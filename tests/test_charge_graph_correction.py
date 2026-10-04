"""Record exclusions remove inferred graph charging while keeping measured SOC."""
from datetime import datetime, timezone
import importlib
from test_charge_payments import ChargePaymentsTest

history = importlib.import_module('custom_components.carrot_ha.battery_history').history


class ChargeGraphCorrectionTests(ChargePaymentsTest):
    def samples(self):
        for minute in (0, 2, 3, 5, 7):
            stamp = f'2026-01-01T00:{minute:02}:00Z'
            self.archive.put(dict(schema=1, device_id='car', event_id=f's{minute}',
                kind='state', observed_at=stamp,
                data=dict(battery_wh=20000, charging=True, onroad=False,
                          measured_at=stamp, field_measured_at={'battery_wh': stamp})))

    def graph(self):
        return history(self.archive, 'car', 64, 'UTC', datetime(2026, 1, 1, 1, tzinfo=timezone.utc))[-1]

    def test_exclusion_removes_session_and_held_flags_restore_is_exact(self):
        self.charge('a', energy=0.15, duration=120)
        self.samples()
        original = self.graph()
        self.assertEqual(original['charge_s'], 120)
        self.assertTrue(original['charge_hours'][0])
        data = self.data()
        revision = self.archive.revision
        self.archive.set_charge_excluded('car', data['payment_id'], data['source_event_ids'], 0, True)
        self.assertGreater(self.archive.revision, revision)
        corrected = self.graph()
        self.assertEqual(corrected['charge_s'], 0)
        self.assertFalse(any(corrected['charge_hours']))
        self.assertFalse(corrected['hours'][0]['charging'])
        self.assertEqual(corrected['hours'][0]['soc'], original['hours'][0]['soc'])
        for key in ['received_samples', 'valid_samples', 'used', 'covered_s', 'drive_s']:
            self.assertEqual(corrected[key], original[key])
        data = self.archive.charge_history('car', include_excluded=True)[0]['data']
        self.archive.set_charge_excluded('car', data['payment_id'], data['source_event_ids'], data['payment_version'], False)
        self.assertEqual(self.graph(), original)

    def test_nearby_retained_charge_still_has_marker_and_duration(self):
        self.charge('a', energy=0.15, duration=120)
        data = self.data()
        self.archive.set_charge_excluded('car', data['payment_id'], data['source_event_ids'], 0, True)
        self.charge('b', start='2026-01-01T00:05:00Z', energy=0.5, duration=120)
        self.samples()
        corrected = self.graph()
        self.assertEqual(corrected['charge_s'], 120)
        self.assertTrue(corrected['charge_hours'][0])
        self.assertTrue(corrected['hours'][0]['charging'])

    def test_permanent_delete_removes_storage_graph_payment_and_replay(self):
        original = self.charge('cloud-a', energy=0.15, duration=120)
        self.samples()
        data = self.data()
        self.write(data, 99)
        data = self.data()
        self.archive.delete_charge('car', data['payment_id'], data['source_event_ids'], data['payment_version'])
        self.assertEqual(self.archive.charge_history('car', include_excluded=True), [])
        self.assertEqual(self.archive.history('car', 'charge'), [])
        self.assertEqual(self.graph()['charge_s'], 0)
        self.assertFalse(any(self.graph()['charge_hours']))
        self.assertEqual(self.graph()['hours'][0]['soc'], 31.25)
        with self.archive.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM charge_payments').fetchone()[0], 0)
        self.assertFalse(self.archive.put_cloud(original))
        self.assertEqual(self.archive.charge_history('car'), [])
        self.archive = type(self.archive)(self.path)
        self.assertFalse(self.archive.put_cloud(original))
        self.assertEqual(self.archive.charge_totals('car', '2026-01')['excluded_slow_kwh'], 0.15)
