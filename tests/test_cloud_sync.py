"""Exercise the real sync coroutine without a Home Assistant installation."""
import ast
import asyncio
import json
import logging
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace


class CloudSyncTests(unittest.IsolatedAsyncioTestCase):
    async def run_sync(self, fail=False, previous=0):
        def event(hour):
            return {'kind': 'state', 'observed_at': f'2026-09-24T{hour:02}:00:00Z'}

        rows = []
        cursor = [0]
        def set_cursor(kind, value=None):
            if value is not None:
                cursor[0] = value
            return cursor[0]

        responses = [
            {'state': event(10)},
            {'events': [{'sequence': 1, 'raw_json': json.dumps({'deviceId': 'test', 'updatedAt': event(11)['observed_at']})}], 'has_more': True},
            {'events': [], 'has_more': False},
            {'trips': []},
        ]
        class Response:
            status = 200
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            async def json(self):
                return self.body

        def get(url, **kwargs):
            response = Response()
            response.body = responses.pop(0)
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

        namespace = dict(asyncio=asyncio, json=json, datetime=datetime, timezone=timezone,
                         ClientTimeout=lambda **kwargs: None,
                         async_get_clientsession=lambda hass: SimpleNamespace(get=get),
                         async_dispatcher_send=lambda *args: notifications.append(runtime['latest']['observed_at']),
                         parse_feed=parse, _LOGGER=logging.getLogger(__name__))
        path = Path(__file__).parents[1] / 'custom_components/carrot_ha/cloud.py'
        tree = ast.parse(path.read_text(encoding='utf-8'))
        tree.body = [node for node in tree.body if isinstance(node, (ast.ClassDef, ast.AsyncFunctionDef))]
        exec(compile(tree, str(path), 'exec'), namespace)
        await namespace['sync'](SimpleNamespace(async_add_executor_job=executor), runtime)
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

