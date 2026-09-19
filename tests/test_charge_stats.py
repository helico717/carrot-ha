import unittest
import importlib.util
import types
import sys
from datetime import datetime, timezone

pkg_cc = sys.modules.get('custom_components') or types.ModuleType('custom_components')
pkg_ch = sys.modules.get('custom_components.carrot_ha') or types.ModuleType('custom_components.carrot_ha')
pkg_ch.__path__ = ['custom_components/carrot_ha']
sys.modules['custom_components'] = pkg_cc
sys.modules['custom_components.carrot_ha'] = pkg_ch

if 'custom_components.carrot_ha.battery' not in sys.modules:
    spec_battery = importlib.util.spec_from_file_location('custom_components.carrot_ha.battery', 'custom_components/carrot_ha/battery.py')
    mod_battery = importlib.util.module_from_spec(spec_battery)
    sys.modules['custom_components.carrot_ha.battery'] = mod_battery
    spec_battery.loader.exec_module(mod_battery)

spec_vehicle = importlib.util.spec_from_file_location('custom_components.carrot_ha.vehicle', 'custom_components/carrot_ha/vehicle.py')
mod_vehicle = importlib.util.module_from_spec(spec_vehicle)
sys.modules['custom_components.carrot_ha.vehicle'] = mod_vehicle
spec_vehicle.loader.exec_module(mod_vehicle)

class MockDateTime(datetime):
    current_time = datetime(2026, 9, 19, 12, 0, 0, tzinfo=timezone.utc)
    @classmethod
    def now(cls, tz=None):
        if tz:
            return cls.current_time.astimezone(tz)
        return cls.current_time

mod_vehicle.datetime = MockDateTime
values = mod_vehicle.values

class TestChargeStats(unittest.TestCase):
    def test_charge_months_present(self):
        runtime = {
            'entry': type('Entry', (), {'options': {'soc_capacity_kwh': 77.0}, 'data': {'device_id': 'test'}, 'title': 'Car'}),
            'latest': {
                'data': {
                    'charge_months': {
                        '2026-09': {
                            'slow_kwh': 45.54,
                            'fast_kwh': 110.36,
                            'cost_krw': 43650
                        }
                    }
                },
                'observed_at': '2026-09-19T12:00:00Z'
            },
            'summary': {}
        }
        v = values(runtime)
        self.assertEqual(v['month_slow_kwh'], 45.54)
        self.assertEqual(v['month_fast_kwh'], 110.36)
        self.assertEqual(v['month_charge_cost'], 43650)
        self.assertEqual(v['month_charge_kwh'], 155.9)

    def test_charge_months_empty_defaults_to_zero(self):
        runtime = {
            'entry': type('Entry', (), {'options': {'soc_capacity_kwh': 77.0}, 'data': {'device_id': 'test'}, 'title': 'Car'}),
            'latest': {
                'data': {},
                'observed_at': '2026-09-19T12:00:00Z'
            },
            'summary': {}
        }
        v = values(runtime)
        self.assertEqual(v['month_slow_kwh'], 0.0)
        self.assertEqual(v['month_fast_kwh'], 0.0)
        self.assertEqual(v['month_charge_cost'], 0)
        self.assertEqual(v['month_charge_kwh'], 0.0)

    def test_charge_months_null_fields_default_to_zero(self):
        runtime = {
            'entry': type('Entry', (), {'options': {'soc_capacity_kwh': 77.0}, 'data': {'device_id': 'test'}, 'title': 'Car'}),
            'latest': {
                'data': {
                    'charge_months': {
                        '2026-09': {
                            'slow_kwh': None,
                            'fast_kwh': None,
                            'cost_krw': None
                        }
                    }
                },
                'observed_at': '2026-09-19T12:00:00Z'
            },
            'summary': {}
        }
        v = values(runtime)
        self.assertEqual(v['month_slow_kwh'], 0.0)
        self.assertEqual(v['month_fast_kwh'], 0.0)
        self.assertEqual(v['month_charge_cost'], 0)
        self.assertEqual(v['month_charge_kwh'], 0.0)

if __name__ == '__main__':
    unittest.main()
