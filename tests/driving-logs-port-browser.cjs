const {chromium}=require('playwright');
const fs=require('fs'), path=require('path'), assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try {
const page=await browser.newPage({viewport:{width:1300,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const root=path.resolve('custom_components/carrot_ha/frontend/carrot_logs');
const segment='00000315--4742c01c35--133';
let fixtureVideo;
const replayRoot=process.env.CARROT_REPLAY_FIXTURE;
const replayMeta=replayRoot?JSON.parse(fs.readFileSync(path.join(replayRoot,'meta.json'),'utf8')):null;
await page.route('**/*',async route=>{const u=new URL(route.request().url());
 if(u.pathname.startsWith('/api/')) {
  if(replayRoot && u.pathname.includes('/replay-source/')) {
    if(u.pathname.endsWith('/rlog')) return route.fulfill({contentType:'application/zstd',body:fs.readFileSync(path.join(replayRoot,replayMeta.logName))});
    if(u.pathname.endsWith('/video')) {
      const body=fs.readFileSync(path.join(replayRoot,'qcamera.mp4')), range=route.request().headers().range;
      const match=range?.match(/^bytes=(\d+)-(\d*)$/);
      if(match){const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),body.length-1):body.length-1;return route.fulfill({status:206,contentType:'video/mp4',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${body.length}`},body:body.subarray(start,end+1)});}
      return route.fulfill({contentType:'video/mp4',headers:{'Accept-Ranges':'bytes'},body});
    }
    return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,mode:'client',segment,segmentIndex:replayMeta.segmentIndex,rlog:{url:u.pathname+'/rlog',compression:replayMeta.logName.endsWith('.zst')?'zstd':replayMeta.logName.endsWith('.bz2')?'bzip2':'none'},video:{url:u.pathname+'/video',container:'mp4'}})});
  }
  if(u.pathname.includes('/video/')) return route.fulfill({contentType:'video/webm',body:Buffer.from(fixtureVideo)});
  if(/thumbnail|preview/.test(u.pathname)) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#334455"/></svg>'});
  return route.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname.includes('routes')?{routes:[{route:'00000315--4742c01c35',segmentFolders:[segment],segmentCount:1,segmentTimes:{[segment]:{startEpoch:1791949800,endEpoch:1791949860}},routeStartEpoch:1791949800,routeEndEpoch:1791949860,latestModifiedEpoch:1791949860}],total:1,hasMore:false,storage:{used:12800000,limit:5000000000}}:{recentSegment:''})});
 }
 const file=path.join(root,u.pathname.replace(/^\/(?:logs|carrot_ha_static\/carrot_logs)\//,''));
 if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css'});
 return route.fulfill({status:404,body:'missing'});
});
await page.goto('https://example.test/logs/logs.html');
fixtureVideo = await page.evaluate(async () => {
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=72;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#e84a31';ctx.fillRect(0,0,128,72);
 const stream=canvas.captureStream(10), recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
 const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);
 const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
 await new Promise(resolve=>setTimeout(resolve,400));recorder.stop();await stopped;stream.getTracks().forEach(track=>track.stop());
 return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
});
// Only the owning parent can initialize the scope.
await page.evaluate(()=>window.postMessage({type:'carrot:logs_session',base:'/api/carrot_ha/v1/driving_logs/test',enabled:true},location.origin));
await page.locator('[data-route-card]').waitFor();
assert.ok(await page.locator('.dashcam-segment-tile').first().isVisible(), 'wide-layout segment list must be visible');
await page.waitForFunction(()=>document.querySelector('.dashcam-route-preview img')?.src.startsWith('blob:'));
const thumb=await page.locator('.dashcam-route-preview img').evaluate(image=>({width:image.naturalWidth,height:image.naturalHeight}));
assert.equal(thumb.width,480);assert.ok(thumb.height>0);
await page.locator('[data-action="select-route"]').click();
await page.getByText('선택 1개',{exact:true}).waitFor();
await page.locator('#logsMenuButton').click(); await page.getByText('내림차순', {exact:false}).waitFor();
await page.keyboard.press('Escape');
await page.locator('[data-action="play"]').first().click();
await page.locator('.dashcam-player-close').waitFor();
await page.waitForTimeout(300);
assert.equal(await page.locator('video').getAttribute('src'), '/api/carrot_ha/v1/driving_logs/test/dashcam/video/'+segment);
await page.locator('.dashcam-player-close').click();
await page.setViewportSize({width:390,height:844});
await page.waitForTimeout(200);
assert.ok(await page.locator('[data-route-card]').isVisible());
await page.screenshot({path:'/private/tmp/carrot-logs-mobile.png'});
if(replayRoot) {
 await page.setViewportSize({width:1300,height:900});
 await page.locator('[data-action="segment-menu"]').first().click();
 await page.getByText('리플레이',{exact:true}).click();
 await page.waitForFunction(()=>window.CarrotVisionReplay.status().timelineReady,{timeout:60000});
 await page.waitForFunction(()=>document.getElementById('carrotRoadVideo').readyState>=2);
 const status=await page.evaluate(()=>window.CarrotVisionReplay.status());
 assert.ok(status.services.carState>0);assert.ok(status.duration>0);
 await page.evaluate(()=>{const video=document.getElementById('carrotRoadVideo');video.pause();video.currentTime=10;});
 await page.waitForFunction(()=>document.getElementById('carrotRoadVideo').currentTime>=9 && typeof window.CarrotHudState?.carState?.vEgo==='number',{timeout:15000});
 await page.waitForFunction(()=>document.getElementById('carrotRoadVideo').readyState>=2 && !document.getElementById('carrotRoadVideo').seeking,{timeout:15000});
 assert.ok((await page.locator('#haReplayValues').innerText()).includes('km/h'));
 await page.locator('#btnCarrotReplayPlay').click();
 await page.waitForFunction(()=>document.getElementById('carrotRoadVideo').currentTime>10.3 && !document.getElementById('carrotRoadVideo').paused);
 await page.waitForTimeout(350);
 assert.ok(await page.locator('#carrotRoadVideo').evaluate(video=>Number(getComputedStyle(video).opacity)>.9));
 await page.locator('#btnCarrotReplayPlay').click();
 await page.locator('#carrotReplayInsightsGraphsTab').click();
 assert.ok(await page.locator('#carrotReplayInsightsGraphsPanel').isVisible());
 await page.waitForFunction(()=>document.querySelector('[data-replay-graph="speed"] polyline')?.getAttribute('points')?.length>20);
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(250);
 assert.ok((await page.locator('#carrotRoadVideo').boundingBox()).width>200);
 await page.setViewportSize({width:1300,height:900});
 await page.waitForTimeout(250);
 await page.screenshot({path:'/private/tmp/carrot-recorded-replay.png'});
 await page.locator('#btnCarrotReplayClose').click();
 assert.equal(await page.evaluate(()=>window.CarrotVisionReplay.isActive()),false);
 console.log('PASS real recorded rlog: original worker parsing, video, telemetry seek and close');
}
assert.deepEqual(errors,[]);
console.log('PASS original log UI: list, selection, sort dialog, player URL, close and mobile layout');
}finally{await browser.close();}})();
