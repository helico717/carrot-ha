"""Archive configuration and executor shutdown without loading HA itself."""
import asyncio
import importlib
from pathlib import Path
import sys
import tempfile
import threading
import types
import unittest
from unittest.mock import AsyncMock, patch

package = types.ModuleType('archive_runtime_test')
package.__path__ = [str(Path(__file__).parents[1] / 'custom_components/carrot_ha/driving_logs')]
sys.modules[package.__name__] = package
module = importlib.import_module(package.__name__ + '.runtime')


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_options_override_seed_settings_including_explicit_disable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'carrot_ha').mkdir()
            module_path = root / 'carrot_ha/driving-logs-settings.json'
            module_path.write_text('{"devices":{"car":{"nas_path":"/share/backup/driving-logs"}}}')
            hass = types.SimpleNamespace(config=types.SimpleNamespace(path=lambda *parts: str(root.joinpath(*parts))))
            entry = types.SimpleNamespace(options={}, data={'device_id': 'car'})
            self.assertEqual(module.configured_path(hass, entry), '/share/backup/driving-logs')
            entry.options['driving_logs_nas_path'] = ''
            self.assertEqual(module.configured_path(hass, entry), '')
            entry.options['driving_logs_nas_path'] = '/media/other/driving-logs'
            self.assertEqual(module.configured_path(hass, entry), '/media/other/driving-logs')

    async def test_unload_waits_for_index_writer_before_allowing_reload(self):
        started, release = threading.Event(), threading.Event()
        def worker():
            started.set()
            release.wait(5)
            return {'phase': 'ready'}
        store = object.__new__(module.TieredLogStore)
        store.maintain = worker
        hass = types.SimpleNamespace(async_add_executor_job=lambda fn, *args: asyncio.to_thread(fn, *args))
        with patch.object(module, 'store_for', AsyncMock(return_value=store)):
            task = asyncio.create_task(module.maintain(hass, {}))
            try:
                self.assertTrue(await asyncio.to_thread(started.wait, 2))
                task.cancel()
                await asyncio.sleep(0.03)
                self.assertFalse(task.done(), 'Reload must not race an executor still writing the index')
            finally:
                release.set()
            with self.assertRaises(asyncio.CancelledError):
                await task
