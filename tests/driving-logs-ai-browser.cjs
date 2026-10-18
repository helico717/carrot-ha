const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[],calls=[];
 page.on('pageerror',e=>errors.push(e.message));
 const root=path.resolve('custom_components/carrot_ha/frontend'),segments=Array.from({length:10},(_,i)=>'000000aa--0123456789--'+i);
 let config={configured:false,model:'gemini-3.8-flash',models:[{id:'gemini-3.8-flash',title:'Gemini 3.8 Flash'}],monthly_budget_usd:2,daily_requests:10,reserved_usd:0,requests_today:0,last_job_id:''},
     localConfig={auto_latest:true},job,localJob,finish=false,localDone=false;
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());calls.push({path:url.pathname+url.search,method:request.method(),body:request.postDataJSON()});
  assert.equal(url.hostname,'logs.test','no live external calls');
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:`<style>body{margin:0;background:#111;color:#eee;font-family:Arial;--card-background-color:#1c1c1c;--primary-text-color:#eee;--secondary-text-color:#aaa;--divider-color:#444;--secondary-background-color:#242424}</style><script type="module">import Card from '/carrot-logs-card.js';const card=document.createElement('carrot-logs-card');document.body.append(card);card.setConfig({});card.hass={locale:{language:'ko'},callApi:async(method,url)=>url.endsWith('/devices')?{devices:[{entry_id:'test',device_id:'car'}]}:{base:'/api/carrot_ha/v1/driving_logs/test',enabled:true}};</script>`});
  if(url.pathname.endsWith('/logs.html'))return route.fulfill({contentType:'text/html',body:`<script>window.addEventListener('message',e=>{if(e.data.type==='carrot:ai_evidence')window.evidenceMessage=e.data;if(e.data.type==='carrot:logs_refresh_analysis')window.refreshCount=(window.refreshCount||0)+1;});parent.postMessage({type:'carrot:logs_ready'},location.origin);</script>`});
  if(url.pathname.endsWith('/ai/config')){if(request.method()==='POST'){const body=request.postDataJSON();config={...config,...body,configured:body.clear_key?false:body.api_key?true:config.configured};delete config.api_key;}return route.fulfill({json:config});}
  if(url.pathname.endsWith('/local/config')){if(request.method()==='POST'){const body=request.postDataJSON();localConfig={auto_latest:Boolean(body.auto_latest)};}return route.fulfill({json:localConfig});}
  if(url.pathname.endsWith('/local/result')){
   if(localDone)return route.fulfill({json:{status:'done',route:'000000aa--0123456789',segments:10,result:{engine:'local-rules',model:'무료 로컬 규칙 분석',summary:'저장된 10개 구간을 순서대로 분석했습니다.',scope:segments.map(s=>({segment:s,frames:40,duration_sec:60})),findings:[{title:'목표 가속도 상승 관측',detail:'저속 목표 가속 상승 반복',evidence_ids:['E1']}],recommendedParams:[{name:'CruiseMaxVals1',title:'저속 가속 상한',current:160,recommended:144,reason:'반복 관측',tradeoff:'출발 반응 완만',evidence_ids:['E1']}],limitations:['규칙 기반 무료 분석이며 외부 AI 호출·파라미터 자동 변경은 없습니다.'],evidence:[{id:'E1',title:'목표 가속도 상승',segment:segments[0],sec:18}],external_requests:0}}});
   return route.fulfill({json:{status:'not_analyzed',result:null,route:'000000aa--0123456789',segments:10}});
  }
  if(url.pathname.endsWith('/local/start')){
   const body=request.postDataJSON();
   localDone=true;
   localJob={id:'localjob',done:true,status:'done',phase:'complete',progress:100,message:'무료 분석 완료',result:{engine:'local-rules',model:'무료 로컬 규칙 분석',summary:`저장된 ${(body.segments||segments).length}개 구간을 순서대로 분석했습니다.`,scope:(body.segments||segments).map(s=>({segment:s,frames:40,duration_sec:60})),findings:[{title:'목표 가속도 상승 관측',detail:'저속 목표 가속 상승 반복',evidence_ids:['E1']}],recommendedParams:[{name:'CruiseMaxVals1',title:'저속 가속 상한',current:160,recommended:144,reason:'반복 관측',tradeoff:'출발 반응 완만',evidence_ids:['E1']}],limitations:['규칙 기반 무료 분석이며 외부 AI 호출·파라미터 자동 변경은 없습니다.'],evidence:[{id:'E1',title:'목표 가속도 상승',segment:(body.segments||segments)[0],sec:18}],external_requests:0}};
   return route.fulfill({json:{job_id:'localjob'}});
  }
  if(url.pathname.endsWith('/local/job'))return route.fulfill({json:localJob});
  if(url.pathname.endsWith('/routes'))return route.fulfill({json:{routes:[{route:'000000aa--0123456789',routeStartEpoch:1800000000,segmentFolders:segments}],hasMore:false}});
  if(url.pathname.endsWith('/ai/models'))return route.fulfill({json:{models:config.models,message:'모델 목록 조회 성공'}});
  if(url.pathname.endsWith('/ai/start')){job={id:'testjob',done:false,phase:'analyzing',progress:65,message:'Gemini 검토 중'};config.last_job_id='testjob';return route.fulfill({json:{job_id:'testjob'}});}
  if(url.pathname.endsWith('/ai/cancel')){job={...job,done:true,status:'canceled',message:'분석을 취소했습니다.'};return route.fulfill({json:{cancel_requested:true}});}
  if(url.pathname.endsWith('/ai/job')){
   if(finish)job={...job,done:true,status:'done',result:{model:config.model,summary:'가속 반응을 추가로 검토하세요. <img src=x onerror=alert(1)>',scope:[{segment:segments[0]}],findings:[{title:'목표 가속 상승',detail:'샘플 근거',evidence_ids:['E1']}],recommendedParams:[{name:'DynamicTFollow',title:'차간거리',current:100,recommended:110,reason:'시험 후보',tradeoff:'간격이 늘 수 있음',evidence_ids:['E1']}],limitations:['현재 값과 당시 설정은 다를 수 있습니다.'],evidence:[{id:'E1',title:'가속 상승',segment:segments[0],sec:12.5}]}};
   return route.fulfill({json:job});
  }
  const file=path.join(root,url.pathname.slice(1));if(fs.existsSync(file))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(file)});
  return route.fulfill({status:404,body:''});
 });
 await page.goto('https://logs.test/');const card=page.locator('carrot-logs-card');
 // 1. Verify menu-triggered confirmation popup & key-free local analysis
 const frame=page.frames().find(f=>f.url().endsWith('/logs.html'));
 await frame.evaluate(segs=>parent.postMessage({type:'carrot:logs_analyze',base:'/api/carrot_ha/v1/driving_logs/test',action:'confirm',mode:'free',route:'000000aa--0123456789',segment:'',checkedSegments:[segs[0],segs[1],segs[2]],allSegments:segs},location.origin),segments);
 await card.locator('#aiConfirm').waitFor({state:'visible'});
 assert.equal(await card.locator('#aiTitle').textContent(),'이 주행을 분석하시겠습니까?');
 assert.equal(await card.locator('#aiConfirmStart').evaluate(el=>el.classList.contains('smallBtn')&&el.classList.contains('btn--filled')),true,'confirm start button uses smallBtn btn--filled');
 assert.equal(await card.locator('#aiConfirmStart').isDisabled(),false,'free analysis start is enabled without Gemini key');
 await card.locator('#aiConfirmStart').click();
 await card.locator('.report-summary').waitFor({state:'visible'});
 assert.equal(calls.filter(c=>c.path.endsWith('/ai/start')).length,0,'free local analysis never calls Gemini');
 const localStart=calls.find(c=>c.path.endsWith('/local/start')).body;
 assert.deepEqual(localStart.segments,[segments[0],segments[1],segments[2]],'confirm checked segments sent to local/start');
 await card.locator('#aiClose').click();

 // 2. Verify manual selection & Gemini AI flow
 await card.locator('#logAiButton').click();await card.locator('#aiChoices details').waitFor();
 assert.equal(calls.filter(c=>c.path.endsWith('/ai/start')).length,0);
 assert.equal(await card.locator('#aiStart').isDisabled(),true);
 await card.locator('#aiConfigTab').click();
 assert.equal(await card.locator('#localAutoLatest').isChecked(),true);
 await card.locator('#localAutoLatest').uncheck();
 await card.locator('#aiStatus').filter({hasText:'마지막 주행 자동 무료 분석을 껐습니다'}).waitFor();
 await card.locator('#aiKey').fill('synthetic-key-for-ui-only');await card.locator('#aiSave').click();
 await card.locator('#aiStatus').filter({hasText:'HA에 연결 설정을 저장했습니다'}).waitFor();assert.equal(await card.locator('#aiKey').inputValue(),'');
 await card.locator('#aiCheckModels').click();await card.locator('#aiStatus').filter({hasText:'모델 목록 조회 성공'}).waitFor();
 await card.locator('#aiAnalysisTab').click();
 for(let i=0;i<8;i++)await card.getByRole('checkbox',{name:segments[i],exact:true}).check();
 await card.getByRole('checkbox',{name:segments[8],exact:true}).click();
 assert.equal(await card.getByRole('checkbox',{name:segments[8],exact:true}).isChecked(),false);
 await card.locator('#aiConsent').check();await card.locator('#aiStart').click();await card.locator('#aiProgress').waitFor({state:'visible'});
 const started=calls.find(c=>c.path.endsWith('/ai/start')).body;assert.equal(started.segments.length,8);assert.equal(started.consent,true);
 await card.locator('#aiCancel').click();await card.locator('#aiStatus').filter({hasText:'취소했습니다'}).waitFor();
 finish=true;await card.locator('#aiStart').click();await card.locator('.report-summary').waitFor();
 assert.equal(await card.locator('#aiResult img').count(),0,'LLM markup rendered as text');
 await card.locator('#aiClose').click();await card.locator('#logAiButton').click();await card.locator('.report-summary').waitFor();
 for(const [width,height] of [[1280,950],[390,844]]){
  await page.setViewportSize({width,height});const bounds=await card.locator('#aiDialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.height<=height);
  assert.equal(await card.locator('.ai-body').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  if(process.env.CARROT_AI_SCREENSHOTS){fs.mkdirSync(process.env.CARROT_AI_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.CARROT_AI_SCREENSHOTS,'ai-result-'+width+'.png')});}
 }
 await page.evaluate(()=>document.body.style.setProperty('--card-background-color','#fff'));await card.locator('.evidence').first().click();
 await page.waitForTimeout(80);assert.equal((await frame.evaluate(()=>window.evidenceMessage)).segment,segments[0]);
 assert.deepEqual(errors,[]);console.log('PASS AI UI: confirm popup, key-free local analysis, auto_latest toggle, manual consent, key save/clear display, model check, max8, cancellation, result, XSS, resume, evidence, mobile/light bounds');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1)});
