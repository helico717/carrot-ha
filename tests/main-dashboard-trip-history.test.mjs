import assert from 'node:assert/strict';
import { test } from 'node:test';

// Polyfill minimal browser DOM if running under Node
if (typeof customElements === 'undefined') {
  globalThis.customElements = {
    get: () => null,
    define: () => {}
  };
}
if (typeof HTMLElement === 'undefined') {
  globalThis.HTMLElement = class {
    attachShadow() {
      return {
        appendChild: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
      };
    }
    setAttribute() {}
    getAttribute() { return null; }
  };
}

const { default: KoreanDashboard } = await import('../custom_components/carrot_ha/frontend/carrot-dashboard-ko.js');
const { default: EnglishDashboard } = await import('../custom_components/carrot_ha/frontend/carrot-dashboard-en.js');
import { tripDays } from '../custom_components/carrot_ha/frontend/carrot-trip-days.js';

test('Main Dashboards (KO & EN): 24H Timeline, 30-min Merge, 2x4 Grid & Pagination', async (t) => {
  const todayDate = tripDays([], undefined)[0]?.key || new Date().toISOString().slice(0, 10);

  for (const [lang, DashClass] of [
    ['Korean', KoreanDashboard],
    ['English', EnglishDashboard]
  ]) {
    const isEn = lang === 'English';
    const card = new DashClass();
    card.v = { soc_percent: 78, odometer_km: 15400, soc_capacity_kwh: 78.0 };
    card.tab = 'trips';
    card.tripDay = todayDate;

    // Provide 4 consecutive short trips with < 30min gap that should merge
    const rawTrips = [
      {
        observed_at: `${todayDate}T12:00:00Z`,
        data: {
          started_at: `${todayDate}T11:45:00Z`,
          ended_at: `${todayDate}T12:00:00Z`,
          duration_s: 900,
          distance_m: 5000,
          energy_wh: 800,
          start_soc_percent: 83.0,
          end_soc_percent: 81.5,
          route: [{ latitude: 37.5, longitude: 127.0, speedMps: 10 }]
        }
      },
      {
        observed_at: `${todayDate}T12:20:00Z`,
        data: {
          started_at: `${todayDate}T12:10:00Z`, // 10 min gap
          ended_at: `${todayDate}T12:20:00Z`,
          duration_s: 600,
          distance_m: 4000,
          energy_wh: 600,
          start_soc_percent: 81.5,
          end_soc_percent: 80.0,
          route: [{ latitude: 37.51, longitude: 127.01, speedMps: 12 }]
        }
      },
      {
        observed_at: `${todayDate}T12:45:00Z`,
        data: {
          started_at: `${todayDate}T12:30:00Z`, // 10 min gap
          ended_at: `${todayDate}T12:45:00Z`,
          duration_s: 900,
          distance_m: 5500,
          energy_wh: 850,
          start_soc_percent: 80.0,
          end_soc_percent: 79.0,
          route: [{ latitude: 37.52, longitude: 127.02, speedMps: 11 }]
        }
      },
      {
        observed_at: `${todayDate}T13:10:00Z`,
        data: {
          started_at: `${todayDate}T12:55:00Z`, // 10 min gap
          ended_at: `${todayDate}T13:10:00Z`,
          duration_s: 900,
          distance_m: 5000,
          energy_wh: 750,
          start_soc_percent: 79.0,
          end_soc_percent: 78.0,
          route: [{ latitude: 37.53, longitude: 127.03, speedMps: 15 }]
        }
      }
    ];

    // Simulate loadCache / load behavior
    card._rawTrips = rawTrips;
    const { mergeConsecutiveTrips } = await import('../custom_components/carrot_ha/frontend/carrot-trip-days.js');
    card._mergedTrips = mergeConsecutiveTrips(card._rawTrips, undefined, 1800);
    card.trips = card._mergeTripsEnabled !== false ? card._mergedTrips : card._rawTrips;

    // 1. Verify merge calculation
    assert.equal(card.trips.length, 1, `${lang}: 4 adjacent trips under 30min should merge into 1`);
    const mergedTrip = card.trips[0].data;
    assert.equal(mergedTrip.merged, true, `${lang}: trip should be marked as merged`);
    assert.equal(mergedTrip.merge_count, 4, `${lang}: merge_count should be 4`);
    assert.equal(mergedTrip.start_soc_percent, 83.0, `${lang}: start_soc_percent should be 83.0`);
    assert.equal(mergedTrip.end_soc_percent, 78.0, `${lang}: end_soc_percent should be 78.0`);
    assert.equal(mergedTrip.distance_m, 19500, `${lang}: distance should be sum of parts (19.5km)`);
    assert.equal(mergedTrip.route.length, 4, `${lang}: route should combine all parts`);

    // 2. Render tripHistory
    const html = card.tripHistory(true);

    // Verify 24H Master Driving Timeline Bar
    assert(html.includes('class="day-timeline-wrap"'), `${lang}: Missing .day-timeline-wrap`);
    assert(html.includes('class="day-timeline-rail"'), `${lang}: Missing .day-timeline-rail`);
    assert(html.includes('class="day-timeline-scale"'), `${lang}: Missing .day-timeline-scale`);
    assert(html.includes('00:00') && html.includes('24:00'), `${lang}: Missing scale labels`);
    assert(html.includes('class="timeline-trip-segment'), `${lang}: Missing .timeline-trip-segment in rail`);

    // Verify Merge Toggle Button
    assert(html.includes('id="btnToggleTripMerge"'), `${lang}: Missing #btnToggleTripMerge`);
    if (isEn) {
      assert(html.includes('Merged (≤30m)'), 'English: Missing Merged button label');
    } else {
      assert(html.includes('30분 이하 병합됨'), 'Korean: Missing 30분 이하 병합됨 button label');
    }

    // Verify 2x4 Sleek Card Grid
    assert(html.includes('class="trip-grid-2x4"'), `${lang}: Missing .trip-grid-2x4`);
    assert(html.includes('class="sleek-trip-card'), `${lang}: Missing .sleek-trip-card`);

    // Verify SoC Used Badge (83% → 78% (5% 사용 / used))
    assert(html.includes('class="trip-soc"'), `${lang}: Missing .trip-soc badge`);
    assert(html.includes('83% → 78%'), `${lang}: Missing 83% → 78%`);
    assert(html.includes(isEn ? '5% used' : '5% 사용'), `${lang}: Missing used percentage tag`);
    assert(!html.includes('-5p') && !html.includes('-5%p'), `${lang}: Must NOT include -5p or -5%p`);

    // Verify Efficiency Badge
    assert(html.includes('class="trip-eff"'), `${lang}: Missing .trip-eff`);
    assert(html.includes('km/kWh'), `${lang}: Missing km/kWh efficiency unit`);

    // Verify Merge Count Badge
    assert(html.includes('class="trip-merge-badge"'), `${lang}: Missing .trip-merge-badge`);
    assert(html.includes(isEn ? '4 merged' : '4건 병합'), `${lang}: Missing merge count text`);

    // Verify Inside-Panel Pagination
    assert(html.includes('class="panel-pagination"'), `${lang}: Missing .panel-pagination`);
    assert(html.includes('data-nav-page="prev"'), `${lang}: Missing prev button`);
    assert(html.includes('data-nav-page="next"'), `${lang}: Missing next button`);
    assert(html.includes(isEn ? '1 / 1 Page' : '1 / 1 페이지'), `${lang}: Missing page indicator`);

    // 3. Verify Charge History SoC Badge
    card.charges = [
      {
        observed_at: `${todayDate}T08:00:00Z`,
        data: {
          started_at: `${todayDate}T07:00:00Z`,
          ended_at: `${todayDate}T08:00:00Z`,
          duration_s: 3600,
          energy_kwh: 25.0,
          start_soc_percent: 42.0,
          end_soc_percent: 80.0,
          soc_charged_percent: 38.0
        }
      },
      {
        observed_at: `${todayDate}T10:00:00Z`,
        data: {
          started_at: `${todayDate}T09:30:00Z`,
          ended_at: `${todayDate}T10:00:00Z`,
          duration_s: 1800,
          energy_kwh: 16.4,
          soc_charged_percent: 21.0,
          soc_retroactive_estimated: true
        }
      }
    ];
    card.chargeDay = todayDate;
    const chgHtml = card.chargeHistory();

    assert(chgHtml.includes('class="charge-soc"'), `${lang}: Missing .charge-soc badge`);
    assert(chgHtml.includes('42% → 80%'), `${lang}: Missing charge start/end SoC`);
    assert(chgHtml.includes(isEn ? '+38% charged' : '+38% 충전'), `${lang}: Missing charged percentage`);
    assert(chgHtml.includes('retro-mode'), `${lang}: Missing retro-mode badge for retroactive estimate`);
    assert(chgHtml.includes(isEn ? '(est.)' : '(소급 추산)'), `${lang}: Missing retroactive estimate tag`);
  }
});
