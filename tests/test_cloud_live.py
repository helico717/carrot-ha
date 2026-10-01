"""Test the actual live coroutine without installing Home Assistant."""
import ast
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import unittest
from urllib.parse import urlencode


class LiveTests(unittest.IsolatedAsyncioTestCase):
    def setup_live(self, status=200, failure=None):
        self.calls = 0
        self.notices = []
        self.gate = asyncio.Event()
        self.gate.set()
        self.events = [{'kind': 'state', 'observed_at': '2026-10-01T01:00:00Z'}]
        self.runtime = {'entry': SimpleNamespace(entry_id='entry', data={'device_id': 'car'},
            options={'cloud_url': 'https://example.test', 'cloud_view_token': 'secret'}),
            'latest': {'kind': 'state', 'observed_at': '2026-10-01T00:00:00Z'},
            'syncing': True}  # Archive sync must never block live reads.
        test = self
        class Response:
            async def __aenter__(self):
                await test.gate.wait()
                if failure:
                    raise failure
                return self
            async def __aexit__(self, *args):
                pass
            async def json(self):
                return {'state': {'updated_at': '2026-10-01T01:00:00Z'}}
        def get(url, **kwargs):
            self.calls += 1
            self.assertTrue(url.endswith('/api/latest-state?device_id=car'))
            self.assertFalse(kwargs['allow_redirects'])
            response = Response()
            response.status = status
            return response
        namespace = dict(asyncio=asyncio, datetime=datetime, timezone=timezone, urlencode=urlencode,
            ClientTimeout=lambda **kwargs: None,
            async_get_clientsession=lambda hass: SimpleNamespace(get=get),
            async_dispatcher_send=lambda *args: self.notices.append(args),
            parse_feed=lambda *args: self.events)
        path = Path(__file__).parents[1] / 'custom_components/carrot_ha/cloud_live.py'
        tree = ast.parse(path.read_text())
        tree.body = [n for n in tree.body if isinstance(n, ast.AsyncFunctionDef)]
        exec(compile(tree, str(path), 'exec'), namespace)
        self.refresh = lambda: namespace['refresh_live'](None, self.runtime)

    async def test_concurrent_clients_share_one_read(self):
        self.setup_live()
        await asyncio.gather(*(self.refresh() for _ in range(20)))
        self.assertEqual(self.calls, 1)
        self.assertEqual(len(self.notices), 1)
        self.assertEqual(self.runtime['live_status'], 'ok')
        self.assertEqual(self.runtime['latest']['observed_at'], self.events[0]['observed_at'])
        self.runtime['live_attempt'] -= 16
        await self.refresh()
        self.assertEqual(self.calls, 2)
        self.assertEqual(len(self.notices), 1)

    async def test_failure_is_throttled_and_preserves_state(self):
        for status, failure in [(500, None), (404, None), (200, TimeoutError())]:
            self.setup_live(status, failure)
            previous = self.runtime['latest']
            await asyncio.gather(self.refresh(), self.refresh())
            self.assertEqual(self.calls, 1)
            self.assertIs(self.runtime['latest'], previous)
            self.assertNotIn('live_checked_at', self.runtime)
            self.assertNotEqual(self.runtime['live_status'], 'ok')

    async def test_late_response_cannot_replace_newer_state(self):
        self.setup_live()
        self.gate.clear()
        task = asyncio.create_task(self.refresh())
        await asyncio.sleep(0)
        latest = {'kind': 'state', 'observed_at': '2026-10-01T02:00:00Z'}
        self.runtime['latest'] = latest
        self.gate.set()
        await task
        self.assertIs(self.runtime['latest'], latest)
        self.assertEqual(self.notices, [])

    async def test_charge_events_do_not_replace_vehicle(self):
        self.setup_live()
        self.events.append({'kind': 'charge', 'observed_at': '2026-10-01T03:00:00Z'})
        await self.refresh()
        self.assertEqual(self.runtime['latest']['kind'], 'state')

    async def test_cancellation_releases_lock(self):
        self.setup_live()
        self.gate.clear()
        task = asyncio.create_task(self.refresh())
        await asyncio.sleep(0)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertFalse(self.runtime['live_lock'].locked())


class DashboardViewTests(unittest.IsolatedAsyncioTestCase):
    async def test_live_endpoint_skips_archive_and_preserves_admin_gate(self):
        class StripImports(ast.NodeTransformer):
            def visit_ImportFrom(self, node):
                return None
        path = Path(__file__).parents[1] / 'custom_components/carrot_ha/__init__.py'
        tree = ast.parse(path.read_text())
        tree.body = [n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'DashboardView']
        tree = StripImports().visit(tree)
        runtime = {'entry': SimpleNamespace(data={'device_id': 'car'}, options={})}
        calls = []
        async def refresh(hass, runtime):
            calls.append('cloud')
        async def executor(*args):
            calls.append('archive')
            return ['history']
        namespace = dict(HomeAssistantView=object, DOMAIN='carrot_ha', DEFAULT_SOC_CAPACITY_KWH=64,
            battery_history=lambda hass, runtime, calculate: executor(),
            values=lambda runtime: {'soc_percent': 70}, refresh_live=refresh, history=object(),
            er=SimpleNamespace(async_get=lambda hass: SimpleNamespace(async_get_entity_id=lambda *args: None)),
            web=SimpleNamespace(Response=lambda **kw: kw, json_response=lambda body, **kw: body))
        exec(compile(tree, str(path), 'exec'), namespace)
        hass = SimpleNamespace(data={'carrot_ha': {'entry': runtime}}, async_add_executor_job=executor,
            config=SimpleNamespace(time_zone='Asia/Seoul'))
        class Request(dict):
            query = {'live': '1', 'refresh': '1'}
        request = Request(hass_user=SimpleNamespace(is_admin=False))
        view = namespace['DashboardView'](hass)
        self.assertEqual(await view.get(request, 'entry'), {'status': 403})
        self.assertEqual(calls, [])
        request['hass_user'].is_admin = True
        result = await view.get(request, 'entry')
        self.assertEqual(calls, ['cloud'])
        self.assertEqual(result['values']['soc_percent'], 70)
        self.assertNotIn('battery_history', result['values'])
        request.query = {}
        runtime['archive'] = object()
        result = await view.get(request, 'entry')
        self.assertEqual(result['values']['battery_history'], ['history'])
        self.assertEqual(calls, ['cloud', 'archive'])
