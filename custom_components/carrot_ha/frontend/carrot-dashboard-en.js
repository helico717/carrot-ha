// A parent's query string is not inherited by relative imports.
// Version every dependency so browser caches cannot mix different releases.
const dependencyURL = name => {
  const url = new URL(name, import.meta.url);
  const version = new URL(import.meta.url).searchParams.get('v');
  if (version) url.searchParams.set('v', version);
  return url.href;
};
const {bindChargePayments, chargeCostLabel} = await import(dependencyURL('./carrot-charge-payment.js'));
const {preserveView,updateView} = await import(dependencyURL('./carrot-view-state.js'));
const {tripDisplayEnergyWh, tripDisplayEfficiency, tripDisplayEstimated, tripEnergyWh, tripEfficiency, tripEnergyLabel, tripSoc, DEFAULT_SOC_CAPACITY_KWH, tripDays, loadRecentTrips, mergeConsecutiveCharges, mergeConsecutiveTrips, tripTimeline} = await import(dependencyURL('./carrot-trip-days.js'));
const { CarrotCamera360Modal } = await import(dependencyURL('./carrot-camera-360.js'));
const assetBase = new URL('./carrot-assets/', import.meta.url).href;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = (v, digits=1) => typeof v==='number' && Number.isFinite(v) ? v.toLocaleString('en-GB',{maximumFractionDigits:digits}) : '—';
const time = (v, tz) => v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toLocaleString('en-GB',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:tz||undefined}) : 'No records';
const timeOnly = (v, tz) => v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toLocaleString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:tz||undefined}) : 'No records';
const duration = v => typeof v==='number' ? [Math.floor(v/3600),Math.floor(v/60)%60,Math.floor(v)%60].map(x=>String(x).padStart(2,'0')).join(':') : '—';
const shortDuration = v => typeof v==='number' ? (Math.floor(v/3600)?Math.floor(v/3600)+' h ':'')+Math.floor(v/60)%60+' min' : '—';
const formatDuration = s => { if(typeof s !== 'number' || !Number.isFinite(s)) return '—'; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); if(h > 0 && m > 0) return `${h}h ${m}m elapsed`; if(h > 0) return `${h}h elapsed`; return `${m}m elapsed`; };
const chargeDuration = s => { if(typeof s !== 'number' || !Number.isFinite(s)) return '—'; if(s <= 0) return 'Done'; if(s < 60) return '< 1 min'; const totalMins = Math.round(s/60); const h = Math.floor(totalMins/60); const m = totalMins%60; if(h === 0) return `${m}m`; return m === 0 ? `${h}h` : `${h}h ${m}m`; };
const formatEtaCompletionEn = (val, tz) => {
  if (!val) return 'Calculating';
  const targetDate = new Date(val);
  if (Number.isNaN(targetDate.getTime())) return '—';
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  const dayDiff = Math.round((targetMidnight - todayMidnight) / 86400000);
  const timeStr = targetDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz || undefined });
  let dayPrefix = '';
  if (dayDiff === 1) dayPrefix = 'Tomorrow ';
  else if (dayDiff === 2) dayPrefix = 'In 2 days ';
  else if (dayDiff > 2) dayPrefix = `${targetDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: tz || undefined })} `;
  return `${dayPrefix}Done at ${timeStr}`;
};
const tripDurationEn = s => {
  if(typeof s !== 'number' || !Number.isFinite(s) || s < 0) return '';
  const totalSec = Math.round(s);
  if(totalSec < 60) return '< 1 min';
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60);
  if(h > 0 && m > 0) return `${h}h ${m}m`;
  if(h > 0) return `${h}h`;
  return `${m}m`;
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
  constructor(){super();this.attachShadow({mode:'open'});this.tab='overview';this.trips=[];this.charges=[];this.v={};this.offset=0;this.busy=false;this.isFromCache=false;this.selected=null;this.tripDay=null;this.chargeDay=null;this.batteryDay=null;this._mergeTripsEnabled=true;this._tripPage=1;this._maxTripPages=1;this._rawTrips=[];this._mergedTrips=[];this.cameraModal=null;}
  get cacheKey(){return 'carrot-cache-'+(this.config?.device_id||'default');}
  loadCache(){
    try{
      const raw=localStorage.getItem(this.cacheKey);
      if(!raw)return false;
      const cached=JSON.parse(raw);
      if(cached&&cached.v&&typeof cached.v==='object'&&Object.keys(cached.v).length){
        this.v=cached.v;
        if(Array.isArray(cached.trips)&&cached.trips.length){
          this._rawTrips=cached.trips;
          this._mergedTrips=mergeConsecutiveTrips(this._rawTrips,this._hass?.config?.time_zone,1800);
          this.trips=this._mergeTripsEnabled!==false?this._mergedTrips:this._rawTrips;
        }
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
      const cachedTrips=(this._rawTrips?.length?this._rawTrips:(this.trips||[])).slice(0,60);
      const cachedCharges=(this.charges||[]).slice(0,30);
      localStorage.setItem(this.cacheKey,JSON.stringify({v:this.v,trips:cachedTrips,charges:cachedCharges,cachedAt:Date.now()}));
    }catch(e){console.warn('Carrot HA cache save failed',e);}
  }
  setConfig(config){this.config=config;this.themeMode=config.color_mode||'auto';try{this.themeMode=localStorage.getItem('carrot-theme-'+(config.device_id||'default'))||this.themeMode;}catch{}this.applyTheme();if(!this.v||!Object.keys(this.v).length)this.loadCache();this.render();}
  applyTheme(){
    if(!['auto','light','dark'].includes(this.themeMode))this.themeMode='auto';
    const dark=this.themeMode==='auto'?(this._hass?.themes?.darkMode??window.matchMedia('(prefers-color-scheme: dark)').matches):this.themeMode==='dark';
    this.setAttribute('data-theme',dark?'dark':'light');
    if(this.cameraModal)this.cameraModal.setTheme(dark?'dark':'light');
  }
  set hass(hass){const oldCharging=this._hass?.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state;const previous=this._hass?.states?.[this.config?.online_entity||this.v?.entity_ids?.comma_online]?.state;this._hass=hass;this.applyTheme();if(!this.initialized){this.initialized=true;if(!this.v||!Object.keys(this.v).length)this.loadCache();this.load();}else if(oldCharging!==hass.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state||previous!==hass.states?.[this.config?.online_entity||this.v?.entity_ids?.comma_online]?.state){this.render();}}
  connectedCallback(){
    clearInterval(this.timer);clearInterval(this.liveTimer);
    this.timer=setInterval(()=>{if(this._hass&&!document.hidden&&this.getClientRects?.().length!==0)this.load(true);},60000);
    this.liveTimer=setInterval(()=>{if(this._hass&&!document.hidden&&this.getClientRects?.().length!==0)this.loadLive();},15000);
    this._onVisible=()=>{if(!document.hidden&&this._hass){this.loadLive();this.load(true);}};
    document.addEventListener('visibilitychange',this._onVisible);
    if(this.initialized)this._onVisible();
  }
  disconnectedCallback(){this._chargePaymentEditor?.remove();this._chargePaymentEditor=null;this.clearMiniMaps();clearInterval(this.timer);clearInterval(this.liveTimer);document.removeEventListener('visibilitychange',this._onVisible);if(this.map){this.map.remove();this.map=null;}if(this.cameraModal){try{this.cameraModal.destroy();}catch(e){}this.cameraModal=null;}}
  getCardSize(){return 8;}
  getGridOptions(){return {columns:36,rows:"auto",min_columns:6};}
  async loadLive(){
    if(this.liveBusy||!this.device)return;
    this.liveBusy=true;
    const id=encodeURIComponent(this.device.entry_id);
    const costEpoch=this._chargeCostEpoch||0;
    const apply=dash=>{
      const next={...dash.values,battery_history:this.v.battery_history};
      if(costEpoch!==(this._chargeCostEpoch||0))next.charge_cost_totals=this.v.charge_cost_totals;
      // Timestamps are displayed to the minute; avoid rebuilding maps for
      // an unchanged sample merely because its age increased by 15 seconds.
      const signature=value=>JSON.stringify(value,(key,item)=>key==='measurement_age_s'?undefined:key==='live_checked_at'&&item?String(item).slice(0,16):item);
      const changed=this.liveError||this.isFromCache||signature(next)!==signature(this.v);
      this.liveError='';
      this.v=next;this.isFromCache=false;
      if(changed){this.saveCache();this.render();}
    };
    try{
      // Publish HA's in-memory state before waiting on the cloud network.
      if(!this._liveLoaded){
        apply(await this._hass.callApi('GET',`carrot_ha/v1/dashboard/${id}?live=1`));
        this._liveLoaded=true;
      }
      apply(await this._hass.callApi('GET',`carrot_ha/v1/dashboard/${id}?live=1&refresh=1`));
    }catch(e){this.liveError=e instanceof Error?e.message:String(e);this.render();}
    finally{this.liveBusy=false;}
  }
  async load(quiet=false){
    if(this.busy){this.loadLive();return;}this.busy=true;this.error='';
    const refBtn=this.shadowRoot?.querySelector('.refresh');if(refBtn)refBtn.textContent='Refreshing…';
    try{
      if(!this.v||!Object.keys(this.v).length){
        this.loadCache();
        if(!this.v||!Object.keys(this.v).length)this.render();
      }
      const devices=await this._hass.callApi('GET','carrot_ha/v1/devices');
      const requested=this.config?.device_id;
      this.device=devices.devices.find(d=>d.device_id===requested)||(!requested?devices.devices[0]:null);
      if(!this.device)throw Error('Carrot HA device not found. Check the device_id in card configuration.');
      const id=encodeURIComponent(this.device.entry_id);
      this.loadLive();
      const costEpoch=this._chargeCostEpoch||0;
      const [,tripsRes,chargesRes]=await Promise.all([
        this._hass.callApi('GET',`carrot_ha/v1/dashboard/${id}`).then(dash=>{
          this.v={...this.v,battery_history:dash.values.battery_history,...(costEpoch===(this._chargeCostEpoch||0)?{charge_cost_totals:dash.values.charge_cost_totals}:{})};
          this.render();return dash;
        }),
        loadRecentTrips(this._hass.callApi.bind(this._hass),id),
        this._hass.callApi('GET',`carrot_ha/v1/history/${id}?kind=charge&include_excluded=1&limit=100&offset=0`)
      ]);
      const selectedStart=this.selected!==null?this.trips[this.selected]?.data?.started_at:null;
      this._rawTrips=tripsRes.events||[];
      this._mergedTrips=mergeConsecutiveTrips(this._rawTrips,this._hass?.config?.time_zone,1800);
      this.trips=this._mergeTripsEnabled!==false?this._mergedTrips:this._rawTrips;
      if(costEpoch===(this._chargeCostEpoch||0))this.charges=chargesRes.charge_costs_grouped?chargesRes.events:mergeConsecutiveCharges(chargesRes.events);
      if(selectedStart!=null){
        const idx=this.trips.findIndex(e=>e.data?.started_at===selectedStart);
        this.selected=idx!==-1?idx:null;
        if(this.selected!==null)this._pageSelection=this.selected;
      }else{
        this.selected=null;
      }
      this.saveCache();
    }catch(e){this.error=e instanceof Error?e.message:'HA request failed. Check your administrator account and integration version.';}
    finally{this.busy=false;this.render();}
  }
  clearMiniMaps(){
    if(this._mapResizeObserver){try{this._mapResizeObserver.disconnect();}catch(e){}}
    if(this._resizeRaf){cancelAnimationFrame(this._resizeRaf);this._resizeRaf=null;}
    const maps=this.miniMaps||[];this.miniMaps=[];
    for(const map of maps){try{map.remove();}catch(e){console.warn("Carrot HA: map cleanup failed",e);}}
  }
  render(){return preserveView(this,()=>this.renderContent());}
  renderContent(){
    this._renderId=(this._renderId||0)+1;
    const mapContext=JSON.stringify([this.tab,this.tripDay,this.selected===null?null:this.trips[this.selected]?.data?.started_at]);
    if(this.map&&this._mapContext===mapContext){this._mapView={center:this.map.getCenter(),zoom:this.map.getZoom()};}
    else if(this._mapContext!==mapContext){this._mapView=null;}
    this._mapContext=mapContext;
    this.clearMiniMaps();
    // Keep the interactive map alive until drawMap decides whether its data changed.
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
    updateView(this.shadowRoot,`<link rel="stylesheet" href="${assetBase}leaflet.css"><style>
      :host{display:block;container-type:inline-size;--ink:#f3f4f4;--muted:#959b9e;--line:#2b2e30;--orange:#ff8a18;--green:#72df9b;color:var(--ink);font-family:Inter,Pretendard,'Noto Sans KR',system-ui,sans-serif}
      *{box-sizing:border-box}ha-card{display:block;background:#0c0e10;border:1px solid #23272a;border-radius:26px;overflow:hidden;color:var(--ink)}button{font:inherit;cursor:pointer;color:inherit}button:focus-visible{outline:3px solid var(--orange);outline-offset:3px}button:disabled{opacity:.4;cursor:default}ha-icon{width:22px;height:22px;color:var(--muted)}.top{padding:28px 28px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px}.brand{font-size:12px;letter-spacing:3px;color:var(--muted);font-weight:650}.top h1{margin:5px 0 0;font-size:29px;letter-spacing:-1px}.badge{display:inline-flex;align-items:center;gap:8px;background:#19221d;padding:9px 12px;border-radius:30px;font-size:12px;color:var(--green);white-space:nowrap}.badge.dim{color:#b8babd;background:#222527}.dot{width:6px;height:6px;border-radius:50%;background:currentColor}.nav{display:flex;gap:5px;margin:0 28px 22px;padding:5px;background:#181b1d;border-radius:14px}.nav button{flex:1;border:0;border-radius:10px;background:transparent;padding:12px 6px;font-size:13px;font-weight:650;color:var(--muted)}.nav button.active{background:#303538;color:white}.main{padding:0 28px 26px}.tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.metric{border:1px solid var(--line);border-radius:18px;background:linear-gradient(145deg,#1d2022,#151719);padding:18px;min-width:0}.metric ha-icon{display:block;margin-bottom:12px}.label{display:block;font-size:12px;color:var(--muted);margin-bottom:8px}.metric strong{font-size:27px;font-weight:700;letter-spacing:-.6px;display:block;overflow-wrap:anywhere}.metric small{font-size:13px;margin-left:5px;font-weight:450;color:#aeb3b6;letter-spacing:0}.hint{font-size:11px;display:block;margin-top:8px;color:var(--muted);line-height:1.5}.layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(240px,1fr);gap:18px}.panel{background:#131618;border:1px solid var(--line);border-radius:20px;overflow:hidden}.paneltitle{padding:19px 20px;display:flex;align-items:center;justify-content:space-between;gap:8px}.paneltitle h2{font-size:16px;margin:0}.sub{color:var(--muted);font-size:12px;line-height:1.5}.map{height:380px;background:#14191c;z-index:0}.map .leaflet-tile-pane{filter:grayscale(1) invert(.91) hue-rotate(180deg) brightness(.8)}.leaflet-container{font:inherit}.leaflet-control-attribution{font-size:9px;background:#e4e7e7df!important;color:#222!important}.leaflet-control-attribution a{color:#26494a!important}.leaflet-bar a{background:#232729!important;color:white!important;border-color:#41464b!important}.pin-dot{display:block;width:14px;height:14px;border-radius:50%;background:#10b981;border:2.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.5),0 2px 6px rgba(0,0,0,0.5);position:relative;box-sizing:border-box;cursor:pointer;transition:transform .15s ease}.pin-dot:hover{transform:scale(1.25);z-index:1000}.pin-dot.end{background:#f97316}.pin-dot.both{width:18px;height:18px;background:#10b981;border:2.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.5),0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;cursor:pointer}.pin-dot.both .pin-core{width:8px;height:8px;border-radius:50%;background:#f97316;border:1.5px solid #fff;display:block;box-sizing:border-box}.pin-vehicle{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#2563eb;color:#fff;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.5),0 2px 6px rgba(0,0,0,0.5);position:relative;font-size:12px;font-weight:750;box-sizing:border-box;cursor:pointer}.pin-vehicle.driving{background:#10b981}.pin-vehicle svg{display:block;pointer-events:none}.pin-vehicle b{line-height:1;font-family:inherit;pointer-events:none}.pin-vehicle .pin-pulse{position:absolute;inset:-5px;border-radius:50%;border:2px solid #10b981;animation:pin-vehicle-pulse 1.8s infinite;pointer-events:none}@keyframes pin-vehicle-pulse{0%{transform:scale(0.85);opacity:0.9}100%{transform:scale(1.55);opacity:0}}.legend-dot{display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:middle;margin:0 3px 2px 1px;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);box-sizing:border-box}.legend-dot.start{background:#10b981}.legend-dot.end{background:#f97316}.legend-dot.both{width:13px;height:13px;background:#10b981;position:relative;display:inline-flex;align-items:center;justify-content:center}.legend-dot.both::after{content:'';width:5px;height:5px;border-radius:50%;background:#f97316;border:1px solid #fff;box-sizing:border-box}.pin{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--green);color:#07130b;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);font-size:11px;font-weight:bold}.pin.end{background:var(--orange)}.route-caption{padding:16px 20px;border-top:1px solid var(--line)}.legend{display:flex;align-items:center;gap:10px;font-size:11px;color:#bcc1c3;margin-bottom:10px}.gradient{height:5px;background:linear-gradient(90deg,#f4511e 0%,#ffb300 35%,#92cd00 65%,#00a843 100%);flex:1;border-radius:10px}.tripbtn{width:100%;text-align:left;padding:17px 18px;border:0;border-top:1px solid var(--line);background:transparent;display:flex;justify-content:space-between;gap:12px;align-items:center}.tripbtn.selected{background:#29251e;border-left:3px solid var(--orange)}.tripbtn b{display:flex;align-items:baseline;flex-wrap:wrap;font-size:13px;margin-bottom:6px}.tripbtn strong{font-size:21px;white-space:nowrap}.tripbtn small{font-size:11px;color:var(--muted)}.trip-dur{font-weight:400;font-size:12px;color:var(--muted);margin-left:6px}.trip-soc{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:#34d399;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.28);padding:2px 7px;border-radius:6px;letter-spacing:-.2px;white-space:nowrap;line-height:1.2}:host([data-theme="light"]) .trip-soc{background:#dcfce7;color:#15803d;border-color:#86efac}.trip-soc ha-icon{--mdc-icon-size:14px;width:14px;height:14px;display:inline-block;color:currentColor;vertical-align:middle}.trip-eff{font-weight:600;font-size:11.5px;color:#38bdf8;background:rgba(56,189,248,.12);padding:2px 7px;border-radius:6px;border:1px solid rgba(56,189,248,.25);letter-spacing:-.2px;white-space:nowrap;line-height:1.2}:host([data-theme="light"]) .trip-eff{background:#e0f2fe;color:#0284c7;border-color:#bae6fd}.scroll{max-height:480px;overflow:auto}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.section{font-size:16px;margin:26px 0 14px}.row{display:flex;justify-content:space-between;gap:15px;padding:15px 20px;border-top:1px solid var(--line);font-size:13px}.row span{color:var(--muted)}.row b{text-align:right}.empty{padding:50px 24px;text-align:center;color:var(--muted);line-height:1.8;font-size:13px}.foot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px;color:var(--muted);font-size:11px}.refresh,.page{background:#202528;border:1px solid #343a3e;border-radius:10px;padding:10px 13px;white-space:nowrap;font-size:12px}.error{border:1px solid #814f25;background:#32241b;color:#ffd8af;padding:14px;border-radius:12px;margin-bottom:16px;font-size:13px}.pages{padding:12px;display:flex;justify-content:space-between;align-items:center}.batterybar{height:6px;background:#2d3433;border-radius:8px;margin:12px 0 4px;overflow:hidden}.batterybar i{display:block;height:100%;background:var(--green)}.allvalues{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}.table-row{display:flex;justify-content:space-between;gap:12px;padding:15px 0;border-bottom:1px solid var(--line);font-size:13px}.table-row span{color:var(--muted)}.notice{margin:14px 0;color:var(--muted);font-size:12px;line-height:1.7}.detailstats{margin-top:16px}.mono{font-variant-numeric:tabular-nums}details{margin-top:18px;color:var(--muted);font-size:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto}.resetmap{font:inherit;background:#232729;color:white;border:0;padding:8px;cursor:pointer}
      @container(max-width:650px){.top{padding:23px 18px 16px}.top h1{font-size:25px}.brand{font-size:10px}.badge{font-size:10px;padding:8px}.nav{margin:0 18px 18px}.main{padding:0 18px 22px}.tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.metric{padding:16px;border-radius:17px}.metric strong{font-size:26px}.layout{grid-template-columns:1fr}.map{height:370px}.allvalues{grid-template-columns:1fr}.scroll{max-height:320px}.foot{align-items:flex-start}.paneltitle{padding:16px}.row{padding:14px 16px}.grid2{gap:10px}}@container(min-width:1000px){.map{height:440px}.top h1{font-size:32px}.metric strong{font-size:31px}}

      :host{width:100%;min-width:0}ha-card{max-width:1440px;margin:auto}.top{padding:20px 24px 12px}.top h1{font-size:25px}.brand{font-size:10px}.nav{margin:0 24px 16px}.main{padding:0 24px 18px}.foot{margin-top:14px}.foot div{line-height:1.6}.cockpit{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:20px}.hero{position:relative;min-height:350px;overflow:hidden;border-radius:20px;background:radial-gradient(ellipse at 65% 80%,#c2cdd0,#e5e9e6 75%);color:#17272d}.hero-copy{position:relative;z-index:1;padding:24px}.hero-copy small{font-size:11px;letter-spacing:2px}.hero-copy h2{font-size:36px;line-height:1.15;margin:10px 0 0;letter-spacing:-1.5px}.hero .car-image{position:absolute;width:100%;height:100%;object-fit:cover;inset:0 0 auto;pointer-events:none}.quick{display:flex;flex-direction:column;gap:12px;min-width:0}.energy{background:#18221f;border:1px solid #34463e;border-radius:18px;padding:18px}.energy-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.energy-head strong{font-size:42px;line-height:1}.energy-head strong small{font-size:16px;color:#a9bdb0}.energy-head span{font-size:12px;color:#a9bdb0}.energy p{margin:8px 0 0;font-size:12px;color:#b8c9bf}.quick-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px}.quick-metrics .metric{padding:13px}.quick-metrics .metric strong{font-size:22px}.quick-metrics .metric ha-icon{display:none}.quick-metrics .label{margin-bottom:6px}.shortcut{display:flex;align-items:center;text-align:left;justify-content:space-between;width:100%;padding:15px;border-radius:15px;border:1px solid var(--line);background:#181c1e;gap:12px}.shortcut b{display:block;font-size:13px}.shortcut small{display:block;color:var(--muted);font-size:11px;margin-top:5px}.shortcut em{font-style:normal;color:var(--green)}.overview-links{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.mini-condition{display:flex;justify-content:space-around;gap:8px;border-top:1px solid var(--line);padding-top:13px;margin-top:14px;color:#b9c0c3;font-size:12px}.mini-condition span{white-space:nowrap}.mini-condition b{color:var(--ink)}
      @container(max-width:700px){.top{padding:15px 16px 10px}.top h1{font-size:22px}.brand{font-size:9px;letter-spacing:2px}.nav{margin:0 16px 12px}.nav button{padding:10px 4px;font-size:12px}.main{padding:0 16px 14px}.cockpit{grid-template-columns:1fr;gap:12px}.hero{min-height:160px}.hero-copy{padding:17px}.hero-copy h2{font-size:28px;max-width:160px}.hero .car-image{width:83%;height:250px;left:20%;top:-48px;object-fit:cover}.energy{padding:13px 15px}.energy-head strong{font-size:34px}.batterybar{margin:10px 0 4px}.quick{gap:10px}.quick-metrics .metric{padding:11px 13px}.quick-metrics .metric strong{font-size:21px}.quick-metrics .label{font-size:11px}.quick-metrics .metric:nth-child(n+3){display:none}.overview-links{margin-top:10px}.shortcut{padding:12px}.shortcut small{line-height:1.5}.mini-condition{margin-top:10px;padding-top:10px;font-size:11px}.foot{font-size:10px;gap:8px}.foot .refresh{padding:9px}.map{height:310px}.metric ha-icon{margin-bottom:7px}.metric{padding:12px}.metric strong{font-size:23px}}@container(max-width:360px){.hero .car-image{left:15%;width:90%}.hero-copy h2{font-size:24px}.mini-condition{flex-wrap:wrap}.overview-links{grid-template-columns:1fr}.badge{font-size:9px}}

   .trip-days,.charge-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:0 10px 15px}.charge-days{max-width:480px;margin:0 auto 12px;gap:4px}.trip-day,.charge-day{max-width:54px;margin:0 auto;width:100%;min-width:0;border:1px solid transparent;border-radius:13px;padding:6px 2px;background:rgba(255,255,255,.025);color:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;transition:all .18s ease}.trip-day:hover,.charge-day:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.08)}.trip-day[aria-pressed="true"],.charge-day[aria-pressed="true"]{background:linear-gradient(180deg,#1d4ed8 0%,#1e40af 100%);border-color:#60a5fa;box-shadow:0 3px 10px rgba(29,78,216,.45);color:#fff}.trip-day[aria-pressed="true"] b,.charge-day[aria-pressed="true"] b{color:#fff;font-weight:700}.trip-day[aria-pressed="true"] .trip-today,.charge-day[aria-pressed="true"] .charge-today{color:#e0f2fe;font-weight:750}.trip-day[aria-pressed="true"] .trip-count,.charge-day[aria-pressed="true"] .charge-count{color:#dbeafe;font-weight:600}.trip-day[aria-pressed="true"] .trip-count ha-icon,.charge-day[aria-pressed="true"] .charge-count ha-icon{color:#dbeafe}:host([data-theme="light"]) .trip-day[aria-pressed="true"],:host([data-theme="light"]) .charge-day[aria-pressed="true"]{background:#dbeafe;border-color:#3b82f6;box-shadow:0 2px 8px rgba(59,130,246,.25);color:#1e3a8a}:host([data-theme="light"]) .trip-day[aria-pressed="true"] b,:host([data-theme="light"]) .charge-day[aria-pressed="true"] b{color:#1e3a8a}:host([data-theme="light"]) .trip-day[aria-pressed="true"] .trip-today,:host([data-theme="light"]) .charge-day[aria-pressed="true"] .charge-today{color:#1d4ed8}:host([data-theme="light"]) .trip-day[aria-pressed="true"] .trip-count,:host([data-theme="light"]) .charge-day[aria-pressed="true"] .charge-count{color:#1e40af}:host([data-theme="light"]) .trip-day[aria-pressed="true"] .trip-count ha-icon,:host([data-theme="light"]) .charge-day[aria-pressed="true"] .charge-count ha-icon{color:#1e40af}.trip-day b,.charge-day b{font-size:11px;white-space:nowrap;color:#d1d5db}.trip-today,.charge-today{height:12px;line-height:12px;font-size:10px;color:#60a5fa;font-weight:600}:host([data-theme="light"]) .trip-today,:host([data-theme="light"]) .charge-today{color:#2563eb}.trip-count,.charge-count{display:flex;align-items:center;justify-content:center;gap:3px;font-size:11px;line-height:12px;color:var(--muted)}.trip-count ha-icon{--mdc-icon-size:10px;width:10px;height:12px}.charge-count ha-icon{--mdc-icon-size:11px;width:11px;height:12px}.trip-day-heading{padding:13px 22px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}.charge-row{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-top:1px solid var(--line);font-size:13px;gap:12px}.charge-meta{display:flex;align-items:center;gap:14px;text-align:left;min-width:0;flex:1 1 auto}.charge-meta>div{min-width:0;text-align:left}.charge-icon-wrap,:host([data-theme="light"]) .charge-icon-wrap{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#edf4fe;color:#2563eb;flex-shrink:0}:host([data-theme="dark"]) .charge-icon-wrap{background:#162235;color:#60a5fa}.charge-icon-wrap.fast,:host([data-theme="light"]) .charge-icon-wrap.fast{background:#dbeafe;color:#1d4ed8}:host([data-theme="dark"]) .charge-icon-wrap.fast{background:#1e355b;color:#93c5fd}.charge-bolt{width:20px;height:20px;display:block;fill:currentColor}.charge-date{font-size:14px;font-weight:650;display:block;margin-bottom:4px;text-align:left!important;white-space:normal;overflow-wrap:anywhere}.charge-info-sub{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);text-align:left!important;flex-wrap:wrap}.charge-dur{color:var(--muted);font-size:12px;white-space:nowrap;flex-shrink:0}.speed-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:-0.2px;line-height:15px;white-space:nowrap;flex-shrink:0}.speed-badge.slow,:host([data-theme="light"]) .speed-badge.slow{background:#edf4fe;color:#2563eb}:host([data-theme="dark"]) .speed-badge.slow{background:#162235;color:#60a5fa}.speed-badge.fast,:host([data-theme="light"]) .speed-badge.fast{background:#dbeafe;color:#1e40af}:host([data-theme="dark"]) .speed-badge.fast{background:#1e355b;color:#93c5fd}.merge-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:-0.2px;line-height:15px;background:#f3e8ff;color:#6b21a8;white-space:nowrap;flex-shrink:0}:host([data-theme="dark"]) .merge-badge{background:#3b1d54;color:#e9d5ff}.charge-row .charge-soc{display:inline-flex;align-items:center;gap:4px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);color:#34d399;font-size:11.5px;font-weight:750;padding:2px 8px;border-radius:6px;white-space:nowrap;line-height:15px;flex-shrink:0}:host([data-theme="light"]) .charge-row .charge-soc{background:#d1fae5;border-color:#86efac;color:#047857}.charge-row .charge-soc.retro-mode{background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.35);color:#fbbf24}:host([data-theme="light"]) .charge-row .charge-soc.retro-mode{background:#fef3c7;border-color:#fde68a;color:#b45309}.charge-row .charge-soc-icon{--mdc-icon-size:12px !important;width:12px !important;height:12px !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;line-height:0 !important;margin:0 !important;padding:0 !important;color:inherit !important;fill:currentColor !important;flex-shrink:0 !important}.charge-row .charge-soc-icon svg,.charge-row svg.charge-soc-icon{display:block !important;width:12px !important;height:12px !important;margin:auto !important}.charge-val{text-align:right;flex-shrink:0;max-width:55%;display:flex;flex-direction:column;align-items:flex-end;gap:2px}.charge-val strong{font-size:14px;font-weight:700;color:var(--ink);line-height:1.25;display:flex;align-items:baseline;justify-content:flex-end;gap:3px;white-space:nowrap}.charge-val strong small{font-size:11px;font-weight:500;color:var(--muted);margin-left:2px}.charge-sub{display:block;font-size:11px;font-weight:normal;color:var(--muted);margin-top:1px;word-break:keep-all;line-height:1.2;white-space:nowrap}@media(min-width:901px){.layout:has(.trip-history){grid-template-columns:minmax(0,1.15fr) minmax(460px,1fr)!important}}@media(max-width:420px){.trip-days,.charge-days{padding-left:3px;padding-right:3px;gap:2px}.trip-day,.charge-day{border-radius:10px;padding:5px 1px}.trip-day b,.charge-day b{font-size:10px}.trip-today,.charge-today{font-size:9px;height:10px;line-height:10px}.trip-count,.charge-count{font-size:10px;line-height:10px}}
.day-timeline-wrap{padding:10px 14px 12px;background:rgba(0,0,0,0.18);border-top:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:6px}
:host([data-theme="light"]) .day-timeline-wrap{background:rgba(0,0,0,0.025)}
.day-timeline-topline{display:flex;justify-content:space-between;align-items:center;font-size:12px;flex-wrap:wrap;gap:6px}
.day-timeline-title strong{color:var(--ink);font-weight:750;font-size:12px}
.day-timeline-merge-sub{color:var(--muted);font-size:11px;margin-left:4px}
.merge-toggle-badge{background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.35);font-size:11px;font-weight:700;padding:3px 9px;border-radius:8px;cursor:pointer;transition:all .15s ease}
:host([data-theme="light"]) .merge-toggle-badge{background:#f3e8ff;color:#7e22ce;border-color:#d8b4fe}
.merge-toggle-badge:hover{background:rgba(168,85,247,0.3);transform:translateY(-1px)}
.merge-toggle-badge.off{background:rgba(148,163,184,0.15);color:#94a3b8;border-color:rgba(148,163,184,0.3)}
.day-timeline-scale{display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted);font-weight:700;padding:0 1px;user-select:none}
.day-timeline-rail{position:relative;width:100%;height:20px;background:rgba(255,255,255,0.05);border-radius:6px;overflow:hidden;border:1px solid var(--line)}
:host([data-theme="light"]) .day-timeline-rail{background:rgba(0,0,0,0.04)}
.timeline-trip-segment{position:absolute;top:2px;bottom:2px;border-radius:4px;background:linear-gradient(135deg,#2563eb,#38bdf8);cursor:pointer;transition:all .15s ease;box-shadow:0 1px 4px rgba(37,99,235,0.3)}
.timeline-trip-segment:hover,.timeline-trip-segment.selected{background:#ff8a18;box-shadow:0 0 10px rgba(255,138,24,0.9);z-index:5}
.trip-grid-container{padding:12px 14px 14px;display:flex;flex-direction:column;justify-content:space-between;min-height:340px}
.trip-grid-2x4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@container(max-width:500px){.trip-grid-2x4{grid-template-columns:1fr;gap:6px}}
.sleek-trip-card{background:var(--surface,rgba(255,255,255,0.03));border:1px solid var(--line);border-radius:12px;padding:9px 12px;display:flex;flex-direction:column;gap:6px;cursor:pointer;transition:all .16s ease;text-align:left;position:relative}
:host([data-theme="light"]) .sleek-trip-card{background:#ffffff}
.sleek-trip-card:hover{border-color:rgba(56,189,248,0.5);background:rgba(255,255,255,0.06);transform:translateY(-1px)}
:host([data-theme="light"]) .sleek-trip-card:hover{background:#f8fafc}
.sleek-trip-card.selected{border-color:#ff8a18;background:rgba(255,138,24,0.1);box-shadow:0 0 0 1px #ff8a18}
.card-top-row{display:flex;justify-content:space-between;align-items:baseline}
.card-time{font-size:12px;font-weight:750;color:var(--ink)}
.card-dur{font-size:11px;color:var(--muted);font-weight:500;margin-left:4px}
.card-dist{font-size:15px;font-weight:850;color:var(--ink);letter-spacing:-0.3px;white-space:nowrap}
.card-dist small{font-size:10.5px;font-weight:500;color:var(--muted)}
.card-badges-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.soc-used-tag{font-size:10px;color:#6ee7b7;font-weight:600;opacity:0.95;margin-left:2px}
:host([data-theme="light"]) .soc-used-tag{color:#166534}
.trip-merge-badge{display:inline-flex;align-items:center;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.3);white-space:nowrap;line-height:1.2}
:host([data-theme="light"]) .trip-merge-badge{background:#f3e8ff;color:#7e22ce;border-color:#d8b4fe}
.panel-pagination{display:flex;justify-content:space-between;align-items:center;padding:10px 4px 0;margin-top:10px;border-top:1px solid var(--line)}
.page-nav-btn{border:1px solid var(--line);background:rgba(255,255,255,0.04);color:var(--ink);font-size:11.5px;font-weight:700;padding:5px 12px;border-radius:8px;cursor:pointer;transition:all .15s ease}
:host([data-theme="light"]) .page-nav-btn{background:#f1f5f9}
.page-nav-btn:hover:not(:disabled){background:#2563eb;color:#fff;border-color:#3b82f6}
.page-nav-btn:disabled{opacity:0.3;cursor:not-allowed}
.page-indicator-text{font-size:11px;font-weight:700;color:var(--muted)}
.charge-date span{display:inline-block;white-space:nowrap}
@container(max-width:500px){.charge-row{flex-wrap:wrap;padding:14px}.charge-meta{flex:1 0 140px;gap:8px}.charge-icon-wrap{width:32px;height:32px}.charge-val{max-width:100%;margin-left:auto}}
.charge-payment-pill{align-self:flex-end;border:1px solid var(--line);border-radius:999px;background:rgba(128,128,128,.16);color:var(--muted);padding:4px 10px;font:inherit;font-size:11px;cursor:pointer;margin-bottom:3px}.charge-payment-pill:hover{background:rgba(128,128,128,.28)}
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

.trip-soc.trip-missing,.trip-eff.trip-missing,:host([data-theme="dark"]) .trip-soc.trip-missing,:host([data-theme="dark"]) .trip-eff.trip-missing{background:rgba(239,68,68,.12)!important;border-color:rgba(239,68,68,.4)!important;color:#fca5a5!important}:host([data-theme="light"]) .trip-soc.trip-missing,:host([data-theme="light"]) .trip-eff.trip-missing{background:#fee2e2!important;border-color:#fca5a5!important;color:#b91c1c!important}.trip-missing .soc-used-tag,:host([data-theme="light"]) .trip-missing .soc-used-tag{color:inherit!important}
</style><ha-card><header class="top"><div><div class="brand">VOLKSWAGEN · CARROT HA</div><h1>${esc(this.config?.vehicle_name||this.v?.vehicle_model||'Volkswagen MEB')}</h1></div><span class="badge ${state.key}"><i class="dot"></i>${badge}</span></header><nav class="nav">${[['overview','My car'],['trips','Trips'],['parking','Location'],['charge','Charging'],['vehicle','Status']].map(([key,label])=>`<button data-tab="${key}" class="${this.tab===key?'active':''}">${label}</button>`).join('')}</nav><main class="main">${this.error||this.liveError?`<div class="error">${esc(this.error||this.liveError)}</div>`:''}${this.body(v,trip,isTrip)}<footer class="foot"><div>Cloudflare · ${esc(v.live_status||v.cloud_status||(this.busy?'Checking connection…':'Checking connection'))}<br>Last check ${time(v.live_checked_at||v.last_sync)}<br>Vehicle data received ${time(v.measured_at)}${this.isFromCache?' (updating…)':''}</div><button class="refresh">${this.busy?'Loading…':'↻ Refresh'}</button></footer></main></ha-card>`);
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
      :host([data-theme="light"]) .pin-dot,:host([data-theme="light"]) .pin-vehicle{box-shadow:0 0 0 1px rgba(0,0,0,0.18),0 2px 5px rgba(0,0,0,0.25)}
      :host([data-theme="light"]) .legend-dot{border-color:rgba(0,0,0,0.15);box-shadow:0 1px 2px rgba(0,0,0,0.15)}
      :host([data-theme="light"]) .legend-dot.both::after{border-color:#fff}
      :host([data-theme="dark"]) .pin-dot,:host([data-theme="dark"]) .pin-vehicle{box-shadow:0 0 0 1px rgba(0,0,0,0.7),0 3px 8px rgba(0,0,0,0.65)}
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
      .battery-label{display:flex;align-items:center;gap:10px;min-width:0}.energy-head .battery-label span,:host([data-theme="light"]) .energy-head .battery-label span{font-size:24px;font-weight:650;color:#fff;word-break:keep-all}.battery-label ha-icon{--mdc-icon-size:26px;--iron-icon-width:26px;--iron-icon-height:26px;width:26px;height:26px;color:#fff;fill:#fff;flex-shrink:0}
      .quick-metrics .metric.charge-eta strong{font-size:20px;line-height:1.4}
      :host([data-theme="light"]) ha-card{background:#fff}
      :host([data-theme="light"]) .nav button.active{color:#1260e8}
      @container(max-width:700px){.energy{min-height:100px}.energy-head .soc-value{font-size:44px}.battery-label ha-icon{--mdc-icon-size:22px;--iron-icon-width:22px;--iron-icon-height:22px;width:22px;height:22px}.battery-label{gap:6px}.energy-head .battery-label span,:host([data-theme="light"]) .energy-head .battery-label span{font-size:20px}.energy-head .soc-value{font-size:36px;gap:4px}.energy-head .soc-value small{font-size:20px}.quick-metrics .metric.charge-eta strong{font-size:17px}}
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
      .energy-head.charging-left .charge-status-label{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,0.95);letter-spacing:0.3px;text-shadow:0 1px 2px rgba(0,0,0,0.35)}
      :host([data-theme="light"]) .energy-head.charging-left .charge-status-label{color:#ffffff}
      .energy-head .soc-value,.energy-head.charging-left .soc-value{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;display:flex;align-items:baseline;gap:4px;font-size:48px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1px}
      .energy-head .soc-value small,.energy-head.charging-left .soc-value small{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;font-size:24px;font-weight:700;color:#fff;letter-spacing:normal}
      .energy-head .battery-label{display:flex;align-items:center;gap:10px}
      .energy-head .battery-label span,:host([data-theme="light"]) .energy-head .battery-label span{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px}
      .battery-head-icon{--mdc-icon-size:26px !important;--iron-icon-width:26px !important;--iron-icon-height:26px !important;width:26px !important;height:26px !important;color:#ffffff !important;fill:#ffffff !important;flex-shrink:0;opacity:0.95;filter:drop-shadow(0 0 4px rgba(255,255,255,0.4));display:inline-flex;align-items:center;justify-content:center}
      :host([data-theme="light"]) .battery-head-icon{color:#ffffff !important;fill:#ffffff !important}
      .charge-head-bolt{width:26px;height:34px;fill:#4ade80 !important;flex-shrink:0;margin-right:8px;filter:drop-shadow(0 0 6px rgba(74,222,128,0.6))}
      :host([data-theme="light"]) .charge-head-bolt{fill:#4ade80 !important}
      @container(max-width:700px){
        .energy-head .soc-value,.energy-head.charging-left .soc-value{font-size:38px !important}
        .energy-head .soc-value small,.energy-head.charging-left .soc-value small{font-size:20px !important}
        .energy-head .battery-label span{font-size:18px !important}
        .battery-head-icon{--mdc-icon-size:22px !important;--iron-icon-width:22px !important;--iron-icon-height:22px !important;width:22px !important;height:22px !important}
        .charge-head-bolt{width:22px;height:30px;margin-right:6px}
        .quick-metrics .metric:nth-child(n+3){display:block !important}
      }
      .quick-metrics .metric.charge-power strong{color:#4ade80 !important}
      :host([data-theme="light"]) .quick-metrics .metric.charge-power strong{color:#16a34a !important}
      .charge-head-main{display:flex;align-items:center;gap:12px}
      .charge-status-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px}
      .charge-power-tag{display:inline-flex;align-items:center;font-family:Inter,-apple-system,sans-serif;font-size:12px;font-weight:750;padding:2px 8px;border-radius:6px;background:rgba(0,0,0,0.35);color:#ffffff !important;border:1px solid rgba(255,255,255,0.22)}
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
    themeStyle.textContent+=`
      .mini-condition-camera-btn{display:inline-flex !important;align-items:center !important;gap:6px !important;background:linear-gradient(135deg,#1260e8 0%,#0c43ad 100%) !important;color:#ffffff !important;border:1px solid rgba(255,255,255,0.25) !important;box-shadow:0 2px 8px rgba(18,96,232,0.35) !important;padding:6px 14px !important;border-radius:10px !important;font-size:12px !important;font-weight:700 !important;cursor:pointer !important;min-height:38px !important;min-width:44px !important;box-sizing:border-box !important;transition:all 0.18s ease !important}
      .mini-condition-camera-btn svg{stroke:#ffffff !important}
      .mini-condition-camera-btn:hover{background:linear-gradient(135deg,#1b6ef3 0%,#124ec2 100%) !important;border-color:rgba(255,255,255,0.4) !important;box-shadow:0 4px 14px rgba(18,96,232,0.5) !important;color:#ffffff !important;transform:translateY(-1px) !important}
      .mini-condition-camera-btn:focus-visible{outline:2px solid #60a5fa !important;outline-offset:2px !important}
      :host([data-theme="light"]) .mini-condition-camera-btn{background:linear-gradient(135deg,#1260e8 0%,#0c43ad 100%) !important;color:#ffffff !important;border:1px solid rgba(18,96,232,0.35) !important;box-shadow:0 2px 8px rgba(18,96,232,0.3) !important}
      :host([data-theme="light"]) .mini-condition-camera-btn:hover{background:linear-gradient(135deg,#1b6ef3 0%,#124ec2 100%) !important;box-shadow:0 4px 14px rgba(18,96,232,0.45) !important;color:#ffffff !important}
      .mini-condition-camera-disabled{display:inline-flex !important;align-items:center !important;gap:5px !important;color:#64748b !important;font-size:11.5px !important;cursor:not-allowed !important;padding:6px 8px !important;min-height:38px !important;box-sizing:border-box !important}
      .mini-condition-camera.is-hidden{display:inline-block !important;visibility:hidden !important;min-width:44px !important;min-height:38px !important}
    `;
    this.shadowRoot.append(themeStyle);
    if(this.cameraModal?.wrapper&&!this.shadowRoot.contains(this.cameraModal.wrapper)){
      this.shadowRoot.appendChild(this.cameraModal.wrapper);
    }
    const isDrivingState=state.key==='driving'||v.onroad===true;
    if(isDrivingState&&this.cameraModal&&this.cameraModal.isOpen){
      this.cameraModal.setState('stopped','Driving detected: camera monitoring automatically stopped for safety.');
      this.cameraModal.cleanupSession();
    }
    const camBtn=this.shadowRoot.querySelector('#camera360Trigger');
    if(camBtn){
      camBtn.onclick=(e)=>{
        e.preventDefault();
        e.stopPropagation();
        this.openCamera360(camBtn);
      };
    }
    this.shadowRoot.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{
      const idx=Number(b.dataset.day);
      this.batteryDay=idx;
      const bDate=b.dataset.date||this.v?.battery_history?.[idx]?.date;
      if(bDate)this.chargeDay=bDate;
      this.render();
    });

    const themeControl=document.createElement('label');themeControl.className='theme-control';
    themeControl.innerHTML='Theme <select aria-label="Theme"><option value="auto">Auto · HA theme</option><option value="light">Light</option><option value="dark">Dark</option></select>';
    const select=themeControl.querySelector('select');select.value=this.themeMode||'auto';
    select.onchange=()=>{this.themeMode=select.value;try{localStorage.setItem('carrot-theme-'+(this.config?.device_id||'default'),this.themeMode);}catch{}this.applyTheme();};
    this.shadowRoot.querySelector('main').append(themeControl);
    this.shadowRoot.querySelector('.refresh').onclick=()=>this.load();
    this.shadowRoot.querySelectorAll('[data-trip-day]').forEach(b=>b.onclick=(e)=>{if(e){e.preventDefault();e.stopPropagation();}this.tripDay=b.dataset.tripDay;this.selected=null;this._tripPage=1;this.render();});
    const mergeBtn=this.shadowRoot.querySelector('#btnToggleTripMerge');
    if(mergeBtn){
      mergeBtn.onclick=(e)=>{
        e.preventDefault();e.stopPropagation();
        this._mergeTripsEnabled=!(this._mergeTripsEnabled!==false);
        this.trips=this._mergeTripsEnabled?this._mergedTrips:this._rawTrips;
        this.selected=null;
        this._tripPage=1;
        this.render();
      };
    }
    this.shadowRoot.querySelectorAll('[data-nav-page]').forEach(b=>b.onclick=(e)=>{
      e.stopPropagation();
      const dir=b.dataset.navPage;
      if(dir==='prev'){
        this._tripPage=Math.max(1,(this._tripPage||1)-1);
      }else if(dir==='next'){
        this._tripPage=Math.min(this._maxTripPages||1,(this._tripPage||1)+1);
      }
      this.render();
    });
    bindChargePayments(this,true);
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
        copyBtn.innerHTML=`${icon('check')} <span>Copied!</span>`;
        setTimeout(()=>{if(copyBtn.isConnected){copyBtn.classList.remove('copied');copyBtn.innerHTML=`${icon('content-copy')} <span>Copy all</span>`;}},2000);
      }catch(err){
        copyBtn.innerHTML=`${icon('alert-circle-outline')} <span>Copy failed</span>`;
        setTimeout(()=>{if(copyBtn.isConnected){copyBtn.classList.remove('copied');copyBtn.innerHTML=`${icon('content-copy')} <span>Copy all</span>`;}},2000);
      }
    };
    if(this.tab==='overview')this.drawMiniMaps(v).catch(()=>{this.shadowRoot.querySelectorAll('.mini-map').forEach(node=>{node.textContent='Unable to load the map';});});
    if (typeof window !== 'undefined' && window.ResizeObserver) {
      this._mapResizeObserver = new ResizeObserver(() => {
        if (!this._resizeRaf) {
          this._resizeRaf = requestAnimationFrame(() => {
            this._resizeRaf = null;
            if (this.miniMaps && this.miniMaps.length) {
              this.miniMaps.forEach(m => {
                try { m.invalidateSize(); } catch (e) {}
              });
            }
          });
        }
      });
      this.shadowRoot?.querySelectorAll('.mini-map').forEach(el => {
        this._mapResizeObserver.observe(el);
      });
    }
    if(!this.shadowRoot.querySelector('.map')&&this.map){this.map.remove();this.map=null;}
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
      let auxStatus='Normal · No discharge risk';
      if(typeof v.aux_voltage==='number'){
        if(v.aux_voltage<12.0)auxStatus='Warning · Low voltage';
        else if(v.aux_voltage<12.4)auxStatus='Normal · Stable voltage';
      }
      const tiles=`
        ${metric('Battery level',n(v.soc_percent,0),'%',batteryIconName(v.soc_percent),`${n(v.battery_kwh,1)} kWh stored`)}
        ${metric('Odometer',n(v.odometer_km,0),'km','counter','Odometer reading')}
        ${isDriving?metric('Current speed',n(v.speed_kph,0),'km/h','speedometer','Live cluster speed'):metric('12V battery',n(v.aux_voltage,1),'V','car-battery',auxStatus)}
        ${metric('Outside temp',n(v.outside_temp_c,1),'°C','thermometer','Ambient temp')}
      `;
      const lat=isDriving?(v.latitude??v.parking_latitude):v.parking_latitude;
      const lng=isDriving?(v.longitude??v.parking_longitude):v.parking_longitude;
      const timeStr=isDriving?`Live update ${time(v.measured_at, this._hass?.config?.time_zone)}`:`Recorded ${time(v.parking_at, this._hass?.config?.time_zone)}`;
      const chipHtml=isDriving
        ?`<span class="parking-chip-badge driving"><i class="dot pulse"></i>Driving (live)</span>`
        :`<span class="parking-chip-badge"><i class="dot"></i>Parked${parkDur&&parkDur!=='—'?` · ${esc(parkDur)} ago`:''}</span>`;
      const captionSub=isDriving
        ?'Current vehicle position · Will be updated to new parking location when trip ends'
        :'Last recorded parking location';
      return `<section class="panel"><div class="paneltitle parking-heading"><div class="parking-heading-wrap"><div class="parking-heading-left"><h2>${isDriving?'Vehicle location':'Parking location'}</h2>${chipHtml}</div><span class="sub">${timeStr}</span></div></div><div class="map"></div><div class="route-caption"><b>${lat==null?'Waiting for location':`${n(lat,5)}, ${n(lng,5)}`}</b><p class="sub">${captionSub}</p></div></section><div class="tiles parking-tiles">${tiles}</div>`;
    }
    if(this.tab==='vehicle')return this.vehicleStatusView(v);
    if(this.tab==='charge'){
      let slowKwh = v.month_slow_kwh;
      let fastKwh = v.month_fast_kwh;
      let totalKwh = v.month_charge_kwh;
      const costKrw = v.charge_cost_totals?.effective_cost_krw ?? v.month_charge_cost ?? 0;
      if (slowKwh == null || fastKwh == null) {
        let sSum = 0, fSum = 0, hasCharges = false;
        const now = new Date();
        const curY = now.getFullYear(), curM = now.getMonth();
        for (const e of (this.charges || []).filter(e=>!e?.data?.excluded)) {
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
      return `<div class="charge-layout">${this.batteryHistory()}<div class="charge-sidebar"><div class="tiles charge-sidebar-tiles">${metric('Charged this month',n(totalKwh),'kWh','battery-plus')}${metric('Charging cost this month',n(costKrw,0),'KRW','cash',chargeCostLabel(v.charge_cost_totals,true))}${metric('Slow charging (estimated)',n(slowKwh),'kWh','power-plug')}${metric('Fast charging (estimated)',n(fastKwh),'kWh','flash')}</div>${this.chargeHistory()}</div></div><p class="notice">Estimated from battery energy increases. Up to 11 kW is classified as slow charging. Costs combine entered actual payments and preset estimates for charges without an entry.${v.charge_cost_totals?` Actual ${n(v.charge_cost_totals.actual_cost_krw,0)} KRW + unentered estimate ${n(v.charge_cost_totals.estimated_cost_krw,0)} KRW.`:''} No measurements are available when the vehicle is asleep or comma is off.</p>`;
    }
    const isSpecificTrip=isTrip&&this.selected!==null&&Boolean(this.trips[this.selected]);
    const curTrip=isSpecificTrip?(this.trips[this.selected]?.data||{}):{};
    // API trips already contain distance repairs. Display merging must not
    // change which measured trips contribute to the daily totals.
    const summaryTrips=this._rawTrips?.length?this._rawTrips:this.trips.flatMap(e=>
      e.data?.merge_parts?.length?e.data.merge_parts.map(data=>({...e,data})):[e]);
    const days=isTrip?tripDays(summaryTrips,this._hass?.config?.time_zone):[];
    const curDayObj=isTrip?days.find(d=>d.key===this.tripDay):null;
    const dayIndices=curDayObj?.indices||[];
    const dayTrips=dayIndices.map(i=>summaryTrips[i]?.data).filter(Boolean);

    let tiles='';
    if(isTrip){
      const capacity = v?.soc_capacity_kwh || DEFAULT_SOC_CAPACITY_KWH;
      if(isSpecificTrip){
        const distVal=curTrip.distance_m!=null?(curTrip.distance_estimated?'≈ ':'')+n(curTrip.distance_m/1000,2):'—';
        const durVal=curTrip.duration_s!=null?duration(curTrip.duration_s):'—';
        const eff = tripDisplayEfficiency(curTrip, capacity);
        const effVal=eff!=null&&Number.isFinite(eff)?n(eff,1):'—';
        const spdVal=curTrip.route?.length?n(this.maxSpeed(curTrip.route),0):'—';
        tiles=`${metric('Distance',distVal,'km','map-marker-distance')}`+
              `${metric('Duration',durVal,'','timer-outline')}`+
              `${metric('Efficiency',effVal,'km/kWh','leaf')}`+
              `${metric('Top speed',spdVal,'km/h','speedometer')}`;
      }else{
        const totalDistM=dayTrips.reduce((acc,t)=>acc+(t.distance_m||0),0);
        const totalDurS=dayTrips.reduce((acc,t)=>acc+(t.duration_s||0),0);
        let distWithEnergyM=0,energyWhSum=0;
        for(const t of dayTrips){
          if(tripEnergyWh(t) != null&&t.distance_m>0){
            energyWhSum+=tripEnergyWh(t);
            distWithEnergyM+=t.distance_m;
          }
        }
        const dayAvgEff=energyWhSum>0&&distWithEnergyM>0?(distWithEnergyM/1000)/(energyWhSum/1000):null;
        const dayAvgSpeed=totalDurS>0&&totalDistM>0?(totalDistM/totalDurS)*3.6:null;

        const distVal=dayTrips.length?(dayTrips.some(t=>t.distance_estimated)?'≈ ':'')+n(totalDistM/1000,2):'—';
        const durVal=dayTrips.length?duration(totalDurS):'—';
        let effVal=dayAvgEff!=null?n(dayAvgEff,1):'—';
        const spdVal=dayAvgSpeed!=null?n(dayAvgSpeed,0):'—';

        tiles=`${metric('Distance',distVal,'km','map-marker-distance')}`+
              `${metric('Duration',durVal,'','timer-outline')}`+
              `${metric('Avg efficiency',effVal,'km/kWh','leaf',distWithEnergyM < totalDistM ? 'Measured trips only' : '')}`+
              `${metric('Avg speed',spdVal,'km/h','speedometer-medium')}`;
      }
    }else{
      tiles=`${metric('Battery level',n(v.soc_percent,0),'%',batteryIconName(v.soc_percent),`${n(v.battery_kwh)} / ${n(v.soc_capacity_kwh)} kWh`)}${metric('Odometer',n(v.odometer_km,0),'km','counter',v.stale?'Last measured':'Vehicle display')}${metric('Distance this month',n(v.month_distance_km),'km','routes',`${n(v.month_trip_count,0)} trips Trips`)}${metric('Estimated charging power',n(v.charge_power_kw??(v.charge_power_w==null?null:v.charge_power_w/1000)),'kW','ev-station',v.charging?'Charging increase detected':'Based on observations')}`;
    }

    const panelTitle=isTrip
      ?(isSpecificTrip?'Trip details':(this.tripDay?`${this.tripDay} trip summary`:'Trip summary'))
      :'Parking location';
    const panelTime=isTrip
      ?(isSpecificTrip?time(curTrip.started_at):(dayTrips.length?`${dayTrips.length} trips total`:'No records'))
      :time(v.parking_at);

    const routeCaption=isTrip
      ?(isSpecificTrip
          ?`<div class="legend"><span>Low · 0 km/h</span><i class="gradient"></i><span>High · ${n(this.maxSpeed(curTrip.route),0)} km/h</span></div><div class="sub">${time(curTrip.started_at)} → ${time(curTrip.ended_at)}<br>${(curTrip.route||[]).length} route points · <span class="legend-dot start"></span>Start · <span class="legend-dot end"></span>Arrival · <span class="legend-dot both"></span>Same location</div>`
          :`<div class="sub">${dayTrips.length?'Showing all trip routes for selected date · <span class="legend-dot start"></span>Start · <span class="legend-dot end"></span>Arrival · <span class="legend-dot both"></span>Same location · Select an individual trip on the right for details':'No trips recorded for this date'}</div>`
        )
      :`<b>${v.parking_latitude!=null?`${n(v.parking_latitude,5)}, ${n(v.parking_longitude,5)}`:'Waiting for location'}</b><div class="sub">Last parking location or trip destination</div>`;

    return `<div class="tiles">${tiles}</div><div class="layout"><section class="panel"><div class="paneltitle"><h2>${panelTitle}</h2><span class="sub">${panelTime}</span></div><div class="map"></div><div class="route-caption">${routeCaption}</div></section>${this.tripHistory(isTrip)}</div>${!isTrip?`<h2 class="section">Vehicle condition</h2><div class="tiles">${metric('Outside temperature',n(v.outside_temp_c),'°C','thermometer')}${metric('12V battery',n(v.aux_voltage,2),'V','car-battery')}${metric('Air conditioning',v.ac_on==null?'—':v.ac_on?'ON':'OFF','','snowflake')}${metric('Blower level',n(v.blower_level,0),'','fan')}</div>`:''}`;
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
      row(batteryIconName(v.soc_percent),'Battery level',n(v.soc_percent),'%'),
      row('car-electric','Range (estimated)',n(v.range_km),'km'),
      row('flash','Battery energy',n(v.battery_kwh),'kWh'),
      row('ev-station','Estimated charging power',n(v.charge_power_kw??(v.charge_power_w==null?null:v.charge_power_w/1000),1),'kW'),
      ...(v.charging?[
        row('timer-sand','Time to 80%',v.time_to_80_s!=null?shortDuration(v.time_to_80_s):'—',''),
        row('clock-end','80% completion time',time(v.eta_80),''),
        row('timer-sand','Time to 100%',v.time_to_100_s!=null?shortDuration(v.time_to_100_s):'—',''),
        row('clock-end','100% completion time',time(v.eta_100),'')
      ]:[])
    ];

    const drivingItems=[
      row('counter','Odometer',n(v.odometer_km,0),'km'),
      row('routes','Distance this month',n(v.month_distance_km),'km'),
      row('car-multiple','Trips this month',n(v.month_trip_count,0),'trips'),
      row('speedometer','Current speed',n(v.speed_kph),'km/h'),
      row('compass-outline','Heading',n(v.bearing_deg),'°'),
      row('car-cruise-control','Driving assistance',v.enabled==null?'Unavailable':v.enabled?'Enabled':'Disabled','',true,v.enabled==null?'dim':v.enabled?'on':'off'),
      row('map-clock-outline','Recorded distance',n(v.recorded_distance_km),'km')
    ];

    const climateItems=[
      row('thermometer','Outside temperature',n(v.outside_temp_c),'°C'),
      row('snowflake','Air conditioning',v.ac_on==null?'Unavailable':v.ac_on?'On':'Off','',true,v.ac_on==null?'dim':v.ac_on?'on':'off'),
      row('car-seat-heater','Driver seat heating',n(v.seat_heat_left,0)),
      row('car-seat-heater','Passenger seat heating',n(v.seat_heat_right,0))
    ];

    const diagnosticItems=[
      row('car-battery','12V auxiliary battery',n(v.aux_voltage,2),'V'),
      row('flash-outline','HV battery voltage',n(v.hv_voltage,1),'V'),
      row('alert-octagon','Emergency charging (est.)',v.emergency_charging?'Detected':'Normal','',true,v.emergency_charging?'off':'on'),
      row('car-shift-pattern','Gear',v.gear!=null?v.gear:'—'),
      row('thermometer-chevron-up','DCDC inverter temp',n(v.dcdc_temperature_c,1),'°C'),
      row('crosshairs-gps','GPS accuracy',n(v.gps_accuracy_m,1),'m'),
      row('parking','Parking recorded time',v.parking_at?time(v.parking_at,this._hass?.config?.time_zone):'—'),
      row('cloud-check','HA sync time',v.last_sync?time(v.last_sync,this._hass?.config?.time_zone):'—'),
      row('cloud-outline','Cloud status',v.cloud_status||'—'),
      row('calculator','SOC calculation capacity',n(v.soc_capacity_kwh,1),'kWh'),
      row('fan','Blower level',n(v.blower_level,0)),
      row('fan-auto','Blower control voltage',n(v.blower_volt,2),'V'),
      row('air-filter','Recirculation signal',n(v.recirc,0))
    ];

    const group=(title,ico,items)=>`<div class="status-group panel"><div class="paneltitle"><h2>${icon(ico)}${title}</h2><span class="sub">${items.length} items</span></div><div class="status-list">${items.join('')}</div></div>`;

    const fieldCount=Object.keys(v||{}).length;
    return `<h2 class="section" style="margin-top:0">Vehicle information</h2><div class="status-groups">${group('Battery & Power','battery-charging',batteryItems)}${group('Driving & Records','steering',drivingItems)}${group('Climate & Cabin','fan',climateItems)}${group('ID.4 Diagnostics','wrench',diagnosticItems)}</div><p class="notice">— means unavailable. SOC calculation capacity calibrates the displayed percentage. Odometer and recorded distance are different values.</p><details class="raw-data-card panel"><summary><div class="raw-summary-content"><span class="raw-summary-title">${icon('code-json')} Show all received data</span><span class="raw-toggle-hint">Raw payload</span></div></summary><div class="raw-content"><div class="raw-toolbar"><span class="raw-count">Raw received payload (${fieldCount} fields)</span><button type="button" class="copy-raw-btn" aria-label="Copy all received data">${icon('content-copy')}<span>Copy all</span></button></div><pre>${esc(JSON.stringify(v,null,2))}</pre></div></details>`;
  }
  chargeHistory(){
    const days=tripDays(this.charges,this._hass?.config?.time_zone).map(d=>({...d,indices:d.indices.filter(i=>Boolean(this.charges[i]?.data?.excluded)===Boolean(this._showExcludedCharges))}));
    if(!this.chargeDay||!days.some(d=>d.key===this.chargeDay)){
      const today=days.find(d=>d.today)||days[days.length-1];
      this.chargeDay=today?today.key:null;
    }
    const selected=days.find(d=>d.key===this.chargeDay);
    const labels=d=>d.date.toLocaleDateString('en-US',{day:'numeric',weekday:'short',timeZone:'UTC'});
    return `<section class="panel charge-history"><div class="paneltitle"><h2>${this._showExcludedCharges?'Excluded charges':'Charging records'}</h2><button class="charge-payment-pill" data-charge-excluded-toggle>${this._showExcludedCharges?'Show charges':'Show excluded records'}</button><span class="sub">Last 7 days</span></div><div class="trip-days charge-days">${days.map(d=>`<button class="trip-day charge-day" data-charge-day="${d.key}" aria-pressed="${d.key===this.chargeDay}" aria-label="${d.key}, ${d.indices.length} charges"><span class="trip-today charge-today">${d.today?'Today':'&nbsp;'}</span><b>${labels(d)}</b><span class="trip-count charge-count">${icon('power-plug')}${d.indices.length}</span></button>`).join('')}</div>${selected?`<div class="trip-day-heading">${selected.key} · ${selected.indices.length} charges</div><div class="scroll">${selected.indices.length?selected.indices.map(i=>{const e=this.charges[i],ed=e?.data||e||{};const fast=Boolean(ed.energy_kwh&&ed.duration_s&&(ed.energy_kwh/(ed.duration_s/3600)>11));const boltSvg=fast?`<svg viewBox="0 0 24 24" class="charge-bolt" fill="currentColor" aria-hidden="true"><path d="M3.2,4V12.8H5.6V20L11.2,10.4H8L11.2,4Z"/><path d="M12.8,4V12.8H15.2V20L20.8,10.4H17.6L20.8,4Z"/></svg>`:`<svg viewBox="0 0 24 24" class="charge-bolt" fill="currentColor" aria-hidden="true"><path d="M7,2V13H10V22L17,10H13L17,2H7Z"/></svg>`;const startSoc=ed.start_soc_percent!=null?Math.round(ed.start_soc_percent):null;const endSoc=ed.end_soc_percent!=null?Math.round(ed.end_soc_percent):null;const chargedSoc=ed.soc_charged_percent!=null?Math.round(ed.soc_charged_percent):((startSoc!=null&&endSoc!=null)?Math.max(0,endSoc-startSoc):null);const isRetro=Boolean(ed.soc_retroactive_estimated);const batterySocIcon = soc => `<ha-icon class="charge-soc-icon" icon="mdi:${batteryIconName(soc)}" aria-hidden="true"></ha-icon>`;const batterySvg=`<svg class="charge-soc-icon" viewBox="0 0 24 24"><path d="M16 4h-2V2h-4v2H8C6.9 4 6 4.9 6 6v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H8V6h8v14z"/></svg>`;const socBadgeHtml=startSoc!=null&&endSoc!=null?`<span class="charge-soc">${batterySocIcon(startSoc)} ${startSoc}% → ${batterySocIcon(endSoc)} ${endSoc}% (+${chargedSoc!=null?chargedSoc:endSoc-startSoc}%)</span>`:(chargedSoc!=null?`<span class="charge-soc ${isRetro?'retro-mode':''}">${batterySvg} +${chargedSoc}%${isRetro?' <small class="retro-tag">(est.)</small>':''}</span>`:'');const chargeEnd=ed.ended_at||(ed.started_at&&ed.duration_s?new Date(new Date(ed.started_at).getTime()+(ed.duration_s*1000)).toISOString():null);const timeRangeStr=chargeEnd?`<span>${timeOnly(ed.started_at,this._hass?.config?.time_zone)}</span> ~ <span>${timeOnly(chargeEnd,this._hass?.config?.time_zone)}</span>`:timeOnly(ed.started_at,this._hass?.config?.time_zone);const unitPrice=ed.actual_cost_krw!=null?(ed.energy_kwh>0?Math.round(ed.actual_cost_krw/ed.energy_kwh):null):ed.unit_price_krw!=null?Math.round(ed.unit_price_krw):(ed.cost_krw!=null&&ed.energy_kwh>0?Math.round(ed.cost_krw/ed.energy_kwh):(fast?320:280));const cost=ed.effective_cost_krw??(ed.cost_krw!=null?Math.round(ed.cost_krw):Math.round((ed.energy_kwh||0)*unitPrice));return `<div class="row charge-row"><div class="charge-meta"><span class="charge-icon-wrap ${fast?'fast':''}">${boltSvg}</span><div><b class="charge-date">${timeRangeStr}</b><div class="charge-info-sub"><span class="speed-badge ${fast?'fast':'slow'}">${fast?'Fast':'Slow'}</span><span class="charge-dur">${formatDuration(ed.duration_s)}</span>${socBadgeHtml}${ed.excluded?'<span class="merge-badge">Excluded</span>':''}${ed.merged?`<span class="merge-badge">${ed.merge_count} merged</span>`:''}</div></div></div><div class="charge-val">${ed.payment_id?`<button class="charge-payment-pill" data-charge-payment="${i}" aria-label="Edit charge payment">${ed.excluded?'Restore / details':ed.actual_cost_krw!=null?'Edit':'Enter amount'}</button>`:''}<strong>₩${n(cost,0)} <small>${ed.actual_cost_krw!=null?'(actual)':'(est.)'}</small></strong><strong title="${ed.merged?(ed.merge_parts||[]).map(p=>`${n(p.energy_kwh,1)} kWh`).join(' + '):''}">${n(ed.energy_kwh,2)} <small>kWh</small></strong><span class="charge-sub">${ed.actual_cost_krw!=null?'Rate':'Est. rate'} ₩${n(unitPrice,0)}/kWh</span></div></div>`;}).join(''):'<div class="empty">No charges recorded.</div>'}</div>`:'<div class="empty">Choose a date to see its charges.</div>'}</section>`;
  }
  tripHistory(isTrip){
    const v = this.v || {};
    const currentTz = this._hass?.config?.time_zone;
    const days = tripDays(this.trips, currentTz);
    if (this.tripDay && !days.some(d => d.key === this.tripDay)) {
      this.tripDay = null;
    }
    if (!this.tripDay) {
      const todayObj = days.find(d => d.today) || days[days.length - 1];
      this.tripDay = todayObj ? todayObj.key : null;
    }
    const selected = days.find(d => d.key === this.tripDay);
    const dayIndices = selected ? selected.indices : [];
    const labels = d => d.date.toLocaleDateString('en-US', {day:'numeric', weekday:'short', timeZone:'UTC'});
    const capacity = v.soc_capacity_kwh || DEFAULT_SOC_CAPACITY_KWH;

    const daysHtml = days.map(d => `
      <button type="button" class="trip-day ${d.key === this.tripDay ? 'active' : ''}" 
              data-trip-day="${d.key}" 
              aria-pressed="${d.key === this.tripDay}" 
              aria-label="${d.key}, ${d.indices.length} trips">
        <span class="trip-today">${d.today ? 'Today' : '&nbsp;'}</span>
        <b>${labels(d)}</b>
        <span class="trip-count"><ha-icon icon="mdi:road"></ha-icon> ${d.indices.length}</span>
      </button>
    `).join('');

    // Timeline Segments (placed inside 24H rail)
    const timelineSegmentsHtml = dayIndices.map(i => {
      const e = this.trips[i];
      const ed = e?.data || {};
      const {leftPct, widthPct} = tripTimeline(e, currentTz);
      const isSel = isTrip && i === this.selected;
      const startSoc = ed.start_soc_percent != null
        ? Math.round(ed.start_soc_percent)
        : (ed.start_battery_wh != null ? Math.round(Math.min(100, Math.max(0, ed.start_battery_wh / (capacity * 1000) * 100))) : null);
      const endSoc = ed.end_soc_percent != null
        ? Math.round(ed.end_soc_percent)
        : (ed.end_battery_wh != null ? Math.round(Math.min(100, Math.max(0, ed.end_battery_wh / (capacity * 1000) * 100))) : null);
      const drain = (startSoc != null && endSoc != null) ? (startSoc - endSoc) : null;
      const usedStr = drain > 0 ? `${drain}% used` : (drain < 0 ? `+${Math.abs(drain)}% regen` : '0% used');
      const segTitle = `${timeOnly(ed.started_at || e.observed_at, currentTz)} ~ ${timeOnly(ed.ended_at || e.observed_at, currentTz)} · ${n((ed.distance_m || 0) / 1000, 2)}km · 🔋${startSoc ?? '—'}%→${endSoc ?? '—'}% (${usedStr}) · ${n(ed.efficiency_km_kwh, 1)} km/kWh${ed.merged ? ` (${ed.merge_count} merged)` : ''}`;

      return `<div class="timeline-trip-segment ${isSel ? 'selected' : ''}" 
                   style="left:${leftPct.toFixed(2)}%; width:${widthPct.toFixed(2)}%;" 
                   data-trip="${i}" 
                   title="${esc(segTitle)}"></div>`;
    }).join('');

    // 2x4 Grid & Pagination (2 columns x max 4 rows = max 8 per page)
    const ITEMS_PER_PAGE = 8;
    const totalItems = dayIndices.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    if (this.selected !== null && this.selected !== this._pageSelection) {
      const selPos = dayIndices.indexOf(this.selected);
      if (selPos !== -1) {
        this._tripPage = Math.floor(selPos / ITEMS_PER_PAGE) + 1;
      }
    }

    this._pageSelection = this.selected;
    if (!this._tripPage || this._tripPage < 1) this._tripPage = 1;
    if (this._tripPage > totalPages) this._tripPage = totalPages;
    this._maxTripPages = totalPages;

    const startIdx = (this._tripPage - 1) * ITEMS_PER_PAGE;
    const visibleIndices = dayIndices.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    let cardsHtml = '';
    if (visibleIndices.length === 0) {
      cardsHtml = `<div class="empty" style="grid-column: 1 / -1; padding: 40px 10px;">No trips recorded for this date.</div>`;
    } else {
      cardsHtml = visibleIndices.map(i => {
        const e = this.trips[i];
        const ed = e?.data || {};
        const durText = tripDurationEn(ed.duration_s);
        const startValue = tripSoc(ed, 'start', capacity), endValue = tripSoc(ed, 'end', capacity);
          const startSoc = startValue == null ? null : Math.round(startValue);
          const endSoc = endValue == null ? null : Math.round(endValue);
          const drain = startSoc == null || endSoc == null ? null : startSoc - endSoc;
        const usedStr = drain > 0 ? `${drain}% used` : (drain < 0 ? `+${Math.abs(drain)}% regen` : '0% used');
        const isSel = isTrip && i === this.selected;

        const eff = tripDisplayEfficiency(ed, capacity);

        const socHtml = `<span class="trip-soc${drain == null ? ' trip-missing' : ''}"><ha-icon icon="mdi:${batteryIconName(startSoc)}"></ha-icon> <span>${startSoc == null ? '—' : startSoc}% → ${endSoc == null ? '—' : endSoc}%</span><small class="soc-used-tag">(${drain == null ? 'Missing record' : usedStr})</small></span>`;
        const effHtml = eff == null ? '' : `<span class="trip-eff">${n(eff, 1)} km/kWh</span>`;
        const mergeHtml = (ed.merged && ed.merge_count > 1)
          ? `<span class="trip-merge-badge">${ed.merge_count} merged</span>`
          : '';
        const distStr = n((ed.distance_m || 0) / 1000, 2);

        return `
          <div class="sleek-trip-card ${isSel ? 'selected' : ''}" data-trip="${i}">
            <div class="card-top-row">
              <div>
                <span class="card-time">${timeOnly(ed.started_at || e.observed_at, currentTz)}</span>
                ${durText ? `<span class="card-dur">${durText}</span>` : ''}
              </div>
              <div class="card-dist">${distStr} <small>km</small></div>
            </div>
            <div class="card-badges-row">
              ${socHtml}
              ${effHtml}
              ${mergeHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    const paginationHtml = `
      <div class="panel-pagination">
        <button class="page-nav-btn" data-nav-page="prev" ${this._tripPage <= 1 ? 'disabled' : ''}>
          ◀ Prev Page
        </button>
        <span class="page-indicator-text">
          ${this._tripPage} / ${totalPages} Page (Total ${totalItems})
        </span>
        <button class="page-nav-btn" data-nav-page="next" ${this._tripPage >= totalPages ? 'disabled' : ''}>
          Next Page ▶
        </button>
      </div>
    `;

    const isMergeActive = this._mergeTripsEnabled !== false;
    const hasMergedTrips = dayIndices.some(i => this.trips[i]?.data?.merged);
    const mergeSubText = isMergeActive
      ? (hasMergedTrips ? '(≤30m gaps merged)' : '')
      : '(individual trips)';

    return `
      <section class="panel trip-history">
        <div class="paneltitle">
          <h2>Recent trips</h2>
          <span class="sub">Last 7 days</span>
        </div>
        <div class="trip-days">
          ${daysHtml}
        </div>
        ${selected ? `
          <div class="day-timeline-wrap">
            <div class="day-timeline-topline">
              <span class="day-timeline-title">
                <strong>${selected.key} · ${dayIndices.length} trips</strong>
                <small class="day-timeline-merge-sub">${mergeSubText}</small>
              </span>
              <button class="merge-toggle-badge ${isMergeActive ? '' : 'off'}" id="btnToggleTripMerge" title="Click to toggle 30-min adjacent trip merge">
                ${isMergeActive ? 'Merged (≤30m)' : 'Individual Trips'}
              </button>
            </div>
            <div class="day-timeline-scale">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
            <div class="day-timeline-rail">
              ${timelineSegmentsHtml}
            </div>
          </div>
          <div class="trip-grid-container">
            <div class="trip-grid-2x4">
              ${cardsHtml}
            </div>
            ${paginationHtml}
          </div>
        ` : `
          <div class="empty">Select a date to view trip history.</div>
        `}
      </section>
    `;
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
    const chargeLabel=isEmergency?(powerKw?`Emergency Charging (${n(powerKw,1)}kW)...`:'Emergency Charging...'):(isFast?'Fast Charging...':'Slow Charging...');
    const sweepSpeedClass=isFast?'fast':'slow';

    const openDoors=[];
    if(v.door_driver_open)openDoors.push('Driver door');
    if(v.door_rear_driver_open)openDoors.push('Rear driver door');
    if(v.door_passenger_open)openDoors.push('Passenger door');
    if(v.door_rear_passenger_open)openDoors.push('Rear passenger door');
    if(v.trunk_open)openDoors.push('Trunk');
    const isLocked=v.doors_locked!==false&&openDoors.length===0;

    const renderLockMetric = (locked, isChargingMode, doorsList = []) => {
      const modeClass = isChargingMode ? 'mode-charging' : 'mode-parked';
      const lockClass = locked ? 'is-locked' : 'is-unlocked';
      const statusText = locked ? 'Locked' : 'Unlocked';
      let hintText = '';
      if (locked) {
        hintText = 'All doors closed & locked';
      } else if (!doorsList || doorsList.length === 0) {
        hintText = 'Door open';
      } else if (doorsList.length === 1) {
        hintText = `${doorsList[0]} open`;
      } else {
        hintText = `${doorsList[0]} +${doorsList.length - 1} open`;
      }
      return `
        <div class="metric lock-metric c1 ${modeClass} ${lockClass}">
          <span class="label">Vehicle Lock Status</span>
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
    const etaCardTitle = `Time to ${targetPercent}%`;
    const targetSec = isUnder80 ? v.time_to_80_s : v.time_to_100_s;
    const targetEta = isUnder80 ? v.eta_80 : v.eta_100;

    let etaCardMainVal = 'Calculating';
    let etaCardSubText = `${targetPercent}% target`;
    if (typeof targetSec === 'number' && Number.isFinite(targetSec)) {
      if (targetSec <= 0) {
        etaCardMainVal = 'Done';
        etaCardSubText = 'Charging complete';
      } else {
        etaCardMainVal = chargeDuration(targetSec);
        etaCardSubText = formatEtaCompletionEn(targetEta, tz);
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
    const sessionCostSub = `+${n(sessionKwh, 1)} kWh (est.)`;

    if(v.charging_eta_source==='held_last_valid') etaCardSubText += ` · Last estimate held (${v.charging_eta_hold_age_s ?? 0}s)`;
    const quickMetrics = charging
      ? `${renderLockMetric(isLocked, true, openDoors)}` +
        `${metric(etaCardTitle, etaCardMainVal, '', 'clock-end', etaCardSubText, 'charge-eta')}` +
        `${metric('Real-time Charge Cost', n(sessionCost, 0), 'KRW', 'cash', sessionCostSub, 'charge-cost')}` +
        `${metric('Charged this month', n(v.month_charge_kwh), 'kWh', 'battery-plus')}`
      : `${renderLockMetric(isLocked, false, openDoors)}` +
        `${metric('Total Odometer', n(v.odometer_km, 0), 'km', 'counter')}` +
        `${metric('Charged this month', n(v.month_charge_kwh), 'kWh', 'battery-plus')}` +
        `${metric('Charge cost this month', n(v.charge_cost_totals?.effective_cost_krw ?? v.month_charge_cost, 0), 'KRW', 'cash', chargeCostLabel(v.charge_cost_totals,true))}`;

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
                 <span>Est. driving range <b>${rangeKm} km</b></span>
               </div>
             </div>
           </div>
         </div>`
      : `<div class="energy-head range-c3">
           <div class="battery-label">
             <ha-icon class="battery-head-icon" icon="mdi:${batteryIconName(soc)}"></ha-icon>
             <span>Battery level</span>
           </div>
           <div class="soc-stack-c3">
             <strong class="soc-value">${n(soc, 0)}<small>%</small></strong>
             <div class="range-sub-c3">
               <span>Est. driving range <b>${rangeKm} km</b></span>
             </div>
           </div>
         </div>`;

    const socState=!charging&&soc!==null?(soc<15?'is-critical soc-critical':soc<30?'is-low soc-low':''):'';

    let cameraConditionSlotHtml='';
    if(isDriving||v.onroad===true||displayState.key==='driving'){
      cameraConditionSlotHtml=`<span>Climate <b>${v.ac_on==null?'—':v.ac_on?'ON':'OFF'}</b></span>`;
    }else if(displayState.key==='parked'||displayState.key==='charging'){
      cameraConditionSlotHtml=`
        <button type="button" class="mini-condition-camera-btn" id="camera360Trigger" aria-label="View 360° Camera">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
          <span>View Camera</span>
        </button>`;
    }else if(displayState.key==='stale'){
      cameraConditionSlotHtml=`
        <span class="mini-condition-camera-disabled" title="Data delayed. Camera disabled.">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" opacity="0.6"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span>Data Delayed</span>
        </span>`;
    }else if(displayState.key==='offline'){
      cameraConditionSlotHtml=`
        <span class="mini-condition-camera-disabled" title="Device offline. Camera unavailable.">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" opacity="0.6"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
          <span>Camera Offline</span>
        </span>`;
    }else{
      cameraConditionSlotHtml=`
        <span class="mini-condition-camera-disabled" title="Checking vehicle status...">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" opacity="0.6"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span>Checking Status</span>
        </span>`;
    }

    return `<div class="cockpit desktop-balanced-cockpit"><div class="overview-col-visual"><section class="hero"><div class="hero-copy"><h2>${esc(status).replace('\n','<br>')}</h2></div>${this.vehicleImage()}</section><div class="mini-condition"><span>Outside <b>${n(v.outside_temp_c)}°C</b></span><span>12V <b>${n(v.aux_voltage,1)}V</b></span>${cameraConditionSlotHtml}</div></div><div class="overview-col-telemetry"><section class="energy ${charging?'is-charging':''} ${isDriving?'is-driving':''} ${socState}" style="--soc:${soc??0}%">${sweepHtml}${markersHtml}${energyHeadHtml}</section><div class="quick-metrics">${quickMetrics}</div><div class="overview-links"><button class="shortcut" data-tab="parking"><span><b>Parking location</b><small>${v.parking_latitude==null?'Waiting for location':time(v.parking_at, tz)}</small></span><em>Map →</em><div class="mini-map parking-mini"></div></button><button class="shortcut" data-tab="trips"><span><b>Recent trips</b><small>${latest?n(latest.distance_m==null?null:latest.distance_m/1000,2)+' km':'No records'}</small><small>${latest?shortDuration(latest.duration_s):'Waiting for a new trip'}</small></span><em>View →</em><div class="mini-map trip-mini"></div></button></div></div></div>`;
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
    const isMoving=(v?.speed_kph>3);
    const isCharging=(Boolean(v?.charging)||this._hass?.states?.[this.config?.charging_entity||this.v?.entity_ids?.charging]?.state==='on')&&!isMoving;
    if(isCharging)return {key:'charging',label:'Charging'};
    const driving=Object.prototype.hasOwnProperty.call(v||{},'driving')?v?.driving:v?.onroad;
    if(driving)return {key:'driving',label:'Driving'};
    if(driving===false)return {key:'parked',label:'Parked'};
    if(online!=='on'&&!this.isFromCache&&(!v||!Object.keys(v).length))return {key:'unknown',label:'Checking connection'};
    return {key:'unknown',label:online==='on'?'Checking status':'Checking connection'};
  }
  openCamera360(triggerBtn){
    if(!this.cameraModal){
      this.cameraModal=new CarrotCamera360Modal({
        container:this.shadowRoot,
        lang:'en',
        theme:this.getAttribute('data-theme')||'dark'
      });
    }else{
      this.cameraModal.setTheme(this.getAttribute('data-theme')||'dark');
      this.cameraModal.setLanguage('en');
    }
    const deviceId=this.device?.device_id||this.config?.device_id||'comma';
    this.cameraModal.open({
      mode:'real',
      hass:this._hass,
      deviceId,
      returnFocusElem:triggerBtn
    });
  }
  async drawMiniMaps(v){
    const currentRenderId=this._renderId;
    const nodes=[this.shadowRoot.querySelector('.parking-mini'),this.shadowRoot.querySelector('.trip-mini')];
    const L=await leaflet();
    if(this._renderId!==currentRenderId)return;
    nodes.forEach((node,i)=>{
      if(!node?.isConnected)return;
      const map=L.map(node,{zoomControl:false,attributionControl:true,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false});
      this.miniMaps.push(map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
      const route=(this.trips[0]?.data?.route||[]).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
      const dot=(p,c)=>L.circleMarker(p,{radius:5,color:'#fff',weight:2,fillColor:c,fillOpacity:1}).addTo(map);
      if(i&&route.length){const coords=route.map(p=>[p.latitude,p.longitude]);const max=Math.max(...route.map(p=>p.speedMps??p.speed_mps??0),1);for(let j=1;j<route.length;j++){let t=(route[j].speedMps??route[j].speed_mps??0)/max;L.polyline([coords[j-1],coords[j]],{color:`hsl(${18+118*t},95%,40%)`,weight:4,opacity:1}).addTo(map)}map.fitBounds(coords,{padding:[16,16],maxZoom:14});dot(coords[0],'#10b981');dot(coords.at(-1),'#f97316');}
      else if(!i&&Number.isFinite(v.parking_latitude)){const p=[v.parking_latitude,v.parking_longitude];map.setView(p,14);dot(p,'#2563eb');}
      else{this.miniMaps=this.miniMaps.filter(item=>item!==map);map.remove();node.textContent='No location data';}
    });
    setTimeout(()=>{
      if(this._renderId===currentRenderId){
        this.miniMaps?.forEach(m=>{try{m.invalidateSize();}catch(e){}});
      }
    },100);
  }

  batteryHistory(){
    const days=this.v?.battery_history;
    if(!days?.length)return '<section class="battery-history"><h2>Battery usage</h2><p>Cannot load hourly history. Update the Carrot HA integration too.</p></section>';
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
    const bars=days.map((x,i)=>`<button data-day="${i}" data-date="${x.date}" aria-label="${x.date} Usage ${x.used??'No records'}" aria-pressed="${idx===i}" style="--bar-end:${x.used>100?'#ffe480':'#65c4ff'};--bar:${idx===i?(x.used>100?'#ffc247':'#479cff'):'#626267'}"><i style="height:${(x.used??0)/max*100}%"></i><span>${new Date(x.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short'})}<small>${x.date.slice(5).replace('-','/')}</small></span></button>`).join('');
    const hours=(()=>{const runs=[];let start=null;for(let h=0;h<d.hours.length;h++){const ch=!!d.charge_hours?.[h]||!!d.hours[h]?.charging;if(ch&&start===null)start=h;if(!ch&&start!==null){runs.push([start,h-1]);start=null;}}if(start!==null)runs.push([start,d.hours.length-1]);let out='',ridx=0;for(let h=0;h<d.hours.length;h++){const x=d.hours[h],run=runs[ridx],charging=!!d.charge_hours?.[h]||!!x?.charging;if(run&&h===run[0])out+=`<div class="charge-run-wrap" style="--span:${run[1]-run[0]+1}"><em aria-hidden="true"><svg viewBox="0 0 32 40"><path d="M19 5 Q21 3 20 7 L17 17 H25 Q27 17 25 20 L13 35 Q11 37 12 33 L15 23 H7 Q5 23 7 20 Z" fill="#5ad46d" stroke="var(--bolt-outline)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg></em>`;out+=`<div title="${h}:00 ${x?(x.last_known?'Last known ':'Measured ')+Math.round(x.soc)+'%':'No SOC record'}${charging?' · Charging recorded during this hour':''}" class="hour ${charging?'charging':x?.last_known?'last-known':x?.driving?'driving':'parked'} ${!charging&&x?(x.soc<15?'soc-critical':x.soc<30?'soc-low':''):''}">${x?`<i style="height:${x.soc}%"></i>`:''}</div>`;if(run&&h===run[1]){out+='</div>';ridx++;}}return out;})();
    return `<section class="battery-history"><h2>Battery usage</h2><div class="usage-total" style="color:${color}"><strong>${d.used==null?'—':n(d.used,1)+'%'}${d.used==null?'':'<small class="usage-caption">used</small>'}</strong><span>${esc(d.date)}</span></div><div class="history-plot"><div class="week-bars">${bars}</div><div class="axis"><span>${max}%</span><span>${max/2}%</span><span>0%</span></div></div><p class="chart-key">Last 7 days · Select a day for details · Yellow indicates over 100%</p><h3>Battery level on selected day</h3><div class="history-plot"><div class="hours">${hours}</div><div class="axis"><span>100%</span><span>50%</span><span>0%</span></div></div><div class="hours-label"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div><p class="chart-key"><b style="color:#5ad46d">● Charging</b>　<span class="driving-key">● Driving</span>　<span class="parking-key">● Parked / last known</span> · <span style="color:#e58a31">Below 30%</span> · <span style="color:#ed6269">Below 15%</span> · Gaps: no records</p><div class="usage-stats"><div>Recorded driving time<strong>${shortDuration(d.drive_s)}</strong></div><div>Recorded charging time<strong>${shortDuration(d.charge_s)}</strong></div></div><p class="chart-key">Received ${d.received_samples??0} samples · Valid SOC ${d.valid_samples??0} samples · Stale samples ${d.stale_samples??0} samples · Recorded coverage ${shortDuration(d.covered_s)} · Usage estimates sum recorded SOC decreases, excluding gaps over 5 minutes. Gray bars show parked readings or last known values. Carried values are excluded from consumption. Green means charging occurred within the hour, not throughout it. Without SOC data, only the charging background is shown. Durations use saved sessions and exclude ongoing or missing sessions.</p></section>`;
  }
  maxSpeed(route){const speeds=(route||[]).map(p=>p.speedMps??p.speed_mps).filter(Number.isFinite);return speeds.length?Math.max(...speeds)*3.6:null;}
  async drawMap(route,v,dayTrips=[]){
    const node=this.shadowRoot.querySelector('.map');
    const mapVehicle=this.tab==='trips'?{}:v;
    const signature=JSON.stringify([this._mapContext,route,dayTrips,mapVehicle.latitude,mapVehicle.longitude,mapVehicle.parking_latitude,mapVehicle.parking_longitude,this.tab==='trips'?null:this.vehicleStatus(v).key]);
    if(this.map&&this._mapSignature===signature){node.replaceWith(this.map.getContainer());return;}
    if(this.map){try{this.map.remove();}catch{}this.map=null;}
    this._mapSignature=signature;
    if(this.tab==='trips' && ![route,...dayTrips.map(t=>t.route||[])].some(points=>points.some(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180))){
      node.innerHTML='<div class="empty">'+(dayTrips.length||this.selected!==null?'No location recorded for this trip.':'No trips recorded for this date.')+'</div>';return;
    }
    try{
      const L=await leaflet();if(!node.isConnected||this._mapSignature!==signature)return;
      const points=route.filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180);
      const isDriving=this.vehicleStatus(v).key==='driving';
      const liveCoord=(isDriving&&Number.isFinite(v.latitude)&&Number.isFinite(v.longitude)&&Math.abs(v.latitude)<=90&&Math.abs(v.longitude)<=180)?[v.latitude,v.longitude]:null;
      const parkingCoord=(Number.isFinite(v.parking_latitude)&&Number.isFinite(v.parking_longitude)&&Math.abs(v.parking_latitude)<=90&&Math.abs(v.parking_longitude)<=180)?[v.parking_latitude,v.parking_longitude]:null;
      const targetPos=this.tab!=='trips' ? liveCoord||parkingCoord : null;
      const hasDayRoutes=!points.length&&dayTrips.length>0&&dayTrips.some(t=>(t.route||[]).some(p=>Number.isFinite(p.latitude)));
      if(!points.length&&!hasDayRoutes&&!targetPos){node.innerHTML='<div class="empty">Waiting for valid coordinates.</div>';return;}
      this.map=L.map(node,{scrollWheelZoom:false,zoomControl:true});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(this.map);
      const areCoordsClose=(c1,c2,thresholdDeg=0.00035)=>{
        if(!c1||!c2)return false;
        return Math.hypot(Number(c1[0])-Number(c2[0]),Number(c1[1])-Number(c2[1]))<thresholdDeg;
      };
      const dotMarker=(pos,type,title='')=>{
        const isBoth=type==='both';
        const size=isBoth?18:14;
        const anchor=size/2;
        const inner=isBoth?'<span class="pin-core"></span>':'';
        return L.marker(pos,{
          title,
          icon:L.divIcon({
            className:'',
            html:`<div class="pin-dot ${type}" title="${esc(title)}">${inner}</div>`,
            iconSize:[size,size],
            iconAnchor:[anchor,anchor]
          })
        }).addTo(this.map);
      };
      const vehicleMarker=(pos,isDriving,title='')=>{
        const iconHtml=isDriving
          ?`<div class="pin-vehicle driving" title="${esc(title)}"><span class="pin-pulse"></span><svg viewBox="0 0 24 24" width="13" height="13" fill="#ffffff"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div>`
          :`<div class="pin-vehicle parked" title="${esc(title)}"><b>P</b></div>`;
        return L.marker(pos,{
          title,
          icon:L.divIcon({
            className:'',
            html:iconHtml,
            iconSize:[24,24],
            iconAnchor:[12,12]
          })
        }).addTo(this.map);
      };
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
        const coords=points.map(p=>[p.latitude,p.longitude]);bounds=L.latLngBounds(coords);this.map.fitBounds(bounds,{padding:[32,32],maxZoom:16});
        const startCoord=coords[0];const endCoord=coords.at(-1);
        if(areCoordsClose(startCoord,endCoord)){
          dotMarker(startCoord,'both','Trip start & arrival');
        }else{
          dotMarker(startCoord,'start','Start');
          dotMarker(endCoord,'end','End');
        }
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
          const startCoord=[startPt.latitude,startPt.longitude];
          const endCoord=[endPt.latitude,endPt.longitude];
          if(areCoordsClose(startCoord,endCoord)){
            dotMarker(startCoord,'both','Day start & arrival');
          }else{
            dotMarker(startCoord,'start','Day start');
            dotMarker(endCoord,'end','Day arrival');
          }
        }else if(targetPos){
          this.map.setView(targetPos,16);vehicleMarker(targetPos,isDriving,isDriving?'Live vehicle location':'Parking location');bounds=L.latLngBounds([targetPos]);
        }
      }else{
        this.map.setView(targetPos,16);vehicleMarker(targetPos,isDriving,isDriving?'Live vehicle location':'Parking location');bounds=L.latLngBounds([targetPos]);
      }
      const reset=L.control({position:'bottomright'});reset.onAdd=()=>{const b=L.DomUtil.create('button','resetmap');b.textContent='⌖ Fit view';b.setAttribute('aria-label','Fit the entire route');L.DomEvent.disableClickPropagation(b);b.onclick=()=>this.map.fitBounds(bounds,{padding:[32,32],maxZoom:16});return b;};reset.addTo(this.map);
      if(this._mapView)this.map.setView(this._mapView.center,this._mapView.zoom,{animate:false});
      const renderedMap=this.map;requestAnimationFrame(()=>{if(this.map===renderedMap)renderedMap.invalidateSize({pan:false});});
    }catch(e){if(node.isConnected)node.innerHTML=`<div class="empty">${esc(e.message)}</div>`;}
  }
}

export default CarrotDashboard;
