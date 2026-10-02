from .battery import DEFAULT_SOC_CAPACITY_KWH
from datetime import datetime
from homeassistant.components.sensor import SensorEntity
from homeassistant.const import EntityCategory
from .entity import VehicleEntity
from .telemetry import SENSOR_FIELDS

GEAR_DISPLAY = {
    'park': 'P',
    'drive': 'D',
    'reverse': 'R',
    'neutral': 'N',
    'sport': 'S',
    'low': 'B',
    'eco': 'Eco',
    'manumatic': 'M',
}

FIELDS = {
 'gear':('현재 기어',None,'mdi:car-shift-pattern',None,None),
 'soc_percent':('배터리 잔량','%','mdi:battery','battery',1),
 'odometer_km':('총 주행거리','km','mdi:counter','distance',0),
 'outside_temp_c':('외기 온도','°C','mdi:thermometer','temperature',1),
 'aux_voltage':('12V 배터리 전압','V','mdi:car-battery','voltage',2),
 'charge_power_w':('충전 전력 (추정)','kW','mdi:ev-station','power',1),
 'time_to_80_s':('80% 충전 남은시간 (추정)','s','mdi:timer-sand','duration',0),
 'eta_80':('80% 충전 완료시각 (추정)',None,'mdi:clock-end','timestamp',None),
 'time_to_100_s':('100% 충전 남은시간 (추정)','s','mdi:timer-sand','duration',0),
 'eta_100':('100% 충전 완료시각 (추정)',None,'mdi:clock-end','timestamp',None),
 'battery_kwh':('배터리 저장 에너지','kWh','mdi:battery-high','energy',1),
 'hv_voltage':('고전압 배터리 전압','V','mdi:lightning-bolt','voltage',1),
 'soc_capacity_kwh':('SOC 계산 용량','kWh','mdi:battery-sync','energy',1),
 'range_km':('주행가능거리 (추정)','km','mdi:map-marker-distance','distance',0),
 'blower_volt':('송풍 제어 전압','V','mdi:fan','voltage',2),
 'blower_level':('송풍 단계',None,'mdi:fan',None,0),
 'seat_heat_left':('운전석 열선 단계',None,'mdi:car-seat-heater',None,0),
 'seat_heat_right':('조수석 열선 단계',None,'mdi:car-seat-heater',None,0),
 'recirc':('내기순환 신호',None,'mdi:car-windshield',None,0),
 'speed_kph':('현재 속도','km/h','mdi:speedometer','speed',0),
 'gps_accuracy_m':('GPS 정확도','m','mdi:crosshairs-gps','distance',1),
 'bearing_deg':('진행 방향','°','mdi:compass',None,0),
 'month_efficiency_kpl':('이번 달 주행 전비 (추정)','km/kWh','mdi:chart-line',None,2),
 'month_charge_kwh':('이번 달 충전량 (추정)','kWh','mdi:ev-station','energy',2),
 'month_slow_kwh':('이번 달 완속 분류 충전량 (추정)','kWh','mdi:power-plug','energy',2),
 'month_fast_kwh':('이번 달 급속 분류 충전량 (추정)','kWh','mdi:flash','energy',2),
 'month_charge_cost':('이번 달 충전요금 (추정)','KRW','mdi:cash','monetary',0),
 'trip_count':('저장된 주행 횟수',None,'mdi:format-list-bulleted',None,0),
 'recorded_distance_km':('기록된 누적 거리','km','mdi:routes','distance',2),
 'month_trip_count':('이번 달 주행 횟수',None,'mdi:calendar-check',None,0),
 'month_distance_km':('이번 달 주행거리','km','mdi:calendar-month','distance',2),
 'last_trip_distance_km':('최근 주행거리','km','mdi:map-marker-distance','distance',2),
 'last_trip_duration_s':('최근 주행시간','s','mdi:timer-outline','duration',0),
 'last_trip_avg_kph':('최근 평균속도','km/h','mdi:speedometer-medium','speed',0),
 'last_trip_max_kph':('최근 최고속도','km/h','mdi:speedometer','speed',0),
 'last_trip_at':('최근 주행 종료',None,'mdi:clock-end','timestamp',None),
 'parking_at':('주차 위치 기록 시각',None,'mdi:parking','timestamp',None),
 'measured_at':('차량 측정 시각',None,'mdi:clock-check-outline','timestamp',None),
 'last_sync':('HA 동기화 시각',None,'mdi:cloud-check','timestamp',None),
 'measurement_age_s':('차량 데이터 경과시간','s','mdi:clock-alert-outline','duration',0),
 'cloud_status':('클라우드 연결 상태',None,'mdi:cloud-outline',None,None),
}

