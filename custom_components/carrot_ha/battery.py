"""Display calibration and measurement-driven charging time estimation."""
import math
from datetime import datetime, timezone

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

POWER_TAU_S = 120.0
HISTORY_S = 300.0


def calibrated_soc(energy_wh, capacity_kwh):
    if not _finite(energy_wh) or not _finite(capacity_kwh):
        return None
    if energy_wh < 0 or not 20 <= capacity_kwh <= 150:
        return None
    return round(min(100, energy_wh / (capacity_kwh * 1000) * 100), 1)


def _finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def estimate_charging_times(battery_kwh, measured_capacity_kwh, charge_power_w,
                            base_time=None, smooth_state=None, is_charging=True):
    """Estimate from unique measurement times and net battery energy.

    measured_capacity_kwh is retained as an API name for compatibility; callers
    must pass the same configured capacity used by displayed SOC, never Ah * V.
    State is immutable to callers. Re-reading a measurement cannot train it.
    """
    empty = dict(time_to_80_s=None, eta_80=None, time_to_100_s=None,
                 eta_100=None, smooth_state=None)
    capacity = measured_capacity_kwh
    if (not is_charging or not all(_finite(x) for x in
            (battery_kwh, capacity, charge_power_w)) or
            not 20 <= capacity <= 150 or not 0 <= battery_kwh <= capacity or
            charge_power_w < 300):
        return empty
    now = base_time or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    t = now.timestamp()
    soc = battery_kwh / capacity * 100
    power = charge_power_w / 1000
    previous = smooth_state
    if previous and previous.get('capacity') != capacity:
        previous = None
    if previous:
        dt = t - previous['last_calc_ts']
        if dt <= 0:
            return dict(previous['result'], smooth_state=previous)
        if dt > 600:
            previous = None
    if previous:
        dt = t - previous['last_calc_ts']
        delta = battery_kwh - previous['energy']
        # Reject implausible steps, including CAN sentinel/reinitialization jumps.
        if delta < -0.05 or delta * 3600 / dt > 250:
            return empty
        if abs(power - previous['last_power']) > 25:
            previous = None

    dt = t - previous['last_calc_ts'] if previous else 0
    history = list(previous['history']) if previous else []
    history = [x for x in history if t - x[0] <= HISTORY_S]
    history.append((t, battery_kwh, power))
    # Prefer an actual multi-minute net energy slope to another filter stacked
    # on top of the collector's 90-240 second power estimate.
    span = t - history[0][0]
    gain = battery_kwh - history[0][1]
    if span >= 180 and gain > 0:
        effective = max(0.3, min(250, gain * 3600 / span))
    elif previous:
        alpha = -math.expm1(-dt / POWER_TAU_S)
        effective = previous['power_smooth'] + alpha * (power - previous['power_smooth'])
    else:
        effective = power

    # Only extrapolate a taper actually observed over multiple measurements.
    # This is evidence of slowing, not an AC/DC classification by instant power.
    slope = 0.0
    soc_span = (battery_kwh - history[0][1]) / capacity * 100
    if (span >= 180 and soc_span >= 2 and len(history) >= 4 and
            max(x[2] for x in history) > 22 and
            all(b[2] <= a[2] * 1.05 for a, b in zip(history, history[1:])) and
            power < history[0][2] * 0.9):
        slope = max(-0.08, math.log(power / history[0][2]) / soc_span)
        # A trailing average lags a sustained taper; anchor to latest power.
        effective = min(effective, power)

    def duration(target):
        if soc >= target:
            return 0
        seconds = 0.0
        curve_now = ID4_CHARGING_CURVE_KW[min(100, max(1, math.ceil(soc)))]
        for step in range(math.floor(soc), target):
            end = step + 1
            fraction = end - max(soc, step)
            curve = ID4_CHARGING_CURVE_KW[end]
            # Limit empirical extrapolation to the next 10 percentage points;
            # beyond that retain the reference curve's relative decline.
            future = effective * math.exp(slope * min(10, end - soc))
            if slope < 0:
                future = min(future, effective * min(1, curve / curve_now))
            kw = max(0.3, min(future, curve))
            seconds += capacity * 0.01 * fraction / kw * 3600
        return max(1, round(seconds))

    result = {}
    raw_durations = {}
    for target in (80, 100):
        raw = duration(target)
        raw_durations[target] = raw
        eta = t + raw
        if raw and previous:
            old_eta = previous['eta_' + str(target) + '_ts']
            shift = eta - old_eta
            # Bounded in elapsed time, never in number of UI reads. Near the
            # target, let measurements win instead of counting down to false 0.
            if raw > 120:
                if abs(shift) <= min(120, raw * 0.1):
                    eta = old_eta
                else:
                    limit = 3 * dt
                    eta = old_eta + max(-limit, min(limit, shift))
            eta = max(t + 1, eta)
        result['time_to_' + str(target) + '_s'] = max(1, round(eta - t)) if raw else 0
        result['eta_' + str(target)] = datetime.fromtimestamp(eta, timezone.utc).isoformat()
    state = dict(capacity=capacity, energy=battery_kwh, last_calc_ts=t,
                 last_power=power, power_smooth=effective, history=history,
                 eta_80_ts=datetime.fromisoformat(result['eta_80']).timestamp(),
                 eta_100_ts=datetime.fromisoformat(result['eta_100']).timestamp(),
                 raw_durations=raw_durations, taper_slope=slope,
                 result=dict(result)) if soc < 100 else None
    return dict(result, smooth_state=state)
