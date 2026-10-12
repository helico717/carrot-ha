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
 const root=page.locator('carrot-vehicle-journal');await root.locator('#entry option[value=__add__]').waitFor({state:'attached'});
 await root.locator('#entry').selectOption('__add__');await root.locator('#vehicleDialog').waitFor({state:'visible'});
 if(await root.locator('#vehicleDialogTitle').textContent()!=='신규 차량을 추가합니다.')throw Error('vehicle dialog title');
 await root.locator('#newVehicleTitle').fill('시험 차량');await root.locator('#newVehicleFuel').selectOption('diesel');await root.locator('#createVehicle').click();
 await page.waitForFunction(()=>document.querySelector('carrot-vehicle-journal').entry==='manual');
 await root.locator('#journalSettings').click();await root.locator('#vehicleManageList [data-vehicle]').waitFor();
 if(!await root.locator('#backupStatus').textContent().then(t=>t.includes('마지막 백업')))throw Error('backup status absent');
 await root.locator('[data-vehicle-action=status]').click();await page.waitForFunction(()=>window.vehicles[0].deleted===true);
 await root.locator('[data-vehicle-action=status]').click();await page.waitForFunction(()=>window.vehicles[0].deleted===false);
 await root.locator('[data-vehicle-action=status]').click();await root.locator('.vehicle-delete').waitFor();
 if(await root.locator('.vehicle-delete').evaluate(el=>getComputedStyle(el).color)!=='rgb(255, 133, 133)')throw Error('delete button not red');
 page.once('dialog',dialog=>dialog.dismiss());await root.locator('.vehicle-delete').click();if(await page.evaluate(()=>window.calls.some(c=>c.type.endsWith('/vehicle/delete'))))throw Error('cancelled deletion sent request');
 page.once('dialog',dialog=>{if(!dialog.message().includes('복원은 불가능합니다'))throw Error('missing irreversible warning');dialog.accept();});await root.locator('.vehicle-delete').click();await page.waitForFunction(()=>window.vehicles.length===0);
 await page.evaluate(()=>window.vehicles.push({entry_id:'manual',title:'시험 차량',fuel:'diesel',linked:false,deleted:false}));await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').openVehicleManagement());

 await root.locator('[data-settings-nav=api]').click();
 if(!(await root.locator('.settings-key-help').allTextContents()).join(' ').includes('Default Rest API Key'))throw Error('key instructions missing');
 if(await root.locator('#opinetKey').inputValue()!=='TESTKEY')throw Error('saved key not prefilled');
 await root.locator('[data-key-toggle=opinetKey]').click();if(await root.locator('#opinetKey').getAttribute('type')!=='text')throw Error('saved key reveal');
 await root.locator('#opinetKey').fill('CHANGED');
 const before=await page.evaluate(()=>window.calls.filter(c=>c.type.endsWith('/settings')&&c.opinet_key!==undefined).length);
 page.once('dialog',dialog=>dialog.dismiss());await root.locator('#saveOpinetKey').click();
 if(await page.evaluate(()=>window.calls.filter(c=>c.type.endsWith('/settings')&&c.opinet_key!==undefined).length)!==before)throw Error('cancelled key save wrote settings');
 page.once('dialog',dialog=>dialog.accept());await root.locator('#saveOpinetKey').click();
 if(await page.evaluate(()=>window.calls.filter(c=>c.type.endsWith('/settings')&&c.opinet_key!==undefined).length)!==before+1)throw Error('confirmed key save missing');
 await root.locator('[data-settings-nav=vehicles]').click();
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
 for(const width of [1280,360,320]){await page.setViewportSize({width,height:900});await root.locator('#journalSettings').click();if(await root.locator('.settings-nav').boundingBox().then(nav=>root.locator('.settings-content').boundingBox().then(content=>nav.x+nav.width>content.x+1)))throw Error('settings nav not left of content '+width);const box=await root.locator('#vehicleManageDialog').boundingBox();if(box.y<24||box.y+box.height>900-24)throw Error('dialog viewport margins '+width);if(await root.locator('[data-settings-nav=vehicles]').evaluate(el=>getComputedStyle(el).textAlign)!=='center')throw Error('nav alignment');if(await root.locator('#vehicleManageDialog').evaluate(el=>el.scrollWidth>el.clientWidth+1))throw Error('settings overflow '+width);await root.locator('#closeVehicleManage').click();await root.locator('#entry').selectOption('__add__');if(await root.locator('#vehicleDialog').evaluate(el=>el.scrollWidth>el.clientWidth+1))throw Error('vehicle dialog overflow '+width);await root.locator('#closeVehicle').click();}
 fs.mkdirSync('.preview/journal',{recursive:true});await root.locator('#entry').selectOption('__add__');await page.screenshot({path:'.preview/journal/vehicle-dialog-mobile.png',fullPage:true});await root.locator('#closeVehicle').click();await root.locator('#journalSettings').click();await page.screenshot({path:'.preview/journal/settings-mobile.png',fullPage:true});
 await page.evaluate(()=>{const c=document.querySelector('carrot-vehicle-journal');c.$('vehicleManageDialog').close();c.entries=[{entry_id:c.entry,fuel:'diesel',linked:false}];c.data.fuel_facts={totals:{fuel_liters:25,fuel_count:1,fuel_price_krw_l:1680},daily:[]};c.data.odometer_facts={distance_km:1000,from:'2026-09-28',to:'2026-10-20',daily:[]};c.renderData();c.selectTab(1);});
 if((await root.locator('#briefStats').textContent()).includes('충전'))throw Error('ICE charging stats');
 if(!(await root.locator('#headline').textContent()).includes('1,000'))throw Error('ICE odometer headline');
 if(!(await root.locator('#legendRow').textContent()).includes('주유비'))throw Error('ICE legend');
 if((await root.locator('#page1').textContent()).match(/배터리|전비|급속|km\/kWh/))throw Error('ICE EV trends');
 await page.evaluate(()=>{const c=document.querySelector('carrot-vehicle-journal');c.openRecord();c.draftLocation={name:'좌표 없는 시험 장소',latitude:null,longitude:null};c.renderLocation();});
 await page.waitForTimeout(100);if(!await root.locator('#locationMap').isHidden())throw Error('name-only location shows default map');
 if(!(await root.locator('#locationHint').textContent()).includes('장소명만'))throw Error('name-only hint missing');
 await root.locator('#locationPin').click();if(await root.locator('#locationMap').isHidden())throw Error('manual picker unavailable');
 await root.locator('#close').click();
 await page.evaluate(()=>{const c=document.querySelector('carrot-vehicle-journal');c.entries[0].fuel='hybrid';c.openRecord(null,'refueling');});if(await root.locator('[name=fuel_type]').inputValue()!=='')throw Error('hybrid guessed fuel');await root.locator('[name=fuel_type]').selectOption('diesel');await root.locator('#close').click();await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').entries[0].fuel='diesel');
 await root.locator('#add').click();await root.locator('[data-record-type=refueling]').click();
 await root.locator('#actualKrw').fill('50000');await root.locator('[name=unit_price_krw]').fill('2000');
 if(Number(await root.locator('[name=fuel_liters]').inputValue())!==25)throw Error('fuel liters estimate');
 await root.locator('[name=fuel_liters]').fill('24');await root.locator('#actualKrw').fill('48000');
 if(Number(await root.locator('[name=fuel_liters]').inputValue())!==24)throw Error('manual liters overwritten');
 await root.locator('#save').click();await root.locator('#recordDialog').waitFor({state:'hidden'});
 const savedFuel=await page.evaluate(()=>window.calls.filter(c=>c.type.endsWith('/record/save')).at(-1).payload);
 if(savedFuel.category!=='refueling'||savedFuel.fuel_liters!==24||savedFuel.actual_krw!==48000||savedFuel.unit_price_krw!==2000)throw Error('fuel payload');
 await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').openRecord(null,'trip'));await root.locator('[name=odometer_km]').fill('100000');await root.locator('#save').click();await root.locator('#recordDialog').waitFor({state:'hidden'});
 const savedTrip=await page.evaluate(()=>window.calls.filter(c=>c.type.endsWith('/record/save')).at(-1).payload);if(savedTrip.odometer_km!==100000||'distance_km' in savedTrip)throw Error('cumulative trip payload');
 for(const mode of ['washing','accident','maintenance','charging']){await page.evaluate(mode=>document.querySelector('carrot-vehicle-journal').openRecord(null,mode),mode);if(await root.locator('#recordDialog').evaluate(el=>el.scrollWidth>el.clientWidth+1))throw Error('entry overflow '+mode);if(mode==='accident'&&await root.locator('#photoCount').textContent()!=='0/10')throw Error('accident photo count');await root.locator('#close').click();}
 await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').openRecord(null,'refueling'));await page.screenshot({path:'.preview/journal/refueling-mobile.png',fullPage:true});await root.locator('#close').click();
 if(await root.locator('#message').evaluate(el=>el.classList.contains('error')))throw Error('journal render error: '+await root.locator('#message').textContent());
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();console.log('Vehicle management: empty onboarding, create, trash/restore, preview, settings, mocked Kakao search/pin/remove, mobile OK');
})().catch(e=>{console.error(e);process.exit(1)});
