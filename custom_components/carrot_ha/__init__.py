import asyncio
import hmac
import json
from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from .storage import Archive
from .protocol import MAX_BYTES

DOMAIN = 'carrot_ha'

async def async_setup(hass, config):
    hass.data.setdefault(DOMAIN, {})
    from pathlib import Path
    from homeassistant.components.http import StaticPathConfig
    await hass.http.async_register_static_paths([StaticPathConfig('/carrot_ha_static', str(Path(__file__).parent / 'frontend'), False)])
    version = await hass.async_add_executor_job(_read_frontend_version)
    hass.http.register_view(FrontendVersionView(version))
    hass.http.register_view(ReceiveView(hass))
    hass.http.register_view(HistoryView(hass))
    hass.http.register_view(DevicesView(hass))
    hass.http.register_view(DashboardView(hass))
    hass.http.register_view(SettingsView(hass))
    hass.http.register_view(ParamSetView(hass))
    hass.http.register_view(ParamStatusView(hass))

    async def async_handle_purge(call):
        for runtime in hass.data.get(DOMAIN, {}).values():
            if isinstance(runtime, dict) and 'archive' in runtime:
                await hass.async_add_executor_job(runtime['archive'].purge_expired)
                await hass.async_add_executor_job(runtime['archive'].vacuum)
                runtime['summary'] = await hass.async_add_executor_job(runtime['archive'].overview, runtime['entry'].data['device_id'])
                async_dispatcher_send(hass, DOMAIN + runtime['entry'].entry_id)

    hass.services.async_register(DOMAIN, 'purge_database', async_handle_purge)
    return True

async def async_setup_entry(hass, entry):
    archive = await hass.async_add_executor_job(Archive, hass.config.path('carrot_ha', entry.entry_id + '.sqlite3'))
    latest = await hass.async_add_executor_job(archive.latest, entry.data['device_id'])
    hass.data[DOMAIN][entry.entry_id] = {'entry': entry, 'archive': archive, 'lock': asyncio.Lock(), 'latest': latest}
    hass.data[DOMAIN][entry.entry_id]['summary'] = await hass.async_add_executor_job(archive.overview, entry.data['device_id'])
    await hass.config_entries.async_forward_entry_setups(entry, ['sensor','binary_sensor','device_tracker'])
    entry.async_on_unload(entry.add_update_listener(_options_updated))
    from datetime import timedelta
    from homeassistant.helpers.event import async_track_time_interval
    from .cloud import sync
    runtime = hass.data[DOMAIN][entry.entry_id]
    @callback
    def start_sync(now=None):
        if not runtime.get('cloud_task') or runtime['cloud_task'].done():
            runtime['cloud_task'] = hass.async_create_background_task(sync(hass, runtime), 'carrot cloud sync')
    entry.async_on_unload(async_track_time_interval(hass, start_sync, timedelta(seconds=60)))
    start_sync()

    async def run_daily_purge(now=None):
        await hass.async_add_executor_job(archive.purge_expired)
        runtime['summary'] = await hass.async_add_executor_job(archive.overview, entry.data['device_id'])
        async_dispatcher_send(hass, DOMAIN + entry.entry_id)

    async def run_weekly_vacuum(now=None):
        await hass.async_add_executor_job(archive.vacuum)

    entry.async_on_unload(async_track_time_interval(hass, lambda _: hass.async_create_task(run_daily_purge()), timedelta(days=1)))
    entry.async_on_unload(async_track_time_interval(hass, lambda _: hass.async_create_task(run_weekly_vacuum()), timedelta(days=7)))
    hass.async_create_task(run_daily_purge())

    return True

async def _options_updated(hass, entry):
    from .cloud import sync
    runtime = hass.data[DOMAIN][entry.entry_id]
    task = runtime.get('cloud_task')
    if task and not task.done():
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
    runtime['cloud_task'] = hass.async_create_background_task(sync(hass, runtime), 'carrot cloud sync')
    async_dispatcher_send(hass, DOMAIN + entry.entry_id)

async def async_unload_entry(hass, entry):
    if await hass.config_entries.async_unload_platforms(entry, ['sensor','binary_sensor','device_tracker']):
        task = hass.data[DOMAIN][entry.entry_id].get('cloud_task')
        if task and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        hass.data[DOMAIN].pop(entry.entry_id, None)
        return True
    return False

