"""Durable, whole-route free analysis; Gemini never runs from this scheduler."""
import asyncio
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import time
import uuid

from .ai import AiManager, AnalysisError, atomic_json, parameter_context
from .local_rules import assess, POLICY_VERSION
from .runtime import store_for
from .store import segment_name

MAX_SEGMENTS = 720
CACHE_VERSION = 1


def fingerprint(items):
    return hashlib.sha256(json.dumps(items,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def plan(store, body):
    """Freeze every known complete segment; never silently sample a route."""
    state=store.state['segments']
    route=body.get('route','')
    requested=body.get('segments')
    if route=='latest':
        if not state:raise AnalysisError('no_logs','저장된 주행 로그가 없습니다.',404)
        route=max(state,key=lambda name:state[name]['recorded']).rsplit('--',1)[0]
    if requested is not None:
        if not isinstance(requested,list) or not 1<=len(requested)<=MAX_SEGMENTS:raise ValueError('invalid_selection')
        names=list(dict.fromkeys(segment_name(name) for name in requested))
        routes={name.rsplit('--',1)[0] for name in names}
        if len(routes)!=1:raise AnalysisError('mixed_routes','한 번에 같은 주행의 구간만 선택해 주세요.')
        selected_route=next(iter(routes))
        if route and route!=selected_route:raise ValueError('route_mismatch')
        route=selected_route
    else:
        segment_name(route+'--0')
        names=[name for name in state if name.rsplit('--',1)[0]==route]
        if not names:raise AnalysisError('route_missing','이 주행의 저장 로그를 찾을 수 없습니다.',404)
    names.sort(key=lambda name:int(name.rsplit('--',1)[1]))
    if len(names)>MAX_SEGMENTS:raise AnalysisError('route_limit','전체 분석은 한 번에 최대720개 구간까지 처리합니다.')
    rows=[]
    for name in names:
        item=state.get(name)
        if not item or not item.get('complete'):raise AnalysisError('receiving','선택한 주행 로그를 아직 수신하고 있습니다.',409)
        if not any(filename.split('.')[0]=='rlog' for filename in item['files']):raise AnalysisError('rlog_missing','분석에 필요한 rlog가 없습니다.',409)
        rows.append([name,item['recorded'],item.get('duration'),item['files'],item.get('hashes',{})])
    indexes=[int(name.rsplit('--',1)[1]) for name in names]
    if requested is None and indexes!=list(range(indexes[-1]+1)):
        raise AnalysisError('segment_gap','아직 받지 못한 세그먼트가 있습니다. 전체 수신 후 다시 분석합니다.',409)
    return {'route':route,'segments':names,'full_route':requested is None,'signature':fingerprint([CACHE_VERSION,POLICY_VERSION,rows]),
            'cache_keys':[fingerprint([CACHE_VERSION,row]) for row in rows]}


def load_json(path, default=None):
    if not path.exists():return default
    return json.loads(path.read_text(encoding='utf-8'))


def prune(directory, count, limit):
    files=sorted(directory.glob('*.json'),key=lambda path:path.stat().st_mtime,reverse=True)
    size=0
    for index,path in enumerate(files):
        size+=path.stat().st_size
        if index>=count or size>limit:path.unlink(missing_ok=True)


async def manager_for(hass,runtime):
    async with runtime.setdefault('driving_local_init_lock',asyncio.Lock()):
        if 'driving_local' not in runtime:runtime['driving_local']=LocalAnalysis(hass,runtime)
        return runtime['driving_local']


class LocalAnalysis:
    def __init__(self,hass,runtime):
        self.hass,self.runtime=hass,runtime
        self.root=Path(hass.config.path('carrot_ha','driving-analysis',runtime['entry'].entry_id))
        self.helper=AiManager(hass,runtime)
        self.lock=asyncio.Lock();self.extract_lock=asyncio.Lock();self.jobs={}
        self.status={'phase':'waiting','message':'마지막 주행 로그를 확인하고 있습니다.'}
        self.stable_signature='';self.stable_since=0;self.failed={}

    async def execute(self,function,*args):return await self.hass.async_add_executor_job(function,*args)

    async def save(self,path,value):
        worker=asyncio.ensure_future(self.execute(atomic_json,path,value))
        try:await asyncio.shield(worker)
        except asyncio.CancelledError:await worker;raise

    async def config(self,body=None):
        async with self.lock:
            value=await self.execute(load_json,self.root/'config.json',{'auto_latest':True})
            if body is not None:
                if type(body.get('auto_latest')) is not bool:raise ValueError('boolean_required')
                value={'auto_latest':body['auto_latest']};await self.save(self.root/'config.json',value)
            return value

    async def selection(self,body):
        async with self.runtime.setdefault('driving_log_lock',asyncio.Lock()):
            store=await store_for(self.hass,self.runtime)
            return await self.execute(plan,store,body)

    async def summaries(self,selection,job=None):
        directory=Path(await self.execute(tempfile.mkdtemp,'','carrot-local-'))
        summaries=[]
        try:
            for index,(name,key) in enumerate(zip(selection['segments'],selection['cache_keys'])):
                async with self.extract_lock:
                    cache=self.root/'segments'/(key+'.json')
                    summary=await self.execute(load_json,cache)
                    if summary is None:
                        # Each source is copied/decoded separately: total route size is unbounded
                        # by the old multi-segment 128MiB snapshot, while per-file limits remain.
                        async with self.helper.gate:
                            extracted,_=await self.helper.extract({'segments':[name]},directory,False)
                        summary=extracted[0];await self.save(cache,summary)
                alias=f'S{index+1}'
                summaries.append({**summary,'alias':alias,'events':[{**event,'alias':alias} for event in summary['events']]})
                if job is not None:
                    job.update(processed=index+1,progress=round((index+1)/len(selection['segments'])*80),
                        message=f'저장 구간 {index+1} / {len(selection["segments"])}개 분석 중')
                await asyncio.sleep(0)
            return summaries
        finally:
            cleanup=asyncio.ensure_future(self.execute(shutil.rmtree,directory,True))
            try:await asyncio.shield(cleanup)
            except asyncio.CancelledError:await cleanup;raise

    async def start(self,body,automatic=False):
        selection=await self.selection(body)
        async with self.lock:
            running=next((job for job in self.jobs.values() if not job['done']),None)
            if running:
                if running['signature']==selection['signature']:return {'job_id':running['id']}
                raise AnalysisError('busy','다른 무료 분석이 진행 중입니다.',409)
            key=uuid.uuid4().hex
            job={'id':key,'status':'running','done':False,'phase':'extracting','message':'저장된 모든 대상 구간을 순차 분석합니다.',
                'route':selection['route'],'total':len(selection['segments']),'processed':0,'progress':0,
                'signature':selection['signature'],'automatic':automatic}
            self.jobs[key]=job
            job['_task']=self.hass.async_create_background_task(self.run(job,selection),'carrot free whole-route analysis')
            def done(task):
                if task.cancelled() and not job['done']:job.update(done=True,status='canceled',phase='canceled',message='무료 분석을 취소했습니다.')
            job['_task'].add_done_callback(done)
            for old in [key for key,value in self.jobs.items() if value['done']][:-4]:self.jobs.pop(old)
            return {'job_id':key}

    def snapshot(self,key):
        job=self.jobs.get(key)
        if not job:raise AnalysisError('job_not_found','무료 분석 작업을 찾을 수 없습니다.',404)
        return {key:value for key,value in job.items() if not key.startswith('_')}

    def cancel(self,key):
        job=self.jobs.get(key)
        if not job:raise AnalysisError('job_not_found','무료 분석 작업을 찾을 수 없습니다.',404)
        if not job['done'] and job['phase']!='canceling':
            job.update(phase='canceling',message='무료 분석을 취소하고 있습니다.');job['_task'].cancel()
        return {'cancel_requested':True}

    async def run(self,job,selection):
        try:
            async with asyncio.timeout(1800):
                summaries=await self.summaries(selection,job)
                job.update(phase='parameters',message='현재 차량 파라미터와 관측 근거를 대조합니다.',progress=85)
                snapshot=await self.helper.current_parameters()
                definitions=parameter_context(snapshot,summaries)
                result=assess(summaries,definitions,selection['segments'])
                result.update(route=selection['route'],full_route=selection['full_route'],signature=selection['signature'],
                    analyzed_at=time.time(),parameters_updated_at=str(snapshot.get('updated_at',''))[:80],automatic=job['automatic'])
                result['limitations'].append('대상은 현재 HA/NAS에 저장된 구간 전체입니다. 새 구간이 늦게 수신되면 결과를 다시 갱신합니다.')
                # A newly arriving segment must not leave a partial result marked current.
                current=await self.selection({'route':selection['route']} if selection['full_route'] else {'segments':selection['segments']})
                if current['signature']!=selection['signature']:raise AnalysisError('logs_changed','새 로그가 수신되어 전체 구간을 다시 확인합니다.',409)
                await self.save(self.root/'reports'/(selection['signature']+'.json'),result)
                await self.execute(prune,self.root/'reports',8,16*1024**2)
                await self.execute(prune,self.root/'segments',1500,32*1024**2)
                job.update(status='done',done=True,phase='complete',message='무료 분석 완료',progress=100,result=result)
        except asyncio.CancelledError:
            job.update(status='canceled',done=True,phase='canceled',message='무료 분석을 취소했습니다.')
        except AnalysisError as error:
            job.update(status='failed',done=True,phase='failed',message=error.message,error=error.message,error_code=error.code)
            self.failed[selection['signature']]=time.monotonic()
        except Exception:
            job.update(status='failed',done=True,phase='failed',message='일부 로그 해석 또는 설정 대조에 실패했습니다. 전체 완료로 표시하지 않습니다.',error_code='local_failed')
            self.failed[selection['signature']]=time.monotonic()

    async def result(self,body):
        selection=await self.selection(body)
        report=await self.execute(load_json,self.root/'reports'/(selection['signature']+'.json'))
        return {'status':'done' if report else 'not_analyzed','result':report,'route':selection['route'],'segments':len(selection['segments'])}

    async def public_status(self):
        config=await self.config()
        running=next((job for job in reversed(list(self.jobs.values())) if not job['done']),None)
        if running:return {**config,'phase':running['phase'],'message':running['message'],'job_id':running['id'],'processed':running['processed'],'total':running['total']}
        try:
            report=await self.result({'route':'latest'})
            if report['result']:
                result=report['result']
                return {**config,'phase':'done','message':f'마지막 주행 무료 분석 완료 · 저장 구간 {report["segments"]}/{report["segments"]}개',
                    'route':report['route'],'segments':report['segments'],'recommendations':len(result['recommendedParams'])}
        except AnalysisError:pass
        return {**config,**self.status}

    async def auto_tick(self):
        if not (await self.config())['auto_latest']:
            self.status={'phase':'disabled','message':'마지막 주행 자동 무료 분석 꺼짐'};return
        try:selection=await self.selection({'route':'latest'})
        except AnalysisError as error:
            self.status={'phase':'waiting','message':error.message};return
        signature=selection['signature'];now=time.monotonic()
        if signature!=self.stable_signature:self.stable_signature=signature;self.stable_since=now
        latest=self.runtime.get('latest') or {};data=latest.get('data') or {}
        active=data.get('driving',data.get('onroad'))
        try:age=time.time()-datetime.fromisoformat(latest['observed_at'].replace('Z','+00:00')).timestamp()
        except (KeyError,ValueError,TypeError):age=float('inf')
        last_commit=self.runtime.get('driving_log_last_commit')
        since=self.stable_since if last_commit is None else max(self.stable_since,last_commit)
        quiet=now-since
        if active is True and age<=180:
            self.status={'phase':'driving','message':'주행 중 · 종료 후 무료 분석'};return
        required=180 if active is False and age<=600 else 600
        if quiet<required:
            self.status={'phase':'waiting','message':'마지막 주행 · 로그 수신 안정 대기 중'};return
        if (await self.result({'route':'latest'}))['result']:return
        if now-self.failed.get(signature,-99999)<600:return
        try:await self.start({'route':selection['route']},automatic=True)
        except AnalysisError as error:self.status={'phase':'waiting','message':error.message}

    async def loop(self):
        while True:
            try:await self.auto_tick()
            except asyncio.CancelledError:raise
            except Exception:self.status={'phase':'retrying','message':'무료 분석 준비를 다시 확인합니다.'}
            await asyncio.sleep(60)

    async def close(self):
        tasks=[job['_task'] for job in self.jobs.values() if not job['_task'].done()]
        for task in tasks:task.cancel()
        await asyncio.gather(*tasks,return_exceptions=True)
