import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-debug.js','utf8');
const context=vm.createContext({HTMLElement:class {},Date,console});
vm.runInContext(source.replace('export const DEBUG_FRESHNESS','const DEBUG_FRESHNESS').replace('export const DEBUG_MODES','const DEBUG_MODES').replace('export function debugDisplay','function debugDisplay').replace('export default class CarrotDebugDashboard','class CarrotDebugDashboard')+'\nglobalThis.api={debugDisplay,CarrotDebugDashboard,DEBUG_MODES};',context);
const {debugDisplay,CarrotDebugDashboard}=context.api;
const now=Date.now(), stamp=seconds=>new Date(now-seconds*1000).toISOString();
const raw={measured_at:stamp(0),last_received:stamp(30),last_sync:stamp(0),cloud_status:'ok',charging:true,onroad:false,charge_power_w:9900,charge_power_kw:9.9,eta_100:stamp(-100),time_to_100_s:100,speed_kph:0,soc_percent:74,latitude:37,longitude:127,gps_measured_at:stamp(0)};
assert.equal(debugDisplay(raw,now).display_state,'charging');
const stale=debugDisplay({...raw,measured_at:stamp(2400),onroad:true},now);
assert.equal(stale.display_state,'stale');
assert.equal(stale.connection_state,'online');
for(const k of ['charge_power_w','charge_power_kw','eta_100','time_to_100_s','speed_kph','charging'])assert.equal(stale[k],raw[k],k);
assert.equal(stale.onroad,true);assert.equal(stale.soc_percent,74);
assert.equal(raw.charge_power_w,9900);
assert.equal(debugDisplay({...raw,measured_at:null},now).display_state,'unknown');
assert.equal(debugDisplay({...raw,measured_at:stamp(-1)},now).display_state,'unknown');
assert.equal(debugDisplay({...raw,measured_at:stamp(180)},now).display_state,'charging');
assert.equal(debugDisplay({...raw,measured_at:stamp(181)},now).display_state,'stale');
assert.equal(debugDisplay({...raw,last_received:stamp(300)},now).display_state,'offline');
assert.equal(debugDisplay({...raw,cloud_status:'error'},now).display_state,'connection_unknown');
assert.equal(debugDisplay({...raw,stale:true},now).display_state,'stale');
// Exercise actual simulation generator and transitions; no HA APIs exist on this stub.
const debug=Object.create(CarrotDebugDashboard.prototype);
debug.state={mode:'charging',soc:74,powerKw:9.9,lang:'ko'};
debug.dashCard={v:{},render(){}};debug.updateInspectorReadout=()=>{};
debug.applyDebugTelemetry();assert.equal(debug.lastGood.mode,'charging');
const healthy={...debug.dashCard.v};
debug.state.mode='stale';debug.applyDebugTelemetry();
for(const k of ['soc_percent','charge_power_w','eta_100','time_to_100_s','onroad','charging','parking_at','outside_temp_c','aux_voltage'])assert.equal(debug.dashCard.v[k],healthy[k],k);
assert.equal(debug.dashCard.v.display_state,'stale');
assert.equal(debug.dashCard.v.last_confirmed_state,'charging');
assert.equal(debug.dashCard.v.debug_raw.charging,true);
assert.equal(debug.dashCard.v.debug_raw.debug_raw,undefined);
const measured=debug.dashCard.v.measured_at;
debug.applyDebugTelemetry();assert.equal(debug.dashCard.v.measured_at,measured);
debug.state.mode='cloud_error';debug.applyDebugTelemetry();assert.equal(debug.dashCard.v.display_state,'connection_unknown');
debug.state.mode='charging';debug.applyDebugTelemetry();assert.equal(debug.dashCard.v.display_state,'charging');assert.equal(debug.dashCard.v.charge_power_w,9900);
debug.state.mode='driving';debug.applyDebugTelemetry();
debug.state.mode='stale';debug.applyDebugTelemetry();assert.equal(debug.dashCard.v.last_confirmed_state,'driving');assert.equal(debug.dashCard.v.onroad,true);

// Verify simulated battery_history for charging tab
debug.state.mode='charging';debug.state.soc=80;debug.applyDebugTelemetry();
assert.equal(Array.isArray(debug.dashCard.v.battery_history),true);
assert.equal(debug.dashCard.v.battery_history.length,7);
const todayHistory=debug.dashCard.v.battery_history[6];
assert.equal(todayHistory.hours.length,24);
assert.equal(todayHistory.charge_hours.length,24);
const currHour=new Date().getHours();
assert.equal(todayHistory.hours[currHour].charging,true);
assert.equal(todayHistory.hours[currHour].soc,80);

console.log('Debug freshness: thresholds, raw isolation, expiry, last healthy state, outage, recovery and battery history passed.');

assert.equal(source.includes('debug-freshness-notice'),false);
assert.equal(source.includes('debug-last-value'),false);

assert.equal(context.api.DEBUG_MODES.length,7);
for(const item of context.api.DEBUG_MODES){debug.state.mode=item.mode;debug.applyDebugTelemetry();assert.equal(debug.dashCard.v.display_state,item.key,item.mode);}
assert.equal(source.includes('btnModeRecover'),false);
assert.equal(source.includes('btnModeConflict'),false);
