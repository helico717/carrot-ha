// Charging visualisation for the 3D vehicle: the body turns into a ghost, a flat battery pack lies
// under the floor like on the real car and fills green with the state of charge, and a cable runs from
// the charge port to a charger post. One soft light sweep runs over the filled pack and along the cable,
// like the dashboard's SOC bar: slow up to 11 kW, fast above that.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Charge port: rear quarter panel on the passenger side of this model (x < 0, car faces +z).
const PORT = new THREE.Vector3(-0.985, 0.98, -1.74);
const GHOST_OPACITY = 0.1;      // closed body panels and glass
const OPEN_OPACITY = 0.84;      // an open door or tailgate stays clearly visible
const FAST_ABOVE_KW = 11;
const SWEEP_WIDTH = 0.12;       // share of the whole route (cable + filled pack) lit by the band at once
const WHEEL_OPACITY = 0.3;      // wheels and tyres: still an x-ray, but a little more solid than the body
// Same timing as the dashboard's SOC bar sweep.
export const SWEEP_SECONDS = {slow: 4.4, fast: 2.2};

export function isFastCharge(kind, powerKw) {
  return Number.isFinite(powerKw) ? powerKw > FAST_ABOVE_KW : kind === 'dc';
}

const DOOR_GROUPS = {fl: /^EXT_DOOR_FL/, fr: /^EXT_DOOR_FR/, rl: /^EXT_DOOR_RL/, rr: /^EXT_DOOR_RR/, trunk: /^EXT_TRUNK_LID/};

const SWEEP_GLSL = `
  // The light travels one route: charger -> cable -> charge port -> filled battery pack, then starts
  // again at the charger. s is the position on that route (0..1); the band is centred on uCenter.
  float routeBand(float s, float center, float width) {
    float d = abs(s - center) / (width * 0.5);
    float k = 1.0 - smoothstep(0.0, 1.0, d);
    return k * k * (3.0 - 2.0 * k);
  }
`;
const PACK_VERTEX = `
  varying vec3 vPos; varying vec3 vNrm;
  void main() { vPos = position; vNrm = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const PACK_FRAGMENT = `
  uniform float uSoc, uCharging, uAlpha, uLen, uWid, uCenter, uWidth, uPackStart;
  varying vec3 vPos; varying vec3 vNrm;
  ${SWEEP_GLSL}
  void main() {
    float u = clamp((vPos.z + uLen * 0.5) / uLen, 0.0, 1.0);      // rear (0) to front (1)
    float v = clamp((vPos.x + uWid * 0.5) / uWid, 0.0, 1.0);
    float top = smoothstep(0.55, 0.95, abs(vNrm.y));
    vec2 g = vec2(fract(u * 12.0), fract(v * 3.0));
    float seam = 1.0 - smoothstep(0.0, 0.07, min(min(g.x, 1.0 - g.x), min(g.y, 1.0 - g.y)) * 2.0);
    float filled = step(u, uSoc);
    vec3 empty = vec3(0.045, 0.065, 0.075);
    vec3 green = vec3(0.10, 0.80, 0.32);
    vec3 col = mix(empty, green, filled);
    col *= 1.0 - seam * 0.3 * top;
    float s = uPackStart + (u / max(uSoc, 0.001)) * (1.0 - uPackStart);   // filled part is the last stretch of the route
    col += vec3(0.7, 1.0, 0.8) * routeBand(s, uCenter, uWidth) * 0.6 * filled * uCharging;
    float rim = smoothstep(0.93, 1.0, max(abs(vPos.x) / (uWid * 0.5), abs(vPos.z) / (uLen * 0.5)));
    col = mix(col, vec3(0.55, 0.9, 0.7), rim * 0.5);
    col *= mix(0.45, 1.0, top);
    gl_FragColor = vec4(col, uAlpha);
  }
`;
const LINE_FRAGMENT = `
  uniform float uAlpha, uCenter, uWidth, uStart, uShare;
  varying vec2 vUv;
  ${SWEEP_GLSL}
  void main() {
    float band = routeBand(uStart + vUv.x * uShare, uCenter, uWidth);
    vec3 col = mix(vec3(0.1, 0.62, 0.3), vec3(0.75, 1.0, 0.82), band);
    gl_FragColor = vec4(col, uAlpha);
  }
