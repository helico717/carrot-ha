"""Optional receive-only telemetry entity metadata and freshness policy."""
BINARY_FIELDS = {
    'door_driver_open': ('운전석 도어 열림', 'door'),
    'door_passenger_open': ('조수석 도어 열림', 'door'),
    'door_rear_driver_open': ('운전석 뒤 도어 열림', 'door'),
    'door_rear_passenger_open': ('조수석 뒤 도어 열림', 'door'),
    'trunk_open': ('트렁크 열림', 'opening'),
    'doors_locked': ('차량 잠김 상태', None),
}
SENSOR_FIELDS = {
    'bms_mode': ('BMS 하드웨어 모드', None, 'mdi:ev-station', None, None),
    'dcdc_temperature_c': ('DC-DC 컨버터 온도', '°C', 'mdi:thermometer', 'temperature', 1),
    'comma_cpu_temperature_c': ('콤마 CPU 최고 온도', '°C', 'mdi:thermometer', 'temperature', 1),
    'comma_gpu_temperature_c': ('콤마 GPU 최고 온도', '°C', 'mdi:thermometer', 'temperature', 1),
    'comma_cpu_usage_percent': ('콤마 CPU 평균 사용률', '%', 'mdi:chip', None, 1),
    'comma_memory_usage_percent': ('콤마 메모리 사용률', '%', 'mdi:memory', None, 1),
    'comma_storage_free_percent': ('콤마 저장공간 잔여율', '%', 'mdi:harddisk', None, 1),
    'comma_fan_requested_percent': ('콤마 팬 목표 출력', '%', 'mdi:fan', None, 0),
    'comma_thermal_status': ('콤마 발열 상태', None, 'mdi:thermometer-alert', None, None),
    'comma_network_type': ('콤마 네트워크 종류', None, 'mdi:network', None, None),
    'comma_network_strength': ('콤마 네트워크 신호 단계', None, 'mdi:signal', None, None),
}
# Door/lock/trunk fields retain last-known values when the vehicle sleeps.
# Only hardware diagnostics and BMS fields expire after FRESHNESS_SECONDS.
CHARGE_CAN_SIGNALS = {
    'plug_text': ('WBA_03', 'WBA_GE_Texte_02'),
    'motor_text': ('Motor_26', 'MO_E_Texte'),
    'activation_text': ('Motor_Hybrid_06', 'MO_Text_Aktivierung_Antrieb'),
    'bms_request': ('HVK_01', 'HVK_BMS_Sollmodus'),
    'manager_request': ('HVK_01', 'HVK_HVLM_Sollmodus'),
}
CHARGE_CAN_KEYS = {f'charge_can_{name}_bus{bus}' for name in CHARGE_CAN_SIGNALS for bus in (0, 1)}
OPTIONAL_FIELDS = set(SENSOR_FIELDS) | CHARGE_CAN_KEYS
REFRESH_FIELDS = OPTIONAL_FIELDS | {'charge_mode', 'charging', 'can_capture_storage', 'can_capture_last_received', 'can_capture_enabled'}
FRESHNESS_SECONDS = 180


def combined_lock_state(data):
    """Combine last reported modes without expiring parked-vehicle values.

    Individual timestamps are diagnostic only: CAN may stop while parked.
    """
    keys = ('doors_locked_external', 'doors_locked_internal')
    states = [data.get(key) for key in keys]
    if any(value is True for value in states):
        return True
    if all(value is False for value in states):
        return False
    return None


def charge_connection_evidence(raw, current):
    """Keep last received codes/times for diagnosis; never infer plug state."""
    evidence = {}
    for name, (message, signal) in CHARGE_CAN_SIGNALS.items():
        for bus in (0, 1):
            key = f'charge_can_{name}_bus{bus}'
            if key in raw:
                evidence[key] = {'value': raw[key], 'bus': bus, 'message': message,
                                 'signal': signal,
                                 'measured_at': (raw.get('field_measured_at') or {}).get(key),
                                 'fresh': current.get(key) is not None}
    return evidence


def charge_plug_indication(data):
    """Whether a fresh WBA_03 code reports Ladestecker_gesteckt.

    Other display codes mean indication absent, not proven physical disconnect.
    Missing/expired samples are unknown rather than a false OFF.
    """
    codes = [data.get(f'charge_can_plug_text_bus{bus}') for bus in (0, 1)]
    valid = [code for code in codes if type(code) is int and 0 <= code <= 7]
    return any(code == 2 for code in valid) if valid else None
