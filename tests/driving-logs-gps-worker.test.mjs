import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const raw={HUD_SERVICES:['gpsLocationExternal','carState'],decodeReplayEvent(bytes,expected,excluded,included){
 const gps=bytes[0]!==2,service=gps?'gpsLocationExternal':'carState';
 if(included&&!included.has(service))return null;
 return {service,valid:bytes[0]!==3,logMonoTime:1e9+bytes[0]*1e6,decoded:gps?{latitude:37.1,longitude:127.1,hasFix:true}:{vEgo:10}};
}};
const self={CarrotRawCapnp:raw,importScripts(){}};
const context=vm.createContext({self,console,TextDecoder,Uint8Array});
vm.runInContext(readFileSync('custom_components/carrot_ha/frontend/carrot_logs/js/realtime/replay_log_worker.js','utf8')+'\nself.TestBuilder=ReplayLogBuilder;',context);
const builder=new self.TestBuilder(0,true);
for(const id of [1,2,3])builder.ingest(new Uint8Array([id]));
const result=builder.finish();
assert.equal(result.records.length,1);
assert.equal(result.records[0].frames[0].service,'gpsLocationExternal');
assert.equal(result.metadata.services.carState,undefined);
assert.equal(result.metadata.services.gpsLocationExternal,1);
assert.equal(new self.TestBuilder(0,true).finish().records.length,0);
assert.throws(()=>new self.TestBuilder(0,false).finish(),/no Carrot Vision/);
console.log('PASS GPS-only decoder: selected services, invalid fix events excluded, empty GPS and original replay semantics');

// A synthetic wire-level Event/GpsLocationData, decoded by the actual schema.
const wire=new Uint8Array(104), view=new DataView(wire.buffer);
view.setUint32(4,12,true); // one segment, twelve words
view.setUint32(12,0x00010002,true); // root: two data words, one pointer
view.setBigUint64(16,1000000000n,true);
view.setUint16(24,47,true); // gpsLocationExternal discriminant
view.setUint32(36,8,true); // payload: eight data words
view.setFloat64(48,37.5,true);view.setFloat64(56,127.0,true);wire[100]=1; // hasFix
const actual=vm.createContext({console,TextDecoder,Uint8Array,DataView,ArrayBuffer,importScripts(){}});
actual.self=actual;
vm.runInContext(readFileSync('custom_components/carrot_ha/frontend/carrot_logs/js/realtime/raw_capnp.js','utf8'),actual);
vm.runInContext(readFileSync('custom_components/carrot_ha/frontend/carrot_logs/js/realtime/replay_log_worker.js','utf8')+'\nself.TestBuilder=ReplayLogBuilder;',actual);
const realBuilder=new actual.TestBuilder(0,true);realBuilder.push(wire);
const fix=realBuilder.finish().records[0].frames[0].decoded;
assert.equal(fix.latitude,37.5);assert.equal(fix.longitude,127);assert.equal(fix.hasFix,true);
console.log('PASS real Cap\'n Proto GPS wire decoding through original replay builder');