FIELDS.update(SENSOR_FIELDS)
# Internal quality/energy inputs remain attributes of monthly efficiency.
FIELDS.pop('bms_mode', None)

async def async_setup_entry(hass,entry,async_add_entities):
    entities = [VehicleSensor(entry,key,*spec) for key,spec in FIELDS.items()]
    entities.extend([
        LastTripSensor(entry),
        ChargingSessionSensor(entry),
        TodayDrivingSensor(entry),
    ])
    async_add_entities(entities)

ID4_DIAGNOSTIC_KEYS = {
    'aux_voltage', 'hv_voltage', 'recirc', 'blower_level', 'blower_volt',
    'parking_at', 'cloud_status', 'gear', 'dcdc_temperature_c',
    'gps_accuracy_m', 'last_sync', 'soc_capacity_kwh'
}

class VehicleSensor(VehicleEntity,SensorEntity):
    def __init__(self,entry,key,name,unit,icon,device_class,precision=None):
        self.configure(entry,key,name,icon)
        self._attr_native_unit_of_measurement=unit
        self._attr_device_class=device_class
        if precision is not None:
            self._attr_suggested_display_precision=precision
        if unit is not None and device_class not in ('monetary','energy'): self._attr_state_class='measurement'
        if key.startswith('comma_') or key in ID4_DIAGNOSTIC_KEYS:
            self._attr_entity_category = EntityCategory.DIAGNOSTIC
        if key in ('month_charge_kwh','month_slow_kwh','month_fast_kwh'):self._attr_state_class='total_increasing'
    @property
    def native_value(self):
        value=self.data.get(self.key)
        if self.key=='gear':
            if not value:
                return None
            return GEAR_DISPLAY.get(str(value).lower(), str(value).upper())
        if self.key=='charge_power_w':
            if isinstance(value,(int,float)):
                return round(value/1000.0, 1)
            kw=self.data.get('charge_power_kw')
            if isinstance(kw,(int,float)):
                return round(kw, 1)
            return None
        if self._attr_device_class=='timestamp' and value:
            try:return datetime.fromisoformat(value.replace('Z','+00:00'))
            except (ValueError,AttributeError):return None
        if getattr(self,'_attr_suggested_display_precision',None)==0 and isinstance(value,float):
            return int(round(value))
        return value
    @property
    def extra_state_attributes(self):
        attrs=super().extra_state_attributes
        if self.key == 'charge_power_w':
            attrs.update(raw_power_w=self.data.get('charge_power_raw_w'),
                         source=self.data.get('charge_power_source'),
                         hold_age_s=self.data.get('charge_power_hold_age_s'),
                         hold_limit_s=self.data.get('charge_power_hold_limit_s'))
        elif self.key in ('time_to_80_s','time_to_100_s','eta_80','eta_100'):
            attrs.update(source=self.data.get('charging_eta_source'),
                         hold_age_s=self.data.get('charging_eta_hold_age_s'), hold_limit_s=180)
        elif self.key == 'month_efficiency_kpl':
            attrs.update(calculation='matched_trip_distance / net_battery_depletion',
                         coverage_percent=self.data.get('month_energy_coverage_percent'),
                         distance_km=self.data.get('month_energy_distance_km'),
                         energy_kwh=self.data.get('month_drive_energy_kwh'),
                         calculation_version=2)
        elif self.key=='gear':
            attrs['raw_gear']=self.data.get('gear')
        elif self.key=='range_km':
            if self.data.get('range_estimated'):
                attrs['estimated']=True
                attrs['efficiency_basis']=self.data.get('range_efficiency_basis')
                recent_eff = self.data.get('recent_efficiency_kpl')
                if recent_eff is not None:
                    attrs['recent_efficiency_kpl'] = recent_eff
                    attrs['recent_efficiency_trip_count'] = self.data.get('recent_efficiency_trip_count')
                    attrs['recent_efficiency_distance_km'] = self.data.get('recent_efficiency_distance_km')
        elif self.key=='soc_percent':
            attrs.update(nominal_net_kwh=78,nominal_gross_kwh=82,soc_capacity_kwh=self.entry.options.get('soc_capacity_kwh',DEFAULT_SOC_CAPACITY_KWH),soc_source='energy_based_calibration')
        return attrs


