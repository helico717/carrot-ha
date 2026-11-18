"""One persistent, six-hour GitHub observer per HA instance; no device commands."""
import asyncio
import logging
import time

from .github_actions import ActionsHealth

KEY = 'carrot_ha_github_actions_monitor'
_LOGGER = logging.getLogger(__name__)


class Monitor:
    def __init__(self, store, fetch, create_task, now=time.time):
        self.store, self.fetch, self.create_task = store, fetch, create_task
        self.health = ActionsHealth(now)
        self.entries = set()
        self.task = None
        self.loaded = False
        self.lock = asyncio.Lock()
        self.storage_error = False

    async def attach(self, entry_id):
        async with self.lock:
            if not self.loaded:
                try:
                    self.health = ActionsHealth(self.health.now, await self.store.async_load())
                except Exception:
                    self.storage_error = True
                    _LOGGER.warning('GitHub sync observations could not be loaded; checking again')
                self.loaded = True
            self.entries.add(entry_id)
            if self.task is None or self.task.done():
                self.task = self.create_task(self.run(), 'carrot GitHub sync health')

    async def detach(self, entry_id):
        async with self.lock:
            self.entries.discard(entry_id)
            if not self.entries:
                await self.stop()

    async def stop(self):
        if self.task is not None:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
            self.task = None

    async def tick(self):
        if await self.health.check(self.fetch):
            try:
                await self.store.async_save(self.health.saved)
                self.storage_error = False
            except Exception:
                self.storage_error = True
                _LOGGER.warning('GitHub sync observations could not be persisted')

    async def run(self):
        while True:
            try:
                await self.tick()
            except Exception:
                # An observer error must not terminate monitoring or vehicle latest-state sync.
                _LOGGER.warning('GitHub sync health check unavailable; retrying on the next interval')
            await asyncio.sleep(60)

    def snapshot(self):
        value = self.health.snapshot()
        if self.storage_error:
            value['errors']['storage'] = 'unavailable'
            value['state'] = 'unavailable'
        return value


async def setup(hass, entry, runtime):
    # Keep this outside hass.data[DOMAIN]: older vehicle paths iterate that mapping as entries.
    monitor = hass.data.get(KEY)
    if monitor is None:
        from aiohttp import ClientTimeout
        from homeassistant.helpers.aiohttp_client import async_get_clientsession
        from homeassistant.helpers.storage import Store
        from homeassistant.const import EVENT_HOMEASSISTANT_STOP
        session = async_get_clientsession(hass)

        async def fetch(path):
            async with session.get('https://api.github.com' + path,
                    timeout=ClientTimeout(total=15), allow_redirects=False,
                    headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'Carrot-HA-sync-health'}) as response:
                response.raise_for_status()
                return await response.json()

        monitor = Monitor(Store(hass, 1, 'carrot_ha.github_actions_health'), fetch,
                          hass.async_create_background_task)
        hass.data[KEY] = monitor

        async def stop(event):
            await monitor.stop()
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop)
    await monitor.attach(entry.entry_id)
    runtime['github_actions_monitor'] = monitor


async def unload(runtime):
    monitor = runtime.get('github_actions_monitor')
    if monitor is not None:
        await monitor.detach(runtime['entry'].entry_id)
