const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const context=await browser.newContext();
  const page=await context.newPage();
  let modelRequests=0,engineRequests=0,release;
  let gate=null;
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<body>cache test</body>'});
   if(url.pathname.endsWith('/vehicle.glb')){modelRequests++;if(gate)await gate;}
   if(url.pathname.endsWith('/vehicle-3d.js'))engineRequests++;
   const file=path.resolve('custom_components/carrot_ha/frontend','.'+url.pathname);
   return fs.existsSync(file)?route.fulfill({path:file,headers:{ETag:'"shipped-model"'}}):route.fulfill({status:404});
  });
  await page.goto('http://localhost/');
  await page.evaluate(async()=>{
   window.module=await import('/carrot-vehicle-3d.js?v=ui-one');
   module.primeVehicle3d({});
  });
  await page.waitForTimeout(50);
  assert.equal(modelRequests,0);assert.equal(engineRequests,0);
  const first=await page.evaluate(async()=>{const m=await module.loadModel(module.DEFAULT_MODEL_URL);return {source:m.source,bytes:m.buffer.byteLength};});
  assert.equal(first.source,'network');assert(first.bytes>0);assert.equal(modelRequests,1);
  await page.waitForFunction(async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('carrot-ha-vehicle-3d',1);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
   try{return await new Promise(resolve=>{const r=db.transaction('models').objectStore('models').get(module.DEFAULT_MODEL_URL);r.onsuccess=()=>resolve(!!r.result?.buffer);});}finally{db.close();}
  });
  await page.reload();
  gate=new Promise(resolve=>release=resolve);
  const cached=await page.evaluate(async()=>{
   const m=await import('/carrot-vehicle-3d.js?v=ui-two');
   m.primeVehicle3d({});
   const result=await m.loadModel(m.DEFAULT_MODEL_URL);
   return {source:result.source,bytes:result.buffer.byteLength,url:m.DEFAULT_MODEL_URL};
  });
  assert.equal(cached.source,'local');assert.equal(cached.bytes,first.bytes);
  assert(!cached.url.includes('ui-two'));assert.equal(engineRequests,0);
  release();
  console.log('PASS persistent IndexedDB survives UI version changes; local load finishes while ETag request is blocked; priming has zero model/engine requests');
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
