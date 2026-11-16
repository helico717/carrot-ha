// Real card + synthetic HA/map responses; no production method or style overrides.
const {chromium}=require('playwright');
const http=require('http');
const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.JOURNAL_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const url=`http://127.0.0.1:${server.address().port}/vehicle-journal/review-favorite-dropdown.html?embed=1&mode=`;
   await page.goto(url+'refueling');
   const card=page.locator('carrot-vehicle-journal'),summary=card.locator('.favorite-dropdown summary'),details=card.locator('.favorite-dropdown');
   await summary.waitFor();
   const geometry=await page.evaluate(()=>{
    const c=window.card,s=c.$('favoritePlaces'),m=c.$('locationMap'),b=s.querySelector('summary'),r=b.getBoundingClientRect(),map=m.getBoundingClientRect();
    return {onMap:s.parentElement.classList.contains('loc-map-container'),height:r.height,top:r.top-map.top,left:r.left-map.left,radius:getComputedStyle(b).borderRadius,color:getComputedStyle(b).color};
   });
   assert.equal(geometry.onMap,true);assert(geometry.height<=25);assert.equal(geometry.radius,'999px');assert.equal(geometry.color,'rgb(245, 248, 250)');assert(geometry.top>=0);assert(geometry.left>=0);
   if(width===390)assert(geometry.top<=11);
   assert.equal(await details.getAttribute('open'),null);
   await summary.click();
   assert.notEqual(await details.getAttribute('open'),null);
   assert(await card.locator('.favorite-list').evaluate(e=>e.scrollHeight>e.clientHeight));
   // Re-rendering the same data must keep the user's open menu and focused DOM.
   await page.evaluate(()=>{window.favoriteSummary=window.card.$('favoritePlaces').querySelector('summary');window.card.renderFavorite();});
   assert(await page.evaluate(()=>window.favoriteSummary===window.card.$('favoritePlaces').querySelector('summary')));
   await summary.press('Escape');
   assert.equal(await details.getAttribute('open'),null);assert(await card.locator('#recordDialog').evaluate(e=>e.open));
   await summary.click();await card.locator('#placeQuery').click();assert.equal(await details.getAttribute('open'),null);
   await summary.click();await card.locator('[data-favorite="1"]').click();
   assert.equal(await details.getAttribute('open'),null);assert.equal(await card.locator('#locationName').inputValue(),'합성 마트 급속충전소');
   await summary.click();page.once('dialog',d=>d.dismiss());await card.locator('[data-favorite-remove="0"]').click();
   assert.equal(await card.locator('[data-favorite]').count(),12);
   page.once('dialog',d=>d.accept());await card.locator('[data-favorite-remove="0"]').click();
   await page.waitForFunction(()=>window.card.$('favoriteCount').textContent==='11');
   assert.equal(await card.locator('#locationName').inputValue(),'합성 마트 급속충전소');
   await page.evaluate(()=>{window.card.entries.find(e=>e.entry_id===window.card.entry).fuel='gasoline';window.card.renderFavorite();});
   assert.equal(await card.locator('#favoritePlaces').isVisible(),false);
   await page.goto(url+'maintenance');await card.locator('#recordDialog').waitFor();
   assert.equal(await card.locator('#favoritePlaces').isVisible(),false);
   assert.deepEqual(errors,[]);console.log(`PASS favorite dropdown: ${width}px, map overlay, compact pill, scroll, keyboard, outside click, selection, delete/cancel, EV/empty`);
   await page.close();
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
