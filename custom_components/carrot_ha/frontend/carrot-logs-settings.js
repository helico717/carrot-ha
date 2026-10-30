/** Log settings use the journal's navigation/content arrangement, without sharing its state. */
export const logsSettingsStyles = `
.header{display:flex;align-items:center;gap:12px;padding:10px 16px;min-height:44px;box-sizing:border-box}
.header-copy{display:flex;align-items:baseline;gap:12px;flex:1;min-width:0;flex-wrap:wrap}
.header-title{font-size:15px;white-space:nowrap}.storage-summary{font-size:12px;font-weight:400;line-height:1.5;color:var(--secondary-text-color);overflow-wrap:anywhere}
.icon-button{width:40px;height:40px;flex:none;display:inline-grid;place-items:center;padding:0;border:1px solid var(--divider-color,#444);border-radius:8px;background:transparent;color:var(--primary-text-color);cursor:pointer}
.icon-button:hover{background:var(--secondary-background-color,#292929)}ha-icon{--mdc-icon-size:22px}
#logSettings{width:min(800px,calc(100vw - 24px));max-width:none;height:min(590px,calc(100dvh - 32px));max-height:none;padding:0;border:1px solid var(--divider-color,#444);border-radius:8px;background:var(--card-background-color,#1c1c1c);color:var(--primary-text-color,#eee);box-sizing:border-box}
#logSettings[open]{display:flex;flex-direction:column}#logSettings::backdrop{background:#0009}
.settings-dialog-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border-bottom:1px solid var(--divider-color,#444)}
.settings-dialog-header h2{font-size:20px;line-height:1.4;margin:0}.settings-layout{display:grid;grid-template-columns:170px minmax(0,1fr);flex:1;min-height:0}
.settings-nav{display:flex;flex-direction:column;gap:8px;padding:16px 10px;border-right:1px solid var(--divider-color,#444);background:var(--secondary-background-color,#222)}
.settings-nav button{padding:12px;text-align:left;border:1px solid transparent;border-radius:8px;font-family:inherit;font-weight:600;font-size:14px;line-height:1.4;color:inherit;background:transparent;cursor:pointer}
.settings-nav button[aria-current=page]{color:#81e6c5;border-color:#81e6c55a;background:#81e6c518}.settings-content{padding:22px;overflow:auto;min-width:0}
.settings-content h3{font-size:18px;margin:0 0 16px}.settings-content dl{margin:0}.settings-content dl>div{display:grid;grid-template-columns:minmax(90px,1fr) minmax(0,1.5fr);gap:16px;padding:12px 0;border-bottom:1px solid var(--divider-color,#444);font-size:14px;line-height:1.55}
.settings-content dt{color:var(--secondary-text-color,#aaa)}.settings-content dd{margin:0;text-align:right;overflow-wrap:anywhere}.settings-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.settings-toolbar h3{margin:0}.settings-error{color:var(--error-color,#ffb4ab);font-size:13px;min-height:20px;margin:12px 0 0}
[data-log-pane][hidden]{display:none}button:focus-visible{outline:2px solid var(--primary-color,#81e6c5);outline-offset:2px}
.transfer-section{margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--divider-color,#444)}.transfer-heading{display:flex;gap:16px;align-items:center;justify-content:space-between}.transfer-heading h3{margin:0}.transfer-section p{font-size:13px;line-height:1.7;color:var(--secondary-text-color,#aaa)}#logTransferStatus{color:inherit}.transfer-switch{flex:none;border:0;border-radius:999px;width:54px;height:30px;padding:3px;background:#666;cursor:pointer;overflow:hidden}.transfer-switch span{display:block;width:24px;height:24px;border-radius:50%;background:white;transition:transform .15s}.transfer-switch[aria-checked=true]{background:#13896c}.transfer-switch[aria-checked=true] span{transform:translateX(24px)}.transfer-switch:disabled{opacity:.55;cursor:wait}
@media(max-width:600px){.header{padding:8px 12px;gap:8px}.header-copy{gap:2px 10px}.settings-dialog-header{padding:14px 16px}.settings-dialog-header h2{font-size:18px}.settings-layout{display:flex;flex-direction:column}.settings-nav{display:grid;grid-template-columns:1fr 1fr;padding:8px;border-right:0;border-bottom:1px solid var(--divider-color,#444)}.settings-nav button{text-align:center;padding:10px 4px}.settings-content{padding:16px;flex:1;min-height:0}.settings-content dl>div{font-size:13px;gap:12px}}
`;

