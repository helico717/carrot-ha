import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preserveView} from '../custom_components/carrot_ha/frontend/carrot-view-state.js';
test('refresh preserves HA shadow-host scroll, internal scroll, disclosure and focus even on failure',()=>{
  const parent={nodeType:1,scrollLeft:4,scrollTop:850};
  const card={nodeType:1,scrollLeft:0,scrollTop:0,parentNode:{host:{nodeType:1,scrollTop:0,scrollLeft:0}},assignedSlot:{parentNode:parent},style:{minHeight:''},getBoundingClientRect:()=>({height:1000})};
  const root={children:[],querySelectorAll(selector){return selector==='details'?this.children.filter(n=>n.tagName==='DETAILS'):this.children;}};
  const make=()=>{
    const nodes=[{tagName:'DETAILS',open:false},{tagName:'PRE',scrollTop:0,scrollLeft:0},{tagName:'INPUT',id:'filter',selectionStart:2,selectionEnd:4,focus(opts){this.focusOptions=opts;},setSelectionRange(a,b){this.range=[a,b];}}];
    for(const n of nodes)n.parentNode=root;root.children=nodes;return nodes;
  };
  card.shadowRoot=root;const old=make();old[0].open=true;old[1].scrollTop=170;root.activeElement=old[2];
  assert.throws(()=>preserveView(card,()=>{make();parent.scrollTop=0;throw Error('render');}));
  assert.equal(parent.scrollTop,850);assert.equal(parent.scrollLeft,4);
  assert.equal(root.children[0].open,true);assert.equal(root.children[1].scrollTop,170);
  assert.deepEqual(root.children[2].focusOptions,{preventScroll:true});assert.deepEqual(root.children[2].range,[2,4]);assert.equal(card.style.minHeight,'');
});
globalThis.HTMLElement=class {attachShadow(){}};
for(const lang of ['ko','en']){
  const Card=(await import(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`)).default;
  test(`${lang}: unchanged route keeps the same interactive map instance`,async()=>{
    const card=new Card(),container={};let replaced;
    card.shadowRoot={querySelector:()=>({replaceWith(node){replaced=node;}})};
    card.vehicleStatus=()=>({key:'parked'});card._mapContext='trip';
    const v={latitude:37,longitude:127};
    card._mapSignature=JSON.stringify(['trip',[],[],37,127,undefined,undefined,'parked']);
    const map={getContainer:()=>container,remove(){throw Error('must not destroy active map');}};card.map=map;
    await card.drawMap([],v,[]);
    assert.equal(card.map,map);assert.equal(replaced,container);
  });
}
