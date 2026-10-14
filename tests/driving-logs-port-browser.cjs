const {chromium}=require('playwright');
const fs=require('fs'), path=require('path'), assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try {
const page=await browser.newPage({viewport:{width:1300,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const root=path.resolve('custom_components/carrot_ha/frontend/carrot_logs');
const segment='00000315--4742c01c35--133';
await page.route('**/*',async route=>{const u=new URL(route.request().url());
 if(u.pathname.startsWith('/api/')) {
  if(/thumbnail|preview/.test(u.pathname)) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#334455"/></svg>'});
  return route.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname.includes('routes')?{routes:[{route:'00000315--4742c01c35',segmentFolders:[segment],segmentCount:1,segmentTimes:{[segment]:{startEpoch:1791949800,endEpoch:1791949860}},routeStartEpoch:1791949800,routeEndEpoch:1791949860,latestModifiedEpoch:1791949860}],total:1,hasMore:false,storage:{used:12800000,limit:5000000000}}:{recentSegment:''})});
 }
 const file=path.join(root,u.pathname.replace('/logs/',''));
 if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css'});
 return route.fulfill({status:404,body:'missing'});
});
await page.goto('https://example.test/logs/logs.html');
// Only the owning parent can initialize the scope.
await page.evaluate(()=>window.postMessage({type:'carrot:logs_session',base:'/api/carrot_ha/v1/driving_logs/test',enabled:true},location.origin));
await page.locator('[data-route-card]').waitFor();
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
assert.deepEqual(errors,[]);
console.log('PASS original log UI: list, selection, sort dialog, player URL, close and mobile layout');
}finally{await browser.close();}})();
