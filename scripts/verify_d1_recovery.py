"""Compare full private before/after D1 backups entirely on the authorized PC.

No data/hashes are transmitted. Prints aggregate verification only.
"""
import argparse
import json
from pathlib import Path
import sqlite3
from datetime import datetime, timezone, timedelta
import importlib.util

parser=argparse.ArgumentParser()
parser.add_argument('before_database');parser.add_argument('after_sql')
args=parser.parse_args()
source=Path(args.after_sql).resolve();after=source.with_suffix('.verified.sqlite3')
if after.exists():raise RuntimeError('Refusing to overwrite verified backup')
db=sqlite3.connect(after)
statement=''
with source.open(encoding='utf-8') as stream:
    for line in stream:
        statement+=line
        if sqlite3.complete_statement(statement):
            db.execute(statement);statement=''
if statement.strip():db.execute(statement)
db.commit()
if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('Post-backup integrity failed')
db.execute('PRAGMA query_only=ON')
spec=importlib.util.spec_from_file_location('cloud_archive',Path('custom_components/carrot_ha/cloud_archive.py'))
codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
before=sqlite3.connect(Path(args.before_database).resolve().as_uri()+'?mode=ro',uri=True)
consumers={r[0]:r[1] for r in db.execute('SELECT device_id,telemetry_sequence FROM archive_consumers')}
cutoff=datetime.now(timezone.utc)-timedelta(days=14)
matched=expired=0
context_cache={}
for seq,device,stamp,original in before.execute('SELECT sequence,device_id,updated_at,raw_json FROM telemetry_history'):
    row=db.execute('SELECT raw_json,context_hash FROM telemetry_history WHERE sequence=? AND device_id=?',(seq,device)).fetchone()
    if row is None:
        if seq>consumers.get(device,0) or datetime.fromisoformat(stamp.replace('Z','+00:00'))>=cutoff:
            raise RuntimeError('Unacknowledged/recent record missing')
        expired+=1;continue
    contexts={}
    if row[1]:
        key=(device,row[1])
        if key not in context_cache:
            context_cache[key]=db.execute('SELECT raw_json FROM telemetry_contexts WHERE device_id=? AND hash=?',key).fetchone()[0]
        contexts[row[1]]=context_cache[key]
    page=codec.restore_page({'encoding':'carrot-cloud-archive-v1','contexts':contexts,
        'events':[{'sequence':seq,'device_id':device,'raw_json':row[0],'context_hash':row[1]}]})
    if json.loads(page['events'][0]['raw_json'])!=json.loads(original):raise RuntimeError('Original value mismatch')
    matched+=1
print(json.dumps({'after_backup_integrity':'ok','original_records_matched':matched,
                  'acknowledged_expired_records':expired,'unexplained_loss':0}))
before.close();db.close()
