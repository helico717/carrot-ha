import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const imports=[];const registry=new Map();
class Element {
  constructor(){this.style={};this.isConnected=false;}
  replaceChildren(child){if(this.child)this.child.remove();this.child=child;child.isConnected=this.isConnected;child.connectedCallback?.();}
  remove(){this.isConnected=false;this.child?.remove();}
}
const ctx=vm.createContext({URL,HTMLElement:Element,navigator:{language:'ko'},window:{},
  customElements:{get:tag=>registry.get(tag),define:(tag,Class)=>registry.set(tag,Class)},
  document:{createElement:tag=>new (registry.get(tag))()},
  load:async url=>{imports.push(url);return {default:class extends Element {setConfig(c){this.config=c;}set hass(h){this._hass=h;}}};}
});
const code=readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard-runtime.js','utf8')
  .replaceAll('import.meta.url',JSON.stringify('https://example.test/carrot-dashboard-runtime.js?v=0.8.6'))
  .replace('await import(moduleURL(filename))','await load(moduleURL(filename))');
vm.runInContext(code,ctx);
assert.equal(imports.length,0,'registering cards must not download implementations');
const Card=registry.get('carrot-dashboard-card');
const card=new Card();card.isConnected=true;
card.setConfig({});
assert.equal(imports.length,0,'wait for HA language instead of downloading wrong locale first');
card.hass={locale:{language:'ko'}};
await new Promise(resolve=>setImmediate(resolve));
assert.equal(imports.length,1);assert.match(imports[0],/carrot-dashboard-ko.js\?v=0.8.6$/);
assert.equal(card.card.card._hass.locale.language,'ko');
card.hass={locale:{language:'en'}};
await new Promise(resolve=>setImmediate(resolve));
assert.equal(imports.length,2);assert.match(imports[1],/carrot-dashboard-en.js/);
assert.equal(card.card.card._hass.locale.language,'en');
assert.ok(!imports.some(url=>/debug|params/.test(url)));
console.log('PASS lazy runtime imports only requested locale; config/hass and locale switches forwarded');
