const fs = require('fs');
const assert = require('assert');

// Read and isolate the VehicleJournal class logic
const raw = fs.readFileSync('custom_components/carrot_ha/frontend/carrot-vehicle-journal.js', 'utf8');
const classCode = raw.slice(raw.indexOf('// HA-local EV journal.'))
  .replace('export class VehicleJournal', 'class VehicleJournal')
  .replace(/export default VehicleJournal;/, '');

// Create a simulated DOM environment
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this._innerHTML = '';
    this.onclick = null;
    this.dataset = {};
  }
  set innerHTML(val) {
    this._innerHTML = val;
  }
  get innerHTML() {
    return this._innerHTML;
  }
  get textContent() {
    // Strip HTML tags
    return this._innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  querySelector(sel) {
    // Basic selector match
    return this;
  }
  querySelectorAll(sel) {
    return [];
  }
}

// Evaluate class in mock context
const context = {
  customElements: { get: () => null, define: () => {} },
  window: {},
  document: {
    createElement: tag => new MockElement(tag),
    head: { append: () => {} }
  },
  HTMLElement: class {
    attachShadow() {
      return { querySelector: () => null, querySelectorAll: () => [] };
    }
  },
  URL,
  Math,
  Date,
  String,
  Number,
  Boolean,
  Array,
  Object,
  JSON
};

const fn = new Function('context', `
  with(context) {
    ${classCode}
    return VehicleJournal;
  }
`);

const VehicleJournal = fn(context);

// Test 1: User's realistic entities
console.log('Test 1: Realistic HA Backup entities rendering');
const journal = new VehicleJournal();
const mockContainer = new MockElement('div');
journal.$ = id => id === 'backupStatus' ? mockContainer : null;
journal.selectSettingsSection = section => { journal.selectedSection = section; };

const realisticEntities = [
  { name: 'Backup 백업 관리자 상태', state: 'blocked', entity_id: 'sensor.backup_manager_state' },
  { name: 'Backup 다음 예약된 자동 백업', state: '2026-10-12T20:44:39+00:00', entity_id: 'sensor.backup_next_attempt' },
  { name: 'Backup 마지막으로 성공적으로 완료된 자동 백업', state: '2026-10-11T20:39:30+00:00', entity_id: 'sensor.backup_last_completed' },
  { name: 'Backup 마지막 자동 백업 시도', state: '2026-10-11T20:02:01+00:00', entity_id: 'sensor.backup_last_attempted' },
  { name: 'Backup 자동 백업', state: '2026-10-11T20:39:32.661+00:00', entity_id: 'sensor.backup_automatic' }
];

journal.renderBackupStatus(realisticEntities);

const html = mockContainer.innerHTML;
const text = mockContainer.textContent;

// 1. Overview banner exists
assert(html.includes('backup-overview-banner'), 'Missing overview banner');
assert(text.includes('차단됨 (대기 중)'), 'Missing blocked Korean label');
assert(html.includes('pill-warning'), 'Missing warning pill for blocked state');
assert(text.includes('백업 관리자 상태'), 'Cleaned manager title missing');

// 2. Schedule & History cards exist
assert(text.includes('다음 예약된 자동 백업'), 'Next backup card missing');
assert(text.includes('마지막으로 성공적으로 완료된 자동 백업'), 'Last success card missing');
assert(html.includes('sensor.backup_manager_state'), 'Missing entity_id in card');

// 3. Synology NAS guide card exists
assert(html.includes('backup-guide-card'), 'Missing Synology guide card');
assert(html.includes('data-jump-settings="backup"'), 'Missing jump settings button');
assert(text.includes('Synology NAS 백업 연계 안내'), 'Missing guide card title');
assert(text.includes('기존 HA 백업 상태를 표시해요'), 'Preserved original note text missing');

console.log('✓ Test 1 passed!');

// Test 2: Backward compatibility with existing vehicle-management.cjs test assertion
console.log('Test 2: vehicle-management.cjs compatibility check');
const testEntities = [{ name: '마지막 백업', state: '2026-10-12' }];
journal.renderBackupStatus(testEntities);
assert(mockContainer.textContent.includes('마지막 백업'), 'Compatibility error: textContent does not contain "마지막 백업"');
assert(mockContainer.textContent.includes('2026. 10. 12'), 'Formatted date missing in test entity');
console.log('✓ Test 2 passed!');

// Test 3: Empty entities array
console.log('Test 3: Empty entities fallback');
journal.renderBackupStatus([]);
assert(mockContainer.innerHTML.includes('backup-empty-card'), 'Empty card missing');
assert(mockContainer.textContent.includes('HA 백업 상태 엔티티가 없어요'), 'Empty message missing');
console.log('✓ Test 3 passed!');

// Test 4: Jump button click handler
console.log('Test 4: Jump button click');
journal.renderBackupStatus(realisticEntities);
journal.selectedSection = null;
mockContainer.onclick({
  target: {
    closest: sel => sel === '[data-jump-settings]' ? { dataset: { jumpSettings: 'backup' } } : null
  }
});
assert.strictEqual(journal.selectedSection, 'backup', 'Jump button did not switch to backup section');
console.log('✓ Test 4 passed!');

console.log('\nAll backup status UI tests completed successfully!');
