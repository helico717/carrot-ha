from datetime import datetime, timezone, timedelta
from .battery import calibrated_soc, estimate_charging_times

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
        power_w = int(round(data['charge_power_kw'] * 1000))

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
    if 'driving' in data:data['onroad']=data['driving']
    if data.get('onroad') is not None: data['onroad'] = bool(data['onroad'])

    # Emergency Charging Detection (ID.4 imperfect plug connection -> ~1kW emergency charging)
    # Condition: not stale, charging, and charge_power <= 1.5kW for >= 300 seconds (5 minutes)
    power_kw = data.get('charge_power_kw')
    is_charging = bool(data.get('charging'))
    is_stale = bool(data.get('stale'))
    is_low_power = is_charging and isinstance(power_kw, (int, float)) and power_kw <= 1.5

    now_utc = datetime.now(timezone.utc)
    try:
        event_time = datetime.fromisoformat(data['measured_at'].replace('Z', '+00:00'))
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError, KeyError, AttributeError):
        event_time = now_utc

    ref_time = event_time
    if not is_stale and (now_utc - event_time).total_seconds() < 180:
        ref_time = max(event_time, now_utc)

    low_power_start = runtime.get('low_power_charging_since')
    if is_low_power:
        if low_power_start is None:
            low_power_start = event_time
            runtime['low_power_charging_since'] = low_power_start
        try:
            duration = (ref_time - low_power_start).total_seconds()
        except TypeError:
            duration = 0
        data['low_power_duration_s'] = max(0, int(duration))
        data['emergency_charging'] = bool(not is_stale and duration >= 300)
    else:
        runtime['low_power_charging_since'] = None
        data['low_power_duration_s'] = 0
        data['emergency_charging'] = False

    # Charging Time Estimation (ID.4 curve & 3-stage smoothing)
    smooth_state = runtime.get('charging_smooth_state')
    charging_est = estimate_charging_times(
        data.get('battery_kwh'),
        data.get('measured_capacity_kwh') or capacity,
        power_w,
        base_time=ref_time,
        smooth_state=smooth_state,
        is_charging=is_charging
    )
    data.update({
        'time_to_80_s': charging_est['time_to_80_s'],
        'eta_80': charging_est['eta_80'],
        'time_to_100_s': charging_est['time_to_100_s'],
        'eta_100': charging_est['eta_100']
    })
    if is_charging:
        runtime['charging_smooth_state'] = charging_est.get('smooth_state')
    else:
        runtime['charging_smooth_state'] = None
    try:
        from zoneinfo import ZoneInfo
        kst = ZoneInfo('Asia/Seoul')
    except Exception:
        kst = timezone(timedelta(hours=9))
    month = datetime.now(kst).strftime('%Y-%m')
    entry = (data.get('charge_months') or {}).get(month)
    if entry is not None:
        slow = round(entry.get('slow_kwh') or 0.0, 2)
        fast = round(entry.get('fast_kwh') or 0.0, 2)
        cost = int(round(entry.get('cost_krw') or 0))
        total = round(slow + fast, 2)
        data.update(month_slow_kwh=slow, month_fast_kwh=fast, month_charge_cost=cost, month_charge_kwh=total)
    else:
        if data.get('month_slow_kwh') is None:
            data['month_slow_kwh'] = 0.0
        if data.get('month_fast_kwh') is None:
            data['month_fast_kwh'] = 0.0
        if data.get('month_charge_cost') is None:
            data['month_charge_cost'] = 0
        if data.get('month_charge_kwh') is None:
            data['month_charge_kwh'] = 0.0
    parking = data.get('parking') or data.get('last_trip_parking') or {}
    data.update(parking_latitude=parking.get('latitude'),parking_longitude=parking.get('longitude'),parking_at=parking.get('measured_at') or parking.get('t'))
    return data
