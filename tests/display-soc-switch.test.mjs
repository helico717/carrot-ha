import test from 'node:test';
import assert from 'node:assert/strict';
import {tripSoc, tripDisplayEnergyWh, mergeConsecutiveTrips} from '../custom_components/carrot_ha/frontend/carrot-trip-days.js';

test('CAN display boundaries win over Wh calibration without altering display energy',()=>{
  const data={start_battery_wh:50000,end_battery_wh:48000,
    start_soc_percent:80,end_soc_percent:78.5,
    start_display_soc_percent:80,end_display_soc_percent:78.5,
    start_soc_source:'can_0x14a_byte19',end_soc_source:'can_0x14a_byte19'};
  assert.equal(tripSoc(data,'start',64),80);
  assert.equal(tripSoc(data,'end',64),78.5);
  assert.equal(tripDisplayEnergyWh(data,64),2000);
  const missingWh={...data,start_battery_wh:null,end_battery_wh:null};
  assert.equal(tripDisplayEnergyWh(missingWh,64),null);
  assert.equal(tripDisplayEnergyWh({...missingWh,start_energy_soc_percent:70,end_energy_soc_percent:68},64),1280);
});

test('merged CAN display SOC retains the final outer endpoint',()=>{
  const event=(id,start,end,a,b)=>({event_id:id,observed_at:end,data:{started_at:start,ended_at:end,
    duration_s:60,distance_m:1000,start_soc_percent:a,end_soc_percent:b,
    start_display_soc_percent:a,end_display_soc_percent:b,start_soc_source:'can_0x14a_byte19',end_soc_source:'can_0x14a_byte19'}});
  const merged=mergeConsecutiveTrips([
    event('a','2026-10-28T00:00:00Z','2026-10-28T00:01:00Z',80,79.5),
    event('b','2026-10-28T00:02:00Z','2026-10-28T00:03:00Z',79.5,78.5)
  ],'Asia/Seoul');
  assert.equal(merged.length,1);
  assert.equal(tripSoc(merged[0].data,'start',64),80);
  assert.equal(tripSoc(merged[0].data,'end',64),78.5);
});
