"""Persistent read-only trip/charge recorder. No openpilot imports."""
import json
import math
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta

def stamp(t): return datetime.fromtimestamp(t,timezone.utc).isoformat(timespec='seconds')
def distance(a,b):
    p1,p2=math.radians(a['latitude']),math.radians(b['latitude'])
    h=math.sin((p2-p1)/2)**2+math.cos(p1)*math.cos(p2)*math.sin(math.radians(b['longitude']-a['longitude'])/2)**2
    return 6371000*2*math.asin(min(1,math.sqrt(h)))

class Store:
    def __init__(self,path):
        self.path=str(path)
        with self.connect() as db:
            db.executescript('CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY,body TEXT); CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,path TEXT,body TEXT,created REAL);')
    @contextmanager
    def connect(self):
        db=sqlite3.connect(self.path,timeout=20)
        try:
            with db:yield db
        finally:db.close()
    def load(self):
        with self.connect() as db: row=db.execute('SELECT body FROM state WHERE id=1').fetchone()
        return json.loads(row[0]) if row else {}
    def save(self,state,events,now):
        with self.connect() as db:
            db.execute('INSERT INTO state VALUES (1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',(json.dumps(state,allow_nan=False),))
            for path,payload in events:
                identity=payload.get('id') or payload['deviceId']+'|'+payload['updatedAt']
                db.execute('INSERT OR IGNORE INTO outbox VALUES (?,?,?,?)',(identity,path,json.dumps(payload,allow_nan=False),now))
    def first(self):
        with self.connect() as db:return db.execute('SELECT id,path,body FROM outbox ORDER BY created,rowid LIMIT 1').fetchone()
    def acknowledge(self,key):
        with self.connect() as db:db.execute('DELETE FROM outbox WHERE id=?',(key,))
    def count(self):
        with self.connect() as db:return db.execute('SELECT COUNT(*) FROM outbox').fetchone()[0]

