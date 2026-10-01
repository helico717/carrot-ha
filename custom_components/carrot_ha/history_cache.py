"""Share expensive battery-history work across cards without caching live state."""
import asyncio
from time import time
from .battery import DEFAULT_SOC_CAPACITY_KWH


async def battery_history(hass, runtime, calculate):
    archive = runtime['archive']
    entry = runtime['entry']
    capacity = entry.options.get('soc_capacity_kwh', DEFAULT_SOC_CAPACITY_KWH)
    zone = hass.config.time_zone
    # Also expire time-dependent coverage when no new events arrive.
    lock = runtime.setdefault('battery_history_lock', asyncio.Lock())
    async with lock:
        key = (getattr(archive, 'revision', 0), capacity, zone, int(time() // 60))
        cached = runtime.get('battery_history_cache')
        if cached and cached[0] == key:
            return await asyncio.shield(cached[1])
        if cached and not cached[1].done():
            await asyncio.shield(cached[1])
        async def compute():
            try:
                return await hass.async_add_executor_job(calculate, archive, entry.data['device_id'], capacity, zone)
            except BaseException:
                if runtime.get('battery_history_cache', (None, None))[1] is asyncio.current_task():
                    runtime.pop('battery_history_cache', None)
                raise
        task = asyncio.create_task(compute())
        # If every HTTP waiter disconnects, still retrieve errors from shared work.
        task.add_done_callback(lambda done: None if done.cancelled() else done.exception())
        runtime['battery_history_cache'] = (key, task)
        return await asyncio.shield(task)
