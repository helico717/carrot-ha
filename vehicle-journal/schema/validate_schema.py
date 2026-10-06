"""Synthetic SQLite contract checks; no HA imports or production connections."""
from pathlib import Path
import sqlite3
import tempfile
import unittest

SQL = Path(__file__).with_name('001_initial.sql').read_text()
STAMP = '2026-10-06T00:00:00+00:00'


class SchemaTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = sqlite3.connect(Path(self.tmp.name) / 'journal.sqlite3')
        self.db.executescript(SQL)
        self.db.execute('INSERT INTO vehicles VALUES (?,?,?,?,?,?)',
                        ('v', 'entry', 'device', 'Asia/Seoul', 'KRW', STAMP))
        self.record('r')
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def record(self, key, origin='manual', source=None, vehicle='v'):
        self.db.execute('''INSERT INTO records
            (vehicle_id,id,kind,origin,source_kind,source_id,source_fingerprint,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?)''',
            (vehicle, key, 'expense', origin, 'charge' if source else None,
             source, 'fingerprint' if source else None, STAMP, STAMP))

    def expense(self, actual=None, estimate=None, payment=None, key='r'):
        self.db.execute('''INSERT INTO expenses
            (vehicle_id,record_id,accounting_date,category,actual_krw,estimated_krw,
             payment_owner,payment_id,payment_version)
            VALUES (?,?,?,?,?,?,?,?,?)''',
            ('v', key, '2026-10-06', 'charging', actual, estimate,
             'ha_charge_payment' if payment else 'journal', payment, 0 if payment else None))

    def photo(self, key, size=100, mime='image/jpeg', status='active', path=None):
        self.db.execute('INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?,?,?)',
            ('v', key, 'r', path or key + '.jpg', 'synthetic.jpg', mime, size,
             'a' * 64, status, STAMP))

    def test_reexecution_and_structure(self):
        self.db.executescript(SQL)
        self.assertEqual(self.db.execute('SELECT version FROM journal_schema').fetchall(), [(1,)])
        tables = {r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertTrue({'records', 'day_parts', 'daily_summaries', 'dirty_days',
                         'fuel_observations', 'expenses', 'attachments'} <= tables)
        indexes = {r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='index'")}
        self.assertTrue({'records_source', 'expenses_payment', 'expenses_date',
                         'day_parts_date', 'mobility_time'} <= indexes)
        self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_source_identity(self):
        self.record('auto1', 'automatic', 'source1')
        with self.assertRaises(sqlite3.IntegrityError):
            self.record('auto2', 'automatic', 'source1')
        self.db.execute('INSERT INTO vehicles VALUES (?,?,?,?,?,?)',
                        ('other', 'entry2', 'device', 'Asia/Seoul', 'KRW', STAMP))
        self.record('auto3', 'automatic', 'source1', 'other')
        with self.assertRaises(sqlite3.IntegrityError):
            self.record('bad', 'automatic')

    def test_zero_and_missing_cost(self):
        self.expense(0, 300)
        self.assertEqual(self.db.execute('SELECT COALESCE(actual_krw,estimated_krw) FROM expenses').fetchone()[0], 0)
        self.db.execute('UPDATE expenses SET actual_krw=NULL')
        self.assertEqual(self.db.execute('SELECT COALESCE(actual_krw,estimated_krw) FROM expenses').fetchone()[0], 300)

    def test_cost_validation_and_payment_identity(self):
        for invalid in (-1, 0.5):
            with self.assertRaises(sqlite3.IntegrityError):
                self.expense(invalid)
        self.expense(100, payment='payment1')
        self.record('r2')
        with self.assertRaises(sqlite3.IntegrityError):
            self.expense(100, payment='payment1', key='r2')

    def test_json_and_versions(self):
        for value in ('invalid', '[]', 'null'):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute('UPDATE records SET quality_json=?', (value,))
        for value in (0, 1.5):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute('UPDATE records SET version=?', (value,))

    def test_time_and_soc(self):
        query = '''INSERT INTO mobility (vehicle_id,record_id,started_at,ended_at,soc_start_percent)
                   VALUES ('v','r',?,?,?)'''
        for start, end, soc in ((STAMP, '2026-10-05T00:00:00Z', 50),
                                ('invalid', STAMP, 50), (STAMP, STAMP, 101)):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(query, (start, end, soc))
        self.db.execute(query, (STAMP, STAMP, 50))
        self.db.execute('UPDATE mobility SET drive_soc_used_pp=120')

    def test_foreign_keys_and_vehicle_isolation(self):
        self.db.execute('INSERT INTO vehicles VALUES (?,?,?,?,?,?)',
                        ('other', 'entry2', 'device2', 'Asia/Seoul', 'KRW', STAMP))
        self.record('other-record', vehicle='other')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('INSERT INTO record_links VALUES (?,?,?,?,?)',
                            ('v', 'r', 'other-record', 'replaces', STAMP))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM vehicles WHERE id='v'")

    def test_attachments_limits_and_restore(self):
        for invalid in (0, 2097153):
            with self.assertRaises(sqlite3.IntegrityError):
                self.photo('bad', size=invalid)
        with self.assertRaises(sqlite3.IntegrityError):
            self.photo('bad', mime='text/html')
        with self.assertRaises(sqlite3.IntegrityError):
            self.photo('bad', path='../private.jpg')
        for n in range(5):
            self.photo(str(n))
        with self.assertRaises(sqlite3.IntegrityError):
            self.photo('six')
        self.photo('six', status='deleted')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE attachments SET status='active' WHERE id='six'")
        self.db.execute("UPDATE attachments SET status='deleted' WHERE id='0'")
        self.db.execute("UPDATE attachments SET status='active' WHERE id='six'")

    def test_atomic_rollback(self):
        self.db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.record('rollback')
                self.expense(-1, key='rollback')
        self.assertIsNone(self.db.execute("SELECT id FROM records WHERE id='rollback'").fetchone())


if __name__ == '__main__':
    unittest.main(verbosity=2)
