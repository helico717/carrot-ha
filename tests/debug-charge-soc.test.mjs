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

test('Carrot HA Debug Dashboard: Integrated Charge SoC Pill Badges & Retroactive Fallback', async () => {
  const debugCard = Object.create(CarrotDashboardDebugCard.prototype);
  debugCard.state = { lang: 'ko', theme: 'dark', mode: 'charging' };

  // Create mock card structure
  const card = {
    state: debugCard.state,
    v: { soc_percent: 80, odometer_km: 15400, soc_capacity_kwh: 78.0 },
    tab: 'charge',
    chargeDay: null,
    selected: null,
    render: () => {},
    vehicleStatus: () => ({ key: 'charging', label: '충전 중' })
  };

  debugCard.patchDashCard(card);

  // 1. Verify card.charges initialization with mock SoC data
  assert(Array.isArray(card.charges), 'card.charges should be an array');
  assert(card.charges.length > 0, 'card.charges should have mock charges');

  const todayCharge = card.charges.find(c => c.id === 'sim-charge-today-pm');
  assert(todayCharge, 'Should have today mock charge');
  assert.equal(todayCharge.data.start_soc_percent, 24);
  assert.equal(todayCharge.data.end_soc_percent, 80);
  assert.equal(todayCharge.data.soc_charged_percent, 56);

  // 2. Render chargeHistory in Korean
  assert(typeof card.chargeHistory === 'function', 'card.chargeHistory should be patched');
  const koHtml = card.chargeHistory();
  assert(koHtml.includes('class="panel charge-history"'), 'Should render charge history panel');
  assert(koHtml.includes('class="charge-soc"'), 'Should render charge-soc pill badge');
  assert(koHtml.includes('24% → 80% (+56% 충전)'), 'Should render integrated 24% → 80% (+56% 충전)');
  assert(koHtml.includes('42% → 78% (+36% 충전)'), 'Should render integrated 42% → 78% (+36% 충전)');

  // 3. Render chargeHistory for retroactive charge session (sim-charge-d6)
  // Set day to d6
  const d6Time = new Date(Date.now() - 86400000 * 6);
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d6Time);
  const d6Key = ['year', 'month', 'day'].map(t => parts.find(p => p.type === t)?.value).join('-');
  card.chargeDay = d6Key;
  const d6Html = card.chargeHistory();
  assert(d6Html.includes('+21% 충전'), 'Should render retroactive +21% 충전');
  assert(d6Html.includes('소급 추산'), 'Should include (소급 추산) tag');

  // 4. English mode test
  debugCard.state.lang = 'en';
  card.chargeDay = null; // Reset to today
  const enHtml = card.chargeHistory();
  assert(enHtml.includes('24% → 80% (+56% charged)'), 'Should render in English in en mode');

  console.log('✔ Carrot HA Debug Dashboard charge SoC badges validated successfully!');
});
