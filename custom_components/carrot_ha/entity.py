from homeassistant.helpers.dispatcher import async_dispatcher_connect
from .vehicle import values
from .telemetry import OPTIONAL_FIELDS
from .entity_migration import ESTIMATED_OBJECT_IDS, comma_device_info

class VehicleEntity:
    _attr_should_poll = False
    _attr_has_entity_name = True
    def configure(self, entry, key, name, icon):
        self.entry, self.key = entry, key
        self._attr_name, self._attr_icon = name, icon
        self._attr_unique_id = entry.data['device_id'] + '_' + key
        legacy = {'soc_percent':'battery','odometer_km':'odometer','outside_temp_c':'outside_temperature','aux_voltage':'auxiliary_voltage','charge_power_w':'estimated_charging_power'}
        self._object_id = ESTIMATED_OBJECT_IDS.get(key, legacy.get(key,key))
        self._attr_device_info = {'identifiers':{('carrot_ha',entry.data['device_id'])},'name':entry.title,'manufacturer':'Volkswagen','model':entry.options.get('vehicle_model','Volkswagen MEB')}
        if key.startswith('comma_'):
            self._attr_device_info = comma_device_info(entry)
    @property
    def suggested_object_id(self): return self._object_id
    @property
    def runtime(self): return self.hass.data['carrot_ha'][self.entry.entry_id]
    @property
    def data(self): return values(self.runtime)
    async def async_added_to_hass(self):
        self.async_on_remove(async_dispatcher_connect(self.hass,'carrot_ha'+self.entry.entry_id,self.async_write_ha_state))
        if self.key in OPTIONAL_FIELDS:
            from datetime import timedelta
            from homeassistant.helpers.event import async_track_time_interval
            from homeassistant.core import callback
            @callback
            def refresh(now):
                self.async_write_ha_state()
            self.async_on_remove(async_track_time_interval(self.hass, refresh, timedelta(seconds=30)))
    @property
    def extra_state_attributes(self):
        data=self.data
        return {'measured_at':data.get('measured_at'),'stale':data.get('stale'),'field_measured_at':(data.get('field_measured_at') or {}).get(self.key)}
