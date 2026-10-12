const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.JOURNAL_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<main id="mount"></main>');
 const raw=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-vehicle-journal.js','utf8');
 const module=raw.slice(raw.indexOf('// HA-local EV journal.')).replace('export class VehicleJournal','class VehicleJournal').replace(/export default VehicleJournal;/,'');
 await page.addScriptTag({content:fs.readFileSync('custom_components/carrot_ha/frontend/carrot-journal-design.js','utf8').replace('export const','const')+'\n'+fs.readFileSync('custom_components/carrot_ha/frontend/carrot-view-state.js','utf8').replace(/export function/g,'function')+'\n'+module});
 await page.evaluate(()=>{
  window.calls=[];window.vehicles=[];
  const card=document.createElement('carrot-vehicle-journal');document.getElementById('mount').append(card);card.setConfig({});
  card.hass={states:{},callWS:async msg=>{window.calls.push(msg);
   if(msg.type.endsWith('/entries'))return window.vehicles.filter(v=>msg.include_deleted||!v.deleted);
   if(msg.type.endsWith('/vehicle/create')){const vehicle={entry_id:'manual',title:msg.title,fuel:msg.fuel,linked:false};window.vehicles.push(vehicle);return {entry_id:'manual',imported:msg.preview_token?2:0};}
   if(msg.type.endsWith('/vehicle/update')){Object.assign(window.vehicles.find(v=>v.entry_id===msg.entry_id),msg);return {};}
   if(msg.type.endsWith('/settings'))return {map_key:'',opinet_configured:true,backup_entities:[{name:'마지막 백업',state:'2026-10-12'}]};
   if(msg.type.endsWith('/map/config'))return {key:'0123456789abcdef0123456789abcdef'};
   if(msg.type.endsWith('/query'))return {totals:{categories:{}},daily:[],records:[],recent_records:[],record_count:0,has_more:false,status:{phase:'complete'},timezone:'Asia/Seoul',record_filters_supported:true};
   return {id:msg.record_id,version:2};
  },fetchWithAuth:async(url,options)=>({ok:true,json:async()=>({token:'preview',summary:{count:2,from:'2025-01-01',to:'2025-02-01',total_krw:1234567},warnings:[],sample:[]}),blob:async()=>new Blob(['snapshot'])})};
 });
 const root=page.locator('carrot-vehicle-journal');await root.locator('#entry option[value=__add__]').waitFor({state:'attached'});
 await root.locator('#entry').selectOption('__add__');await root.locator('#vehicleDialog').waitFor({state:'visible'});
 if(await root.locator('#vehicleDialogTitle').textContent()!=='신규 차량을 추가합니다.')throw Error('vehicle dialog title');
 await root.locator('#newVehicleTitle').fill('시험 차량');await root.locator('#newVehicleFuel').selectOption('diesel');await root.locator('#createVehicle').click();
 await page.waitForFunction(()=>document.querySelector('carrot-vehicle-journal').entry==='manual');
 await root.locator('#journalSettings').click();await root.locator('#vehicleManageList [data-vehicle]').waitFor();
 if(!await root.locator('#backupStatus').textContent().then(t=>t.includes('마지막 백업')))throw Error('backup status absent');
 await root.locator('[data-vehicle-action=status]').click();await page.waitForFunction(()=>window.vehicles[0].deleted===true);
 await root.locator('[data-vehicle-action=status]').click();await page.waitForFunction(()=>window.vehicles[0].deleted===false);
 await root.locator('#closeVehicleManage').click();
 await root.locator('#entry').selectOption('__add__');await root.locator('#newVehicleTitle').fill('이관 차량');
 await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').importKind='michael');
 await root.locator('#vehicleImportFile').setInputFiles({name:'synthetic.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('synthetic')});
 await root.locator('#importPreview').waitFor({state:'visible'});
 if(!(await root.locator('#importPreview').textContent()).includes('1,234,567원'))throw Error('import currency formatting');
 if(await page.evaluate(()=>window.calls.filter(c=>c.type.endsWith('/vehicle/create')).length)!==1)throw Error('preview wrote vehicle');
 await root.locator('#closeVehicle').click();
 await page.evaluate(()=>{
  const maps={LatLng:class{constructor(lat,lon){this.lat=lat;this.lon=lon;}getLat(){return this.lat;}getLng(){return this.lon;}},Map:class{setCenter(){}},Marker:class{setMap(){}setPosition(){}},event:{addListener:(map,name,fn)=>window.pin=fn},services:{Status:{OK:'OK'},Places:class{keywordSearch(query,callback){window.searchQuery=query;callback([{place_name:'시험 주유소',road_address_name:'시험 주소',x:'127',y:'37.5'}],'OK');}}}};
  window.__journalKakaoKey='0123456789abcdef0123456789abcdef';window.__journalKakao=Promise.resolve(maps);
  document.querySelector('carrot-vehicle-journal').openRecord();
 });
 if(!await root.locator('#locationEditor').isHidden())throw Error('empty record loaded location map');
 await root.locator('#addLocation').click();await root.locator('#placeQuery').fill('시험');await root.locator('#placeSearch').click();await root.locator('#placeResults button').click();
 if(await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').draftLocation.latitude)!==37.5)throw Error('search location not selected');
 await page.evaluate(()=>window.pin({latLng:{getLat:()=>35,getLng:()=>129}}));
 if(await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').draftLocation.latitude)!==35)throw Error('manual pin not applied');
 await root.locator('#removeLocation').click();if(!await root.locator('#locationEditor').isHidden())throw Error('removed location still maps');
 await root.locator('#close').click();
 for(const width of [360,320]){await page.setViewportSize({width,height:900});await root.locator('#journalSettings').click();if(await root.locator('#vehicleManageDialog').evaluate(el=>el.scrollWidth>el.clientWidth+1))throw Error('settings overflow '+width);await root.locator('#closeVehicleManage').click();await root.locator('#entry').selectOption('__add__');if(await root.locator('#vehicleDialog').evaluate(el=>el.scrollWidth>el.clientWidth+1))throw Error('vehicle dialog overflow '+width);await root.locator('#closeVehicle').click();}
 fs.mkdirSync('.preview/journal',{recursive:true});await root.locator('#entry').selectOption('__add__');await page.screenshot({path:'.preview/journal/vehicle-dialog-mobile.png',fullPage:true});await root.locator('#closeVehicle').click();await root.locator('#journalSettings').click();await page.screenshot({path:'.preview/journal/settings-mobile.png',fullPage:true});
 if(await root.locator('#message').evaluate(el=>el.classList.contains('error')))throw Error('journal render error: '+await root.locator('#message').textContent());
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();console.log('Vehicle management: empty onboarding, create, trash/restore, preview, settings, mocked Kakao search/pin/remove, mobile OK');
})().catch(e=>{console.error(e);process.exit(1)});
