const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const lang of ['ko','en']){
   const page=await browser.newPage({viewport:{width:1100,height:700}});
   const library=gate(),tiles=gate();let libraryRequests=0,tileRequests=0;
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='tile.openstreetmap.org'){
     tileRequests++;await tiles.promise;
     return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
    }
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<style>#host{height:600px;overflow:auto}#spacer{height:180px}#bottom{height:1000px}</style><div id="host"><div id="spacer"></div><div id="card"></div><div id="bottom"></div></div>'});
    if(url.pathname.endsWith('/leaflet.js')){
     libraryRequests++;
     assert(await page.evaluate(()=>card._vehicleDataReady&&card.v.soc_percent===72));
     await library.promise;
    }
    const file=path.resolve('custom_components/carrot_ha/frontend','.'+url.pathname);
    return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404});
   });
   await page.goto('http://localhost/');
   await page.evaluate(async lang=>{
    const Card=(await import(`/carrot-dashboard-${lang}.js`)).default;
    Card.prototype.connectedCallback=function(){};customElements.define('map-test-card',Card);
    window.card=document.createElement('map-test-card');card.setConfig({device_id:'car'});
    document.querySelector('#card').append(card);
    const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
    window.live=gate();window.battery=gate();window.trips=gate();window.charges=gate();
    card._hass={states:{},themes:{darkMode:false},config:{time_zone:'Asia/Seoul'},callApi:async(m,p)=>{
     if(p.endsWith('/devices'))return {devices:[{entry_id:'entry',device_id:'car'}]};
     if(p.includes('live=1'))return live.promise;
     if(p.includes('/dashboard/'))return battery.promise;
     return p.includes('kind=trip')?trips.promise:charges.promise;
    }};
    window.loading=card.load();
   },lang);
   await page.waitForTimeout(100);assert.equal(libraryRequests,0);assert.equal(tileRequests,0);
   await page.evaluate(()=>live.resolve({values:{soc_percent:72,parking_latitude:37.5,parking_longitude:127,charging:false,onroad:false}}));
   await page.waitForFunction(()=>card._v3d?.viewer);
   assert.equal(libraryRequests,1);assert.equal(tileRequests,0);
   assert(await page.evaluate(()=>card.v.soc_percent===72&&card.busy&&!card._initialDataSettled));
   // Another response arrives while Leaflet is still downloading.
   await page.evaluate(()=>charges.resolve({events:[],charge_costs_grouped:true}));
   library.resolve();
   await page.waitForFunction(()=>card.miniMaps?.length===1);
   await page.evaluate(()=>{
    window.parkingMap=card.miniMaps[0];parkingMap.setZoom(15,{animate:false});window.parkingNode=parkingMap.getContainer();
    window.tile=parkingNode.querySelector('.leaflet-tile');
    const host=document.querySelector('#host');host.scrollTop=120;window.scrollBefore=host.scrollTop;
    window.panel=card.shadowRoot.querySelector('ha-card');
    trips.resolve({events:[{event_id:'trip',data:{started_at:'2026-11-16T00:00:00Z',duration_s:60,distance_m:500,route:[{latitude:37.5,longitude:127},{latitude:37.51,longitude:127.01}]}}]});
   });
   await page.waitForFunction(()=>card.miniMaps?.length===2);
   assert(await page.evaluate(()=>card.busy&&!card._initialDataSettled),'trip map must not wait for battery');
   await page.evaluate(async()=>{
    window.tripMap=card.miniMaps[1];
    battery.resolve({values:{battery_history:[]}});await loading;
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
   });
   const result=await page.evaluate(()=>({parking:card.miniMaps[0]===parkingMap,node:card.shadowRoot.querySelector('.parking-mini')===parkingNode,tile:parkingNode.querySelector('.leaflet-tile')===tile,trip:card.miniMaps[1]===tripMap,panel:card.shadowRoot.querySelector('ha-card')===panel,zoom:parkingMap.getZoom(),before:scrollBefore,after:document.querySelector('#host').scrollTop}));
   assert(result.parking&&result.node&&result.tile&&result.trip&&result.panel,JSON.stringify(result));
   assert.equal(result.zoom,15);assert(result.before>0);assert.equal(result.before,result.after);assert(tileRequests>0);
   await page.evaluate(()=>{card.v.parking_latitude=37.52;card.render();});
   await page.waitForFunction(()=>card.miniMaps[0]!==parkingMap);
   assert(await page.evaluate(()=>card.miniMaps[1]===tripMap),'parking update must retain the trip map');
   await page.evaluate(()=>{window.changedParking=card.miniMaps[0];card.trips[0].data.route[1].latitude=37.53;card.render();});
   await page.waitForFunction(()=>card.miniMaps[1]!==tripMap);
   assert(await page.evaluate(()=>card.miniMaps[0]===changedParking),'route update must retain the parking map');
   tiles.resolve();
   await page.evaluate(()=>{card.tab='charge';card.render();});
   assert.equal(await page.evaluate(()=>card.miniMaps.length),0);
   assert.deepEqual(errors,[]);
   console.log(`PASS ${lang}: state before map/3D, slow Leaflet/tiles do not block data; parking before trips, trip before battery; maps/tiles/DOM/scroll reused; cleanup on tab departure`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
