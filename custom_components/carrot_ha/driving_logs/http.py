"""HA-authenticated browsing and independently scoped device uploads."""
import asyncio
import hashlib
import hmac
import math
from pathlib import Path
import secrets
import time

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

from .store import CHUNK
from .upload import UploadManager, request_segments
from .runtime import store_for
from .transfer_policy import policy_for, set_enabled, require_permission, public_status


def upload_token(terminal_token):
    return hmac.new(terminal_token.encode(), b'carrot-driving-logs-v1', hashlib.sha256).hexdigest()


def runtime_for(hass, entry_id):
    runtime = hass.data.get('carrot_ha', {}).get(entry_id)
    if not isinstance(runtime, dict) or 'entry' not in runtime:
        raise web.HTTPNotFound()
    return runtime


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
            policy = await policy_for(self.hass, runtime)
            if request.query.get('generation') == policy['generation'] and policy['generation']:
                runtime['driving_log_transfer_ack'] = {'generation': policy['generation'], 'seen': time.monotonic()}
            if not policy['enabled']:
                return web.json_response({'transfer': policy, 'floor': 0, 'complete': {}}, headers={'Cache-Control': 'no-store'})
            store = await store_for(self.hass, runtime)
            return web.json_response({'transfer': policy, 'floor': store.state['floor'], 'complete': {
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
            policy = await policy_for(self.hass, runtime)
            try:
                require_permission(policy, request.headers.get('X-Transfer-Generation'),
                                   float(request.headers.get('X-Recording-Started', 'nan')))
                runtime['driving_log_transfer_ack'] = {'generation': policy['generation'], 'seen': time.monotonic()}
            except ValueError:
                raise web.HTTPForbidden(text='Driving log transfer disabled or expired') from None
            store = await store_for(self.hass, runtime)
            try:
                if action == 'begin':
                    value = await self.hass.async_add_executor_job(store.begin, data)
                elif action == 'commit':
                    value = await self.hass.async_add_executor_job(store.commit, data.get('segment'), data.get('hashes'))
                    runtime['driving_log_last_commit']=time.monotonic()
                else:
                    raise web.HTTPNotFound()
            except (ValueError, KeyError):
                raise web.HTTPConflict(text='Manifest, retention or file verification mismatch')
            except OSError:
                raise web.HTTPInsufficientStorage()
        return web.json_response(value, headers={'Cache-Control': 'no-store'})

    async def put(self, request, device_id, action, segment=None, filename=None):
        runtime = self.runtime(request, device_id)
        # Reject before consuming the upload body when transfer is disabled.
        policy = await policy_for(self.hass, runtime)
        try:
            require_permission(policy, request.headers.get('X-Transfer-Generation'),
                               float(request.headers.get('X-Recording-Started', 'nan')))
            runtime['driving_log_transfer_ack'] = {'generation': policy['generation'], 'seen': time.monotonic()}
        except ValueError:
            raise web.HTTPForbidden(text='Driving log transfer disabled or expired') from None
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
            policy = await policy_for(self.hass, runtime)
            try:
                require_permission(policy, request.headers.get('X-Transfer-Generation'),
                                   float(request.headers.get('X-Recording-Started', 'nan')))
                runtime['driving_log_transfer_ack'] = {'generation': policy['generation'], 'seen': time.monotonic()}
            except ValueError:
                raise web.HTTPForbidden(text='Driving log transfer disabled or expired') from None
            store = await store_for(self.hass, runtime)
            try:
                value = await self.hass.async_add_executor_job(store.chunk, segment, filename, offset, data)
            except (ValueError, KeyError):
                raise web.HTTPConflict(text='Restart from server upload offset')
        return web.json_response(value)


class BrowserView(HomeAssistantView):
    url = '/api/carrot_ha/v1/driving_logs/{entry_id}/{area}/{action}'
    extra_urls = ['/api/carrot_ha/v1/driving_logs/{entry_id}/{area}/{action}/{segment}',
                  '/api/carrot_ha/v1/driving_logs/{entry_id}/{area}/{action}/{segment}/{kind}',
                  '/api/carrot_ha/v1/driving_logs/{entry_id}/{area}/{action}/{segment}/{kind}/{index}']
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

    async def get(self, request, entry_id, area, action, segment=None, kind=None, index=None):
        runtime = self.runtime(request, entry_id)
        if area == 'transfer' and action == 'policy' and segment is None:
            policy = await policy_for(self.hass, runtime)
            return web.json_response(public_status(runtime, policy), headers={'Cache-Control': 'no-store'})
        if area == 'local' and segment is None:
            return await self.local(request,runtime,action)
        if area == 'ai' and segment is None:
            return await self.ai(request, runtime, action)
        if area == 'dashcam' and action == 'v2' and segment:
            from .replay_v2 import RadarJobs, manifest, tool_commands
            async with runtime.setdefault('driving_log_lock', asyncio.Lock()):
                store = await store_for(self.hass, runtime)
                try:
                    base = f'/api/carrot_ha/v1/driving_logs/{entry_id}/dashcam/v2/{segment}'
                    value = await self.hass.async_add_executor_job(manifest, store, runtime['entry'], segment, base)
                    if kind == 'file':
                        if index not in {f['name'] for f in value['segments'][0]['files']}:
                            raise web.HTTPNotFound()
                        path = await self.hass.async_add_executor_job(store.directory, segment)
                        return web.FileResponse(path / index, headers={'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer'})
                    if kind == 'radar':
                        if index != str(value['firstSegment']):
                            raise web.HTTPNotFound()
                        source = await self.hass.async_add_executor_job(store.file, segment, 'rlog')
                except (KeyError, ValueError, StopIteration):
                    raise web.HTTPNotFound()
                except OSError:
                    raise web.HTTPServiceUnavailable()
            if kind == 'radar':
                async with runtime.setdefault('driving_log_v2_init_lock', asyncio.Lock()):
                    jobs = runtime.get('driving_log_v2_jobs')
                    if jobs is None:
                        jobs = runtime['driving_log_v2_jobs'] = await self.hass.async_add_executor_job(RadarJobs, self.hass)
                try:
                    return await jobs.response(source, request.query.get('sensor', 'auto'), request.query.get('radar_track_flip', 'recorded'))
                except OSError:
                    raise web.HTTPServiceUnavailable()
            if kind == 'manifest':
                tool_commands(runtime, value, f'{request.scheme}://{request.host}', entry_id, segment)
                return web.json_response(value, headers={'Cache-Control':'no-store'})
            if kind is None:
                return web.FileResponse(Path(__file__).parent.parent / 'frontend/carrot_logs/v2/route.html', headers={'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'})
            raise web.HTTPNotFound()
        if area == 'dashcam' and action == 'upload':
            return await self.upload(request, runtime, segment)
        if area not in {'dashcam', 'screenrecord'}:
            raise web.HTTPNotFound()
        async with runtime.setdefault('driving_log_lock', asyncio.Lock()):
            store = await store_for(self.hass, runtime)
            if area == 'screenrecord':
                # Screen-recording ingestion belongs to the subsequent full-menu port.
                return web.json_response({'videos': [], 'total': 0, 'hasMore': False})
            if action == 'storage':
                if hasattr(store, 'diagnostics'):
                    storage = await self.hass.async_add_executor_job(store.diagnostics)
                else:
                    storage = {'used': await self.hass.async_add_executor_job(store.usage), 'limit': store.limit,
                               'nas': {'status': 'not_configured'}}
                return web.json_response({'storage': storage, 'maintenance': runtime.get('driving_log_archive_status', {})},
                                         headers={'Cache-Control': 'no-store'})
            try:
                offset = max(0, min(100000, int(request.query.get('offset', 0))))
                limit = max(1, min(2000, int(request.query.get('limit', 40))))
                start = float(request.query['from']) if 'from' in request.query else None
                end = float(request.query['to']) if 'to' in request.query else None
                if any(value is not None and (not math.isfinite(value) or value < 0) for value in (start, end)) or (start is not None and end is not None and start >= end):
                    raise ValueError('Invalid date interval')
                page = None
                if action in {'routes', 'recent'}:
                    page = await self.hass.async_add_executor_job(store.routes, offset, limit, request.query.get('sort', 'desc'), start, end)
                if action == 'routes':
                    value = page
                elif action == 'calendar':
                    catalog = await self.hass.async_add_executor_job(store.routes, 0, 100000)
                    value = {'intervals': [{'start': r['routeStartEpoch'], 'end': r['routeEndEpoch']} for r in catalog['routes']]}
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
                    sizes = store.segment_info(segment)['files']
                    value = {'ok':True, 'mode':'client', 'segment':segment,
                             'segmentIndex':int(segment.rsplit('--',1)[1]),
                             'rlog':{'name':rlog.name, 'size':sizes[rlog.name],
                                     'compression':'zstd' if rlog.name.endswith('.zst') else 'bzip2' if rlog.name.endswith('.bz2') else 'none',
                                     'url':base+'/rlog'},
                             'video':{'name':video.name, 'size':sizes[video.name],
                                      'container':'mp4' if video.name.endswith('.mp4') else 'mpegts', 'url':base+'/video'}}
                elif action in {'video', 'download'} and segment:
                    path = await self.hass.async_add_executor_job(store.file, segment, kind or 'qcamera')
                    headers = {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'}
                    if action == 'download' or request.query.get('download'):
                        headers['Content-Disposition'] = 'attachment; filename="' + path.name + '"'
                    return web.FileResponse(path, headers=headers)
                elif action in {'thumbnail', 'preview'}:
                    return web.Response(status=204, headers={'Cache-Control': 'no-store'})
                else:
                    raise web.HTTPNotImplemented(text='This feature is scheduled for the next log migration stage')
            except (KeyError, StopIteration):
                raise web.HTTPNotFound()
            except ValueError:
                raise web.HTTPBadRequest()
            except OSError:
                raise web.HTTPServiceUnavailable(text='NAS archive is temporarily unavailable; local logs remain accessible')
        return web.json_response(value, headers={'Cache-Control': 'no-store'})

    async def post(self, request, entry_id, area, action, segment=None, kind=None, index=None):
        runtime = self.runtime(request, entry_id)
        if area == 'transfer' and action == 'policy' and segment is None:
            if request.content_type != 'application/json':
                raise web.HTTPUnsupportedMediaType()
            if request.content_length is None or request.content_length > 1024:
                raise web.HTTPBadRequest()
            body = await request.json()
            if not isinstance(body, dict) or type(body.get('enabled')) is not bool:
                raise web.HTTPBadRequest()
            policy = await set_enabled(self.hass, runtime, body['enabled'])
            from homeassistant.helpers.dispatcher import async_dispatcher_send
            async_dispatcher_send(self.hass, 'carrot_ha' + entry_id)
            return web.json_response(public_status(runtime, policy), headers={'Cache-Control': 'no-store'})
        if area == 'local' and segment is None:
            return await self.local(request,runtime,action)
        if area == 'ai' and segment is None:
            return await self.ai(request, runtime, action)
        if index is not None:
            raise web.HTTPNotFound()
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

    async def ai(self, request, runtime, action):
        from .ai import AiManager, AnalysisError
        headers = {'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'}
        async with runtime.setdefault('driving_ai_init_lock', asyncio.Lock()):
            if 'driving_ai' not in runtime:
                runtime['driving_ai'] = AiManager(self.hass, runtime)
            manager = runtime['driving_ai']
        try:
            if request.method == 'GET' and action == 'config':
                value = await manager.config()
            elif request.method == 'GET' and action == 'models':
                value = await manager.models()
            elif request.method == 'GET' and action == 'job':
                value = manager.snapshot(request.query.get('id',''))
            elif request.method == 'POST':
                if request.content_type != 'application/json':
                    raise web.HTTPUnsupportedMediaType()
                if request.content_length is None or request.content_length > 16*1024:
                    raise web.HTTPRequestEntityTooLarge(max_size=16*1024, actual_size=request.content_length or 0)
                body = await request.json()
                if not isinstance(body,dict):raise ValueError('invalid_request')
                if action == 'config':value = await manager.config(body)
                elif action == 'start':value = await manager.start(body)
                elif action == 'cancel':value = manager.cancel(str(body.get('id','')))
                else:raise web.HTTPNotFound()
            else:raise web.HTTPNotFound()
        except AnalysisError as error:
            return web.json_response({'error':error.message,'code':error.code},status=error.status,headers=headers)
        except (ValueError,TypeError,KeyError):
            return web.json_response({'error':'요청 값 또는 선택한 로그를 확인해 주세요.'},status=400,headers=headers)
        except OSError:
            return web.json_response({'error':'분석 설정 파일을 읽거나 저장하지 못했습니다.'},status=503,headers=headers)
        return web.json_response(value,headers=headers)

    async def local(self,request,runtime,action):
        from .local_analysis import manager_for
        from .ai import AnalysisError
        manager=await manager_for(self.hass,runtime)
        headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}
        try:
            if request.method=='GET':
                if action=='status':value=await manager.public_status()
                elif action=='config':value=await manager.config()
                elif action=='job':value=manager.snapshot(request.query.get('id',''))
                elif action=='result':value=await manager.result({'route':request.query.get('route','latest')})
                else:raise web.HTTPNotFound()
            elif request.method=='POST':
                if request.content_type!='application/json':raise web.HTTPUnsupportedMediaType()
                if request.content_length is None or request.content_length>128*1024:
                    raise web.HTTPRequestEntityTooLarge(max_size=128*1024,actual_size=request.content_length or 0)
                body=await request.json()
                if not isinstance(body,dict):raise ValueError('invalid_request')
                if action=='config':value=await manager.config(body)
                elif action=='start':value=await manager.start(body)
                elif action=='result':value=await manager.result(body)
                elif action=='cancel':value=manager.cancel(str(body.get('id','')))
                else:raise web.HTTPNotFound()
            else:raise web.HTTPNotFound()
        except AnalysisError as error:
            return web.json_response({'error':error.message,'code':error.code},status=error.status,headers=headers)
        except (ValueError,KeyError,TypeError):
            return web.json_response({'error':'분석 범위 또는 설정 값을 확인해 주세요.'},status=400,headers=headers)
        except OSError:
            return web.json_response({'error':'저장 로그 또는 분석 캐시에 접근하지 못했습니다.'},status=503,headers=headers)
        return web.json_response(value,headers=headers)

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


class ToolsView(HomeAssistantView):
    url = '/api/carrot_ha/v1/driving_logs_tools/{entry_id}/{token}/{tail:.*}'
    name = 'api:carrot_ha:driving_logs_tools'
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, entry_id, token, tail):
        runtime = runtime_for(self.hass, entry_id)
        item = runtime.get('driving_log_v2_tokens', {}).get(token)
        if not item or item['expires'] <= time.monotonic():
            raise web.HTTPUnauthorized()
        name = item['segment']
        async with runtime.setdefault('driving_log_lock', asyncio.Lock()):
            store = await store_for(self.hass, runtime)
            try:
                info = await self.hass.async_add_executor_job(store.segment_info, name)
                if not info['complete']:
                    raise KeyError(name)
                prefix = f'/api/carrot_ha/v1/driving_logs_tools/{entry_id}/{token}'
                headers = {'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}
                if tail.startswith('file/'):
                    filename = tail[5:]
                    if filename not in info['files']:
                        raise web.HTTPNotFound()
                    directory = await self.hass.async_add_executor_job(store.directory, name)
                    return web.FileResponse(directory / filename, headers=headers)
                tail = tail.replace('api//v1/', 'api/v1/')
                canonical = item['canonical']
                if tail == f'api/v1/route/{canonical}/files':
                    groups = {'logs':[],'qlogs':[],'cameras':[],'ecameras':[],'qcameras':[]}
                    for filename in info['files']:
                        group = {'rlog':'logs','qlog':'qlogs','fcamera':'cameras','ecamera':'ecameras','qcamera':'qcameras'}.get(filename.split('.')[0])
                        if group:
                            groups[group].append(f'{request.scheme}://{request.host}{prefix}/file/{filename}')
                    value = groups
                elif tail == f'api/v1/route/{canonical}':
                    value = {'fullname':canonical,'maxrlog':int(name.rsplit('--',1)[1]),'maxqlog':int(name.rsplit('--',1)[1]),'segmentCount':1}
                elif tail == 'api/v1/me/devices/':
                    value = [{'dongle_id':item['device'],'alias':'HA selected segment','device_type':'shared'}]
                elif tail == f"api/v1/devices/{item['device']}/routes_segments":
                    value = [{'fullname':canonical,'maxqlog':int(name.rsplit('--',1)[1]),'start_time_utc_millis':int(info['recorded']*1000),'end_time_utc_millis':int((info['recorded']+60)*1000)}]
                elif tail == 'api/v1/routes/preserved':
                    value = []
                else:
                    raise web.HTTPNotFound()
                return web.json_response(value, headers=headers)
            except (KeyError, ValueError):
                raise web.HTTPNotFound()
            except OSError:
                raise web.HTTPServiceUnavailable()


def register(hass):
    for cls in (SessionView, DeviceView, BrowserView, ToolsView):
        hass.http.register_view(cls(hass))
