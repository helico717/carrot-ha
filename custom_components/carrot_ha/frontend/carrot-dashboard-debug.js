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
    return { sec80: null, eta80: null, sec100: null, eta100: null, simpleSec80: null, simpleSec100: null, effectiveKw: null };
  }

  const soc = Math.max(0, Math.min(100, currentSoc));
  const currentKwh = (soc / 100) * capacityKwh;
  const currentCurveKw = ID4_CHARGING_CURVE_KW[Math.min(100, Math.max(1, Math.round(soc)))];
  const effectiveKw = soc >= 100 ? 0 : Math.min(powerKw, currentCurveKw);

  // Simple linear benchmark calculation based on current intake power
  const target80Kwh = capacityKwh * 0.8;
  const need80Kwh = Math.max(0, target80Kwh - currentKwh);
  const simplePower = Math.max(0.3, effectiveKw > 0 ? effectiveKw : powerKw);
  const simpleSec80 = Math.round((need80Kwh / simplePower) * 3600);

  const target100Kwh = capacityKwh * 1.0;
  const need100Kwh = Math.max(0, target100Kwh - currentKwh);
  const simpleSec100 = Math.round((need100Kwh / simplePower) * 3600);

  if (calcModel === 'simple') {
    return {
      sec80: simpleSec80,
      eta80: new Date(baseTimeMs + simpleSec80 * 1000).toISOString(),
      sec100: simpleSec100,
      eta100: new Date(baseTimeMs + simpleSec100 * 1000).toISOString(),
      simpleSec80,
      simpleSec100,
      effectiveKw
    };
  }

  // Option 1: Bottleneck Model (충전기 상한 및 커브 동시 적용)
  const calcTimeToSoc = (targetSoc) => {
    if (soc >= targetSoc) return 0;
    let totalSec = 0;
    const startInt = Math.floor(soc);
    const targetInt = Math.floor(targetSoc);

    for (let s = startInt; s < targetInt; s++) {
      const curveVal = ID4_CHARGING_CURVE_KW[Math.min(100, s + 1)];
      const stepKw = Math.max(0.3, Math.min(powerKw, curveVal));
      let stepFraction = 1.0;
      if (s === startInt) {
        stepFraction = (startInt + 1) - soc;
      }
      const stepKwh = capacityKwh * 0.01 * stepFraction;
      totalSec += (stepKwh / stepKw) * 3600;
    }

    if (targetSoc > targetInt) {
      const curveVal = ID4_CHARGING_CURVE_KW[Math.min(100, targetInt + 1)];
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

  return { sec80, eta80, sec100, eta100, simpleSec80, simpleSec100, effectiveKw };
}

function generateMockBatteryHistory(currentSoc = 74, isCharging = false, isDriving = false, nowMs = Date.now()) {
  const now = new Date(nowMs);
  const currentHour = now.getHours();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const targetDate = new Date(nowMs);
    targetDate.setDate(targetDate.getDate() - i);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const isToday = (i === 0);
    const hours = new Array(24).fill(null);
    const charge_hours = new Array(24).fill(false);

    let used = 0;
    let drive_s = 0;
    let charge_s = 0;
    let valid_samples = 0;

    if (!isToday) {
      const patterns = [
        { chargeStart: 1, chargeEnd: 5, chargeFrom: 45, chargeTo: 85, drive1Start: 8, drive1End: 9, soc1: 72, drive2Start: 18, drive2End: 19, soc2: 60, used: 25.0, drive_s: 5400, charge_s: 14400 },
        { chargeStart: 13, chargeEnd: 14, chargeFrom: 20, chargeTo: 80, drive1Start: 9, drive1End: 12, soc1: 20, drive2Start: 15, drive2End: 18, soc2: 35, used: 105.0, drive_s: 18000, charge_s: 3600 },
        { chargeStart: null, drive1Start: 12, drive1End: 13, soc1: 70, used: 10.0, drive_s: 2400, charge_s: 0 },
        { chargeStart: 2, chargeEnd: 6, chargeFrom: 35, chargeTo: 90, drive1Start: 8, drive1End: 9, soc1: 78, drive2Start: 19, drive2End: 20, soc2: 65, used: 38.0, drive_s: 6000, charge_s: 14400 },
        { chargeStart: 20, chargeEnd: 23, chargeFrom: 40, chargeTo: 80, drive1Start: 9, drive1End: 10, soc1: 68, drive2Start: 18, drive2End: 19, soc2: 52, used: 32.0, drive_s: 5800, charge_s: 10800 },
        { chargeStart: 1, chargeEnd: 4, chargeFrom: 50, chargeTo: 85, drive1Start: 8, drive1End: 9, soc1: 74, drive2Start: 18, drive2End: 19, soc2: 62, used: 28.5, drive_s: 5400, charge_s: 10800 }
      ];

      const p = patterns[i - 1] || patterns[0];
      used = p.used;
      drive_s = p.drive_s;
      charge_s = p.charge_s;

      let currentSimSoc = p.chargeFrom || 60;
      for (let h = 0; h < 24; h++) {
        let charging = false;
        let driving = false;

        if (p.chargeStart != null && h >= p.chargeStart && h <= p.chargeEnd) {
          charging = true;
          charge_hours[h] = true;
          const progress = (h - p.chargeStart + 1) / (p.chargeEnd - p.chargeStart + 1);
          currentSimSoc = Math.min(100, Math.round(p.chargeFrom + (p.chargeTo - p.chargeFrom) * progress));
        } else if (h === p.drive1Start || (p.drive1End && h === p.drive1End)) {
          driving = true;
          currentSimSoc = p.soc1;
        } else if (p.drive2Start && (h === p.drive2Start || (p.drive2End && h === p.drive2End))) {
          driving = true;
          currentSimSoc = p.soc2;
        }

        hours[h] = {
          soc: currentSimSoc,
          charging,
          driving,
          last_known: !charging && !driving
        };
      }
      valid_samples = 280;
    } else {
      let runningSoc = Math.min(100, Math.max(10, currentSoc + (isDriving ? 8 : isCharging ? -15 : 4)));
      for (let h = 0; h <= currentHour; h++) {
        if (h === currentHour) {
          hours[h] = {
            soc: currentSoc,
            charging: isCharging,
            driving: isDriving,
            last_known: !isCharging && !isDriving
          };
          if (isCharging) charge_hours[h] = true;
        } else {
          const isMorningCommute = (h === 8 || h === 9);
          const wasOvernightCharge = (h >= 1 && h <= 4);
          let ch = wasOvernightCharge;
          let dr = isMorningCommute;
          if (ch) {
            charge_hours[h] = true;
            runningSoc = Math.min(95, runningSoc + 8);
          } else if (dr) {
            runningSoc = Math.max(20, runningSoc - 6);
          }
          hours[h] = {
            soc: Math.round(runningSoc),
            charging: ch,
            driving: dr,
            last_known: !ch && !dr
          };
        }
      }
      used = Math.round(Math.max(5, (100 - currentSoc) * 0.6) * 10) / 10;
      drive_s = isDriving ? 3200 : 2100;
      charge_s = isCharging ? 5400 : 1800;
      valid_samples = Math.max(12, currentHour * 14);
    }

    days.push({
      date: dateStr,
      used,
      drive_s,
      charge_s,
      covered_s: drive_s + charge_s + (isToday ? currentHour * 900 : 3600 * 8),
      received_samples: valid_samples + 8,
      valid_samples,
      stale_samples: 1,
      hours,
      charge_hours
    });
  }

  return days;
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
      powerKw: 11,
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
    const { sec80, eta80, sec100, eta100, simpleSec80, simpleSec100, effectiveKw } = estimateChargingTimesWithCurve(
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
      month_slow_kwh: 45.5,
      month_fast_kwh: 110.4,
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
      const liveKw = effectiveKw != null ? Number(effectiveKw.toFixed(1)) : this.state.powerKw;
      v.charge_power_kw = liveKw;
      v.charge_power_w = Math.round(liveKw * 1000);
      v.charger_max_kw = this.state.powerKw;
      v.time_to_80_s = this.state.soc < 80 ? sec80 : 0;
      v.eta_80 = eta80;
      v.time_to_100_s = sec100;
      v.eta_100 = eta100;
      v.calc_model = this.state.calcModel || 'curve';
      v.simple_sec80 = simpleSec80;
      v.simple_sec100 = simpleSec100;
      v.effective_kw = liveKw;
      v.emergency_charging = !impaired && (liveKw <= 1.5);
    } else {
      v.charge_power_kw = 0;
      v.charge_power_w = 0;
      v.charger_max_kw = 0;
      v.effective_kw = 0;
      v.emergency_charging = false;
      v.time_to_80_s = null;
      v.eta_80 = null;
      v.time_to_100_s = null;
      v.eta_100 = null;
    }

    const batteryHistory = generateMockBatteryHistory(this.state.soc, isCharging, isDriving, now);
    v.battery_history = batteryHistory;

    const displayed=debugDisplay(v,Date.now(),this.lastGood?.values);
    if(['charging','driving','parked'].includes(displayed.display_state))this.lastGood={mode:displayed.display_state,at:measuredAt,values:{...displayed}};
    this.dashCard.v = {...displayed, battery_history: batteryHistory, debug_raw: v};
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
    const elCharger = this.shadowRoot.querySelector('#inspectCharger');
    const elEffective = this.shadowRoot.querySelector('#inspectEffective');
    const elIntake = this.shadowRoot.querySelector('#effectiveIntakeVal');
    const elSocLabel = this.shadowRoot.querySelector('#effectiveSocLabel');
    const elEmergency = this.shadowRoot.querySelector('#inspectEmergency');
    const elEmergencyNotice = this.shadowRoot.querySelector('#emergencyNotice');

    if (elSocLabel) {
      elSocLabel.textContent = `${this.state.soc}%`;
    }

    const curveVal = ID4_CHARGING_CURVE_KW[Math.min(100, Math.max(1, Math.round(this.state.soc)))];
    const chargerKw = this.state.powerKw;
    const effectiveKw = Math.min(chargerKw, curveVal);
    const isThrottled = chargerKw > curveVal;
    const isEmergency = v.charging === true && !v.stale && (effectiveKw <= 1.5);

    if (elIntake) {
      if (v.charging === true) {
        if (this.state.soc >= 100) {
          elIntake.innerHTML = '<span style="color:#94a3b8;">완충됨 (0.0 kW)</span>';
        } else if (isEmergency) {
          elIntake.innerHTML = `<span style="color:#ef4444;font-weight:700;">${effectiveKw.toFixed(1)} kW (비상충전 모드)</span>`;
        } else if (isThrottled) {
          elIntake.innerHTML = `<span style="color:#f59e0b;font-weight:700;">${effectiveKw.toFixed(1)} kW</span> <small style="color:#94a3b8;font-size:10.5px;">(차량 커브 ${curveVal.toFixed(1)} kW 제한)</small>`;
        } else {
          elIntake.innerHTML = `<span style="color:#34d399;font-weight:700;">${effectiveKw.toFixed(1)} kW</span> <small style="color:#94a3b8;font-size:10.5px;">(충전기 용량 100% 수전)</small>`;
        }
      } else {
        elIntake.innerHTML = '<span style="color:#94a3b8;">0.0 kW (충전 아님)</span>';
      }
    }

    if (elEmergencyNotice) {
      if (isEmergency) {
        elEmergencyNotice.style.display = 'block';
        elEmergencyNotice.textContent = '⚠️ 완속 충전기 미체결로 인한 1kW 비상충전 모드 진입으로 추정됩니다 (HA 엔터티 ON 조건).';
      } else {
        elEmergencyNotice.style.display = 'none';
      }
    }

    if (elEmergency) {
      if (v.charging === true) {
        if (v.stale === true) {
          elEmergency.innerHTML = '<span style="color:#94a3b8;">데이터 지연 (확인 불가)</span>';
        } else if (isEmergency) {
          elEmergency.innerHTML = '<span style="color:#ef4444;font-weight:700;">🚨 비상충전 감지 (≤1.5kW)</span>';
        } else {
          elEmergency.innerHTML = '<span style="color:#34d399;font-weight:600;">정상 충전</span>';
        }
      } else {
        elEmergency.innerHTML = '—';
      }
    }

    if (elCharger) {
      elCharger.innerHTML = v.charging === true ? `<b>${chargerKw.toFixed(1)} kW</b>` : '—';
    }

    if (elEffective) {
      if (v.charging === true) {
        if (this.state.soc >= 100) {
          elEffective.innerHTML = '<b style="color:#94a3b8;">0.0 kW (완충)</b>';
        } else if (isEmergency) {
          elEffective.innerHTML = `<b style="color:#ef4444;">${effectiveKw.toFixed(1)} kW</b> <small style="display:block;font-size:10.5px;color:#f87171;font-weight:normal;">(비상충전 감지)</small>`;
        } else if (isThrottled) {
          elEffective.innerHTML = `<b style="color:#f59e0b;">${effectiveKw.toFixed(1)} kW</b> <small style="display:block;font-size:10.5px;color:#94a3b8;font-weight:normal;">(커브 ${curveVal.toFixed(1)}kW 병목)</small>`;
        } else {
          elEffective.innerHTML = `<b style="color:#34d399;">${effectiveKw.toFixed(1)} kW</b>`;
        }
      } else {
        elEffective.innerHTML = '—';
      }
    }

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
          width: 100%;
          box-sizing: border-box;
        }

        #dashSlot {
          width: 100%;
          display: block;
        }

        #dashSlot > * {
          width: 100% !important;
          display: block;
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

        .btn-group button small {
          display: block;
          font-size: 10px;
          font-weight: 400;
          color: #9ca3af;
          margin-top: 2px;
          white-space: nowrap;
        }

        .btn-group button.active small {
          color: #d1fae5;
        }

        .charger-section-title {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          margin: 6px 0 2px;
          display: flex;
          align-items: center;
          gap: 4px;
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

            <!-- Group 3: 충전기 사양 선택 (EVSE Presets) & 충전 전력 -->
            <div class="control-group">
              <div class="group-label">
                <span>충전기 사양 (EVSE Spec)</span>
                <span id="powerVal" class="value">${this.state.powerKw.toFixed(1)} kW</span>
              </div>
              
              <!-- 완속 (AC) / 비상 충전 버튼군: 1, 3, 7, 11 kW -->
              <div class="charger-section-title">🔌 완속 충전기 (AC) & 비상 충전</div>
              <div class="btn-group">
                <button data-charger="1" class="${Math.abs(this.state.powerKw - 1) < 0.1 ? 'active charge' : ''}">1 kW<small>비상충전중</small></button>
                <button data-charger="3" class="${Math.abs(this.state.powerKw - 3) < 0.1 ? 'active charge' : ''}">3 kW<small>비상 220V</small></button>
                <button data-charger="7" class="${Math.abs(this.state.powerKw - 7) < 0.1 ? 'active charge' : ''}">7 kW<small>표준 완속</small></button>
                <button data-charger="11" class="${Math.abs(this.state.powerKw - 11) < 0.1 ? 'active charge' : ''}">11 kW<small>공용/심야 완속</small></button>
              </div>

              <!-- 급속 / 초급속 (DC) 버튼군: 50, 100, 350, 500 kW -->
              <div class="charger-section-title">⚡ 급속 / 초급속 충전기 (DC)</div>
              <div class="btn-group">
                <button data-charger="50" class="${Math.abs(this.state.powerKw - 50) < 0.1 ? 'active charge' : ''}">50 kW<small>일반 급속</small></button>
                <button data-charger="100" class="${Math.abs(this.state.powerKw - 100) < 0.1 ? 'active charge' : ''}">100 kW<small>고속 급속</small></button>
                <button data-charger="350" class="${Math.abs(this.state.powerKw - 350) < 0.1 ? 'active charge' : ''}">350 kW<small>초급속 (E-pit)</small></button>
                <button data-charger="500" class="${Math.abs(this.state.powerKw - 500) < 0.1 ? 'active charge' : ''}">500 kW<small>메가와트급</small></button>
              </div>

              <!-- 충전기 출력 슬라이더 (1kW ~ 500kW) -->
              <div style="margin-top: 8px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; margin-bottom:3px;">
                  <span>충전기 정격 출력 미세조절</span>
                  <span id="sliderValLabel">${this.state.powerKw.toFixed(1)} kW</span>
                </div>
                <input id="powerSlider" type="range" min="1.0" max="500.0" value="${this.state.powerKw}" step="1">
              </div>

              <!-- 실시간 인입 전력 피드백 -->
              <div class="sub-note" style="color:#9ca3af;font-size:11px;line-height:1.4;margin-top:6px;background:rgba(255,255,255,0.03);padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);">
                🔋 <b>현재 배터리(<span id="effectiveSocLabel">${this.state.soc}%</span>) 실제 인입 전력</b>: <span id="effectiveIntakeVal" style="font-weight:700;color:#34d399;">—</span>
                <div id="emergencyNotice" style="display:none;font-size:10.5px;color:#f87171;margin-top:3px;font-weight:600;"></div>
                <div style="font-size:10px;color:#64748b;margin-top:2px;">
                  * 차량 수전 한계(ID.4 커브)와 충전기 출력(P_charger)의 병목 min(P_charger, P_curve)으로 자동 산출됩니다.
                </div>
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
                <span>선택 충전기 사양</span>
                <strong id="inspectCharger">—</strong>
              </div>
              <div class="inspect-item">
                <span>실제 수전 전력 (P_eff)</span>
                <strong id="inspectEffective">—</strong>
              </div>
              <div class="inspect-item">
                <span>비상 충전 모드 추정</span>
                <strong id="inspectEmergency">—</strong>
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
      const nowMs = Date.now();
      card.trips = [
        {
          observed_at: new Date(nowMs - 300000).toISOString(),
          data: {
            id: 'sim-trip-1',
            started_at: new Date(nowMs - 1494000 - 300000).toISOString(),
            ended_at: new Date(nowMs - 300000).toISOString(),
            duration_s: 1494, // 24m 54s -> "24분 동안 주행"
            distance_m: 15600,
            energy_wh: 2100,
            efficiency_km_kwh: 7.4,
            soc_used_percent: 2.7,
            start_battery_wh: 59400,
            end_battery_wh: 57300,
            start_soc_percent: 76.2,
            end_soc_percent: 73.5,
            route: [
              { latitude: 37.5665, longitude: 126.9780, speedMps: 0 },
              { latitude: 37.5680, longitude: 126.9800, speedMps: 11.2 },
              { latitude: 37.5700, longitude: 126.9830, speedMps: 14.5 },
              { latitude: 37.5720, longitude: 126.9850, speedMps: 0 }
            ]
          }
        },
        {
          observed_at: new Date(nowMs - 3600000).toISOString(),
          data: {
            id: 'sim-trip-2',
            started_at: new Date(nowMs - 3600000 - 1038000).toISOString(),
            ended_at: new Date(nowMs - 3600000).toISOString(),
            duration_s: 1038, // 17m 18s -> "17분 동안 주행"
            distance_m: 6860,
            energy_wh: 1200,
            efficiency_km_kwh: 5.7,
            soc_used_percent: 1.5,
            start_battery_wh: 61600,
            end_battery_wh: 60400,
            start_soc_percent: 79.0,
            end_soc_percent: 77.4,
            route: [
              { latitude: 37.5720, longitude: 126.9850, speedMps: 0 },
              { latitude: 37.5750, longitude: 126.9900, speedMps: 8.5 },
              { latitude: 37.5780, longitude: 126.9950, speedMps: 0 }
            ]
          }
        },
        {
          observed_at: new Date(nowMs - 14400000).toISOString(),
          data: {
            id: 'sim-trip-3',
            started_at: new Date(nowMs - 14400000 - 4500000).toISOString(),
            ended_at: new Date(nowMs - 14400000).toISOString(),
            duration_s: 4500, // 1h 15m -> "1시간 15분 동안 주행"
            distance_m: 54600,
            energy_wh: 8500,
            efficiency_km_kwh: 6.4,
            soc_used_percent: 10.9,
            start_battery_wh: 70100,
            end_battery_wh: 61600,
            start_soc_percent: 89.9,
            end_soc_percent: 79.0,
            route: [
              { latitude: 37.5000, longitude: 127.0000, speedMps: 0 },
              { latitude: 37.5780, longitude: 126.9950, speedMps: 0 }
            ]
          }
        },
        {
          observed_at: new Date(nowMs - 28800000).toISOString(),
          data: {
            id: 'sim-trip-4',
            started_at: new Date(nowMs - 28800000 - 45000).toISOString(),
            ended_at: new Date(nowMs - 28800000).toISOString(),
            duration_s: 45, // < 1m -> "1분 미만 주행"
            distance_m: 350,
            energy_wh: 50,
            efficiency_km_kwh: 7.0,
            soc_used_percent: 0.1,
            start_battery_wh: 70150,
            end_battery_wh: 70100,
            start_soc_percent: 90.0,
            end_soc_percent: 89.9,
            route: [
              { latitude: 37.5000, longitude: 127.0000, speedMps: 0 },
              { latitude: 37.5010, longitude: 127.0010, speedMps: 0 }
            ]
          }
        }
      ];
    }
    if (!card.charges || card.charges.length === 0) {
      const nowMs = Date.now();
      const d1 = new Date(nowMs - 86400000); d1.setHours(1, 0, 0, 0);
      const d2 = new Date(nowMs - 86400000 * 2); d2.setHours(13, 0, 0, 0);
      const d4 = new Date(nowMs - 86400000 * 4); d4.setHours(2, 0, 0, 0);
      const d5 = new Date(nowMs - 86400000 * 5); d5.setHours(20, 0, 0, 0);
      const d6 = new Date(nowMs - 86400000 * 6); d6.setHours(1, 0, 0, 0);
      card.charges = [
        {
          id: 'sim-charge-today',
          observed_at: new Date(nowMs - 3600000).toISOString(),
          data: {
            started_at: new Date(nowMs - 7200000).toISOString(),
            ended_at: new Date(nowMs - 3600000).toISOString(),
            energy_kwh: 18.2,
            duration_s: 3600,
            partial: false
          }
        },
        {
          id: 'sim-charge-d1',
          observed_at: new Date(d1.getTime() + 14400000).toISOString(),
          data: {
            started_at: d1.toISOString(),
            ended_at: new Date(d1.getTime() + 14400000).toISOString(),
            energy_kwh: 28.3,
            duration_s: 14400,
            partial: false
          }
        },
        {
          id: 'sim-charge-d2',
          observed_at: new Date(d2.getTime() + 3600000).toISOString(),
          data: {
            started_at: d2.toISOString(),
            ended_at: new Date(d2.getTime() + 3600000).toISOString(),
            energy_kwh: 42.5,
            duration_s: 3600,
            partial: false
          }
        },
        {
          id: 'sim-charge-d4',
          observed_at: new Date(d4.getTime() + 14400000).toISOString(),
          data: {
            started_at: d4.toISOString(),
            ended_at: new Date(d4.getTime() + 14400000).toISOString(),
            energy_kwh: 39.0,
            duration_s: 14400,
            partial: false
          }
        },
        {
          id: 'sim-charge-d5',
          observed_at: new Date(d5.getTime() + 10800000).toISOString(),
          data: {
            started_at: d5.toISOString(),
            ended_at: new Date(d5.getTime() + 10800000).toISOString(),
            energy_kwh: 28.3,
            duration_s: 10800,
            partial: false
          }
        },
        {
          id: 'sim-charge-d6',
          observed_at: new Date(d6.getTime() + 10800000).toISOString(),
          data: {
            started_at: d6.toISOString(),
            ended_at: new Date(d6.getTime() + 10800000).toISOString(),
            energy_kwh: 24.8,
            duration_s: 10800,
            partial: false
          }
        }
      ];
    }
    if (!card.v) card.v = {};
    if (!card.v.battery_history) {
      card.v.battery_history = generateMockBatteryHistory(this.state.soc, this.state.mode === 'charging', this.state.mode === 'driving');
    }

    // Restructure Overview tab into 2-column balanced layout on desktop while keeping mobile identical
    if (typeof card.overview === 'function' && !card._overviewPatched) {
      card._overviewPatched = true;
      const origOverview = card.overview.bind(card);
      card.overview = function(v) {
        const html = origOverview(v);
        try {
          const heroStart = html.indexOf('<section class="hero');
          const heroEnd = html.indexOf('</section><div class="quick">');
          const energyStart = html.indexOf('<section class="energy');
          const energyEnd = html.indexOf('</section><div class="quick-metrics">');
          const metricsStart = html.indexOf('<div class="quick-metrics">');
          const metricsEnd = html.indexOf('</div></div><div class="overview-links">');
          const linksStart = html.indexOf('<div class="overview-links">');
          const linksEnd = html.indexOf('</div><div class="mini-condition">');
          const condStart = html.indexOf('<div class="mini-condition">');

          if (heroStart !== -1 && heroEnd !== -1 && energyStart !== -1 && energyEnd !== -1 &&
              metricsStart !== -1 && metricsEnd !== -1 && linksStart !== -1 && linksEnd !== -1 && condStart !== -1) {
            const heroHtml = html.slice(heroStart, heroEnd + 10);
            const energyHtml = html.slice(energyStart, energyEnd + 10);
            const metricsHtml = html.slice(metricsStart, metricsEnd);
            const linksHtml = html.slice(linksStart, linksEnd + 6);
            const condHtml = html.slice(condStart);

            return `
              <div class="cockpit desktop-balanced-cockpit">
                <div class="overview-col-visual">
                  ${heroHtml}
                  ${condHtml}
                </div>
                <div class="overview-col-telemetry">
                  ${energyHtml}
                  ${metricsHtml}
                  ${linksHtml}
                </div>
              </div>
            `;
          }
        } catch (e) {
          console.warn('Carrot HA Debug: Overview restructuring fallback', e);
        }
        return html;
      };
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

      if (typeof window !== 'undefined' && window.ResizeObserver) {
        if (!card._mapResizeObserver) {
          card._mapResizeObserver = new ResizeObserver(() => {
            if (card.miniMaps && card.miniMaps.length) {
              card.miniMaps.forEach(m => {
                try { m.invalidateSize(); } catch (e) {}
              });
            }
          });
        }
        card.shadowRoot?.querySelectorAll('.mini-map').forEach(el => {
          card._mapResizeObserver.observe(el);
        });
      }
      setTimeout(() => {
        if (card.miniMaps && card.miniMaps.length) {
          card.miniMaps.forEach(m => {
            try { m.invalidateSize(); } catch (e) {}
          });
        }
      }, 120);
    };
  }

  injectCustomStyles(card) {
    if (!card || !card.shadowRoot) return;

    let style = card.shadowRoot.querySelector('#debug-custom-enhancements');
    if (!style) {
      style = document.createElement('style');
      style.id = 'debug-custom-enhancements';
    }
    card.shadowRoot.appendChild(style);

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

      /* ========================================================= */
      /* Overview Tab: Desktop 2-Column Balanced Dashboard Layout  */
      /* ========================================================= */
      @container (min-width: 820px) {
        .cockpit.desktop-balanced-cockpit {
          display: grid !important;
          grid-template-columns: minmax(320px, 1.05fr) minmax(380px, 1.35fr) !important;
          gap: 16px 20px !important;
          align-items: stretch !important;
          margin-bottom: 0 !important;
        }

        .overview-col-visual {
          display: flex !important;
          flex-direction: column !important;
          gap: 14px !important;
          min-width: 0 !important;
          height: 100% !important;
        }

        .overview-col-visual .hero {
          flex: 1 !important;
          min-height: 340px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          border-radius: 20px !important;
          overflow: hidden !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          background: #181d22 !important;
          margin: 0 !important;
        }

        :host([data-theme="light"]) .overview-col-visual .hero {
          background: #f0f3f5 !important;
          border-color: var(--line) !important;
        }

        .overview-col-visual .hero-copy {
          padding: 22px 24px 0 !important;
        }

        .overview-col-visual .hero-copy h2 {
          font-size: 30px !important;
          letter-spacing: -0.5px !important;
          line-height: 1.2 !important;
        }

        .overview-col-visual .hero .car-image {
          max-height: 250px !important;
          width: 100% !important;
          object-fit: contain !important;
          object-position: center !important;
          margin: auto 0 !important;
          padding: 12px 18px !important;
        }

        /* Mini condition integrated under Hero */
        .overview-col-visual .mini-condition {
          display: flex !important;
          justify-content: space-around !important;
          align-items: center !important;
          gap: 10px !important;
          padding: 14px 18px !important;
          margin-top: 0 !important;
          border-top: none !important;
          border-radius: 16px !important;
          border: 1px solid var(--line) !important;
          background: #14171a !important;
          font-size: 12.5px !important;
          color: #9ca3af !important;
        }

        :host([data-theme="light"]) .overview-col-visual .mini-condition {
          background: #ffffff !important;
          border-color: var(--line) !important;
          color: #5b686e !important;
        }

        .overview-col-visual .mini-condition span b {
          font-weight: 700 !important;
          color: var(--ink) !important;
          font-size: 13.5px !important;
          margin-left: 2px !important;
        }

        /* Right column: Telemetry & Quick Links */
        .overview-col-telemetry {
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
          min-width: 0 !important;
        }

        .overview-col-telemetry .energy {
          margin: 0 !important;
        }

        .overview-col-telemetry .energy.is-charging {
          margin: 0 !important;
        }

        .overview-col-telemetry .quick-metrics {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 10px !important;
        }

        .overview-col-telemetry .overview-links {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 10px !important;
          margin-top: 0 !important;
        }

        .overview-col-telemetry .shortcut {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          grid-template-rows: 1fr auto !important;
          gap: 12px !important;
          padding: 10px 10px 10px 14px !important;
          min-height: 124px !important;
          align-items: stretch !important;
        }

        .overview-col-telemetry .shortcut > span {
          grid-column: 1 !important;
          grid-row: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: flex-start !important;
          min-width: 0 !important;
          padding-top: 2px !important;
        }

        .overview-col-telemetry .shortcut b {
          font-size: 15px !important;
          line-height: 1.3 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .overview-col-telemetry .shortcut small {
          font-size: 11px !important;
          line-height: 1.35 !important;
          margin-top: 4px !important;
          color: var(--muted) !important;
        }

        .overview-col-telemetry .shortcut > em {
          grid-column: 1 !important;
          grid-row: 2 !important;
          align-self: end !important;
          font-size: 11.5px !important;
          font-weight: 600 !important;
          padding-bottom: 2px !important;
        }

        .overview-col-telemetry .mini-map {
          grid-column: 2 !important;
          grid-row: 1 / 3 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 104px !important;
          max-width: none !important;
          max-height: none !important;
          aspect-ratio: auto !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          align-self: stretch !important;
          justify-self: stretch !important;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
        }
      }

      /* Tablet & Wide Mobile Optimization (520px - 819px): 2-column shortcut cards */
      @container (min-width: 520px) and (max-width: 819px) {
        .overview-links {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 12px !important;
        }
      }

      /* Mobile & Compact Screens (< 820px): Universal 50% rectangular map */
      @container (max-width: 819px) {
        .cockpit.desktop-balanced-cockpit {
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
        }

        .overview-col-visual,
        .overview-col-telemetry {
          display: contents !important;
        }

        .hero {
          order: 1 !important;
        }

        .energy {
          order: 2 !important;
        }

        .quick-metrics {
          order: 3 !important;
        }

        .overview-links {
          order: 4 !important;
          margin-top: 2px !important;
        }

        :host .shortcut,
        ha-card .shortcut,
        .shortcut {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          grid-template-rows: 1fr auto !important;
          gap: 10px !important;
          padding: 10px 10px 10px 14px !important;
          min-height: 118px !important;
          align-items: stretch !important;
        }

        :host .shortcut > span,
        ha-card .shortcut > span,
        .shortcut > span {
          grid-column: 1 !important;
          grid-row: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: flex-start !important;
          min-width: 0 !important;
        }

        :host .shortcut > span b,
        ha-card .shortcut > span b,
        .shortcut > span b {
          font-size: 15px !important;
        }

        :host .shortcut > em,
        ha-card .shortcut > em,
        .shortcut > em {
          grid-column: 1 !important;
          grid-row: 2 !important;
          align-self: end !important;
        }

        :host .mini-map,
        :host .shortcut .mini-map,
        ha-card .mini-map,
        .shortcut .mini-map,
        .mini-map {
          grid-column: 2 !important;
          grid-row: 1 / 3 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 98px !important;
          max-width: none !important;
          max-height: none !important;
          aspect-ratio: auto !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          align-self: stretch !important;
          justify-self: stretch !important;
        }

        .mini-condition {
          order: 5 !important;
          margin-top: 4px !important;
        }
      }

      /* Mobile typography and layout overrides (< 700px) */
      @container (max-width: 700px) {
        :host .shortcut,
        ha-card .shortcut,
        .shortcut {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          grid-template-rows: 1fr auto !important;
          gap: 10px !important;
          padding: 10px 10px 10px 12px !important;
          min-height: 116px !important;
          align-items: stretch !important;
        }

        :host .mini-map,
        :host .shortcut .mini-map,
        ha-card .mini-map,
        .shortcut .mini-map,
        .mini-map {
          grid-column: 2 !important;
          grid-row: 1 / 3 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 96px !important;
          max-width: none !important;
          max-height: none !important;
          aspect-ratio: auto !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          align-self: stretch !important;
          justify-self: stretch !important;
        }

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

    // EVSE Charger Presets & Power Slider
    const powerSlider = root.querySelector('#powerSlider');
    const powerVal = root.querySelector('#powerVal');
    const sliderValLabel = root.querySelector('#sliderValLabel');

    const updateChargerBtns = (val) => {
      root.querySelectorAll('[data-charger]').forEach(btn => {
        const chargerVal = Number(btn.dataset.charger);
        const isActive = Math.abs(chargerVal - val) < 0.1;
        btn.className = isActive ? 'active charge' : '';
      });
    };

    root.querySelectorAll('[data-charger]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = Number(btn.dataset.charger);
        if (!isNaN(val)) {
          this.state.powerKw = val;
          if (powerSlider) powerSlider.value = val;
          if (powerVal) powerVal.textContent = val.toFixed(1) + ' kW';
          if (sliderValLabel) sliderValLabel.textContent = val.toFixed(1) + ' kW';
          updateChargerBtns(val);
          this.applyDebugTelemetry();
        }
      });
    });

    if (powerSlider) {
      powerSlider.addEventListener('input', (e) => {
        this.state.powerKw = Number(e.target.value);
        if (powerVal) powerVal.textContent = this.state.powerKw.toFixed(1) + ' kW';
        if (sliderValLabel) sliderValLabel.textContent = this.state.powerKw.toFixed(1) + ' kW';
        updateChargerBtns(this.state.powerKw);
        this.applyDebugTelemetry();
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
        this.state.powerKw = 11;
        this.state.calcModel = 'curve';
        if (socSlider) socSlider.value = 74;
        if (socVal) socVal.textContent = '74%';
        updateSocPresetUI(74);
        if (powerSlider) powerSlider.value = 11;
        if (powerVal) powerVal.textContent = '11.0 kW';
        if (sliderValLabel) sliderValLabel.textContent = '11.0 kW';
        updateChargerBtns(11);
        if (calcModelVal) calcModelVal.textContent = 'ID.4 커브 (옵션 1)';
        if (btnModelCurve) btnModelCurve.className = 'active charge';
        if (btnModelSimple) btnModelSimple.className = '';
        updateModeBtns();
        this.applyDebugTelemetry();
      });
    }
  }
}
CarrotDebugDashboard.prototype.generateMockBatteryHistory = generateMockBatteryHistory;
