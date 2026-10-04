"""Exercise the real sync coroutine without a Home Assistant installation."""
import ast
import asyncio
import json
import logging
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlencode


class CloudSyncTests(unittest.IsolatedAsyncioTestCase):
    async def run_sync(self, fail=False, previous=0, trip_pages=None, repeat=False, legacy=False, state_500=False, trip_500=False):
        def event(hour):
            return {'kind': 'state', 'observed_at': f'2026-09-24T{hour:02}:00:00Z'}

        rows = []
        cursor = [0]
        cursors = {}
        def set_cursor(kind, value=None):
            if kind != 'telemetry':
                if value is not None:
                    cursors[kind] = value
                return cursors.get(kind, 0)
            if value is not None:
                cursor[0] = value
            return cursor[0]

        responses = [
            {'state': event(10)},
            {'events': [{'sequence': 1, 'raw_json': json.dumps({'deviceId': 'test', 'updatedAt': event(11)['observed_at']})}], 'has_more': True},
            {'events': [], 'has_more': False},
            {'trips': []},
        ]
        if trip_pages is not None:
            responses[-1:] = [{'trips': page} for page in trip_pages]
        calls = []
        class Response:
            status = 200
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            async def json(self):
                return self.body

        def get(url, **kwargs):
            calls.append(url)
            response = Response()
            if '/api/trip-changes?' in url:
                response.status = 404
                return response
            if (legacy or state_500) and '/api/latest-state?' in url:
                response.status = 500 if state_500 else 404
                return response
            if trip_500 and '/api/trips?' in url:
                response.status = 500
                return response
            response.body = responses.pop(0) if responses else {}
            if fail and 'after=1' in url:
                response.status = 500
            return response

        async def executor(fn, *args):
            return fn(*args)

        runtime = {'entry': SimpleNamespace(entry_id='test', data={'device_id': 'test'}, options={'cloud_url': 'https://example.test', 'cloud_view_token': 'test'}),
                   'lock': asyncio.Lock(), 'latest': event(previous) if previous else None,
                   'archive': SimpleNamespace(put_cloud=rows.append, cursor=set_cursor, latest=lambda device: max(rows, key=lambda e: e['observed_at']), overview=lambda device: {})}
        notifications = []
        def parse(feed, device):
            state = feed.get('state')
            return [state if 'observed_at' in state else {'kind': 'state', 'observed_at': state['updated_at']}] if state else []

        async def refresh_costs(hass, runtime):
            runtime['charge_cost_totals'] = {'effective_cost_krw': 0}

        namespace = dict(refresh_runtime_costs=refresh_costs, asyncio=asyncio, json=json, datetime=datetime, timezone=timezone, urlencode=urlencode,
                         ClientTimeout=lambda **kwargs: None,
                         async_get_clientsession=lambda hass: SimpleNamespace(get=get),
                         async_dispatcher_send=lambda *args: notifications.append(runtime['latest']['observed_at']),
                         parse_feed=parse, _LOGGER=logging.getLogger(__name__))
        path = Path(__file__).parents[1] / 'custom_components/carrot_ha/cloud.py'
        tree = ast.parse(path.read_text(encoding='utf-8'))
        tree.body = [node for node in tree.body if isinstance(node, (ast.ClassDef, ast.AsyncFunctionDef))]
        exec(compile(tree, str(path), 'exec'), namespace)
        await namespace['sync'](SimpleNamespace(async_add_executor_job=executor), runtime)
        if repeat:
            responses.extend([{'state': event(10)}, {'events': [], 'has_more': False}, {'trips': []}])
            await namespace['sync'](SimpleNamespace(async_add_executor_job=executor), runtime)
        runtime['test_calls'] = calls
        runtime['test_cursors'] = cursors
        return runtime, cursor[0], notifications

    async def test_history_failure_still_publishes_committed_latest(self):
        runtime, cursor, notifications = await self.run_sync(fail=True)
        self.assertEqual(runtime['latest']['observed_at'], '2026-09-24T11:00:00Z')
        self.assertEqual(runtime['cloud_status'], 'HTTP_500')
        self.assertEqual(cursor, 1)
        self.assertFalse(runtime['syncing'])
        self.assertEqual(len(notifications), 2)

    async def test_success_publishes_once_after_history(self):
        runtime, _, notifications = await self.run_sync()
        self.assertEqual(runtime['latest']['observed_at'], '2026-09-24T11:00:00Z')
        self.assertEqual(runtime['cloud_status'], 'ok')
        self.assertEqual(len(notifications), 2)

    async def test_history_cannot_replace_newer_runtime(self):
        runtime, _, notifications = await self.run_sync(previous=12)
        self.assertTrue(all(stamp == '2026-09-24T12:00:00Z' for stamp in notifications))

    async def test_lightweight_state_and_legacy_fallback(self):
        runtime, _, _ = await self.run_sync()
        self.assertTrue(runtime['test_calls'][0].endswith('/api/latest-state?device_id=test'))
        self.assertFalse(any('/api/json' in url for url in runtime['test_calls']))
        runtime, _, _ = await self.run_sync(legacy=True)
        self.assertTrue(runtime['test_calls'][1].endswith('/api/json'))
        self.assertEqual(runtime['cloud_status'], 'ok')

    async def test_repeated_page_stops(self):
        page = [{'id': str(i)} for i in range(10)]
        runtime, _, _ = await self.run_sync(trip_pages=[page, page])
        self.assertEqual(runtime['cloud_status'], 'error')
        self.assertEqual(runtime['test_cursors']['trip_offset'], 0)
        self.assertEqual(sum('/api/trips?' in url for url in runtime['test_calls']), 2)

    async def test_page_budget_resumes_next_sync(self):
        pages = [[{'id': str(p * 10 + i)} for i in range(10)] for p in range(10)]
        runtime, _, _ = await self.run_sync(trip_pages=pages)
        self.assertEqual(runtime['test_cursors']['trip_offset'], 100)
        self.assertEqual(runtime['cloud_status'], 'ok')
        runtime, _, _ = await self.run_sync(trip_pages=pages, repeat=True)
        self.assertIn('offset=100&', runtime['test_calls'][-1])
        self.assertEqual(runtime['cloud_trip_count'], 100)
        self.assertEqual(runtime['test_cursors']['trip_offset'], 0)

    async def test_latest_state_500_falls_back_to_json(self):
        runtime, _, _ = await self.run_sync(state_500=True)
        self.assertTrue(runtime['test_calls'][0].endswith('/api/latest-state?device_id=test'))
        self.assertTrue(runtime['test_calls'][1].endswith('/api/json'))
        self.assertEqual(runtime['cloud_status'], 'ok')

    async def test_trip_sync_500_preserves_state_and_completes_ok(self):
        runtime, _, _ = await self.run_sync(trip_500=True)
        self.assertEqual(runtime['cloud_status'], 'ok')
        self.assertIsNotNone(runtime['latest'])
        self.assertIsNotNone(runtime['cloud_last_sync'])
