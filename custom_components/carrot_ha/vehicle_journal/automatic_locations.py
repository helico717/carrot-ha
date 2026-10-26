"""Bounded background enrichment; prices and archive charge payments are untouched."""
from datetime import timedelta
import json
import time
import math
from .store import stamp,encode,now
from .stations import coordinates,distance_m,ProviderError
from ..archive_codec import loads


# 4: re-run lookups that a truncated provider response wrongly parked for 24 hours.
LOOKUP_VERSION=4
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


def save(journal,item,point,location,message,candidates=None,transient=False):
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
        current['location_lookup']={'version':LOOKUP_VERSION,'retry_after':time.time()+delay,'message':message}
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
        if not electric_vehicle(manager,journal):return
        if point:
            try:
                result=await manager.stations.nearby('charging',point['latitude'],point['longitude']);selected=result['selected'];message=result['message']
                if not selected and result.get('reason') in ('ambiguous','far'):candidates=[c['location']['name'] for c in result['candidates'][:3]] or None
            except ProviderError as error:message=str(error);transient=True
            except ValueError as error:message=str(error)
            # Whenever the station itself is not settled, keep at least the verified road address.
            if not selected:
                try:address=await manager.stations.address_location(point['latitude'],point['longitude'])
                except ValueError:address=None
                if address:message='충전소 이름을 확인하지 못해 도로명 주소로 먼저 기록했어요. '+('잠시 뒤 충전소 이름을 다시 조회할게요.' if transient else '실제 이용한 충전소를 선택하면 정확해져요.')
        if not electric_vehicle(manager,journal):return
        await hass.async_add_executor_job(save,journal,item,point,selected['location'] if selected else address,message,candidates,transient)
    await hass.async_add_executor_job(propagate,journal)