class ReceiveView(HomeAssistantView):
    url = '/api/carrot_ha/v1/events'
    name = 'api:carrot_ha:events'
    requires_auth = False  # Dedicated per-device bearer credentials checked below.

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request):
        credential = request.headers.get('Authorization', '')
        runtime = next((r for r in self.hass.data[DOMAIN].values() if hmac.compare_digest(credential.encode(), ('Bearer ' + r['entry'].data['token']).encode())), None)
        if runtime is None:
            return web.Response(status=401)
        raw = bytearray()
        async for chunk in request.content.iter_chunked(8192):
            raw.extend(chunk)
            if len(raw) > MAX_BYTES:
                return web.Response(status=413)
        try:
            event = json.loads(raw)
            if not isinstance(event, dict) or event.get('device_id') != runtime['entry'].data['device_id']:
                return web.Response(status=403)
            async with runtime['lock']:
                await self.hass.async_add_executor_job(runtime['archive'].put, event)
                if event['kind'] == 'state':
                    from datetime import datetime
                    previous = runtime['latest']
                    if not previous or datetime.fromisoformat(event['observed_at'].replace('Z', '+00:00')) >= datetime.fromisoformat(previous['observed_at'].replace('Z', '+00:00')):
                        runtime['latest'] = event
                        async_dispatcher_send(self.hass, DOMAIN + runtime['entry'].entry_id)
        except (ValueError, KeyError, TypeError, OverflowError, RecursionError):
            return web.Response(status=400)
        return web.json_response({'accepted': event['event_id'], 'device_id': event['device_id']})

class HistoryView(HomeAssistantView):
    url = '/api/carrot_ha/v1/history/{entry_id}'
    name = 'api:carrot_ha:history'
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, entry_id):
        # Location history is restricted to an authenticated administrator.
        if not request['hass_user'].is_admin:
            return web.Response(status=403)
        runtime = self.hass.data[DOMAIN].get(entry_id)
        if runtime is None:
            return web.Response(status=404)
        try:
            kind = request.query.get('kind', 'trip')
            limit = int(request.query.get('limit', '100'))
            offset = int(request.query.get('offset', '0'))
            rows = await self.hass.async_add_executor_job(runtime['archive'].history, runtime['entry'].data['device_id'], kind, limit, offset, request.query.get('since'))
        except ValueError:
            return web.Response(status=400)
        if kind == 'trip' and rows:
            capacity = runtime['entry'].options.get('soc_capacity_kwh', 78.0)
            rows = await self.hass.async_add_executor_job(
                runtime['archive'].enrich_trips_energy,
                runtime['entry'].data['device_id'], rows, capacity)
        return web.json_response({'events': rows, 'offset': offset, 'limit': limit})

class DevicesView(HomeAssistantView):
    url = '/api/carrot_ha/v1/devices'
    name = 'api:carrot_ha:devices'
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request):
        if not request['hass_user'].is_admin:
            return web.Response(status=403)
        return web.json_response({'devices': [
            {'entry_id': key, 'device_id': value['entry'].data['device_id'], 'name': value['entry'].title,
             'cloud_status': value.get('cloud_status', 'not_configured'),
             'cloud_trip_count': value.get('cloud_trip_count'), 'cloud_last_sync': value.get('cloud_last_sync')}
            for key, value in self.hass.data[DOMAIN].items()
        ]})

class DashboardView(HomeAssistantView):
    url='/api/carrot_ha/v1/dashboard/{entry_id}'
    name='api:carrot_ha:dashboard'
    requires_auth=True
    def __init__(self,hass):self.hass=hass
    async def get(self,request,entry_id):
        if not request['hass_user'].is_admin:return web.Response(status=403)
        runtime=self.hass.data[DOMAIN].get(entry_id)
        if runtime is None:return web.Response(status=404)
        from .vehicle import values
        from .battery_history import history
        data=values(runtime)
        from homeassistant.helpers import entity_registry as er
        registry=er.async_get(self.hass)
        data['entity_ids']={key:registry.async_get_entity_id('binary_sensor', DOMAIN, runtime['entry'].data['device_id']+'_'+key) for key in ('charging','comma_online','emergency_charging')}
        data['vehicle_model']=runtime['entry'].options.get('vehicle_model','Volkswagen MEB')
        data['battery_history']=await self.hass.async_add_executor_job(history,runtime['archive'],runtime['entry'].data['device_id'],runtime['entry'].options.get('soc_capacity_kwh',78.0),self.hass.config.time_zone)
        return web.json_response({'device_id':runtime['entry'].data['device_id'],'values':data})


