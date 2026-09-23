import {tripDays, loadRecentTrips, mergeConsecutiveCharges} from './carrot-trip-days.js';
const assetBase = new URL('./carrot-assets/', import.meta.url).href;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = (v, digits=1) => typeof v==='number' && Number.isFinite(v) ? v.toLocaleString('ko-KR',{maximumFractionDigits:digits}) : '—';
const time = (v, tz) => v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:tz||undefined}) : '기록 없음';
const timeOnly = (v, tz) => v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toLocaleString('ko-KR',{hour:'2-digit',minute:'2-digit',timeZone:tz||undefined}) : '기록 없음';
const duration = v => typeof v==='number' ? [Math.floor(v/3600),Math.floor(v/60)%60,Math.floor(v)%60].map(x=>String(x).padStart(2,'0')).join(':') : '—';
const shortDuration = v => typeof v==='number' ? (Math.floor(v/3600)?Math.floor(v/3600)+'시간 ':'')+Math.floor(v/60)%60+'분' : '—';
const formatDuration = s => { if(typeof s !== 'number' || !Number.isFinite(s)) return '—'; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); if(h > 0 && m > 0) return `${h}시간 ${m}분 소요`; if(h > 0) return `${h}시간 소요`; return `${m}분 소요`; };
const chargeDuration = s => { if(typeof s !== 'number' || !Number.isFinite(s)) return '—'; if(s <= 0) return '완료'; if(s < 60) return '1분 미만'; const totalMins = Math.round(s/60); const h = Math.floor(totalMins/60); const m = totalMins%60; if(h === 0) return `${m}분`; return m === 0 ? `${h}시간` : `${h}시간 ${m}분`; };
const formatEtaCompletion = (val, tz) => {
  if (!val) return '계산 중';
  const targetDate = new Date(val);
  if (Number.isNaN(targetDate.getTime())) return '—';
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  const dayDiff = Math.round((targetMidnight - todayMidnight) / 86400000);
  const timeStr = targetDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: tz || undefined });
  let dayPrefix = '';
  if (dayDiff === 1) dayPrefix = '내일 ';
  else if (dayDiff === 2) dayPrefix = '모레 ';
  else if (dayDiff > 2) dayPrefix = `${targetDate.getMonth() + 1}월 ${targetDate.getDate()}일 `;
  return `${dayPrefix}${timeStr} 완료`;
};
const tripDurationKo = s => {
  if(typeof s !== 'number' || !Number.isFinite(s) || s < 0) return '';
  const totalSec = Math.round(s);
  if(totalSec < 60) return '1분 미만';
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60);
  if(h > 0 && m > 0) return `${h}시간 ${m}분`;
  if(h > 0) return `${h}시간`;
  return `${m}분`;
};
const batteryIconName = soc => {
  if(typeof soc !== 'number' || !Number.isFinite(soc)) return 'battery';
  const level = Math.max(0, Math.min(100, Math.round(soc)));
  if(level >= 95) return 'battery';
  if(level <= 5) return 'battery-outline';
  return `battery-${Math.round(level / 10) * 10}`;
};
const parkingDuration = (parkingAt, refTime) => {
  if (!parkingAt) return '—';
  const pTime = new Date(parkingAt).getTime();
  const now = refTime ? new Date(refTime).getTime() : Date.now();
  const diffMs = Math.max(0, now - pTime);
  const diffMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMinutes / (60 * 24));
  const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
  const mins = diffMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0 || days > 0) parts.push(`${hours}시간`);
  parts.push(`${mins}분`);
  return parts.join(' ');
};
const icon = name => {
  if(name==='flash-double')return `<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,20px);height:var(--mdc-icon-size,20px);display:inline-block" fill="currentColor" aria-hidden="true"><path d="M3.2,4V12.8H5.6V20L11.2,10.4H8L11.2,4Z"/><path d="M12.8,4V12.8H15.2V20L20.8,10.4H17.6L20.8,4Z"/></svg>`;
  return `<ha-icon icon="mdi:${name}"></ha-icon>`;
};
const metric = (label,value,unit,ico,sub='',cls='') => `<div class="metric ${cls}">${icon(ico)}<span class="label">${label}</span><strong>${esc(value)}<small>${esc(unit)}</small></strong>${sub?`<span class="hint">${esc(sub)}</span>`:''}</div>`;
function leaflet() {
  if (!window.__carrotLeaflet) window.__carrotLeaflet = new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=assetBase+'leaflet.js';
    script.onload=()=>resolve(window.L.noConflict());script.onerror=()=>{window.__carrotLeaflet=null;reject(Error('지도 라이브러리를 읽을 수 없습니다. carrot-assets 폴더를 확인하세요.'));};document.head.append(script);
  });
  return window.__carrotLeaflet;
}

