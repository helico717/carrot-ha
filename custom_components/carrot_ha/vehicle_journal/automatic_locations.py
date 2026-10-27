"""Bounded background enrichment; prices and archive charge payments are untouched."""
from datetime import timedelta
import json
import time
import math
from .store import stamp,encode,now
from .stations import coordinates,distance_m,ProviderError
from ..archive_codec import loads


# 4: re-run lookups that a truncated provider response wrongly parked for 24 hours.
# 5: store a reason code, step results and evidence so failures can be explained in the ledger.
LOOKUP_VERSION=5
RETRY_DAY=86400
RETRY_TRANSIENT=900

def provisional(place,lookup):
    """Road address saved while the provider was failing; replaced by the station once a lookup succeeds."""
    return bool(place and place.get('selection_source')=='automatic_address' and lookup.get('failures'))


def pending(journal):
    with journal.connect() as db:
        rows=db.execute("SELECT r.id,r.version,r.extra_json,m.started_at FROM records r JOIN mobility m ON m.vehicle_id=r.vehicle_id AND m.record_id=r.id WHERE r.vehicle_id=? AND r.kind='charge' AND r.origin='automatic' AND r.status='active' ORDER BY m.started_at DESC",(journal.vehicle,)).fetchall()
        result=[]
        for key,version,text,started in rows:
            extra=json.loads(text)
            lookup=extra.get('location_lookup',{})
            if extra.get('location_user_override') or ('location' in extra and not provisional(extra.get('location'),lookup)):continue
            if lookup.get('version')==LOOKUP_VERSION and lookup.get('retry_after',0)>time.time():continue
            result.append((key,version,extra,started))
            if len(result)==3:break
        return result


def stationary_gps(data,observed):
    """Validate an original fix, never a receipt timestamp substituted for GPS time."""
    gps=data.get('gps') or {}
    try:
        coordinates(gps.get('latitude'),gps.get('longitude'))
        measured=stamp(gps.get('measured_at') or (data.get('field_measured_at') or {}).get('gps'))
        accuracy=gps.get('accuracyM');speed=gps.get('speedMps')
        if accuracy is not None and (type(accuracy) not in (int,float) or not math.isfinite(accuracy) or not 0<=accuracy<=100):return None
        if speed is not None and (type(speed) not in (int,float) or not math.isfinite(speed) or not 0<=speed<=1):return None
        if gps.get('fresh') is False or data.get('onroad') is True:return None
        if abs((stamp(observed)-measured).total_seconds())>60:return None
    except (ValueError,TypeError,AttributeError):return None
    return measured,{'latitude':gps['latitude'],'longitude':gps['longitude'],'observed_at':observed,'gps_measured_at':measured.isoformat(),'accuracy_m':accuracy,'basis':'charge_start_fresh_stationary_gps'}


def parked_until_start(samples,index,start,point):
    """Require continuous stopped telemetry; stale repeated GPS alone does not prove no motion."""
    previous=stamp(samples[index][0]);last=previous
    for observed,data in samples[index:]:
        receipt=stamp(observed)
        if receipt>start+timedelta(seconds=60):break
        if (receipt-previous).total_seconds()>90:return False
        previous=receipt;last=receipt
        # Missing/unknown driving state cannot establish continuity.
        if data.get('onroad') is not False:return False
        vehicle=data.get('vehicle') or {}
        wheel=vehicle.get('wheel_speed_mps')
        if wheel is not None and (type(wheel) not in (int,float) or not math.isfinite(wheel) or not 0<=wheel<=1):return False
        gps=data.get('gps') or {}
        try:
            coordinates(gps.get('latitude'),gps.get('longitude'))
            speed=gps.get('speedMps');accuracy=gps.get('accuracyM')
            if speed is None or type(speed) not in (int,float) or not math.isfinite(speed) or not 0<=speed<=1:return False
            if accuracy is None or type(accuracy) not in (int,float) or not math.isfinite(accuracy) or not 0<=accuracy<=50:return False
            measured=stamp(gps.get('measured_at') or (data.get('field_measured_at') or {}).get('gps'))
            if measured>receipt+timedelta(seconds=60) or measured<stamp(point['gps_measured_at']):return False
            if distance_m(point['latitude'],point['longitude'],gps['latitude'],gps['longitude'])>30:return False
        except (ValueError,TypeError,AttributeError):return False
    return abs((last-start).total_seconds())<=90


