// Carrot HA Live Debug Dashboard Card
// Clones the official Carrot Dashboard and provides a real-time UI controller underneath.

const BMS_CAPACITY = 70.8; // kWh (ID.4 BMS pack capacity)

export default class CarrotDebugDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.state = {
      mode: 'charging', // 'charging' | 'parked' | 'driving'
      soc: 74,
      powerKw: 9.9,
      lang: 'ko',
      theme: 'dark'
    };
  }

  connectedCallback() {
    this.style.display = 'block';
    this.render();
  }

  setConfig(config) {
    this.config = config || {};
    if (this.config.initial_soc != null) this.state.soc = Number(this.config.initial_soc);
    if (this.config.initial_charging != null) this.state.mode = this.config.initial_charging ? 'charging' : 'parked';
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.dashCard) {
      this.dashCard.hass = hass;
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
    const isCharging = this.state.mode === 'charging';
    const isDriving = this.state.mode === 'driving';

    // 80% calculations
    const target80Kwh = BMS_CAPACITY * 0.8;
    const need80Kwh = Math.max(0, target80Kwh - currentKwh);
    const sec80 = Math.round((need80Kwh / this.state.powerKw) * 3600);
    const eta80 = new Date(Date.now() + sec80 * 1000).toISOString();

    // 100% calculations
    const target100Kwh = BMS_CAPACITY * 1.0;
    const need100Kwh = Math.max(0, target100Kwh - currentKwh);
    const sec100 = Math.round((need100Kwh / this.state.powerKw) * 3600);
    const eta100 = new Date(Date.now() + sec100 * 1000).toISOString();

    const v = {
      ...(this.dashCard.v || {}),
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
      parking_at: new Date().toISOString()
    };

    if (isCharging) {
      v.charge_power_kw = this.state.powerKw;
      v.charge_power_w = this.state.powerKw * 1000;
      v.time_to_80_s = this.state.soc < 80 ? sec80 : 0;
      v.eta_80 = eta80;
      v.time_to_100_s = sec100;
      v.eta_100 = eta100;
    } else {
      v.charge_power_kw = 0;
      v.charge_power_w = 0;
      v.time_to_80_s = null;
      v.eta_80 = null;
      v.time_to_100_s = null;
      v.eta_100 = null;
    }

    this.dashCard.v = v;
    this.dashCard.busy = false;
    this.dashCard.render();
    this.updateInspectorReadout(v, sec80, sec100, eta100);
  }

  updateInspectorReadout(v, sec80, sec100, eta100) {
    const el80 = this.shadowRoot.querySelector('#inspect80');
    const el100 = this.shadowRoot.querySelector('#inspect100');
    const elEta = this.shadowRoot.querySelector('#inspectEta');
    const elSpeed = this.shadowRoot.querySelector('#inspectSpeed');
    const elKwh = this.shadowRoot.querySelector('#inspectKwh');

    if (el80) {
      el80.innerHTML = this.state.mode === 'charging'
        ? (this.state.soc >= 80 ? '<span class="text-amber-400">도달 완료 (80% 바 자동 숨김)</span>' : `<b>${this.formatDuration(sec80)}</b>`)
        : '—';
    }
    if (el100) {
      el100.innerHTML = this.state.mode === 'charging' ? `<b>${this.formatDuration(sec100)}</b>` : '—';
    }
    if (elEta) {
      elEta.innerHTML = this.state.mode === 'charging' ? `<b>${this.formatTime(eta100)}</b>` : '—';
    }
    if (elSpeed) {
      if (this.state.mode === 'charging') {
        const isFast = this.state.powerKw >= 11;
        elSpeed.innerHTML = isFast
          ? '<span style="color:#60a5fa;font-weight:700">⚡ 고속 충전 (2.2초 주기)</span>'
          : '<span style="color:#34d399;font-weight:700">🔌 완속 충전 (4.4초 주기)</span>';
      } else if (this.state.mode === 'driving') {
        elSpeed.innerHTML = '<span style="color:#38bdf8;font-weight:700">🚗 주행 방전 (역방향 2.5초)</span>';
      } else {
        elSpeed.innerHTML = '<span style="color:#9ca3af;font-weight:700">🅿️ 주차 (정적 바)</span>';
      }
    }
    if (elKwh) {
      elKwh.innerHTML = `<b>${(v.battery_kwh || 0).toFixed(1)}</b> / ${BMS_CAPACITY} kWh`;
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

        /* Quick presets chip */
        .presets {
          display: flex;
          gap: 6px;
          overflow-x: auto;
        }

        .presets button {
          padding: 4px 8px;
          font-size: 11px;
          border-radius: 6px;
          background: #111827;
          border: 1px solid #374151;
          color: #9ca3af;
          cursor: pointer;
          white-space: nowrap;
        }

        .presets button:hover {
          color: #f3f4f6;
          border-color: #4b5563;
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
                <button id="btnModeCharge" class="${this.state.mode === 'charging' ? 'active charge' : ''}">⚡ 충전중</button>
                <button id="btnModePark" class="${this.state.mode === 'parked' ? 'active' : ''}">🅿️ 주차/미충전</button>
                <button id="btnModeDrive" class="${this.state.mode === 'driving' ? 'active' : ''}">🚗 주행중</button>
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
              <div class="presets">
                <button data-soc="20">20% (경고)</button>
                <button data-soc="50">50%</button>
                <button data-soc="74">74% (현재)</button>
                <button data-soc="80">80% (경계)</button>
                <button data-soc="85">85% (80초과)</button>
                <button data-soc="100">100%</button>
              </div>
            </div>

            <!-- Group 3: 충전 전력 (kW) -->
            <div class="control-group">
              <div class="group-label">
                <span>충전 전력 (추정) <small style="color:#9ca3af;font-weight:normal">(11kW 완속/고속 분기)</small></span>
                <span id="powerVal" class="value">${this.state.powerKw.toFixed(1)} kW</span>
              </div>
              <input id="powerSlider" type="range" min="2.0" max="150.0" value="${this.state.powerKw}" step="0.1">
              <div class="presets">
                <button data-kw="3.0">3kW (220V)</button>
                <button data-kw="7.0">7kW (완속)</button>
                <button data-kw="9.9">9.9kW (ID.4)</button>
                <button data-kw="50.0">50kW (급속)</button>
                <button data-kw="100.0">100kW</button>
                <button data-kw="135.0">135kW (피크)</button>
              </div>
            </div>

            <!-- Group 4: 테마 & 언어 -->
            <div class="control-group">
              <div class="group-label">
                <span>디스플레이 환경</span>
              </div>
              <div class="btn-group">
                <button id="btnThemeToggle">다크 모드</button>
                <button id="btnLangToggle">한국어 (KO)</button>
              </div>
              <div style="color:#9ca3af;font-size:11px;line-height:1.4">
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
            </div>

          </div>
        </div>
      </div>
    `;

    this.mountDashboard();
    this.bindEvents();
    this.applyDebugTelemetry();
  }

  mountDashboard() {
    const slot = this.shadowRoot.querySelector('#dashSlot');
    if (!slot) return;
    slot.innerHTML = '';

    const tagName = this.state.lang === 'ko' ? 'carrot-dashboard-ko' : 'carrot-dashboard-en';
    this.dashCard = document.createElement(tagName);
    this.dashCard.setConfig({
      ...(this.config || {}),
      color_mode: this.state.theme
    });

    if (this._hass) {
      this.dashCard.hass = this._hass;
    }

    // Override load so it doesn't wipe our simulated debug values
    this.dashCard.load = async () => {};

    // Patch embedded card with updated layouts, animations, icons, and fonts
    this.patchDashCard(this.dashCard);

    slot.appendChild(this.dashCard);
  }

  patchDashCard(card) {
    if (!card) return;

    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const n = (v, digits=1) => typeof v==='number' && Number.isFinite(v) ? v.toLocaleString('ko-KR',{maximumFractionDigits:digits}) : '—';
    const time = v => v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '기록 없음';
    const timeOnly = v => v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toLocaleString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '기록 없음';
    const shortDuration = v => typeof v==='number' ? (Math.floor(v/3600)?Math.floor(v/3600)+'시간 ':'')+Math.floor(v/60)%60+'분' : '—';
    const chargeDuration = s => { if(typeof s !== 'number' || !Number.isFinite(s)) return '—'; if(s <= 0) return '완료'; const totalMins = Math.round(s/60); const h = Math.floor(totalMins/60); const m = totalMins%60; if(h === 0) return `${m}분`; return m === 0 ? `${h}시간` : `${h}시간 ${m}분`; };
    const icon = name => {
      if(name==='flash-double')return `<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,20px);height:var(--mdc-icon-size,20px);display:inline-block" fill="currentColor" aria-hidden="true"><path d="M3.2,4V12.8H5.6V20L11.2,10.4H8L11.2,4Z"/><path d="M12.8,4V12.8H15.2V20L20.8,10.4H17.6L20.8,4Z"/></svg>`;
      return `<ha-icon icon="mdi:${name}"></ha-icon>`;
    };
    const metric = (label,value,unit,ico,sub='',cls='') => `<div class="metric ${cls}">${icon(ico)}<span class="label">${label}</span><strong>${esc(value)}<small>${esc(unit)}</small></strong>${sub?`<span class="hint">${esc(sub)}</span>`:''}</div>`;

    card.vehicleStatus = (v) => {
      if (v.charging) return { key: 'charging', label: '충전중' };
      if (v.onroad) return { key: 'driving', label: '주행 중' };
      return { key: 'parked', label: '주차중' };
    };

    card.overview = (v) => {
      const charging = Boolean(v.charging);
      const isDriving = Boolean(v.onroad);
      const latest = card.trips?.[0]?.data;
      const soc = Number.isFinite(v.soc_percent) ? Math.max(0, Math.min(100, v.soc_percent)) : null;
      const status = card.vehicleStatus(v).label;
      const powerKw = v.charge_power_kw ?? (v.charge_power_w == null ? null : v.charge_power_w / 1000);
      const isFast = typeof powerKw === 'number' && powerKw >= 11;
      const chargeLabel = isFast ? '고속충전중...' : '완속충전중...';
      const sweepSpeedClass = isFast ? 'fast' : 'slow';

      // 4 Cards Layout
      // Charging: [충전 전력 · 추정, 예상 완료시간] on top, [총 주행거리, 이번 달 충전량] on bottom
      // Parked/Driving: [총 주행거리, 이번 달 주행, 이번 달 충전량, 이번 달 충전요금]
      const quickMetrics = charging
        ? `${metric('충전 전력 · 추정', n(powerKw, 1), 'kW', 'ev-station', isFast ? '급속 충전' : '완속 충전', 'charge-power')}` +
          `${metric('예상 완료시간', v.eta_100 ? timeOnly(v.eta_100) : '계산 중', '', 'clock-end', v.time_to_100_s != null ? chargeDuration(v.time_to_100_s) + ' 남음' : '100% 목표')}` +
          `${metric('총 주행거리', n(v.odometer_km, 0), 'km', 'counter')}` +
          `${metric('이번 달 충전량', n(v.month_charge_kwh), 'kWh', 'battery-plus')}`
        : `${metric('총 주행거리', n(v.odometer_km, 0), 'km', 'counter')}` +
          `${metric('이번 달 주행', n(v.month_distance_km), 'km', 'routes')}` +
          `${metric('이번 달 충전량', n(v.month_charge_kwh), 'kWh', 'battery-plus')}` +
          `${metric('이번 달 충전요금', n(v.month_charge_cost, 0), '원', 'cash', '추정치')}`;

      // Markers HTML (charging only)
      const markersHtml = charging
        ? `${(soc == null || soc < 80) ? `<div class="charge-marker marker-80" data-top="80%" data-bottom="${chargeDuration(v.time_to_80_s)}"><span class="marker-cap cap-top"></span><span class="marker-cap cap-bottom"></span></div>` : ''}` +
          `<div class="charge-marker marker-100" data-top="100%" data-bottom="${chargeDuration(v.time_to_100_s)}"><span class="marker-cap cap-top"></span><span class="marker-cap cap-bottom"></span></div>`
        : '';

      // Sweep animation:
      // Charging: forward beam with slow (4.4s) or fast (2.2s) speed
      // Driving: reverse beam (energy discharge, 2.5s)
      // Parked: static (no sweep HTML)
      const sweepHtml = charging
        ? `<div class="sweep-overlay"><div class="sweep-clipper"><div class="sweep-beam ${sweepSpeedClass}"></div></div></div>`
        : (isDriving
          ? `<div class="sweep-overlay"><div class="sweep-clipper"><div class="sweep-beam driving"></div></div></div>`
          : '');

      // Battery bar head HTML
      // Charging: Lightning bolt icon + stacked status & SOC
      // Parked / Driving: Battery outline icon + '배터리 잔량' + SOC
      const energyHeadHtml = charging
        ? `<div class="energy-head charging-left">
             <svg viewBox="0 0 24 24" class="charge-head-bolt"><path d="M7 2v11h3v9l7-12h-4l3-8z"/></svg>
             <div class="charge-info-stack">
               <span class="charge-status-label">${chargeLabel}</span>
               <strong class="soc-value">${n(soc, 0)}<small>%</small></strong>
             </div>
           </div>`
        : `<div class="energy-head">
             <div class="battery-label">
               <svg viewBox="0 0 24 24" class="battery-head-icon"><path d="M16.67 4C17.4 4 18 4.6 18 5.33v15.34A1.33 1.33 0 0 1 16.67 22H7.33A1.33 1.33 0 0 1 6 20.67V5.33C6 4.6 6.6 4 7.33 4H9V2h6v2h1.67M16 6H8v14h8V6z"/></svg>
               <span>배터리 잔량</span>
             </div>
             <strong class="soc-value">${n(soc, 0)}<small>%</small></strong>
           </div>`;

      return `<div class="cockpit">
        <section class="hero">
          <div class="hero-copy"><h2>${esc(status).replace('\n', '<br>')}</h2></div>
          ${card.vehicleImage()}
        </section>
        <div class="quick">
          <section class="energy ${charging ? 'is-charging' : ''} ${isDriving ? 'is-driving' : ''}" style="--soc:${soc ?? 0}%">
            ${sweepHtml}
            ${markersHtml}
            ${energyHeadHtml}
          </section>
          <div class="quick-metrics">${quickMetrics}</div>
        </div>
      </div>
      <div class="overview-links">
        <button class="shortcut" data-tab="parking">
          <span><b>주차 위치</b><small>${v.parking_latitude == null ? '위치 수신 대기' : time(v.parking_at)}</small></span>
          <em>지도 →</em>
          <div class="mini-map parking-mini"></div>
        </button>
        <button class="shortcut" data-tab="trips">
          <span><b>최근 주행</b><small>${latest ? n(latest.distance_m == null ? null : latest.distance_m / 1000, 2) + ' km' : '기록 없음'}</small><small>${latest ? shortDuration(latest.duration_s) : '새 주행 기록을 기다립니다'}</small></span>
          <em>보기 →</em>
          <div class="mini-map trip-mini"></div>
        </button>
      </div>
      <div class="mini-condition">
        <span>외기 <b>${n(v.outside_temp_c)}°C</b></span>
        <span>12V <b>${n(v.aux_voltage, 1)}V</b></span>
        <span>공조 <b>${v.ac_on == null ? '—' : v.ac_on ? 'ON' : 'OFF'}</b></span>
      </div>`;
    };

    const origRender = card.render.bind(card);
    card.render = () => {
      origRender();
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
        fill: #60a5fa;
        flex-shrink: 0;
        filter: drop-shadow(0 0 5px rgba(96, 165, 250, 0.4));
      }

      :host([data-theme="light"]) .battery-head-icon {
        fill: #2563eb;
      }

      .charge-head-bolt {
        width: 26px;
        height: 34px;
        fill: #4ade80;
        flex-shrink: 0;
        margin-right: 8px;
        filter: drop-shadow(0 0 6px rgba(74, 222, 128, 0.6));
      }

      /* Sweep animation frequencies */
      .sweep-beam.fast {
        animation: chargeSweep 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
      }

      .sweep-beam.slow {
        animation: chargeSweep 4.4s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
      }

      /* Reverse sweep for Driving mode (Discharge effect) */
      .energy.is-driving .sweep-beam.driving {
        left: 100% !important;
        background: linear-gradient(90deg, transparent 0%, rgba(147, 197, 253, 0.08) 30%, rgba(224, 242, 254, 0.45) 50%, rgba(147, 197, 253, 0.08) 70%, transparent 100%) !important;
        filter: blur(1px) !important;
        animation: driveSweep 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
      }

      @keyframes driveSweep {
        0% { left: 100%; opacity: 0.1; }
        20% { opacity: 0.85; }
        80% { opacity: 0.85; }
        100% { left: -60%; opacity: 0.1; }
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

    // Mode Buttons
    const btnCharge = root.querySelector('#btnModeCharge');
    const btnPark = root.querySelector('#btnModePark');
    const btnDrive = root.querySelector('#btnModeDrive');

    const updateModeBtns = () => {
      [btnCharge, btnPark, btnDrive].forEach(b => b.className = '');
      if (this.state.mode === 'charging') btnCharge.className = 'active charge';
      else if (this.state.mode === 'parked') btnPark.className = 'active';
      else if (this.state.mode === 'driving') btnDrive.className = 'active';
    };

    btnCharge.addEventListener('click', () => {
      this.state.mode = 'charging';
      updateModeBtns();
      this.applyDebugTelemetry();
    });

    btnPark.addEventListener('click', () => {
      this.state.mode = 'parked';
      updateModeBtns();
      this.applyDebugTelemetry();
    });

    btnDrive.addEventListener('click', () => {
      this.state.mode = 'driving';
      updateModeBtns();
      this.applyDebugTelemetry();
    });

    // SOC Slider
    const socSlider = root.querySelector('#socSlider');
    const socVal = root.querySelector('#socVal');
    socSlider.addEventListener('input', (e) => {
      this.state.soc = Number(e.target.value);
      socVal.textContent = this.state.soc + '%';
      this.applyDebugTelemetry();
    });

    // SOC Preset Chips
    root.querySelectorAll('.presets button[data-soc]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.soc = Number(btn.getAttribute('data-soc'));
        socSlider.value = this.state.soc;
        socVal.textContent = this.state.soc + '%';
        this.applyDebugTelemetry();
      });
    });

    // Power Slider
    const powerSlider = root.querySelector('#powerSlider');
    const powerVal = root.querySelector('#powerVal');
    powerSlider.addEventListener('input', (e) => {
      this.state.powerKw = Number(e.target.value);
      powerVal.textContent = this.state.powerKw.toFixed(1) + ' kW';
      this.applyDebugTelemetry();
    });

    // Power Preset Chips
    root.querySelectorAll('.presets button[data-kw]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.powerKw = Number(btn.getAttribute('data-kw'));
        powerSlider.value = this.state.powerKw;
        powerVal.textContent = this.state.powerKw.toFixed(1) + ' kW';
        this.applyDebugTelemetry();
      });
    });

    // Theme Toggle
    const btnTheme = root.querySelector('#btnThemeToggle');
    btnTheme.addEventListener('click', () => {
      this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
      btnTheme.textContent = this.state.theme === 'dark' ? '다크 모드' : '라이트 모드';
      if (this.dashCard) {
        this.dashCard.themeMode = this.state.theme;
        this.dashCard.applyTheme();
        this.dashCard.render();
      }
    });

    // Language Toggle
    const btnLang = root.querySelector('#btnLangToggle');
    btnLang.addEventListener('click', () => {
      this.state.lang = this.state.lang === 'ko' ? 'en' : 'ko';
      btnLang.textContent = this.state.lang === 'ko' ? '한국어 (KO)' : 'English (EN)';
      this.mountDashboard();
      this.applyDebugTelemetry();
    });

    // Reset Button
    root.querySelector('#btnReset').addEventListener('click', () => {
      this.state.mode = 'charging';
      this.state.soc = 74;
      this.state.powerKw = 9.9;
      socSlider.value = 74;
      socVal.textContent = '74%';
      powerSlider.value = 9.9;
      powerVal.textContent = '9.9 kW';
      updateModeBtns();
      this.applyDebugTelemetry();
    });
  }
}
