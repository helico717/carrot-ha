/** Manual, server-backed analysis of selected saved logs. No parameter writes. */
const css=`
#aiDialog{--ai-bg:var(--card-background-color,#1c1c1c);--ai-raised:var(--secondary-background-color,#24282f);--ai-line:var(--divider-color,#373d46);--ai-text:var(--primary-text-color,#eceef2);--ai-muted:var(--secondary-text-color,#a2aab7);--ai-accent:#ef9b59;color-scheme:var(--ha-card-color-scheme,normal);width:min(900px,calc(100vw - 28px));height:min(880px,calc(100dvh - 32px));max-width:none;max-height:none;box-sizing:border-box;padding:0;border:1px solid var(--ai-line);border-radius:14px;background:var(--ai-bg);color:var(--ai-text);overflow:hidden;box-shadow:0 24px 90px #0006;font:14px/1.6 var(--paper-font-body1_-_font-family,system-ui)}
#aiDialog *{box-sizing:border-box}#aiDialog[open]{display:flex;flex-direction:column}#aiDialog::backdrop{background:#0009;backdrop-filter:blur(3px)}#aiDialog [hidden]{display:none!important}#aiDialog button,#aiDialog input,#aiDialog textarea,#aiDialog select{font:inherit;color:inherit}#aiDialog button{cursor:pointer;border:1px solid var(--ai-line);border-radius:8px;background:var(--ai-raised);padding:9px 14px}#aiDialog button:disabled{opacity:.45;cursor:default}#aiDialog button:focus-visible,#aiDialog input:focus-visible,#aiDialog select:focus-visible,#aiDialog textarea:focus-visible{outline:2px solid var(--ai-accent);outline-offset:2px}#aiDialog .primary{background:#ffad6c;color:#38200d;border-color:transparent;font-weight:650}#aiDialog .ai-head{padding:20px 26px;border-bottom:1px solid var(--ai-line);display:flex;justify-content:space-between;align-items:center;gap:12px}#aiDialog h1{font-size:22px;margin:2px 0 0;line-height:1.4}#aiDialog .eyebrow{color:var(--ai-accent);font-size:11px;letter-spacing:.12em;font-weight:650}#aiDialog .ai-body{padding:0 26px 24px;overflow:auto;flex:1;min-height:0;overscroll-behavior:contain}#aiDialog .ai-tabs{display:flex;gap:22px;border-bottom:1px solid var(--ai-line);position:sticky;top:0;background:var(--ai-bg);z-index:1;margin-bottom:20px}#aiDialog .ai-tabs button{background:none;border:0;border-bottom:2px solid transparent;padding:14px 0;border-radius:0;color:var(--ai-muted)}#aiDialog .ai-tabs button[aria-selected=true]{color:var(--ai-accent);border-bottom-color:var(--ai-accent)}#aiDialog h2{font-size:16px;margin:20px 0 10px}#aiDialog p{margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}#aiDialog .muted{color:var(--ai-muted);font-size:12px}#aiDialog .ai-choices{border:1px solid var(--ai-line);border-radius:10px;overflow:hidden;max-height:300px;overflow-y:auto}#aiDialog details{background:var(--ai-raised);padding:12px 14px;border-bottom:1px solid var(--ai-line)}#aiDialog details:last-child{border:0}#aiDialog summary{cursor:pointer;overflow-wrap:anywhere}#aiDialog .segments{display:flex;flex-wrap:wrap;gap:8px 18px;padding-top:12px}#aiDialog .segments label{font-size:12px;display:flex;align-items:center;gap:5px}#aiDialog input[type=checkbox]{accent-color:var(--ai-accent);width:16px;height:16px;flex:none}#aiDialog .field{display:flex;flex-direction:column;gap:7px;margin:16px 0;font-size:13px;font-weight:600}#aiDialog input:not([type=checkbox]),#aiDialog textarea,#aiDialog select{background:var(--ai-raised);border:1px solid var(--ai-line);border-radius:8px;padding:10px 12px;width:100%;min-width:0}#aiDialog textarea{resize:vertical;min-height:75px}#aiDialog .checkline{display:flex;align-items:flex-start;gap:8px;font-size:13px;margin:14px 0}#aiDialog .actions{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:18px}#aiDialog .notice{padding:12px 14px;border:1px solid var(--ai-line);border-radius:9px;font-size:13px;margin:14px 0}#aiDialog a{color:var(--ai-accent)}#aiDialog .ai-progress{text-align:center;padding:65px 8px}#aiDialog progress{width:min(360px,100%);height:5px;accent-color:var(--ai-accent);border-radius:4px;overflow:hidden;margin:24px auto;display:block}#aiDialog .finding,#aiDialog .recommendation{border:1px solid var(--ai-line);border-radius:10px;padding:16px;margin:12px 0;background:var(--ai-raised)}#aiDialog h3{font-size:15px;margin:0 0 8px}#aiDialog .evidence{display:block;width:100%;text-align:left;margin-top:9px;font-size:12px}#aiDialog .value-pair{display:flex;gap:16px;align-items:center;font-size:23px;font-weight:650;margin:12px 0;color:var(--ai-accent)}#aiDialog .value-pair small{font-size:11px;color:var(--ai-muted);display:block;font-weight:400}#aiDialog .config-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}#aiDialog .report-summary{font-size:18px;line-height:1.7;margin:20px 0}#aiDialog .ai-status{min-height:24px;white-space:pre-wrap;color:var(--ai-accent);font-size:13px}#aiDialog .link-button{background:none;color:var(--ai-accent);border:0;padding:5px 0}#aiDialog code{font-size:12px;overflow-wrap:anywhere}@media(max-width:560px){#aiDialog{width:calc(100vw - 16px);height:calc(100dvh - 16px)}#aiDialog .ai-head{padding:16px}#aiDialog .ai-body{padding:0 16px 20px}#aiDialog .config-grid{grid-template-columns:1fr;gap:0}#aiDialog h1{font-size:20px}}
`;
const markup=`<header class="ai-head"><div><span class="eyebrow">CARROT · GEMINI</span><h1>AI 주행 분석</h1></div><button id="aiClose" aria-label="AI 주행 분석 닫기">닫기</button></header><div class="ai-body"><nav class="ai-tabs" aria-label="AI 분석 메뉴"><button id="aiAnalysisTab" aria-selected="true">로그 분석</button><button id="aiConfigTab" aria-selected="false">AI 연결 · 사용 한도</button></nav><p id="aiStatus" class="ai-status" role="status"></p><section id="aiAnalysisPane"><div id="aiSelection"><div class="actions"><h2>분석할 저장 로그</h2><span id="aiCount" class="muted"></span></div><p class="muted">완료된 rlog 세그먼트를 최대 8개 선택하세요. HA와 NAS의 저장 목록을 사용합니다.</p><div id="aiChoices" class="ai-choices"></div><button id="aiMore" class="link-button" hidden>이전 주행 더 보기</button><label class="field">확인하고 싶은 증상<select id="aiSymptom"><option value="">전체적인 주행 검토</option value="가속·출발 시 반응이 급하게 느껴집니다.">가속 · 출발</option><option value="앞차 감속에 대한 반응과 차간거리를 확인하고 싶습니다.">감속 · 차간거리</option><option value="조향 반응과 목표·실제 각도 차이를 확인하고 싶습니다.">조향 반응</option></select></label><label class="field">추가 설명 <span class="muted">선택 사항 · 개인정보는 입력하지 마세요.</span><textarea id="aiIssue" maxlength="1300" placeholder="어떤 상황에서 불편했는지 적어주세요."></textarea></label><label class="checkline"><input id="aiOverrides" type="checkbox">운전자 수동 개입도 관찰에 포함</label><p id="aiConnection" class="muted"></p><label class="checkline"><input id="aiConsent" type="checkbox">선택 로그에서 추출한 수치·상대 시각·차종, 현재 설정과 위 설명을 Google Gemini API로 전송하는 데 동의합니다.</label><p class="muted">원본 로그·영상·GPS·기기 ID는 전송하지 않습니다. 무료 API는 전송 내용이 Google 제품 개선에 사용될 수 있습니다.</p><div class="actions"><span class="muted">버튼을 누를 때만 분석 · 추천값 자동 적용 없음</span><button id="aiStart" class="primary" disabled>선택 로그 분석 시작</button></div></div><div id="aiProgress" class="ai-progress" hidden><span class="eyebrow">주행 근거 확인 중</span><h2 id="aiPhase"></h2><progress id="aiProgressBar" max="100" value="0"></progress><p class="muted">선택 구간과 HA의 처리 상태에 따라 수 분 걸릴 수 있습니다.</p><button id="aiCancel">분석 취소</button><p class="muted">취소 전 Google에 전달된 요청은 한도·비용에 반영될 수 있습니다.</p></div><div id="aiResult" hidden></div></section><section id="aiConfigPane" hidden><h2>Gemini API 연결</h2><p class="muted">Google AI Pro 앱 구독과 API 프로젝트의 결제·한도는 별개입니다. API 키는 HA 서버에만 저장하며 다시 표시하지 않습니다.</p><label class="field">Gemini API 키<input id="aiKey" type="password" autocomplete="new-password" spellcheck="false" placeholder="새 키를 입력하면 교체됩니다."></label><div class="actions"><a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">AI Studio에서 키 발급</a><button id="aiClearKey">저장된 키 삭제</button></div><label class="field">분석 모델<select id="aiModel"></select></label><button id="aiCheckModels">키 권한 · 모델 목록 확인</button><p class="muted">모델 목록 조회는 분석을 실행하지 않습니다. 무료 제공 여부·잔여량은 AI Studio가 기준입니다.</p><div class="config-grid"><label class="field">월 예약 예산 (USD)<input id="aiBudget" type="number" min="0" max="100" step="0.1"></label><label class="field">일일 분석 요청 상한<input id="aiDaily" type="number" min="1" max="500" step="1"></label></div><p id="aiUsage" class="notice"></p><p class="muted">표시 금액은 유료 단가와 최대 출력량으로 보수적으로 예약한 값입니다. 무료 이용도 합산하며 실제 청구액·크레딧 잔액은 아닙니다. 이 차량 기능만 제한하고 다른 앱의 사용량은 포함하지 않습니다. 취소·실패에도 예약액을 보존하며 월/일 기준은 UTC입니다.</p><p class="muted">Google의 가격 변경으로 실제 비용과 차이가 생길 수 있습니다. 자동 재시도·다른 유료 모델로의 자동 전환은 없습니다.</p><div class="actions"><a href="https://aistudio.google.com/usage?tab=rate-limit" target="_blank" rel="noopener noreferrer">API 사용량 · 실제 한도 확인</a><button id="aiSave" class="primary">연결 설정 저장</button></div></section></div>`;

