import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-params-card.js', 'utf8');
const context = vm.createContext({HTMLElement: class {}, customElements: {get: () => true}, console});
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
