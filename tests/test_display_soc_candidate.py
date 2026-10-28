"""Cluster-SOC candidate (bus1 0x14A) is preserved and exposed, never used as dashboard SOC."""
from datetime import datetime, timezone, timedelta
import importlib.util
from pathlib import Path
import sys
import unittest

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, Path(path))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

sys.path.insert(0, str(Path('addons/carrot_receiver').resolve()))
receiver = load('display_soc_receiver', 'addons/carrot_receiver/receiver.py')
telemetry = load('display_soc_telemetry', 'custom_components/carrot_ha/telemetry.py')
KEY = 'display_soc_candidate_percent'


class ReceiverTripMeasurementTests(unittest.TestCase):
    def test_candidate_preserved_with_measured_time(self):
        raw = {'start': {'at': '2026-10-27T10:00:00+00:00', 'battery_wh': 40000, 'soc_percent': 51.3,
                         KEY: 62.5, 'display_soc_candidate_measured_at': '2026-10-27T09:59:58+00:00'},
               'end': {'at': '2026-10-27T10:10:00+00:00', 'battery_wh': 39000, 'soc_percent': 50,
                       KEY: None, 'display_soc_candidate_measured_at': None}, 'complete': True}
        result = receiver.trip_measurements(raw)
        self.assertEqual(result['start'][KEY], 62.5)
        self.assertEqual(result['start']['display_soc_candidate_measured_at'], '2026-10-27T09:59:58+00:00')
        self.assertEqual(result['start']['soc_percent'], 51.3)
        self.assertIsNone(result['end'][KEY])
        self.assertIsNone(result['end']['display_soc_candidate_measured_at'])

    def test_invalid_candidate_or_time_cleared_and_old_points_unchanged(self):
        point = {'at': '2026-10-27T10:00:00Z', 'battery_wh': 40000, 'soc_percent': 51.3}
        for value, at in ((127, '2026-10-27T10:00:00Z'), (float('nan'), '2026-10-27T10:00:00Z'), (60, 'bad'), (60, None)):
            result = receiver.trip_measurements({'start': {**point, KEY: value, 'display_soc_candidate_measured_at': at}})
            self.assertIsNone(result['start'][KEY]); self.assertIsNone(result['start']['display_soc_candidate_measured_at'])
        # Older collectors: exact previous output, so HA trip fingerprints do not change.
        self.assertEqual(receiver.trip_measurements({'start': point})['start'],
                         {'at': point['at'], 'battery_wh': 40000, 'soc_percent': 51.3})
        # Candidate alone never creates an energy boundary.
        self.assertIsNone(receiver.trip_measurements({'start': {'at': point['at'], KEY: 60,
            'display_soc_candidate_measured_at': point['at']}})['start'])


class HaSensorTests(unittest.TestCase):
    def test_sensor_is_optional_fresh_checked_and_labelled_candidate(self):
        self.assertNotIn(KEY, telemetry.SENSOR_FIELDS)  # no parallel observation entity
        self.assertIn(KEY, telemetry.OPTIONAL_FIELDS)  # expires after FRESHNESS_SECONDS
        self.assertEqual(telemetry.battery_monitor_attributes(KEY, {}), {})



if __name__ == '__main__':
    unittest.main()
