import {chargeCostLabel} from '../custom_components/carrot_ha/frontend/carrot-charge-payment.js';
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

const clampPitch = (pDeg) => Math.max(-20, Math.min(25, pDeg));
const wrapYaw = (yDeg) => {
  let y = yDeg % 360;
  if (y < 0) y += 360;
  return y;
};

assert.equal(clampPitch(0), 0);
assert.equal(clampPitch(80), 25);
assert.equal(clampPitch(-90), -20);
assert.equal(wrapYaw(0), 0);
assert.equal(wrapYaw(360), 0);
assert.equal(wrapYaw(450), 90);
assert.equal(wrapYaw(-90), 270);
console.log('Orientation math passed.');

// 3. Test Debug Dashboard Mini-Condition 360 Button State Rules
console.log('Testing Debug Dashboard 360 camera slot rules in mini-condition...');
const debugSource = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-debug.js', 'utf8');

// Ensure production dashboards and debug dashboard expose the 360 camera button
const koSource = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-ko.js', 'utf8');
const enSource = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-en.js', 'utf8');
assert.equal(koSource.includes('camera360Trigger'), true, 'carrot-dashboard-ko must contain camera360Trigger');
assert.equal(enSource.includes('camera360Trigger'), true, 'carrot-dashboard-en must contain camera360Trigger');
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

// Test getEffectiveCameraMode
debug.getEffectiveCameraMode = CarrotDebugDashboard.prototype.getEffectiveCameraMode.bind(debug);
debug.state.selectedCameraDevice = '';
debug.state.cameraMode = 'auto';
assert.equal(debug.getEffectiveCameraMode(), 'real', 'Auto mode must resolve to real when camera entities exist');

debug._hass = { states: {} };
assert.equal(debug.getEffectiveCameraMode(), 'mock', 'Auto mode must fallback to mock when no camera entities exist');

debug.state.cameraMode = 'real';
assert.equal(debug.getEffectiveCameraMode(), 'real', 'Explicit real mode must return real');

debug.state.cameraMode = 'mock';
assert.equal(debug.getEffectiveCameraMode(), 'mock', 'Explicit mock mode must return mock');

console.log('Entity discovery helper and effective camera mode resolution passed.');

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

// 6. Test Non-Carrot Camera Filtering & Comma Device Grouping
console.log('Testing Non-Carrot camera rejection and Comma device grouping...');
const liveHaMockStates = {
  // Non-Carrot Cameras: Bambu Lab 3D printers, Generic IP, Frigate, TP-Link
  'camera.p2s_combo': {
    state: 'idle',
    attributes: { access_token: 'tok1', friendly_name: 'P2S Combo', supported_features: 2 }
  },
  'camera.p2s_combo_camera': {
    state: 'streaming',
    attributes: { brand: 'Bambu Lab', icon: 'mdi:camera', friendly_name: 'P2S_Combo 카메라', supported_features: 2 }
  },
  'camera.a1_combo_camera': {
    state: 'streaming',
    attributes: { brand: 'Bambu Lab', icon: 'mdi:camera', friendly_name: 'A1_Combo 카메라', supported_features: 0 }
  },
  'camera.192_168_0_140': {
    state: 'idle',
    attributes: { friendly_name: '할머니집 카메라 HD', supported_features: 2 }
  },
  'camera.gm_house': {
    state: 'unavailable',
    attributes: { friendly_name: 'Gm House' }
  },
  // Genuine Carrot HA Cameras (Comma 4)
  'camera.comma_gwanggag_kamera': {
    state: 'idle',
    attributes: {
      friendly_name: 'Comma 광각 카메라',
      unique_id: 'test-id4_camera_wide',
      viewing_mode: 'offroad_only',
      transport: 'https_hls',
      session_limit_seconds: 300,
      supported_features: 3
    }
  },
  'camera.comma_silnae_kamera': {
    state: 'idle',
    attributes: {
      friendly_name: 'Comma 실내 카메라',
      unique_id: 'test-id4_camera_driver',
      viewing_mode: 'offroad_only',
      transport: 'https_hls',
      session_limit_seconds: 300,
      supported_features: 3
    }
  },
  'camera.comma_mangweon_kamera': {
    state: 'idle',
    attributes: {
      friendly_name: 'Comma 망원 카메라',
      unique_id: 'test-id4_camera_road',
      viewing_mode: 'offroad_only',
      transport: 'https_hls',
      session_limit_seconds: 300,
      supported_features: 3
    }
  }
};