const rows = entries => entries.map(([label, key]) => `<div><dt>${label}</dt><dd data-log-value="${key}">-</dd></div>`).join('');
export const logsSettingsMarkup = `
<dialog id="logSettings" aria-labelledby="logSettingsTitle">
 <header class="settings-dialog-header"><h2 id="logSettingsTitle">주행 로그 설정</h2><button id="closeLogSettings" class="icon-button" type="button" title="설정 닫기" aria-label="설정 닫기"><ha-icon icon="mdi:close"></ha-icon></button></header>
 <div class="settings-layout"><nav class="settings-nav" aria-label="설정 분류"><button type="button" data-log-nav="policy" aria-current="page">보관 정책</button><button type="button" data-log-nav="nas" aria-current="false">시놀로지 상태</button></nav>
 <main class="settings-content"><section data-log-pane="policy"><section class="transfer-section" aria-labelledby="logTransferTitle"><div class="transfer-heading"><h3 id="logTransferTitle">주행 영상·상세 로그 자동 전송</h3><button id="logTransferToggle" class="transfer-switch" type="button" role="switch" aria-labelledby="logTransferTitle" aria-describedby="logTransferHelp logTransferStatus" aria-checked="false" disabled><span></span></button></div><p id="logTransferHelp">켜져 있는 동안 새로 생성되는 주행 영상·상세 로그만 전송합니다. 꺼져 있던 기간의 기록은 나중에도 전송하지 않습니다.</p><p id="logTransferStatus" role="status">전송 설정 확인 중…</p><p>차량 상태·위치·충전·일반 주행 요약은 계속 전송합니다.</p></section><h3>주행 로그 보관</h3><dl>${rows([['HA 보관 용량','localUsage'],['HA 보관 기준','localPolicy'],['시놀로지 보관 기간','retention'],['삭제 단위','eviction'],['HA 초기화 후 복구','recovery']])}</dl></section>
 <section data-log-pane="nas" hidden><div class="settings-toolbar"><h3>Synology NAS</h3><button id="refreshLogStorage" class="icon-button" type="button" title="상태 새로고침" aria-label="상태 새로고침"><ha-icon icon="mdi:refresh"></ha-icon></button></div><dl>${rows([['연결 상태','nasStatus'],['저장 경로','path'],['로그 보관량','nasUsage'],['보관된 주행','routes'],['완료 세그먼트','segments'],['검증 완료','verified'],['NAS 전용 세그먼트','nasOnly'],['NAS 남은 공간','free'],['처리 상태','phase'],['연결 확인 시각','checked']])}</dl></section>
 <p id="logStorageError" class="settings-error" role="status"></p></main></div>
</dialog>`;

