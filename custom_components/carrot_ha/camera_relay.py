"""Authenticated device WebSocket to private loopback MPEG-TS feeds."""
import asyncio
from contextlib import suppress
import hmac
import logging
import secrets
import time
import uuid

from aiohttp import WSMsgType, web

from .camera_session import CAMERAS, HEADER, MAX_PAYLOAD, CameraSession

RETRYABLE_STOPS = {'device_ended', 'device_disconnected', 'source_timeout'}
MAX_CAPTURE_ATTEMPTS = 3  # Initial capture plus two retries within the same deadline.
_LOGGER = logging.getLogger(__name__)


class CameraRelay:
    def __init__(self, token, changed=lambda: None, *, clock=time.monotonic):
        self.token = token
        self.changed = changed
        self.clock = clock
        self.session = CameraSession(clock)
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
        self.tickets[key] = {'camera': camera, 'session': None, 'valid': True,
                             'created': self.clock(), 'deadline': None, 'attempts': 0}
        return f'{self.base_url}/{key}/{camera}.ts'

    def valid(self, key):
        ticket = self.tickets.get(key)
        return bool(ticket and ticket['valid'] and (
            self.clock() < ticket['deadline'] if ticket['deadline'] is not None
            else self.clock() - ticket['created'] < 60))

    def source_valid(self, url):
        return bool(url and self.valid(url.rsplit('/', 2)[-2]))

    def invalidate_session(self, session_id, reason=None):
        for ticket in self.tickets.values():
            if ticket['session'] == session_id:
                if reason not in RETRYABLE_STOPS or ticket['attempts'] >= MAX_CAPTURE_ATTEMPTS:
                    ticket['valid'] = False

    async def commands(self, commands):
        for command in commands:
            if command['type'] == 'stop':
                self.invalidate_session(command['session_id'], command.get('reason'))
                if command.get('reason') in RETRYABLE_STOPS:
                    _LOGGER.warning('Camera capture interrupted: %s', command['reason'])
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
                        if data.get('offroad') is not True:
                            # Also revoke pending retries not attached to a
                            # currently active capture session.
                            for ticket in self.tickets.values():
                                ticket['valid'] = False
                        await self.commands(self.session.device_status(generation, offroad=data.get('offroad')))
                    elif data.get('type') == 'ended':
                        # Capture teardown can finish after stop or after a new
                        # viewer has started. An old completion is not a protocol
                        # violation and must not disconnect the current session.
                        ended_session = data.get('session_id')
                        if not isinstance(ended_session, str):
                            raise ValueError('Missing ended session')
                        uuid.UUID(ended_session)
                        if ended_session == self.session.session_id:
                            await self.commands(self.session.stop('device_ended'))
                    else:
                        raise ValueError('Invalid control message')
                elif message.type == WSMsgType.ERROR:
                    break
        except (ValueError, TypeError):
            for ticket in self.tickets.values():
                ticket['valid'] = False
            if ws.prepared:
                await ws.close(code=1008, message=b'Invalid or interrupted camera connection')
        except (ConnectionError, RuntimeError):
            if ws.prepared:
                await ws.close()
        finally:
            commands = self.session.disconnect(generation)
            for command in commands:
                self.invalidate_session(command['session_id'], command.get('reason'))
            self.ws = None
            self.changed()
        return ws

    async def feed(self, request):
        key, camera = request.match_info['ticket'], request.match_info['camera']
        if not self.valid(key) or self.tickets[key]['camera'] != camera:
            raise web.HTTPForbidden()
        if not self.ready:
            raise web.HTTPServiceUnavailable()
        ticket = self.tickets[key]
        try:
            reader, commands = self.session.subscribe(camera, deadline=ticket['deadline'])
        except (RuntimeError, ValueError):
            raise web.HTTPServiceUnavailable() from None
        if ticket['session'] != self.session.session_id:
            ticket['attempts'] += 1
        ticket['session'] = self.session.session_id
        ticket['deadline'] = min(ticket['deadline'] or self.session.deadline, self.session.deadline)
        stop_reason = 'no_viewers'
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
        except TimeoutError:
            stop_reason = 'source_timeout'
            if not response.prepared:
                raise web.HTTPGatewayTimeout() from None
        except ConnectionError:
            if not response.prepared:
                raise web.HTTPGatewayTimeout() from None
        finally:
            await self.commands(self.session.unsubscribe(reader, reason=stop_reason))
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
