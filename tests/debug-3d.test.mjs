import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SCENARIOS,DOORS} from '../custom_components/carrot_ha/frontend/carrot-debug-3d.js';
import {vehicleViewState} from '../custom_components/carrot_ha/frontend/carrot-vehicle-3d.js';
test('all 34 scenarios have unique identifiers and explicit expected views',()=>{
 assert.equal(SCENARIOS.length,34);assert.equal(new Set(SCENARIOS.map(s=>s.id)).size,34);
 const expected=['front',...Array(6).fill('top'),...Array(4).fill('drive'),'front',...Array(10).fill('charge'),'front','front','drive','drive',...Array(3).fill('top'),'front','fallback','fallback','front','front'];
 assert.deepEqual(SCENARIOS.map(s=>s.expected),expected);
});
test('scenario inputs use production vehicleViewState with driving, then charging, precedence',()=>{
 for(const s of SCENARIOS){if(s.expected==='fallback')continue;
  const keys=['door_driver_open','door_passenger_open','door_rear_driver_open','door_rear_passenger_open','trunk_open'];
  const raw=Object.fromEntries(DOORS.map((k,i)=>[keys[i],!!s.patch.doors?.[k]]));
  const mode=s.patch.mode;
  const state=vehicleViewState(raw,{key:mode==='driving'?'driving':mode==='charging'?'charging':'parked'},false);
  const view=state.driving?'drive':state.charging?'charge':state.trunk||Object.values(state.doors).some(Boolean)?'top':'front';
  assert.equal(view,s.expected,s.id);
 }
});
test('charging scenarios cover slow and fast sweeps, the 11 kW boundary, SOC extremes, doors and lamp restore',()=>{
 const byId=Object.fromEntries(SCENARIOS.map(s=>[s.id,s]));
 const slow=['charge-ac7','charge-ac11'],fast=['charge-dc50','charge-dc150'];
 for(const id of slow){assert.equal(byId[id].expect.sweep,'slow',id);assert.ok(byId[id].patch.powerKw<=11,id);}
 for(const id of fast){assert.equal(byId[id].expect.sweep,'fast',id);assert.ok(byId[id].patch.powerKw>11,id);}
 assert.equal(byId['charge-ac11'].patch.powerKw,11,'11 kW is still the slow class');
 assert.ok(byId['charge-soc10'].patch.soc<=10&&byId['charge-soc95'].patch.soc>=95);
 assert.ok(Object.keys(byId['charge-all-open'].patch.doors).length===DOORS.length);
 // The headlamps follow charging, whatever the real low beam says, and return to it afterwards.
 assert.equal(byId['charge-lamp-off'].patch.lowBeam,false);assert.equal(byId['charge-lamp-off'].expect.lamp,1);
 assert.equal(byId['charge-end'].expect.lamp,0);assert.equal(byId['charge-end-real'].expect.lamp,1);
 assert.equal(byId['charge-to-drive'].expect.charging,false);
 for(const s of SCENARIOS.filter(s=>s.patch.mode==='charging'))assert.equal(s.expect.charging,true,s.id);
});
test('debug preserves inherited render and synchronizes the embed shadowRoot through production method',()=>{
 const debug=fs.readFileSync(new URL('../custom_components/carrot_ha/frontend/carrot-dashboard-debug.js',import.meta.url),'utf8');
 const ko=fs.readFileSync(new URL('../custom_components/carrot_ha/frontend/carrot-dashboard-ko.js',import.meta.url),'utf8');
 assert.match(debug,/const origRender = card.render.bind\(card\)/);assert.match(debug,/origRender\(\)/);
 assert.match(ko,/this\.syncVehicle3d\(v,state\)/);
 assert.match(ko,/m\.syncVehicle3d\(this,/);
 assert.match(debug,/simulatorMarkup\(\)/);assert.match(debug,/installSimulator\(this\)/);
});
