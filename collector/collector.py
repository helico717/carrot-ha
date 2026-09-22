"""Standalone MyID4 CAN reader -> existing Cloudflare API, with durable outbox."""
import json
import os
import sys
import threading
import time
import urllib.request
import urllib.error
from pathlib import Path
from engine import Store,Engine
from telemetry_fields import device_health

BASE=Path(__file__).resolve().parent
STATE=BASE/'state'

def atomic(path,data):
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,allow_nan=False),encoding='utf-8');temp.replace(path)

def main():
    STATE.mkdir(exist_ok=True)
    config=json.loads((BASE/'connection.json').read_text())
    from urllib.parse import urlsplit
    url=urlsplit(config['url'])
    if url.scheme!='https' or not url.hostname or url.username or url.password or url.path not in ('','/') or url.query or url.fragment:raise ValueError('Invalid Worker URL')
    from openpilot.cereal import messaging
    from openpilot.common.params import Params
    import wayon_vehicle_telemetry as reference
    store=Store(STATE/'collector.sqlite3');engine=Engine(store,config['device'])
    sample_lock=threading.Lock();latest_sample={};sample_version=0
    def sample():
        nonlocal latest_sample,sample_version
        while True:
            try:
                values=reference.sample_vehicle_can(timeout_s=4)
                with sample_lock:latest_sample=values;sample_version+=1
            except Exception as error:print('CAN sample:',type(error).__name__,flush=True)
            time.sleep(26)
    def upload():
        delay=2
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self,*args,**kwargs):return None
        opener=urllib.request.build_opener(NoRedirect)
        while True:
            row=store.first()
            if not row:time.sleep(2);continue
            key,path,body=row
            try:
                request=urllib.request.Request(config['url'].rstrip('/')+path,data=body.encode(),headers={'Authorization':'Bearer '+config['token'],'User-Agent':'CarrotHA/0.3.0','Content-Type':'application/json','Accept':'application/json'})
                with opener.open(request,timeout=30) as response:ack=json.load(response)
                if ack.get('ok') is not True or (path=='/api/trips' and ack.get('id')!=json.loads(body)['id']):raise ValueError('Invalid acknowledgement')
                store.acknowledge(key);delay=2
                atomic(STATE/'delivery.json',{'status':'ok','at':time.time(),'path':path,'pending':store.count()})
            except Exception as error:
                reason=type(error).__name__+(' HTTP '+str(error.code) if isinstance(error,urllib.error.HTTPError) else '')
                atomic(STATE/'delivery.json',{'status':'retrying','reason':reason,'pending':store.count(),'at':time.time()})
                print('Upload retry:',reason,flush=True);time.sleep(delay);delay=min(120,delay*2)
    threading.Thread(target=sample,daemon=True).start();threading.Thread(target=upload,daemon=True).start()
    try:
        from param_sync import start_param_sync_thread
        start_param_sync_thread(config)
    except Exception as err:
        print('Param sync start error:', err, flush=True)
    sm=messaging.SubMaster(['carState','gpsLocationExternal','gpsLocation','peripheralState','selfdriveState','deviceState'])
    params=Params();consumed=-1;last_health=0
    print('Carrot HA collector started: receive-only CAN, Cloudflare outbox.',flush=True)
    while True:
        time.sleep(1);sm.update(0);now=time.time();mono=time.monotonic()
        if now<1735689600:continue
        gps=None
        for service in ['gpsLocationExternal','gpsLocation']:
            if sm.valid.get(service) and sm.seen.get(service) and mono-sm.recv_time[service]<10:
                g=sm[service]
                if g.hasFix:
                    gps={'latitude':float(g.latitude),'longitude':float(g.longitude),'speedMps':float(g.speed),'bearingDeg':float(g.bearingDeg),'accuracyM':float(g.horizontalAccuracy)}
                    import math
                    if not all(math.isfinite(v) for v in gps.values()) or abs(gps['latitude'])>90 or abs(gps['longitude'])>180:gps=None
                    else:break
        with sample_lock:
            sampled=dict(latest_sample) if consumed!=sample_version else None
            consumed=sample_version
        if sampled is not None and sm.valid.get('peripheralState') and mono-sm.recv_time['peripheralState']<10:
            mv=sm['peripheralState'].voltage
            if 9000<=mv<=18000:sampled['aux_voltage']=round(mv/1000,2)
        enabled=None
        if sm.valid.get('selfdriveState') and mono-sm.recv_time['selfdriveState']<10:enabled=bool(sm['selfdriveState'].enabled)
        motion=None
        if sm.valid.get('carState') and sm.seen.get('carState') and mono-sm.recv_time['carState']<2:
            car=sm['carState']
            if car.canValid:
                motion={'gear':str(car.gearShifter),'speed_mps':float(car.vEgo)}
        diagnostics = None
        if mono-last_health >= 10 and sm.seen.get('deviceState') and sm.valid.get('deviceState') and mono-sm.recv_time['deviceState'] < 10:
            try:
                diagnostics = device_health(sm['deviceState'])
            except Exception:
                diagnostics = None
            last_health = mono
        engine.tick(now,params.get_bool('IsOnroad'),gps,sampled,enabled,motion=motion,diagnostics=diagnostics)
        atomic(STATE/'status.json',{'status':'running','at':now,'onroad':engine.s['vehicle'].get('comma_onroad'),'driving':engine.s.get('onroad'),'gear':engine.s['vehicle'].get('gear'),'pending':store.count(),'can_fields':sorted((latest_sample or {}).keys()),'active_trip':bool(engine.s.get('trip'))})

if __name__=='__main__':
    import fcntl
    with (BASE/'collector.lock').open('w') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:sys.exit(0)
        main()
