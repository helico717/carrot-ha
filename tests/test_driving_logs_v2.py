"""Run the pinned original production engine against synthetic capnp records."""
import importlib.util
import asyncio
import gzip
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from aiohttp import web

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('carrot_v2_test', ROOT / 'custom_components/carrot_ha/driving_logs/replay_v2.py')
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)


class ReplayV2Tests(unittest.TestCase):
    @unittest.skipUnless(sys.version_info >= (3,14),'Python 3.14 native fallback')
    def test_missing_python_zstd_extension(self):
        import io
        from compression import zstd
        runner_spec=importlib.util.spec_from_file_location('radar_runner_test',v2.ROOT/'radar_runner.py')
        runner=importlib.util.module_from_spec(runner_spec);runner_spec.loader.exec_module(runner)
        if sys.platform == 'win32':
            library=Path('C:/Program Files/Git/mingw64/bin/libzstd.dll')
            if not library.exists():self.skipTest('Native libzstd unavailable')
            override=patch('ctypes.util.find_library',return_value=str(library));override.start();self.addCleanup(override.stop)
        raw=b'raw synthetic log'*100000
        compressed=zstd.compress(raw[:700000])+zstd.compress(raw[700000:])
        with runner.native_zstd_reader(io.BytesIO(compressed)) as result:
            self.assertEqual(result.read(),raw)
        for raw_case in (b'a'*131072,b'a'*262144,os.urandom(2*1024**2+19)):
            with runner.native_zstd_reader(io.BytesIO(zstd.compress(raw_case))) as result:
                self.assertEqual(result.read(),raw_case)
        with self.assertRaises(ValueError):
            runner.native_zstd_reader(io.BytesIO(compressed[:-1]))
        runner.install_stdlib_zstd(force_native=True)
        import zstandard
        with zstandard.ZstdDecompressor().stream_reader(io.BytesIO(compressed)) as result:
            self.assertEqual(result.read(),raw)
    def test_core_manifest_has_no_external_zstandard_requirement(self):
        manifest=json.loads((ROOT/'custom_components/carrot_ha/manifest.json').read_text())
        self.assertFalse(any(item.split('=')[0].startswith('zstandard') for item in manifest['requirements']))

    def test_original_engine_runner(self):
        engine = v2.engine_root()
        with tempfile.TemporaryDirectory() as directory:
            source, output = Path(directory)/'rlog.zst', Path(directory)/'output.json'
            fixture = '''
import sys
from pathlib import Path
sys.path.insert(0,sys.argv[1])
from openpilot.selfdrive.carrot.radar.tools.radar_validation_replay import _route_replay_module
schema=_route_replay_module().load_openpilot_log_schema()
events=[]
def event(kind, t):
    e=schema.Event.new_message();e.logMonoTime=t;e.init(kind);events.append(e);return getattr(e,kind)
event('carState',1000000000).vEgo=15
tracks=event('liveTracks',1000000001)
tracks.init('points',1)
tracks.points[0].trackId=1
tracks.points[0].dRel=30
tracks.points[0].yRel=0
tracks.points[0].vRel=-1
for i in range(3):
    model=event('modelV2',1000000010+i*50000000)
    model.position.x=[float(x) for x in range(0,101,5)]
    model.position.y=[0.0]*21
    model.position.z=[0.0]*21
    model.position.t=[x/15 for x in range(0,101,5)]
raw=b''.join(e.to_bytes() for e in events)
if sys.version_info >= (3,14):
    from compression import zstd
    compress=zstd.compress
else:
    import zstandard
    compress=zstandard.ZstdCompressor().compress
half=len(raw)//2
Path(sys.argv[2]).write_bytes(compress(raw[:half])+compress(raw[half:]))
'''
            environment = {**os.environ,'PYTHONPATH':os.pathsep.join(sys.path),'OPENBLAS_NUM_THREADS':'1'}
            result = subprocess.run([sys.executable,'-c',fixture,str(engine),str(source)],env=environment,capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stderr)
            result = subprocess.run([sys.executable,str(v2.ROOT/'radar_runner.py'),str(engine),str(source),str(output),'auto','recorded'],env=environment,capture_output=True,text=True,timeout=60)
            self.assertEqual(result.returncode,0,result.stderr)
            data=json.loads(output.read_text())
            self.assertEqual(data['engine'],'production-dpath-controller')
            self.assertEqual(data['schemaVersion'],1)
            self.assertEqual(len(data['frames']),3)
            self.assertIn('leadOne',data['graphs'])
            self.assertTrue(data['sourceVersion'])
            if sys.version_info >= (3,14) and sys.platform.startswith('linux'):
                blocked="import sys,runpy;sys.modules['compression.zstd']=None;sys.argv=sys.argv[1:];runpy.run_path(sys.argv[0],run_name='__main__')"
                result=subprocess.run([sys.executable,'-c',blocked,str(v2.ROOT/'radar_runner.py'),str(engine),str(source),str(output),'auto','recorded'],env=environment,capture_output=True,text=True,timeout=60)
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertEqual(json.loads(output.read_text())['engine'],'production-dpath-controller')
            async def verify_jobs():
                async def executor(function,*args):
                    return await asyncio.to_thread(function,*args)
                hass=SimpleNamespace(async_add_executor_job=executor,async_create_background_task=lambda coro,name:asyncio.create_task(coro,name=name))
                jobs=v2.RadarJobs(hass)
                try:
                    response=await jobs.response(source,'auto','recorded')
                    self.assertEqual(response.status,202)
                    await asyncio.gather(*jobs.jobs.values())
                    response=await jobs.response(source,'auto','recorded')
                    self.assertIsInstance(response,web.FileResponse)
                    payload=json.loads(gzip.decompress(next(jobs.cache.glob('*.json.gz')).read_bytes()))
                    self.assertEqual(payload['engine'],'production-dpath-controller')
                    self.assertEqual(len(jobs.jobs),1)
                    with self.assertRaises(web.HTTPBadRequest):
                        await jobs.response(source,'invalid','recorded')
                finally:
                    await jobs.close()
                self.assertFalse(jobs.cache.exists())
            asyncio.run(verify_jobs())


if __name__ == '__main__':
    unittest.main()
