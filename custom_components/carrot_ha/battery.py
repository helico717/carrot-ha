"""Display calibration and charging time estimation with ID.4 curve & 3-stage smoothing."""
import math
from datetime import datetime, timezone, timedelta

NET_CAPACITY_KWH = 78.0
GROSS_CAPACITY_KWH = 82.0

# 2023 VW ID.4 Pro S Theoretical Charging Curve (1% - 100% in kW)
ID4_CHARGING_CURVE_KW = [
    181.3,  # 0% fallback
    181.3, 183.4, 183.3, 185.0, 187.1, 187.2, 187.2, 188.3, 189.1, 189.2,  # 1-10%
    190.2, 190.3, 190.2, 191.3, 191.3, 191.3, 191.3, 191.3, 192.3, 192.4,  # 11-20%
    189.2, 187.1, 184.4, 181.2, 179.2, 176.2, 170.2, 165.0, 160.2, 155.0,  # 21-30%
    150.2, 146.0, 144.0, 141.2, 138.2, 136.0, 132.9, 131.2, 129.1, 127.0,  # 31-40%
    124.0, 122.9, 120.1, 119.1, 117.0, 114.0, 112.9, 110.1, 109.1, 107.0,  # 41-50%
    107.0, 104.9, 103.8, 101.8, 101.9, 100.7, 100.1,  99.1,  98.0,  96.9,  # 51-60%
     96.0,  95.0,  93.9,  92.8,  91.8,  91.8,  91.8,  91.8,  91.8,  91.8,  # 61-70%
     91.8,  91.8,  91.9,  91.8,  92.9,  92.8,  92.8,  92.8,  91.8,  90.8,  # 71-80%
     90.0,  88.9,  85.9,  81.8,  79.1,  76.0,  72.8,  69.7,  66.9,  62.8,  # 81-90%
     59.7,  57.0,  52.7,  49.7,  46.8,  43.7,  40.6,  37.6,  34.8,  31.7   # 91-100%
]

SMOOTH_ALPHA = 0.25         # Power EMA factor
SMOOTH_SLEW_MAX_S = 180     # Max allowed ETA shift per update (3 minutes)
SMOOTH_DEADBAND_S = 120     # Preserve previous ETA if change is within +/- 2 min
SMOOTH_JUMP_RESET_KW = 25.0 # Instant reset if power changes abruptly (e.g. AC <-> DC)

def calibrated_soc(energy_wh, capacity_kwh):
    if type(energy_wh) not in (float, int) or type(capacity_kwh) not in (float, int):
        return None
    if not math.isfinite(energy_wh) or not math.isfinite(capacity_kwh) or energy_wh < 0 or not 20 <= capacity_kwh <= 150:
        return None
    return round(min(100, energy_wh / (capacity_kwh * 1000) * 100), 1)

