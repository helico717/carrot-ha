"""Persistent standalone vehicles and metadata overlays for existing device entries."""
import asyncio
from copy import deepcopy
from pathlib import Path
import secrets
import shutil
import time
from types import SimpleNamespace
from uuid import uuid4, UUID
from .store import Journal
from .importers import michael_preview
from .snapshots import snapshot_preview, restore_snapshot, export_snapshot, restore_source

FUELS={'gasoline':'휘발유','diesel':'경유','hybrid':'하이브리드','electric':'전기'}


def manager(hass):return hass.data['carrot_ha_journal_manager']


def lookup(hass,key):
    m=hass.data.get('carrot_ha_journal_manager')
    return m.get(key) if m else hass.data.get('carrot_ha',{}).get(key)


class Vehicles:
    def __init__(self,hass,store):
        self.hass=hass;self.store=store;self.metadata={};self.map_key="";self.opinet_key="";self.kakao_rest_key="";self.search_cache={};self.search_last=0;self.manual={};self.previews={};self.lock=asyncio.Lock()

    async def load(self):
        state=await self.store.async_load() or {'vehicles':{}}
        self.metadata=state['vehicles'];self.map_key=state.get('map_key','');self.opinet_key=state.get('opinet_key','');self.kakao_rest_key=state.get('kakao_rest_key','')
        for key,meta in list(self.metadata.items()):
            if meta.get('purging'):
                await self.hass.async_add_executor_job(self._remove_files,key,None)
                self.metadata.pop(key);await self.persist();continue
            if meta.get('kind')!='manual':continue
            path=self.hass.config.path('carrot_ha','vehicle_journal',key+'.sqlite3')
            if not Path(path).exists():raise ValueError('수동 차량 DB가 없어 복구가 필요해요.')
            journal=await self.hass.async_add_executor_job(Journal,path,key,meta['device_id'],meta['timezone'])
            self.manual[key]={'journal':journal,'manual_vehicle':True,'entry':SimpleNamespace(title=meta['title'],data={'device_id':meta['device_id']})}

    def get(self,key,include_deleted=False):
        if not include_deleted and self.metadata.get(key,{}).get('deleted'):return None
        return self.manual.get(key) or self.hass.data.get('carrot_ha',{}).get(key)

    def entries(self,include_deleted=False):
        entries=[];seen=set()
        for key,runtime in {**self.manual,**self.hass.data.get('carrot_ha',{})}.items():
            if not isinstance(runtime,dict) or 'entry' not in runtime:continue
            if 'journal' not in runtime:
                if runtime.get('journal_error'):
                    meta=self.metadata.get(key,{})
                    if include_deleted or not meta.get('deleted'):entries.append({'entry_id':key,'title':meta.get('title',runtime['entry'].title),'fuel':meta.get('fuel','electric'),'deleted':bool(meta.get('deleted')),'linked':True,'unavailable':True,'error':runtime['journal_error']})
                continue
            if runtime['journal'].vehicle in seen:continue
            seen.add(runtime['journal'].vehicle)
            meta=self.metadata.get(key,{})
            if meta.get('deleted') and not include_deleted:continue
            entries.append({'entry_id':key,'title':meta.get('title',runtime['entry'].title),'fuel':meta.get('fuel','electric'),'deleted':bool(meta.get('deleted')),'linked':not runtime.get('manual_vehicle'),'vehicle_id':runtime['journal'].vehicle})
        return entries

    async def persist(self):await self.store.async_save({'vehicles':self.metadata,'map_key':self.map_key,'opinet_key':self.opinet_key,'kakao_rest_key':self.kakao_rest_key})

    async def change(self,key,title,fuel,deleted):
        if not isinstance(title,str) or not title.strip() or len(title)>80 or fuel not in FUELS or type(deleted)is not bool:raise ValueError('차량 이름·유종을 확인해 주세요.')
        async with self.lock:
            runtime=self.get(key,True)
            if not isinstance(runtime,dict) or 'journal' not in runtime:raise ValueError('차량을 찾지 못했어요.')
            old=deepcopy(self.metadata)
            self.metadata.setdefault(key,{'kind':'linked'})
            self.metadata[key].update(title=title.strip(),fuel=fuel,deleted=deleted)
            try:await self.persist()
            except Exception:self.metadata=old;raise
        return {'entry_id':key}

    def _remove_files(self,key,journal):
        # Never accept uploaded paths or touch a device-linked archive.
        path=Path(self.hass.config.path('carrot_ha','vehicle_journal',key+'.sqlite3'))
        def remove():
            if journal:journal.permanently_deleted=True
            for suffix in ('','-wal','-shm','-journal','.before-schema2.sqlite3','.before-schema3.sqlite3'):
                Path(str(path)+suffix).unlink(missing_ok=True)
            directory=path.with_suffix('')
            if directory.exists():shutil.rmtree(directory)
        if journal:
            with journal.lock:remove()
        else:remove()

    async def purge(self,key):
        async with self.lock:
            meta=self.metadata.get(key)
            runtime=self.manual.get(key)
            if not meta or meta.get('kind')!='manual' or (not meta.get('purging') and (not runtime or not runtime.get('manual_vehicle'))):
                raise ValueError('수동 등록 차량만 영구 삭제할 수 있어요.')
            if not meta.get('deleted'):raise ValueError('휴지통으로 이동한 차량만 영구 삭제할 수 있어요.')
            old=deepcopy(meta);meta['purging']=True
            try:await self.persist()
            except Exception:self.metadata[key]=old;raise
            # Durable marker resumes interrupted deletion before loading any DB.
            self.manual.pop(key,None)
            await self.hass.async_add_executor_job(self._remove_files,key,runtime['journal'] if runtime else None)
            self.metadata.pop(key,None)
            try:await self.persist()
            except Exception:self.metadata[key]=meta;raise
            self.previews={token:p for token,p in self.previews.items() if p.get('result',{}).get('entry_id')!=key}
            return {'entry_id':key,'deleted':True}

    async def preview(self,content,kind,fuel,user_id):
        if fuel not in FUELS:raise ValueError('유종을 선택해 주세요.')
        method=michael_preview if kind=='michael' else snapshot_preview if kind=='snapshot' else None
        if not method:raise ValueError('파일 종류를 확인해 주세요.')
        args=(content,fuel) if kind=='michael' else (content,)
        plan=await self.hass.async_add_executor_job(method,*args)
        if kind=='snapshot':
            from tempfile import TemporaryDirectory
            def validate():
                with TemporaryDirectory() as directory:
                    meta=plan['metadata'];j=Journal(Path(directory)/'check.sqlite3','preview',meta.get('device_id','preview'),self.hass.config.time_zone)
                    restore_snapshot(j,plan,'preview',meta.get('device_id','preview'))
                    from ..storage import Archive
                    restore_source(Archive(Path(directory)/'source.sqlite3'),plan['source_tables'],j.device)
            await self.hass.async_add_executor_job(validate)
        self.previews={k:v for k,v in self.previews.items() if v['expires']>time.monotonic()}
        if len(self.previews)>=4 or sum(p.get('size',0) for p in self.previews.values())+len(content)>192*1024*1024:raise ValueError('다른 이관 작업을 먼저 완료해 주세요.')
        token=secrets.token_urlsafe(32)
        self.previews[token]={'plan':plan,'user':user_id,'expires':time.monotonic()+900,'fuel':fuel,'size':len(content)}
        return {'token':token,'summary':plan['summary'],'warnings':plan['warnings'],'vehicle':plan.get('metadata'),'sample':[{'date':r['payload']['date'],'category':r['payload'].get('category','odometer'),'subcategory':r['payload'].get('subcategory',''),'actual_krw':r['payload'].get('actual_krw'),'location':r['source']['fields'].get('장소명','')} for r in plan.get('records',[])[:20]]}

    async def create(self,title,fuel,token,user_id):
        if not isinstance(title,str) or not title.strip() or len(title)>80 or fuel not in FUELS:raise ValueError('차량 이름·유종을 확인해 주세요.')
        async with self.lock:
            preview=self.previews.get(token) if token else None
            if token and (not preview or preview['expires']<=time.monotonic() or preview['user']!=user_id or preview['fuel']!=fuel):raise ValueError('미리보기가 만료됐거나 유종이 바뀌었어요. 파일을 다시 선택해 주세요.')
            if preview and preview.get('result'):return preview['result']
            plan=preview['plan'] if preview else None
            metadata=plan.get('metadata',{}) if plan else {}
            if plan and plan['format']=='snapshot':
                vehicle_id=str(UUID(metadata['vehicle_id']))
                if any(e.get('vehicle_id')==vehicle_id or (metadata.get('linked') and (self.get(e['entry_id'],True).get('journal').device if self.get(e['entry_id'],True).get('journal') else getattr(self.get(e['entry_id'],True).get('entry'),'data',{}).get('device_id'))==metadata.get('device_id')) for e in self.entries(True)):raise ValueError('같은 차량이 이미 있어요. 휴지통도 확인해 주세요. 덮어쓰지 않았어요.')
            key='journal-'+str(uuid4());device=metadata.get('device_id') or 'manual-'+str(uuid4());timezone=metadata.get('timezone') or self.hass.config.time_zone
            path=self.hass.config.path('carrot_ha','vehicle_journal',key+'.sqlite3')
            def prepare():
                j=Journal(path,key,device,timezone)
                counts={'imported':0,'skipped':0}
                try:
                    if plan:
                        counts=restore_snapshot(j,plan,key,device) if plan['format']=='snapshot' else j.import_michael(plan['records'])
                    return j,counts
                except Exception:
                    Path(path).unlink(missing_ok=True);shutil.rmtree(Path(path).with_suffix(''),ignore_errors=True);raise
            journal,counts=await self.hass.async_add_executor_job(prepare)
            self.metadata[key]={'kind':'manual','title':title.strip(),'fuel':fuel,'deleted':False,'device_id':device,'timezone':timezone,'linked_origin':bool(metadata.get('linked')),'source_tables':plan.get('source_tables',{}) if plan else {}}
            try:await self.persist()
            except Exception:
                self.metadata.pop(key,None)
                await self.hass.async_add_executor_job(Path(path).unlink)
                await self.hass.async_add_executor_job(shutil.rmtree,Path(path).with_suffix(''),True)
                raise
            self.manual[key]={'journal':journal,'manual_vehicle':True,'entry':SimpleNamespace(title=title.strip(),data={'device_id':device})}
            result={'entry_id':key,**counts}
            if preview:preview['result']=result
            return result

    async def attach(self,entry,runtime,journal):
        matches=[key for key,meta in self.metadata.items() if meta.get('kind')=='manual' and meta.get('linked_origin') and meta.get('device_id')==entry.data['device_id']]
        if len(matches)>1:raise ValueError('연결할 차계부 차량이 여러 대예요.')
        if not matches:return journal
        key=matches[0];restored=self.manual[key]['journal']
        await self.hass.async_add_executor_job(restore_source,runtime['archive'],self.metadata[key].get('source_tables',{}),restored.device)
        runtime['journal']=restored;self.manual[key]=runtime
        return restored

    async def export(self,key):
        r=self.get(key,True)
        if not isinstance(r,dict) or 'journal' not in r:raise ValueError('차량을 찾지 못했어요.')
        j=r['journal'];meta=self.metadata.get(key,{})
        metadata={'vehicle_id':j.vehicle,'title':meta.get('title',r['entry'].title),'fuel':meta.get('fuel','electric'),'device_id':j.device,'timezone':j.time_zone,'linked':bool(not r.get('manual_vehicle') or meta.get('linked_origin'))}
        if 'archive' in r:
            async with r['lock']:
                from .source import sync
                await self.hass.async_add_executor_job(sync,r['archive'],j,True)
                return await self.hass.async_add_executor_job(export_snapshot,j,metadata,r['archive'])
        return await self.hass.async_add_executor_job(export_snapshot,j,metadata,None,meta.get('source_tables',{}))


async def setup(hass):
    from homeassistant.helpers.storage import Store
    instance=Vehicles(hass,Store(hass,1,'carrot_ha.journal_vehicles'))
    await instance.load();hass.data['carrot_ha_journal_manager']=instance
