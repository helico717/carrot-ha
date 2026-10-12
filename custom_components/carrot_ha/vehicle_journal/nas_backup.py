"""Independent verified snapshots and GFS generations on an existing NAS mount."""
import asyncio
from datetime import datetime
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import tempfile
import threading
from uuid import uuid4
from zoneinfo import ZoneInfo
from .snapshots import snapshot_preview,restore_snapshot,restore_source,MAX_SNAPSHOT
from .store import Journal

FILE=re.compile(r'snapshot-[0-9a-f-]{36}-[0-9a-f]{32}\.zip')
POLICY={'daily':7,'weekly':4,'monthly':12}
MARKER={'format':'carrot-journal-nas','version':1}


def verify(content):
    plan=snapshot_preview(content);meta=plan['metadata']
    with tempfile.TemporaryDirectory() as directory:
        journal=Journal(Path(directory)/'verify.sqlite3','verify',meta['device_id'],meta.get('timezone','Asia/Seoul'))
        restore_snapshot(journal,plan,'verify',meta['device_id'])
        from ..storage import Archive
        restore_source(Archive(Path(directory)/'source.sqlite3'),plan['source_tables'],meta['device_id'])
        with journal.connect() as db:
            if db.execute('PRAGMA quick_check').fetchone()!=('ok',) or db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('복원 DB 검증에 실패했어요.')
            for table in plan['tables']:
                if db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0]!=len(plan['tables'][table]['rows']):raise ValueError('복원 기록 수가 일치하지 않아요.')
    return {'records':plan['summary']['count'],'photos':plan['summary']['photos'],'restored':True}


def network_path(value):
    path=Path(value)
    if not path.is_absolute() or '..' in path.parts or path.name!='vehicle-journal':raise ValueError('마운트 아래 vehicle-journal 전용 폴더를 지정해 주세요.')
    base=path.parent
    if not any(base.is_relative_to(root) and base!=Path(root) for root in ('/share','/media','/backup')):raise ValueError('HA 네트워크 저장소 경로만 사용할 수 있어요.')
    base.stat()  # Activate an already configured automount; never create it locally.
    if base.resolve()!=base or path.is_symlink():raise ValueError('심볼릭 링크 백업 경로는 사용할 수 없어요.')
    mounted=False
    for line in Path('/proc/self/mountinfo').read_text().splitlines():
        before,after=line.split(' - ',1);target=Path(before.split()[4].replace('\\040',' '));kind=after.split()[0]
        if kind in ('nfs','nfs4','cifs') and base.is_relative_to(target):mounted=True
    if not mounted:raise ValueError('NAS 네트워크 마운트가 연결되지 않았어요. 로컬 디스크에 대신 저장하지 않아요.')
    return path


def atomic(path,content):
    if path.is_symlink():raise ValueError('백업 파일 링크는 사용할 수 없어요.')
    temporary=path.with_name(path.name+'.'+uuid4().hex+'.partial')
    try:
        with temporary.open('xb') as handle:handle.write(content);handle.flush();os.fsync(handle.fileno())
        temporary.chmod(0o600);os.replace(temporary,path)
        fd=os.open(path.parent,os.O_RDONLY)
        try:os.fsync(fd)
        finally:os.close(fd)
    finally:temporary.unlink(missing_ok=True)


