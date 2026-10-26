import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const frontend = new URL('../custom_components/carrot_ha/frontend/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, frontend), 'utf8');
const {vehicleViewState, syncVehicle3d, loadModel, warmVehicle3d, headingBottom, openpilotEngaged, DEFAULT_MODEL_URL} = await import(new URL('carrot-vehicle-3d.js', frontend));

test('vehicle state maps door, trunk, low beam, speed and driving from the values the card already has', () => {
  const state = vehicleViewState({door_driver_open: true, door_passenger_open: false, door_rear_driver_open: true,
    door_rear_passenger_open: null, trunk_open: true, light_low_beam_requested: true, speed_kph: 62}, {key: 'driving'}, true);
  assert.deepEqual(state.doors, {fl: true, fr: false, rl: true, rr: false});
  assert.equal(state.trunk, true);
  assert.equal(state.lowBeam, true);
  assert.equal(state.driving, true);
  assert.equal(state.speedKph, 62);
  assert.equal(state.dark, true);
});

test('charging state comes from the card status and the values it already has', () => {
  const charging = vehicleViewState({soc_percent: 62, charge_power_kw: 50, charge_mode: 'dc_charging'}, {key: 'charging'}, false);
  assert.deepEqual([charging.charging, charging.chargeKind, charging.chargePowerKw, charging.soc], [true, 'dc', 50, 62]);
  const watts = vehicleViewState({soc_percent: 40, charge_power_w: 7200}, {key: 'charging'}, false);
  assert.deepEqual([watts.chargeKind, watts.chargePowerKw], ['ac', 7.2]);
  const parked = vehicleViewState({soc_percent: 62, charge_power_kw: 50}, {key: 'parked'}, false);
  assert.equal(parked.charging, false, 'only the card status switches the charging scene on');
  assert.equal(vehicleViewState({}, {key: 'charging'}, false).soc, null);
});

test('expired or unknown values never light the lamp or open a door', () => {
  const state = vehicleViewState({door_driver_open: undefined, trunk_open: 'yes', light_low_beam_requested: null, speed_kph: 'fast'}, {key: 'parked'}, false);
  assert.equal(state.doors.fl, false);
  assert.equal(state.trunk, false);
  assert.equal(state.lowBeam, false);
  assert.equal(state.speedKph, 0);
  assert.equal(state.driving, false);
});

test('without a model file the PNG stays and the model is not requested again on every render', async () => {
  let requests = 0;
  globalThis.fetch = async url => { requests += 1; assert.equal(url, '/missing/model.glb'); return {ok: false, status: 404}; };
  const box = {isConnected: true, appendChild() { throw Error('no viewer container without a model'); }, querySelector: () => null};
  const card = {config: {vehicle_3d_model: '/missing/model.glb'}, shadowRoot: {querySelector: () => box}};
  await syncVehicle3d(card, {v: {}, status: {key: 'parked'}, dark: false});
  await syncVehicle3d(card, {v: {}, status: {key: 'parked'}, dark: false});
  assert.equal(requests, 1);
  assert.equal(card._v3d.viewer, null);
});

test('the model is downloaded once per page load, and warm-up shares that download', async () => {
  let requests = 0;
  const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
  globalThis.fetch = async () => { requests += 1; return {ok: true, status: 200, headers: {get: () => '"etag"'}, arrayBuffer: async () => bytes}; };
  warmVehicle3d({vehicle_3d_model: '/warm/model.glb'});
  const a = await loadModel('/warm/model.glb');
  const b = await loadModel('/warm/model.glb');
  assert.equal(requests, 1);
  assert.equal(a, b);
  assert.equal(a.source, 'network');
  assert.equal(a.buffer.byteLength, 4);
});

test('warm-up is skipped when 3D is switched off', async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return {ok: false}; };
  warmVehicle3d({vehicle_3d: false, vehicle_3d_model: '/off/model.glb'});
  assert.equal(requests, 0);
});

test('3D can be switched off and the viewer is released when the container disappears', async () => {
  let disposed = 0;
  const card = {config: {vehicle_3d: false}, shadowRoot: {querySelector: () => ({})}, _v3d: {viewer: {dispose() { disposed += 1; }}, stage: {remove() {}}}};
  await syncVehicle3d(card, {v: {}, status: {key: 'parked'}, dark: false});
  assert.equal(disposed, 1);
  assert.equal(card._v3d, null);
  const gone = {config: {}, shadowRoot: {querySelector: () => null}, _v3d: {viewer: {dispose() { disposed += 1; }}, stage: {remove() {}}}};
  await syncVehicle3d(gone, {v: {}, status: {key: 'parked'}, dark: false});
  assert.equal(disposed, 2);
});

