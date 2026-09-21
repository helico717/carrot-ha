import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src = fs.readFileSync('cloudflare/src/worker.js','utf8');
const start=src.indexOf('async function handleParamsQueue');
const end=src.indexOf('async function handleCleanup', start);
const ctx=vm.createContext({URL,authorize:()=>true,json:(body,status=200)=>({body,status})});
vm.runInContext(src.slice(start,end)+'\nglobalThis.api={handleParamsQueue,handleParamsStatus,handleParamsPending,handleParamsAck};',ctx);
const statements=[];
const env={DB:{prepare(sql){return {bind(...args){statements.push({sql,args});return {
 first:async()=>({catalog_json:JSON.stringify({params:[{name:'Test',min:0,max:10}]})}),
 all:async()=>({results:[{id:45,param_name:'Test',status:'pending'}]}),run:async()=>({meta:{last_row_id:45}})
};}};},batch:async()=>[{meta:{last_row_id:45}}]}};
const queue=body=>ctx.api.handleParamsQueue({json:async()=>body},env);
assert.equal((await queue({device_id:'a',param_name:'Test',param_value:99})).status,400);
assert.equal((await queue({device_id:'a',param_name:'Removed',param_value:1})).status,400);
const result=await queue({device_id:'a',param_name:'Test',param_value:4});
assert.equal(result.body.ids[0],45);
await ctx.api.handleParamsStatus({url:'http://worker/api/params/status?device_id=a&ids=45,46'},env);
assert.match(statements.at(-1).sql,/id IN/);
assert.deepEqual(statements.at(-1).args,['a','45','46']);
assert.equal((await ctx.api.handleParamsStatus({url:'http://worker/api/params/status?device_id=a&ids=bad'},env)).status,400);

// Test pending TTL expiration query
await ctx.api.handleParamsPending({url:'http://worker/api/params/pending?device_id=a'},env);
const expireStmt = statements.find(s => s.sql.includes("status = 'expired'"));
assert.ok(expireStmt, 'handleParamsPending must execute TTL expiration update');

// Test ACK updates queue status and does NOT update carrot_settings_cache
statements.length = 0;
const ackResult = await ctx.api.handleParamsAck({json: async() => ({device_id: 'a', applied_ids: [45], current_values: {Test: 4}})}, env);
assert.equal(ackResult.status, 200);
assert.equal(ackResult.body.acked, 1);
assert.ok(statements.some(s => s.sql.includes("status = 'applied'")), 'ACK must update queue status to applied');
assert.ok(!statements.some(s => s.sql.includes('carrot_settings_cache')), 'ACK must not directly overwrite carrot_settings_cache');

console.log('Worker: catalog validation, queue IDs, exact ID status, pending TTL and safe ACK passed');
