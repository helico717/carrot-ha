const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const lang of ['ko','en']){
   const page=await browser.newPage({viewport:{width:1100,height:700}});
   const requested=[];page.on('request',r=>requested.push(r.url()));
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<style>#host{height:600px;overflow:auto}#spacer{height:180px}#bottom{height:1000px}</style><div id="host"><div id="spacer"></div><div id="card"></div><div id="bottom"></div></div>'});
    const file=path.resolve('custom_components/carrot_ha/frontend','.'+url.pathname);
    return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'missing'});
   });
   await page.goto('http://localhost/');
   await page.evaluate(async lang=>{
    const Card=(await import(`/carrot-dashboard-${lang}.js`)).default;
    Card.prototype.connectedCallback=function(){};
    customElements.define('loading-test-card',Card);
    window.card=document.createElement('loading-test-card');
    card.setConfig({device_id:'car'});
    document.querySelector('#card').append(card);
    const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
    window.battery=gate();window.trips=gate();window.charges=gate();
    card._hass={states:{},themes:{darkMode:false},config:{time_zone:'Asia/Seoul'},callApi:async(m,p)=>{
     if(p.endsWith('/devices'))return {devices:[{entry_id:'entry',device_id:'car'}]};
     if(p.includes('live=1'))return {values:{soc_percent:72,charging:false,onroad:false}};
     if(p.includes('/dashboard/'))return battery.promise;
     return p.includes('kind=trip')?trips.promise:charges.promise;
    }};
    window.loading=card.load();
   },lang);
   await page.waitForFunction(()=>card.v.soc_percent===72);
   assert(!requested.some(url=>/carrot-camera-360|carrot-vehicle-3d|leaflet\.js/.test(url)),'optional assets must not compete with initial data: '+JSON.stringify(requested.filter(url=>/carrot-camera-360|carrot-vehicle-3d|leaflet\.js/.test(url))));
   for(const tab of ['overview','trips','parking','charge','vehicle']){
    await page.evaluate(tab=>{card.tab=tab;card.render();},tab);
    assert(await page.evaluate(()=>!!card.shadowRoot.querySelector('ha-card')));
   }
   const result=await page.evaluate(async()=>{
    card.tab='charge';card.render();
    const host=document.querySelector('#host');host.scrollTop=120;
    const panel=card.shadowRoot.querySelector('ha-card'),before=host.scrollTop;
    charges.resolve({events:[],charge_costs_grouped:true});
    await new Promise(r=>setTimeout(r,30));
    trips.resolve({events:[{event_id:'trip',data:{started_at:new Date().toISOString(),duration_s:60,distance_m:500}}]});
    await new Promise(r=>setTimeout(r,30));
    const early=card.trips.length===1&&card.busy;
    battery.resolve({values:{battery_history:[]}});await loading;
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    return {tab:card.tab,early,before,after:host.scrollTop,same:panel===card.shadowRoot.querySelector('ha-card')};
   });
   assert.equal(result.tab,'charge');assert(result.early);assert(result.before>0);assert.equal(result.before,result.after);assert(result.same);assert.deepEqual(errors,[]);
   const restored=await page.evaluate(()=>{
    card.shadowRoot.querySelector('[data-tab="charge"]').click();
    const date=card.chargeDay;
    card.remove();
    const replacement=document.createElement('loading-test-card');
    replacement.setConfig({device_id:'car',vehicle_3d:false});
    document.querySelector('#card').append(replacement);window.replacement=replacement;
    return {tab:replacement.tab,date:replacement.chargeDay,expected:date};
   });
   assert.equal(restored.tab,'charge');assert.equal(restored.date,restored.expected);
   let releaseCamera, cameraRequested;
   const cameraGate=new Promise(resolve=>releaseCamera=resolve);
   const requestSeen=new Promise(resolve=>cameraRequested=resolve);
   await page.route('**/carrot-camera-360.js',async route=>{
    cameraRequested();await cameraGate;
    await route.fulfill({contentType:'text/javascript',body:'export class CarrotCamera360Modal {constructor(){throw Error("camera must remain closed while driving")}}'});
   });
   await page.evaluate(()=>{replacement.v={driving:false};window.opening=replacement.openCamera360();});
   await requestSeen;
   await page.evaluate(()=>{replacement.v={driving:true};});releaseCamera();
   assert.equal(await page.evaluate(async()=>{await opening;return replacement.cameraModal===null;}),true);
   console.log(`PASS ${lang}: cold state, all tabs, independent history and scroll after async responses + two frames`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
