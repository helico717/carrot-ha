"""HA timer dispatch must create journal tasks on its event loop, not a worker."""
import ast
import asyncio
from pathlib import Path
from types import SimpleNamespace
import unittest

class ScheduleTests(unittest.IsolatedAsyncioTestCase):
    async def test_timer_dispatch_is_on_loop_and_coalesces_running_task(self):
        path = Path('custom_components/carrot_ha/vehicle_journal/runtime.py')
        class Imports(ast.NodeTransformer):
            def visit_ImportFrom(self, node):
                return None
        tree = ast.parse(path.read_text())
        tree.body = [n for n in tree.body if isinstance(n, ast.AsyncFunctionDef)]
        tree = Imports().visit(tree)
        tick = []
        tasks = []
        unload = []
        calls = []
        gate = asyncio.Event()
        def callback(fn):
            fn.ha_callback = True
            return fn
        def track(hass, fn, interval):
            tick.append(fn)
            return lambda: None
        async def executor(fn, *args):
            if fn is sync:
                await gate.wait()
            return fn(*args)
        def sync(*args):
            calls.append(args)
        def create(coro, name):
            asyncio.get_running_loop()  # Fails if HA dispatches to its executor.
            task = asyncio.create_task(coro, name=name)
            tasks.append(task)
            return task
        from datetime import timedelta
        namespace = dict(callback=callback, async_track_time_interval=track, timedelta=timedelta,
                         Journal=lambda *args: object(), sync=sync)
        exec(compile(tree, str(path), 'exec'), namespace)
        runtime = {'archive': SimpleNamespace(journal_guard=None)}
        hass = SimpleNamespace(async_add_executor_job=executor,
            async_create_background_task=create, config=SimpleNamespace(path=lambda *a: 'temp',time_zone='Asia/Seoul'))
        entry = SimpleNamespace(entry_id='entry',data={'device_id':'car'},async_on_unload=unload.append)
        await namespace['setup'](hass, entry, runtime)
        async def dispatch():
            if getattr(tick[0], 'ha_callback', False):
                tick[0]()
            else:
                await asyncio.to_thread(tick[0])
        await dispatch()
        self.assertEqual(len(tasks), 1)
        gate.set()
        await tasks[0]
        await dispatch()
        await tasks[-1]
        self.assertEqual(len(calls), 2)
