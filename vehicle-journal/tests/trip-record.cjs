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



 const root=page.locator('carrot-vehicle-journal');
 await page.evaluate(()=>{const c=document.querySelector('carrot-vehicle-journal');c.entry='entry';c.entries=[{entry_id:'entry',fuel:'electric',linked:true}];c.load=async()=>{};window.saved=[];window.uploads=[];c.call=async(type,msg)=>{window.saved.push({type,...msg});return {id:msg.record_id,version:1};};c._hass.fetchWithAuth=async(url,options)=>{window.uploads.push(url);return {ok:true};};c.chooseRecordType();});
 await root.locator('[data-record-type=trip]').click();await root.locator('#recordDialog').waitFor({state:'visible'});
 const visible=await root.locator('#recordDialog .fields>label,#recordDialog .fields>section').evaluateAll(nodes=>nodes.filter(n=>!n.hidden&&getComputedStyle(n).display!=='none').map(n=>n.id));
 if(visible.sort().join(',')!==['dateField','odometerField','recordPhotoField'].sort().join(','))throw Error('trip has additional fields '+visible);
 if(await root.locator('#photoCount').textContent()!=='0/1')throw Error('trip photo limit label');
 await root.locator('#save').click();if(await page.evaluate(()=>window.saved.length)!==0)throw Error('blank odometer saved');
 await root.locator('[name=odometer_km]').fill('123456.7');
 const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=10;c.height=10;return c.toDataURL('image/png').split(',')[1];}),'base64');
 await root.locator('#photos').setInputFiles(['a.png','b.png'].map(name=>({name,mimeType:'image/png',buffer:png})));await root.locator('#save').click();if(await page.evaluate(()=>window.saved.length)!==0)throw Error('two trip photos saved');
 await root.locator('#photoPreview button').last().click();await root.locator('#save').click();await root.locator('#recordDialog').waitFor({state:'hidden'});
 const request=await page.evaluate(()=>window.saved[0]);if(request.payload.kind!=='trip'||request.payload.odometer_km!==123456.7||'location' in request.payload||'distance_km' in request.payload||'memo' in request.payload)throw Error('trip payload');
 if(await page.evaluate(()=>window.uploads.length)!==1)throw Error('trip photo upload count');
 if(errors.length)throw Error(errors.join('\n'));await browser.close();console.log('PASS trip selection opens, three fields, required odometer, one photo and save payload');
})().catch(e=>{console.error(e);process.exit(1);});
