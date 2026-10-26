import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SCENARIOS,DOORS} from '../custom_components/carrot_ha/frontend/carrot-debug-3d.js';
import {vehicleViewState} from '../custom_components/carrot_ha/frontend/carrot-vehicle-3d.js';
test('all 22 scenarios have unique identifiers and explicit expected views',()=>{
 assert.equal(SCENARIOS.length,22);assert.equal(new Set(SCENARIOS.map(s=>s.id)).size,22);
 const expected=['front',...Array(6).fill('top'),...Array(4).fill('drive'),'front','top','drive',...Array(3).fill('top'),'front','fallback','fallback','front','front'];
 assert.deepEqual(SCENARIOS.map(s=>s.expected),expected);
});
test('scenario inputs use production vehicleViewState with driving precedence',()=>{
 for(const s of SCENARIOS){if(s.expected==='fallback')continue;
  const keys=['door_driver_open','door_passenger_open','door_rear_driver_open','door_rear_passenger_open','trunk_open'];
  const raw=Object.fromEntries(DOORS.map((k,i)=>[keys[i],!!s.patch.doors?.[k]]));
  const state=vehicleViewState(raw,{key:s.patch.mode==='driving'?'driving':'parked'},false);
  assert.equal(state.driving?'drive':state.trunk||Object.values(state.doors).some(Boolean)?'top':'front',s.expected,s.id);
 }
});
test('debug preserves inherited render and synchronizes the embed shadowRoot through production method',()=>{
 const debug=fs.readFileSync(new URL('../custom_components/carrot_ha/frontend/carrot-dashboard-debug.js',import.meta.url),'utf8');
 const ko=fs.readFileSync(new URL('../custom_components/carrot_ha/frontend/carrot-dashboard-ko.js',import.meta.url),'utf8');
 assert.match(debug,/const origRender = card.render.bind\(card\)/);assert.match(debug,/origRender\(\)/);
 assert.match(ko,/this\.syncVehicle3d\(v,state\)/);
 assert.match(ko,/m\.syncVehicle3d\(this,/);
 assert.match(debug,/simulatorMarkup\(\)/);assert.match(debug,/installSimulator\(this\)/);
});
