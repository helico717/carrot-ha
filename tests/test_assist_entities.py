"""The two openpilot assist entities (docs/OPENPILOT_ASSIST_ENTITIES_PLAN_2026-11-06.md)."""
from enum import Enum
import importlib
import sys
import types
import unittest

for name in ['homeassistant', 'homeassistant.components', 'homeassistant.components.sensor', 'homeassistant.const',
             'homeassistant.helpers', 'homeassistant.helpers.dispatcher']:
    module = sys.modules.get(name) or types.ModuleType(name)
    if name == 'homeassistant.components.sensor' and not hasattr(module, 'SensorEntity'):
        module.SensorEntity = type('SensorEntity', (), {})
    if name == 'homeassistant.const' and not hasattr(module, 'EntityCategory'):
        module.EntityCategory = Enum('EntityCategory', {'DIAGNOSTIC': 'diagnostic'})
    if name == 'homeassistant.helpers.dispatcher' and not hasattr(module, 'async_dispatcher_connect'):
        module.async_dispatcher_connect = lambda *args, **kwargs: None
    sys.modules[name] = module
package = types.ModuleType('_assist_entity_test')
package.__path__ = ['custom_components/carrot_ha']
sys.modules[package.__name__] = package
sensors = importlib.import_module(package.__name__ + '.sensors_v3')
assist_stats = importlib.import_module(package.__name__ + '.assist_stats')

MEASURED = {'measured': True, 'since': '2026-11-01T01:00:00+00:00', 'current_streak_days': 3, 'best_streak_days': 5,
            'active_days': 9, 'measured_trips': 12, 'disengagements': 7, 'system_enabled_m': 290000.0,
            'unrecorded_estimate_m': 1000.0,
            'longest_streak': {'distance_m': 44600.0, 'start_at': '2026-11-02T00:10:00+00:00'},
            'total': {'ratio': 0.9806, 'assist_m': 303000.0, 'manual_m': 6000.0, 'unknown_m': 500.0,
                      'lat_only_m': 3000.0, 'long_only_m': 0.0, 'both_m': 300000.0}}
MONTH = {'measured': True, 'total': {'ratio': 0.95, 'assist_m': 120000.0}}
TODAY = {'measured': True, 'total': {'assist_m': 12345.0}}


class AssistEntityTests(unittest.TestCase):
    def sensor(self, cls, summary):
        entry = types.SimpleNamespace(entry_id='e', title='ID.4', options={}, data={'device_id': 'test-id4'})
        runtime = {'entry': entry, 'latest': {'data': {}}, 'summary': summary}
        sensor = cls(entry)
        sensor.hass = types.SimpleNamespace(data={'carrot_ha': {'e': runtime}})
        return sensor

    def test_names_ids_and_classes_follow_the_plan(self):
        ratio = self.sensor(sensors.AssistRatioSensor, {})
        distance = self.sensor(sensors.AssistDistanceSensor, {})
        self.assertEqual((ratio._attr_name, ratio.suggested_object_id, ratio._attr_unique_id),
                         ('오픈파일럿 사용률', 'openpilot_assist_ratio', 'test-id4_openpilot_assist_ratio'))
        self.assertEqual((distance._attr_name, distance.suggested_object_id, distance._attr_unique_id),
                         ('오픈파일럿 누적 주행거리', 'openpilot_assist_distance', 'test-id4_openpilot_assist_distance'))
        self.assertEqual((ratio._attr_native_unit_of_measurement, ratio._attr_state_class), ('%', 'measurement'))
        self.assertEqual((distance._attr_native_unit_of_measurement, distance._attr_state_class,
                          distance._attr_device_class), ('km', 'total_increasing', 'distance'))
        self.assertFalse(hasattr(ratio, '_attr_entity_category'))

    def test_unknown_before_the_first_measured_trip(self):
        empty = assist_stats.entity_values({'measured': False, 'total': {}}, {'total': {}}, {'total': {}})
        self.assertIsNone(self.sensor(sensors.AssistRatioSensor, empty).native_value)
        self.assertIsNone(self.sensor(sensors.AssistDistanceSensor, empty).native_value)
        self.assertEqual(self.sensor(sensors.AssistRatioSensor, empty).extra_state_attributes['measured_trips'], 0)

    def test_values_and_attributes(self):
        values = assist_stats.entity_values(MEASURED, MONTH, TODAY)
        ratio = self.sensor(sensors.AssistRatioSensor, values)
        distance = self.sensor(sensors.AssistDistanceSensor, values)
        self.assertEqual(ratio.native_value, 98.1)
        self.assertEqual(distance.native_value, 303.0)
        attrs = ratio.extra_state_attributes
        self.assertEqual(list(attrs), ['since', 'assist_km', 'manual_km', 'unknown_km', 'month_ratio', 'month_assist_km',
                                       'longest_streak_km', 'longest_streak_at', 'current_streak_days',
                                       'best_streak_days', 'active_days', 'measured_trips', 'disengagements',
                                       'unrecorded_estimate_km'])
        self.assertEqual((attrs['manual_km'], attrs['month_ratio'], attrs['longest_streak_km'],
                          attrs['current_streak_days'], attrs['unrecorded_estimate_km']), (6.0, 95.0, 44.6, 3, 1.0))
        self.assertEqual(distance.extra_state_attributes,
                         {'lateral_only_km': 3.0, 'longitudinal_only_km': 0.0, 'both_km': 300.0,
                          'system_enabled_km': 290.0, 'today_assist_km': 12.3})
        # No per-minute measurement timestamps: unchanged statistics write no recorder rows.
        self.assertNotIn('measured_at', attrs)

    def test_last_trip_attributes_are_null_without_statistics(self):
        summary = {'last_trip_distance_km': 1.2, 'last_trip_assist_ratio': None, 'last_trip_assist_km': None}
        attrs = self.sensor(sensors.LastTripSensor, summary).extra_state_attributes
        self.assertIsNone(attrs['assist_ratio'])
        self.assertIsNone(attrs['assist_disengagements'])
        attrs = self.sensor(sensors.LastTripSensor, {**summary, 'last_trip_assist_ratio': 80.0,
                                                     'last_trip_assist_km': 8.0}).extra_state_attributes
        self.assertEqual((attrs['assist_ratio'], attrs['assist_km']), (80.0, 8.0))


if __name__ == '__main__':
    unittest.main()
