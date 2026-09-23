"""Poll the MyID4-compatible Worker; credentials never reach the frontend."""
import asyncio
import json
import logging
from datetime import datetime, timezone
from aiohttp import ClientTimeout
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_send
from .cloud_feed import parse_feed

_LOGGER = logging.getLogger(__name__)

class CloudHTTPError(Exception):
    def __init__(self, status, path):
        self.status = status
        self.path = path.split('?')[0]

async def sync(hass, runtime):
    entry = runtime['entry']
    base = entry.options.get('cloud_url', '').rstrip('/')
    token = entry.options.get('cloud_view_token', '')
    if not base or not token or runtime.get('syncing'):
        return
    runtime['syncing'] = True
    runtime['cloud_status'] = 'syncing'
    session = async_get_clientsession(hass)
    async def get(path):
        async with session.get(base + path, headers={'Authorization': 'Bearer ' + token,
                                                    'User-Agent': 'CarrotHA/0.5.2',
                                                    'Accept': 'application/json'},
                               timeout=ClientTimeout(total=45), allow_redirects=False) as response:
            if response.status != 200:
                raise CloudHTTPError(response.status, path)
            return await response.json()

    async def save(feed):
        for event in parse_feed(feed, entry.data['device_id']):
            async with runtime['lock']:
                await hass.async_add_executor_job(runtime['archive'].put_cloud, event)
                if event['kind'] == 'state':
                    previous = runtime['latest']
                    if not previous or datetime.fromisoformat(event['observed_at'].replace('Z', '+00:00')) >= datetime.fromisoformat(previous['observed_at'].replace('Z', '+00:00')):
                        runtime['latest'] = event
            async_dispatcher_send(hass, 'carrot_ha' + entry.entry_id)

    async def archive_history(feed):
        """Store historical telemetry in DB without updating runtime['latest'].

        When a device reconnects after being offline, buffered telemetry
        arrives oldest-first.  Updating runtime['latest'] for each record
        would cause the dashboard to replay stale vehicle states.
        """
        nonlocal history_ingested
        for event in parse_feed(feed, entry.data['device_id']):
            async with runtime['lock']:
                await hass.async_add_executor_job(runtime['archive'].put_cloud, event)
                history_ingested = True

    history_ingested = False
    try:
        feed = await get('/api/json')
        await save({'state': feed.get('state')})
        cursor = await hass.async_add_executor_job(runtime['archive'].cursor, 'telemetry')
        while True:
            try:
                history = await get(f'/api/telemetry-history?after={cursor}&limit=20')
            except CloudHTTPError as error:
                if error.status == 404:
                    runtime['history_supported'] = False
                    break
                raise
            runtime['history_supported'] = True
            for item in history['events']:
                payload = json.loads(item['raw_json'])
                await archive_history({'state':{'device_id':payload['deviceId'],'updated_at':payload['updatedAt'],'onroad':payload.get('onroad'),'raw_json':payload}})
                cursor = item['sequence']
                await hass.async_add_executor_job(runtime['archive'].cursor,'telemetry',cursor)
            if not history['has_more']:break
        offset = count = 0
        while True:
            feed = await get(f'/api/trips?limit=10&offset={offset}&include_route=true')
            trips = feed.get('trips')
            if not isinstance(trips, list):
                raise ValueError('Invalid trips response')
            await save({'trips': trips})
            count += len(trips)
            if len(trips) < 10:
                break
            offset += len(trips)
            await asyncio.sleep(0)
        runtime['cloud_trip_count'] = count
        runtime['summary'] = await hass.async_add_executor_job(runtime['archive'].overview, entry.data['device_id'])
        runtime['cloud_status'] = 'ok'
        runtime['cloud_last_sync'] = datetime.now(timezone.utc).isoformat()
    except asyncio.CancelledError:
        raise
    except CloudHTTPError as error:
        runtime['cloud_status'] = 'HTTP_' + str(error.status)
        _LOGGER.warning('Carrot cloud sync failed: HTTP %s at %s; will retry in 5 minutes', error.status, error.path)
    except Exception as error:
        runtime['cloud_status'] = 'error'
        # Exception messages can contain credential-bearing URLs; log only type.
        _LOGGER.warning('Carrot cloud sync failed (%s); will retry in 5 minutes', type(error).__name__)
    finally:
        try:
            if history_ingested:
                async with runtime['lock']:
                    db_latest = await hass.async_add_executor_job(runtime['archive'].latest, entry.data['device_id'])
                    previous = runtime['latest']
                    if db_latest and (not previous or datetime.fromisoformat(db_latest['observed_at'].replace('Z', '+00:00')) >= datetime.fromisoformat(previous['observed_at'].replace('Z', '+00:00'))):
                        runtime['latest'] = db_latest
        finally:
            runtime['syncing'] = False
            async_dispatcher_send(hass, 'carrot_ha' + entry.entry_id)
