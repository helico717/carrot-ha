/* HA/NAS date browsing and recorded replay V2. No map or GPS downloads. */
(() => {
  let started=false,calendarReady=false,selectedDate='',calendar=[];
  const $=id=>document.getElementById(id);
  const dayKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const localDay=value=>{const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d);};
  function scopeURL(value){
    if(!calendarReady||!selectedDate||!/^\/api\/dashcam\/routes(?:\?|$)/.test(value))return value;
    const date=localDay(selectedDate),next=new Date(date);next.setDate(next.getDate()+1);
    const url=new URL(value,location.origin);url.searchParams.set('from',date.getTime()/1000);url.searchParams.set('to',next.getTime()/1000);
    return url.pathname+url.search;
  }
  function syncDates(){
    $('haLogDate').value=selectedDate;
    $('haLogDatePrevious').disabled=!calendar.some(day=>!selectedDate||day<selectedDate);
    $('haLogDateNext').disabled=!selectedDate||!calendar.some(day=>day>selectedDate);
    $('haLogAllDates').setAttribute('aria-pressed',String(!selectedDate));
    $('haLogDateStatus').textContent=selectedDate&&!calendar.includes(selectedDate)?'해당 날짜의 주행 로그 없음':'';
  }
  async function calendarLoad(){
    const data=await getJson('/api/dashcam/calendar'),days=new Set();
    for(const interval of data.intervals||[]){
      if(!Number.isFinite(interval.start)||!Number.isFinite(interval.end)||interval.start>interval.end)continue;
      const end=new Date(interval.end*1000),date=new Date(interval.start*1000);date.setHours(0,0,0,0);
      for(let count=0;count<35&&date<=end;count++,date.setDate(date.getDate()+1))days.add(dayKey(date));
    }
    calendarReady=true;$('haLogDate').disabled=false;$('haLogAllDates').disabled=false;
    calendar=[...days].sort();$('haLogDate').min=calendar[0]||'';$('haLogDate').max=calendar.at(-1)||'';syncDates();
  }
  function selectDate(value){
    selectedDate=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';syncDates();$('dashcamRoutes').scrollTop=0;
    try{sessionStorage.setItem(`carrot:log-date:${logsBase}`,selectedDate);}catch{}
    window.CarrotLogsRuntime?.dashcam.load({silent:true});
  }
  function openV2(segment){
    if(!segment)return;$('haReplayV2Frame').src=`${logsBase}/dashcam/v2/${encodeURIComponent(segment)}`;
    if(!$('haReplayV2').open)$('haReplayV2').showModal();
  }
  function init(){
    if(started||!logsBase)return;started=true;
    const bar=document.createElement('div');bar.className='ha-log-datebar';bar.innerHTML='<button id="haLogDatePrevious" class="smallBtn" type="button" aria-label="이전 기록 날짜" title="이전 기록 날짜">‹</button><input id="haLogDate" type="date" aria-label="주행 로그 날짜"><button id="haLogDateNext" class="smallBtn" type="button" aria-label="다음 기록 날짜" title="다음 기록 날짜">›</button><button id="haLogAllDates" class="smallBtn" type="button" aria-pressed="true">전체 날짜</button><span id="haLogDateStatus" role="status"></span>';
    document.querySelector('.logs-tabbar').after(bar);
    const dialog=document.createElement('dialog');dialog.id='haReplayV2';dialog.innerHTML='<header><strong>리플레이 V2</strong><button class="smallBtn" type="button" aria-label="리플레이 V2 닫기">닫기</button></header><iframe id="haReplayV2Frame" title="Carrot Routes 리플레이 V2" referrerpolicy="no-referrer"></iframe>';document.body.append(dialog);
    dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>$('haReplayV2Frame').src='about:blank');
    let menuSegment='';
    document.addEventListener('click',event=>{const item=event.target.closest('[data-action="segment-menu"]');if(item)menuSegment=item.dataset.segment;},true);
    new MutationObserver(()=>{
      const choices=$('appDialogChoices');if(!menuSegment||choices.hidden||choices.querySelector('.ha-replay-v2-choice'))return;
      const original=[...choices.querySelectorAll('button')].find(button=>/^(리플레이|Replay)$/.test(button.textContent.trim()));if(!original)return;
      const button=original.cloneNode(true),segment=menuSegment;button.classList.add('ha-replay-v2-choice');button.textContent='리플레이 V2';button.onclick=()=>{$('appDialogCancel')?.click();openV2(segment);};original.after(button);
    }).observe($('appDialogChoices'),{childList:true,attributes:true,subtree:true});
    $('haLogDate').onchange=event=>selectDate(event.target.value);$('haLogAllDates').onclick=()=>selectDate('');
    $('haLogDatePrevious').onclick=()=>selectDate(calendar.filter(day=>!selectedDate||day<selectedDate).at(-1)||selectedDate);
    $('haLogDateNext').onclick=()=>selectDate(calendar.find(day=>day>selectedDate)||selectedDate);
    try{selectedDate=sessionStorage.getItem(`carrot:log-date:${logsBase}`)||'';}catch{}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate))selectedDate='';
    for(const id of ['haLogDate','haLogDatePrevious','haLogDateNext','haLogAllDates'])$(id).disabled=true;
    calendarLoad().then(()=>window.CarrotLogsRuntime.dashcam.load({silent:true})).catch(error=>$('haLogDateStatus').textContent=[404,501].includes(error.status)?'날짜 검색은 HA 재시작 후 사용할 수 있습니다.':error.message);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)calendarLoad().catch(()=>{});});
  }
  window.CarrotLogExplorer={init,scopeURL,acceptPage(){},openV2};
  if(typeof logsStarted!=='undefined'&&logsStarted)init();
})();
