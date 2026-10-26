const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1300,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root=path.resolve('custom_components/carrot_ha/frontend');
 await page.route('https://params.test/**',async route=>{
  const p=new URL(route.request().url()).pathname;
  if(p==='/')return route.fulfill({contentType:'text/html',body:'<script type="module" src="/carrot_ha_static/carrot-parameter-tuning-card.js"></script>'});
  const file=path.join(root,p.replace('/carrot_ha_static/',''));
  if(!fs.existsSync(file))return route.fulfill({status:404,body:'missing'});
  return route.fulfill({path:file});
 });
 await page.goto('https://params.test/');
 await page.evaluate(async()=>{
  await customElements.whenDefined('carrot-parameter-tuning-card');
  window.snapshot={ok:true,param_queue_protocol:1,updated_at:new Date().toISOString(),device_id:'car-a',values:{Toggle:0},catalog:{groups:[{group:'테스트',count:1}],items_by_group:{테스트:[{name:'Toggle',title:'복원 시험',group:'테스트',min:0,max:1,unit:1,default:0}]}}};
  window.queue=[];let nextId=1;window.card=document.createElement('carrot-parameter-tuning-card');card.setConfig({device_id:'car-a'});document.body.append(card);
  card.hass={callApi:async(method,url,body)=>{
   if(url.endsWith('/devices'))return {devices:[{device_id:'car-a',entry_id:'entry-a'}]};
   if(url.includes('/settings/'))return structuredClone(snapshot);
   if(url.includes('/param_status/'))return {ok:true,queue:structuredClone(queue)};
   if(url.includes('/param_set/')){const id=nextId++;queue.push({id,param_name:body.name,param_value:body.value,status:'pending'});return {ok:true,ids:[id]};}
   throw Error(url);
  }};
 });
 const frame=page.frameLocator('#carrotSettingsFrame');await frame.locator('#groupList button[data-group]').last().click();
 const row=frame.locator('.setting[data-setting-name="Toggle"]');const toggle=row.locator('input[type=checkbox]');await toggle.waitFor({state:'attached'});
 async function request(){await toggle.evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});await page.waitForFunction(()=>card._pending.size===1);await row.locator('.ha-param-state').filter({hasText:'적용 대기'}).waitFor();assert.equal(await toggle.isDisabled(),true);}
 async function status(value,actual){await page.evaluate(async({value,actual})=>{queue.at(-1).status=value;if(actual!==undefined)snapshot.values.Toggle=actual;await card._checkPendingStatus();},{value,actual});}
 await request();await status('failed');await row.locator('.ha-param-state').filter({hasText:'변경 실패'}).waitFor();assert.equal(await toggle.isChecked(),false);assert.equal(await toggle.isDisabled(),false);
 await request();await status('applied',0);await row.locator('.ha-param-state').filter({hasText:'차량 확인값: 0'}).waitFor();assert.equal(await toggle.isChecked(),false);
 await request();await page.evaluate(async()=>{for(const req of card._pending.values())req.started=Date.now()-101000;await card._checkPendingStatus();});
 await row.locator('.ha-param-state').filter({hasText:'적용 여부 미확인'}).waitFor();assert.equal(await toggle.isChecked(),false);assert.equal(await page.evaluate(()=>card._pending.size),1);
 await status('applied',1);await page.waitForFunction(()=>card._pending.size===0);
 await toggle.waitFor({state:'attached'});await page.waitForFunction(()=>{const w=card.shadowRoot.querySelector('iframe').contentWindow;return w.document.querySelector('.setting[data-setting-name="Toggle"] input[type=checkbox]')?.checked===true;});
 await row.locator('.ha-param-state').filter({hasText:'차량 확인값: 1'}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS real control: failure rollback, duplicate control lock, authoritative mismatch value, uncertain timeout rollback and late vehicle confirmation');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
