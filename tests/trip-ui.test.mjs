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

  // Test Case 4: Daily summary mode vs Specific trip mode in trips tab
  const instTrips = new DashClass();
  instTrips.tab = 'trips';
  instTrips.tripDay = '2026-09-19';
  instTrips.trips = [
    {
      observed_at: '2026-09-19T10:50:00Z',
      data: {
        started_at: '2026-09-19T10:25:00Z',
        ended_at: '2026-09-19T10:45:00Z',
        duration_s: 1200,
        distance_m: 15600,
        energy_wh: 2000,
        efficiency_km_kwh: 7.8,
        route: [{ speedMps: 10 }, { speedMps: 20.833 }] // max ~75 km/h
      }
    },
    {
      observed_at: '2026-09-19T14:20:00Z',
      data: {
        started_at: '2026-09-19T14:10:00Z',
        ended_at: '2026-09-19T14:20:00Z',
        duration_s: 600,
        distance_m: 10000,
        energy_wh: 1500,
        efficiency_km_kwh: 6.7,
        route: [{ speedMps: 15 }, { speedMps: 25 }] // max 90 km/h
      }
    }
  ];

  // (A) Daily Summary Mode (selected === null)
  instTrips.selected = null;
  const summaryHtml = instTrips.body(instTrips.v || {}, {}, true);

  if (name === 'Korean') {
    assert(summaryHtml.includes('>주행거리</span>'), 'Korean Summary: Missing 주행거리 metric');
    assert(summaryHtml.includes('25.6'), 'Korean Summary: Expected total distance 25.6 km');
    assert(summaryHtml.includes('>주행시간</span>'), 'Korean Summary: Missing 주행시간 metric');
    assert(summaryHtml.includes('>평균전비</span>'), 'Korean Summary: Missing 평균전비 metric');
    assert(summaryHtml.includes('7.3'), 'Korean Summary: Expected average efficiency 7.3 km/kWh');
    assert(summaryHtml.includes('>평균속도</span>'), 'Korean Summary: Missing 평균속도 metric');
    assert(summaryHtml.includes('51'), 'Korean Summary: Expected average speed 51 km/h');
    assert(summaryHtml.includes('2026-09-19 주행 요약'), 'Korean Summary: Expected 2026-09-19 주행 요약 title');
    assert(summaryHtml.includes('총 2회 주행'), 'Korean Summary: Expected 총 2회 주행 subtitle');
    assert(summaryHtml.includes('이날 출발(하늘색) / 이날 도착(파랑)'), 'Korean Summary: Expected 이날 출발/이날 도착 legend');
  } else {
    assert(summaryHtml.includes('>Distance</span>'), 'English Summary: Missing Distance metric');
    assert(summaryHtml.includes('25.6'), 'English Summary: Expected total distance 25.6 km');
    assert(summaryHtml.includes('>Duration</span>'), 'English Summary: Missing Duration metric');
    assert(summaryHtml.includes('>Avg efficiency</span>'), 'English Summary: Missing Avg efficiency metric');
    assert(summaryHtml.includes('7.3'), 'English Summary: Expected average efficiency 7.3 km/kWh');
    assert(summaryHtml.includes('>Avg speed</span>'), 'English Summary: Missing Avg speed metric');
    assert(summaryHtml.includes('51'), 'English Summary: Expected average speed 51 km/h');
    assert(summaryHtml.includes('2026-09-19 trip summary'), 'English Summary: Expected 2026-09-19 trip summary title');
    assert(summaryHtml.includes('2 trips total'), 'English Summary: Expected 2 trips total subtitle');
    assert(summaryHtml.includes('Day start (sky blue) / Day arrival (blue)'), 'English Summary: Expected Day start/Day arrival legend');
  }

  // (B) Specific Trip Mode (selected === 0)
  instTrips.selected = 0;
  const specificHtml = instTrips.body(instTrips.v || {}, instTrips.trips[0].data, true);

  if (name === 'Korean') {
    assert(specificHtml.includes('>주행거리</span>'), 'Korean Specific: Missing 주행거리 metric');
    assert(specificHtml.includes('15.6'), 'Korean Specific: Expected trip distance 15.6 km');
    assert(specificHtml.includes('>주행시간</span>'), 'Korean Specific: Missing 주행시간 metric');
    assert(specificHtml.includes('>전비</span>'), 'Korean Specific: Missing 전비 metric');
    assert(specificHtml.includes('7.8'), 'Korean Specific: Expected trip efficiency 7.8 km/kWh');
    assert(specificHtml.includes('>최고속도</span>'), 'Korean Specific: Missing 최고속도 metric');
    assert(specificHtml.includes('75'), 'Korean Specific: Expected top speed 75 km/h');
    assert(specificHtml.includes('주행 상세'), 'Korean Specific: Expected 주행 상세 title');
  } else {
    assert(specificHtml.includes('>Distance</span>'), 'English Specific: Missing Distance metric');
    assert(specificHtml.includes('15.6'), 'English Specific: Expected trip distance 15.6 km');
    assert(specificHtml.includes('>Duration</span>'), 'English Specific: Missing Duration metric');
    assert(specificHtml.includes('>Efficiency</span>'), 'English Specific: Missing Efficiency metric');
    assert(specificHtml.includes('7.8'), 'English Specific: Expected trip efficiency 7.8 km/kWh');
    assert(specificHtml.includes('>Top speed</span>'), 'English Specific: Missing Top speed metric');
    assert(specificHtml.includes('75'), 'English Specific: Expected top speed 75 km/h');
    assert(specificHtml.includes('Trip details'), 'English Specific: Expected Trip details title');
  }

  // Test Case 5: Bidirectional date sync between batteryHistory and chargeHistory
  const instCharge = new DashClass();
  instCharge.tab = 'charge';
  instCharge.v = {
    battery_history: [
      { date: '2026-09-15', used: 20, hours: [] },
      { date: '2026-09-16', used: 0, hours: [] },
      { date: '2026-09-17', used: 0, hours: [] },
      { date: '2026-09-18', used: 60, hours: [] },
      { date: '2026-09-19', used: 137, hours: [] },
      { date: '2026-09-20', used: 30, hours: [] },
      { date: '2026-09-21', used: 25, hours: [] }
    ]
  };
  instCharge.charges = [
    {
      observed_at: '2026-09-19T08:00:00Z',
      data: { started_at: '2026-09-19T07:00:00Z', energy_kwh: 25.0, duration_s: 3600 }
    }
  ];

  // (A) Setting chargeDay selects the corresponding bar in batteryHistory
  instCharge.chargeDay = '2026-09-19';
  const batHtml1 = instCharge.batteryHistory();
  const chgHtml1 = instCharge.chargeHistory();
  assert(batHtml1.includes('data-date="2026-09-19" aria-label="2026-09-19'), `${name}: batteryHistory should render data-date for 2026-09-19`);
  assert(batHtml1.includes('data-day="4" data-date="2026-09-19" aria-label="2026-09-19 사용량 137" aria-pressed="true"') ||
         batHtml1.includes('data-day="4" data-date="2026-09-19" aria-label="2026-09-19 Usage 137" aria-pressed="true"'),
         `${name}: batteryHistory bar for 2026-09-19 should have aria-pressed="true"`);
  assert(chgHtml1.includes('data-charge-day="2026-09-19" aria-pressed="true"'), `${name}: chargeHistory button for 2026-09-19 should have aria-pressed="true"`);

  // (B) Simulating click on chargeHistory day -> synchronizes batteryDay
  instCharge.chargeDay = '2026-09-18';
  const bIdx = instCharge.v.battery_history.findIndex(x => x.date === instCharge.chargeDay);
  if (bIdx !== -1) instCharge.batteryDay = bIdx;
  const batHtml2 = instCharge.batteryHistory();
  assert(batHtml2.includes('data-day="3" data-date="2026-09-18" aria-label="2026-09-18 사용량 60" aria-pressed="true"') ||
         batHtml2.includes('data-day="3" data-date="2026-09-18" aria-label="2026-09-18 Usage 60" aria-pressed="true"'),
         `${name}: batteryHistory bar for 2026-09-18 should be aria-pressed="true" after chargeDay change`);

  // (C) Simulating click on batteryHistory bar -> synchronizes chargeDay
  const clickedDate = instCharge.v.battery_history[0].date; // 2026-09-15
  instCharge.batteryDay = 0;
  instCharge.chargeDay = clickedDate;
  const chgHtml3 = instCharge.chargeHistory();
  assert(chgHtml3.includes('data-charge-day="2026-09-15" aria-pressed="true"'), `${name}: chargeHistory should have 2026-09-15 aria-pressed="true" after battery bar click`);

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

console.log('All Korean, English, and Debug dashboard CSS, tripHistory, and daily summary assertions passed successfully.');

