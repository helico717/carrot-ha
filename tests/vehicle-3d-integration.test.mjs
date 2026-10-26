import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const frontend = new URL('../custom_components/carrot_ha/frontend/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, frontend), 'utf8');
const {vehicleViewState, syncVehicle3d, DEFAULT_MODEL_URL} = await import(new URL('carrot-vehicle-3d.js', frontend));

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

test('expired or unknown values never light the lamp or open a door', () => {
  const state = vehicleViewState({door_driver_open: undefined, trunk_open: 'yes', light_low_beam_requested: null, speed_kph: 'fast'}, {key: 'parked'}, false);
  assert.equal(state.doors.fl, false);
  assert.equal(state.trunk, false);
  assert.equal(state.lowBeam, false);
  assert.equal(state.speedKph, 0);
  assert.equal(state.driving, false);
});

test('without a model file the PNG stays and the model is not probed again on every render', async () => {
  let probes = 0;
  globalThis.fetch = async (url, options) => { probes += 1; assert.equal(options.method, 'HEAD'); return {ok: false}; };
  const box = {isConnected: true, appendChild() { throw Error('no viewer container without a model'); }, querySelector: () => null};
  const card = {config: {vehicle_3d_model: '/missing/model.glb'}, shadowRoot: {querySelector: () => box}};
  await syncVehicle3d(card, {v: {}, status: {key: 'parked'}, dark: false});
  await syncVehicle3d(card, {v: {}, status: {key: 'parked'}, dark: false});
  assert.equal(probes, 1);
  assert.equal(card._v3d.viewer, null);
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

test('the 3D module adds no data requests: only a HEAD probe of the model file', () => {
  const source = read('carrot-vehicle-3d.js');
  assert.equal((source.match(/fetch\(/g) || []).length, 1);
  assert.match(source, /method: 'HEAD'/);
  assert.doesNotMatch(source, /callApi|WebSocket|api\/carrot_ha/);
});

test('view patching leaves the 3D container to its owner, like the Leaflet map', () => {
  assert.match(read('carrot-view-state.js'), /\['map','vehicle3d'\]\.some\(/);
});
