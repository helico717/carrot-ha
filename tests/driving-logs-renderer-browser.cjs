const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1300,height:900}}), errors=[], sockets=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('websocket',s=>sockets.push(s.url()));
  const root=path.resolve('custom_components/carrot_ha/frontend/carrot_logs');
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:{routes:[],total:0,hasMore:false}});
   const file=path.join(root,url.pathname.replace(/^\/carrot_ha_static\/carrot_logs\//,''));
   if(!fs.existsSync(file))return route.fulfill({status:404,body:'missing'});
   let body=fs.readFileSync(file);
   if(file.endsWith('replay_client.js'))body=Buffer.concat([body,Buffer.from(`
    window.CarrotReplayClient.fetchSource=async()=>({});
    window.CarrotReplayClient.start=()=>({profile:{mode:'synthetic'},session:{dispose(){}},
     video:{urlPromise:Promise.resolve(window.testVideo),complete:Promise.resolve()},
     timelinePromise:Promise.resolve({durationMs:3000,metadata:{services:{carState:2,modelV2:2}},records:window.testRecords})});
   `)]);
   return route.fulfill({body,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':file.endsWith('.ttf')?'font/ttf':'text/css'});
  });
  await page.goto('https://renderer.test/carrot_ha_static/carrot_logs/logs.html');
  await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#30383b';ctx.fillRect(0,0,640,360);
   const stream=canvas.captureStream(20),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];
   recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(r=>recorder.onstop=r);recorder.start();
   let tick=0;const timer=setInterval(()=>{ctx.fillStyle=tick++%2?'#30383b':'#30383c';ctx.fillRect(0,0,640,360);},50);
   await new Promise(r=>setTimeout(r,3000));clearInterval(timer);recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
   window.testVideo=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));
   const x=Array.from({length:33},(_,i)=>i*3), line=y=>({x,y:x.map(()=>y),z:x.map(()=>0),t:x.map((_,i)=>i/10)});
   const frames=speed=>[
    {service:'carState',decoded:{vEgo:speed,vEgoCluster:speed,aEgo:0.4,gearShifter:'drive',steeringAngleDeg:3,cruiseState:{enabled:true,speed:25}}},
    {service:'controlsState',decoded:{enabled:true,active:true}},
    {service:'liveCalibration',decoded:{calStatus:'calibrated',rpyCalib:[0,0,0]}},
    {service:'deviceState',decoded:{deviceType:'mici'}},
    {service:'roadCameraState',decoded:{sensor:'os04c10'}},
    {service:'modelV2',decoded:{position:line(0),laneLines:[line(-5.4),line(-1.8),line(1.8),line(5.4)],laneLineProbs:[1,1,1,1],roadEdges:[line(-6),line(6)],roadEdgeStds:[0.1,0.1],velocity:{x:x.map(()=>speed)},meta:{engagedProb:1}}},
    {service:'radarState',decoded:{leadOne:{status:true,dRel:35,yRel:0,vRel:0},leadTwo:{status:false}}}
   ];
   window.testRecords=[{timeMs:0,frames:frames(10)},{timeMs:1000,frames:frames(20)}];
  });
  const started=await page.evaluate(()=>window.CarrotVisionReplay.start({segment:'synthetic--1',segments:['synthetic--0','synthetic--1','synthetic--2']}));
  assert.equal(started,true,await page.locator('#haLogsStatus').innerText());
  await page.waitForFunction(()=>window.CarrotVisionReplay.isReady());
  assert.ok(await page.locator('#carrotReplaySegmentSelect option[aria-current="true"]').innerText().then(t=>t.includes('[현재 구간]') && t.includes('synthetic--1')));
  await page.locator('#haReplayNext').click();
  await page.waitForFunction(()=>window.CarrotVisionReplay.status().segment==='synthetic--2' && window.CarrotVisionReplay.isReady());
  assert.ok(await page.locator('#haReplayNext').isDisabled());
  await page.locator('#haReplayPrevious').click();
  await page.waitForFunction(()=>window.CarrotVisionReplay.status().segment==='synthetic--1' && window.CarrotVisionReplay.isReady());
  await page.evaluate(()=>document.getElementById('carrotRoadVideo').pause());
  assert.ok(await page.locator('[data-carrot-hud="overlay"]').isVisible());
  assert.equal(await page.evaluate(()=>typeof window.DriveVisionFacade.replay.renderVideoFrame),'function');
  assert.ok(await page.evaluate(async()=>{const image=new Image();image.src='/carrot_ha_static/carrot_logs/shared-assets/icons_mici/carrot_wheel_org.png';await image.decode();return image.naturalWidth>0;}));
  const pixels=()=>page.evaluate(()=>{
   const canvas=document.getElementById('carrotPerformanceCanvas'),gl=canvas.getContext('webgl2');
   window.HomeDrive.renderReplayVideoFrame({force:true,overlayDirty:true,hudDirty:true});
   const bytes=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
   let count=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i])count++;return count;
  });
  assert.ok(await pixels()>100,'GPU road geometry must contain visible pixels');
  for(const time of [1.5,0.2]){
   await page.evaluate(t=>{document.getElementById('carrotRoadVideo').currentTime=t;},time);
   await page.waitForFunction(t=>!document.getElementById('carrotRoadVideo').seeking && window.CarrotHudState.carState.vEgo===(t>1?20:10),time,{timeout:5000}).catch(async error=>{console.log(await page.evaluate(()=>({status:window.CarrotVisionReplay.status(),speed:window.CarrotHudState.carState,video:{time:document.getElementById('carrotRoadVideo').currentTime,seeking:document.getElementById('carrotRoadVideo').seeking}})),errors);throw error;});
   await page.waitForTimeout(100);
   assert.ok(await pixels()>100,'geometry must survive forward/backward seek');
  }
  await page.screenshot({path:path.join(os.tmpdir(),'carrot-hud-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  await page.screenshot({path:path.join(os.tmpdir(),'carrot-hud-mobile.png')});
  assert.ok((await page.evaluate(()=>window.DriveVisionHudContent.status().suppressions)).includes('replay-insights'),'preserve original portrait analysis layout');
  assert.ok(await pixels()>100,'mobile GPU overlay must render');
  await page.screenshot({path:path.join(os.tmpdir(),'carrot-hud-mobile.png')});
  await page.setViewportSize({width:1300,height:900});await page.waitForTimeout(200);
  await page.locator('#carrotReplayHudToggle').evaluate(e=>e.click());
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.chud-zone')).visibility==='hidden');
  await page.locator('#carrotReplayHudToggle').evaluate(e=>e.click());
  await page.locator('#btnCarrotReplayClose').click();
  assert.equal(await page.evaluate(()=>window.CarrotVisionReplay.isActive()),false);
  assert.deepEqual(sockets,[],'recorded renderer must never open a live socket');
  assert.deepEqual(errors,[]);
  console.log('PASS original HUD and GPU geometry: desktop/mobile, forward/backward seek, close, zero live sockets');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
