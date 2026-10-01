import ast
import asyncio
from pathlib import Path
from types import SimpleNamespace
import unittest


class HistoryCacheTests(unittest.IsolatedAsyncioTestCase):
    async def test_shared_generation_invalidation_and_cancelled_waiter(self):
        tree=ast.parse(Path('custom_components/carrot_ha/history_cache.py').read_text())
        tree.body=[n for n in tree.body if isinstance(n,ast.AsyncFunctionDef)]
        ns=dict(asyncio=asyncio,DEFAULT_SOC_CAPACITY_KWH=64,time=lambda:100)
        exec(compile(tree,'history_cache.py','exec'),ns)
        gate=asyncio.Event()
        calls=[]
        async def executor(*args):
            calls.append(args)
            await gate.wait()
            return ['history']
        runtime={'archive':SimpleNamespace(revision=0),'entry':SimpleNamespace(options={},data={'device_id':'car'})}
        hass=SimpleNamespace(async_add_executor_job=executor,config=SimpleNamespace(time_zone='Asia/Seoul'))
        async def read():return await ns['battery_history'](hass,runtime,None)
        first=asyncio.create_task(read())
        await asyncio.sleep(0);await asyncio.sleep(0)
        first.cancel()
        with self.assertRaises(asyncio.CancelledError):await first
        readers=[asyncio.create_task(read()) for _ in range(20)]
        gate.set()
        self.assertTrue(all(row==['history'] for row in await asyncio.gather(*readers)))
        self.assertEqual(len(calls),1)
        runtime['archive'].revision+=1
        await read();self.assertEqual(len(calls),2)
        ns['time']=lambda:180
        await read();self.assertEqual(len(calls),3)
