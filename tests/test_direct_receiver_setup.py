import asyncio
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location('direct_receiver_setup', Path('custom_components/carrot_ha/direct_receiver.py'))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class SetupTests(unittest.IsolatedAsyncioTestCase):
    async def test_prepared_setup_keeps_other_options_and_only_applies_once(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'direct-receiver-setup.json'
            options = {'receiver_url': 'http://874ccb4c-carrot-receiver:8099',
                       'receiver_view_token': 'v' * 32, 'receiver_upload_token': 'u' * 32}
            path.write_text(json.dumps([{'entry_id': 'entry', 'device_id': 'car', **options}]))
            entry = SimpleNamespace(entry_id='entry', data={'device_id': 'car'},
                                    options={'camera_enabled': True, 'camera_token': 'c' * 32, 'cloud_url': 'https://old.example'})
            original = entry.options.copy()
            calls = []
            def update(entry, options):
                calls.append(options)
                entry.options = options
            async def executor(fn, *args):
                return await asyncio.to_thread(fn, *args)
            hass = SimpleNamespace(config=SimpleNamespace(path=lambda *parts: str(path)),
                                   config_entries=SimpleNamespace(async_update_entry=update), async_add_executor_job=executor)
            await setup.apply_prepared(hass, entry)
            self.assertEqual(entry.options, {**original, **options})
            entry.options['receiver_url'] = 'https://changed-by-user.example'
            await setup.apply_prepared(hass, entry)
            self.assertEqual(len(calls), 1)
            self.assertEqual(entry.options['receiver_url'], 'https://changed-by-user.example')
            self.assertTrue(json.loads(path.read_text())[0]['applied'])

    async def test_device_mismatch_and_invalid_setup_are_not_applied(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'setup.json'
            value = {'entry_id': 'entry', 'device_id': 'other', 'receiver_url': 'http://874ccb4c-carrot-receiver:8099',
                     'receiver_view_token': 'v' * 32, 'receiver_upload_token': 'u' * 32}
            path.write_text(json.dumps([value]))
            self.assertIsNone(setup.read_setup(path, 'entry', 'car'))
            value['device_id'] = 'car'
            value['receiver_url'] = 'http://external.example:8099'
            path.write_text(json.dumps([value]))
            with self.assertRaises(ValueError):
                setup.read_setup(path, 'entry', 'car')


if __name__ == '__main__':
    unittest.main()
