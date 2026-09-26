import {mergeConsecutiveTrips, tripTimeline} from '../custom_components/carrot_ha/frontend/carrot-trip-days.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-debug.js', 'utf8');
const context = vm.createContext({mergeConsecutiveTrips, tripTimeline,
  HTMLElement: class {},
  Date,
  console
});

vm.runInContext(
  source
    .replace(/^import .*;\r?\n/m, '')
    .replace('export const DEBUG_FRESHNESS', 'const DEBUG_FRESHNESS')
    .replace('export const DEBUG_MODES', 'const DEBUG_MODES')
    .replace('export function debugDisplay', 'function debugDisplay')
    .replace('export default class CarrotDebugDashboard', 'class CarrotDebugDashboard') +
    '\nglobalThis.api = { debugDisplay, CarrotDebugDashboard, estimateChargingTimesWithCurve, ID4_CHARGING_CURVE_KW };',
  context
);

const { estimateChargingTimesWithCurve, ID4_CHARGING_CURVE_KW, CarrotDebugDashboard } = context.api;

console.log('Testing ID.4 charging curve points...');
// Curve data check
assert.equal(ID4_CHARGING_CURVE_KW.length, 101);
assert.equal(ID4_CHARGING_CURVE_KW[20], 192.4);
assert.equal(ID4_CHARGING_CURVE_KW[50], 107.0);
assert.equal(ID4_CHARGING_CURVE_KW[74], 91.8);
assert.equal(ID4_CHARGING_CURVE_KW[80], 90.8);
assert.equal(ID4_CHARGING_CURVE_KW[85], 79.1);
assert.equal(ID4_CHARGING_CURVE_KW[95], 46.8);

console.log('Testing EVSE charger presets & bottleneck behavior...');

// AC Chargers (1, 3, 7, 11 kW) - curve never bottlenecks these at 50% SOC
for (const p of [1, 3, 7, 11]) {
  const res = estimateChargingTimesWithCurve(50, p, 77);
  assert.equal(res.effectiveKw, p, `AC charger ${p}kW should not be throttled at 50%`);
}

// DC 350kW Charger:
// At 20% SOC: car peak is 192.4 kW < 350 kW -> effectiveKw = 192.4
const res20_350 = estimateChargingTimesWithCurve(20, 350, 77);
assert.equal(res20_350.effectiveKw, 192.4);

// At 74% SOC: car peak is 91.8 kW < 350 kW -> effectiveKw = 91.8
const res74_350 = estimateChargingTimesWithCurve(74, 350, 77);
assert.equal(res74_350.effectiveKw, 91.8);

// At 95% SOC: car peak is 46.8 kW
// With 50kW charger -> car gets 46.8 kW (bottlenecked by car)
const res95_50 = estimateChargingTimesWithCurve(95, 50, 77);
assert.equal(res95_50.effectiveKw, 46.8);

// With 11kW AC charger -> car gets 11 kW (bottlenecked by charger)
const res95_11 = estimateChargingTimesWithCurve(95, 11, 77);
assert.equal(res95_11.effectiveKw, 11.0);

// At 100% SOC -> 0 kW
const res100 = estimateChargingTimesWithCurve(100, 350, 77);
assert.equal(res100.effectiveKw, 0);

console.log('Testing time calculations: curve integration vs simple linear...');
// At 20% SOC with 100kW charger:
const res20_100 = estimateChargingTimesWithCurve(20, 100, 77, Date.now(), 'curve');
assert.ok(res20_100.sec80 > 0 && res20_100.sec80 < 3600);
assert.ok(res20_100.sec100 > res20_100.sec80);
assert.ok(res20_100.sec100 > res20_100.simpleSec100, 'Curve taper should make 100% take longer than simple linear');

console.log('Testing simulated debug dashboard state & telemetry generation...');
const debug = Object.create(CarrotDebugDashboard.prototype);
debug.state = { mode: 'charging', soc: 74, powerKw: 350, lang: 'ko', calcModel: 'curve' };
debug.dashCard = { v: {}, render() {} };
debug.shadowRoot = { querySelector() { return null; }, querySelectorAll() { return []; } };
debug.updateInspectorReadout = () => {};

debug.applyDebugTelemetry();
assert.equal(debug.dashCard.v.charger_max_kw, 350);
assert.equal(debug.dashCard.v.charge_power_kw, 91.8);
assert.equal(debug.dashCard.v.charge_power_w, 91800);
assert.equal(debug.dashCard.v.charging, true);
assert.equal(debug.dashCard.v.emergency_charging, false);

