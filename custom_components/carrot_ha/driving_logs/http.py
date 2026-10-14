"""HA-authenticated browsing and independently scoped device uploads."""
import asyncio
import hashlib
import hmac
import secrets
import time

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

from .store import CHUNK, LogStore
from .upload import UploadManager, request_segments


def upload_token(terminal_token):
    return hmac.new(terminal_token.encode(), b'carrot-driving-logs-v1', hashlib.sha256).hexdigest()


def runtime_for(hass, entry_id):
    runtime = hass.data.get('carrot_ha', {}).get(entry_id)
    if not isinstance(runtime, dict) or 'entry' not in runtime:
        raise web.HTTPNotFound()
    return runtime


async def store_for(hass, runtime):
    if 'driving_log_store' not in runtime:
        runtime['driving_log_store'] = await hass.async_add_executor_job(
            LogStore, hass.config.path('carrot_ha', 'driving-logs', runtime['entry'].entry_id))
    return runtime['driving_log_store']


class SessionView(HomeAssistantView):
    url = '/api/carrot_ha/v1/driving_logs/{entry_id}/session'
    name = 'api:carrot_ha:driving_logs_session'

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request, entry_id):
        runtime = runtime_for(self.hass, entry_id)
        if not request['hass_user'].is_admin:
            raise web.HTTPForbidden()
        sessions = runtime.setdefault('driving_log_sessions', {})
        now = time.monotonic()
        for key, expiry in list(sessions.items()):
            if expiry <= now:
                del sessions[key]
        previous = request.cookies.get('carrot_logs')
        if previous:
            sessions.pop(previous, None)
        if len(sessions) >= 32:
            raise web.HTTPTooManyRequests()
        key = secrets.token_urlsafe(32)
        sessions[key] = now + 3600
        base = '/api/carrot_ha/v1/driving_logs/' + entry_id
        response = web.json_response({'base': base,
            'enabled': bool(runtime['entry'].options.get('terminal_enabled')),
            'expires_in': 3600})
        response.set_cookie('carrot_logs', key, path=base, httponly=True,
                            secure=request.secure or request.headers.get('X-Forwarded-Proto') == 'https',
                            samesite='Strict', max_age=3600)
        response.headers['Cache-Control'] = 'no-store'
        return response


class DeviceView(HomeAssistantView):
    url = '/api/carrot_ha/v1/driving_logs_upload/{device_id}/{action}'
    extra_urls = ['/api/carrot_ha/v1/driving_logs_upload/{device_id}/{action}/{segment}/{filename}']
    name = 'api:carrot_ha:driving_logs_upload'
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    def runtime(self, request, device_id):
        for runtime in self.hass.data.get('carrot_ha', {}).values():
            if isinstance(runtime, dict) and 'entry' in runtime:
                entry = runtime['entry']
                if entry.data['device_id'] == device_id:
                    token = entry.options.get('terminal_token', '')
                    if (entry.options.get('terminal_enabled') and len(token) >= 32 and
                            hmac.compare_digest(request.headers.get('Authorization', '').encode(), ('Bearer ' + upload_token(token)).encode())):
                        return runtime
        raise web.HTTPUnauthorized()

    async def get(self, request, device_id, action, segment=None, filename=None):
        runtime = self.runtime(request, device_id)
        if action != 'state':
            raise web.HTTPNotFound()
        async with runtime.setdefault('driving_log_lock', asyncio.Lock()):
            store = await store_for(self.hass, runtime)
            return web.json_response({'floor': store.state['floor'], 'complete': {
                name: item['recorded'] for name, item in store.state['segments'].items() if item['complete']
            }}, headers={'Cache-Control': 'no-store'})

    async def post(self, request, device_id, action, segment=None, filename=None):
        runtime = self.runtime(request, device_id)
        if request.content_length is None or request.content_length > 16 * 1024:
            raise web.HTTPRequestEntityTooLarge(max_size=16 * 1024, actual_size=request.content_length or 0)
        data = await request.json()
        if not isinstance(data, dict):
            raise web.HTTPBadRequest()
        lock = runtime.setdefault('driving_log_lock', asyncio.Lock())
        async with lock:
            store = await store_for(self.hass, runtime)
            try:
                if action == 'begin':
                    value = await self.hass.async_add_executor_job(store.begin, data)
                elif action == 'commit':
                    value = await self.hass.async_add_executor_job(store.commit, data.get('segment'), data.get('hashes'))
                else:
                    raise web.HTTPNotFound()
            except (ValueError, KeyError):
                raise web.HTTPConflict(text='Manifest, retention or file verification mismatch')
            except OSError:
                raise web.HTTPInsufficientStorage()
        return web.json_response(value, headers={'Cache-Control': 'no-store'})

    async def put(self, request, device_id, action, segment=None, filename=None):
        runtime = self.runtime(request, device_id)
        if action != 'chunk' or not segment or not filename:
            raise web.HTTPNotFound()
        if request.content_length is None or not 0 < request.content_length <= CHUNK:
            raise web.HTTPRequestEntityTooLarge(max_size=CHUNK, actual_size=request.content_length or 0)
        try:
            offset = int(request.headers.get('X-Upload-Offset', '-1'))
        except ValueError:
            raise web.HTTPBadRequest()
        data = await request.read()
        async with runtime.setdefault('driving_log_lock', asyncio.Lock()):
            store = await store_for(self.hass, runtime)
            try:
                value = await self.hass.async_add_executor_job(store.chunk, segment, filename, offset, data)
            except (ValueError, KeyError):
                raise web.HTTPConflict(text='Restart from server upload offset')
        return web.json_response(value)