def position(archive,journal,started):
    start=stamp(started);low=(start-timedelta(minutes=10)).isoformat();high=(start+timedelta(minutes=2)).isoformat()
    with archive.connect() as db:
        rows=db.execute("SELECT observed,body FROM events WHERE device=? AND kind='state' AND observed BETWEEN ? AND ? ORDER BY observed DESC LIMIT 2001",(journal.device,low,high)).fetchall()
    # Never infer parking continuity across a truncated sample window.
    complete=len(rows)<=2000
    samples=[(observed,loads(body).get('data',{})) for observed,body in reversed(rows)]
    fresh=[];parked=[]
    for index,(observed,data) in enumerate(samples):
        candidate=stationary_gps(data,observed)
        if not candidate:continue
        measured,point=candidate;gap=(start-measured).total_seconds()
        if abs(gap)<=120:fresh.append((abs(gap),point));continue
        if not complete or not 120<gap<=600 or data.get('onroad') is not False:continue
        if point['accuracy_m'] is None or point['accuracy_m']>50:continue
        if parked_until_start(samples,index,start,point):
            point['basis']='charge_start_verified_parked_gps'
            parked.append((gap,point))
    candidates=fresh or parked
    return min(candidates,key=lambda p:p[0])[1] if candidates else None


def finite(value):
    return type(value) in (int,float) and math.isfinite(value)


def gps_diagnosis(archive,journal,started):
    """Why no charge-start GPS qualified: the fix nearest the start and the first rule it broke.

    Debugging aid only; position() stays the single rule for using a fix."""
    start=stamp(started);low=(start-timedelta(minutes=10)).isoformat();high=(start+timedelta(minutes=2)).isoformat()
    with archive.connect() as db:
        rows=db.execute("SELECT observed,body FROM events WHERE device=? AND kind='state' AND observed BETWEEN ? AND ? ORDER BY observed DESC LIMIT 2001",(journal.device,low,high)).fetchall()
    samples=[(observed,loads(body).get('data',{})) for observed,body in reversed(rows)]
    fixes=[]
    for observed,data in samples:
        gps=data.get('gps') or {}
        try:
            coordinates(gps.get('latitude'),gps.get('longitude'))
            measured=stamp(gps.get('measured_at') or (data.get('field_measured_at') or {}).get('gps') or observed)
        except (ValueError,TypeError,AttributeError):continue
        fixes.append((observed,data,gps,measured))
    evidence={'samples':len(samples),'gps_samples':len(fixes)}
    if not samples:return 'gps_no_samples',evidence
    if not fixes:return 'gps_missing',evidence
    observed,data,gps,measured=min(fixes,key=lambda f:abs((f[3]-start).total_seconds()))
    gap=(measured-start).total_seconds();lag=(stamp(observed)-measured).total_seconds()
    accuracy=gps.get('accuracyM');speed=gps.get('speedMps');wheel=(data.get('vehicle') or {}).get('wheel_speed_mps')
    evidence.update({'nearest_gap_s':round(gap),'measured_lag_s':round(lag),'onroad':data.get('onroad')})
    if finite(accuracy):evidence['accuracy_m']=round(accuracy)
    if finite(speed):evidence['speed_mps']=round(speed,1)
    def exceeds(value,limit):return value is not None and not (finite(value) and 0<=value<=limit)
    if data.get('onroad') is True or exceeds(speed,1) or exceeds(wheel,1):code='gps_moving'
    elif exceeds(accuracy,100) or (abs(gap)>120 and exceeds(accuracy,50)):code='gps_inaccurate'
    elif gps.get('fresh') is False or abs(lag)>60 or not -600<=gap<=120:code='gps_stale'
    else:code='gps_parking_unverified'
    if code=='gps_parking_unverified':
        times=[stamp(o) for o,_ in samples if stamp(observed)<=stamp(o)<=start+timedelta(seconds=60)]
        evidence['continuity_gap_s']=round(max([(b-a).total_seconds() for a,b in zip(times,times[1:])] or [0]))
    return code,evidence


def point_evidence(point,started):
    evidence={'basis':point.get('basis'),'latitude':round(point['latitude'],5),'longitude':round(point['longitude'],5)}
    if finite(point.get('accuracy_m')):evidence['accuracy_m']=round(point['accuracy_m'])
    try:evidence['nearest_gap_s']=round((stamp(point['gps_measured_at'])-stamp(started)).total_seconds())
    except (KeyError,ValueError,TypeError):pass
    return {k:v for k,v in evidence.items() if v is not None}


