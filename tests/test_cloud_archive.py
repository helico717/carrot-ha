import base64
import gzip
import importlib.util
import json
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('cloud_archive',Path('custom_components/carrot_ha/cloud_archive.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


def packed(value):
    return json.dumps({'_carrot_cloud_archive_v1':1,'codec':'gzip',
                      'data':base64.b64encode(gzip.compress(json.dumps(value).encode())).decode()})


class CloudArchiveTests(unittest.TestCase):
    def test_lossless_context_and_legacy(self):
        context={'charge_sessions':[{'id':'one','energy_kwh':1.25}],'charge_months':{'2026-10':{'cost':1234}}}
        original={'deviceId':'car','vehicle':{'battery_wh':50000,**context}}
        compact={'deviceId':'car','vehicle':{'battery_wh':50000,**{k:{'_carrot_context_field':k} for k in context}}}
        feed={'encoding':'carrot-cloud-archive-v1','contexts':{'hash':packed(context)},
              'events':[{'device_id':'car','sequence':7,'context_hash':'hash','raw_json':packed(compact)}]}
        restored=module.restore_page(feed)
        self.assertEqual(json.loads(restored['events'][0]['raw_json']),original)
        self.assertEqual(module.restore_page({'events':[]}),{'events':[]})
        feed['contexts']={}
        with self.assertRaises(ValueError):module.restore_page(feed)

    def test_corruption_and_bomb_never_restore(self):
        with self.assertRaises(ValueError): module.decoded(packed({'large':'x'*(module.MAX_RAW+1)}))
        with self.assertRaises(ValueError): module.decoded('{"_carrot_cloud_archive_v1":1,"codec":"gzip","data":"bad"}')
        with self.assertRaises(ValueError):module.restore_page({'encoding':'carrot-cloud-archive-v1',
            'events':[{'device_id':'other','raw_json':packed({'deviceId':'car'})}]})
