// Carrot HA Live Debug Dashboard Card
// Clones the official Carrot Dashboard and provides a real-time UI controller underneath.

const BMS_CAPACITY = 70.8; // kWh (ID.4 BMS pack capacity)

// 2023 VW ID.4 Pro S AWD Theoretical Charging Curve (1% - 100% in kW)
const ID4_CHARGING_CURVE_KW = [
  181.3, // 0% fallback
  181.3, 183.4, 183.3, 185.0, 187.1, 187.2, 187.2, 188.3, 189.1, 189.2, // 1-10%
  190.2, 190.3, 190.2, 191.3, 191.3, 191.3, 191.3, 191.3, 192.3, 192.4, // 11-20%
  189.2, 187.1, 184.4, 181.2, 179.2, 176.2, 170.2, 165.0, 160.2, 155.0, // 21-30%
  150.2, 146.0, 144.0, 141.2, 138.2, 136.0, 132.9, 131.2, 129.1, 127.0, // 31-40%
  124.0, 122.9, 120.1, 119.1, 117.0, 114.0, 112.9, 110.1, 109.1, 107.0, // 41-50%
  107.0, 104.9, 103.8, 101.8, 101.9, 100.7, 100.1,  99.1,  98.0,  96.9, // 51-60%
   96.0,  95.0,  93.9,  92.8,  91.8,  91.8,  91.8,  91.8,  91.8,  91.8, // 61-70%
   91.8,  91.8,  91.9,  91.8,  92.9,  92.8,  92.8,  92.8,  91.8,  90.8, // 71-80%
   90.0,  88.9,  85.9,  81.8,  79.1,  76.0,  72.8,  69.7,  66.9,  62.8, // 81-90%
   59.7,  57.0,  52.7,  49.7,  46.8,  43.7,  40.6,  37.6,  34.8,  31.7  // 91-100%
];

function estimateChargingTimesWithCurve(currentSoc, powerKw, capacityKwh = BMS_CAPACITY, baseTimeMs = Date.now(), calcModel = 'curve') {
  if (typeof powerKw !== 'number' || powerKw < 0.3 || typeof currentSoc !== 'number') {
    return { sec80: null, eta80: null, sec100: null, eta100: null, simpleSec80: null, simpleSec100: null };
  }

  const soc = Math.max(0, Math.min(100, currentSoc));
  const currentKwh = (soc / 100) * capacityKwh;

  // Simple linear benchmark calculation
  const target80Kwh = capacityKwh * 0.8;
  const need80Kwh = Math.max(0, target80Kwh - currentKwh);
  const simpleSec80 = Math.round((need80Kwh / powerKw) * 3600);

  const target100Kwh = capacityKwh * 1.0;
  const need100Kwh = Math.max(0, target100Kwh - currentKwh);
  const simpleSec100 = Math.round((need100Kwh / powerKw) * 3600);

  if (calcModel === 'simple') {
    return {
      sec80: simpleSec80,
      eta80: new Date(baseTimeMs + simpleSec80 * 1000).toISOString(),
      sec100: simpleSec100,
      eta100: new Date(baseTimeMs + simpleSec100 * 1000).toISOString(),
      simpleSec80,
      simpleSec100
    };
  }

  // Option 1: Bottleneck Model (충전기 상한 및 커브 동시 적용)
  const currentCurveKw = ID4_CHARGING_CURVE_KW[Math.min(100, Math.max(1, Math.round(soc)))];
  const scale = powerKw > currentCurveKw ? Math.min(1.15, powerKw / currentCurveKw) : 1.0;

  const calcTimeToSoc = (targetSoc) => {
    if (soc >= targetSoc) return 0;
    let totalSec = 0;
    const startInt = Math.floor(soc);
    const targetInt = Math.floor(targetSoc);

    for (let s = startInt; s < targetInt; s++) {
      const curveVal = ID4_CHARGING_CURVE_KW[Math.min(100, s + 1)] * scale;
      const stepKw = Math.max(0.3, Math.min(powerKw, curveVal));
      let stepFraction = 1.0;
      if (s === startInt) {
        stepFraction = (startInt + 1) - soc;
      }
      const stepKwh = capacityKwh * 0.01 * stepFraction;
      totalSec += (stepKwh / stepKw) * 3600;
    }

    if (targetSoc > targetInt) {
      const curveVal = ID4_CHARGING_CURVE_KW[Math.min(100, targetInt + 1)] * scale;
      const stepKw = Math.max(0.3, Math.min(powerKw, curveVal));
      const stepKwh = capacityKwh * 0.01 * (targetSoc - targetInt);
      totalSec += (stepKwh / stepKw) * 3600;
    }

    return Math.round(totalSec);
  };

  const sec80 = calcTimeToSoc(80);
  const sec100 = calcTimeToSoc(100);
  const eta80 = new Date(baseTimeMs + sec80 * 1000).toISOString();
  const eta100 = new Date(baseTimeMs + sec100 * 1000).toISOString();

  return { sec80, eta80, sec100, eta100, simpleSec80, simpleSec100 };
}

