/* HA/NAS date browsing and real recorded GPS; no live sockets or route uploads. */
(() => {
  const routes=new Map(), cache=new Map();
  let started=false, calendarReady=false, selectedDate='', calendar=[], active=null, worker=null, generation=0, map=null, marker=null, layers=[], mapTouched=false, fitting=false, leaflet;
  const dayKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const localDay=value=>{const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d);};
  const $=id=>document.getElementById(id);
  const sorted=names=>[...names].sort((a,b)=>Number(a.split('--').at(-1))-Number(b.split('--').at(-1)));
  function scopeURL(value){
    if(!calendarReady || !selectedDate || !/^\/api\/dashcam\/routes(?:\?|$)/.test(value))return value;
    const date=localDay(selectedDate),next=new Date(date);next.setDate(next.getDate()+1);
    const url=new URL(value,location.origin);url.searchParams.set('from',date.getTime()/1000);url.searchParams.set('to',next.getTime()/1000);
    return url.pathname+url.search;
  }
  function acceptPage(data){if(data.routes)for(const route of data.routes)routes.set(route.route,route);}
  function buttons(){
    for(const card of document.querySelectorAll('[data-route-card]')){
      if(card.querySelector('.ha-route-explore'))continue;
      const button=document.createElement('button');button.type='button';button.className='smallBtn ha-route-explore';button.textContent='지도 · 분석';
      button.textContent='경로';button.onclick=event=>{event.stopPropagation();open(card.dataset.routeCard).catch(error=>showAppToast(error.message));};
      (card.querySelector('.dashcam-route-titleblock') || card).append(button);
    }
  }
  async function calendarLoad(){
    const data=await getJson('/api/dashcam/calendar');const days=new Set();
    for(const interval of data.intervals || []){
      if(!Number.isFinite(interval.start)||!Number.isFinite(interval.end)||interval.start>interval.end)continue;
      const end=new Date(interval.end*1000),date=new Date(interval.start*1000);date.setHours(0,0,0,0);
      for(let count=0;count<35&&date<=end;count++,date.setDate(date.getDate()+1))days.add(dayKey(date));
    }
    calendarReady=true;$('haLogDate').disabled=false;$('haLogAllDates').disabled=false;
    calendar=[...days].sort();$('haLogDate').min=calendar[0] || '';$('haLogDate').max=calendar.at(-1) || '';
    syncDates();
  }
  function syncDates(){
    $('haLogDate').value=selectedDate;
    $('haLogDatePrevious').disabled=!calendar.some(day=>!selectedDate||day<selectedDate);
    $('haLogDateNext').disabled=!selectedDate||!calendar.some(day=>day>selectedDate);
    $('haLogAllDates').setAttribute('aria-pressed',String(!selectedDate));
    $('haLogDateStatus').textContent=selectedDate&&!calendar.includes(selectedDate)?'해당 날짜의 주행 로그 없음':'';
  }
  function selectDate(value){
    selectedDate=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';syncDates();
    $('dashcamRoutes').scrollTop=0;
    try{sessionStorage.setItem(`carrot:log-date:${logsBase}`,selectedDate);}catch{}
    window.CarrotLogsRuntime?.dashcam.load({silent:true});
  }
  function leafletLoad(){
    if(window.L)return Promise.resolve(window.L);
    if(!leaflet)leaflet=new Promise((resolve,reject)=>{
      const css=document.createElement('link');css.rel='stylesheet';css.href='/carrot_ha_static/carrot-assets/leaflet.css';document.head.append(css);
      const script=document.createElement('script');script.src='/carrot_ha_static/carrot-assets/leaflet.js';script.onload=()=>resolve(window.L);script.onerror=()=>reject(Error('지도를 불러오지 못했습니다.'));document.head.append(script);
    }).catch(error=>{leaflet=null;throw error;});
    return leaflet;
  }
  function stop(){generation++;worker?.terminate();worker=null;active?.controller?.abort();}
  function gps(source,signal){
    return new Promise((resolve,reject)=>{
      const current=new Worker('/carrot_ha_static/carrot_logs/js/realtime/replay_log_worker.js');worker=current;
      let timeout;
      const finish=(error,data)=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);current.terminate();if(worker===current)worker=null;error?reject(error):resolve(data);};
      const abort=()=>finish(new DOMException('Aborted','AbortError'));
      if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
      timeout=setTimeout(()=>finish(Error('GPS 로그 해석 시간이 초과됐습니다.')),90000);
      current.onmessage=event=>{const data=event.data || {};if(data.type==='error')finish(Error(data.error));if(data.type==='complete')finish(null,data);};
      current.onerror=event=>finish(Error(event.message || 'GPS 로그 해석 실패'));
      current.postMessage({type:'start',gpsOnly:true,url:source.rlog.url,compression:source.rlog.compression,expectedSegment:source.segmentIndex});
    });
  }
  function gpsPoints(timeline){
    const points=[];
    for(const record of timeline.records || [])for(const frame of record.frames || []){
      if(frame.service!=='gpsLocationExternal'||!Number.isFinite(record.timeMs))continue;const value=frame.decoded || {},lat=value.latitude,lon=value.longitude;
      if(value.hasFix!==true||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0))continue;
      points.push({lat,lon,time:Math.max(0,record.timeMs/1000)});
    }
    return points.filter((_,index)=>index%Math.max(1,Math.ceil(points.length/1200))===0 || index===points.length-1);
  }
  function choose(segment,time=0){
    if(!active)return;const changed=active.segment!==segment;active.segment=segment;active.time=time;$('haMapSegment').value=segment;
    if(changed)for(const layer of layers)layer.line.setStyle({color:layer.segment===segment?'#ffad63':'#53bdcc',weight:layer.segment===segment?5:3});
    const point=active.points.get(segment)?.reduce((best,p)=>!best||Math.abs(p.time-time)<Math.abs(best.time-time)?p:best,null);
    if(point){if(!marker)marker=L.circleMarker([point.lat,point.lon],{radius:6,color:'#fff',weight:2,fillColor:'#ffad63',fillOpacity:1}).addTo(map);else marker.setLatLng([point.lat,point.lon]);}
    else{marker?.remove();marker=null;}
    $('haMapPosition').textContent=`${segment.split('--').at(-1)} · ${time.toFixed(1)}초`;
    for(const tile of document.querySelectorAll('.dashcam-segment-tile'))tile.classList.toggle('ha-map-selected',tile.dataset.segment===segment);
  }
  function addSegment(segment,points){
    active.points.set(segment,points);let chunk=[];
    const flush=()=>{if(chunk.length){const positions=chunk.map(p=>[p.lat,p.lon]);const line=chunk.length>1?L.polyline(positions,{color:'#53bdcc',weight:3}):L.circleMarker(positions[0],{color:'#53bdcc',radius:4});const values=chunk;line.addTo(map).on('click',event=>{const point=values.reduce((best,p)=>((p.lat-event.latlng.lat)**2+(p.lon-event.latlng.lng)**2)<((best.lat-event.latlng.lat)**2+(best.lon-event.latlng.lng)**2)?p:best,values[0]);choose(segment,point.time);const status=window.CarrotVisionReplay?.status();if(status?.active&&status.segment===segment)$('carrotRoadVideo').currentTime=point.time;});layers.push({line,segment});}chunk=[];};
    for(const point of points){const previous=chunk.at(-1);if(previous&&(point.time-previous.time>5||L.latLng(previous.lat,previous.lon).distanceTo([point.lat,point.lon])>250))flush();chunk.push(point);}flush();
    if(!mapTouched&&layers.length){fitting=true;map.fitBounds(L.featureGroup(layers.map(item=>item.line)).getBounds(),{padding:[24,24],maxZoom:17,animate:false});fitting=false;}
  }
  async function pathLoad(){
    stop();const token=generation,entry=active;entry.controller=new AbortController();const signal=entry.controller.signal;
    for(const item of layers)item.line.remove();layers=[];marker?.remove();marker=null;entry.points.clear();mapTouched=false;
    let failures=0,done=0,partial=0;
    for(const segment of entry.segments){
      if(token!==generation||signal.aborted)return;
      $('haMapStatus').textContent=`GPS 경로 불러오는 중 · ${done} / ${entry.segments.length}`;
      try{
        let points=cache.get(segment);
        if(!points){const source=await getJson(`/api/dashcam/replay-source/${encodeURIComponent(segment)}`);if(token!==generation)return;const result=await gps(source,signal);if(result.metadata?.rawParseStatus==='partial')partial++;points=gpsPoints(result);cache.set(segment,points);while(cache.size>8)cache.delete(cache.keys().next().value);}
        if(token!==generation)return;
        const budget=Math.max(2,Math.floor(60000/entry.segments.length)),stride=Math.max(1,Math.ceil(points.length/budget));
        addSegment(segment,points.filter((_,index)=>index%stride===0||index===points.length-1));
      }catch(error){if(signal.aborted||token!==generation)return;failures++;}
      done++;
      if(entry.segment===segment)choose(segment,entry.time);
    }
    if(token!==generation)return;
    const count=[...entry.points.values()].reduce((n,points)=>n+points.length,0);
    $('haMapStatus').textContent=count?`실제 GPS ${count.toLocaleString()}개 · ${done-failures} / ${done}개 구간${failures?` · 읽기 실패 ${failures}개`:''}${partial?` · 부분 로그 ${partial}개`:''}`:`유효한 GPS 기록 없음${failures?` · 읽기 실패 ${failures}개`:''}`;
  }
  async function open(routeId,segment,time=0){
    if(active?.route===routeId){choose(segment||active.segment,time);return;}
    stop();const request=generation;let route=routes.get(routeId);
    if(window.CarrotVisionReplay?.isActive())$('carrotRoadVideo')?.pause();
    if(!route || (route.segmentCount||0)>(route.segmentFolders||[]).length){route=await getJson(`/api/dashcam/segments/${encodeURIComponent(routeId)}?limit=2000&sort=asc`);routes.set(routeId,route);}
    if(request!==generation)return;
    const segments=sorted(route.segmentFolders || route.segments || []);if(!segments.length)throw Error('주행 세그먼트가 없습니다.');
    active={route:routeId,segments,segment:segments.includes(segment)?segment:segments[0],time,points:new Map(),controller:null};
    $('haMapTitle').textContent=routeId;
    const select=$('haMapSegment');select.replaceChildren();for(const name of segments){const option=document.createElement('option');option.value=name;const times=route.segmentTimes?.[name];option.textContent=`구간 ${name.split('--').at(-1)}${times?.endEpoch?' · '+new Date((times.startEpoch||times.endEpoch)*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):''}`;select.append(option);}select.value=active.segment;
    $('haMapStatus').textContent='지도 불러오는 중';
    const token=generation;
    try{await initMap();if(token!==generation)return;map.invalidateSize();await pathLoad();}catch(error){if(token===generation)$('haMapStatus').textContent=error.message;}
  }
  async function initMap(){
    await leafletLoad();if(map)return;
    map=L.map('haRouteMap',{preferCanvas:true});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
    fitting=true;map.fitBounds([[33,124],[43,132]],{padding:[12,12],animate:false});fitting=false;
    map.on('movestart',()=>{if(!fitting)mapTouched=true;});
    new ResizeObserver(()=>map.invalidateSize()).observe($('haRouteMap'));
  }
  function openV2(segment){
    if(!segment)return;const dialog=$('haReplayV2');
    $('haReplayV2Frame').src=`${logsBase}/dashcam/v2/${encodeURIComponent(segment)}`;
    if(!dialog.open)dialog.showModal();
  }
  async function replay(tab){
    if(!active)return;const {route,segment,segments,time}=active;
    try{await window.CarrotVisionReplay.start({route,segment,segments,title:route,titleForSegment:value=>value});const video=$('carrotRoadVideo');const seek=()=>{if(time>0&&Number.isFinite(video.duration))video.currentTime=Math.min(time,video.duration);};if(video.readyState>=1)seek();else video.addEventListener('loadedmetadata',seek,{once:true});if(tab)$(`carrotReplayInsights${tab}Tab`)?.click();}catch(error){showAppToast(error.message);}
  }
  function init(){
    if(started||!logsBase)return;started=true;
    const bar=document.createElement('div');bar.className='ha-log-datebar';bar.innerHTML='<button id="haLogDatePrevious" class="smallBtn" type="button" aria-label="이전 기록 날짜" title="이전 기록 날짜">‹</button><input id="haLogDate" type="date" aria-label="주행 로그 날짜"><button id="haLogDateNext" class="smallBtn" type="button" aria-label="다음 기록 날짜" title="다음 기록 날짜">›</button><button id="haLogAllDates" class="smallBtn" type="button" aria-pressed="true">전체 날짜</button><span id="haLogDateStatus" role="status"></span>';
    document.querySelector('.logs-tabbar').after(bar);
    const panel=document.createElement('aside');panel.id='haRouteExplorer';panel.innerHTML='<header><h2 id="haMapTitle">주행 지도</h2></header><div class="ha-map-toolbar"><select id="haMapSegment" aria-label="지도 주행 구간"><option>주행 선택</option></select><button id="haMapReload" class="smallBtn" type="button" aria-label="경로 새로고침" title="경로 새로고침">↻</button></div><div id="haRouteMap" aria-label="기록된 실제 주행 GPS 지도"></div><footer><span id="haMapStatus" role="status"></span><span id="haMapPosition"></span></footer>';
    $('logsDashcamPanel').prepend(panel);
    $('haMapReload').onclick=()=>active&&pathLoad().catch(error=>$('haMapStatus').textContent=error.message);$('haMapSegment').onchange=event=>active&&choose(event.target.value);
    initMap().catch(error=>$('haMapStatus').textContent=error.message);
    const dialog=document.createElement('dialog');dialog.id='haReplayV2';dialog.innerHTML='<header><strong>리플레이 V2</strong><button class="smallBtn" type="button" aria-label="리플레이 V2 닫기">닫기</button></header><iframe id="haReplayV2Frame" title="Carrot Routes 리플레이 V2" referrerpolicy="no-referrer"></iframe>';document.body.append(dialog);
    dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>$('haReplayV2Frame').src='about:blank');
    let menuSegment='';
    document.addEventListener('click',event=>{
      const item=event.target.closest('[data-action]');if(!item)return;
      if(item.dataset.action==='segment-menu'){menuSegment=item.dataset.segment;return;}
      if(item.closest('#dashcamRoutes')&&item.dataset.route&&['play','toggle-route','select-route'].includes(item.dataset.action)){
        if(item.dataset.action==='play'){event.preventDefault();event.stopImmediatePropagation();}
        open(item.dataset.route,item.dataset.segment).catch(error=>showAppToast(error.message));
      }
    },true);
    new MutationObserver(()=>{
      const choices=$('appDialogChoices');if(!menuSegment||choices.hidden||choices.querySelector('.ha-replay-v2-choice'))return;
      const original=[...choices.querySelectorAll('button')].find(button=>/^(리플레이|Replay)$/.test(button.textContent.trim()));if(!original)return;
      const button=original.cloneNode(true),segment=menuSegment;button.classList.add('ha-replay-v2-choice');button.textContent='리플레이 V2';button.onclick=()=>{$('appDialogCancel')?.click();$('appDialog')?.close?.();openV2(segment);};original.after(button);
    }).observe($('appDialogChoices'),{childList:true,attributes:true,subtree:true});
    $('haLogDate').onchange=event=>selectDate(event.target.value);$('haLogAllDates').onclick=()=>selectDate('');
    $('haLogDatePrevious').onclick=()=>selectDate(calendar.filter(day=>!selectedDate||day<selectedDate).at(-1)||selectedDate);
    $('haLogDateNext').onclick=()=>selectDate(calendar.find(day=>day>selectedDate)||selectedDate);
    try{selectedDate=sessionStorage.getItem(`carrot:log-date:${logsBase}`)||'';}catch{}if(!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate))selectedDate='';
    for(const id of ['haLogDate','haLogDatePrevious','haLogDateNext','haLogAllDates'])$(id).disabled=true;
    calendarLoad().then(()=>window.CarrotLogsRuntime.dashcam.load({silent:true})).catch(error=>$('haLogDateStatus').textContent=[404,501].includes(error.status)?'날짜 검색은 HA 재시작 후 사용할 수 있습니다.':error.message);
    new MutationObserver(buttons).observe($('dashcamRoutes'),{childList:true,subtree:true});buttons();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)calendarLoad().catch(()=>{});});
    window.addEventListener('pagehide',stop);
    document.addEventListener('timeupdate',event=>{if(event.target.id!=='carrotRoadVideo')return;const status=window.CarrotVisionReplay.status();if(active?.points.has(status.segment))choose(status.segment,event.target.currentTime);},true);
  }
  window.CarrotLogExplorer={init,scopeURL,acceptPage,open,openV2,openForReplay:()=>{const status=window.CarrotVisionReplay.status();$('btnCarrotReplayClose')?.click();return open(status.route,status.segment,status.currentTime);}};
  if(typeof logsStarted!=='undefined'&&logsStarted)init();
})();
