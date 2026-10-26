"""Retention, upload recovery and source integrity, without HA dependencies."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).parents[1] / 'custom_components/carrot_ha/driving_logs/store.py'
spec = importlib.util.spec_from_file_location('driving_log_store_test', SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DrivingLogTests(unittest.TestCase):
    def test_date_filter_overlaps_whole_drives_before_pagination(self):
        with tempfile.TemporaryDirectory() as directory:
            store = module.LogStore(directory, limit=8000)
            store.state['segments'] = {
                'night--0': {'recorded':200,'duration':100,'complete':True,'files':{'rlog':1}},
                'day--0': {'recorded':400,'duration':100,'complete':True,'files':{'rlog':1}}}
            self.assertEqual(store.routes(start=200,end=350)['total'],2)
            self.assertEqual(store.routes(start=201,end=500)['total'],1)
            self.assertEqual(store.routes(end=100)['total'],0)
            self.assertEqual(store.routes(offset=1,limit=1,start=200,end=500)['routes'][0]['route'],'night')
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = module.LogStore(self.temp.name, limit=4000)

    def upload(self, number, recorded, size=450, route='00000315--4742c01c35'):
        name = f'{route}--{number}'
        files = {'rlog.zst': size, 'qcamera.mp4': size}
        status = self.store.begin({'segment': name, 'recorded': recorded, 'files': files})
        if status['accepted'] and not status['complete']:
            for filename in files:
                self.store.chunk(name, filename, 0, b'x' * size)
            self.store.commit(name, {f: hashlib.sha256(b'x' * size).hexdigest() for f in files})
        return name, status

    def test_recent_suffix_not_arrival_order_and_evicted_not_reuploaded(self):
        first, _ = self.upload(1, 100, route='old')
        self.upload(3, 300, route='new')
        middle, _ = self.upload(2, 200, route='middle')
        self.assertNotIn(first, self.store.state['segments'])
        self.assertIn(middle, self.store.state['segments'])
        self.assertFalse(self.upload(1, 100, route='old')[1]['accepted'])
        self.assertLessEqual(self.store.usage(), self.store.limit)

    def test_retention_removes_whole_drive_and_rejects_later_siblings(self):
        self.store.limit = 8000
        first, _ = self.upload(0, 100, route='old')
        second, _ = self.upload(1, 160, route='old')
        self.upload(0, 300, route='new')
        self.upload(1, 360, route='new')
        self.upload(2, 420, route='new')
        self.assertNotIn(first, self.store.state['segments'])
        self.assertNotIn(second, self.store.state['segments'])
        self.assertFalse((self.store.root / first).exists())
        self.assertFalse((self.store.root / second).exists())
        self.store = module.LogStore(self.temp.name, limit=8000)
        self.assertFalse(self.upload(2, 500, route='old')[1]['accepted'])
        self.assertEqual({n.rsplit('--', 1)[0] for n in self.store.state['segments']}, {'new'})

    def test_oversized_drive_is_removed_in_full(self):
        self.upload(0, 100)
        self.upload(1, 160)
        self.assertFalse(self.upload(2, 220)[1]['accepted'])
        self.assertEqual(self.store.state['segments'], {})

    def test_default_limit_is_five_decimal_gigabytes(self):
        self.assertEqual(module.LIMIT, 5_000_000_000)

    def test_unfinished_files_not_listed_and_resume_after_restart(self):
        name = '00000315--4742c01c35--9'
        self.store.begin({'segment':name, 'recorded':500,'files':{'rlog':100,'qcamera.mp4':100}})
        self.store.chunk(name,'rlog',0,b'a'*25)
        restored = module.LogStore(self.temp.name, limit=1000)
        self.assertEqual(restored.status(name)['offsets']['rlog'],25)
        self.assertEqual(restored.routes()['routes'],[])
        with self.assertRaises(ValueError):
            restored.chunk(name,'rlog',0,b'b')

    def test_hash_mismatch_restart_and_complete_idempotency(self):
        name = '00000315--4742c01c35--10'
        self.store.begin({'segment':name,'recorded':600,'files':{'rlog':10,'qcamera.mp4':10}})
        for f in ('rlog','qcamera.mp4'): self.store.chunk(name,f,0,b'a'*10)
        with self.assertRaises(ValueError): self.store.commit(name,{'rlog':'bad','qcamera.mp4':'bad'})
        self.assertEqual(self.store.status(name)['offsets']['rlog'],0)
        self.store.chunk(name,'rlog',0,b'a'*10)
        hashes={f:hashlib.sha256(b'a'*10).hexdigest() for f in ('rlog','qcamera.mp4')}
        self.assertTrue(self.store.commit(name,hashes)['complete'])
        self.assertTrue(self.store.commit(name,hashes)['complete'])

    def test_oversize_missing_time_and_path_traversal_rejected(self):
        self.assertFalse(self.upload(20,1000,size=3000)[1]['accepted'])
        for name in ('../escape--1','x/evil--1','x--1/evil'):
            with self.assertRaises(ValueError): module.segment_name(name)
        with self.assertRaises(ValueError):
            self.store.begin({'segment':'x--1','files':{'rlog':10,'qcamera.mp4':10}})


if __name__ == '__main__': unittest.main()
