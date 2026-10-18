/* HA/NAS recorded replay V2. No date filtering, map or GPS downloads. */
(() => {
  let started=false;
  const $=id=>document.getElementById(id);
  const scopeURL=value=>value;
  function openV2(segment){
    if(!segment)return;$('haReplayV2Frame').src=`${logsBase}/dashcam/v2/${encodeURIComponent(segment)}`;
    if(!$('haReplayV2').open)$('haReplayV2').showModal();
  }
  function init(){
    if(started||!logsBase)return;started=true;
    const dialog=document.createElement('dialog');dialog.id='haReplayV2';dialog.innerHTML='<header><strong>리플레이 V2</strong><button class="smallBtn" type="button" aria-label="리플레이 V2 닫기">닫기</button></header><iframe id="haReplayV2Frame" title="Carrot Routes 리플레이 V2" referrerpolicy="no-referrer"></iframe>';document.body.append(dialog);
    dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>$('haReplayV2Frame').src='about:blank');
    let menuSegment='';
    document.addEventListener('click',event=>{const item=event.target.closest('[data-action="segment-menu"]');if(item)menuSegment=item.dataset.segment;},true);
    new MutationObserver(()=>{
      const choices=$('appDialogChoices');if(!menuSegment||choices.hidden||choices.querySelector('.ha-replay-v2-choice'))return;
      const original=[...choices.querySelectorAll('button')].find(button=>/^(리플레이|Replay)$/.test(button.textContent.trim()));if(!original)return;
      const button=original.cloneNode(true),segment=menuSegment;button.classList.add('ha-replay-v2-choice');button.textContent='리플레이 V2';button.onclick=()=>{$('appDialogCancel')?.click();openV2(segment);};original.after(button);
    }).observe($('appDialogChoices'),{childList:true,attributes:true,subtree:true});
  }
  window.CarrotLogExplorer={init,scopeURL,acceptPage(){},openV2};
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='carrot:ai_evidence'||event.data.base!==logsBase)return;
    if(typeof event.data.segment==='string'&&/^[A-Za-z0-9_|.-]{1,96}--[0-9]{1,6}$/.test(event.data.segment)&&!event.data.segment.includes('..'))openV2(event.data.segment);
  });
  if(typeof logsStarted!=='undefined'&&logsStarted)init();
})();
