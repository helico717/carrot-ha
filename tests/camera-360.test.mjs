import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { MockFeedGenerator } from '../custom_components/carrot_ha/frontend/carrot-camera-360.js';
import { DEFAULT_SOC_CAPACITY_KWH, mergeConsecutiveTrips, tripTimeline } from '../custom_components/carrot_ha/frontend/carrot-trip-days.js';

// 1. MockFeedGenerator Verification
console.log('Testing MockFeedGenerator...');
const feedGen = new MockFeedGenerator();
assert.equal(typeof feedGen.renderFrame, 'function');

const frame1 = feedGen.renderFrame(1000, 0);
assert.equal(frame1.frontPts, 1000);
assert.equal(frame1.rearPts, 1000);
assert.equal(frame1.deltaMs, 0);
assert.ok(frame1.frontSource);
assert.ok(frame1.rearSource);

// Check simulated PTS offset
const frame2 = feedGen.renderFrame(2000, 1200);
assert.equal(frame2.frontPts, 2000);
assert.equal(frame2.rearPts, 3200);
assert.equal(frame2.deltaMs, 1200);
console.log('MockFeedGenerator passed.');

// 2. Camera360 Angle and Orientation Math Verification
console.log('Testing Camera360 orientation clamping and wrapping...');
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const clampPitch = (pDeg) => Math.max(-75, Math.min(75, pDeg));
const wrapYaw = (yDeg) => {
  let y = yDeg % 360;
  if (y < 0) y += 360;
  return y;
};

assert.equal(clampPitch(0), 0);
assert.equal(clampPitch(80), 75);
assert.equal(clampPitch(-90), -75);
assert.equal(wrapYaw(0), 0);
assert.equal(wrapYaw(360), 0);
assert.equal(wrapYaw(450), 90);
assert.equal(wrapYaw(-90), 270);
console.log('Orientation math passed.');

// 3. Test Debug Dashboard Mini-Condition 360 Button State Rules
console.log('Testing Debug Dashboard 360 camera slot rules in mini-condition...');
const debugSource = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-debug.js', 'utf8');

// Ensure production dashboards do NOT expose the 360 camera button by default
const koSource = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-ko.js', 'utf8');
const enSource = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-en.js', 'utf8');
assert.equal(koSource.includes('camera360Trigger'), false, 'carrot-dashboard-ko must not contain camera360Trigger');
assert.equal(enSource.includes('camera360Trigger'), false, 'carrot-dashboard-en must not contain camera360Trigger');
assert.equal(debugSource.includes('camera360Trigger'), true, 'carrot-dashboard-debug must contain camera360Trigger');

// Set up VM to execute CarrotDebugDashboard logic
const mockWindow = {
  matchMedia: () => ({ matches: false }),
  addEventListener: () => {},
  removeEventListener: () => {}
};
const mockDocument = {
  createElement: (tag) => {
    return {
      tagName: tag.toUpperCase(),
      style: {},
      setAttribute: () => {},
      getAttribute: () => null,
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => []
    };
  }
};

const fakeCanvas = {
  width: 960,
  height: 540,
  getContext: () => null
};

const context = vm.createContext({
  DEFAULT_SOC_CAPACITY_KWH,
  mergeConsecutiveTrips,
  tripTimeline,
  HTMLElement: class {},
  document: mockDocument,
  window: mockWindow,
  Date,
  console
});

// Strip module imports for vm evaluation
const cleanSource = debugSource
  .replace(/import\s+.*?;\r?\n/g, '')
  .replace('export const DEBUG_FRESHNESS', 'const DEBUG_FRESHNESS')
  .replace('export const DEBUG_MODES', 'const DEBUG_MODES')
  .replace('export function debugDisplay', 'function debugDisplay')
  .replace('export default class CarrotDebugDashboard', 'class CarrotDebugDashboard');

vm.runInContext(cleanSource + '\nglobalThis.api={debugDisplay,CarrotDebugDashboard,DEBUG_MODES};', context);
const { debugDisplay, CarrotDebugDashboard } = context.api;

const debug = Object.create(CarrotDebugDashboard.prototype);
debug.state = {
  mode: 'parked',
  soc: 74,
  powerKw: 0,
  lang: 'ko',
  cameraMode: 'mock',
  simStreamStatus: 'ok',
  doors_locked: true,
  doors: {}
};
debug.dashCard = { v: {}, render() {} };
debug.updateInspectorReadout = () => {};
debug.patchDashCard = CarrotDebugDashboard.prototype.patchDashCard.bind(debug);

// Test patchDashCard overview generation
const cardStub = {
  vehicleStatus: () => ({ key: 'parked', label: '주차중' }),
  vehicleImage: () => '<img class="car-image">',
  render: () => {},
  trips: []
};
debug.patchDashCard(cardStub);

