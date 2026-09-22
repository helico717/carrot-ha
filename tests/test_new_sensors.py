import unittest
import importlib.util
import types
import sys
from datetime import datetime, timezone, timedelta

# Create dummy package modules so relative imports work without homeassistant
for mod_name in ['homeassistant', 'homeassistant.components', 'homeassistant.components.sensor', 'homeassistant.helpers', 'homeassistant.helpers.dispatcher']:
    m = types.ModuleType(mod_name)
    if mod_name == 'homeassistant.components.sensor':
        m.SensorEntity = type('SensorEntity', (), {})
    elif mod_name == 'homeassistant.helpers.dispatcher':
        m.async_dispatcher_connect = lambda *args, **kwargs: None
    sys.modules[mod_name] = m

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

values = mod_vehicle.values

class TestNewSensors(unittest.TestCase):
    def _make_runtime(self, data, summary=None):
        return {
            'entry': type('Entry', (), {
                'options': {'soc_capacity_kwh': 77.0},
                'data': {'device_id': 'test-id'},
                'title': 'Test Car'
            }),
            'latest': {'data': data, 'observed_at': '2026-09-22T06:00:00Z'},
            'summary': summary or {}
        }

    def test_wheel_speed_conversion(self):
        # 25 m/s = 90.0 km/h
        runtime = self._make_runtime({'wheel_speed_mps': 25.0})
        res = values(runtime)
        self.assertEqual(res.get('wheel_speed_kph'), 90.0)

        # None / invalid wheel_speed_mps
        runtime_none = self._make_runtime({})
        res_none = values(runtime_none)
        self.assertIsNone(res_none.get('wheel_speed_kph'))

    def test_monthly_efficiency_calculation(self):
        # Only the 500 km with matching battery measurements participates.
        runtime = self._make_runtime({
            'charge_months': {datetime.now(timezone(timedelta(hours=9))).strftime('%Y-%m'): {'slow_kwh': 80.0, 'fast_kwh': 20.0, 'cost_krw': 28800}}
        }, summary={'month_distance_km': 550.0, 'month_energy_distance_km': 500.0, 'month_drive_energy_kwh': 100.0})
        res = values(runtime)
        self.assertEqual(res.get('month_charge_kwh'), 100.0)
        self.assertEqual(res.get('month_distance_km'), 550.0)
        self.assertEqual(res.get('month_efficiency_kpl'), 5.0)

    def test_monthly_efficiency_zero_charge_defense(self):
        # 0 charge -> should be None, no ZeroDivisionError
        runtime = self._make_runtime({}, summary={'month_distance_km': 120.0})
        res = values(runtime)
        self.assertEqual(res.get('month_charge_kwh'), 0.0)
        self.assertIsNone(res.get('month_efficiency_kpl'))

    def test_estimated_range_without_measured_efficiency(self):
        # No arbitrary default efficiency when trip energy is unavailable.
        runtime = self._make_runtime({'battery_wh': 55000.0})
        res = values(runtime)
        self.assertEqual(res.get('battery_kwh'), 55.0)
        self.assertIsNone(res.get('range_km'))
        self.assertTrue(res.get('range_estimated'))
        self.assertEqual(res.get('range_efficiency_basis'), 'insufficient_trip_energy')

    def test_estimated_range_with_dynamic_efficiency(self):
        # 600 km / 120 kWh consumed = 5 km/kWh, regardless of charge amount.
        runtime = self._make_runtime({
            'battery_wh': 50000.0,
            'charge_months': {datetime.now(timezone(timedelta(hours=9))).strftime('%Y-%m'): {'slow_kwh': 100.0, 'fast_kwh': 0.0, 'cost_krw': 28000}}
        }, summary={'month_distance_km': 600.0, 'month_energy_distance_km': 600.0, 'month_drive_energy_kwh': 120.0, 'month_energy_coverage_percent': 100.0})
        res = values(runtime)
        self.assertEqual(res.get('month_efficiency_kpl'), 5.0)
        self.assertEqual(res.get('range_km'), 250)
        self.assertTrue(res.get('range_estimated'))
        self.assertEqual(res.get('range_efficiency_basis'), 'matched_trip_energy')

    def test_charging_cannot_change_driving_efficiency(self):
        summary = {'month_distance_km': 480.5, 'month_energy_distance_km': 480.5,
                   'month_drive_energy_kwh': 80.0, 'month_energy_coverage_percent': 100}
        for charged in (0, 50, 200):
            result = values(self._make_runtime({'month_charge_kwh': charged}, summary))
            self.assertEqual(result['month_efficiency_kpl'], 6.01)

    def test_missing_energy_does_not_use_charge_ratio(self):
        result = values(self._make_runtime({'month_charge_kwh': 50}, {'month_distance_km': 480.5}))
        self.assertIsNone(result['month_efficiency_kpl'])

    def test_stale_door_is_unknown_even_with_fresh_battery(self):
        now = datetime.now(timezone.utc)
        result = values(self._make_runtime({'door_driver_open': False,
            'measured_at': now.isoformat(),
            'field_measured_at': {'door_driver_open': (now-timedelta(seconds=181)).isoformat()}}))
        self.assertIsNone(result['door_driver_open'])
        result = values(self._make_runtime({'door_driver_open': False,
            'field_measured_at': {'door_driver_open': now.isoformat()}}))
        self.assertIs(result['door_driver_open'], False)

    def test_optional_fields_survive_collector_cloud_and_ha(self):
        import tempfile
        from pathlib import Path
        sys.path.insert(0, str(Path('collector').resolve()))
        from engine import Engine, Store
        from custom_components.carrot_ha.cloud_feed import parse_feed
        now = datetime.now(timezone.utc).timestamp()
        with tempfile.TemporaryDirectory() as folder:
            engine = Engine(Store(Path(folder)/'collector.db'), 'test-id')
            events = engine.tick(now, False, sampled={'battery_wh': 50000,
                'door_driver_open': False, 'trunk_open': True, 'bms_mode': 'ac_charging'},
                diagnostics={'comma_cpu_temperature_c': 63})
            raw = events[-1][1]
            feed = {'state': {'device_id': 'test-id', 'updated_at': raw['updatedAt'],
                              'onroad': raw['onroad'], 'raw_json': raw}}
            event = parse_feed(feed, 'test-id')[0]
            runtime = self._make_runtime({})
            runtime['latest'] = event
            result = values(runtime)
            self.assertIs(result['door_driver_open'], False)
            self.assertIs(result['trunk_open'], True)
            self.assertEqual(result['bms_mode'], 'ac_charging')
            self.assertEqual(result['comma_cpu_temperature_c'], 63)

    def test_gear_mapping(self):
        from custom_components.carrot_ha.sensors_v3 import GEAR_DISPLAY
        self.assertEqual(GEAR_DISPLAY.get('park'), 'P')
        self.assertEqual(GEAR_DISPLAY.get('drive'), 'D')
        self.assertEqual(GEAR_DISPLAY.get('reverse'), 'R')
        self.assertEqual(GEAR_DISPLAY.get('neutral'), 'N')
        self.assertEqual(GEAR_DISPLAY.get('sport'), 'S')
        self.assertEqual(GEAR_DISPLAY.get('low'), 'B')
        self.assertEqual(GEAR_DISPLAY.get('eco'), 'Eco')

if __name__ == '__main__':
    unittest.main()
