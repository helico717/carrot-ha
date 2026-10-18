"""Grounded recommendations, durable request limits and real cereal extraction."""
import asyncio
import bz2
import importlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
pkg=types.ModuleType('driving_ai_test');pkg.__path__=[str(ROOT/'custom_components/carrot_ha/driving_logs')]
sys.modules[pkg.__name__]=pkg
ai=importlib.import_module(pkg.__name__+'.ai')
summary=importlib.import_module(pkg.__name__+'.ai_summary')


class Rules(unittest.TestCase):
    def test_budget_survives_reload_key_replacement_and_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'config.json';config=ai.read_config(path)
            config=ai.update_config(config,{'api_key':'test-key-000000000','daily_requests':1})
            self.assertGreater(ai.reserve(config,5000),0)
            ai.atomic_json(path,config)
            config=ai.update_config(ai.read_config(path),{'api_key':'replacement-key-000','monthly_budget_usd':5})
            self.assertNotIn('api_key',ai.public_config(config))
            with self.assertRaises(ai.AnalysisError) as raised:ai.reserve(config,5000)
            self.assertEqual(raised.exception.code,'daily_limit')
            with self.assertRaises(ValueError):ai.update_config(config,{'monthly_budget_usd':float('nan')})
            config['usage']={};config['monthly_budget_usd']=0
            with self.assertRaises(ai.AnalysisError) as raised:ai.reserve(config,5)
            self.assertEqual(raised.exception.code,'budget_limit')

    def test_bad_model_recommendations_are_not_shown(self):
        definition={'current':100,'min':50,'max':150,'integer':True,'title':'test'}
        entries=[{'name':name,'recommended':value,'evidence_ids':refs} for name,value,refs in [
            ('DynamicTFollow',110,['E1']),('Unknown',1,['E1']),('DynamicTFollow',200,['E1']),
            ('DynamicTFollow',100.5,['E1']),('DynamicTFollow',90,['invented']),(['bad'],1,['E1'])]]
        result=ai.checked_result({'summary':'검토','limitations':[],'findings':[{'title':'event','evidence_ids':['E1','fake']}],
                                 'recommendedParams':entries},{'DynamicTFollow':definition},[{'id':'E1'}])
        self.assertEqual([p['recommended'] for p in result['recommendedParams']],[110])
        self.assertEqual(result['findings'][0]['evidence_ids'],['E1'])
        with self.assertRaises(ai.AnalysisError):ai.checked_result({'summary':'ok','findings':None},{},[])

    def test_observation_limits_and_unknown_control(self):
        frames=[{'sec':i/4,'speed_kph':50,'target_accel':2,'gas':i==4,'brake':False,'steer':False} for i in range(1200)]
        data=summary.summarize(frames,'S1',False)
        self.assertEqual(data['events'][0]['kind'],'sample')
        self.assertLessEqual(len(data['sample']),32)
        self.assertNotIn('gas',data['sample'][0])
        for frame in frames:frame['enabled']=True
        data=summary.summarize(frames,'S1',True)
        self.assertLessEqual(len(data['events']),16)
        self.assertEqual(data['overrides']['gas'],1)
        self.assertGreater(data['events'][-1]['sec'],250)

    def test_torque_parameters_excluded_for_angle_car_and_unlisted_values(self):
        snapshot={'catalog':{'items_by_group':{'test':[{'name':name,'min':0,'max':200,'default':100} for name in ['DynamicTFollow','LateralTorqueFriction','IgnoreSafety']]}},
                  'values':{'DynamicTFollow':'100','LateralTorqueFriction':'20','IgnoreSafety':'5'}}
        self.assertEqual(set(ai.parameter_context(snapshot,[{'metadata':{'steer_control':'angle'}}])),{'DynamicTFollow'})

    def test_full_cereal_subprocess_removes_location_and_identifiers(self):
        engine=ai.engine_root()
        fixture=r'''
import sys,json
from pathlib import Path
sys.path.insert(0,sys.argv[1])
from openpilot.selfdrive.carrot.radar.tools.radar_validation_replay import _route_replay_module
schema=_route_replay_module().load_openpilot_log_schema()
events=[]
def event(kind,t):
 e=schema.Event.new_message();e.logMonoTime=t;e.valid=True;e.init(kind);events.append(e);return getattr(e,kind)
cp=event('carParams',1000000000);cp.carFingerprint='VOLKSWAGEN ID.4';cp.steerControlType='angle'
gps=event('gpsLocationExternal',1000000001);gps.latitude=37.123456;gps.longitude=127.123456
for i in range(40):
 t=1000000000+i*250000000
 event('selfdriveState',t).enabled=True
 cc=event('carControl',t);cc.actuators.steeringAngleDeg=12
 cs=event('carState',t);cs.vEgo=15;cs.steeringAngleDeg=5
raw=b''.join(e.to_bytes() for e in events)
import bz2
Path(sys.argv[2]).write_bytes(bz2.compress(raw))
'''
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp);source=directory/'private-route-rlog.bz2';output=directory/'summary.json';request=directory/'request.json'
            env={**os.environ,'PYTHONPATH':os.pathsep.join(sys.path),'PYTHONDONTWRITEBYTECODE':'1','OPENBLAS_NUM_THREADS':'1'}
            result=subprocess.run([sys.executable,'-c',fixture,str(engine),str(source)],capture_output=True,text=True,env=env,timeout=30)
            self.assertEqual(result.returncode,0,result.stderr)
            request.write_text(json.dumps({'sources':[{'path':str(source),'alias':'S1'}],'overrides':False}))
            result=subprocess.run([sys.executable,str(ai.ROOT/'ai_runner.py'),str(engine),str(request),str(output)],capture_output=True,text=True,env=env,timeout=60)
            self.assertEqual(result.returncode,0,result.stderr)
            text=output.read_text();data=json.loads(text)[0]
            self.assertEqual(data['metadata']['steer_control'],'angle')
            self.assertEqual(data['events'][0]['kind'],'steering')
            self.assertEqual(data['frames'],40)
            for secret in ['37.123456','127.123456','private-route','latitude','longitude',str(directory)]:self.assertNotIn(secret,text)
            if sys.version_info>=(3,14):
                from compression import zstd
                compress=zstd.compress
            else:
                import zstandard
                compress=zstandard.ZstdCompressor().compress
            zsource=directory/'private-route-rlog.zst'
            zsource.write_bytes(compress(bz2.decompress(source.read_bytes())))
            request.write_text(json.dumps({'sources':[{'path':str(zsource),'alias':'S1'}],'overrides':False}))
            result=subprocess.run([sys.executable,str(ai.ROOT/'ai_runner.py'),str(engine),str(request),str(output)],capture_output=True,text=True,env=env,timeout=60)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(json.loads(output.read_text())[0]['frames'],40)


