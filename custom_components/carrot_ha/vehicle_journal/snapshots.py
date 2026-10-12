"""Portable logical journal snapshots with bounded ZIP members and photo hashes."""
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
from zipfile import ZipFile, ZIP_DEFLATED, BadZipFile
from .store import now

SOURCE_TABLES=('charge_summaries','charge_payments','charge_payment_parts','charge_exclusions','charge_deletions')

MAX_SNAPSHOT=128*1024*1024
TABLES=('vehicles','records','mobility','expenses','expense_members','record_links','corrections','change_log','attachments','day_parts','daily_summaries','comparison_settings','fuel_observations','sync_state','dirty_days')


def export_snapshot(journal,metadata,archive=None,source=None):
    with journal.lock,journal.connect() as db:
        db.execute('BEGIN')
        tables={}
        for table in TABLES:
            cursor=db.execute('SELECT * FROM '+table+' WHERE '+('id' if table=='vehicles' else 'vehicle_id')+'=?',(journal.vehicle,))
            tables[table]={'columns':[d[0] for d in cursor.description],'rows':cursor.fetchall()}
        files={};photos={}
        for row in tables['attachments']['rows']:
            item=dict(zip(tables['attachments']['columns'],row));name=item['relative_path']
            if not re.fullmatch(r'[0-9a-f-]+\.(jpg|png|webp)',name):raise ValueError('사진 경로를 확인해 주세요.')
            content=(Path(journal.path).with_suffix('')/'attachments'/name).read_bytes()
            if sha256(content).hexdigest()!=item['sha256']:raise ValueError('사진 파일 검증에 실패했어요.')
            photos['photos/'+name]=content
        journal_json=json.dumps(tables,ensure_ascii=False,separators=(',',':')).encode()
        source=source or {}
        if archive:
            with archive.connect() as source_db:
                source_db.execute('BEGIN')
                for table in SOURCE_TABLES:
                    cursor=source_db.execute('SELECT * FROM '+table+' WHERE device=?',(journal.device,))
                    source[table]={'columns':[d[0] for d in cursor.description],'rows':cursor.fetchall()}
        payloads={'journal.json':journal_json,'source.json':json.dumps(source,ensure_ascii=False,separators=(',',':')).encode(),**photos}
        for name,content in payloads.items():files[name]={'bytes':len(content),'sha256':sha256(content).hexdigest()}
        manifest={'format':'carrot-journal','version':1,'schema_version':2,'created_at':now(),'vehicle':metadata,'files':files}
        stream=BytesIO()
        with ZipFile(stream,'w',ZIP_DEFLATED) as zipfile:
            zipfile.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False))
            for name,content in payloads.items():zipfile.writestr(name,content)
        if stream.tell()>MAX_SNAPSHOT:raise ValueError('스냅샷이 최대 128MiB를 초과했어요.')
        return stream.getvalue()


def snapshot_preview(content):
    if not content or len(content)>MAX_SNAPSHOT:raise ValueError('128MiB 이하 스냅샷을 선택해 주세요.')
    try:
        with ZipFile(BytesIO(content)) as z:
            infos=z.infolist();names=[i.filename for i in infos]
            if len(infos)>10000 or len(set(names))!=len(names) or sum(i.file_size for i in infos)>256*1024*1024:raise ValueError('스냅샷 용량을 확인해 주세요.')
            if any(i.flag_bits&1 for i in infos):raise ValueError('지원하지 않는 스냅샷 암호 형식이에요.')
            if any(n not in ('manifest.json','journal.json','source.json') and not re.fullmatch(r'photos/[0-9a-f-]+\.(jpg|png|webp)',n) for n in names):raise ValueError('스냅샷 경로를 확인해 주세요.')
            manifest=json.loads(z.read('manifest.json'))
            if manifest.get('format')!='carrot-journal' or manifest.get('version')!=1 or manifest.get('schema_version')!=2:raise ValueError('지원하지 않는 스냅샷 버전이에요.')
            if set(manifest['files'])!=set(names)-{'manifest.json'}:raise ValueError('스냅샷 파일 목록이 달라요.')
            payloads={}
            for name,check in manifest['files'].items():
                data=z.read(name)
                if len(data)!=check['bytes'] or sha256(data).hexdigest()!=check['sha256']:raise ValueError('스냅샷 체크섬이 일치하지 않아요.')
                payloads[name]=data
            tables=json.loads(payloads.pop('journal.json'));source=json.loads(payloads.pop('source.json'))
            if not isinstance(source,dict) or set(source)-set(SOURCE_TABLES):raise ValueError('원본 결제 테이블을 확인해 주세요.')
            if set(tables)!=set(TABLES):raise ValueError('스냅샷 테이블을 확인해 주세요.')
            if sum(len(t['rows']) for t in tables.values())>100000:raise ValueError('스냅샷 기록이 너무 많아요.')
            if len(tables['vehicles']['rows'])!=1:raise ValueError('스냅샷은 차량 한 대여야 해요.')
            vehicle=dict(zip(tables['vehicles']['columns'],tables['vehicles']['rows'][0]))
            if manifest['vehicle'].get('vehicle_id')!=vehicle['id'] or manifest['vehicle'].get('device_id')!=vehicle['device_id'] or manifest['vehicle'].get('timezone',vehicle['accounting_timezone'])!=vehicle['accounting_timezone']:raise ValueError('차량 식별 정보가 일치하지 않아요.')
            records=[dict(zip(tables['records']['columns'],r)) for r in tables['records']['rows']]
            expenses=[dict(zip(tables['expenses']['columns'],r)) for r in tables['expenses']['rows']]
            active_ids={r['id'] for r in records if r['status']=='active'}
            active_expenses=[r for r in expenses if r['record_id'] in active_ids]
            dates=[r['accounting_date'] for r in expenses]
            return {'format':'snapshot','tables':tables,'source_tables':source,'photos':payloads,'metadata':manifest['vehicle'],'summary':{'count':len(records),'from':min(dates) if dates else None,'to':max(dates) if dates else None,'total_krw':sum((r['actual_krw'] if r['actual_krw'] is not None else r['estimated_krw']) or 0 for r in active_expenses),'photos':len(payloads)},'warnings':['이 스냅샷은 차계부 기록과 사진을 복원해요. HA 전체 설정·CAN·인증 토큰은 포함하지 않아요.']}
    except (BadZipFile,KeyError,TypeError,ValueError,json.JSONDecodeError) as e:
        raise ValueError(str(e) if isinstance(e,ValueError) else '스냅샷 형식을 확인해 주세요.') from e


