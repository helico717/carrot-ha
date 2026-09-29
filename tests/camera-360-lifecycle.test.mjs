import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CarrotCamera360Modal} from '../custom_components/carrot_ha/frontend/carrot-camera-360.js';

function fixture() {
 const m=Object.create(CarrotCamera360Modal.prototype);
 Object.assign(m,{isOpen:true,sessionSeq:1,state:'connecting',retryCount:0,maxRetries:3,firstFrameTimeoutMs:45000,lang:'ko',realStreams:{},cameraEntities:{wide:'camera.wide',driver:'camera.driver'},hass:{states:{},callWS:async()=>({url:'/stream.m3u8'})},setState(s){this.state=s},_loadHls:async()=>{}});
 return m;
}
class Video extends EventTarget {
 readyState=0;
 pause(){}
 removeAttribute(){}
 load(){this.dispatchEvent(new Event('error'));}
}
test('cleanup errors do not consume retries and old readiness cannot restart playback',async()=>{
 const m=fixture();
 const oldDocument=globalThis.document;
 globalThis.document={createElement:()=>new Video()};
 try {
  await m.startRealSession(1);
  const oldRear=m.realStreams.rearVideo;
  const oldFront=m.realStreams.frontVideo;
  oldRear.dispatchEvent(new Event('error'));
  assert.equal(m.retryCount,1);
  assert.equal(m.state,'retrying');
  oldFront.readyState=oldRear.readyState=2;
  oldFront.dispatchEvent(new Event('loadeddata'));
  oldRear.dispatchEvent(new Event('error'));
  assert.equal(m.state,'retrying');
  assert.equal(m.retryCount,1);
  m.cleanupSession();
  assert.equal(m.retryTimer,null);
 } finally {globalThis.document=oldDocument;m.cleanupSession();}
});
test('closed or superseded URL request cannot create video players',async()=>{
 const m=fixture();let release;
 m.hass.callWS=()=>new Promise(r=>{release=r});
 // One shared pending request resolves both parallel API calls.
 const pending=new Promise(r=>{release=r});m.hass.callWS=()=>pending;
 const run=m.startRealSession(1);
 m.isOpen=false;m.cleanupSession();release({url:'/old.m3u8'});
 await run;
 assert.equal(m.realStreams.frontVideo,undefined);
});
test('HLS import finishing after teardown cannot allocate a player',async()=>{
 const m=fixture();let release;
 delete m._loadHls;
 m._ensureHls=()=>new Promise(r=>{release=r});
 const run=m._loadHls({},'/stale.m3u8',1);
 m.cleanupSession();release(true);
 await run;
 assert.equal(m.retryCount,0);
});
