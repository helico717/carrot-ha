const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.JOURNAL_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<main id="mount"></main>');
 const raw=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-vehicle-journal.js','utf8');
 const module='const assetBase="http://localhost/carrot-assets/";\n'+raw.slice(raw.indexOf('// HA-local EV journal.')).replace('export class VehicleJournal','class VehicleJournal').replace(/export default VehicleJournal;/,'');
 await page.addScriptTag({content:fs.readFileSync('custom_components/carrot_ha/frontend/carrot-journal-design.js','utf8').replace('export const','const')+'\n'+fs.readFileSync('custom_components/carrot_ha/frontend/carrot-view-state.js','utf8').replace(/export function/g,'function')+'\n'+module});
 await page.evaluate(()=>{
  window.calls=[];window.vehicles=[];
  const card=document.createElement('carrot-vehicle-journal');document.getElementById('mount').append(card);card.setConfig({});
  card.hass={states:{},callWS:async msg=>{window.calls.push(msg);if(['/settings','/map/config','/location/search'].some(t=>msg.type.endsWith(t))&&'entry_id' in msg)throw Error("unexpected entry_id in global request");
   if(msg.type.endsWith('/entries'))return window.vehicles.filter(v=>msg.include_deleted||!v.deleted);
   if(msg.type.endsWith('/vehicle/create')){const vehicle={entry_id:'manual',title:msg.title,fuel:msg.fuel,linked:false};window.vehicles.push(vehicle);return {entry_id:'manual',imported:msg.preview_token?2:0};}
   if(msg.type.endsWith('/vehicle/delete')){window.vehicles=window.vehicles.filter(v=>v.entry_id!==msg.entry_id);return {};}
   if(msg.type.endsWith('/vehicle/update')){Object.assign(window.vehicles.find(v=>v.entry_id===msg.entry_id),msg);return {};}
   if(msg.type.endsWith('/settings'))return {map_key:'0123456789abcdef0123456789abcdef',kakao_rest_key:'abcdef0123456789abcdef0123456789',opinet_key:'TESTKEY',opinet_configured:true,backup_entities:[{name:'마지막 백업',state:'2026-10-12'}]};
   if(msg.type.endsWith('/map/config'))return {key:'0123456789abcdef0123456789abcdef'};
   if(msg.type.endsWith('/query'))return {totals:{categories:{}},daily:[],records:[],recent_records:[],record_count:0,has_more:false,status:{phase:'complete'},timezone:'Asia/Seoul',record_filters_supported:true};
   return {id:msg.record_id,version:2};
  },fetchWithAuth:async(url,options)=>({ok:true,json:async()=>({token:'preview',summary:{count:2,from:'2025-01-01',to:'2025-02-01',total_krw:1234567},warnings:[],sample:[]}),blob:async()=>new Blob(['snapshot'])})};
 });

 await page.waitForFunction(()=>document.querySelector('carrot-vehicle-journal').ready);
 await page.evaluate(()=>{const c=document.querySelector('carrot-vehicle-journal');c.entry='manual';c.entries=[{entry_id:'manual',title:'Synthetic EV',fuel:'electric',linked:false}];c.automaticLocations=false;c.load=async()=>{};const original=c._hass.callWS;c._hass.callWS=async msg=>{if(msg.type.endsWith('/record/save')&&!['charging','refueling','washing','accident','maintenance'].includes(msg.payload.category))throw Error('invalid category');return original(msg);};});
 const root=page.locator('carrot-vehicle-journal');
 for(const width of [320,360,390,430,1280]){
  await page.setViewportSize({width,height:850});
  await page.evaluate(()=>{const c=document.querySelector('carrot-vehicle-journal');c.openRecord({id:'synthetic',version:1,kind:'expense',category:'charging',accounting_date:'2026-10-13',actual_krw:1000,location:{name:'Station B',address:'Synthetic address',latitude:null,longitude:null},input:{kind:'expense',category:'charging',date:'2026-10-13',actual_krw:1000}});});
  if(await root.locator('#recordDialog').evaluate(el=>el.scrollWidth>el.clientWidth+1))throw Error('dialog overflow '+width);
  const overlap=await root.locator('#recordForm').evaluate(form=>{const a=form.elements.date.getBoundingClientRect(),b=form.elements.odometer_km.getBoundingClientRect();return a.right>b.left+1&&a.bottom>b.top+1&&a.top<b.bottom-1&&a.left<b.right-1;});
  if(overlap)throw Error('date overlaps odometer '+width);
  if(width<=440){const compact=await root.locator('#recordForm').evaluate(form=>{const fields=form.querySelector('.fields'),date=form.querySelector('#dateField').getBoundingClientRect(),odo=form.querySelector('#odometerField').getBoundingClientRect(),amount=form.querySelector('#amountField').getBoundingClientRect();return {dateFull:Math.abs(date.width-fields.clientWidth)<2,paired:Math.abs(odo.y-amount.y)<1&&odo.right<=amount.left+1};});if(!compact.dateFull||!compact.paired)throw Error('mobile date full row / paired values '+width);}
  await page.evaluate(()=>{const c=document.querySelector('carrot-vehicle-journal');c.$('placeResults').innerHTML=Array.from({length:5},(_,i)=>'<button type="button" class="place-result-item"><strong class="place-result-name">Synthetic station with long multiline name '+i+'</strong><span class="place-result-address">Synthetic long address that must stay within each result</span></button>').join('');});
  const shrunk=await root.locator('#placeResults').evaluate(el=>[...el.children].some(row=>row.scrollHeight>row.clientHeight+2));if(shrunk)throw Error('place results shrink '+width);
  await root.locator('#actualKrw').fill('5432');await root.locator('#locationName').fill('Chosen Station');await root.locator('#save').click();await root.locator('#recordDialog').waitFor({state:'hidden'});
  const saved=await page.evaluate(()=>window.calls.filter(c=>c.type.endsWith('/record/save')).at(-1).payload);
  if(saved.category!=='charging'||saved.actual_krw!==5432||saved.location.name!=='Chosen Station')throw Error('edit not saved '+width);
 }
 await page.evaluate(()=>{const c=document.querySelector('carrot-vehicle-journal');c.data={totals:{categories:{}},daily:[],records:[{id:'deleted-test',version:2,status:'deleted',kind:'expense',origin:'manual',category:'tuning',accounting_date:'2026-01-01',actual_krw:100}],recent_records:[],record_count:1,has_more:false,status:{phase:'complete'}};c.renderData();c.selectTab(3);});
 const purge=root.locator('[data-action=purge]');if(!await purge.isVisible())throw Error('permanent delete missing from deleted record');
 page.once('dialog',dialog=>dialog.dismiss());await purge.click();if(await page.evaluate(()=>window.calls.some(c=>c.type.endsWith('/record/purge'))))throw Error('cancelled permanent delete sent request');
 page.once('dialog',dialog=>{if(!dialog.message().includes('복원할 수 없습니다'))throw Error('permanent delete warning missing');dialog.accept();});await purge.click();
 const deletion=await page.evaluate(()=>window.calls.find(c=>c.type.endsWith('/record/purge')));if(deletion?.confirm!==true||deletion?.entry_id!=='manual'||deletion?.expected_version!==2)throw Error('permanent delete payload');
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();console.log('PASS charging edit payload, date layout, place results and permanent deletion confirmation at 320/360/390/430/1280px');
})().catch(e=>{console.error(e);process.exit(1);});