function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
const clock=seconds=>`${Math.floor(Number(seconds||0)/60).toString().padStart(2,'0')}:${Math.floor(Number(seconds||0)%60).toString().padStart(2,'0')}`;
export function bindDrivingAi(card){
  card.shadowRoot.getElementById('aiDialog')?.remove();card.shadowRoot.getElementById('aiStyle')?.remove();
  const style=element('style');style.id='aiStyle';style.textContent=css;card.shadowRoot.append(style);
  const dialog=element('dialog');dialog.id='aiDialog';dialog.setAttribute('aria-label','AI 주행 분석');dialog.innerHTML=markup;card.shadowRoot.append(dialog);
  const $=id=>dialog.querySelector('#'+id), selected=new Set();
  let base='',config=null,offset=0,hasMore=false,jobId='',active=false,timer=null,disposed=false,controller=new AbortController(),report=null;
  const status=text=>{$('aiStatus').textContent=text;};
  async function api(path,body){
    const response=await fetch(base+'/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(disposed)throw new Error('화면이 닫혔습니다.');
    if(response.status===401)throw new Error('로그 세션이 만료되었습니다. 화면을 새로고침해 주세요.');
    let data;try{data=await response.json();}catch{throw new Error('AI API를 불러오지 못했습니다. HA 재시작·업데이트 상태를 확인해 주세요.');}
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'요청을 처리하지 못했습니다.');return data;
  }
  async function action(work){try{await work();}catch(error){if(!disposed&&error.name!=='AbortError')status(error.message);}}
  function view(name){for(const [id,key] of [['aiSelection','selection'],['aiProgress','progress'],['aiResult','result']])$(id).hidden=name!==key;}
  function tab(settings){$('aiAnalysisPane').hidden=settings;$('aiConfigPane').hidden=!settings;$('aiAnalysisTab').setAttribute('aria-selected',String(!settings));$('aiConfigTab').setAttribute('aria-selected',String(settings));}
  function update(){
    $('aiCount').textContent=`${selected.size} / 8개 선택`;
    $('aiStart').disabled=active||!selected.size||!config?.configured||!$('aiConsent').checked;
    $('aiConnection').textContent=config?.configured?`${config.model} · 키 저장됨 (권한·잔여 한도는 별도 확인)`:'API 키가 필요합니다. AI 연결 · 사용 한도에서 설정해 주세요.';
    for(const id of ['aiSave','aiClearKey','aiCheckModels'])$(id).disabled=active;
  }
  function showConfig(value){
    config=value;const options=value.models.map(m=>{const option=element('option',m.title);option.value=m.id;return option;});
    $('aiModel').replaceChildren(...options);$('aiModel').value=value.model;$('aiBudget').value=value.monthly_budget_usd;$('aiDaily').value=value.daily_requests;
    $('aiUsage').textContent=`이번 달 예약 $${Number(value.reserved_usd).toFixed(3)} / $${Number(value.monthly_budget_usd).toFixed(2)} · 오늘 ${value.requests_today} / ${value.daily_requests}회 (UTC)`;
    update();
  }
  async function routes(reset=false){
    if(reset){offset=0;$('aiChoices').replaceChildren();}
    const page=await api('dashcam/routes?offset='+offset+'&limit=40');
    for(const route of page.routes||[]){
      const details=element('details');details.open=offset===0&&$('aiChoices').childElementCount===0;
      const time=Number(route.routeStartEpoch)>0?new Date(route.routeStartEpoch*1000).toLocaleString('ko-KR',{hour12:false}):route.route;
      const summary=element('summary',`${time} · ${route.segmentFolders.length}개 구간`),group=element('div',undefined,'segments');
      for(const segment of route.segmentFolders){
        const label=element('label'),input=element('input');input.type='checkbox';input.checked=selected.has(segment);input.setAttribute('aria-label',segment);
        input.onchange=()=>{if(input.checked&&selected.size>=8){input.checked=false;status('한 번에 최대 8개 구간을 선택할 수 있습니다.');return;}input.checked?selected.add(segment):selected.delete(segment);update();};
        label.append(input,document.createTextNode('구간 '+segment.split('--').at(-1)));group.append(label);
      }
      details.append(summary,element('p',route.route,'muted'),group);$('aiChoices').append(details);
    }
    offset+=page.routes?.length||0;hasMore=Boolean(page.hasMore);$('aiMore').hidden=!hasMore;
    if(!offset)$('aiChoices').append(element('p','저장된 주행 로그가 없습니다.','notice'));
  }
  function evidenceButtons(ids,result){
    return ids.map(id=>{
      const evidence=result.evidence.find(e=>e.id===id);if(!evidence)return null;
      const button=element('button',`${evidence.title} · 구간 ${evidence.segment.split('--').at(-1)} ${clock(evidence.sec)} → 리플레이`,'evidence');
      button.onclick=()=>{dialog.close();card.shadowRoot.querySelector('iframe')?.contentWindow.postMessage({type:'carrot:ai_evidence',base,segment:evidence.segment},location.origin);};return button;
    }).filter(Boolean);
  }
  function resultView(result){
    report=result;const root=$('aiResult');root.replaceChildren();
    root.append(element('p',`${result.model} · ${result.scope.length}개 구간 · 저장 로그 수동 분석`,'muted'),element('p',result.summary,'report-summary'));
    for(const finding of result.findings){const section=element('article',undefined,'finding');section.append(element('h3',finding.title),element('p',finding.detail),...evidenceButtons(finding.evidence_ids,result));root.append(section);}
    root.append(element('h2','파라미터 변경 검토 후보'));
    if(!result.recommendedParams.length)root.append(element('p','근거가 충분한 변경 후보가 없습니다. 현재 설정을 유지하며 추가 로그를 확인하세요.','notice'));
    for(const param of result.recommendedParams){
      const section=element('article',undefined,'recommendation'),values=element('div',undefined,'value-pair'),current=element('span',String(param.current)),next=element('span',String(param.recommended));
      current.append(element('small','분석 시점 현재값'));next.append(element('small','검토 후보 · 저장 단위'));values.append(current,element('span','→'),next);
      section.append(element('h3',param.title),element('code',param.name),values,element('p',param.reason),element('p','예상 영향·부작용: '+param.tradeoff,'muted'),...evidenceButtons(param.evidence_ids,result));root.append(section);
    }
    root.append(element('h2','분석 범위와 한계'));
    for(const limitation of result.limitations)root.append(element('p','· '+limitation,'muted'));
    root.append(element('p','차량 신호는 약 0.25초 간격 표본과 제한된 관찰로 요약됩니다. 모든 순간의 사건·원인·설정 효과를 판정하는 기능은 아닙니다. 리플레이는 구간 시작부터 열리므로 표시된 상대 시각을 직접 확인하세요.','muted'));
    const buttons=element('div',undefined,'actions'),copy=element('button','분석 내용 복사'),again=element('button','다른 로그 분석','primary');
    copy.onclick=()=>action(async()=>{await navigator.clipboard.writeText(JSON.stringify(report,null,2));status('분석 내용을 복사했습니다.');});
    again.onclick=()=>{view('selection');status('');};buttons.append(copy,again);root.append(buttons);view('result');
  }
  async function poll(){
    clearTimeout(timer);if(disposed||!dialog.open||document.hidden||!jobId)return;
    try{
      const job=await api('ai/job?id='+encodeURIComponent(jobId));active=!job.done;update();
      if(job.done){
        if(job.status==='done'){status('추천은 검토용이며 차량에 자동 적용되지 않습니다.');resultView(job.result);}
        else{view('selection');status(job.error||job.message||'분석이 종료됐습니다.');}
        showConfig(await api('ai/config'));return;
      }
      view('progress');$('aiPhase').textContent=job.message;$('aiProgressBar').value=job.progress||0;$('aiCancel').disabled=job.phase==='canceling';
      timer=setTimeout(poll,1500);
    }catch(error){if(!disposed&&error.name!=='AbortError')status(error.message+' · 다시 화면을 열면 상태를 확인합니다.');}
  }
  $('aiClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{clearTimeout(timer);$('aiKey').value='';});
  $('aiAnalysisTab').onclick=()=>tab(false);$('aiConfigTab').onclick=()=>tab(true);$('aiConsent').onchange=update;
  $('aiMore').onclick=()=>action(async()=>{const button=$('aiMore');button.disabled=true;try{await routes();}finally{button.disabled=false;}});
  $('aiStart').onclick=()=>action(async()=>{
    if($('aiStart').disabled)return;active=true;update();status('');
    try{const issue=[$('aiSymptom').value,$('aiIssue').value].filter(Boolean).join('\n');const job=await api('ai/start',{segments:[...selected],issue,include_overrides:$('aiOverrides').checked,consent:$('aiConsent').checked});jobId=job.job_id;await poll();}
    catch(error){active=false;update();throw error;}
  });
  $('aiCancel').onclick=()=>action(async()=>{$('aiCancel').disabled=true;try{await api('ai/cancel',{id:jobId});await poll();}finally{$('aiCancel').disabled=false;}});
  $('aiSave').onclick=()=>action(async()=>{
    const body={model:$('aiModel').value,monthly_budget_usd:Number($('aiBudget').value),daily_requests:Number($('aiDaily').value)};
    if($('aiKey').value.trim())body.api_key=$('aiKey').value.trim();$('aiSave').disabled=true;
    try{showConfig(await api('ai/config',body));$('aiKey').value='';status('HA에 연결 설정을 저장했습니다. 모델 목록으로 키 권한을 확인할 수 있습니다.');}finally{update();}
  });
  $('aiClearKey').onclick=()=>action(async()=>{showConfig(await api('ai/config',{clear_key:true}));$('aiKey').value='';status('저장된 Gemini API 키를 삭제했습니다.');});
  $('aiCheckModels').onclick=()=>action(async()=>{const button=$('aiCheckModels');button.disabled=true;try{const result=await api('ai/models');status(result.message+'\n사용 가능한 모델: '+(result.models.map(m=>m.title).join(', ')||'없음'));}finally{update();}});
  const visible=()=>{if(!document.hidden&&dialog.open&&active)poll();};document.addEventListener('visibilitychange',visible);
  card._detachAi=()=>{disposed=true;clearTimeout(timer);controller.abort();dialog.close();document.removeEventListener('visibilitychange',visible);dialog.remove();style.remove();};
  return {async open(){
    await card._connect();base=card._session?.base;if(!base)throw new Error('로그 세션이 없습니다.');
    dialog.showModal();status('설정과 저장 로그를 확인하고 있습니다.');
    await action(async()=>{showConfig(await api('ai/config'));if(!offset)await routes(true);status('');tab(false);view('selection');if(config.last_job_id){jobId=config.last_job_id;await poll();}update();});
  }};
}
