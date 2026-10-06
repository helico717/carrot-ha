const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.JOURNAL_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const module=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-vehicle-journal.js','utf8');
 await page.setContent('<main id="mount"></main>');
 const view=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-view-state.js','utf8').replace(/export function/g,'function');
 await page.addScriptTag({content:view+'\n'+module.replace("import {preserveView} from './carrot-view-state.js';",'').replace(/export default VehicleJournal;/,'').replace('export class VehicleJournal','class VehicleJournal')});
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
 await root.locator('#tab1').click();await root.locator('#metric').selectOption('drive_energy_kwh');
 if(!(await root.locator('#chart path').getAttribute('d')))throw Error('chart did not update');
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
 // HA may populate a panel before its async module finishes defining it.
 await page.evaluate(()=>{
  const panel=document.createElement('carrot-journal-panel');
  panel.hass=document.querySelector('carrot-vehicle-journal')._hass;
  document.getElementById('mount').append(panel);
 });
 const panelModule=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-journal-panel.js','utf8');
 await page.addScriptTag({content:panelModule.slice(panelModule.indexOf('class CarrotJournalPanel'))});
 await page.locator('carrot-journal-panel').locator('#headline').filter({hasText:'km'}).waitFor();
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();console.log('Journal browser checks: tabs, chart, manual save, escaping, desktop/mobile layout OK');
})().catch(e=>{console.error(e);process.exit(1)});
