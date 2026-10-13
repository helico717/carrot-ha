"""Entry lifecycle: background local sync independent of latest-state refresh."""
import asyncio
import logging
from datetime import timedelta
from pathlib import Path
from .store import Journal
from .source import sync

_LOGGER=logging.getLogger(__name__)


async def setup(hass, entry, runtime):
    journal=await hass.async_add_executor_job(Journal,
        hass.config.path('carrot_ha','vehicle_journal',entry.entry_id+'.sqlite3'),
        entry.entry_id,entry.data['device_id'],hass.config.time_zone)
    from .vehicles import manager
    journal=await manager(hass).attach(entry,runtime,journal)
    runtime['journal']=journal
    runtime['archive'].journal_guard=lambda: sync(runtime['archive'],journal,True)
    from homeassistant.core import callback
    from homeassistant.helpers.event import async_track_time_interval

    async def run():
        try:
            await hass.async_add_executor_job(journal.cleanup_purged_photos)
            await hass.async_add_executor_job(sync,runtime['archive'],journal)
            runtime.pop('journal_error',None)
            from .automatic_locations import enrich
            try:await enrich(hass,manager(hass),runtime['archive'],journal)
            except Exception:runtime['journal_location_error']='충전소 위치 조회를 다시 시도하고 있어요.'
        except Exception:
            runtime['journal_error']='차계부 동기화를 다시 시도하고 있어요.'
            _LOGGER.exception('Local vehicle journal synchronization failed')

    @callback
    def schedule(_=None):
        if not runtime.get('journal_task') or runtime['journal_task'].done():
            runtime['journal_task']=hass.async_create_background_task(run(),'carrot local journal sync')

    entry.async_on_unload(async_track_time_interval(hass,schedule,timedelta(seconds=60)))
    entry.async_on_unload(lambda: runtime['archive'].__setattr__('journal_guard',None))
    schedule()
