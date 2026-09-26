import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

// Polyfill browser globals
globalThis.window = globalThis;
globalThis.document = {
  addEventListener: () => {},
  getElementById: () => null,
  querySelectorAll: () => []
};

test('Preview Showcase: Charging Tab, Integrated Start/End SoC Badges & Retroactive Fallback', async () => {
  const htmlPath = path.resolve('preview/trip_candidates/index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // 1. Verify HTML Structure & Nav
  assert(htmlContent.includes('id="nav-btn-charge"'), 'Master card nav should have charging tab button');
  assert(htmlContent.includes('id="view-charge-container"'), 'Should have charging view container');
  assert(htmlContent.includes('id="charge-sessions-list"'), 'Should have charge-sessions-list container');

  // 2. Extract script functions and test charging data processing
  const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/i);
  assert(scriptMatch, 'Should contain inline JavaScript script tag');

  // Create mock environment to run logic
  const mockEnv = {
    RAW_CHARGES_DATA: null,
    renderChargeSocBadgeHtml: null
  };

  const scriptCode = scriptMatch[1];
  const runFn = new Function('env', `
    ${scriptCode}
    env.RAW_CHARGES_DATA = RAW_CHARGES_DATA;
    env.renderChargeSocBadgeHtml = renderChargeSocBadgeHtml;
  `);

  runFn(mockEnv);

  const { RAW_CHARGES_DATA, renderChargeSocBadgeHtml } = mockEnv;
  assert(Array.isArray(RAW_CHARGES_DATA), 'RAW_CHARGES_DATA should be an array');
  assert.equal(RAW_CHARGES_DATA.length, 7, 'RAW_CHARGES_DATA should have 7 days');

  // 3. Test 2026-09-26 (Today) charges
  const todayData = RAW_CHARGES_DATA.find(d => d.key === '2026-09-26');
  assert(todayData, 'Today (2026-09-26) charge data should exist');
  assert(todayData.sessions, 'Today should have sessions array');
  assert.equal(todayData.sessions.length, 2, 'Today should have 2 charge sessions');

  // 4. Test Integrated SoC badge rendering: 🔋 start% → end% (+gain% 충전)
  // A) Standard charge (24% -> 80% with +56% 충전)
  const stdCharge = todayData.sessions.find(c => c.id === 'c261');
  assert(stdCharge, 'Should have standard charge c261');
  const stdBadge = renderChargeSocBadgeHtml(stdCharge);
  assert(stdBadge.includes('24% → 80%'), 'Should render 24% → 80%');
  assert(stdBadge.includes('(+56% 충전)'), 'Should render (+56% 충전) inside the integrated badge');

  // B) Merged charge (42% -> 78% with +36% 충전)
  const mergedSession = todayData.sessions.find(c => c.id === 'c262');
  assert(mergedSession, 'Should have merged charge session c262');
  const mergedBadge = renderChargeSocBadgeHtml(mergedSession);
  assert(mergedBadge.includes('42% → 78%'), 'Merged badge should render 42% → 78%');
  assert(mergedBadge.includes('(+36% 충전)'), 'Merged badge should render (+36% 충전) inside the integrated badge');

  // C) Retroactive estimated fallback (missing start/end state, energy-based)
  const d24 = RAW_CHARGES_DATA.find(d => d.key === '2026-09-24');
  assert(d24 && d24.sessions, '2026-09-24 should have sessions');
  const retroCharge = d24.sessions.find(c => c.isRetroactive);
  assert(retroCharge, 'Should have retroactive fallback charge session');
  const retroBadge = renderChargeSocBadgeHtml(retroCharge);
  assert(retroBadge.includes('+21% 충전'), 'Retroactive badge should render +21% 충전');
  assert(retroBadge.includes('소급 추산'), 'Retroactive badge should include 소급 추산 tag');

  console.log('✔ Preview Showcase: Charging Tab, Integrated Start/End SoC Badges & Retroactive Fallback validated successfully!');
});
