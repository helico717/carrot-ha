import fs from 'node:fs';
import assert from 'node:assert/strict';
for (const lang of ['ko','en']) {
  const source=fs.readFileSync(new URL(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`,import.meta.url),'utf8');
  const body=source.match(/vehicleStatus\(v\)\{([\s\S]*?)\n  \}/)[1];
  const state=new Function('v',body).bind({_hass:{states:{online:{state:'on'}}},config:{online_entity:'online'}});
  assert.equal(state({onroad:true,driving:false,charging:true}).key,'charging');
  assert.equal(state({onroad:true,driving:null,charging:null}).key,'unknown');
  assert.equal(state({onroad:true,driving:true,charging:false}).key,'driving');
  assert.equal(state({onroad:true}).key,'driving');
  assert.equal(state({driving:false,charging:true,stale:true}).key,'stale');
  assert.equal(state({driving:false,charging:true,measured_at:new Date(Date.now()-240000).toISOString()}).key,'stale');
}
console.log('PASS: motion classification and freshness coexist in both languages');
