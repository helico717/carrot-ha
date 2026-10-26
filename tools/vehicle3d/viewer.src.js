// Interactive 3D vehicle viewer for the Carrot HA hero card.
// Built into custom_components/carrot_ha/frontend/carrot-assets/vehicle-3d.js by build.sh.
// Pure rendering: it only receives state through setState() and never queries the cloud.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

const DOOR_CLIPS = {fl: 'Front left door', fr: 'Front right door', rl: 'Rear left door', rr: 'Rear right door', trunk: 'Tailgate and shelf'};
const WHEEL_RE = /^YSTAD_20_(FL|FR|RL|RR)_/;
const CAR_LENGTH = 4.6;
const DEFAULT_BODY_COLOR = '#333234'; // RGB 51,50,52
const DOOR_SECONDS = 0.9;

// Telephoto framing: a narrow field of view with the camera pulled back keeps the same
// car size as a wide lens, but without the rounded, wide-angle look.
const tele = (view, fov) => {
  const k = Math.tan((view.fov * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360);
  const look = view.look;
  return {look, fov, pos: view.pos.map((v, i) => look[i] + (v - look[i]) * k)};
};
const VIEWS = {
  // Car faces +Z, left side is +X.
  front: tele({pos: [0.0, 1.0, 5.6], look: [0, 0.74, 0], fov: 30}, 7.2),
  top: tele({pos: [4.3, 5.5, 5.4], look: [0, 0.45, -0.05], fov: 32}, 18),
  side: tele({pos: [-6.9, 1.2, 0], look: [0, 0.7, 0], fov: 30}, 11),
  // Driving default: elevated three-quarter view from behind, passenger side.
  drive: tele({pos: [-4.4, 2.6, -4.3], look: [0, 0.55, 0.4], fov: 30}, 13),
  rear: tele({pos: [0.0, 1.0, -5.6], look: [0, 0.74, 0], fov: 30}, 7.2),
};

const ease = (t) => t * t * (3 - 2 * t);

function radialTexture(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function beamTexture() {
  // Fan of light: narrow at the lamp, spreading forward, fading out smoothly over distance and
  // towards the edges, so there is no hard cut anywhere.
  const W = 128, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) {
    const d = y / (H - 1); // 0 at the lamp, 1 at the far end
    const half = 0.1 + 0.9 * Math.pow(d, 0.85); // fan half-width
    for (let x = 0; x < W; x++) {
      const l = Math.abs((x + 0.5) / W * 2 - 1);
      const side = 1 - smooth(0.35, 1, l / half);
      const reach = Math.pow(1 - smooth(0.0, 1, d), 1.5) * smooth(0, 0.14, d);
      const a = 0.62 * side * reach;
      const i = (y * W + x) * 4;
      img.data[i] = 236; img.data[i + 1] = 244; img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * Math.min(1, a));
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}


const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('image-load-failed'));
  img.src = url;
});

