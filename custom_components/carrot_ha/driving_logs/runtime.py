"""NAS archive lifecycle, separate from telemetry and journal synchronization."""
import asyncio
import json
import logging
from pathlib import Path

from .store import LogStore
from .tiered import TieredLogStore

_LOGGER = logging.getLogger(__name__)


def configured_path(hass, entry):
    if 'driving_logs_nas_path' in entry.options:
        return str(entry.options['driving_logs_nas_path']).strip()
    path = Path(hass.config.path('carrot_ha', 'driving-logs-settings.json'))
    if not path.exists():
        return ''
    data = json.loads(path.read_text(encoding='utf-8'))
    return str(data.get('devices', {}).get(entry.data['device_id'], {}).get('nas_path', '')).strip()


def create_store(hass, entry):
    root = hass.config.path('carrot_ha', 'driving-logs', entry.entry_id)
    path = configured_path(hass, entry)
    return TieredLogStore(root, path, entry.data['device_id']) if path else LogStore(root)


async def store_for(hass, runtime):
    if 'driving_log_store' not in runtime:
        runtime['driving_log_store'] = await hass.async_add_executor_job(create_store, hass, runtime['entry'])
    return runtime['driving_log_store']


async def maintain(hass, runtime):
    while True:
        delay = 30
        try:
            async with runtime.setdefault('driving_log_lock', asyncio.Lock()):
                store = await store_for(hass, runtime)
                if not isinstance(store, TieredLogStore):
                    return
                worker = asyncio.ensure_future(hass.async_add_executor_job(store.maintain))
                try:
                    result = await asyncio.shield(worker)
                except asyncio.CancelledError:
                    # An executor keeps writing after coroutine cancellation. Finish
                    # it before an entry reload can open a second index writer.
                    await worker
                    raise
                previous = runtime.get('driving_log_archive_status', {}).get('phase')
                runtime['driving_log_archive_status'] = result
                if previous != result['phase']:
                    _LOGGER.info('Driving log archive phase: %s', result)
                if result['phase'] in ('archiving', 'restoring'):
                    delay = 0.2
        except (OSError, ValueError, KeyError):
            runtime['driving_log_archive_status'] = {'phase': 'retrying'}
            _LOGGER.warning('Driving log archive maintenance deferred; local recordings retained', exc_info=True)
        await asyncio.sleep(delay)


def setup(hass, entry, runtime):
    task = hass.async_create_background_task(maintain(hass, runtime), 'carrot log archive')
    runtime['driving_log_archive_task'] = task
    entry.async_on_unload(task.cancel)
    async def analyze_latest():
        from .local_analysis import manager_for
        manager=await manager_for(hass,runtime)
        await manager.loop()
    analysis=hass.async_create_background_task(analyze_latest(),'carrot last-drive free analysis')
    runtime['driving_local_task']=analysis
    entry.async_on_unload(analysis.cancel)