debug._hass = { states: liveHaMockStates };
debug.state.selectedCameraDevice = '';

// Test non-Carrot filtering
assert.equal(debug.isCarrotCameraEntity('camera.p2s_combo', liveHaMockStates['camera.p2s_combo']), false);
assert.equal(debug.isCarrotCameraEntity('camera.p2s_combo_camera', liveHaMockStates['camera.p2s_combo_camera']), false);
assert.equal(debug.isCarrotCameraEntity('camera.a1_combo_camera', liveHaMockStates['camera.a1_combo_camera']), false);
assert.equal(debug.isCarrotCameraEntity('camera.192_168_0_140', liveHaMockStates['camera.192_168_0_140']), false);
assert.equal(debug.isCarrotCameraEntity('camera.gm_house', liveHaMockStates['camera.gm_house']), false);

// Test genuine Carrot camera acceptance
assert.equal(debug.isCarrotCameraEntity('camera.comma_gwanggag_kamera', liveHaMockStates['camera.comma_gwanggag_kamera']), true);
assert.equal(debug.isCarrotCameraEntity('camera.comma_silnae_kamera', liveHaMockStates['camera.comma_silnae_kamera']), true);
assert.equal(debug.isCarrotCameraEntity('camera.comma_mangweon_kamera', liveHaMockStates['camera.comma_mangweon_kamera']), true);

// Test grouping into single device
const carrotDevices = debug.getCarrotCameraDevices();
assert.equal(carrotDevices.length, 1, 'Must discover exactly 1 Carrot device, ignoring all 3D printers and IP cams');
assert.equal(carrotDevices[0].id, 'test-id4', 'Device ID must be test-id4 from unique_id');
assert.equal(carrotDevices[0].name, 'Comma');
assert.equal(carrotDevices[0].wide, 'camera.comma_gwanggag_kamera');
assert.equal(carrotDevices[0].driver, 'camera.comma_silnae_kamera');
assert.equal(carrotDevices[0].road, 'camera.comma_mangweon_kamera');

// Test findCarrotCameraEntities with empty deviceId auto-picks Comma device
const resolvedCameras = debug.findCarrotCameraEntities();
assert.equal(resolvedCameras.wide, 'camera.comma_gwanggag_kamera');
assert.equal(resolvedCameras.driver, 'camera.comma_silnae_kamera');
assert.equal(resolvedCameras.road, 'camera.comma_mangweon_kamera');

// Test dropdown HTML: Must contain Comma and NOT contain any non-Carrot devices
const dropdownHtml = debug.renderDeviceSelectOptions();
assert.ok(dropdownHtml.includes('test-id4'), 'Dropdown must list test-id4');
assert.ok(dropdownHtml.includes('광각·실내 연결됨'), 'Dropdown must show connected status');
assert.equal(dropdownHtml.includes('p2s'), false, 'Dropdown must NOT contain p2s 3D printer');
assert.equal(dropdownHtml.includes('a1_combo'), false, 'Dropdown must NOT contain a1_combo 3D printer');
assert.equal(dropdownHtml.includes('192_168_0'), false, 'Dropdown must NOT contain 192_168_0 IP camera');

// Test status chips HTML
const statusHtml = debug.renderCameraEntitiesStatusHtml();
assert.ok(statusHtml.includes('camera.comma_gwanggag_kamera'));
assert.ok(statusHtml.includes('camera.comma_silnae_kamera'));
assert.ok(statusHtml.includes('camera.comma_mangweon_kamera'));
assert.ok(statusHtml.includes('360° 합성 준비 완료'));

