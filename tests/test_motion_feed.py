"""Load pure feed modules without requiring a Home Assistant installation."""
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/'custom_components'/'carrot_ha'
package=types.ModuleType('carrot_feed_test')
package.__path__=[str(ROOT)]
sys.modules[package.__name__]=package
spec=importlib.util.spec_from_file_location('carrot_feed_test.cloud_feed',ROOT/'cloud_feed.py')
feed=importlib.util.module_from_spec(spec)
spec.loader.exec_module(feed)

class FeedTests(unittest.TestCase):
    def parse(self,vehicle):
        events=feed.parse_feed({'state':{'device_id':'test','updated_at':'2026-09-19T00:00:00+00:00',
                                       'onroad':1,'raw_json':{'vehicle':vehicle}}},'test')
        return events[0]['data']
    def test_parked_key_on_overrides_legacy_onroad(self):
        self.assertIs(self.parse({'driving':False,'comma_onroad':True})['onroad'],False)
    def test_unknown_does_not_fall_back_to_key_on(self):
        self.assertIsNone(self.parse({'driving':None})['onroad'])
    def test_legacy_records_preserved(self):
        self.assertEqual(self.parse({})['onroad'],1)

if __name__=='__main__':unittest.main()
