// Build with scripts/build_params_preview.py, then serve its output locally.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1360,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const root='/private/tmp/carrot-params-preview';
  await page.route('https://preview.test/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   const file=root+pathname+(pathname.endsWith('/')?'index.html':'');
   if(!fs.existsSync(file))return route.fulfill({status:404,body:'missing'});
   return route.fulfill({path:file});
  });
  await page.goto('https://preview.test/compare.html');
  await page.locator('#status').filter({hasText:'준비됐습니다'}).waitFor();
  const inner=variant=>page.frames().find(f=>f.url().includes('/'+variant+'/carrot_ha_static/carrot_web/settings.html'));
  const before=inner('before'),after=inner('after');assert.ok(before&&after);
  assert.equal(await before.locator('#settingInlineSearchLabel').count(),1);
  assert.equal(await after.locator('#settingInlineSearchLabel').count(),0);
  await page.locator('#search').click();
  await page.locator('#status').filter({hasText:'같은 동작'}).waitFor();
  await after.locator('#settingInlineSearchResults .setting[data-setting-name]').first().waitFor();
  assert.equal(await before.locator('#settingInlineSearchInput').inputValue(),'차선');
  assert.equal(await after.locator('#settingInlineSearchInput').inputValue(),'차선');
  assert.equal(await after.locator('#settingInlineSearchInput').evaluate(el=>el===document.activeElement),true);
  assert.equal(await after.locator('#settingScreenGroups').isVisible(),true);
  await page.screenshot({path:'/private/tmp/params-compare-search.png',fullPage:true});
  await page.locator('#detail').click();
  await page.locator('#status').filter({hasText:'같은 동작'}).waitFor();
  await after.waitForFunction(()=>!!CURRENT_SETTING_DETAIL);
  await page.locator('#back').click();
  await page.locator('#status').filter({hasText:'같은 동작'}).waitFor();
  await after.waitForFunction(()=>!CURRENT_SETTING_DETAIL);
  await after.locator('#settingInlineSearchResults .setting[data-setting-name]').first().waitFor();
  assert.equal(await after.locator('#settingInlineSearchInput').inputValue(),'차선');
  // The real iframe bridge still routes writes through its owning HA card.
  const result=await after.evaluate(async()=>postJson('/api/param_set',{name:'DemoLaneOffset',value:3}));
  assert.equal(result.value,3);
  await page.locator('#desktop').click();
  await page.waitForFunction(()=>document.body.classList.contains('wide'));
  assert.equal(await page.locator('.panel').first().evaluate(el=>el.clientWidth),898);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#mobile').click();
  await page.screenshot({path:'/private/tmp/params-compare-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: existing/new isolated modules; search DOM, mobile in-place results/focus, detail/parent return, exact-ID write confirmation, desktop/mobile controls, no page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