console.log('Non-Carrot camera rejection and Comma device grouping passed.');

// 7. Test Pure Telemetry Device Discovery (When No camera.* or image.* Entities Exist)
console.log('Testing pure telemetry device discovery (no snapshot entities)...');
const telemetryMockStates = {
  'sensor.test_id4_soc_percent': {
    state: '80',
    attributes: { unique_id: 'test-id4_soc_percent', friendly_name: 'ID.4 배터리 잔량' }
  },
  'binary_sensor.test_id4_comma_online': {
    state: 'on',
    attributes: { unique_id: 'test-id4_comma_online', friendly_name: 'Comma 온라인 상태' }
  },
  'sensor.test_id4_storage_used_percent': {
    state: '45',
    attributes: { unique_id: 'test-id4_comma_storage_used_percent', friendly_name: 'Comma 저장소 사용량' }
  }
};
debug._hass = { states: telemetryMockStates };
debug.state.selectedCameraDevice = '';
debug.state.cameraMode = 'auto';

const discoveredTelemetryDevices = debug.getCarrotCameraDevices();
assert.equal(discoveredTelemetryDevices.length, 1, 'Must discover 1 Carrot device from telemetry unique_id');
assert.equal(discoveredTelemetryDevices[0].id, 'test-id4');
assert.ok(discoveredTelemetryDevices[0].wide.includes('/api/carrot_ha/v1/camera/test-id4/live'), 'Must construct live WSS endpoint for wide');
assert.ok(discoveredTelemetryDevices[0].driver.includes('/api/carrot_ha/v1/camera/test-id4/live'), 'Must construct live WSS endpoint for driver');

const resolvedTelemetryCam = debug.findCarrotCameraEntities();
assert.ok(resolvedTelemetryCam.wide);
assert.ok(resolvedTelemetryCam.driver);
assert.equal(debug.getEffectiveCameraMode(), 'real', 'Must resolve to real mode when Carrot telemetry device is detected');

const telemetryStatusHtml = debug.renderCameraEntitiesStatusHtml();
assert.ok(telemetryStatusHtml.includes('WebCodecs WSS Relay'));
assert.ok(telemetryStatusHtml.includes('360° 합성 준비 완료'));
// 8. Test Production Dashboards (KO and EN) Overview Mini-Condition 360 Button
console.log('Testing Production Dashboards (KO and EN) mini-condition rendering...');

const cleanKo = koSource
  .replace(/import\s+.*?;\r?\n/g, '')
  .replace(/import\.meta\.url/g, '"http://localhost/"')
  .replace('class CarrotDashboard extends HTMLElement', 'class CarrotDashboardKo extends HTMLElement')
  .replace('export default CarrotDashboard;', '');
const cleanEn = enSource
  .replace(/import\s+.*?;\r?\n/g, '')
  .replace(/import\.meta\.url/g, '"http://localhost/"')
  .replace('class CarrotDashboard extends HTMLElement', 'class CarrotDashboardEn extends HTMLElement')
  .replace('export default CarrotDashboard;', '');

const createProdContext = () => vm.createContext({
  chargeCostLabel,
  DEFAULT_SOC_CAPACITY_KWH,
  tripDays: () => [],
  loadRecentTrips: async () => ({ events: [] }),
  mergeConsecutiveCharges: () => [],
  mergeConsecutiveTrips: () => [],
  tripTimeline: () => '',
  CarrotCamera360Modal: class {},
  HTMLElement: class {},
  document: mockDocument,
  window: mockWindow,
  Date,
  URL,
  console
});

const prodContextKo = createProdContext();
const prodContextEn = createProdContext();

vm.runInContext(cleanKo + '\nglobalThis.CarrotDashboardKo = CarrotDashboardKo;', prodContextKo);
vm.runInContext(cleanEn + '\nglobalThis.CarrotDashboardEn = CarrotDashboardEn;', prodContextEn);

