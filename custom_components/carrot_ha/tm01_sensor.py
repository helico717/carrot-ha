"""Trial observations do not claim ECU command acceptance."""
from homeassistant.components.sensor import SensorEntity
from homeassistant.const import EntityCategory
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from .tm01_experiment import controller, device_info


class Tm01TrialSensor(SensorEntity):
    _attr_should_poll = False
    _attr_has_entity_name = True
    _attr_name = '잠금 시험 결과'
    _attr_icon = 'mdi:flask-outline'
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, entry):
        self.entry = entry
        self._attr_unique_id = entry.data['device_id']+'_tm01_trial_result'
        self._attr_device_info = device_info(entry)

    @property
    def native_value(self):
        code = controller(self.hass, self.entry).result['status']
        return {'not_tested': '미시험', 'running': '시험 중',
                'blocked': '조건 미충족으로 중단',
                'lock_transition_observed': '잠금 상태 변화 관측',
                'target_state_observed': '목표 상태 관측 · 인과 미확인',
                'panda_echo_no_target_state': 'Panda 반환 확인 · 차량 반응 미확인',
                'published_delivery_unconfirmed': '요청 발행 · 전달 미확인',
                'delivery_or_result_unconfirmed': '연결 또는 결과 미확인',
                'restoration_unconfirmed': '원래 설정 복귀 미확인',
                'receive_only_completed': '수신 점검 완료'}.get(code, code)

    @property
    def extra_state_attributes(self):
        return controller(self.hass, self.entry).result

    async def async_added_to_hass(self):
        self.async_on_remove(async_dispatcher_connect(self.hass, 'carrot_tm01_'+self.entry.entry_id, self.async_write_ha_state))
