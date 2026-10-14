import ast
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import unittest


class ArchiveAckTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_durable_cursors_and_unchanged_does_not_write(self):
        tree = ast.parse(Path('custom_components/carrot_ha/cloud.py').read_text())
        tree.body = [n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'acknowledge_archive']
        ns = {'datetime':datetime,'timezone':timezone,'ClientTimeout':lambda **kw:kw,
              '_LOGGER':SimpleNamespace(warning=lambda *args:None)}
        exec(compile(tree,'cloud.py','exec'),ns)
        cursors = {'telemetry':7,'trip_changes':3}; calls=[]; status=200
        class Response:
            async def __aenter__(self): self.status=status; return self
            async def __aexit__(self,*args): pass
            async def json(self): return {'ok': self.status==200}
        def post(url,**kwargs): calls.append(kwargs); return Response()
        async def executor(fn,*args): return fn(*args)
        runtime={'archive':SimpleNamespace(cursor=lambda key:cursors[key]),
                 'entry':SimpleNamespace(data={'device_id':'car'})}
        args=(SimpleNamespace(async_add_executor_job=executor),runtime,
              SimpleNamespace(post=post),'https://example.test','secret')
        await ns['acknowledge_archive'](*args)
        self.assertEqual(calls[0]['json'],{'device_id':'car','telemetry_sequence':7,'trip_sequence':3})
        await ns['acknowledge_archive'](*args)
        self.assertEqual(len(calls),1)
        cursors['telemetry']=9; status=503
        await ns['acknowledge_archive'](*args)
        self.assertEqual(runtime['archive_acknowledged'],(7,3))
        self.assertEqual(cursors['telemetry'],9)
        runtime['archive_ack_retry_at']=0; status=200
        await ns['acknowledge_archive'](*args)
        self.assertEqual(runtime['archive_acknowledged'],(9,3))
