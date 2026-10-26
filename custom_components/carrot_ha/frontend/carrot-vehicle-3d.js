// Interactive 3D vehicle for the dashboard hero card.
//
// The card keeps rendering its normal PNG. When a local model file exists and WebGL works,
// this module mounts the viewer on top of it and feeds it the vehicle state the card already
// holds (doors, trunk, low beam, speed, driving state). It never issues its own cloud or HA
// requests for vehicle data, so it cannot add query load (see docs/modular-ev-dashboard-architecture.md).
//
// The model itself is a user-supplied file (see docs/VEHICLE_3D_MODEL.md) and is never shipped
// in this repository; without it the card silently keeps the PNG.
const version = new URL(import.meta.url).searchParams.get('v');
const versioned = name => {
  const url = new URL(name, import.meta.url);
  if (version) url.searchParams.set('v', version);
  return url.href;
};

export const DEFAULT_MODEL_URL = '/carrot_ha_models/vehicle.glb';

const modelAvailable = new Map();
let viewerModule = null;
let webglBroken = false;

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
  };
}

function hasModel(url) {
  if (!modelAvailable.has(url)) {
    modelAvailable.set(url, fetch(url, {method: 'HEAD'}).then(response => response.ok, () => false));
  }
  return modelAvailable.get(url);
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
  const url = card.config?.vehicle_3d_model || DEFAULT_MODEL_URL;
  try {
    if (!await hasModel(url)) return;
    viewerModule ||= await import(versioned('./carrot-assets/vehicle-3d.js'));
    if (card._v3d !== holder || !box.isConnected) return;
    const stage = document.createElement('div');
    stage.className = 'v3d-stage';
    box.appendChild(stage);
    holder.stage = stage;
    const viewer = await viewerModule.createVehicleViewer(stage, {
      modelUrl: url,
      bodyColor: card.config?.vehicle_3d_color,
      label: card.config?.vehicle_name || 'Carrot HA',
    });
    if (card._v3d !== holder || !box.isConnected) {
      viewer.dispose();
      return;
    }
    holder.viewer = viewer;
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
