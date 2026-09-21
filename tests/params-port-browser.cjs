// Run: NODE_PATH=<runtime node_modules> node tests/params-port-browser.cjs
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve('custom_components/carrot_ha/frontend');
(async () => {
  const browser = await chromium.launch({headless:true, channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1300,height:900}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:'<body><script type="module">import "/carrot_ha_static/carrot-params-card.js";</script></body>'});
      if (!url.pathname.startsWith('/carrot_ha_static/')) return route.fulfill({status:404,body:'fixture: unavailable'});
      const file = path.join(root, url.pathname.slice('/carrot_ha_static/'.length));
      if (!fs.existsSync(file)) return route.fulfill({status:404,body:'missing asset'});
      return route.fulfill({path:file});
    });
    await page.goto('http://localhost/');
    await page.evaluate(async () => {
      await customElements.whenDefined('carrot-params-card');
      const items = [
        {name:'TestOffset',title:'차선 보정 테스트',descr:'설명',group:'테스트',min:0,max:100,default:0,unit:1},
        {name:'TestToggle',title:'테스트 스위치',group:'테스트',min:0,max:1,default:0,unit:1}
      ];
      window.snapshot = {ok:true,param_queue_protocol:1,device_id:'car-a',values:{TestOffset:0,TestToggle:0},catalog:{groups:[{group:'테스트',egroup:'Test',count:2}],items_by_group:{테스트:items},unit_cycle:[1,2,5]}};
      window.calls = []; window.queue = []; window.failWrite = false;
      window.card = document.createElement('carrot-params-card');
      card.setConfig({device_id:'car-a'}); document.body.append(card);
      card.hass = {callApi:async (method,url,body) => {
        calls.push({method,url,body});
        if (url.endsWith('/devices')) return {devices:[{device_id:'car-a',entry_id:'entry-a'}]};
        if (url.includes('/settings/')) return structuredClone(snapshot);
        if (url.includes('/param_status/')) return {ok:true,queue:structuredClone(queue)};
        if (url.includes('/param_set/')) {
          if (failWrite) throw new Error('test rejection');
          queue.push({id:77,param_name:body.name,param_value:body.value,status:'pending'});
          return {ok:true,ids:[77]};
        }
        throw new Error(url);
      }};
    });
    const frame = page.frameLocator('#carrotSettingsFrame');
    await frame.locator('#groupList button[data-group]').last().waitFor();
    await frame.locator('#groupList button[data-group]').last().click();
    await frame.locator('#items').getByText('TestOffset', {exact:true}).waitFor();
    console.log('PASS: real iframe renders catalog and parameter rows');
    const child = page.frames().find(f => f.url().includes('settings.html'));
    // Parent-window message has the same origin but the wrong source.
    await page.evaluate(() => window.postMessage({type:'carrot:param_set',requestId:'evil',name:'TestOffset',value:8},location.origin));
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => calls.filter(c=>c.method==='POST').length),0);
    const unsupported = await child.evaluate(async () => {try {await postJson('/api/set_default',{});return false;}catch{return true;}});
    assert.equal(unsupported,true);
    // Write must remain unresolved until its exact queue ID is applied.
    await child.evaluate(() => {window.writeResult=null; postJson('/api/param_set',{name:'TestOffset',value:4}).then(r=>window.writeResult=r).catch(e=>window.writeResult={error:e.message});});
    await page.waitForFunction(() => queue.length===1);
    assert.equal(await child.evaluate(()=>window.writeResult),null);
    await page.evaluate(async () => {queue.push({id:1,param_name:'TestOffset',status:'applied'});await card._checkPendingStatus();});
    assert.equal(await child.evaluate(()=>window.writeResult),null);
    await page.evaluate(async () => {queue[0].status='applied'; snapshot.values.TestOffset=4;await card._checkPendingStatus();});
    await child.waitForFunction(()=>window.writeResult?.value===4);
    await page.evaluate(()=>window.failWrite=true);
    const rejected = await child.evaluate(async () => {try {await postJson('/api/param_set',{name:'TestOffset',value:9});return false;}catch(e){return e.message.includes('test rejection');}});
    assert.equal(rejected,true);
    assert.equal(await child.evaluate(async ()=>(await getJson('/api/params_bulk')).values.TestOffset),4);
    console.log('PASS: source isolation, unsupported actions, failure propagation and exact-ID application');
    await page.evaluate(async () => {
      const item=snapshot.catalog.items_by_group.테스트[0];
      snapshot.catalog.items_by_group.테스트=[{...item,name:'NewParam',title:'새 파라미터'}];snapshot.values={NewParam:7};
      await card._loadData();
    });
    await frame.locator('#items').getByText('NewParam',{exact:true}).waitFor();
    assert.equal(await frame.locator('#items').getByText('TestOffset',{exact:true}).count(),0);
    const input = frame.locator('#settingInlineSearchInput');
    await input.fill('새 파라미터');
    assert.equal(await input.inputValue(),'새 파라미터');
    await page.screenshot({path:'/tmp/carrot-port-fixed.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS: catalog addition/removal, Korean search, no page exceptions');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
