"""Display calibration; does not claim to measure battery SOH."""
import math

NET_CAPACITY_KWH = 78.0
GROSS_CAPACITY_KWH = 82.0

def calibrated_soc(energy_wh, capacity_kwh):
    if type(energy_wh) not in (float, int) or type(capacity_kwh) not in (float, int):
        return None
    if not math.isfinite(energy_wh) or not math.isfinite(capacity_kwh) or energy_wh < 0 or not 20 <= capacity_kwh <= 150:
        return None
    return round(min(100, energy_wh / (capacity_kwh * 1000) * 100), 1)

def estimate_charging_times(battery_kwh, measured_capacity_kwh, charge_power_w, base_time=None):
    """Estimate remaining seconds and completion timestamp for 80% and 100% charging."""
    if not isinstance(charge_power_w, (int, float)) or charge_power_w < 300:
        return {'time_to_80_s': None, 'eta_80': None, 'time_to_100_s': None, 'eta_100': None}
    if not isinstance(battery_kwh, (int, float)) or not isinstance(measured_capacity_kwh, (int, float)):
        return {'time_to_80_s': None, 'eta_80': None, 'time_to_100_s': None, 'eta_100': None}
    if battery_kwh < 0 or measured_capacity_kwh <= 0:
        return {'time_to_80_s': None, 'eta_80': None, 'time_to_100_s': None, 'eta_100': None}

    power_kw = charge_power_w / 1000.0
    from datetime import datetime, timezone, timedelta
    now = base_time or datetime.now(timezone.utc)

    # 80% estimation
    target_80_kwh = measured_capacity_kwh * 0.8
    need_80 = max(0.0, target_80_kwh - battery_kwh)
    time_80_s = round((need_80 / power_kw) * 3600)
    eta_80 = (now + timedelta(seconds=time_80_s)).isoformat()

    # 100% estimation
    target_100_kwh = measured_capacity_kwh * 1.0
    need_100 = max(0.0, target_100_kwh - battery_kwh)
    time_100_s = round((need_100 / power_kw) * 3600)
    eta_100 = (now + timedelta(seconds=time_100_s)).isoformat()

    return {
        'time_to_80_s': time_80_s,
        'eta_80': eta_80,
        'time_to_100_s': time_100_s,
        'eta_100': eta_100,
    }