class ManagedStore:
    """Only owns files listed in its index; never prunes unrelated HA backups."""
    def __init__(self,directory):self.directory=Path(directory)
    def load(self):
        marker=self.directory/'.carrot-journal-store'
        if not self.directory.exists():self.directory.mkdir(mode=0o700)
        if not marker.exists():
            if any(self.directory.iterdir()):raise ValueError('전용 폴더에 다른 파일이 있어 초기화하지 않았어요.')
            atomic(marker,json.dumps(MARKER).encode())
        if marker.is_symlink() or json.loads(marker.read_text())!=MARKER:raise ValueError('차계부 전용 백업 폴더를 확인해 주세요.')
        index=self.directory/'index.json'
        if not index.exists():return {'version':1,'objects':{},'generations':{key:{} for key in POLICY}}
        if index.is_symlink():raise ValueError('백업 인덱스 링크는 사용할 수 없어요.')
        data=json.loads(index.read_text())
        if data.get('version')!=1 or set(data.get('generations',{}))!=set(POLICY):raise ValueError('백업 인덱스 버전을 확인해 주세요.')
        for name,item in data['objects'].items():
            if not FILE.fullmatch(name) or not re.fullmatch('[0-9a-f]{64}',item['sha256']):raise ValueError('백업 인덱스 경로를 확인해 주세요.')
        return data
    def write_run(self,items,clock):
        index=self.load();old_objects=dict(index['objects']);written={}
        # Full round-trip validation occurs before committing any generation pointers.
        for key,content in items:
            proof=verify(content);plan=snapshot_preview(content);vehicle=plan['metadata']['vehicle_id']
            name='snapshot-'+vehicle+'-'+uuid4().hex+'.zip'
            if not FILE.fullmatch(name):raise ValueError('차량 백업 식별자를 확인해 주세요.')
            path=self.directory/name;atomic(path,content)
            received=path.read_bytes()
            if sha256(received).digest()!=sha256(content).digest():raise ValueError('NAS 저장 후 체크섬이 다릅니다.')
            proof=verify(received)
            index['objects'][name]={'sha256':sha256(content).hexdigest(),'vehicle_id':vehicle,'title':plan['metadata'].get('title','차량'),'created_at':clock.isoformat(),'bytes':len(content),'verification':proof}
            written[vehicle]=name
        if not written:raise ValueError('백업할 차량이 없어요.')
        periods={'daily':clock.strftime('%Y-%m-%d'),'weekly':f'{clock.isocalendar().year}-W{clock.isocalendar().week:02}','monthly':clock.strftime('%Y-%m')}
        for category,count in POLICY.items():
            generations=index['generations'][category];generations[periods[category]]=written
            for period in sorted(generations)[:-count]:del generations[period]
        referenced={name for groups in index['generations'].values() for vehicles in groups.values() for name in vehicles.values()}
        obsolete=set(old_objects)-referenced
        index['objects']={name:item for name,item in index['objects'].items() if name in referenced}
        index['last_success']=clock.isoformat();atomic(self.directory/'index.json',json.dumps(index,ensure_ascii=False).encode())
        # Only after a fully verified run and durable index commit may old owned objects go.
        for name in obsolete:
            path=self.directory/name
            if path.is_symlink():raise ValueError('보관 정리 대상이 링크여서 삭제하지 않았어요.')
            if path.exists() and sha256(path.read_bytes()).hexdigest()==old_objects[name]['sha256']:path.unlink()
        return {'last_success':clock.isoformat(),'vehicles':len(written),'restore_verified':True,'generations':{key:len(groups) for key,groups in index['generations'].items()},'objects':len(index['objects'])}
    def read(self,name):
        index=self.load()
        if name not in index['objects'] or not FILE.fullmatch(name):raise ValueError('백업 파일을 찾지 못했어요.')
        path=self.directory/name
        if path.is_symlink() or path.stat().st_size>MAX_SNAPSHOT:raise ValueError('백업 파일을 확인해 주세요.')
        content=path.read_bytes()
        if sha256(content).hexdigest()!=index['objects'][name]['sha256']:raise ValueError('백업 체크섬 검증에 실패했어요.')
        verify(content);return content


class NasBackup:
    def __init__(self,manager):self.manager=manager;self.lock=asyncio.Lock();self.io_lock=threading.Lock();self.status={}
    def io(self,method,*args):
        if not self.io_lock.acquire(blocking=False):raise ValueError('NAS 파일 작업이 아직 진행 중이에요.')
        try:
            path=network_path(self.manager.backup_config.get('path',''))
            return getattr(ManagedStore(path),method)(*args)
        finally:self.io_lock.release()
    async def run(self):
        if self.lock.locked():raise ValueError('차계부 백업이 진행 중이에요.')
        async with self.lock:
            self.status={'phase':'running'}
            try:
                items=[]
                for vehicle in self.manager.entries(True):
                    if vehicle.get('unavailable'):raise ValueError('백업할 차량 DB를 열 수 없어요. 기존 세대를 유지합니다.')
                    items.append((vehicle['entry_id'],await self.manager.export(vehicle['entry_id'])))
                result=await self.manager.hass.async_add_executor_job(self.io,'write_run',items,datetime.now(ZoneInfo('Asia/Seoul')))
                self.status={'phase':'complete',**result};self.manager.backup_state=self.status;await self.manager.persist();return self.status
            except Exception as error:
                self.status={'phase':'failed','message':str(error) if isinstance(error,(ValueError,OSError)) else '백업 작업에 실패했어요. 기존 세대를 유지합니다.'}
                self.manager.backup_state=self.status;await self.manager.persist();raise ValueError(self.status['message']) from None
    async def listing(self):
        index=await self.manager.hass.async_add_executor_job(self.io,'load')
        return {'status':self.status or self.manager.backup_state,'objects':[{'name':name,**item} for name,item in index['objects'].items()],'generations':index['generations']}
    async def schedule(self):
        if not self.manager.backup_config.get('enabled') or self.lock.locked():return
        now=datetime.now(ZoneInfo('Asia/Seoul'));last=self.manager.backup_state.get('last_success','')
        if now.hour<3 or last.startswith(now.strftime('%Y-%m-%d')):return
        retry=self.manager.backup_state.get('retry_after')
        if retry and now.timestamp()<retry:return
        try:await self.run()
        except ValueError:
            self.manager.backup_state['retry_after']=now.timestamp()+3600;await self.manager.persist()