def save(journal,item,point,location,message,candidates=None,transient=False,diagnostic=None):
    key,version,extra,_=item
    with journal.lock,journal.connect() as db:
        row=db.execute('SELECT version,extra_json FROM records WHERE vehicle_id=? AND id=?',(journal.vehicle,key)).fetchone()
        if not row or row[0]!=version:return False
        current=json.loads(row[1])
        previous=current.get('location_lookup',{})
        if current.get('location_user_override') or ('location' in current and not provisional(current.get('location'),previous)):return False
        if point:current['source_position']=point
        # Provider/transport failures are not a lookup result: back off from 15 minutes up to a day.
        failures=(previous.get('failures',0) if previous.get('version')==LOOKUP_VERSION else 0)+1 if transient else 0
        delay=min(RETRY_DAY,RETRY_TRANSIENT*2**(failures-1)) if transient else RETRY_DAY
        attempts=(previous.get('attempts',0) if previous.get('version')==LOOKUP_VERSION else 0)+1
        current['location_lookup']={**(diagnostic or {}),'version':LOOKUP_VERSION,'retry_after':time.time()+delay,'message':message,'attempted_at':time.time(),'attempts':attempts}
        if transient:current['location_lookup']['failures']=failures
        if candidates:current['location_lookup']['candidates']=candidates
        if location:journal.validate_location(location);current['location']=location
        db.execute('UPDATE records SET extra_json=?,version=version+1,updated_at=? WHERE vehicle_id=? AND id=?',(encode(current),now(),journal.vehicle,key))
        return True


def identity(place):
    if place.get('station_id'):return (place.get('provider'),place['station_id'])
    if place.get('selection_source')=='automatic_address' and place.get('address'):return ('address',place['address'])


def propagate(journal):
    with journal.lock,journal.connect() as db:
        for expense, in db.execute("SELECT DISTINCT x.expense_id FROM expense_members x JOIN records r ON r.vehicle_id=x.vehicle_id AND r.id=x.expense_id WHERE x.vehicle_id=? AND r.status='active'",(journal.vehicle,)).fetchall():
            row=db.execute('SELECT extra_json FROM records WHERE vehicle_id=? AND id=?',(journal.vehicle,expense)).fetchone();extra=json.loads(row[0])
            if extra.get('location_user_override') or extra.get('journal_override'):continue
            locations=[json.loads(r[0]).get('location') for r in db.execute('SELECT r.extra_json FROM expense_members x JOIN records r ON r.vehicle_id=x.vehicle_id AND r.id=x.charge_id WHERE x.vehicle_id=? AND x.expense_id=?',(journal.vehicle,expense))]
            ids={identity(p) for p in locations if p and identity(p)}
            if len(ids)!=1 or not locations or any(not p or not identity(p) for p in locations):
                if (extra.get('location') or {}).get('selection_source') in ('automatic','automatic_address'):
                    extra.pop('location',None)
                    db.execute('UPDATE records SET extra_json=?,version=version+1,updated_at=? WHERE vehicle_id=? AND id=?',(encode(extra),now(),journal.vehicle,expense))
                continue
            if extra.get('location')==locations[0]:continue
            extra['location']=locations[0]
            db.execute('UPDATE records SET extra_json=?,version=version+1,updated_at=? WHERE vehicle_id=? AND id=?',(encode(extra),now(),journal.vehicle,expense))


DIAGNOSTIC_FIELDS=('code','steps','evidence','station_code','address_reason','provider','attempted_at','attempts','failures','retry_after','message')


def describe(extra,started):
    """Ledger-facing explanation of why an automatic charge has no settled station; None when nothing to explain."""
    place=extra.get('location') or {}
    if extra.get('location_user_override') or place.get('station_id'):return None
    address=place.get('selection_source')=='automatic_address'
    if place and not address:return None
    lookup=extra.get('location_lookup') or {}
    if not lookup:return {'charge_started_at':started,'state':'pending','code':'pending'}
    result={'charge_started_at':started,'lookup_version':lookup.get('version'),**{k:lookup[k] for k in DIAGNOSTIC_FIELDS if k in lookup}}
    if result.setdefault('code','legacy')=='station_selected':return None
    if 'candidates' in lookup:result['candidates']=[c if isinstance(c,dict) else {'name':str(c)} for c in lookup['candidates']]
    result['state']='address' if address else 'failed'
    result['provisional']=bool(address and lookup.get('failures'))
    # A road address saved from a final station result is never looked up again.
    if address and not result['provisional']:result['retry_after']=None
    return result


