"""Lossless migration, SQL compatibility, idempotency, and rollback gates."""
import importlib
import json
import sqlite3
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
from datetime import datetime, timezone
from pathlib import Path

package = sys.modules.setdefault('custom_components.carrot_ha', types.ModuleType('custom_components.carrot_ha'))
package.__path__ = ['custom_components/carrot_ha']
Archive = importlib.import_module('custom_components.carrot_ha.storage').Archive
codec = importlib.import_module('custom_components.carrot_ha.archive_codec')


def event(key='cloud-large', battery=50000):
    return dict(schema=1, device_id='test', event_id=key, kind='state',
                observed_at=datetime.now(timezone.utc).isoformat(),
                data=dict(battery_wh=battery, odometer_km=12345, charging=False,
                          field_measured_at={'battery_wh': '2026-10-04T00:00:00+00:00'},
                          charge_months={'2026-10': {'slow_kwh': 42}},
                          charge_sessions=[{'id': 'charge-one', 'detail': 'x' * 12000}],
                          cloud_raw_state={'vehicle': {'details': 'y' * 12000}}))


class CompressionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'archive.sqlite3'
        self.archive = Archive(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_exact_bytes_projection_and_collision(self):
        e = event()
        raw = json.dumps(e, ensure_ascii=False, indent=2)
        packed = codec.pack(raw)
        self.assertLess(len(packed), len(raw) / 2)
        self.assertEqual(codec.unpack(packed), raw)
        self.assertEqual(codec.loads(packed), e)
        with self.archive.connect() as db:
            self.assertEqual(db.execute("SELECT json_extract(?,'$.data.battery_wh')", (packed,)).fetchone()[0], 50000)
        e[codec.MARKER] = 'user field'
        raw = json.dumps(e)
        self.assertEqual(codec.loads(codec.pack(raw)), e)

    def test_corrupt_compression_is_explicit_error(self):
        packed = json.loads(codec.pack(json.dumps(event())))
        packed[codec.MARKER] = 'not base64!'
        with self.assertRaises(ValueError):
            codec.unpack(json.dumps(packed))

    def test_migration_dedup_and_restore_with_new_records(self):
        e = event()
        self.assertTrue(self.archive.put_cloud(e))
        with self.archive.connect() as db:
            original = db.execute('SELECT rowid,body FROM events').fetchone()
        self.assertFalse(self.archive.compression_enabled)
        result = self.archive.compact_lossless()
        self.assertEqual(result['compressed_rows'], 1)
        self.assertTrue(Path(result['backup']).exists())
        self.assertEqual(self.archive.latest('test'), e)
        self.assertEqual(self.archive.history('test', 'state'), [e])
        self.assertEqual(self.archive.history('test', 'state', since='2026-01-01T00:00:00Z'), [e])
        revision = self.archive.revision
        self.assertFalse(self.archive.put_cloud(e))
        self.assertEqual(self.archive.revision, revision)
        self.assertEqual(self.archive.compact_lossless()['compressed_rows'], 0)
        later = event('cloud-later', 48000)
        self.archive.put_cloud(later)
        # Direct immutable duplicate comparison also reads packed originals.
        direct = event('direct-large')
        self.assertTrue(self.archive.put(direct))
        self.assertFalse(self.archive.put(direct))
        changed = dict(direct, data=dict(direct['data'], battery_wh=47000))
        with self.assertRaises(ValueError):
            self.archive.put(changed)
        self.assertEqual(self.archive.restore_lossless()['restored_rows'], 3)
        self.assertFalse(self.archive.compression_enabled)
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT rowid,body FROM events WHERE id=?', (e['event_id'],)).fetchone(), original)
            self.assertEqual(json.loads(db.execute('SELECT body FROM events WHERE id=?', (later['event_id'],)).fetchone()[0]), later)
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        # Historical backup is not replaced on retry.
        with sqlite3.connect(result['backup']) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM events').fetchone()[0], 1)

    def test_interrupted_migration_resumes_and_preserves_all_rows(self):
        for i in range(201):
            self.archive.put_cloud(event(f'cloud-{i}'))
        original_pack = codec.pack
        count = 0
        def interrupted(body):
            nonlocal count
            count += 1
            if count == 201:
                raise RuntimeError('Simulated interruption after committed batch')
            return original_pack(body)
        with patch.object(codec, 'pack', side_effect=interrupted):
            with self.assertRaises(RuntimeError):
                self.archive.compact_lossless()
        self.assertFalse(self.archive.compression_enabled)
        self.assertEqual(len(self.archive.history('test', 'state', 500)), 201)
        self.assertEqual(self.archive.compact_lossless()['compressed_rows'], 1)
        self.assertEqual(self.archive.restore_lossless()['restored_rows'], 201)

    def test_emergency_utility_keeps_source_and_restores_copy(self):
        e = event()
        self.archive.put_cloud(e)
        self.archive.compact_lossless()
        output = Path(self.temp.name) / 'recovery.sqlite3'
        subprocess.run([sys.executable, 'scripts/restore_archive_json.py',
                        str(self.path), str(output)], check=True, capture_output=True)
        with sqlite3.connect(output) as db:
            self.assertEqual(json.loads(db.execute('SELECT body FROM events').fetchone()[0]), e)
        with self.archive.connect() as db:
            self.assertNotIn('schema', json.loads(db.execute('SELECT body FROM events').fetchone()[0]))

    def test_concurrent_cloud_update_is_not_overwritten(self):
        e = event()
        self.archive.put_cloud(e)
        original_pack = codec.pack
        def interleaved(body):
            newer = dict(e, data=dict(e['data'], battery_wh=47000))
            self.archive.put_cloud(newer)
            return original_pack(body)
        with patch.object(codec, 'pack', side_effect=interleaved):
            self.assertEqual(self.archive.compact_lossless()['compressed_rows'], 0)
        self.assertEqual(self.archive.latest('test')['data']['battery_wh'], 47000)

    def test_no_disk_space_leaves_original_untouched(self):
        e = event()
        self.archive.put_cloud(e)
        with patch.object(sys.modules[Archive.__module__].shutil, 'disk_usage',
                   return_value=types.SimpleNamespace(free=0)):
            with self.assertRaises(OSError):
                self.archive.compact_lossless()
        self.assertFalse(self.archive.compression_enabled)
        self.assertEqual(self.archive.latest('test'), e)
        self.assertFalse(Path(str(self.path) + '.before-compression.sqlite3').exists())

    def test_cloud_changed_record_and_mixed_storage(self):
        e = event()
        self.archive.put_cloud(e)
        self.archive.compact_lossless()
        e['data']['battery_wh'] = 49000
        self.assertTrue(self.archive.put_cloud(e))
        self.assertEqual(self.archive.latest('test'), e)
        self.archive.set_compression(False)
        self.assertFalse(self.archive.put_cloud(e))
        self.assertEqual(self.archive.latest('test'), e)
        # Small records and trips remain plain JSON for native route mutation.
        small = dict(e, event_id='cloud-small', data={'battery_wh': 40000})
        self.archive.set_compression(True)
        self.archive.put_cloud(small)
        with self.archive.connect() as db:
            self.assertEqual(json.loads(db.execute('SELECT body FROM events WHERE id=?', ('cloud-small',)).fetchone()[0]), small)


if __name__ == '__main__':
    unittest.main()