class BrowserView(HomeAssistantView):
    url = '/api/carrot_ha/v1/driving_logs/{entry_id}/{area}/{action}'
    extra_urls = ['/api/carrot_ha/v1/driving_logs/{entry_id}/{area}/{action}/{segment}',
                  '/api/carrot_ha/v1/driving_logs/{entry_id}/{area}/{action}/{segment}/{kind}']
    name = 'api:carrot_ha:driving_logs_browser'
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    def runtime(self, request, entry_id):
        runtime = runtime_for(self.hass, entry_id)
        key = request.cookies.get('carrot_logs', '')
        if runtime.get('driving_log_sessions', {}).get(key, 0) <= time.monotonic():
            raise web.HTTPUnauthorized()
        return runtime

    async def get(self, request, entry_id, area, action, segment=None, kind=None):
        runtime = self.runtime(request, entry_id)
        if area == 'dashcam' and action == 'upload':
            return await self.upload(request, runtime, segment)
        if area not in {'dashcam', 'screenrecord'}:
            raise web.HTTPNotFound()
        async with runtime.setdefault('driving_log_lock', asyncio.Lock()):
            store = await store_for(self.hass, runtime)
            if area == 'screenrecord':
                # Screen-recording ingestion belongs to the subsequent full-menu port.
                return web.json_response({'videos': [], 'total': 0, 'hasMore': False})
            try:
                offset = max(0, min(100000, int(request.query.get('offset', 0))))
                limit = max(1, min(2000, int(request.query.get('limit', 40))))
                page = await self.hass.async_add_executor_job(store.routes, offset, limit, request.query.get('sort', 'desc'))
                if action == 'routes':
                    value = page
                elif action == 'segments' and segment:
                    all_routes = await self.hass.async_add_executor_job(store.routes, 0, 2000, request.query.get('sort', 'desc'))
                    route = next(r for r in all_routes['routes'] if r['route'] == segment)
                    names = route['segmentFolders']
                    value = {**route, 'segments': names[offset:offset + limit], 'nextOffset': offset + limit,
                             'hasMore': offset + limit < len(names), 'total': len(names)}
                elif action == 'read-state':
                    value = runtime.get('driving_log_read_state', {'recentSegment': ''})
                elif action == 'recent':
                    value = {'segments': [n for r in page['routes'] for n in r['segmentFolders']][:limit]}
                elif action == 'replay-source' and segment:
                    rlog = await self.hass.async_add_executor_job(store.file, segment, 'rlog')
                    video = await self.hass.async_add_executor_job(store.file, segment, 'qcamera')
                    base = f'/api/carrot_ha/v1/driving_logs/{entry_id}/dashcam/replay-source/{segment}'
                    if kind:
                        path = rlog if kind == 'rlog' else video if kind == 'video' else None
                        if path is None:
                            raise web.HTTPNotFound()
                        return web.FileResponse(path, headers={'Cache-Control':'private, no-store'})
                    value = {'ok':True, 'mode':'client', 'segment':segment,
                             'segmentIndex':int(segment.rsplit('--',1)[1]),
                             'rlog':{'name':rlog.name, 'size':rlog.stat().st_size,
                                     'compression':'zstd' if rlog.name.endswith('.zst') else 'bzip2' if rlog.name.endswith('.bz2') else 'none',
                                     'url':base+'/rlog'},
                             'video':{'name':video.name, 'size':video.stat().st_size,
                                      'container':'mp4' if video.name.endswith('.mp4') else 'mpegts', 'url':base+'/video'}}
                elif action in {'video', 'download'} and segment:
                    path = await self.hass.async_add_executor_job(store.file, segment, kind or 'qcamera')
                    headers = {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'}
                    if action == 'download' or request.query.get('download'):
                        headers['Content-Disposition'] = 'attachment; filename="' + path.name + '"'
                    return web.FileResponse(path, headers=headers)
                elif action in {'thumbnail', 'preview'}:
                    return web.Response(text='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#15202b"/><text x="230" y="190" fill="white">HA Driving Log</text></svg>', content_type='image/svg+xml')
                else:
                    raise web.HTTPNotImplemented(text='This feature is scheduled for the next log migration stage')
            except (KeyError, StopIteration):
                raise web.HTTPNotFound()
            except ValueError:
                raise web.HTTPBadRequest()
        return web.json_response(value, headers={'Cache-Control': 'no-store'})

    async def post(self, request, entry_id, area, action, segment=None, kind=None):
        runtime = self.runtime(request, entry_id)
        if area == 'dashcam' and action == 'upload':
            return await self.upload(request, runtime, segment)
        if area == 'dashcam' and action == 'read-state':
            body = await request.json()
            value = body.get('recentSegment', '')
            if not isinstance(value, str) or len(value) > 128:
                raise web.HTTPBadRequest()
            runtime['driving_log_read_state'] = {'recentSegment': value}
            return web.json_response({'ok': True, 'recentSegment': value})
        raise web.HTTPNotImplemented(text='로그 서버 전송과 분석은 다음 단계에서 연결됩니다.')

    async def upload(self, request, runtime, action):
        async with runtime.setdefault('driving_log_lock', asyncio.Lock()):
            store = await store_for(self.hass, runtime)
            if 'driving_log_upload' not in runtime:
                runtime['driving_log_upload'] = UploadManager(self.hass, runtime, store)
            manager = runtime['driving_log_upload']
            try:
                if request.method == 'GET' and action == 'job':
                    value = manager.snapshot(manager.jobs[request.query.get('id', '')])
                elif request.method == 'POST':
                    if request.content_length is None or request.content_length > 256 * 1024:
                        raise web.HTTPRequestEntityTooLarge(max_size=256 * 1024, actual_size=request.content_length or 0)
                    body = await request.json()
                    if not isinstance(body, dict):
                        raise ValueError('Invalid request')
                    if action == 'cancel':
                        value = manager.cancel(str(body.get('id') or ''))
                    elif action in {'summary', 'start'}:
                        names, include_all = request_segments(body)
                        value = manager.summary(names, include_all) if action == 'summary' else manager.start(names, include_all)
                    else:
                        raise web.HTTPNotFound()
                else:
                    raise web.HTTPNotFound()
            except KeyError:
                return web.json_response({'ok': False, 'error': 'Log segment or upload job not found'}, status=404)
            except (ValueError, StopIteration) as error:
                return web.json_response({'ok': False, 'error': str(error)}, status=409 if str(error) == 'Upload already running' else 400)
        return web.json_response(value, headers={'Cache-Control': 'no-store'})


def register(hass):
    for cls in (SessionView, DeviceView, BrowserView):
        hass.http.register_view(cls(hass))
