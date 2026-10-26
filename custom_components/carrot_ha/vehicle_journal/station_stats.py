"""Rebuildable per-place statistics from immutable quantities and location overlays."""
import json
from .efficiency import value


def facts(db,vehicle,start,end):
    groups={};unlocated=0;accounted=set()
    rows=db.execute("SELECT r.id,r.extra_json,e.category,e.actual_krw,e.estimated_krw FROM records r JOIN expenses e ON e.vehicle_id=r.vehicle_id AND e.record_id=r.id WHERE r.vehicle_id=? AND r.status='active' AND e.category IN ('charging','refueling') AND e.accounting_date BETWEEN ? AND ?",(vehicle,start,end))
    for rid,text,kind,actual,estimated in rows:
        extra=json.loads(text);data=extra.get('input') or {};location=extra.get('location',data.get('location'));fields=extra.get('import_source',{}).get('fields',{})
        if not location or not (location.get('name') or location.get('latitude') is not None):unlocated+=1;continue
        # Name-only imports remain separate until the user identifies an actual place.
        if location.get('provider') and location.get('station_id'):identity=location['provider']+':'+location['station_id']
        elif location.get('selection_source')=='automatic_address' and location.get('address') and location.get('latitude') is not None:identity='address:'+location['address']
        elif location.get('latitude') is not None:identity=f"coordinate:{location['latitude']:.5f}:{location['longitude']:.5f}"
        else:identity='unresolved:'+rid
        group=groups.setdefault((kind,identity),{'id':identity,'kind':kind,'location':location,'resolved':not identity.startswith('unresolved:'),'visits':0,'actual_krw':0,'estimated_krw':0,'fuel_liters':0,'billed_kwh':0,'battery_kwh':0,'fuel_priced_liters':0,'fuel_priced_cost':0,'billed_priced_kwh':0,'billed_priced_cost':0,'battery_priced_kwh':0,'battery_priced_cost':0,'unknown_quantity_count':0})
        group['address_only']=identity.startswith('address:')
        members_ids=[r[0] for r in db.execute('SELECT charge_id FROM expense_members WHERE vehicle_id=? AND expense_id=?',(vehicle,rid))];accounted.update(members_ids)
        group['visits']+=len(members_ids) or 1;group['actual_krw']+=actual or 0;group['estimated_krw']+=estimated or 0;cost=actual if actual is not None else estimated
        if kind=='refueling':
            qty=value(data,fields,'fuel_liters','주유량');basis='fuel'
        else:
            qty=value(data,fields,'billed_charge_kwh','충전량');basis='billed'
            if qty is None:
                members=db.execute("SELECT m.battery_charge_kwh FROM expense_members x JOIN mobility m ON m.vehicle_id=x.vehicle_id AND m.record_id=x.charge_id JOIN records r ON r.vehicle_id=m.vehicle_id AND r.id=m.record_id WHERE x.vehicle_id=? AND x.expense_id=? AND r.status='active'",(vehicle,rid)).fetchall()
                qty=sum(r[0] for r in members) if members and all(r[0] is not None for r in members) else None;basis='battery'
        if qty is None or qty<=0:group['unknown_quantity_count']+=1;continue
        group[{'fuel':'fuel_liters','billed':'billed_kwh','battery':'battery_kwh'}[basis]]+=qty
        if cost is not None:group[basis+'_priced_cost']+=cost;group[basis+('_priced_liters' if basis=='fuel' else '_priced_kwh')]+=qty
    # Sessions at different places must retain visit/quantity statistics even if a
    # single original payment group cannot be attributed to one place safely.
    for rid,text,started,battery,billed in db.execute("SELECT r.id,r.extra_json,m.started_at,m.battery_charge_kwh,m.billed_charge_kwh FROM records r JOIN mobility m ON m.vehicle_id=r.vehicle_id AND m.record_id=r.id WHERE r.vehicle_id=? AND r.kind='charge' AND r.status='active'",(vehicle,)):
        from .store import stamp
        from zoneinfo import ZoneInfo
        timezone=db.execute('SELECT accounting_timezone FROM vehicles WHERE id=?',(vehicle,)).fetchone()[0]
        if rid in accounted or not start<=stamp(started).astimezone(ZoneInfo(timezone)).date().isoformat()<=end:continue
        extra=json.loads(text);location=extra.get('location',(extra.get('input') or {}).get('location'))
        if not location:continue
        if location.get('station_id'):identity=location.get('provider','manual')+':'+location['station_id']
        elif location.get('selection_source')=='automatic_address' and location.get('address') and location.get('latitude') is not None:identity='address:'+location['address']
        else:continue
        g=groups.setdefault(('charging',identity),{'id':identity,'kind':'charging','location':location,'resolved':True,'visits':0,'actual_krw':0,'estimated_krw':0,'fuel_liters':0,'billed_kwh':0,'battery_kwh':0,'fuel_priced_liters':0,'fuel_priced_cost':0,'billed_priced_kwh':0,'billed_priced_cost':0,'battery_priced_kwh':0,'battery_priced_cost':0,'unknown_quantity_count':0})
        g['address_only']=identity.startswith('address:');g['visits']+=1
        if billed is not None:g['billed_kwh']+=billed
        elif battery is not None:g['battery_kwh']+=battery
        else:g['unknown_quantity_count']+=1
    for g in groups.values():
        for basis in ('fuel','billed','battery'):
            divisor=g[basis+('_priced_liters' if basis=='fuel' else '_priced_kwh')]
            g[basis+'_average_krw']=g[basis+'_priced_cost']/divisor if divisor else None
    return {'from':start,'to':end,'places':list(groups.values()),'unlocated_records':unlocated,'basis':'금액과 수량이 함께 있는 기록의 합계로 가중 평균 · 청구 kWh와 배터리 추정 kWh 분리'}
