import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-params-card.js', 'utf8');
const context = vm.createContext({
  HTMLElement: class {},
  customElements: {get: () => true},
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
});
vm.runInContext(source.replace('export default CarrotParamsCard;', 'globalThis.Card = CarrotParamsCard;'), context);
const card = Object.create(context.Card.prototype);
Object.assign(card, {
  _catalog: {items_by_group: {조향: [{name: 'PathOffset', title: '차선 보정'}]}, categories: [
    {id: 'DRIVING', ko: '주행', groups: [{sections: [{items: ['PathOffset']}]}]}
  ]}, _activeCategory: 'DRIVING', _searchQuery: '', _values: {}, _expandedParams: new Set(), _pending: new Set()
});
assert.equal(card._filterItems(card._getAllItems()).length, 1);
card._activeCategory = 'OTHER';
assert.equal(card._filterItems(card._getAllItems()).length, 0);
card._catalog.categories = [];
assert.equal(card._getCategories()[1].id, '조향');
card._catalog = {items_by_group: {}, params: [{name: 'Fallback'}]};
assert.equal(card._getAllItems()[0].name, 'Fallback');
// Exercise the real input handler and list renderer with a stable input node.
const input = {value: '', focus() {}};
const clear = {};
const list = {innerHTML: ''};
card.shadowRoot = {
  getElementById: id => ({searchInput: input, searchClear: clear}[id] || null),
  querySelector: () => list,
  querySelectorAll: () => []
};
card._catalog = {params: [{name: 'PathOffset', title: '차선 보정', descr: ''}]};
card._activeCategory = 'ALL';
card._render = () => {throw new Error('Search must not replace the input DOM');};
card._bindEvents();
for (const text of ['ㅊ', '차', '차선', '차선 보정']) {
  input.value = text;
  input.oninput({target: input, isComposing: true});
  assert.equal(input.value, text);
  assert.equal(card._searchQuery, text);
}
assert.match(list.innerHTML, /PathOffset/);
input.value = '없는 검색어';
input.oninput({target: input});
assert.match(list.innerHTML, /검색 결과가 없습니다/);
clear.onclick();
assert.equal(input.value, '');
assert.match(list.innerHTML, /PathOffset/);
console.log('Parameter card: category, fallback, Korean input and clear checks passed');

// Test 2: Iframe and postMessage bridge tests
const iframeMessages = [];
const mockIframe = {
  contentWindow: {
    postMessage(data, targetOrigin) {
      iframeMessages.push({ data, targetOrigin });
    }
  },
  style: {}
};

const bridgeCard = Object.create(context.Card.prototype);
const apiCalls = [];
bridgeCard._hass = {
  callApi(method, path, body) {
    apiCalls.push({ method, path, body });
    return Promise.resolve({ ok: true });
  }
};
bridgeCard._entryId = 'test-entry-123';
bridgeCard._deviceId = 'test-id4';
bridgeCard._values = { PathOffset: 0 };
bridgeCard._pending = new Set();
bridgeCard._snapshotData = {
  catalog: { categories: [] },
  values: { PathOffset: 0 },
  device_id: 'test-id4'
};
bridgeCard.shadowRoot = {
  getElementById: id => (id === 'carrotSettingsFrame' ? mockIframe : null)
};

// Test carrot:ready triggers snapshot delivery
bridgeCard._iframeReady = false;
bridgeCard._handleWindowMessage({ data: { type: 'carrot:ready' } });
assert.equal(bridgeCard._iframeReady, true);
assert.equal(iframeMessages.length, 1);
assert.equal(iframeMessages[0].data.type, 'carrot:snapshot');
assert.equal(iframeMessages[0].data.data.device_id, 'test-id4');

// Test carrot:param_set triggers HA API call
bridgeCard._handleWindowMessage({ data: { type: 'carrot:param_set', name: 'PathOffset', value: 5 } });
await new Promise(r => setTimeout(r, 10));
assert.equal(apiCalls.length, 1);
assert.equal(apiCalls[0].method, 'POST');
assert.equal(apiCalls[0].path, 'carrot_ha/v1/param_set/test-entry-123');
assert.equal(apiCalls[0].body.name, 'PathOffset');
assert.equal(apiCalls[0].body.value, 5);
assert.equal(bridgeCard._values.PathOffset, 5);
assert.equal(bridgeCard._pending.has('PathOffset'), true);

// Test carrot:resize adjusts iframe height
bridgeCard._handleWindowMessage({ data: { type: 'carrot:resize', height: 950 } });
assert.equal(mockIframe.style.height, '950px');

// Test _render HTML contains iframe with settings.html
let renderedHtml = '';
bridgeCard.shadowRoot = {
  set innerHTML(html) { renderedHtml = html; },
  get innerHTML() { return renderedHtml; },
  getElementById: () => null
};
bridgeCard._render();
assert.match(renderedHtml, /<iframe/);
assert.match(renderedHtml, /\/carrot_ha_static\/carrot_web\/settings\.html/);

console.log('Parameter card: iframe bridge and postMessage integration tests passed');