// Display-only policy; raw input is retained separately and never written to HA.
export const DEBUG_FRESHNESS = { measurement: 180, telemetry: 300, sync: 180 };
export const DEBUG_MODES = [
  {mode:'charging', key:'charging', ko:'충전중', en:'Charging'},
  {mode:'driving', key:'driving', ko:'주행 중', en:'Driving'},
  {mode:'parked', key:'parked', ko:'주차중', en:'Parked'},
  {mode:'stale', key:'stale', ko:'차량 데이터 지연', en:'Vehicle data delayed'},
  {mode:'offline', key:'offline', ko:'통신 지연', en:'Communication delayed'},
  {mode:'cloud_error', key:'connection_unknown', ko:'연결 확인 불가', en:'Connection unavailable'},
  {mode:'unknown', key:'unknown', ko:'상태 확인 불가', en:'Status unavailable'}
];
export function debugDisplay(raw, now = Date.now(), lastGood = null) {
  const age = value => {
    const t = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(t) && t <= now ? (now-t)/1000 : null;
  };
  const measured = age(raw.measured_at), telemetry = age(raw.last_received), sync = age(raw.last_sync);
  const connection = raw.cloud_status === 'error' || sync === null || sync > DEBUG_FRESHNESS.sync
    ? 'unknown' : telemetry === null ? 'unknown' : telemetry >= DEBUG_FRESHNESS.telemetry ? 'offline' : 'online';
  const stale = raw.stale === true || (measured !== null && measured > DEBUG_FRESHNESS.measurement);
  const key = measured === null ? 'unknown' : connection === 'offline' ? 'offline' : stale ? 'stale'
    : connection !== 'online' ? 'connection_unknown' : raw.onroad ? 'driving' : raw.charging ? 'charging'
    : raw.onroad === false ? 'parked' : 'unknown';
  const live = ['driving','charging','parked'].includes(key);
  // Keep the last healthy card contents, including power/ETA and visual mode.
  // Freshness changes only the status label, never the recorded measurements.
  const recorded = !live && lastGood ? lastGood : raw;
  const values = {...recorded, simulated:true, display_state:key, stale,
    measurement_age_s:measured, last_confirmed_state:raw.last_confirmed_state, last_confirmed_at:raw.last_confirmed_at, connection_state:connection,
    telemetry_age_s:telemetry, sync_age_s:sync};
  return values;
}

