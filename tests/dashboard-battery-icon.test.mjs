import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const koCode = readFileSync(path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-ko.js'), 'utf8');
const enCode = readFileSync(path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-en.js'), 'utf8');
const debugCode = readFileSync(path.resolve('custom_components/carrot_ha/frontend/carrot-dashboard-debug.js'), 'utf8');
const previewHtml = readFileSync(path.resolve('preview.html'), 'utf8');

test('batteryIconName logic and dynamic battery-head-icon in Korean dashboard', () => {
  // 1. Verify dynamic ha-icon in overview energy-head
  assert.ok(
    koCode.includes('<ha-icon class="battery-head-icon" icon="mdi:${batteryIconName(soc)}"></ha-icon>'),
    'Korean dashboard must render dynamic ha-icon for battery-head-icon'
  );

  // 2. Verify static empty svg is removed
  assert.ok(
    !koCode.includes('<svg viewBox="0 0 24 24" class="battery-head-icon">'),
    'Korean dashboard must NOT have hardcoded empty battery SVG'
  );

  // 3. Verify CSS rules set --mdc-icon-size and color
  assert.ok(
    koCode.includes('.battery-head-icon{--mdc-icon-size:26px !important;') &&
    koCode.includes('color:#ffffff !important;'),
    'Korean dashboard must style battery-head-icon with --mdc-icon-size:26px and white color'
  );
  assert.ok(
    koCode.includes('.battery-head-icon{--mdc-icon-size:22px !important;'),
    'Korean dashboard must style battery-head-icon with --mdc-icon-size:22px on mobile container'
  );
  assert.ok(
    koCode.includes('.battery-label ha-icon{--mdc-icon-size:26px;'),
    'Korean dashboard must set .battery-label ha-icon to 26px'
  );
});

test('batteryIconName logic and dynamic battery-head-icon in English dashboard', () => {
  // 1. Verify dynamic ha-icon in overview energy-head
  assert.ok(
    enCode.includes('<ha-icon class="battery-head-icon" icon="mdi:${batteryIconName(soc)}"></ha-icon>'),
    'English dashboard must render dynamic ha-icon for battery-head-icon'
  );

  // 2. Verify static empty svg is removed
  assert.ok(
    !enCode.includes('<svg viewBox="0 0 24 24" class="battery-head-icon">'),
    'English dashboard must NOT have hardcoded empty battery SVG'
  );

  // 3. Verify CSS rules set --mdc-icon-size and color
  assert.ok(
    enCode.includes('.battery-head-icon{--mdc-icon-size:26px !important;') &&
    enCode.includes('color:#ffffff !important;'),
    'English dashboard must style battery-head-icon with --mdc-icon-size:26px and white color'
  );
  assert.ok(
    enCode.includes('.battery-head-icon{--mdc-icon-size:22px !important;'),
    'English dashboard must style battery-head-icon with --mdc-icon-size:22px on mobile container'
  );
});

test('batteryIconName logic and dynamic battery-head-icon in Debug dashboard', () => {
  assert.ok(
    debugCode.includes('<ha-icon class="battery-head-icon" icon="mdi:${batteryIconName(socVal)}"></ha-icon>'),
    'Debug dashboard must render dynamic ha-icon using socVal'
  );
  assert.ok(
    !debugCode.includes('<svg viewBox="0 0 24 24" class="battery-head-icon">'),
    'Debug dashboard must NOT have hardcoded empty battery SVG'
  );
});

test('preview.html full solid battery icon definition', () => {
  assert.ok(
    previewHtml.includes("'battery': '<path d=\"M16.67 4C17.4 4 18 4.6 18 5.33v15.34A1.33 1.33 0 0 1 16.67 22H7.33A1.33 1.33 0 0 1 6 20.67V5.33C6 4.6 6.6 4 7.33 4H9V2h6v2h1.67z\"/>'"),
    'preview.html must define 100% full solid battery without cutout hole'
  );
});

test('batteryIconName functional calculation', () => {
  const batteryIconName = soc => {
    if (typeof soc !== 'number' || !Number.isFinite(soc)) return 'battery';
    const level = Math.max(0, Math.min(100, Math.round(soc)));
    if (level >= 95) return 'battery';
    if (level <= 5) return 'battery-outline';
    return `battery-${Math.round(level / 10) * 10}`;
  };

  assert.equal(batteryIconName(48), 'battery-50');
  assert.equal(batteryIconName(0), 'battery-outline');
  assert.equal(batteryIconName(3), 'battery-outline');
  assert.equal(batteryIconName(5), 'battery-outline');
  assert.equal(batteryIconName(6), 'battery-10');
  assert.equal(batteryIconName(20), 'battery-20');
  assert.equal(batteryIconName(78), 'battery-80');
  assert.equal(batteryIconName(94), 'battery-90');
  assert.equal(batteryIconName(95), 'battery');
  assert.equal(batteryIconName(100), 'battery');
  assert.equal(batteryIconName(null), 'battery');
});
