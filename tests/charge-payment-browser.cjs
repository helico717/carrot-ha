// NODE_PATH=<bundled node_modules> node tests/charge-payment-browser.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const screenshotDir=path.join(require('node:os').tmpdir(),'carrot-charge-layout');
fs.mkdirSync(screenshotDir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const lang of ['ko','en'])for(const width of [390,1200])for(const dark of [false,true]){
   const page=await browser.newPage({viewport:{width,height:850},hasTouch:width===390});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<style>body{margin:0;font:14px system-ui}#host{height:760px;overflow:auto;padding:20px;box-sizing:border-box}#spacer{height:180px}#bottom{height:600px}</style><div id="host"><div id="spacer"></div><div id="card"></div><div id="bottom"></div></div>'});
    const file=path.resolve('custom_components/carrot_ha/frontend','.'+url.pathname);
    return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'missing'});
   });
   await page.goto('http://localhost/');
   await page.evaluate(async({lang,dark})=>{
    const Card=(await import(`/carrot-dashboard-${lang}.js`)).default;
    customElements.define('payment-test-card',Card);
    // Prevent lifecycle polling; the test controls all asynchronous responses.
    Card.prototype.connectedCallback=function(){};
    window.card=document.createElement('payment-test-card');
    card.config={device_id:'car',theme:dark?'dark':'light'};card.tab='charge';card.device={entry_id:'entry',device_id:'car'};
    document.body.style.setProperty('--card-background-color',dark?'#202528':'#fff');
    document.body.style.setProperty('--primary-text-color',dark?'#eee':'#222');
    const now=new Date();now.setHours(4,0,0,0);
    window.rows=Array.from({length:12},(_,i)=>({event_id:`payment-${i}`,kind:'charge',data:{
     started_at:now.toISOString(),ended_at:new Date(now.getTime()+3600000).toISOString(),duration_s:3600,
     source:"can_request",can_mode:4,confirmed_duration_s:3300,unknown_duration_s:300,gap_corrected:true,corrected_energy_kwh:0.2,
     energy_kwh:10,estimated_cost_krw:2800,effective_cost_krw:2800,actual_cost_krw:null,cost_krw:2800,
     payment_id:`payment-${i}`,source_event_ids:[`source-${i}`],payment_version:0,cost_source:'estimated'}}));
    window.totals={effective_cost_krw:33600,actual_cost_krw:0,estimated_cost_krw:33600,cost_source:'estimated'};
    window.writes=[];window.rejectWrite=false;
    card._hass={config:{time_zone:'Asia/Seoul'},themes:{darkMode:dark},states:{},async callApi(method,url){
     await new Promise(r=>setTimeout(r,60));
     if(url.endsWith('/devices'))return {devices:[card.device]};
     if(url.includes('/dashboard/'))return {values:{...card.v,charge_cost_totals:structuredClone(totals)}};
     if(url.includes('kind=charge'))return {charge_costs_grouped:true,events:structuredClone(rows)};
     if(url.includes('kind=trip'))return {events:[]};throw Error(url);
    },async callWS(msg){
     writes.push(msg);await new Promise(r=>setTimeout(r,80));
     if(rejectWrite)throw {code:'save_failed'};
     const d=rows.find(e=>e.data.payment_id===msg.payment_id).data;
     if(msg.type==='carrot_ha/charge_record/delete'){rows=rows.filter(e=>e.data.payment_id!==msg.payment_id);totals.effective_cost_krw=rows.reduce((s,e)=>s+e.data.effective_cost_krw,0);return {deleted:true};}
     d.actual_cost_krw=msg.type.endsWith('/delete')?null:msg.actual_cost_krw;
     d.effective_cost_krw=d.actual_cost_krw??d.estimated_cost_krw;d.payment_version++;
     d.cost_source=d.actual_cost_krw==null?'estimated':'actual';
     totals={effective_cost_krw:rows.reduce((s,e)=>s+e.data.effective_cost_krw,0),actual_cost_krw:d.actual_cost_krw??0,estimated_cost_krw:d.actual_cost_krw==null?33600:30800,cost_source:d.actual_cost_krw==null?'estimated':'mixed'};
     return {payment_version:d.payment_version};
    }};
    card.v={soc_percent:70,onroad:false,driving:false,charging:false,month_charge_cost:33600,month_slow_kwh:120,month_fast_kwh:0,month_charge_kwh:120,charge_cost_totals:totals,battery_history:[]};
    card.charges=structuredClone(rows);card.themeMode=dark?'dark':'light';card.applyTheme();document.querySelector('#card').append(card);card.render();
   },{lang,dark});
   const pill=page.locator('payment-test-card [data-charge-payment="0"]');
   const text=await page.evaluate(()=>card.shadowRoot.textContent);assert(text.includes(lang==='ko'?'신호 공백':'Signal gap'));assert(text.includes('0.2'));
   const overlap=await page.evaluate(()=>{const meta=card.shadowRoot.querySelector('.charge-meta').getBoundingClientRect(),price=card.shadowRoot.querySelector('.charge-val').getBoundingClientRect();return meta.right>price.left;});assert.equal(overlap,false);
   assert.equal(await page.evaluate(()=>card.getAttribute('data-theme')),dark?'dark':'light');
   if(width===1200){
    const dimensions=await page.evaluate(()=>{const row=card.shadowRoot.querySelector('[data-charge-record]'),actions=row.querySelector('.charge-actions').getBoundingClientRect(),cost=row.querySelector('.charge-val>strong').getBoundingClientRect(),pill=row.querySelector('.charge-payment-pill').getBoundingClientRect(),menu=row.querySelector('.charge-menu summary').getBoundingClientRect();return {height:row.getBoundingClientRect().height,actionsBottom:actions.bottom,costTop:cost.top,pillCenter:(pill.top+pill.bottom)/2,menuCenter:(menu.top+menu.bottom)/2};});
    assert(dimensions.actionsBottom<=dimensions.costTop,JSON.stringify(dimensions));
    assert(Math.abs(dimensions.pillCenter-dimensions.menuCenter)<3,JSON.stringify(dimensions));
    assert(dimensions.height<=120,JSON.stringify(dimensions));
    console.log('compact row',lang,dark?'dark':'light',dimensions.height);
    await page.locator('payment-test-card [data-charge-record="0"]').screenshot({path:path.join(screenshotDir,`carrot-compact-${lang}-${dark?'dark':'light'}.png`)});
   }
   await pill.click();const input=page.locator('dialog input');await input.fill('12,345');
   if(width===390)await page.screenshot({path:path.join(screenshotDir,`carrot-payment-editor-${lang}-${dark?'dark':'light'}.png`)});
   await input.evaluate(el=>el.setSelectionRange(2,4));
   const before=await page.evaluate(()=>{const host=document.querySelector('#host');const list=card.shadowRoot.querySelector('.charge-history .scroll');list.scrollTop=40;window.oldPanel=card.shadowRoot.querySelector('ha-card');window.oldStyle=card.shadowRoot.querySelector('style');return {scroll:host.scrollTop,list:list.scrollTop,day:card.chargeDay};});
   await page.evaluate(async()=>{await card.load(true);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
   assert.equal(await input.inputValue(),'12,345');
   const after=await page.evaluate(()=>({scroll:document.querySelector('#host').scrollTop,list:card.shadowRoot.querySelector('.charge-history .scroll').scrollTop,day:card.chargeDay,panel:oldPanel===card.shadowRoot.querySelector('ha-card'),style:oldStyle===card.shadowRoot.querySelector('style'),focused:document.activeElement===document.querySelector('dialog input'),range:[document.querySelector('dialog input').selectionStart,document.querySelector('dialog input').selectionEnd]}));
   assert.deepEqual({scroll:after.scroll,list:after.list,day:after.day},before);assert(after.panel&&after.style&&after.focused);assert.deepEqual(after.range,[2,4]);
   await page.evaluate(()=>window.rejectWrite=true);await page.locator('dialog .save').click();
   await page.waitForFunction(()=>document.querySelector('dialog .error').textContent.length>0);
   assert.equal(await input.inputValue(),'12,345');
   await page.evaluate(()=>window.rejectWrite=false);await input.fill('0');await page.locator('dialog .save').click();
   await page.waitForFunction(()=>!document.querySelector('dialog')&&card.charges[0].data.actual_cost_krw===0);
   await page.waitForFunction(lang=>card.shadowRoot.querySelector('[data-charge-payment="0"]').textContent.includes(lang==='ko'?'수정':'Edit'),lang);
   assert((await pill.textContent()).includes(lang==='ko'?'수정':'Edit'));
   const actualText=await page.locator('payment-test-card .charge-val').first().textContent();assert(actualText.includes(lang==='ko'?'(실제)':'(actual)'));
   await pill.click();assert.equal(await input.inputValue(),'0');await input.fill('1,234');await page.locator('dialog .save').click();
   await page.waitForFunction(()=>!document.querySelector('dialog')&&card.charges[0].data.actual_cost_krw===1234);
   await page.waitForFunction(()=>card.shadowRoot.querySelector('.charge-val').textContent.includes('1,234'));
   await pill.click();await page.locator('dialog .delete').click();
   await page.waitForFunction(()=>!document.querySelector('dialog')&&card.charges[0].data.actual_cost_krw===null);
   await page.waitForFunction(lang=>card.shadowRoot.querySelector('[data-charge-payment="0"]').textContent.includes(lang==='ko'?'직접 입력':'Enter amount'),lang);
   assert((await pill.textContent()).includes(lang==='ko'?'직접 입력':'Enter amount'));
   assert.equal(await page.evaluate(()=>card.v.charge_cost_totals.effective_cost_krw),33600);
   const row=page.locator('payment-test-card [data-charge-record="0"]');
   const bounds=await row.boundingBox();
   if(width===390){
     const session=await page.context().newCDPSession(page);
     const point=x=>({x,y:bounds.y+bounds.height/2});
     await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(bounds.x+150)]});
     for(let dx=130;dx>=30;dx-=20)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(bounds.x+dx)]});
     await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await session.detach();
   }else{
     await page.locator('payment-test-card [data-charge-record="0"] summary').click();
     await page.locator('payment-test-card [data-charge-menu-delete="0"]').click();
     assert(await page.locator('dialog').isVisible());
     await page.locator('dialog .cancel').click();
     await page.mouse.move(bounds.x+150,bounds.y+bounds.height/2);await page.mouse.down();
     await page.mouse.move(bounds.x+30,bounds.y+bounds.height/2,{steps:6});await page.mouse.up();
   }
   await page.waitForFunction(()=>{const el=card.shadowRoot.querySelector('[data-charge-record="0"]>.charge-meta');return Math.round(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)===-84;});
   if(width===390)await page.screenshot({path:path.join(screenshotDir,`carrot-swipe-delete-${lang}-${dark?'dark':'light'}.png`)});
   await page.locator('payment-test-card [data-charge-delete="0"]').click();
   assert((await page.locator('dialog .warning').textContent()).includes(lang==='ko'?'복원이 불가':'cannot be restored'));
   await page.locator('dialog .cancel').click();
   assert.equal(await page.evaluate(()=>rows.length),12);
   await page.locator('payment-test-card [data-charge-delete="0"]').click();
   await page.locator('dialog .confirm').click();
   await page.waitForFunction(()=>!document.querySelector('dialog')&&card.charges.length===11);
   assert.equal(await page.evaluate(()=>rows.some(e=>e.data.payment_id==='payment-0')),false);
   assert.equal(await page.evaluate(()=>writes.filter(e=>e.type==='carrot_ha/charge_record/delete').length),1);
   const overflow=await page.evaluate(()=>card.shadowRoot.querySelector('.charge-history').scrollWidth>card.shadowRoot.querySelector('.charge-history').clientWidth+1);assert.equal(overflow,false);
   if(width===390)await page.screenshot({path:path.join(screenshotDir,`carrot-payment-${lang}-${dark?'dark':'light'}.png`)});
   assert.deepEqual(errors,[]);console.log(`PASS ${lang} ${width}px ${dark?'dark':'light'}: save/edit/zero/delete/failure/async continuity`);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
