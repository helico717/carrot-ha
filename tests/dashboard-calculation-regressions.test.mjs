import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mergeConsecutiveTrips, mergeConsecutiveCharges, tripTimeline, tripDays} from '../custom_components/carrot_ha/frontend/carrot-trip-days.js';

globalThis.HTMLElement = class { attachShadow() { return {}; } };
globalThis.customElements = {get() {}, define() {}};
const {default: Korean} = await import('../custom_components/carrot_ha/frontend/carrot-dashboard-ko.js');
const {default: English} = await import('../custom_components/carrot_ha/frontend/carrot-dashboard-en.js');
const {default: Debug} = await import('../custom_components/carrot_ha/frontend/carrot-dashboard-debug.js');
const day = tripDays([], 'Asia/Seoul').at(-1).key;
const trip = (start, end, extra = {}) => ({data: {
  started_at: `${day}T${start}:00+09:00`, ended_at: `${day}T${end}:00+09:00`,
  duration_s: 600, distance_m: 10000, energy_wh: 2000, efficiency_km_kwh: 5, ...extra
}});

test('unknown or rejected energy never becomes zero consumption in merged trips', () => {
  for (const extra of [{energy_wh: undefined}, {energy_wh: 2000, energy_rejected: true}]) {
    const raw = [trip('08:00', '08:10'), trip('08:20', '08:30', extra), trip('08:40', '08:50')];
    const merged = mergeConsecutiveTrips(raw, 'Asia/Seoul')[0].data;
    assert.equal(merged.distance_m, 30000);
    assert.equal(merged.energy_wh, null);
    assert.equal(merged.efficiency_km_kwh, null);
    assert.equal(raw[0].data.energy_wh, 2000);
  }
  const valid = mergeConsecutiveTrips([trip('08:00','08:10'), trip('08:20','08:30', {energy_wh:3000})], 'Asia/Seoul')[0].data;
  assert.equal(valid.energy_wh, 5000);
  assert.equal(valid.efficiency_km_kwh, 4);
});

test('merged charge SOC follows the final boundary and sums estimated gains', () => {
  const raw = [trip('08:00','08:10', {energy_kwh:7.8, start_soc_percent:20, end_soc_percent:30, soc_charged_percent:10}),
    trip('08:15','08:25', {energy_kwh:7.8, start_soc_percent:30, end_soc_percent:40, soc_charged_percent:10})];
  const measured = mergeConsecutiveCharges(raw)[0].data;
  assert.equal(measured.energy_kwh, 15.6);
  assert.equal(measured.start_soc_percent, 20);
  assert.equal(measured.end_soc_percent, 40);
  assert.equal(measured.soc_charged_percent, 20);
  raw[1].data.soc_retroactive_estimated = true;
  delete raw[1].data.start_soc_percent;
  delete raw[1].data.end_soc_percent;
  const mixed = mergeConsecutiveCharges(raw)[0].data;
  assert.equal(mixed.soc_charged_percent, 20);
  assert.equal(mixed.end_soc_percent, null);
  assert.equal(mixed.soc_retroactive_estimated, true);
  delete raw[1].data.soc_charged_percent;
  assert.equal(mergeConsecutiveCharges(raw)[0].data.soc_charged_percent, null);
});

test('timeline uses HA local time and elapsed boundaries including stops', () => {
  const event = mergeConsecutiveTrips([trip('08:00','08:10'),trip('08:20','08:30')], 'Asia/Seoul')[0];
  assert.equal(event.data.duration_s, 1200);
  const seoul = tripTimeline(event, 'Asia/Seoul');
  assert.ok(Math.abs(seoul.leftPct - 100/3) < 1e-9);
  assert.ok(Math.abs(seoul.widthPct - 30/1440*100) < 1e-9);
  const utc = tripTimeline(event, 'UTC');
  assert.ok(Math.abs(utc.leftPct - 23/24*100) < 1e-9);
  const crossing = tripTimeline(trip('23:50','00:10', {ended_at:new Date(new Date(`${day}T23:50:00+09:00`).getTime()+1200000).toISOString()}), 'Asia/Seoul');
  assert.ok(Math.abs(crossing.leftPct + crossing.widthPct - 100) < 1e-9);
});

test('all dashboards retain explicit pagination with a selected trip', () => {
  const debug = Object.create(Debug.prototype);
  debug.state = {lang:'ko', theme:'dark', mode:'parked'};
  const debugCard = {v:{}, tab:'trips', selected:null, render(){}, vehicleStatus(){return {key:'parked',label:'parked'};}};
  debug.patchDashCard(debugCard);
  for (const card of [new Korean(), new English(), debugCard]) {
    card._hass = {config:{time_zone:'Asia/Seoul'}};
    card.trips = Array.from({length:9}, () => trip('08:00','08:10'));
    card.tripDay = day;
    card.selected = 0;
    card.tripHistory(true);
    card._tripPage = 2;
    const html = card.tripHistory(true);
    assert.equal(card._tripPage, 2);
    assert.equal(card.selected, 0);
    assert.match(html, /2 \/ 2/);
    card.selected = 1;
    card.tripHistory(true);
    assert.equal(card._tripPage, 1);
    card.selected = 8;
    card.tripHistory(true);
    assert.equal(card._tripPage, 2);
  }
});
