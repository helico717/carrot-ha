const fs = require('fs');
const path = require('path');

const filePath = '/Users/davidlim/Developer/carrot-ha/custom_components/carrot_ha/frontend/carrot-dashboard-ko.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldText = "`${metric('충전 상태',this._hass?.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state==='on'?'충전중':'충전 중이 아님','','ev-station')}${metric('이번 달 충전량',n(v.month_charge_kwh),'kWh','battery-plus')}${metric('완속 분류',n(v.month_slow_kwh),'kWh','power-plug')}${metric('급속 분류',n(v.month_fast_kwh),'kWh','flash')}`";
const newText = "`${metric('충전 상태',this._hass?.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state==='on'?'충전중':'충전 중이 아님','','ev-station')}${metric('이번 달 충전량',n(v.month_charge_kwh),'kWh','battery-plus')}${metric('이번 달 충전금액',n(v.month_charge_cost,0),'원','cash','추정치')}${metric('완속 분류',n(v.month_slow_kwh),'kWh','power-plug')}${metric('급속 분류',n(v.month_fast_kwh),'kWh','flash')}`";

if (content.includes(oldText)) {
  content = content.replace(oldText, newText);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Replacement successful');
} else {
  console.error('Old text not found in file');
  process.exit(1);
}
