import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const koPath = path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-ko.js');
const enPath = path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-en.js');
const debugPath = path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-debug.js');
const vehiclePath = path.resolve('custom_components/carrot_ha/vehicle.py');

const koContent = fs.readFileSync(koPath, 'utf8');
const enContent = fs.readFileSync(enPath, 'utf8');
const debugContent = fs.readFileSync(debugPath, 'utf8');
const vehicleContent = fs.readFileSync(vehiclePath, 'utf8');

// 1. Verify Range Candidate 3 (C3): no dot, pure white color
for (const [name, content] of [['Korean', koContent], ['English', enContent], ['Debug', debugContent]]) {
  assert.ok(
    content.includes('range-sub-c3'),
    `${name} must contain range-sub-c3`
  );
  assert.ok(
    !content.includes('rs-dot'),
    `${name} must NOT contain .rs-dot`
  );
}

// Check white styling for range-sub-c3
assert.ok(
  koContent.includes('.range-sub-c3 span,.range-sub-c3 b') && koContent.includes('color:#ffffff !important'),
  'Korean dashboard must set range-sub-c3 text to #ffffff !important'
);
assert.ok(
  enContent.includes('.range-sub-c3 span,.range-sub-c3 b') && enContent.includes('color:#ffffff !important'),
  'English dashboard must set range-sub-c3 text to #ffffff !important'
);
assert.ok(
  debugContent.includes('.range-sub-c3 span,') && debugContent.includes('color: #ffffff !important'),
  'Debug dashboard must set range-sub-c3 text to #ffffff !important'
);

// 2. Verify Fast Charging threshold is strictly > 11 kW
assert.ok(
  /powerKw\s*>\s*11/.test(koContent) || /power_kw\s*>\s*11/.test(koContent),
  'Korean dashboard must use > 11 for fast charging'
);
assert.ok(
  /powerKw\s*>\s*11/.test(enContent) || /power_kw\s*>\s*11/.test(enContent),
  'English dashboard must use > 11 for fast charging'
);
assert.ok(
  debugContent.includes('powerKw > 11'),
  'Debug dashboard must use powerKw > 11 for fast charging'
);
assert.ok(
  vehicleContent.includes('power_kw > 11'),
  'vehicle.py must use power_kw > 11 for fast charging'
);

// 3. Verify ID.4 BMS capacity baseline is 78.0 kWh
assert.ok(
  debugContent.includes('const BMS_CAPACITY = 78.0;'),
  'Debug dashboard must define BMS_CAPACITY = 78.0 baseline'
);

// 4. Verify phantom 18.2kWh fallback is removed
assert.ok(
  !debugContent.includes('currentKwh - 18.2'),
  'Debug dashboard must not pre-subtract 18.2kWh on session start'
);
assert.ok(
  !debugContent.includes('card.charges?.[0]'),
  'Debug dashboard overview must not use past completed charges as current session'
);

// 5. Verify offline lastGood preserves lock, open_doors, and estimated_range_km
import vm from 'node:vm';
const vmContext = vm.createContext({ HTMLElement: class {}, Date, console });
vm.runInContext(
  debugContent
    .replace('export const DEBUG_FRESHNESS', 'const DEBUG_FRESHNESS')
    .replace('export const DEBUG_MODES', 'const DEBUG_MODES')
    .replace('export function debugDisplay', 'function debugDisplay')
    .replace('export default class CarrotDebugDashboard', 'class CarrotDebugDashboard') +
    '\nglobalThis.debugDisplay = debugDisplay;',
  vmContext
);
const debugDisplay = vmContext.debugDisplay;

const healthyRaw = {
  measured_at: new Date(Date.now() - 30000).toISOString(),
  last_received: new Date(Date.now() - 30000).toISOString(),
  last_sync: new Date(Date.now() - 30000).toISOString(),
  charging: true,
  doors_locked: true,
  open_doors: [],
  estimated_range_km: 340,
};
const liveResult = debugDisplay(healthyRaw, Date.now(), null);
assert.equal(liveResult.display_state, 'charging');
assert.equal(liveResult.doors_locked, true);
assert.equal(liveResult.estimated_range_km, 340);

const offlineRaw = {
  measured_at: new Date(Date.now() - 400000).toISOString(),
  last_received: new Date(Date.now() - 400000).toISOString(),
  last_sync: new Date(Date.now() - 30000).toISOString(),
  charging: false,
  doors_locked: false,
  open_doors: ['Driver door'],
  estimated_range_km: 999,
};
const offlineResult = debugDisplay(offlineRaw, Date.now(), liveResult);
assert.equal(offlineResult.display_state, 'offline');
assert.equal(offlineResult.doors_locked, true, 'doors_locked must be preserved from lastGood when offline');
assert.deepEqual(offlineResult.open_doors, [], 'open_doors must be preserved from lastGood when offline');
assert.equal(offlineResult.estimated_range_km, 340, 'estimated_range_km must be preserved from lastGood when offline');

// 6. Verify default range candidate is 3
assert.ok(
  debugContent.includes('rangeCandidate: 3'),
  'Debug dashboard default range candidate must be 3'
);

// 7. Verify quick metric card labels in English dashboard
assert.ok(enContent.includes('Vehicle Lock Status'), 'English card must have Vehicle Lock Status');
assert.ok(enContent.includes('Real-time Charge Cost'), 'English card must have Real-time Charge Cost');
assert.ok(enContent.includes('Charged this month'), 'English card must have Charged this month');
assert.ok(enContent.includes('Total Odometer'), 'English card must have Total Odometer');
assert.ok(enContent.includes('Charge cost this month'), 'English card must have Charge cost this month');

// 8. Verify Lock Icon Badge alignment and centering across all dashboards
const manifestPath = path.resolve('custom_components/carrot_ha/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.version, '0.6.10', 'manifest.json version must be 0.6.10');

for (const [name, content] of [['Korean', koContent], ['English', enContent], ['Debug', debugContent]]) {
  assert.ok(
    /\.lock-icon-badge\s*\{[^}]*width:\s*32px\s*!important;[^}]*height:\s*32px\s*!important;[^}]*border-radius:\s*50%\s*!important/s.test(content),
    `${name} dashboard must have circular 32px .lock-icon-badge`
  );
  assert.ok(
    /\.lock-icon-badge\s+ha-icon\s*\{[^}]*display:\s*flex\s*!important;[^}]*align-items:\s*center\s*!important;[^}]*justify-content:\s*center\s*!important;[^}]*margin:\s*0\s*!important/s.test(content),
    `${name} dashboard must properly reset margin and center ha-icon in .lock-icon-badge`
  );
}

console.log('PASS: All Range Candidate 3, lock icon centering, bug fixes, and English localization assertions passed successfully!');