`;
const CABLE_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CABLE_FRAGMENT = `
  uniform float uAlpha, uCenter, uWidth, uCableShare;
  varying vec2 vUv;
  ${SWEEP_GLSL}
  void main() {
    float band = routeBand(vUv.x * uCableShare, uCenter, uWidth);
    vec3 col = mix(vec3(0.05, 0.075, 0.07), vec3(0.2, 1.0, 0.5), band);
    gl_FragColor = vec4(col, uAlpha);
  }
`;

export function createChargeScene(scene, model, wheelPivots) {
  // ---- ghost body: shared exterior materials fade, doors get their own copies while charging ----
  const bodyMaterials = new Map();      // material -> original look
  const doorMeshes = [];                // {key, mesh, original, clones}
  const interior = [];
  const visit = (o) => {
    if (/^INTERIOR/.test(o.name)) interior.push(o);
    if (!o.isMesh) return;
    let node = o, exterior = false, door = null, wheel = false;
    while (node && node !== model) {
      if (/^(YSTAD_20_|BRAKES)/.test(node.name)) wheel = true;
      // The tail lamps were grafted on from another model and sit outside the EXT_* groups.
      if (/^(EXT_(BODY|DOORS|TRUNK)|Tail_)/.test(node.name)) exterior = true;
      for (const [key, re] of Object.entries(DOOR_GROUPS)) if (re.test(node.name)) door = key;
      node = node.parent;
    }
    if (wheel && !exterior) {
      // Wheel parts share some materials with the body (black plastics), so they get private copies
      // while charging, exactly like the doors; otherwise the body parts would become more solid too.
      doorMeshes.push({key: 'wheel', mesh: o, original: o.material, clones: null});
      return;
    }
    if (!exterior) return;
    if (door) { doorMeshes.push({key: door, mesh: o, original: o.material, clones: null}); return; }
    for (const m of [].concat(o.material)) {
      if (/^Glow_/.test(m.name) || bodyMaterials.has(m)) continue;   // lit LEDs keep their strength
      bodyMaterials.set(m, {opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite});
    }
  };
  model.traverse(visit);
  // Wheels are moved into spin pivots outside the model, so they must be visited separately.
  for (const pivot of wheelPivots) pivot.traverse(visit);
  const interiorNodes = interior.filter((o) => !interior.some((p) => p !== o && p.children.includes(o)));
  let doorsGhosted = false;

  function ghostDoors() {
    if (doorsGhosted) return;
    doorsGhosted = true;
    for (const d of doorMeshes) {
      d.clones = [].concat(d.original).map((m) => {
        const c = m.clone();
        c.userData.base = {opacity: m.opacity, glow: /^Glow_/.test(m.name)};
        c.transparent = true;
        c.depthWrite = false;
        c.needsUpdate = true;
        return c;
      });
      d.mesh.material = Array.isArray(d.original) ? d.clones : d.clones[0];
    }
  }
  function restoreDoors() {
    if (!doorsGhosted) return;
    doorsGhosted = false;
    for (const d of doorMeshes) {
      d.mesh.material = d.original;
      for (const c of d.clones || []) c.dispose();
      d.clones = null;
    }
  }

  // ---- battery pack: flat slab between the axles ----
  const p = wheelPivots.map((w) => w.getWorldPosition(new THREE.Vector3()));
  const zFront = Math.max(...p.map((v) => v.z)), zRear = Math.min(...p.map((v) => v.z));
  const length = zFront - zRear - 0.6, width = 1.46, height = 0.14;
  const packMaterial = new THREE.ShaderMaterial({
    vertexShader: PACK_VERTEX, fragmentShader: PACK_FRAGMENT, transparent: true,
    depthWrite: true,
    uniforms: {uSoc: {value: 0.5}, uCharging: {value: 0}, uAlpha: {value: 0}, uLen: {value: length}, uWid: {value: width}, uCenter: {value: -1}, uWidth: {value: SWEEP_WIDTH}, uPackStart: {value: 0.7}},
  });
  const pack = new THREE.Mesh(new RoundedBoxGeometry(width, height, length, 3, 0.035), packMaterial);
  pack.position.set(0, 0.3, (zFront + zRear) / 2 + 0.02);
  pack.renderOrder = -2;     // drawn before the ghost body and writes depth: doors in front cover it, parts behind are hidden
  pack.visible = false;
  scene.add(pack);

  // ---- two green lines from the charge port to the battery pack, along the chassis ----
  const lineMaterial = new THREE.ShaderMaterial({
    vertexShader: CABLE_VERTEX, fragmentShader: LINE_FRAGMENT, transparent: true, depthWrite: true,
    uniforms: {uAlpha: {value: 0}, uCenter: {value: -1}, uWidth: {value: SWEEP_WIDTH}, uStart: {value: 0.4}, uShare: {value: 0.2}},
  });
  // Inside the car the lines continue the plug's direction (30 degrees downward, into the body), then
  // bend down behind the wheel arch and run forward along the chassis to the pack.
  const portTip = PORT.clone().add(new THREE.Vector3(-0.012, 0, 0));
  const lineCurve = (dx) => {
    const dir = new THREE.Vector3(Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6), 0);
    const at = (t) => portTip.clone().addScaledVector(dir, t);
    return new THREE.CatmullRomCurve3([
      at(0.02).add(new THREE.Vector3(dx, 0, 0)),
      at(0.14).add(new THREE.Vector3(dx, 0, 0)),
      new THREE.Vector3(-0.66 + dx, 0.72, -1.7),
      new THREE.Vector3(-0.58 + dx, 0.5, -1.63),
      new THREE.Vector3(-0.56 + dx, 0.34, -1.45),
      new THREE.Vector3(-0.55 + dx, 0.3, -1.2),
      new THREE.Vector3(-0.54 + dx, 0.3, -1.06),
    ], false, 'catmullrom', 0.5);
  };
  const lineCurves = [lineCurve(-0.03), lineCurve(0.03)];
  const lineLength = lineCurves[0].getLength();
  const lines = lineCurves.map((c) => {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(c, 60, 0.011, 8, false), lineMaterial);
    mesh.renderOrder = -1;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });

  // ---- connector: black plug entering the port 30 degrees downward (it comes in from above) ----
  const INSERT = new THREE.Vector3(Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6), 0);   // into the car, down
  const connectorMat = new THREE.MeshStandardMaterial({color: 0x101214, roughness: 0.42, metalness: 0.25, transparent: true, opacity: 0});
  const latchMat = new THREE.MeshStandardMaterial({color: 0x2a2f33, roughness: 0.5, metalness: 0.3, transparent: true, opacity: 0});
  const connector = new THREE.Group();     // built along +z with the tip at the origin
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.075, 20), connectorMat);
  head.rotation.x = Math.PI / 2; head.position.z = -0.0375;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.03, 20), connectorMat);
  collar.rotation.x = Math.PI / 2; collar.position.z = -0.09;
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.043, 0.13, 6, 16), connectorMat);
  handle.rotation.x = Math.PI / 2; handle.position.z = -0.185;
  const latch = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.02, 0.07, 2, 0.008), latchMat);
  latch.position.set(0, 0.052, -0.14);
  const relief = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.07, 16), connectorMat);
  relief.rotation.x = Math.PI / 2; relief.position.z = -0.29;
  connector.add(head, collar, handle, latch, relief);
  const tipAt = PORT.clone().add(new THREE.Vector3(-0.012, 0, 0));
  connector.position.copy(tipAt);
  connector.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), INSERT);
  for (const part of connector.children) part.renderOrder = -1;
  connector.renderOrder = -1;
  connector.visible = false;
  scene.add(connector);
  const tail = tipAt.clone().addScaledVector(INSERT, -0.33);   // where the cable leaves the plug (up and outwards)

  // ---- cable from the charger to the plug (u runs towards the car) ----
  const post = new THREE.Vector3(-1.95, 0, -2.3);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(post.x + 0.1, 0.72, post.z + 0.02),
    new THREE.Vector3(post.x + 0.3, 0.18, post.z + 0.05),
    new THREE.Vector3(-1.62, 0.04, -2.2),
    new THREE.Vector3(-1.52, 0.4, -2.0),
    new THREE.Vector3(-1.45, 0.86, -1.84),
    tail.clone().addScaledVector(INSERT, -0.04).add(new THREE.Vector3(-0.1, -0.06, 0.02)),
    tail,
  ], false, 'catmullrom', 0.45);
  const cableMaterial = new THREE.ShaderMaterial({
    vertexShader: CABLE_VERTEX, fragmentShader: CABLE_FRAGMENT, transparent: true, depthWrite: true,
    uniforms: {uAlpha: {value: 0}, uCenter: {value: -1}, uWidth: {value: SWEEP_WIDTH}, uCableShare: {value: 0.5}},
  });
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.024, 10, false), cableMaterial);
  cable.renderOrder = -1;
  cable.visible = false;
  scene.add(cable);

  // ---- charging station: plinth, rounded column, hood, screen with live numbers, status light, holster ----
  const postGroup = new THREE.Group();
  const stationMats = {
    shell: new THREE.MeshStandardMaterial({color: 0xe4e8ec, roughness: 0.38, metalness: 0.15, transparent: true, opacity: 0}),
    dark: new THREE.MeshStandardMaterial({color: 0x1b2026, roughness: 0.5, metalness: 0.35, transparent: true, opacity: 0}),
    accent: new THREE.MeshBasicMaterial({color: 0x33ff88, transparent: true, opacity: 0, toneMapped: false}),
  };
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.07, 0.32, 3, 0.03), stationMats.dark);
  plinth.position.y = 0.035;
  const column = new THREE.Mesh(new RoundedBoxGeometry(0.3, 1.0, 0.2, 4, 0.07), stationMats.shell);
  column.position.y = 0.58;
  const hood = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.1, 0.24, 3, 0.045), stationMats.dark);
  hood.position.y = 1.12;
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.3, 0.02, 3, 0.012), stationMats.dark);
  bezel.position.set(0, 0.86, 0.1);
  const strip = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.5, 0.012, 2, 0.005), stationMats.accent);
  strip.position.set(0.1, 0.55, 0.1);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 28), stationMats.accent);
  ring.position.set(0, 0.62, 0.103);
  const holster = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.16, 0.1, 3, 0.03), stationMats.dark);
  holster.position.set(0.19, 0.74, 0);
  const screen = document.createElement('canvas');
  screen.width = 256; screen.height = 192;
  const screenTexture = new THREE.CanvasTexture(screen);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({map: screenTexture, transparent: true, opacity: 0, toneMapped: false});
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.255), screenMat);
  display.position.set(0, 0.86, 0.112);
  postGroup.add(plinth, column, hood, bezel, strip, ring, holster, display);
  for (const part of postGroup.children) part.renderOrder = -1;
  postGroup.position.copy(post);
  postGroup.rotation.y = -0.55;         // faces the camera side of the car
  postGroup.visible = false;
  scene.add(postGroup);

  function drawScreen() {
    const g = screen.getContext('2d');
    g.fillStyle = '#04120b'; g.fillRect(0, 0, 256, 192);
    const grad = g.createLinearGradient(0, 0, 0, 192);
    grad.addColorStop(0, 'rgba(40,255,140,0.22)'); grad.addColorStop(1, 'rgba(40,255,140,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 192);
    g.textAlign = 'center'; g.fillStyle = '#7dffb4';
    g.font = '600 24px system-ui, sans-serif'; g.fillText('CHARGING', 128, 38);
    g.font = '700 70px system-ui, sans-serif'; g.fillText(`${Math.round(state.soc)}%`, 128, 112);
    g.font = '600 28px system-ui, sans-serif';
    g.fillText(Number.isFinite(state.powerKw) ? `${state.powerKw >= 10 ? Math.round(state.powerKw) : state.powerKw.toFixed(1)} kW` : (state.kind === 'dc' ? 'DC' : 'AC'), 128, 160);
    screenTexture.needsUpdate = true;
  }
  const stationParts = [plinth, column, hood, bezel, strip, ring, holster, display];

  const cableLength = curve.getLength();
  const state = {target: 0, amount: 0, kind: 'ac', powerKw: null, soc: 50, time: 0, period: SWEEP_SECONDS.slow};
  drawScreen();
  const fade = (x) => x * x * (3 - 2 * x);
  const AMBER = new THREE.Color(1.0, 0.55, 0.1);

  function apply(doors) {
    const a = fade(state.amount);
    const on = a > 0.002;
    if (on) ghostDoors(); else restoreDoors();
    for (const [m, o] of bodyMaterials) {
      const transparent = on || o.transparent;
      if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
      m.opacity = o.opacity * (1 - (1 - GHOST_OPACITY) * a);
      m.depthWrite = on ? false : o.depthWrite;
    }
    if (on) {
      for (const d of doorMeshes) {
        const wheelPart = d.key === 'wheel';
        const open = wheelPart ? 0 : Math.min(1, Math.max(0, doors?.[d.key] || 0));
        const keep = wheelPart ? WHEEL_OPACITY : GHOST_OPACITY + (OPEN_OPACITY - GHOST_OPACITY) * open;      // open doors stay visible
        for (const c of d.clones) {
          const base = c.userData.base;
          c.opacity = base.opacity * (1 - (1 - (base.glow ? 1 : keep)) * a);
          if (c.emissive && !base.glow) c.emissive.copy(AMBER).multiplyScalar(0.42 * open * a);  // warm tint on open doors
        }
      }
    }
    for (const node of interiorNodes) node.visible = a < 0.5;
    pack.visible = cable.visible = postGroup.visible = connector.visible = on;
    for (const mesh of lines) mesh.visible = on;
    lineMaterial.uniforms.uAlpha.value = a;
    packMaterial.uniforms.uAlpha.value = 0.94 * a;
    cableMaterial.uniforms.uAlpha.value = a;
    for (const m of Object.values(stationMats)) m.opacity = a;
    screenMat.opacity = a;
    connectorMat.opacity = a;
    latchMat.opacity = a;
  }

  return {
    set(next) {
      if ('on' in next) state.target = next.on ? 1 : 0;
      if (next.kind) state.kind = next.kind === 'dc' ? 'dc' : 'ac';
      if ('powerKw' in next) state.powerKw = Number.isFinite(next.powerKw) ? next.powerKw : null;
      if (Number.isFinite(next.soc)) state.soc = Math.min(100, Math.max(0, next.soc));
      packMaterial.uniforms.uSoc.value = state.soc / 100;
      const packRoute = Math.max(0.15, length * state.soc / 100);
      const total = cableLength + lineLength + packRoute;
      cableMaterial.uniforms.uCableShare.value = cableLength / total;
      lineMaterial.uniforms.uStart.value = cableLength / total;
      lineMaterial.uniforms.uShare.value = lineLength / total;
      packMaterial.uniforms.uPackStart.value = (cableLength + lineLength) / total;
      const shown = `${Math.round(state.soc)}|${state.powerKw}|${state.kind}`;
      if (shown !== state.shown) { state.shown = shown; drawScreen(); }
      const period = isFastCharge(state.kind, state.powerKw) ? SWEEP_SECONDS.fast : SWEEP_SECONDS.slow;
      state.period = period;
    },
    // Returns true while something is still moving and needs frames. `doors` holds 0..1 open amounts.
    update(dt, doors) {
      let busy = false;
      if (state.amount !== state.target) {
        const step = dt / 0.7;
        state.amount = state.amount < state.target ? Math.min(state.target, state.amount + step) : Math.max(state.target, state.amount - step);
        busy = true;
      }
      if (state.amount > 0 || state.target) {
        apply(doors);
        state.time += dt;
        // Constant speed along the whole route: the band enters at the charger and leaves past the end of
        // the filled pack, then the next cycle starts at the charger again.
        const phase = (state.time / state.period) % 1;
        const center = -SWEEP_WIDTH / 2 + phase * (1 + SWEEP_WIDTH);
        packMaterial.uniforms.uCenter.value = center;
        cableMaterial.uniforms.uCenter.value = center;
        lineMaterial.uniforms.uCenter.value = center;
        packMaterial.uniforms.uCharging.value = state.target;
        // the station's status light flashes as each cycle starts
        const start = 1 - Math.min(1, phase / 0.18);
        stationMats.accent.opacity = fade(state.amount) * (0.6 + 0.4 * start * start);
        busy = true;
      } else if (doorsGhosted) {
        apply(doors);
      }
      return busy;
    },
    get active() { return state.target === 1; },
    get period() { return state.period; },
    get transitioning() { return state.amount !== state.target; },
    get amount() { return state.amount; },
    dispose() {
      scene.remove(pack, cable, postGroup, connector, ...lines);
      for (const obj of [pack, cable, ...lines, ...stationParts, head, collar, handle, latch, relief]) obj.geometry.dispose();
      for (const m of [packMaterial, cableMaterial, lineMaterial, screenMat, connectorMat, latchMat, ...Object.values(stationMats)]) m.dispose();
      screenTexture.dispose();
      state.target = 0; state.amount = 0; apply();
    },
  };
}
