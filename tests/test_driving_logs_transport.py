"""Actual aiohttp upload/browse sockets with minimal HA host adapters."""
import asyncio
import hashlib
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest

from aiohttp import ClientSession, CookieJar, web
from aiohttp.test_utils import TestServer

ROOT = Path(__file__).parents[1]
pkg = types.ModuleType('driving_logs_transport')
pkg.__path__ = [str(ROOT / 'custom_components/carrot_ha/driving_logs')]
sys.modules[pkg.__name__] = pkg
http_stub = types.ModuleType('homeassistant.components.http')
http_stub.HomeAssistantView = object
sys.modules.setdefault('homeassistant.components.http', http_stub)
from driving_logs_transport.http import BrowserView, DeviceView, SessionView, ToolsView, upload_token
from driving_logs_transport.store import LogStore
from driving_logs_transport.tiered import TieredLogStore


class TransportTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.entry = types.SimpleNamespace(entry_id='entry', data={'device_id':'comma'},
                                           options={'terminal_enabled':True,'terminal_token':'t'*64})
        self.runtime = {'entry':self.entry,'driving_log_store':LogStore(self.temp.name)}
        async def executor(function, *args):
            return await asyncio.to_thread(function,*args)
        self.hass = types.SimpleNamespace(data={'carrot_ha':{'entry':self.runtime}}, async_add_executor_job=executor)
        @web.middleware
        async def user(request, handler):
            request['hass_user'] = types.SimpleNamespace(is_admin=request.headers.get('X-Test-Admin') == 'yes')
            return await handler(request)
        app=web.Application(middlewares=[user])
        session, device, browser = SessionView(self.hass), DeviceView(self.hass), BrowserView(self.hass)
        def handler(method):
            async def wrapped(request):
                return await method(request, **request.match_info)
            return wrapped
        app.router.add_post(session.url,handler(session.post))
        for url in [device.url,*device.extra_urls]:
            app.router.add_post(url,handler(device.post))
            app.router.add_put(url,handler(device.put))
            app.router.add_get(url,handler(device.get))
        for url in [browser.url,*browser.extra_urls]:
            app.router.add_get(url,handler(browser.get))
            app.router.add_post(url,handler(browser.post))
        tools = ToolsView(self.hass)
        app.router.add_get(tools.url, handler(tools.get))
        self.server=TestServer(app);await self.server.start_server()
        self.client=ClientSession(cookie_jar=CookieJar(unsafe=True))

    async def asyncTearDown(self):
        await self.client.close();await self.server.close();self.temp.cleanup()

    async def test_upload_browse_range_and_auth_scope(self):
        base=self.server.make_url('/api/carrot_ha/v1/driving_logs_upload/comma')
        segment='00000315--4742c01c35--133'
        manifest={'segment':segment,'recorded':1000,'files':{'rlog.zst':4,'qcamera.mp4':8}}
        async with self.client.post(str(base)+'/begin',json=manifest) as response:
            self.assertEqual(response.status,401)
        headers={'Authorization':'Bearer '+upload_token('t'*64)}
        async with self.client.post(str(base)+'/begin',json=manifest,headers=headers) as response:
            self.assertEqual(response.status,200)
        for filename, data in {'rlog.zst':b'log!','qcamera.mp4':b'video123'}.items():
            async with self.client.put(str(base)+'/chunk/'+segment+'/'+filename,data=data,headers={**headers,'X-Upload-Offset':'0'}) as response:
                self.assertEqual(response.status,200)
        async with self.client.post(str(base)+'/commit',json={'segment':segment,'hashes':{f:hashlib.sha256(d).hexdigest() for f,d in {'rlog.zst':b'log!','qcamera.mp4':b'video123'}.items()}},headers=headers) as response:
            self.assertTrue((await response.json())['complete'])
        browse=self.server.make_url('/api/carrot_ha/v1/driving_logs/entry')
        async with self.client.get(str(browse)+'/dashcam/routes') as response:
            self.assertEqual(response.status,401)
        async with self.client.get(str(browse)+'/dashcam/storage') as response:
            self.assertEqual(response.status,401)
        async with self.client.get(str(browse)+'/dashcam/calendar') as response:
            self.assertEqual(response.status,401)
        async with self.client.get(str(browse)+'/dashcam/v2/'+segment) as response:
            self.assertEqual(response.status,401)
        async with self.client.post(str(browse)+'/dashcam/upload/summary', json={'segments':[segment]}) as response:
            self.assertEqual(response.status,401)
        async with self.client.post(str(browse)+'/session') as response:
            self.assertEqual(response.status,403)
        async with self.client.post(str(browse)+'/session',headers={'X-Test-Admin':'yes'}) as response:
            self.assertEqual(response.status,200)
            self.assertTrue(response.cookies['carrot_logs']['httponly'])
        async with self.client.get(str(browse)+'/dashcam/routes') as response:
            self.assertEqual((await response.json())['routes'][0]['segmentFolders'],[segment])
        async with self.client.get(str(browse)+'/dashcam/storage') as response:
            storage = (await response.json())['storage']
            self.assertEqual(response.status, 200)
            self.assertEqual(storage['limit'], 5_000_000_000)
            self.assertIn(storage['nas']['status'], ('available', 'not_configured'))
        async with self.client.get(str(browse)+'/dashcam/calendar') as response:
            self.assertEqual((await response.json())['intervals'], [{'start':1000,'end':1000}])
        async with self.client.get(str(browse)+'/dashcam/routes?from=1001&to=2000') as response:
            self.assertEqual((await response.json())['total'], 0)
        async with self.client.get(str(browse)+'/dashcam/routes?from=900&to=1001') as response:
            self.assertEqual((await response.json())['total'], 1)
        for query in ('from=nan','from=-1','from=2000&to=1000','to=inf'):
            async with self.client.get(str(browse)+'/dashcam/routes?'+query) as response:
                self.assertEqual(response.status, 400)
        async with self.client.get(str(browse)+'/dashcam/thumbnail/'+segment) as response:
            self.assertEqual(response.status, 204)
            self.assertEqual(await response.read(), b'')
        async with self.client.post(str(browse)+'/dashcam/upload/summary', json={'segments':[segment]}) as response:
            summary = await response.json()
            self.assertEqual(response.status,200)
            self.assertEqual(summary['summaries'][0]['totalSize'],12)
        async with self.client.get(str(browse)+'/dashcam/upload/job?id=another-entry-job') as response:
            self.assertEqual(response.status,404)
        async with self.client.get(str(browse)+'/dashcam/replay-source/'+segment) as response:
            source=await response.json()
            self.assertEqual(source['mode'],'client')
            self.assertEqual(source['rlog']['compression'],'zstd')
        async with self.client.get(self.server.make_url(source['rlog']['url'])) as response:
            self.assertEqual(await response.read(),b'log!')
        async with self.client.get(str(browse)+'/dashcam/video/'+segment,headers={'Range':'bytes=2-5'}) as response:
            self.assertEqual(response.status,206)
            self.assertEqual(await response.read(),b'deo1')
        v2base = str(browse)+'/dashcam/v2/'+segment
        async with self.client.get(v2base) as response:
            self.assertEqual(response.status,200)
            self.assertIn('attachRadarReview', await response.text())
        async with self.client.get(v2base+'/manifest') as response:
            v2 = await response.json()
            self.assertEqual(v2['segments'][0]['name'],segment)
            self.assertIn('API_HOST=',v2['cabanaCommand'])
        async with self.client.get(v2base+'/file/qcamera.mp4',headers={'Range':'bytes=2-5'}) as response:
            self.assertEqual(response.status,206)
            self.assertEqual(await response.read(),b'deo1')
        async with self.client.get(v2base+'/file/unknown') as response:
            self.assertEqual(response.status,404)
        async with self.client.get(v2base+'/radar/999') as response:
            self.assertEqual(response.status,404)
        async def radar_response(source,sensor,flip):
            self.assertFalse(self.runtime['driving_log_lock'].locked())
            self.assertEqual(source.read_bytes(),b'log!')
            self.assertEqual((sensor,flip),('corner','normal'))
            return web.json_response({'status':'preparing'},status=202)
        self.runtime['driving_log_v2_jobs']=types.SimpleNamespace(response=radar_response)
        async with self.client.get(v2base+'/radar/133?sensor=corner&radar_track_flip=normal') as response:
            self.assertEqual(response.status,202)
        self.runtime.pop('driving_log_v2_jobs')
        token, capability = next(iter(self.runtime['driving_log_v2_tokens'].items()))
        tools = self.server.make_url('/api/carrot_ha/v1/driving_logs_tools/entry/'+token)
        async with self.client.get(str(tools)+'/api/v1/route/'+capability['canonical']+'/files') as response:
            files=await response.json()
            self.assertEqual(len(files['logs']),1)
        async with ClientSession() as tool_client:
            async with tool_client.get(files['logs'][0]) as response:
                self.assertEqual(await response.read(),b'log!')
            async with tool_client.get(str(tools)+'/api/v1/route/other/files') as response:
                self.assertEqual(response.status,404)
            async with tool_client.get(str(tools).replace('/entry/','/other/')+'/file/rlog.zst') as response:
                self.assertIn(response.status,(401,404))
            capability['expires']=0
            async with tool_client.get(files['logs'][0]) as response:
                self.assertEqual(response.status,401)
        self.entry.options['terminal_enabled']=False
        async with self.client.post(str(base)+'/begin',json=manifest,headers=headers) as response:
            self.assertEqual(response.status,401)

    @unittest.skipUnless(os.environ.get('CARROT_OPENPILOT_ROOT'), 'Set CARROT_OPENPILOT_ROOT for cross-repository sender integration')
    async def test_real_device_sender_to_ha_receiver(self):
        source=Path(os.environ['CARROT_OPENPILOT_ROOT'])/'openpilot/selfdrive/carrot/ha/driving_logs.py'
        spec=importlib.util.spec_from_file_location('device_log_sender_integration',source)
        sender=importlib.util.module_from_spec(spec);spec.loader.exec_module(sender)
        root=Path(self.temp.name)/'source';root.mkdir()
        directory=root/'00000315--4742c01c35--134';directory.mkdir()
        rlog=directory/'rlog.zst';rlog.write_bytes(b'original log bytes')
        video=directory/'qcamera.mp4';video.write_bytes(b'original video bytes')
        working=root/'working';working.mkdir()
        base=str(self.server.make_url('/api/carrot_ha/v1/driving_logs_upload/comma'))
        async with ClientSession(headers={'Authorization':'Bearer '+sender.credential('t'*64)}) as client:
            await sender.transfer(client,base,directory,2000,rlog,video,working)
        self.assertTrue(self.runtime['driving_log_store'].status(directory.name)['complete'])
        self.assertEqual(self.runtime['driving_log_store'].file(directory.name,'rlog').read_bytes(),rlog.read_bytes())

    async def test_nas_only_replay_video_range_upload_summary_and_auth(self):
        root = Path(self.temp.name)
        nas = root / 'network' / 'driving-logs'
        nas.parent.mkdir()
        store = TieredLogStore(root / 'cache', nas, 'comma', clock=lambda: 2000, guard=Path)
        self.runtime['driving_log_store'] = store
        await self.test_upload_browse_range_and_auth_scope()
        self.assertFalse(store.local.state['segments'])
        self.assertEqual(len(store.nas.state['segments']), 1)
        self.assertEqual(store.routes()['routes'][0]['storageSources'], ['nas'])
        details=store.diagnostics()
        self.assertEqual(details['nas']['nas_only_segments'], 1)
        self.assertEqual(details['nas']['verified_segments'], 1)
        self.assertEqual(details['nas']['used'], 12)


if __name__=='__main__':unittest.main()
