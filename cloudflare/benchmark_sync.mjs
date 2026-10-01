// Synthetic protocol benchmark, not production D1 billing or vehicle latency.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './src/worker.js';
const db=new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
let queries=0;
const env={SNAPSHOTS:{},WAYON_VIEW_TOKEN:'test',DB:{prepare(sql){queries++;const q=db.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return q.get(...args)??null;},async all(){return {results:q.all(...args)};},async run(){return q.run(...args);}};}}};
const route=JSON.stringify(Array.from({length:1000},(_,i)=>({latitude:37+i/100000,longitude:127+i/100000,speedMps:10})));
const insert=db.prepare('INSERT INTO trips(id,device_id,started_at,ended_at,duration_s,distance_m,route_point_count,route_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
for(let i=0;i<100;i++)insert.run('trip-'+i,'car','2026-10-01T01:00:00Z','2026-10-01T01:30:00Z',1800,10000,1000,route,'2026-10-01T01:30:00Z');
const cursor=db.prepare('SELECT MAX(sequence) AS n FROM trip_sync_revision').get().n;
async function bytes(path){const r=await worker.fetch(new Request('https://example.test'+path,{headers:{Authorization:'Bearer test'}}),env,{});assert.equal(r.status,200);return Buffer.byteLength(await r.text());}
let oldBytes=0;queries=0;
const warn=console.warn;console.warn=()=>{};
try{for(let offset=0;offset<100;offset+=10)oldBytes+=await bytes(`/api/trips?limit=10&offset=${offset}&include_route=true`);}finally{console.warn=warn;}
const oldQueries=queries;queries=0;
const newBytes=await bytes(`/api/trip-changes?device_id=car&after=${cursor}`);
assert.equal(queries,1);assert.ok(newBytes<512);assert.ok(oldBytes>newBytes*1000);
console.log(JSON.stringify({fixture:{trips:100,points_per_trip:1000},unchanged_full_history:{requests:10,sql_queries:oldQueries,bytes:oldBytes},incremental:{requests:1,sql_queries:queries,bytes:newBytes},payload_reduction_percent:Number((100*(1-newBytes/oldBytes)).toFixed(3))},null,2));
