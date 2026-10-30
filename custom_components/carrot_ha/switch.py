"""Local HA control of continuous raw CAN files; no cloud writes."""
from homeassistant.components.switch import SwitchEntity
from homeassistant.const import EntityCategory
from homeassistant.helpers.dispatcher import async_dispatcher_send
from .entity import VehicleEntity

async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([CanCaptureSwitch(entry), DrivingLogTransferSwitch(entry)])


class DrivingLogTransferSwitch(VehicleEntity, SwitchEntity):
    def __init__(self, entry):
        self.configure(entry, 'driving_log_transfer', '주행 영상·상세 로그 자동 전송', 'mdi:file-upload-outline')

    async def async_added_to_hass(self):
        from .driving_logs.transfer_policy import policy_for
        await policy_for(self.hass, self.runtime)
        await super().async_added_to_hass()

    @property
    def is_on(self):
        return self.runtime.get('driving_log_transfer_policy', {}).get('enabled', False)

    async def _set(self, enabled):
        from .driving_logs.transfer_policy import set_enabled
        await set_enabled(self.hass, self.runtime, enabled)
        async_dispatcher_send(self.hass, 'carrot_ha' + self.entry.entry_id)

    async def async_turn_on(self, **kwargs):
        await self._set(True)

    async def async_turn_off(self, **kwargs):
        await self._set(False)

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