def estimate_charging_times(battery_kwh, measured_capacity_kwh, charge_power_w, base_time=None, smooth_state=None, is_charging=True):
    """Estimate remaining seconds and completion timestamp for 80% and 100% charging using ID.4 curve and 3-stage smoothing."""
    if not is_charging:
        return {'time_to_80_s': None, 'eta_80': None, 'time_to_100_s': None, 'eta_100': None, 'smooth_state': None}
    if not isinstance(charge_power_w, (int, float)) or charge_power_w < 300:
        return {'time_to_80_s': None, 'eta_80': None, 'time_to_100_s': None, 'eta_100': None, 'smooth_state': None}
    if not isinstance(battery_kwh, (int, float)) or not isinstance(measured_capacity_kwh, (int, float)):
        return {'time_to_80_s': None, 'eta_80': None, 'time_to_100_s': None, 'eta_100': None, 'smooth_state': None}
    if battery_kwh < 0 or measured_capacity_kwh <= 0:
        return {'time_to_80_s': None, 'eta_80': None, 'time_to_100_s': None, 'eta_100': None, 'smooth_state': None}

    now = base_time or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    power_kw = charge_power_w / 1000.0
    soc = min(100.0, max(0.0, (battery_kwh / measured_capacity_kwh) * 100.0))

    if soc >= 100.0:
        now_iso = now.isoformat()
        return {
            'time_to_80_s': 0,
            'eta_80': now_iso,
            'time_to_100_s': 0,
            'eta_100': now_iso,
            'smooth_state': None
        }

    now_ts = now.timestamp()
    if smooth_state and isinstance(smooth_state.get('last_calc_ts'), (int, float)):
        if abs(now_ts - smooth_state['last_calc_ts']) > 600:
            smooth_state = None

    # Stage 1: Power EMA Filter
    power_smooth = power_kw
    if smooth_state and isinstance(smooth_state.get('power_smooth'), (int, float)) and smooth_state['power_smooth'] > 0:
        prev_p = smooth_state['power_smooth']
        if abs(power_kw - prev_p) > SMOOTH_JUMP_RESET_KW:
            power_smooth = power_kw
            smooth_state = None
        else:
            power_smooth = SMOOTH_ALPHA * power_kw + (1.0 - SMOOTH_ALPHA) * prev_p

    # Stage 2: ID.4 Curve Bottleneck Numerical Integration
    def calc_time_to_soc(target_soc, p_in):
        if soc >= target_soc:
            return 0
        total_sec = 0.0
        start_int = int(math.floor(soc))
        target_int = int(math.floor(target_soc))
        for s in range(start_int, target_int):
            curve_val = ID4_CHARGING_CURVE_KW[min(100, s + 1)]
            step_kw = max(0.3, min(p_in, curve_val))
            step_frac = (start_int + 1 - soc) if s == start_int else 1.0
            step_kwh = measured_capacity_kwh * 0.01 * step_frac
            total_sec += (step_kwh / step_kw) * 3600.0

        if target_soc > target_int:
            curve_val = ID4_CHARGING_CURVE_KW[min(100, target_int + 1)]
            step_kw = max(0.3, min(p_in, curve_val))
            step_kwh = measured_capacity_kwh * 0.01 * (target_soc - target_int)
            total_sec += (step_kwh / step_kw) * 3600.0

        return int(round(total_sec))

    raw_sec80 = calc_time_to_soc(80.0, power_smooth) if soc < 80.0 else 0
    raw_sec100 = calc_time_to_soc(100.0, power_smooth)

    # Stage 3: Slew-Rate Limiter & Countdown Deadband
    def apply_slew_and_deadband(target_sec, prev_eta_ts, prev_sec, last_calc_ts):
        new_eta_ts = now_ts + target_sec
        if prev_eta_ts is None or last_calc_ts is None or prev_sec is None:
            return target_sec, new_eta_ts

        elapsed_sec = max(0.0, now_ts - last_calc_ts)
        natural_sec = max(0, int(round(prev_sec - elapsed_sec)))
        delta_eta_sec = new_eta_ts - prev_eta_ts

        # Deadband: within +/- 120s, preserve existing ETA and natural countdown
        if abs(delta_eta_sec) <= SMOOTH_DEADBAND_S:
            return natural_sec, prev_eta_ts

        # Slew-rate clamp: limit drift to +/- 180s per update
        sign = 1.0 if delta_eta_sec > 0 else -1.0
        allowed_shift = sign * min(abs(delta_eta_sec), float(SMOOTH_SLEW_MAX_S))
        smooth_eta_ts = prev_eta_ts + allowed_shift
        smooth_sec = max(0, int(round(smooth_eta_ts - now_ts)))
        return smooth_sec, smooth_eta_ts

    prev_80_ts = smooth_state.get('eta_80_ts') if smooth_state else None
    prev_80_sec = smooth_state.get('sec80') if smooth_state else None
    prev_100_ts = smooth_state.get('eta_100_ts') if smooth_state else None
    prev_100_sec = smooth_state.get('sec100') if smooth_state else None
    last_calc_ts = smooth_state.get('last_calc_ts') if smooth_state else None

    if soc >= 80.0:
        sec80 = 0
        eta80_ts = now_ts
    else:
        sec80, eta80_ts = apply_slew_and_deadband(raw_sec80, prev_80_ts, prev_80_sec, last_calc_ts)
    sec100, eta100_ts = apply_slew_and_deadband(raw_sec100, prev_100_ts, prev_100_sec, last_calc_ts)

    updated_state = {
        'power_smooth': power_smooth,
        'last_calc_ts': now_ts,
        'eta_80_ts': eta80_ts,
        'eta_100_ts': eta100_ts,
        'sec80': sec80,
        'sec100': sec100
    }

    eta_80 = datetime.fromtimestamp(eta80_ts, timezone.utc).isoformat()
    eta_100 = datetime.fromtimestamp(eta100_ts, timezone.utc).isoformat()

    return {
        'time_to_80_s': sec80,
        'eta_80': eta_80,
        'time_to_100_s': sec100,
        'eta_100': eta_100,
        'smooth_state': updated_state
    }