// Test 1kW Emergency Charging mode
debug.state.powerKw = 1;
debug.applyDebugTelemetry();
assert.equal(debug.dashCard.v.charger_max_kw, 1);
assert.equal(debug.dashCard.v.charge_power_kw, 1.0);
assert.equal(debug.dashCard.v.charge_power_w, 1000);
assert.equal(debug.dashCard.v.emergency_charging, true);

// Test when vehicle state is stale, emergency_charging should not be active
debug.state.mode = 'stale';
debug.applyDebugTelemetry();
assert.equal(debug.dashCard.v.debug_raw.emergency_charging, false);

// Restore charging mode
debug.state.mode = 'charging';
debug.state.powerKw = 7;
debug.applyDebugTelemetry();
assert.equal(debug.dashCard.v.emergency_charging, false);

console.log('Testing Option D 3-stage smoothing and jitter suppression...');
const t0 = 1720000000000;
// 1. Initial 7kW charging at 50% SOC
const initSmooth = estimateChargingTimesWithCurve(50, 7.0, 70.8, t0, 'smooth', null);
assert.ok(initSmooth.sec100 > 0, 'Initial smooth sec100 should be calculated');
assert.equal(initSmooth.powerSmooth, 7.0, 'Initial powerSmooth should equal raw power');

// 2. BMS quantization noise: power dips to 4.8 kW 120 seconds later
const t1 = t0 + 120000;
const rawDip = estimateChargingTimesWithCurve(50, 4.8, 70.8, t1, 'curve');
const smoothDip = estimateChargingTimesWithCurve(50, 4.8, 70.8, t1, 'smooth', initSmooth.smoothState);

// Raw calculation causes a jump of over 2 hours (> 7000 seconds)
const rawJumpSec = Math.abs(rawDip.sec100 - initSmooth.sec100);
assert.ok(rawJumpSec > 7000, `Raw jump should be > 2 hours, was ${rawJumpSec}s`);

// Smoothed calculation clamps ETA shift to at most slewMaxSec (180s = 3 minutes)
const expectedNaturalCountdownSec = initSmooth.sec100 - 120;
const smoothShiftSec = Math.abs(smoothDip.sec100 - expectedNaturalCountdownSec);
assert.ok(smoothShiftSec <= 180, `Smoothed shift should be clamped <= 180s (3 min), was ${smoothShiftSec}s`);
assert.ok(smoothDip.powerSmooth > 6.0 && smoothDip.powerSmooth < 7.0, 'Power EMA should smoothly filter the dip');

// 3. BMS quantization noise: power surges to 8.2 kW 120 seconds later
const t2 = t1 + 120000;
const smoothSurge = estimateChargingTimesWithCurve(50, 8.2, 70.8, t2, 'smooth', smoothDip.smoothState);
const expectedNaturalCountdownSec2 = smoothDip.sec100 - 120;
const smoothShiftSec2 = Math.abs(smoothSurge.sec100 - expectedNaturalCountdownSec2);
assert.ok(smoothShiftSec2 <= 180, `Smoothed shift on surge should be clamped <= 180s, was ${smoothShiftSec2}s`);

// Check template elements
assert.ok(source.includes('data-charger="1"'));
assert.ok(source.includes('비상충전중'));
assert.ok(source.includes('data-charger="3"'));
assert.ok(source.includes('data-charger="7"'));
assert.ok(source.includes('data-charger="11"'));
assert.ok(source.includes('data-charger="50"'));
assert.ok(source.includes('data-charger="100"'));
assert.ok(source.includes('data-charger="350"'));
assert.ok(source.includes('data-charger="500"'));
assert.ok(source.includes('max="500.0"'));
assert.ok(source.includes('id="effectiveIntakeVal"'));
assert.ok(source.includes('id="inspectCharger"'));
assert.ok(source.includes('id="inspectEffective"'));
assert.ok(source.includes('id="inspectEmergency"'));
assert.ok(source.includes('id="btnModelSmooth"'));
assert.ok(source.includes('id="btnToggleNoise"'));
assert.ok(source.includes('BMS 전력 변동 시뮬레이션'));

console.log('All charging curve, EVSE presets, and Option D smoothing tests passed successfully!');
