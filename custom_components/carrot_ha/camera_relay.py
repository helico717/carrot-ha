"""Authenticated device WebSocket to private loopback MPEG-TS feeds."""
import asyncio
from contextlib import suppress
import hmac
import secrets
import time

from aiohttp import WSMsgType, web

from .camera_session import CAMERAS, HEADER, MAX_PAYLOAD, CameraSession


class CameraRelay:
    def __init__(self, token, changed=lambda: None):
        self.token = token
        self.changed = changed
        self.session = CameraSession()
        self.ws = None
        self.runner = None
        self.task = None
        self.base_url = None
        self.tickets = {}
        self.send_lock = asyncio.Lock()

    @property
    def ready(self):
        return self.ws is not None and not self.ws.closed and self.session.ready

    async def start(self):
        app = web.Application()
        app.router.add_get('/{ticket}/{camera}.ts', self.feed, allow_head=False)
        self.runner = web.AppRunner(app, access_log=None, shutdown_timeout=2)
        await self.runner.setup()
        site = web.TCPSite(self.runner, '127.0.0.1', 0)
        await site.start()
        self.base_url = f'http://127.0.0.1:{self.runner.addresses[0][1]}'
        self.task = asyncio.create_task(self.monitor(), name='carrot camera lease')

    def source(self, camera):
        if camera not in CAMERAS:
            raise ValueError('Unknown camera')
        for key, ticket in self.tickets.items():
            if ticket['camera'] == camera and self.valid(key):
                return f'{self.base_url}/{key}/{camera}.ts'
        # At most one live capability per camera; requesting a URL is inert.
        for key in list(self.tickets):
            if self.tickets[key]['camera'] == camera:
                del self.tickets[key]
        key = secrets.token_urlsafe(32)
        self.tickets[key] = {'camera': camera, 'session': None, 'valid': True, 'created': time.monotonic()}
        return f'{self.base_url}/{key}/{camera}.ts'

    def valid(self, key):
        ticket = self.tickets.get(key)
        return bool(ticket and ticket['valid'] and (
            ticket['session'] is not None or time.monotonic() - ticket['created'] < 60))

    def source_valid(self, url):
        return bool(url and self.valid(url.rsplit('/', 2)[-2]))

    def invalidate_session(self, session_id):
        for ticket in self.tickets.values():
            if ticket['session'] == session_id:
                ticket['valid'] = False

    async def commands(self, commands):
        for command in commands:
            if command['type'] == 'stop':
                self.invalidate_session(command['session_id'])
            if self.ws is not None and not self.ws.closed:
                try:
                    async with self.send_lock, asyncio.timeout(3):
                        await self.ws.send_json(command)
                except (ConnectionError, RuntimeError, TimeoutError):
                    await self.ws.close()
        self.changed()

    async def monitor(self):
        while True:
            await asyncio.sleep(3)
            await self.commands(self.session.tick())
            if self.session.generation is None and self.ws is not None:
                await self.ws.close()

    async def device(self, request):
        credential = request.headers.get('Authorization', '')
        if not hmac.compare_digest(credential.encode(), ('Bearer ' + self.token).encode()):
            raise web.HTTPUnauthorized()
        if self.ws is not None:
            raise web.HTTPConflict(text='Device already connected')
        ws = web.WebSocketResponse(heartbeat=10, max_msg_size=HEADER.size + MAX_PAYLOAD, compress=False)
        # Reserve before awaiting prepare: simultaneous connects cannot replace ownership.
        generation = self.session.connect()
        self.ws = ws
        try:
            await ws.prepare(request)
            await ws.send_json({'type': 'hello', 'protocol': 1})
            async for message in ws:
                if message.type == WSMsgType.BINARY:
                    await self.commands(self.session.accept_media(generation, message.data))
                elif message.type == WSMsgType.TEXT:
                    if len(message.data) > 4096:
                        raise ValueError('Control message too large')
                    data = message.json()
                    if not isinstance(data, dict):
                        raise ValueError('Invalid control message')
                    if data.get('type') == 'status' and data.get('protocol') == 1:
                        await self.commands(self.session.device_status(generation, offroad=data.get('offroad')))
                    elif data.get('type') == 'ended' and data.get('session_id') == self.session.session_id:
                        await self.commands(self.session.stop('device_ended'))
                    else:
                        raise ValueError('Invalid control message')
                elif message.type == WSMsgType.ERROR:
                    break
        except (ValueError, TypeError, ConnectionError, RuntimeError):
            if ws.prepared:
                await ws.close(code=1008, message=b'Invalid or interrupted camera connection')
        finally:
            commands = self.session.disconnect(generation)
            for command in commands:
                self.invalidate_session(command['session_id'])
            self.ws = None
            self.changed()
        return ws

    async def feed(self, request):
        key, camera = request.match_info['ticket'], request.match_info['camera']
        if not self.valid(key) or self.tickets[key]['camera'] != camera:
            raise web.HTTPForbidden()
        if not self.ready:
            raise web.HTTPServiceUnavailable()
        try:
            reader, commands = self.session.subscribe(camera)
        except (RuntimeError, ValueError):
            raise web.HTTPServiceUnavailable() from None
        self.tickets[key]['session'] = self.session.session_id
        response = web.StreamResponse(headers={'Content-Type': 'video/mp2t', 'Cache-Control': 'no-store'})
        try:
            await self.commands(commands)
            # Wait for actual media before returning HTTP 200 to the demuxer.
            first = await asyncio.wait_for(reader.queue.get(), 25)
            if first is None:
                raise web.HTTPServiceUnavailable()
            await response.prepare(request)
            async with asyncio.timeout(5):
                await response.write(first)
            while not reader.closed:
                packet = await asyncio.wait_for(reader.queue.get(), 12)
                if packet is None:
                    break
                async with asyncio.timeout(5):
                    await response.write(packet)
        except (ConnectionError, TimeoutError):
            if not response.prepared:
                raise web.HTTPGatewayTimeout() from None
        finally:
            await self.commands(self.session.unsubscribe(reader))
        return response

    async def stop_camera(self, camera):
        for ticket in self.tickets.values():
            if ticket['camera'] == camera:
                ticket['valid'] = False
        for reader in tuple(self.session.readers):
            if reader.camera == camera:
                await self.commands(self.session.unsubscribe(reader))

    async def close(self):
        await self.commands(self.session.stop('integration_unloaded'))
        if self.ws is not None:
            await self.ws.close()
        if self.task is not None:
            self.task.cancel()
            with suppress(asyncio.CancelledError):
                await self.task
        if self.runner is not None:
            await self.runner.cleanup()
