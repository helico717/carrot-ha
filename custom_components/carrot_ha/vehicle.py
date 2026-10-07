from .battery import DEFAULT_SOC_CAPACITY_KWH, MEB_INVALID_ENERGY_WH
from datetime import datetime, timezone, timedelta
from .battery import calibrated_soc, estimate_charging_times
from .charging_power import charging_power
from .telemetry import combined_lock_state
import math
from .telemetry import OPTIONAL_FIELDS, FRESHNESS_SECONDS

def values(runtime):
    latest = runtime.get('latest', {})
    data = dict(latest.get('data', {}))
    data.update(runtime.get('summary', {}))
    if data.get('battery_wh') in MEB_INVALID_ENERGY_WH:
        data.update(battery_wh=None, soc_percent=None, charge_power_w=None,
                    charge_power_kw=None, charging=None)
    capacity = runtime['entry'].options.get('soc_capacity_kwh', DEFAULT_SOC_CAPACITY_KWH)
    if type(data.get('battery_wh')) in (int, float) and math.isfinite(data['battery_wh']) and data['battery_wh'] >= 0:
        data['soc_percent'] = calibrated_soc(data['battery_wh'], capacity)
        data['battery_kwh'] = round(data['battery_wh'] / 1000, 1)
    else:
        data['battery_kwh'] = None
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
    wheel_speed = data.get('wheel_speed_mps')
    data['wheel_speed_kph'] = round(wheel_speed*3.6,1) if isinstance(wheel_speed,(int,float)) else None
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

    from .charging_mode import charging_mode
    charge_signal = charging_mode(data, datetime.now(timezone.utc))
    data.update(charging=charge_signal['charging'], charge_mode=charge_signal['mode'],
                charge_mode_evidence=charge_signal, charge_state_source='can_actual' if charge_signal['source_kind']=='actual' else 'can_request')
    data['doors_locked'] = combined_lock_state(data)
    power_w = charging_power(data, runtime, datetime.now(timezone.utc))

    # Emergency Charging Detection (ID.4 imperfect plug connection -> ~1kW emergency charging)
    # Condition: not stale, charging, and charge_power <= 1.5kW for >= 300 seconds (5 minutes)
    # Display holding must not create evidence for the low-power alarm.
    raw_power = data.get('charge_power_raw_w')
    power_kw = raw_power / 1000 if type(raw_power) in (int, float) else None
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

    # Real-time charging session energy & cost (280 KRW/kWh slow <=11kW, 320 KRW/kWh fast >11kW)
    battery_wh = data.get('battery_wh')
    if is_charging and type(battery_wh) in (int, float) and battery_wh > 0:
        session_start_wh = runtime.get('charge_session_start_wh')
        if session_start_wh is None or battery_wh < session_start_wh:
            session_start_wh = battery_wh
            runtime['charge_session_start_wh'] = session_start_wh
            runtime['charge_session_fast'] = False
        session_kwh = max(0.0, round((battery_wh - session_start_wh) / 1000.0, 2))
        runtime['charge_session_fast'] = data.get('charge_mode') == 'dc_charging'
        is_fast_charge = bool(runtime.get('charge_session_fast', False))
        unit_price = 320 if is_fast_charge else 280
        active = data.get('charge_active_session') or {}
        if active.get('source') in ('can_request', 'can_actual'):
            session_kwh = active.get('energy_kwh', session_kwh)
        data['session_charge_kwh'] = session_kwh
        data['session_charge_cost'] = int(round(session_kwh * unit_price))
        data['session_charge_price'] = unit_price
        data['session_charge_type'] = 'DC_FAST' if is_fast_charge else 'AC_SLOW'
        data['session_start_soc'] = calibrated_soc(session_start_wh, capacity)
    elif not is_charging:
        runtime['charge_session_start_wh'] = None
        runtime['charge_session_fast'] = False
        data['session_charge_kwh'] = None
        data['session_charge_cost'] = None
        data['session_charge_price'] = None
        data['session_charge_type'] = None
        data['session_start_soc'] = None

    # Train once per battery measurement, not once per sensor/UI property read.
    stamp = (data.get('field_measured_at') or {}).get('battery_wh') or data.get('measured_at')
    try:
        measured_time = datetime.fromisoformat(stamp.replace('Z', '+00:00'))
        if measured_time.tzinfo is None:
            measured_time = measured_time.replace(tzinfo=timezone.utc)
        age_s = (now_utc - measured_time).total_seconds()
        estimate_valid = not is_stale and 0 <= age_s <= 180
    except (ValueError, TypeError, AttributeError):
        measured_time = now_utc
        estimate_valid = False
    session = (capacity, runtime.get('charge_session_start_wh'))
    active_estimate = data.get('charging') is True and not data.get('onroad') and estimate_valid
    held = runtime.get('charging_eta_hold')
    if held and (not active_estimate or held['session'] != session):
        held = None
        runtime.pop('charging_eta_hold', None)
    previous_model = runtime.get('charging_smooth_state')
    charging_est = estimate_charging_times(
        battery_wh / 1000 if type(battery_wh) in (int, float) else None,
        capacity, raw_power, base_time=measured_time,
        smooth_state=previous_model, is_charging=active_estimate
    )
    # Missing/quantized zero power is a display interruption, not training data.
    # A model rejection with otherwise valid power is an anomaly, never held.
    # A delayed snapshot is display-only: do not reset or retrain the model
    # merely because its power has been withheld from calculation inputs.
    runtime['charging_smooth_state'] = (previous_model if active_estimate and charge_signal.get('delayed')
                                       else charging_est['smooth_state'])
    valid_result = charging_est['eta_100'] is not None
    if valid_result and active_estimate:
        if held is None or measured_time.timestamp() > held['measured']:
            held = {'session':session, 'measured':measured_time.timestamp(),
                    'eta_80':charging_est['eta_80'], 'eta_100':charging_est['eta_100'], 'battery_wh':battery_wh}
            runtime['charging_eta_hold'] = held
    temporary_gap = raw_power is None or (type(raw_power) in (int, float)
        and math.isfinite(raw_power) and 0 <= raw_power < 300)
    hold_age = now_utc.timestamp()-held['measured'] if held else None
    elapsed = measured_time.timestamp()-held['measured'] if held else 0
    anomaly = bool(held and type(battery_wh) in (int,float) and (
        not math.isfinite(battery_wh) or battery_wh < 0 or battery_wh > capacity*1000
        or (elapsed > 0 and ((battery_wh-held['battery_wh']) < -50
            or (battery_wh-held['battery_wh'])*3600/elapsed > 250000))))
    holding = bool(not valid_result and active_estimate and temporary_gap and not anomaly and held
                   and 0 <= hold_age < 180)
    if not valid_result and not holding:
        runtime.pop('charging_eta_hold', None)
    data['charging_eta_source'] = 'held_last_valid' if holding else ('measured' if valid_result else 'unavailable')
    data['charging_eta_hold_age_s'] = round(hold_age) if holding else None
    for target in (80, 100):
        seconds_key, eta_key = f'time_to_{target}_s', f'eta_{target}'
        seconds, eta = charging_est[seconds_key], charging_est[eta_key]
        if holding:
            eta = held[eta_key]
            seconds = round((datetime.fromisoformat(eta)-now_utc).total_seconds()) if eta else None
            if seconds is not None and seconds <= 0:
                seconds, eta = None, None
        elif seconds is not None and seconds > 0:
            seconds = max(1, round((datetime.fromisoformat(eta)-now_utc).total_seconds()))
        # Reaching a target requires a fresh current measurement, not expiry of ETA.
        if active_estimate and not anomaly and type(battery_wh) in (int,float) and math.isfinite(battery_wh) and battery_wh <= capacity*1000 and battery_wh >= capacity*1000*target/100:
            seconds, eta = 0, now_utc.isoformat()
        data[seconds_key], data[eta_key] = seconds, eta
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

    # Local reversible corrections leave collector ledgers and raw telemetry intact.
    totals = runtime.get('charge_cost_totals') or {}
    if totals.get('month') == month:
        data['month_slow_kwh'] = round(max(0, data['month_slow_kwh'] - totals.get('excluded_slow_kwh', 0)), 2)
        data['month_fast_kwh'] = round(max(0, data['month_fast_kwh'] - totals.get('excluded_fast_kwh', 0)), 2)
        data['month_charge_kwh'] = round(data['month_slow_kwh'] + data['month_fast_kwh'], 2)
        data['month_charge_cost'] = max(0, data['month_charge_cost'] - totals.get('excluded_estimated_cost_krw', 0))

    # Only matched trip distance / net battery depletion is driving efficiency.
    for period in ('month', 'rolling30'):
        distance = data.get(f'{period}_energy_distance_km')
        energy = data.get(f'{period}_drive_energy_kwh')
        data[f'{period}_efficiency_kpl'] = (
            round(distance / energy, 2)
            if type(distance) in (int, float) and type(energy) in (int, float)
            and math.isfinite(distance) and math.isfinite(energy)
            and distance >= 1 and energy >= 0.5 else None
        )

    DEFAULT_RANGE_EFFICIENCY = 5.0  # km/kWh, conservative default for VW ID.4 in Korea

    if data.get('range_km') is None and data.get('battery_kwh') is not None:
        eff = data.get('month_efficiency_kpl')
        coverage = data.get('month_energy_coverage_percent') or 0
        enough_data = (data.get('month_energy_distance_km') or 0) >= 20 and coverage >= 80
        data['range_estimated'] = True
        if eff is not None and enough_data:
            data['range_km'] = int(round(data['battery_kwh'] * eff))
            data['range_efficiency_basis'] = 'matched_trip_energy'
        else:
            recent = data.get('recent_efficiency_kpl')
            if recent is not None:
                data['range_km'] = int(round(data['battery_kwh'] * recent))
                data['range_efficiency_basis'] = 'recent_trips'
            elif eff is not None:
                data['range_km'] = int(round(data['battery_kwh'] * eff))
                data['range_efficiency_basis'] = 'low_coverage_trip_energy'
            else:
                data['range_km'] = int(round(data['battery_kwh'] * DEFAULT_RANGE_EFFICIENCY))
                data['range_efficiency_basis'] = 'default_efficiency'

    # Never present stale locks/doors/health as current, including older collectors.
    for key in OPTIONAL_FIELDS:
        stamp = (data.get('field_measured_at') or {}).get(key)
        try:
            field_age = (now_utc - datetime.fromisoformat(stamp.replace('Z', '+00:00'))).total_seconds()
            if not 0 <= field_age <= FRESHNESS_SECONDS:
                data[key] = None
        except (ValueError, TypeError, AttributeError):
            data[key] = None

    parking = data.get('parking') or data.get('last_trip_parking') or {}
    data.update(parking_latitude=parking.get('latitude'),parking_longitude=parking.get('longitude'),parking_at=parking.get('measured_at') or parking.get('t'))
    return data
