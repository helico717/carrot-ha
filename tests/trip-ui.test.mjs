import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.HTMLElement = class {
  attachShadow() {
    this.shadowRoot = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: () => {},
      append: () => {}
    };
    return this.shadowRoot;
  }
};
globalThis.document = {
  createElement: () => ({ textContent: '' })
};
globalThis.customElements = { define: () => {}, get: () => false };

const { default: KoreanDashboard } = await import('../custom_components/carrot_ha/frontend/carrot-dashboard-ko.js');
const { default: EnglishDashboard } = await import('../custom_components/carrot_ha/frontend/carrot-dashboard-en.js');

for (const [name, DashClass, durExpected] of [
  ['Korean', KoreanDashboard, '24분'],
  ['English', EnglishDashboard, '24m']
]) {
  const inst = new DashClass();
  inst.trips = [{
    observed_at: '2026-09-19T10:50:00Z',
    data: {
      started_at: '2026-09-19T10:25:06Z',
      ended_at: '2026-09-19T10:50:00Z',
      duration_s: 1494,
      distance_m: 15600,
      efficiency_km_kwh: 7.4,
      start_soc_percent: 76.2,
      end_soc_percent: 73.5
    }
  }];
  inst.tripDay = '2026-09-19';
  const html = inst.tripHistory(true);

  assert(html.includes('trip-days'), `${name}: Missing trip-days`);
  assert(html.includes(durExpected), `${name}: Missing ${durExpected}`);
  assert(!html.includes('동안 주행'), `${name}: Should not include 동안 주행`);
  assert(!html.includes('Drove for'), `${name}: Should not include Drove for`);
  assert(html.includes('class="trip-soc"'), `${name}: Missing trip-soc`);
  assert(html.includes('76% → 74%'), `${name}: Missing 76% → 74%`);
  assert(html.includes('class="trip-eff"'), `${name}: Missing trip-eff`);
  assert(html.includes('7.4 km/kWh'), `${name}: Missing 7.4 km/kWh`);

  // Assert single battery icon
  const socPartMatch = html.match(/<span class="trip-soc">([\s\S]*?)<\/span>/);
  assert(socPartMatch, `${name}: Could not match trip-soc span`);
  const socInner = socPartMatch[1];
  const iconMatches = socInner.match(/<ha-icon/g) || [];
  assert.equal(iconMatches.length, 1, `${name}: Expected exactly 1 ha-icon inside trip-soc, got ${iconMatches.length}`);

  // Assert trip-eff is adjacent (sibling), not nested inside trip-soc
  assert(!socInner.includes('trip-eff'), `${name}: trip-eff should NOT be nested inside trip-soc`);

  // Test Case 2: start_battery_wh / end_battery_wh fallback when start_soc_percent is absent
  const instWh = new DashClass();
  instWh.v = { soc_capacity_kwh: 78.0 };
  instWh.trips = [{
    observed_at: '2026-09-19T10:50:00Z',
    data: {
      started_at: '2026-09-19T10:25:06Z',
      ended_at: '2026-09-19T10:50:00Z',
      duration_s: 1494,
      distance_m: 11530,
      efficiency_km_kwh: 7.4,
      start_battery_wh: 59280, // 59280 / 78000 = 76%
      end_battery_wh: 57720   // 57720 / 78000 = 74%
    }
  }];
  instWh.tripDay = '2026-09-19';
  const htmlWh = instWh.tripHistory(true);
  assert(htmlWh.includes('class="trip-soc"'), `${name} Wh fallback: Missing trip-soc badge`);
  assert(htmlWh.includes('76% → 74%'), `${name} Wh fallback: Expected calculated 76% → 74% from Wh`);
  assert(htmlWh.includes('class="trip-eff"'), `${name} Wh fallback: Missing trip-eff badge`);
  assert(htmlWh.includes('7.4 km/kWh'), `${name} Wh fallback: Missing 7.4 km/kWh`);
  assert(!htmlWh.includes('00:24:54'), `${name} Wh fallback: Should NOT contain redundant 00:24:54`);

  // Test Case 3: When no SOC is available at all, but duration & efficiency exist, do NOT duplicate duration
  const instNoSoc = new DashClass();
  instNoSoc.trips = [{
    observed_at: '2026-09-19T10:50:00Z',
    data: {
      started_at: '2026-09-19T10:25:06Z',
      ended_at: '2026-09-19T10:50:00Z',
      duration_s: 1494,
      distance_m: 11530,
      efficiency_km_kwh: 7.4
    }
  }];
  instNoSoc.tripDay = '2026-09-19';
  const htmlNoSoc = instNoSoc.tripHistory(true);
  assert(!htmlNoSoc.includes('class="trip-soc"'), `${name} NoSoc: Should not show trip-soc`);
  assert(htmlNoSoc.includes('class="trip-eff"'), `${name} NoSoc: Should show trip-eff`);
  assert(!htmlNoSoc.includes('00:24:54'), `${name} NoSoc: Should NOT duplicate 00:24:54 when duration text is already shown in header`);

  // Assert CSS rules directly from source
  const jsSource = name === 'Korean'
    ? await readFile(new URL('../custom_components/carrot_ha/frontend/carrot-dashboard-ko.js', import.meta.url), 'utf8')
    : await readFile(new URL('../custom_components/carrot_ha/frontend/carrot-dashboard-en.js', import.meta.url), 'utf8');
  
  const styleMatches = [...jsSource.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  assert(styleMatches.length > 0, `${name}: No <style> block found`);
  const css = styleMatches.join('\n');

  assert(css.includes('.trip-days'), `${name}: CSS missing .trip-days`);
  assert(css.includes('.charge-days'), `${name}: CSS missing .charge-days`);
  assert(css.includes('grid-template-columns:repeat(7,minmax(0,1fr))'), `${name}: Missing 7-column grid definition`);
  assert(css.includes('.trip-soc'), `${name}: CSS missing .trip-soc`);
  assert(css.includes('.trip-eff'), `${name}: CSS missing .trip-eff`);
  assert(css.includes('#34d399'), `${name}: CSS missing green color for trip-soc`);
  assert(css.includes('#38bdf8'), `${name}: CSS missing cyan/blue color for trip-eff`);

  // Check balanced braces in CSS
  let braceCount = 0;
  for (let c of css) {
    if (c === '{') braceCount++;
    if (c === '}') braceCount--;
    assert(braceCount >= 0, `${name}: Negative brace count (extra closing brace) in CSS`);
  }
  assert.equal(braceCount, 0, `${name}: Unbalanced braces in CSS (count: ${braceCount})`);
}

// Also verify carrot-dashboard-debug.js
const dbgSource = await readFile(new URL('../custom_components/carrot_ha/frontend/carrot-dashboard-debug.js', import.meta.url), 'utf8');
assert(dbgSource.includes('.trip-days'), 'debug.js: missing .trip-days in injectCustomStyles');
assert(dbgSource.includes('.charge-days'), 'debug.js: missing .charge-days in injectCustomStyles');
assert(dbgSource.includes('.trip-soc'), 'debug.js: missing .trip-soc in injectCustomStyles');
assert(dbgSource.includes('.trip-eff'), 'debug.js: missing .trip-eff in injectCustomStyles');

console.log('All Korean, English, and Debug dashboard CSS & tripHistory assertions passed successfully.');
