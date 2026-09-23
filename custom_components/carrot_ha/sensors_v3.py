from datetime import datetime
from homeassistant.components.sensor import SensorEntity
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
 'measured_capacity_kwh':('BMS 용량 (추정)','kWh','mdi:battery-heart-variant','energy',1),
 'soc_capacity_kwh':('SOC 계산 용량','kWh','mdi:battery-sync','energy',1),
 'range_km':('주행가능거리 (추정)','km','mdi:map-marker-distance','distance',0),
 'blower_volt':('송풍 제어 전압','V','mdi:fan','voltage',2),
 'blower_level':('송풍 단계',None,'mdi:fan',None,0),
 'seat_heat_left':('운전석 열선 단계',None,'mdi:car-seat-heater',None,0),
 'seat_heat_right':('조수석 열선 단계',None,'mdi:car-seat-heater',None,0),
 'recirc':('내기순환 신호',None,'mdi:car-windshield',None,0),
 'speed_kph':('현재 속도','km/h','mdi:speedometer','speed',0),
 'wheel_speed_kph':('실차 휠 차속','km/h','mdi:speedometer','speed',0),
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
    async_add_entities([VehicleSensor(entry,key,*spec) for key,spec in FIELDS.items()])

class VehicleSensor(VehicleEntity,SensorEntity):
    def __init__(self,entry,key,name,unit,icon,device_class,precision=None):
        self.configure(entry,key,name,icon)
        self._attr_native_unit_of_measurement=unit
        self._attr_device_class=device_class
        if precision is not None:
            self._attr_suggested_display_precision=precision
        if unit is not None and device_class not in ('monetary','energy'): self._attr_state_class='measurement'
        if key.startswith('comma_') or key == 'bms_target_soc_percent':
            self._attr_entity_category = 'diagnostic'
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
        if self.key == 'month_efficiency_kpl':
            attrs.update(calculation='matched_trip_distance / net_battery_depletion',
                         coverage_percent=self.data.get('month_energy_coverage_percent'),
                         distance_km=self.data.get('month_energy_distance_km'),
                         energy_kwh=self.data.get('month_drive_energy_kwh'),
                         calculation_version=2)
        elif self.key == 'bms_target_soc_percent':
            attrs.update(source='BMS_04.BMS_Soll_SOC_HiRes', vehicle_charge_limit_verified=False)
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
            attrs.update(nominal_net_kwh=78,nominal_gross_kwh=82,soc_capacity_kwh=self.entry.options.get('soc_capacity_kwh',78),soc_source='energy_based_calibration')
        return attrs
