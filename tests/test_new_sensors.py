import unittest
from enum import Enum
import importlib.util
import types
import sys
from datetime import datetime, timezone, timedelta

# Create dummy package modules so relative imports work without homeassistant
for mod_name in ['homeassistant', 'homeassistant.components', 'homeassistant.components.sensor', 'homeassistant.const', 'homeassistant.helpers', 'homeassistant.helpers.dispatcher']:
    m = types.ModuleType(mod_name)
    if mod_name == 'homeassistant.components.sensor':
        m.SensorEntity = type('SensorEntity', (), {})
    elif mod_name == 'homeassistant.const':
        m.EntityCategory = Enum('EntityCategory', {'DIAGNOSTIC': 'diagnostic'})
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

    def test_battery_monitoring_entities_freshness_and_attributes(self):
        from custom_components.carrot_ha.sensors_v3 import VehicleSensor, FIELDS
        from custom_components.carrot_ha.telemetry import BATTERY_MONITOR_FIELDS
        self.assertEqual(len(BATTERY_MONITOR_FIELDS), 6)
        now = datetime.now(timezone.utc)
        for key in BATTERY_MONITOR_FIELDS:
            value = 'optimal' if key == 'battery_charge_temperature_status' else 13
            runtime = self._make_runtime({key: value, 'field_measured_at': {key: now.isoformat()}})
            entry = runtime['entry']; entry.entry_id = 'battery-test'
            sensor = VehicleSensor(entry, key, *FIELDS[key])
            sensor.hass = types.SimpleNamespace(data={'carrot_ha': {'battery-test': runtime}})
            self.assertEqual(sensor.native_value, '적정' if isinstance(value, str) else value)
            attrs = sensor.extra_state_attributes
            self.assertEqual(attrs['source'], 'passive_can')
            self.assertEqual(attrs['measured_at'], now.isoformat())
            self.assertFalse(attrs['stale'])
            runtime['latest']['data']['field_measured_at'][key] = (now - timedelta(seconds=181)).isoformat()
            self.assertIsNone(sensor.native_value)
            self.assertTrue(sensor.extra_state_attributes['stale'])
            self.assertNotEqual(sensor.extra_state_attributes['measured_at'], now.isoformat())

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
        # No trip energy at all → falls back to default efficiency (5.0 km/kWh).
        runtime = self._make_runtime({'battery_wh': 55000.0})
        res = values(runtime)
        self.assertEqual(res.get('battery_kwh'), 55.0)
        self.assertEqual(res.get('range_km'), 275)  # 55.0 * 5.0
        self.assertTrue(res.get('range_estimated'))
        self.assertEqual(res.get('range_efficiency_basis'), 'default_efficiency')

    def test_estimated_range_with_recent_efficiency(self):
        # Month data insufficient, but recent_efficiency available from trip_energy cache.
        runtime = self._make_runtime({'battery_wh': 50000.0},
            summary={'recent_efficiency_kpl': 4.8, 'recent_efficiency_trip_count': 5,
                     'recent_efficiency_distance_km': 120.0})
        res = values(runtime)
        self.assertEqual(res.get('range_km'), 240)  # 50.0 * 4.8
        self.assertEqual(res.get('range_efficiency_basis'), 'recent_trips')

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

    def test_stale_door_retains_last_value(self):
        # Door fields are no longer in OPTIONAL_FIELDS; they retain last-known values.
        now = datetime.now(timezone.utc)
        result = values(self._make_runtime({'door_driver_open': False,
            'measured_at': now.isoformat(),
            'field_measured_at': {'door_driver_open': (now-timedelta(seconds=181)).isoformat()}}))
        self.assertIs(result['door_driver_open'], False)
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

    def test_diagnostics_use_category_enum_and_comma_device(self):
        from homeassistant.const import EntityCategory
        from custom_components.carrot_ha.sensors_v3 import FIELDS, VehicleSensor
        entry = self._make_runtime({})['entry']
        keys = [key for key in FIELDS if key.startswith('comma_')]
        self.assertEqual(len(keys), 9)
        for key in keys + ['aux_voltage']:
            sensor = VehicleSensor(entry, key, *FIELDS[key])
            self.assertIs(sensor._attr_entity_category, EntityCategory.DIAGNOSTIC)
            if key.startswith('comma_'):
                self.assertEqual(sensor._attr_device_info['identifiers'],
                                 {('carrot_ha', 'test-id_comma')})

    def test_gear_mapping(self):
        from custom_components.carrot_ha.sensors_v3 import GEAR_DISPLAY
        self.assertEqual(GEAR_DISPLAY.get('park'), 'P')
        self.assertEqual(GEAR_DISPLAY.get('drive'), 'D')
        self.assertEqual(GEAR_DISPLAY.get('reverse'), 'R')
        self.assertEqual(GEAR_DISPLAY.get('neutral'), 'N')
        self.assertEqual(GEAR_DISPLAY.get('sport'), 'S')
        self.assertEqual(GEAR_DISPLAY.get('low'), 'B')
        self.assertEqual(GEAR_DISPLAY.get('eco'), 'Eco')

    def test_last_trip_sensor(self):
        from custom_components.carrot_ha.sensors_v3 import LastTripSensor
        entry = type('Entry', (), {'options': {'soc_capacity_kwh': 77.0}, 'data': {'device_id': 'test-id'}, 'title': 'Test Car', 'entry_id': 'test_entry'})()
        sensor = LastTripSensor(entry)
        sensor.hass = types.SimpleNamespace()
        sensor.hass.data = {
            'carrot_ha': {
                'test_entry': {
                    'entry': entry,
                    'latest': {'data': {}},
                    'summary': {
                        'last_trip_distance_km': 15.42,
                        'last_trip_duration_s': 1440,
                        'last_trip_efficiency_kpl': 5.4,
                        'last_trip_energy_kwh': 2.85,
                        'last_trip_start_soc': 82.0,
                        'last_trip_end_soc': 77.0,
                        'last_trip_consumed_soc': 5.0,
                        'last_trip_avg_kph': 38.5,
                        'last_trip_max_kph': 85.0,
                        'last_trip_at': '2026-10-01T14:44:00Z',
                    }
                }
            }
        }
        self.assertEqual(sensor.native_value, 15.42)
        attrs = sensor.extra_state_attributes
        self.assertEqual(attrs['distance_km'], 15.42)
        self.assertEqual(attrs['duration_minutes'], 24.0)
        self.assertEqual(attrs['efficiency_kpl'], 5.4)
        self.assertEqual(attrs['energy_kwh'], 2.85)
        self.assertEqual(attrs['start_soc'], 82.0)
        self.assertEqual(attrs['end_soc'], 77.0)
        self.assertEqual(attrs['consumed_soc'], 5.0)
        self.assertEqual(attrs['avg_speed_kph'], 38.5)
        self.assertEqual(attrs['max_speed_kph'], 85.0)
        self.assertEqual(attrs['ended_at'], '2026-10-01T14:44:00Z')

    def test_charging_session_sensor(self):
        from custom_components.carrot_ha.sensors_v3 import ChargingSessionSensor
        from custom_components.carrot_ha import entity as entity_module
        old_clock = entity_module.values.__globals__['datetime']
        entity_module.values.__globals__['datetime'] = datetime
        self.addCleanup(entity_module.values.__globals__.__setitem__, 'datetime', old_clock)
        entry = type('Entry', (), {'options': {'soc_capacity_kwh': 77.0}, 'data': {'device_id': 'test-id'}, 'title': 'Test Car', 'entry_id': 'test_entry'})()
        sensor = ChargingSessionSensor(entry)
        sensor.hass = types.SimpleNamespace()
        sensor.hass.data = {
            'carrot_ha': {
                'test_entry': {
                    'entry': entry,
                    'latest': {
                        'data': {
                            'charging': True,
                            'charge_can_bms_request_bus1': 6,
                            'field_measured_at': {'charge_can_bms_request_bus1': datetime.now(timezone.utc).isoformat()},
                            'soc_percent': 65.0,
                            'session_start_soc': 25.0,
                            'session_charge_kwh': 18.2,
                            'session_charge_cost': 5820,
                            'session_charge_price': 320,
                            'session_charge_type': 'DC_FAST',
                            'charge_power_kw': 65.4,
                            'time_to_80_s': 900,
                            'eta_80': '2026-10-01T16:45:00Z',
                        }
                    },
                    'summary': {}
                }
            }
        }
        self.assertEqual(sensor.native_value, 'charging')
        self.assertEqual(sensor.icon, 'mdi:ev-station')
        attrs = sensor.extra_state_attributes
        self.assertTrue(attrs['charging'])
        self.assertEqual(attrs['session_charge_kwh'], 18.2)
        self.assertEqual(attrs['session_charge_cost'], 5820)
        self.assertEqual(attrs['charger_type'], 'DC_FAST')
        self.assertEqual(attrs['start_soc'], 25.0)
        self.assertEqual(attrs['current_soc'], 65.0)
        self.assertEqual(attrs['added_soc'], 40.0)

        # Test disconnected
        sensor.hass.data['carrot_ha']['test_entry']['latest']['data'] = {'charging': False, 'charge_can_bms_request_bus1': 1, 'field_measured_at': {'charge_can_bms_request_bus1': datetime.now(timezone.utc).isoformat()}}
        self.assertEqual(sensor.native_value, 'idle')
        self.assertEqual(sensor.icon, 'mdi:power-plug-off')

        # Test emergency charging
        now_iso = datetime.now(timezone.utc).isoformat()
        sensor.hass.data['carrot_ha']['test_entry']['latest']['data'] = {
            'charging': True,
            'charge_power_w': 1000, 'bms_actual_mode_bus1':6, 'bms_power_w_bus1':1000, 'bms_voltage_v_bus1':350,
            'charge_can_bms_request_bus1': 4,
            'field_measured_at': {'charge_can_bms_request_bus1': now_iso},
            'measured_at': now_iso,
            'stale': False,
        }
        d=sensor.hass.data['carrot_ha']['test_entry']['latest']['data']
        d['field_measured_at'].update({k:d['measured_at'] for k in ('bms_actual_mode_bus1','bms_power_w_bus1','bms_voltage_v_bus1')})
        sensor.hass.data['carrot_ha']['test_entry']['low_power_charging_since'] = datetime.now(timezone.utc) - timedelta(seconds=400)
        self.assertEqual(sensor.native_value, 'emergency')
        self.assertEqual(sensor.icon, 'mdi:power-plug-off')

    def test_today_driving_sensor(self):
        from custom_components.carrot_ha.sensors_v3 import TodayDrivingSensor
        entry = type('Entry', (), {'options': {'soc_capacity_kwh': 77.0}, 'data': {'device_id': 'test-id'}, 'title': 'Test Car', 'entry_id': 'test_entry'})()
        sensor = TodayDrivingSensor(entry)
        sensor.hass = types.SimpleNamespace()
        sensor.hass.data = {
            'carrot_ha': {
                'test_entry': {
                    'entry': entry,
                    'latest': {'data': {}},
                    'summary': {
                        'today_distance_km': 45.2,
                        'today_trip_count': 3,
                        'today_energy_kwh': 7.8,
                        'today_efficiency_kpl': 5.8,
                    }
                }
            }
        }
        self.assertEqual(sensor.native_value, 45.2)
        attrs = sensor.extra_state_attributes
        self.assertEqual(attrs['today_trip_count'], 3)
        self.assertEqual(attrs['today_distance_km'], 45.2)
        self.assertEqual(attrs['today_energy_kwh'], 7.8)
        self.assertEqual(attrs['today_efficiency_kpl'], 5.8)

class ActualPowerEntityTests(unittest.TestCase):
    def test_new_identity_precision_and_no_estimated_entity(self):
        from custom_components.carrot_ha.sensors_v3 import FIELDS, VehicleSensor
        from unittest.mock import patch, PropertyMock
        self.assertNotIn('charge_power_w', FIELDS)
        entry=types.SimpleNamespace(data={'device_id':'car'},options={},title='ID.4')
        sensor=VehicleSensor(entry,'actual_charge_power_w',*FIELDS['actual_charge_power_w'])
        self.assertEqual(sensor._attr_unique_id,'car_actual_charge_power_w')
        for mode,power,expected,precision in [('ac_charging',6480,6.5,1),('dc_charging',71480,71,0)]:
            with patch.object(VehicleSensor,'data',new_callable=PropertyMock,return_value={'actual_charge_power_w':power,'charge_mode':mode}):
                self.assertEqual(sensor.native_value,expected)
                self.assertEqual(sensor.suggested_display_precision,precision)

if __name__ == '__main__':
    unittest.main()
