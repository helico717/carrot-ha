import fs from 'node:fs';
import assert from 'node:assert/strict';
for (const lang of ['ko','en']) {
  const source=fs.readFileSync(new URL(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`,import.meta.url),'utf8');
  const body=source.match(/vehicleStatus\(v\)\{([\s\S]*?)\n  \}/)[1];
  const context={_hass:{states:{online:{state:'on'}}},config:{online_entity:'online'}};
  const state=new Function('v',body).bind(context);
  assert.equal(state({onroad:true,driving:false,charging:true}).key,'charging');
  assert.equal(state({onroad:true,driving:null,charging:null}).key,'unknown');
  assert.equal(state({onroad:true,driving:true,charging:false}).key,'driving');
  assert.equal(state({onroad:true}).key,'driving');
  assert.equal(state({driving:false,charging:true,stale:true}).key,'stale');
  assert.equal(state({driving:false,charging:true,measured_at:new Date(Date.now()-240000).toISOString()}).key,'stale');
  const stamp=new Date(Date.now()-600000).toISOString();
  const parked=state({driving:false,charging:null,stale:true,measured_at:stamp});
  assert.match(parked.label,lang==='ko'?/마지막 확인: 주차 · 측정 10분 전/:/Last known: parked · measured 10 min ago/);
  assert.match(state({driving:false,charging:true,stale:true,measured_at:stamp}).label,lang==='ko'?/마지막 확인: 충전/:/Last known: charging/);
  assert.match(state({driving:true,stale:true}).label,lang==='ko'?/마지막 확인: 주행/:/Last known: driving/);
  assert.match(state({driving:null,stale:true}).label,lang==='ko'?/현재 상태 확인 불가/:/Current state unknown/);
  assert.equal(state({driving:false,charging:true,measured_at:new Date().toISOString()}).key,'charging');
  context._hass.states.online.state='off';
  assert.equal(state({driving:false,charging:true,stale:true}).key,'offline');
  context._hass.states.online.state='unavailable';
  assert.equal(state({driving:false}).key,'unknown');
}
console.log('PASS: motion classification and freshness coexist in both languages');
