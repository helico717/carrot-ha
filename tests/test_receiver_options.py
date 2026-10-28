"""Exercise the actual options handler with HA UI adapters and real validation."""
import ast
import asyncio
from pathlib import Path
import sys
import types
from types import SimpleNamespace
import unittest
import voluptuous as vol


class OptionsTests(unittest.IsolatedAsyncioTestCase):
    async def test_direct_options_preserve_hidden_keys_and_other_feature_settings(self):
        source = Path('custom_components/carrot_ha/config_flow.py').read_text()
        node = next(n for n in ast.parse(source).body if isinstance(n, ast.ClassDef) and n.name == 'BatteryOptionsFlow')
        class Base:
            def async_create_entry(self, **kwargs):
                return kwargs
            def async_show_form(self, **kwargs):
                return kwargs
        package = types.ModuleType('options_test_component')
        package.__path__ = [str(Path('custom_components/carrot_ha').resolve())]
        sys.modules[package.__name__] = package
        constants = {}
        for assignment in ast.parse(Path('custom_components/carrot_ha/battery.py').read_text(encoding='utf-8')).body:
            if isinstance(assignment, ast.Assign) and isinstance(assignment.targets[0], ast.Name) and assignment.targets[0].id in {'DEFAULT_SOC_CAPACITY_KWH', 'DEFAULT_REFERENCE_EFFICIENCY_KPL'}:
                constants[assignment.targets[0].id] = ast.literal_eval(assignment.value)
        namespace = {'__name__': package.__name__ + '.config_flow', '__package__': package.__name__,
                     'vol': vol, **constants,
                     'config_entries': SimpleNamespace(OptionsFlow=Base)}
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<actual-options>', 'exec'), namespace)
        flow = namespace['BatteryOptionsFlow']()
        original = {'cloud_url': 'https://legacy.example', 'cloud_view_token': 'v' * 32,
                    'terminal_upload_token': 'old-upload', 'terminal_token': 't' * 32,
                    'camera_enabled': True, 'camera_token': 'c' * 32, 'terminal_enabled': True,
                    'terminal_ha_url': 'https://ha.example', 'custom_preserved_option': 42,
                    'receiver_url': 'http://874ccb4c-carrot-receiver:8099',
                    'receiver_view_token': 'r' * 32, 'receiver_upload_token': 'u' * 32}
        flow.config_entry = SimpleNamespace(options=original.copy(), data={'token': 'd' * 32, 'device_id': 'car'})
        flow.hass = SimpleNamespace(async_add_executor_job=lambda fn, *args: asyncio.to_thread(fn, *args),
                                    config=SimpleNamespace(path=lambda *parts: str(Path('/nonexistent-options-test', *parts))))
        result = await flow.async_step_init({'soc_capacity_kwh': 80})
        self.assertEqual(result['data']['soc_capacity_kwh'], 80)
        for key, value in original.items():
            self.assertEqual(result['data'][key], value, key)
        form = await flow.async_step_init()
        visible = {key.schema for key in form['data_schema'].schema}
        self.assertFalse(visible & {'cloud_url', 'cloud_view_token', 'terminal_upload_token'})
