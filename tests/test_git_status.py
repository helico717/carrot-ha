import asyncio
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('git_status',Path('custom_components/carrot_ha/git_status.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class GitStatusTests(unittest.IsolatedAsyncioTestCase):
    async def test_offline_persisted_commit_comparison_and_shared_cache(self):
        calls=[]; clock=[0]; checker=module.GitStatus(lambda:clock[0])
        data={'comma_git_commit':'a'*40,'comma_git_measured_at':'2026-10-11T00:00:00Z'}
        async def fetch(path):
            calls.append(path)
            await asyncio.sleep(0)
            if '/compare/' in path:return {'ahead_by':4,'behind_by':0,'status':'ahead'}
            return {'sha':'b'*40,'commit':{'message':'New feature\n\nDetails'}}
        results=await asyncio.gather(checker.get(data,fetch),checker.get(data,fetch))
        self.assertEqual(len(calls),2)
        self.assertEqual(results[0]['behind'],4)
        self.assertEqual(results[0]['installed_measured_at'],data['comma_git_measured_at'])
        clock[0]=601
        async def fail(path):raise OSError('offline')
        cached=await checker.get(data,fail)
        self.assertTrue(cached['cached']);self.assertEqual(cached['behind'],4)
        self.assertEqual(cached['checked_at'],results[0]['checked_at'])

    async def test_unknown_device_and_unavailable_compare_still_show_latest(self):
        async def fetch(path):
            if '/compare/' in path:raise OSError('missing base')
            return {'sha':'b'*40,'commit':{'message':'Latest'}}
        checker=module.GitStatus()
        unknown=await checker.get({},fetch)
        self.assertIsNone(unknown['installed_commit']);self.assertIsNone(unknown['behind'])
        self.assertEqual(unknown['latest_message'],'Latest')
        known=await checker.get({'comma_git_commit':'a'*40},fetch)
        self.assertEqual(known['error'],'comparison_unavailable')
        self.assertEqual(known['latest_message'],'Latest')

    async def test_changed_commit_invalidates_cache_and_divergence(self):
        calls=[]
        async def fetch(path):
            calls.append(path)
            if '/compare/' in path:return {'ahead_by':3,'behind_by':2,'status':'diverged'}
            return {'sha':'b'*40,'commit':{'message':'Latest'}}
        checker=module.GitStatus()
        first=await checker.get({'comma_git_commit':'b'*40},fetch)
        self.assertEqual(first['behind'],0);self.assertEqual(len(calls),1)
        second=await checker.get({'comma_git_commit':'a'*40},fetch)
        self.assertEqual(second['comparison'],'diverged');self.assertEqual(second['ahead'],2)
