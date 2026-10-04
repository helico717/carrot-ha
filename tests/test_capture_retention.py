"""HA-only ring retention gates, independent of the companion device checkout."""
import ast
import gzip
import json
import tempfile
import unittest
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'custom_components/carrot_ha/can_capture.py'
tree=ast.parse(p.read_text())
tree.body=[n for n in tree.body if not isinstance(n,ast.ImportFrom) or n.module not in ('aiohttp','homeassistant.components.http')]
m={'HomeAssistantView':object};exec(compile(tree,str(p),'exec'),m)

def batch(key):return gzip.compress(json.dumps({'schema':1,'device':'car','batch_id':key,'unix_ns':1,'boot_ns':1,'frames':[[1,1,0,'00']]}).encode())

class RetentionTests(unittest.TestCase):
 def test_cap_shared_by_vehicles_and_oldest_rotated(self):
  with tempfile.TemporaryDirectory() as root:
   a=m['CaptureFiles'](Path(root)/'a');b=m['CaptureFiles'](Path(root)/'b');a.start();b.start()
   k1='a'*32+'-0000000001';k2='b'*32+'-0000000001';w1=batch(k1);w2=batch(k2)
   old=m['MAX_DISK'];reserve=m['METADATA_RESERVE'];m['MAX_DISK']=max(len(w1),len(w2))+1;m['METADATA_RESERVE']=0
   try:
    a.store(k1,w1,'car');b.store(k2,w2,'car')
    self.assertEqual(a.count,0);self.assertEqual(b.count,1)
    self.assertLessEqual(b.status()['total_bytes'],m['MAX_DISK'])
    self.assertTrue(a.status()['enabled']);self.assertEqual(b.status()['rotated_batches'],1)
   finally:m['MAX_DISK']=old;m['METADATA_RESERVE']=reserve
 def test_legacy_enabled_migrates_to_continuous_but_stopped_stays_stopped(self):
  with tempfile.TemporaryDirectory() as root:
   a=Path(root)/'a';a.mkdir();(a/'capture.json').write_text(json.dumps({'until':1}))
   x=m['CaptureFiles'](a);self.assertTrue(x.status()['continuous']);self.assertTrue(x.status()['enabled'])
   x.stop();self.assertFalse(m['CaptureFiles'](a).status()['enabled'])
 def test_duplicate_retry_does_not_rotate_or_double_count(self):
  with tempfile.TemporaryDirectory() as root:
   x=m['CaptureFiles'](Path(root)/'a');x.start();key='a'*32+'-0000000001';wire=batch(key)
   x.store(key,wire,'car');x.stop()
   self.assertTrue(x.store(key,wire,'car')['duplicate'])
   self.assertEqual(x.count,1);self.assertEqual(x.status()['rotated_batches'],0)
