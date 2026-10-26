// Interactive 3D vehicle for the dashboard hero card.
//
// The card keeps rendering its normal PNG. When a local model file exists and WebGL works,
// this module mounts the viewer on top of it and feeds it the vehicle state the card already
// holds (doors, trunk, low beam, speed, driving state). It never issues its own cloud or HA
// requests for vehicle data, so it cannot add query load (see docs/modular-ev-dashboard-architecture.md).
//
// The shared viewer owns gestures on its canvas: swipes and wheel input stay there,
// while scrolling outside the vehicle remains available in production and debug cards.
// The model itself is a user-supplied file (see docs/VEHICLE_3D_MODEL.md) and is never shipped
// in this repository; without it the card silently keeps the PNG.
const version = new URL(import.meta.url).searchParams.get('v');
const versioned = name => {
  const url = new URL(name, import.meta.url);
  if (version) url.searchParams.set('v', version);
  return url.href;
};

export const DEFAULT_MODEL_URL = '/carrot_ha_models/vehicle.glb';

let viewerModule = null;
let webglBroken = false;

// ---- model download with a persistent local copy -------------------------------------------
// The first visit downloads the file; later visits start from the copy kept in this browser's
// IndexedDB (localStorage is too small for a binary model) and only revalidate it in the
// background with its ETag, so a changed model is picked up on the following visit.
const DB_NAME = 'carrot-ha-vehicle-3d';
const modelLoads = new Map();

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('indexeddb-unavailable')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('models');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedModel(url, value) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('models', value ? 'readwrite' : 'readonly');
      const request = value ? tx.objectStore('models').put(value, url) : tx.objectStore('models').get(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function download(url, headers) {
  const response = await fetch(url, headers ? {headers, cache: 'no-cache'} : undefined);
  if (response.status === 304) return {notModified: true};
  if (!response.ok) return null;
  return {buffer: await response.arrayBuffer(), etag: response.headers.get('ETag')};
}

async function revalidate(url, cached) {
  try {
    const fresh = await download(url, cached.etag ? {'If-None-Match': cached.etag} : undefined);
    if (fresh?.buffer) await storedModel(url, {buffer: fresh.buffer, etag: fresh.etag});
  } catch (error) { /* offline or slow: keep using the stored copy */ }
}

// Resolves with the model bytes, or null when there is no model file. Memoised per page load.
export function loadModel(url) {
  if (!modelLoads.has(url)) {
    modelLoads.set(url, (async () => {
      let cached = null;
      try { cached = await storedModel(url); } catch (error) { /* private mode: no local copy */ }
      if (cached?.buffer) {
        revalidate(url, cached);
        return {buffer: cached.buffer, source: 'local'};
      }
      const fresh = await download(url);
      if (!fresh?.buffer) return null;
      storedModel(url, {buffer: fresh.buffer, etag: fresh.etag}).catch(() => {});
      return {buffer: fresh.buffer, source: 'network'};
    })().catch(() => null));
  }
  return modelLoads.get(url);
}

const loadViewerModule = () => (viewerModule ||= import(versioned('./carrot-assets/vehicle-3d.js')));

function modelUrlOf(config) {
  return config?.vehicle_3d_model || DEFAULT_MODEL_URL;
}

// Start the downloads as soon as the card is configured, in parallel with its own data requests,
// so the model is usually ready by the time the overview renders.
export function warmVehicle3d(config) {
  if (config?.vehicle_3d === false || webglBroken) return;
  loadModel(modelUrlOf(config));
  loadViewerModule().catch(() => {});
}

export function vehicleViewState(v, status, dark) {
  const open = key => v?.[key] === true;
  return {
    doors: {
      fl: open('door_driver_open'),
      fr: open('door_passenger_open'),
      rl: open('door_rear_driver_open'),
      rr: open('door_rear_passenger_open'),
    },
    trunk: open('trunk_open'),
    lowBeam: v?.light_low_beam_requested === true,
    driving: status?.key === 'driving',
    speedKph: Number.isFinite(v?.speed_kph) ? v.speed_kph : 0,
    dark: Boolean(dark),
    // Charging scene: only while the card itself shows the vehicle as charging.
    charging: status?.key === 'charging',
    chargeKind: v?.charge_mode === 'dc_charging' ? 'dc' : 'ac',
    chargePowerKw: Number.isFinite(v?.charge_power_kw) ? v.charge_power_kw : (Number.isFinite(v?.charge_power_w) ? v.charge_power_w / 1000 : null),
    soc: Number.isFinite(v?.soc_percent) ? v.soc_percent : null,
  };
}

export function disposeVehicle3d(card) {
  const holder = card._v3d;
  if (holder?.viewer) {
    try { holder.viewer.dispose(); } catch (error) { /* already gone with its container */ }
  }
  holder?.stage?.remove();
  card._v3d = null;
}

// Called after every render. Cheap when the viewer already exists: it only pushes the new state.
export async function syncVehicle3d(card, {v, status, dark}) {
  const box = card.shadowRoot?.querySelector('.vehicle3d');
  let holder = card._v3d;
  if (!box || card.config?.vehicle_3d === false) {
    if (holder) disposeVehicle3d(card);
    return;
  }
  const next = vehicleViewState(v, status, dark);
  if (holder && holder.box === box) {
    holder.pending = next;
    if (holder.viewer) holder.viewer.setState(next);
    return;
  }
  if (holder) disposeVehicle3d(card);
  if (webglBroken) return;
  holder = card._v3d = {box, pending: next, viewer: null, stage: null};
  const url = modelUrlOf(card.config);
  const started = performance.now();
  try {
    const [model, module] = await Promise.all([loadModel(url), loadViewerModule()]);
    if (!model) return; // no model file: keep the image
    holder.timing = {downloadMs: Math.round(performance.now() - started), source: model.source};
    if (card._v3d !== holder || !box.isConnected) return;
    const stage = document.createElement('div');
    stage.className = 'v3d-stage';
    box.appendChild(stage);
    holder.stage = stage;
    const viewer = await module.createVehicleViewer(stage, {
      modelUrl: url,
      modelBuffer: model.buffer.slice(0),
      bodyColor: card.config?.vehicle_3d_color,
      label: card.config?.vehicle_name || 'Carrot HA',
    });
    if (card._v3d !== holder || !box.isConnected) {
      viewer.dispose();
      return;
    }
    holder.viewer = viewer;
    holder.timing.totalMs = Math.round(performance.now() - started);
    viewer.setState(holder.pending);
    const fallback = box.querySelector('.v3d-fallback');
    if (fallback) fallback.style.visibility = 'hidden';
  } catch (error) {
    // No WebGL, a corrupt model or a network error: keep the PNG and do not retry on every render.
    if (error?.message === 'webgl-unavailable') webglBroken = true;
    console.warn('Carrot HA: 3D vehicle disabled', error);
    holder.stage?.remove();
    holder.stage = null;
  }
}
