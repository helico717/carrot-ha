import {test} from 'node:test';
import assert from 'node:assert/strict';
globalThis.HTMLElement=class {attachShadow(){return {};}};
globalThis.customElements={get(){},define(){}};
for(const lang of ['ko','en']){
 const Card=(await import(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`)).default;
 test(`${lang}: stale GPS does not hide charging; fresh movement and driving still block`,()=>{
  const c=new Card();c._hass={states:{},config:{time_zone:'Asia/Seoul'}};
  const v={charging:true,driving:false,speed_kph:6.5,gps_measured_at:'2026-10-10T07:58:37Z'};
  assert.equal(c.vehicleStatus(v).key,'charging');
  v.gps_measured_at=new Date().toISOString();assert.equal(c.vehicleStatus(v).key,'parked');
  v.speed_kph=null;v.driving=true;assert.equal(c.vehicleStatus(v).key,'driving');
  c.config={online_entity:'online'};c._hass.states.online={state:'off'};assert.equal(c.vehicleStatus(v).key,'offline');
 });
 test(`${lang}: estimated parking label and GPS timestamp appear in location view`,()=>{
  const c=new Card();c._hass={states:{},config:{time_zone:'Asia/Seoul'}};c.tab='parking';
  const v={driving:false,parking_latitude:37,parking_longitude:127,parking_at:'2026-10-10T07:59:27Z',parking_gps_at:'2026-10-10T07:58:36Z',parking_estimated:true};
  assert.match(c.overview(v),/주차 위치 추정 · 마지막 GPS 기준|Estimated parking · Last GPS fix/);
  const html=c.body(v,null,false);
  assert.match(html,/주차 위치 추정 · 마지막 GPS 기준|Estimated parking · Last GPS fix/);
  assert.match(html,/GPS 측정|GPS measured/);
  v.parking_estimated=false;assert.doesNotMatch(c.body(v,null,false),/주차 위치 추정|Estimated parking/);
 });
}
