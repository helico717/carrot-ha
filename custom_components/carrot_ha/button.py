"""Explicit administrator-requested parked experiments, separate device."""
from homeassistant.components.button import ButtonEntity
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from .tm01_experiment import controller, device_info


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([Tm01Button(entry, 'lock', '잠금 요청', 'mdi:lock'),
                        Tm01Button(entry, 'unlock', '잠금해제 요청', 'mdi:lock-open')])


class Tm01Button(ButtonEntity):
    _attr_should_poll = False
    _attr_has_entity_name = True

    def __init__(self, entry, action, name, icon):
        self.entry, self.action = entry, action
        self._attr_unique_id = entry.data['device_id']+'_tm01_trial_'+action
        self._attr_name, self._attr_icon = name, icon
        self._attr_device_info = device_info(entry)

    @property
    def available(self):
        return controller(self.hass, self.entry).available

    async def async_added_to_hass(self):
        for signal in ('carrot_tm01_', 'carrot_terminal_'):
            self.async_on_remove(async_dispatcher_connect(self.hass, signal+self.entry.entry_id, self.async_write_ha_state))

    async def async_press(self):
        user_id = self._context.user_id if self._context else None
        user = await self.hass.auth.async_get_user(user_id) if user_id else None
        if user is None or not user.is_admin:
            raise HomeAssistantError('시험 버튼은 관리자 계정에서 직접 실행해야 합니다.')
        try:
            await controller(self.hass, self.entry).run(self.action)
        except (RuntimeError, TimeoutError) as exc:
            raise HomeAssistantError(str(exc)) from exc