class LastTripSensor(VehicleEntity, SensorEntity):
    _attr_device_class = 'distance'
    _attr_state_class = 'measurement'
    _attr_native_unit_of_measurement = 'km'
    _attr_suggested_display_precision = 2

    def __init__(self, entry):
        self.configure(entry, 'last_trip', '최근 주행 결과', 'mdi:map-marker-distance')

    @property
    def native_value(self):
        val = self.data.get('last_trip_distance_km')
        return round(val, 2) if isinstance(val, (int, float)) else None

    @property
    def extra_state_attributes(self):
        attrs = super().extra_state_attributes
        duration_s = self.data.get('last_trip_duration_s')
        duration_m = round(duration_s / 60.0, 1) if isinstance(duration_s, (int, float)) else None
        attrs.update({
            'distance_km': self.data.get('last_trip_distance_km'),
            'duration_s': duration_s,
            'duration_minutes': duration_m,
            'efficiency_kpl': self.data.get('last_trip_efficiency_kpl'),
            'energy_kwh': self.data.get('last_trip_energy_kwh'),
            'start_soc': self.data.get('last_trip_start_soc'),
            'end_soc': self.data.get('last_trip_end_soc'),
            'consumed_soc': self.data.get('last_trip_consumed_soc'),
            'avg_speed_kph': self.data.get('last_trip_avg_kph'),
            'max_speed_kph': self.data.get('last_trip_max_kph'),
            'ended_at': self.data.get('last_trip_at'),
        })
        return attrs


class ChargingSessionSensor(VehicleEntity, SensorEntity):
    def __init__(self, entry):
        self.configure(entry, 'charging_session', '충전 세션', 'mdi:ev-station')

    @property
    def native_value(self):
        if bool(self.data.get('emergency_charging')):
            return 'emergency'
        if bool(self.data.get('charging')):
            return 'charging'
        return 'disconnected'

    @property
    def icon(self):
        return 'mdi:ev-station' if self.native_value == 'charging' else 'mdi:power-plug-off'

    @property
    def extra_state_attributes(self):
        attrs = super().extra_state_attributes
        current_soc = self.data.get('soc_percent')
        start_soc = self.data.get('session_start_soc')
        added_soc = round(current_soc - start_soc, 1) if isinstance(current_soc, (int, float)) and isinstance(start_soc, (int, float)) else None
        attrs.update({
            'charging': bool(self.data.get('charging')),
            'session_charge_kwh': self.data.get('session_charge_kwh'),
            'session_charge_cost': self.data.get('session_charge_cost'),
            'unit_price_krw': self.data.get('session_charge_price'),
            'charger_type': self.data.get('session_charge_type'),
            'power_kw': self.data.get('charge_power_kw'),
            'start_soc': start_soc,
            'current_soc': current_soc,
            'added_soc': added_soc,
            'time_to_80_s': self.data.get('time_to_80_s'),
            'eta_80': self.data.get('eta_80'),
            'time_to_100_s': self.data.get('time_to_100_s'),
            'eta_100': self.data.get('eta_100'),
        })
        return attrs


class TodayDrivingSensor(VehicleEntity, SensorEntity):
    _attr_device_class = 'distance'
    _attr_state_class = 'measurement'
    _attr_native_unit_of_measurement = 'km'
    _attr_suggested_display_precision = 2

    def __init__(self, entry):
        self.configure(entry, 'today_summary', '오늘의 주행 요약', 'mdi:calendar-today')

    @property
    def native_value(self):
        val = self.data.get('today_distance_km')
        return round(val, 2) if isinstance(val, (int, float)) else 0.0

    @property
    def extra_state_attributes(self):
        attrs = super().extra_state_attributes
        attrs.update({
            'today_trip_count': self.data.get('today_trip_count', 0),
            'today_distance_km': self.data.get('today_distance_km', 0.0),
            'today_energy_kwh': self.data.get('today_energy_kwh'),
            'today_efficiency_kpl': self.data.get('today_efficiency_kpl'),
        })
        return attrs

