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
      month_charge_kwh: 155.9,
      month_distance_km: 1248,
      range_km: Math.round(this.state.soc * 4.2),
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
                • <b>충전중</b>: 80/100% 돌출 바, 스윕 애니메이션, 2x2 충전 전력/ETA 카드 활성화<br>
                • <b>미충전</b>: 원래 배터리 잔량(좌우분리) 및 기본 카드로 자동 복귀
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
                <span>충전 전력 (추정)</span>
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

    slot.appendChild(this.dashCard);
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
