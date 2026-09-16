import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-debug.js', 'utf8');
const context = vm.createContext({
  HTMLElement: class {},
  Date,
  console
});

vm.runInContext(
  source
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

// AC Chargers (3, 7, 11 kW) - curve never bottlenecks these at 50% SOC
for (const p of [3, 7, 11]) {
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

// Check template elements
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

console.log('All charging curve and EVSE preset tests passed successfully!');
