"""Bounded background enrichment; prices and archive charge payments are untouched."""
from datetime import timedelta
import json
import time
import math
from .store import stamp,encode,now
from .stations import coordinates
from ..archive_codec import loads


def pending(journal):
    with journal.connect() as db:
        rows=db.execute("SELECT r.id,r.version,r.extra_json,m.started_at FROM records r JOIN mobility m ON m.vehicle_id=r.vehicle_id AND m.record_id=r.id WHERE r.vehicle_id=? AND r.kind='charge' AND r.origin='automatic' AND r.status='active' ORDER BY m.started_at DESC",(journal.vehicle,)).fetchall()
        result=[]
        for key,version,text,started in rows:
            extra=json.loads(text)
            if extra.get('location_user_override') or 'location' in extra or extra.get('location_lookup',{}).get('retry_after',0)>time.time():continue
            result.append((key,version,extra,started))
            if len(result)==3:break
        return result


def position(archive,journal,started):
    start=stamp(started);low=(start-timedelta(minutes=10)).isoformat();high=(start+timedelta(minutes=10)).isoformat()
    with archive.connect() as db:
        rows=db.execute("SELECT observed,body FROM events WHERE device=? AND kind='state' AND observed BETWEEN ? AND ? ORDER BY observed DESC LIMIT 100",(journal.device,low,high)).fetchall()
    candidates=[]
    for observed,body in rows:
        data=loads(body).get('data',{});gps=data.get('gps') or {};lat,lon=gps.get('latitude'),gps.get('longitude')
        try:coordinates(lat,lon)
        except ValueError:continue
        accuracy=gps.get('accuracyM')
        if accuracy is not None and (type(accuracy) not in (int,float) or not math.isfinite(accuracy) or not 0<=accuracy<=100):continue
        measured=gps.get('measured_at') or (data.get('field_measured_at') or {}).get('gps')
        if not measured or gps.get('fresh') is False or data.get('onroad') is True:continue
        try:
            measurement=stamp(measured);receipt=stamp(observed)
            if abs((measurement-receipt).total_seconds())>60 or abs((measurement-start).total_seconds())>120:continue
            speed=gps.get('speedMps')
            if speed is not None and (type(speed) not in (int,float) or not math.isfinite(speed) or speed>1):continue
        except (ValueError,TypeError):continue
        candidates.append((abs((measurement-start).total_seconds()),{'latitude':lat,'longitude':lon,'observed_at':observed,'gps_measured_at':measured,'accuracy_m':accuracy,'basis':'charge_start_fresh_stationary_gps'}))

    return min(candidates,key=lambda p:p[0])[1] if candidates else None


def save(journal,item,point,location,message):
    key,version,extra,_=item
    with journal.lock,journal.connect() as db:
        row=db.execute('SELECT version,extra_json FROM records WHERE vehicle_id=? AND id=?',(journal.vehicle,key)).fetchone()
        if not row or row[0]!=version:return False
        current=json.loads(row[1])
        if 'location' in current or current.get('location_user_override'):return False
        if point:current['source_position']=point
        current['location_lookup']={'retry_after':time.time()+86400,'message':message}
        if location:journal.validate_location(location);current['location']=location
        db.execute('UPDATE records SET extra_json=?,version=version+1,updated_at=? WHERE vehicle_id=? AND id=?',(encode(current),now(),journal.vehicle,key))
        return True


def propagate(journal):
    with journal.lock,journal.connect() as db:
        for expense, in db.execute("SELECT DISTINCT x.expense_id FROM expense_members x JOIN records r ON r.vehicle_id=x.vehicle_id AND r.id=x.expense_id WHERE x.vehicle_id=? AND r.status='active'",(journal.vehicle,)).fetchall():
            row=db.execute('SELECT extra_json FROM records WHERE vehicle_id=? AND id=?',(journal.vehicle,expense)).fetchone();extra=json.loads(row[0])
            if extra.get('location_user_override') or extra.get('journal_override'):continue
            locations=[json.loads(r[0]).get('location') for r in db.execute('SELECT r.extra_json FROM expense_members x JOIN records r ON r.vehicle_id=x.vehicle_id AND r.id=x.charge_id WHERE x.vehicle_id=? AND x.expense_id=?',(journal.vehicle,expense))]
            ids={(p.get('provider'),p.get('station_id')) for p in locations if p and p.get('station_id')}
            if len(ids)!=1 or not locations or any(not p or not p.get('station_id') for p in locations):
                if (extra.get('location') or {}).get('selection_source')=='automatic':
                    extra.pop('location',None)
                    db.execute('UPDATE records SET extra_json=?,version=version+1,updated_at=? WHERE vehicle_id=? AND id=?',(encode(extra),now(),journal.vehicle,expense))
                continue
            if extra.get('location')==locations[0]:continue
            extra['location']=locations[0]
            db.execute('UPDATE records SET extra_json=?,version=version+1,updated_at=? WHERE vehicle_id=? AND id=?',(encode(extra),now(),journal.vehicle,expense))


async def enrich(hass,manager,archive,journal):
    if not manager.automatic_locations or not manager.kakao_rest_key:return
    for item in await hass.async_add_executor_job(pending,journal):
        point=await hass.async_add_executor_job(position,archive,journal,item[3])
        selected=None;message='충전 시작 2분 이내의 신선한 정차 GPS가 없어 장소를 자동 선택하지 않았어요.'
        if point:
            try:
                result=await manager.stations.nearby('charging',point['latitude'],point['longitude']);selected=result['selected'];message=result['message']
            except ValueError as error:message=str(error)
        await hass.async_add_executor_job(save,journal,item,point,selected['location'] if selected else None,message)
    await hass.async_add_executor_job(propagate,journal)
