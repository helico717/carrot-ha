"""Poll the MyID4-compatible Worker; credentials never reach the frontend."""
import asyncio
import json
import logging
from urllib.parse import urlencode
from datetime import datetime, timezone
from aiohttp import ClientTimeout
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_send
from .cloud_feed import parse_feed
from .charge_costs import refresh_runtime_costs

_LOGGER = logging.getLogger(__name__)

class CloudHTTPError(Exception):
    def __init__(self, status, path):
        self.status = status
        self.path = path.split('?')[0]

async def sync_trip_changes(hass, runtime, get, save):
    """Bounded, durable revision cursor; only compatibility errors enable legacy sync."""
    now = datetime.now(timezone.utc).timestamp()
    if now < runtime.get('trip_changes_retry_at', 0):
        return False
    archive = runtime['archive']
    cursor = int(await hass.async_add_executor_job(archive.cursor, 'trip_changes') or 0)
    for _ in range(10):
        try:
            feed = await get('/api/trip-changes?' + urlencode({
                'device_id': runtime['entry'].data['device_id'], 'after': cursor, 'limit': 10}))
        except CloudHTTPError as error:
            if error.status in (404, 409):
                runtime['trip_changes_retry_at'] = now + 3600
                return False
            raise
        trips = feed.get('trips')
        next_cursor = feed.get('next_cursor')
        more = feed.get('has_more')
        if (feed.get('schema') != 'carrot-trip-changes-v1' or not isinstance(trips, list)
                or type(next_cursor) is not int or type(more) is not bool):
            raise ValueError('Invalid trip change page')
        sequences = [trip.get('sync_sequence') for trip in trips]
        if (any(type(seq) is not int or seq <= cursor for seq in sequences)
                or sequences != sorted(set(sequences))
                or any(not isinstance(trip.get('id'), str) or not trip['id'] for trip in trips)
                or next_cursor != (sequences[-1] if sequences else cursor)
                or (more and not trips)):
            raise ValueError('Trip change cursor did not advance')
        await save({'trips': trips})
        # On any partial write failure, retry the entire page. put_cloud is idempotent.
        await hass.async_add_executor_job(archive.cursor, 'trip_changes', next_cursor)
        cursor = next_cursor
        if not more:
            break
    return True

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
        fallback_trips = None
        try:
            feed = await get('/api/latest-state?' + urlencode({'device_id': entry.data['device_id']}))
        except CloudHTTPError as error:
            # Keep older or temporarily failing Workers usable by falling back to /api/json
            _LOGGER.warning('Carrot latest-state endpoint unavailable (HTTP %s); falling back to /api/json', error.status)
            feed = await get('/api/json')
            fallback_trips = feed.get('trips')
        await save({'state': feed.get('state')})
        if fallback_trips and isinstance(fallback_trips, list):
            await save({'trips': fallback_trips})
        # Recent trips must not wait behind an offline telemetry backlog.
        try:
            incremental_trips = await sync_trip_changes(hass, runtime, get, save)
        except CloudHTTPError as trip_error:
            incremental_trips = True  # Never turn transient errors into a full rescan.
            _LOGGER.warning('Carrot trip changes unavailable: HTTP %s; retrying next sync', trip_error.status)
        cursor = await hass.async_add_executor_job(runtime['archive'].cursor, 'telemetry')
        for _ in range(10):
            try:
                history = await get('/api/telemetry-history?' + urlencode({'after': cursor, 'limit': 100, 'device_id': entry.data['device_id']}))
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
        offset = 0
        try:
            if not incremental_trips:
                offset = int(await hass.async_add_executor_job(runtime['archive'].cursor, 'trip_offset') or 0)
                seen = runtime.setdefault('trip_sync_seen', set())
                if offset == 0:
                    seen.clear()
                # Bound each run; resume the remaining pages on the next scheduled sync.
                for _ in range(10):
                    feed = await get(f'/api/trips?limit=10&offset={offset}&include_route=true')
                    trips = feed.get('trips')
                    if not isinstance(trips, list):
                        raise ValueError('Invalid trips response')
                    ids = [trip.get('id') for trip in trips]
                    if any(not isinstance(key, str) or not key for key in ids):
                        raise ValueError('Invalid trip ID')
                    if trips and not set(ids).difference(seen):
                        await hass.async_add_executor_job(runtime['archive'].cursor, 'trip_offset', 0)
                        seen.clear()
                        raise ValueError('Trip pagination did not advance')
                    await save({'trips': trips})
                    seen.update(ids)
                    offset += len(trips)
                    if len(trips) < 10:
                        runtime['cloud_trip_count'] = offset
                        await hass.async_add_executor_job(runtime['archive'].cursor, 'trip_offset', 0)
                        seen.clear()
                        break
                    await hass.async_add_executor_job(runtime['archive'].cursor, 'trip_offset', offset)
                    await asyncio.sleep(0)
        except CloudHTTPError as trip_error:
            _LOGGER.warning('Carrot trip sync unavailable: HTTP %s at %s; preserving state and existing history', trip_error.status, trip_error.path)
            if not fallback_trips and offset == 0 and runtime.get('trip_changes_retry_at', 0):
                try:
                    legacy_feed = await get('/api/json')
                    if isinstance(legacy_feed.get('trips'), list):
                        await save({'trips': legacy_feed['trips']})
                except Exception as legacy_error:
                    _LOGGER.debug('Carrot fallback /api/json trip sync failed: %s', type(legacy_error).__name__)
        runtime['summary'] = await hass.async_add_executor_job(runtime['archive'].overview, entry.data['device_id'])
        await refresh_runtime_costs(hass, runtime)
        runtime['cloud_status'] = 'ok'
        runtime['cloud_last_sync'] = datetime.now(timezone.utc).isoformat()
    except asyncio.CancelledError:
        raise
    except CloudHTTPError as error:
        runtime['cloud_status'] = 'HTTP_' + str(error.status)
        _LOGGER.warning('Carrot cloud sync failed: HTTP %s at %s; will retry on the next scheduled sync', error.status, error.path)
    except Exception as error:
        runtime['cloud_status'] = 'error'
        # Exception messages can contain credential-bearing URLs; log only type.
        _LOGGER.warning('Carrot cloud sync failed (%s); will retry on the next scheduled sync', type(error).__name__)
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
