"""Authenticated reverse terminal relay with a single administrator lease."""
import asyncio
from contextlib import suppress
import hmac
import json
import time
import uuid

from aiohttp import WSMsgType, web


PROTOCOL = 1
MAX_CONTROL_BYTES = 8192
MAX_DEVICE_BYTES = 131072
LEASE_SECONDS = 15 * 60


class TerminalRelay:
    def __init__(self, token, changed=lambda: None, *, clock=time.monotonic):
        self.token = token
        self.changed = changed
        self.clock = clock
        self.ws = None
        self.generation = None
        self.offroad = False
        self.local_ready = False
        self.last_status = 0.0
        self.session_id = None
        self.controller = None
        self.lease_deadline = 0.0
        self.subscribers = {}
        self.send_lock = asyncio.Lock()
        self.monitor_task = None

    @property
    def connected(self):
        return self.ws is not None and not self.ws.closed

    @property
    def ready(self):
        return self.connected and self.offroad and self.local_ready and self.clock() - self.last_status < 10

    def snapshot(self):
        return {
            'type': 'status',
            'connected': self.connected,
            'offroad': self.offroad,
            'local_ready': self.local_ready,
            'ready': self.ready,
            'active': self.session_id is not None,
            'controller': self.controller is not None,
            'lease_remaining': max(0, int(self.lease_deadline - self.clock())) if self.controller is not None else 0,
        }

    async def start(self):
        self.monitor_task = asyncio.create_task(self._monitor(), name='carrot terminal lease')

    async def close(self):
        await self._end_session('integration_unloaded')
        if self.ws is not None:
            await self.ws.close()
        if self.monitor_task is not None:
            self.monitor_task.cancel()
            with suppress(asyncio.CancelledError):
                await self.monitor_task
            self.monitor_task = None
        self.subscribers.clear()

    def subscribe(self, key, callback, controller_key=None):
        self.subscribers[key] = callback
        controller_key = key if controller_key is None else controller_key

        async def unsubscribe():
            self.subscribers.pop(key, None)
            if self.controller == controller_key:
                await self.release(controller_key, 'browser_disconnected')

        return unsubscribe

    def _notify(self, payload):
        for callback in list(self.subscribers.values()):
            try:
                callback(payload)
            except Exception:
                pass
        self.changed()

    async def _send(self, payload):
        if not self.connected:
            raise RuntimeError('Comma terminal agent is offline')
        encoded = json.dumps(payload, separators=(',', ':')).encode()
        if len(encoded) > MAX_CONTROL_BYTES:
            raise ValueError('Terminal control message is too large')
        async with self.send_lock, asyncio.timeout(5):
            await self.ws.send_json(payload)

    async def acquire(self, key):
        if not self.ready:
            raise RuntimeError('Comma terminal is not ready or the vehicle is onroad')
        if self.controller not in (None, key):
            raise RuntimeError('Another administrator controls this terminal')
        self.controller = key
        self.lease_deadline = self.clock() + LEASE_SECONDS
        if self.session_id is None:
            self.session_id = str(uuid.uuid4())
            try:
                await self._send({'type': 'start', 'session_id': self.session_id, 'cols': 100, 'rows': 30})
            except Exception:
                self.session_id = None
                self.controller = None
                self.lease_deadline = 0
                raise
        self._notify(self.snapshot())
        return {'session_id': self.session_id, **self.snapshot()}

    async def input(self, key, message):
        if self.controller != key or self.session_id is None:
            raise RuntimeError('Terminal control lease is not held')
        if self.clock() >= self.lease_deadline:
            await self.release(key, 'lease_expired')
            raise RuntimeError('Terminal control lease expired')
        if not self.ready:
            await self.release(key, 'device_not_offroad')
            raise RuntimeError('Comma terminal is no longer available')
        if not isinstance(message, dict):
            raise ValueError('Invalid terminal input')
        kind = message.get('type')
        if kind == 'raw':
            data = message.get('data')
            if not isinstance(data, str) or not data or len(data.encode('utf-8')) > 4096:
                raise ValueError('Invalid terminal input')
            local = {'type': 'raw', 'data': data}
        elif kind == 'control' and message.get('action') in ('ctrl_c', 'clear', 'refresh'):
            local = {'type': 'control', 'action': message['action']}
        else:
            raise ValueError('Unsupported terminal input')
        self.lease_deadline = self.clock() + LEASE_SECONDS
        await self._send({'type': 'input', 'session_id': self.session_id, 'message': local})
        return {'lease_remaining': LEASE_SECONDS}

    async def release(self, key, reason='released'):
        if self.controller != key:
            return
        await self._end_session(reason)

    async def _end_session(self, reason):
        session_id = self.session_id
        self.session_id = None
        self.controller = None
        self.lease_deadline = 0
        if session_id is not None and self.connected:
            with suppress(ConnectionError, RuntimeError, TimeoutError):
                await self._send({'type': 'stop', 'session_id': session_id, 'reason': reason})
        self._notify({'type': 'ended', 'reason': reason})
        self._notify(self.snapshot())

    async def _monitor(self):
        while True:
            await asyncio.sleep(3)
            if self.controller is not None and self.clock() >= self.lease_deadline:
                await self._end_session('lease_expired')
            elif self.session_id is not None and not self.ready:
                await self._end_session('device_not_offroad')

    async def device(self, request):
        credential = request.headers.get('Authorization', '')
        if not hmac.compare_digest(credential.encode(), ('Bearer ' + self.token).encode()):
            raise web.HTTPUnauthorized()
        if self.connected:
            raise web.HTTPConflict(text='Device already connected')
        ws = web.WebSocketResponse(heartbeat=10, max_msg_size=MAX_DEVICE_BYTES, compress=False)
        generation = uuid.uuid4().hex
        self.ws = ws
        self.generation = generation
        try:
            await ws.prepare(request)
            await ws.send_json({'type': 'hello', 'protocol': PROTOCOL})
            async for message in ws:
                if message.type != WSMsgType.TEXT:
                    if message.type == WSMsgType.ERROR:
                        break
                    raise ValueError('Only JSON terminal messages are accepted')
                if len(message.data.encode()) > MAX_DEVICE_BYTES:
                    raise ValueError('Terminal message is too large')
                data = message.json()
                if not isinstance(data, dict):
                    raise ValueError('Invalid terminal message')
                kind = data.get('type')
                if kind == 'status' and data.get('protocol') == PROTOCOL:
                    self.offroad = data.get('offroad') is True
                    self.local_ready = data.get('local_ready') is True
                    self.last_status = self.clock()
                    if not self.offroad and self.session_id is not None:
                        await self._end_session('device_not_offroad')
                    self._notify(self.snapshot())
                elif kind == 'terminal':
                    if data.get('session_id') != self.session_id or not isinstance(data.get('message'), dict):
                        continue
                    payload = data['message']
                    if payload.get('type') not in ('meta', 'pty_output', 'pty_resize', 'pty_exit', 'error'):
                        raise ValueError('Unsupported local terminal message')
                    self._notify({'type': 'terminal', 'message': payload})
                elif kind == 'started' and data.get('session_id') == self.session_id:
                    self._notify({'type': 'started', 'session_id': self.session_id})
                elif kind == 'ended' and data.get('session_id') == self.session_id:
                    await self._end_session(str(data.get('reason') or 'device_ended')[:80])
                else:
                    raise ValueError('Invalid terminal device message')
        except (ValueError, TypeError):
            if ws.prepared:
                await ws.close(code=1008, message=b'Invalid terminal protocol')
        finally:
            if self.generation == generation:
                self.ws = None
                self.generation = None
                self.offroad = False
                self.local_ready = False
                self.last_status = 0
                await self._end_session('device_disconnected')
        return ws
