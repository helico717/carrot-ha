const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:900},timezoneId:'Asia/Seoul'}),errors=[],sockets=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('websocket',s=>sockets.push(s.url()));
 const root=path.resolve('custom_components/carrot_ha/frontend');
 const routes=[['first',Date.parse('2026-10-14T10:00:00Z')/1000],['second',Date.parse('2026-10-15T01:00:00Z')/1000]].map(([route,time])=>({route,segmentFolders:[route+'--0',route+'--1'],segmentCount:2,routeStartEpoch:time,routeEndEpoch:time+120,latestModifiedEpoch:time+120,segmentTimes:{[route+'--0']:{startEpoch:time,endEpoch:time+60},[route+'--1']:{startEpoch:time+60,endEpoch:time+120}}}));
 await page.addInitScript(()=>{
  window.testWorkers=0;window.testTerminated=0;
  const NativeWorker=Worker;
  window.Worker=class {constructor(url){if(!String(url).includes('replay_log_worker'))return new NativeWorker(url);window.testWorkers++;}postMessage(options){window.testGpsOnly=options.gpsOnly;this.timer=setTimeout(()=>this.onmessage?.({data:{type:'complete',metadata:{rawParseStatus:'complete'},records:[{timeMs:0,frames:[{service:'gpsLocationExternal',decoded:{latitude:37.5,longitude:127,hasFix:true}}]},{timeMs:1000,frames:[{service:'gpsLocationExternal',decoded:{latitude:37.5001,longitude:127.0001,hasFix:true}}]},{timeMs:2000,frames:[{service:'gpsLocationExternal',decoded:{latitude:0,longitude:0,hasFix:false}}]}]}}),300);}terminate(){clearTimeout(this.timer);window.testTerminated++;}};
 });
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());requests.push(url.pathname+url.search);
  if(url.hostname==='tile.openstreetmap.org')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  if(url.pathname.startsWith('/api/')){
   if(url.pathname.endsWith('/calendar'))return route.fulfill({json:{intervals:routes.map(r=>({start:r.routeStartEpoch,end:r.routeEndEpoch}))}});
   if(url.pathname.endsWith('/routes')){const filtered=routes.filter(r=>(!url.searchParams.has('from')||r.routeEndEpoch>=Number(url.searchParams.get('from')))&&(!url.searchParams.has('to')||r.routeStartEpoch<Number(url.searchParams.get('to'))));return route.fulfill({json:{routes:filtered,total:filtered.length,hasMore:false,storage:{used:3733600006,limit:5000000000}}});}
   if(url.pathname.includes('/replay-source/'))return route.fulfill({json:{segmentIndex:Number(url.pathname.split('--').at(-1)),rlog:{url:'/synthetic.rlog',compression:'none'},video:{url:'/synthetic.mp4',container:'mp4'}}});
   if(/thumbnail|preview|video/.test(url.pathname))return route.fulfill({status:204,body:''});
   return route.fulfill({json:{recentSegment:''}});
  }
  const file=path.join(root,url.pathname.replace(/^\/carrot_ha_static\//,''));
  if(fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'text/css'});
  return route.fulfill({status:404,body:''});
 });
 await page.goto('https://explorer.test/carrot_ha_static/carrot_logs/logs.html');
 await page.evaluate(()=>postMessage({type:'carrot:logs_session',base:'/api/carrot_ha/v1/driving_logs/test',enabled:true},location.origin));
 await page.locator('[data-route-card=first] .ha-route-explore').waitFor();
 await page.locator('#haLogDate').fill('2026-10-15');await page.locator('#haLogDate').dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelectorAll('[data-route-card]').length===1&&!!document.querySelector('[data-route-card=second]'));
 assert.ok(requests.some(url=>url.includes('from=1791990000')&&url.includes('to=1792076400')),'local midnight interval');
 await page.locator('#haLogDatePrevious').click();await page.locator('[data-route-card=first]').waitFor();
 await page.locator('[data-route-card=first] .ha-route-explore').click();
 await page.waitForFunction(()=>window.testWorkers>0);await page.locator('#haMapClose').click();
 assert.ok(await page.evaluate(()=>window.testTerminated>0));
 await page.locator('[data-route-card=first] .ha-route-explore').click();
 await page.locator('#haMapStatus').filter({hasText:'실제 GPS 4개'}).waitFor();
 assert.equal(await page.evaluate(()=>window.testGpsOnly),true);
 assert.ok(await page.locator('#haRouteMap canvas').evaluate(canvas=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=3;i<data.length;i+=4)if(data[i])count++;return count>100;}),'real Leaflet geographic vector canvas is nonblank');
 await page.screenshot({path:path.join(os.tmpdir(),'carrot-log-map-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 assert.ok(await page.locator('#haRouteExplorer').evaluate(e=>e.scrollWidth<=e.clientWidth));
 await page.screenshot({path:path.join(os.tmpdir(),'carrot-log-map-mobile.png')});
 await page.locator('#haMapSegment').selectOption('first--1');
 await page.evaluate(()=>{window.replayCalls=[];window.CarrotVisionReplay.start=async options=>{replayCalls.push(options);const button=document.createElement('button');button.id='carrotReplayInsightsAdvancedTab';button.onclick=()=>window.testAnalysis=true;document.body.append(button);const video=document.createElement('video');video.id='carrotRoadVideo';document.body.append(video);};});
 await page.locator('#haMapAnalysis').click();await page.waitForFunction(()=>window.testAnalysis===true);
 assert.equal(await page.evaluate(()=>replayCalls[0].segment),'first--1');
 assert.deepEqual(await page.evaluate(()=>replayCalls[0].segments),['first--0','first--1']);
 await page.locator('#haLogAllDates').click();await page.waitForFunction(()=>document.querySelectorAll('[data-route-card]').length===2);
 assert.deepEqual(errors,[]);assert.deepEqual(sockets,[]);
 console.log('PASS explorer: local dates, pagination scope, route actions, GPS-only map vectors, cancel, desktop/mobile, analysis segment link, no sockets');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