test('default model location is a local path outside the repository', () => {
  assert.equal(DEFAULT_MODEL_URL, '/carrot_ha_models/vehicle.glb');
  assert.equal(fs.existsSync(new URL('carrot-assets/vehicle.glb', frontend)), false);
  const ignored = fs.readFileSync(new URL('../../../.gitignore', frontend), 'utf8');
  assert.match(ignored, /\*\.glb/);
});

for (const lang of ['ko', 'en']) {
  test(`${lang}: dashboard loads the 3D module lazily and only reads state it already holds`, () => {
    const source = read(`carrot-dashboard-${lang}.js`);
    assert.doesNotMatch(source, /^(import|const .*await import).*carrot-vehicle-3d/m, 'must not load 3D eagerly');
    assert.match(source, /import\(dependencyURL\('\.\/carrot-vehicle-3d\.js'\)\)/);
    assert.match(source, /this\.syncVehicle3d\(v,state\);/);
    assert.match(source, /<div class="car-image vehicle3d">\$\{fallback\}<\/div>/);
  });
}

globalThis.HTMLElement = class { attachShadow() {} };
for (const lang of ['ko', 'en']) {
  const Card = (await import(new URL(`carrot-dashboard-${lang}.js`, frontend))).default;
  const image = config => Card.prototype.vehicleImage.call({config});
  test(`${lang}: the 3D container is used for every image layout, with the configured image as fallback`, () => {
    // Regression: a card configured with the legacy ID.4 crop used to bypass 3D entirely.
    const legacy = image({vehicle_image_layout: 'legacy_id4', vehicle_image: '/local/carrot-assets/id4.png', vehicle_name: 'ID.4 PRO'});
    assert.match(legacy, /^<div class="car-image vehicle3d"><svg class="v3d-fallback" viewBox="1000 552 2120 1680"/);
    assert.match(legacy, /href="\/local\/carrot-assets\/id4\.png"/);
    const plain = image({vehicle_image: '/local/x.png'});
    assert.match(plain, /^<div class="car-image vehicle3d"><img class="v3d-fallback" src="\/local\/x\.png"/);
    const bare = image({});
    assert.match(bare, /class="car-image vehicle3d"/);
  });
  test(`${lang}: vehicle_3d false returns the original image markup`, () => {
    assert.match(image({vehicle_3d: false, vehicle_image_layout: 'legacy_id4', vehicle_image: '/a.png'}), /^<svg class="car-image" viewBox="1000 552 2120 1680"/);
    assert.match(image({vehicle_3d: false, vehicle_image: '/a.png'}), /^<img class="car-image" src="\/a\.png"/);
    assert.doesNotMatch(image({vehicle_3d: false}), /vehicle3d/);
  });
}

for (const lang of ['ko', 'en']) {
  test(`${lang}: the 3D card is a little taller on phones, and only the 3D container is`, () => {
    const source = read(`carrot-dashboard-${lang}.js`);
    const phone = source.indexOf('@container(max-width:700px){.hero{min-height:190px}');
    assert.ok(phone >= 0);
    assert.match(source.slice(phone, phone + 400), /\.hero \.car-image\{height:155px;width:100%;padding:5px 12px\}\.hero \.car-image\.vehicle3d\{height:195px\}/);
  });
}

