const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.JOURNAL_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const rawModule=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-vehicle-journal.js','utf8');
 const module=rawModule.slice(rawModule.indexOf('// HA-local EV journal.'));
 await page.setContent('<main id="mount"></main>');
 const view=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-view-state.js','utf8').replace(/export function/g,'function');
 await page.addScriptTag({content:fs.readFileSync('custom_components/carrot_ha/frontend/carrot-journal-design.js','utf8').replace('export const','const')+'\n'+view+'\n'+module.replace(/import \{journalDesign\}[^;]+;/,'').replace("import {preserveView} from './carrot-view-state.js';",'').replace(/export default VehicleJournal;/,'').replace('export class VehicleJournal','class VehicleJournal')});
 await page.evaluate(()=>{
   const daily=[{day:'2026-10-01',distance_km:42,energy_distance_km:42,drive_energy_kwh:8,battery_charge_kwh:20,charge_effective_krw:6000,drive_soc_used_pp:10}];
   const totals={distance_km:42,drive_energy_kwh:8,battery_charge_kwh:20,charge_effective_krw:6000,efficiency_km_kwh:5.25,energy_coverage_percent:100,total_cost_krw:51000,slow_count:1,fast_count:0,unknown_count:0,drive_soc_used_pp:10,categories:{charging:{actual_krw:6000,estimated_krw:6000,effective_krw:6000},maintenance:{actual_krw:45000,estimated_krw:0,effective_krw:45000}}};
   const records=[{id:'manual',version:1,origin:'manual',status:'active',kind:'expense',accounting_date:'2026-10-01',category:'maintenance',actual_krw:45000,memo:'<img src=x onerror=alert(1)>',input:{kind:'expense',date:'2026-10-01',category:'maintenance',actual_krw:45000}}];
   const card=document.createElement('carrot-vehicle-journal');document.getElementById('mount').append(card);card.setConfig({});
   window.saved=[];card.hass={callWS:async msg=>{
    if(msg.type.endsWith('/entries'))return [{entry_id:'entry',title:'내 차'}];
    if(msg.type.endsWith('/query'))return {totals,daily,records,record_count:3,timezone:'Asia/Seoul',has_more:false,status:{phase:'complete'},latest:{soc_percent:70,range_km:300}};
    window.saved.push(msg);return {id:msg.record_id,version:1};
   }};
 });
 const root=page.locator('carrot-vehicle-journal');
 await root.locator('#headline').filter({hasText:'42km'}).waitFor();
 if(await root.locator('#records img').count())throw Error('memo HTML executed');
 await root.locator('#tab1').click();
 if(await root.locator('.trend-card').count()!==6)throw Error('six trend metrics did not render');
 if(await root.locator('#message').getAttribute('class')==='error')throw Error('journal render error: '+await root.locator('#message').textContent());
 // Execute every metric; syntax checks cannot detect unresolved identifiers.
 await page.evaluate(()=>{
  const card=document.querySelector('carrot-vehicle-journal'),original=card.data;
  for(const scope of ['month','year']){
   card.scope=scope;card.$('month').value=scope==='year'?'2026':'2026-10';
   for(const previous of [null,{daily:original.daily,totals:{...original.totals,distance_km:21,battery_charge_kwh:10,efficiency_km_kwh:4,charge_effective_krw:2000,drive_soc_used_pp:5,fast_count:1,slow_count:0}}]){
    card.data={...original,previous};card.renderTrendsDashboard();
    if(card.shadowRoot.querySelectorAll('.trend-card').length!==6)throw Error('missing trend metrics: '+scope);
    if(card.shadowRoot.querySelectorAll('.trend-chart-svg').length!==6)throw Error('missing trend charts: '+scope);
    if(/NaN|undefined/.test(card.$('changingTrendsGrid').innerHTML+card.$('stableTrendsGrid').innerHTML))throw Error('invalid trend value: '+scope);
    if(previous&&!card.$('changingTrendsGrid').querySelector('.trend-card'))throw Error('period comparison not rendered: '+scope);
    for(const change of card.shadowRoot.querySelectorAll('.trend-change')){
     if(!/^[0-9.]+% (상승|감소)$/.test(change.textContent))throw Error('invalid change emphasis');
     if(getComputedStyle(change).color!==getComputedStyle(change.closest('.trend-card').querySelector('.trend-metric-name')).color)throw Error('change color does not match metric');
    }
    if(previous&&!card.shadowRoot.querySelector('.trend-change'))throw Error('missing change emphasis');
   }
  }
  card.data={...original,daily:[]};card.renderTrendsDashboard();
  if(!card.$('changingTrendsGrid').textContent.includes('데이터가 아직 없어요'))throw Error('missing empty trend state');
  card.scope='month';card.$('month').value='2026-10';card.data=original;card.renderTrendsDashboard();
 });
 await root.locator('#add').click();
 await root.locator('input[name="date"]').fill('2026-09-02');await root.locator('#actualKrw').fill('123');
 await root.locator('#save').click();
 if((await page.evaluate(()=>window.saved[0]?.payload.actual_krw))!==123)throw Error('manual record not saved');
 await root.locator('#tab0').click();
 await page.evaluate(async()=>{
  const card=document.querySelector('carrot-vehicle-journal'),original=card._hass.callWS;
  card.$('month').value='2026-10';
  let release;const gate=new Promise(resolve=>{release=resolve});let first=true;
  card._hass.callWS=async msg=>{const result=await original(msg);if(msg.type.endsWith('/query')){if(first){first=false;await gate;}if(msg.from==='2026-09-01')return {...result,totals:{...result.totals,distance_km:23}};}return result;};
  const pending=card.load(true);await Promise.resolve();
  card.$('month').value='2026-09';card.$('month').dispatchEvent(new Event('change'));
  release();await pending;
 });
 await root.locator('#headline').filter({hasText:'23km'}).waitFor();
 await page.evaluate(async()=>{const card=document.querySelector('carrot-vehicle-journal');card.$('month').value='2026-10';await card.load(true);const style=card.shadowRoot.querySelector('style');window.scrollTo(0,100);const before=scrollY;await card.load(true);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);if(scrollY!==before||card.shadowRoot.querySelector('style')!==style)throw Error('refresh lost reading position or stylesheet');});
 await root.locator('[data-scope=year]').click();
 await root.locator('#month').fill('2024');await root.locator('#month').dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelector('carrot-vehicle-journal').data && !document.querySelector('carrot-vehicle-journal').loading);
 const leap=await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').range());
 if(leap.from!=='2024-01-01'||leap.to!=='2024-12-31'||leap.previousTo!=='2023-12-31')throw Error('year range incorrect');
 // Daily scope was removed from the UI; day/week/month chart periods remain.
 await root.locator('[data-scope=month]').click();await root.locator('#month').fill('2026-10');await root.locator('#month').dispatchEvent('change');
 await page.waitForFunction(()=>!document.querySelector('carrot-vehicle-journal').loading);
 await root.locator('#legendRow [data-cat=maintenance]').click();
 if(await root.locator('#legendRow [data-cat=maintenance]').getAttribute('aria-pressed')!=='true')throw Error('comparison filter failed');
 await root.locator('#legendRow [data-cat=maintenance]').click();
 if(await root.locator('#recordForm select[name=category] option').count()!==4)throw Error('expense modal categories incorrect');
 fs.mkdirSync('.preview/journal',{recursive:true});
 await page.screenshot({path:'.preview/journal/desktop.png',fullPage:true});
 for(const width of [850,520,360,320]){
  await page.setViewportSize({width,height:1100});
  await page.waitForTimeout(150);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw Error('page horizontal overflow at '+width);
  await root.locator('#tab1').click();await root.locator('#tab0').click();
  if(width===360)await page.screenshot({path:'.preview/journal/mobile.png',fullPage:true});
 }
 // Async panel property replay is covered by loader-update.cjs with real modules.
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();console.log('Journal browser checks: tabs, chart, manual save, escaping, desktop/mobile layout OK');
})().catch(e=>{console.error(e);process.exit(1)});
