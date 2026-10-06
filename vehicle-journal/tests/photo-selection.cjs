const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.JOURNAL_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const source=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-vehicle-journal.js','utf8');
  const design=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-journal-design.js','utf8').replace('export const','const');
  const view=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-view-state.js','utf8').replace(/export function/g,'function');
  await page.setContent('<main id="mount"></main>');
  await page.addScriptTag({content:design+'\n'+view+'\n'+source.replace(/^import .*;$/gm,'').replace('export class','class').replace('export default VehicleJournal;','')});
  const png=Buffer.from(await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=40;c.height=40;return c.toDataURL('image/png').split(',')[1];
  }),'base64');
  await page.evaluate(()=>{
   const card=document.createElement('carrot-vehicle-journal');document.getElementById('mount').append(card);card.setConfig({});card.entry='entry';window.saved=[];window.uploads=[];
   card.call=async(type,msg)=>{window.saved.push({type,...msg});return {id:msg?.record_id,version:2};};
   card.load=async()=>{};card._hass={fetchWithAuth:async(url,options)=>{const file=options.body.get('file');window.uploads.push({size:file.size,type:file.type,name:file.name});return {ok:true};}};
   card.openRecord();
  });
  const root=page.locator('carrot-vehicle-journal');
  await root.locator('input[name="date"]').fill('2026-04-17');await root.locator('#actualKrw').fill('77000');await root.locator('textarea[name="memo"]').fill('Keep this memo');
  const files=['one.png','two.png'].map(name=>({name,mimeType:'image/png',buffer:png}));
  await root.locator('#photos').setInputFiles(files);
  assert.equal(await root.locator('#photoPreview button').count(),2);
  await root.locator('#photoPreview button').first().click();
  assert.equal(await root.locator('#photoPreview button').count(),1);
  assert.equal(await root.locator('textarea[name="memo"]').inputValue(),'Keep this memo');
  assert.equal((await root.locator('#actualKrw').inputValue()).replace(/,/g,''),'77000');
  await root.locator('#clearPhotos').click();assert.equal(await root.locator('#photoPreview img').count(),0);
  assert.equal(await root.locator('input[name="date"]').inputValue(),'2026-04-17');
  await root.locator('#photos').setInputFiles(files.slice(0,1));await root.locator('#save').click();
  await page.waitForFunction(()=>window.uploads.length===1);
  assert.deepEqual(await page.evaluate(()=>window.uploads.map(x=>x.type)),['image/jpeg']);
  assert.equal(await page.evaluate(()=>window.saved[0].payload.memo),'Keep this memo');
  // Broken photos fail before any record is created; fields remain editable.
  await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').openRecord());
  await root.locator('textarea[name="memo"]').fill('Still here');await root.locator('#actualKrw').fill('77000');
  await root.locator('#photos').setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:Buffer.from('broken')});
  await root.locator('#save').click();await root.locator('#recordError').filter({hasText:'읽지 못했어요'}).waitFor();
  assert.equal(await page.evaluate(()=>window.saved.length),1);
  assert.equal(await root.locator('textarea[name="memo"]').inputValue(),'Still here');
  await root.locator('#clearPhotos').click();await root.locator('#save').click();await page.waitForFunction(()=>window.saved.length===2);assert.equal(await page.evaluate(()=>window.saved.length),2);
  // Editing reuses the ID and current version.
  await page.evaluate(()=>document.querySelector('carrot-vehicle-journal').openRecord({id:'existing',version:3,input:{kind:'expense',date:'2026-04-17',category:'maintenance',actual_krw:77000,memo:'existing'}}));
  await root.locator('textarea[name="memo"]').fill('edited');await root.locator('#save').click();
  await page.waitForFunction(()=>window.saved.length===3);
  const edit=await page.evaluate(()=>window.saved[2]);assert.equal(edit.record_id,'existing');assert.equal(edit.expected_version,3);assert.equal(edit.payload.memo,'edited');
  assert.deepEqual(errors,[]);console.log('Photo selection UI OK: individual/all cancel preserve fields, upload JPEG, invalid photo creates no record, manual edit retains ID/version');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