// Builds a colour map and a height map from a flat wheel photo. The height map makes the
// dark spoke windows read as recessed under the scene lighting.
async function wheelTextures(opts) {
  const SIZE = 1024;
  const face = await loadImage(opts.face);
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d', {willReadFrequently: true});
  g.drawImage(face, 0, 0, SIZE, SIZE);
  if (opts.cap) {
    const cap = await loadImage(opts.cap);
    const crop = cap.width * 0.15;
    const rad = SIZE * 0.075;
    g.save();
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, rad, 0, Math.PI * 2);
    g.clip();
    g.drawImage(cap, cap.width / 2 - crop, cap.height / 2 - crop, crop * 2, crop * 2, SIZE / 2 - rad, SIZE / 2 - rad, rad * 2, rad * 2);
    g.restore();
  }
  const src = g.getImageData(0, 0, SIZE, SIZE);
  const h = document.createElement('canvas');
  h.width = h.height = SIZE;
  const hg = h.getContext('2d');
  const out = hg.createImageData(SIZE, SIZE);
  for (let i = 0; i < src.data.length; i += 4) {
    const lum = (src.data[i] + src.data[i + 1] + src.data[i + 2]) / 3;
    const t = Math.min(1, Math.max(0, (lum - 35) / 90));
    const v = 40 + 215 * t * t * (3 - 2 * t);
    out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }
  hg.putImageData(out, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(h);
  for (const t of [map, bump]) { t.repeat.set(0.985, 0.985); t.offset.set(0.0075, 0.0075); }
  return {map, bump};
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

export async function createVehicleViewer(container, options = {}) {
  if (!webglAvailable()) throw new Error('webgl-unavailable');
  const modelUrl = options.modelUrl;
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', options.label || 'Vehicle 3D view');
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(3, 6, 4);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 120);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  // The caller may pass the downloaded bytes (served from the local cache) instead of a URL.
  const gltf = options.modelBuffer ? await loader.parseAsync(options.modelBuffer, '') : await loader.loadAsync(modelUrl);

  // ----- normalise the model: car faces +Z, centred, wheels on y=0, fixed length -----
  const car = new THREE.Group();
  const model = gltf.scene;
  car.add(model);
  scene.add(car);
  model.updateMatrixWorld(true);

  const findNode = (re) => { let f = null; model.traverse((o) => { if (!f && re.test(o.name)) f = o; }); return f; };
  const centreOf = (o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  const headNode = findNode(/^Ext_Headlight#/);
  const tailNode = findNode(/^Tail_Bar_Sides/) || findNode(/^Ext_Taillight#/) || findNode(/^Ext_Trunk_Lid_Taillight#/);
  const front = centreOf(headNode).sub(centreOf(tailNode));
  front.y = 0;
  front.normalize();
  model.rotation.y = -Math.atan2(front.x, front.z);
  model.updateMatrixWorld(true);
  const box0 = new THREE.Box3().setFromObject(model);
  const size0 = box0.getSize(new THREE.Vector3());
  const k = CAR_LENGTH / Math.max(size0.x, size0.z);
  car.scale.setScalar(k);
  car.updateMatrixWorld(true);
  const box1 = new THREE.Box3().setFromObject(car);
  const c1 = box1.getCenter(new THREE.Vector3());
  car.position.set(-c1.x, -box1.min.y, -c1.z);
  car.updateMatrixWorld(true);
  const carBox = new THREE.Box3().setFromObject(car);

  // ----- door / tailgate clips driven by hand (no wall-clock playback) -----
  const mixer = new THREE.AnimationMixer(model);
  const clips = {};
  for (const [key, name] of Object.entries(DOOR_CLIPS)) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.play();
    action.paused = true;
    action.time = 0;
    clips[key] = {action, duration: clip.duration, value: 0, target: 0};
  }
  mixer.update(0);

  // ----- paint, lights, glow -----
  const mats = {paint: [], drl: [], tail: [], plate: []};
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (/^Artic_Blue_Metallic/.test(m.name) && !mats.paint.includes(m)) mats.paint.push(m);
      else if (/^Glow_DRL/.test(m.name) && !mats.drl.includes(m)) mats.drl.push(m);
      else if (/^Glow_Red/.test(m.name) && !mats.tail.includes(m)) mats.tail.push(m);
      else if (/^Glow_Plate/.test(m.name) && !mats.plate.includes(m)) mats.plate.push(m);
    }
  });
  // The source car has amber bumper/headlamp marker reflectors that the real car does not.
