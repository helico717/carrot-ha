import assert from 'node:assert/strict';
import {test} from 'node:test';
globalThis.HTMLElement=class {attachShadow(){return {querySelector:()=>null};}};
const classes=await Promise.all(['ko','en'].map(async lang=>(await import(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`)).default));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const [index,Card] of classes.entries()){
  test(`${index}: live renders while all history is blocked; history cannot overwrite live`,async()=>{
    const card=new Card();
    card.config={};card.render=()=>{};card.saveCache=()=>{};
    card.v={soc_percent:10,battery_history:['cached']};
    const history=deferred(),cloud=deferred();
    let calls=[];
    card._hass={callApi:async(method,path)=>{
      calls.push(path);
      if(path.endsWith('/devices'))return {devices:[{entry_id:'test'}]};
      if(path.includes('refresh=1'))return cloud.promise;
      if(path.includes('live=1'))return {values:{soc_percent:20}};
      if(path.includes('/dashboard/')){await history.promise;return {values:{soc_percent:15,battery_history:['new']}};}
      await history.promise;return {events:[]};
    }};
    const loading=card.load();await tick();
    assert.equal(card.v.soc_percent,20);
    assert.equal(card.busy,true);
    assert.deepEqual(card.v.battery_history,['cached']);
    cloud.resolve({values:{soc_percent:30}});await tick();
    assert.equal(card.v.soc_percent,30);
    history.resolve();await loading;
    assert.equal(card.v.soc_percent,30);
    assert.deepEqual(card.v.battery_history,['new']);
    assert.equal(calls.filter(x=>x.includes('refresh=1')).length,1);
  });
  test(`${index}: a history failure does not prevent live state`,async()=>{
    const card=new Card();card.config={};card.render=()=>{};card.saveCache=()=>{};
    card.v={soc_percent:10};
    card._hass={callApi:async(method,path)=>{
      if(path.endsWith('/devices'))return {devices:[{entry_id:'test'}]};
      if(path.includes('live=1'))return {values:{soc_percent:90}};
      throw Error('history unavailable');
    }};
    await card.load();await tick();
    assert.equal(card.v.soc_percent,90);
    assert.equal(card.isFromCache,false);
    assert.match(card.error,/history unavailable/);
  });
  test(`${index}: visibility resumes immediately and disconnect clears both timers`,()=>{
    let callback,removed;const intervals=new Map();
    const oldSet=globalThis.setInterval,oldClear=globalThis.clearInterval;
    globalThis.document={hidden:false,addEventListener:(name,fn)=>{callback=fn;},removeEventListener:(name,fn)=>{removed=fn;}};
    globalThis.setInterval=(fn,ms)=>{intervals.set(ms,fn);return ms;};
    globalThis.clearInterval=id=>intervals.delete(id);
    try{
      const card=new Card();let live=0,history=0;card._hass={};card.clearMiniMaps=()=>{};
      card.loadLive=()=>{live++;};card.load=()=>{history++;};
      card.connectedCallback();
      document.hidden=true;intervals.get(15000)();assert.equal(live,0);
      document.hidden=false;callback();assert.equal(live,1);assert.equal(history,1);
      card.disconnectedCallback();assert.equal(intervals.size,0);assert.equal(removed,callback);
    }finally{globalThis.setInterval=oldSet;globalThis.clearInterval=oldClear;delete globalThis.document;}
  });
}