class CarrotDashboard extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.tab='overview';this.trips=[];this.charges=[];this.v={};this.offset=0;this.busy=false;this.isFromCache=false;this.selected=null;this.tripDay=null;this.chargeDay=null;this.batteryDay=null;}
  get cacheKey(){return 'carrot-cache-'+(this.config?.device_id||'default');}
  loadCache(){
    try{
      const raw=localStorage.getItem(this.cacheKey);
      if(!raw)return false;
      const cached=JSON.parse(raw);
      if(cached&&cached.v&&typeof cached.v==='object'&&Object.keys(cached.v).length){
        this.v=cached.v;
        if(Array.isArray(cached.trips)&&cached.trips.length)this.trips=cached.trips;
        if(Array.isArray(cached.charges)&&cached.charges.length)this.charges=cached.charges;
        this.isFromCache=true;
        return true;
      }
    }catch(e){console.warn('Carrot HA cache load failed',e);}
    return false;
  }
  saveCache(){
    try{
      if(!this.v||!Object.keys(this.v).length)return;
      const cachedTrips=(this.trips||[]).slice(0,5);
      const cachedCharges=(this.charges||[]).slice(0,5);
      localStorage.setItem(this.cacheKey,JSON.stringify({v:this.v,trips:cachedTrips,charges:cachedCharges,saved_at:Date.now()}));
    }catch(e){console.warn('Carrot HA cache save failed',e);}
  }
  setConfig(config){this.config=config;this.themeMode=config.color_mode||'auto';try{this.themeMode=localStorage.getItem('carrot-theme-'+(config.device_id||'default'))||this.themeMode;}catch{}this.applyTheme();if(!this.v||!Object.keys(this.v).length)this.loadCache();this.render();}
  applyTheme(){
    if(!['auto','light','dark'].includes(this.themeMode))this.themeMode='auto';
    const dark=this.themeMode==='auto'?(this._hass?.themes?.darkMode??window.matchMedia('(prefers-color-scheme: dark)').matches):this.themeMode==='dark';
    this.setAttribute('data-theme',dark?'dark':'light');
  }
  set hass(hass){const oldCharging=this._hass?.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state;const previous=this._hass?.states?.[this.config?.online_entity||this.v?.entity_ids?.comma_online]?.state;this._hass=hass;this.applyTheme();if(!this.initialized){this.initialized=true;if(!this.v||!Object.keys(this.v).length)this.loadCache();this.load();}else if(oldCharging!==hass.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state||previous!==hass.states?.[this.config?.online_entity||this.v?.entity_ids?.comma_online]?.state){this.render();}}
  connectedCallback(){this.timer=setInterval(()=>{if(this._hass&&!document.hidden)this.load(true);},60000);}
  disconnectedCallback(){this.clearMiniMaps();clearInterval(this.timer);if(this.map){this.map.remove();this.map=null;}}
  getCardSize(){return 8;}
  getGridOptions(){return {columns:36,rows:"auto",min_columns:6};}
  async load(quiet=false){
    if(this.busy)return;this.busy=true;this.error='';
    try{
      if(!quiet&&(!this.v||!Object.keys(this.v).length))this.render();
      const devices=await this._hass.callApi('GET','carrot_ha/v1/devices');
      const requested=this.config?.device_id;
      this.device=devices.devices.find(d=>d.device_id===requested)||(!requested?devices.devices[0]:null);
      if(!this.device)throw Error('Carrot HA 장치를 찾지 못했습니다. 카드의 device_id를 확인하세요.');
      const id=encodeURIComponent(this.device.entry_id);
      const dash=await this._hass.callApi('GET',`carrot_ha/v1/dashboard/${id}`);
      this.v=dash.values;this.isFromCache=false;this.saveCache();this.render();
      const [trips,charges]=await Promise.all([
        loadRecentTrips(this._hass.callApi.bind(this._hass),id),
        this._hass.callApi('GET',`carrot_ha/v1/history/${id}?kind=charge&limit=100&offset=0`)]);
      const selectedStart=this.selected!==null?this.trips[this.selected]?.data?.started_at:null;
      this.trips=trips.events;this.charges=mergeConsecutiveCharges(charges.events);
      if(selectedStart!=null){
        const idx=this.trips.findIndex(e=>e.data?.started_at===selectedStart);
        this.selected=idx!==-1?idx:null;
      }else{
        this.selected=null;
      }
      this.saveCache();
    }catch(e){this.error=e instanceof Error?e.message:'HA 조회 실패. 관리자 계정과 통합 업데이트를 확인하세요.';}
    finally{this.busy=false;this.render();}
  }
  clearMiniMaps(){const maps=this.miniMaps||[];this.miniMaps=[];for(const map of maps){try{map.remove();}catch(e){console.warn("Carrot HA: map cleanup failed",e);}}}
  render(){
    this.clearMiniMaps();
    if(this.map){this.map.remove();this.map=null;}
    if(this.tab==='trips'){
      const days=tripDays(this.trips,this._hass?.config?.time_zone);
      if(!this.tripDay||!days.some(d=>d.key===this.tripDay)){
        const today=days.find(d=>d.today)||days[days.length-1];
        this.tripDay=today?today.key:null;
        this.selected=null;
      }
      if(this.selected!==null){
        const curTrip=this.trips[this.selected];
        const dayObj=days.find(d=>d.key===this.tripDay);
        if(!curTrip||!dayObj||!dayObj.indices.includes(this.selected)){
          this.selected=null;
        }
      }
    }
    if(this.tab==='charge'){
      const days=tripDays(this.charges,this._hass?.config?.time_zone);
      if(!this.chargeDay||!days.some(d=>d.key===this.chargeDay)){
        const today=days.find(d=>d.today)||days[days.length-1];
        this.chargeDay=today?today.key:null;
      }
      const bDays=this.v?.battery_history;
      if(Array.isArray(bDays)&&this.chargeDay){
        const bIdx=bDays.findIndex(x=>x.date===this.chargeDay);
        if(bIdx!==-1)this.batteryDay=bIdx;
      }
    }
    const v=this.v;
    const isTrip=this.tab==='trips';
    const isSpecificTrip=isTrip&&this.selected!==null&&Boolean(this.trips[this.selected]);
    const trip=isSpecificTrip?(this.trips[this.selected]?.data||{}):{};
    const route=trip.route||[];
    const state=this.vehicleStatus(v),badge=state.label;
    this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${assetBase}leaflet.css"><style>
      :host{display:block;container-type:inline-size;--ink:#f3f4f4;--muted:#959b9e;--line:#2b2e30;--orange:#ff8a18;--green:#72df9b;color:var(--ink);font-family:Inter,Pretendard,'Noto Sans KR',system-ui,sans-serif}
      *{box-sizing:border-box}ha-card{display:block;background:#0c0e10;border:1px solid #23272a;border-radius:26px;overflow:hidden;color:var(--ink)}button{font:inherit;cursor:pointer;color:inherit}button:focus-visible{outline:3px solid var(--orange);outline-offset:3px}button:disabled{opacity:.4;cursor:default}ha-icon{width:22px;height:22px;color:var(--muted)}.top{padding:28px 28px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px}.brand{font-size:12px;letter-spacing:3px;color:var(--muted);font-weight:650}.top h1{margin:5px 0 0;font-size:29px;letter-spacing:-1px}.badge{display:inline-flex;align-items:center;gap:8px;background:#19221d;padding:9px 12px;border-radius:30px;font-size:12px;color:var(--green);white-space:nowrap}.badge.dim{color:#b8babd;background:#222527}.dot{width:6px;height:6px;border-radius:50%;background:currentColor}.nav{display:flex;gap:5px;margin:0 28px 22px;padding:5px;background:#181b1d;border-radius:14px}.nav button{flex:1;border:0;border-radius:10px;background:transparent;padding:12px 6px;font-size:13px;font-weight:650;color:var(--muted)}.nav button.active{background:#303538;color:white}.main{padding:0 28px 26px}.tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.metric{border:1px solid var(--line);border-radius:18px;background:linear-gradient(145deg,#1d2022,#151719);padding:18px;min-width:0}.metric ha-icon{display:block;margin-bottom:12px}.label{display:block;font-size:12px;color:var(--muted);margin-bottom:8px}.metric strong{font-size:27px;font-weight:700;letter-spacing:-.6px;display:block;overflow-wrap:anywhere}.metric small{font-size:13px;margin-left:5px;font-weight:450;color:#aeb3b6;letter-spacing:0}.hint{font-size:11px;display:block;margin-top:8px;color:var(--muted);line-height:1.5}.layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(240px,1fr);gap:18px}.panel{background:#131618;border:1px solid var(--line);border-radius:20px;overflow:hidden}.paneltitle{padding:19px 20px;display:flex;align-items:center;justify-content:space-between;gap:8px}.paneltitle h2{font-size:16px;margin:0}.sub{color:var(--muted);font-size:12px;line-height:1.5}.map{height:380px;background:#14191c;z-index:0}.map .leaflet-tile-pane{filter:grayscale(1) invert(.91) hue-rotate(180deg) brightness(.8)}.leaflet-container{font:inherit}.leaflet-control-attribution{font-size:9px;background:#e4e7e7df!important;color:#222!important}.leaflet-control-attribution a{color:#26494a!important}.leaflet-bar a{background:#232729!important;color:white!important;border-color:#41464b!important}.pin{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--green);color:#07130b;border:3px solid #e8fff0;box-shadow:0 0 0 5px #0007;font-size:12px;font-weight:bold}.pin.end{background:var(--orange);border-color:#ffe2c4}.route-caption{padding:16px 20px;border-top:1px solid var(--line)}.legend{display:flex;align-items:center;gap:10px;font-size:11px;color:#bcc1c3;margin-bottom:10px}.gradient{height:5px;background:linear-gradient(90deg,#f4511e 0%,#ffb300 35%,#92cd00 65%,#00a843 100%);flex:1;border-radius:10px}.tripbtn{width:100%;text-align:left;padding:17px 18px;border:0;border-top:1px solid var(--line);background:transparent;display:flex;justify-content:space-between;gap:12px;align-items:center}.tripbtn.selected{background:#29251e;border-left:3px solid var(--orange)}.tripbtn b{display:flex;align-items:baseline;flex-wrap:wrap;font-size:13px;margin-bottom:6px}.tripbtn strong{font-size:21px;white-space:nowrap}.tripbtn small{font-size:11px;color:var(--muted)}.trip-dur{font-weight:400;font-size:12px;color:var(--muted);margin-left:6px}.trip-soc{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:#34d399;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.28);padding:2px 7px;border-radius:6px;letter-spacing:-.2px;white-space:nowrap;line-height:1.2}:host([data-theme="light"]) .trip-soc{background:#dcfce7;color:#15803d;border-color:#86efac}.trip-soc ha-icon{--mdc-icon-size:14px;width:14px;height:14px;display:inline-block;color:currentColor;vertical-align:middle}.trip-eff{margin-left:6px;font-weight:600;font-size:11.5px;color:#38bdf8;background:rgba(56,189,248,.12);padding:2px 7px;border-radius:6px;border:1px solid rgba(56,189,248,.25);letter-spacing:-.2px;white-space:nowrap;line-height:1.2}:host([data-theme="light"]) .trip-eff{background:#e0f2fe;color:#0284c7;border-color:#bae6fd}.scroll{max-height:480px;overflow:auto}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.section{font-size:16px;margin:26px 0 14px}.row{display:flex;justify-content:space-between;gap:15px;padding:15px 20px;border-top:1px solid var(--line);font-size:13px}.row span{color:var(--muted)}.row b{text-align:right}.empty{padding:50px 24px;text-align:center;color:var(--muted);line-height:1.8;font-size:13px}.foot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px;color:var(--muted);font-size:11px}.refresh,.page{background:#202528;border:1px solid #343a3e;border-radius:10px;padding:10px 13px;white-space:nowrap;font-size:12px}.error{border:1px solid #814f25;background:#32241b;color:#ffd8af;padding:14px;border-radius:12px;margin-bottom:16px;font-size:13px}.pages{padding:12px;display:flex;justify-content:space-between;align-items:center}.batterybar{height:6px;background:#2d3433;border-radius:8px;margin:12px 0 4px;overflow:hidden}.batterybar i{display:block;height:100%;background:var(--green)}.allvalues{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}.table-row{display:flex;justify-content:space-between;gap:12px;padding:15px 0;border-bottom:1px solid var(--line);font-size:13px}.table-row span{color:var(--muted)}.notice{margin:14px 0;color:var(--muted);font-size:12px;line-height:1.7}.detailstats{margin-top:16px}.mono{font-variant-numeric:tabular-nums}details{margin-top:18px;color:var(--muted);font-size:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto}.resetmap{font:inherit;background:#232729;color:white;border:0;padding:8px;cursor:pointer}
       @container(max-width:650px){.top{padding:23px 18px 16px}.top h1{font-size:25px}.brand{font-size:10px}.badge{font-size:10px;padding:8px}.nav{margin:0 18px 18px}.main{padding:0 18px 22px}.tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.metric{padding:16px;border-radius:17px}.metric strong{font-size:26px}.layout{grid-template-columns:1fr}.map{height:370px}.allvalues{grid-template-columns:1fr}.scroll{max-height:320px}.foot{align-items:flex-start}.paneltitle{padding:16px}.row{padding:14px 16px}.grid2{gap:10px}}@container(min-width:1000px){.map{height:440px}.top h1{font-size:32px}.metric strong{font-size:31px}}
 
       :host{width:100%;min-width:0}ha-card{max-width:1440px;margin:auto}.top{padding:20px 24px 12px}.top h1{font-size:25px}.brand{font-size:10px}.nav{margin:0 24px 16px}.main{padding:0 24px 18px}.foot{margin-top:14px}.foot div{line-height:1.6}.cockpit{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:20px}.hero{position:relative;min-height:350px;overflow:hidden;border-radius:20px;background:radial-gradient(ellipse at 65% 80%,#c2cdd0,#e5e9e6 75%);color:#17272d}.hero-copy{position:relative;z-index:1;padding:24px}.hero-copy small{font-size:11px;letter-spacing:2px}.hero-copy h2{font-size:36px;line-height:1.15;margin:10px 0 0;letter-spacing:-1.5px}.hero .car-image{position:absolute;width:100%;height:100%;object-fit:cover;inset:0 0 auto;pointer-events:none}.quick{display:flex;flex-direction:column;gap:12px;min-width:0}.energy{background:#18221f;border:1px solid #34463e;border-radius:18px;padding:18px}.energy-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.energy-head strong{font-size:42px;line-height:1}.energy-head strong small{font-size:16px;color:#a9bdb0}.energy-head span{font-size:12px;color:#a9bdb0}.energy p{margin:8px 0 0;font-size:12px;color:#b8c9bf}.quick-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px}.quick-metrics .metric{padding:13px}.quick-metrics .metric strong{font-size:22px}.quick-metrics .metric ha-icon{display:none}.quick-metrics .label{margin-bottom:6px}.shortcut{display:flex;align-items:center;text-align:left;justify-content:space-between;width:100%;padding:15px;border-radius:15px;border:1px solid var(--line);background:#181c1e;gap:12px}.shortcut b{display:block;font-size:13px}.shortcut small{display:block;color:var(--muted);font-size:11px;margin-top:5px}.shortcut em{font-style:normal;color:var(--green)}.overview-links{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.mini-condition{display:flex;justify-content:space-around;gap:8px;border-top:1px solid var(--line);padding-top:13px;margin-top:14px;color:#b9c0c3;font-size:12px}.mini-condition span{white-space:nowrap}.mini-condition b{color:var(--ink)}
       @container(max-width:700px){.top{padding:15px 16px 10px}.top h1{font-size:22px}.brand{font-size:9px;letter-spacing:2px}.nav{margin:0 16px 12px}.nav button{padding:10px 4px;font-size:12px}.main{padding:0 16px 14px}.cockpit{grid-template-columns:1fr;gap:12px}.hero{min-height:160px}.hero-copy{padding:17px}.hero-copy h2{font-size:28px;max-width:160px}.hero .car-image{width:83%;height:250px;left:20%;top:-48px;object-fit:cover}.energy{padding:13px 15px}.energy-head strong{font-size:34px}.batterybar{margin:10px 0 4px}.quick{gap:10px}.quick-metrics .metric{padding:11px 13px}.quick-metrics .metric strong{font-size:21px}.quick-metrics .label{font-size:11px}.quick-metrics .metric:nth-child(n+3){display:none}.overview-links{margin-top:10px}.shortcut{padding:12px}.shortcut small{line-height:1.5}.mini-condition{margin-top:10px;padding-top:10px;font-size:11px}.foot{font-size:10px;gap:8px}.foot .refresh{padding:9px}.map{height:310px}.metric ha-icon{margin-bottom:7px}.metric{padding:12px}.metric strong{font-size:23px}}@container(max-width:360px){.hero .car-image{left:15%;width:90%}.hero-copy h2{font-size:24px}.mini-condition{flex-wrap:wrap}.overview-links{grid-template-columns:1fr}.badge{font-size:9px}}
 
    .trip-days,.charge-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:0 10px 15px}.charge-days{max-width:480px;margin:0 auto 12px;gap:4px}.trip-day,.charge-day{max-width:54px;margin:0 auto;width:100%;min-width:0;border:1px solid transparent;border-radius:13px;padding:6px 2px;background:rgba(255,255,255,.025);color:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;transition:all .18s ease}.trip-day:hover,.charge-day:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.08)}.trip-day[aria-pressed="true"],.charge-day[aria-pressed="true"]{background:linear-gradient(180deg,#1d4ed8 0%,#1e40af 100%);border-color:#60a5fa;box-shadow:0 3px 10px rgba(29,78,216,.45);color:#fff}.trip-day[aria-pressed="true"] b,.charge-day[aria-pressed="true"] b{color:#fff;font-weight:700}.trip-day[aria-pressed="true"] .trip-today,.charge-day[aria-pressed="true"] .charge-today{color:#e0f2fe;font-weight:750}.trip-day[aria-pressed="true"] .trip-count,.charge-day[aria-pressed="true"] .charge-count{color:#dbeafe;font-weight:600}.trip-day[aria-pressed="true"] .trip-count ha-icon,.charge-day[aria-pressed="true"] .charge-count ha-icon{color:#dbeafe}:host([data-theme="light"]) .trip-day[aria-pressed="true"],:host([data-theme="light"]) .charge-day[aria-pressed="true"]{background:#dbeafe;border-color:#3b82f6;box-shadow:0 2px 8px rgba(59,130,246,.25);color:#1e3a8a}:host([data-theme="light"]) .trip-day[aria-pressed="true"] b,:host([data-theme="light"]) .charge-day[aria-pressed="true"] b{color:#1e3a8a}:host([data-theme="light"]) .trip-day[aria-pressed="true"] .trip-today,:host([data-theme="light"]) .charge-day[aria-pressed="true"] .charge-today{color:#1d4ed8}:host([data-theme="light"]) .trip-day[aria-pressed="true"] .trip-count,:host([data-theme="light"]) .charge-day[aria-pressed="true"] .charge-count{color:#1e40af}:host([data-theme="light"]) .trip-day[aria-pressed="true"] .trip-count ha-icon,:host([data-theme="light"]) .charge-day[aria-pressed="true"] .charge-count ha-icon{color:#1e40af}.trip-day b,.charge-day b{font-size:11px;white-space:nowrap;color:#d1d5db}.trip-today,.charge-today{height:12px;line-height:12px;font-size:10px;color:#60a5fa;font-weight:600}:host([data-theme="light"]) .trip-today,:host([data-theme="light"]) .charge-today{color:#2563eb}.trip-count,.charge-count{display:flex;align-items:center;justify-content:center;gap:3px;font-size:11px;line-height:12px;color:var(--muted)}.trip-count ha-icon{--mdc-icon-size:10px;width:10px;height:12px}.charge-count ha-icon{--mdc-icon-size:11px;width:11px;height:12px}.trip-day-heading{padding:13px 22px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}.charge-row{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-top:1px solid var(--line);font-size:13px;gap:12px}.charge-meta{display:flex;align-items:center;gap:14px;text-align:left;min-width:0;flex:1 1 auto}.charge-meta>div{min-width:0;text-align:left}.charge-icon-wrap,:host([data-theme="light"]) .charge-icon-wrap{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#edf4fe;color:#2563eb;flex-shrink:0}:host([data-theme="dark"]) .charge-icon-wrap{background:#162235;color:#60a5fa}.charge-icon-wrap.fast,:host([data-theme="light"]) .charge-icon-wrap.fast{background:#dbeafe;color:#1d4ed8}:host([data-theme="dark"]) .charge-icon-wrap.fast{background:#1e355b;color:#93c5fd}.charge-bolt{width:20px;height:20px;display:block;fill:currentColor}.charge-date{font-size:14px;font-weight:650;display:block;margin-bottom:4px;text-align:left!important;white-space:nowrap}.charge-info-sub{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);text-align:left!important;flex-wrap:wrap}.charge-dur{color:var(--muted);font-size:12px;white-space:nowrap;flex-shrink:0}.speed-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:-0.2px;line-height:15px;white-space:nowrap;flex-shrink:0}.speed-badge.slow,:host([data-theme="light"]) .speed-badge.slow{background:#edf4fe;color:#2563eb}:host([data-theme="dark"]) .speed-badge.slow{background:#162235;color:#60a5fa}.speed-badge.fast,:host([data-theme="light"]) .speed-badge.fast{background:#dbeafe;color:#1e40af}:host([data-theme="dark"]) .speed-badge.fast{background:#1e355b;color:#93c5fd}.merge-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:-0.2px;line-height:15px;background:#f3e8ff;color:#6b21a8;white-space:nowrap;flex-shrink:0}:host([data-theme="dark"]) .merge-badge{background:#3b1d54;color:#e9d5ff}.charge-val{text-align:right;flex-shrink:0;max-width:55%}.charge-sub{display:block;font-size:11px;font-weight:normal;color:var(--muted);margin-top:2px;word-break:keep-all;line-height:1.3}@media(min-width:901px){.layout:has(.trip-history){grid-template-columns:minmax(0,1.35fr) minmax(390px,1fr)}}@media(max-width:420px){.trip-days,.charge-days{padding-left:3px;padding-right:3px;gap:2px}.trip-day,.charge-day{border-radius:10px;padding:5px 1px}.trip-day b,.charge-day b{font-size:10px}.trip-today,.charge-today{font-size:9px;height:10px;line-height:10px}.trip-count,.charge-count{font-size:10px;line-height:10px}}
.charge-layout{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(360px,1fr);gap:18px;align-items:start;width:100%}
.charge-layout .battery-history{margin-bottom:0;width:100%}
.charge-sidebar{display:flex;flex-direction:column;gap:16px;min-width:0;width:100%}
.charge-sidebar-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px;margin-bottom:0;width:100%}
.charge-sidebar .charge-history{width:100%}
.charge-sidebar .charge-history .scroll{max-height:380px}
.charge-sidebar .charge-days{max-width:100%;margin:0 0 10px;padding:0 8px 10px;width:100%}
@container(max-width:750px){.charge-layout{display:flex;flex-direction:column;gap:16px;align-items:stretch;width:100%}.charge-sidebar{width:100%}.charge-sidebar-tiles{width:100%;gap:10px}.charge-sidebar .charge-history{width:100%}.charge-sidebar .charge-history .scroll{max-height:320px}}
.parking-chip-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(18,96,232,0.18);color:#5ea2ff;border:1px solid rgba(18,96,232,0.35);padding:6px 14px;border-radius:22px;font-size:14.5px;font-weight:700;letter-spacing:-.3px}
.parking-chip-badge.driving{background:rgba(19,120,69,0.22);color:#72df9b;border-color:rgba(114,223,155,0.4)}
.parking-chip-badge .dot{width:9px;height:9px;border-radius:50%;background:currentColor;box-shadow:0 0 7px currentColor}
.parking-chip-badge .dot.pulse{animation:pulse-dot 1.5s infinite}
@keyframes pulse-dot{0%{transform:scale(0.9);opacity:.8}50%{transform:scale(1.3);opacity:1}100%{transform:scale(0.9);opacity:.8}}
.parking-heading-wrap{display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:10px}
.parking-heading-left{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.parking-heading-left h2{font-size:18px;margin:0}
.parking-tiles{margin-top:18px}
</style><ha-card><header class="top"><div><div class="brand">VOLKSWAGEN · CARROT HA</div><h1>${esc(this.config?.vehicle_name||this.v?.vehicle_model||'Volkswagen MEB')}</h1></div><span class="badge ${state.key}"><i class="dot"></i>${badge}</span></header><nav class="nav">${[['overview','내 차'],['trips','주행'],['parking','위치'],['charge','충전'],['vehicle','상태']].map(([key,label])=>`<button data-tab="${key}" class="${this.tab===key?'active':''}">${label}</button>`).join('')}</nav><main class="main">${this.error?`<div class="error">${esc(this.error)}</div>`:''}${this.body(v,trip,isTrip)}<footer class="foot"><div>Cloudflare · ${esc(v.cloud_status||(this.busy?'연결 확인 중…':'연결 확인 중'))}<br>HA 업데이트 ${time(v.last_sync)}<br>차량 정보 수신 ${time(v.measured_at)}${this.isFromCache?' (최신 확인 중…)':''}</div><button class="refresh">${this.busy?'조회 중…':'↻ 새로고침'}</button></footer></main></ha-card>`;
    this.shadowRoot.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.tab==='trips'&&this.tab!=='trips'){this.selected=null;this.tripDay=null;}if(b.dataset.tab==='charge'&&this.tab!=='charge'){this.chargeDay=null;this.batteryDay=null;}this.tab=b.dataset.tab;this.render();});
    const themeStyle=document.createElement('style');
    themeStyle.textContent=`
      .theme-control{display:flex;align-items:center;gap:8px;margin-top:14px;color:var(--muted);font-size:12px}.theme-control select{font:inherit;color:var(--ink);background:#202528;border:1px solid var(--line);border-radius:8px;padding:7px;min-height:34px}
      :host([data-theme="dark"]){color-scheme:dark}
      :host([data-theme="light"]){color-scheme:light;--ink:#1b292f;--muted:#5b686e;--line:#d6dfe2;--green:#187845;--orange:#b85a00}
      :host([data-theme="light"]) ha-card{background:#f6f8f9;border-color:var(--line)}
      :host([data-theme="light"]) .nav,:host([data-theme="light"]) .shortcut{background:#e9eef0}
      :host([data-theme="light"]) .nav button.active{background:#fff;color:var(--ink);box-shadow:0 1px 4px #17272d18}
      :host([data-theme="light"]) .metric{background:linear-gradient(145deg,#fff,#f0f4f5)}
      :host([data-theme="light"]) .panel{background:#fff}
      :host([data-theme="light"]) .energy,:host([data-theme="light"]) .badge{background:#e6f2ea;border-color:#bed7c7}
      :host([data-theme="light"]) .energy-head span,:host([data-theme="light"]) .energy-head small,:host([data-theme="light"]) .energy p,:host([data-theme="light"]) .metric small,:host([data-theme="light"]) .mini-condition,:host([data-theme="light"]) .legend{color:var(--muted)}
      :host([data-theme="light"]) .badge.dim{color:#58666d;background:#e5eaed}
      :host([data-theme="light"]) .batterybar{background:#cbdcd1}
      :host([data-theme="light"]) .tripbtn.selected{background:#fff0df}
      :host([data-theme="light"]) .refresh,:host([data-theme="light"]) .page,:host([data-theme="light"]) select{background:#fff;border-color:var(--line)}
      :host([data-theme="light"]) .error{background:#fff0e0;color:#773e10;border-color:#d8a574}
      :host([data-theme="light"]) .map{background:#e6ebed}
      :host([data-theme="light"]) .map .leaflet-tile-pane{filter:none}
      :host([data-theme="light"]) .leaflet-bar a,:host([data-theme="light"]) .resetmap{background:#fff!important;color:#1b292f!important;border-color:#cbd5da!important}
      :host([data-theme="light"]) .pin{background:#72df9b}
      :host([data-theme="light"]) .pin.end{background:#ff8a18}
      :host([data-theme="light"]) .parking-chip-badge{background:#e8f0fe;color:#1a73e8;border-color:#bad3fb}
      :host([data-theme="light"]) .parking-chip-badge.driving{background:#e6f7ec;color:#187845;border-color:#a3e2b9}
    `;
    themeStyle.textContent+=`
      .hero{background:#777b80;color:#fff;min-height:280px;display:flex;flex-direction:column;border:0;min-width:0}
      .hero-copy{padding:16px 20px 0}.hero-copy h2{font-size:28px;margin:0;max-width:none}
      .hero .car-image{position:static;inset:auto;width:100%;max-width:100%;height:250px;object-fit:contain;object-position:center;display:block;min-width:0;flex-shrink:0;padding:12px}
      .badge.parked{background:#363b40;color:#e0e3e5}.badge.driving{background:#133960;color:#83bdff}.badge.charging{background:#173e29;color:#83e2a4}.badge.offline{background:#483c13;color:#ffe17b}
      .badge.stale,.badge.unknown,.badge.offline,.badge.connection_unknown{background:#49391e;color:#ffdc91}
      :host([data-theme="light"]) .badge.parked{background:#e4e7e9;color:#4b555b}:host([data-theme="light"]) .badge.driving{background:#e0edff;color:#1356a2}:host([data-theme="light"]) .badge.charging{background:#e2f2e7;color:#156332}:host([data-theme="light"]) .badge.offline{background:#fff1bd;color:#745400}
      :host([data-theme="light"]) .badge.stale,:host([data-theme="light"]) .badge.unknown,:host([data-theme="light"]) .badge.offline,:host([data-theme="light"]) .badge.connection_unknown{background:#fff1bd;color:#745400}
      .energy{background:linear-gradient(90deg,#28583c 0 var(--soc),#18221f var(--soc) 100%);min-height:110px;display:flex;align-items:center}.energy-head{width:100%}
      :host([data-theme="light"]) .energy{background:linear-gradient(90deg,#b8dec6 0 var(--soc),#e8eeeb var(--soc) 100%)}
      .nav{margin:0 16px 12px}.theme-control{justify-content:flex-end}
      @container(max-width:700px){.hero{min-height:190px}.hero-copy{padding:12px 16px 0}.hero-copy h2{font-size:24px}.hero .car-image{height:155px;width:100%;padding:5px 12px}.energy{min-height:95px}}
    `;
    themeStyle.textContent+=`
      .hero{background:#343b42;color:var(--ink);border:0}
      :host([data-theme="light"]) .hero{background:#f0f2f4}
      .energy,:host([data-theme="light"]) .energy{background:linear-gradient(90deg,#1260e8 0 var(--soc),#0c43ad var(--soc) 100%);color:#fff;border:0;min-height:115px}
      .energy-head .soc-value{display:flex;align-items:baseline;gap:8px;white-space:nowrap;flex-wrap:nowrap;font-size:48px;color:#fff}
      .energy-head .soc-value small,:host([data-theme="light"]) .energy-head .soc-value small{display:inline;font-size:24px;color:#fff}
      .battery-label{display:flex;align-items:center;gap:10px;min-width:0}.energy-head .battery-label span,:host([data-theme="light"]) .energy-head .battery-label span{font-size:24px;font-weight:650;color:#fff;word-break:keep-all}.battery-label ha-icon{width:48px;height:48px;color:#fff;flex-shrink:0}
      .quick-metrics .metric.charge-eta strong{font-size:20px;line-height:1.4}
      :host([data-theme="light"]) ha-card{background:#fff}
      :host([data-theme="light"]) .nav button.active{color:#1260e8}
      @container(max-width:700px){.energy{min-height:100px}.energy-head .soc-value{font-size:44px}.battery-label ha-icon{width:32px;height:32px}.battery-label{gap:6px}.energy-head .battery-label span,:host([data-theme="light"]) .energy-head .battery-label span{font-size:20px}.energy-head .soc-value{font-size:36px;gap:4px}.energy-head .soc-value small{font-size:20px}.quick-metrics .metric.charge-eta strong{font-size:17px}}
    `;
    themeStyle.textContent+=`
      .shortcut{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:1fr auto;padding:10px 10px 10px 14px;gap:12px;overflow:hidden;min-height:124px;align-items:stretch}
      .shortcut>span{grid-column:1;grid-row:1;display:flex;flex-direction:column;justify-content:flex-start;min-width:0;padding-top:2px}
      .shortcut>span b{font-size:15px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .shortcut>span small{font-size:11px;line-height:1.35;margin-top:4px;color:var(--muted)}
      .shortcut>em{grid-column:1;grid-row:2;padding:0;align-self:end;font-size:11.5px;font-weight:600;padding-bottom:2px}
      .mini-map{grid-column:2;grid-row:1/3;height:100%;width:100%;min-height:104px;max-width:none;max-height:none;aspect-ratio:auto;align-self:stretch;justify-self:stretch;border-radius:12px;overflow:hidden;pointer-events:none;background:#e5e9e7;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08)}
      .mini-map .leaflet-control-attribution{font-size:7px}
      :host([data-theme="dark"]) .mini-map{background:#20262b}
      :host([data-theme="dark"]) .mini-map .leaflet-tile-pane{filter:grayscale(1) invert(.91) hue-rotate(180deg) brightness(.8)}
      :host([data-theme="light"]) .mini-map .leaflet-tile-pane{filter:none}
      .overview-links{gap:12px}

      @container (min-width: 820px) {
        .cockpit.desktop-balanced-cockpit{display:grid;grid-template-columns:minmax(320px,1.05fr) minmax(380px,1.35fr);gap:16px 20px;align-items:stretch;margin-bottom:0}
        .overview-col-visual{display:flex;flex-direction:column;gap:14px;min-width:0;height:100%}
        .overview-col-visual .hero{flex:1;min-height:340px;display:flex;flex-direction:column;justify-content:space-between;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);background:#181d22;margin:0}
        :host([data-theme="light"]) .overview-col-visual .hero{background:#f0f3f5;border-color:var(--line)}
        .overview-col-visual .hero-copy{padding:22px 24px 0}
        .overview-col-visual .hero-copy h2{font-size:30px;letter-spacing:-0.5px;line-height:1.2}
        .overview-col-visual .hero .car-image{max-height:250px;width:100%;object-fit:contain;object-position:center;margin:auto 0;padding:12px 18px}
        .overview-col-visual .mini-condition{display:flex;justify-content:space-around;align-items:center;gap:10px;padding:14px 18px;margin-top:0;border-top:none;border-radius:16px;border:1px solid var(--line);background:#14171a;font-size:12.5px;color:#9ca3af}
        :host([data-theme="light"]) .overview-col-visual .mini-condition{background:#ffffff;border-color:var(--line);color:#5b686e}
        .overview-col-visual .mini-condition span b{font-weight:700;color:var(--ink);font-size:13.5px;margin-left:2px}
        .overview-col-telemetry{display:flex;flex-direction:column;gap:12px;min-width:0}
        .overview-col-telemetry .energy,.overview-col-telemetry .energy.is-charging{margin:0}
        .overview-col-telemetry .quick-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .overview-col-telemetry .overview-links{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:0}
        .overview-col-telemetry .shortcut{min-height:124px}
        .overview-col-telemetry .mini-map{min-height:104px}
      }

      @container (min-width: 520px) and (max-width: 819px) {
        .overview-links{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      }

      @container (max-width: 819px) {
        .cockpit.desktop-balanced-cockpit{display:flex;flex-direction:column;gap:12px}
        .overview-col-visual,.overview-col-telemetry{display:contents}
        .hero{order:1}
        .energy{order:2}
        .quick-metrics{order:3}
        .overview-links{order:4;margin-top:2px}
        .shortcut{padding:10px 10px 10px 14px;min-height:118px}
        .mini-map{min-height:98px}
        .mini-condition{order:5;margin-top:4px}
      }

      @container (max-width: 700px) {
        .overview-links{grid-template-columns:1fr}
        .shortcut{padding:10px 10px 10px 12px;min-height:116px}
        .mini-map{min-height:96px}
        .shortcut b{font-size:14px}
        .shortcut>em{font-size:11.5px}
        .shortcut small{font-size:11px}
      }
    `;
    themeStyle.textContent+=`
      :host([data-theme="light"]) .shortcut{background:#dceaff;border-color:#d4e4fc}
      :host([data-theme="dark"]) .shortcut{background:#203b5e;border-color:#284363}
      .shortcut b{font-size:15px;line-height:1.3}.shortcut small{font-size:11px;margin-top:4px}
      .shortcut em{color:#75baff}:host([data-theme="light"]) .shortcut em{color:#1260e8}
      .tiles .metric,:host([data-theme="light"]) .tiles .metric{background:rgba(18,96,232,.5);border-color:rgba(18,96,232,.3);color:var(--ink)}
      .tiles .metric .label,.tiles .metric small,.tiles .metric ha-icon,:host([data-theme="light"]) .tiles .metric small{color:var(--ink)}
      .tripbtn.selected,:host([data-theme="light"]) .tripbtn.selected{background:rgba(18,96,232,.05);border-left:3px solid #1260e880;color:#173958}
      :host([data-theme="dark"]) .tripbtn.selected{background:rgba(18,96,232,.18);color:#fff}
      .tripbtn.selected small{color:inherit}
      .pin,:host([data-theme="light"]) .pin{background:#79ceff80;color:#092b45;border-color:#e4f5ff}
      .pin.end,:host([data-theme="light"]) .pin.end{background:#1260e880;color:var(--ink);border-color:#d5e6ff}
      .parking-heading{background:rgba(18,96,232,.5);color:var(--ink)}.parking-heading .sub{color:inherit}
    `;
    themeStyle.textContent+=`
      :host([data-theme="light"]) .tiles .metric,
      :host([data-theme="light"]) .parking-heading,
      :host([data-theme="light"]) .tripbtn.selected{background:#dceaff;border-color:#d4e4fc;color:var(--ink)}
      :host([data-theme="dark"]) .tiles .metric,
      :host([data-theme="dark"]) .parking-heading,
      :host([data-theme="dark"]) .tripbtn.selected{background:#203b5e;border-color:#284363;color:var(--ink)}
    `;
    themeStyle.textContent+=`
.battery-history{background:var(--panel,#1d1d20);border:1px solid var(--line);border-radius:24px;padding:26px;margin-bottom:20px;color:var(--ink)}
:host([data-theme="light"]) .battery-history{background:#f3f5f8}.battery-history h2{margin:0;font-size:21px}.demo-note,.chart-key{font-size:11px;color:var(--muted)}.usage-total{padding:16px 0 24px;display:flex;flex-direction:column}.usage-total strong{font-size:46px}.usage-total span{font-size:17px;color:var(--muted)}.history-plot{position:relative;padding-right:45px}.week-bars,.hours{height:160px;display:flex;gap:12px;border-bottom:1px solid #8885;background:repeating-linear-gradient(to top,transparent 0,transparent calc(50% - 1px),#8884 calc(50% - 1px),#8884 50%)}.week-bars button{position:relative;flex:1;background:none;border:0;padding:0 10px;display:flex;align-items:flex-end}.week-bars i{display:block;width:100%;background:var(--bar);border-radius:7px 7px 0 0}.week-bars button[aria-pressed="true"]{color:var(--bar)}.week-bars button span{position:absolute;top:100%;left:0;right:0;text-align:center;padding-top:8px;font-size:14px}.week-bars small{display:block;font-size:10px}.axis{position:absolute;right:0;top:0;bottom:0;display:flex;flex-direction:column;justify-content:space-between;font-size:11px;color:var(--muted)}.history-plot+.chart-key{margin-top:48px}.battery-history h3{font-size:14px;margin-top:28px}.hours{gap:4px;height:160px}.hour{position:relative;flex:1;display:flex;align-items:flex-end}.hour i{width:100%;background:#77777f;border-radius:3px 3px 0 0}.hour.parked i{opacity:.4}.hour.charging{background:#54ce6530;border-top:4px solid #5ad46d}.hour.charging i{background:#5ad46d}.hour em{position:absolute;top:-22px;width:100%;text-align:center;color:#5ad46d;font-size:24px}.hours-label{display:flex;justify-content:space-between;padding-right:45px;font-size:11px;color:var(--muted);margin-top:8px}.usage-stats{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line);margin-top:20px;padding-top:18px;color:var(--muted);font-size:13px}.usage-stats strong{display:block;font-size:25px;color:var(--ink);margin-top:8px}@container(max-width:700px){.battery-history{padding:18px}.week-bars{gap:4px}.week-bars button{padding:0 4px}.usage-stats strong{font-size:22px}.hours{gap:2px}}
    `;
    themeStyle.textContent+=`
      .energy{position:relative;overflow:visible;margin:12px 0 16px}
      .energy.is-charging{margin:32px 0 40px !important}
      @container(max-width:700px){.energy.is-charging{margin:30px 0 38px !important}}
      .energy.is-charging,:host([data-theme="light"]) .energy.is-charging{background:linear-gradient(90deg,#198346 0 var(--soc),#11562f var(--soc) 100%)}
      .energy.is-low,:host([data-theme="light"]) .energy.is-low,
      .energy.soc-low,:host([data-theme="light"]) .energy.soc-low{background:linear-gradient(90deg,#e5a50a 0 var(--soc),#5c3809 var(--soc) 100%)}
      .energy.is-critical,:host([data-theme="light"]) .energy.is-critical,
      .energy.soc-critical,:host([data-theme="light"]) .energy.soc-critical{background:linear-gradient(90deg,#dc2626 0 var(--soc),#6b1414 var(--soc) 100%)}
      .energy.is-low .battery-head-icon,.energy.soc-low .battery-head-icon,
      .energy.is-critical .battery-head-icon,.energy.soc-critical .battery-head-icon{filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))}
      .sweep-overlay{position:absolute;inset:0;border-radius:18px;overflow:hidden;pointer-events:none;z-index:2}
      .sweep-clipper{position:absolute;top:0;left:0;bottom:0;width:var(--soc);overflow:hidden}
      .sweep-beam{position:absolute;top:0;left:-60%;width:60%;height:100%;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.08) 30%,rgba(255,255,255,0.45) 50%,rgba(255,255,255,0.08) 70%,transparent 100%);filter:blur(1px);animation:chargeSweep 2.2s cubic-bezier(0.4,0,0.2,1) infinite}
      .sweep-beam.fast{animation:chargeSweep 2.2s cubic-bezier(0.4,0,0.2,1) infinite !important}
      .sweep-beam.slow{animation:chargeSweep 4.4s cubic-bezier(0.4,0,0.2,1) infinite !important}
      .sweep-beam.driving,.energy.is-driving .sweep-beam{width:60%!important;height:100%!important;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.1) 20%,rgba(255,255,255,0.75) 50%,rgba(255,255,255,0.1) 80%,transparent 100%)!important;filter:blur(1px)!important;animation:driveSweep 2.2s cubic-bezier(0.4,0,0.2,1) infinite!important}
      @keyframes chargeSweep{0%{left:-60%;opacity:0.15}20%{opacity:1}80%{opacity:1}100%{left:100%;opacity:0.1}}
      @keyframes driveSweep{0%{left:100%;opacity:0.1}15%{opacity:1}85%{opacity:1}100%{left:-60%;opacity:0.1}}
      .charge-marker{position:absolute;top:-6px;bottom:-6px;width:2px;background:rgba(255,255,255,0.9);box-shadow:0 0 5px rgba(255,255,255,0.4);z-index:4;pointer-events:none;border-radius:999px}
      .charge-marker.marker-80{left:80%;transform:translateX(-50%)}
      .charge-marker.marker-100{left:100%;transform:translateX(-100%)}
      .charge-marker::before{content:attr(data-top);position:absolute;bottom:100%;right:5px;left:auto;transform:none;margin-bottom:2px;font-size:11px;font-weight:700;letter-spacing:-0.3px;color:#4ade80;text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;text-align:right}
      .charge-marker::after{content:attr(data-bottom);position:absolute;top:100%;right:4px;left:auto;transform:none;margin-top:3px;font-size:10px;font-weight:600;letter-spacing:-0.2px;color:#f8fafc;background:rgba(15,23,42,0.92);backdrop-filter:blur(4px);padding:1.5px 7px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.35)}
      :host([data-theme="light"]) .charge-marker::before{color:#156332;text-shadow:none}
      :host([data-theme="light"]) .charge-marker::after{color:#1e293b;background:rgba(255,255,255,0.95);border-color:rgba(0,0,0,0.12);box-shadow:0 2px 6px rgba(0,0,0,0.08)}
      .marker-cap{position:absolute;left:50%;transform:translateX(-50%);width:4px;height:4px;padding:0 !important;margin:0 !important;box-sizing:border-box !important;border-radius:50%;background:#fff;box-shadow:0 0 3px rgba(74,222,128,0.7)}
      .marker-cap.cap-top{top:-2px}
      .marker-cap.cap-bottom{bottom:-2px}
      .energy-head{position:relative;z-index:5}
      .energy-head.charging-left{display:flex;align-items:center;justify-content:flex-start;position:relative;z-index:5}
      .energy-head.charging-left .charge-info-stack{display:flex;flex-direction:column;gap:1px}
      .energy-head.charging-left .charge-status-label{font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,0.95);letter-spacing:0.3px;text-shadow:0 1px 2px rgba(0,0,0,0.35)}
      :host([data-theme="light"]) .energy-head.charging-left .charge-status-label{color:#ffffff}
      .energy-head .soc-value,.energy-head.charging-left .soc-value{font-family:Inter,Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;display:flex;align-items:baseline;gap:4px;font-size:48px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1px}
      .energy-head .soc-value small,.energy-head.charging-left .soc-value small{font-family:Inter,Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;font-size:24px;font-weight:700;color:#fff;letter-spacing:normal}
      .energy-head .battery-label{display:flex;align-items:center;gap:10px}
      .energy-head .battery-label span,:host([data-theme="light"]) .energy-head .battery-label span{font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px}
      .battery-head-icon{width:26px;height:26px;fill:#ffffff !important;flex-shrink:0;opacity:0.95;filter:drop-shadow(0 0 4px rgba(255,255,255,0.4))}
      :host([data-theme="light"]) .battery-head-icon{fill:#ffffff !important}
      .charge-head-bolt{width:26px;height:34px;fill:#4ade80 !important;flex-shrink:0;margin-right:8px;filter:drop-shadow(0 0 6px rgba(74,222,128,0.6))}
      :host([data-theme="light"]) .charge-head-bolt{fill:#4ade80 !important}
      @container(max-width:700px){
        .energy-head .soc-value,.energy-head.charging-left .soc-value{font-size:38px !important}
        .energy-head .soc-value small,.energy-head.charging-left .soc-value small{font-size:20px !important}
        .energy-head .battery-label span{font-size:18px !important}
        .battery-head-icon{width:22px;height:22px}
        .charge-head-bolt{width:22px;height:30px;margin-right:6px}
        .quick-metrics .metric:nth-child(n+3){display:block !important}
      }
      .quick-metrics .metric.charge-power strong{color:#4ade80 !important}
      :host([data-theme="light"]) .quick-metrics .metric.charge-power strong{color:#16a34a !important}
      .charge-head-main{display:flex;align-items:center;gap:12px}
      .charge-status-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px}
      .charge-power-tag{display:inline-flex;align-items:center;font-family:Inter,Pretendard,sans-serif;font-size:12px;font-weight:750;padding:2px 8px;border-radius:6px;background:rgba(0,0,0,0.35);color:#ffffff !important;border:1px solid rgba(255,255,255,0.22)}
      :host([data-theme="light"]) .charge-power-tag{background:rgba(0,0,0,0.35) !important;color:#ffffff !important;border-color:rgba(255,255,255,0.22) !important}
      .range-sub-c3{display:flex !important;align-items:center !important;gap:4px !important;margin-top:4px !important;font-size:12px !important;color:#ffffff !important;font-weight:550 !important;letter-spacing:-0.2px !important}
      .range-sub-c3 span,.range-sub-c3 b,:host([data-theme="light"]) .energy-head .range-sub-c3,:host([data-theme="light"]) .energy-head .range-sub-c3 span,:host([data-theme="light"]) .energy-head .range-sub-c3 b{color:#ffffff !important}
      .range-sub-c3 b{font-weight:750 !important}
      .soc-stack-c3{display:flex !important;flex-direction:column !important;align-items:flex-end !important}
      .quick-metrics .metric.charge-eta{display:flex;flex-direction:column;justify-content:space-between;min-width:0}
      .quick-metrics .metric.charge-eta strong{font-size:21px;font-weight:750;letter-spacing:-0.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .quick-metrics .metric.charge-eta .hint{font-size:11px;font-weight:550;color:#94a3b8;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      :host([data-theme="light"]) .quick-metrics .metric.charge-eta .hint{color:#64748b}
      .quick-metrics .metric.lock-metric{display:flex !important;flex-direction:column !important;justify-content:space-between !important;position:relative !important;overflow:hidden !important;border-radius:16px;min-width:0;transition:all 0.25s ease !important;cursor:default !important}
      .quick-metrics .metric.lock-metric ha-icon{display:inline-flex !important;width:18px !important;height:18px !important;--mdc-icon-size:18px !important}
      .quick-metrics .metric.lock-metric .label{font-size:11.5px !important;color:var(--muted) !important;margin-bottom:2px !important;display:block !important}
      .quick-metrics .metric.lock-metric .lock-val-row{display:flex !important;align-items:center !important;gap:9px !important;margin:2px 0 6px !important}
      .quick-metrics .metric.lock-metric .lock-icon-badge{width:32px !important;height:32px !important;border-radius:50% !important;display:flex !important;align-items:center !important;justify-content:center !important;flex-shrink:0 !important;margin:0 !important;padding:0 !important;line-height:0 !important;box-sizing:border-box !important;transition:all 0.2s ease !important}
      .quick-metrics .metric.lock-metric .lock-icon-badge ha-icon{display:flex !important;align-items:center !important;justify-content:center !important;width:18px !important;height:18px !important;--mdc-icon-size:18px !important;margin:0 !important;padding:0 !important;line-height:0 !important;transform:translateY(0.75px) !important}
      .quick-metrics .metric.lock-metric .lock-icon-badge ha-icon svg,.quick-metrics .metric.lock-metric .lock-icon-badge svg{display:block !important;width:18px !important;height:18px !important;margin:0 auto !important;padding:0 !important}
      .quick-metrics .metric.lock-metric .lock-val{font-size:22px !important;font-weight:800 !important;letter-spacing:-0.4px !important;line-height:1.2 !important;display:inline-block !important;margin:0 !important}
      .quick-metrics .metric.lock-metric .hint{font-size:11px !important;font-weight:550 !important;margin-top:4px !important;line-height:1.3 !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important}
      .metric.lock-metric.is-locked .lock-icon-badge{background:rgba(255,255,255,0.08) !important;color:var(--ink,#ffffff) !important;border:1px solid rgba(255,255,255,0.12) !important}
      :host([data-theme="light"]) .metric.lock-metric.is-locked .lock-icon-badge{background:rgba(0,0,0,0.06) !important;color:#0f172a !important;border:1px solid rgba(0,0,0,0.08) !important}
      .metric.lock-metric.is-locked .lock-val,.metric.lock-metric.is-locked .locked-text{color:var(--ink,#ffffff) !important}
      :host([data-theme="light"]) .metric.lock-metric.is-locked .lock-val,:host([data-theme="light"]) .metric.lock-metric.is-locked .locked-text{color:#0f172a !important}
      .metric.lock-metric.is-locked .hint{color:var(--muted) !important}
      .metric.lock-metric.mode-charging.is-unlocked .lock-icon-badge{background:rgba(16,185,129,0.16) !important;color:#34d399 !important;border:1px solid rgba(52,211,153,0.35) !important}
      :host([data-theme="light"]) .metric.lock-metric.mode-charging.is-unlocked .lock-icon-badge{background:#dcfce7 !important;color:#15803d !important;border:1px solid rgba(22,163,74,0.35) !important}
      .metric.lock-metric.mode-charging.is-unlocked .lock-val,.metric.lock-metric.mode-charging.is-unlocked .unlocked-text{color:#34d399 !important}
      :host([data-theme="light"]) .metric.lock-metric.mode-charging.is-unlocked .lock-val,:host([data-theme="light"]) .metric.lock-metric.mode-charging.is-unlocked .unlocked-text{color:#15803d !important}
      .metric.lock-metric.mode-charging.is-unlocked .hint{color:#34d399 !important}
      :host([data-theme="light"]) .metric.lock-metric.mode-charging.is-unlocked .hint{color:#15803d !important}
      .metric.lock-metric.mode-parked.is-unlocked .lock-icon-badge{background:rgba(56,189,248,0.16) !important;color:#38bdf8 !important;border:1px solid rgba(56,189,248,0.35) !important}
      :host([data-theme="light"]) .metric.lock-metric.mode-parked.is-unlocked .lock-icon-badge{background:#e0f2fe !important;color:#0284c7 !important;border:1px solid rgba(2,132,199,0.35) !important}
      .metric.lock-metric.mode-parked.is-unlocked .lock-val,.metric.lock-metric.mode-parked.is-unlocked .unlocked-text{color:#38bdf8 !important}
      :host([data-theme="light"]) .metric.lock-metric.mode-parked.is-unlocked .lock-val,:host([data-theme="light"]) .metric.lock-metric.mode-parked.is-unlocked .unlocked-text{color:#0284c7 !important}
      .metric.lock-metric.mode-parked.is-unlocked .hint{color:#38bdf8 !important}
      :host([data-theme="light"]) .metric.lock-metric.mode-parked.is-unlocked .hint{color:#0284c7 !important}
    `;
    themeStyle.textContent+=`.battery-history{padding:20px;margin-bottom:16px}.usage-total{padding:8px 0 14px}.usage-total strong{font-size:36px}.usage-total span{font-size:14px}.week-bars{height:110px}.week-bars button{justify-content:center}.week-bars i{max-width:42px}.hours{height:110px}.battery-history h3{margin-top:16px}.usage-stats{margin-top:12px;padding-top:12px}.usage-stats strong{font-size:22px}.chart-key{margin-bottom:10px}
`;
    themeStyle.textContent+=`.hour.driving i{background:#bbc7d8;opacity:1}.hour.parked i{background:linear-gradient(180deg,#8e8e93,#c7c7cc);opacity:1}.hour.charging i{background:#5ad46d;opacity:1}`;
    themeStyle.textContent+=`.usage-total strong{display:flex;align-items:baseline;gap:10px;white-space:nowrap}.usage-total .usage-caption{font-size:.55em;font-weight:600;color:inherit}.week-bars i{border-radius:10px 10px 3px 3px}.hour i{border-radius:7px 7px 2px 2px}.hour.charging{border-top:0;border-radius:7px 7px 0 0}.hour.charging:before{content:"";position:absolute;top:0;left:0;right:0;height:5px;background:#5ad46d;border-radius:999px}.hour em{top:-18px;left:50%;width:30px;height:38px;transform:translateX(-50%);z-index:2;line-height:0;pointer-events:none}.hour em svg{display:block;width:100%;height:100%}@container(max-width:700px){.hour em{width:22px;height:29px;top:-14px}}`;
    themeStyle.textContent+=`.hour.last-known i{background:linear-gradient(180deg,#8e8e93,#c7c7cc);opacity:1}.hour.charging{background:rgba(90,212,109,.18)}.hour.charging i{background:#5ad46d;opacity:1}`;
    themeStyle.textContent+=`
.battery-history{--park-base:#49525e;--park-stripe:#5d6876;--bolt-outline:#17201b}
:host([data-theme="light"]) .battery-history{--park-base:#ced4dc;--park-stripe:#b7c0cd;--bolt-outline:#fff}
.hour.driving i{background:linear-gradient(180deg,#378bdd,#73b8ea);opacity:1}
.hour.parked i,.hour.last-known i{background:linear-gradient(180deg,#8e8e93,#c7c7cc);opacity:1}
.hour.soc-low i{background:linear-gradient(180deg,#f28b32,#ffc46b)}
.hour.soc-critical i{background:linear-gradient(180deg,#ed4c53,#ff9092)}
.hour.parked.soc-low i,.hour.last-known.soc-low i{background:linear-gradient(180deg,#f28b32,#ffc46b)}
.hour.parked.soc-critical i,.hour.last-known.soc-critical i{background:linear-gradient(180deg,#ed4c53,#ff9092)}
.hour.charging i{background:linear-gradient(180deg,#2acb58,#7ce88d);opacity:1}
.hour.parked i,.hour.last-known i{background:linear-gradient(180deg,#8e8e93,#c7c7cc)}
.hour em{width:23px;height:29px;top:-13px}
@container(max-width:700px){.hour em{width:19px;height:24px;top:-11px}}
.week-bars button[aria-pressed="true"] i{background:linear-gradient(180deg,var(--bar),var(--bar-end))}
.chart-key .driving-key{color:#378bdd}.chart-key .parking-key{color:var(--muted)}
/* Merge adjacent charging backgrounds into one green band; bars, gaps and bolt icon stay unchanged */
.hours .charge-run-wrap{--wrap-gap:4px;position:relative;display:flex;flex:var(--span) calc((var(--span) - 1)*var(--wrap-gap));gap:var(--wrap-gap);min-width:0;background:rgba(90,212,109,.18);border-radius:7px 7px 0 0}
.hours .charge-run-wrap .hour{flex:1;min-width:0;height:100%;background:transparent}
.hours .charge-run-wrap .hour.charging:before{display:none}
.hours .charge-run-wrap:before{content:"";position:absolute;top:0;left:0;right:0;height:5px;background:#5ad46d;border-radius:999px;pointer-events:none}
.hours .charge-run-wrap>em{position:absolute;top:-13px;left:50%;transform:translateX(-50%);width:23px;height:29px;z-index:2;line-height:0;pointer-events:none}
.hours .charge-run-wrap>em svg{display:block;width:100%;height:100%}
@container(max-width:700px){.hours .charge-run-wrap{--wrap-gap:2px}}
@container(max-width:700px){.hours .charge-run-wrap>em{width:19px;height:24px;top:-11px}}

.status-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:16px}
.status-group{display:flex;flex-direction:column}
.status-group .paneltitle{padding:14px 18px;border-bottom:1px solid var(--line)}
.status-group .paneltitle h2{display:flex;align-items:center;gap:8px;font-size:15px;margin:0;font-weight:650}
.status-group .paneltitle h2 ha-icon{--mdc-icon-size:20px;--iron-icon-width:20px;--iron-icon-height:20px;width:20px;height:20px;color:#1260e8;display:flex;align-items:center;justify-content:center}
:host([data-theme="dark"]) .status-group .paneltitle h2 ha-icon{color:#60a5fa}
.status-list{padding:4px 18px 8px;flex:1}
.status-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}
.status-row:last-child{border-bottom:none}
.status-label-wrap{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
.status-icon{display:grid;place-items:center;width:32px;height:32px;min-width:32px;border-radius:50%;background:#edf4fe;color:#1260e8;flex-shrink:0}
:host([data-theme="dark"]) .status-icon{background:#162235;color:#60a5fa}
.status-icon ha-icon{--mdc-icon-size:18px;--iron-icon-width:18px;--iron-icon-height:18px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:inherit}
.status-label{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4}
.status-val{font-size:13px;font-weight:650;color:var(--ink);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.status-val small{font-size:11px;font-weight:normal;color:var(--muted);margin-left:3px}
.status-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:-0.2px;line-height:14px;white-space:nowrap}
.status-badge.on{background:rgba(114,223,155,.18);color:var(--green)}
:host([data-theme="light"]) .status-badge.on{background:#e6f9ee;color:#187845}
.status-badge.off{background:rgba(149,155,158,.18);color:var(--muted)}
:host([data-theme="light"]) .status-badge.off{background:#eef1f3;color:#5b686e}
.status-badge.dim{background:rgba(149,155,158,.1);color:var(--muted)}

.raw-data-card{margin-top:16px;border-radius:18px}
.raw-data-card summary{padding:14px 18px;cursor:pointer;user-select:none;list-style:none;font-size:13px;font-weight:600;color:var(--ink)}
.raw-data-card summary::-webkit-details-marker{display:none}
.raw-data-card[open] summary{border-bottom:1px solid var(--line)}
.raw-summary-content{display:flex;align-items:center;justify-content:space-between;width:100%;gap:10px}
.raw-summary-title{display:flex;align-items:center;gap:8px}
.raw-summary-title ha-icon{--mdc-icon-size:18px;--iron-icon-width:18px;--iron-icon-height:18px;width:18px;height:18px;color:var(--muted);display:flex;align-items:center;justify-content:center}
.raw-toggle-hint{font-size:11px;font-weight:normal;color:var(--muted)}
.raw-content{padding:14px 18px 18px}
.raw-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.raw-count{font-size:11px;color:var(--muted)}
.copy-raw-btn{display:inline-flex;align-items:center;gap:6px;background:#202528;border:1px solid #343a3e;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:var(--ink);cursor:pointer;transition:all .15s}
.copy-raw-btn:hover{background:#2b3237;border-color:#485157}
.copy-raw-btn.copied{background:rgba(114,223,155,.2);border-color:var(--green);color:var(--green)}
:host([data-theme="light"]) .copy-raw-btn{background:#fff;border-color:var(--line);color:var(--ink)}
:host([data-theme="light"]) .copy-raw-btn:hover{background:#f0f3f5}
:host([data-theme="light"]) .copy-raw-btn.copied{background:#e6f9ee;border-color:#187845;color:#187845}
.copy-raw-btn ha-icon{--mdc-icon-size:15px;--iron-icon-width:15px;--iron-icon-height:15px;width:15px;height:15px;display:flex;align-items:center;justify-content:center}
.raw-content pre{margin:0;max-height:360px;overflow:auto;background:rgba(0,0,0,.28);border-radius:10px;padding:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;line-height:1.55;color:#c9d1d9}
:host([data-theme="light"]) .raw-content pre{background:#f4f6f8;color:#24292f}
@container(max-width:700px){.status-groups{grid-template-columns:1fr;gap:12px}.raw-content{padding:12px 14px 14px}}
`;
    this.shadowRoot.append(themeStyle);
    this.shadowRoot.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{
      const idx=Number(b.dataset.day);
      this.batteryDay=idx;
      const bDate=b.dataset.date||this.v?.battery_history?.[idx]?.date;
      if(bDate)this.chargeDay=bDate;
      this.render();
    });

    const themeControl=document.createElement('label');themeControl.className='theme-control';
    themeControl.innerHTML='화면 테마 <select aria-label="화면 테마"><option value="auto">자동 · HA 테마</option><option value="light">라이트</option><option value="dark">다크</option></select>';
    const select=themeControl.querySelector('select');select.value=this.themeMode||'auto';
    select.onchange=()=>{this.themeMode=select.value;try{localStorage.setItem('carrot-theme-'+(this.config?.device_id||'default'),this.themeMode);}catch{}this.applyTheme();};
    this.shadowRoot.querySelector('main').append(themeControl);
    this.shadowRoot.querySelector('.refresh').onclick=()=>this.load();
    this.shadowRoot.querySelectorAll('[data-trip-day]').forEach(b=>b.onclick=()=>{this.tripDay=b.dataset.tripDay;this.selected=null;this.render();});
    this.shadowRoot.querySelectorAll('[data-charge-day]').forEach(b=>b.onclick=()=>{
      this.chargeDay=b.dataset.chargeDay;
      const bDays=this.v?.battery_history;
      if(Array.isArray(bDays)){
        const bIdx=bDays.findIndex(x=>x.date===this.chargeDay);
        if(bIdx!==-1)this.batteryDay=bIdx;
      }
      this.render();
    });
    this.shadowRoot.querySelectorAll('[data-trip]').forEach(b=>b.onclick=()=>{const clicked=Number(b.dataset.trip);this.selected=this.selected===clicked?null:clicked;this.tab='trips';this.render();});
    this.shadowRoot.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{this.offset=Math.max(0,this.offset+Number(b.dataset.page)*20);this.selected=null;this.load();});
    const copyBtn=this.shadowRoot.querySelector('.copy-raw-btn');
    if(copyBtn)copyBtn.onclick=async(e)=>{
      e.preventDefault();e.stopPropagation();
      const raw=JSON.stringify(v,null,2);
      try{
        if(navigator.clipboard&&window.isSecureContext){
          await navigator.clipboard.writeText(raw);
        }else{
          const ta=document.createElement('textarea');
          ta.value=raw;ta.style.position='fixed';ta.style.opacity='0';
          document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
        }
        copyBtn.classList.add('copied');
        copyBtn.innerHTML=`${icon('check')} <span>복사 완료!</span>`;
        setTimeout(()=>{if(copyBtn.isConnected){copyBtn.classList.remove('copied');copyBtn.innerHTML=`${icon('content-copy')} <span>모두 복사</span>`;}},2000);
      }catch(err){
        copyBtn.innerHTML=`${icon('alert-circle-outline')} <span>복사 실패</span>`;
        setTimeout(()=>{if(copyBtn.isConnected){copyBtn.classList.remove('copied');copyBtn.innerHTML=`${icon('content-copy')} <span>모두 복사</span>`;}},2000);
      }
    };
    if(this.tab==='overview')this.drawMiniMaps(v).catch(()=>{this.shadowRoot.querySelectorAll('.mini-map').forEach(node=>{node.textContent='지도를 불러오지 못했습니다';});});
    if (typeof window !== 'undefined' && window.ResizeObserver) {
      if (!this._mapResizeObserver) {
        this._mapResizeObserver = new ResizeObserver(() => {
          if (this.miniMaps && this.miniMaps.length) {
            this.miniMaps.forEach(m => {
              try { m.invalidateSize(); } catch (e) {}
            });
          }
        });
      }
      this.shadowRoot?.querySelectorAll('.mini-map').forEach(el => {
        this._mapResizeObserver.observe(el);
      });
    }
    if(this.shadowRoot.querySelector('.map')){
      const dayObj=isTrip?tripDays(this.trips,this._hass?.config?.time_zone).find(d=>d.key===this.tripDay):null;
      const dayTrips=(dayObj?.indices||[]).map(i=>this.trips[i]?.data).filter(Boolean);
      this.drawMap(isSpecificTrip?route:[],v,(!isSpecificTrip&&isTrip)?dayTrips:[]);
    }
  }
  body(v,trip,isTrip){
    if(this.tab==='overview')return this.overview(v);
    if(this.tab==='parking'){
      const isDriving=this.vehicleStatus(v).key==='driving';
      const parkDur=parkingDuration(v.parking_at);
      let auxStatus='정상 · 방전 위험 없음';
      if(typeof v.aux_voltage==='number'){
        if(v.aux_voltage<12.0)auxStatus='주의 · 저전압 경고';
        else if(v.aux_voltage<12.4)auxStatus='보통 · 전압 안정';
      }
      const tiles=`
        ${metric('배터리 잔량',n(v.soc_percent,0),'%','battery',`${n(v.battery_kwh,1)} kWh 저장`)}
        ${metric('총 주행거리',n(v.odometer_km,0),'km','counter','계기판 누적거리')}
        ${isDriving?metric('현재 속도',n(v.wheel_speed_kph??v.speed_kph,0),'km/h','speedometer','실시간 계기판 속도'):metric('12V 배터리',n(v.aux_voltage,1),'V','car-battery',auxStatus)}
        ${metric('외부 온도',n(v.outside_temp_c,1),'°C','thermometer','차량 주변 기온')}
      `;
      const lat=isDriving?(v.latitude??v.parking_latitude):v.parking_latitude;
      const lng=isDriving?(v.longitude??v.parking_longitude):v.parking_longitude;
      const timeStr=isDriving?`실시간 수신 ${time(v.measured_at, this._hass?.config?.time_zone)}`:`주차 기록 ${time(v.parking_at, this._hass?.config?.time_zone)}`;
      const chipHtml=isDriving
        ?`<span class="parking-chip-badge driving"><i class="dot pulse"></i>주행 중 (실시간)</span>`
        :`<span class="parking-chip-badge"><i class="dot"></i>주차중${parkDur&&parkDur!=='—'?` · ${esc(parkDur)} 경과`:''}</span>`;
      const captionSub=isDriving
        ?'현재 주행 중인 차량 위치입니다 · 운행이 종료되면 새로운 주차 위치로 자동 기록됩니다'
        :'마지막으로 기록된 주차 위치';
      return `<section class="panel"><div class="paneltitle parking-heading"><div class="parking-heading-wrap"><div class="parking-heading-left"><h2>${isDriving?'차량 위치':'주차 위치'}</h2>${chipHtml}</div><span class="sub">${timeStr}</span></div></div><div class="map"></div><div class="route-caption"><b>${lat==null?'위치 정보 대기 중':`${n(lat,5)}, ${n(lng,5)}`}</b><p class="sub">${captionSub}</p></div></section><div class="tiles parking-tiles">${tiles}</div>`;
    }
    if(this.tab==='vehicle')return this.vehicleStatusView(v);
    if(this.tab==='charge'){
      let slowKwh = v.month_slow_kwh;
      let fastKwh = v.month_fast_kwh;
      let totalKwh = v.month_charge_kwh;
      const costKrw = v.month_charge_cost ?? 0;
      if (slowKwh == null || fastKwh == null) {
        let sSum = 0, fSum = 0, hasCharges = false;
        const now = new Date();
        const curY = now.getFullYear(), curM = now.getMonth();
        for (const e of (this.charges || [])) {
          const ed = e?.data || e || {};
          if (!ed.started_at || ed.energy_kwh == null) continue;
          const d = new Date(ed.started_at);
          if (d.getFullYear() === curY && d.getMonth() === curM) {
            hasCharges = true;
            const fast = Boolean(ed.duration_s && (ed.energy_kwh / (ed.duration_s / 3600) > 11));
            if (fast) fSum += ed.energy_kwh;
            else sSum += ed.energy_kwh;
          }
        }
        if (slowKwh == null) slowKwh = hasCharges ? Math.round(sSum * 10) / 10 : 0.0;
        if (fastKwh == null) fastKwh = hasCharges ? Math.round(fSum * 10) / 10 : 0.0;
        if (totalKwh == null) totalKwh = hasCharges ? Math.round((sSum + fSum) * 10) / 10 : 0.0;
      }
      return `<div class="charge-layout">${this.batteryHistory()}<div class="charge-sidebar"><div class="tiles charge-sidebar-tiles">${metric('이번 달 충전량',n(totalKwh),'kWh','battery-plus')}${metric('이번 달 충전 요금',n(costKrw,0),'원','cash','(추정)')}${metric('완속 분류',n(slowKwh),'kWh','power-plug')}${metric('급속 분류',n(fastKwh),'kWh','flash')}</div>${this.chargeHistory()}</div></div><p class="notice">배터리 에너지 증가로 추정합니다. 11kW 이하를 완속으로 분류하며, 요금 ${n(costKrw,0)}원은 기본 단가 기준 추정입니다. 차량이 잠들거나 콤마 전원이 꺼지면 측정할 수 없습니다.</p>`;
    }
    const isSpecificTrip=isTrip&&this.selected!==null&&Boolean(this.trips[this.selected]);
    const curTrip=isSpecificTrip?(this.trips[this.selected]?.data||{}):{};
    const days=isTrip?tripDays(this.trips,this._hass?.config?.time_zone):[];
    const curDayObj=isTrip?days.find(d=>d.key===this.tripDay):null;
    const dayIndices=curDayObj?.indices||[];
    const dayTrips=dayIndices.map(i=>this.trips[i]?.data).filter(Boolean);

    let tiles='';
    if(isTrip){
      if(isSpecificTrip){
        const distVal=curTrip.distance_m!=null?n(curTrip.distance_m/1000,2):'—';
        const durVal=curTrip.duration_s!=null?duration(curTrip.duration_s):'—';
        const effVal=curTrip.efficiency_km_kwh!=null?n(curTrip.efficiency_km_kwh,1):'—';
        const spdVal=curTrip.route?.length?n(this.maxSpeed(curTrip.route),0):'—';
        tiles=`${metric('주행거리',distVal,'km','map-marker-distance')}`+
              `${metric('주행시간',durVal,'','timer-outline')}`+
              `${metric('전비',effVal,'km/kWh','leaf')}`+
              `${metric('최고속도',spdVal,'km/h','speedometer')}`;
      }else{
        const totalDistM=dayTrips.reduce((acc,t)=>acc+(t.distance_m||0),0);
        const totalDurS=dayTrips.reduce((acc,t)=>acc+(t.duration_s||0),0);
        let distWithEnergyM=0,energyWhSum=0;
        for(const t of dayTrips){
          if(t.energy_wh&&t.energy_wh>0&&t.distance_m){
            energyWhSum+=t.energy_wh;
            distWithEnergyM+=t.distance_m;
          }
        }
        const dayAvgEff=energyWhSum>0&&distWithEnergyM>0?(distWithEnergyM/1000)/(energyWhSum/1000):null;
        const dayAvgSpeed=totalDurS>0&&totalDistM>0?(totalDistM/totalDurS)*3.6:null;

        const distVal=dayTrips.length?n(totalDistM/1000,2):'—';
        const durVal=dayTrips.length?duration(totalDurS):'—';
        const effVal=dayAvgEff!=null?n(dayAvgEff,1):'—';
        const spdVal=dayAvgSpeed!=null?n(dayAvgSpeed,0):'—';

        tiles=`${metric('주행거리',distVal,'km','map-marker-distance')}`+
              `${metric('주행시간',durVal,'','timer-outline')}`+
              `${metric('평균전비',effVal,'km/kWh','leaf')}`+
              `${metric('평균속도',spdVal,'km/h','speedometer-medium')}`;
      }
    }else{
      tiles=`${metric('배터리 잔량',n(v.soc_percent,0),'%','battery',`${n(v.battery_kwh)} / ${n(v.soc_capacity_kwh)} kWh`)}${metric('총 주행거리',n(v.odometer_km,0),'km','counter',v.stale?'마지막 측정값':'차량 계기판')}${metric('이번 달 주행거리',n(v.month_distance_km),'km','routes',`${n(v.month_trip_count,0)}회 주행`)}${metric('충전 전력 (추정)',n(v.charge_power_kw??(v.charge_power_w==null?null:v.charge_power_w/1000)),'kW','ev-station',v.charging?'충전 증가 감지':'관측값 기준')}`;
    }

    const panelTitle=isTrip
      ?(isSpecificTrip?'주행 상세':(this.tripDay?`${this.tripDay} 주행 요약`:'주행 요약'))
      :'주차 위치';
    const panelTime=isTrip
      ?(isSpecificTrip?time(curTrip.started_at):(dayTrips.length?`총 ${dayTrips.length}회 주행`:'기록 없음'))
      :time(v.parking_at);

    const routeCaption=isTrip
      ?(isSpecificTrip
          ?`<div class="legend"><span>저속 · 0 km/h</span><i class="gradient"></i><span>고속 · ${n(this.maxSpeed(curTrip.route),0)} km/h</span></div><div class="sub">${time(curTrip.started_at)} → ${time(curTrip.ended_at)}<br>${(curTrip.route||[]).length}개 경로 좌표 · 출발 하늘색 / 도착 파랑</div>`
          :`<div class="sub">${dayTrips.length?'선택된 날짜의 전체 주행 경로입니다 · 이날 출발(하늘색) / 이날 도착(파랑) · 우측 목록에서 개별 주행을 선택하면 상세 정보가 표시됩니다':'해당 날짜에 기록된 주행이 없습니다'}</div>`
        )
      :`<b>${v.parking_latitude!=null?`${n(v.parking_latitude,5)}, ${n(v.parking_longitude,5)}`:'위치 정보 대기 중'}</b><div class="sub">최근 주차 또는 마지막 주행 도착 위치</div>`;

    return `<div class="tiles">${tiles}</div><div class="layout"><section class="panel"><div class="paneltitle"><h2>${panelTitle}</h2><span class="sub">${panelTime}</span></div><div class="map"></div><div class="route-caption">${routeCaption}</div></section>${this.tripHistory(isTrip)}</div>${!isTrip?`<h2 class="section">차량 컨디션</h2><div class="tiles">${metric('외부 온도',n(v.outside_temp_c),'°C','thermometer')}${metric('12V 배터리',n(v.aux_voltage,2),'V','car-battery')}${metric('에어컨',v.ac_on==null?'—':v.ac_on?'ON':'OFF','','snowflake')}${metric('송풍 단계',n(v.blower_level,0),'','fan')}</div>`:''}`;
  }
  vehicleStatusView(v){
    const row=(ico,label,val,unit='',isBadge=false,badgeType='dim')=>{
      let valHtml;
      if(isBadge){
        valHtml=`<span class="status-badge ${badgeType}">${esc(val)}</span>`;
      }else{
        const isNone=val==='—'||val==null;
        const uText=(!isNone&&unit)?`<small>${esc(unit)}</small>`:'';
        valHtml=`<b class="status-val">${esc(val)}${uText}</b>`;
      }
      return `<div class="status-row"><div class="status-label-wrap"><span class="status-icon">${icon(ico)}</span><span class="status-label">${label}</span></div>${valHtml}</div>`;
    };

    const batteryItems=[
      row('battery','배터리 잔량',n(v.soc_percent),'%'),
      row('car-electric','주행가능거리 (추정)',n(v.range_km),'km'),
      row('flash','배터리 에너지',n(v.battery_kwh),'kWh'),
      row('ev-station','충전 전력 (추정)',n(v.charge_power_kw??(v.charge_power_w==null?null:v.charge_power_w/1000),1),'kW'),
      ...(v.charging?[
        row('timer-sand','80% 충전 남은시간',v.time_to_80_s!=null?shortDuration(v.time_to_80_s):'—',''),
        row('clock-end','80% 충전 완료시각',time(v.eta_80),''),
        row('timer-sand','100% 충전 남은시간',v.time_to_100_s!=null?shortDuration(v.time_to_100_s):'—',''),
        row('clock-end','100% 충전 완료시각',time(v.eta_100),'')
      ]:[]),
      row('flash-outline','고전압 배터리',n(v.hv_voltage),'V'),
      row('car-battery','12V 배터리',n(v.aux_voltage,2),'V'),
      row('battery-sync','BMS 용량 (추정)',n(v.measured_capacity_kwh),'kWh'),
      row('calculator','SOC 계산 용량',n(v.soc_capacity_kwh),'kWh')
    ];

    const drivingItems=[
      row('counter','총 주행거리',n(v.odometer_km,0),'km'),
      row('routes','이번 달 주행거리',n(v.month_distance_km),'km'),
      row('car-multiple','이번 달 주행 횟수',n(v.month_trip_count,0),'회'),
      row('speedometer','현재 속도',n(v.speed_kph),'km/h'),
      row('compass-outline','진행 방향',n(v.bearing_deg),'°'),
      row('car-cruise-control','주행 보조',v.enabled==null?'정보 없음':v.enabled?'활성':'비활성','',true,v.enabled==null?'dim':v.enabled?'on':'off'),
      row('crosshairs-gps','GPS 정확도',n(v.gps_accuracy_m),'m'),
      row('map-clock-outline','기록된 누적 거리',n(v.recorded_distance_km),'km')
    ];

    const climateItems=[
      row('thermometer','외부 온도',n(v.outside_temp_c),'°C'),
      row('snowflake','에어컨',v.ac_on==null?'정보 없음':v.ac_on?'작동':'꺼짐','',true,v.ac_on==null?'dim':v.ac_on?'on':'off'),
      row('fan','송풍 단계',n(v.blower_level,0)),
      row('fan-auto','송풍 제어 전압',n(v.blower_volt),'V'),
      row('car-seat-heater','운전석 열선',n(v.seat_heat_left,0)),
      row('car-seat-heater','조수석 열선',n(v.seat_heat_right,0)),
      row('air-filter','내기순환 신호',n(v.recirc,0))
    ];

    const group=(title,ico,items)=>`<div class="status-group panel"><div class="paneltitle"><h2>${icon(ico)}${title}</h2><span class="sub">${items.length}개 항목</span></div><div class="status-list">${items.join('')}</div></div>`;

    const fieldCount=Object.keys(v||{}).length;
    return `<h2 class="section" style="margin-top:0">차량 정보</h2><div class="status-groups">${group('배터리 & 전력','battery-charging',batteryItems)}${group('주행 & 운행 기록','steering',drivingItems)}${group('공조 & 실내 환경','fan',climateItems)}</div><p class="notice">— 는 정보 없음입니다. BMS 용량 추정은 실제 열화율이 아니며 SOC 계산 용량은 계기판 표시 보정에 사용합니다. 총 주행거리와 기록된 누적 거리는 서로 다른 값입니다.</p><details class="raw-data-card panel"><summary><div class="raw-summary-content"><span class="raw-summary-title">${icon('code-json')} 수신 데이터 전체 보기</span><span class="raw-toggle-hint">JSON 원본 데이터</span></div></summary><div class="raw-content"><div class="raw-toolbar"><span class="raw-count">수신된 원본 데이터 (${fieldCount}개 필드)</span><button type="button" class="copy-raw-btn" aria-label="수신 데이터 전체 복사">${icon('content-copy')}<span>모두 복사</span></button></div><pre>${esc(JSON.stringify(v,null,2))}</pre></div></details>`;
  }
  chargeHistory(){
    const days=tripDays(this.charges,this._hass?.config?.time_zone);
    if(!this.chargeDay||!days.some(d=>d.key===this.chargeDay)){
      const today=days.find(d=>d.today)||days[days.length-1];
      this.chargeDay=today?today.key:null;
    }
    const selected=days.find(d=>d.key===this.chargeDay);
    const labels=d=>d.date.getUTCDate()+'일('+['일','월','화','수','목','금','토'][d.date.getUTCDay()]+')';
    return `<section class="panel charge-history"><div class="paneltitle"><h2>충전 기록</h2><span class="sub">최근 7일</span></div><div class="trip-days charge-days">${days.map(d=>`<button class="trip-day charge-day" data-charge-day="${d.key}" aria-pressed="${d.key===this.chargeDay}" aria-label="${d.key}, ${d.indices.length} 회 충전"><span class="trip-today charge-today">${d.today?'오늘':'&nbsp;'}</span><b>${labels(d)}</b><span class="trip-count charge-count">${icon('power-plug')}${d.indices.length}</span></button>`).join('')}</div>${selected?`<div class="trip-day-heading">${selected.key} · ${selected.indices.length} 회 충전</div><div class="scroll">${selected.indices.length?selected.indices.map(i=>{const e=this.charges[i],ed=e?.data||e||{};const fast=Boolean(ed.energy_kwh&&ed.duration_s&&(ed.energy_kwh/(ed.duration_s/3600)>11));const boltSvg=fast?`<svg viewBox="0 0 24 24" class="charge-bolt" fill="currentColor" aria-hidden="true"><path d="M3.2,4V12.8H5.6V20L11.2,10.4H8L11.2,4Z"/><path d="M12.8,4V12.8H15.2V20L20.8,10.4H17.6L20.8,4Z"/></svg>`:`<svg viewBox="0 0 24 24" class="charge-bolt" fill="currentColor" aria-hidden="true"><path d="M7,2V13H10V22L17,10H13L17,2H7Z"/></svg>`;return `<div class="row charge-row"><div class="charge-meta"><span class="charge-icon-wrap ${fast?'fast':''}">${boltSvg}</span><div><b class="charge-date">${timeOnly(ed.started_at)}</b><div class="charge-info-sub"><span class="speed-badge ${fast?'fast':'slow'}">${fast?'급속':'완속'}</span><span class="charge-dur">${formatDuration(ed.duration_s)}</span>${ed.merged?`<span class="merge-badge">${ed.merge_count}회 병합</span>`:''}</div></div></div><div class="charge-val"><strong>${n(ed.energy_kwh,2)} <small>kWh</small></strong><span class="charge-sub" title="${ed.merged?(ed.merge_parts||[]).map(p=>`${n(p.energy_kwh,1)} kWh`).join(' + '):''}">${ed.merged?`${Math.max(1,Math.round((ed.merge_gap_s||0)/60))}분 간격 재연결`:(ed.partial?'일부 구간만 수집':'기록된 충전량')}</span></div></div>`;}).join(''):'<div class="empty">기록된 충전이 없습니다.</div>'}</div>`:'<div class="empty">날짜를 선택하면 해당 날짜의 충전 기록이 표시됩니다.</div>'}</section>`;
  }
  tripHistory(isTrip){
    const days=tripDays(this.trips,this._hass?.config?.time_zone);
    if(this.tripDay&&!days.some(d=>d.key===this.tripDay))this.tripDay=null;
    const selected=days.find(d=>d.key===this.tripDay);
    const labels=d=>d.date.getUTCDate()+'일('+['일','월','화','수','목','금','토'][d.date.getUTCDay()]+')';
    const capacity=(this.v&&this.v.soc_capacity_kwh)||78.0;
    return `<section class="panel trip-history"><div class="paneltitle"><h2>최근 주행</h2><span class="sub">최근 7일</span></div><div class="trip-days">${days.map(d=>`<button class="trip-day" data-trip-day="${d.key}" aria-pressed="${d.key===this.tripDay}" aria-label="${d.key}, ${d.indices.length} 회 주행"><span class="trip-today">${d.today?'오늘':'&nbsp;'}</span><b>${labels(d)}</b><span class="trip-count">${icon('road')}${d.indices.length}</span></button>`).join('')}</div>${selected?`<div class="trip-day-heading">${selected.key} · ${selected.indices.length} 회 주행</div><div class="scroll">${selected.indices.length?selected.indices.map(i=>{const e=this.trips[i];const ed=e?.data||{};const durText=tripDurationKo(ed.duration_s);const startSoc=ed.start_soc_percent!=null?Math.round(ed.start_soc_percent):(ed.start_battery_wh!=null?Math.round(Math.min(100,Math.max(0,ed.start_battery_wh/(capacity*1000)*100))):null);const endSoc=ed.end_soc_percent!=null?Math.round(ed.end_soc_percent):(ed.end_battery_wh!=null?Math.round(Math.min(100,Math.max(0,ed.end_battery_wh/(capacity*1000)*100))):null);const hasSoc=startSoc!=null&&endSoc!=null;const effHtml=ed.efficiency_km_kwh!=null?`<span class="trip-eff">${n(ed.efficiency_km_kwh,1)} km/kWh</span>`:'';const socHtml=hasSoc?`<span class="trip-soc">${icon(batteryIconName(startSoc))} ${startSoc}% → ${endSoc}%</span>`:(!effHtml&&!durText?`<small>${duration(ed.duration_s)}</small>`:'');return `<button class="tripbtn ${isTrip&&i===this.selected?'selected':''}" data-trip="${i}"><span><b>${timeOnly(ed.started_at||e.observed_at)}${durText?`<span class="trip-dur">${durText}</span>`:''}</b>${socHtml}${effHtml}</span><strong>${n((ed.distance_m||0)/1000,2)} <small>km</small></strong></button>`;}).join(''):'<div class="empty">기록된 주행이 없습니다.</div>'}</div>`:'<div class="empty">날짜를 선택하면 해당 날짜의 주행 기록이 표시됩니다.</div>'}</section>`;
  }
  overview(v){
    const tz = this._hass?.config?.time_zone;
    const displayState=this.vehicleStatus(v);
    const charging=displayState.key==='charging';
    const isDriving=displayState.key==='driving';
    const latest=this.trips[0]?.data;
    const soc=Number.isFinite(v.soc_percent)?Math.max(0,Math.min(100,v.soc_percent)):null;
    const status=displayState.label;
    const powerKw=v.charge_power_kw??(v.charge_power_w==null?null:v.charge_power_w/1000);
    const isEmergency=Boolean(v.emergency_charging);
    const isFast=typeof powerKw==='number'&&powerKw>11;
    const chargeLabel=isEmergency?(powerKw?`비상충전중 (${n(powerKw,1)}kW)...`:'비상충전중...'):(isFast?'고속충전중...':'완속충전중...');
    const sweepSpeedClass=isFast?'fast':'slow';

    const openDoors=[];
    if(v.door_driver_open)openDoors.push('운전석');
    if(v.door_rear_driver_open)openDoors.push('운전석 뒤');
    if(v.door_passenger_open)openDoors.push('동승석');
    if(v.door_rear_passenger_open)openDoors.push('동승석 뒤');
    if(v.trunk_open)openDoors.push('트렁크');
    const isLocked=v.doors_locked!==false&&openDoors.length===0;

    const renderLockMetric = (locked, isChargingMode, doorsList = []) => {
      const modeClass = isChargingMode ? 'mode-charging' : 'mode-parked';
      const lockClass = locked ? 'is-locked' : 'is-unlocked';
      const statusText = locked ? '잠김' : '열림';
      let hintText = '';
      if (locked) {
        hintText = '모든 도어 닫힘 및 잠김';
      } else if (!doorsList || doorsList.length === 0) {
        hintText = '도어 열림';
      } else if (doorsList.length === 1) {
        hintText = `${doorsList[0]} 열림`;
      } else {
        hintText = `${doorsList[0]} 외 ${doorsList.length - 1}개 열림`;
      }
      return `
        <div class="metric lock-metric c1 ${modeClass} ${lockClass}">
          <span class="label">차량 잠금 상태</span>
          <div class="lock-val-row">
            <div class="lock-icon-badge">
              <ha-icon icon="${locked ? 'mdi:lock' : 'mdi:lock-open-variant'}"></ha-icon>
            </div>
            <strong class="lock-val ${locked ? 'locked-text' : 'unlocked-text'}">${statusText}</strong>
          </div>
          <span class="hint">${hintText}</span>
        </div>`;
    };

    // Card 2: ETA to 80% / 100%
    const isUnder80 = soc == null || Math.round(soc) < 80;
    const targetPercent = isUnder80 ? 80 : 100;
    const etaCardTitle = `${targetPercent}%까지 걸리는 시간`;
    const targetSec = isUnder80 ? v.time_to_80_s : v.time_to_100_s;
    const targetEta = isUnder80 ? v.eta_80 : v.eta_100;

    let etaCardMainVal = '계산 중';
    let etaCardSubText = `${targetPercent}% 목표`;
    if (typeof targetSec === 'number' && Number.isFinite(targetSec)) {
      if (targetSec <= 0) {
        etaCardMainVal = '완료';
        etaCardSubText = '충전 완료';
      } else {
        etaCardMainVal = chargeDuration(targetSec);
        etaCardSubText = formatEtaCompletion(targetEta, tz);
      }
    }

    // Card 3: Real-time Charging Session Cost (no phantom 18.2kWh fallback)
    const sessionKwh = typeof v.session_charge_kwh === 'number'
      ? v.session_charge_kwh
      : (typeof v.charge_energy_kwh === 'number' ? v.charge_energy_kwh : 0.0);
    const sessionUnitPrice = isFast ? 320 : 280;
    const sessionCost = typeof v.session_charge_cost === 'number'
      ? v.session_charge_cost
      : Math.round(sessionKwh * sessionUnitPrice);
    const sessionCostSub = `+${n(sessionKwh, 1)} kWh (추정)`;

    const quickMetrics = charging
      ? `${renderLockMetric(isLocked, true, openDoors)}` +
        `${metric(etaCardTitle, etaCardMainVal, '', 'clock-end', etaCardSubText, 'charge-eta')}` +
        `${metric('실시간 충전금액', n(sessionCost, 0), '원', 'cash', sessionCostSub, 'charge-cost')}` +
        `${metric('이번 달 충전량', n(v.month_charge_kwh), 'kWh', 'battery-plus')}`
      : `${renderLockMetric(isLocked, false, openDoors)}` +
        `${metric('총 주행거리', n(v.odometer_km, 0), 'km', 'counter')}` +
        `${metric('이번 달 충전량', n(v.month_charge_kwh), 'kWh', 'battery-plus')}` +
        `${metric('이번 달 충전요금', n(v.month_charge_cost, 0), '원', 'cash', '(추정)')}`;

    const markersHtml=charging
      ?`${(soc==null||Math.round(soc)<80)?`<div class="charge-marker marker-80" data-top="80%" data-bottom="${chargeDuration(v.time_to_80_s)}"><span class="marker-cap cap-top"></span><span class="marker-cap cap-bottom"></span></div>`:''}`+
       `<div class="charge-marker marker-100" data-top="100%" data-bottom="${chargeDuration(v.time_to_100_s)}"><span class="marker-cap cap-top"></span><span class="marker-cap cap-bottom"></span></div>`
      :'';

    const sweepHtml=charging
      ?`<div class="sweep-overlay"><div class="sweep-clipper"><div class="sweep-beam ${sweepSpeedClass}"></div></div></div>`
      :(isDriving
        ?`<div class="sweep-overlay"><div class="sweep-clipper"><div class="sweep-beam driving"></div></div></div>`
        :'');

    const rangeKm = typeof v.estimated_range_km === 'number' && Number.isFinite(v.estimated_range_km)
      ? v.estimated_range_km
      : Math.round((soc ?? 0) * 4.6);

    const energyHeadHtml = charging
      ? `<div class="energy-head charging-left range-c3">
           <div class="charge-head-main">
             <svg viewBox="0 0 24 24" class="charge-head-bolt"><path d="M7 2v11h3v9l7-12h-4l3-8z"/></svg>
             <div class="charge-info-stack">
               <div class="charge-status-line">
                 <span class="charge-status-label">${chargeLabel}</span>
                 ${powerKw != null ? `<span class="charge-power-tag ${isFast ? 'fast' : 'slow'}">${n(powerKw, 1)} kW</span>` : ''}
               </div>
               <strong class="soc-value">${n(soc, 0)}<small>%</small></strong>
               <div class="range-sub-c3">
                 <span>예상 주행가능거리 <b>${rangeKm} km</b></span>
               </div>
             </div>
           </div>
         </div>`
      : `<div class="energy-head range-c3">
           <div class="battery-label">
             <svg viewBox="0 0 24 24" class="battery-head-icon"><path d="M16.67 4C17.4 4 18 4.6 18 5.33v15.34A1.33 1.33 0 0 1 16.67 22H7.33A1.33 1.33 0 0 1 6 20.67V5.33C6 4.6 6.6 4 7.33 4H9V2h6v2h1.67M16 6H8v14h8V6z"/></svg>
             <span>배터리 잔량</span>
           </div>
           <div class="soc-stack-c3">
             <strong class="soc-value">${n(soc, 0)}<small>%</small></strong>
             <div class="range-sub-c3">
               <span>주행가능거리 약 <b>${rangeKm} km</b></span>
             </div>
           </div>
         </div>`;

    const socState=!charging&&soc!==null?(soc<15?'is-critical soc-critical':soc<30?'is-low soc-low':''):'';

    return `<div class="cockpit desktop-balanced-cockpit"><div class="overview-col-visual"><section class="hero"><div class="hero-copy"><h2>${esc(status).replace('\n','<br>')}</h2></div>${this.vehicleImage()}</section><div class="mini-condition"><span>외기 <b>${n(v.outside_temp_c)}°C</b></span><span>12V <b>${n(v.aux_voltage,1)}V</b></span><span>공조 <b>${v.ac_on==null?'—':v.ac_on?'ON':'OFF'}</b></span></div></div><div class="overview-col-telemetry"><section class="energy ${charging?'is-charging':''} ${isDriving?'is-driving':''} ${socState}" style="--soc:${soc??0}%">${sweepHtml}${markersHtml}${energyHeadHtml}</section><div class="quick-metrics">${quickMetrics}</div><div class="overview-links"><button class="shortcut" data-tab="parking"><span><b>주차 위치</b><small>${v.parking_latitude==null?'위치 수신 대기':time(v.parking_at, tz)}</small></span><em>지도 →</em><div class="mini-map parking-mini"></div></button><button class="shortcut" data-tab="trips"><span><b>최근 주행</b><small>${latest?n(latest.distance_m==null?null:latest.distance_m/1000,2)+' km':'기록 없음'}</small><small>${latest?shortDuration(latest.duration_s):'새 주행 기록을 기다립니다'}</small></span><em>보기 →</em><div class="mini-map trip-mini"></div></button></div></div></div>`;
  }
  vehicleImage(){
    const src=this.config?.vehicle_image||assetBase+'carrot.png';
    // Legacy artwork contains large transparent margins; crop only for an explicit preset.
    if(this.config?.vehicle_image_layout==='legacy_id4')return `<svg class="car-image" viewBox="1000 552 2120 1680" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(this.config?.vehicle_name||'차량')}"><image href="${esc(src)}" width="4096" height="2729"/></svg>`;
    return `<img class="car-image" src="${esc(src)}" alt="${esc(this.config?.vehicle_name||'Carrot HA')}" style="object-fit:contain">`;
  }
  vehicleStatus(v){
    const online=this._hass?.states?.[this.config?.online_entity||this.v?.entity_ids?.comma_online]?.state;
    if(online==='off')return {key:'offline',label:'오프라인'};
    if(online!=='on'&&!this.isFromCache)return {key:'unknown',label:'연결 확인 중'};
    const isMoving=(v.speed_kph>5)||(typeof v.wheel_speed_mps==='number'&&v.wheel_speed_mps>1.5);
    const isCharging=(Boolean(v.charging)||this._hass?.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state==='on')&&!isMoving;
    if(isCharging)return {key:'charging',label:'충전중'};
    const driving=Object.prototype.hasOwnProperty.call(v,'driving')?v.driving:v.onroad;
    if(driving)return {key:'driving',label:'주행 중'};
    if(driving===false)return {key:'parked',label:'주차중'};
    return {key:'unknown',label:online==='on'?'상태 확인 중':'연결 확인 중'};
  }
  async drawMiniMaps(v){
    const nodes=[this.shadowRoot.querySelector('.parking-mini'),this.shadowRoot.querySelector('.trip-mini')];
    const L=await leaflet();
    nodes.forEach((node,i)=>{
      if(!node?.isConnected)return;
      const map=L.map(node,{zoomControl:false,attributionControl:true,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false});
      this.miniMaps.push(map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
      const route=(this.trips[0]?.data?.route||[]).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
      const dot=(p,c)=>L.circleMarker(p,{radius:5,color:'#fff',weight:2,fillColor:c,fillOpacity:1}).addTo(map);
      if(i&&route.length){const coords=route.map(p=>[p.latitude,p.longitude]);const max=Math.max(...route.map(p=>p.speedMps??p.speed_mps??0),1);for(let j=1;j<route.length;j++){let t=(route[j].speedMps??route[j].speed_mps??0)/max;L.polyline([coords[j-1],coords[j]],{color:`hsl(${18+118*t},95%,40%)`,weight:4,opacity:1}).addTo(map)}map.fitBounds(coords,{padding:[16,16],maxZoom:14});dot(coords[0],'#79ceff');dot(coords.at(-1),'#1260e8');}
      else if(!i&&Number.isFinite(v.parking_latitude)){const p=[v.parking_latitude,v.parking_longitude];map.setView(p,14);dot(p,'#1260e8');}
      else{this.miniMaps=this.miniMaps.filter(item=>item!==map);map.remove();node.textContent='위치 정보 없음';}
    });
    setTimeout(()=>{
      this.miniMaps?.forEach(m=>{try{m.invalidateSize();}catch(e){}});
    },100);
  }

  batteryHistory(){
    const days=this.v?.battery_history;
    if(!days?.length)return '<section class="battery-history"><h2>배터리 사용량</h2><p>시간별 기록을 불러올 수 없습니다. Carrot HA 구성요소도 함께 업데이트해 주세요.</p></section>';
    let idx=-1;
    if(this.chargeDay){
      idx=days.findIndex(x=>x.date===this.chargeDay);
    }
    if(idx===-1){
      idx=typeof this.batteryDay==='number'?Math.min(this.batteryDay,days.length-1):days.length-1;
    }
    if(idx<0)idx=0;
    this.batteryDay=idx;
    const d=days[idx],max=Math.max(100,Math.ceil(Math.max(...days.map(x=>x.used??0))/50)*50),color=d.used>100?'#ffc247':'#479cff';
    const bars=days.map((x,i)=>`<button data-day="${i}" data-date="${x.date}" aria-label="${x.date} 사용량 ${x.used??'기록 없음'}" aria-pressed="${idx===i}" style="--bar-end:${x.used>100?'#ffe480':'#65c4ff'};--bar:${idx===i?(x.used>100?'#ffc247':'#479cff'):'#626267'}"><i style="height:${(x.used??0)/max*100}%"></i><span>${new Date(x.date+'T12:00:00').toLocaleDateString('ko-KR',{weekday:'short'})}<small>${x.date.slice(5).replace('-','/')}</small></span></button>`).join('');
    const hours=(()=>{const runs=[];let start=null;for(let h=0;h<d.hours.length;h++){const ch=!!d.charge_hours?.[h]||!!d.hours[h]?.charging;if(ch&&start===null)start=h;if(!ch&&start!==null){runs.push([start,h-1]);start=null;}}if(start!==null)runs.push([start,d.hours.length-1]);let out='',ridx=0;for(let h=0;h<d.hours.length;h++){const x=d.hours[h],run=runs[ridx],charging=!!d.charge_hours?.[h]||!!x?.charging;if(run&&h===run[0])out+=`<div class="charge-run-wrap" style="--span:${run[1]-run[0]+1}"><em aria-hidden="true"><svg viewBox="0 0 32 40"><path d="M19 5 Q21 3 20 7 L17 17 H25 Q27 17 25 20 L13 35 Q11 37 12 33 L15 23 H7 Q5 23 7 20 Z" fill="#5ad46d" stroke="var(--bolt-outline)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg></em>`;out+=`<div title="${h}시 ${x?(x.last_known?'마지막 확인값 ':'실측 ')+Math.round(x.soc)+'%':'SOC 기록 없음'}${charging?' · 해당 시간 충전 기록 있음':''}" class="hour ${charging?'charging':x?.last_known?'last-known':x?.driving?'driving':'parked'} ${!charging&&x?(x.soc<15?'soc-critical':x.soc<30?'soc-low':''):''}">${x?`<i style="height:${x.soc}%"></i>`:''}</div>`;if(run&&h===run[1]){out+='</div>';ridx++;}}return out;})();
    return `<section class="battery-history"><h2>배터리 사용량</h2><div class="usage-total" style="color:${color}"><strong>${d.used==null?'—':n(d.used,1)+'%'}${d.used==null?'':'<small class="usage-caption">사용됨</small>'}</strong><span>${esc(d.date)}</span></div><div class="history-plot"><div class="week-bars">${bars}</div><div class="axis"><span>${max}%</span><span>${max/2}%</span><span>0%</span></div></div><p class="chart-key">최근 7일 · 날짜를 눌러 상세 보기 · 100% 초과는 노랑</p><h3>선택한 날짜의 배터리 잔량</h3><div class="history-plot"><div class="hours">${hours}</div><div class="axis"><span>100%</span><span>50%</span><span>0%</span></div></div><div class="hours-label"><span>00시</span><span>06시</span><span>12시</span><span>18시</span><span>24시</span></div><p class="chart-key"><b style="color:#5ad46d">● 충전중</b>　<span class="driving-key">● 주행 중</span>　<span class="parking-key">● 주차·마지막 확인값</span> · <span style="color:#e58a31">30% 미만</span> · <span style="color:#ed6269">15% 미만</span> · 빈 구간: 기록 없음</p><div class="usage-stats"><div>기록된 주행 시간<strong>${shortDuration(d.drive_s)}</strong></div><div>기록된 충전 시간<strong>${shortDuration(d.charge_s)}</strong></div></div><p class="chart-key">수신 ${d.received_samples??0}건 · 유효 SOC ${d.valid_samples??0}건 · 오래된 값 ${d.stale_samples??0}건 · 수집된 구간 ${shortDuration(d.covered_s)} · 사용량은 기록된 SOC 감소량의 합계이며 추정값입니다. 5분 초과 공백은 계산하지 않습니다. 회색 막대는 주차 중 측정값 또는 마지막 확인값입니다. 새 측정이 없는 시간에 유지한 값은 사용량 계산에서 제외합니다. 초록색은 해당 시간에 충전 기록이 있다는 뜻이며, 한 시간 내내 충전했다는 뜻은 아닙니다. SOC 기록이 없으면 충전 배경만 표시합니다. 주행·충전 시간은 저장된 세션 구간 기준이며 진행 중이거나 누락된 세션은 포함되지 않습니다.</p></section>`;
  }
  maxSpeed(route){const speeds=(route||[]).map(p=>p.speedMps??p.speed_mps).filter(Number.isFinite);return speeds.length?Math.max(...speeds)*3.6:null;}
  async drawMap(route,v,dayTrips=[]){
    const node=this.shadowRoot.querySelector('.map');
    try{
      const L=await leaflet();if(!node.isConnected)return;
      const points=route.filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180);
      const isDriving=this.vehicleStatus(v).key==='driving';
      const liveCoord=(isDriving&&Number.isFinite(v.latitude)&&Number.isFinite(v.longitude)&&Math.abs(v.latitude)<=90&&Math.abs(v.longitude)<=180)?[v.latitude,v.longitude]:null;
      const parkingCoord=(Number.isFinite(v.parking_latitude)&&Number.isFinite(v.parking_longitude)&&Math.abs(v.parking_latitude)<=90&&Math.abs(v.parking_longitude)<=180)?[v.parking_latitude,v.parking_longitude]:null;
      const targetPos=liveCoord||parkingCoord;
      const hasDayRoutes=!points.length&&dayTrips.length>0&&dayTrips.some(t=>(t.route||[]).some(p=>Number.isFinite(p.latitude)));
      if(!points.length&&!hasDayRoutes&&!targetPos){node.innerHTML='<div class="empty">유효한 위치 좌표를 기다리고 있습니다.</div>';return;}
      this.map=L.map(node,{scrollWheelZoom:false,zoomControl:true});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(this.map);
      const marker=(pos,end,text,title='')=>L.marker(pos,{title,icon:L.divIcon({className:'',html:`<div class="pin ${end?'end':''}" title="${esc(title)}">${text}</div>`,iconSize:[30,30],iconAnchor:[15,15]})}).addTo(this.map);
      let bounds;
      if(points.length){
        const max=Math.max(this.maxSpeed(points)||0,1)/3.6;
        for(let i=1;i<points.length;i++){
          const p=points[i],a=points[i-1],speed=p.speedMps??p.speed_mps;
          const t=Number.isFinite(speed)?Math.max(0,Math.min(1,speed/max)):0;
          const stops=[[0,244,81,30],[.35,255,179,0],[.65,146,205,0],[1,0,168,67]];
          const j=t<.35?0:t<.65?1:2,lo=stops[j],hi=stops[j+1],u=(t-lo[0])/(hi[0]-lo[0]);
          const color=Number.isFinite(speed)?`rgb(${lo.slice(1).map((c,k)=>Math.round(c+(hi[k+1]-c)*u)).join(',')})`:'#92989c';
          L.polyline([[a.latitude,a.longitude],[p.latitude,p.longitude]],{color,weight:6,opacity:1}).addTo(this.map);
        }
        const coords=points.map(p=>[p.latitude,p.longitude]);bounds=L.latLngBounds(coords);this.map.fitBounds(bounds,{padding:[32,32],maxZoom:16});marker(coords[0],false,'출','출발');marker(coords.at(-1),true,'도','도착');
      }else if(hasDayRoutes){
        const validTrips=dayTrips
          .map(dt=>({dt,pts:(dt.route||[]).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180)}))
          .filter(t=>t.pts.length>0);
        const getTime=t=>new Date(t.dt?.started_at||t.dt?.observed_at||0).getTime();
        validTrips.sort((a,b)=>getTime(a)-getTime(b));

        const allDayCoords=[];
        validTrips.forEach(vt=>{
          const coords=vt.pts.map(p=>[p.latitude,p.longitude]);
          allDayCoords.push(...coords);
          L.polyline(coords,{color:'#3b82f6',weight:5,opacity:0.85}).addTo(this.map);
        });
        if(allDayCoords.length&&validTrips.length){
          bounds=L.latLngBounds(allDayCoords);
          this.map.fitBounds(bounds,{padding:[32,32],maxZoom:16});
          const startPt=validTrips[0].pts[0];
          const endPt=validTrips.at(-1).pts.at(-1);
          marker([startPt.latitude,startPt.longitude],false,'출','이날 출발');
          marker([endPt.latitude,endPt.longitude],true,'도','이날 도착');
        }else if(targetPos){
          this.map.setView(targetPos,16);marker(targetPos,false,isDriving?'<span style="font-size:11px">차량</span>':'P');bounds=L.latLngBounds([targetPos]);
        }
      }else{
        this.map.setView(targetPos,16);marker(targetPos,false,isDriving?'<span style="font-size:11px">차량</span>':'P');bounds=L.latLngBounds([targetPos]);
      }
      const reset=L.control({position:'bottomright'});reset.onAdd=()=>{const b=L.DomUtil.create('button','resetmap');b.textContent='⌖ 전체 보기';b.setAttribute('aria-label','지도 전체 경로 보기');L.DomEvent.disableClickPropagation(b);b.onclick=()=>this.map.fitBounds(bounds,{padding:[32,32],maxZoom:16});return b;};reset.addTo(this.map);
      requestAnimationFrame(()=>this.map?.invalidateSize());
    }catch(e){if(node.isConnected)node.innerHTML=`<div class="empty">${esc(e.message)}</div>`;}
  }
}

export default CarrotDashboard;
