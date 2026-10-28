import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

globalThis.HTMLElement = class { attachShadow() { return {}; } };
globalThis.customElements = {get() {}, define() {}};
const {default: Korean} = await import('../custom_components/carrot_ha/frontend/carrot-dashboard-ko.js');
const {default: English} = await import('../custom_components/carrot_ha/frontend/carrot-dashboard-en.js');

const card = (Class, status) => {
  const c = new Class();
  c.vehicleStatus = () => ({key: status, label: status});
  return c;
};
const values = (extra = {}) => ({aux_voltage: 12.5, aux_level: 'ok', aux_level_reason: 'ok', aux_age_s: 20, aux_low_minutes: 0, ...extra});

test('colour is shown only while parked with a fresh, judged measurement', () => {
  for (const Class of [Korean, English]) {
    const parked = card(Class, 'parked');
    for (const level of ['ok', 'caution', 'warn']) {
      assert.equal(parked.auxBatteryView(values({aux_level: level, aux_level_reason: level})).level, level);
    }
    assert.equal(parked.auxBatteryView(values({aux_level: 'caution', aux_level_reason: 'low-pending'})).reason, 'low-pending');
    // driving and charging: no colour at all, even when the voltage is low
    for (const status of ['driving', 'charging']) {
      const view = card(Class, status).auxBatteryView(values({aux_voltage: 11.8, aux_level: 'warn'}));
      assert.equal(view.level, 'none');
      assert.equal(view.reason, 'active');
    }
    // every other state is gray: communication delayed, stale data, offline, unknown
    for (const status of ['stale', 'offline', 'connection_unknown', 'unknown']) {
      const view = card(Class, status).auxBatteryView(values());
      assert.equal(view.level, 'unknown', status);
      assert.equal(view.reason, 'state');
    }
  }
});

test('an old measurement is gray even when the last known level was caution or warn', () => {
  for (const Class of [Korean, English]) {
    const parked = card(Class, 'parked');
    const old = parked.auxBatteryView(values({aux_voltage: 11.81, aux_level: 'caution', aux_level_reason: 'low-pending', aux_age_s: 3 * 3600}));
    assert.equal(old.level, 'unknown');
    assert.equal(old.reason, 'stale');
    assert.equal(parked.auxBatteryView(values({aux_age_s: 600})).level, 'ok');       // boundary is inclusive
    assert.equal(parked.auxBatteryView(values({aux_age_s: 601})).reason, 'stale');
    for (const unknown of [null, undefined, NaN, '20']) {                              // null >= 0 is true in JS: unknown age must not pass
      assert.equal(parked.auxBatteryView(values({aux_age_s: unknown})).reason, 'stale');
    }
    assert.equal(parked.auxBatteryView(values({aux_age_s: -5})).reason, 'stale');
  }
});

test('no voltage or no server judgement (DC-DC) is gray, never a guessed colour', () => {
  for (const Class of [Korean, English]) {
    const parked = card(Class, 'parked');
    for (const bad of [null, undefined, NaN, '12.5']) {
      const view = parked.auxBatteryView(values({aux_voltage: bad}));
      assert.equal(view.level, 'unknown');
      assert.equal(view.reason, 'no-data');
      assert.equal(view.text, '--');
    }
    assert.equal(parked.auxBatteryView(values({aux_level: null, aux_level_reason: 'dcdc'})).reason, 'dcdc');
    assert.equal(parked.auxBatteryView(values({aux_level: null, aux_level_reason: 'active'})).reason, 'state');
    assert.equal(parked.auxBatteryView(values({aux_level: undefined, aux_level_reason: undefined})).level, 'unknown');
    assert.equal(parked.auxBatteryView({}).level, 'unknown');
  }
});

test('the value always shows one decimal so the number matches its 0.1 V judgement', () => {
  const parked = card(Korean, 'parked');
  assert.equal(parked.auxBatteryView(values({aux_voltage: 12})).text, '12.0V');
  assert.equal(parked.auxBatteryView(values({aux_voltage: 12.04})).text, '12.0V');
  assert.equal(parked.auxBatteryView(values({aux_voltage: 11.8})).text, '11.8V');
});

test('label is 배터리 / Battery and the markup carries the level, tooltip and old-value age', () => {
  const ko = card(Korean, 'parked');
  const html = ko.auxBatterySpan(values({aux_voltage: 12.1, aux_level: 'caution', aux_level_reason: 'caution'}));
  assert.match(html, /^<span class="aux-battery" title="주의[^"]*">배터리 <b data-aux="caution">12\.1V<\/b><\/span>$/);
  const en = card(English, 'parked');
  assert.match(en.auxBatterySpan(values()), /^<span class="aux-battery" title="Normal">Battery <b data-aux="ok">12\.5V<\/b><\/span>$/);
  assert.doesNotMatch(html + en.auxBatterySpan(values()), />12V /);
  const stale = ko.auxBatterySpan(values({aux_voltage: 11.8, aux_age_s: 3 * 3600 + 5}));
  assert.match(stale, /data-aux="unknown">11\.8V<\/b><small class="aux-age">3시간 전<\/small>/);
  assert.match(en.auxBatterySpan(values({aux_voltage: 11.8, aux_age_s: 700})), /<small class="aux-age">11m ago<\/small>/);
  // age label only for the stale case, and not for a few seconds
  assert.doesNotMatch(ko.auxBatterySpan(values()), /aux-age/);
});

test('overview row uses the shared span, keeps outside temperature aligned and has the level styles', () => {
  for (const file of ['ko', 'en']) {
    const source = readFileSync(`custom_components/carrot_ha/frontend/carrot-dashboard-${file}.js`, 'utf8');
    assert.match(source, /<span class="aux-sib">(외기|Outside) <b>\$\{n\(v\.outside_temp_c\)\}°C<\/b><\/span>\$\{this\.auxBatterySpan\(v\)\}/);
    assert.doesNotMatch(source, /<span>12V <b>/);
    // narrow screens: same vertical centering as the wide-screen rule
    assert.match(source, /\.mini-condition\{display:flex;justify-content:space-around;align-items:center;gap:8px;/);
    // beats ".overview-col-visual .mini-condition span b" (0,2,2) used from 820px up
    for (const level of ['caution', 'warn']) {
      assert.match(source, new RegExp(`\\.mini-condition \\.aux-battery b\\[data-aux="${level}"\\]\\{color:`));
    }
  }
  const debug = readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-debug.js', 'utf8');
  assert.match(debug, /\$\{card\.auxBatterySpan\(v\)\}/);
  assert.doesNotMatch(debug, /<span>12V <b>/);
});
