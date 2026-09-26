import {mergeConsecutiveTrips, tripTimeline} from './carrot-trip-days.js';
// Carrot HA Live Debug Dashboard Card
// Clones the official Carrot Dashboard and provides a real-time UI controller underneath.

const BMS_CAPACITY = 78.0; // kWh (ID.4 BMS pack capacity baseline)

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

// 3-Stage Hybrid Smoothing Configuration (Option D)
const SMOOTH_CONFIG = {
  alpha: 0.25,        // EMA power smoothing factor
  slewMaxSec: 180,    // Maximum allowed ETA jump per update (3 minutes)
  deadbandSec: 120,   // Deadband window: if ETA change is within +/- 2 min, maintain natural countdown
  jumpResetKw: 25.0   // Reset EMA if power changes abruptly (e.g. unplugged or switched AC <-> DC)
};

function estimateChargingTimesWithCurve(currentSoc, powerKw, capacityKwh = BMS_CAPACITY, baseTimeMs = Date.now(), calcModel = 'curve', smoothState = null) {
  if (typeof powerKw !== 'number' || powerKw < 0.3 || typeof currentSoc !== 'number') {
    return {
      sec80: null, eta80: null, sec100: null, eta100: null,
      simpleSec80: null, simpleSec100: null, effectiveKw: null,
      rawSec80: null, rawEta80: null, rawSec100: null, rawEta100: null,
      powerSmooth: null, smoothState: null
    };
  }

  const soc = Math.max(0, Math.min(100, currentSoc));
  const currentKwh = (soc / 100) * capacityKwh;
  const currentCurveKw = ID4_CHARGING_CURVE_KW[Math.min(100, Math.max(1, Math.round(soc)))];
  const effectiveKw = soc >= 100 ? 0 : Math.min(powerKw, currentCurveKw);

  // 1. Simple linear benchmark calculation based on current intake power
  const target80Kwh = capacityKwh * 0.8;
  const need80Kwh = Math.max(0, target80Kwh - currentKwh);
  const simplePower = Math.max(0.3, effectiveKw > 0 ? effectiveKw : powerKw);
  const simpleSec80 = Math.round((need80Kwh / simplePower) * 3600);

  const target100Kwh = capacityKwh * 1.0;
  const need100Kwh = Math.max(0, target100Kwh - currentKwh);
  const simpleSec100 = Math.round((need100Kwh / simplePower) * 3600);

  if (calcModel === 'simple') {
    const sEta80 = new Date(baseTimeMs + simpleSec80 * 1000).toISOString();
    const sEta100 = new Date(baseTimeMs + simpleSec100 * 1000).toISOString();
    return {
      sec80: simpleSec80,
      eta80: sEta80,
      sec100: simpleSec100,
      eta100: sEta100,
      simpleSec80,
      simpleSec100,
      effectiveKw,
      rawSec80: simpleSec80,
      rawEta80: sEta80,
      rawSec100: simpleSec100,
      rawEta100: sEta100,
      powerSmooth: powerKw,
      smoothState: null
    };
  }

  // Helper for numerical integration with ID.4 charging curve
  const calcTimeToSoc = (targetSoc, inputPower) => {
    if (soc >= targetSoc) return 0;
    let totalSec = 0;
    const startInt = Math.floor(soc);
    const targetInt = Math.floor(targetSoc);

    for (let s = startInt; s < targetInt; s++) {
      const curveVal = ID4_CHARGING_CURVE_KW[Math.min(100, s + 1)];
      const stepKw = Math.max(0.3, Math.min(inputPower, curveVal));
      let stepFraction = 1.0;
      if (s === startInt) {
        stepFraction = (startInt + 1) - soc;
      }
      const stepKwh = capacityKwh * 0.01 * stepFraction;
      totalSec += (stepKwh / stepKw) * 3600;
    }

    if (targetSoc > targetInt) {
      const curveVal = ID4_CHARGING_CURVE_KW[Math.min(100, targetInt + 1)];
      const stepKw = Math.max(0.3, Math.min(inputPower, curveVal));
      const stepKwh = capacityKwh * 0.01 * (targetSoc - targetInt);
      totalSec += (stepKwh / stepKw) * 3600;
    }

    return Math.round(totalSec);
  };

  // Option 1: Bottleneck Model (Raw instantaneous calculation)
  const rawSec80 = calcTimeToSoc(80, powerKw);
  const rawSec100 = calcTimeToSoc(100, powerKw);
  const rawEta80 = new Date(baseTimeMs + rawSec80 * 1000).toISOString();
  const rawEta100 = new Date(baseTimeMs + rawSec100 * 1000).toISOString();

  if (calcModel === 'curve') {
    return {
      sec80: rawSec80,
      eta80: rawEta80,
      sec100: rawSec100,
      eta100: rawEta100,
      simpleSec80,
      simpleSec100,
      effectiveKw,
      rawSec80,
      rawEta80,
      rawSec100,
      rawEta100,
      powerSmooth: powerKw,
      smoothState: null
    };
  }

  // Option D: 3-Stage Hybrid Smoothing (calcModel === 'smooth')
  // Stage 1: Power EMA Filter
  let powerSmooth = powerKw;
  if (smoothState && typeof smoothState.powerSmooth === 'number' && smoothState.powerSmooth > 0) {
    const powerJump = Math.abs(powerKw - smoothState.powerSmooth);
    if (powerJump > SMOOTH_CONFIG.jumpResetKw) {
      powerSmooth = powerKw; // Step reset on abrupt change
      smoothState = null;
    } else {
      powerSmooth = SMOOTH_CONFIG.alpha * powerKw + (1 - SMOOTH_CONFIG.alpha) * smoothState.powerSmooth;
    }
  }

  // Stage 2: Curve integration using EMA smoothed power
  const smoothedRawSec80 = calcTimeToSoc(80, powerSmooth);
  const smoothedRawSec100 = calcTimeToSoc(100, powerSmooth);

  // Stage 3: Slew-rate limiter & countdown deadband
  const applySlewRateAndDeadband = (targetSec, prevEtaMs, prevSec, lastCalcAt) => {
    const newEtaMs = baseTimeMs + targetSec * 1000;
    if (!prevEtaMs || !lastCalcAt || prevSec == null) {
      return { smoothSec: targetSec, smoothEtaMs: newEtaMs };
    }

    const elapsedSec = Math.max(0, Math.round((baseTimeMs - lastCalcAt) / 1000));
    const naturalSec = Math.max(0, prevSec - elapsedSec);
    const deltaEtaSec = (newEtaMs - prevEtaMs) / 1000;

    // Deadband check: if within +/- 120s, preserve existing ETA and natural countdown
    if (Math.abs(deltaEtaSec) <= SMOOTH_CONFIG.deadbandSec) {
      return {
        smoothSec: naturalSec,
        smoothEtaMs: prevEtaMs
      };
    }

    // Slew-rate clamp: limit drift to +/- slewMaxSec per calculation step
    const allowedShiftSec = Math.sign(deltaEtaSec) * Math.min(Math.abs(deltaEtaSec), SMOOTH_CONFIG.slewMaxSec);
    const smoothEtaMs = prevEtaMs + allowedShiftSec * 1000;
    const smoothSec = Math.max(0, Math.round((smoothEtaMs - baseTimeMs) / 1000));

    return { smoothSec, smoothEtaMs };
  };

  const smooth80 = applySlewRateAndDeadband(
    smoothedRawSec80,
    smoothState?.eta80Ms,
    smoothState?.sec80,
    smoothState?.lastCalcAt
  );

  const smooth100 = applySlewRateAndDeadband(
    smoothedRawSec100,
    smoothState?.eta100Ms,
    smoothState?.sec100,
    smoothState?.lastCalcAt
  );

  const updatedSmoothState = {
    powerSmooth,
    lastCalcAt: baseTimeMs,
    eta80Ms: smooth80.smoothEtaMs,
    eta100Ms: smooth100.smoothEtaMs,
    sec80: smooth80.smoothSec,
    sec100: smooth100.smoothSec
  };

  return {
    sec80: smooth80.smoothSec,
    eta80: new Date(smooth80.smoothEtaMs).toISOString(),
    sec100: smooth100.smoothSec,
    eta100: new Date(smooth100.smoothEtaMs).toISOString(),
    simpleSec80,
    simpleSec100,
    effectiveKw,
    rawSec80,
    rawEta80,
    rawSec100,
    rawEta100,
    powerSmooth,
    smoothState: updatedSmoothState
  };
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
    doors_locked: recorded.doors_locked,
    open_doors: recorded.open_doors,
    estimated_range_km: recorded.estimated_range_km,
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
      calcModel: 'smooth', // 'smooth' (3-Stage Hybrid Smoothing) | 'curve' (Option 1: Bottleneck) | 'simple' (Linear)
      noiseEnabled: false, // BMS quantization jitter simulation
      lang: 'ko',
      theme: 'auto',
      candidate: 1, // 1 | 2 | 3 | 4 | 5 (lock candidate)
      rangeCandidate: 3, // 1 | 2 | 3 | 4 | 5 (estimated range candidate, default C3)
      doors_locked: true, // true (잠김) | false (열림/미잠김)
      doors: {
        driver: false,         // 운전석 도어
        passenger: false,      // 조수석 도어
        rear_driver: false,    // 운전석 뒤 도어
        rear_passenger: false, // 조수석 뒤 도어
        trunk: false           // 트렁크
      }
    };
    this.smoothState = null;
    this._noiseTimer = null;
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

  disconnectedCallback(){
    clearInterval(this.freshnessTimer);
    if (this._noiseTimer) {
      clearInterval(this._noiseTimer);
      this._noiseTimer = null;
    }
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
    if (seconds == null) return '—';
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

    // Noise Simulation: If enabled during charging, simulate BMS quantization noise
    let simulatedInputKw = this.state.powerKw;
    let isNoisy = false;
    if (this.state.noiseEnabled && isCharging && !impaired) {
      isNoisy = true;
      const isAc = this.state.powerKw <= 11;
      const maxJitter = isAc ? 1.6 : Math.max(8.0, this.state.powerKw * 0.15);
      const jitter = (Math.random() * 2 - 1) * maxJitter;
      simulatedInputKw = Math.max(0.8, Number((this.state.powerKw + jitter).toFixed(1)));
    }

    if (!isCharging) {
      this.smoothState = null;
    }

    // 80% & 100% calculations (ID.4 Charging Curve + 3-Stage Hybrid Smoothing Option D)
    const {
      sec80, eta80, sec100, eta100,
      simpleSec80, simpleSec100, effectiveKw,
      rawSec80, rawEta80, rawSec100, rawEta100,
      powerSmooth, smoothState
    } = estimateChargingTimesWithCurve(
      this.state.soc,
      simulatedInputKw,
      BMS_CAPACITY,
      now,
      this.state.calcModel || 'smooth',
      this.smoothState
    );
    this.smoothState = smoothState;

    if (isDriving) {
      this.simulatedParkingAt = null;
    } else if (!this.simulatedParkingAt) {
      this.simulatedParkingAt = new Date(this.scenarioAt - (this.state.mode === 'parked' ? 45 * 60000 : 0)).toISOString();
    }

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
      month_charge_cost: 48068,
      month_slow_kwh: 45.5,
      month_fast_kwh: 110.4,
      outside_temp_c: 24,
      aux_voltage: 13.8,
      ac_on: true,
      blower_level: 2,
      parking_latitude: 37.5665,
      parking_longitude: 126.9780,
      parking_at: this.simulatedParkingAt || new Date(this.scenarioAt).toISOString(),
      latitude: 37.5665,
      longitude: 126.9780
    };

    const openDoorsList = [];
    if (this.state.doors?.driver) openDoorsList.push('운전석 도어');
    if (this.state.doors?.passenger) openDoorsList.push('조수석 도어');
    if (this.state.doors?.rear_driver) openDoorsList.push('운전석 뒤 도어');
    if (this.state.doors?.rear_passenger) openDoorsList.push('조수석 뒤 도어');
    if (this.state.doors?.trunk) openDoorsList.push('트렁크');

    const anyDoorOpen = openDoorsList.length > 0;
    const isLocked = !anyDoorOpen && (this.state.doors_locked !== false);
    v.doors_locked = isLocked;
    v.open_doors = openDoorsList;
    v.door_driver_open = !!this.state.doors?.driver;
    v.door_passenger_open = !!this.state.doors?.passenger;
    v.door_rear_driver_open = !!this.state.doors?.rear_driver;
    v.door_rear_passenger_open = !!this.state.doors?.rear_passenger;
    v.trunk_open = !!this.state.doors?.trunk;

    // sensor.id_4_estimated_range_km (approx 4.6km per 1% SOC on ID.4 78kWh)
    v.estimated_range_km = Math.round(this.state.soc * 4.6);

    v.cloud_raw_state = {device_id:'simulated-debug',onroad:v.onroad?1:0,updated_at:receivedAt};

    if (isCharging) {
      const displayKw = (this.state.soc >= 100)
        ? 0.0
        : ((this.state.calcModel === 'smooth' && powerSmooth != null)
          ? Number(Math.min(powerSmooth, ID4_CHARGING_CURVE_KW[Math.min(100, Math.max(1, Math.round(this.state.soc)))]).toFixed(1))
          : (effectiveKw != null ? Number(effectiveKw.toFixed(1)) : simulatedInputKw));

      v.charge_power_kw = displayKw;
      v.charge_power_w = Math.round(displayKw * 1000);
      v.charger_max_kw = this.state.powerKw;
      v.time_to_80_s = Math.round(this.state.soc) < 80 ? sec80 : 0;
      v.eta_80 = eta80;
      v.time_to_100_s = this.state.soc >= 100 ? 0 : sec100;
      v.eta_100 = this.state.soc >= 100 ? new Date().toISOString() : eta100;
      v.calc_model = this.state.calcModel || 'smooth';
      v.simple_sec80 = simpleSec80;
      v.simple_sec100 = simpleSec100;
      v.raw_sec80 = rawSec80;
      v.raw_sec100 = rawSec100;
      v.raw_eta80 = rawEta80;
      v.raw_eta100 = rawEta100;
      v.power_smooth = powerSmooth;
      v.simulated_input_kw = simulatedInputKw;
      v.effective_kw = displayKw;
      v.emergency_charging = !impaired && (displayKw <= 1.5);

      // Real-time Charging Session Energy & Cost (280 KRW/kWh slow <=11kW, 320 KRW/kWh fast >11kW)
      if (this.chargeSessionStartKwh == null || this.chargeSessionStartMode !== 'charging') {
        this.chargeSessionStartKwh = currentKwh;
        this.chargeSessionStartMode = 'charging';
        this.chargeSessionFast = false;
      }
      if (currentKwh < this.chargeSessionStartKwh) {
        this.chargeSessionStartKwh = currentKwh;
      }
      if (displayKw > 11) {
        this.chargeSessionFast = true;
      }
      const sessionChargedKwh = Number((currentKwh - this.chargeSessionStartKwh).toFixed(2));
      const isFastCharge = Boolean(this.chargeSessionFast);
      const unitPrice = isFastCharge ? 320 : 280;
      const sessionCost = Math.round(sessionChargedKwh * unitPrice);

      v.session_charge_kwh = sessionChargedKwh;
      v.session_charge_cost = sessionCost;
      v.session_charge_price = unitPrice;
    } else {
      this.chargeSessionStartKwh = null;
      this.chargeSessionStartMode = null;
      this.chargeSessionFast = false;
      v.session_charge_kwh = null;
      v.session_charge_cost = null;
      v.session_charge_price = null;
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
    this.dashCard.v = {
      ...displayed,
      battery_history: batteryHistory,
      debug_raw: v,
      doors_locked: displayed.doors_locked ?? isLocked,
      open_doors: displayed.open_doors ?? openDoorsList,
      estimated_range_km: displayed.estimated_range_km ?? v.estimated_range_km,
      candidate: this.state.candidate || 1,
      range_candidate: this.state.rangeCandidate || 3
    };
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
    const isEmergency = v.charging === true && !v.stale && (v.effective_kw <= 1.5);
    const isNoisy = this.state.noiseEnabled && v.charging === true && !v.stale;

    if (elIntake) {
      if (v.charging === true) {
        if (this.state.soc >= 100) {
          elIntake.innerHTML = '<span style="color:#94a3b8;">완충됨 (0.0 kW)</span>';
        } else if (isEmergency) {
          elIntake.innerHTML = `<span style="color:#ef4444;font-weight:700;">${(v.charge_power_kw || effectiveKw).toFixed(1)} kW (비상충전 모드)</span>`;
        } else if (this.state.calcModel === 'smooth' && v.power_smooth != null) {
          elIntake.innerHTML = `<span style="color:#34d399;font-weight:700;">${v.charge_power_kw.toFixed(1)} kW</span> <small style="color:#94a3b8;font-size:10.5px;">(EMA 안정화: ${v.power_smooth.toFixed(1)} kW${isNoisy ? `, 순간 입력: ${v.simulated_input_kw?.toFixed(1)}kW` : ''})</small>`;
        } else if (isThrottled) {
          elIntake.innerHTML = `<span style="color:#f59e0b;font-weight:700;">${effectiveKw.toFixed(1)} kW</span> <small style="color:#94a3b8;font-size:10.5px;">(차량 커브 ${curveVal.toFixed(1)} kW 제한)</small>`;
        } else {
          elIntake.innerHTML = `<span style="color:#34d399;font-weight:700;">${(v.charge_power_kw || effectiveKw).toFixed(1)} kW</span> <small style="color:#94a3b8;font-size:10.5px;">(충전기 용량 100% 수전)</small>`;
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
      if (v.charging === true) {
        const noiseNote = isNoisy ? ` <small style="display:block;font-size:10.5px;color:#f59e0b;font-weight:normal;">(🌊 순간 노이즈 입력: ${v.simulated_input_kw?.toFixed(1)} kW)</small>` : '';
        elCharger.innerHTML = `<b>${chargerKw.toFixed(1)} kW</b>${noiseNote}`;
      } else {
        elCharger.innerHTML = '—';
      }
    }

    if (elEffective) {
      if (v.charging === true) {
        if (this.state.soc >= 100) {
          elEffective.innerHTML = '<b style="color:#94a3b8;">0.0 kW (완충)</b>';
        } else if (isEmergency) {
          elEffective.innerHTML = `<b style="color:#ef4444;">${(v.charge_power_kw || effectiveKw).toFixed(1)} kW</b> <small style="display:block;font-size:10.5px;color:#f87171;font-weight:normal;">(비상충전 감지)</small>`;
        } else if (this.state.calcModel === 'smooth' && v.power_smooth != null) {
          elEffective.innerHTML = `<b style="color:#34d399;">${v.charge_power_kw.toFixed(1)} kW</b> <small style="display:block;font-size:10.5px;color:#34d399;font-weight:normal;">(EMA 평활화 적용${isThrottled ? ' · 커브제한' : ''})</small>`;
        } else if (isThrottled) {
          elEffective.innerHTML = `<b style="color:#f59e0b;">${effectiveKw.toFixed(1)} kW</b> <small style="display:block;font-size:10.5px;color:#94a3b8;font-weight:normal;">(커브 ${curveVal.toFixed(1)}kW 병목)</small>`;
        } else {
          elEffective.innerHTML = `<b style="color:#34d399;">${(v.charge_power_kw || effectiveKw).toFixed(1)} kW</b>`;
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
          let comp = '';
          if (this.state.calcModel === 'smooth' && v.raw_sec80 != null && v.raw_sec80 !== sec80) {
            comp = `<small style="display:block;font-size:11px;font-weight:normal;color:#f59e0b;margin-top:2px">원시 순간치: ${this.formatDuration(v.raw_sec80)} (${sec80 > v.raw_sec80 ? '+' : ''}${Math.round((sec80 - v.raw_sec80)/60)}분 차이)</small>`;
          } else if (v.simple_sec80 != null && this.state.calcModel !== 'simple' && v.simple_sec80 !== sec80) {
            comp = `<small style="display:block;font-size:11px;font-weight:normal;color:#94a3b8;margin-top:2px">단순 선형: ${this.formatDuration(v.simple_sec80)} (${sec80 > v.simple_sec80 ? '+' : ''}${Math.round((sec80 - v.simple_sec80)/60)}분)</small>`;
          }
          el80.innerHTML = `<b>${this.formatDuration(sec80)}</b>${comp}`;
        }
      } else {
        el80.innerHTML = '—';
      }
    }
    if (el100) {
      if (v.charging === true) {
        let comp = '';
        if (this.state.calcModel === 'smooth' && v.raw_sec100 != null && v.raw_sec100 !== sec100) {
          comp = `<small style="display:block;font-size:11px;font-weight:normal;color:#f59e0b;margin-top:2px">원시 순간치: ${this.formatDuration(v.raw_sec100)} (${sec100 > v.raw_sec100 ? '+' : ''}${Math.round((sec100 - v.raw_sec100)/60)}분 차이)</small>`;
        } else if (v.simple_sec100 != null && this.state.calcModel !== 'simple' && v.simple_sec100 !== sec100) {
          comp = `<small style="display:block;font-size:11px;font-weight:normal;color:#94a3b8;margin-top:2px">단순 선형: ${this.formatDuration(v.simple_sec100)} (${sec100 > v.simple_sec100 ? '+' : ''}${Math.round((sec100 - v.simple_sec100)/60)}분)</small>`;
        }
        el100.innerHTML = `<b>${this.formatDuration(sec100)}</b>${comp}`;
      } else {
        el100.innerHTML = '—';
      }
    }
    if (elEta) {
      if (v.charging === true) {
        let rawEtaComp = '';
        if (this.state.calcModel === 'smooth' && v.raw_eta100 && v.raw_eta100 !== eta100) {
          rawEtaComp = `<small style="display:block;font-size:10.5px;color:#f59e0b;font-weight:normal;">원시 ETA: ${this.formatTime(v.raw_eta100)} (널뛰기 중)</small>`;
        }
        elEta.innerHTML = `<b>${this.formatTime(eta100)}</b>${rawEtaComp}`;
      } else {
        elEta.innerHTML = '—';
      }
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
      if (this.state.calcModel === 'smooth') {
        elModel.innerHTML = '<span style="color:#34d399;font-weight:700;">⚡ ID.4 커브 + 3단계 스무딩 (안정화)</span>';
      } else if (this.state.calcModel === 'curve') {
        elModel.innerHTML = '<span style="color:#f59e0b;font-weight:700;">⚡ ID.4 커브 (원시값 - 널뛰기 발생)</span>';
      } else {
        elModel.innerHTML = '<span style="color:#94a3b8;">📏 기존 단순 선형</span>';
      }
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
                • <b>충전중</b>: 배터리 바에 충전 전력(11.0 kW) 표시, 좌측 상단 잠금 카드, ETA/누적거리/이번달 충전량 배치<br>
                • <b>주차중</b>: 좌측 상단 잠금 카드, <b>우측 상단 총 주행거리</b> (이번달 주행 제거), 충전량/충전요금 배치
              </div>
            </div>

            <!-- Group Lock & Candidate: 차량 잠금 상태 & UI 디자인 후보 5종 -->
            <div class="control-group">
              <div class="group-label">
                <span>차량 잠금 상태 & UI 디자인 후보 (5종)</span>
                <span class="value" id="lockStatusVal">${this.state.doors_locked !== false ? '🔒 잠김 (정상)' : '🔓 열림 (경고)'}</span>
              </div>
              <div class="btn-group" style="margin-bottom: 8px;">
                <button id="btnLockTrue" class="${this.state.doors_locked !== false ? 'active' : ''}">🔒 도어 잠김 (정상)</button>
                <button id="btnLockFalse" class="${this.state.doors_locked === false ? 'active charge' : ''}" style="${this.state.doors_locked === false ? 'background:#dc2626;border-color:#ef4444;' : ''}">🔓 도어 열림/미잠김 (경고)</button>
              </div>

              <!-- 가상 개별 도어 개폐 제어 (실제 5개 도어 엔터티 반영) -->
              <div class="charger-section-title" style="margin-top:8px;">🚪 가상 개별 도어 개폐 제어 (5개 도어)</div>
              <div class="door-toggle-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(80px, 1fr));gap:6px;margin-bottom:6px;">
                <button class="door-btn ${this.state.doors?.driver ? 'door-open' : ''}" data-door="driver">
                  <span class="door-state-icon">${this.state.doors?.driver ? '🔴' : '⚪'}</span>
                  <span>운전석</span>
                </button>
                <button class="door-btn ${this.state.doors?.passenger ? 'door-open' : ''}" data-door="passenger">
                  <span class="door-state-icon">${this.state.doors?.passenger ? '🔴' : '⚪'}</span>
                  <span>조수석</span>
                </button>
                <button class="door-btn ${this.state.doors?.rear_driver ? 'door-open' : ''}" data-door="rear_driver">
                  <span class="door-state-icon">${this.state.doors?.rear_driver ? '🔴' : '⚪'}</span>
                  <span>운전석 뒤</span>
                </button>
                <button class="door-btn ${this.state.doors?.rear_passenger ? 'door-open' : ''}" data-door="rear_passenger">
                  <span class="door-state-icon">${this.state.doors?.rear_passenger ? '🔴' : '⚪'}</span>
                  <span>조수석 뒤</span>
                </button>
                <button class="door-btn ${this.state.doors?.trunk ? 'door-open' : ''}" data-door="trunk">
                  <span class="door-state-icon">${this.state.doors?.trunk ? '🔴' : '⚪'}</span>
                  <span>트렁크</span>
                </button>
              </div>
              <div class="btn-group" style="margin-bottom: 8px;">
                <button id="btnAllDoorsClose" class="preset-btn" style="flex:1;">✓ 모든 도어 닫기</button>
                <button id="btnAllDoorsOpen" class="preset-btn" style="flex:1;">⚠️ 모든 도어 열기</button>
              </div>

              <!-- 주행가능거리 표시 방법 후보 선택 -->
              <div class="charger-section-title" style="margin-top:12px;">⚡ 배터리 카드 주행가능거리 표기 후보 선택 (sensor.id_4_estimated_range_km)</div>
              <div class="btn-group" id="rangeCandidateBtns">
                <button data-range-candidate="1" class="${(this.state.rangeCandidate || 1) === 1 ? 'active' : ''}">후보 1<small>인라인 슬래시</small></button>
                <button data-range-candidate="2" class="${this.state.rangeCandidate === 2 ? 'active' : ''}">후보 2<small>우측 독립 캡슐</small></button>
                <button data-range-candidate="3" class="${this.state.rangeCandidate === 3 ? 'active' : ''}">후보 3<small>하단 서브텍스트</small></button>
                <button data-range-candidate="4" class="${this.state.rangeCandidate === 4 ? 'active' : ''}">후보 4<small>상단 헤더 칩</small></button>
                <button data-range-candidate="5" class="${this.state.rangeCandidate === 5 ? 'active' : ''}">후보 5<small>계기판 듀얼 캡슐</small></button>
              </div>
              <div class="text-[11px]" style="color:#9ca3af;font-size:11px;line-height:1.4;margin-top:6px;margin-bottom:10px;">
                • <b>후보 1 (인라인 슬래시)</b>: SOC 옆에 <code>| 340 km</code> 구분선과 함께 배치 (가장 단정하고 컴팩트)<br>
                • <b>후보 2 (우측 독립 캡슐)</b>: 카드 우측 끝에 <code>주행 가능 340 km</code> 글래스 배지 독립 배치 (좌우 시각 밸런스)<br>
                • <b>후보 3 (하단 서브텍스트)</b>: SOC 숫자 바로 아래에 <code>약 340 km 주행 가능</code> 서브텍스트 (계층적 가독성)<br>
                • <b>후보 4 (상단 헤더 칩)</b>: 상단 상태 라벨 옆에 <code>[🔋 340 km]</code> 인라인 칩 배치 (메인 영역 100% 여유)<br>
                • <b>후보 5 (계기판 듀얼 캡슐)</b>: 최신 EV 계기판 스타일의 <code>[ ⚡ 340 km ]</code> 전용 캡슐 결합 (모빌리티 완성도)
              </div>

              <div class="charger-section-title" style="margin-top:6px;">🎨 프론트엔드 UI 수정 후보 선택 (잠금 카드)</div>
              <div class="btn-group">
                <button data-candidate="1" class="${(this.state.candidate || 1) === 1 ? 'active' : ''}">후보 1<small>클래식 서클</small></button>
                <button data-candidate="2" class="${this.state.candidate === 2 ? 'active' : ''}">후보 2<small>볼드 실드</small></button>
                <button data-candidate="3" class="${this.state.candidate === 3 ? 'active' : ''}">후보 3<small>스마트 도어</small></button>
                <button data-candidate="4" class="${this.state.candidate === 4 ? 'active' : ''}">후보 4<small>글래스 칩</small></button>
                <button data-candidate="5" class="${this.state.candidate === 5 ? 'active' : ''}">후보 5<small>하이 콘트라스트</small></button>
              </div>
              <div class="text-[11px]" style="color:#9ca3af;font-size:11px;line-height:1.4;margin-top:6px;">
                • <b>후보 1</b>: 클래식 서클 아이콘 + 소프트 알약 배지 (가장 단정하고 일체감 우수)<br>
                • <b>후보 2</b>: 대형 보안 실드(방패) + 볼드 타이포그래피 (시인성 최상)<br>
                • <b>후보 3</b>: 스마트 커넥티드 도어 + 좌측 액센트 컬러 라인<br>
                • <b>후보 4</b>: 글래스모피즘 반투명 카드 + 듀얼 상태 칩 (LOCKED/UNLOCKED)<br>
                • <b>후보 5</b>: 미잠김 시 카드 전체 붉은색 경고 발광 (하이 콘트라스트 알림)
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

            <!-- Group 4: 충전 시간 계산 모델 & 스무딩 체감 테스트 -->
            <div class="control-group">
              <div class="group-label">
                <span>충전 시간 계산 모델 & 스무딩 (체감 테스트)</span>
                <span id="calcModelVal" class="value">${this.state.calcModel === 'simple' ? '단순 선형' : this.state.calcModel === 'curve' ? 'ID.4 커브 (원시값)' : 'ID.4 커브 + 스무딩 (방안 D)'}</span>
              </div>
              <div class="btn-group">
                <button id="btnModelSmooth" class="${this.state.calcModel === 'smooth' || !this.state.calcModel ? 'active charge' : ''}">⚡ ID.4 커브 + 스무딩 (추천)</button>
                <button id="btnModelCurve" class="${this.state.calcModel === 'curve' ? 'active charge' : ''}">⚡ ID.4 커브 (원시값: 널뛰기)</button>
                <button id="btnModelSimple" class="${this.state.calcModel === 'simple' ? 'active' : ''}">📏 기존 단순 선형</button>
              </div>

              <!-- BMS 전력 변동(노이즈) 시뮬레이션 토글 -->
              <div style="margin-top: 8px;">
                <button id="btnToggleNoise" class="${this.state.noiseEnabled ? 'active charge' : ''}" style="width: 100%; padding: 8px 12px; font-size: 11.5px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                  ${this.state.noiseEnabled ? '🌊 BMS 전력 변동 시뮬레이션: ON (널뛰기 발생 중)' : '🌊 BMS 전력 변동 시뮬레이션: OFF'}
                </button>
              </div>

              <div class="sub-note" style="color:#9ca3af;font-size:11px;line-height:1.4;margin-top:6px;">
                • <b>ID.4 커브 + 스무딩 (방안 D)</b>: 1단계 전력 EMA(α=0.25) + 2단계 커브 적분 + 3단계 ETA 슬루율(최대 ±3분 클램핑 & 2분 데드밴드)을 적용하여 1~2시간 널뛰기를 완벽히 방지합니다.<br>
                • <b>ID.4 커브 (원시값)</b>: 매 순간 측정값으로 즉시 계산합니다. 전력 노이즈 ON 시 소요시간이 1~2시간씩 널뛰는 현상을 직접 확인할 수 있습니다.<br>
                • <b>🌊 전력 변동 시뮬레이션</b>: 실제 BMS 샘플링 오차(완속 ±1.6kW / 급속 ±15%)를 실시간으로 발생시켜 두 모델 간의 안정성 차이를 체감합니다.
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

    const getTripDateKey = (val, timeZone) => {
      const d = new Date(val);
      if (!val || Number.isNaN(d.getTime())) return '';
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      return ['year', 'month', 'day'].map(t => parts.find(p => p.type === t)?.value).join('-');
    };

    const generateMockRoute = (startLat, startLng, distM, maxKph, seed) => {
      const maxMps = (maxKph || 60) / 3.6;
      const count = Math.max(6, Math.min(18, Math.round(distM / 1000 * 1.5)));
      const pts = [];
      const angle = (((seed * 9301 + 49297) % 233280) / 233280) * 2 * Math.PI;

      for (let i = 0; i < count; i++) {
        const progress = i / (count - 1);
        const r = (progress * 0.04);
        const lat = startLat + Math.sin(angle) * r + Math.sin(i * 1.3) * 0.002;
        const lng = startLng + Math.cos(angle) * r + Math.cos(i * 1.3) * 0.002;
        const spdFactor = Math.sin(progress * Math.PI);
        const speedMps = (i === 0 || i === count - 1) ? 0 : Math.max(1.5, maxMps * spdFactor * (0.8 + 0.4 * Math.sin(i * 2)));
        pts.push({
          latitude: Math.round(lat * 100000) / 100000,
          longitude: Math.round(lng * 100000) / 100000,
          speedMps: Math.round(speedMps * 10) / 10
        });
      }
      return pts;
    };

    const batteryIconName = soc => {
      if (typeof soc !== 'number' || !Number.isFinite(soc)) return 'battery';
      const level = Math.max(0, Math.min(100, Math.round(soc)));
      if (level >= 95) return 'battery';
      if (level <= 5) return 'battery-outline';
      return `battery-${Math.round(level / 10) * 10}`;
    };

    const tripDurationKo = (s, isEnglish) => {
      if (typeof s !== 'number' || !Number.isFinite(s) || s < 0) return '';
      const totalSec = Math.round(s);
      if (totalSec < 60) return isEnglish ? '< 1m' : '1분 미만';
      const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60);
      if (isEnglish) {
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
      }
      if (h > 0 && m > 0) return `${h}시간 ${m}분`;
      if (h > 0) return `${h}시간`;
      return `${m}분`;
    };

    const generateMockTrips = (baseMs) => {
      const getDayDate = (daysAgo, h, m) => {
        const d = new Date(baseMs - daysAgo * 86400000);
        d.setHours(h, m, 0, 0);
        return d;
      };

      const makeTrip = (id, startD, durMin, distKm, startSoc, endSoc, eff, spd, baseLat, baseLng, seed) => {
        const started_at = startD.toISOString();
        const ended_at = new Date(startD.getTime() + durMin * 60000).toISOString();
        const duration_s = durMin * 60;
        const distance_m = Math.round(distKm * 1000);
        const energy_wh = Math.round((distKm / Math.max(0.1, eff)) * 1000);
        const route = generateMockRoute(baseLat, baseLng, distance_m, spd, seed);
        return {
          observed_at: ended_at,
          data: {
            id,
            started_at,
            ended_at,
            duration_s,
            distance_m,
            energy_wh,
            efficiency_km_kwh: eff,
            start_soc_percent: startSoc,
            end_soc_percent: endSoc,
            route
          }
        };
      };

      const trips = [
        // Day 0 (Today): Morning commute (2 trips <= 30m apart) + Lunch multi-segment (4 trips <= 30m apart matching screenshot)
        makeTrip('t0-m1', getDayDate(0, 8, 15), 20, 12.4, 90.0, 87.0, 6.5, 82, 37.5100, 127.0200, 101),
        makeTrip('t0-m2', getDayDate(0, 8, 50), 8, 3.2, 87.0, 86.0, 6.4, 68, 37.5250, 127.0300, 102), // gap: 15m -> merges with t0-m1
        makeTrip('t0-l1', getDayDate(0, 12, 52), 7, 1.28, 83.0, 82.0, 5.5, 65, 37.4050, 126.9300, 103),
        makeTrip('t0-l2', getDayDate(0, 13, 6), 18, 8.83, 82.0, 80.0, 6.3, 90, 37.3950, 126.9380, 104), // gap: 7m -> merges
        makeTrip('t0-l3', getDayDate(0, 13, 34), 10, 5.91, 80.0, 79.0, 7.4, 88, 37.3680, 126.9400, 105), // gap: 10m -> merges
        makeTrip('t0-l4', getDayDate(0, 13, 58), 10, 3.06, 79.0, 78.0, 4.1, 82, 37.3300, 126.9680, 106), // gap: 14m -> merges (4건 병합, 19.08km, 83%->78% 5% 사용)

        // Day 1 (Yesterday): Road trip day with 11 trips (tests merging groups into 4 consolidated sessions)
        makeTrip('t1-1', getDayDate(1, 8, 30), 42, 38.4, 84.0, 72.0, 6.2, 104, 37.4500, 126.9500, 111),
        makeTrip('t1-2', getDayDate(1, 9, 25), 23, 16.8, 72.0, 67.0, 5.8, 88, 37.4900, 126.9900, 112), // gap: 13m
        makeTrip('t1-3', getDayDate(1, 10, 10), 25, 22.1, 67.0, 60.0, 6.1, 92, 37.5200, 127.0200, 113), // gap: 22m
        makeTrip('t1-4', getDayDate(1, 10, 45), 17, 12.3, 60.0, 56.0, 5.5, 78, 37.5500, 127.0500, 114), // gap: 10m
        makeTrip('t1-5', getDayDate(1, 11, 30), 15, 8.5, 56.0, 53.0, 5.2, 65, 37.5700, 127.0700, 115), // gap: 28m -> 1~5 merge into morning tour!
        makeTrip('t1-6', getDayDate(1, 13, 25), 43, 41.2, 53.0, 40.0, 6.4, 108, 37.5700, 127.0700, 116), // gap: 100m (lunch stop)
        makeTrip('t1-7', getDayDate(1, 14, 30), 22, 18.0, 40.0, 34.0, 5.7, 85, 37.5400, 127.0200, 117), // gap: 22m -> merges with t1-6
        makeTrip('t1-8', getDayDate(1, 16, 32), 23, 19.5, 34.0, 28.0, 6.0, 90, 37.5100, 126.9800, 118), // gap: 100m
        makeTrip('t1-9', getDayDate(1, 17, 10), 18, 14.2, 28.0, 23.0, 5.6, 82, 37.4800, 126.9500, 119), // gap: 15m -> merges with t1-8
        makeTrip('t1-10', getDayDate(1, 18, 5), 17, 12.8, 23.0, 19.0, 5.9, 80, 37.4500, 126.9300, 120), // gap: 37m
        makeTrip('t1-11', getDayDate(1, 18, 40), 11, 10.8, 19.0, 19.0, 6.8, 74, 37.4200, 126.9100, 121), // gap: 18m -> merges with t1-10

        // Day 2 (2 days ago): 9 individual trips with gaps > 30m (tests 2x4 grid 8-card limit and pagination: Page 1 has 8, Page 2 has 1)
        makeTrip('t2-1', getDayDate(2, 7, 30), 15, 9.2, 38.0, 35.0, 6.2, 75, 37.4100, 126.9200, 131),
        makeTrip('t2-2', getDayDate(2, 9, 15), 10, 5.2, 35.0, 33.0, 6.3, 60, 37.4300, 126.9400, 132),
        makeTrip('t2-3', getDayDate(2, 11, 0), 12, 6.1, 33.0, 30.0, 5.9, 65, 37.4600, 126.9700, 133),
        makeTrip('t2-4', getDayDate(2, 12, 45), 18, 10.2, 30.0, 26.0, 6.0, 80, 37.5000, 127.0100, 134),
        makeTrip('t2-5', getDayDate(2, 14, 15), 15, 8.9, 26.0, 23.0, 5.8, 72, 37.5300, 127.0300, 135),
        makeTrip('t2-6', getDayDate(2, 15, 50), 20, 12.5, 23.0, 18.0, 6.2, 85, 37.5500, 127.0500, 136),
        makeTrip('t2-7', getDayDate(2, 17, 30), 16, 10.0, 45.0, 41.0, 6.0, 78, 37.5200, 127.0100, 137),
        makeTrip('t2-8', getDayDate(2, 19, 10), 14, 8.2, 41.0, 38.0, 5.7, 70, 37.4800, 126.9700, 138),
        makeTrip('t2-9', getDayDate(2, 21, 0), 18, 11.5, 38.0, 34.0, 6.1, 84, 37.4400, 126.9300, 139),

        // Day 3 (3 days ago): 8 trips with 2 merged pairs
        makeTrip('t3-1', getDayDate(3, 8, 0), 22, 10.2, 53.0, 49.0, 5.8, 72, 37.4500, 126.9500, 141),
        makeTrip('t3-2', getDayDate(3, 8, 28), 18, 11.0, 49.0, 45.0, 5.5, 78, 37.4800, 126.9800, 142),
        makeTrip('t3-3', getDayDate(3, 11, 15), 14, 8.9, 45.0, 42.0, 5.7, 70, 37.5100, 127.0100, 143),
        makeTrip('t3-4', getDayDate(3, 13, 50), 19, 13.8, 42.0, 37.0, 6.0, 82, 37.5400, 127.0400, 144),
        makeTrip('t3-5', getDayDate(3, 15, 30), 12, 7.1, 37.0, 34.0, 5.4, 65, 37.5200, 127.0100, 145),
        makeTrip('t3-6', getDayDate(3, 17, 45), 22, 15.6, 34.0, 28.0, 5.8, 85, 37.4900, 126.9800, 146),
        makeTrip('t3-7', getDayDate(3, 19, 20), 16, 9.4, 28.0, 24.0, 5.6, 75, 37.4600, 126.9500, 147),
        makeTrip('t3-8', getDayDate(3, 19, 42), 25, 18.2, 24.0, 17.0, 5.9, 90, 37.4200, 126.9100, 148),

        // Day 4 (4 days ago): 6 trips
        makeTrip('t4-1', getDayDate(4, 8, 15), 14, 7.8, 64.0, 61.0, 6.1, 70, 37.4300, 126.9300, 151),
        makeTrip('t4-2', getDayDate(4, 9, 15), 12, 6.2, 61.0, 59.0, 6.2, 65, 37.4600, 126.9600, 152),
        makeTrip('t4-3', getDayDate(4, 11, 30), 11, 5.4, 59.0, 57.0, 5.9, 60, 37.4900, 126.9900, 153),
        makeTrip('t4-4', getDayDate(4, 14, 40), 17, 10.5, 57.0, 53.0, 6.0, 78, 37.5200, 127.0200, 154),
        makeTrip('t4-5', getDayDate(4, 17, 20), 14, 7.8, 53.0, 50.0, 5.8, 68, 37.5000, 127.0000, 155),
        makeTrip('t4-6', getDayDate(4, 19, 45), 20, 12.1, 50.0, 45.0, 6.1, 84, 37.4500, 126.9500, 156),

        // Day 5 (5 days ago): 4 trips
        makeTrip('t5-1', getDayDate(5, 8, 10), 15, 9.2, 78.0, 75.0, 6.2, 75, 37.4400, 126.9400, 161),
        makeTrip('t5-2', getDayDate(5, 9, 30), 10, 5.2, 75.0, 73.0, 6.3, 60, 37.4700, 126.9700, 162),
        makeTrip('t5-3', getDayDate(5, 14, 10), 18, 10.2, 73.0, 69.0, 6.0, 80, 37.5100, 127.0100, 163),
        makeTrip('t5-4', getDayDate(5, 17, 40), 15, 8.9, 69.0, 66.0, 5.8, 72, 37.4600, 126.9600, 164),

        // Day 6 (6 days ago): 2 trips
        makeTrip('t6-1', getDayDate(6, 8, 15), 37, 21.3, 90.0, 83.0, 6.4, 95, 37.4500, 126.9500, 171),
        makeTrip('t6-2', getDayDate(6, 18, 40), 38, 21.3, 83.0, 77.0, 6.2, 92, 37.5100, 127.0100, 172)
      ];

      return trips.sort((a, b) => new Date(b.data.started_at).getTime() - new Date(a.data.started_at).getTime());
    };

    const nowMs = Date.now();
    const tz = this._hass?.config?.time_zone;
    if (!card._mockTripsInitialized) {
      card._mockTripsInitialized = true;
      card._rawTrips = generateMockTrips(nowMs);
      card._mergedTrips = mergeConsecutiveTrips(card._rawTrips, tz, 1800);
      if (card._mergeTripsEnabled === undefined) card._mergeTripsEnabled = true;
      card.trips = card._mergeTripsEnabled ? card._mergedTrips : card._rawTrips;
    }
    if (!card.charges || card.charges.length === 0) {
      const nowMs = Date.now();
      const d0_pm = new Date(); d0_pm.setHours(14, 15, 0, 0);
      const d0_am = new Date(); d0_am.setHours(9, 30, 0, 0);
      const d1 = new Date(nowMs - 86400000); d1.setHours(13, 0, 0, 0);
      const d2 = new Date(nowMs - 86400000 * 2); d2.setHours(13, 0, 0, 0);
      const d4 = new Date(nowMs - 86400000 * 4); d4.setHours(2, 0, 0, 0);
      const d5 = new Date(nowMs - 86400000 * 5); d5.setHours(20, 0, 0, 0);
      const d6 = new Date(nowMs - 86400000 * 6); d6.setHours(20, 10, 0, 0);
      card.charges = [
        {
          id: 'sim-charge-today-pm',
          observed_at: new Date(d0_pm.getTime() + 13500000).toISOString(),
          data: {
            started_at: d0_pm.toISOString(),
            ended_at: new Date(d0_pm.getTime() + 13500000).toISOString(),
            energy_kwh: 43.68,
            duration_s: 13500,
            start_soc_percent: 24,
            end_soc_percent: 80,
            soc_charged_percent: 56,
            partial: false
          }
        },
        {
          id: 'sim-charge-today-am',
          observed_at: new Date(d0_am.getTime() + 2280000).toISOString(),
          data: {
            started_at: d0_am.toISOString(),
            ended_at: new Date(d0_am.getTime() + 2280000).toISOString(),
            energy_kwh: 28.08,
            duration_s: 2280,
            start_soc_percent: 42,
            end_soc_percent: 78,
            soc_charged_percent: 36,
            merged: true,
            merge_count: 2,
            merge_gap_s: 240,
            merge_parts: [{ energy_kwh: 12.6 }, { energy_kwh: 15.48 }],
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
            start_soc_percent: 20,
            end_soc_percent: 75,
            soc_charged_percent: 55,
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
            start_soc_percent: 30,
            end_soc_percent: 80,
            soc_charged_percent: 50,
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
            start_soc_percent: 45,
            end_soc_percent: 81,
            soc_charged_percent: 36,
            partial: false
          }
        },
        {
          id: 'sim-charge-d6',
          observed_at: new Date(d6.getTime() + 4500000).toISOString(),
          data: {
            started_at: d6.toISOString(),
            ended_at: new Date(d6.getTime() + 4500000).toISOString(),
            energy_kwh: 16.38,
            duration_s: 4500,
            soc_charged_percent: 21,
            soc_retroactive_estimated: true,
            partial: false
          }
        }
      ];
    }
    if (!card.v) card.v = {};
    if (!card.v.battery_history) {
      card.v.battery_history = generateMockBatteryHistory(this.state.soc, this.state.mode === 'charging', this.state.mode === 'driving');
    }

    // tz already declared above
    const esc = val => String(val ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const n = (val, digits = 1) => typeof val === 'number' && Number.isFinite(val) ? val.toLocaleString(isEn ? 'en-GB' : 'ko-KR', { maximumFractionDigits: digits }) : '—';
    const time = val => val && !Number.isNaN(new Date(val).getTime()) ? new Date(val).toLocaleString(isEn ? 'en-GB' : 'ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz || undefined }) : (isEn ? 'No records' : '기록 없음');
    const timeOnly = (val, timeZone = tz) => val && !Number.isNaN(new Date(val).getTime()) ? new Date(val).toLocaleString(isEn ? 'en-GB' : 'ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: timeZone || undefined }) : (isEn ? 'No records' : '기록 없음');
    const formatEtaCompletion = val => {
      if (!val) return isEn ? 'Calculating' : '계산 중';
      const targetDate = new Date(val);
      if (Number.isNaN(targetDate.getTime())) return '—';
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
      const dayDiff = Math.round((targetMidnight - todayMidnight) / 86400000);
      const timeStr = targetDate.toLocaleTimeString(isEn ? 'en-GB' : 'ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: tz || undefined });
      if (isEn) {
        let dayPrefix = '';
        if (dayDiff === 1) dayPrefix = 'Tomorrow ';
        else if (dayDiff === 2) dayPrefix = 'In 2 days ';
        else if (dayDiff > 2) dayPrefix = `${targetDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: tz || undefined })} `;
        return `${dayPrefix}Done at ${timeStr}`;
      }
      let dayPrefix = '';
      if (dayDiff === 1) dayPrefix = '내일 ';
      else if (dayDiff === 2) dayPrefix = '모레 ';
      else if (dayDiff > 2) dayPrefix = `${targetDate.getMonth() + 1}월 ${targetDate.getDate()}일 `;
      return `${dayPrefix}${timeStr} 완료`;
    };
    const chargeDuration = s => {
      if (typeof s !== 'number' || !Number.isFinite(s)) return '—';
      if (s <= 0) return isEn ? 'Done' : '완료';
      if (s < 60) return isEn ? '< 1 min' : '1분 미만';
      const totalMins = Math.round(s / 60);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      if (isEn) {
        if (h === 0) return `${m}m`;
        return m === 0 ? `${h}h` : `${h}h ${m}m`;
      }
      if (h === 0) return `${m}분`;
      return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
    };
    const shortDuration = val => {
      if (typeof val !== 'number') return '—';
      const h = Math.floor(val / 3600);
      const m = Math.floor(val / 60) % 60;
      if (isEn) return (h ? h + ' h ' : '') + m + ' min';
      return (h ? h + '시간 ' : '') + m + '분';
    };
    const icon = name => `<ha-icon icon="mdi:${name}"></ha-icon>`;
    const metric = (label, val, unit, ico, sub = '', cls = '') =>
      `<div class="metric ${cls}">${icon(ico)}<span class="label">${label}</span><strong>${esc(val)}<small>${esc(unit)}</small></strong>${sub ? `<span class="hint">${esc(sub)}</span>` : ''}</div>`;

    const tripDays = (events, timeZone, now = new Date()) => {
      const today = getTripDateKey(now, timeZone);
      const anchor = new Date(today + 'T12:00:00Z');
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(+anchor - (6 - i) * 86400000);
        const key = date.toISOString().slice(0, 10);
        return {
          key,
          date,
          today: i === 6,
          indices: (events || []).flatMap((e, index) => {
            const timeVal = e?.data?.started_at || e?.started_at || e?.observed_at || e?.data?.observed_at;
            return getTripDateKey(timeVal, timeZone) === key ? [index] : [];
          })
        };
      });
    };

    card.tripHistory = function(isTrip) {
      const currentTz = this._hass?.config?.time_zone;
      const isEnglish = isEn || card.lang === 'en';
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
      const labels = d => d.date.getUTCDate() + (isEnglish ? ` (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.date.getUTCDay()]})` : `일(${['일','월','화','수','목','금','토'][d.date.getUTCDay()]})`);

      const daysHtml = days.map(d => `
        <button class="trip-day ${d.key === this.tripDay ? 'active' : ''}" 
                data-trip-day="${d.key}" 
                aria-pressed="${d.key === this.tripDay}" 
                aria-label="${d.key}, ${d.indices.length} ${isEnglish ? 'trips' : '회 주행'}">
          <span class="trip-today">${d.today ? (isEnglish ? 'Today' : '오늘') : '&nbsp;'}</span>
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
        const startSoc = ed.start_soc_percent != null ? Math.round(ed.start_soc_percent) : null;
        const endSoc = ed.end_soc_percent != null ? Math.round(ed.end_soc_percent) : null;
        const drain = (startSoc != null && endSoc != null) ? (startSoc - endSoc) : null;
        const usedStr = drain > 0 ? `${drain}% ${isEnglish ? 'used' : '사용'}` : (drain < 0 ? `+${Math.abs(drain)}% ${isEnglish ? 'regen' : '회생'}` : `0% ${isEnglish ? 'used' : '사용'}`);
        const segTitle = `${timeOnly(ed.started_at || e.observed_at, currentTz)} ~ ${timeOnly(ed.ended_at || e.observed_at, currentTz)} · ${n((ed.distance_m || 0) / 1000, 2)}km · 🔋${startSoc ?? '—'}%→${endSoc ?? '—'}% (${usedStr}) · ${n(ed.efficiency_km_kwh, 1)} km/kWh${ed.merged ? ` (${ed.merge_count}${isEnglish ? ' merged' : '건 병합'})` : ''}`;

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
        cardsHtml = `<div class="empty" style="grid-column: 1 / -1; padding: 40px 10px;">${isEnglish ? 'No trips recorded for this date.' : '기록된 주행이 없습니다.'}</div>`;
      } else {
        cardsHtml = visibleIndices.map(i => {
          const e = this.trips[i];
          const ed = e?.data || {};
          const durText = tripDurationKo(ed.duration_s, isEnglish);
          const startSoc = ed.start_soc_percent != null ? Math.round(ed.start_soc_percent) : null;
          const endSoc = ed.end_soc_percent != null ? Math.round(ed.end_soc_percent) : null;
          const drain = (startSoc != null && endSoc != null) ? (startSoc - endSoc) : null;
          const usedStr = drain > 0 ? `${drain}% ${isEnglish ? 'used' : '사용'}` : (drain < 0 ? `+${Math.abs(drain)}% ${isEnglish ? 'regen' : '회생'}` : `0% ${isEnglish ? 'used' : '사용'}`);
          const isSel = isTrip && i === this.selected;

          // Authentic Carrot HA Badges
          const socHtml = (startSoc != null && endSoc != null)
            ? `<span class="trip-soc"><ha-icon icon="mdi:${batteryIconName(startSoc)}"></ha-icon> <span>${startSoc}% → ${endSoc}%</span><small class="soc-used-tag">(${usedStr})</small></span>`
            : '';
          const effHtml = ed.efficiency_km_kwh != null
            ? `<span class="trip-eff">${n(ed.efficiency_km_kwh, 1)} km/kWh</span>`
            : '';
          const mergeHtml = (ed.merged && ed.merge_count > 1)
            ? `<span class="trip-merge-badge">${ed.merge_count}${isEnglish ? ' merged' : '건 병합'}</span>`
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
            ◀ ${isEnglish ? 'Prev Page' : '이전 페이지'}
          </button>
          <span class="page-indicator-text">
            ${this._tripPage} / ${totalPages} ${isEnglish ? 'Page' : '페이지'} (${isEnglish ? 'Total ' : '총 '}${totalItems}${isEnglish ? '' : '개'})
          </span>
          <button class="page-nav-btn" data-nav-page="next" ${this._tripPage >= totalPages ? 'disabled' : ''}>
            ${isEnglish ? 'Next Page' : '다음 페이지'} ▶
          </button>
        </div>
      `;

      const isMergeActive = this._mergeTripsEnabled !== false;
      const hasMergedTrips = dayIndices.some(i => this.trips[i]?.data?.merged);
      const mergeSubText = isMergeActive
        ? (hasMergedTrips ? (isEnglish ? '(≤30m gaps merged)' : '(30분 이하 인접 주행 병합됨)') : '')
        : (isEnglish ? '(individual trips)' : '(개별 분할 표시)');

      return `
        <section class="panel trip-history">
          <div class="paneltitle">
            <h2>${isEnglish ? 'Recent Trips' : '최근 주행'}</h2>
            <span class="sub">${isEnglish ? 'Recent 7 days' : '최근 7일'}</span>
          </div>
          <div class="trip-days">
            ${daysHtml}
          </div>
          ${selected ? `
            <div class="day-timeline-wrap">
              <div class="day-timeline-topline">
                <span class="day-timeline-title">
                  <strong>${selected.key} · ${dayIndices.length}${isEnglish ? ' trips' : '회 주행'}</strong>
                  <small class="day-timeline-merge-sub">${mergeSubText}</small>
                </span>
                <button class="merge-toggle-badge ${isMergeActive ? '' : 'off'}" id="btnToggleTripMerge" title="${isEnglish ? 'Click to toggle 30-min adjacent trip merge' : '클릭하여 30분 이하 인접 주행 병합 토글'}">
                  ${isMergeActive ? (isEnglish ? 'Merged (≤30m)' : '30분 이하 병합됨') : (isEnglish ? 'Individual Trips' : '개별 분할 표시')}
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
            <div class="empty">${isEnglish ? 'Select a date to view trip history.' : '날짜를 선택하면 해당 날짜의 주행 기록이 표시됩니다.'}</div>
          `}
        </section>
      `;
    };

    const formatChargeDuration = (s, isEnglish) => {
      if (typeof s !== 'number' || !Number.isFinite(s) || s < 0) return '—';
      const totalSec = Math.round(s);
      if (totalSec < 60) return isEnglish ? '< 1m' : '1분 미만';
      const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60);
      if (isEnglish) {
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
      }
      if (h > 0 && m > 0) return `${h}시간 ${m}분`;
      if (h > 0) return `${h}시간`;
      return `${m}분`;
    };

    card.chargeHistory = function() {
      const currentTz = this._hass?.config?.time_zone;
      const isEnglish = isEn || card.lang === 'en' || card.state?.lang === 'en' || this.state?.lang === 'en';
      const days = tripDays(this.charges, currentTz);
      if (!this.chargeDay || !days.some(d => d.key === this.chargeDay)) {
        const today = days.find(d => d.today) || days[days.length - 1];
        this.chargeDay = today ? today.key : null;
      }
      const selected = days.find(d => d.key === this.chargeDay);
      const labels = d => d.date.getUTCDate() + (isEnglish ? ` (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.date.getUTCDay()]})` : `일(${['일','월','화','수','목','금','토'][d.date.getUTCDay()]})`);

      const daysHtml = days.map(d => `
        <button class="trip-day charge-day" 
                data-charge-day="${d.key}" 
                aria-pressed="${d.key === this.chargeDay}" 
                aria-label="${d.key}, ${d.indices.length} ${isEnglish ? 'charges' : '회 충전'}">
          <span class="trip-today charge-today">${d.today ? (isEnglish ? 'Today' : '오늘') : '&nbsp;'}</span>
          <b>${labels(d)}</b>
          <span class="trip-count charge-count">${icon('power-plug')} ${d.indices.length}</span>
        </button>
      `).join('');

      const batterySvg = `<svg class="charge-soc-icon" viewBox="0 0 24 24"><path d="M16 4h-2V2h-4v2H8C6.9 4 6 4.9 6 6v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H8V6h8v14z"/></svg>`;

      return `
        <section class="panel charge-history">
          <div class="paneltitle">
            <h2>${isEnglish ? 'Charging Records' : '충전 내역'}</h2>
            <span class="sub">${isEnglish ? 'Last 7 days' : '최근 7일'}</span>
          </div>
          <div class="trip-days charge-days">
            ${daysHtml}
          </div>
          ${selected ? `
            <div class="trip-day-heading">${selected.key} · ${selected.indices.length}${isEnglish ? ' charges' : '회 충전'}</div>
            <div class="scroll">
              ${selected.indices.length ? selected.indices.map(i => {
                const e = this.charges[i];
                const ed = e?.data || e || {};
                const fast = Boolean(ed.energy_kwh && ed.duration_s && (ed.energy_kwh / (ed.duration_s / 3600) > 11));
                const boltSvg = fast ?
                  `<svg viewBox="0 0 24 24" class="charge-bolt" fill="currentColor" aria-hidden="true"><path d="M3.2,4V12.8H5.6V20L11.2,10.4H8L11.2,4Z"/><path d="M12.8,4V12.8H15.2V20L20.8,10.4H17.6L20.8,4Z"/></svg>` :
                  `<svg viewBox="0 0 24 24" class="charge-bolt" fill="currentColor" aria-hidden="true"><path d="M7,2V13H10V22L17,10H13L17,2H7Z"/></svg>`;

                const startSoc = ed.start_soc_percent != null ? Math.round(ed.start_soc_percent) : null;
                const endSoc = ed.end_soc_percent != null ? Math.round(ed.end_soc_percent) : null;
                const chargedSoc = ed.soc_charged_percent != null ? Math.round(ed.soc_charged_percent) : ((startSoc != null && endSoc != null) ? Math.max(0, endSoc - startSoc) : null);
                const isRetro = Boolean(ed.soc_retroactive_estimated);

                let socBadgeHtml = '';
                if (startSoc != null && endSoc != null) {
                  const gain = chargedSoc != null ? chargedSoc : Math.max(0, endSoc - startSoc);
                  socBadgeHtml = `<span class="charge-soc">${batterySvg} ${startSoc}% → ${endSoc}% (+${gain}% ${isEnglish ? 'charged' : '충전'})</span>`;
                } else if (chargedSoc != null) {
                  socBadgeHtml = `<span class="charge-soc ${isRetro ? 'retro-mode' : ''}">${batterySvg} +${chargedSoc}% ${isEnglish ? 'charged' : '충전'}${isRetro ? ` <small class="retro-tag">(${isEnglish ? 'est.' : '소급 추산'})</small>` : ''}</span>`;
                }

                return `
                  <div class="row charge-row">
                    <div class="charge-meta">
                      <span class="charge-icon-wrap ${fast ? 'fast' : ''}">${boltSvg}</span>
                      <div>
                        <b class="charge-date">${timeOnly(ed.started_at || e.observed_at)}</b>
                        <div class="charge-info-sub">
                          <span class="speed-badge ${fast ? 'fast' : 'slow'}">${fast ? (isEnglish ? 'Fast' : '급속') : (isEnglish ? 'Slow' : '완속')}</span>
                          <span class="charge-dur">${formatChargeDuration(ed.duration_s, isEnglish)}</span>
                          ${socBadgeHtml}
                          ${ed.merged ? `<span class="merge-badge">${ed.merge_count}${isEnglish ? ' merged' : '회 병합'}</span>` : ''}
                        </div>
                      </div>
                    </div>
                    <div class="charge-val">
                      <strong>${n(ed.energy_kwh, 2)} <small>kWh</small></strong>
                      <span class="charge-sub" title="${ed.merged ? (ed.merge_parts || []).map(p => `${n(p.energy_kwh, 1)} kWh`).join(' + ') : ''}">
                        ${ed.merged ? (isEnglish ? `Reconnected in ${Math.max(1, Math.round((ed.merge_gap_s || 0) / 60))}m` : `${Math.max(1, Math.round((ed.merge_gap_s || 0) / 60))}분 간격 재연결`) : (ed.partial ? (isEnglish ? 'Partial data' : '일부 구간만 수집') : (isEnglish ? 'Recorded energy' : '기록된 충전량'))}
                      </span>
                    </div>
                  </div>`;
              }).join('') : `<div class="empty">${isEnglish ? 'No charges recorded.' : '기록된 충전이 없습니다.'}</div>`}
            </div>
          ` : `
            <div class="empty">${isEnglish ? 'Choose a date to see its charges.' : '날짜를 선택하면 해당 날짜의 충전 기록이 표시됩니다.'}</div>
          `}
        </section>
      `;
    };

    card.overview = (v) => {
      const displayState = card.vehicleStatus(v);
      const charging = displayState.key === 'charging';
      const isDriving = displayState.key === 'driving';
      const isParked = !charging && !isDriving;
      const latest = card.trips?.[0]?.data;
      const soc = Number.isFinite(v.soc_percent) ? Math.max(0, Math.min(100, v.soc_percent)) : null;
      const status = displayState.label;
      const powerKw = v.charge_power_kw ?? (v.charge_power_w == null ? null : v.charge_power_w / 1000);
      const isEmergency = Boolean(v.emergency_charging);
      const isFast = typeof powerKw === 'number' && powerKw > 11;
      const chargeLabel = isEmergency
        ? (powerKw ? (isEn ? `Emergency Charging (${n(powerKw, 1)}kW)...` : `비상충전중 (${n(powerKw, 1)}kW)...`) : (isEn ? 'Emergency Charging...' : '비상충전중...'))
        : (isFast ? (isEn ? 'Fast Charging...' : '고속충전중...') : (isEn ? 'Slow Charging...' : '완속충전중...'));
      const sweepSpeedClass = isFast ? 'fast' : 'slow';

      const rawDoors = v.open_doors || [];
      const openDoors = rawDoors.map(d => {
        if (!isEn) return d;
        if (d.includes('운전석 뒤')) return 'Rear driver door';
        if (d.includes('운전석')) return 'Driver door';
        if (d.includes('조수석 뒤') || d.includes('동승석 뒤')) return 'Rear passenger door';
        if (d.includes('조수석') || d.includes('동승석')) return 'Passenger door';
        if (d.includes('트렁크')) return 'Trunk';
        return d;
      });
      const isLocked = v.doors_locked !== false && openDoors.length === 0;
      const candidate = this.state.candidate || 1;

      // 1. Lock Status Card Renderer (Candidate 1 ~ 5)
      const renderLockMetric = (locked, isChargingMode, doorsList = [], c = 1) => {
        const modeClass = isChargingMode ? 'mode-charging' : 'mode-parked';
        const lockClass = locked ? 'is-locked' : 'is-unlocked';
        const statusText = locked ? (isEn ? 'Locked' : '잠김') : (isEn ? 'Unlocked' : '열림');
        const lockLabel = isEn ? 'Vehicle Lock Status' : '차량 잠금 상태';

        let hintText = '';
        if (locked) {
          hintText = isEn ? 'All doors closed & locked' : '모든 도어 닫힘 및 잠김';
        } else if (!doorsList || doorsList.length === 0) {
          hintText = isEn ? 'Door open' : '도어 열림';
        } else if (doorsList.length === 1) {
          hintText = isEn ? `${doorsList[0]} open` : `${doorsList[0]} 열림`;
        } else {
          hintText = isEn ? `${doorsList[0]} +${doorsList.length - 1} open` : `${doorsList[0]} 외 ${doorsList.length - 1}개 열림`;
        }

        if (c === 1) {
          return `
            <div class="metric lock-metric c1 ${modeClass} ${lockClass}">
              <span class="label">${lockLabel}</span>
              <div class="lock-val-row">
                <div class="lock-icon-badge">
                  <ha-icon icon="${locked ? 'mdi:lock' : 'mdi:lock-open-variant'}"></ha-icon>
                </div>
                <strong class="lock-val ${locked ? 'locked-text' : 'unlocked-text'}">${statusText}</strong>
              </div>
              <span class="hint">${hintText}</span>
            </div>`;
        }
        if (c === 2) {
          return `
            <div class="metric lock-metric c2 ${modeClass} ${lockClass}">
              <span class="label">${lockLabel}</span>
              <div class="lock-val-row">
                <div class="lock-icon-badge">
                  <ha-icon icon="${locked ? 'mdi:shield-check' : 'mdi:shield-alert'}"></ha-icon>
                </div>
                <strong class="lock-val ${locked ? 'locked-text' : 'unlocked-text'}">${statusText}</strong>
              </div>
              <span class="hint">${hintText}</span>
            </div>`;
        }
        if (c === 3) {
          return `
            <div class="metric lock-metric c3 ${modeClass} ${lockClass}">
              <span class="label">${lockLabel}</span>
              <div class="lock-val-row">
                <div class="lock-icon-badge">
                  <ha-icon icon="${locked ? 'mdi:car-door-lock' : 'mdi:car-door'}"></ha-icon>
                </div>
                <strong class="lock-val ${locked ? 'locked-text' : 'unlocked-text'}">${statusText}</strong>
              </div>
              <span class="hint">${hintText}</span>
            </div>`;
        }
        if (c === 4) {
          return `
            <div class="metric lock-metric c4 ${modeClass} ${lockClass}">
              <span class="label">${lockLabel}</span>
              <div class="lock-val-row">
                <div class="lock-icon-badge">
                  <ha-icon icon="${locked ? 'mdi:lock-check' : 'mdi:lock-alert'}"></ha-icon>
                </div>
                <strong class="lock-val ${locked ? 'locked-text' : 'unlocked-text'}">${statusText}</strong>
              </div>
              <span class="hint">${hintText}</span>
            </div>`;
        }
        return `
          <div class="metric lock-metric c5 ${modeClass} ${lockClass}">
            <span class="label">${lockLabel}</span>
            <div class="lock-val-row">
              <div class="lock-icon-badge">
                <ha-icon icon="${locked ? 'mdi:lock' : 'mdi:alert'}"></ha-icon>
              </div>
              <strong class="lock-val ${locked ? 'locked-text' : 'unlocked-text'}">${statusText}</strong>
            </div>
            <span class="hint">${hintText}</span>
          </div>`;
      };

      // 2. Battery Power Readout Renderer (Candidate 1 ~ 5)
      const renderBatteryPower = (pKw, fast, emergency, c) => {
        const pVal = typeof pKw === 'number' ? pKw.toFixed(1) : '—';
        const typeLabel = emergency ? (isEn ? 'Emergency' : '비상') : (fast ? (isEn ? 'Fast' : '급속') : (isEn ? 'Slow' : '완속'));
        if (c === 1) {
          return `
            <div class="charge-power-badge cp-c1">
              <div class="cp-pill">
                <span class="cp-bolt">⚡</span>
                <span class="cp-num">${pVal}</span>
                <span class="cp-unit">kW</span>
                <span class="cp-tag ${fast ? 'fast' : 'slow'}">${typeLabel}</span>
              </div>
            </div>`;
        }
        if (c === 2) {
          return `
            <div class="charge-power-badge cp-c2">
              <div class="cp-divider"></div>
              <div class="cp-stack">
                <div class="cp-num-row">
                  <span class="cp-num">${pVal}</span>
                  <small class="cp-unit">kW</small>
                </div>
                <span class="cp-sub-label">${emergency ? (isEn ? 'Emergency' : '비상 충전') : (fast ? (isEn ? 'Fast Charge' : '고속 급속') : (isEn ? 'Standard' : '표준 완속'))}</span>
              </div>
            </div>`;
        }
        if (c === 3) {
          return `
            <div class="charge-power-badge cp-c3">
              <div class="cp-neon-chip">
                <span class="cp-icon">⚡</span>
                <span class="cp-text">${pVal} kW</span>
                <span class="cp-badge">${typeLabel}</span>
              </div>
            </div>`;
        }
        if (c === 4) {
          return `
            <div class="charge-power-badge cp-c4">
              <span class="cp-title">${isEn ? 'Intake Power' : '인입 충전 전력'}</span>
              <div class="cp-main">
                <span class="cp-val">${pVal}</span>
                <small>kW</small>
                <span class="cp-speed">${typeLabel}</span>
              </div>
            </div>`;
        }
        return `
          <div class="charge-power-badge cp-c5">
            <div class="cp-gauge">
              <span class="cp-glow">⚡</span>
              <strong class="cp-digital">${pVal}</strong>
              <small class="cp-kw">kW</small>
              <span class="cp-pill-type">${typeLabel}</span>
            </div>
          </div>`;
      };

      // 3. Quick Metrics: 4 Cards
      const isUnder80 = soc == null || Math.round(soc) < 80;
      const targetPercent = isUnder80 ? 80 : 100;
      const etaCardTitle = isEn ? `Time to ${targetPercent}%` : `${targetPercent}%까지 걸리는 시간`;
      const targetSec = isUnder80 ? v.time_to_80_s : v.time_to_100_s;
      const targetEta = isUnder80 ? v.eta_80 : v.eta_100;

      let etaCardMainVal = isEn ? 'Calculating' : '계산 중';
      let etaCardSubText = isEn ? `${targetPercent}% target` : `${targetPercent}% 목표`;
      if (typeof targetSec === 'number' && Number.isFinite(targetSec)) {
        if (targetSec <= 0) {
          etaCardMainVal = isEn ? 'Done' : '완료';
          etaCardSubText = isEn ? 'Charging complete' : '충전 완료';
        } else {
          etaCardMainVal = chargeDuration(targetSec);
          etaCardSubText = formatEtaCompletion(targetEta);
        }
      }

      // Real-time Charging Session Cost (Card 3 in Charging Mode)
      const sessionKwh = typeof v.session_charge_kwh === 'number'
        ? v.session_charge_kwh
        : (typeof v.charge_energy_kwh === 'number' ? v.charge_energy_kwh : 0.0);
      const sessionUnitPrice = isFast ? 320 : 280;
      const sessionCost = typeof v.session_charge_cost === 'number'
        ? v.session_charge_cost
        : Math.round(sessionKwh * sessionUnitPrice);
      const sessionCostSub = `+${n(sessionKwh, 1)} kWh ${isEn ? '(est.)' : '(추정)'}`;
      const costUnit = isEn ? 'KRW' : '원';

      const quickMetrics = charging
        ? `${renderLockMetric(isLocked, true, openDoors, candidate)}` +
          `${metric(etaCardTitle, etaCardMainVal, '', 'clock-end', etaCardSubText, 'charge-eta')}` +
          `${metric(isEn ? 'Real-time Charge Cost' : '실시간 충전금액', n(sessionCost, 0), costUnit, 'cash', sessionCostSub, 'charge-cost')}` +
          `${metric(isEn ? 'Charged this month' : '이번 달 충전량', n(v.month_charge_kwh), 'kWh', 'battery-plus')}`
        : `${renderLockMetric(isLocked, false, openDoors, candidate)}` +
          `${metric(isEn ? 'Total Odometer' : '총 주행거리', n(v.odometer_km, 0), 'km', 'counter')}` +
          `${metric(isEn ? 'Charged this month' : '이번 달 충전량', n(v.month_charge_kwh), 'kWh', 'battery-plus')}` +
          `${metric(isEn ? 'Charge cost this month' : '이번 달 충전요금', n(v.month_charge_cost, 0), costUnit, 'cash', isEn ? '(est.)' : '(추정)')}`;


      const markersHtml = charging
        ? `${(soc == null || soc < 80) ? `<div class="charge-marker marker-80" data-top="80%" data-bottom="${chargeDuration(v.time_to_80_s)}"><span class="marker-cap cap-top"></span><span class="marker-cap cap-bottom"></span></div>` : ''}` +
          `<div class="charge-marker marker-100" data-top="100%" data-bottom="${chargeDuration(v.time_to_100_s)}"><span class="marker-cap cap-top"></span><span class="marker-cap cap-bottom"></span></div>`
        : '';

      const sweepHtml = charging
        ? `<div class="sweep-overlay"><div class="sweep-clipper"><div class="sweep-beam ${sweepSpeedClass}"></div></div></div>`
        : (isDriving ? `<div class="sweep-overlay"><div class="sweep-clipper"><div class="sweep-beam driving"></div></div></div>` : '');

      const rangeKm = typeof v.estimated_range_km === 'number' && Number.isFinite(v.estimated_range_km)
        ? v.estimated_range_km
        : Math.round((soc ?? 0) * 4.6);
      const rc = this.state.rangeCandidate || 1;

      const renderEnergyHead = (isChargingMode, isDrivingMode, socVal, cLabel, pKw, fast, rKm, rCand) => {
        const rangeNum = typeof rKm === 'number' && Number.isFinite(rKm) ? rKm : '—';
        const powerTag = pKw != null ? `<span class="charge-power-tag ${fast ? 'fast' : 'slow'}">${n(pKw, 1)} kW</span>` : '';
        const batteryIconSvg = `<svg viewBox="0 0 24 24" class="battery-head-icon"><path d="M16.67 4C17.4 4 18 4.6 18 5.33v15.34A1.33 1.33 0 0 1 16.67 22H7.33A1.33 1.33 0 0 1 6 20.67V5.33C6 4.6 6.6 4 7.33 4H9V2h6v2h1.67M16 6H8v14h8V6z"/></svg>`;
        const driveModeIcon = isDrivingMode ? '🛣️' : '🔋';

        if (isChargingMode) {
          if (rCand === 1) {
            return `
              <div class="energy-head charging-left range-c1">
                <div class="charge-head-main">
                  <svg viewBox="0 0 24 24" class="charge-head-bolt"><path d="M7 2v11h3v9l7-12h-4l3-8z"/></svg>
                  <div class="charge-info-stack">
                    <div class="charge-status-line">
                      <span class="charge-status-label">${cLabel}</span>
                      ${powerTag}
                    </div>
                    <div class="soc-row-inline">
                      <strong class="soc-value">${n(socVal, 0)}<small>%</small></strong>
                      <span class="range-inline-c1">
                        <span class="range-sep">|</span>
                        <span class="range-val">${rangeNum}</span>
                        <span class="range-unit">km</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>`;
          }
          if (rCand === 2) {
            return `
              <div class="energy-head charging-left range-c2">
                <div class="charge-head-main">
                  <svg viewBox="0 0 24 24" class="charge-head-bolt"><path d="M7 2v11h3v9l7-12h-4l3-8z"/></svg>
                  <div class="charge-info-stack">
                    <div class="charge-status-line">
                      <span class="charge-status-label">${cLabel}</span>
                      ${powerTag}
                    </div>
                    <strong class="soc-value">${n(socVal, 0)}<small>%</small></strong>
                  </div>
                </div>
                <div class="range-capsule-c2">
                  <span class="rc-label">${isEn ? 'Driving range' : '주행 가능'}</span>
                  <div class="rc-val"><b>${rangeNum}</b><small>km</small></div>
                </div>
              </div>`;
          }
          if (rCand === 3) {
            return `
              <div class="energy-head charging-left range-c3">
                <div class="charge-head-main">
                  <svg viewBox="0 0 24 24" class="charge-head-bolt"><path d="M7 2v11h3v9l7-12h-4l3-8z"/></svg>
                  <div class="charge-info-stack">
                    <div class="charge-status-line">
                      <span class="charge-status-label">${cLabel}</span>
                      ${powerTag}
                    </div>
                    <strong class="soc-value">${n(socVal, 0)}<small>%</small></strong>
                    <div class="range-sub-c3">
                      <span>${isEn ? 'Est. driving range' : '예상 주행가능거리'} <b>${rangeNum} km</b></span>
                    </div>
                  </div>
                </div>
              </div>`;
          }
          if (rCand === 4) {
            return `
              <div class="energy-head charging-left range-c4">
                <div class="charge-head-main">
                  <svg viewBox="0 0 24 24" class="charge-head-bolt"><path d="M7 2v11h3v9l7-12h-4l3-8z"/></svg>
                  <div class="charge-info-stack">
                    <div class="charge-status-line">
                      <span class="charge-status-label">${cLabel}</span>
                      ${powerTag}
                      <span class="range-chip-c4">
                        <svg viewBox="0 0 24 24" class="rc-chip-icon"><path d="M12 2C6.48 2 2 6.48 2 12c0 3.54 1.84 6.66 4.64 8.44.33.21.76.19 1.05-.07.31-.28.37-.73.17-1.08A7.95 7.95 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8c0 2.76-1.4 5.2-3.53 6.65-.33.23-.42.67-.23 1.03.19.36.63.5 1 .32C19.78 18.23 22 15.38 22 12c0-5.52-4.48-10-10-10zm-1 5.5v5.09c-.6.35-1 .99-1 1.74 0 1.1.9 2 2 2s2-.9 2-2c0-.75-.4-1.39-1-1.74V7.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5z"/></svg>
                        <b>${rangeNum}</b> km
                      </span>
                    </div>
                    <strong class="soc-value">${n(socVal, 0)}<small>%</small></strong>
                  </div>
                </div>
              </div>`;
          }
          // Candidate 5: Instrument Twin Gauge Pill
          return `
            <div class="energy-head charging-left range-c5">
              <div class="charge-head-main">
                <svg viewBox="0 0 24 24" class="charge-head-bolt"><path d="M7 2v11h3v9l7-12h-4l3-8z"/></svg>
                <div class="charge-info-stack">
                  <div class="charge-status-line">
                    <span class="charge-status-label">${cLabel}</span>
                    ${powerTag}
                  </div>
                  <div class="soc-twin-row-c5">
                    <strong class="soc-value">${n(socVal, 0)}<small>%</small></strong>
                    <div class="range-twin-c5">
                      <span class="rt-icon">⚡</span>
                      <div class="rt-stack">
                        <span class="rt-top">${isEn ? 'Range' : '주행가능'}</span>
                        <span class="rt-num"><b>${rangeNum}</b><small>km</small></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>`;
        }

        // Non-charging Mode (Parked / Driving)
        if (rCand === 1) {
          return `
            <div class="energy-head range-c1">
              <div class="battery-label">
                ${batteryIconSvg}
                <span>${isEn ? 'Battery level' : '배터리 잔량'}</span>
              </div>
              <div class="soc-row-inline">
                <strong class="soc-value">${n(socVal, 0)}<small>%</small></strong>
                <span class="range-inline-c1">
                  <span class="range-sep">|</span>
                  <span class="range-val">${rangeNum}</span>
                  <span class="range-unit">km</span>
                </span>
              </div>
            </div>`;
        }
        if (rCand === 2) {
          return `
            <div class="energy-head range-c2">
              <div class="battery-label">
                ${batteryIconSvg}
                <span>${isEn ? 'Battery level' : '배터리 잔량'}</span>
              </div>
              <div class="right-stack-c2">
                <strong class="soc-value">${n(socVal, 0)}<small>%</small></strong>
                <div class="range-capsule-c2">
                  <span class="rc-label">${isEn ? 'Driving range' : '주행 가능'}</span>
                  <div class="rc-val"><b>${rangeNum}</b><small>km</small></div>
                </div>
              </div>
            </div>`;
        }
        if (rCand === 3) {
          return `
            <div class="energy-head range-c3">
              <div class="battery-label">
                ${batteryIconSvg}
                <span>${isEn ? 'Battery level' : '배터리 잔량'}</span>
              </div>
              <div class="soc-stack-c3">
                <strong class="soc-value">${n(socVal, 0)}<small>%</small></strong>
                <div class="range-sub-c3">
                  <span>${isEn ? 'Est. driving range' : '주행가능거리 약'} <b>${rangeNum} km</b></span>
                </div>
              </div>
            </div>`;
        }
        if (rCand === 4) {
          return `
            <div class="energy-head range-c4">
              <div class="battery-label">
                ${batteryIconSvg}
                <span>${isEn ? 'Battery level' : '배터리 잔량'}</span>
                <span class="range-chip-c4">
                  <svg viewBox="0 0 24 24" class="rc-chip-icon"><path d="M12 2C6.48 2 2 6.48 2 12c0 3.54 1.84 6.66 4.64 8.44.33.21.76.19 1.05-.07.31-.28.37-.73.17-1.08A7.95 7.95 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8c0 2.76-1.4 5.2-3.53 6.65-.33.23-.42.67-.23 1.03.19.36.63.5 1 .32C19.78 18.23 22 15.38 22 12c0-5.52-4.48-10-10-10zm-1 5.5v5.09c-.6.35-1 .99-1 1.74 0 1.1.9 2 2 2s2-.9 2-2c0-.75-.4-1.39-1-1.74V7.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5z"/></svg>
                  <b>${rangeNum}</b> km
                </span>
              </div>
              <strong class="soc-value">${n(socVal, 0)}<small>%</small></strong>
            </div>`;
        }
        // Candidate 5: Instrument Twin Gauge Pill
        return `
          <div class="energy-head range-c5">
            <div class="battery-label">
              ${batteryIconSvg}
              <span>${isEn ? 'Battery level' : '배터리 잔량'}</span>
            </div>
            <div class="soc-twin-row-c5">
              <strong class="soc-value">${n(socVal, 0)}<small>%</small></strong>
              <div class="range-twin-c5">
                <span class="rt-icon">${driveModeIcon}</span>
                <div class="rt-stack">
                  <span class="rt-top">${isEn ? 'Range' : '주행가능'}</span>
                  <span class="rt-num"><b>${rangeNum}</b><small>km</small></span>
                </div>
              </div>
            </div>
          </div>`;
      };

      const energyHeadHtml = renderEnergyHead(charging, isDriving, soc, chargeLabel, powerKw, isFast, rangeKm, rc);

      const socState = !charging && soc !== null ? (soc < 15 ? 'is-critical soc-critical' : soc < 30 ? 'is-low soc-low' : '') : '';

      return `<div class="cockpit desktop-balanced-cockpit">
        <div class="overview-col-visual">
          <section class="hero">
            <div class="hero-copy"><h2>${esc(status).replace('\n', '<br>')}</h2></div>
            ${card.vehicleImage()}
          </section>
          <div class="mini-condition">
            <span>${isEn ? 'Outside' : '외기'} <b>${n(v.outside_temp_c)}°C</b></span>
            <span>12V <b>${n(v.aux_voltage, 1)}V</b></span>
            <span>${isEn ? 'Climate' : '공조'} <b>${v.ac_on == null ? '—' : v.ac_on ? 'ON' : 'OFF'}</b></span>
          </div>
        </div>
        <div class="overview-col-telemetry">
          <section class="energy ${charging ? 'is-charging' : ''} ${isDriving ? 'is-driving' : ''} ${socState}" style="--soc:${soc ?? 0}%">
            ${sweepHtml}${markersHtml}${energyHeadHtml}
          </section>
          <div class="quick-metrics">${quickMetrics}</div>
          <div class="overview-links">
            <button class="shortcut" data-tab="parking">
              <span><b>${isEn ? 'Parking location' : '주차 위치'}</b><small>${v.parking_latitude == null ? (isEn ? 'Waiting for location' : '위치 수신 대기') : time(v.parking_at, tz)}</small></span>
              <em>${isEn ? 'Map →' : '지도 →'}</em>
              <div class="mini-map parking-mini"></div>
            </button>
            <button class="shortcut" data-tab="trips">
              <span><b>${isEn ? 'Recent trips' : '최근 주행'}</b><small>${latest ? n(latest.distance_m == null ? null : latest.distance_m / 1000, 2) + ' km' : (isEn ? 'No records' : '기록 없음')}</small><small>${latest ? shortDuration(latest.duration_s) : (isEn ? 'Waiting for a new trip' : '새 주행 기록을 기다립니다')}</small></span>
              <em>${isEn ? 'View →' : '보기 →'}</em>
              <div class="mini-map trip-mini"></div>
            </button>
          </div>
        </div>
      </div>`;
    };

    const origRender = card.render.bind(card);
    card.render = () => {
      const chargeState = card.v.charging ? 'on' : 'off';
      card._hass = { ...(this._hass || {}), states: { ...(this._hass?.states || {}), 'binary_sensor.carrot_debug_simulated': { state: chargeState } } };
      origRender();

      const refreshBtn = card.shadowRoot?.querySelector('.refresh');
      if (refreshBtn) {
        refreshBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.applyDebugTelemetry();
        };
      }

      // Pagination controls handling
      card.shadowRoot?.querySelectorAll('[data-nav-page]').forEach(b => {
        b.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const dir = b.dataset.navPage;
          if (dir === 'prev') {
            card._tripPage = Math.max(1, (card._tripPage || 1) - 1);
          } else if (dir === 'next') {
            card._tripPage = Math.min(card._maxTripPages || 1, (card._tripPage || 1) + 1);
          }
          card.render();
        };
      });

      // 30-min adjacent trip merge toggle handling
      const mergeBtn = card.shadowRoot?.querySelector('#btnToggleTripMerge');
      if (mergeBtn) {
        mergeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          card._mergeTripsEnabled = !(card._mergeTripsEnabled !== false);
          card.trips = card._mergeTripsEnabled ? card._mergedTrips : card._rawTrips;
          card.selected = null;
          card._tripPage = 1;
          card.render();
        };
      }

      // Reset trip pagination page when switching day
      card.shadowRoot?.querySelectorAll('[data-trip-day]').forEach(b => {
        const orig = b.onclick;
        b.onclick = (e) => {
          card._tripPage = 1;
          if (orig) orig.call(b, e);
        };
      });

      this.injectCustomStyles(card);

      if (typeof window !== 'undefined' && window.ResizeObserver) {
        if (!card._mapResizeObserver) {
          card._mapResizeObserver = new ResizeObserver(() => {
            if (card.miniMaps && card.miniMaps.length) {
              card.miniMaps.forEach(m => {
                try { m.invalidateSize(); } catch (e) {}
              });
            }
            if (card.map) {
              try { card.map.invalidateSize(); } catch (e) {}
            }
          });
        }
        card.shadowRoot?.querySelectorAll('.mini-map, .map').forEach(el => {
          card._mapResizeObserver.observe(el);
        });
      }
      setTimeout(() => {
        if (card.miniMaps && card.miniMaps.length) {
          card.miniMaps.forEach(m => {
            try { m.invalidateSize(); } catch (e) {}
          });
        }
        if (card.map) {
          try { card.map.invalidateSize(); } catch (e) {}
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
      .trip-days, .charge-days {
        display: grid !important;
        grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
        gap: 4px !important;
        padding: 0 10px 12px !important;
      }
      .charge-days {
        max-width: 480px !important;
        margin: 0 auto 12px !important;
      }
      .trip-day {
        max-width: 54px !important;
        margin: 0 auto !important;
        width: 100% !important;
        min-width: 0 !important;
        border-radius: 12px !important;
        padding: 6px 2px !important;
        background: rgba(255,255,255,0.025) !important;
        border: 1px solid transparent !important;
        color: var(--ink) !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 2px !important;
        cursor: pointer !important;
        transition: all .18s ease !important;
      }
      .trip-day:hover {
        background: rgba(255,255,255,0.06) !important;
      }
      .trip-day[aria-pressed="true"], .trip-day.active {
        background: linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%) !important;
        border-color: #60a5fa !important;
        box-shadow: 0 3px 10px rgba(29,78,216,0.45) !important;
        color: #fff !important;
      }
      :host([data-theme="light"]) .trip-day[aria-pressed="true"], :host([data-theme="light"]) .trip-day.active {
        background: #dbeafe !important;
        border-color: #3b82f6 !important;
        color: #1e3a8a !important;
      }

      /* 24H Master Driving Timeline Bar */
      .day-timeline-wrap {
        padding: 10px 14px 12px !important;
        background: rgba(0,0,0,0.18) !important;
        border-top: 1px solid var(--line) !important;
        border-bottom: 1px solid var(--line) !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 6px !important;
      }
      :host([data-theme="light"]) .day-timeline-wrap {
        background: rgba(0,0,0,0.025) !important;
      }
      .day-timeline-topline {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        font-size: 12px !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
      }
      .day-timeline-title strong {
        color: var(--ink) !important;
        font-weight: 750 !important;
        font-size: 12px !important;
      }
      .day-timeline-merge-sub {
        color: var(--muted) !important;
        font-size: 11px !important;
        margin-left: 4px !important;
      }
      .merge-toggle-badge {
        background: rgba(168, 85, 247, 0.15) !important;
        color: #c084fc !important;
        border: 1px solid rgba(168, 85, 247, 0.35) !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        padding: 3px 9px !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        transition: all .15s ease !important;
      }
      :host([data-theme="light"]) .merge-toggle-badge {
        background: #f3e8ff !important;
        color: #7e22ce !important;
        border-color: #d8b4fe !important;
      }
      .merge-toggle-badge:hover {
        background: rgba(168, 85, 247, 0.3) !important;
        transform: translateY(-1px) !important;
      }
      .merge-toggle-badge.off {
        background: rgba(148, 163, 184, 0.15) !important;
        color: #94a3b8 !important;
        border-color: rgba(148, 163, 184, 0.3) !important;
      }
      .day-timeline-scale {
        display: flex !important;
        justify-content: space-between !important;
        font-size: 9.5px !important;
        color: var(--muted) !important;
        font-weight: 700 !important;
        padding: 0 1px !important;
        user-select: none !important;
      }
      .day-timeline-rail {
        position: relative !important;
        width: 100% !important;
        height: 20px !important;
        background: rgba(255,255,255,0.05) !important;
        border-radius: 6px !important;
        overflow: hidden !important;
        border: 1px solid var(--line) !important;
      }
      :host([data-theme="light"]) .day-timeline-rail {
        background: rgba(0,0,0,0.04) !important;
      }
      .timeline-trip-segment {
        position: absolute !important;
        top: 2px !important;
        bottom: 2px !important;
        border-radius: 4px !important;
        background: linear-gradient(135deg, #2563eb, #38bdf8) !important;
        cursor: pointer !important;
        transition: all .15s ease !important;
        box-shadow: 0 1px 4px rgba(37,99,235,0.3) !important;
      }
      .timeline-trip-segment:hover, .timeline-trip-segment.selected {
        background: #ff8a18 !important;
        box-shadow: 0 0 10px rgba(255,138,24,0.9) !important;
        z-index: 5 !important;
      }

      /* 2x4 Trip Grid Container & Pagination */
      .trip-grid-container {
        padding: 12px 14px 14px !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        min-height: 340px !important;
      }
      .trip-grid-2x4 {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
      }
      @container (max-width: 500px) {
        .trip-grid-2x4 {
          grid-template-columns: 1fr !important;
          gap: 6px !important;
        }
      }

      /* Sleek Trip Card */
      .sleek-trip-card {
        background: var(--surface, rgba(255,255,255,0.03)) !important;
        border: 1px solid var(--line) !important;
        border-radius: 12px !important;
        padding: 9px 12px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 6px !important;
        cursor: pointer !important;
        transition: all .16s ease !important;
        text-align: left !important;
        position: relative !important;
      }
      :host([data-theme="light"]) .sleek-trip-card {
        background: #ffffff !important;
      }
      .sleek-trip-card:hover {
        border-color: rgba(56, 189, 248, 0.5) !important;
        background: rgba(255,255,255,0.06) !important;
        transform: translateY(-1px) !important;
      }
      :host([data-theme="light"]) .sleek-trip-card:hover {
        background: #f8fafc !important;
      }
      .sleek-trip-card.selected {
        border-color: #ff8a18 !important;
        background: rgba(255, 138, 24, 0.1) !important;
        box-shadow: 0 0 0 1px #ff8a18 !important;
      }

      /* Top Row: Time, Dur & Distance */
      .card-top-row {
        display: flex !important;
        justify-content: space-between !important;
        align-items: baseline !important;
      }
      .card-time {
        font-size: 12px !important;
        font-weight: 750 !important;
        color: var(--ink) !important;
      }
      .card-dur {
        font-size: 11px !important;
        color: var(--muted) !important;
        font-weight: 500 !important;
        margin-left: 4px !important;
      }
      .card-dist {
        font-size: 15px !important;
        font-weight: 850 !important;
        color: var(--ink) !important;
        letter-spacing: -0.3px !important;
        white-space: nowrap !important;
      }
      .card-dist small {
        font-size: 10.5px !important;
        font-weight: 500 !important;
        color: var(--muted) !important;
      }

      /* Badges Row */
      .card-badges-row {
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
        flex-wrap: wrap !important;
      }

      /* Authentic Carrot HA Badges */
      .trip-soc {
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        color: #34d399 !important;
        background: rgba(16, 185, 129, 0.12) !important;
        border: 1px solid rgba(16, 185, 129, 0.28) !important;
        padding: 2.5px 7px !important;
        border-radius: 6px !important;
        letter-spacing: -0.2px !important;
        white-space: nowrap !important;
        line-height: 1.2 !important;
      }
      :host([data-theme="light"]) .trip-soc {
        background: #dcfce7 !important;
        color: #15803d !important;
        border-color: #86efac !important;
      }
      .trip-soc ha-icon {
        --mdc-icon-size: 13px !important;
        width: 13px !important;
        height: 13px !important;
      }
      .trip-soc .soc-used-tag {
        font-size: 10px !important;
        color: #6ee7b7 !important;
        font-weight: 600 !important;
        opacity: 0.95 !important;
        margin-left: 2px !important;
      }
      :host([data-theme="light"]) .trip-soc .soc-used-tag {
        color: #166534 !important;
      }

      .trip-eff {
        display: inline-flex !important;
        align-items: center !important;
        font-weight: 600 !important;
        font-size: 11px !important;
        color: #38bdf8 !important;
        background: rgba(56, 189, 248, 0.12) !important;
        padding: 2.5px 7px !important;
        border-radius: 6px !important;
        border: 1px solid rgba(56, 189, 248, 0.25) !important;
        letter-spacing: -0.2px !important;
        white-space: nowrap !important;
        line-height: 1.2 !important;
        margin-left: 0 !important;
      }
      :host([data-theme="light"]) .trip-eff {
        background: #e0f2fe !important;
        color: #0284c7 !important;
        border-color: #bae6fd !important;
      }

      .trip-merge-badge {
        display: inline-flex !important;
        align-items: center !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        padding: 2px 6px !important;
        border-radius: 6px !important;
        background: rgba(168, 85, 247, 0.15) !important;
        color: #c084fc !important;
        border: 1px solid rgba(168, 85, 247, 0.3) !important;
        white-space: nowrap !important;
        line-height: 1.2 !important;
      }
      :host([data-theme="light"]) .trip-merge-badge {
        background: #f3e8ff !important;
        color: #7e22ce !important;
        border-color: #d8b4fe !important;
      }

      /* Pagination Bar */
      .panel-pagination {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 10px 4px 0 !important;
        margin-top: 10px !important;
        border-top: 1px solid var(--line) !important;
      }
      .page-nav-btn {
        border: 1px solid var(--line) !important;
        background: rgba(255,255,255,0.04) !important;
        color: var(--ink) !important;
        font-size: 11.5px !important;
        font-weight: 700 !important;
        padding: 5px 12px !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        transition: all .15s ease !important;
      }
      :host([data-theme="light"]) .page-nav-btn {
        background: #f1f5f9 !important;
      }
      .page-nav-btn:hover:not(:disabled) {
        background: #2563eb !important;
        color: #fff !important;
        border-color: #3b82f6 !important;
      }
      .page-nav-btn:disabled {
        opacity: 0.3 !important;
        cursor: not-allowed !important;
      }
      .page-indicator-text {
        font-size: 11px !important;
        font-weight: 700 !important;
        color: var(--muted) !important;
      }

      /* Charge History Integrated SoC Pill Badge */
      .charge-soc {
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        background: rgba(16, 185, 129, 0.12) !important;
        border: 1px solid rgba(16, 185, 129, 0.35) !important;
        color: #34d399 !important;
        font-size: 11.5px !important;
        font-weight: 750 !important;
        padding: 2px 8px !important;
        border-radius: 6px !important;
        white-space: nowrap !important;
        line-height: 15px !important;
        flex-shrink: 0 !important;
      }
      :host([data-theme="light"]) .charge-soc {
        background: #d1fae5 !important;
        border-color: #86efac !important;
        color: #047857 !important;
      }
      .charge-soc.retro-mode {
        background: rgba(245, 158, 11, 0.12) !important;
        border-color: rgba(245, 158, 11, 0.35) !important;
        color: #fbbf24 !important;
      }
      :host([data-theme="light"]) .charge-soc.retro-mode {
        background: #fef3c7 !important;
        border-color: #fde68a !important;
        color: #b45309 !important;
      }
      .charge-soc-icon {
        width: 12px !important;
        height: 12px !important;
        fill: currentColor !important;
        display: inline-block !important;
      }

      @media(min-width: 901px) {
        .layout:has(.trip-history) {
          grid-template-columns: minmax(0, 1.15fr) minmax(460px, 1fr) !important;
        }
      }
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

      /* === Vehicle Lock Metric & Charging Power Badges === */
      .energy-head.charging-left {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 16px !important;
      }
      .charge-head-main {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
      }
      .charge-info-stack {
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
      }
      .charge-status-line {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
        margin-bottom: 2px !important;
      }
      .charge-power-tag {
        display: inline-flex !important;
        align-items: center !important;
        font-family: Inter, Pretendard, sans-serif !important;
        font-size: 12.5px !important;
        font-weight: 750 !important;
        letter-spacing: -0.2px !important;
        padding: 2px 8px !important;
        border-radius: 6px !important;
        line-height: 1.2 !important;
        background: rgba(0, 0, 0, 0.35) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.22) !important;
      }
      .charge-power-tag.fast,
      .charge-power-tag.slow {
        background: rgba(0, 0, 0, 0.35) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.22) !important;
      }
      :host([data-theme="light"]) .charge-power-tag,
      :host([data-theme="light"]) .charge-power-tag.fast,
      :host([data-theme="light"]) .charge-power-tag.slow {
        background: rgba(0, 0, 0, 0.35) !important;
        color: #ffffff !important;
        border-color: rgba(255, 255, 255, 0.22) !important;
      }

      /* Charging ETA Metric Card */
      .quick-metrics .metric.charge-eta {
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        min-width: 0 !important;
      }
      .quick-metrics .metric.charge-eta strong {
        font-size: 21px !important;
        font-weight: 750 !important;
        letter-spacing: -0.4px !important;
        line-height: 1.25 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      .quick-metrics .metric.charge-eta .hint {
        font-size: 11px !important;
        font-weight: 550 !important;
        color: #94a3b8 !important;
        margin-top: 6px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        line-height: 1.3 !important;
      }
      :host([data-theme="light"]) .quick-metrics .metric.charge-eta .hint {
        color: #64748b !important;
      }
      @container (max-width: 380px) {
        .quick-metrics .metric.charge-eta strong {
          font-size: 18px !important;
        }
        .quick-metrics .metric.charge-eta .hint {
          font-size: 10px !important;
        }
      }

      /* === Battery Card Range Candidates (Candidate 1 ~ 5) === */

      /* Candidate 1: Inline Divider beside SOC */
      .soc-row-inline {
        display: flex !important;
        align-items: baseline !important;
        gap: 6px !important;
        flex-wrap: wrap !important;
      }
      .range-inline-c1 {
        display: inline-flex !important;
        align-items: baseline !important;
        font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        color: rgba(255, 255, 255, 0.92) !important;
      }
      .range-inline-c1 .range-sep {
        font-size: 22px !important;
        font-weight: 300 !important;
        color: rgba(255, 255, 255, 0.35) !important;
        margin: 0 4px !important;
      }
      .range-inline-c1 .range-val {
        font-size: 22px !important;
        font-weight: 750 !important;
        letter-spacing: -0.4px !important;
        font-variant-numeric: tabular-nums !important;
        color: #ffffff !important;
      }
      .range-inline-c1 .range-unit {
        font-size: 13px !important;
        font-weight: 600 !important;
        color: rgba(255, 255, 255, 0.75) !important;
        margin-left: 2px !important;
      }

      /* Candidate 2: Right-Aligned Capsule Badge */
      .energy-head.range-c2 {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        width: 100% !important;
      }
      .right-stack-c2 {
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
      }
      .range-capsule-c2 {
        background: rgba(0, 0, 0, 0.35) !important;
        border: 1px solid rgba(255, 255, 255, 0.22) !important;
        border-radius: 12px !important;
        padding: 5px 12px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
        backdrop-filter: blur(8px) !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
        flex-shrink: 0 !important;
      }
      .range-capsule-c2 .rc-label {
        font-size: 10.5px !important;
        font-weight: 600 !important;
        color: rgba(255, 255, 255, 0.7) !important;
        letter-spacing: -0.2px !important;
        line-height: 1.1 !important;
      }
      .range-capsule-c2 .rc-val {
        display: flex !important;
        align-items: baseline !important;
        gap: 2px !important;
      }
      .range-capsule-c2 .rc-val b {
        font-size: 18px !important;
        font-weight: 800 !important;
        color: #ffffff !important;
        letter-spacing: -0.3px !important;
        font-variant-numeric: tabular-nums !important;
      }
      .range-capsule-c2 .rc-val small {
        font-size: 11.5px !important;
        font-weight: 600 !important;
        color: rgba(255, 255, 255, 0.75) !important;
      }

      /* Candidate 3: Under-SOC Subtitle Line */
      .soc-stack-c3 {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
      }
      .range-sub-c3 {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        margin-top: 4px !important;
        font-size: 12px !important;
        color: #ffffff !important;
        font-weight: 550 !important;
        letter-spacing: -0.2px !important;
      }
      .range-sub-c3 span,
      .range-sub-c3 b,
      :host([data-theme="light"]) .energy-head .range-sub-c3,
      :host([data-theme="light"]) .energy-head .range-sub-c3 span,
      :host([data-theme="light"]) .energy-head .range-sub-c3 b {
        color: #ffffff !important;
      }
      .range-sub-c3 b {
        font-weight: 750 !important;
      }

      /* Candidate 4: Header Inline Status Chip */
      .range-chip-c4 {
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        padding: 2px 8px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        background: rgba(0, 0, 0, 0.35) !important;
        border: 1px solid rgba(255, 255, 255, 0.22) !important;
        color: #ffffff !important;
        margin-left: 6px !important;
      }
      .range-chip-c4 .rc-chip-icon {
        width: 13px !important;
        height: 13px !important;
        fill: #ffffff !important;
        opacity: 0.85 !important;
      }
      .range-chip-c4 b {
        font-weight: 800 !important;
        font-variant-numeric: tabular-nums !important;
      }

      /* Candidate 5: Instrument Twin Gauge Pill */
      .soc-twin-row-c5 {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
      }
      .range-twin-c5 {
        display: inline-flex !important;
        align-items: center !important;
        gap: 7px !important;
        background: rgba(0, 0, 0, 0.38) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 10px !important;
        padding: 4px 10px !important;
        backdrop-filter: blur(6px) !important;
      }
      .range-twin-c5 .rt-icon {
        font-size: 15px !important;
        line-height: 1 !important;
      }
      .range-twin-c5 .rt-stack {
        display: flex !important;
        flex-direction: column !important;
      }
      .range-twin-c5 .rt-top {
        font-size: 9.5px !important;
        color: rgba(255, 255, 255, 0.65) !important;
        line-height: 1 !important;
        letter-spacing: -0.2px !important;
      }
      .range-twin-c5 .rt-num {
        display: flex !important;
        align-items: baseline !important;
        gap: 2px !important;
        line-height: 1.15 !important;
      }
      .range-twin-c5 .rt-num b {
        font-size: 16px !important;
        font-weight: 800 !important;
        color: #ffffff !important;
        font-variant-numeric: tabular-nums !important;
      }
      .range-twin-c5 .rt-num small {
        font-size: 11px !important;
        font-weight: 600 !important;
        color: rgba(255, 255, 255, 0.75) !important;
      }

      @container (max-width: 380px) {
        .range-inline-c1 .range-val { font-size: 18px !important; }
        .range-inline-c1 .range-sep { font-size: 18px !important; }
        .range-capsule-c2 .rc-val b { font-size: 16px !important; }
        .range-sub-c3 { font-size: 11px !important; }
        .range-chip-c4 { font-size: 11px !important; padding: 1.5px 6px !important; }
        .range-twin-c5 .rt-num b { font-size: 14.5px !important; }
      }

      /* Lock Metric Card General */
      .quick-metrics .metric.lock-metric {
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        position: relative !important;
        overflow: hidden !important;
        transition: all 0.25s ease !important;
        cursor: default !important;
      }
      .quick-metrics .metric.lock-metric ha-icon {
        display: inline-flex !important;
        width: 18px !important;
        height: 18px !important;
        --mdc-icon-size: 18px !important;
      }
      .quick-metrics .metric.lock-metric .label {
        font-size: 12px !important;
        color: var(--muted) !important;
        margin-bottom: 6px !important;
        display: block !important;
      }
      .quick-metrics .metric.lock-metric .lock-val-row {
        display: flex !important;
        align-items: center !important;
        gap: 9px !important;
        margin: 2px 0 6px !important;
      }
      .quick-metrics .metric.lock-metric .lock-icon-badge {
        width: 32px !important;
        height: 32px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 0 !important;
        box-sizing: border-box !important;
        transition: all 0.2s ease !important;
      }
      .quick-metrics .metric.lock-metric .lock-icon-badge ha-icon {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 18px !important;
        height: 18px !important;
        --mdc-icon-size: 18px !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 0 !important;
        transform: translateY(0.75px) !important;
      }
      .quick-metrics .metric.lock-metric .lock-icon-badge ha-icon svg,
      .quick-metrics .metric.lock-metric .lock-icon-badge svg {
        display: block !important;
        width: 18px !important;
        height: 18px !important;
        margin: 0 auto !important;
        padding: 0 !important;
      }
      .quick-metrics .metric.lock-metric .lock-val {
        font-size: 22px !important;
        font-weight: 800 !important;
        letter-spacing: -0.4px !important;
        line-height: 1.2 !important;
        display: inline-block !important;
        margin: 0 !important;
      }
      .quick-metrics .metric.lock-metric .hint {
        font-size: 11px !important;
        font-weight: 550 !important;
        color: var(--muted) !important;
        margin-top: 4px !important;
        line-height: 1.3 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      /* Locked State (잠겨있을 경우): 다른 카드의 중요한 텍스트 색상과 동일 */
      .metric.lock-metric.is-locked .lock-icon-badge {
        background: rgba(255, 255, 255, 0.08) !important;
        color: var(--ink, #ffffff) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.is-locked .lock-icon-badge {
        background: rgba(0, 0, 0, 0.06) !important;
        color: #0f172a !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
      }
      .metric.lock-metric.is-locked .lock-val,
      .metric.lock-metric.is-locked .locked-text {
        color: var(--ink, #ffffff) !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.is-locked .lock-val,
      :host([data-theme="light"]) .metric.lock-metric.is-locked .locked-text {
        color: #0f172a !important;
      }
      .metric.lock-metric.is-locked .hint {
        color: var(--muted) !important;
      }

      /* Unlocked / Door Open (열려있음 일 경우): 충전중(초록)/주차중(파랑) 포인트 색상 */
      .metric.lock-metric.mode-charging.is-unlocked .lock-icon-badge {
        background: rgba(16, 185, 129, 0.16) !important;
        color: #34d399 !important;
        border: 1px solid rgba(52, 211, 153, 0.35) !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.mode-charging.is-unlocked .lock-icon-badge {
        background: #dcfce7 !important;
        color: #15803d !important;
        border: 1px solid rgba(22, 163, 74, 0.35) !important;
      }
      .metric.lock-metric.mode-charging.is-unlocked .lock-val,
      .metric.lock-metric.mode-charging.is-unlocked .unlocked-text {
        color: #34d399 !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.mode-charging.is-unlocked .lock-val,
      :host([data-theme="light"]) .metric.lock-metric.mode-charging.is-unlocked .unlocked-text {
        color: #15803d !important;
      }
      .metric.lock-metric.mode-charging.is-unlocked .hint {
        color: #34d399 !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.mode-charging.is-unlocked .hint {
        color: #15803d !important;
      }

      .metric.lock-metric.mode-parked.is-unlocked .lock-icon-badge {
        background: rgba(56, 189, 248, 0.16) !important;
        color: #38bdf8 !important;
        border: 1px solid rgba(56, 189, 248, 0.35) !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.mode-parked.is-unlocked .lock-icon-badge {
        background: #e0f2fe !important;
        color: #0284c7 !important;
        border: 1px solid rgba(2, 132, 199, 0.35) !important;
      }
      .metric.lock-metric.mode-parked.is-unlocked .lock-val,
      .metric.lock-metric.mode-parked.is-unlocked .unlocked-text {
        color: #38bdf8 !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.mode-parked.is-unlocked .lock-val,
      :host([data-theme="light"]) .metric.lock-metric.mode-parked.is-unlocked .unlocked-text {
        color: #0284c7 !important;
      }
      .metric.lock-metric.mode-parked.is-unlocked .hint {
        color: #38bdf8 !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.mode-parked.is-unlocked .hint {
        color: #0284c7 !important;
      }

      /* Virtual Door Controls in Debug Panel */
      .door-toggle-grid {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 6px !important;
        margin-bottom: 6px !important;
      }
      .door-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        padding: 7px 10px !important;
        font-size: 12px !important;
        font-weight: 650 !important;
        background: #21262d !important;
        color: #c9d1d9 !important;
        border: 1px solid #30363d !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
      }
      .door-btn:hover {
        background: #30363d !important;
        color: #fff !important;
      }
      .door-btn.door-open {
        background: rgba(239, 68, 68, 0.22) !important;
        color: #fca5a5 !important;
        border-color: #ef4444 !important;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.25) !important;
      }
      :host([data-theme="light"]) .door-btn {
        background: #f1f5f9 !important;
        color: #334155 !important;
        border-color: #cbd5e1 !important;
      }
      :host([data-theme="light"]) .door-btn.door-open {
        background: #fee2e2 !important;
        color: #b91c1c !important;
        border-color: #f87171 !important;
      }

      /* Candidate 2: Bold Security Shield & High Visibility */
      .metric.lock-metric.c2 .lock-header-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .metric.lock-metric.c2 ha-icon {
        width: 26px !important;
        height: 26px !important;
        --mdc-icon-size: 26px !important;
      }
      .metric.lock-metric.c2.is-locked ha-icon {
        color: var(--ink, #ffffff) !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.c2.is-locked ha-icon {
        color: #0f172a !important;
      }
      .metric.lock-metric.c2.mode-charging.is-unlocked ha-icon {
        color: #34d399 !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.c2.mode-charging.is-unlocked ha-icon {
        color: #15803d !important;
      }
      .metric.lock-metric.c2.mode-parked.is-unlocked ha-icon {
        color: #38bdf8 !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.c2.mode-parked.is-unlocked ha-icon {
        color: #0284c7 !important;
      }
      .metric.lock-metric.c2 .lock-val {
        font-size: 23px !important;
        letter-spacing: -0.6px !important;
      }

      /* Candidate 3: Smart Mobility Door & Left Accent Stripe */
      .metric.lock-metric.c3 {
        padding-left: 20px !important;
      }
      .metric.lock-metric.c3 .accent-stripe {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 5px;
      }
      .metric.lock-metric.c3 .accent-stripe.locked {
        background: rgba(255, 255, 255, 0.25);
      }
      :host([data-theme="light"]) .metric.lock-metric.c3 .accent-stripe.locked {
        background: rgba(0, 0, 0, 0.2);
      }
      .metric.lock-metric.c3.mode-charging .accent-stripe.unlocked {
        background: linear-gradient(180deg, #10b981 0%, #059669 100%);
      }
      .metric.lock-metric.c3.mode-parked .accent-stripe.unlocked {
        background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%);
      }
      .metric.lock-metric.c3 .lock-top-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .metric.lock-metric.c3.is-locked .lock-top-meta ha-icon {
        color: var(--ink, #ffffff);
      }
      :host([data-theme="light"]) .metric.lock-metric.c3.is-locked .lock-top-meta ha-icon {
        color: #0f172a;
      }
      .metric.lock-metric.c3.mode-charging.is-unlocked .lock-top-meta ha-icon {
        color: #34d399;
      }
      :host([data-theme="light"]) .metric.lock-metric.c3.mode-charging.is-unlocked .lock-top-meta ha-icon {
        color: #15803d;
      }
      .metric.lock-metric.c3.mode-parked.is-unlocked .lock-top-meta ha-icon {
        color: #38bdf8;
      }
      :host([data-theme="light"]) .metric.lock-metric.c3.mode-parked.is-unlocked .lock-top-meta ha-icon {
        color: #0284c7;
      }

      /* Candidate 4: Glassmorphism & Status Pill */
      .metric.lock-metric.c4 {
        background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)) !important;
        border-color: rgba(255,255,255,0.12) !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.c4 {
        background: linear-gradient(145deg, #ffffff, #f1f5f9) !important;
        border-color: #cbd5e1 !important;
      }
      .metric.lock-metric.c4 .glass-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .metric.lock-metric.c4 .status-pill {
        font-size: 10.5px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        gap: 5px;
        letter-spacing: 0.3px;
      }
      .metric.lock-metric.c4 .status-pill.locked {
        background: rgba(255, 255, 255, 0.08);
        color: var(--ink, #ffffff);
      }
      :host([data-theme="light"]) .metric.lock-metric.c4 .status-pill.locked {
        background: rgba(0, 0, 0, 0.06);
        color: #0f172a;
      }
      .metric.lock-metric.c4.mode-charging .status-pill.unlocked {
        background: rgba(16, 185, 129, 0.2);
        color: #34d399;
      }
      :host([data-theme="light"]) .metric.lock-metric.c4.mode-charging .status-pill.unlocked {
        background: #dcfce7;
        color: #15803d;
      }
      .metric.lock-metric.c4.mode-parked .status-pill.unlocked {
        background: rgba(56, 189, 248, 0.2);
        color: #38bdf8;
      }
      :host([data-theme="light"]) .metric.lock-metric.c4.mode-parked .status-pill.unlocked {
        background: #e0f2fe;
        color: #0284c7;
      }

      /* Candidate 5: High-Contrast Alert Guard */
      .metric.lock-metric.c5.is-unlocked {
        background: linear-gradient(145deg, rgba(239, 68, 68, 0.22), rgba(239, 68, 68, 0.08)) !important;
        border: 1.5px solid rgba(239, 68, 68, 0.55) !important;
        box-shadow: 0 0 16px rgba(239, 68, 68, 0.18) !important;
      }
      :host([data-theme="light"]) .metric.lock-metric.c5.is-unlocked {
        background: linear-gradient(145deg, #fff1f2, #ffe4e6) !important;
        border-color: #f87171 !important;
      }
      .metric.lock-metric.c5 .safety-top {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .metric.lock-metric.c5 .safety-icon-circle {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .metric.lock-metric.c5 .safety-icon-circle.safe {
        background: rgba(16, 185, 129, 0.2);
        color: #34d399;
      }
      .metric.lock-metric.c5 .safety-icon-circle.danger {
        background: rgba(239, 68, 68, 0.3);
        color: #f87171;
      }

      /* Battery Card Charging Power Badges */
      .charge-power-badge {
        display: inline-flex;
        align-items: center;
      }

      /* Battery Power Candidate 1: Classic Translucent Pill */
      .charge-power-badge.cp-c1 .cp-pill {
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 999px;
        padding: 6px 14px;
        display: flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
      .charge-power-badge.cp-c1 .cp-bolt {
        font-size: 15px;
        color: #34d399;
      }
      .charge-power-badge.cp-c1 .cp-num {
        font-family: Inter, Pretendard, sans-serif;
        font-size: 22px;
        font-weight: 800;
        color: #ffffff;
        line-height: 1;
      }
      .charge-power-badge.cp-c1 .cp-unit {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.85);
      }
      .charge-power-badge.cp-c1 .cp-tag {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 6px;
        margin-left: 2px;
      }
      .charge-power-badge.cp-c1 .cp-tag.fast {
        background: rgba(56, 189, 248, 0.25);
        color: #7dd3fc;
        border: 1px solid rgba(56, 189, 248, 0.4);
      }
      .charge-power-badge.cp-c1 .cp-tag.slow {
        background: rgba(251, 191, 36, 0.25);
        color: #fde68a;
        border: 1px solid rgba(251, 191, 36, 0.4);
      }

      /* Battery Power Candidate 2: Divider Stack */
      .charge-power-badge.cp-c2 {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .charge-power-badge.cp-c2 .cp-divider {
        width: 1px;
        height: 40px;
        background: rgba(255, 255, 255, 0.22);
      }
      .charge-power-badge.cp-c2 .cp-stack {
        display: flex;
        flex-direction: column;
      }
      .charge-power-badge.cp-c2 .cp-num-row {
        display: flex;
        align-items: baseline;
        gap: 3px;
      }
      .charge-power-badge.cp-c2 .cp-num {
        font-family: Inter, Pretendard, sans-serif;
        font-size: 26px;
        font-weight: 850;
        color: #ffffff;
        line-height: 1;
      }
      .charge-power-badge.cp-c2 .cp-unit {
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.85);
      }
      .charge-power-badge.cp-c2 .cp-sub-label {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 3px;
      }

      /* Battery Power Candidate 3: Neon Chip */
      .charge-power-badge.cp-c3 .cp-neon-chip {
        background: rgba(16, 185, 129, 0.18);
        border: 1px solid rgba(52, 211, 153, 0.5);
        box-shadow: 0 0 10px rgba(52, 211, 153, 0.25);
        border-radius: 12px;
        padding: 6px 12px;
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .charge-power-badge.cp-c3 .cp-text {
        font-family: Inter, Pretendard, sans-serif;
        font-size: 21px;
        font-weight: 800;
        color: #6ee7b7;
      }
      .charge-power-badge.cp-c3 .cp-badge {
        font-size: 10.5px;
        font-weight: 700;
        background: rgba(0, 0, 0, 0.35);
        color: #fff;
        padding: 2px 6px;
        border-radius: 4px;
      }

      /* Battery Power Candidate 4: Telemetry Card Header */
      .charge-power-badge.cp-c4 {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        background: rgba(255, 255, 255, 0.08);
        padding: 6px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .charge-power-badge.cp-c4 .cp-title {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 2px;
      }
      .charge-power-badge.cp-c4 .cp-main {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }
      .charge-power-badge.cp-c4 .cp-val {
        font-family: Inter, Pretendard, sans-serif;
        font-size: 23px;
        font-weight: 800;
        color: #fff;
      }
      .charge-power-badge.cp-c4 .cp-speed {
        font-size: 11px;
        font-weight: 600;
        color: #38bdf8;
        margin-left: 4px;
      }

      /* Battery Power Candidate 5: Digital Instrument Gauge */
      .charge-power-badge.cp-c5 .cp-gauge {
        background: rgba(0, 0, 0, 0.45);
        border: 1.5px solid rgba(52, 211, 153, 0.4);
        border-radius: 14px;
        padding: 7px 14px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .charge-power-badge.cp-c5 .cp-glow {
        color: #34d399;
        font-size: 17px;
      }
      .charge-power-badge.cp-c5 .cp-digital {
        font-family: Inter, Pretendard, sans-serif;
        font-size: 24px;
        font-weight: 900;
        color: #ffffff;
        letter-spacing: -0.5px;
      }
      .charge-power-badge.cp-c5 .cp-kw {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.85);
      }
      .charge-power-badge.cp-c5 .cp-pill-type {
        font-size: 11px;
        font-weight: 700;
        background: #059669;
        color: #fff;
        padding: 2px 7px;
        border-radius: 6px;
        margin-left: 5px;
      }

      /* Mobile adjustment for battery bar power badges */
      @container (max-width: 700px) {
        .energy-head.charging-left {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 10px !important;
        }
        .charge-power-badge {
          align-self: flex-start !important;
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
      if (typeof window !== 'undefined' && window.__updatePreviewToolbar) {
        window.__updatePreviewToolbar(this.state);
      }
    }));

    // Candidate buttons binding
    const updateCandidateBtns = () => {
      root.querySelectorAll('[data-candidate]').forEach(btn => {
        const c = Number(btn.dataset.candidate);
        btn.className = (this.state.candidate || 1) === c ? 'active' : '';
      });
    };
    root.querySelectorAll('[data-candidate]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.candidate = Number(btn.dataset.candidate);
        updateCandidateBtns();
        this.applyDebugTelemetry();
        if (typeof window !== 'undefined' && window.__updatePreviewToolbar) {
          window.__updatePreviewToolbar(this.state);
        }
      });
    });

    // Door lock and virtual door toggles
    const btnLockTrue = root.querySelector('#btnLockTrue');
    const btnLockFalse = root.querySelector('#btnLockFalse');
    const lockVal = root.querySelector('#lockStatusVal');

    const updateDoorsUI = () => {
      const doors = this.state.doors || {};
      const doorKeys = ['driver', 'passenger', 'rear_driver', 'rear_passenger', 'trunk'];
      doorKeys.forEach(k => {
        const btn = root.querySelector(`.door-btn[data-door="${k}"]`);
        if (btn) {
          const isOpen = !!doors[k];
          btn.className = `door-btn ${isOpen ? 'door-open' : ''}`;
          const iconSpan = btn.querySelector('.door-state-icon');
          if (iconSpan) iconSpan.textContent = isOpen ? '🔴' : '⚪';
        }
      });
      updateLockUI();
    };

    const updateLockUI = () => {
      const anyDoorOpen = Object.values(this.state.doors || {}).some(Boolean);
      const isLocked = !anyDoorOpen && (this.state.doors_locked !== false);
      if (btnLockTrue) btnLockTrue.className = isLocked ? 'active' : '';
      if (btnLockFalse) {
        btnLockFalse.className = !isLocked ? 'active charge' : '';
        btnLockFalse.style = !isLocked ? 'background:#dc2626;border-color:#ef4444;' : '';
      }
      if (lockVal) {
        if (anyDoorOpen) {
          const openCount = Object.values(this.state.doors || {}).filter(Boolean).length;
          lockVal.textContent = `🔓 열림 (도어 ${openCount}개 열림)`;
        } else {
          lockVal.textContent = isLocked ? '🔒 잠김 (정상)' : '🔓 열림 (경고)';
        }
      }
    };

    // Range candidate buttons binding
    const updateRangeCandidateBtns = () => {
      root.querySelectorAll('#rangeCandidateBtns [data-range-candidate]').forEach(btn => {
        const rc = Number(btn.dataset.rangeCandidate);
        btn.className = (this.state.rangeCandidate || 1) === rc ? 'active' : '';
      });
    };
    root.querySelectorAll('#rangeCandidateBtns [data-range-candidate]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.rangeCandidate = Number(btn.dataset.rangeCandidate);
        updateRangeCandidateBtns();
        this.applyDebugTelemetry();
        if (typeof window !== 'undefined' && window.__updatePreviewToolbar) {
          window.__updatePreviewToolbar(this.state);
        }
      });
    });

    if (btnLockTrue) {
      btnLockTrue.addEventListener('click', () => {
        this.state.doors_locked = true;
        // When locking, close open doors if any
        if (this.state.doors) {
          Object.keys(this.state.doors).forEach(k => this.state.doors[k] = false);
        }
        updateDoorsUI();
        this.applyDebugTelemetry();
        if (typeof window !== 'undefined' && window.__updatePreviewToolbar) {
          window.__updatePreviewToolbar(this.state);
        }
      });
    }
    if (btnLockFalse) {
      btnLockFalse.addEventListener('click', () => {
        this.state.doors_locked = false;
        updateLockUI();
        this.applyDebugTelemetry();
        if (typeof window !== 'undefined' && window.__updatePreviewToolbar) {
          window.__updatePreviewToolbar(this.state);
        }
      });
    }

    // Door toggle buttons
    root.querySelectorAll('.door-btn[data-door]').forEach(btn => {
      btn.addEventListener('click', () => {
        const doorKey = btn.dataset.door;
        if (!this.state.doors) this.state.doors = {};
        this.state.doors[doorKey] = !this.state.doors[doorKey];
        if (this.state.doors[doorKey]) {
          // If a door is open, vehicle is unlocked
          this.state.doors_locked = false;
        }
        updateDoorsUI();
        this.applyDebugTelemetry();
        if (typeof window !== 'undefined' && window.__updatePreviewToolbar) {
          window.__updatePreviewToolbar(this.state);
        }
      });
    });

    const btnAllDoorsClose = root.querySelector('#btnAllDoorsClose');
    if (btnAllDoorsClose) {
      btnAllDoorsClose.addEventListener('click', () => {
        if (!this.state.doors) this.state.doors = {};
        Object.keys(this.state.doors).forEach(k => this.state.doors[k] = false);
        this.state.doors_locked = true;
        updateDoorsUI();
        this.applyDebugTelemetry();
        if (typeof window !== 'undefined' && window.__updatePreviewToolbar) {
          window.__updatePreviewToolbar(this.state);
        }
      });
    }

    const btnAllDoorsOpen = root.querySelector('#btnAllDoorsOpen');
    if (btnAllDoorsOpen) {
      btnAllDoorsOpen.addEventListener('click', () => {
        if (!this.state.doors) this.state.doors = {};
        Object.keys(this.state.doors).forEach(k => this.state.doors[k] = true);
        this.state.doors_locked = false;
        updateDoorsUI();
        this.applyDebugTelemetry();
        if (typeof window !== 'undefined' && window.__updatePreviewToolbar) {
          window.__updatePreviewToolbar(this.state);
        }
      });
    }

    // Expose method so preview toolbar can sync this component
    this.__syncFromExternal = (newState) => {
      if (typeof newState.candidate === 'number') this.state.candidate = newState.candidate;
      if (typeof newState.rangeCandidate === 'number') this.state.rangeCandidate = newState.rangeCandidate;
      if (typeof newState.doors_locked === 'boolean') this.state.doors_locked = newState.doors_locked;
      if (newState.doors && typeof newState.doors === 'object') {
        this.state.doors = { ...this.state.doors, ...newState.doors };
      }
      if (typeof newState.mode === 'string') this.state.mode = newState.mode;
      updateCandidateBtns();
      updateRangeCandidateBtns();
      updateDoorsUI();
      updateModeBtns();
      this.applyDebugTelemetry();
    };

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

    // Calculation Model Toggle (Smooth vs Instant Curve vs Simple Linear)
    const btnModelSmooth = root.querySelector('#btnModelSmooth');
    const btnModelCurve = root.querySelector('#btnModelCurve');
    const btnModelSimple = root.querySelector('#btnModelSimple');
    const calcModelVal = root.querySelector('#calcModelVal');
    const btnToggleNoise = root.querySelector('#btnToggleNoise');

    const updateModelBtns = () => {
      if (btnModelSmooth) btnModelSmooth.className = (this.state.calcModel === 'smooth' || !this.state.calcModel) ? 'active charge' : '';
      if (btnModelCurve) btnModelCurve.className = this.state.calcModel === 'curve' ? 'active charge' : '';
      if (btnModelSimple) btnModelSimple.className = this.state.calcModel === 'simple' ? 'active' : '';
      if (calcModelVal) {
        calcModelVal.textContent = this.state.calcModel === 'simple'
          ? '기존 단순 선형'
          : this.state.calcModel === 'curve'
          ? 'ID.4 커브 (원시값)'
          : 'ID.4 커브 + 스무딩 (방안 D)';
      }
    };

    if (btnModelSmooth) {
      btnModelSmooth.addEventListener('click', () => {
        this.state.calcModel = 'smooth';
        this.smoothState = null;
        updateModelBtns();
        this.applyDebugTelemetry();
      });
    }

    if (btnModelCurve) {
      btnModelCurve.addEventListener('click', () => {
        this.state.calcModel = 'curve';
        this.smoothState = null;
        updateModelBtns();
        this.applyDebugTelemetry();
      });
    }

    if (btnModelSimple) {
      btnModelSimple.addEventListener('click', () => {
        this.state.calcModel = 'simple';
        this.smoothState = null;
        updateModelBtns();
        this.applyDebugTelemetry();
      });
    }

    if (btnToggleNoise) {
      btnToggleNoise.addEventListener('click', () => {
        this.state.noiseEnabled = !this.state.noiseEnabled;
        btnToggleNoise.className = this.state.noiseEnabled ? 'active charge' : '';
        btnToggleNoise.textContent = this.state.noiseEnabled
          ? '🌊 BMS 전력 변동 시뮬레이션: ON (널뛰기 발생 중)'
          : '🌊 BMS 전력 변동 시뮬레이션: OFF';

        if (this._noiseTimer) {
          clearInterval(this._noiseTimer);
          this._noiseTimer = null;
        }
        if (this.state.noiseEnabled) {
          this._noiseTimer = setInterval(() => {
            if (this.state.mode === 'charging') {
              this.applyDebugTelemetry();
            }
          }, 2000);
        }
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
        this.state.calcModel = 'smooth';
        this.state.noiseEnabled = false;
        this.smoothState = null;
        if (this._noiseTimer) {
          clearInterval(this._noiseTimer);
          this._noiseTimer = null;
        }
        if (btnToggleNoise) {
          btnToggleNoise.className = '';
          btnToggleNoise.textContent = '🌊 BMS 전력 변동 시뮬레이션: OFF';
        }
        if (socSlider) socSlider.value = 74;
        if (socVal) socVal.textContent = '74%';
        updateSocPresetUI(74);
        if (powerSlider) powerSlider.value = 11;
        if (powerVal) powerVal.textContent = '11.0 kW';
        if (sliderValLabel) sliderValLabel.textContent = '11.0 kW';
        updateChargerBtns(11);
        updateModelBtns();
        updateModeBtns();
        this.applyDebugTelemetry();
      });
    }
  }
}
CarrotDebugDashboard.prototype.generateMockBatteryHistory = generateMockBatteryHistory;
