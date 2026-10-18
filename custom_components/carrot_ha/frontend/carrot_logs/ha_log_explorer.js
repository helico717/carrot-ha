/* HA/NAS recorded replay V2 and menu-based local/AI driving analysis. */
(() => {
  let started=false, routesCache=[], statusTimer=null;
  const $=id=>document.getElementById(id);
  const scopeURL=value=>value;
  function openV2(segment){
    if(!segment)return;$('haReplayV2Frame').src=`${logsBase}/dashcam/v2/${encodeURIComponent(segment)}`;
    if(!$('haReplayV2').open)$('haReplayV2').showModal();
  }
  function checkedForRoute(route){
    const runtimeSelected=window.CarrotLogsRuntime?.dashcam?.selectedForRoute?.(route);
    if(Array.isArray(runtimeSelected)&&runtimeSelected.length)return runtimeSelected;
    const prefix=route+'--';
    return [...document.querySelectorAll('input[data-action="select-segment"]:checked')].map(input=>input.dataset.segment||'').filter(seg=>seg.startsWith(prefix));
  }
  function routeFolders(route){
    const found=routesCache.find(item=>item.route===route);
    if(found&&Array.isArray(found.segmentFolders)&&found.segmentFolders.length)return found.segmentFolders;
    const prefix=route+'--';
    const dom=[...document.querySelectorAll(`[data-route-card="${CSS.escape(route)}"] [data-segment]`)].map(el=>el.dataset.segment||'').filter(seg=>seg.startsWith(prefix));
    return [...new Set(dom)];
  }
  function postAnalyze(payload){
    window.parent.postMessage({type:'carrot:logs_analyze',base:logsBase,...payload},location.origin);
  }
  async function refreshBanner(){
    if(!logsBase||document.hidden)return;
    let banner=$('freeAnalysisBanner');
    if(!banner){
      const shell=document.querySelector('.logs-shell'),tabbar=shell?.querySelector('.logs-tabbar');
      if(!shell||!tabbar)return;
      banner=document.createElement('button');banner.id='freeAnalysisBanner';banner.type='button';banner.className='smallBtn ha-free-analysis-banner';banner.hidden=true;
      shell.insertBefore(banner,tabbar.nextSibling);
    }
    try{
      const response=await fetch(`${logsBase}/local/status`,{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)return;
      const data=await response.json();
      banner.hidden=false;banner.replaceChildren();
      const label=document.createElement('span');label.className='ha-free-analysis-banner__text';
      label.textContent=data.message||'마지막 주행 무료 분석 상태를 확인하고 있습니다.';
      const badge=document.createElement('span');
      badge.className=data.phase==='done'?'chip chip--accent':'chip';
      badge.textContent=data.phase==='done'?'결과 보기 →':data.phase==='disabled'?'설정 보기':'외부 API 호출 없음';
      banner.append(label,badge);
      banner.onclick=()=>{
        const latestRoute=data.route||routesCache[0]?.route||'latest';
        if(data.phase==='done')postAnalyze({action:'result',mode:'free',route:latestRoute,allSegments:routeFolders(latestRoute)});
        else if(data.job_id)postAnalyze({action:'job',mode:'free',jobId:data.job_id,route:latestRoute});
        else if(data.phase==='disabled')postAnalyze({action:'settings'});
        else if(routesCache[0]?.route)postAnalyze({action:'confirm',mode:'free',route:routesCache[0].route,segment:'',checkedSegments:checkedForRoute(routesCache[0].route),allSegments:routeFolders(routesCache[0].route)});
        else postAnalyze({action:'settings'});
      };
    }catch{}
  }
  function init(){
    if(started||!logsBase)return;started=true;
    const dialog=document.createElement('dialog');dialog.id='haReplayV2';dialog.innerHTML='<header><strong>리플레이 V2</strong><button class="smallBtn" type="button" aria-label="리플레이 V2 닫기">닫기</button></header><iframe id="haReplayV2Frame" title="Carrot Routes 리플레이 V2" referrerpolicy="no-referrer"></iframe>';document.body.append(dialog);
    dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>$('haReplayV2Frame').src='about:blank');
    let menuCtx=null;
    document.addEventListener('click',event=>{
      const item=event.target.closest('[data-action="route-menu"],[data-action="segment-menu"]');
      if(!item)return;
      const isThumb=Boolean(item.closest('.dashcam-route-preview'));
      const segment=isThumb?'':(item.dataset.segment||'');
      const route=item.dataset.route||(segment?segment.split('--').slice(0,-1).join('--'):'')||item.closest('[data-route-card]')?.dataset.routeCard||'';
      menuCtx={route,segment};
    },true);
    new MutationObserver(()=>{
      const choices=$('appDialogChoices');if(!menuCtx||!choices||choices.hidden)return;
      if(menuCtx.segment&&!choices.querySelector('.ha-replay-v2-choice')){
        const original=[...choices.querySelectorAll('button')].find(button=>/^(리플레이|Replay)$/.test(button.textContent.trim()));
        if(original){
          const button=original.cloneNode(true),segment=menuCtx.segment;button.classList.add('ha-replay-v2-choice');button.textContent='리플레이 V2';
          button.onclick=()=>{$('appDialogCancel')?.click();openV2(segment);};original.after(button);
        }
      }
      if(!choices.querySelector('.ha-analysis-choice')&&menuCtx.route){
        const ctx={...menuCtx};
        const template=choices.querySelector('button:not(.ha-analysis-choice)');
        for(const [label,mode] of [[ctx.segment?'이 구간 무료 분석…':'무료 분석 결과 / 다시 분석…','free'],['AI 분석…','ai']]){
          const button=template?template.cloneNode(false):document.createElement('button');
          button.type='button';
          if(!template)button.className='smallBtn app-dialog__choiceBtn app-dialog__choiceBtn--action';
          button.classList.add('ha-analysis-choice');button.textContent=label;
          button.onclick=()=>{
            $('appDialogCancel')?.click();
            const checked=checkedForRoute(ctx.route),all=routeFolders(ctx.route);
            postAnalyze({action:mode==='free'&&!ctx.segment&&!checked.length?'route_free':'confirm',mode,route:ctx.route,segment:ctx.segment,checkedSegments:checked,allSegments:all});
          };
          choices.append(button);
        }
      }
    }).observe($('appDialogChoices'),{childList:true,attributes:true,subtree:true});
    refreshBanner();
    clearInterval(statusTimer);statusTimer=setInterval(refreshBanner,15000);
  }
  window.CarrotLogExplorer={init,scopeURL,acceptPage(data){if(Array.isArray(data?.routes)&&data.routes.length){routesCache=data.routes;refreshBanner();}},openV2,refreshBanner};
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.base!==logsBase)return;
    if(event.data?.type==='carrot:ai_evidence'&&typeof event.data.segment==='string'&&/^[A-Za-z0-9_|.-]{1,96}--[0-9]{1,6}$/.test(event.data.segment)&&!event.data.segment.includes('..'))openV2(event.data.segment);
    if(event.data?.type==='carrot:logs_refresh_analysis')refreshBanner();
  });
  if(typeof logsStarted!=='undefined'&&logsStarted)init();
})();