def diagnostics(db,vehicle,rows):
    """Attach location_diagnostic to charging expense rows from their linked automatic charges (one batched read)."""
    targets={r['id']:r for r in rows if r.get('kind')=='expense' and r.get('category')=='charging' and not (r.get('location') or {}).get('station_id')}
    if not targets:return
    linked={}
    for expense,text,started in db.execute(f"""SELECT x.expense_id,r.extra_json,m.started_at FROM expense_members x
            JOIN records r ON r.vehicle_id=x.vehicle_id AND r.id=x.charge_id
            LEFT JOIN mobility m ON m.vehicle_id=r.vehicle_id AND m.record_id=r.id
            WHERE x.vehicle_id=? AND r.origin='automatic' AND r.status='active' AND x.expense_id IN ({','.join('?'*len(targets))})
            ORDER BY m.started_at""",(vehicle,*targets)):
        linked.setdefault(expense,[]).append((json.loads(text),started))
    for key,row in targets.items():
        for extra,started in linked.get(key,[]):
            found=describe(extra,started)
            if found:row['location_diagnostic']=found;break


def setup_issue(manager,journal):
    """Why lookups are not running at all for this vehicle; reported instead of an endless 'pending'."""
    if not manager.automatic_locations:return 'disabled'
    if not manager.kakao_rest_key:return 'no_kakao_key'
    if not electric_vehicle(manager,journal):return 'not_electric'


def electric_vehicle(manager,journal):
    # Use the same resolved fuel shown in vehicle settings (linked EV default included).
    return any(entry.get('vehicle_id')==journal.vehicle and entry.get('fuel')=='electric'
               for entry in manager.entries())


async def enrich(hass,manager,archive,journal):
    if not manager.automatic_locations or not manager.kakao_rest_key:return
    if not electric_vehicle(manager,journal):return
    for item in await hass.async_add_executor_job(pending,journal):
        point=await hass.async_add_executor_job(position,archive,journal,item[3])
        selected=None;candidates=None;address=None;transient=False;message='충전 시작 부근의 신선한 정차 GPS 또는 이동 없음이 확인된 주차 GPS가 없어 장소를 자동 선택하지 않았어요.'
        steps={'gps':'fail','station':'skip','address':'skip'};diagnostic={'steps':steps}
        if not electric_vehicle(manager,journal):return
        if point:
            steps['gps']='ok';diagnostic['evidence']=point_evidence(point,item[3]);code=None
            try:
                result=await manager.stations.nearby('charging',point['latitude'],point['longitude']);selected=result['selected'];message=result['message']
                if not selected:
                    code='station_'+(result.get('reason') or 'none')
                    candidates=[{'name':c['location']['name'],'distance_m':round(c['distance_m'])} for c in result['candidates'][:3]] or None
            except ProviderError as error:message=str(error);transient=True;code='provider_error';diagnostic['provider']=message
            except ValueError as error:message=str(error);code='provider_error';diagnostic['provider']=message
            if selected:steps['station']='ok';diagnostic['code']='station_selected'
            # Whenever the station itself is not settled, keep at least the verified road address.
            else:
                steps['station']='fail' if code=='provider_error' else 'warn'
                try:address,reason,extra=await manager.stations.address_lookup(point['latitude'],point['longitude'])
                except ProviderError:address,reason,extra=None,'error',{};transient=True
                except ValueError:address,reason,extra=None,'error',{}
                if address:
                    steps['address']='ok';diagnostic['code']=code
                    message='충전소 이름을 확인하지 못해 도로명 주소로 먼저 기록했어요. '+('잠시 뒤 충전소 이름을 다시 조회할게요.' if transient else '실제 이용한 충전소를 선택하면 정확해져요.')
                else:
                    steps['address']='fail';diagnostic.update(code='address_failed',station_code=code,address_reason=reason);diagnostic['evidence'].update(extra)
        else:
            code,evidence=await hass.async_add_executor_job(gps_diagnosis,archive,journal,item[3])
            diagnostic.update(code=code,evidence=evidence)
        if not electric_vehicle(manager,journal):return
        await hass.async_add_executor_job(save,journal,item,point,selected['location'] if selected else address,message,candidates,transient,diagnostic)
    await hass.async_add_executor_job(propagate,journal)
