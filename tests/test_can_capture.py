import ast, importlib.util, tempfile, unittest, gzip, json
from pathlib import Path
ha_path=Path(__file__).resolve().parents[1]/'custom_components/carrot_ha/can_capture.py'
tree=ast.parse(ha_path.read_text())
tree.body=[n for n in tree.body if not isinstance(n,ast.ImportFrom) or n.module not in ('aiohttp','homeassistant.components.http')]
ha={'HomeAssistantView':object}
exec(compile(tree,str(ha_path),'exec'),ha)
companion=Path(__file__).resolve().parents[2]/'openpilot/openpilot/selfdrive/carrot/ha/can_capture.py'
if not companion.exists():
 raise unittest.SkipTest('Cross-repository CAN wire tests require companion openpilot checkout')
spec=importlib.util.spec_from_file_location('capture',companion)
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
class CaptureTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.store=ha['CaptureFiles'](Path(self.tmp.name)/'ha')
  self.client=c.CaptureClient({'device':'id4'},Path(self.tmp.name)/'comma',lambda:{'charging':False,'battery_wh':21000})
  self.frames=[[123456,0x123,0,'0011223344556677'],[123457,0x321,1,'ffff']]
 def test_roundtrip_and_duplicate(self):
  self.store.start();self.client.save(self.frames);p=self.client.pending[0];key=p.name[:-8];wire=p.read_bytes()
  self.assertTrue(self.store.store(key,wire,'id4')['ok'])
  self.assertTrue(self.store.store(key,wire,'id4')['duplicate'])
  data=json.loads(gzip.decompress((self.store.root/p.name).read_bytes()))
  self.assertEqual(data['frames'],self.frames);self.assertEqual(data['context']['battery_wh'],21000)
  self.assertEqual(self.store.count,1)
 def test_disabled_and_restart(self):
  self.client.save(self.frames);p=self.client.pending[0]
  with self.assertRaises(PermissionError):self.store.store(p.name[:-8],p.read_bytes(),'id4')
  self.store.start();again=ha['CaptureFiles'](self.store.root);self.assertTrue(again.status()['enabled'])
  again.stop();self.assertFalse(ha['CaptureFiles'](self.store.root).status()['enabled'])
 def test_device_isolation_and_invalid_frame(self):
  self.store.start();self.client.save(self.frames);p=self.client.pending[0]
  with self.assertRaises(ValueError):self.store.store(p.name[:-8],p.read_bytes(),'other')
  wire=c.encode_batch('id4',p.name[:-8],[[1,1,999,'00']],{})
  with self.assertRaises(ValueError):self.store.store(p.name[:-8],wire,'id4')
 def test_spool_recovery_and_limit(self):
  self.client.save(self.frames);other=c.CaptureClient({'device':'id4'},Path(self.tmp.name)/'comma',lambda:{})
  self.assertEqual(len(other.pending),1)
  old=c.MAX_SPOOL;c.MAX_SPOOL=1
  try:other.save(self.frames)
  finally:c.MAX_SPOOL=old
  self.assertEqual(other.dropped,2);self.assertEqual(len(other.pending),1)
 def test_decompression_limit(self):
  with self.assertRaises(ValueError):self.store.store('a'*32+'-0000000001',gzip.compress(b' '* (ha['MAX_BODY']+1)),'id4')

# Real HTTP integration: authentication, bounded receiver and actual upload ACK.
import asyncio
from types import SimpleNamespace
try:
 from aiohttp import web, ClientSession
except ImportError:
 web=None

@unittest.skipIf(web is None, 'aiohttp required for HTTP integration')
class HttpCaptureTests(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.store=ha['CaptureFiles'](Path(self.tmp.name)/'ha');self.store.start()
  self.token='x'*32
  async def executor(fn,*args):return await asyncio.to_thread(fn,*args)
  self.hass=SimpleNamespace(data={'carrot_ha':{'entry':{'entry':SimpleNamespace(data={'device_id':'id4'},options={'terminal_enabled':True,'terminal_token':self.token}),'can_capture':self.store}}},async_add_executor_job=executor)
  ha['web']=web;view=ha['CanCaptureView'](self.hass)
  async def route(request):return await getattr(view,request.method.lower())(request,request.match_info['device_id'])
  app=web.Application(client_max_size=ha['MAX_WIRE']);app.router.add_route('*','/api/carrot_ha/v1/can-capture/{device_id}',route)
  self.runner=web.AppRunner(app);await self.runner.setup();site=web.TCPSite(self.runner,'127.0.0.1',0);await site.start()
  self.url='http://127.0.0.1:'+str(site._server.sockets[0].getsockname()[1])
  self.http=ClientSession()
 async def asyncTearDown(self):
  await self.http.close();await self.runner.cleanup()
 async def test_actual_upload_and_auth(self):
  async with self.http.get(self.url+'/api/carrot_ha/v1/can-capture/id4') as r:self.assertEqual(r.status,401)
  async with self.http.get(self.url+'/api/carrot_ha/v1/can-capture/other',headers={'Authorization':'Bearer '+self.token}) as r:self.assertEqual(r.status,401)
  client=c.CaptureClient({'device':'id4'},Path(self.tmp.name)/'comma',lambda:{'charging':True})
  client.destination={'ha_url':self.url,'terminal_token':self.token};client.save([[1000,0x123,0,'0011']])
  task=asyncio.create_task(client.upload(self.http))
  try:
   for _ in range(100):
    if client.delivered:break
    await asyncio.sleep(.02)
   self.assertEqual(client.delivered,1);self.assertEqual(client.pending,[]);self.assertEqual(self.store.count,1)
   saved=json.loads(gzip.decompress(next(self.store.root.glob('*.json.gz')).read_bytes()))
   self.assertEqual(saved['frames'],[[1000,0x123,0,'0011']])
  finally:task.cancel();await asyncio.gather(task,return_exceptions=True)
 async def test_bad_gzip_and_stopped_capture(self):
  headers={'Authorization':'Bearer '+self.token,'X-Can-Batch':'a'*32+'-0000000001'}
  async with self.http.post(self.url+'/api/carrot_ha/v1/can-capture/id4',data=b'not gzip',headers=headers) as r:self.assertEqual(r.status,400)
  self.store.stop();wire=c.encode_batch('id4',headers['X-Can-Batch'],[[1,1,0,'00']],{})
  async with self.http.post(self.url+'/api/carrot_ha/v1/can-capture/id4',data=wire,headers=headers) as r:self.assertEqual(r.status,409)

if __name__=='__main__':unittest.main()
