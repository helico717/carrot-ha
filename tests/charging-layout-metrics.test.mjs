import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const koPath = path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-ko.js');
const enPath = path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-en.js');
const debugPath = path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-debug.js');

const koContent = fs.readFileSync(koPath, 'utf8');
const enContent = fs.readFileSync(enPath, 'utf8');
const debugContent = fs.readFileSync(debugPath, 'utf8');

// 1. Layout & Stretch verification in ko and en cards
for (const [name, content] of [['Korean', koContent], ['English', enContent]]) {
  assert.match(
    content,
    /\.charge-layout\{display:grid;grid-template-columns:minmax\(0,1\.3fr\) minmax\(360px,1fr\);gap:18px;align-items:start;width:100%\}/,
    `${name} dashboard must set width: 100% on .charge-layout`
  );

  assert.match(
    content,
    /@container\(max-width:750px\)\{\.charge-layout\{display:flex;flex-direction:column;gap:16px;align-items:stretch;width:100%\}\.charge-sidebar\{width:100%\}\.charge-sidebar-tiles\{width:100%;gap:10px\}\.charge-sidebar \.charge-history\{width:100%\}/,
    `${name} dashboard must stretch .charge-layout, .charge-sidebar, and .charge-history to 100% on <=750px`
  );

  // Fallback slow/fast kwh aggregation
  assert.ok(
    content.includes('let slowKwh = v.month_slow_kwh;') &&
    content.includes('let fastKwh = v.month_fast_kwh;'),
    `${name} dashboard must include slow/fast fallback resolution logic`
  );
}

// 2. Debug simulator telemetry & preview-pane CSS verification
assert.match(
  debugContent,
  /month_slow_kwh:\s*45\.5/,
  'Debug dashboard must include month_slow_kwh in simulated telemetry'
);
assert.match(
  debugContent,
  /month_fast_kwh:\s*110\.4/,
  'Debug dashboard must include month_fast_kwh in simulated telemetry'
);
assert.match(
  debugContent,
  /\.preview-pane\s*\{[^}]*width:\s*100%;[^}]*box-sizing:\s*border-box;/s,
  'Debug dashboard preview pane must specify width: 100% and box-sizing: border-box'
);
assert.match(
  debugContent,
  /#dashSlot\s*\{[^}]*width:\s*100%;/s,
  'Debug dashboard #dashSlot must specify width: 100%'
);

console.log('PASS: Charging tab layout full-width stretch and slow/fast metrics tests completed successfully!');
