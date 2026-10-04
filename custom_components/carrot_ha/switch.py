"""Local HA control of continuous raw CAN files; no cloud writes."""
from homeassistant.components.switch import SwitchEntity
from homeassistant.const import EntityCategory
from homeassistant.helpers.dispatcher import async_dispatcher_send
from .entity import VehicleEntity

async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([CanCaptureSwitch(entry)])

class CanCaptureSwitch(VehicleEntity, SwitchEntity):
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, entry):
        self.configure(entry, 'can_capture_enabled', '원시 CAN 기록 수집', 'mdi:record-rec')

    @property
    def is_on(self):
        return self.runtime['can_capture'].status()['enabled']

    @property
    def extra_state_attributes(self):
        state = self.runtime['can_capture'].status()
        return {key: state[key] for key in ('continuous', 'until', 'limit_bytes', 'retention')}

    async def async_turn_on(self, **kwargs):
        if not self.entry.options.get('terminal_enabled'):
            raise ValueError('Configure HA remote terminal discovery first')
        await self.hass.async_add_executor_job(self.runtime['can_capture'].start)
        async_dispatcher_send(self.hass, 'carrot_ha' + self.entry.entry_id)

    async def async_turn_off(self, **kwargs):
        await self.hass.async_add_executor_job(self.runtime['can_capture'].stop)
        async_dispatcher_send(self.hass, 'carrot_ha' + self.entry.entry_id)
