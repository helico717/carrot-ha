"""Exercise durable page checkpoints using the production sync helper."""
import ast
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import unittest
from urllib.parse import urlencode


class IncrementalSyncTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        tree = ast.parse(Path('custom_components/carrot_ha/cloud.py').read_text())
        tree.body = [n for n in tree.body if isinstance(n, (ast.AsyncFunctionDef, ast.ClassDef))]
        self.ns = dict(asyncio=asyncio, datetime=datetime, timezone=timezone, urlencode=urlencode)
        exec(compile(tree, 'cloud.py', 'exec'), self.ns)
        self.cursor = 0
        self.saved = []
        self.calls = []
        def cursor(kind, value=None):
            if value is not None:
                self.cursor = value
            return self.cursor
        self.runtime = {'archive': SimpleNamespace(cursor=cursor), 'entry': SimpleNamespace(data={'device_id':'car'})}
        async def executor(fn, *args):
            return fn(*args)
        self.hass = SimpleNamespace(async_add_executor_job=executor)

    def page(self, seq, more=False):
        return {'schema':'carrot-trip-changes-v1', 'trips':[{'id':str(seq),'sync_sequence':seq}] if seq else [], 'next_cursor':seq, 'has_more':more}

    async def run_pages(self, pages, save=None):
        async def get(path):
            self.calls.append(path)
            result = pages.pop(0)
            if isinstance(result, Exception):
                raise result
            return result
        async def default_save(feed):
            self.saved.extend(feed['trips'])
        return await self.ns['sync_trip_changes'](self.hass, self.runtime, get, save or default_save)

    async def test_persisted_cursor_resumes_and_unchanged_has_no_writes(self):
        self.assertTrue(await self.run_pages([self.page(1,True),self.page(3)]))
        self.assertEqual(self.cursor,3)
        self.assertIn('after=1',self.calls[-1])
        saved=len(self.saved)
        await self.run_pages([{'schema':'carrot-trip-changes-v1','trips':[], 'next_cursor':3,'has_more':False}])
        self.assertEqual(len(self.saved),saved)
        self.assertIn('after=3',self.calls[-1])

    async def test_partial_write_failure_does_not_advance_page(self):
        async def fail(feed):
            raise OSError('disk full')
        with self.assertRaises(OSError):
            await self.run_pages([self.page(1)],fail)
        self.assertEqual(self.cursor,0)
        await self.run_pages([self.page(1)])
        self.assertEqual(self.cursor,1)

    async def test_budget_and_resume(self):
        await self.run_pages([self.page(i,True) for i in range(1,11)])
        self.assertEqual(self.cursor,10)
        self.assertEqual(len(self.calls),10)
        await self.run_pages([self.page(11)])
        self.assertEqual(self.cursor,11)

    async def test_invalid_cursor_never_commits(self):
        for page in [self.page(0,True),{**self.page(1),'next_cursor':0},{**self.page(1),'schema':'wrong'}]:
            with self.assertRaises(ValueError):
                await self.run_pages([page])
            self.assertEqual(self.cursor,0)
        self.assertEqual(self.saved,[])

    async def test_only_compatibility_errors_fall_back_and_probe_is_throttled(self):
        error=self.ns['CloudHTTPError']
        self.assertFalse(await self.run_pages([error(404,'/api/trip-changes')]))
        self.assertFalse(await self.run_pages([]))
        self.assertEqual(len(self.calls),1)
        self.runtime.pop('trip_changes_retry_at')
        with self.assertRaises(error):
            await self.run_pages([error(503,'/api/trip-changes')])
        self.assertEqual(self.cursor,0)
