import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeConsecutiveTrips, tripDays, tripEfficiency} from '../custom_components/carrot_ha/frontend/carrot-trip-days.js';
globalThis.HTMLElement=class {attachShadow(){return {};}};
globalThis.customElements={get(){},define(){}};
const day=tripDays([], 'Asia/Seoul').at(-1).key;
const t=(id,start,end,data={})=>({event_id:id,data:{started_at:`${day}T${start}:00+09:00`,ended_at:`${day}T${end}:00+09:00`,duration_s:600,distance_m:10000,...data}});
for(const lang of ['ko','en']){
  const Card=(await import(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`)).default;
  test(`${lang}: history never substitutes current SOC or recent efficiency; missing pills are red`,()=>{
    const c=new Card(); c._hass={config:{time_zone:'Asia/Seoul'}}; c.trips=[t('missing','08:00','08:10')];c.tripDay=day;
    c.v={soc_percent:92,recent_efficiency_kpl:6.1};
    const html=c.tripHistory(true);
    assert.match(html,/trip-soc trip-missing/);assert.match(html,/trip-eff trip-missing/);
    assert.doesNotMatch(html,/92%|6\.1 km\/kWh/);
    c.v.soc_percent=51; assert.equal(c.tripHistory(true),html);
    c.trips=[t('measured','08:00','08:10',{start_soc_percent:71,end_soc_percent:48,energy_wh:1500})];
    assert.match(c.tripHistory(true),/71% → 48%/);assert.match(c.tripHistory(true),/6[.,]7 km\/kWh/);
  });
  test(`${lang}: empty trip day or missing GPS never displays the current parked position`,async()=>{
    const c=new Card(),node={innerHTML:'',isConnected:true};c.shadowRoot={querySelector:()=>node};c.tab='trips';c.selected=null;
    await c.drawMap([],{parking_latitude:37,parking_longitude:127},[]);
    assert.match(node.innerHTML,/주행 기록이 없습니다|No trips recorded/);assert.ok(!c.map);
    await c.drawMap([],{parking_latitude:37,parking_longitude:127},[{route:[]}]);
    assert.match(node.innerHTML,/위치 기록이 없습니다|No location recorded/);
  });
}
test('merge uses all matched energies and strict outer boundaries, never parking energy or partial energy',()=>{
  const raw=[t('a','08:00','08:10',{start_soc_percent:70,end_soc_percent:68,energy_wh:1000,start_battery_wh:50000,end_battery_wh:49000}),
    t('b','08:40','08:50',{start_soc_percent:67,end_soc_percent:64,energy_wh:2000,start_battery_wh:48000,end_battery_wh:46000})];
  const d=mergeConsecutiveTrips(raw,'Asia/Seoul')[0].data;
  assert.equal(d.start_soc_percent,70);assert.equal(d.end_soc_percent,64);assert.equal(d.energy_wh,3000);assert.equal(d.efficiency_km_kwh,6.7);
  assert.equal(mergeConsecutiveTrips([...raw,raw[1]],'Asia/Seoul')[0].data.distance_m,20000);
  delete raw[0].data.start_soc_percent; delete raw[0].data.start_battery_wh;
  delete raw[1].data.end_soc_percent;delete raw[1].data.end_battery_wh;delete raw[1].data.energy_wh;
  const missing=mergeConsecutiveTrips(raw,'Asia/Seoul')[0].data;
  assert.equal(missing.start_soc_percent,undefined);assert.equal(missing.end_soc_percent,null);assert.equal(missing.energy_wh,null);
  assert.equal(tripEfficiency(missing),null);
  raw[1].data.started_at=`${day}T08:40:01+09:00`;
  assert.equal(mergeConsecutiveTrips(raw,'Asia/Seoul').length,2);
});
