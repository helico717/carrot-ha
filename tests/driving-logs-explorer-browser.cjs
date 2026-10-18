const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:900},timezoneId:'Asia/Seoul'}),errors=[],sockets=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('websocket',s=>sockets.push(s.url()));
 const root=path.resolve('custom_components/carrot_ha/frontend');
 const routes=[['first',Date.parse('2026-10-14T10:00:00Z')/1000],['second',Date.parse('2026-10-15T01:00:00Z')/1000]].map(([route,time])=>({route,segmentFolders:[route+'--0',route+'--1'],segmentCount:2,routeStartEpoch:time,routeEndEpoch:time+120,latestModifiedEpoch:time+120,segmentTimes:{[route+'--0']:{startEpoch:time,endEpoch:time+60},[route+'--1']:{startEpoch:time+60,endEpoch:time+120}}}));
 await page.addInitScript(()=>{
  sessionStorage.setItem('carrot:log-date:/api/carrot_ha/v1/driving_logs/test','2026-10-15');
  window.testWorkers=0;window.testTerminated=0;window.analyzeMessages=[];
  window.addEventListener('message',e=>{if(e.data?.type==='carrot:logs_analyze')window.analyzeMessages.push(e.data);});
  const NativeWorker=Worker;
  window.Worker=class {constructor(url){if(!String(url).includes('replay_log_worker'))return new NativeWorker(url);window.testWorkers++;}postMessage(options){window.testGpsOnly=options.gpsOnly;this.timer=setTimeout(()=>this.onmessage?.({data:{type:'complete',metadata:{rawParseStatus:'complete'},records:[{timeMs:0,frames:[{service:'gpsLocationExternal',decoded:{latitude:37.5,longitude:127,hasFix:true}}]},{timeMs:1000,frames:[{service:'gpsLocationExternal',decoded:{latitude:37.5001,longitude:127.0001,hasFix:true}}]},{timeMs:2000,frames:[{service:'gpsLocationExternal',decoded:{latitude:0,longitude:0,hasFix:false}}]}]}}),300);}terminate(){clearTimeout(this.timer);window.testTerminated++;}};
 });
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());requests.push(url.pathname+url.search);
  if(url.hostname==='tile.openstreetmap.org')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  if(url.pathname.startsWith('/api/')){
   if(url.pathname.endsWith('/local/status'))return route.fulfill({json:{auto_latest:true,phase:'done',route:'second',segments:2,recommendations:1,message:'마지막 주행 무료 분석 완료 · 저장 구간 2/2개'}});
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
 await page.locator('[data-route-card=first]').waitFor();
 await page.locator('[data-route-card=second]').waitFor();
 await page.locator('#freeAnalysisBanner').waitFor({state:'visible'});
 assert.ok((await page.locator('#freeAnalysisBanner').textContent()).includes('마지막 주행 무료 분석 완료'));
 await page.locator('#freeAnalysisBanner').click();
 await page.waitForFunction(()=>window.analyzeMessages?.length>0);
 assert.equal(await page.evaluate(()=>window.analyzeMessages.at(-1)?.action),'result');
 assert.equal(await page.locator('.ha-log-datebar,#haLogDate,#haLogDatePrevious,#haLogDateNext,#haLogAllDates').count(),0,'date controls removed');
 assert.ok(!requests.some(value=>value.includes('/calendar')||new URL(value,'https://explorer.test').searchParams.has('from')||new URL(value,'https://explorer.test').searchParams.has('to')),'saved dates cannot filter the catalog or trigger calendar reads');
 assert.equal(await page.evaluate(()=>window.testWorkers),0,'no GPS download workers');
 assert.equal(await page.locator('#haRouteMap,#haRouteExplorer,.ha-route-explore').count(),0,'map system removed');
 assert.ok(!requests.some(url=>/leaflet|tile\.openstreetmap/.test(url)),'no map assets or tile requests');
 await page.locator('button[data-action="segment-menu"][data-segment="first--1"]').first().click();
 await page.locator('.ha-replay-v2-choice').waitFor();
 assert.equal(await page.locator('.ha-analysis-choice').count(),2,'segment menu injects free & AI analysis choices');
 assert.equal(await page.locator('.ha-replay-v2-choice').evaluate(e=>e.previousElementSibling.textContent.trim()),'리플레이');
 await page.locator('.ha-replay-v2-choice').click();
 assert.ok(await page.locator('#haReplayV2').evaluate(e=>e.open));
 assert.ok((await page.locator('#haReplayV2Frame').getAttribute('src')).endsWith('/dashcam/v2/first--1'));
 await page.locator('#haReplayV2 header button').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 assert.ok(await page.locator('.logs-shell').evaluate(e=>e.scrollWidth<=e.clientWidth));
 await page.screenshot({path:path.join(os.tmpdir(),'carrot-logs-no-map-mobile.png')});
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.waitForTimeout(100);
 assert.equal(await page.locator('[data-route-card]').count(),2);
 assert.ok(!requests.some(url=>url.includes('/calendar')),'visibility refresh has no calendar dependency');
 assert.deepEqual(errors,[]);assert.deepEqual(sockets,[]);
 console.log('PASS log explorer: date controls and persisted filtering removed, full catalog, free analysis banner, V2 + analysis menus, desktop/mobile, no calendar/GPS downloads or sockets');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