class Engine:
    def __init__(self,store,device):
        self.store,self.device=store,device
        self.s=store.load()
        self.s.setdefault('vehicle',{})
        self.s.setdefault('field_measured_at',{})
        self.s.setdefault('charge_months',{})
        self.s.setdefault('charge_sessions',[])
        self.last_saved=0
        if self.s.get('trip'):self.s['trip']['partial']=True
    def tick(self,now,onroad,gps=None,sampled=None,enabled=None):
        events=[];s=self.s;changed=onroad!=s.get('onroad');old_onroad=s.get('onroad')
        was_charging=s['vehicle'].get('charging') is True
        trip=s.get('trip')
        if onroad and not trip:
            trip=s['trip']={'id':str(uuid.uuid4()),'deviceId':self.device,'startedAt':stamp(now),'durationS':0,'distanceM':0,'route':[],'last_at':now,'partial':old_onroad is None}
        if trip and onroad:
            dt=now-trip['last_at'];trip['last_at']=now
            if 0<=dt<=20:trip['durationS']+=dt
            else:trip['partial']=True
            if gps and now-trip.get('last_point_at',0)>=5:
                point=dict(gps,t=stamp(now));previous=trip.get('last_point')
                if previous:
                    d=distance(previous,point)
                    interval=max(1,now-trip.get('last_point_at',now))
                    if d>max(100,interval*70):point=None
                    elif interval <= 20:trip['distanceM']+=d
                    else:trip['partial']=True
                if point:
                    trip['last_point'],trip['last_point_at']=point,now
                    if len(trip['route'])>=720:trip['route']=trip['route'][::2]
                    trip['route'].append(point)
        elif trip and not onroad:
            end=trip.get('last_at',now)
            payload={k:v for k,v in trip.items() if not k.startswith('last_')}
            payload.update(endedAt=stamp(end),durationS=round(trip['durationS']),distanceM=round(trip['distanceM'],1))
            if payload['distanceM']>=100 and len(payload['route'])>=2:events.append(('/api/trips',payload))
            if trip.get('last_point'):s['parking']=dict(trip['last_point'],measured_at=stamp(end))
            s['trip']=None
        if gps:
            s['gps']=dict(gps,measured_at=stamp(now))
            if not onroad:s['parking']=dict(gps,measured_at=stamp(now))
        s['onroad']=onroad
        if sampled is not None:
            for key,value in sampled.items():
                if value is not None and (not isinstance(value,float) or math.isfinite(value)):
                    s['vehicle'][key]=value;s['field_measured_at'][key]=stamp(now)
            if sampled:s['measured_at']=stamp(now)
            self._sample_energy(now, onroad, sampled.get('battery_wh'))
        # Expire state even when no new CAN sample arrives.
        candidate=s.get('charge_candidate')
        if candidate and now-candidate['ended_at']>=300:
            s.pop('charge_candidate',None)
        if s.get('charge') and (onroad or now-s.get('last_charge_increase',now)>=300):
            s['charge_sessions'].append(s.pop('charge'))
            s['charge_sessions']=s['charge_sessions'][-50:]
        measured=s.get('field_measured_at',{}).get('battery_wh')
        fresh=measured is not None and 0<=now-datetime.fromisoformat(measured).timestamp()<=120
        if onroad:
            s.pop('charge_candidate',None)
            if not old_onroad:s.pop('energy_sample',None)
            s['vehicle'].update(charging=False,charge_power_w=0)
        elif not fresh:
            s['vehicle'].update(charging=None,charge_power_w=None)
        else:
            s['vehicle']['charging']=bool(s.get('charge'))
        charging_started=s['vehicle'].get('charging') is True and not was_charging
        interval=30 if onroad or s['vehicle'].get('charging') is True else 60
        if changed or charging_started or now-s.get('last_upload',0)>=interval:
            vehicle=dict(s['vehicle'])
            measured=s['field_measured_at'].get('battery_wh') or s.get('measured_at')
            age=now-datetime.fromisoformat(measured).timestamp() if measured else 999999
            vehicle.update(field_measured_at=s['field_measured_at'],measured_at=measured,stale=age>120,charge_months=s['charge_months'],charge_sessions=s['charge_sessions'],parking=s.get('parking'))
            if vehicle.get('battery_wh') is not None:vehicle.update(capacity_wh=78000,soc_percent=min(100,vehicle['battery_wh']/780))
            events.append(('/api/telemetry',{'deviceId':self.device,'updatedAt':stamp(now),'onroad':int(onroad),'ignition':int(onroad),'enabled':enabled,'gps':s.get('gps') or {},'vehicle':vehicle}))
            s['last_upload']=now
        if events or now-self.last_saved>=5:
            self.store.save(s,events,now);self.last_saved=now
        return events

    def _sample_energy(self, now, onroad, wh):
        """Validate non-overlapping energy windows before committing charge totals.

        100 Wh confirms in one window; two consecutive positive windows totalling
        at least 50 Wh confirm a small increase. These are heuristic thresholds,
        not a charger connection signal. Keep the existing 90-240 second window.
        """
        if not isinstance(wh,(int,float)) or not math.isfinite(wh) or wh<=0:
            return
        s=self.s
        prev=s.get('energy_sample')
        if onroad or not prev or prev['onroad']!=onroad or not 0<=now-prev['at']<=240:
            s['energy_sample']={'wh':wh,'at':now,'onroad':onroad}
            s.pop('charge_candidate',None)
            s['vehicle']['charge_power_w']=0 if onroad else None
            if s.get('charge'):s['charge']['partial']=True
            return
        dt=now-prev['at']
        if dt<90:return
        delta=wh-prev['wh']
        estimate=delta*3600/dt
        s['energy_sample']={'wh':wh,'at':now,'onroad':onroad}
        s['vehicle']['charge_power_w']=round(estimate) if 300<=estimate<=250000 else 0
        if not 300<=estimate<=250000:
            s.pop('charge_candidate',None)
            if estimate>250000 and s.get('charge'):s['charge']['partial']=True
            return
        window={'started_at':prev['at'],'ended_at':now,'delta':delta,'dt':dt,'power':estimate}
        if s.get('charge'):
            windows=[window]
        else:
            candidate=s.get('charge_candidate')
            windows=candidate['windows']+[window] if candidate and candidate['ended_at']==prev['at'] else [window]
            s['charge_candidate']={'windows':windows,'ended_at':now}
            if delta<100 and not (len(windows)>=2 and sum(w['delta'] for w in windows)>=50):
                return
            s['charge']={'id':str(uuid.uuid4()),'started_at':stamp(windows[0]['started_at']),
                         'energy_kwh':0,'duration_s':0,'partial':False}
            s.pop('charge_candidate',None)
        for w in windows:
            month=datetime.fromtimestamp(w['ended_at'],timezone(timedelta(hours=9))).strftime('%Y-%m')
            ledger=s['charge_months'].setdefault(month,{'slow_kwh':0,'fast_kwh':0,'cost_krw':0})
            kind='slow' if w['power']<=11000 else 'fast'
            ledger[kind+'_kwh']+=w['delta']/1000
            ledger['cost_krw']+=w['delta']/1000*(280 if kind=='slow' else 320)
            s['charge']['energy_kwh']+=w['delta']/1000
            s['charge']['duration_s']+=w['dt']
        s['charge']['ended_at']=stamp(now)
        s['last_charge_increase']=now
