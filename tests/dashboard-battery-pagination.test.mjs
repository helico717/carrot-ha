import {test} from 'node:test';
import assert from 'node:assert/strict';
globalThis.HTMLElement=class {attachShadow(){}};
for(const lang of ['ko','en']){
 const Card=(await import(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`)).default;
 test(`${lang}: pages align battery details and charges without requests and retain selection`,()=>{
  const c=new Card(); c._hass={config:{time_zone:'Asia/Seoul'}};c.render=()=>{c.batteryHistory();c.chargeHistory();};
  c.v.battery_history=Array.from({length:14},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,used:i===0?null:i,hours:Array(24).fill(null)}));
  c.charges=[{data:{started_at:'2026-10-07T01:00:00Z',energy_kwh:1,duration_s:60}}];
  let html=c.batteryHistory();assert.match(html,/<path d="m14 6-6 6 6 6"/);assert.match(html,/<path d="m10 6 6 6-6 6"/);assert.doesNotMatch(html,/>&(?:lt|gt);<\/button>/);assert.equal((html.match(/data-day=/g)||[]).length,7);assert.match(html,/data-day="13"/);assert.match(html,/data-battery-page="-1"[^>]*disabled/);
  c.moveBatteryPage(1);assert.equal(c.chargeDay,'2026-10-07');assert.equal(c.batteryDay,6);
  html=c.batteryHistory();assert.match(html,/data-day="0"/);assert.doesNotMatch(html,/data-day="7"/);assert.match(html,/data-battery-page="1"[^>]*disabled/);assert.equal(c.batteryChargeDays().at(-1).indices[0],0);
  c.chargeDay='2026-10-01';c.render();assert.equal(c.batteryDay,0);assert.equal(c.chargeDay,'2026-10-01');assert.match(c.batteryHistory(),/—/);
  c.moveBatteryPage(1);assert.equal(c.batteryPage,1);c.moveBatteryPage(-1);assert.equal(c.batteryPage,0);assert.equal(c.chargeDay,'2026-10-14');c.moveBatteryPage(-1);assert.equal(c.batteryPage,0);
  c.v.battery_history=c.v.battery_history.slice(-7);html=c.batteryHistory();assert.match(html,/data-battery-page="1"[^>]*disabled/);
 });
}
