"""Save correctness when unchanged archives skip historical reprojection."""
from pathlib import Path
import sys
import tempfile
from time import perf_counter
import types
import unittest
from unittest.mock import patch
from uuid import uuid4

pkg = types.ModuleType('custom_components.carrot_ha')
pkg.__path__ = ['custom_components/carrot_ha']
sys.modules.setdefault('custom_components', types.ModuleType('custom_components'))
sys.modules.setdefault('custom_components.carrot_ha', pkg)
from custom_components.carrot_ha.storage import Archive
from custom_components.carrot_ha.vehicle_journal.store import Journal, Conflict
from custom_components.carrot_ha.vehicle_journal import source
from custom_components.carrot_ha.vehicle_journal.save import save_linked, SaveTimings


class SaveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.archive = Archive(Path(self.temp.name)/'archive.sqlite3')
        self.journal = Journal(Path(self.temp.name)/'journal.sqlite3', 'entry', 'car', 'Asia/Seoul')
        self.journal.soc_capacity_kwh = 64.0
        self.archive.put({'schema': 1, 'device_id': 'car', 'event_id': 'charge', 'kind': 'charge',
            'observed_at': '2026-09-01T15:30:00Z', 'data': {
            'started_at': '2026-09-01T14:30:00Z', 'ended_at': '2026-09-01T15:30:00Z',
            'duration_s': 3600, 'energy_kwh': 12, 'cost_krw': 3600, 'can_mode': 6}})
        source.sync(self.archive, self.journal)
        with self.journal.connect() as db:
            self.key, self.version = db.execute("SELECT id,version FROM records WHERE kind='expense'").fetchone()
        self.payload = {'kind': 'expense', 'date': '2026-09-02', 'category': 'charging', 'actual_krw': 1234, 'memo': 'edited'}

    def save(self, key=None, version=None, payload=None):
        return save_linked(self.archive, self.journal, key or self.key,
            self.version if version is None else version, payload or self.payload, SaveTimings(), perf_counter())

    def test_payment_persisted_projected_and_reloads_with_one_snapshot(self):
        with patch.object(source, 'snapshot', wraps=source.snapshot) as snapshot:
            saved = self.save()
            self.assertEqual(snapshot.call_count, 1)
        group = self.archive.charge_history('car')[0]['data']
        self.assertEqual(group['actual_cost_krw'], 1234)
        row = next(r for r in self.journal.query('2026-09-01', '2026-09-30')['records'] if r['id'] == self.key)
        self.assertEqual(row['actual_krw'], 1234)
        self.assertEqual(row['memo'], 'edited')
        self.assertEqual(row['version'], saved['version'])
        self.assertEqual(self.journal.query('2026-09-02', '2026-09-02')['totals']['categories']['charging']['actual_krw'], 1234)
        self.assertFalse(source.sync(self.archive, self.journal))
        with self.journal.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM payment_outbox').fetchone()[0], 0)
        with self.assertRaises(Conflict):
            self.save()  # Old browser version must still be rejected.

    def test_manual_expense_skips_both_full_snapshots(self):
        with patch.object(source, 'snapshot', wraps=source.snapshot) as snapshot:
            key = str(uuid4())
            self.save(key, 0, {'kind': 'expense', 'date': '2026-09-02', 'category': 'washing', 'actual_krw': 500})
            self.assertEqual(snapshot.call_count, 0)
        self.assertEqual(self.journal.query('2026-09-02', '2026-09-02')['totals']['categories']['washing']['actual_krw'], 500)

    def test_new_archive_data_still_syncs_before_save(self):
        self.archive.put({'schema': 1, 'device_id': 'car', 'event_id': 'trip', 'kind': 'trip',
            'observed_at': '2026-09-02T01:00:00Z', 'data': {
            'started_at': '2026-09-02T00:00:00Z', 'ended_at': '2026-09-02T01:00:00Z', 'distance_m': 10000}})
        with patch.object(source, 'snapshot', wraps=source.snapshot) as snapshot:
            self.save()
            self.assertEqual(snapshot.call_count, 2)
        self.assertEqual(self.journal.query('2026-09-01', '2026-09-30')['totals']['distance_km'], 10)

    def test_failed_payment_write_remains_durable_and_replays(self):
        with patch.object(self.archive, 'set_charge_payment', side_effect=OSError('synthetic failure')):
            with self.assertRaises(OSError):
                self.save()
        with self.journal.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM payment_outbox').fetchone()[0], 1)
        source.sync(self.archive, self.journal)
        self.assertEqual(self.archive.charge_history('car')[0]['data']['actual_cost_krw'], 1234)
        with self.journal.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM payment_outbox').fetchone()[0], 0)

    def test_failed_projection_retries_after_payment_committed(self):
        with patch.object(self.journal, 'import_snapshot', side_effect=OSError('synthetic failure')):
            with self.assertRaises(OSError):
                self.save()
        self.assertEqual(self.archive.charge_history('car')[0]['data']['actual_cost_krw'], 1234)
        self.assertTrue(source.sync(self.archive, self.journal))
        row = next(r for r in self.journal.query('2026-09-01', '2026-09-30')['records'] if r['id'] == self.key)
        self.assertEqual(row['actual_krw'], 1234)

    def test_capacity_change_does_not_skip_reprojection(self):
        self.journal.soc_capacity_kwh = 70
        with patch.object(source, 'snapshot', wraps=source.snapshot) as snapshot:
            self.save(str(uuid4()), 0, {'kind': 'expense', 'date': '2026-09-02', 'category': 'washing', 'actual_krw': 500})
            self.assertEqual(snapshot.call_count, 1)
        self.assertEqual(self.journal.synced_soc_basis(), 70)


class TimingPrivacyTests(unittest.TestCase):
    def test_slow_save_logs_only_stage_durations(self):
        from custom_components.carrot_ha.vehicle_journal import save
        with patch.object(save, 'perf_counter', return_value=10.0) as clock:
            timing = SaveTimings()
            clock.return_value = 10.5
            timing.since('runtime_lock_wait', 10.0)
            clock.return_value = 12.5
            with self.assertLogs(save.__name__, level='WARNING') as captured:
                timing.log('ok')
        self.assertIn('total_ms=2500.0', captured.output[0])
        self.assertIn("'runtime_lock_wait': 500.0", captured.output[0])
        self.assertNotIn('record_id', captured.output[0])
        self.assertNotIn('payload', captured.output[0])