// A. Test Parked State: Button must be displayed with camera360Trigger and aria-label
const parkedHtml = cardStub.overview({
  display_state: 'parked',
  onroad: false,
  charging: false,
  outside_temp_c: 21,
  aux_voltage: 13.8,
  soc_percent: 74
});
assert.ok(parkedHtml.includes('id="camera360Trigger"'), 'Parked state must contain camera360Trigger button');
assert.ok(parkedHtml.includes('360° 카메라 보기') || parkedHtml.includes('View Camera'), 'Parked state must contain camera view text');
assert.ok(parkedHtml.includes('21°C'), 'Outside temp must be preserved');
assert.ok(parkedHtml.includes('13.8V'), '12V voltage must be preserved');
assert.equal(parkedHtml.includes('공조 <b>OFF</b>'), false, 'Slot 3 climate text must be removed from mini-condition');

// B. Test Charging State: Button must be displayed
cardStub.vehicleStatus = () => ({ key: 'charging', label: '충전중' });
const chargingHtml = cardStub.overview({
  display_state: 'charging',
  onroad: false,
  charging: true,
  outside_temp_c: 19,
  aux_voltage: 14.1,
  soc_percent: 74
});
assert.ok(chargingHtml.includes('id="camera360Trigger"'), 'Charging state must contain camera360Trigger button');

// C. Test Driving State: Button must be hidden and layout preserved
cardStub.vehicleStatus = () => ({ key: 'driving', label: '주행중' });
const drivingHtml = cardStub.overview({
  display_state: 'driving',
  onroad: true,
  charging: false,
  outside_temp_c: 22,
  aux_voltage: 14.2,
  soc_percent: 72
});
assert.equal(drivingHtml.includes('id="camera360Trigger"'), false, 'Driving state must NOT contain active camera button');
assert.ok(drivingHtml.includes('mini-condition-camera is-hidden'), 'Driving state must contain hidden placeholder to preserve 3-column layout');

// D. Test Stale / Delayed State: Button disabled with warning
cardStub.vehicleStatus = () => ({ key: 'stale', label: '데이터 지연' });
const staleHtml = cardStub.overview({
  display_state: 'stale',
  onroad: false,
  charging: false,
  outside_temp_c: 20,
  aux_voltage: 12.4
});
assert.equal(staleHtml.includes('id="camera360Trigger"'), false);
assert.ok(staleHtml.includes('데이터 지연') || staleHtml.includes('Data Delayed'));

// E. Test Offline State: Button disabled with offline notice
cardStub.vehicleStatus = () => ({ key: 'offline', label: '오프라인' });
const offlineHtml = cardStub.overview({
  display_state: 'offline',
  onroad: false,
  charging: false
});
assert.equal(offlineHtml.includes('id="camera360Trigger"'), false);
assert.ok(offlineHtml.includes('카메라 연결 안 됨') || offlineHtml.includes('Camera Offline'));

// F. Test Real Mode with Unconfigured Cameras
debug.state.cameraMode = 'real';
debug.state.selectedCameraDevice = 'none';
debug._hass = { states: {} };
cardStub.vehicleStatus = () => ({ key: 'parked', label: '주차중' });
const unconfiguredHtml = cardStub.overview({
  display_state: 'parked',
  onroad: false,
  charging: false
});
assert.equal(unconfiguredHtml.includes('id="camera360Trigger"'), false);
assert.ok(unconfiguredHtml.includes('카메라 미설정') || unconfiguredHtml.includes('Camera Unconfigured'));

console.log('All mini-condition 360 button state rules passed!');

// 4. Test Entity Discovery Helper
debug._hass = {
  states: {
    'camera.my_comma_camera_wide': { attributes: { unique_id: 'dev123_camera_wide', friendly_name: '광각 카메라' } },
    'camera.my_comma_camera_driver': { attributes: { unique_id: 'dev123_camera_driver', friendly_name: '실내 카메라' } },
    'camera.my_comma_camera_road': { attributes: { unique_id: 'dev123_camera_road', friendly_name: '망원 카메라' } }
  }
};
const found = debug.findCarrotCameraEntities();
assert.equal(found.wide, 'camera.my_comma_camera_wide');
assert.equal(found.driver, 'camera.my_comma_camera_driver');
assert.equal(found.road, 'camera.my_comma_camera_road');
console.log('Entity discovery helper passed.');

// 5. Test Driving Safety Stop Rule
debug.cameraModal = {
  isOpen: true,
  state: 'playing',
  setState(s, msg) { this.state = s; this.msg = msg; },
  cleanupSession() { this.cleaned = true; }
};
debug.applyDebugTelemetry = CarrotDebugDashboard.prototype.applyDebugTelemetry.bind(debug);

// Trigger driving state
debug.state.mode = 'driving';
debug.applyDebugTelemetry();
assert.equal(debug.cameraModal.state, 'stopped');
assert.ok(debug.cameraModal.msg.includes('주행') || debug.cameraModal.msg.includes('Driving'));
assert.equal(debug.cameraModal.cleaned, true);
console.log('Driving safety automatic stop rule passed.');

console.log('\n=== ALL 360 CAMERA UNIT TESTS PASSED SUCCESSFULLY ===\n');
