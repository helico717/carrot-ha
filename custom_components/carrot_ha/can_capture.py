"""Bounded, opt-in raw CAN analysis files, entirely separate from the archive DB."""
import gzip
import hashlib
import hmac
import json
import os
import re
import threading
import time
import zlib
from pathlib import Path
from aiohttp import web
from homeassistant.components.http import HomeAssistantView

MAX_BODY = 4 * 1024 * 1024
MAX_WIRE = 512 * 1024
MAX_DISK = 20 * 1024 * 1024 * 1024
IDENTITY = re.compile(r'^[0-9a-f]{32}-[0-9]{10}$')


class CaptureFiles:
    def __init__(self, root):
        self.root = Path(root)
        self.lock = threading.RLock()
        self.root.mkdir(parents=True, exist_ok=True)
        try:
            self.policy = json.loads((self.root / 'capture.json').read_text())
        except (OSError, ValueError):
            self.policy = {'until': 0}
        self.size = sum(p.stat().st_size for p in self.root.glob('*.json.gz'))
        self.count = len(list(self.root.glob('*.json.gz')))
        self.last = None

    def start(self, hours=12, max_gb=20):
        if type(hours) not in (int, float) or not 0 < hours <= 24:
            raise ValueError('Capture duration must be 0–24 hours')
        if type(max_gb) not in (int, float) or not 1 <= max_gb <= 500:
            raise ValueError('Storage limit must be 1–500 GiB')
        with self.lock:
            self.policy = {'until': time.time() + hours * 3600, 'limit_bytes': int(max_gb * 1024**3)}
            self._save_policy()
            return self.status()

    def stop(self):
        with self.lock:
            self.policy = {'until': 0}
            self._save_policy()
            return self.status()

    def _save_policy(self):
        temp = self.root / 'capture.json.tmp'
        temp.write_text(json.dumps(self.policy))
        temp.replace(self.root / 'capture.json')

    def status(self):
        with self.lock:
            return dict(enabled=time.time() < self.policy.get('until', 0) and self.size < self.policy.get('limit_bytes', MAX_DISK),
                        until=self.policy.get('until', 0), bytes=self.size, batches=self.count,
                        last_batch=self.last, limit_bytes=self.policy.get('limit_bytes', MAX_DISK), directory=str(self.root))

    def store(self, key, compressed, device):
        if not IDENTITY.fullmatch(key):
            raise ValueError('Invalid batch identity')
        if len(compressed) > MAX_WIRE:
            raise ValueError('Batch too large')
        # Bound decompression before parsing untrusted input.
        import io
        with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
            raw = stream.read(MAX_BODY + 1)
        if len(raw) > MAX_BODY:
            raise ValueError('Decoded batch too large')
        data = json.loads(raw)
        if data.get('schema') != 1 or data.get('device') != device or data.get('batch_id') != key:
            raise ValueError('Batch identity mismatch')
        frames = data.get('frames')
        if not isinstance(frames, list) or not 1 <= len(frames) <= 30000:
            raise ValueError('Invalid frames')
        if type(data.get('unix_ns')) is not int or type(data.get('boot_ns')) is not int:
            raise ValueError('Missing clock anchors')
        for frame in frames:
            if (not isinstance(frame, list) or len(frame) != 4
                    or any(type(v) is not int for v in frame[:3])
                    or frame[0] < 0 or not 0 <= frame[1] <= 0x1fffffff or not 0 <= frame[2] <= 255
                    or not isinstance(frame[3], str) or not re.fullmatch(r'(?:[0-9a-f]{2}){0,64}', frame[3])):
                raise ValueError('Invalid CAN frame')
        with self.lock:
            path = self.root / (key + '.json.gz')
            if path.exists():
                if hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256(compressed).digest():
                    raise ValueError('Batch ID reused')
                return {'ok': True, 'batch_id': key, 'duplicate': True}
            if not self.status()['enabled']:
                raise PermissionError('Capture inactive or storage limit reached')
            if self.size + len(compressed) > self.policy.get('limit_bytes', MAX_DISK):
                raise PermissionError('Capture storage limit reached')
            temp = path.with_suffix('.tmp')
            with temp.open('wb') as stream:
                stream.write(compressed)
                stream.flush()
                os.fsync(stream.fileno())
            temp.replace(path)
            self.size += len(compressed)
            self.count += 1
            self.last = dict(batch_id=key, received_at=time.time(), frames=len(frames),
                             dropped_frames=data.get('dropped_frames', 0), context=data.get('context', {}))
            status_temp = self.root / 'status.json.tmp'
            status_temp.write_text(json.dumps(self.status()))
            status_temp.replace(self.root / 'status.json')
            return {'ok': True, 'batch_id': key}


