#!/usr/bin/env python3
"""Back up an archive into a NEW file, derive corrections and write an audit CSV.
Never opens the input database for writing. Run from any directory; no HA needed.
"""
import argparse
import csv
import hashlib
import json
import sqlite3
import sys
import types
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

root = Path(__file__).resolve().parents[1]
pkg = types.ModuleType('custom_components.carrot_ha')
pkg.__path__ = [str(root/'custom_components/carrot_ha')]
sys.modules.setdefault('custom_components', types.ModuleType('custom_components'))
sys.modules['custom_components.carrot_ha'] = pkg
sys.path.insert(0, str(root))
from custom_components.carrot_ha.storage import Archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if not args.source.is_file() or args.output.exists() or args.source.resolve() == args.output.resolve():
        parser.error('Source must exist; output must be a new, distinct path.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation also prevents accidental overwrites on reruns.
    args.output.open('xb').close()
    source = sqlite3.connect(args.source.resolve().as_uri()+'?mode=ro', uri=True)
    target = sqlite3.connect(args.output)
    try:
        source.backup(target)
        assert target.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        devices = [r[0] for r in target.execute('SELECT DISTINCT device FROM events')]
        before = dict(target.execute('SELECT device||char(0)||id,body FROM events'))
    finally:
        target.close()
        source.close()
    archive = Archive(args.output)
    report=[]
    for device in devices:
        results={r['id']:r for r in archive.repair_trips(device)}
        with archive.connect() as db:
            trips = [(i,json.loads(b)) for i,b in db.execute("SELECT id,body FROM events WHERE device=? AND kind='trip' ORDER BY observed",(device,))]
        months=set()
        for key,event in trips:
            d=event['data'];r=results[key];raw=d.get('distance_m') or 0
            at=d.get('started_at') or event['observed_at']
            local=datetime.fromisoformat(at.replace('Z','+00:00')).astimezone(ZoneInfo('Asia/Seoul'))
            months.add(datetime.fromisoformat(event['observed_at']).astimezone(ZoneInfo('Asia/Seoul')).strftime('%Y-%m'))
            report.append({'device':device,'id':key,'started_kst':local.isoformat(),
                'raw_km':round(raw/1000,4),'effective_km':round((r.get('distance_m') if r.get('distance_m') is not None else raw)/1000,4),
                'status':r['status'],'reason':r['reason'],
                'gps_km':round(r.get('gps',{}).get('distance_m',0)/1000,4),
                'odometer_km':r.get('odometer',{}).get('distance_m',''),
                'energy_kwh':r.get('energy',{}).get('energy_wh'),
                'estimated':bool(r.get('estimated'))})
            if report[-1]['odometer_km']!='':report[-1]['odometer_km']/=1000
            if report[-1]['energy_kwh'] is not None:report[-1]['energy_kwh']/=1000
        for month in months:
            archive.driving_energy_summary(device,month,ZoneInfo('Asia/Seoul'),0)
    with archive.connect() as db:
        assert before == dict(db.execute('SELECT device||char(0)||id,body FROM events')), 'Raw events changed'
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    csv_path=args.output.with_suffix('.audit.csv')
    with csv_path.open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.DictWriter(f,fieldnames=list(report[0]) if report else ['device'])
        writer.writeheader();writer.writerows(report)
    summary={'trips':len(report),'corrected':sum(r['status']=='corrected' for r in report),
             'raw_km':round(sum(r['raw_km'] for r in report),4),'effective_km':round(sum(r['effective_km'] for r in report),4),
             'raw_events_unchanged':True,'integrity_check':'ok',
             'output':str(args.output),'audit':str(csv_path)}
    args.output.with_suffix('.summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
