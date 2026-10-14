import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './src/worker.js';
import {packTelemetry, unpackTelemetry, maintainArchive, compressed} from './src/archive_storage.js';
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('./schema.sql', import.meta.url),'utf8'));
let queries = 0;
const env = {SNAPSHOTS:{},WAYON_UPLOAD_TOKEN:'upload',WAYON_VIEW_TOKEN:'view',DB:{
  prepare(sql){queries++; let args=[]; const q=db.prepare(sql);return {
    bind(...v){args=v;return this},async first(){return q.get(...args)||null},
    async all(){return {results:q.all(...args)}},async run(){return q.run(...args)}};},
  async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
}};
async function call(path, body, token=body?'upload':'view') {
  const r=await worker.fetch(new Request('https://example.test'+path,{method:body?'POST':'GET',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env,{});
  return {status:r.status,body:await r.json()};
}
const sessions=Array.from({length:50},(_,i)=>({id:'s'+i,ended_at:'2026-09-01',energy_kwh:20,cost_krw:5000}));
const payload={deviceId:'car',updatedAt:'2026-09-01T00:00:00+00:00',onroad:false,vehicle:{
  battery_wh:50000,charge_sessions:sessions,charge_months:{'2026-09':{slow_kwh:200}},unicode:'한국어'}};
const packed=await packTelemetry(payload);
assert.ok(packed.hash);assert.deepEqual(JSON.parse(await unpackTelemetry(packed.raw,packed.context)),payload);
assert.ok(packed.raw.length+packed.context.length < JSON.stringify(payload).length/2);
await assert.rejects(unpackTelemetry(packed.raw),/Missing archive context/);
assert.equal((await call('/api/telemetry',payload)).status,200);
assert.equal((await call('/api/telemetry',{...payload,updatedAt:'2026-09-01T00:01:00+00:00'})).status,200);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM telemetry_contexts').get().n,1);
queries=0;
let feed=await call('/api/telemetry-history?device_id=car');
assert.equal(queries,1,'one indexed joined history query, no per-row lookup');
assert.deepEqual(JSON.parse(feed.body.events[0].raw_json),payload);
queries=0;
const transport=await call('/api/telemetry-history?device_id=car&encoding=carrot-cloud-archive-v1');
assert.equal(queries,1);
assert.equal(transport.body.encoding,'carrot-cloud-archive-v1');
assert.equal(Object.keys(transport.body.contexts).length,1,'shared contexts are sent once per page');
assert.deepEqual(JSON.parse(await unpackTelemetry(transport.body.events[0].raw_json,
  transport.body.contexts[transport.body.events[0].context_hash])),payload);
assert.equal((await call('/api/telemetry-history?encoding=invalid')).status,400);
assert.equal((await call('/api/telemetry-history?device_id=other')).body.events.length,0);
const second=feed.body.events[1].sequence;
await maintainArchive(env,Date.parse('2026-10-14'));
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM telemetry_history').get().n,2,'unacknowledged history cannot expire');
assert.equal((await call('/api/archive-ack',{device_id:'car',telemetry_sequence:second,trip_sequence:0},'bad')).status,401);
assert.equal((await call('/api/archive-ack',{device_id:'other',telemetry_sequence:second,trip_sequence:0},'view')).status,409);
assert.equal((await call('/api/archive-ack',{device_id:'car',telemetry_sequence:second+100,trip_sequence:0},'view')).status,409);
assert.equal((await call('/api/archive-ack',{device_id:'car',telemetry_sequence:second,trip_sequence:0},'view')).status,200);
await maintainArchive(env,Date.parse('2026-10-14'));
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM telemetry_history').get().n,0);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM telemetry_contexts').get().n,0);
assert.equal(db.prepare("SELECT bytes FROM archive_budget WHERE resource='telemetry'").get().bytes,0);
await call('/api/telemetry',{...payload,updatedAt:'2026-10-14T00:00:00Z'});
db.prepare("UPDATE archive_budget SET max_bytes=bytes WHERE resource='telemetry'").run();
assert.equal((await call('/api/telemetry',{...payload,updatedAt:'2026-10-14T00:01:00Z'})).status,503);
const latest=await call('/api/latest-state?device_id=car');
assert.equal(latest.body.state.updated_at,'2026-10-14T00:01:00Z','latest remains independently available at archive cap');
// Rollout mode accepts legacy schema and preserves exact original values.
const legacy=new DatabaseSync(':memory:');legacy.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8').split('-- Archive storage migration for new installations')[0]);
const oldDB=env.DB;
env.DB={prepare(sql){let args=[];const q=legacy.prepare(sql);return {bind(...v){args=v;return this},async first(){return q.get(...args)||null},async all(){return {results:q.all(...args)}},async run(){return q.run(...args)}}}};
env.ARCHIVE_STORAGE_V1='0';
assert.equal((await call('/api/telemetry',payload)).status,200);
feed=await call('/api/telemetry-history?device_id=car');
assert.deepEqual(JSON.parse(feed.body.events[0].raw_json),payload);
assert.equal((await call('/api/archive-ack',{device_id:'car',telemetry_sequence:1,trip_sequence:0},'view')).status,404);
assert.deepEqual(JSON.parse(await unpackTelemetry(await compressed(payload))),payload);
env.DB=oldDB;
console.log('PASS lossless codec/context dedup, single-query isolation, durable retention, quota backpressure and legacy rollout');
