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
 await page.evaluate(()=>{const c=document.querySelector('carrot-vehicle-journal');c.entry='manual';c.entries=[{entry_id:'manual',fuel:'electric'}];c.load=async()=>{};window.saved=[];window.photoReads=[];c.call=async(type,msg)=>{window.saved.push({type,...msg});return {id:msg.record_id,version:2};};const canvas=document.createElement('canvas');canvas.width=10;canvas.height=10;const png=canvas.toDataURL('image/png');c._hass.fetchWithAuth=async url=>{window.photoReads.push(url);const bytes=Uint8Array.from(atob(png.split(',')[1]),x=>x.charCodeAt(0));return {ok:true,blob:async()=>new Blob([bytes],{type:'image/png'})};};window.photoRecord={id:'synthetic',version:1,kind:'expense',category:'maintenance',origin:'manual',accounting_date:'2026-01-01',actual_krw:100,input:{kind:'expense',date:'2026-01-01',category:'maintenance',actual_krw:100},attachments:[{id:'photo-A',name:'first.png'},{id:'photo-B',name:'second.png'}]};c.openRecord(window.photoRecord);});
 await page.waitForFunction(()=>[...document.querySelector('carrot-vehicle-journal').shadowRoot.querySelectorAll('#photoPreview img')].length===2&&[...document.querySelector('carrot-vehicle-journal').shadowRoot.querySelectorAll('#photoPreview img')].every(i=>i.complete&&i.naturalWidth>0));
 if(await root.locator('#photoCount').textContent()!=='2/5')throw Error('existing photo count');
 await root.getByRole('button',{name:'first.png 사진 삭제',exact:true}).click();if(await root.locator('#photoCount').textContent()!=='1/5')throw Error('removed photo count');
 if(await page.evaluate(()=>window.saved.length)!==0)throw Error('photo removed before save');
 await root.locator('#close').click();await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').openRecord(window.photoRecord));
 if(await root.locator('#photoPreview img').count()!==2)throw Error('cancel changed saved photos');
 await root.getByRole('button',{name:'first.png 사진 삭제',exact:true}).click();await root.locator('#save').click();await root.locator('#recordDialog').waitFor({state:'hidden'});
 const saved=await page.evaluate(()=>window.saved[0]);if(saved.payload.remove_attachment_ids.join(',')!=='photo-A')throw Error('photo removal save payload');
 if(errors.length)throw Error(errors.join('\n'));await browser.close();console.log('PASS saved photo previews, remove on save, count and cancel preservation');
})().catch(e=>{console.error(e);process.exit(1);});
