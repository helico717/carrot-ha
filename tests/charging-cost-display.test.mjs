import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const koPath = path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-ko.js');
const enPath = path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-en.js');
const debugPath = path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-debug.js');

const koContent = fs.readFileSync(koPath, 'utf8');
const enContent = fs.readFileSync(enPath, 'utf8');
const debugContent = fs.readFileSync(debugPath, 'utf8');

// 1. KO Dashboard Verification
assert.ok(
  koContent.includes('<strong>${n(cost,0)}원 <small>(추정)</small></strong>'),
  'KO dashboard must place cost at Line 1 with "원 <small>(추정)</small>" format'
);
assert.ok(
  koContent.includes('>${n(ed.energy_kwh,2)} <small>kWh</small></strong>'),
  'KO dashboard must place energy at Line 2 with <strong> style and "kWh" casing'
);
assert.ok(
  koContent.includes('<span class="charge-sub">${n(unitPrice,0)}원/kWh</span>'),
  'KO dashboard must place unit price at Line 3 with "원/kWh" (exact casing)'
);

// CSS verification for KO
assert.ok(
  koContent.includes('.charge-val{text-align:right;flex-shrink:0;max-width:55%;display:flex;flex-direction:column;align-items:flex-end;gap:2px}'),
  'KO dashboard must style .charge-val with column flex and right alignment'
);
assert.ok(
  koContent.includes('.charge-val strong{font-size:14px;font-weight:700;color:var(--ink);line-height:1.25;display:flex;align-items:baseline;justify-content:flex-end;gap:3px;white-space:nowrap}'),
  'KO dashboard must style .charge-val strong with prominent 14px 700 font'
);

// 2. EN Dashboard Verification
assert.ok(
  enContent.includes('<strong>₩${n(cost,0)} <small>(est.)</small></strong>'),
  'EN dashboard must place cost at Line 1 with "₩... <small>(est.)</small>" format'
);
assert.ok(
  enContent.includes('>${n(ed.energy_kwh,2)} <small>kWh</small></strong>'),
  'EN dashboard must place energy at Line 2 with <strong> style and "kWh" casing'
);
assert.ok(
  enContent.includes('<span class="charge-sub">₩${n(unitPrice,0)}/kWh</span>'),
  'EN dashboard must place unit price at Line 3 with "₩.../kWh" (exact casing)'
);

// 3. Debug Dashboard Verification
assert.ok(
  debugContent.includes("isEnglish ? `₩${n(cost, 0)} <small>(est.)</small>` : `${n(cost, 0)}원 <small>(추정)</small>`"),
  'Debug dashboard must format Line 1 cost with localization'
);
assert.ok(
  debugContent.includes('>${n(ed.energy_kwh, 2)} <small>kWh</small></strong>'),
  'Debug dashboard must format Line 2 energy in strong tag with kWh'
);
assert.ok(
  debugContent.includes("isEnglish ? `₩${n(unitPrice, 0)}/kWh` : `${n(unitPrice, 0)}원/kWh`"),
  'Debug dashboard must format Line 3 unit price with /kWh'
);
assert.match(
  debugContent,
  /\.charge-val\s*\{[^}]*display:\s*flex\s*!important;[^}]*flex-direction:\s*column\s*!important;/s,
  'Debug dashboard must style .charge-val with column flex'
);

// 4. Unit price calculation logic check
for (const [name, content] of [['KO', koContent], ['EN', enContent], ['Debug', debugContent]]) {
  assert.ok(
    content.includes('unit_price_krw') || content.includes('unitPrice'),
    `${name} dashboard must calculate unit price`
  );
  // Ensure kWh has uppercase W and lowercase k, h in the charge-val area
  assert.doesNotMatch(
    content,
    /[0-9]원\/kwh|[0-9]원\/KWH/i,
    `${name} dashboard must not use lowercase or all-caps kwh in unit price string`
  );
}

console.log('PASS: Charging history cost, kWh, and unit rate layout tests passed successfully!');
