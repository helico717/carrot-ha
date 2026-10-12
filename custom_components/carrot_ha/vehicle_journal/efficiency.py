"""Full-to-full recorded fuel intervals, with explicit uncertainty and weighting."""
import json
from collections import defaultdict
from .importers import numeric


def value(data,fields,name,source):
    try:return numeric(data.get(name,fields.get(source)))
    except ValueError:return None


def calculate(db,vehicle,start,end):
    by_day=defaultdict(list)
    for key,d,text in db.execute("SELECT r.id,e.accounting_date,r.extra_json FROM records r JOIN expenses e ON e.vehicle_id=r.vehicle_id AND e.record_id=r.id WHERE r.vehicle_id=? AND r.status='active' AND e.category='refueling' AND e.accounting_date<=? ORDER BY e.accounting_date,r.id",(vehicle,end)):
        extra=json.loads(text);data=extra.get('input') or {};fields=extra.get('import_source',{}).get('fields',{})
        flag=data.get('full_tank');raw=fields.get('구분','')
        if type(flag)is not bool:flag=True if '가득' in raw else False if '부분' in raw else None
        by_day[d].append({'id':key,'date':d,'full':flag,'odometer':value(data,fields,'odometer_km','누적주행거리'),'liters':value(data,fields,'fuel_liters','주유량'),'estimated':data.get('fuel_quantity_source')=='estimated','fuel':data.get('fuel_type')})
    anchor=None;pending=[];intervals=[];warnings=[]
    for d,rows in sorted(by_day.items()):
        if len(rows)>1 and any(r['full'] is not False for r in rows):
            if start<=d<=end:warnings.append({'date':d,'reason':'같은 날 가득 주유를 포함한 여러 기록의 순서를 확인할 수 없어 제외했어요.'})
            anchor=None;pending=[];continue
        for row in rows:
            if row['full'] is None:
                if start<=d<=end:warnings.append({'date':d,'reason':'가득/부분 주유 여부가 없어 구간을 계산하지 않았어요.'})
                anchor=None;pending=[];continue
            if not row['full']:
                if anchor:pending.append(row)
                continue
            if anchor:
                fuel_rows=pending+[row];liters=[r['liters'] for r in fuel_rows];a,b=anchor['odometer'],row['odometer'];fuel_types={r['fuel'] for r in [anchor]+fuel_rows if r['fuel']}
                reason=None
                if a is None or b is None:reason='가득 주유 시점의 누적거리가 없어 제외했어요.'
                elif b<=a:reason='누적거리 증가가 없어 제외했어요.'
                elif any(v is None or v<=0 for v in liters):reason='구간 안에 주유량이 없는 기록이 있어 제외했어요.'
                elif len(fuel_types)>1:reason='구간 안에 서로 다른 유종이 있어 제외했어요.'
                if reason:
                    if start<=d<=end:warnings.append({'date':d,'reason':reason})
                else:
                    qty=sum(liters);distance=b-a
                    intervals.append({'from':anchor['date'],'to':d,'distance_km':distance,'fuel_liters':qty,'efficiency_km_l':distance/qty,'partial_count':len(pending),'estimated':any(r['estimated'] for r in fuel_rows),'record_ids':[anchor['id']]+[r['id'] for r in fuel_rows]})
            anchor=row;pending=[]
    selected=[i for i in intervals if start<=i['to']<=end]
    def weighted(items):
        liters=sum(i['fuel_liters'] for i in items)
        return {'efficiency_km_l':sum(i['distance_km'] for i in items)/liters if liters else None,'distance_km':sum(i['distance_km'] for i in items),'fuel_liters':liters,'interval_count':len(items),'estimated':any(i['estimated'] for i in items)}
    return {'selected':weighted(selected),'overall':weighted(intervals),'intervals':selected,'warnings':warnings,'pending_partial_count':len(pending),'basis':'가득 주유 시점 사이 기록된 주유량 기준 · 시작 가득 주유량 제외, 종료 가득 주유량 포함'}
