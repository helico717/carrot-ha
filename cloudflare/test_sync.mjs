import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './src/worker.js';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const env = {SNAPSHOTS:{}, WAYON_UPLOAD_TOKEN:'upload-test', WAYON_VIEW_TOKEN:'view-test', DB:{prepare(sql){
  const statement = sqlite.prepare(sql); let values=[];
  return {bind(...args){values=args; return this}, async run(){return statement.run(...values)}, async all(){return {results:statement.all(...values)}}, async first(){return statement.get(...values)??null}};
}}};
async function request(path, token='view-test', body){
  const r = new Request('https://example.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  return worker.fetch(r,env,{});
}
const telemetry={deviceId:'test-id4',updatedAt:'2026-09-09T01:00:00Z',onroad:false};
assert.equal((await request('/api/telemetry','upload-test',telemetry)).status,200);
// Lightweight state must issue only one indexed, device-scoped query.
const originalPrepare = env.DB.prepare;
const queries = [];
env.DB.prepare = sql => { queries.push(sql); return originalPrepare(sql); };
assert.equal((await request('/api/latest-state?device_id=test-id4', 'wrong')).status, 401);
assert.equal((await request('/api/latest-state')).status, 400);
assert.equal(queries.length, 0);
const latest = await (await request('/api/latest-state?device_id=test-id4')).json();
assert.deepEqual(Object.keys(latest), ['state']);
assert.equal(latest.state.device_id, 'test-id4');
assert.equal(queries.length, 1);
assert.match(queries[0], /WHERE device_id = \?/);
assert.equal((await (await request('/api/latest-state?device_id=missing')).json()).state, null);
env.DB.prepare = originalPrepare;

// Server-backed pagination must forward offset and route requirements.
const serverCalls = [];
env.WAYON_SERVER_SYNC_TOKEN = 'server-test';
env.WAYON_SERVER_API = {async fetch(url) {
  const params = new URL(url).searchParams;
  serverCalls.push(params);
  const offset = Number(params.get('offset'));
  return Response.json({schemaVersion:'wayon-trip-read-v1', trips:
    Array.from({length:Math.min(10, 27-offset)}, (_, i) => ({id:`server-${offset+i}`, route:[{latitude:37,longitude:127}]}))});
}};
const serverIds = new Set();
for (const offset of [0,10,20]) {
  const page = await (await request(`/api/trips?limit=10&offset=${offset}&include_route=true`)).json();
  for (const trip of page.trips) { serverIds.add(trip.id); assert.equal(trip.route[0].latitude,37); }
}
assert.equal(serverIds.size, 27);
assert.deepEqual(serverCalls.map(p=>p.get('offset')), ['0','10','20']);
assert.ok(serverCalls.every(p=>p.get('include_route')==='true'));
sqlite.close();
console.log('PASS: lightweight state auth/isolation/query count and server pagination with routes');