class Jobs(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp=tempfile.TemporaryDirectory();self.runtime={'entry':types.SimpleNamespace(entry_id='entry',options={},data={})}
        async def executor(fn,*args):return await asyncio.to_thread(fn,*args)
        self.hass=types.SimpleNamespace(data={'carrot_ha':{}},config=types.SimpleNamespace(path=lambda *parts:str(Path(self.temp.name).joinpath(*parts))),
            async_add_executor_job=executor,async_create_background_task=lambda coro,name:asyncio.create_task(coro,name=name))
        self.manager=ai.AiManager(self.hass,self.runtime)
        await self.manager.config({'api_key':'not-a-real-key-000000'})

    async def asyncTearDown(self):
        await self.manager.close();self.temp.cleanup()

    async def test_manual_consent_and_immediate_cancel(self):
        with self.assertRaises(ai.AnalysisError):await self.manager.start({'segments':['route--hash--0']})
        result=await self.manager.start({'segments':['route--hash--0'],'consent':True})
        self.manager.cancel(result['job_id']);await asyncio.sleep(0);await asyncio.sleep(0)
        job=self.manager.snapshot(result['job_id']);self.assertTrue(job['done']);self.assertEqual(job['status'],'canceled')
        self.assertFalse(any(k.startswith('_') for k in job))

    async def test_provider_only_receives_summary_and_no_parameter_write(self):
        captured=[]
        async def extract(job,directory,overrides):
            return [{**summary.summarize([{'sec':0,'speed_kph':10}],'S1'),'metadata':{'steer_control':'angle'}}],{'S1':'private--route--0'}
        async def parameters():return {}
        async def provider(method,path,key,body=None):
            captured.append((method,path,body))
            return {'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'summary':'観測','limitations':[],'findings':[], 'recommendedParams':[]})}]}}]}
        with patch.object(self.manager,'extract',extract),patch.object(self.manager,'current_parameters',parameters),patch.object(self.manager,'provider',provider):
            result=await self.manager.start({'segments':['private--route--0'],'consent':True})
            await self.manager.jobs[result['job_id']]['_task']
        job=self.manager.snapshot(result['job_id']);self.assertEqual(job['status'],'done')
        self.assertEqual(len(captured),1);self.assertEqual(captured[0][0],'POST')
        sent=json.dumps(captured[0][2]);self.assertNotIn('private--route',sent);self.assertNotIn('not-a-real-key',sent)
        self.assertEqual(job['result']['evidence'][0]['segment'],'private--route--0')
        self.assertEqual((await self.manager.config())['requests_today'],1)

    async def test_cancel_after_dispatch_keeps_durable_reservation(self):
        dispatched=asyncio.Event()
        async def extract(job,directory,overrides):
            return [{**summary.summarize([{'sec':0,'speed_kph':10}],'S1'),'metadata':{}}],{'S1':'route--hash--0'}
        async def parameters():return {}
        async def provider(*args,**kwargs):
            dispatched.set();await asyncio.sleep(60)
        with patch.object(self.manager,'extract',extract),patch.object(self.manager,'current_parameters',parameters),patch.object(self.manager,'provider',provider):
            result=await self.manager.start({'segments':['route--hash--0'],'consent':True})
            await asyncio.wait_for(dispatched.wait(),5)
            self.manager.cancel(result['job_id']);await self.manager.jobs[result['job_id']]['_task']
        self.assertEqual(self.manager.snapshot(result['job_id'])['status'],'canceled')
        self.assertEqual((await self.manager.config())['requests_today'],1)
        manager=ai.AiManager(self.hass,self.runtime)
        self.assertGreater((await manager.config())['reserved_usd'],0)


if __name__=='__main__':unittest.main()
