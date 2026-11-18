import asyncio
from copy import deepcopy
import importlib.util
from pathlib import Path
import sys
import types
import unittest

ROOT = Path(__file__).resolve().parents[1] / 'custom_components/carrot_ha'
package = types.ModuleType('sync_health_test')
package.__path__ = [str(ROOT)]
sys.modules[package.__name__] = package


def load(name):
    spec = importlib.util.spec_from_file_location(f'{package.__name__}.{name}', ROOT / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


core = load('github_actions')
runtime = load('github_actions_runtime')
NOW = core.timestamp('2026-11-18T01:00:00Z')


def run(event='schedule', age=3600, conclusion='success', status='completed'):
    return {'id': 123, 'event': event, 'created_at': core.iso(NOW - age),
            'conclusion': conclusion, 'status': status, 'head_branch': 'carrot-wip'}


class Fixture:
    def __init__(self):
        self.now = NOW
        self.calls = []
        self.fail = set()
        self.workflow = {'state': 'active'}
        self.latest = run()
        self.scheduled = run()
        self.comparison = {'ahead_by': 0, 'behind_by': 129, 'status': 'behind'}
        self.health = core.ActionsHealth(lambda: self.now)

    async def fetch(self, path):
        self.calls.append(path)
        key = ('comparison' if '/compare/' in path else 'scheduled' if 'event=schedule' in path
               else 'latest' if '/runs?' in path else 'workflow')
        if key in self.fail:
            raise OSError('never persist this exception body')
        value = deepcopy(getattr(self, key))
        return {'workflow_runs': [value] if value else []} if key in {'latest', 'scheduled'} else value


class ActionsTests(unittest.IsolatedAsyncioTestCase):
    async def test_normal_and_coalesced_six_hour_checks(self):
        f = Fixture()
        await asyncio.gather(*(f.health.check(f.fetch) for _ in range(10)))
        self.assertEqual(len(f.calls), 4)
        self.assertEqual(f.health.snapshot()['state'], 'healthy')
        f.now += core.INTERVAL - 1
        await f.health.check(f.fetch)
        self.assertEqual(len(f.calls), 4)
        f.now += 1
        await f.health.check(f.fetch)
        self.assertEqual(len(f.calls), 8)

    async def test_manual_success_does_not_hide_missing_schedules(self):
        f = Fixture()
        f.latest = run('workflow_dispatch')
        f.scheduled = run(age=12 * 3600 + 1)
        await f.health.check(f.fetch)
        value = f.health.snapshot()
        self.assertEqual(value['state'], 'overdue')
        self.assertEqual(value['comparison']['upstream_pending'], 0)
        self.assertTrue(value['schedule_overdue'])

    async def test_time_crossing_threshold_is_evaluated_without_a_remote_call(self):
        f = Fixture()
        f.scheduled = run(age=11 * 3600)
        await f.health.check(f.fetch)
        self.assertEqual(f.health.snapshot()['state'], 'healthy')
        f.now += 3601
        self.assertEqual(f.health.snapshot()['state'], 'overdue')
        self.assertEqual(len(f.calls), 4)

    async def test_failed_run_disabled_and_in_progress(self):
        for conclusion in core.FAILED:
            f = Fixture()
            f.latest = run(conclusion=conclusion)
            await f.health.check(f.fetch)
            self.assertEqual(f.health.snapshot()['state'], 'failed', conclusion)
        for state in ('disabled_manually', 'disabled_inactivity', 'disabled_fork'):
            f = Fixture(); f.workflow['state'] = state
            await f.health.check(f.fetch)
            self.assertEqual(f.health.snapshot()['state'], 'disabled')
        f = Fixture(); f.latest = run(conclusion=None, status='in_progress')
        await f.health.check(f.fetch)
        self.assertEqual(f.health.snapshot()['state'], 'running')

    async def test_scheduled_failure_survives_manual_success_and_skipped_is_not_success(self):
        for result, expected in (('failure', 'failed'), ('skipped', 'unconfirmed'), ('neutral', 'unconfirmed')):
            f = Fixture(); f.latest = run('workflow_dispatch'); f.scheduled = run(conclusion=result)
            await f.health.check(f.fetch)
            self.assertEqual(f.health.snapshot()['state'], expected)

    async def test_no_schedules_and_pending_source_are_distinct(self):
        f = Fixture(); f.scheduled = None
        await f.health.check(f.fetch)
        self.assertEqual(f.health.snapshot()['state'], 'no_schedule')
        f = Fixture(); f.comparison['ahead_by'] = 140; f.comparison['status'] = 'diverged'
        await f.health.check(f.fetch)
        self.assertEqual(f.health.snapshot()['state'], 'pending')
        self.assertEqual(f.health.snapshot()['comparison']['upstream_pending'], 140)

    async def test_partial_failure_preserves_per_component_measurements(self):
        f = Fixture()
        f.comparison['ahead_by'] = 4
        await f.health.check(f.fetch)
        before = f.health.snapshot()
        f.now += core.INTERVAL
        f.fail.add('comparison'); f.latest = run(conclusion='failure')
        await f.health.check(f.fetch)
        value = f.health.snapshot()
        self.assertEqual(value['state'], 'unavailable')
        self.assertEqual(value['latest_run']['conclusion'], 'failure')
        self.assertEqual(value['comparison']['upstream_pending'], 4)
        self.assertEqual(value['comparison_checked_at'], before['comparison_checked_at'])
        self.assertEqual(value['last_success_at'], before['last_success_at'])
        self.assertNotEqual(value['last_attempt_at'], before['last_attempt_at'])
        self.assertNotIn('exception body', str(f.health.saved))

    async def test_restart_reuses_cache_and_cold_or_malformed_results_never_look_healthy(self):
        f = Fixture()
        self.assertEqual(f.health.snapshot()['state'], 'checking')
        await f.health.check(f.fetch)
        restored = core.ActionsHealth(lambda: f.now, deepcopy(f.health.saved))
        self.assertFalse(await restored.check(f.fetch))
        self.assertEqual(restored.snapshot()['state'], 'healthy')
        self.assertEqual(len(f.calls), 4)
        for invalid in ({'ahead_by': -1, 'behind_by': 0, 'status': 'ahead'},
                        {'ahead_by': True, 'behind_by': 0, 'status': 'ahead'}, {}):
            f = Fixture(); f.comparison = invalid
            await f.health.check(f.fetch)
            self.assertEqual(f.health.snapshot()['state'], 'unavailable')
            self.assertIsNone(f.health.snapshot()['comparison'])

    async def test_cancelled_poll_is_not_published_and_can_retry(self):
        f = Fixture(); started = asyncio.Event()
        async def wait(path):
            started.set(); await asyncio.Event().wait()
        task = asyncio.create_task(f.health.check(wait))
        await started.wait(); task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        self.assertEqual(f.health.snapshot()['state'], 'checking')
        self.assertTrue(await f.health.check(f.fetch))

    async def test_stalled_monitor_and_backwards_clock_do_not_report_freshness(self):
        f = Fixture(); await f.health.check(f.fetch)
        f.now += core.SCHEDULE_TIMEOUT
        self.assertEqual(f.health.snapshot()['state'], 'unavailable')
        f.now = NOW - 10
        self.assertTrue(f.health.due())


class Store:
    def __init__(self, saved=None):
        self.saved = saved; self.loads = 0; self.saves = 0; self.fail = False
    async def async_load(self):
        self.loads += 1; return deepcopy(self.saved)
    async def async_save(self, value):
        self.saves += 1
        if self.fail: raise OSError('disk')
        self.saved = deepcopy(value)


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_multiple_entries_share_poll_and_last_unload_cancels_background_task(self):
        f = Fixture(); store = Store()
        service = runtime.Monitor(store, f.fetch, lambda coro, name: asyncio.create_task(coro), lambda: f.now)
        try:
            await asyncio.gather(service.attach('one'), service.attach('two'))
            await service.tick()
            self.assertEqual(store.loads, 1)
            self.assertEqual(len(f.calls), 4)
            task = service.task
            await service.detach('one')
            self.assertIs(service.task, task)
            await service.detach('two')
            self.assertIsNone(service.task)
            self.assertTrue(task.cancelled())
            await service.attach('one')
            await service.tick()
            self.assertEqual(len(f.calls), 4)
        finally:
            await service.stop()

    async def test_persistence_failure_is_visible_and_restart_observations_are_reused(self):
        f = Fixture(); store = Store(); store.fail = True
        service = runtime.Monitor(store, f.fetch, lambda coro, name: asyncio.create_task(coro), lambda: f.now)
        await service.tick()
        self.assertEqual(service.snapshot()['state'], 'unavailable')
        self.assertIn('storage', service.snapshot()['errors'])
        store.fail = False; f.now += core.INTERVAL
        await service.tick()
        restored = runtime.Monitor(store, f.fetch, lambda coro, name: asyncio.create_task(coro), lambda: f.now)
        try:
            await restored.attach('one')
            await restored.tick()
            self.assertEqual(len(f.calls), 8)
            self.assertEqual(restored.snapshot()['last_success_at'], service.snapshot()['last_success_at'])
        finally:
            await restored.stop()


if __name__ == '__main__':
    unittest.main()
