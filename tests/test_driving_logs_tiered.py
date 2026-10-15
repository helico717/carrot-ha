"""Synthetic replicas, archive expiry, whole-drive cache eviction and clean restore."""
import hashlib
import importlib
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

package = types.ModuleType('tiered_logs_test')
package.__path__ = [str(Path(__file__).parents[1] / 'custom_components/carrot_ha/driving_logs')]
sys.modules[package.__name__] = package
module = importlib.import_module(package.__name__ + '.tiered')


class TieredTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)
        self.nas = self.path / 'network' / 'driving-logs'
        self.nas.parent.mkdir()
        self.now = 1_800_000_000
        self.online = True
        self.size_patch = patch.object(module, 'LOCAL_LIMIT', 4_000_000)
        self.size_patch.start()
        self.addCleanup(self.size_patch.stop)
        self.store = self.new_store('ha')

    def guard(self, value):
        if not self.online:
            raise OSError('Simulated disconnected mount')
        return Path(value)

    def new_store(self, folder, device='car'):
        return module.TieredLogStore(self.path / folder, self.nas, device, clock=lambda: self.now, guard=self.guard)

    def upload(self, name, recorded=None, size=200_000):
        data = b'x' * size
        files = {'rlog': size, 'qcamera.mp4': size}
        result = self.store.begin({'segment': name, 'recorded': recorded or self.now, 'files': files})
        if not result.get('accepted') or result.get('complete'):
            return result
        for filename in files:
            offset = result['offsets'][filename]
            while offset < size:
                chunk = data[offset:offset + module.CHUNK]
                offset = self.store.chunk(name, filename, offset, chunk)['offset']
        return self.store.commit(name, {f: hashlib.sha256(data).hexdigest() for f in files})

    def settle(self, store=None):
        store = store or self.store
        for _ in range(30):
            result = store.maintain()
            if result['phase'] == 'ready':
                return result
        self.fail('Archive did not settle')

    def test_primary_nas_union_and_whole_drive_cache_rotation(self):
        for route in range(3):
            for segment in range(2):
                self.upload(f'route{route}--{segment}', self.now - 1000 + route * 100 + segment, 400_000)
        self.settle()
        self.assertEqual(len(self.store.routes()['routes']), 3)
        self.assertEqual(len(self.store.nas.state['segments']), 6)
        self.assertEqual(set(self.store.local.state['segments']), {'route2--0', 'route2--1'})
        self.assertLessEqual(self.store.usage(), self.store.limit)
        self.assertEqual(self.store.file('route0--0', 'rlog').parent.parent, self.store.nas.root)
        self.assertEqual(self.store.routes()['routes'][-1]['storageSources'], ['nas'])

    def test_clean_install_restores_same_device_with_new_entry_directory(self):
        self.upload('recent--0')
        self.upload('recent--1')
        self.settle()
        fresh = self.new_store('different-ha-entry')
        self.assertEqual(fresh.local.routes()['routes'], [])
        self.assertEqual(len(fresh.routes()['routes']), 1)
        self.settle(fresh)
        self.assertEqual(len(fresh.local.state['segments']), 2)
        self.assertEqual(fresh.file('recent--0', 'rlog').read_bytes(), b'x' * 200_000)
        self.assertEqual(self.new_store('another-car', 'other').routes()['routes'], [])

    def test_legacy_floor_does_not_hide_30_day_backfill(self):
        self.store.local.state['floor'] = self.now - 60
        self.upload('backfill--0', self.now - 7 * 86400)
        self.assertIn('backfill--0', self.store.nas.state['segments'])
        self.assertLess(self.store.state['floor'], self.now - 7 * 86400)

    def test_offline_cache_reads_and_unverified_recordings_are_protected(self):
        self.upload('cached--0')
        self.settle()
        self.online = False
        self.assertTrue(self.store.file('cached--0', 'rlog').exists())
        self.upload('offline--0', self.now + 10, 800_000)
        with self.assertRaises(OSError):
            self.upload('newer--0', self.now + 20, 800_000)
        self.assertIn('offline--0', self.store.local.state['segments'])
        self.assertLessEqual(self.store.usage(), self.store.limit)
        self.online = True
        self.settle()
        self.assertIn('offline--0', self.store.nas.state['segments'])

    def test_30_days_expiry_uses_whole_drive_end_and_not_arrival_time(self):
        self.upload('expired--0', self.now - 29 * 86400)
        self.upload('crossing--0', self.now - 29 * 86400)
        self.upload('crossing--1', self.now - 27 * 86400)
        self.settle()
        self.now += 2 * 86400
        self.settle()
        self.assertNotIn('expired--0', self.store.nas.state['segments'])
        self.assertIn('crossing--0', self.store.nas.state['segments'])
        self.assertIn('crossing--1', self.store.nas.state['segments'])
        self.assertTrue(self.store.file('expired--0', 'rlog').exists(), 'local cache has capacity policy, not 30-day expiry')

    def test_migration_verifies_nas_before_reclaiming_existing_ha_files(self):
        self.online = False
        self.upload('legacy--0')
        self.assertEqual(self.store.catalog['segments'], {})
        self.online = True
        self.assertEqual(self.store.maintain()['phase'], 'archiving')
        self.assertTrue(self.store.nas.state['segments']['legacy--0']['hashes'])
        self.settle()

    def test_nonempty_unmanaged_nas_folder_is_never_adopted(self):
        unrelated = self.path / 'unmanaged' / 'driving-logs'
        unrelated.mkdir(parents=True)
        (unrelated / 'keep.txt').write_text('unrelated backup')
        store = module.TieredLogStore(self.path / 'separate', unrelated, 'car', clock=lambda: self.now, guard=self.guard)
        self.assertEqual(store.nas_status, 'unavailable')
        self.assertEqual((unrelated / 'keep.txt').read_text(), 'unrelated backup')

    def test_failed_readback_never_authorizes_local_eviction_after_catalog_refresh(self):
        self.online = False
        self.upload('protected--0')
        self.online = True
        with patch.object(module, 'digest', return_value='incorrect'):
            with self.assertRaisesRegex(OSError, 'checksum'):
                self.store.maintain()
        self.store._catalog()
        with self.assertRaises(OSError):
            self.store.protect({'protected'})
        self.assertTrue(self.store.local.file('protected--0', 'rlog').exists())
        self.assertEqual(self.store.maintain()['phase'], 'archiving')
        self.store.protect({'protected'})

    def test_legacy_replica_without_verified_marker_is_read_back_again(self):
        self.upload('existing--0')
        self.settle()
        self.store.nas.state['segments']['existing--0'].pop('replica_verified')
        self.store.nas._save()
        self.store._catalog()
        with self.assertRaises(OSError):
            self.store.protect({'existing'})
        self.assertEqual(self.store.maintain()['phase'], 'archiving')
        self.store.protect({'existing'})
