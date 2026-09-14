import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile(new URL('../custom_components/carrot_ha/frontend/carrot-trip-days.js',import.meta.url),'utf8');
const {tripDateKey,tripDays,loadRecentTrips,mergeConsecutiveCharges}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(tripDateKey('2026-09-13T15:01:00Z','Asia/Seoul'),'2026-09-14');
const days=tripDays([{data:{started_at:'2026-09-13T15:01:00Z'}},{data:{started_at:'2026-09-13T14:59:00Z'}}],'Asia/Seoul',new Date('2026-09-14T04:00:00Z'));
assert.equal(days.length,7);assert.equal(days[0].key,'2026-09-08');assert.deepEqual(days[6].indices,[0]);assert.deepEqual(days[5].indices,[1]);
const dst=tripDays([],'America/New_York',new Date('2026-03-09T04:30:00Z'));
assert.equal(dst[0].key,'2026-03-03');assert.equal(dst[6].key,'2026-03-09');
let calls=0;
const many=await loadRecentTrips(async (_,url)=>{calls++;return {events:Array.from({length:url.includes('offset=0&')?100:3},()=>({data:{}}))};},'device');
assert.equal(calls,2);assert.equal(many.events.length,103);
const latest={data:{started_at:'2025-01-01T00:00:00Z'}};
const fallback=await loadRecentTrips(async(_,url)=>({events:url.includes('since=')?[]:[latest]}),'device');
assert.deepEqual(fallback.events,[latest]);

// Test mergeConsecutiveCharges with 9/12 scenario:
const rawCharges = [
  { data: { id: 'c1', started_at: '2026-09-12T13:59:00Z', duration_s: 15420, energy_kwh: 24.25, partial: false } },
  { data: { id: 'c2', started_at: '2026-09-12T10:16:00Z', duration_s: 2460, energy_kwh: 24.85, partial: false } },
  { data: { id: 'c3', started_at: '2026-09-12T08:52:00Z', duration_s: 720, energy_kwh: 12.60, partial: true } },
  { data: { id: 'c4', started_at: '2026-09-12T08:32:00Z', duration_s: 960, energy_kwh: 30.15, partial: true } },
];
const merged = mergeConsecutiveCharges(rawCharges);
assert.equal(merged.length, 3);
assert.equal(merged[0].data.id, 'c1');
assert.equal(merged[1].data.id, 'c2');
const m = merged[2].data;
assert.equal(m.started_at, '2026-09-12T08:32:00Z');
assert.equal(m.duration_s, 960 + 720); // 1680s = 28 min
assert.equal(m.energy_kwh, 42.75);
assert.equal(m.merged, true);
assert.equal(m.merge_count, 2);
assert.equal(m.merge_gap_s, 240); // 4 min
assert.equal(m.merge_parts.length, 2);
assert.equal(m.partial, true);

// Test sessions with > 15min gap are NOT merged:
const separateCharges = [
  { data: { id: 's1', started_at: '2026-09-12T09:00:00Z', duration_s: 600, energy_kwh: 10 } },
  { data: { id: 's2', started_at: '2026-09-12T08:30:00Z', duration_s: 600, energy_kwh: 10 } }, // ends at 08:40, gap is 20m (1200s)
];
const notMerged = mergeConsecutiveCharges(separateCharges);
assert.equal(notMerged.length, 2);

console.log('Trip date grouping, timezone/DST, pagination, latest-trip fallback and charge merging passed.');

