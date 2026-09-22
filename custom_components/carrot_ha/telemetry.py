"""Optional receive-only telemetry entity metadata and freshness policy."""
BINARY_FIELDS = {
    'door_driver_open': ('운전석 도어 열림', 'door'),
    'door_passenger_open': ('조수석 도어 열림', 'door'),
    'door_rear_driver_open': ('운전석 뒤 도어 열림', 'door'),
    'door_rear_passenger_open': ('조수석 뒤 도어 열림', 'door'),
    'trunk_open': ('트렁크 열림', 'opening'),
    'doors_locked_external': ('외부 잠금 상태', None),
    'doors_locked_internal': ('내부 잠금 상태', None),
}
SENSOR_FIELDS = {
    'bms_mode': ('BMS 하드웨어 모드', None, 'mdi:ev-station', None, None),
    'bms_target_soc_percent': ('BMS 목표 SOC 신호', '%', 'mdi:battery-charging-80', None, 1),
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
OPTIONAL_FIELDS = set(SENSOR_FIELDS)
FRESHNESS_SECONDS = 180
