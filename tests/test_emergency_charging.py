import unittest
import importlib.util
import types
import sys
from datetime import datetime, timezone, timedelta

# Create dummy package modules so relative imports work without aiohttp/homeassistant
pkg_cc = types.ModuleType('custom_components')
pkg_ch = types.ModuleType('custom_components.carrot_ha')
pkg_ch.__path__ = ['custom_components/carrot_ha']
sys.modules['custom_components'] = pkg_cc
sys.modules['custom_components.carrot_ha'] = pkg_ch

spec_battery = importlib.util.spec_from_file_location('custom_components.carrot_ha.battery', 'custom_components/carrot_ha/battery.py')
mod_battery = importlib.util.module_from_spec(spec_battery)
sys.modules['custom_components.carrot_ha.battery'] = mod_battery
spec_battery.loader.exec_module(mod_battery)

spec_vehicle = importlib.util.spec_from_file_location('custom_components.carrot_ha.vehicle', 'custom_components/carrot_ha/vehicle.py')
mod_vehicle = importlib.util.module_from_spec(spec_vehicle)
sys.modules['custom_components.carrot_ha.vehicle'] = mod_vehicle
spec_vehicle.loader.exec_module(mod_vehicle)

class MockDateTime(datetime):
    current_time = datetime(2026, 9, 16, 12, 0, 0, tzinfo=timezone.utc)
    @classmethod
    def now(cls, tz=None):
        if tz:
            return cls.current_time.astimezone(tz)
        return cls.current_time

mod_vehicle.datetime = MockDateTime
values = mod_vehicle.values

class TestEmergencyCharging(unittest.TestCase):
    def setUp(self):
        self.entry_options = {'soc_capacity_kwh': 77.0}
        self.base_time = datetime(2026, 9, 16, 12, 0, 0, tzinfo=timezone.utc)
        MockDateTime.current_time = self.base_time

    def _make_runtime(self, charging=True, power_w=1000, elapsed_s=0, stale=False):
        measured_time = self.base_time + timedelta(seconds=elapsed_s)
        MockDateTime.current_time = measured_time
        data = {
            'charging': charging,
            'charge_power_w': power_w,
            'battery_wh': 57000,
            'measured_at': measured_time.isoformat(),
            'stale': stale
        }
        return {
            'entry': type('Entry', (), {'options': self.entry_options, 'data': {'device_id': 'test-id'}, 'title': 'Test Car'}),
            'latest': {'data': data, 'observed_at': measured_time.isoformat()},
            'summary': {}
        }

    def _set_elapsed(self, runtime, elapsed_s):
        measured_time = self.base_time + timedelta(seconds=elapsed_s)
        MockDateTime.current_time = measured_time
        runtime['latest']['data']['measured_at'] = measured_time.isoformat()
        runtime['latest']['observed_at'] = measured_time.isoformat()

    def test_emergency_charging_lifecycle(self):
        # 1. Start charging at 1.0 kW (elapsed = 0s)
        runtime = self._make_runtime(charging=True, power_w=1000, elapsed_s=0)
        v = values(runtime)
        self.assertEqual(v['charge_power_kw'], 1.0)
        self.assertEqual(v['low_power_duration_s'], 0)
        self.assertFalse(v['emergency_charging'])

        # 2. 3 minutes later (180s), still 1.0 kW -> duration 180s, not 5m yet
        self._set_elapsed(runtime, 180)
        v = values(runtime)
        self.assertEqual(v['low_power_duration_s'], 180)
        self.assertFalse(v['emergency_charging'])

        # 3. Exactly 5 minutes (300s) -> emergency_charging turns True!
        self._set_elapsed(runtime, 300)
        v = values(runtime)
        self.assertEqual(v['low_power_duration_s'], 300)
        self.assertTrue(v['emergency_charging'])

        # 4. 6 minutes (360s) -> remains True
        self._set_elapsed(runtime, 360)
        v = values(runtime)
        self.assertEqual(v['low_power_duration_s'], 360)
        self.assertTrue(v['emergency_charging'])

        # 5. Data becomes stale -> emergency_charging becomes False (condition: not stale)
        runtime['latest']['data']['stale'] = True
        v = values(runtime)
        self.assertFalse(v['emergency_charging'])

        # 6. Recovers from stale -> emergency_charging becomes True again
        runtime['latest']['data']['stale'] = False
        self._set_elapsed(runtime, 370)
        v = values(runtime)
        self.assertTrue(v['emergency_charging'])

        # 7. Connector reseated properly, charging speed jumps to 7.0 kW -> resets!
        runtime['latest']['data']['charge_power_w'] = 7000
        self._set_elapsed(runtime, 400)
        v = values(runtime)
        self.assertEqual(v['charge_power_kw'], 7.0)
        self.assertEqual(v['low_power_duration_s'], 0)
        self.assertFalse(v['emergency_charging'])
        self.assertIsNone(runtime.get('low_power_charging_since'))

    def test_threshold_boundary(self):
        # 1.5 kW exactly -> should trigger after 300s
        runtime = self._make_runtime(charging=True, power_w=1500, elapsed_s=0)
        values(runtime)
        self._set_elapsed(runtime, 300)
        v = values(runtime)
        self.assertTrue(v['emergency_charging'])

        # 1.6 kW -> exceeds 1.5 kW, should NOT trigger
        runtime2 = self._make_runtime(charging=True, power_w=1600, elapsed_s=0)
        values(runtime2)
        self._set_elapsed(runtime2, 300)
        v2 = values(runtime2)
        self.assertFalse(v2['emergency_charging'])

    def test_unplugged(self):
        # Charging stopped
        runtime = self._make_runtime(charging=False, power_w=0, elapsed_s=0)
        v = values(runtime)
        self.assertFalse(v['emergency_charging'])
        self.assertEqual(v['low_power_duration_s'], 0)

if __name__ == '__main__':
    unittest.main()
