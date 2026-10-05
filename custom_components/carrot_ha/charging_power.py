"""Fresh battery-side CAN charging power; no energy-delta/display hold."""
from .charging_mode import charging_mode, actual_power_voltage

def charging_power(data, runtime, now):
    signal = charging_mode(data, now)
    power, voltage, stamp = actual_power_voltage(data, signal)
    runtime.pop('power_hold', None)
    data.update(charge_power_w=power, actual_charge_power_w=power, hv_voltage=voltage,
                charge_power_kw=power/1000 if power is not None else None,
                charge_power_raw_w=power, charge_power_source='can_actual' if power is not None else 'unavailable',
                charge_power_hold_age_s=None, charge_power_hold_limit_s=None)
    if stamp:
        data['field_measured_at'] = dict(data.get('field_measured_at') or {}, actual_charge_power_w=stamp, hv_voltage=stamp)
    return power