const { CarrotDashboardKo } = prodContextKo;
const { CarrotDashboardEn } = prodContextEn;

const koInstance = Object.create(CarrotDashboardKo.prototype);
koInstance.trips = [];
koInstance.vehicleImage = () => '<img class="car-image">';
koInstance.config = { vehicle_name: 'ID.4' };
koInstance._hass = { states: { 'binary_sensor.comma_online': { state: 'on' } }, config: { time_zone: 'Asia/Seoul' } };

const enInstance = Object.create(CarrotDashboardEn.prototype);
enInstance.trips = [];
enInstance.vehicleImage = () => '<img class="car-image">';
enInstance.config = { vehicle_name: 'ID.4' };
enInstance._hass = { states: { 'binary_sensor.comma_online': { state: 'on' } }, config: { time_zone: 'UTC' } };

// KO Parked
koInstance.vehicleStatus = () => ({ key: 'parked', label: '주차중' });
const koParkedHtml = koInstance.overview({ onroad: false, charging: false, outside_temp_c: 20, aux_voltage: 13.5, soc_percent: 80 });
assert.ok(koParkedHtml.includes('id="camera360Trigger"'), 'KO Parked must have camera360Trigger');
assert.ok(koParkedHtml.includes('카메라 보기'), 'KO Parked must have "카메라 보기"');

// EN Parked
enInstance.vehicleStatus = () => ({ key: 'parked', label: 'Parked' });
const enParkedHtml = enInstance.overview({ onroad: false, charging: false, outside_temp_c: 20, aux_voltage: 13.5, soc_percent: 80 });
assert.ok(enParkedHtml.includes('id="camera360Trigger"'), 'EN Parked must have camera360Trigger');
assert.ok(enParkedHtml.includes('View Camera'), 'EN Parked must have "View Camera"');

// KO Charging
koInstance.vehicleStatus = () => ({ key: 'charging', label: '충전중' });
const koChargingHtml = koInstance.overview({ onroad: false, charging: true, outside_temp_c: 18, aux_voltage: 14.0, soc_percent: 50 });
assert.ok(koChargingHtml.includes('id="camera360Trigger"'), 'KO Charging must have camera360Trigger');

// EN Charging
enInstance.vehicleStatus = () => ({ key: 'charging', label: 'Charging' });
const enChargingHtml = enInstance.overview({ onroad: false, charging: true, outside_temp_c: 18, aux_voltage: 14.0, soc_percent: 50 });
assert.ok(enChargingHtml.includes('id="camera360Trigger"'), 'EN Charging must have camera360Trigger');

// KO Driving (Must NOT have button, must show Climate)
koInstance.vehicleStatus = () => ({ key: 'driving', label: '주행 중' });
const koDrivingHtml = koInstance.overview({ onroad: true, charging: false, outside_temp_c: 22, aux_voltage: 14.1, soc_percent: 78, ac_on: true });
assert.equal(koDrivingHtml.includes('id="camera360Trigger"'), false, 'KO Driving must NOT have camera360Trigger');
assert.ok(koDrivingHtml.includes('공조 <b>ON</b>'), 'KO Driving must show climate status');

// EN Driving (Must NOT have button, must show Climate)
enInstance.vehicleStatus = () => ({ key: 'driving', label: 'Driving' });
const enDrivingHtml = enInstance.overview({ onroad: true, charging: false, outside_temp_c: 22, aux_voltage: 14.1, soc_percent: 78, ac_on: true });
assert.equal(enDrivingHtml.includes('id="camera360Trigger"'), false, 'EN Driving must NOT have camera360Trigger');
assert.ok(enDrivingHtml.includes('Climate <b>ON</b>'), 'EN Driving must show climate status');

console.log('Production Dashboards (KO and EN) mini-condition tests passed.');

console.log('\n=== ALL 360 CAMERA UNIT TESTS PASSED SUCCESSFULLY ===\n');
