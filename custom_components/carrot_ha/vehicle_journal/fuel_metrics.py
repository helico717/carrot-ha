"""Read-only fuel facts from preserved manual/import inputs; never infer efficiency."""
import json
from .importers import numeric


def facts(db,vehicle,start,end):
    rows=db.execute('''SELECT r.extra_json,e.accounting_date,e.category,e.actual_krw FROM records r
        LEFT JOIN expenses e ON e.vehicle_id=r.vehicle_id AND e.record_id=r.id
        WHERE r.vehicle_id=? AND r.status='active' AND e.accounting_date BETWEEN ? AND ?''',(vehicle,start,end)).fetchall()
    daily={}
    for extra_text,date,category,amount in rows:
        if category!='refueling':continue
        extra=json.loads(extra_text);fields=extra.get('import_source',{}).get('fields',{})
        try:liters=numeric((extra.get('input') or {}).get('fuel_liters',fields.get('주유량')))
        except ValueError:liters=None
        row=daily.setdefault(date,{'day':date,'fuel_liters':None,'fuel_count':0,'fuel_cost_krw':0,'priced_liters':0,'priced_cost_krw':0})
        row['fuel_count']+=1
        if amount is not None:row['fuel_cost_krw']+=amount
        if liters is not None and liters>0:
            row['fuel_liters']=(row['fuel_liters'] or 0)+liters
            if amount is not None:row['priced_liters']+=liters;row['priced_cost_krw']+=amount
    totals={'fuel_liters':sum(r['fuel_liters'] for r in daily.values() if r['fuel_liters'] is not None) if any(r['fuel_liters'] is not None for r in daily.values()) else None,'fuel_count':sum(r['fuel_count'] for r in daily.values()),'fuel_cost_krw':sum(r['fuel_cost_krw'] for r in daily.values())}
    liters=sum(r['priced_liters'] for r in daily.values());cost=sum(r['priced_cost_krw'] for r in daily.values())
    totals['fuel_price_krw_l']=cost/liters if liters>0 else None
    for row in daily.values():row['fuel_price_krw_l']=row['priced_cost_krw']/row['priced_liters'] if row['priced_liters'] else None
    return {'totals':totals,'daily':list(daily.values())}


def odometer(db,vehicle,start,end):
    points={}
    for (text,) in db.execute("SELECT extra_json FROM records WHERE vehicle_id=? AND status='active' AND json_extract(extra_json,'$.input.date')<=?",(vehicle,end)):
        extra=json.loads(text);data=extra.get('input') or {};fields=extra.get('import_source',{}).get('fields',{})
        try:value=numeric(data.get('odometer_km',fields.get('누적주행거리')))
        except ValueError:continue
        if value is None or value<0:continue
        points.setdefault(data['date'],set()).add(value)
    previous=[d for d in points if d<start];baseline=max(previous) if previous else None
    inside=sorted(d for d in points if start<=d<=end)
    fallback=False
    if not baseline and start.endswith('-01-01') and end.startswith(start[:4]) and len(inside)>=2:
        baseline=inside.pop(0);fallback=True
    result={'distance_km':None,'from':baseline,'to':inside[-1] if inside else None,'daily':[],'warning':'연초 기준 기록이 없어 해당 연도 첫 기록부터 계산했어요.' if fallback else None}
    if not baseline or not inside:
        result['warning']='이전 기간 기준 누적거리 또는 선택 기간 누적거리 기록이 없어요.';return result
    dates=[baseline]+inside
    values=[max(points[d]) for d in dates]
    if any(b<a for a,b in zip(values,values[1:])):
        result['warning']='누적거리 감소가 있어 계산하지 않았어요.';return result
    for prev_val,d in zip(values[:-1],inside):
        if any(v<prev_val for v in points[d]):
            result['warning']='누적거리 감소가 있어 계산하지 않았어요.';return result
    result['distance_km']=values[-1]-values[0]
    result['daily']=[{'day':d,'distance_km':b-a} for d,a,b in zip(inside,values,values[1:])]
    return result
