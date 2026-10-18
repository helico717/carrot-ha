"""All stored segments, free recommendations, durable cache and end-of-drive gates."""
import asyncio
from datetime import datetime,timezone
import importlib
from pathlib import Path
import sys
import tempfile
import time
import types
import unittest
from unittest.mock import AsyncMock,patch

pkg=types.ModuleType('local_analysis_test');pkg.__path__=[str(Path(__file__).parents[1]/'custom_components/carrot_ha/driving_logs')]
sys.modules[pkg.__name__]=pkg
module=importlib.import_module(pkg.__name__+'.local_analysis')
rules=importlib.import_module(pkg.__name__+'.local_rules')
summarize=importlib.import_module(pkg.__name__+'.ai_summary').summarize


def state(count=33):
    return {'segments':{f'route--hash--{i}':{'complete':True,'recorded':1000+i*60,'duration':60,
        'files':{'rlog.zst':4},'hashes':{'rlog.zst':'hash-'+str(i)}} for i in range(count)}}


class Planning(unittest.TestCase):
    def test_all_33_are_selected_in_order_not_four_representatives(self):
        store=types.SimpleNamespace(state=state())
        selected=module.plan(store,{'route':'latest'})
        self.assertEqual(len(selected['segments']),33)
        self.assertEqual(selected['segments'][-1],'route--hash--32')
        self.assertTrue(selected['full_route'])
        a=module.plan(store,{'segments':['route--hash--2','route--hash--0']})
        self.assertEqual(a['segments'],['route--hash--0','route--hash--2'])
        self.assertFalse(a['full_route'])

    def test_missing_receiving_and_cross_route_rejected(self):
        store=types.SimpleNamespace(state=state())
        del store.state['segments']['route--hash--12']
        with self.assertRaises(module.AnalysisError) as error:module.plan(store,{'route':'latest'})
        self.assertEqual(error.exception.code,'segment_gap')
        store.state=state();store.state['segments']['route--hash--32']['complete']=False
        with self.assertRaises(module.AnalysisError) as error:module.plan(store,{'route':'latest'})
        self.assertEqual(error.exception.code,'receiving')
        with self.assertRaises(module.AnalysisError):module.plan(store,{'segments':['route--hash--0','other--hash--1']})

    def test_recommendation_requires_repeat_active_evidence_and_real_catalog(self):
        frames=[{'sec':i*.25,'speed_kph':10,'enabled':True,'target_accel':1.9,'gas':False,'brake':False,'steer':False} for i in range(48)]
        summary=summarize(frames,'S1')
        definition={'CruiseMaxVals1':{'min':30,'max':300,'integer':True,'title':'low speed','current':160}}
        result=rules.assess([summary],definition,['route--hash--0'])
        self.assertEqual(result['recommendedParams'][0]['recommended'],144)
        self.assertEqual(result['external_requests'],0)
        self.assertEqual(rules.assess([summary],{},['route--hash--0'])['recommendedParams'],[])
        for f in frames:f['enabled']=False
        self.assertEqual(rules.assess([summarize(frames,'S1')],definition,['route--hash--0'])['recommendedParams'],[])


class Jobs(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp=tempfile.TemporaryDirectory();self.store=types.SimpleNamespace(state=state())
        self.runtime={'entry':types.SimpleNamespace(entry_id='entry',options={},data={}), 'driving_log_store':self.store,
            'latest':{'observed_at':datetime.now(timezone.utc).isoformat(),'data':{'driving':False}}}
        async def executor(fn,*args):return await asyncio.to_thread(fn,*args)
        self.hass=types.SimpleNamespace(data={'carrot_ha':{'entry':self.runtime}},
            config=types.SimpleNamespace(path=lambda *parts:str(Path(self.temp.name).joinpath(*parts))),
            async_add_executor_job=executor,async_create_background_task=lambda coro,name:asyncio.create_task(coro,name=name))
        self.manager=module.LocalAnalysis(self.hass,self.runtime);self.decoded=[]
        async def extract(job,directory,overrides):
            self.decoded.extend(job['segments'])
            return [{**summarize([{'sec':0,'speed_kph':10}],'S1'),'metadata':{}}],{'S1':job['segments'][0]}
        self.manager.helper.extract=extract
        self.manager.helper.current_parameters=AsyncMock(return_value={})
        self.manager.helper.provider=AsyncMock(side_effect=AssertionError('free analysis must never call Google'))

    async def asyncTearDown(self):
        await self.manager.close();self.temp.cleanup()

    async def run_job(self,body):
        result=await self.manager.start(body)
        await self.manager.jobs[result['job_id']]['_task']
        return self.manager.snapshot(result['job_id'])

    async def test_all_segments_cached_and_result_survives_manager_reload(self):
        job=await self.run_job({'route':'latest'})
        self.assertEqual(job['status'],'done');self.assertEqual(job['processed'],33)
        self.assertEqual(len(self.decoded),33);self.assertEqual(len(set(self.decoded)),33)
        self.assertEqual(job['result']['stats']['segments'],33)
        self.assertEqual(len(job['result']['scope']),33)
        await self.run_job({'route':'latest'});self.assertEqual(len(self.decoded),33,'no duplicate decode for unchanged logs')
        reloaded=module.LocalAnalysis(self.hass,self.runtime)
        self.assertEqual((await reloaded.result({'route':'latest'}))['status'],'done')
        self.assertFalse((Path(self.temp.name)/'carrot_ha/ai-driving').exists(),'free mode never requires or reads a Gemini key')
        self.manager.helper.provider.assert_not_awaited()
        self.assertEqual(set(self.hass.data['carrot_ha']),{'entry'},'global semaphore must not masquerade as a vehicle runtime')

    async def test_auto_waits_for_parked_and_stable_uploads_and_reprocesses_late_segment(self):
        self.runtime['latest']['data']['driving']=True
        await self.manager.auto_tick();self.assertFalse(self.manager.jobs)
        self.runtime['latest']['data']['driving']=False
        self.manager.stable_since=time.monotonic()-181
        await self.manager.auto_tick()
        job=next(iter(self.manager.jobs.values()));await job['_task']
        self.assertTrue(job['automatic']);self.assertEqual(job['processed'],33)
        self.store.state=state(34)
        self.assertEqual((await self.manager.result({'route':'latest'}))['status'],'not_analyzed')
        await self.manager.auto_tick();self.assertEqual(len(self.manager.jobs),1,'late upload resets stability wait')
        self.manager.stable_since=time.monotonic()-181
        await self.manager.auto_tick();job=list(self.manager.jobs.values())[-1];await job['_task']
        self.assertEqual(job['processed'],34);self.assertEqual(len(self.decoded),34,'prior 33 segment summaries reused')
        self.manager.helper.provider.assert_not_awaited()

    async def test_decode_failure_never_marks_whole_drive_complete(self):
        original=self.manager.helper.extract
        async def failed(job,*args):
            if job['segments']==['route--hash--12']:raise OSError('synthetic missing file')
            return await original(job,*args)
        self.manager.helper.extract=failed
        job=await self.run_job({'route':'latest'})
        self.assertEqual(job['status'],'failed');self.assertEqual(job['processed'],12)
        self.assertEqual((await self.manager.result({'route':'latest'}))['status'],'not_analyzed')

    async def test_disabling_auto_does_not_start_jobs(self):
        await self.manager.config({'auto_latest':False});await self.manager.auto_tick()
        self.assertFalse(self.manager.jobs);self.assertEqual(self.manager.status['phase'],'disabled')


if __name__=='__main__':unittest.main()
