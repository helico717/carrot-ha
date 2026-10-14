"""Synthetic files against a local implementation of the upstream HTTP protocol."""
import asyncio
import hashlib
import importlib
from pathlib import Path
import sys
import tempfile
import types
import unittest

from aiohttp import web
from aiohttp.test_utils import TestServer

package = types.ModuleType('ha_log_upload_test')
package.__path__ = [str(Path(__file__).parents[1] / 'custom_components/carrot_ha/driving_logs')]
sys.modules[package.__name__] = package
store_module = importlib.import_module(package.__name__ + '.store')
upload_module = importlib.import_module(package.__name__ + '.upload')


class UploadTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = store_module.LogStore(self.temp.name)
        self.name = '00000217--f263cf29ea--0'
        self.contents = {'qcamera.ts': b'original-video', 'qcamera.mp4': b'playback-copy', 'rlog.zst': b'original-log'}
        self.store.begin({'segment': self.name, 'recorded': 100, 'files': {n: len(v) for n, v in self.contents.items()}})
        for name, data in self.contents.items():
            self.store.chunk(self.name, name, 0, data)
        self.store.commit(self.name, {n: hashlib.sha256(v).hexdigest() for n, v in self.contents.items()})
        self.calls = []
        self.mismatch = False
        self.quota = False

        async def session(request):
            payload = await request.json()
            self.assertEqual(payload['purpose'], 'dashcam')
            self.assertEqual(payload['deviceId'], 'test-device')
            self.calls.append(('session', payload))
            return web.json_response({'ok': False, 'error': 'daily quota exceeded'} if self.quota else {'ok': True, 'token': 'temporary-session'}, status=429 if self.quota else 200)

        async def put(request):
            self.assertEqual(request.headers['Authorization'], 'Bearer temporary-session')
            self.assertEqual(request.match_info['directory'], 'test-device')
            self.assertEqual(request.match_info['segment'], self.name)
            data = await request.read()
            self.assertEqual(int(request.headers['X-File-Size']), len(data))
            self.assertEqual(data, self.contents[request.match_info['filename']])
            self.calls.append(('file', request.match_info['filename']))
            return web.json_response({'ok': True, 'size': len(data) + int(self.mismatch)})

        async def complete(request):
            self.calls.append(('complete', await request.json()))
            return web.json_response({'ok': True})

        app = web.Application()
        app.router.add_post('/api/v1/session', session)
        app.router.add_put('/api/v1/upload/{directory}/{segment}/{filename}', put)
        app.router.add_post('/api/v1/complete', complete)
        self.server = TestServer(app)
        await self.server.start_server()
        self.addAsyncCleanup(self.server.close)
        runtime = {'entry': types.SimpleNamespace(data={'device_id': 'test-device'})}
        hass = types.SimpleNamespace(async_create_background_task=lambda coro, name: asyncio.create_task(coro))
        self.manager = upload_module.UploadManager(hass, runtime, self.store, str(self.server.make_url('')).rstrip('/'))
        self.addAsyncCleanup(self.manager.close)

    async def run_job(self, all_files=False):
        response = self.manager.start([self.name], all_files)
        job = self.manager.jobs[response['job_id']]
        await job['_task']
        return job

    async def test_original_protocol_and_default_source_selection(self):
        job = await self.run_job()
        self.assertEqual(job['status'], 'done')
        self.assertEqual(job['progress'], 100)
        self.assertEqual([c[1] for c in self.calls if c[0] == 'file'], ['qcamera.ts', 'rlog.zst'])
        self.assertEqual(self.calls[-1][0], 'complete')
        self.assertTrue(job['result']['webComplete']['ok'])
        self.assertEqual(job['result']['uploaded'], 1)
        self.assertIn('shareText', job['result'])
        self.assertNotIn('_task', self.manager.snapshot(job))

    async def test_all_files_and_duplicate_start(self):
        self.manager.start([self.name], True)
        with self.assertRaises(ValueError):
            self.manager.start([self.name], False)
        job = next(iter(self.manager.jobs.values()))
        await job['_task']
        self.assertEqual({c[1] for c in self.calls if c[0] == 'file'}, set(self.contents))

    async def test_server_size_mismatch_is_failure_with_original_retry(self):
        self.mismatch = True
        job = await self.run_job()
        self.assertEqual(job['status'], 'failed')
        self.assertEqual(job['result']['uploaded'], 0)
        self.assertIn('size mismatch', job['result']['results'][0]['error'])
        self.assertEqual(len([c for c in self.calls if c[0] == 'file']), 2)

    async def test_remote_quota_rejection_remains_failure(self):
        self.quota = True
        job = await self.run_job()
        self.assertEqual(job['status'], 'failed')
        self.assertIn('429', job['error'])
        self.assertEqual([c[0] for c in self.calls], ['session'])

    async def test_retention_cancels_without_uploading_or_pinning(self):
        response = self.manager.start([self.name], False)
        self.manager.retire({self.name.rsplit('--', 1)[0]})
        job = self.manager.jobs[response['job_id']]
        await job['_task']
        self.assertEqual(job['status'], 'canceled')
        self.assertEqual(self.calls, [])

    async def test_request_validation(self):
        for body in ({'segments': []}, {'segments': ['../x--0']}, {'segments': [self.name], 'includeAllFiles': 'yes'}):
            with self.assertRaises(ValueError):
                upload_module.request_segments(body)
        self.assertEqual(upload_module.request_segments({'segments': [self.name, self.name]})[0], [self.name])
