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
 if(await root.locator('.trend-card').count()!==13)throw Error('six trend metrics did not render');
 if(await root.locator('#message').getAttribute('class')==='error')throw Error('journal render error: '+await root.locator('#message').textContent());
 // Execute every metric; syntax checks cannot detect unresolved identifiers.
 await page.evaluate(()=>{
  const card=document.querySelector('carrot-vehicle-journal'),original=card.data;
  const trend=id=>card.shadowRoot.querySelector(`[data-trend="${id}"]`);
  if(!trend('cost100').textContent.includes('추정'))throw Error('missing estimated cost label');
  if(!trend('distance').querySelector('.trend-chart-avg-label').textContent.includes('42km'))throw Error('observed-day distance mean wrong');
  if(!trend('cost100').querySelector('.trend-chart-avg-label').textContent.includes('5,714원'))throw Error('cost per 100km wrong');
  if(!trend('soc100').querySelector('.trend-chart-avg-label').textContent.includes('23.8%'))throw Error('SOC per 100km wrong');
  if(!trend('per_charge').querySelector('.trend-chart-avg-label').textContent.includes('20kWh'))throw Error('charge mean wrong');
  if(!trend('charge_count').querySelector('.trend-chart-avg-label').textContent.includes('1회'))throw Error('charge count wrong');
  for(const scope of ['month','year']){
   card.scope=scope;card.$('month').value=scope==='year'?'2026':'2026-10';
   for(const previous of [null,{daily:original.daily,totals:{...original.totals,distance_km:21,battery_charge_kwh:10,efficiency_km_kwh:4,charge_effective_krw:2000,drive_soc_used_pp:5,fast_count:1,slow_count:0}}]){
    card.data={...original,previous};card.renderTrendsDashboard();
    if(card.shadowRoot.querySelectorAll('.trend-card').length!==13)throw Error('missing trend metrics: '+scope);
    if(card.shadowRoot.querySelectorAll('.trend-chart-svg').length<6)throw Error('missing trend charts: '+scope);
    if(/NaN|undefined/.test(card.$('changingTrendsGrid').innerHTML+card.$('stableTrendsGrid').innerHTML))throw Error('invalid trend value: '+scope);
    if(previous&&!card.$('changingTrendsGrid').querySelector('.trend-card'))throw Error('period comparison not rendered: '+scope);
    for(const change of card.shadowRoot.querySelectorAll('.trend-change')){
     if(!/^[0-9.,]+(km|kWh|km\/kWh|원|%|회) (증가|감소)$/.test(change.textContent))throw Error('invalid change emphasis');
     if(getComputedStyle(change).color!==getComputedStyle(change.closest('.trend-card').querySelector('.trend-metric-name')).color)throw Error('change color does not match metric');
    }
    if(previous&&!card.shadowRoot.querySelector('.trend-change'))throw Error('missing change emphasis');
    for(const item of card.shadowRoot.querySelectorAll('.trend-card')){
     const name=item.querySelector('.trend-metric-name'),headline=item.querySelector('.trend-headline');
     if(parseFloat(getComputedStyle(name).fontSize)<=parseFloat(getComputedStyle(headline).fontSize))throw Error('metric title must be larger than headline');
     for(const direction of headline.querySelectorAll('.trend-direction')){
      if(!/^(증가|감소|일관)$/.test(direction.textContent)||getComputedStyle(direction).color!==getComputedStyle(name).color)throw Error('headline direction emphasis incorrect');
     }
     if(previous&&!headline.querySelector('.trend-direction'))throw Error('missing headline direction emphasis');
     if(item.textContent.includes('안정적인 패턴'))throw Error('legacy stable wording remains');
     const summary=item.querySelector('.trend-card-summary').textContent;
     const metricId=item.dataset.trend;
     if(metricId==='charge_rate'||metricId==='cost100'||metricId==='total_cost'||metricId.startsWith('cost_')){
      for(const text of [summary,...[...item.querySelectorAll('.trend-chart-avg-label,svg title')].map(el=>el.textContent)]){
       if(/\d{4,}\s*원/.test(text))throw Error('currency grouping missing: '+text);
      }
     }
     if(/기록이 있는 날|기간 충전 단가|실제·추정 비용|누적 지출|주행거리당 SOC|기록 범위/.test(summary))throw Error('unrequested explanatory text remains');
     if(previous&&headline.querySelector('.trend-direction')?.textContent!=='일관'&&!/대비 [0-9.,]+(km|kWh|km\/kWh|원|%|회) (증가|감소)했어요\.$/.test(summary))throw Error('comparison summary must contain only comparison data');
    }
   }
  }
  card.data={...original,daily:[]};card.renderTrendsDashboard();
  if(!card.$('changingTrendsGrid').textContent.includes('데이터가 아직 없어요'))throw Error('missing empty trend state');
  card.scope='month';card.$('month').value='2026-10';card.data=original;card.renderTrendsDashboard();
  const expected={efficiency:'평균 전비',charge_rate:'kWh당 충전 단가',distance:'하루 평균 주행거리',charge_kwh:'하루 평균 배터리 충전량',drive_soc:'하루 평균 주행 배터리 사용률',fast_ratio:'완속·급속 충전 중 급속 충전 비율',cost100:'100km를 달리는 데 드는 충전 비용 (추정)',total_cost:'선택한 달의 총 차량 지출',charge_count:'선택한 달의 총 충전 횟수',per_charge:'충전 1회당 평균 배터리 충전량',soc100:'100km를 달릴 때 사용한 배터리 비율'};
  for(const [id,title] of Object.entries(expected))if(trend(id).querySelector('.trend-metric-name').textContent!==title)throw Error('incorrect approved title: '+id);
 });
 // Date buttons follow the selected month/year, reset ledger pagination, and retain the tab.
 const loaded=()=>page.waitForFunction(()=>!document.querySelector('carrot-vehicle-journal').loading);
 await root.locator('#month').fill('2025-12');await root.locator('#month').dispatchEvent('change');await loaded();
 await page.evaluate(()=>{document.querySelector('carrot-vehicle-journal').offset=100;});
 await root.locator('#periodNext').click();await loaded();
 if(await root.locator('#month').inputValue()!=='2026-01')throw Error('next month failed at year boundary');
 if(await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').offset)!==0)throw Error('date move did not reset ledger page');
 await root.locator('#periodPrev').click();await loaded();
 if(await root.locator('#month').inputValue()!=='2025-12')throw Error('previous month failed at year boundary');
 await root.locator('#periodCurrent').click();await loaded();
 const today=await page.evaluate(()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}));
 if(await root.locator('#month').inputValue()!==today.slice(0,7))throw Error('current month failed');
 if(await root.locator('#month').getAttribute('max')!==today.slice(0,7)||!await root.locator('#periodNext').isDisabled())throw Error('current month permits future navigation');
 await root.locator('#month').evaluate(input=>{input.value='2099-12';});
 if(await root.locator('#month').evaluate(input=>input.validity.valid))throw Error('future calendar month accepted');
 if(await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').range())!==null)throw Error('future month query range accepted');
 await root.locator('#month').dispatchEvent('change');await loaded();
 if(await root.locator('#month').inputValue()!==today.slice(0,7))throw Error('future month direct input not corrected');
 await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').stepPeriod(1));
 if(await root.locator('#month').inputValue()!==today.slice(0,7))throw Error('future month step bypassed disabled button');
 if(await root.locator('#tab1').getAttribute('aria-selected')!=='true')throw Error('date navigation changed tab');
 await root.locator('[data-scope=year]').click();await loaded();
 if(await root.locator('#periodCurrent').textContent()!=='올해'||await root.locator('#periodPrev').getAttribute('aria-label')!=='이전 해')throw Error('year navigation labels incorrect');
 await root.locator('#month').fill('2024');await root.locator('#month').dispatchEvent('change');await loaded();
 await root.locator('#periodPrev').click();await loaded();
 if(await root.locator('#month').inputValue()!=='2023')throw Error('previous year failed');
 await root.locator('#periodNext').click();await loaded();
 if(await root.locator('#month').inputValue()!=='2024')throw Error('next year failed');
 await root.locator('#periodCurrent').click();await loaded();
 if(await root.locator('#month').inputValue()!==today.slice(0,4))throw Error('current year failed');
 if(await root.locator('#month').getAttribute('max')!==today.slice(0,4)||!await root.locator('#periodNext').isDisabled())throw Error('current year permits future navigation');
 await root.locator('#month').evaluate(input=>{input.value='2099';});
 if(await root.locator('#month').evaluate(input=>input.validity.valid))throw Error('future direct year input accepted');
 await root.locator('#month').dispatchEvent('change');await loaded();
 if(await root.locator('#month').inputValue()!==today.slice(0,4))throw Error('future year not corrected');
 await root.locator('[data-scope=month]').click();await loaded();
 await root.locator('#month').fill('2026-10');await root.locator('#month').dispatchEvent('change');await loaded();
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
 // Ledger filters must not mutate the briefing or its totals.
 await root.locator('#tab3').click();
 await page.evaluate(()=>{
  const card=document.querySelector('carrot-vehicle-journal');window.ledgerOriginal=card.data;window.ledgerCall=card._hass.callWS;
  const records=[{id:'trip',kind:'trip',origin:'automatic',status:'active',started_at:'2026-10-01T01:00:00Z',distance_km:10},
   {id:'charge',kind:'charge',origin:'automatic',status:'active',started_at:'2026-10-01T02:00:00Z',battery_charge_kwh:20},
   {id:'cost',kind:'expense',category:'charging',origin:'automatic',status:'active',accounting_date:'2026-10-01',actual_krw:6000},
   {...card.data.records[0],memo:'A very long memo '.repeat(60)}];
  window.ledgerQueries=[];
  card._hass.callWS=async msg=>{
   if(!msg.type.endsWith('/query'))return window.ledgerCall(msg);
   window.ledgerQueries.push(msg);
   const filtered=records.filter(r=>(msg.include_trips!==false||r.kind!=='trip')&&(!msg.record_categories?.length||msg.record_categories.includes(card.recordCategory(r))));
   return {...window.ledgerOriginal,records:filtered,has_more:false,record_filters_supported:true,recent_records:records.filter(r=>r.kind==='expense')};
  };
  card.recordFiltersSupported=true;card.data={...card.data,records};card.renderData();
 });
 if(await root.locator('#showTrips').isChecked()||await root.locator('#records tr').count()!==3)throw Error('trips not hidden by default');
 const columns=()=>root.locator('.ledger-table th').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));
 const originalColumns=await columns();
 await root.locator('#showTrips').check();await loaded();
 if(await root.locator('#records tr').count()!==4)throw Error('trip checkbox did not include all records');
 await root.locator('[data-ledger-category=trip]').click();await loaded();
 if(await root.locator('#records tr').count()!==1||!await root.locator('#records').textContent().then(text=>text.includes('주행')))throw Error('trip-only filter failed');
 await root.locator('[data-ledger-category=charging]').click();await loaded();
 if(await root.locator('#records tr').count()!==3)throw Error('multiple ledger categories failed');
 await root.locator('#showTrips').uncheck();await loaded();
 if(await root.locator('#records tr').count()!==2)throw Error('unchecking trips did not preserve other category');
 await root.locator('[data-ledger-category=maintenance]').click();await loaded();
 if(await root.locator('#records tr').count()!==3)throw Error('category OR filter failed');
 const filteredColumns=await columns();
 if(filteredColumns.some((width,i)=>Math.abs(width-originalColumns[i])>1))throw Error('ledger columns change with records');
 await page.evaluate(()=>{
  const card=document.querySelector('carrot-vehicle-journal');
  for(const row of card.shadowRoot.querySelectorAll('#records tr'))if(getComputedStyle(row.querySelector('.memo-cat-title')).color==='rgb(241, 246, 250)')throw Error('missing ledger category color');
  if(card.$('recent').querySelectorAll('.recent-expense-row').length!==2)throw Error('filters changed recent expenses');
  if(!window.ledgerQueries.some(q=>q.include_trips===false&&q.record_categories?.includes('charging')))throw Error('ledger filter not sent to server');
  card._hass.callWS=window.ledgerCall;card.data=window.ledgerOriginal;card.recordCategories.clear();card.showTrips=false;card.renderData();
 });
 fs.mkdirSync('.preview/journal',{recursive:true});
 await page.screenshot({path:'.preview/journal/desktop.png',fullPage:true});
 for(const width of [850,520,360,320]){
  await page.setViewportSize({width,height:1100});
  await root.locator('#tab1').click();
  if(width<=600){
   const hierarchy=await page.evaluate(()=>[...document.querySelector('carrot-vehicle-journal').shadowRoot.querySelectorAll('.trend-card')].every(item=>parseFloat(getComputedStyle(item.querySelector('.trend-metric-name')).fontSize)>parseFloat(getComputedStyle(item.querySelector('.trend-headline')).fontSize)));
   if(!hierarchy)throw Error('mobile title hierarchy incorrect at '+width);
   const columns=await page.evaluate(()=>getComputedStyle(document.querySelector('carrot-vehicle-journal').shadowRoot.querySelector('.trends-grid')).gridTemplateColumns.split(' ').length);
   if(columns!==1)throw Error('mobile trends must have one column at '+width);
  }
  await page.waitForTimeout(150);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw Error('page horizontal overflow at '+width);
  await root.locator('#tab3').click();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('ledger horizontal page overflow at '+width);
  await root.locator('#tab1').click();await root.locator('#tab0').click();
  if(width===360)await page.screenshot({path:'.preview/journal/mobile.png',fullPage:true});
 }
 // Async panel property replay is covered by loader-update.cjs with real modules.
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();console.log('Journal browser checks: tabs, chart, manual save, escaping, desktop/mobile layout OK');
})().catch(e=>{console.error(e);process.exit(1)});
