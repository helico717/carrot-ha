from datetime import datetime, timezone, timedelta
from .battery import calibrated_soc

def values(runtime):
    latest = runtime.get('latest', {})
    data = dict(latest.get('data', {}))
    data.update(runtime.get('summary', {}))
    capacity = runtime['entry'].options.get('soc_capacity_kwh', 78.0)
    if data.get('battery_wh') is not None:
        data['soc_percent'] = calibrated_soc(data['battery_wh'], capacity)
        data['battery_kwh'] = round(data['battery_wh'] / 1000, 1)
    for source, target in [('measured_capacity_wh','measured_capacity_kwh'),('capacity_wh','capacity_kwh')]:
        if isinstance(data.get(source), (int,float)): data[target] = round(data[source] / 1000, 1)
    data['soc_capacity_kwh'] = round(capacity, 1)
    power_w = data.get('charge_power_w')
    if isinstance(power_w, (int, float)):
        data['charge_power_kw'] = round(power_w / 1000, 1)
    elif data.get('charge_power_kw') is not None:
        data['charge_power_kw'] = round(data['charge_power_kw'], 1)
    if isinstance(data.get('odometer_km'), (int, float)):
        data['odometer_km'] = int(round(data['odometer_km']))
    if isinstance(data.get('outside_temp_c'), (int, float)):
        data['outside_temp_c'] = round(data['outside_temp_c'], 1)
    gps = data.get('gps') or {}
    for source, target in [('latitude','latitude'),('longitude','longitude')]:
        data[target] = gps.get(source)
    data['gps_accuracy_m'] = round(gps['accuracyM'], 1) if isinstance(gps.get('accuracyM'), (int, float)) else None
    data['bearing_deg'] = int(round(gps['bearingDeg'])) if isinstance(gps.get('bearingDeg'), (int, float)) else None
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
    if data.get('onroad') is not None: data['onroad'] = bool(data['onroad'])
    try:
        from zoneinfo import ZoneInfo
        kst = ZoneInfo('Asia/Seoul')
    except Exception:
        kst = timezone(timedelta(hours=9))
    month = datetime.now(kst).strftime('%Y-%m')
    entry = (data.get('charge_months') or {}).get(month)
    if entry is not None:
        slow = round(entry.get('slow_kwh', 0), 2) if entry.get('slow_kwh') is not None else None
        fast = round(entry.get('fast_kwh', 0), 2) if entry.get('fast_kwh') is not None else None
        cost = int(round(entry.get('cost_krw', 0))) if entry.get('cost_krw') is not None else None
        total = round((entry.get('slow_kwh') or 0) + (entry.get('fast_kwh') or 0), 2)
        data.update(month_slow_kwh=slow, month_fast_kwh=fast, month_charge_cost=cost, month_charge_kwh=total)
    parking = data.get('parking') or data.get('last_trip_parking') or {}
    data.update(parking_latitude=parking.get('latitude'),parking_longitude=parking.get('longitude'),parking_at=parking.get('measured_at') or parking.get('t'))
    return data
