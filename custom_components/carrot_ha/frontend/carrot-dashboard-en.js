import {tripDays, loadRecentTrips, mergeConsecutiveCharges} from './carrot-trip-days.js';
const assetBase = new URL('./carrot-assets/', import.meta.url).href;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = (v, digits=1) => typeof v==='number' && Number.isFinite(v) ? v.toLocaleString('en-GB',{maximumFractionDigits:digits}) : '—';
const time = v => v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toLocaleString('en-GB',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'No records';
const timeOnly = v => v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toLocaleString('en-GB',{hour:'2-digit',minute:'2-digit'}) : 'No records';
const duration = v => typeof v==='number' ? [Math.floor(v/3600),Math.floor(v/60)%60,Math.floor(v)%60].map(x=>String(x).padStart(2,'0')).join(':') : '—';
const shortDuration = v => typeof v==='number' ? (Math.floor(v/3600)?Math.floor(v/3600)+' h ':'')+Math.floor(v/60)%60+' min' : '—';
const formatDuration = s => { if(typeof s !== 'number' || !Number.isFinite(s)) return '—'; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); if(h > 0 && m > 0) return `${h}h ${m}m elapsed`; if(h > 0) return `${h}h elapsed`; return `${m}m elapsed`; };
const chargeDuration = s => { if(typeof s !== 'number' || !Number.isFinite(s)) return '—'; if(s <= 0) return 'Done'; const totalMins = Math.round(s/60); const h = Math.floor(totalMins/60); const m = totalMins%60; if(h === 0) return `${m}m`; return m === 0 ? `${h}h` : `${h}h ${m}m`; };
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
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
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
    script.onload=()=>resolve(window.L.noConflict());script.onerror=()=>{window.__carrotLeaflet=null;reject(Error('Unable to load the map library. carrot-assets Check the folder.'));};document.head.append(script);
  });
  return window.__carrotLeaflet;
}