export default class CarrotDebugDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.state = {
      mode: 'charging', // 'charging' | 'parked' | 'driving'
      soc: 74,
      powerKw: 9.9,
      calcModel: 'curve', // 'curve' (ID.4 curve Option 1) | 'simple' (legacy linear)
      lang: 'ko',
      theme: 'auto'
    };
    this._userThemeSelected = false;
  }

  getEffectiveTheme(theme = this.state.theme) {
    if (theme === 'light' || theme === 'dark') return theme;
    const isDark = this._hass?.themes?.darkMode ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'dark' : 'light';
  }

  connectedCallback() {
    this.style.display = 'block';
    if (!this._userThemeSelected) {
      this.state.theme = this.getEffectiveTheme('auto');
    }
    this.render();
    clearInterval(this.freshnessTimer);
    this.freshnessTimer=setInterval(()=>this.applyDebugTelemetry(),30000);
  }

  disconnectedCallback(){clearInterval(this.freshnessTimer);}

  setConfig(config) {
    this.config = config || {};
    if (this.config.initial_soc != null) this.state.soc = Number(this.config.initial_soc);
    if (this.config.initial_charging != null) this.state.mode = this.config.initial_charging ? 'charging' : 'parked';
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.dashCard) {
      this.dashCard._hass = hass;
    }
    if (!this._userThemeSelected) {
      const haTheme = this.getEffectiveTheme('auto');
      if (this.getAttribute('data-theme') !== haTheme) {
        this.applyTheme(haTheme, true);
      }
    }
  }

  getCardSize() {
    return 14;
  }

  getGridOptions() {
    return { columns: 36, rows: 'auto', min_columns: 6 };
  }

  formatDuration(seconds) {
    if (seconds <= 0) return '완료';
    const totalMins = Math.round(seconds / 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}분`;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
  }

  formatTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return !Number.isNaN(d.getTime())
      ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '—';
  }

  applyDebugTelemetry() {
    if (!this.dashCard) return;

    const currentKwh = (this.state.soc / 100) * BMS_CAPACITY;
    const impaired=['stale','unknown','offline','cloud_error'].includes(this.state.mode);
    const lastMode=impaired?(this.lastGood?.mode||null):this.state.mode;
    const isCharging=lastMode==='charging';
    const isDriving=lastMode==='driving';
    const now=Date.now();
    if(this.scenarioMode!==this.state.mode){this.scenarioMode=this.state.mode;this.scenarioAt=now;}
    const measuredAt=this.state.mode==='unknown'?null:new Date(impaired?this.scenarioAt-(this.state.mode==='stale'?2400000:this.state.mode==='offline'?600000:30000):now).toISOString();
    const receivedAt=new Date(this.state.mode==='offline'?this.scenarioAt-600000:this.state.mode==='cloud_error'?this.scenarioAt-30000:now-30000).toISOString();

    // 80% & 100% calculations (ID.4 Charging Curve - Option 1: Bottleneck Model)
    const { sec80, eta80, sec100, eta100, simpleSec80, simpleSec100 } = estimateChargingTimesWithCurve(
      this.state.soc,
      this.state.powerKw,
      BMS_CAPACITY,
      now,
      this.state.calcModel || 'curve'
    );

    const v = {
      stale: this.state.mode === 'stale',
      simulated: true,
      state_version: 1,
      vehicle_state: this.state.mode,
      state_reason: this.state.mode === 'stale' ? 'battery_measurement_expired' : this.state.mode === 'unknown' ? 'motion_unavailable' : 'stationary_energy_increase',
      last_confirmed_state: this.lastGood?.mode || null,
      last_confirmed_at: this.lastGood ? (impaired && measuredAt ? measuredAt : this.lastGood.at) : null,
      state_evaluated_at: new Date().toISOString(),
      measured_at: measuredAt,
      last_received: receivedAt,
      gps_measured_at: measuredAt,
      field_measured_at: Object.fromEntries(['battery_wh','outside_temp_c','aux_voltage','ac_on'].map(k=>[k,measuredAt])),
      last_sync: new Date(this.state.mode==='cloud_error'?this.scenarioAt-30000:now).toISOString(),
      cloud_status: this.state.mode==='cloud_error'?'error':'ok',
      speed_kph: isDriving?42:0,
      soc_percent: this.state.soc,
      battery_kwh: currentKwh,
      soc_capacity_kwh: BMS_CAPACITY,
      charging: isCharging,
      onroad: isDriving,
      odometer_km: 76233,
      month_distance_km: 1248,
      month_charge_kwh: 155.9,
      month_charge_cost: 43650,
      outside_temp_c: 24,
      aux_voltage: 13.8,
      ac_on: true,
      blower_level: 2,
      parking_latitude: 37.5665,
      parking_longitude: 126.9780,
      parking_at: new Date().toISOString(),
      latitude: 37.5665,
      longitude: 126.9780
    };

    v.cloud_raw_state = {device_id:'simulated-debug',onroad:v.onroad?1:0,updated_at:receivedAt};

    if (isCharging) {
      v.charge_power_kw = this.state.powerKw;
      v.charge_power_w = this.state.powerKw * 1000;
      v.time_to_80_s = this.state.soc < 80 ? sec80 : 0;
      v.eta_80 = eta80;
      v.time_to_100_s = sec100;
      v.eta_100 = eta100;
      v.calc_model = this.state.calcModel || 'curve';
      v.simple_sec80 = simpleSec80;
      v.simple_sec100 = simpleSec100;
    } else {
      v.charge_power_kw = 0;
      v.charge_power_w = 0;
      v.time_to_80_s = null;
      v.eta_80 = null;
      v.time_to_100_s = null;
      v.eta_100 = null;
    }

    const displayed=debugDisplay(v,Date.now(),this.lastGood?.values);
    if(['charging','driving','parked'].includes(displayed.display_state))this.lastGood={mode:displayed.display_state,at:measuredAt,values:{...displayed}};
    this.dashCard.v = {...displayed, debug_raw: v};
    this.dashCard.busy = false;
    this.dashCard.render();
    this.updateInspectorReadout(displayed, displayed.time_to_80_s, displayed.time_to_100_s, displayed.eta_100);
  }

  updateInspectorReadout(v, sec80, sec100, eta100) {
    const el80 = this.shadowRoot.querySelector('#inspect80');
    const el100 = this.shadowRoot.querySelector('#inspect100');
    const elEta = this.shadowRoot.querySelector('#inspectEta');
    const elSpeed = this.shadowRoot.querySelector('#inspectSpeed');
    const elKwh = this.shadowRoot.querySelector('#inspectKwh');

    if (el80) {
      if (v.charging === true) {
        if (v.soc_percent >= 80) {
          el80.innerHTML = '<span class="text-amber-400">도달 완료 (80% 바 자동 숨김)</span>';
        } else {
          const comp = v.simple_sec80 != null && this.state.calcModel !== 'simple' && v.simple_sec80 !== sec80
            ? `<small style="display:block;font-size:11px;font-weight:normal;color:#94a3b8;margin-top:2px">단순 선형: ${this.formatDuration(v.simple_sec80)} (${sec80 > v.simple_sec80 ? '+' : ''}${Math.round((sec80 - v.simple_sec80)/60)}분)</small>`
            : '';
          el80.innerHTML = `<b>${this.formatDuration(sec80)}</b>${comp}`;
        }
      } else {
        el80.innerHTML = '—';
      }
    }
    if (el100) {
      if (v.charging === true) {
        const comp = v.simple_sec100 != null && this.state.calcModel !== 'simple' && v.simple_sec100 !== sec100
          ? `<small style="display:block;font-size:11px;font-weight:normal;color:#94a3b8;margin-top:2px">단순 선형: ${this.formatDuration(v.simple_sec100)} (${sec100 > v.simple_sec100 ? '+' : ''}${Math.round((sec100 - v.simple_sec100)/60)}분)</small>`
          : '';
        el100.innerHTML = `<b>${this.formatDuration(sec100)}</b>${comp}`;
      } else {
        el100.innerHTML = '—';
      }
    }
    if (elEta) {
      elEta.innerHTML = v.charging === true ? `<b>${this.formatTime(eta100)}</b>` : '—';
    }
    if (elSpeed) {
      if (v.charging === true) {
        const isFast = v.charge_power_kw >= 11;
        elSpeed.innerHTML = isFast
          ? '<span style="color:#60a5fa;font-weight:700">⚡ 고속 충전 (2.2초 주기)</span>'
          : '<span style="color:#34d399;font-weight:700">🔌 완속 충전 (4.4초 주기)</span>';
      } else if (v.onroad === true) {
        elSpeed.innerHTML = '<span style="color:#38bdf8;font-weight:700">🚗 주행 방전 (역방향 2.5초)</span>';
      } else {
        elSpeed.textContent = v.display_state==='parked'?'주차 · 정적 표시':'최신 측정 없음 · 애니메이션 중단';
      }
    }
    if (elKwh) {
      elKwh.innerHTML = `<b>${(v.battery_kwh || 0).toFixed(1)}</b> / ${BMS_CAPACITY} kWh`;
    }
    const elModel = this.shadowRoot.querySelector('#inspectModel');
    if (elModel) {
      elModel.textContent = this.state.calcModel === 'simple' ? '기존 단순 선형' : 'ID.4 커브 (옵션 1: 병목)';
      elModel.style.color = this.state.calcModel === 'simple' ? '#94a3b8' : '#34d399';
    }
  }

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          max-width: 1440px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #f1f5f9;
        }

        .debug-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 8px;
        }

        /* Top embedded dashboard card area */
        .preview-pane {
          position: relative;
          border-radius: 24px;
          background: #0f141c;
          border: 2px dashed #3b82f6;
          padding: 8px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .pane-badge {
          position: absolute;
          top: -12px;
          left: 24px;
          background: #2563eb;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 12px;
          border-radius: 9999px;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.5);
          z-index: 10;
        }

        /* Bottom Developer Control Panel */
        .debug-panel {
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #1f2937;
          padding-bottom: 12px;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f3f4f6;
        }

        .panel-header .tag {
          font-size: 10px;
          background: #065f46;
          color: #6ee7b7;
          padding: 2px 8px;
          border-radius: 9999px;
          font-weight: 600;
        }

        .controls-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .control-group {
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .group-label {
          font-size: 12px;
          font-weight: 700;
          color: #9ca3af;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .group-label span.value {
          color: #34d399;
          font-size: 14px;
          font-weight: 800;
        }

        /* Button Groups */
        .btn-group {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .btn-group button {
          flex: 1;
          min-width: 60px;
          padding: 8px 10px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid #374151;
          background: #111827;
          color: #d1d5db;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }

        .btn-group button:hover {
          background: #374151;
          color: #ffffff;
        }

        .btn-group button.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
        }

        .btn-group button.active.charge {
          background: #059669;
          border-color: #10b981;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
        }

        /* Range Sliders */
        input[type="range"] {
          width: 100%;
          accent-color: #10b981;
          cursor: pointer;
        }

        /* Preset Dropdown */
        .preset-dropdown-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 2px;
        }

        .preset-label {
          font-size: 11.5px;
          color: #9ca3af;
          white-space: nowrap;
          font-weight: 600;
        }

        .preset-select {
          flex: 1;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          color: #f3f4f6;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
        }

        .preset-select:hover {
          border-color: #4b5563;
        }

        .preset-select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
        }

        /* Live Inspector Card */
        .inspector-box {
          grid-column: 1 / -1;
          background: #0d131f;
          border: 1px solid #1e3a8a;
          border-radius: 14px;
          padding: 14px 18px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          font-size: 12px;
        }

        .inspect-item span {
          display: block;
          color: #60a5fa;
          font-size: 11px;
          margin-bottom: 2px;
          font-weight: 600;
        }

        .inspect-item strong {
          color: #f3f4f6;
          font-size: 14px;
        }

        .reset-btn {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 8px;
          border: 1px solid #374151;
          background: #1f2937;
          color: #9ca3af;
          cursor: pointer;
        }
        .reset-btn:hover {
          color: #fff;
          background: #374151;
        }

        /* Light Theme Adaptation */
        :host([data-theme="light"]) {
          color: #1e293b;
        }
        :host([data-theme="light"]) .preview-pane {
          background: #f8fafc;
          border-color: #3b82f6;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
        }
        :host([data-theme="light"]) .debug-panel {
          background: #ffffff;
          border-color: #e2e8f0;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);
        }
        :host([data-theme="light"]) .panel-header {
          border-bottom-color: #e2e8f0;
        }
        :host([data-theme="light"]) .panel-header h3 {
          color: #0f172a;
        }
        :host([data-theme="light"]) .panel-header .tag {
          background: #d1fae5;
          color: #065f46;
        }
        :host([data-theme="light"]) .control-group {
          background: #f8fafc;
          border-color: #e2e8f0;
        }
        :host([data-theme="light"]) .group-label {
          color: #475569;
        }
        :host([data-theme="light"]) .group-label span.value {
          color: #059669;
        }
        :host([data-theme="light"]) .btn-group button,
        :host([data-theme="light"]) .reset-btn {
          background: #ffffff;
          border-color: #cbd5e1;
          color: #334155;
        }
        :host([data-theme="light"]) .btn-group button:hover,
        :host([data-theme="light"]) .reset-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }
        :host([data-theme="light"]) .preset-label {
          color: #64748b;
        }
        :host([data-theme="light"]) .preset-select {
          color: #0f172a;
          background: #ffffff;
          border-color: #cbd5e1;
        }
        :host([data-theme="light"]) .preset-select:hover {
          border-color: #94a3b8;
        }
        :host([data-theme="light"]) .btn-group button.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #1d4ed8;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }
        :host([data-theme="light"]) .btn-group button.active.charge {
          background: #059669;
          border-color: #047857;
          box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
        }
        :host([data-theme="light"]) .inspector-box {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }
        :host([data-theme="light"]) .inspect-item span {
          color: #059669;
        }
        :host([data-theme="light"]) .inspect-item strong {
          color: #0f172a;
        }
        :host([data-theme="light"]) .sub-note {
          color: #64748b !important;
        }
      </style>

      <div class="debug-container">
        <!-- Top: Live Cloned Carrot Dashboard -->
        <div class="preview-pane">
          <div class="pane-badge">실시간 대시보드 뷰 (HA Dashboard Clone)</div>
          <div id="dashSlot"></div>
        </div>

        <!-- Bottom: Interactive Developer Control Panel -->
        <div class="debug-panel">
          <div class="panel-header">
            <h3>
              <span>🛠️</span> Carrot HA 실시간 디버거 (Live Debugger)
              <span class="tag">REAL-TIME SIMULATOR</span>
            </h3>
            <button id="btnReset" class="reset-btn">기본값 리셋</button>
          </div>

          <div class="controls-grid">
            
            <!-- Group 1: 차량 운행/충전 모드 -->
            <div class="control-group">
              <div class="group-label">
                <span>차량 동작 모드</span>
              </div>
              <div class="btn-group">
                ${DEBUG_MODES.map(item=>`<button data-mode="${item.mode}" class="${this.state.mode===item.mode?(item.mode==='charging'?'active charge':'active'):''}">${item[this.state.lang==='en'?'en':'ko']}</button>`).join('')}
              </div>
              <div class="text-[11px]" style="color:#9ca3af;font-size:11px;line-height:1.4">
                • <b>충전중</b>: 80/100% 마커, 완속(<11kW)/고속(≥11kW) 문구 및 속도 분기, 충전전력/ETA 상단 배치<br>
                • <b>주행중</b>: 에너지 방전 역방향 스윕 애니메이션, 4개 운행 카드 표시<br>
                • <b>주차중</b>: 정적 배터리 바, 4개 운행 카드 표시 (주행거리 → 이번달 주행 → 충전량 → 충전요금)
              </div>
            </div>

            <!-- Group 2: 배터리 SOC 잔량 슬라이더 -->
            <div class="control-group">
              <div class="group-label">
                <span>배터리 잔량 (SOC)</span>
                <span id="socVal" class="value">${this.state.soc}%</span>
              </div>
              <input id="socSlider" type="range" min="5" max="100" value="${this.state.soc}" step="1">
              <div class="preset-dropdown-row">
                <span class="preset-label">빠른 프리셋</span>
                <select id="socSelect" class="preset-select" aria-label="배터리 잔량 프리셋">
                  <option value="" disabled ${![20, 50, 74, 80, 85, 100].includes(this.state.soc) ? 'selected' : ''}>직접 조절 중 (${this.state.soc}%)</option>
                  <option value="20" ${this.state.soc === 20 ? 'selected' : ''}>20% (경고 · 저전압)</option>
                  <option value="50" ${this.state.soc === 50 ? 'selected' : ''}>50% (평균 잔량)</option>
                  <option value="74" ${this.state.soc === 74 ? 'selected' : ''}>74% (현재 ID.4 시뮬레이션)</option>
                  <option value="80" ${this.state.soc === 80 ? 'selected' : ''}>80% (충전 목표 기준선)</option>
                  <option value="85" ${this.state.soc === 85 ? 'selected' : ''}>85% (80% 초과 구간)</option>
                  <option value="100" ${this.state.soc === 100 ? 'selected' : ''}>100% (완충 완료)</option>
                </select>
              </div>
            </div>

            <!-- Group 3: 충전 전력 (kW) -->
            <div class="control-group">
              <div class="group-label">
                <span>충전 전력 (추정) <small style="color:#9ca3af;font-weight:normal">(11kW 완속/고속 분기)</small></span>
                <span id="powerVal" class="value">${this.state.powerKw.toFixed(1)} kW</span>
              </div>
              <input id="powerSlider" type="range" min="2.0" max="200.0" value="${this.state.powerKw}" step="0.1">
              <div class="preset-dropdown-row">
                <span class="preset-label">빠른 프리셋</span>
                <select id="powerSelect" class="preset-select" aria-label="충전 전력 프리셋">
                  <option value="" disabled ${![3.0, 7.0, 9.9, 50.0, 100.0, 135.0, 185.0].includes(this.state.powerKw) ? 'selected' : ''}>직접 조절 중 (${this.state.powerKw.toFixed(1)} kW)</option>
                  <option value="3.0" ${this.state.powerKw === 3.0 ? 'selected' : ''}>3.0 kW (220V 비상 충전)</option>
                  <option value="7.0" ${this.state.powerKw === 7.0 ? 'selected' : ''}>7.0 kW (표준 완속 충전)</option>
                  <option value="9.9" ${this.state.powerKw === 9.9 ? 'selected' : ''}>9.9 kW (ID.4 완속 최대)</option>
                  <option value="50.0" ${this.state.powerKw === 50.0 ? 'selected' : ''}>50.0 kW (공용 급속 충전)</option>
                  <option value="100.0" ${this.state.powerKw === 100.0 ? 'selected' : ''}>100.0 kW (초급속 충전)</option>
                  <option value="135.0" ${this.state.powerKw === 135.0 ? 'selected' : ''}>135.0 kW (ID.4 급속 피크)</option>
                  <option value="185.0" ${this.state.powerKw === 185.0 ? 'selected' : ''}>185.0 kW (2023 ID.4 초급속 피크)</option>
                </select>
              </div>
            </div>

            <!-- Group 4: 충전 시간 계산 모델 -->
            <div class="control-group">
              <div class="group-label">
                <span>충전 시간 계산 모델 <small style="color:#9ca3af;font-weight:normal">(테스트용)</small></span>
                <span id="calcModelVal" class="value">${this.state.calcModel === 'simple' ? '단순 선형' : 'ID.4 커브 (옵션 1)'}</span>
              </div>
              <div class="btn-group">
                <button id="btnModelCurve" class="${this.state.calcModel !== 'simple' ? 'active charge' : ''}">⚡ ID.4 커브 (옵션 1: 병목)</button>
                <button id="btnModelSimple" class="${this.state.calcModel === 'simple' ? 'active' : ''}">📏 기존 단순 선형</button>
              </div>
              <div class="sub-note" style="color:#9ca3af;font-size:11px;line-height:1.4">
                • <b>ID.4 커브 (옵션 1)</b>: 실측 속도와 ID.4 충전 커브의 병목 min(P_real, P_curve)을 1% 단위로 수치 적분하여 계산합니다.<br>
                • <b>기존 단순 선형</b>: 잔여 용량 / 현재 속도로 단순 계산합니다.
              </div>
            </div>

            <!-- Group 5: 테마 & 언어 -->
            <div class="control-group">
              <div class="group-label">
                <span>디스플레이 환경</span>
              </div>
              <div class="btn-group">
                <button id="btnThemeToggle">${this.state.theme === 'dark' ? '🌙 테마: 다크' : '☀️ 테마: 라이트'}</button>
                <button id="btnLangToggle">${this.state.lang === 'ko' ? '🌐 언어: 한국어 (KO)' : '🌐 Language: English (EN)'}</button>
              </div>
              <div class="sub-note" style="color:#9ca3af;font-size:11px;line-height:1.4">
                라이트/다크 테마 및 언어 변경 시 마커와 카드 대비를 즉시 확인합니다.
              </div>
            </div>

            <!-- Live Inspector Box -->
            <div class="inspector-box">
              <div class="inspect-item">
                <span>80% 도달 소요시간</span>
                <strong id="inspect80">—</strong>
              </div>
              <div class="inspect-item">
                <span>100% 완료 소요시간</span>
                <strong id="inspect100">—</strong>
              </div>
              <div class="inspect-item">
                <span>예상 완료시각 (ETA)</span>
                <strong id="inspectEta">—</strong>
              </div>
              <div class="inspect-item">
                <span>동작 모드 & 스윕 속도</span>
                <strong id="inspectSpeed">—</strong>
              </div>
              <div class="inspect-item">
                <span>저장 배터리 용량</span>
                <strong id="inspectKwh">—</strong>
              </div>
              <div class="inspect-item">
                <span>계산 방식</span>
                <strong id="inspectModel" style="color:#34d399;font-size:12px;">ID.4 커브 (옵션 1: 병목)</strong>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    this.mountDashboard();
    this.bindEvents();
    this.applyTheme(this.state.theme);
    this.applyDebugTelemetry();
  }

  applyTheme(theme, syncDashCard = true) {
    if (theme) {
      this.state.theme = (theme === 'auto') ? this.getEffectiveTheme('auto') : theme;
    }
    const currentTheme = this.getEffectiveTheme();
    this.setAttribute('data-theme', currentTheme);

    const btnTheme = this.shadowRoot?.querySelector('#btnThemeToggle');
    if (btnTheme) {
      btnTheme.textContent = currentTheme === 'dark' ? '🌙 테마: 다크' : '☀️ 테마: 라이트';
    }

    if (syncDashCard && this.dashCard) {
      this.dashCard.themeMode = currentTheme;
      this.dashCard.applyTheme();
      this.dashCard.render();
    }
  }

  mountDashboard() {
    const slot = this.shadowRoot.querySelector('#dashSlot');
    if (!slot) return;
    slot.innerHTML = '';

    const tagName = this.state.lang === 'ko' ? 'carrot-dashboard-ko' : 'carrot-dashboard-en';
    this.dashCard = document.createElement(tagName);
    this.dashCard.setConfig({
      ...(this.config || {}),
      charging_entity: 'binary_sensor.carrot_debug_simulated',
      color_mode: this.getEffectiveTheme()
    });

    // Make load a permanent simulated action so it never queries Cloudflare or HA REST APIs
    this.dashCard.load = async () => {
      this.applyDebugTelemetry();
    };
    this.dashCard.initialized = true;

    if (this._hass) {
      this.dashCard._hass = this._hass;
    }

    // Two-way theme sync: when user changes theme inside dashboard dropdown, sync debug panel
    const origDashApplyTheme = this.dashCard.applyTheme.bind(this.dashCard);
    this.dashCard.applyTheme = () => {
      origDashApplyTheme();
      const cardTheme = this.dashCard.getAttribute('data-theme') || this.getEffectiveTheme();
      if (this.getAttribute('data-theme') !== cardTheme) {
        this.applyTheme(cardTheme, false);
      }
    };

    // Patch embedded card with updated layouts, animations, icons, fonts, and mock data
    this.patchDashCard(this.dashCard);

    slot.appendChild(this.dashCard);
  }

  patchDashCard(card) {
    if (!card) return;

    card.load = async () => {
      this.applyDebugTelemetry();
    };

    const isEn = this.state.lang === 'en';
    card.vehicleStatus = v => {
      const labels=Object.fromEntries(DEBUG_MODES.map(item=>[item.key,item[isEn?'en':'ko']]));
      const key=v.display_state||debugDisplay(v).display_state;
      const elapsed=Number.isFinite(v.measurement_age_s)?Math.floor(v.measurement_age_s/60):null;
      const label=key==='stale'&&elapsed!==null?`${labels.stale} · ${elapsed}${isEn?' min ago':'분 전'}`:labels[key]||labels.unknown;
      return {key,label};
    };

    if (!card.trips || card.trips.length === 0) {
      card.trips = [
        {
          observed_at: new Date().toISOString(),
          data: {
            id: 'sim-trip-1',
            started_at: new Date(Date.now() - 1800000).toISOString(),
            ended_at: new Date(Date.now() - 300000).toISOString(),
            duration_s: 1500,
            distance_m: 14200,
            route: [
              { latitude: 37.5665, longitude: 126.9780, speedMps: 0 },
              { latitude: 37.5680, longitude: 126.9800, speedMps: 11.2 },
              { latitude: 37.5700, longitude: 126.9830, speedMps: 14.5 },
              { latitude: 37.5720, longitude: 126.9850, speedMps: 0 }
            ]
          }
        }
      ];
    }
    if (!card.charges || card.charges.length === 0) {
      card.charges = [
        {
          id: 'sim-charge-1',
          observed_at: new Date(Date.now() - 3600000).toISOString(),
          data: {
            started_at: new Date(Date.now() - 7200000).toISOString(),
            ended_at: new Date(Date.now() - 3600000).toISOString(),
            energy_kwh: 22.4,
            duration_s: 3600,
            partial: false
          }
        }
      ];
    }

    const origRender = card.render.bind(card);
    card.render = () => {
      const chargeState=card.v.charging?'on':'off';
      card._hass={...(this._hass||{}),states:{...(this._hass?.states||{}),'binary_sensor.carrot_debug_simulated':{state:chargeState}}};
      origRender();
      const refreshBtn = card.shadowRoot?.querySelector('.refresh');
      if (refreshBtn) {
        refreshBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.applyDebugTelemetry();
        };
      }
      this.injectCustomStyles(card);
    };
  }

  injectCustomStyles(card) {
    if (!card || !card.shadowRoot) return;

    let style = card.shadowRoot.querySelector('#debug-custom-enhancements');
    if (!style) {
      style = document.createElement('style');
      style.id = 'debug-custom-enhancements';
      card.shadowRoot.appendChild(style);
    }

    style.textContent = `
      .badge.stale,.badge.unknown,.badge.offline,.badge.connection_unknown{background:#49391e;color:#ffdc91}
      :host([data-theme="light"]) .badge.stale,:host([data-theme="light"]) .badge.unknown,:host([data-theme="light"]) .badge.offline,:host([data-theme="light"]) .badge.connection_unknown{background:#fff1bd;color:#745400}
      /* Typography & Alignment Unification across States */
      .energy-head .soc-value,
      .energy-head.charging-left .soc-value {
        font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 48px !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        letter-spacing: -1px !important;
        color: #ffffff !important;
        display: flex !important;
        align-items: baseline !important;
        gap: 4px !important;
      }

      .energy-head .soc-value small,
      .energy-head.charging-left .soc-value small {
        font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 24px !important;
        font-weight: 700 !important;
        color: #ffffff !important;
        letter-spacing: normal !important;
      }

      .energy-head .battery-label {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
      }

      .energy-head .battery-label span {
        font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 22px !important;
        font-weight: 700 !important;
        color: #ffffff !important;
        letter-spacing: -0.3px !important;
      }

      .energy-head.charging-left .charge-status-label {
        font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        letter-spacing: 0.3px !important;
        color: rgba(255, 255, 255, 0.95) !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35) !important;
      }

      /* Icons in Battery Bar */
      .battery-head-icon {
        width: 26px;
        height: 26px;
        fill: #ffffff !important;
        flex-shrink: 0;
        opacity: 0.95;
        filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
      }

      :host([data-theme="light"]) .battery-head-icon {
        fill: #ffffff !important;
      }

      .charge-head-bolt {
        width: 26px;
        height: 34px;
        fill: #4ade80 !important;
        flex-shrink: 0;
        margin-right: 8px;
        filter: drop-shadow(0 0 6px rgba(74, 222, 128, 0.6));
      }

      :host([data-theme="light"]) .charge-head-bolt {
        fill: #4ade80 !important;
      }

      .energy-head {
        position: relative !important;
        z-index: 5 !important;
      }

      /* Sweep animation frequencies */
      .sweep-beam.fast {
        animation: chargeSweep 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
      }

      .sweep-beam.slow {
        animation: chargeSweep 4.4s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
      }

      /* Reverse sweep for Driving mode (Discharge effect) */
      .sweep-beam.driving,
      .energy.is-driving .sweep-beam {
        width: 60% !important;
        height: 100% !important;
        background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 20%, rgba(255, 255, 255, 0.75) 50%, rgba(255, 255, 255, 0.1) 80%, transparent 100%) !important;
        filter: blur(1px) !important;
        animation: driveSweep 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
      }

      @keyframes driveSweep {
        0% {
          left: 100%;
          opacity: 0.1;
        }
        15% {
          opacity: 1;
        }
        85% {
          opacity: 1;
        }
        100% {
          left: -60%;
          opacity: 0.1;
        }
      }

      /* SOC low / critical styling */
      .energy.is-low,
      :host([data-theme="light"]) .energy.is-low,
      .energy.soc-low,
      :host([data-theme="light"]) .energy.soc-low {
        background: linear-gradient(90deg, #e5a50a 0 var(--soc), #5c3809 var(--soc) 100%) !important;
      }
      .energy.is-critical,
      :host([data-theme="light"]) .energy.is-critical,
      .energy.soc-critical,
      :host([data-theme="light"]) .energy.soc-critical {
        background: linear-gradient(90deg, #dc2626 0 var(--soc), #6b1414 var(--soc) 100%) !important;
      }
      .energy.is-low .battery-head-icon,
      .energy.soc-low .battery-head-icon,
      .energy.is-critical .battery-head-icon,
      .energy.soc-critical .battery-head-icon {
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)) !important;
      }

      /* Mobile responsiveness overrides */
      @container (max-width: 700px) {
        .energy-head .soc-value,
        .energy-head.charging-left .soc-value {
          font-size: 38px !important;
        }
        .energy-head .soc-value small,
        .energy-head.charging-left .soc-value small {
          font-size: 20px !important;
        }
        .energy-head .battery-label span {
          font-size: 18px !important;
        }
        .battery-head-icon {
          width: 22px;
          height: 22px;
        }
        .charge-head-bolt {
          width: 22px;
          height: 30px;
          margin-right: 6px;
        }
        .quick-metrics .metric:nth-child(n+3) {
          display: block !important;
        }
      }
    `;
  }

  bindEvents() {
    const root = this.shadowRoot;

    // Use the exact same state list as the upper-right badge.
    const updateModeBtns = () => {
      root.querySelectorAll('[data-mode]').forEach(button=>{
        const mode=button.dataset.mode;
        button.className=this.state.mode===mode?(mode==='charging'?'active charge':'active'):'';
      });
    };
    root.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
      this.state.mode=button.dataset.mode;
      updateModeBtns();
      this.applyDebugTelemetry();
    }));

    // SOC Slider & Preset Dropdown
    const socSlider = root.querySelector('#socSlider');
    const socVal = root.querySelector('#socVal');
    const socSelect = root.querySelector('#socSelect');

    const updateSocPresetUI = (val) => {
      if (socSelect) {
        if (socSelect.options && socSelect.options[0]) {
          socSelect.options[0].textContent = `직접 조절 중 (${val}%)`;
        }
        socSelect.value = [20, 50, 74, 80, 85, 100].includes(val) ? String(val) : '';
      }
    };

    if (socSlider) {
      socSlider.addEventListener('input', (e) => {
        this.state.soc = Number(e.target.value);
        if (socVal) socVal.textContent = this.state.soc + '%';
        updateSocPresetUI(this.state.soc);
        this.applyDebugTelemetry();
      });
    }

    if (socSelect) {
      socSelect.addEventListener('change', (e) => {
        const val = Number(e.target.value);
        if (!isNaN(val)) {
          this.state.soc = val;
          if (socSlider) socSlider.value = val;
          if (socVal) socVal.textContent = val + '%';
          updateSocPresetUI(val);
          this.applyDebugTelemetry();
        }
      });
    }

    // Power Slider & Preset Dropdown
    const powerSlider = root.querySelector('#powerSlider');
    const powerVal = root.querySelector('#powerVal');
    const powerSelect = root.querySelector('#powerSelect');

    const updatePowerPresetUI = (val) => {
      if (powerSelect) {
        if (powerSelect.options && powerSelect.options[0]) {
          powerSelect.options[0].textContent = `직접 조절 중 (${val.toFixed(1)} kW)`;
        }
        const matches = [3.0, 7.0, 9.9, 50.0, 100.0, 135.0, 185.0].some(p => Math.abs(p - val) < 0.05);
        powerSelect.value = matches ? val.toFixed(1) : '';
      }
    };

    if (powerSlider) {
      powerSlider.addEventListener('input', (e) => {
        this.state.powerKw = Number(e.target.value);
        if (powerVal) powerVal.textContent = this.state.powerKw.toFixed(1) + ' kW';
        updatePowerPresetUI(this.state.powerKw);
        this.applyDebugTelemetry();
      });
    }

    if (powerSelect) {
      powerSelect.addEventListener('change', (e) => {
        const val = Number(e.target.value);
        if (!isNaN(val)) {
          this.state.powerKw = val;
          if (powerSlider) powerSlider.value = val;
          if (powerVal) powerVal.textContent = val.toFixed(1) + ' kW';
          updatePowerPresetUI(val);
          this.applyDebugTelemetry();
        }
      });
    }

    // Calculation Model Toggle (Curve Option 1 vs Simple Linear)
    const btnModelCurve = root.querySelector('#btnModelCurve');
    const btnModelSimple = root.querySelector('#btnModelSimple');
    const calcModelVal = root.querySelector('#calcModelVal');

    if (btnModelCurve && btnModelSimple) {
      btnModelCurve.addEventListener('click', () => {
        this.state.calcModel = 'curve';
        btnModelCurve.className = 'active charge';
        btnModelSimple.className = '';
        if (calcModelVal) calcModelVal.textContent = 'ID.4 커브 (옵션 1)';
        this.applyDebugTelemetry();
      });

      btnModelSimple.addEventListener('click', () => {
        this.state.calcModel = 'simple';
        btnModelSimple.className = 'active';
        btnModelCurve.className = '';
        if (calcModelVal) calcModelVal.textContent = '단순 선형';
        this.applyDebugTelemetry();
      });
    }

    // Theme Toggle
    const btnTheme = root.querySelector('#btnThemeToggle');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        this._userThemeSelected = true;
        const currentTheme = this.getEffectiveTheme();
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(nextTheme, true);
      });
    }

    // Language Toggle
    const btnLang = root.querySelector('#btnLangToggle');
    if (btnLang) {
      btnLang.addEventListener('click', () => {
        this.state.lang = this.state.lang === 'ko' ? 'en' : 'ko';
        btnLang.textContent = this.state.lang === 'ko' ? '🌐 언어: 한국어 (KO)' : '🌐 Language: English (EN)';
        this.mountDashboard();
        this.applyDebugTelemetry();
      });
    }

    // Reset Button
    const btnReset = root.querySelector('#btnReset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.state.mode = 'charging';
        this.state.soc = 74;
        this.state.powerKw = 9.9;
        this.state.calcModel = 'curve';
        if (socSlider) socSlider.value = 74;
        if (socVal) socVal.textContent = '74%';
        updateSocPresetUI(74);
        if (powerSlider) powerSlider.value = 9.9;
        if (powerVal) powerVal.textContent = '9.9 kW';
        updatePowerPresetUI(9.9);
        if (calcModelVal) calcModelVal.textContent = 'ID.4 커브 (옵션 1)';
        if (btnModelCurve) btnModelCurve.className = 'active charge';
        if (btnModelSimple) btnModelSimple.className = '';
        updateModeBtns();
        this.applyDebugTelemetry();
      });
    }
  }
}
