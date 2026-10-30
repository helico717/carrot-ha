import asyncio
import importlib.util
import json
from pathlib import Path
import tempfile
import time
import types
import unittest

spec = importlib.util.spec_from_file_location('transfer_policy', Path(__file__).parents[1] / 'custom_components/carrot_ha/driving_logs/transfer_policy.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class PolicyTests(unittest.IsolatedAsyncioTestCase):
    async def test_default_off_persistence_generation_and_old_upload_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            async def executor(function, *args):
                return function(*args)
            hass = types.SimpleNamespace(config=types.SimpleNamespace(path=lambda *parts: str(Path(directory).joinpath(*parts))), async_add_executor_job=executor)
            runtime = {'entry': types.SimpleNamespace(entry_id='one')}
            self.assertFalse((await policy.policy_for(hass, runtime))['enabled'])
            on = await policy.set_enabled(hass, runtime, True)
            started = time.time()
            policy.require_permission(on, on['generation'], started)
            with self.assertRaises(ValueError):
                policy.require_permission(on, on['generation'], on['since'] - 1)
            with self.assertRaises(ValueError):
                policy.require_permission(on, on['generation'], float('nan'))
            self.assertEqual(await policy.set_enabled(hass, runtime, True), on)
            runtime.pop('driving_log_transfer_policy')
            self.assertEqual(await policy.policy_for(hass, runtime), on)
            off = await policy.set_enabled(hass, runtime, False)
            with self.assertRaises(ValueError):
                policy.require_permission(off, on['generation'], started)
            again = await policy.set_enabled(hass, runtime, True)
            self.assertNotEqual(on['generation'], again['generation'])
            with self.assertRaises(ValueError):
                policy.require_permission(again, on['generation'], started)
            self.assertFalse(policy.public_status(runtime, again)['applied'])
            runtime['driving_log_transfer_ack'] = {'generation': again['generation'], 'seen': time.monotonic()}
            self.assertTrue(policy.public_status(runtime, again)['applied'])

    async def test_corrupt_policy_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'policy.json'
            path.write_text(json.dumps({'enabled': 'false', 'generation': 'old'}))
            with self.assertRaises(ValueError):
                policy.load(path)


if __name__ == '__main__':
    unittest.main()