test('the 3D module adds no data requests: it only fetches the model file itself', () => {
  const source = read('carrot-vehicle-3d.js');
  assert.equal((source.match(/fetch\(/g) || []).length, 1);
  assert.doesNotMatch(source, /callApi|WebSocket|api\/carrot_ha/);
  // The local copy lives in IndexedDB: localStorage cannot hold a binary model.
  assert.match(source, /indexedDB\.open/);
  assert.doesNotMatch(source, /localStorage\./);
});

for (const lang of ['ko', 'en']) {
  test(`${lang}: the 3D container receives pointer events (the card style disables them on .car-image)`, () => {
    const source = read(`carrot-dashboard-${lang}.js`);
    const disabled = source.indexOf('.hero .car-image{position:absolute;width:100%;height:100%;object-fit:cover;inset:0 0 auto;pointer-events:none}');
    const enabled = source.indexOf('.hero .vehicle3d,.hero .vehicle3d .v3d-stage{pointer-events:auto}');
    assert.ok(disabled >= 0 && enabled > disabled, 'the enabling rule must come after the rule that disables pointer events');
    assert.match(source, /warmVehicle3d\(config\)/);
  });
}

test('view patching leaves the 3D container to its owner, like the Leaflet map', () => {
  assert.match(read('carrot-view-state.js'), /\['map','vehicle3d'\]\.some\(/);
});


test('vehicle gestures stay on the shared viewer in default and free-look modes', () => {
  const source = fs.readFileSync(new URL('../tools/vehicle3d/viewer.src.js', import.meta.url), 'utf8');
  assert.match(source, /touch-action:none/);
  assert.doesNotMatch(source, /touch-action:pan-y|touchAction.*pan-y/);
  assert.match(source, /setFreeLook\(on\)[\s\S]*?canvas\.style\.touchAction = 'none'/);
  const wheel = source.slice(source.indexOf("canvas.addEventListener('wheel'"), source.indexOf("canvas.addEventListener('dblclick'"));
  assert.ok(wheel.indexOf('e.preventDefault()') < wheel.indexOf('offset.zoom = clampZoom'));
  assert.doesNotMatch(wheel, /ctrlKey/, 'a plain mouse wheel zooms, not only ctrl+wheel / pinch');
  assert.match(wheel, /passive: false/);
  assert.match(wheel, /offset\.zoom = clampZoom/);
  for (const lang of ['ko', 'en']) assert.match(read(`carrot-dashboard-${lang}.js`), /carrot-vehicle-3d\.js/);
});

test('the car is framed below the card heading, and the open-door view leaves room for the tailgate', () => {
  const rect = (top, bottom) => ({getBoundingClientRect: () => ({top, bottom})});
  const box = {parentElement: {querySelector: sel => sel === '.hero-copy' ? rect(214, 272) : null}};
  assert.equal(headingBottom(box, rect(214, 616)), 58);
  assert.equal(headingBottom(box, rect(300, 500)), 0, 'a heading above the stage does not inset it');
  assert.equal(headingBottom({parentElement: {querySelector: () => null}}, rect(0, 100)), 0);
  const source = fs.readFileSync(new URL('../tools/vehicle3d/viewer.src.js', import.meta.url), 'utf8');
  assert.match(source, /setViewOffset\(size\.w, size\.h - size\.top, 0, -size\.top, size\.w, size\.h\)/);
  assert.match(source, /top: \{\.\.\.tele\([^\n]*needV: 4\.6\}/);
  assert.match(read('carrot-vehicle-3d.js'), /frameTop: \(\) => headingBottom\(box, stage\)/);
});

test('openpilot engagement comes from the enabled entity, falling back to the card data', () => {
  const v = {enabled: false, entity_ids: {enabled: 'binary_sensor.id_4_enabled'}};
  const hass = state => ({states: {'binary_sensor.id_4_enabled': {state}}});
  assert.equal(openpilotEngaged(v, hass('on')), true);
  assert.equal(openpilotEngaged({...v, enabled: true}, hass('off')), false, 'the entity wins over the card value');
  assert.equal(openpilotEngaged({...v, enabled: true}, hass('unavailable')), true, 'unknown entity state falls back to the card value');
  assert.equal(openpilotEngaged({enabled: true}, {states: {}}), true);
  assert.equal(openpilotEngaged({}, {states: {'binary_sensor.custom': {state: 'on'}}}, {openpilot_entity: 'binary_sensor.custom'}), true);
  assert.equal(vehicleViewState({}, {key: 'driving'}, false, true).openpilot, true);
  assert.equal(vehicleViewState({}, {key: 'driving'}, false).openpilot, false);
});

test('while driving the doors are drawn closed, lanes follow openpilot, and the drive view backs off', () => {
  const source = fs.readFileSync(new URL('../tools/vehicle3d/viewer.src.js', import.meta.url), 'utf8');
  assert.match(source, /const want = !state\.driving && \(key === 'trunk' \? state\.trunk : state\.doors\[key\]\);/);
  assert.match(source, /const laneTarget = state\.openpilot \? LANE_ON : LANE_OFF;/);
  assert.match(source, /LANE_OFF = new THREE\.Color\(0x9aa3a8\)/);
  assert.match(source, /drive: \{\.\.\.tele\(\{pos: \[-4\.4, 3\.5, -3\.85\], look: \[0, 0\.55, 0\.85\][^\n]*pad: 1\.15\}/);
  assert.match(source, /LANE_ON = new THREE\.Color\(0x1fff5e\)/);
  assert.match(source, /'soc', 'openpilot'\]\) if \(key in next\)/);
  assert.match(read('carrot-vehicle-3d.js'), /vehicleViewState\(v, status, dark, openpilotEngaged\(v, card\._hass, card\.config\)\)/);
});