def restore_snapshot(journal,plan,entry_id,device_id):
    """Known-schema inserts only. Uploaded SQL and paths are never executed."""
    with journal.lock,journal.connect() as db:
        if db.execute('SELECT COUNT(*) FROM records').fetchone()[0]:raise ValueError('빈 새 차량에만 복원할 수 있어요.')
        db.execute('DELETE FROM vehicles')
        for table in TABLES:
            expected=[r[1] for r in db.execute('PRAGMA table_info('+table+')')]
            source=plan['tables'][table]
            if source['columns']!=expected:raise ValueError('스냅샷 스키마가 일치하지 않아요.')
            rows=source['rows']
            if any(not isinstance(row,list) or len(row)!=len(expected) for row in rows):raise ValueError('스냅샷 행 형식이 잘못됐어요.')
            db.executemany('INSERT INTO '+table+' VALUES ('+','.join('?' for _ in expected)+')',rows)
        vehicle=db.execute('SELECT id FROM vehicles').fetchone()[0]
        db.execute('UPDATE vehicles SET entry_id=?,device_id=? WHERE id=?',(entry_id,device_id,vehicle))
        if db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('스냅샷 기록 연결이 잘못됐어요.')
        attachments=db.execute('SELECT relative_path,size_bytes,sha256 FROM attachments').fetchall()
        if {'photos/'+r[0] for r in attachments}!=set(plan['photos']):raise ValueError('사진 참조가 일치하지 않아요.')
        for name,size,digest in attachments:
            data=plan['photos']['photos/'+name]
            if len(data)!=size or sha256(data).hexdigest()!=digest:raise ValueError('사진 정보가 일치하지 않아요.')
    journal.vehicle=vehicle
    directory=Path(journal.path).with_suffix('')/'attachments';directory.mkdir(parents=True,exist_ok=True)
    for name,data in plan['photos'].items():
        path=directory/name.split('/')[-1];path.write_bytes(data);path.chmod(0o600)
    return {'imported':len(plan['tables']['records']['rows']),'skipped':0}


def restore_source(archive,source,device):
    """Restore original payment facts without replacing existing source records."""
    with archive.connect() as db:
        for table,item in source.items():
            if table not in SOURCE_TABLES:raise ValueError('지원하지 않는 원본 테이블이에요.')
            columns=[r[1] for r in db.execute('PRAGMA table_info('+table+')')]
            if item['columns']!=columns:raise ValueError('원본 결제 형식이 달라요.')
            for row in item['rows']:
                if len(row)!=len(columns) or row[0]!=device:raise ValueError('원본 차량 정보가 달라요.')
                old=db.execute('SELECT * FROM '+table+' WHERE '+columns[0]+'=? AND '+columns[1]+'=?',row[:2]).fetchone()
                if old and tuple(row)!=old:raise ValueError('기존 결제 원본과 달라요. 덮어쓰지 않았어요.')
                if not old:db.execute('INSERT INTO '+table+' VALUES ('+','.join('?' for _ in row)+')',row)