model.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of [].concat(o.material)) {
    if (!/^Reflector_Orange/.test(m.name) || m.userData.darkened) continue;
    m.userData.darkened = true;
    m.color.set(0x0c0c0d);
    if (m.emissive) m.emissive.set(0x000000);
    m.map = null;
    m.metalness = 0.2;
    m.roughness = 0.6;
    m.needsUpdate = true;
  }
});
// The source glass is nearly invisible (alpha 0.08-0.18), which shows every seat. Tint the
// windshield and side/rear windows like the reference photo; lamp covers stay clear.
const tint = {Windows_Ext_Clear: [0x0c1113, 0.93], Windows_Ext_Tinted: [0x05090a, 0.9]};
model.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of [].concat(o.material)) {
    const t = Object.entries(tint).find(([k]) => m.name.startsWith(k));
    if (!t || m.userData.tinted) continue;
    m.userData.tinted = true;
    m.color.set(t[1][0]);
    m.opacity = t[1][1];
    m.transparent = true;
    m.roughness = 0.12;
  }
});
// The source paint is a mirror-like clearcoat; soften it to a satin finish.
for (const m of mats.paint) {
  m.metalness = 0.55;
  m.roughness = 0.5;
  m.clearcoat = 0.3;
  m.clearcoatRoughness = 0.45;
  m.envMapIntensity = 0.55;
}
for (const m of [...mats.drl, ...mats.tail]) m.userData.baseStrength = m.emissiveIntensity || 1;
// ACES tone mapping shifts very bright red towards orange; keep the tail light pure red.
for (const m of mats.tail) {
  m.toneMapped = false;
  m.emissive.set(1, 0.02, 0.02);
  m.userData.baseStrength = 1.0;
}

  // Headlamp light starts at the projector bulb (about a third of the way in from the outer
  // corner, slightly below centre, just behind the lens), not at the middle of the housing.
  const bulbPoints = [];
  {
    const sideBoxes = {l: new THREE.Box3(), r: new THREE.Box3()};
    const v = new THREE.Vector3();
    headNode.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        (v.x > 0 ? sideBoxes.l : sideBoxes.r).expandByPoint(v);
      }
    });
    for (const [b, sign] of [[sideBoxes.l, 1], [sideBoxes.r, -1]]) {
      const w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z;
      const outer = sign > 0 ? b.max.x : b.min.x;
      bulbPoints.push(new THREE.Vector3(outer - sign * 0.36 * w, b.min.y + 0.43 * h, b.max.z - 0.25 * d));
    }
  }
  const lampGroup = new THREE.Group();
  scene.add(lampGroup);
  const glowTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(236,244,255,0.6)'], [1, 'rgba(226,238,255,0)']]);
  const beamTex = beamTexture();
  const lamps = bulbPoints.map((p) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex, transparent: true, depthWrite: false, depthTest: true, opacity: 0}));
    sprite.scale.setScalar(0.22);
    sprite.position.copy(p);
    lampGroup.add(sprite);
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7.5), new THREE.MeshBasicMaterial({map: beamTex, transparent: true, depthWrite: false, opacity: 0}));
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(p.x, 0.015, carBox.max.z + 0.8 + 3.75);
    lampGroup.add(beam);
    return {sprite, beam};
  });
  // Light glow: shells of the emissive geometry pushed outwards along the normals, drawn with
  // additive blending. They hug the lamp surface (so the body hides them correctly) and look
  // like light blooming around the LEDs.
  const glowShells = {tail: []};
  model.updateMatrixWorld(true);
  const addShells = (mesh, bucket, color, defs) => {
    const scale = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).x || 1;
    for (const [off, op] of defs) {
      const uOff = {value: off / scale};
      const mat = new THREE.MeshBasicMaterial({color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false});
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uOff = uOff;
        sh.vertexShader = 'uniform float uOff;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * uOff;');
      };
      const shell = new THREE.Mesh(mesh.geometry, mat);
      shell.visible = false;
      shell.renderOrder = 2;
      mesh.add(shell);
      glowShells[bucket].push({shell, op});
    }
  };
  const TAIL_SHELLS = [[0.005, 0.8], [0.016, 0.5], [0.034, 0.28], [0.06, 0.12]];
    model.traverse((o) => {
    if (!o.isMesh) return;
    if (/^Tail_Bar_/.test(o.name)) addShells(o, 'tail', 0xff2418, TAIL_SHELLS);
  });

  // contact shadow + road
  const shadowTex = radialTexture([[0, 'rgba(0,0,0,0.5)'], [0.6, 'rgba(0,0,0,0.22)'], [1, 'rgba(0,0,0,0)']], 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(CAR_LENGTH * 1.25, CAR_LENGTH * 0.62), new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false}));
  shadow.rotation.x = -Math.PI / 2;
  shadow.rotation.z = Math.PI / 2;
  shadow.position.set(0, 0.005, 0);
  scene.add(shadow);

  const road = new THREE.Group();
  const dashMat = new THREE.MeshBasicMaterial({color: 0x9aa3a8, transparent: true, opacity: 0, depthWrite: false});
  const DASH = 1.4, GAP = 1.6, COUNT = 14, PERIOD = DASH + GAP;
  const dashes = [];
  for (let i = 0; i < COUNT; i++) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.14, DASH), dashMat);
    d.rotation.x = -Math.PI / 2;
    d.position.set(1.9, 0.004, 0);
    road.add(d);
    dashes.push(d);
    const e = d.clone();
    e.position.x = -1.9;
    road.add(e);
    dashes.push(e);
  }
  scene.add(road);

  // wheels: pivot at wheel centre so we can spin them around the lateral axis
  const wheels = [];
  model.traverse((o) => {
    if (WHEEL_RE.test(o.name)) wheels.push(o);
  });
  const wheelPivots = wheels.map((w) => {
    const pivot = new THREE.Group();
    const c = new THREE.Box3().setFromObject(w).getCenter(new THREE.Vector3());
    car.worldToLocal(c);
    car.add(pivot);
    pivot.position.copy(c);
    pivot.updateMatrixWorld(true);
    pivot.attach(w);
    return pivot;
  });
  const wheelRadius = (() => {
    const b = new THREE.Box3().setFromObject(wheels[0] || car);
    return Math.max(0.05, (b.max.y - b.min.y) / 2);
  })();

  // Replace each rim face with the photographed wheel design (flat disc + relief + dark barrel).
  if (options.wheel) {
    try {
      const tex = await wheelTextures(options.wheel);
      const faceMat = new THREE.MeshStandardMaterial({map: tex.map, bumpMap: tex.bump, bumpScale: options.wheel.relief ?? 3, roughness: 0.42, metalness: 0.45, envMapIntensity: 0.7});
      const barrelMat = new THREE.MeshStandardMaterial({color: 0x08080a, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide});
      const kk = car.scale.x;
      wheels.forEach((w, i) => {
        const pivot = wheelPivots[i];
        let rim = null;
        w.traverse((o) => { if (!rim && /^Rim_/.test(o.name)) rim = o; });
        if (!rim) return;
        const box = new THREE.Box3().setFromObject(rim);
        const centre = new THREE.Vector3();
        pivot.getWorldPosition(centre);
        const sign = centre.x > 0 ? 1 : -1;
        const xOut = ((sign > 0 ? box.max.x : box.min.x) - centre.x) / kk;
        const radius = (box.max.y - box.min.y) / 2 / kk;
        const depth = ((box.max.x - box.min.x) / kk) * 0.85;
        rim.visible = false;
        const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.985, 96), faceMat);
        disc.rotation.y = sign * Math.PI / 2;
        disc.position.x = xOut + sign * 0.002 / kk;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.93, radius * 0.93, depth, 48, 1, true), barrelMat);
        barrel.rotation.z = Math.PI / 2;
        barrel.position.x = xOut - sign * depth / 2;
        pivot.add(disc, barrel);
      });
    } catch (e) {
      console.warn('wheel texture skipped', e);
    }
  }

  // ----- state & camera -----
  const state = {
    doors: {fl: false, fr: false, rl: false, rr: false}, trunk: false, lowBeam: false,
    driving: false, speedKph: 0, dark: false, bodyColor: options.bodyColor || DEFAULT_BODY_COLOR, mode: 'auto',
  };
  let viewName = 'front';
  const camState = {pos: new THREE.Vector3(...VIEWS.front.pos), look: new THREE.Vector3(...VIEWS.front.look), fov: VIEWS.front.fov};
  let aspect = 1.6;
  const offset = {yaw: 0, pitch: 0, zoom: 1};
  let lampLevel = 0;
  let roadLevel = 0;
  let wheelAngle = 0;
  let roadScroll = 0;
  let paintColor = null;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  let disposed = false;
  let settled = false;

  function chooseView() {
    if (state.mode !== 'auto') return state.mode;
    if (state.driving) return 'drive';
    if (state.trunk || Object.values(state.doors).some(Boolean)) return 'top';
    return 'front';
  }

  function targetCamera() {
    const v = VIEWS[viewName];
    const fit = Math.min(1.35, Math.max(0.82, 1.55 / aspect)); // wide, short cards: bring the car closer
    const pos = new THREE.Vector3(...v.pos);
    const look = new THREE.Vector3(...v.look);
    const dir = pos.clone().sub(look).multiplyScalar(fit * offset.zoom);
    const sph = new THREE.Spherical().setFromVector3(dir);
    sph.theta += offset.yaw;
    // Free orbit in every direction, except that the camera never drops below the horizon of the
    // car's mid-height: from lower angles the underbody and the far wheels look wrong.
    const phiMax = Math.PI / 2;
    const phi = Math.min(phiMax, Math.max(0.02, sph.phi + offset.pitch));
    offset.pitch = phi - sph.phi; // keep the stored offset inside the limit so dragging back responds at once
    sph.phi = phi;
    dir.setFromSpherical(sph);
    return {pos: look.clone().add(dir), look, fov: v.fov};
  }

  function frame(now) {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    let busy = false;

    const nextView = chooseView();
    if (nextView !== viewName) {
      viewName = nextView;
      offset.yaw = offset.pitch = 0;
      offset.zoom = 1;
    }
    const t = targetCamera();
    const a = 1 - Math.exp(-dt * 4.2);
    camState.pos.lerp(t.pos, a);
    camState.look.lerp(t.look, a);
    camState.fov += (t.fov - camState.fov) * a;
    if (camState.pos.distanceTo(t.pos) > 0.003 || camState.look.distanceTo(t.look) > 0.003) busy = true;
    camera.position.copy(camState.pos);
    camera.fov = camState.fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camera.lookAt(camState.look);

    for (const [key, c] of Object.entries(clips)) {
      const want = key === 'trunk' ? state.trunk : state.doors[key];
      c.target = want ? 1 : 0;
      if (c.value !== c.target) {
        const step = dt / DOOR_SECONDS;
        c.value = c.value < c.target ? Math.min(c.target, c.value + step) : Math.max(c.target, c.value - step);
        c.action.time = ease(c.value) * c.duration;
        busy = true;
      }
    }
    mixer.update(0);

    const lampTarget = state.lowBeam ? 1 : 0;
    if (Math.abs(lampLevel - lampTarget) > 0.002) {
      lampLevel += (lampTarget - lampLevel) * (1 - Math.exp(-dt * 7));
      busy = true;
    } else lampLevel = lampTarget;
    const dark = state.dark ? 1 : 0;
    for (const m of mats.drl) m.emissiveIntensity = m.userData.baseStrength * (0.12 + 0.88 * lampLevel);
    for (const m of mats.tail) m.emissiveIntensity = m.userData.baseStrength * (0.04 + 0.96 * lampLevel);
    for (const bucket of Object.values(glowShells)) for (const t of bucket) { t.shell.visible = lampLevel > 0.01; t.shell.material.opacity = lampLevel * t.op; }
    for (const l of lamps) {
      // The bulb is inside the housing: only visible from in front of the car.
      const toCam = camera.position.clone().sub(l.sprite.position).normalize();
      const facing = Math.min(1, Math.max(0, (toCam.z - 0.2) / 0.45));
      l.sprite.material.opacity = lampLevel * facing * (viewName === 'side' ? 0.45 : 0.95);
      l.beam.material.opacity = lampLevel * (0.4 + 0.4 * dark) * (viewName === 'side' ? 0.35 : 1);
    }

    const roadTarget = state.driving ? 1 : 0;
    if (Math.abs(roadLevel - roadTarget) > 0.002) {
      roadLevel += (roadTarget - roadLevel) * (1 - Math.exp(-dt * 3));
      busy = true;
    } else roadLevel = roadTarget;
    dashMat.opacity = roadLevel * 0.55;
    road.visible = roadLevel > 0.01;
    if (state.driving) {
      const mps = Math.max(8, state.speedKph || 40) / 3.6 * 0.5;
      roadScroll = (roadScroll + mps * dt) % PERIOD;
      wheelAngle += (mps * dt) / wheelRadius;
      busy = true;
      dashes.forEach((d, i) => {
        const idx = Math.floor(i / 2);
        d.position.z = -((idx * PERIOD + roadScroll) % (COUNT * PERIOD)) + (COUNT * PERIOD) / 2;
      });
      car.rotation.z = Math.sin(performance.now() / 380) * 0.0025;
    } else car.rotation.z = 0;
    for (const p of wheelPivots) p.rotation.x = wheelAngle; // lateral axis is X once the car faces +Z

    renderer.render(scene, camera);
    settled = !busy;
    if (visible && (busy || state.driving)) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && !disposed && visible) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    aspect = w / h;
    kick();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver((e) => {
    visible = e[0].isIntersecting && !document.hidden;
    kick();
  });
  io.observe(container);
  const onVis = () => { visible = !document.hidden; kick(); };
  document.addEventListener('visibilitychange', onVis);

  // Free look: the default view per state is only a starting point. Dragging orbits without
  // any angle limit; double click returns to the default view of the current state.
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let freeLook = false;
  const clampZoom = (z) => Math.min(6, Math.max(0.12, z));
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), zoom: offset.zoom};
      drag = null;
    } else {
      drag = {x: e.clientX, y: e.clientY, id: e.pointerId, moved: false};
    }
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      offset.zoom = clampZoom(pinch.zoom * (pinch.d / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))));
      kick();
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    if (!drag.moved) canvas.setPointerCapture(e.pointerId);
    drag.moved = true;
    drag.x = e.clientX; drag.y = e.clientY;
    offset.yaw -= dx * 0.006;
    offset.pitch -= dy * 0.005;
    kick();
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) { drag = null; canvas.style.cursor = 'grab'; }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  // Gestures starting on the vehicle stay in the viewer; ctrl+wheel / pinch zooms.
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!e.ctrlKey && !freeLook) return;
    offset.zoom = clampZoom(offset.zoom * Math.exp(e.deltaY * 0.0025));
    kick();
  }, {passive: false});
  canvas.addEventListener('dblclick', () => { offset.yaw = offset.pitch = 0; offset.zoom = 1; kick(); });

  function applyPaint() {
    if (!state.bodyColor) return;
    if (state.bodyColor === paintColor) return;
    paintColor = state.bodyColor;
    for (const m of mats.paint) {
      if (m.map) { m.userData.map = m.map; m.map = null; }
      m.color.set(paintColor);
      m.needsUpdate = true;
    }
  }

  resize();
  applyPaint();
  frame(performance.now());

  return {
    setState(next = {}) {
      if (next.doors) Object.assign(state.doors, next.doors);
      for (const key of ['trunk', 'lowBeam', 'driving', 'speedKph', 'dark', 'bodyColor', 'mode']) if (key in next) state[key] = next[key];
      applyPaint();
      kick();
    },
    setFreeLook(on) {
      freeLook = !!on;
      canvas.style.touchAction = 'none';
    },
    setOrbit(o = {}) {
      if ('yaw' in o) offset.yaw = o.yaw;
      if ('pitch' in o) offset.pitch = o.pitch;
      if ('zoom' in o) offset.zoom = clampZoom(o.zoom);
      kick();
    },
    resetView() { offset.yaw = offset.pitch = 0; offset.zoom = 1; kick(); },
    get view() { return viewName; },
    get settled() { return settled; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of [].concat(o.material || [])) {
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
          m.dispose();
        }
      });
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
