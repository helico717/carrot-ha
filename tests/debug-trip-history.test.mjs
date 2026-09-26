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

// Import debug dashboard
const { default: CarrotDashboardDebugCard } = await import('../custom_components/carrot_ha/frontend/carrot-dashboard-debug.js');

test('Carrot HA Debug Dashboard: Trip History & 30-min Merge enhancements', async (t) => {
  const debugCard = Object.create(CarrotDashboardDebugCard.prototype);
  debugCard.state = { lang: 'ko', theme: 'dark', mode: 'parked' };
  
  // Create mock card structure
  const card = {
    state: debugCard.state,
    v: { soc_percent: 80, odometer_km: 15400, soc_capacity_kwh: 78.0 },
    tab: 'trips',
    tripDay: null,
    selected: null,
    _tripPage: 1,
    render: () => {},
    vehicleStatus: () => ({ key: 'parked', label: '주차됨' })
  };

  debugCard.patchDashCard(card);

  // 1. Verify card.trips initialization
  assert(Array.isArray(card.trips), 'card.trips should be an array');
  assert(card.trips.length > 0, 'card.trips should have mock trips');
  assert(card._mergeTripsEnabled === true, 'Merge should be enabled by default');
  assert(Array.isArray(card._rawTrips), 'card._rawTrips should be an array');
  assert(Array.isArray(card._mergedTrips), 'card._mergedTrips should be an array');
  assert(card._mergedTrips.length < card._rawTrips.length, 'Merged trips count should be less than raw trips count');

  // 2. Verify 30-minute merge on today's trips
  const todayMergedTrips = card.trips.filter(t => t.data?.id?.startsWith('t0-'));
  assert(todayMergedTrips.length > 0, 'Today should have trips');
  
  // Find the lunch merged trip
  const lunchTrip = todayMergedTrips.find(t => t.data?.merged && t.data?.merge_count === 4);
  assert(lunchTrip, 'Today should have a merged trip consolidated from 4 sub-trips');
  assert.equal(lunchTrip.data.merge_count, 4, 'Lunch trip should merge exactly 4 sub-trips');
  assert.equal(lunchTrip.data.start_soc_percent, 83.0, 'Start SoC should be 83%');
  assert.equal(lunchTrip.data.end_soc_percent, 78.0, 'End SoC should be 78%');
  assert(lunchTrip.data.distance_m >= 19000, 'Distance should be sum of 4 trips (~19.08km)');
  assert(Array.isArray(lunchTrip.data.route) && lunchTrip.data.route.length >= 20, 'Merged route should combine points');
  assert(lunchTrip.data.route.every(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Number.isFinite(p.speedMps)), 'All route points should have valid coordinates and speedMps');

  // 3. Test card.tripHistory() rendering
  const html = card.tripHistory(true);

  // 7-day selector
  assert(html.includes('class="trip-days"'), 'Should render .trip-days');

  // 24H Master Driving Timeline Bar
  assert(html.includes('class="day-timeline-wrap"'), 'Should render .day-timeline-wrap');
  assert(html.includes('class="day-timeline-rail"'), 'Should render .day-timeline-rail');
  assert(html.includes('class="day-timeline-scale"'), 'Should render .day-timeline-scale with 00:00~24:00');
  assert(html.includes('class="timeline-trip-segment'), 'Should render .timeline-trip-segment in rail');
  assert(html.includes('id="btnToggleTripMerge"'), 'Should render #btnToggleTripMerge');

  // 2x4 Grid & Sleek Cards
  assert(html.includes('class="trip-grid-2x4"'), 'Should render .trip-grid-2x4');
  assert(html.includes('class="sleek-trip-card'), 'Should render .sleek-trip-card');

  // Authentic Badges (Matching Screenshot: 🔋 83% → 78% (5% 사용))
  assert(html.includes('class="trip-soc"'), 'Should render .trip-soc');
  assert(html.includes('83% → 78%'), 'Should render start% → end%');
  assert(html.includes('5% 사용'), 'Should render (5% 사용)');
  assert(!html.includes('-5p') && !html.includes('-5%p'), 'Should NOT render -5p or -5%p');

  // Efficiency badge
  assert(html.includes('class="trip-eff"'), 'Should render .trip-eff');
  assert(html.includes('km/kWh'), 'Should render efficiency unit km/kWh');

  // Merged badge
  assert(html.includes('class="trip-merge-badge"'), 'Should render .trip-merge-badge');
  assert(html.includes('4건 병합'), 'Should render 4건 병합 badge');

  // Inside-Panel Pagination
  assert(html.includes('class="panel-pagination"'), 'Should render .panel-pagination');
  assert(html.includes('이전 페이지'), 'Should render 이전 페이지 button');
  assert(html.includes('다음 페이지'), 'Should render 다음 페이지 button');

  // 4. Test day with 9 trips (Day 2) pagination
  const day2Trip = card.trips.find(t => t.data?.id?.startsWith('t2-'));
  const day2Key = card._getTripDateKey ? card._getTripDateKey(day2Trip.data.started_at) : (day2Trip.data.started_at.slice(0, 10));
  card.tripDay = day2Key;
  card._tripPage = 1;
  const htmlDay2 = card.tripHistory(true);
  assert(htmlDay2.includes('1 / 2 페이지 (총 9개)'), 'Day 2 should show 1 / 2 페이지 (총 9개)');

  // Change page to 2
  card._tripPage = 2;
  const htmlDay2Page2 = card.tripHistory(true);
  assert(htmlDay2Page2.includes('2 / 2 페이지 (총 9개)'), 'Day 2 should show 2 / 2 페이지 (총 9개)');

  // 5. Test toggle merge off
  card._mergeTripsEnabled = false;
  card.trips = card._rawTrips;
  card.tripDay = null; // reset to today
  const htmlUnmerged = card.tripHistory(true);
  assert(htmlUnmerged.includes('개별 분할 표시'), 'Should indicate individual unmerged display');

  console.log('✔ All debug dashboard trip history enhancements verified successfully!');
});