class CarrotDashboard extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.tab='overview';this.trips=[];this.charges=[];this.v={};this.offset=0;this.busy=false;this.selected=0;this.chargeDay=null;}
  setConfig(config){this.config=config;this.themeMode=config.color_mode||'auto';try{this.themeMode=localStorage.getItem('carrot-theme-'+(config.device_id||'default'))||this.themeMode;}catch{}this.applyTheme();this.render();}
  applyTheme(){
    if(!['auto','light','dark'].includes(this.themeMode))this.themeMode='auto';
    const dark=this.themeMode==='auto'?(this._hass?.themes?.darkMode??window.matchMedia('(prefers-color-scheme: dark)').matches):this.themeMode==='dark';
    this.setAttribute('data-theme',dark?'dark':'light');
  }
  set hass(hass){const oldCharging=this._hass?.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state;const previous=this._hass?.states?.[this.config?.online_entity||this.v?.entity_ids?.comma_online]?.state;this._hass=hass;this.applyTheme();if(!this.initialized){this.initialized=true;this.load();}else if(oldCharging!==hass.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state||previous!==hass.states?.[this.config?.online_entity||this.v?.entity_ids?.comma_online]?.state){this.render();}}
  connectedCallback(){this.timer=setInterval(()=>{if(this._hass&&!document.hidden)this.load(true);},60000);}
  disconnectedCallback(){this.clearMiniMaps();clearInterval(this.timer);if(this.map){this.map.remove();this.map=null;}}
  getCardSize(){return 8;}
  getGridOptions(){return {columns:36,rows:"auto",min_columns:6};}
  async load(quiet=false){
    if(this.busy)return;this.busy=true;this.error='';
    try{
      if(!quiet)this.render();
      const devices=await this._hass.callApi('GET','carrot_ha/v1/devices');
      const requested=this.config?.device_id;
      this.device=devices.devices.find(d=>d.device_id===requested)||(!requested?devices.devices[0]:null);
      if(!this.device)throw Error('Carrot HA Device not found. Check the card device_id setting.');
      const id=encodeURIComponent(this.device.entry_id);
      const [dash,trips,charges]=await Promise.all([
        this._hass.callApi('GET',`carrot_ha/v1/dashboard/${id}`),
        loadRecentTrips(this._hass.callApi.bind(this._hass),id),
        this._hass.callApi('GET',`carrot_ha/v1/history/${id}?kind=charge&limit=100&offset=0`)]);
      const selectedStart=this.trips[this.selected]?.data?.started_at;
      this.v=dash.values;this.trips=trips.events;this.charges=mergeConsecutiveCharges(charges.events);
      this.selected=Math.max(0,this.trips.findIndex(e=>e.data.started_at===selectedStart));
      if(this.selected>=this.trips.length)this.selected=0;
    }catch(e){this.error=e instanceof Error?e.message:'HA request failed. Check your administrator account and integration version.';}
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
        if(today?.indices?.length){
          this.selected=today.indices[0];
        }else if(this.trips.length){
          this.selected=0;
        }
      }
    }
    const v=this.v,trip=this.trips[this.selected]?.data||{},route=trip.route||[];
    const isTrip=this.tab==='trips';
    const state=this.vehicleStatus(v),badge=state.label;
    this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${assetBase}leaflet.css"><style>
      :host{display:block;container-type:inline-size;--ink:#f3f4f4;--muted:#959b9e;--line:#2b2e30;--orange:#ff8a18;--green:#72df9b;color:var(--ink);font-family:Inter,Pretendard,'Noto Sans KR',system-ui,sans-serif}
      *{box-sizing:border-box}ha-card{display:block;background:#0c0e10;border:1px solid #23272a;border-radius:26px;overflow:hidden;color:var(--ink)}button{font:inherit;cursor:pointer;color:inherit}button:focus-visible{outline:3px solid var(--orange);outline-offset:3px}button:disabled{opacity:.4;cursor:default}ha-icon{width:22px;height:22px;color:var(--muted)}.top{padding:28px 28px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px}.brand{font-size:12px;letter-spacing:3px;color:var(--muted);font-weight:650}.top h1{margin:5px 0 0;font-size:29px;letter-spacing:-1px}.badge{display:inline-flex;align-items:center;gap:8px;background:#19221d;padding:9px 12px;border-radius:30px;font-size:12px;color:var(--green);white-space:nowrap}.badge.dim{color:#b8babd;background:#222527}.dot{width:6px;height:6px;border-radius:50%;background:currentColor}.nav{display:flex;gap:5px;margin:0 28px 22px;padding:5px;background:#181b1d;border-radius:14px}.nav button{flex:1;border:0;border-radius:10px;background:transparent;padding:12px 6px;font-size:13px;font-weight:650;color:var(--muted)}.nav button.active{background:#303538;color:white}.main{padding:0 28px 26px}.tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.metric{border:1px solid var(--line);border-radius:18px;background:linear-gradient(145deg,#1d2022,#151719);padding:18px;min-width:0}.metric ha-icon{display:block;margin-bottom:12px}.label{display:block;font-size:12px;color:var(--muted);margin-bottom:8px}.metric strong{font-size:27px;font-weight:700;letter-spacing:-.6px;display:block;overflow-wrap:anywhere}.metric small{font-size:13px;margin-left:5px;font-weight:450;color:#aeb3b6;letter-spacing:0}.hint{font-size:11px;display:block;margin-top:8px;color:var(--muted);line-height:1.5}.layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(240px,1fr);gap:18px}.panel{background:#131618;border:1px solid var(--line);border-radius:20px;overflow:hidden}.paneltitle{padding:19px 20px;display:flex;align-items:center;justify-content:space-between;gap:8px}.paneltitle h2{font-size:16px;margin:0}.sub{color:var(--muted);font-size:12px;line-height:1.5}.map{height:380px;background:#14191c;z-index:0}.map .leaflet-tile-pane{filter:grayscale(1) invert(.91) hue-rotate(180deg) brightness(.8)}.leaflet-container{font:inherit}.leaflet-control-attribution{font-size:9px;background:#e4e7e7df!important;color:#222!important}.leaflet-control-attribution a{color:#26494a!important}.leaflet-bar a{background:#232729!important;color:white!important;border-color:#41464b!important}.pin{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--green);color:#07130b;border:3px solid #e8fff0;box-shadow:0 0 0 5px #0007;font-size:12px;font-weight:bold}.pin.end{background:var(--orange);border-color:#ffe2c4}.route-caption{padding:16px 20px;border-top:1px solid var(--line)}.legend{display:flex;align-items:center;gap:10px;font-size:11px;color:#bcc1c3;margin-bottom:10px}.gradient{height:5px;background:linear-gradient(90deg,#f4511e 0%,#ffb300 35%,#92cd00 65%,#00a843 100%);flex:1;border-radius:10px}.tripbtn{width:100%;text-align:left;padding:17px 18px;border:0;border-top:1px solid var(--line);background:transparent;display:flex;justify-content:space-between;gap:12px;align-items:center}.tripbtn.selected{background:#29251e;border-left:3px solid var(--orange)}.tripbtn b{display:block;font-size:13px;margin-bottom:7px}.tripbtn strong{font-size:21px;white-space:nowrap}.tripbtn small{font-size:11px;color:var(--muted)}.scroll{max-height:480px;overflow:auto}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.section{font-size:16px;margin:26px 0 14px}.row{display:flex;justify-content:space-between;gap:15px;padding:15px 20px;border-top:1px solid var(--line);font-size:13px}.row span{color:var(--muted)}.row b{text-align:right}.empty{padding:50px 24px;text-align:center;color:var(--muted);line-height:1.8;font-size:13px}.foot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px;color:var(--muted);font-size:11px}.refresh,.page{background:#202528;border:1px solid #343a3e;border-radius:10px;padding:10px 13px;white-space:nowrap;font-size:12px}.error{border:1px solid #814f25;background:#32241b;color:#ffd8af;padding:14px;border-radius:12px;margin-bottom:16px;font-size:13px}.pages{padding:12px;display:flex;justify-content:space-between;align-items:center}.batterybar{height:6px;background:#2d3433;border-radius:8px;margin:12px 0 4px;overflow:hidden}.batterybar i{display:block;height:100%;background:var(--green)}.allvalues{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}.table-row{display:flex;justify-content:space-between;gap:12px;padding:15px 0;border-bottom:1px solid var(--line);font-size:13px}.table-row span{color:var(--muted)}.notice{margin:14px 0;color:var(--muted);font-size:12px;line-height:1.7}.detailstats{margin-top:16px}.mono{font-variant-numeric:tabular-nums}details{margin-top:18px;color:var(--muted);font-size:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto}.resetmap{font:inherit;background:#232729;color:white;border:0;padding:8px;cursor:pointer}
      @container(max-width:650px){.top{padding:23px 18px 16px}.top h1{font-size:25px}.brand{font-size:10px}.badge{font-size:10px;padding:8px}.nav{margin:0 18px 18px}.main{padding:0 18px 22px}.tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.metric{padding:16px;border-radius:17px}.metric strong{font-size:26px}.layout{grid-template-columns:1fr}.map{height:370px}.allvalues{grid-template-columns:1fr}.scroll{max-height:320px}.foot{align-items:flex-start}.paneltitle{padding:16px}.row{padding:14px 16px}.grid2{gap:10px}}@container(min-width:1000px){.map{height:440px}.top h1{font-size:32px}.metric strong{font-size:31px}}

      :host{width:100%;min-width:0}ha-card{max-width:1440px;margin:auto}.top{padding:20px 24px 12px}.top h1{font-size:25px}.brand{font-size:10px}.nav{margin:0 24px 16px}.main{padding:0 24px 18px}.foot{margin-top:14px}.foot div{line-height:1.6}.cockpit{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:20px}.hero{position:relative;min-height:350px;overflow:hidden;border-radius:20px;background:radial-gradient(ellipse at 65% 80%,#c2cdd0,#e5e9e6 75%);color:#17272d}.hero-copy{position:relative;z-index:1;padding:24px}.hero-copy small{font-size:11px;letter-spacing:2px}.hero-copy h2{font-size:36px;line-height:1.15;margin:10px 0 0;letter-spacing:-1.5px}.hero .car-image{position:absolute;width:100%;height:100%;object-fit:cover;inset:0 0 auto;pointer-events:none}.quick{display:flex;flex-direction:column;gap:12px;min-width:0}.energy{background:#18221f;border:1px solid #34463e;border-radius:18px;padding:18px}.energy-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.energy-head strong{font-size:42px;line-height:1}.energy-head strong small{font-size:16px;color:#a9bdb0}.energy-head span{font-size:12px;color:#a9bdb0}.energy p{margin:8px 0 0;font-size:12px;color:#b8c9bf}.quick-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px}.quick-metrics .metric{padding:13px}.quick-metrics .metric strong{font-size:22px}.quick-metrics .metric ha-icon{display:none}.quick-metrics .label{margin-bottom:6px}.shortcut{display:flex;align-items:center;text-align:left;justify-content:space-between;width:100%;padding:15px;border-radius:15px;border:1px solid var(--line);background:#181c1e;gap:12px}.shortcut b{display:block;font-size:13px}.shortcut small{display:block;color:var(--muted);font-size:11px;margin-top:5px}.shortcut em{font-style:normal;color:var(--green)}.overview-links{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.mini-condition{display:flex;justify-content:space-around;gap:8px;border-top:1px solid var(--line);padding-top:13px;margin-top:14px;color:#b9c0c3;font-size:12px}.mini-condition span{white-space:nowrap}.mini-condition b{color:var(--ink)}
      @container(max-width:700px){.top{padding:15px 16px 10px}.top h1{font-size:22px}.brand{font-size:9px;letter-spacing:2px}.nav{margin:0 16px 12px}.nav button{padding:10px 4px;font-size:12px}.main{padding:0 16px 14px}.cockpit{grid-template-columns:1fr;gap:12px}.hero{min-height:160px}.hero-copy{padding:17px}.hero-copy h2{font-size:28px;max-width:160px}.hero .car-image{width:83%;height:250px;left:20%;top:-48px;object-fit:cover}.energy{padding:13px 15px}.energy-head strong{font-size:34px}.batterybar{margin:10px 0 4px}.quick{gap:10px}.quick-metrics .metric{padding:11px 13px}.quick-metrics .metric strong{font-size:21px}.quick-metrics .label{font-size:11px}.quick-metrics .metric:nth-child(n+3){display:none}.overview-links{margin-top:10px}.shortcut{padding:12px}.shortcut small{line-height:1.5}.mini-condition{margin-top:10px;padding-top:10px;font-size:11px}.foot{font-size:10px;gap:8px}.foot .refresh{padding:9px}.map{height:310px}.metric ha-icon{margin-bottom:7px}.metric{padding:12px}.metric strong{font-size:23px}}@container(max-width:360px){.hero .car-image{left:15%;width:90%}.hero-copy h2{font-size:24px}.mini-condition{flex-wrap:wrap}.overview-links{grid-template-columns:1fr}.badge{font-size:9px}}

    .trip-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;padding:0 10px 15px}.charge-days{max-width:480px;margin:0 auto 12px;gap:4px}.trip-day{max-width:52px;margin:0 auto;width:100%;aspect-ratio:1;min-width:0;border:0;border-radius:50%;padding:0;background:transparent;color:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer}.trip-day[aria-pressed="true"]{background:#dce8ff;color:#205fc6}:host([data-theme="dark"]) .trip-day[aria-pressed="true"]{background:#223a5c;color:#8fbdff}.charge-day[aria-pressed="true"]{background:#dce8ff;color:#205fc6}:host([data-theme="dark"]) .charge-day[aria-pressed="true"]{background:#223a5c;color:#8fbdff}.trip-day b{font-size:11px;white-space:nowrap}.trip-today{height:12px;line-height:12px;font-size:10px;color:#367bdd}:host([data-theme="dark"]) .trip-today{color:#8fbdff}.charge-today{color:#205fc6}:host([data-theme="dark"]) .charge-today{color:#8fbdff}.trip-count{display:flex;align-items:center;justify-content:center;gap:3px;font-size:11px;line-height:12px}.trip-count ha-icon{--mdc-icon-size:10px;width:10px;height:12px}.charge-count ha-icon{--mdc-icon-size:11px;width:11px;height:12px}.trip-day-heading{padding:13px 22px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}.charge-row{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-top:1px solid var(--line);font-size:13px;gap:12px}.charge-meta{display:flex;align-items:center;gap:14px;text-align:left;min-width:0;flex:1 1 auto}.charge-meta>div{min-width:0;text-align:left}.charge-icon-wrap,:host([data-theme="light"]) .charge-icon-wrap{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#edf4fe;color:#2563eb;flex-shrink:0}:host([data-theme="dark"]) .charge-icon-wrap{background:#162235;color:#60a5fa}.charge-icon-wrap.fast,:host([data-theme="light"]) .charge-icon-wrap.fast{background:#dbeafe;color:#1d4ed8}:host([data-theme="dark"]) .charge-icon-wrap.fast{background:#1e355b;color:#93c5fd}.charge-bolt{width:20px;height:20px;display:block;fill:currentColor}.charge-date{font-size:14px;font-weight:650;display:block;margin-bottom:4px;text-align:left!important;white-space:nowrap}.charge-info-sub{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);text-align:left!important;flex-wrap:wrap}.charge-dur{color:var(--muted);font-size:12px;white-space:nowrap;flex-shrink:0}.speed-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:-0.2px;line-height:15px;white-space:nowrap;flex-shrink:0}.speed-badge.slow,:host([data-theme="light"]) .speed-badge.slow{background:#edf4fe;color:#2563eb}:host([data-theme="dark"]) .speed-badge.slow{background:#162235;color:#60a5fa}.speed-badge.fast,:host([data-theme="light"]) .speed-badge.fast{background:#dbeafe;color:#1e40af}:host([data-theme="dark"]) .speed-badge.fast{background:#1e355b;color:#93c5fd}.merge-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:-0.2px;line-height:15px;background:#f3e8ff;color:#6b21a8;white-space:nowrap;flex-shrink:0}:host([data-theme="dark"]) .merge-badge{background:#3b1d54;color:#e9d5ff}.charge-val{text-align:right;flex-shrink:0;max-width:55%}.charge-sub{display:block;font-size:11px;font-weight:normal;color:var(--muted);margin-top:2px;word-break:keep-all;line-height:1.3}@media(min-width:901px){.layout:has(.trip-history){grid-template-columns:minmax(0,1.35fr) minmax(390px,1fr)}}@media(max-width:420px){.trip-days{padding-left:3px;padding-right:3px;gap:0}.trip-day{gap:1px}.trip-day b{font-size:10px}.trip-today{font-size:9px;height:10px;line-height:10px}.trip-count{font-size:10px;line-height:10px}}
.parking-chip-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(18,96,232,0.18);color:#5ea2ff;border:1px solid rgba(18,96,232,0.35);padding:6px 14px;border-radius:22px;font-size:14.5px;font-weight:700;letter-spacing:-.3px}
.parking-chip-badge.driving{background:rgba(19,120,69,0.22);color:#72df9b;border-color:rgba(114,223,155,0.4)}
.parking-chip-badge .dot{width:9px;height:9px;border-radius:50%;background:currentColor;box-shadow:0 0 7px currentColor}
.parking-chip-badge .dot.pulse{animation:pulse-dot 1.5s infinite}
@keyframes pulse-dot{0%{transform:scale(0.9);opacity:.8}50%{transform:scale(1.3);opacity:1}100%{transform:scale(0.9);opacity:.8}}
.parking-heading-wrap{display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:10px}
.parking-heading-left{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.parking-heading-left h2{font-size:18px;margin:0}
.parking-tiles{margin-top:18px}
</style><ha-card><header class="top"><div><div class="brand">VOLKSWAGEN · CARROT HA</div><h1>${esc(this.config?.vehicle_name||this.v?.vehicle_model||'Volkswagen MEB')}</h1></div><span class="badge ${state.key}"><i class="dot"></i>${badge}</span></header><nav class="nav">${[['overview','My car'],['trips','Trips'],['parking','Location'],['charge','Charging'],['vehicle','Status']].map(([key,label])=>`<button data-tab="${key}" class="${this.tab===key?'active':''}">${label}</button>`).join('')}</nav><main class="main">${this.error?`<div class="error">${esc(this.error)}</div>`:''}${this.body(v,trip,isTrip)}<footer class="foot"><div>Cloudflare · ${esc(v.cloud_status||'Checking connection')}<br>HA updated ${time(v.last_sync)}<br>Vehicle data received ${time(v.measured_at)}</div><button class="refresh">${this.busy?'Loading…':'↻ Refresh'}</button></footer></main></ha-card>`;
    this.shadowRoot.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.tab==='trips'&&this.tab!=='trips'){this.selected=0;this.tripDay=null;}if(b.dataset.tab==='charge'&&this.tab!=='charge'){this.chargeDay=null;}this.tab=b.dataset.tab;this.render();});
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
      :host([data-theme="light"]) .badge.parked{background:#e4e7e9;color:#4b555b}:host([data-theme="light"]) .badge.driving{background:#e0edff;color:#1356a2}:host([data-theme="light"]) .badge.charging{background:#e2f2e7;color:#156332}:host([data-theme="light"]) .badge.offline{background:#fff1bd;color:#745400}
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
      .quick-metrics .metric:nth-child(2) strong{font-size:20px;line-height:1.4}
      :host([data-theme="light"]) ha-card{background:#fff}
      :host([data-theme="light"]) .nav button.active{color:#1260e8}
      @container(max-width:700px){.energy{min-height:100px}.energy-head .soc-value{font-size:44px}.battery-label ha-icon{width:32px;height:32px}.battery-label{gap:6px}.energy-head .battery-label span,:host([data-theme="light"]) .energy-head .battery-label span{font-size:20px}.energy-head .soc-value{font-size:36px;gap:4px}.energy-head .soc-value small{font-size:20px}.quick-metrics .metric:nth-child(2) strong{font-size:17px}}
    `;
    themeStyle.textContent+=`.shortcut{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 112px;grid-template-rows:1fr auto;padding:12px;gap:8px 12px;overflow:hidden;min-height:136px;align-items:start}.shortcut>span{grid-column:1;grid-row:1;padding:0}.shortcut>em{grid-column:1;grid-row:2;padding:0;align-self:end}.mini-map{grid-column:2;grid-row:1/3;height:112px;width:112px;align-self:center;border-radius:10px;overflow:hidden;pointer-events:none;background:#e5e9e7}.mini-map .leaflet-control-attribution{font-size:7px}:host([data-theme="dark"]) .mini-map{background:#20262b}:host([data-theme="dark"]) .mini-map .leaflet-tile-pane{filter:grayscale(1) invert(.91) hue-rotate(180deg) brightness(.8)}:host([data-theme="light"]) .mini-map .leaflet-tile-pane{filter:none}.overview-links{gap:12px}@container(max-width:700px){.overview-links{grid-template-columns:1fr}.shortcut{grid-template-columns:minmax(0,1fr) 100px;min-height:124px}.mini-map{height:100px;width:100px}.shortcut b{font-size:13px}.shortcut>em{font-size:12px}.shortcut small{font-size:11px}}`;
    themeStyle.textContent+=`
      :host([data-theme="light"]) .shortcut{background:#dceaff;border-color:#d4e4fc}
      :host([data-theme="dark"]) .shortcut{background:#203b5e;border-color:#284363}
      .shortcut b{font-size:19px;line-height:1.35}.shortcut small{font-size:12px;margin-top:7px}
      .shortcut em{color:#75baff}:host([data-theme="light"]) .shortcut em{color:#1260e8}
      .tiles .metric,:host([data-theme="light"]) .tiles .metric{background:rgba(18,96,232,.5);border-color:rgba(18,96,232,.3);color:var(--ink)}
      .tiles .metric .label,.tiles .metric small,.tiles .metric ha-icon,:host([data-theme="light"]) .tiles .metric small{color:var(--ink)}
      .tripbtn.selected,:host([data-theme="light"]) .tripbtn.selected{background:rgba(18,96,232,.05);border-left:3px solid #1260e880;color:#173958}
      :host([data-theme="dark"]) .tripbtn.selected{background:rgba(18,96,232,.18);color:#fff}
      .tripbtn.selected small{color:inherit}
      .pin,:host([data-theme="light"]) .pin{background:#79ceff80;color:#092b45;border-color:#e4f5ff}
      .pin.end,:host([data-theme="light"]) .pin.end{background:#1260e880;color:var(--ink);border-color:#d5e6ff}
      .parking-heading{background:rgba(18,96,232,.5);color:var(--ink)}.parking-heading .sub{color:inherit}
      @container(max-width:700px){.shortcut b{font-size:17px}.shortcut small{font-size:12px}}
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
      .sweep-overlay{position:absolute;inset:0;border-radius:18px;overflow:hidden;pointer-events:none;z-index:2}
      .sweep-clipper{position:absolute;top:0;left:0;bottom:0;width:var(--soc);overflow:hidden}
      .sweep-beam{position:absolute;top:0;left:-60%;width:60%;height:100%;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.08) 30%,rgba(255,255,255,0.45) 50%,rgba(255,255,255,0.08) 70%,transparent 100%);filter:blur(1px);animation:chargeSweep 2.2s cubic-bezier(0.4,0,0.2,1) infinite}
      @keyframes chargeSweep{0%{left:-60%;opacity:0.15}20%{opacity:1}80%{opacity:1}100%{left:100%;opacity:0.1}}
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
      .energy-head.charging-left{display:flex;align-items:center;justify-content:flex-start;position:relative;z-index:5}
      .energy-head.charging-left .charge-info-stack{display:flex;flex-direction:column;gap:1px}
      .energy-head.charging-left .charge-status-label{font-size:12px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:0.5px;text-transform:uppercase;text-shadow:0 1px 2px rgba(0,0,0,0.35)}
      :host([data-theme="light"]) .energy-head.charging-left .charge-status-label{color:#ffffff}
      .energy-head.charging-left .soc-value{display:flex;align-items:baseline;gap:4px;font-size:48px;font-weight:900;color:#fff;line-height:1}
      .energy-head.charging-left .soc-value small{font-size:24px;color:#fff}
      @container(max-width:700px){
        .energy-head.charging-left .soc-value{font-size:38px}
        .energy-head.charging-left .soc-value small{font-size:20px}
        .quick-metrics .metric:nth-child(n+3){display:block !important}
      }
      .quick-metrics .metric.charge-power strong{color:#4ade80 !important}
      :host([data-theme="light"]) .quick-metrics .metric.charge-power strong{color:#16a34a !important}
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
}
}
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
    this.shadowRoot.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{this.batteryDay=Number(b.dataset.day);this.render();});

    const themeControl=document.createElement('label');themeControl.className='theme-control';
    themeControl.innerHTML='Theme <select aria-label="Theme"><option value="auto">Auto · HA theme</option><option value="light">Light</option><option value="dark">Dark</option></select>';
    const select=themeControl.querySelector('select');select.value=this.themeMode||'auto';
    select.onchange=()=>{this.themeMode=select.value;try{localStorage.setItem('carrot-theme-'+(this.config?.device_id||'default'),this.themeMode);}catch{}this.applyTheme();};
    this.shadowRoot.querySelector('main').append(themeControl);
    this.shadowRoot.querySelector('.refresh').onclick=()=>this.load();
    this.shadowRoot.querySelectorAll('[data-trip-day]').forEach(b=>b.onclick=()=>{this.tripDay=b.dataset.tripDay;const day=tripDays(this.trips,this._hass?.config?.time_zone).find(d=>d.key===this.tripDay);if(day?.indices?.length)this.selected=day.indices[0];this.render();});
    this.shadowRoot.querySelectorAll('[data-charge-day]').forEach(b=>b.onclick=()=>{this.chargeDay=b.dataset.chargeDay;this.render();});
    this.shadowRoot.querySelectorAll('[data-trip]').forEach(b=>b.onclick=()=>{this.selected=Number(b.dataset.trip);this.tab='trips';this.render();});
    this.shadowRoot.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{this.offset=Math.max(0,this.offset+Number(b.dataset.page)*20);this.selected=0;this.load();});
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
        copyBtn.innerHTML=`${icon('check')} <span>Copied!</span>`;
        setTimeout(()=>{if(copyBtn.isConnected){copyBtn.classList.remove('copied');copyBtn.innerHTML=`${icon('content-copy')} <span>Copy all</span>`;}},2000);
      }catch(err){
        copyBtn.innerHTML=`${icon('alert-circle-outline')} <span>Copy failed</span>`;
        setTimeout(()=>{if(copyBtn.isConnected){copyBtn.classList.remove('copied');copyBtn.innerHTML=`${icon('content-copy')} <span>Copy all</span>`;}},2000);
      }
    };
    if(this.tab==='overview')this.drawMiniMaps(v).catch(()=>{this.shadowRoot.querySelectorAll('.mini-map').forEach(node=>{node.textContent='Unable to load the map';});});
    if(this.shadowRoot.querySelector('.map'))this.drawMap(isTrip?route:[],v);
  }
  body(v,trip,isTrip){
    if(this.tab==='overview')return this.overview(v);
    if(this.tab==='parking'){
      const isDriving=Boolean(v.onroad);
      const refNow=v.measured_at||new Date().toISOString();
      const parkDur=parkingDuration(v.parking_at,refNow);
      let auxStatus='Normal · No discharge risk';
      if(typeof v.aux_voltage==='number'){
        if(v.aux_voltage<12.0)auxStatus='Warning · Low voltage';
        else if(v.aux_voltage<12.4)auxStatus='Normal · Stable voltage';
      }
      const tiles=`
        ${metric('Battery level',n(v.soc_percent,0),'%','battery',`${n(v.battery_kwh,1)} kWh stored`)}
        ${metric('Odometer',n(v.odometer_km,0),'km','counter','Vehicle odometer')}
        ${isDriving?metric('Current speed',n(v.speed_kph,0),'km/h','speedometer','Current speed'):metric('12V battery',n(v.aux_voltage,1),'V','car-battery',auxStatus)}
        ${metric('Outside temperature',n(v.outside_temp_c,1),'°C','thermometer','Ambient temperature')}
      `;
      const lat=isDriving?(v.latitude??v.parking_latitude):v.parking_latitude;
      const lng=isDriving?(v.longitude??v.parking_longitude):v.parking_longitude;
      const timeStr=isDriving?`Live update ${time(v.measured_at)}`:`Recorded ${time(v.parking_at)}`;
      const chipHtml=isDriving
        ?`<span class="parking-chip-badge driving"><i class="dot pulse"></i>Driving (Live)</span>`
        :`<span class="parking-chip-badge"><i class="dot"></i>Parked · ${esc(parkDur)} ago</span>`;
      const captionSub=isDriving
        ?'Current vehicle position · Will be updated to new parking location when trip ends'
        :'Last recorded parking location';
      return `<section class="panel"><div class="paneltitle parking-heading"><div class="parking-heading-wrap"><div class="parking-heading-left"><h2>${isDriving?'Vehicle location':'Parking location'}</h2>${chipHtml}</div><span class="sub">${timeStr}</span></div></div><div class="map"></div><div class="route-caption"><b>${lat==null?'Waiting for location':`${n(lat,5)}, ${n(lng,5)}`}</b><p class="sub">${captionSub}</p></div></section><div class="tiles parking-tiles">${tiles}</div>`;
    }
    if(this.tab==='vehicle')return this.vehicleStatusView(v);
    if(this.tab==='charge')return `${this.batteryHistory()}<div class="tiles">${metric('Charged this month',n(v.month_charge_kwh),'kWh','battery-plus')}${metric('Charging cost this month',n(v.month_charge_cost,0),'KRW','cash','estimated')}${metric('Slow charging (estimated)',n(v.month_slow_kwh),'kWh','power-plug')}${metric('Fast charging (estimated)',n(v.month_fast_kwh),'kWh','flash')}</div>${this.chargeHistory()}<p class="notice">Estimated from battery energy increases. Up to 11 kW is classified as slow charging. Estimated cost: ${n(v.month_charge_cost,0)} KRW using preset rates. No measurements are available when the vehicle is asleep or comma is off.</p>`;
    const tiles=isTrip?`${metric('Distance',n(trip.distance_m==null?null:trip.distance_m/1000,2),'km','map-marker-distance')}${metric('Duration',duration(trip.duration_s),'','timer-outline')}${metric('Average speed',n(trip.duration_s?trip.distance_m/trip.duration_s*3.6:null,0),'km/h','speedometer-medium')}${metric('Top speed',n(this.maxSpeed(trip.route),0),'km/h','speedometer')}`:
      `${metric('Battery level',n(v.soc_percent,0),'%','battery',`${n(v.battery_kwh)} / ${n(v.soc_capacity_kwh)} kWh`)}${metric('Odometer',n(v.odometer_km,0),'km','counter',v.stale?'Last measured':'Vehicle display')}${metric('Distance this month',n(v.month_distance_km),'km','routes',`${n(v.month_trip_count,0)} trips Trips`)}${metric('Estimated charging power',n(v.charge_power_kw??(v.charge_power_w==null?null:v.charge_power_w/1000)),'kW','ev-station',v.charging?'Charging increase detected':'Based on observations')}`;
    return `<div class="tiles">${tiles}</div><div class="layout"><section class="panel"><div class="paneltitle"><h2>${isTrip?'Trip details':'Parking location'}</h2><span class="sub">${time(isTrip?trip.started_at:v.parking_at)}</span></div><div class="map"></div><div class="route-caption">${isTrip?`<div class="legend"><span>Low · 0 km/h</span><i class="gradient"></i><span>High · ${n(this.maxSpeed(trip.route),0)} km/h</span></div><div class="sub">${time(trip.started_at)} → ${time(trip.ended_at)}<br>${(trip.route||[]).length} route points · Start: light blue / End: blue</div>`:`<b>${v.parking_latitude!=null?`${n(v.parking_latitude,5)}, ${n(v.parking_longitude,5)}`:'Waiting for location'}</b><div class="sub">Last parking location or trip destination</div>`}</div></section>${this.tripHistory(isTrip)}</div>${!isTrip?`<h2 class="section">Vehicle condition</h2><div class="tiles">${metric('Outside temperature',n(v.outside_temp_c),'°C','thermometer')}${metric('12V battery',n(v.aux_voltage,2),'V','car-battery')}${metric('Air conditioning',v.ac_on==null?'—':v.ac_on?'ON':'OFF','','snowflake')}${metric('Blower level',n(v.blower_level,0),'','fan')}</div>`:''}`;
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
      row('battery','Battery level',n(v.soc_percent),'%'),
      row('car-electric','Range',n(v.range_km),'km'),
      row('flash','Battery energy',n(v.battery_kwh),'kWh'),
      row('ev-station','Estimated charging power',n(v.charge_power_kw??(v.charge_power_w==null?null:v.charge_power_w/1000),1),'kW'),
      ...(v.charging?[
        row('timer-sand','Time to 80%',v.time_to_80_s!=null?shortDuration(v.time_to_80_s):'—',''),
        row('clock-end','80% completion time',time(v.eta_80),''),
        row('timer-sand','Time to 100%',v.time_to_100_s!=null?shortDuration(v.time_to_100_s):'—',''),
        row('clock-end','100% completion time',time(v.eta_100),'')
      ]:[]),
      row('flash-outline','HV battery',n(v.hv_voltage),'V'),
      row('car-battery','12V battery',n(v.aux_voltage,2),'V'),
      row('battery-sync','Estimated BMS capacity',n(v.measured_capacity_kwh),'kWh'),
      row('calculator','SOC calculation capacity',n(v.soc_capacity_kwh),'kWh')
    ];

    const drivingItems=[
      row('counter','Odometer',n(v.odometer_km,0),'km'),
      row('routes','Distance this month',n(v.month_distance_km),'km'),
      row('car-multiple','Trips this month',n(v.month_trip_count,0),'trips'),
      row('speedometer','Current speed',n(v.speed_kph),'km/h'),
      row('compass-outline','Heading',n(v.bearing_deg),'°'),
      row('car-cruise-control','Driving assistance',v.enabled==null?'Unavailable':v.enabled?'Enabled':'Disabled','',true,v.enabled==null?'dim':v.enabled?'on':'off'),
      row('crosshairs-gps','GPS accuracy',n(v.gps_accuracy_m),'m'),
      row('map-clock-outline','Recorded distance',n(v.recorded_distance_km),'km')
    ];

    const climateItems=[
      row('thermometer','Outside temperature',n(v.outside_temp_c),'°C'),
      row('snowflake','Air conditioning',v.ac_on==null?'Unavailable':v.ac_on?'On':'Off','',true,v.ac_on==null?'dim':v.ac_on?'on':'off'),
      row('fan','Blower level',n(v.blower_level,0)),
      row('fan-auto','Blower control voltage',n(v.blower_volt),'V'),
      row('car-seat-heater','Driver seat heating',n(v.seat_heat_left,0)),
      row('car-seat-heater','Passenger seat heating',n(v.seat_heat_right,0)),
      row('air-filter','Recirculation signal',n(v.recirc,0))
    ];

    const group=(title,ico,items)=>`<div class="status-group panel"><div class="paneltitle"><h2>${icon(ico)}${title}</h2><span class="sub">${items.length} items</span></div><div class="status-list">${items.join('')}</div></div>`;

    const fieldCount=Object.keys(v||{}).length;
    return `<h2 class="section" style="margin-top:0">Vehicle information</h2><div class="status-groups">${group('Battery & Power','battery-charging',batteryItems)}${group('Driving & Records','steering',drivingItems)}${group('Climate & Cabin','fan',climateItems)}</div><p class="notice">— means unavailable. Estimated BMS capacity is not battery health. SOC calculation capacity calibrates the displayed percentage. Odometer and recorded distance are different values.</p><details class="raw-data-card panel"><summary><div class="raw-summary-content"><span class="raw-summary-title">${icon('code-json')} Show all received data</span><span class="raw-toggle-hint">Raw payload</span></div></summary><div class="raw-content"><div class="raw-toolbar"><span class="raw-count">Raw received payload (${fieldCount} fields)</span><button type="button" class="copy-raw-btn" aria-label="Copy all received data">${icon('content-copy')}<span>Copy all</span></button></div><pre>${esc(JSON.stringify(v,null,2))}</pre></div></details>`;
  }
  chargeHistory(){
    const days=tripDays(this.charges,this._hass?.config?.time_zone);
    if(this.chargeDay&&!days.some(d=>d.key===this.chargeDay))this.chargeDay=null;
    const selected=days.find(d=>d.key===this.chargeDay);
    const labels=d=>d.date.toLocaleDateString('en-US',{day:'numeric',weekday:'short',timeZone:'UTC'});
    return `<section class="panel charge-history"><div class="paneltitle"><h2>Charging records</h2><span class="sub">Last 7 days</span></div><div class="trip-days charge-days">${days.map(d=>`<button class="trip-day charge-day" data-charge-day="${d.key}" aria-pressed="${d.key===this.chargeDay}" aria-label="${d.key}, ${d.indices.length} charges"><span class="trip-today charge-today">${d.today?'Today':'&nbsp;'}</span><b>${labels(d)}</b><span class="trip-count charge-count">${icon('power-plug')}${d.indices.length}</span></button>`).join('')}</div>${selected?`<div class="trip-day-heading">${selected.key} · ${selected.indices.length} charges</div><div class="scroll">${selected.indices.length?selected.indices.map(i=>{const e=this.charges[i];const fast=Boolean(e.data.energy_kwh&&e.data.duration_s&&(e.data.energy_kwh/(e.data.duration_s/3600)>11));const boltSvg=fast?`<svg viewBox="0 0 24 24" class="charge-bolt" fill="currentColor" aria-hidden="true"><path d="M3.2,4V12.8H5.6V20L11.2,10.4H8L11.2,4Z"/><path d="M12.8,4V12.8H15.2V20L20.8,10.4H17.6L20.8,4Z"/></svg>`:`<svg viewBox="0 0 24 24" class="charge-bolt" fill="currentColor" aria-hidden="true"><path d="M7,2V13H10V22L17,10H13L17,2H7Z"/></svg>`;return `<div class="row charge-row"><div class="charge-meta"><span class="charge-icon-wrap ${fast?'fast':''}">${boltSvg}</span><div><b class="charge-date">${timeOnly(e.data.started_at)}</b><div class="charge-info-sub"><span class="speed-badge ${fast?'fast':'slow'}">${fast?'Fast':'Slow'}</span><span class="charge-dur">${formatDuration(e.data.duration_s)}</span>${e.data.merged?`<span class="merge-badge">${e.data.merge_count} merged</span>`:''}</div></div></div><div class="charge-val"><strong>${n(e.data.energy_kwh,2)} <small>kWh</small></strong><span class="charge-sub" title="${e.data.merged?(e.data.merge_parts||[]).map(p=>`${n(p.energy_kwh,1)} kWh`).join(' + '):''}">${e.data.merged?`Reconnected in ${Math.max(1,Math.round((e.data.merge_gap_s||0)/60))}m`:(e.data.partial?'Partial data':'Recorded energy')}</span></div></div>`;}).join(''):'<div class="empty">No charges recorded.</div>'}</div>`:'<div class="empty">Choose a date to see its charges.</div>'}</section>`;
  }
  tripHistory(isTrip){
    const days=tripDays(this.trips,this._hass?.config?.time_zone);
    if(this.tripDay&&!days.some(d=>d.key===this.tripDay))this.tripDay=null;
    const selected=days.find(d=>d.key===this.tripDay);
    const labels=d=>d.date.toLocaleDateString('en-US',{day:'numeric',weekday:'short',timeZone:'UTC'});
    return `<section class="panel trip-history"><div class="paneltitle"><h2>Recent trips</h2><span class="sub">Last 7 days</span></div><div class="trip-days">${days.map(d=>`<button class="trip-day" data-trip-day="${d.key}" aria-pressed="${d.key===this.tripDay}" aria-label="${d.key}, ${d.indices.length} trips"><span class="trip-today">${d.today?'Today':'&nbsp;'}</span><b>${labels(d)}</b><span class="trip-count">${icon('road')}${d.indices.length}</span></button>`).join('')}</div>${selected?`<div class="trip-day-heading">${selected.key} · ${selected.indices.length} trips</div><div class="scroll">${selected.indices.length?selected.indices.map(i=>{const e=this.trips[i];return `<button class="tripbtn ${isTrip&&i===this.selected?'selected':''}" data-trip="${i}"><span><b>${timeOnly(e.data.started_at||e.observed_at)}</b><small>${duration(e.data.duration_s)}</small></span><strong>${n((e.data.distance_m||0)/1000,2)} <small>km</small></strong></button>`;}).join(''):'<div class="empty">No trips recorded.</div>'}</div>`:'<div class="empty">Choose a date to see its trips.</div>'}</section>`;
  }
  overview(v){
    const charging=this._hass?.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state==='on'||Boolean(v.charging);
    const latest=this.trips[0]?.data;
    const soc=Number.isFinite(v.soc_percent)?Math.max(0,Math.min(100,v.soc_percent)):null;
    const status=this.vehicleStatus(v).label;
    const powerKw=v.charge_power_kw??(v.charge_power_w==null?null:v.charge_power_w/1000);
    const quickMetrics=charging
      ?`${metric('Odometer',n(v.odometer_km,0),'km','counter')}`+
       `${metric('Charged this month',n(v.month_charge_kwh),'kWh','battery-plus')}`+
       `${metric('Estimated charging power',n(powerKw,1),'kW','ev-station','Charging','charge-power')}`+
       `${metric('Estimated completion',v.eta_100?timeOnly(v.eta_100):'Calculating','','clock-end',v.time_to_100_s!=null?chargeDuration(v.time_to_100_s)+' left':'100% target')}`
      :`${metric('Odometer',n(v.odometer_km,0),'km','counter')}`+
       `${metric('Charged this month',n(v.month_charge_kwh),'kWh','battery-plus')}`+
       `${metric('Distance this month',n(v.month_distance_km),'km','routes')}`+
       `${metric('Range',n(v.range_km,0),'km','car-electric')}`;

    const markersHtml=charging
      ?`${(soc==null||soc<80)?`<div class="charge-marker marker-80" data-top="80%" data-bottom="${chargeDuration(v.time_to_80_s)}"><span class="marker-cap cap-top"></span><span class="marker-cap cap-bottom"></span></div>`:''}`+
       `<div class="charge-marker marker-100" data-top="100%" data-bottom="${chargeDuration(v.time_to_100_s)}"><span class="marker-cap cap-top"></span><span class="marker-cap cap-bottom"></span></div>`
      :'';

    const sweepHtml=charging
      ?`<div class="sweep-overlay"><div class="sweep-clipper"><div class="sweep-beam"></div></div></div>`
      :'';

    const energyHeadHtml=charging
      ?`<div class="energy-head charging-left"><div class="charge-info-stack"><span class="charge-status-label">Charging</span><strong class="soc-value">${n(soc,0)}<small>%</small></strong></div></div>`
      :`<div class="energy-head"><div class="battery-label"><span>Battery level</span></div><strong class="soc-value">${n(soc,0)}<small>%</small></strong></div>`;

    return `<div class="cockpit"><section class="hero"><div class="hero-copy"><h2>${esc(status).replace('\n','<br>')}</h2></div>${this.vehicleImage()}</section><div class="quick"><section class="energy ${charging?'is-charging':''}" style="--soc:${soc??0}%">${sweepHtml}${markersHtml}${energyHeadHtml}</section><div class="quick-metrics">${quickMetrics}</div></div></div><div class="overview-links"><button class="shortcut" data-tab="parking"><span><b>Parking location</b><small>${v.parking_latitude==null?'Waiting for location':time(v.parking_at)}</small></span><em>Map →</em><div class="mini-map parking-mini"></div></button><button class="shortcut" data-tab="trips"><span><b>Recent trips</b><small>${latest?n(latest.distance_m==null?null:latest.distance_m/1000,2)+' km':'No records'}</small><small>${latest?shortDuration(latest.duration_s):'Waiting for a new trip'}</small></span><em>View →</em><div class="mini-map trip-mini"></div></button></div><div class="mini-condition"><span>Outside <b>${n(v.outside_temp_c)}°C</b></span><span>12V <b>${n(v.aux_voltage,1)}V</b></span><span>Climate <b>${v.ac_on==null?'—':v.ac_on?'ON':'OFF'}</b></span></div>`;
  }
  vehicleImage(){
    const src=this.config?.vehicle_image||assetBase+'carrot.png';
    // Legacy artwork contains large transparent margins; crop only for an explicit preset.
    if(this.config?.vehicle_image_layout==='legacy_id4')return `<svg class="car-image" viewBox="1000 552 2120 1680" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(this.config?.vehicle_name||'Vehicle')}"><image href="${esc(src)}" width="4096" height="2729"/></svg>`;
    return `<img class="car-image" src="${esc(src)}" alt="${esc(this.config?.vehicle_name||'Carrot HA')}" style="object-fit:contain">`;
  }
  vehicleStatus(v){
    const online=this._hass?.states?.[this.config?.online_entity||this.v?.entity_ids?.comma_online]?.state;
    if(online==='off')return {key:'offline',label:'Offline'};
    if(online!=='on')return {key:'unknown',label:'Checking connection'};
    if(v.onroad)return {key:'driving',label:'Driving'};
    if(v.charging)return {key:'charging',label:'Charging'};
    return v.onroad===false?{key:'parked',label:'Parked'}:{key:'unknown',label:'Checking status'};
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
      if(i&&route.length){const coords=route.map(p=>[p.latitude,p.longitude]);const max=Math.max(...route.map(p=>p.speedMps??p.speed_mps??0),1);for(let j=1;j<route.length;j++){let t=(route[j].speedMps??route[j].speed_mps??0)/max;L.polyline([coords[j-1],coords[j]],{color:`hsl(${18+118*t},95%,40%)`,weight:4,opacity:1}).addTo(map)}map.fitBounds(coords,{paddingTopLeft:[16,12],paddingBottomRight:[16,34],maxZoom:14});dot(coords[0],'#79ceff');dot(coords.at(-1),'#1260e8');}
      else if(!i&&Number.isFinite(v.parking_latitude)){const p=[v.parking_latitude,v.parking_longitude];map.setView(p,14);map.panBy([0,12],{animate:false});dot(p,'#1260e8');}
      else{this.miniMaps=this.miniMaps.filter(item=>item!==map);map.remove();node.textContent='No location data';}
    });
  }

  batteryHistory(){
    const days=this.v?.battery_history;
    if(!days?.length)return '<section class="battery-history"><h2>Battery usage</h2><p>Cannot load hourly history. Update the Carrot HA integration too.</p></section>';
    const idx=Math.min(this.batteryDay??days.length-1,days.length-1),d=days[idx],max=Math.max(100,Math.ceil(Math.max(...days.map(x=>x.used??0))/50)*50),color=d.used>100?'#ffc247':'#479cff';
    const bars=days.map((x,i)=>`<button data-day="${i}" aria-label="${x.date} Usage ${x.used??'No records'}" aria-pressed="${idx===i}" style="--bar-end:${x.used>100?'#ffe480':'#65c4ff'};--bar:${idx===i?(x.used>100?'#ffc247':'#479cff'):'#626267'}"><i style="height:${(x.used??0)/max*100}%"></i><span>${new Date(x.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short'})}<small>${x.date.slice(5).replace('-','/')}</small></span></button>`).join('');
    const hours=(()=>{const runs=[];let start=null;for(let h=0;h<d.hours.length;h++){const ch=!!d.charge_hours?.[h]||!!d.hours[h]?.charging;if(ch&&start===null)start=h;if(!ch&&start!==null){runs.push([start,h-1]);start=null;}}if(start!==null)runs.push([start,d.hours.length-1]);let out='',ridx=0;for(let h=0;h<d.hours.length;h++){const x=d.hours[h],run=runs[ridx],charging=!!d.charge_hours?.[h]||!!x?.charging;if(run&&h===run[0])out+=`<div class="charge-run-wrap" style="--span:${run[1]-run[0]+1}"><em aria-hidden="true"><svg viewBox="0 0 32 40"><path d="M19 5 Q21 3 20 7 L17 17 H25 Q27 17 25 20 L13 35 Q11 37 12 33 L15 23 H7 Q5 23 7 20 Z" fill="#5ad46d" stroke="var(--bolt-outline)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg></em>`;out+=`<div title="${h}:00 ${x?(x.last_known?'Last known ':'Measured ')+Math.round(x.soc)+'%':'No SOC record'}${charging?' · Charging recorded during this hour':''}" class="hour ${charging?'charging':x?.last_known?'last-known':x?.driving?'driving':'parked'} ${!charging&&x?(x.soc<15?'soc-critical':x.soc<30?'soc-low':''):''}">${x?`<i style="height:${x.soc}%"></i>`:''}</div>`;if(run&&h===run[1]){out+='</div>';ridx++;}}return out;})();
    return `<section class="battery-history"><h2>Battery usage</h2><div class="usage-total" style="color:${color}"><strong>${d.used==null?'—':n(d.used,1)+'%'}${d.used==null?'':'<small class="usage-caption">used</small>'}</strong><span>${esc(d.date)}</span></div><div class="history-plot"><div class="week-bars">${bars}</div><div class="axis"><span>${max}%</span><span>${max/2}%</span><span>0%</span></div></div><p class="chart-key">Last 7 days · Select a day for details · Yellow indicates over 100%</p><h3>Battery level on selected day</h3><div class="history-plot"><div class="hours">${hours}</div><div class="axis"><span>100%</span><span>50%</span><span>0%</span></div></div><div class="hours-label"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div><p class="chart-key"><b style="color:#5ad46d">● Charging</b>　<span class="driving-key">● Driving</span>　<span class="parking-key">● Parked / last known</span> · <span style="color:#e58a31">Below 30%</span> · <span style="color:#ed6269">Below 15%</span> · Gaps: no records</p><div class="usage-stats"><div>Recorded driving time<strong>${shortDuration(d.drive_s)}</strong></div><div>Recorded charging time<strong>${shortDuration(d.charge_s)}</strong></div></div><p class="chart-key">Received ${d.received_samples??0} samples · Valid SOC ${d.valid_samples??0} samples · Stale samples ${d.stale_samples??0} samples · Recorded coverage ${shortDuration(d.covered_s)} · Usage estimates sum recorded SOC decreases, excluding gaps over 5 minutes. Gray bars show parked readings or last known values. Carried values are excluded from consumption. Green means charging occurred within the hour, not throughout it. Without SOC data, only the charging background is shown. Durations use saved sessions and exclude ongoing or missing sessions.</p></section>`;
  }
  maxSpeed(route){const speeds=(route||[]).map(p=>p.speedMps??p.speed_mps).filter(Number.isFinite);return speeds.length?Math.max(...speeds)*3.6:null;}
  async drawMap(route,v){
    const node=this.shadowRoot.querySelector('.map');
    try{
      const L=await leaflet();if(!node.isConnected)return;
      const points=route.filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180);
      const isDriving=Boolean(v.onroad);
      const liveCoord=(isDriving&&Number.isFinite(v.latitude)&&Number.isFinite(v.longitude)&&Math.abs(v.latitude)<=90&&Math.abs(v.longitude)<=180)?[v.latitude,v.longitude]:null;
      const parkingCoord=(Number.isFinite(v.parking_latitude)&&Number.isFinite(v.parking_longitude)&&Math.abs(v.parking_latitude)<=90&&Math.abs(v.parking_longitude)<=180)?[v.parking_latitude,v.parking_longitude]:null;
      const targetPos=liveCoord||parkingCoord;
      if(!points.length&&!targetPos){node.innerHTML='<div class="empty">Waiting for valid coordinates.</div>';return;}
      this.map=L.map(node,{scrollWheelZoom:false,zoomControl:true});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(this.map);
      const marker=(pos,end,text)=>L.marker(pos,{icon:L.divIcon({className:'',html:`<div class="pin ${end?'end':''}">${text}</div>`,iconSize:[30,30],iconAnchor:[15,15]})}).addTo(this.map);
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
        const coords=points.map(p=>[p.latitude,p.longitude]);bounds=L.latLngBounds(coords);this.map.fitBounds(bounds,{padding:[32,32],maxZoom:16});marker(coords[0],false,'S');marker(coords.at(-1),true,'E');
      }else{this.map.setView(targetPos,16);marker(targetPos,false,isDriving?'<span style="font-size:10px">Live</span>':'P');bounds=L.latLngBounds([targetPos]);}
      const reset=L.control({position:'bottomright'});reset.onAdd=()=>{const b=L.DomUtil.create('button','resetmap');b.textContent='⌖ Fit view';b.setAttribute('aria-label','Fit the entire route');L.DomEvent.disableClickPropagation(b);b.onclick=()=>this.map.fitBounds(bounds,{padding:[32,32],maxZoom:16});return b;};reset.addTo(this.map);
      requestAnimationFrame(()=>this.map?.invalidateSize());
    }catch(e){if(node.isConnected)node.innerHTML=`<div class="empty">${esc(e.message)}</div>`;}
  }
}

export default CarrotDashboard;