def _read_frontend_version():
    """Read the installed manifest in HA's executor, never in the event loop."""
    from pathlib import Path
    return json.loads((Path(__file__).parent / 'manifest.json').read_text(encoding='utf-8'))['version']


class FrontendVersionView(HomeAssistantView):
    """Public installed version only; no vehicle data or credentials."""
    url = '/api/carrot_ha/frontend-version'
    name = 'api:carrot_ha:frontend_version'
    requires_auth = False

    def __init__(self, version):
        self.version = version

    async def get(self, request):
        try:
            version = _read_frontend_version()
        except Exception:
            version = self.version
        return web.json_response({'version': version}, headers={'Cache-Control': 'no-store'})


class SettingsView(HomeAssistantView):
    url = '/api/carrot_ha/v1/settings/{entry_id}'
    name = 'api:carrot_ha:settings'
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, entry_id):
        if not request['hass_user'].is_admin:
            return web.Response(status=403)
        runtime = self.hass.data[DOMAIN].get(entry_id)
        if runtime is None:
            return web.Response(status=404)

        base = runtime['entry'].options.get('cloud_url', '').rstrip('/')
        token = runtime['entry'].options.get('cloud_view_token', '')
        device_id = runtime['entry'].data['device_id']

        if not base or not token:
            return web.json_response({'ok': False, 'error': 'cloud_not_configured'}, status=400)

        from homeassistant.helpers.aiohttp_client import async_get_clientsession
        from aiohttp import ClientTimeout
        session = async_get_clientsession(self.hass)
        try:
            async with session.get(
                f"{base}/api/settings?device_id={device_id}",
                headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'},
                timeout=ClientTimeout(total=15)
            ) as resp:
                data = await resp.json()
                return web.json_response(data, status=resp.status)
        except Exception as err:
            return web.json_response({'ok': False, 'error': str(err)}, status=502)


class ParamSetView(HomeAssistantView):
    url = '/api/carrot_ha/v1/param_set/{entry_id}'
    name = 'api:carrot_ha:param_set'
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request, entry_id):
        if not request['hass_user'].is_admin:
            return web.Response(status=403)
        runtime = self.hass.data[DOMAIN].get(entry_id)
        if runtime is None:
            return web.Response(status=404)

        base = runtime['entry'].options.get('cloud_url', '').rstrip('/')
        token = runtime['entry'].options.get('cloud_view_token', '')
        device_id = runtime['entry'].data['device_id']

        if not base or not token:
            return web.json_response({'ok': False, 'error': 'cloud_not_configured'}, status=400)

        try:
            body = await request.json()
        except Exception:
            return web.json_response({'ok': False, 'error': 'invalid_json'}, status=400)

        name = body.get('name')
        value = body.get('value')
        if name is None or value is None:
            return web.json_response({'ok': False, 'error': 'missing_name_or_value'}, status=400)

        from homeassistant.helpers.aiohttp_client import async_get_clientsession
        from aiohttp import ClientTimeout
        session = async_get_clientsession(self.hass)
        try:
            payload = {'device_id': device_id, 'param_name': name, 'param_value': value}
            async with session.post(
                f"{base}/api/params/queue",
                json=payload,
                headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/json'},
                timeout=ClientTimeout(total=10)
            ) as resp:
                data = await resp.json()
                return web.json_response(data, status=resp.status)
        except Exception as err:
            return web.json_response({'ok': False, 'error': str(err)}, status=502)


class ParamStatusView(HomeAssistantView):
    url = '/api/carrot_ha/v1/param_status/{entry_id}'
    name = 'api:carrot_ha:param_status'
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, entry_id):
        if not request['hass_user'].is_admin:
            return web.Response(status=403)
        runtime = self.hass.data[DOMAIN].get(entry_id)
        if runtime is None:
            return web.Response(status=404)

        base = runtime['entry'].options.get('cloud_url', '').rstrip('/')
        token = runtime['entry'].options.get('cloud_view_token', '')
        device_id = runtime['entry'].data['device_id']

        if not base or not token:
            return web.json_response({'ok': False, 'error': 'cloud_not_configured'}, status=400)

        from homeassistant.helpers.aiohttp_client import async_get_clientsession
        from aiohttp import ClientTimeout
        session = async_get_clientsession(self.hass)
        try:
            async with session.get(
                f"{base}/api/params/status?device_id={device_id}",
                headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'},
                timeout=ClientTimeout(total=10)
            ) as resp:
                data = await resp.json()
                return web.json_response(data, status=resp.status)
        except Exception as err:
            return web.json_response({'ok': False, 'error': str(err)}, status=502)

