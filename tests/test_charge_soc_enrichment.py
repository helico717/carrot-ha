import unittest
import tempfile
from pathlib import Path
from datetime import datetime, timezone, timedelta
import sys
import types
import importlib.util

pkg_cc = types.ModuleType('custom_components')
pkg_ch = types.ModuleType('custom_components.carrot_ha')
pkg_ch.__path__ = ['custom_components/carrot_ha']
sys.modules['custom_components'] = pkg_cc
sys.modules['custom_components.carrot_ha'] = pkg_ch

spec_protocol = importlib.util.spec_from_file_location('custom_components.carrot_ha.protocol', 'custom_components/carrot_ha/protocol.py')
mod_protocol = importlib.util.module_from_spec(spec_protocol)
sys.modules['custom_components.carrot_ha.protocol'] = mod_protocol
spec_protocol.loader.exec_module(mod_protocol)

spec_storage = importlib.util.spec_from_file_location('custom_components.carrot_ha.storage', 'custom_components/carrot_ha/storage.py')
mod_storage = importlib.util.module_from_spec(spec_storage)
sys.modules['custom_components.carrot_ha.storage'] = mod_storage
spec_storage.loader.exec_module(mod_storage)

Archive = mod_storage.Archive

class TestChargeSocEnrichment(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_archive.sqlite3"
        self.archive = Archive(self.db_path)
        self.device = "test_ev_1"
        self.now = datetime.now(timezone.utc)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _make_state(self, event_id, time_offset_s, soc_percent, battery_wh=None):
        observed = self.now + timedelta(seconds=time_offset_s)
        return {
            'schema': 1,
            'device_id': self.device,
            'event_id': event_id,
            'kind': 'state',
            'observed_at': observed.isoformat().replace('+00:00', 'Z'),
            'data': {
                'soc_percent': soc_percent,
                'battery_wh': battery_wh if battery_wh is not None else int(soc_percent * 780),
                'measured_at': observed.isoformat().replace('+00:00', 'Z')
            }
        }

    def _make_charge(self, event_id, start_offset_s, end_offset_s, energy_kwh, duration_s):
        start_ts = (self.now + timedelta(seconds=start_offset_s)).isoformat().replace('+00:00', 'Z')
        end_ts = (self.now + timedelta(seconds=end_offset_s)).isoformat().replace('+00:00', 'Z')
        return {
            'schema': 1,
            'device_id': self.device,
            'event_id': event_id,
            'kind': 'charge',
            'observed_at': end_ts,
            'data': {
                'started_at': start_ts,
                'ended_at': end_ts,
                'energy_kwh': energy_kwh,
                'duration_s': duration_s
            }
        }

    def test_enrich_with_state_events(self):
        # Charge from 0s to 3600s
        # State at start: 24.3%
        # State at end: 80.1%
        self.archive.put(self._make_state('s1', -10, 24.3))
        self.archive.put(self._make_state('s2', 3610, 80.1))

        charges = [self._make_charge('c1', 0, 3600, 43.68, 3600)]
        enriched = self.archive.enrich_charges_soc(self.device, charges, capacity_kwh=78.0)

        data = enriched[0]['data']
        self.assertEqual(data.get('start_soc_percent'), 24.3)
        self.assertEqual(data.get('end_soc_percent'), 80.1)
        self.assertEqual(data.get('soc_charged_percent'), 55.8)
        self.assertFalse(data.get('soc_retroactive_estimated'))

    def test_enrich_retroactive_fallback_when_states_expired(self):
        # No state events in database (e.g. past 14 days expired)
        charges = [self._make_charge('c_old', -86400 * 20, -86400 * 20 + 3600, 16.38, 3600)]
        enriched = self.archive.enrich_charges_soc(self.device, charges, capacity_kwh=78.0)

        data = enriched[0]['data']
        self.assertIsNone(data.get('start_soc_percent'))
        self.assertIsNone(data.get('end_soc_percent'))
        # 16.38 kWh / 78.0 kWh = 21.0%
        self.assertEqual(data.get('soc_charged_percent'), 21.0)
        self.assertTrue(data.get('soc_retroactive_estimated'))

    def test_empty_and_graceful(self):
        self.assertEqual(self.archive.enrich_charges_soc(self.device, []), [])
        no_times = [{'data': {'energy_kwh': 10.0}}]
        enriched = self.archive.enrich_charges_soc(self.device, no_times, capacity_kwh=78.0)
        self.assertEqual(enriched[0]['data'].get('soc_charged_percent'), 12.8)
        self.assertTrue(enriched[0]['data'].get('soc_retroactive_estimated'))

    def test_energy_soc_uses_configured_capacity_and_its_timestamp(self):
        for event_id, offset, soc, wh in [('s1', 0, 50, 39000), ('s2', 3600, 60, 46800)]:
            state = self._make_state(event_id, offset, soc, wh)
            state['data']['field_measured_at'] = {
                'battery_wh': state['observed_at'],
                'soc_percent': (self.now - timedelta(days=1)).isoformat(),
            }
            self.archive.put(state)
        charge = self._make_charge('c1', 0, 3600, 7.8, 3600)
        data = self.archive.enrich_charges_soc(self.device, [charge], 100)[0]['data']
        self.assertEqual(data['start_soc_percent'], 39)
        self.assertEqual(data['end_soc_percent'], 46.8)
        self.assertEqual(data['soc_charged_percent'], 7.8)
        self.assertFalse(data['soc_retroactive_estimated'])

    def test_soc_only_states_remain_a_fallback(self):
        for event_id, offset, soc in [('s1', 0, 20), ('s2', 3600, 30)]:
            state = self._make_state(event_id, offset, soc)
            del state['data']['battery_wh']
            self.archive.put(state)
        charge = self._make_charge('c1', 0, 3600, 10, 3600)
        data = self.archive.enrich_charges_soc(self.device, [charge], 100)[0]['data']
        self.assertEqual(data['start_soc_percent'], 20)
        self.assertEqual(data['end_soc_percent'], 30)

if __name__ == '__main__':
    unittest.main()
