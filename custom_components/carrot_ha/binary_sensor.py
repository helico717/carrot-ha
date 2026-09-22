from homeassistant.components.binary_sensor import BinarySensorEntity
from .entity import VehicleEntity
from .telemetry import BINARY_FIELDS
from .connectivity import connection_status
from datetime import timedelta
from homeassistant.core import callback
from homeassistant.helpers.event import async_track_time_interval

async def async_setup_entry(hass,entry,async_add_entities):
    async_add_entities([Flag(entry,*spec) for spec in [('onroad','주행 모드','mdi:car'),('charging','충전 중 추정','mdi:ev-station'),('ac_on','에어컨 작동','mdi:snowflake'),('stale','차량 데이터 오래됨','mdi:clock-alert'),('enabled','주행 보조 활성','mdi:steering')]])
    async_add_entities([CommaConnection(entry), EmergencyCharging(entry)])
    async_add_entities([TelemetryFlag(entry, key, *spec) for key, spec in BINARY_FIELDS.items()])

class EmergencyCharging(VehicleEntity, BinarySensorEntity):
    _attr_device_class = 'problem'

    def __init__(self, entry):
        self.configure(entry, 'emergency_charging', '비상 충전 모드 추정', 'mdi:power-plug-off')

    @property
    def is_on(self):
        return bool(self.data.get('emergency_charging'))

    @property
    def icon(self):
        return 'mdi:power-plug-off' if self.is_on else 'mdi:power-plug'

    @property
    def extra_state_attributes(self):
        attrs = super().extra_state_attributes
        attrs.update({
            'low_power_duration_s': self.data.get('low_power_duration_s', 0),
            'threshold_kw': 1.5,
            'min_duration_s': 300,
            'charge_power_kw': self.data.get('charge_power_kw')
        })
        return attrs

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        @callback
        def refresh(now):
            self.async_write_ha_state()
        self.async_on_remove(async_track_time_interval(self.hass, refresh, timedelta(seconds=30)))

class CommaConnection(VehicleEntity, BinarySensorEntity):
    _attr_device_class = 'connectivity'

    def __init__(self, entry):
        self.configure(entry, 'comma_online', '콤마 연결 상태', 'mdi:access-point-network')

    @property
    def is_on(self):
        return connection_status(self.runtime)['online']

    @property
    def extra_state_attributes(self):
        state = connection_status(self.runtime)
        return {key: value for key, value in state.items() if key != 'online'}

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        @callback
        def refresh(now):
            self.async_write_ha_state()
        self.async_on_remove(async_track_time_interval(self.hass, refresh, timedelta(seconds=30)))

class Flag(VehicleEntity,BinarySensorEntity):
    def __init__(self,entry,key,name,icon):self.configure(entry,key,name,icon)
    @property
    def is_on(self):
        value=self.data.get(self.key)
        return None if value is None else bool(value)


class TelemetryFlag(Flag):
    def __init__(self, entry, key, name, device_class):
        icon = 'mdi:car-door-lock' if 'lock' in key else 'mdi:car-info'
        super().__init__(entry, key, name, icon)
        self._attr_device_class = device_class

    @property
    def is_on(self):
        value = self.data.get(self.key)
        return value if type(value) is bool else None

    @property
    def extra_state_attributes(self):
        attrs = super().extra_state_attributes
        attrs['source'] = 'Licht_Anf_01 (request)' if self.key.startswith('light_') else 'ZV_02'
        return attrs