class CanCaptureView(HomeAssistantView):
    url = '/api/carrot_ha/v1/can-capture/{device_id}'
    name = 'api:carrot_ha:can_capture'
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    def runtime(self, request, device_id):
        credential = request.headers.get('Authorization', '').encode()
        for runtime in self.hass.data.get('carrot_ha', {}).values():
            if not isinstance(runtime, dict) or 'entry' not in runtime:
                continue
            entry = runtime['entry']
            token = entry.options.get('terminal_token', '')
            if (entry.data['device_id'] == device_id and entry.options.get('terminal_enabled')
                    and len(token) >= 32 and hmac.compare_digest(credential, ('Bearer ' + token).encode())):
                return runtime
        raise web.HTTPUnauthorized()

    async def get(self, request, device_id):
        runtime = self.runtime(request, device_id)
        return web.json_response(await self.hass.async_add_executor_job(runtime['can_capture'].status))

    async def post(self, request, device_id):
        runtime = self.runtime(request, device_id)
        if request.content_length is not None and request.content_length > MAX_WIRE:
            raise web.HTTPRequestEntityTooLarge(max_size=MAX_WIRE, actual_size=request.content_length)
        payload = bytearray()
        async for part in request.content.iter_chunked(65536):
            payload.extend(part)
            if len(payload) > MAX_WIRE:
                raise web.HTTPRequestEntityTooLarge(max_size=MAX_WIRE, actual_size=len(payload))
        try:
            result = await self.hass.async_add_executor_job(runtime['can_capture'].store,
                request.headers.get('X-Can-Batch', ''), bytes(payload), device_id)
        except PermissionError:
            raise web.HTTPConflict(text='Capture stopped or storage full')
        except (ValueError, OSError, EOFError, TypeError, AttributeError, zlib.error):
            raise web.HTTPBadRequest(text='Invalid CAN batch')
        return web.json_response(result)


def register(hass):
    import voluptuous as vol
    hass.http.register_view(CanCaptureView(hass))

    async def handle(call):
        runtime = hass.data.get('carrot_ha', {}).get(call.data['entry_id'])
        if not isinstance(runtime, dict) or 'can_capture' not in runtime:
            raise ValueError('Unknown vehicle entry')
        if not runtime['entry'].options.get('terminal_enabled'):
            raise ValueError('Configure the existing remote terminal HA URL and credentials first')
        if call.service == 'start_can_capture':
            await hass.async_add_executor_job(runtime['can_capture'].start, call.data.get('hours', 12), call.data.get('max_gb', 20))
        else:
            await hass.async_add_executor_job(runtime['can_capture'].stop)

    hass.services.async_register('carrot_ha', 'start_can_capture', handle,
        schema=vol.Schema({vol.Required('entry_id'): str, vol.Optional('hours', default=12): vol.All(vol.Coerce(float), vol.Range(min=0.01, max=24)), vol.Optional('max_gb', default=20): vol.All(vol.Coerce(float), vol.Range(min=1, max=500))}))
    hass.services.async_register('carrot_ha', 'stop_can_capture', handle,
        schema=vol.Schema({vol.Required('entry_id'): str}))
