import {test} from 'node:test';
import assert from 'node:assert/strict';
globalThis.HTMLElement=class {attachShadow(){}};
for(const lang of ['ko','en']){
 const Card=(await import(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`)).default;
 test(`${lang}: quarter-hour detail keeps weekly summary and separates charging runs`,()=>{
  const c=new Card();c._hass={config:{time_zone:'UTC'}};
  const days=Array.from({length:14},(_,i)=>({date:`2026-11-${String(i+3).padStart(2,'0')}`,used:25,interval_minutes:15,hours:Array.from({length:96},()=>({soc:60,driving:true})),charge_hours:Array(96).fill(false)}));
  days[13].charge_hours[36]=days[13].charge_hours[38]=true;c.v={battery_history:days};
  const html=c.batteryHistory();assert.equal((html.match(/class="hour /g)||[]).length,96);assert.equal((html.match(/class="charge-run-wrap"/g)||[]).length,2);assert.match(html,/09:15–09:30/);assert.match(html,/23:45–24:00/);assert.match(html,/hours quarter-hour/);
  const weekly=html.match(/<div class="week-bars">(.*?)<div class="axis">/s)[1];
  c.v.battery_history=days.map(d=>({...d,interval_minutes:undefined,hours:d.hours.slice(0,24),charge_hours:Array(24).fill(false)}));
  const legacy=c.batteryHistory();assert.equal((legacy.match(/class="hour /g)||[]).length,24);assert.match(legacy,/23:00–24:00/);assert.equal(legacy.match(/<div class="week-bars">(.*?)<div class="axis">/s)[1],weekly);
 });
}