export function bindLogSettings(card) {
  const root = card.shadowRoot, dialog = root.getElementById('logSettings');
  let refreshTimer;
  let policyTimer, policyBusy=false;
  const toggle=root.getElementById('logTransferToggle'), status=root.getElementById('logTransferStatus');
  const renderPolicy=p=>{
    card._transferPolicy=p;toggle.setAttribute('aria-checked',String(p.enabled));
    status.textContent=p.applied?(p.enabled?'신규 생성 로그 전송 허용 · 차량 적용 확인됨':'중지됨 · 과거 로그 자동 전송 안 함'):(p.enabled?'시작 요청 대기 · 차량 연결 또는 업데이트 필요':'중지 요청 대기 · 서버 수신은 차단됨');
  };
  const policyRequest=async enabled=>{
    if(policyBusy)return;policyBusy=true;toggle.disabled=true;
    const base=card._session?.base;
    try{
      if(!base)throw Error();
      const response=await fetch(base+'/transfer/policy',{method:enabled===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',...(enabled===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})})});
      if(!response.ok)throw Error();const p=await response.json();
      if(card._session?.base!==base)return;
      renderPolicy(p);toggle.disabled=false;
    }catch{if(card._session?.base===base)status.textContent='전송 설정을 확인하지 못했습니다. 설정 창을 다시 열어 주세요.';}
    finally{policyBusy=false;}
  };
  toggle.onclick=()=>policyRequest(!card._transferPolicy?.enabled);
  dialog.addEventListener('close',()=>clearInterval(policyTimer));
  const request = () => {
    clearTimeout(refreshTimer);
    root.getElementById('refreshLogStorage').disabled = true;
    root.getElementById('logStorageError').textContent = '';
    if (card._ready && card._session) root.querySelector('iframe').contentWindow.postMessage({type:'carrot:logs_storage_request'}, location.origin);
    refreshTimer = setTimeout(() => card._storageError('상태 확인이 지연되고 있습니다. 다시 확인해 주세요.'), 15000);
  };
  root.getElementById('logSettingsButton').onclick = () => { dialog.showModal(); request(); policyRequest(); clearInterval(policyTimer); policyTimer=setInterval(()=>{if(!document.hidden)policyRequest();},15000); };
  root.getElementById('closeLogSettings').onclick = () => dialog.close();
  root.getElementById('refreshLogStorage').onclick = request;
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => { clearTimeout(refreshTimer); root.getElementById('refreshLogStorage').disabled=false; });
  for (const button of root.querySelectorAll('[data-log-nav]')) button.onclick = () => {
    for (const item of root.querySelectorAll('[data-log-nav]')) item.setAttribute('aria-current', String(item===button ? 'page' : 'false'));
    for (const pane of root.querySelectorAll('[data-log-pane]')) pane.hidden = pane.dataset.logPane !== button.dataset.logNav;
  };
  card._storageError = message => { clearTimeout(refreshTimer); root.getElementById('refreshLogStorage').disabled=false; root.getElementById('logStorageError').textContent=message; };
  card._updateStorage = (incoming, maintenance) => {
    clearTimeout(refreshTimer);
    root.getElementById('refreshLogStorage').disabled=false;
    const previous=card._storage || {};
    const storage=card._storage={...previous,...incoming,nas:{...previous.nas,...incoming.nas}};
    if(maintenance) card._maintenance=maintenance;
    const nas=storage.nas || {}, gb=n=>Number.isFinite(n)?`${(n/1e9).toFixed(2)} GB`:'-';
    const count=n=>Number.isFinite(n)?n.toLocaleString():'-';
    root.getElementById('storageSummary').textContent=`HA 보관 ${Number.isFinite(storage.used)?(storage.used/1e9).toFixed(2):'-'} / ${Number.isFinite(storage.limit)?(storage.limit/1e9).toFixed(2):'-'} GB · 최신 주행부터 보관`;
    const phase=card._maintenance?.phase;
    const values={localUsage:`${gb(storage.used)} / ${gb(storage.limit)}`,localPolicy:'최신 주행부터',retention:`${nas.retention_days || 30}일`,eviction:'주행 전체 · 모든 세그먼트 묶음',recovery:'동일 기기 ID · 최신 5GB 순차 복구',
      nasStatus:({available:'연결됨',unavailable:'연결 확인 필요',not_configured:'미설정',connecting:'연결 확인 중'})[nas.status] || '확인 대기',path:nas.path || '-',nasUsage:gb(nas.used),routes:count(nas.routes),segments:count(nas.segments),verified:count(nas.verified_segments),nasOnly:count(nas.nas_only_segments),free:gb(nas.disk_free),
      phase:({ready:'정상',archiving:'NAS 복사 · 검증 중',restoring:'HA 캐시 복구 중',retrying:'재시도 대기',nas_unavailable:'NAS 연결 대기'})[phase] || (storage.used>storage.limit?'초기 검증 · 정리 대기':'확인 대기'),checked:Number.isFinite(nas.checked_at)?new Date(nas.checked_at*1000).toLocaleString(): '-'};
    for(const element of root.querySelectorAll('[data-log-value]')) element.textContent=values[element.dataset.logValue] || '-';
    root.getElementById('logStorageError').textContent=nas.path || nas.status==='not_configured' ? '' : '상세 상태는 HA에 새 코드를 적용하고 재시작한 뒤 확인할 수 있습니다.';
  };
  card._closeLogSettings = () => { clearTimeout(refreshTimer); clearInterval(policyTimer); if(dialog.open)dialog.close(); };
  card._resetLogSettings = () => { card._transferPolicy=null;toggle.disabled=true;toggle.setAttribute('aria-checked','false');status.textContent='전송 설정 확인 중…';for(const element of root.querySelectorAll('[data-log-value]'))element.textContent='-'; root.getElementById('logStorageError').textContent=''; };
}
