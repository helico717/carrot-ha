// Debug-only synthetic scenarios; rendering and state mapping belong to the production viewer.
export const DOORS = ['driver','passenger','rear_driver','rear_passenger','trunk'];
const item = (id, label, expected, patch = {}, expect = {}) => ({id,label,expected,patch,expect,waitMs:1800});
const ALL_OPEN = Object.fromEntries(DOORS.map(k=>[k,true]));
export const SCENARIOS = [
  item('parked','주차 · 닫힘','front'),
  ...DOORS.map((door,i)=>item(door,['운전석','조수석','뒤 운전석','뒤 조수석','트렁크'][i]+' 열림','top',{doors:{[door]:true}})),
  item('all','전부 열림','top',{doors:Object.fromEntries(DOORS.map(k=>[k,true]))}),
  ...[0,60,120].map(speed=>item('drive'+speed,`주행 ${speed} km/h`,'drive',{mode:'driving',speed})),
  item('drive-lights','주행 + 하향등','drive',{mode:'driving',speed:60,lowBeam:true}),
  item('night','주차 + 하향등 · 야간','front',{lowBeam:true,theme:'dark'}),
  item('charge-door','충전 + 문 열림','charge',{mode:'charging',doors:{driver:true}},{charging:true,lamp:1}),
  item('charge-ac7','충전 · 완속 7kW','charge',{mode:'charging',powerKw:7,soc:62},{charging:true,lamp:1,sweep:'slow'}),
  item('charge-ac11','충전 · 완속 11kW (경계)','charge',{mode:'charging',powerKw:11,soc:62},{charging:true,lamp:1,sweep:'slow'}),
  item('charge-dc50','충전 · 급속 50kW','charge',{mode:'charging',powerKw:50,soc:62},{charging:true,lamp:1,sweep:'fast'}),
  item('charge-dc150','충전 · 급속 150kW','charge',{mode:'charging',powerKw:150,soc:62},{charging:true,lamp:1,sweep:'fast'}),
  item('charge-soc10','충전 · SOC 10%','charge',{mode:'charging',powerKw:50,soc:10},{charging:true,lamp:1}),
  item('charge-soc95','충전 · SOC 95%','charge',{mode:'charging',powerKw:7,soc:95},{charging:true,lamp:1}),
  item('charge-all-open','충전 + 문·트렁크 전부 열림','charge',{mode:'charging',powerKw:11,doors:ALL_OPEN},{charging:true,lamp:1}),
  item('charge-lamp-off','충전 중 하향등 켜짐 (실제 꺼짐)','charge',{mode:'charging',powerKw:11,lowBeam:false},{charging:true,lamp:1}),
  item('charge-lamp-real','충전 + 실제 하향등 켜짐','charge',{mode:'charging',powerKw:11,lowBeam:true},{charging:true,lamp:1}),
  item('charge-end','충전 종료 → 하향등 원래대로 (꺼짐)','front',{mode:'parked',lowBeam:false},{charging:false,lamp:0}),
  item('charge-end-real','충전 종료 → 실제 하향등 유지 (켜짐)','front',{mode:'parked',lowBeam:true},{charging:false,lamp:1}),
  item('charge-to-drive','충전 중 주행 시작','drive',{mode:'driving',speed:60},{charging:false,lamp:0}),
  item('start','문 열림 → 주행 시작','drive',{mode:'driving',speed:60,doors:{driver:true}}),
  item('stop','문 열림 → 주행 종료','top',{doors:{driver:true}}),
  item('stale','데이터 지연 · 문 유지','top',{mode:'stale',doors:{driver:true},retain:true}),
  item('offline','통신 지연 · 문 유지','top',{mode:'offline',doors:{driver:true},retain:true}),
  item('expired','하향등 181초 만료','front',{lowBeam:true,expired:true}),
  item('off','3D 끔','fallback',{enabled:false}),
  item('missing','모델 없음','fallback',{missing:true}),
  item('dark','다크','front',{theme:'dark'}),item('light','라이트','front',{theme:'light'})
];
export function simulatorMarkup() {
  return `<div class="control-group" id="sim3d"><div class="group-label">3D 차량 시뮬레이터</div>
  <div class="btn-group"><button data-sim="open">전부 열기</button><button data-sim="close">전부 닫기</button>
  <label><input type="checkbox" id="simBeam">하향등</label><label><input type="checkbox" id="simExpired">하향등 값 만료</label>
  <label><input type="checkbox" id="simOff">3D 끄기</label><label><input type="checkbox" id="simMissing">모델 없음</label></div>
  <label>속도 <input id="simSpeed" type="range" min="0" max="140" value="42"> <output id="simSpeedValue">42 km/h</output></label>
  <div class="btn-group"><button data-sim="reset">시점 초기화</button><label><input id="simFree" type="checkbox">자유시점</label><span id="simView">뷰어 대기</span></div>
  <div class="btn-group" style="flex-wrap:wrap">${SCENARIOS.map(s=>`<button data-scenario="${s.id}">${s.label}</button>`).join('')}</div>
  <div class="btn-group"><button data-sim="play">전체 순회 재생</button><button data-sim="stop">중지</button></div>
  <p id="simProgress" role="status">각 단계 1.8초 이상 · 시점 안정화 후 검증</p><details open><summary id="simSummary">검증 대기</summary><ol id="simResults"></ol></details></div>`;
}
export function installSimulator(host) {
  host.sim3d ||= {speed:42,lowBeam:false,expired:false,enabled:true,missing:false};
  const root=host.shadowRoot, sim=host.sim3d;
  const viewer=()=>host.dashCard?._v3d?.viewer;
  const update=()=>{host.applyDebugTelemetry(); refresh();};
  const refresh=()=>{
    const put=(id,text)=>{const el=root.querySelector('#'+id);if(el)el.textContent=text;};
    put('simView',`시점: ${viewer()?.view || 'PNG / 로딩'} · ${viewer()?.settled?'안정':'전환/대기'}`);
    put('simSpeedValue',`${host.state.mode==='driving'?sim.speed:0} km/h`);
    for(const [id,key] of [['simBeam','lowBeam'],['simExpired','expired'],['simMissing','missing']])root.querySelector('#'+id).checked=sim[key];
    root.querySelector('#simOff').checked=!sim.enabled;
    root.querySelector('#simSpeed').value=sim.speed;
    root.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===host.state.mode));
    root.querySelectorAll('[data-door]').forEach(b=>b.classList.toggle('door-open',!!host.state.doors?.[b.dataset.door]));
  };
  for(const [id,key] of [['simBeam','lowBeam'],['simExpired','expired'],['simMissing','missing'],['simOff','enabled']])root.querySelector('#'+id).onchange=e=>{sim[key]=id==='simOff'?!e.target.checked:e.target.checked;update();};
  root.querySelector('#simSpeed').oninput=e=>{sim.speed=Number(e.target.value);if(sim.speed>0)host.state.mode='driving';update();};
  root.querySelector('#simFree').onchange=e=>viewer()?.setFreeLook(e.target.checked);
  const stop=()=>{host._simRun=(host._simRun||0)+1;};
  host.stop3dSimulation=stop;
  const apply=s=>{
    Object.assign(sim,{speed:0,lowBeam:false,expired:false,enabled:true,missing:false},s.patch);
    host.state.doors={...s.patch.doors};
    host.state.powerKw=s.patch.powerKw??11;host.state.soc=s.patch.soc??74;
    host.state.mode='parked';host.applyDebugTelemetry(); // healthy snapshot for stale/offline retention
    host.state.mode=s.patch.mode||'parked';
    if(s.patch.theme)host.applyTheme(s.patch.theme);
    root.querySelector('#simFree').checked=false;viewer()?.setFreeLook(false);
    update();viewer()?.resetView();
  };
  host.apply3dScenario=id=>apply(SCENARIOS.find(s=>s.id===id));
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const check=async(s,token)=>{
    host.dashCard.scrollIntoView({block:'start'});
    const begin=performance.now();
    do {
      if(host._simRun!==token||!host.isConnected)return null;
      const v=viewer();
      if(performance.now()-begin>=s.waitMs && (s.expected==='fallback'||v?.settled||(s.expected==='drive'&&v?.view==='drive')))break;
      root.querySelector('#simProgress').textContent=`${s.label} · 대기 ${Math.max(0,Math.ceil((s.waitMs-(performance.now()-begin))/1000))}초 · 안정화 제한 12초`;
      await pause(100);
    }while(performance.now()-begin<12000);
    const card=host.dashCard,v=viewer(),actual=v?.view||'fallback';
    const fallback=s.expected==='fallback';
    const box=card.shadowRoot.querySelector('.vehicle3d');
    const image=card.shadowRoot.querySelector('.car-image');
    const visibleFallback=!!image && (!box || (!box.querySelector('canvas') && box.querySelector('.v3d-fallback')?.style.visibility!=='hidden'));
    const state=card._v3d?.pending;
    const lampOk=s.id!=='expired'||(state?.lowBeam===false && card.v.debug_raw.field_measured_at.light_low_beam_requested);
    // Charging checks: scene on/off, headlamp level (real low beam or charging) and the sweep speed class.
    const exp=s.expect||{},notes=[];let extra=true;
    if(!fallback&&v){
      if('charging' in exp&&v.charge.active!==exp.charging){extra=false;notes.push(`충전 장면 ${v.charge.active}`);}
      if('lamp' in exp&&(exp.lamp?v.lamp<0.9:v.lamp>0.1)){extra=false;notes.push(`램프 ${v.lamp.toFixed(2)}`);}
      if(exp.sweep){
        const kw=card.v?.charge_power_kw,want=kw>11?2.2:4.4;
        if(Math.abs(v.charge.period-want)>0.01||(exp.sweep==='fast')!==(want===2.2)){extra=false;notes.push(`스윕 ${v.charge.period}초 (전력 ${kw} kW)`);}
        else notes.push(`스윕 ${v.charge.period}초 · ${kw} kW`);
      }
    }
    const pass=actual===s.expected && (fallback?visibleFallback:!!v&&(v.settled||s.expected==='drive')) && !!lampOk && extra;
    const row={id:s.id,expected:s.expected,actual,pass};
    host.sim3dResults.push(row);
    const li=document.createElement('li');li.textContent=`${pass?'통과':'실패'} · ${s.label}: 기대 ${s.expected} / 실제 ${actual}${notes.length?' · '+notes.join(' · '):''}`;
    root.querySelector('#simResults').append(li);
    const passed=host.sim3dResults.filter(r=>r.pass).length;
    root.querySelector('#simSummary').textContent=`통과 ${passed} / 실패 ${host.sim3dResults.length-passed} / 전체 ${host.sim3dResults.length}`;
    return row;
  };
  root.querySelectorAll('[data-scenario]').forEach(b=>b.onclick=async()=>{stop();const token=host._simRun,s=SCENARIOS.find(s=>s.id===b.dataset.scenario);host.sim3dResults||=[];apply(s);await check(s,token);});
  root.querySelectorAll('[data-sim]').forEach(b=>b.onclick=async()=>{
    const action=b.dataset.sim;
    if(action==='reset'){viewer()?.resetView();return;}
    if(action==='open'||action==='close'){stop();host.state.doors=Object.fromEntries(DOORS.map(k=>[k,action==='open']));update();return;}
    stop();if(action==='stop'){root.querySelector('#simProgress').textContent='중지됨';return;}
    host.sim3dResults=[];root.querySelector('#simResults').replaceChildren();
    const token=host._simRun;
    for(const s of SCENARIOS){if(host._simRun!==token)break;apply(s);if(await check(s,token)===null)return;}
    if(host._simRun===token)root.querySelector('#simProgress').textContent='전체 순회 완료';
  });
  clearInterval(host._simMonitor);host._simMonitor=setInterval(refresh,250);refresh();
}
