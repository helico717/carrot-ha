const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 let version='0.8.13-test-one';const requests=[];
 const fixture={totals:{distance_km:42,total_cost_krw:123},daily:[],records:Array.from({length:30},(_,i)=>({id:'synthetic-'+i,status:'active',kind:'expense',origin:'auto',accounting_date:'2025-09-01',category:'charging',actual_krw:123})),categories:{},coverage:{},comparison:null,fuel_sensors:{},status:{phase:'complete'},record_count:30,timezone:'Asia/Seoul',has_more:false};
 const server=http.createServer((req,res)=>{
  requests.push(req.url);
  if(req.url.startsWith('/api/carrot_ha/frontend-version')){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({version}));return;}
  if(req.url.startsWith('/carrot_ha_static/')){const file=path.basename(new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync('custom_components/carrot_ha/frontend/'+file));return;}
  res.setHeader('Content-Type','text/html');res.end(`<style>body{margin:0}.ha-scroll{height:700px;overflow:auto}</style><div class="ha-scroll"><carrot-journal-panel></carrot-journal-panel></div><script>
  document.querySelector('carrot-journal-panel').hass={callWS:async msg=>msg.type.endsWith('/entries')?[{entry_id:'synthetic',title:'Test EV'}]:${JSON.stringify(fixture)}};
  </script><script type="module" src="/carrot_ha_static/carrot-journal-panel.js?v=old-startup-hash"></script>`);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/carrot-journal`);
 await page.getByRole('tab',{name:'상세 기록',exact:true}).waitFor();
 const card=()=>document.querySelector('carrot-journal-panel').card;
 await page.waitForFunction(()=>document.querySelector('carrot-journal-panel').card?.data);
 for(const file of ['carrot-journal-panel-runtime.js','carrot-vehicle-journal.js','carrot-journal-design.js','carrot-view-state.js'])assert(requests.includes(`/carrot_ha_static/${file}?v=${version}`),file+' missing version');
 await page.evaluate(()=>{const c=document.querySelector('carrot-journal-panel').card;c.$('month').value='2025-09';c.selectTab(3);c.openRecord();c.$('recordForm').elements.memo.value='unsaved';});
 version='0.8.13-test-two';
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.getByRole('button',{name:'새 화면 버전 적용',exact:true}).waitFor();
 await page.evaluate(()=>document.querySelector('carrot-journal-panel').shadowRoot.getElementById('apply').click());
 assert.equal(await page.evaluate(()=>document.querySelector('carrot-journal-panel').card.$('recordForm').elements.memo.value),'unsaved');
 assert(await page.getByText('작성 중인 기록·사진 또는 비교 기준을 먼저 저장하거나 취소해 주세요.').isVisible());
 await page.evaluate(()=>{const c=document.querySelector('carrot-journal-panel').card;c.$('recordDialog').close();c.$('compareForm').dispatchEvent(new Event('input'));});
 await page.evaluate(()=>document.querySelector('carrot-journal-panel').shadowRoot.getElementById('apply').click());
 assert.equal(await page.evaluate(()=>document.querySelector('carrot-journal-panel').card.comparisonDirty),true);
 await page.evaluate(()=>{document.querySelector('carrot-journal-panel').card.comparisonDirty=false;document.querySelector('.ha-scroll').scrollTop=150;});
 const before=await page.evaluate(()=>document.querySelector('.ha-scroll').scrollTop);
 await Promise.all([page.waitForEvent('load'),page.evaluate(()=>document.querySelector('carrot-journal-panel').shadowRoot.getElementById('apply').click())]);
 await page.waitForFunction(()=>document.querySelector('carrot-journal-panel').card?.data);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
 const state=await page.evaluate(()=>{const c=document.querySelector('carrot-journal-panel').card;return {month:c.$('month').value,tab:c.tab,scroll:document.querySelector('.ha-scroll').scrollTop,stored:sessionStorage.getItem('carrot-journal-update-view')};});
 assert.equal(state.month,'2025-09');assert.equal(state.tab,3);assert.equal(state.scroll,before);assert.equal(state.stored,null);
 assert(requests.includes('/carrot_ha_static/carrot-journal-panel-runtime.js?v=0.8.13-test-two'));
 assert.equal(await page.getByRole('button',{name:'새 화면 버전 적용',exact:true}).isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS: latest module chain, pre-upgrade hass, guarded drafts, reload state/scroll, one-shot view storage');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
