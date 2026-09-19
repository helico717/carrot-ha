from datetime import datetime, timezone
from .battery import calibrated_soc

def values(runtime):
    latest = runtime.get('latest', {})
    data = dict(latest.get('data', {}))
    data.update(runtime.get('summary', {}))
    capacity = runtime['entry'].options.get('soc_capacity_kwh', 78.0)
    if data.get('battery_wh') is not None:
        data['soc_percent'] = calibrated_soc(data['battery_wh'], capacity)
        data['battery_kwh'] = data['battery_wh'] / 1000
    for source, target in [('measured_capacity_wh','measured_capacity_kwh'),('capacity_wh','capacity_kwh')]:
        if isinstance(data.get(source), (int,float)): data[target] = data[source] / 1000
    data['soc_capacity_kwh'] = capacity
    gps = data.get('gps') or {}
    for source, target in [('latitude','latitude'),('longitude','longitude'),('accuracyM','gps_accuracy_m'),('bearingDeg','bearing_deg')]:
        data[target] = gps.get(source)
    speed = gps.get('speedMps')
    data['speed_kph'] = round(speed*3.6,1) if isinstance(speed,(int,float)) else None
    data['last_received'] = latest.get('observed_at')
    data['cloud_status'] = runtime.get('cloud_status','not_configured')
    data['last_sync'] = runtime.get('cloud_last_sync')
    data['measured_at'] = data.get('measured_at') or latest.get('observed_at')
    try:
        age = (datetime.now(timezone.utc)-datetime.fromisoformat(data['measured_at'].replace('Z','+00:00'))).total_seconds()
        data['measurement_age_s'] = max(0,int(age))
        data['stale'] = bool(data.get('stale')) or age > 180
    except (ValueError,TypeError,KeyError,AttributeError): data['stale'] = True
    if 'driving' in data:data['onroad']=data['driving']
    if data.get('onroad') is not None: data['onroad'] = bool(data['onroad'])
    from zoneinfo import ZoneInfo
    month = datetime.now(ZoneInfo('Asia/Seoul')).strftime('%Y-%m')
    entry = (data.get('charge_months') or {}).get(month)
    if entry is not None:
        data.update(month_slow_kwh=entry.get('slow_kwh'),month_fast_kwh=entry.get('fast_kwh'),month_charge_cost=entry.get('cost_krw'))
        data['month_charge_kwh'] = entry.get('slow_kwh',0)+entry.get('fast_kwh',0)
    parking = data.get('parking') or data.get('last_trip_parking') or {}
    data.update(parking_latitude=parking.get('latitude'),parking_longitude=parking.get('longitude'),parking_at=parking.get('measured_at') or parking.get('t'))
    return data
