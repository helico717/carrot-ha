import assert from 'node:assert/strict';
import {assistState,assistScope,assistPanelHtml,ensureAssist} from '/private/tmp/carrot-assist-default-preview/frontend/carrot-assist-stats.js';
const all={measured:true,since:'2026-11-15T00:00:00Z',trips:2,total:{ratio:.6,assist_m:6000,manual_m:4000},days:[{date:'2026-11-16',ratio:0,assist_m:0,manual_m:4000}],months:[],current_streak_days:0,best_streak_days:1};
const calls=[];const card={tripDay:'2026-11-16',device:{entry_id:'test'},_hass:{config:{time_zone:'Asia/Seoul'},callWS:async m=>{calls.push(m.period);return m.period==='all'?all:{measured:true};}}};
await ensureAssist(card,1000);assert.equal(assistScope(card),'day');assert.deepEqual(calls,['all','day']);
await ensureAssist(card,2000);assert.deepEqual(calls,['all','day']);
let html=assistPanelHtml(card,'ko',new Date('2026-11-16T03:00:00Z'));assert.match(html,/0\.0<small>/);
assistState(card).scope='all';assert.equal(assistScope(card),'all');assistPanelHtml(card);assert.equal(assistScope(card),'all');
card.tripDay='2026-11-15';assert.equal(assistScope(card),'all');
card.tripDay='2026-11-16';assert.equal(assistScope(card),'day');
all.days[0].active=true;html=assistPanelHtml(card);assert.match(html,/<svg viewBox="0 0 24 24" aria-hidden="true"/);assert(!html.includes('✓'));
for(const lang of ['ko','en'])assert.match(assistPanelHtml(card,lang),/stroke-width:11/);
console.log('PASS date-first, no-data fallback, 0% record, explicit choice retention, date-change defaults, SVG check, wider gauge, request coalescing');

assert.equal(assistState(card).chart,'day');
for(const lang of ['ko','en']){
 for(const selected of ['2026-11-16','2026-11-15']){
  card.tripDay=selected;const h=assistPanelHtml(card,lang);
  assert.match(h,/data-assist-chart="day" class="on"/);
  assert.match(h,/as-bars dense/);
 }
}
assistState(card).chart='month';assistPanelHtml(card);assert.equal(assistState(card).chart,'month');
console.log('PASS daily chart default with/without selected-day records; explicit monthly choice remains unchanged');
