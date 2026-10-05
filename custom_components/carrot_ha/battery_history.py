"""Seven local days, measured samples only; gaps are never interpolated."""
import json
from . import archive_codec
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

def history(archive, device, capacity, zone='Asia/Seoul', now=None):
    tz=ZoneInfo(zone)
    now=now or datetime.now(timezone.utc)
    today=now.astimezone(tz).date()
    dates=[today-timedelta(days=i) for i in range(6,-1,-1)]
    days={str(d):dict(date=str(d),used=None,drive_s=0,charge_s=0,covered_s=0,received_samples=0,valid_samples=0,stale_samples=0,hours=[None]*24,charge_hours=[False]*24) for d in dates}
    start=datetime.combine(dates[0],datetime.min.time(),tzinfo=tz).timestamp()
    previous=None
    # Exclusions correct inferred charging without changing measured battery energy.
    # Collector charging flags can remain true for five minutes after the last gain.
    with archive.connect() as db:
        excluded_rows = db.execute("""SELECT s.id,s.started,s.ended FROM charge_summaries s
            JOIN charge_exclusions x ON x.device=s.device AND x.event_id=s.id
            WHERE s.device=? AND x.excluded=1""", (device,)).fetchall()
    with archive.connect() as db:
        for key,body in db.execute('SELECT event_id,correction FROM charge_deletions WHERE device=?',(device,)):
            data=json.loads(body)
            excluded_rows.append((key,data['started_at'],data['ended_at']))
    excluded_ids = {row[0] for row in excluded_rows}
    excluded_windows = [(datetime.fromisoformat(a.replace('Z','+00:00')).timestamp(),
                         datetime.fromisoformat(b.replace('Z','+00:00')).timestamp()+300)
                        for _,a,b in excluded_rows]
    # A nearby retained charge must continue to show its own charging samples.
    retained_windows = []
    if excluded_windows:
        with archive.connect() as db:
            for key,a,b in db.execute('SELECT id,started,ended FROM charge_summaries WHERE device=?', (device,)):
                if key not in excluded_ids:
                    retained_windows.append((datetime.fromisoformat(a.replace('Z','+00:00')).timestamp(),
                                             datetime.fromisoformat(b.replace('Z','+00:00')).timestamp()+300))
    with archive.connect() as db:
        rows=db.execute("SELECT body FROM events WHERE device=? AND kind='state' AND observed>=? ORDER BY observed",(device,datetime.fromtimestamp(start-300,timezone.utc).isoformat().replace('+00:00','Z')))
        for (body,) in rows:
            e=archive_codec.calculation_event(body);v=e.get('data',{})
            try:
                received=datetime.fromisoformat(e['observed_at'].replace('Z','+00:00')).astimezone(tz)
                rd=days.get(str(received.date()))
                if rd is not None:
                    rd['received_samples']+=1
                    if v.get('stale'):rd['stale_samples']+=1
                stamp=(v.get('field_measured_at') or {}).get('battery_wh') or v.get('measured_at') or e['observed_at']
                t=datetime.fromisoformat(stamp.replace('Z','+00:00')).timestamp()
                energy=float(v['battery_wh']);soc=energy/(float(capacity)*1000)*100
                if not math.isfinite(soc) or not 0<=soc<=110 or v.get('stale') or t>now.timestamp():continue
            except (ValueError,TypeError,KeyError):continue
            charging=v.get('charging') in (True, 1)
            if charging and any(a<=t<=b for a,b in excluded_windows) and not any(a<=t<=b for a,b in retained_windows):
                charging=False
            local=datetime.fromtimestamp(t,tz);day=days.get(str(local.date()))
            if day is not None:
                day['valid_samples']+=1
                if charging:day['charge_hours'][local.hour]=True
                day['hours'][local.hour]={'soc':min(100,soc),'charging':charging,'driving':v.get('driving',v.get('onroad')) in (True, 1)}
            if previous and t>previous[0] and t-previous[0]<=300:
                pt,ps,pv=previous;dt=t-pt
                cursor=max(pt,start)
                while cursor<t:
                    local_start=datetime.fromtimestamp(cursor,tz)
                    midnight=datetime.combine(local_start.date()+timedelta(days=1),datetime.min.time(),tzinfo=tz).timestamp()
                    end=min(t,midnight);d=days.get(str(local_start.date()));seconds=end-cursor
                    if d is not None:
                        d['used']=(d['used'] or 0)+max(0,ps-soc)*seconds/dt
                        d['covered_s']+=seconds
                        # Session records determine driving duration independently of SOC.
                        # Session records determine charging duration independently of SOC.
                    cursor=end
            if previous is None or t>previous[0]:previous=(t,soc,v)
    for d in days.values():
        if d['used'] is not None:d['used']=round(d['used'],1)
    # Carry the last measured value only into elapsed, unmeasured hours.
    last=None
    for d in days.values():
        for h,x in enumerate(d['hours']):
            hour_start=datetime.fromisoformat(d['date']).replace(hour=h,tzinfo=tz).timestamp()
            if x is not None:
                x['last_known']=False
                last=x['soc']
            elif last is not None and hour_start<=now.timestamp():
                d['hours'][h]={'soc':last,'last_known':True,'charging':False,'driving':False}
    # Merge overlapping sessions so duplicate imports do not double count time.
    intervals={'trip':[], 'charge':[]}
    with archive.connect() as db:
        for kind,body in db.execute("SELECT kind,body FROM events WHERE device=? AND kind IN ('trip','charge')",(device,)):
            event=json.loads(body)
            if kind=='charge' and event.get('event_id') in excluded_ids:continue
            v=event.get('data',{})
            try:
                a=datetime.fromisoformat(v['started_at'].replace('Z','+00:00')).timestamp()
                b=datetime.fromisoformat(v['ended_at'].replace('Z','+00:00')).timestamp()
                a=max(a,start);b=min(b,now.timestamp())
                parts = [(a,b)] if b>a else []
                if kind == 'charge' and v.get('source') in ('can_request', 'can_actual'):
                    for gap in v.get('signal_gaps') or []:
                        ga=datetime.fromisoformat(gap['started_at'].replace('Z','+00:00')).timestamp()
                        gb=datetime.fromisoformat(gap['ended_at'].replace('Z','+00:00')).timestamp()
                        next_parts=[]
                        for pa,pb in parts:
                            if gb<=pa or ga>=pb:next_parts.append((pa,pb))
                            else:
                                if pa<ga:next_parts.append((pa,min(ga,pb)))
                                if gb<pb:next_parts.append((max(gb,pa),pb))
                        parts=next_parts
                intervals[kind].extend(parts)
            except (KeyError,ValueError,TypeError):continue
    for kind,parts in intervals.items():
        merged=[]
        for a,b in sorted(parts):
            if merged and a<=merged[-1][1]:merged[-1]=(merged[-1][0],max(b,merged[-1][1]))
            else:merged.append((a,b))
        for a,b in merged:
            while a<b:
                local=datetime.fromtimestamp(a,tz)
                end=min(b,datetime.combine(local.date()+timedelta(days=1),datetime.min.time(),tzinfo=tz).timestamp())
                d=days.get(str(local.date()))
                if d is not None:
                    d['drive_s' if kind=='trip' else 'charge_s']+=end-a
                    if kind=='charge':
                        # Any overlap counts, including a brief charge before the last sample.
                        for h in range(24):
                            hs=datetime.combine(local.date(),datetime.min.time(),tzinfo=tz)+timedelta(hours=h)
                            he=hs+timedelta(hours=1)
                            if hs.timestamp()<end and he.timestamp()>a:d['charge_hours'][h]=True
                a=end
    return list(days.values())
