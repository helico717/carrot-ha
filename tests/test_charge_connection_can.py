"""Passive CAN evidence, transport persistence and tri-state indication."""
import importlib.util
import tempfile
import unittest
from pathlib import Path


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


telemetry = load('ha_charge_telemetry', 'custom_components/carrot_ha/telemetry.py')


class ChargeConnectionTests(unittest.TestCase):
    def test_fresh_plug_code_not_energy_controls_indication(self):
        for code in range(8):
            self.assertEqual(telemetry.charge_plug_indication({'charge_can_plug_text_bus1': code}), code == 2)
        self.assertIsNone(telemetry.charge_plug_indication({'charging': True}))
        self.assertIsNone(telemetry.charge_plug_indication({'charge_can_plug_text_bus1': None}))
        self.assertIsNone(telemetry.charge_plug_indication({'charge_can_plug_text_bus1': True}))
        self.assertTrue(telemetry.charge_plug_indication({'charge_can_plug_text_bus0': 0, 'charge_can_plug_text_bus1': 2}))

    def test_expired_evidence_retains_last_code_and_measurement(self):
        key = 'charge_can_plug_text_bus1'
        raw = {key: 2, 'field_measured_at': {key: '2026-10-04T06:00:00Z'}}
        entry = telemetry.charge_connection_evidence(raw, {key: None})[key]
        self.assertEqual(entry['value'], 2)
        self.assertEqual(entry['bus'], 1)
        self.assertEqual(entry['measured_at'], raw['field_measured_at'][key])
        self.assertFalse(entry['fresh'])
        self.assertIn(key, telemetry.OPTIONAL_FIELDS)


if __name__ == '__main__':
    unittest.main()
