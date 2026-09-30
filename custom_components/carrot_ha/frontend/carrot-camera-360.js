/**
 * Carrot HA 360° Camera Monitoring Component
 * - Dual fisheye projection (Front Wide + Cabin Wide) with WebGL GPU stitching
 * - Pointer events dragging for interactive yaw / pitch control
 * - Responsive modal lifecycle with session generation management
 * - Explicit states: idle, connecting, starting, waiting_for_frames, playing, retrying, error, stopped
 * - Frame synchronization measurement & drift alert
 * - Dual-mode architecture: Mock Simulation (default) and Real Device Stream
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const HEADER_SIZE = 24;
const FRAME_METADATA = 0;
const FRAME_WIDE = 1;
const FRAME_DRIVER = 2;
const FRAME_STATUS = 3;
const FLAG_KEY = 1;
const FRAME_SYNC_TOLERANCE_US = 100_000; // 100ms
const MAX_DECODE_QUEUE = 12;

export class Camera360Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    // GLSL ES 1.00 shaders: request the matching context.
    this.gl = canvas.getContext('webgl');
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }
    this.program = null;
    this.frontTexture = null;
    this.rearTexture = null;
    this.yaw = 0.0;     // radians
    this.pitch = 0.0;   // radians (-75 deg to +75 deg)
    this.fov = 75.0 * DEG2RAD; // FOV along the longer viewport dimension
    this.viewMode = 0;  // 0: 360 stitched, 1: front only, 2: cabin only

    // Lens calibration parameters (configurable, not hardcoded APK constants)
    this.calibration = {
      frontFov: 186.0 * DEG2RAD,
      rearFov: 186.0 * DEG2RAD,
      frontCenter: [0.5, 0.5],
      rearCenter: [0.5, 0.5],
      frontDist: [0.0, 0.0],
      rearDist: [0.0, 0.0],
      rearPitch: -15.0 * DEG2RAD // Compensates for downward-looking driver camera mount tilt on windshield
    };

    this.sourceAspect = [1344 / 760, 1344 / 760];
    this.initGL();
  }

  initGL() {
    const gl = this.gl;
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec2 v_uv;

      uniform vec2 u_resolution;
      uniform float u_yaw;
      uniform float u_pitch;
      uniform float u_fov;
      uniform int u_viewMode;

      uniform sampler2D u_frontTex;
      uniform sampler2D u_rearTex;

      uniform vec2 u_frontCenter;
      uniform vec2 u_rearCenter;
      uniform vec2 u_frontDist;
      uniform vec2 u_rearDist;
      uniform float u_frontMaxAngle;
      uniform float u_rearMaxAngle;
      uniform vec2 u_sourceAspect;
      uniform float u_rearPitch;

      vec3 getRay(vec2 uv, float aspect) {
        vec2 ndc = uv * 2.0 - 1.0;
        float tanHalfFov = tan(u_fov * 0.5);
        vec3 ray = normalize(vec3(ndc.x * tanHalfFov * min(aspect, 1.0), ndc.y * tanHalfFov / max(aspect, 1.0), 1.0));

        // Pitch around X
        float cp = cos(u_pitch);
        float sp = sin(u_pitch);
        vec3 r1 = vec3(ray.x, ray.y * cp - ray.z * sp, ray.y * sp + ray.z * cp);

        // Yaw around Y
        float cy = cos(u_yaw);
        float sy = sin(u_yaw);
        vec3 r2 = vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy);

        return normalize(r2);
      }

      vec4 sampleFisheye(sampler2D tex, vec3 ray, vec3 forward, vec3 right, vec3 up, float maxAngle, vec2 center, vec2 dist, float sourceAspect, bool mirrorX) {
        float cosA = dot(ray, forward);
        // Fisheye overlap extends beyond 90 degrees; do not clip it.

        float angle = acos(clamp(cosA, -1.0, 1.0));
        if (angle > maxAngle) return vec4(0.0);

        float rx = dot(ray, right);
        float ry = dot(ray, up);
        float rLen = sqrt(rx * rx + ry * ry);
        if (rLen < 0.0001) {
          return texture2D(tex, center);
        }

        float normAngle = angle / maxAngle;
        float rDist = normAngle * (1.0 + dist.x * normAngle * normAngle + dist.y * pow(normAngle, 4.0));

        float nx = (rx / rLen) * rDist * 0.5;
        float ny = (ry / rLen) * rDist * 0.5 * sourceAspect;

        if (mirrorX) nx = -nx;

        // Fix inverted video: negate ny so top of camera frame (row 0) maps to top of view (sky/ceiling)
        vec2 texCoord = center + vec2(nx, -ny);
        if (texCoord.x < 0.0 || texCoord.x > 1.0 || texCoord.y < 0.0 || texCoord.y > 1.0) {
          return vec4(0.0);
        }

        float edgeFalloff = (1.0 - smoothstep(0.94, 1.0, normAngle));
        vec4 col = texture2D(tex, texCoord);
        return vec4(col.rgb, col.a * edgeFalloff);
      }

      void main() {
        float aspect = u_resolution.x / u_resolution.y;
        vec3 ray = getRay(v_uv, aspect);

        // Neutral dark cockpit background
        vec3 bg = mix(vec3(0.07, 0.09, 0.11), vec3(0.02, 0.03, 0.04), abs(ray.y));
        if (abs(ray.y) < 0.003) {
          bg += vec3(0.10, 0.16, 0.20);
        }

        // Rear camera orientation with mount pitch compensation
        float sPitch = sin(u_rearPitch);
        float cPitch = cos(u_rearPitch);
        vec3 rearForward = normalize(vec3(0.0, sPitch, -cPitch));
        vec3 rearUp = normalize(vec3(0.0, cPitch, sPitch));
        vec3 rearRight = vec3(-1.0, 0.0, 0.0);

        if (u_viewMode == 1) { // Front only
          vec4 f = sampleFisheye(u_frontTex, ray, vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), u_frontMaxAngle * 0.5, u_frontCenter, u_frontDist, u_sourceAspect.x, false);
          gl_FragColor = vec4(mix(bg, f.rgb, f.a), 1.0);
          return;
        }

        if (u_viewMode == 2) { // Cabin only
          vec4 r = sampleFisheye(u_rearTex, ray, rearForward, rearRight, rearUp, u_rearMaxAngle * 0.5, u_rearCenter, u_rearDist, u_sourceAspect.y, false);
          gl_FragColor = vec4(mix(bg, r.rgb, r.a), 1.0);
          return;
        }

        // 360 Stitched Mode
        vec4 frontCol = sampleFisheye(u_frontTex, ray, vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), u_frontMaxAngle * 0.5, u_frontCenter, u_frontDist, u_sourceAspect.x, false);
        vec4 rearCol = sampleFisheye(u_rearTex, ray, rearForward, rearRight, rearUp, u_rearMaxAngle * 0.5, u_rearCenter, u_rearDist, u_sourceAspect.y, false);

        float wFront = frontCol.a;
        float wRear = rearCol.a;
        float totalW = wFront + wRear;

        vec3 finalCol;
        if (totalW > 0.001) {
          finalCol = (frontCol.rgb * wFront + rearCol.rgb * wRear) / totalW;
          float maxA = max(wFront, wRear);
          finalCol = mix(bg, finalCol, maxA);
        } else {
          finalCol = bg;
        }

        gl_FragColor = vec4(finalCol, 1.0);
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Shader link failed: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;

    // Quad geometry
    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    this.vbo = vbo;

    this.uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      sourceAspect: gl.getUniformLocation(program, 'u_sourceAspect'),
      yaw: gl.getUniformLocation(program, 'u_yaw'),
      pitch: gl.getUniformLocation(program, 'u_pitch'),
      fov: gl.getUniformLocation(program, 'u_fov'),
      viewMode: gl.getUniformLocation(program, 'u_viewMode'),
      frontTex: gl.getUniformLocation(program, 'u_frontTex'),
      rearTex: gl.getUniformLocation(program, 'u_rearTex'),
      frontCenter: gl.getUniformLocation(program, 'u_frontCenter'),
      rearCenter: gl.getUniformLocation(program, 'u_rearCenter'),
      frontDist: gl.getUniformLocation(program, 'u_frontDist'),
      rearDist: gl.getUniformLocation(program, 'u_rearDist'),
      frontMaxAngle: gl.getUniformLocation(program, 'u_frontMaxAngle'),
      rearMaxAngle: gl.getUniformLocation(program, 'u_rearMaxAngle'),
      rearPitch: gl.getUniformLocation(program, 'u_rearPitch')
    };

    this.frontTexture = this.createTexture();
    this.rearTexture = this.createTexture();
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${err}`);
    }
    return shader;
  }

  createTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Initial 1x1 black pixel
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return tex;
  }

  updateTexture(textureUnit, source) {
    if (!source) return;
    const w = source.displayWidth || source.videoWidth || source.width || 0;
    const h = source.displayHeight || source.videoHeight || source.height || 0;
    if (w > 0 && h > 0) this.sourceAspect[textureUnit] = w / h;
    const gl = this.gl;
    const tex = textureUnit === 0 ? this.frontTexture : this.rearTexture;
    gl.activeTexture(textureUnit === 0 ? gl.TEXTURE0 : gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch (_) {
      // Handle cross-origin or transient frame decode errors safely
    }
  }

  render() {
    const gl = this.gl;
    if (!gl || !this.program) return;

    // CSS aspect ratios change on phones and on rotation. Never stretch a
    // fixed 16:9 framebuffer into a differently shaped viewport.
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round((this.canvas.clientWidth || this.canvas.width) * dpr));
    const height = Math.max(1, Math.round((this.canvas.clientHeight || this.canvas.height) * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    gl.viewport(0, 0, width, height);

    gl.useProgram(this.program);

    gl.uniform2f(this.uniforms.resolution, width, height);
    gl.uniform2fv(this.uniforms.sourceAspect, this.sourceAspect);
    gl.uniform1f(this.uniforms.yaw, this.yaw);
    gl.uniform1f(this.uniforms.pitch, this.pitch);
    gl.uniform1f(this.uniforms.fov, this.fov);
    gl.uniform1i(this.uniforms.viewMode, this.viewMode);

    gl.uniform1i(this.uniforms.frontTex, 0);
    gl.uniform1i(this.uniforms.rearTex, 1);

    gl.uniform2fv(this.uniforms.frontCenter, this.calibration.frontCenter);
    gl.uniform2fv(this.uniforms.rearCenter, this.calibration.rearCenter);
    gl.uniform2fv(this.uniforms.frontDist, this.calibration.frontDist);
    gl.uniform2fv(this.uniforms.rearDist, this.calibration.rearDist);
    gl.uniform1f(this.uniforms.frontMaxAngle, this.calibration.frontFov);
    gl.uniform1f(this.uniforms.rearMaxAngle, this.calibration.rearFov);
    gl.uniform1f(this.uniforms.rearPitch, this.calibration.rearPitch);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  setOrientation(yawDeg, pitchDeg) {
    this.yaw = (yawDeg * DEG2RAD) % (2 * Math.PI);
    this.pitch = Math.max(-20 * DEG2RAD, Math.min(25 * DEG2RAD, pitchDeg * DEG2RAD));
  }

  resetOrientation() {
    this.yaw = 0.0;
    this.pitch = 0.0;
  }

  getOrientationDeg() {
    let yawDeg = Math.round(this.yaw * RAD2DEG) % 360;
    if (yawDeg < 0) yawDeg += 360;
    const pitchDeg = Math.round(this.pitch * RAD2DEG);
    return { yaw: yawDeg, pitch: pitchDeg };
  }

  destroy() {
    const gl = this.gl;
    if (!gl) return;
    if (this.frontTexture) gl.deleteTexture(this.frontTexture);
    if (this.rearTexture) gl.deleteTexture(this.rearTexture);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.program) gl.deleteProgram(this.program);
    this.frontTexture = null;
    this.rearTexture = null;
    this.program = null;
  }
}

/**
 * Procedural mock camera feed generator for testing and offline simulation
 */
export class MockFeedGenerator {
  constructor() {
    const createCanvas = (w, h) => {
      if (typeof document !== 'undefined' && document.createElement) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
      }
      return {
        width: w,
        height: h,
        getContext: () => ({
          fillRect() {}, stroke() {}, beginPath() {}, arc() {}, fill() {},
          fillText() {}, createLinearGradient: () => ({ addColorStop() {} }),
          roundRect() {}, moveTo() {}, lineTo() {}, ellipse() {}
        })
      };
    };

    this.frontCanvas = createCanvas(640, 360);
    this.frontCtx = this.frontCanvas.getContext('2d');

    this.rearCanvas = createCanvas(640, 360);
    this.rearCtx = this.rearCanvas.getContext('2d');

    this.frameIndex = 0;
    this.lastFrontPts = 0;
    this.lastRearPts = 0;
  }

  renderFrame(timestampMs, offsetMs = 0) {
    this.frameIndex++;
    const now = timestampMs || Date.now();
    this.lastFrontPts = now;
    this.lastRearPts = now + offsetMs;

    this._drawFront(this.frontCtx, this.frontCanvas.width, this.frontCanvas.height, now, this.frameIndex);
    this._drawRear(this.rearCtx, this.rearCanvas.width, this.rearCanvas.height, now + offsetMs, this.frameIndex);

    return {
      frontSource: this.frontCanvas,
      rearSource: this.rearCanvas,
      frontPts: this.lastFrontPts,
      rearPts: this.lastRearPts,
      deltaMs: Math.abs(offsetMs)
    };
  }

  _drawFront(ctx, w, h, pts, frame) {
    // Road & sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, '#0f172a');
    sky.addColorStop(1, '#1e293b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.55);

    const ground = ctx.createLinearGradient(0, h * 0.55, 0, h);
    ground.addColorStop(0, '#334155');
    ground.addColorStop(1, '#0f172a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    // Horizon line
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.lineTo(w, h * 0.55);
    ctx.stroke();

    // Perspective lane lines / parking bay
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
    ctx.lineWidth = 3;
    const moveOffset = (frame * 2) % 60;
    ctx.beginPath();
    ctx.moveTo(w * 0.45, h * 0.55);
    ctx.lineTo(w * 0.15, h);
    ctx.moveTo(w * 0.55, h * 0.55);
    ctx.lineTo(w * 0.85, h);
    ctx.stroke();

    // Concentric calibration rings (Fisheye FOV)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
    ctx.arc(w / 2, h / 2, 130, 0, Math.PI * 2);
    ctx.stroke();

    // Front vehicle hood curve
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.ellipse(w / 2, h + 30, w * 0.42, 70, 0, 0, Math.PI, true);
    ctx.fill();

    // Info overlay
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('🚗 전방 광각 카메라 (FRONT WIDE · 0°)', 20, 32);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`PTS: ${pts} ms | Frame #${frame}`, 20, 54);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText('⚠️ [모의 시뮬레이션 모드] 실제 차량 촬영 영상이 아닙니다', 20, h - 18);
  }

  _drawRear(ctx, w, h, pts, frame) {
    // Cabin interior atmosphere
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);

    // Rear window view
    const winGrad = ctx.createLinearGradient(0, 40, 0, h * 0.5);
    winGrad.addColorStop(0, '#1e293b');
    winGrad.addColorStop(1, '#334155');
    ctx.fillStyle = winGrad;
    ctx.beginPath();
    ctx.roundRect(w * 0.22, 40, w * 0.56, h * 0.45, 16);
    ctx.fill();

    // Rearview mirror
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.roundRect(w * 0.42, 20, w * 0.16, 26, 6);
    ctx.fill();

    // Front seats / headrests outline
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.roundRect(w * 0.12, h * 0.42, w * 0.22, h * 0.58, [24, 24, 0, 0]);
    ctx.roundRect(w * 0.66, h * 0.42, w * 0.22, h * 0.58, [24, 24, 0, 0]);
    ctx.fill();

    // Headrests
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(w * 0.17, h * 0.32, w * 0.12, 45, 12);
    ctx.roundRect(w * 0.71, h * 0.32, w * 0.12, 45, 12);
    ctx.fill();

    // Concentric calibration rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
    ctx.arc(w / 2, h / 2, 130, 0, Math.PI * 2);
    ctx.stroke();

    // Info overlay
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('👤 실내 광각 카메라 (CABIN WIDE · 180°)', 20, 32);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(`PTS: ${pts} ms | Frame #${frame}`, 20, 54);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText('⚠️ [모의 시뮬레이션 모드] 실제 차량 촬영 영상이 아닙니다', 20, h - 18);
  }
}

/**
 * 360° Camera Monitoring Popup Modal Controller
 */
export class CarrotCamera360Modal {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.onClose = options.onClose || (() => {});
    this.lang = options.lang || 'ko';
    this.theme = options.theme || 'dark';

    this.isOpen = false;
    this.sessionSeq = 0;
    this.state = 'idle'; // idle | connecting | starting | waiting_for_frames | playing | retrying | error | stopped
    this.mode = 'mock';  // 'mock' | 'real'
    this.retryCount = 0;
    this.maxRetries = 3;
    this.firstFrameTimeoutMs = 45000;
    this.retryTimer = null;
    this.closeTimer = null;

    // Front/Rear video elements or mock generators
    this.renderer = null;
    this.mockFeed = null;
    this.animId = null;
    this.firstFrameTimer = null;
    this.returnFocusElem = null;

    // Simulation tweaks
    this.simConfig = {
      connectDelayMs: 600,
      missingStream: 'none', // 'none' | 'front' | 'rear' | 'both'
      ptsOffsetMs: 0,
      failOnRetry: false
    };

    // Real device WebCodecs streaming
    this.realStreams = {
      socket: null,
      heartbeatTimer: null,
      receiveBuffer: new Uint8Array(0),
      wide: {
        decoder: null,
        frame: null,
        ready: false,
        keySeen: false,
        droppingUntilKey: false,
        lastTimestamp: -1,
      },
      driver: {
        decoder: null,
        frame: null,
        ready: false,
        keySeen: false,
        droppingUntilKey: false,
        lastTimestamp: -1,
      },
    };

    this.buildDOM();
    this.bindEvents();
  }

  buildDOM() {
    const isEn = this.lang === 'en';
    const wrapper = document.createElement('div');
    wrapper.className = 'camera360-modal-root';
    wrapper.setAttribute('data-theme', this.theme);
    wrapper.style.display = 'none';

    wrapper.innerHTML = `
      <style>
        .camera360-modal-root {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #f1f5f9;
          padding: 16px;
          box-sizing: border-box;
          opacity: 0;
          transition: opacity 0.2s ease-out;
        }
        .camera360-modal-root.is-visible {
          opacity: 1;
        }
        .camera360-card {
          position: relative;
          width: 100%;
          max-width: 960px;
          max-height: calc(100vh - 32px);
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-sizing: border-box;
        }
        .camera360-modal-root[data-theme="light"] .camera360-card {
          background: #ffffff;
          border-color: #e2e8f0;
          color: #0f172a;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2);
        }
        .camera360-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          gap: 12px;
          flex-wrap: wrap;
        }
        .camera360-modal-root[data-theme="light"] .camera360-topbar {
          border-bottom-color: #f1f5f9;
        }
        .camera360-header-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .camera360-title {
          font-size: 17px;
          font-weight: 700;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .camera360-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 20px;
          font-size: 11.5px;
          font-weight: 600;
        }
        .pill-mode-mock {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .pill-mode-real {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .pill-status {
          background: rgba(148, 163, 184, 0.15);
          color: #cbd5e1;
        }
        .pill-status.status-playing {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        .pill-status.status-error {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .pill-status.status-waiting {
          background: rgba(234, 179, 8, 0.15);
          color: #fde047;
          border: 1px solid rgba(234, 179, 8, 0.3);
        }
        .pill-sync-warn {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          border: 1px solid #ef4444;
          display: none;
        }
        .camera360-close-btn {
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 8px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          transition: background 0.15s;
        }
        .camera360-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .camera360-modal-root[data-theme="light"] .camera360-close-btn:hover {
          background: #f1f5f9;
        }
        .camera360-close-btn:focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
        .camera360-viewport {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          min-height: 280px;
          max-height: 560px;
          background: #000000;
          overflow: hidden;
          cursor: grab;
          touch-action: none;
        }
        .camera360-viewport.is-dragging {
          cursor: grabbing;
        }
        .camera360-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
        .camera360-hud {
          position: absolute;
          top: 12px;
          left: 12px;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 6px 12px;
          font-size: 12px;
          pointer-events: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hud-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
        }
        .camera360-overlay {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.92);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
          gap: 14px;
          z-index: 10;
        }
        .camera360-spinner {
          width: 38px;
          height: 38px;
          border: 3px solid rgba(255, 255, 255, 0.15);
          border-top-color: #38bdf8;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .camera360-msg {
          font-size: 14px;
          color: #cbd5e1;
          max-width: 440px;
          line-height: 1.5;
        }
        .camera360-retry-btn {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          min-height: 44px;
          min-width: 44px;
          transition: background 0.15s;
        }
        .camera360-retry-btn:hover {
          background: #1d4ed8;
        }
        .camera360-bottombar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          gap: 12px;
          flex-wrap: wrap;
        }
        .camera360-modal-root[data-theme="light"] .camera360-bottombar {
          border-top-color: #f1f5f9;
        }
        .camera360-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #94a3b8;
        }
        .camera360-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .camera360-view-tabs {
          display: flex;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 2px;
          gap: 2px;
        }
        .camera360-modal-root[data-theme="light"] .camera360-view-tabs {
          background: #f1f5f9;
        }
        .view-btn {
          background: transparent;
          border: none;
          color: inherit;
          font-size: 12px;
          font-weight: 500;
          padding: 7px 12px;
          border-radius: 8px;
          cursor: pointer;
          min-height: 38px;
          transition: background 0.15s, color 0.15s;
        }
        .view-btn.is-active {
          background: #3b82f6;
          color: #ffffff;
          font-weight: 600;
        }
        .reset-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: inherit;
          padding: 7px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .reset-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .camera360-modal-root[data-theme="light"] .reset-btn {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        @media (max-width: 640px) {
          .camera360-modal-root { padding: 0; }
          .camera360-card {
            height: 100dvh;
            max-height: 100dvh;
            border-radius: 0;
            border: 0;
          }
          .camera360-topbar { padding-top: max(12px, env(safe-area-inset-top)); flex-shrink: 0; }
          .camera360-bottombar { padding-bottom: max(12px, env(safe-area-inset-bottom)); flex-shrink: 0; }
          .camera360-viewport {
            flex: 1;
            aspect-ratio: auto;
            min-height: 0;
            max-height: none;
          }
          .camera360-canvas { position: absolute; inset: 0; }
          .camera360-topbar, .camera360-bottombar {
            padding: 10px 14px;
          }
          .camera360-controls {
            width: 100%;
            justify-content: space-between;
          }
        }
      </style>

      <div class="camera360-card" role="dialog" aria-modal="true" aria-labelledby="cam360Title">
        <header class="camera360-topbar">
          <div class="camera360-header-info">
            <h2 id="cam360Title" class="camera360-title">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <ellipse cx="12" cy="12" rx="10" ry="4"></ellipse>
                <line x1="12" y1="2" x2="12" y2="22"></line>
              </svg>
              <span>${isEn ? '360° Camera Monitoring' : '360° 카메라 모니터링'}</span>
            </h2>
            <span class="camera360-pill pill-mode-mock" id="cam360ModePill">🧪 ${isEn ? 'Simulation Mode' : '모의 모드'}</span>
            <span class="camera360-pill pill-status" id="cam360StatusPill">${isEn ? 'Connecting...' : '연결 중...'}</span>
            <span class="camera360-pill pill-sync-warn" id="cam360SyncWarn">⚠️ ${isEn ? 'Sync Delta' : '동기화 편차'}</span>
          </div>
          <button type="button" class="camera360-close-btn" id="cam360CloseBtn" aria-label="${isEn ? 'Close' : '닫기'}">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div class="camera360-viewport" id="cam360Viewport">
          <canvas class="camera360-canvas" id="cam360Canvas" width="960" height="540"></canvas>
          <div class="camera360-hud">
            <div class="hud-dot" id="cam360HudDot"></div>
            <span id="cam360HudYaw">0° (정면 · FRONT)</span>
          </div>
          <div class="camera360-overlay" id="cam360Overlay">
            <div class="camera360-spinner" id="cam360Spinner"></div>
            <div class="camera360-msg" id="cam360Msg">${isEn ? 'Initializing cameras...' : '카메라 스트림을 준비하고 있습니다...'}</div>
            <button type="button" class="camera360-retry-btn" id="cam360RetryBtn" style="display:none">
              ${isEn ? 'Retry Connection' : '다시 시도'}
            </button>
          </div>
        </div>

        <footer class="camera360-bottombar">
          <div class="camera360-hint">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3"></path>
            </svg>
            <span>${isEn ? 'Drag mouse or touch to rotate 360°' : '화면을 드래그하여 360° 시야를 자유롭게 회전하세요'}</span>
          </div>
          <div class="camera360-controls">
            <div class="camera360-view-tabs">
              <button type="button" class="view-btn is-active" data-view="0">${isEn ? '360° View' : '360° 합성'}</button>
              <button type="button" class="view-btn" data-view="1">${isEn ? 'Front' : '전방 광각'}</button>
              <button type="button" class="view-btn" data-view="2">${isEn ? 'Cabin' : '실내 광각'}</button>
            </div>
            <button type="button" class="reset-btn" id="cam360ResetBtn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
              <span>${isEn ? 'Front' : '정면 리셋'}</span>
            </button>
          </div>
        </footer>
      </div>
    `;

    this.wrapper = wrapper;
    this.container.appendChild(wrapper);

    // Cache elements
    this.canvas = wrapper.querySelector('#cam360Canvas');
    this.viewport = wrapper.querySelector('#cam360Viewport');
    this.modePill = wrapper.querySelector('#cam360ModePill');
    this.statusPill = wrapper.querySelector('#cam360StatusPill');
    this.syncWarn = wrapper.querySelector('#cam360SyncWarn');
    this.overlay = wrapper.querySelector('#cam360Overlay');
    this.spinner = wrapper.querySelector('#cam360Spinner');
    this.msgEl = wrapper.querySelector('#cam360Msg');
    this.retryBtn = wrapper.querySelector('#cam360RetryBtn');
    this.hudYaw = wrapper.querySelector('#cam360HudYaw');
    this.hudDot = wrapper.querySelector('#cam360HudDot');
    this.closeBtn = wrapper.querySelector('#cam360CloseBtn');
    this.resetBtn = wrapper.querySelector('#cam360ResetBtn');
    this.viewButtons = Array.from(wrapper.querySelectorAll('.view-btn'));
  }

  bindEvents() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.resetBtn.addEventListener('click', () => {
      if (this.renderer) {
        this.renderer.resetOrientation();
        this.updateHud();
      }
    });
    this.retryBtn.addEventListener('click', () => {
      this.retryCount = 0;
      this.startSession();
    });

    this.viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = parseInt(btn.getAttribute('data-view'), 10);
        this.viewButtons.forEach(b => b.classList.toggle('is-active', b === btn));
        if (this.renderer) {
          this.renderer.viewMode = mode;
          this.renderer.setOrientation(mode === 2 ? 180 : 0, 0);
          this.updateHud();
        }
      });
    });

    // Pointer events for dragging
    let isDragging = false;
    let dragPointer = null;
    let startX = 0;
    let startY = 0;
    let initialYaw = 0;
    let initialPitch = 0;

    const onPointerDown = (e) => {
      if (!this.renderer || this.state !== 'playing' || isDragging || e.button > 0) return;
      dragPointer = e.pointerId;
      e.preventDefault();
      isDragging = true;
      this.viewport.classList.add('is-dragging');
      this.viewport.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      initialYaw = this.renderer.yaw;
      initialPitch = this.renderer.pitch;
    };

    const onPointerMove = (e) => {
      if (!isDragging || !this.renderer || e.pointerId !== dragPointer) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const rect = this.viewport.getBoundingClientRect();
      const sensitivityX = this.renderer.fov / Math.max(rect.width, rect.height, 1);
      const sensitivityY = sensitivityX * 0.35;

      this.renderer.yaw = (initialYaw - dx * sensitivityX) % (2 * Math.PI);
      this.renderer.pitch = Math.max(-20 * DEG2RAD, Math.min(25 * DEG2RAD, initialPitch - dy * sensitivityY));
      this.updateHud();
    };

    const onPointerUp = (e) => {
      if (!isDragging || e.pointerId !== dragPointer) return;
      isDragging = false;
      dragPointer = null;
      this.viewport.classList.remove('is-dragging');
      try {
        this.viewport.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    this.viewport.addEventListener('pointerdown', onPointerDown);
    this.viewport.addEventListener('pointermove', onPointerMove);
    this.viewport.addEventListener('pointerup', onPointerUp);
    this.viewport.addEventListener('pointercancel', onPointerUp);
    this.viewport.addEventListener('lostpointercapture', onPointerUp);
    this.viewport.addEventListener('dblclick', () => {
      if (!this.renderer) return;
      this.renderer.pitch = 0.0;
      this.updateHud();
    });

    // Escape key listener
    this._onKeyDown = (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  updateHud() {
    if (!this.renderer || !this.hudYaw) return;
    const { yaw, pitch } = this.renderer.getOrientationDeg();
    const isEn = this.lang === 'en';
    let dirName = isEn ? 'FRONT' : '정면';
    if (yaw >= 45 && yaw < 135) dirName = isEn ? 'RIGHT' : '우측';
    else if (yaw >= 135 && yaw < 225) dirName = isEn ? 'CABIN / REAR' : '실내 / 후방';
    else if (yaw >= 225 && yaw < 315) dirName = isEn ? 'LEFT' : '좌측';

    this.hudYaw.textContent = `${yaw}° (${dirName} · pitch ${pitch}°)`;
  }

  setTheme(theme) {
    this.theme = theme;
    if (this.wrapper) {
      this.wrapper.setAttribute('data-theme', theme);
    }
  }

  setLanguage(lang) {
    this.lang = lang;
  }

  open({ mode = 'mock', hass = null, deviceId = '', cameraEntities = {}, returnFocusElem = null } = {}) {
    if (this.isOpen) return;
    clearTimeout(this.closeTimer);
    this.isOpen = true;
    this.mode = mode;
    this.hass = hass;
    this.deviceId = deviceId;
    this.cameraEntities = cameraEntities;
    this.returnFocusElem = returnFocusElem;
    this.retryCount = 0;
    this.sessionSeq++;
    this.viewDeadline = Date.now() + 300000;
    clearTimeout(this.deadlineTimer);
    this.deadlineTimer = setTimeout(() => {
      if (!this.isOpen) return;
      this.cleanupSession();
      this.setState('error', this.lang === 'en' ? 'Viewing time ended. Close and reopen to start a new session.' : '시청 시간이 종료되었습니다. 닫고 다시 열어 새로 시작하세요.');
    }, 300000);
    const currentSeq = this.sessionSeq;

    // Apply modal appearance
    this.wrapper.style.display = 'flex';
    requestAnimationFrame(() => this.wrapper.classList.add('is-visible'));
    document.body.style.overflow = 'hidden'; // Lock background scroll

    // Focus close button initially
    this.closeBtn.focus();

    // Mode Pill update
    const isEn = this.lang === 'en';
    if (this.mode === 'mock') {
      this.modePill.className = 'camera360-pill pill-mode-mock';
      this.modePill.textContent = `🧪 ${isEn ? 'Mock Simulation' : '모의 시뮬레이션'}`;
    } else {
      this.modePill.className = 'camera360-pill pill-mode-real';
      this.modePill.textContent = `🚗 ${isEn ? 'Live Vehicle' : '실기기 연결'}`;
    }

    this.startSession(currentSeq);
  }

  setState(newState, message = '') {
    this.state = newState;
    const isEn = this.lang === 'en';

    this.statusPill.className = 'camera360-pill pill-status';
    this.spinner.style.display = 'none';
    this.retryBtn.style.display = 'none';

    switch (newState) {
      case 'connecting':
        this.statusPill.classList.add('status-waiting');
        this.statusPill.textContent = isEn ? 'Connecting...' : '연결 중...';
        this.overlay.style.display = 'flex';
        this.spinner.style.display = 'block';
        this.msgEl.textContent = message || (isEn ? 'Establishing connection to camera service...' : '카메라 서비스에 연결 중입니다...');
        break;

      case 'starting':
        this.statusPill.classList.add('status-waiting');
        this.statusPill.textContent = isEn ? 'Starting...' : '카메라 구동 중...';
        this.overlay.style.display = 'flex';
        this.spinner.style.display = 'block';
        this.msgEl.textContent = message || (isEn ? 'Starting camera capture hardware...' : '차량 카메라 장치를 구동하고 있습니다...');
        break;

      case 'waiting_for_frames':
        this.statusPill.classList.add('status-waiting');
        this.statusPill.textContent = isEn ? 'Waiting for frames...' : '프레임 수신 대기 중...';
        this.overlay.style.display = 'flex';
        this.spinner.style.display = 'block';
        this.msgEl.textContent = message || (isEn ? 'Waiting for video streams to decode...' : '전방·실내 영상 스트림 수신 대기 중...');
        break;

      case 'playing':
        this.statusPill.classList.add('status-playing');
        this.statusPill.textContent = isEn ? 'Playing 360°' : '360° 정상 재생 중';
        this.overlay.style.display = 'none';
        break;

      case 'retrying':
        this.statusPill.classList.add('status-waiting');
        this.statusPill.textContent = isEn ? `Retrying (${this.retryCount}/${this.maxRetries})...` : `재시도 중 (${this.retryCount}/${this.maxRetries})...`;
        this.overlay.style.display = 'flex';
        this.spinner.style.display = 'block';
        this.msgEl.textContent = message || (isEn ? 'Reconnecting camera stream...' : '영상 연결을 재시도하고 있습니다...');
        break;

      case 'error':
        this.statusPill.classList.add('status-error');
        this.statusPill.textContent = isEn ? 'Stream Error' : '연결 실패';
        this.overlay.style.display = 'flex';
        this.spinner.style.display = 'none';
        this.retryBtn.style.display = 'block';
        this.msgEl.textContent = message || (isEn ? 'Failed to establish camera stream.' : '카메라 영상을 가져오지 못했습니다.');
        break;

      case 'stopped':
        this.statusPill.textContent = isEn ? 'Stopped' : '종료됨';
        this.overlay.style.display = 'flex';
        this.spinner.style.display = 'none';
        this.msgEl.textContent = message || (isEn ? 'Camera monitoring stopped.' : '카메라 모니터링이 종료되었습니다.');
        break;
    }
  }

  async startSession(targetSeq = this.sessionSeq) {
    if (this.sessionSeq !== targetSeq || !this.isOpen) return;

    this.cleanupSession();
    targetSeq = this.sessionSeq;
    if (this.viewDeadline && Date.now() >= this.viewDeadline) {
      this.setState('error', this.lang === 'en' ? 'Viewing time ended. Close and reopen.' : '시청 시간이 종료되었습니다. 닫고 다시 열어주세요.');
      return;
    }

    try {
      this.renderer = new Camera360Renderer(this.canvas);
      this.renderer.resetOrientation();
      this.updateHud();
    } catch (err) {
      this.setState('error', `WebGL 초기화 실패: ${err.message}`);
      return;
    }

    if (this.mode === 'mock') {
      this.startMockSession(targetSeq);
    } else {
      this.startRealSession(targetSeq);
    }
  }

  startMockSession(targetSeq) {
    const isEn = this.lang === 'en';
    this.setState('connecting', isEn ? 'Connecting to simulated vehicle cameras...' : '모의 차량 카메라에 연결하는 중입니다...');

    const delay = this.simConfig.connectDelayMs || 600;
    setTimeout(() => {
      if (this.sessionSeq !== targetSeq || !this.isOpen) return;

      this.setState('starting', isEn ? 'Initializing virtual camera sensors...' : '가상 카메라 센서를 구동하고 있습니다...');

      setTimeout(() => {
        if (this.sessionSeq !== targetSeq || !this.isOpen) return;

        // Check if missing stream simulated
        if (this.simConfig.missingStream === 'front') {
          this.setState('waiting_for_frames', isEn ? 'Waiting for Front Wide camera frame...' : '전방 광각 카메라 프레임 대기 중...');
          return;
        }
        if (this.simConfig.missingStream === 'rear') {
          this.setState('waiting_for_frames', isEn ? 'Waiting for Cabin Wide camera frame...' : '실내 광각 카메라 프레임 대기 중...');
          return;
        }
        if (this.simConfig.missingStream === 'both') {
          this.setState('waiting_for_frames', isEn ? 'Waiting for both camera streams...' : '두 카메라 스트림 수신 대기 중...');
          return;
        }

        this.mockFeed = new MockFeedGenerator();
        this.setState('playing');

        const loop = () => {
          if (this.sessionSeq !== targetSeq || !this.isOpen) return;
          const frame = this.mockFeed.renderFrame(Date.now(), this.simConfig.ptsOffsetMs || 0);

          if (this.renderer) {
            this.renderer.updateTexture(0, frame.frontSource);
            this.renderer.updateTexture(1, frame.rearSource);
            this.renderer.render();
          }

          // Measure sync delta
          if (frame.deltaMs > 500) {
            this.syncWarn.style.display = 'inline-flex';
            this.syncWarn.textContent = `⚠️ ${isEn ? 'Sync Delta' : '동기화 편차'}: ${(frame.deltaMs / 1000).toFixed(2)}s`;
          } else {
            this.syncWarn.style.display = 'none';
          }

          this.animId = requestAnimationFrame(loop);
        };
        this.animId = requestAnimationFrame(loop);

      }, delay);
    }, delay);
  }

  async startRealSession(targetSeq) {
    const isEn = this.lang === 'en';
    const wideEntity = this.cameraEntities?.wide;
    const driverEntity = this.cameraEntities?.driver;

    if (!wideEntity || !driverEntity) {
      this.setState('error', isEn ? 'Carrot HA wide and driver camera entities not configured.' : 'Carrot HA 전방 광각 및 실내 카메라 엔터티가 설정되지 않았습니다.');
      return;
    }

    // Safety offroad / parking check via HA state
    const wideState = this.hass?.states?.[wideEntity];
    const driverState = this.hass?.states?.[driverEntity];
    if (wideState?.state === 'unavailable' || driverState?.state === 'unavailable') {
      this.setState('error', isEn ? 'Comma camera service is currently offline or offroad check pending.' : 'Comma 카메라 서비스가 오프라인이거나 주차 상태 확인이 필요합니다.');
      return;
    }

    // WebCodecs support validation
    if (typeof window === 'undefined' || typeof VideoDecoder === 'undefined' || typeof EncodedVideoChunk === 'undefined') {
      this.handlePlaybackFailure(isEn ? 'WebCodecs hardware video decoding is not supported in this browser.' : '현재 브라우저에서 WebCodecs 하드웨어 디코딩을 지원하지 않습니다.');
      return;
    }

    this.setState('connecting', isEn ? 'Connecting to live camera WebSocket...' : '실시간 카메라 웹소켓에 연결하고 있습니다...');

    this.firstFrameTimer = setTimeout(() => {
      if (this.sessionSeq !== targetSeq || !this.isOpen) return;
      if (this.state !== 'playing') {
        this.handlePlaybackFailure(isEn ? 'First frame timeout: camera capture delayed.' : '첫 프레임 수신 시간 초과: 카메라 구동 지연.');
      }
    }, this.firstFrameTimeoutMs);

    try {
      // Determine WebSocket live URL
      const livePath = wideState?.attributes?.live_ws_url || driverState?.attributes?.live_ws_url;
      let wsUrl = '';
      if (livePath) {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${proto}//${window.location.host}${livePath}`;
      } else {
        const entityId = wideEntity || driverEntity || '';
        const match = entityId.match(/camera\.(.+)_camera_/);
        const deviceId = match ? match[1] : '';
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${proto}//${window.location.host}/api/carrot_ha/v1/camera/${deviceId}/live`;
      }

      const socket = new WebSocket(wsUrl);
      socket.binaryType = 'arraybuffer';
      this.realStreams.socket = socket;

      socket.onopen = () => {
        if (this.sessionSeq !== targetSeq || !this.isOpen) return;
        this.setState('starting', isEn ? 'Connected. Waiting for camera frames...' : '연결됨. 카메라 프레임 수신 대기 중...');
        this._startHeartbeat(socket, targetSeq);
      };

      socket.onmessage = (event) => {
        if (this.sessionSeq !== targetSeq || !this.isOpen) return;
        if (typeof event.data === 'string') return;
        this._appendChunk(event.data, targetSeq);
      };

      socket.onerror = () => {
        if (this.sessionSeq !== targetSeq || !this.isOpen) return;
        this.handlePlaybackFailure(isEn ? 'Camera WebSocket connection failed.' : '카메라 웹소켓 연결에 실패했습니다.');
      };

      socket.onclose = (ev) => {
        if (this.sessionSeq !== targetSeq || !this.isOpen) return;
        if (ev.code !== 1000) {
          this.handlePlaybackFailure(isEn ? 'Camera stream disconnected.' : '카메라 스트림 연결이 종료되었습니다.');
        }
      };

    } catch (err) {
      if (this.sessionSeq !== targetSeq || !this.isOpen) return;
      this.handlePlaybackFailure(err.message);
    }
  }

  _startHeartbeat(socket, targetSeq) {
    if (this.realStreams.heartbeatTimer) clearInterval(this.realStreams.heartbeatTimer);
    this.realStreams.heartbeatTimer = setInterval(() => {
      if (this.sessionSeq !== targetSeq || !this.isOpen || !this.realStreams.socket) return;
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send('WLP1');
        } catch (_) {}
      }
    }, 3000);
  }

  _appendChunk(chunk, targetSeq) {
    const incoming = new Uint8Array(chunk);
    let buf = this.realStreams.receiveBuffer;
    if (buf.length === 0) {
      this.realStreams.receiveBuffer = incoming;
    } else {
      const merged = new Uint8Array(buf.length + incoming.length);
      merged.set(buf);
      merged.set(incoming, buf.length);
      this.realStreams.receiveBuffer = merged;
    }
    this._consumeFrames(targetSeq);
  }

  _consumeFrames(targetSeq) {
    let offset = 0;
    let buf = this.realStreams.receiveBuffer;
    while (buf.length - offset >= HEADER_SIZE) {
      const view = new DataView(buf.buffer, buf.byteOffset + offset);
      // Verify magic 'WLV1' = 87, 76, 86, 49
      if (view.getUint8(0) !== 87 || view.getUint8(1) !== 76 ||
          view.getUint8(2) !== 86 || view.getUint8(3) !== 49) {
        offset += 1;
        continue;
      }
      const frameType = view.getUint8(4);
      const flags = view.getUint8(5);
      const timestamp = view.getUint32(12) * 4294967296 + view.getUint32(16);
      const payloadSize = view.getUint32(20);
      if (buf.length - offset < HEADER_SIZE + payloadSize) break;

      const payload = buf.slice(offset + HEADER_SIZE, offset + HEADER_SIZE + payloadSize);
      const isKey = Boolean(flags & FLAG_KEY);

      if (frameType === FRAME_WIDE) {
        this._decodeVideo('wide', payload, isKey, timestamp, targetSeq);
      } else if (frameType === FRAME_DRIVER) {
        this._decodeVideo('driver', payload, isKey, timestamp, targetSeq);
      }

      offset += HEADER_SIZE + payloadSize;
    }
    this.realStreams.receiveBuffer = buf.slice(offset);
  }

  _decoderFor(name, targetSeq) {
    const stream = this.realStreams[name];
    if (stream.decoder && stream.decoder.state !== 'closed') return stream.decoder;
    const isEn = this.lang === 'en';

    const decoder = new VideoDecoder({
      output: (frame) => {
        if (this.sessionSeq !== targetSeq || !this.isOpen) {
          frame.close();
          return;
        }
        if (stream.frame) stream.frame.close();
        stream.frame = frame;
        stream.ready = true;
        this._checkStreamsReady(targetSeq);
      },
      error: (err) => {
        console.error(`Carrot 360 ${name} decoder error:`, err);
        this.handlePlaybackFailure(isEn ? `${name} video decoding error.` : `${name} 비디오 디코딩 오류.`);
      }
    });

    decoder.configure({
      codec: 'avc1.640020',
      hardwareAcceleration: 'prefer-hardware',
      optimizeForLatency: true,
    });

    stream.decoder = decoder;
    return decoder;
  }

  _resetDecoder(name, targetSeq) {
    const stream = this.realStreams[name];
    if (!stream) return;
    if (stream.frame) {
      try { stream.frame.close(); } catch (_) {}
      stream.frame = null;
    }
    if (stream.decoder && stream.decoder.state !== 'closed') {
      try { stream.decoder.close(); } catch (_) {}
    }
    stream.decoder = null;
    stream.keySeen = false;
    stream.droppingUntilKey = false;
    stream.lastTimestamp = -1;
  }

  _decodeVideo(name, payload, isKey, timestamp, targetSeq) {
    const stream = this.realStreams[name];
    if (!stream) return;

    if (stream.droppingUntilKey && !isKey) return;

    if (!isKey && stream.decoder?.decodeQueueSize > MAX_DECODE_QUEUE) {
      stream.droppingUntilKey = true;
      return;
    }
    if (isKey && (stream.droppingUntilKey || stream.decoder?.decodeQueueSize > MAX_DECODE_QUEUE)) {
      this._resetDecoder(name, targetSeq);
    }
    if (!stream.keySeen && !isKey) return;
    if (isKey) stream.keySeen = true;

    const decoder = this._decoderFor(name, targetSeq);
    const safeTimestamp = Math.max(stream.lastTimestamp + 1, timestamp);
    stream.lastTimestamp = safeTimestamp;

    try {
      decoder.decode(new EncodedVideoChunk({
        type: isKey ? 'key' : 'delta',
        timestamp: safeTimestamp,
        data: payload,
      }));
    } catch (err) {
      console.warn(`Carrot 360 decode chunk error on ${name}:`, err);
    }
  }

  _checkStreamsReady(targetSeq) {
    if (this.sessionSeq !== targetSeq || !this.isOpen) return;
    const wideReady = Boolean(this.realStreams.wide.ready && this.realStreams.wide.frame);
    const driverReady = Boolean(this.realStreams.driver.ready && this.realStreams.driver.frame);
    const isEn = this.lang === 'en';

    if (wideReady && driverReady) {
      if (this.firstFrameTimer) {
        clearTimeout(this.firstFrameTimer);
        this.firstFrameTimer = null;
      }
      if (this.state !== 'playing') {
        this.setState('playing');
        this.startRealRenderLoop(targetSeq);
      }
    } else if (wideReady && !driverReady) {
      this.setState('waiting_for_frames', isEn ? 'Front ready. Waiting for Cabin camera...' : '전방 수신 완료. 실내 카메라 대기 중...');
    } else if (!wideReady && driverReady) {
      this.setState('waiting_for_frames', isEn ? 'Cabin ready. Waiting for Front camera...' : '실내 수신 완료. 전방 카메라 대기 중...');
    }
  }

  startRealRenderLoop(targetSeq) {
    const isEn = this.lang === 'en';

    const loop = () => {
      if (this.sessionSeq !== targetSeq || !this.isOpen) return;

      const wideFrame = this.realStreams.wide.frame;
      const driverFrame = this.realStreams.driver.frame;

      if (this.renderer && wideFrame && driverFrame) {
        this.renderer.updateTexture(0, wideFrame);
        this.renderer.updateTexture(1, driverFrame);
        this.renderer.render();

        const wideTs = this.realStreams.wide.lastTimestamp;
        const driverTs = this.realStreams.driver.lastTimestamp;
        if (wideTs > 0 && driverTs > 0) {
          const deltaUs = Math.abs(wideTs - driverTs);
          if (deltaUs > FRAME_SYNC_TOLERANCE_US) {
            this.syncWarn.style.display = 'inline-flex';
            this.syncWarn.textContent = `⚠️ ${isEn ? 'Sync Delta' : '동기화 편차'}: ${(deltaUs / 1000).toFixed(0)}ms`;
          } else {
            this.syncWarn.style.display = 'none';
          }
        }
      }

      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  handlePlaybackFailure(reason) {
    if (!this.isOpen || this.state === 'retrying' || this.state === 'error') return;
    this.cleanupSession();

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState('retrying', `${reason} (재시도 중 ${this.retryCount}/${this.maxRetries})`);
      const retrySeq = this.sessionSeq;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (this.isOpen && this.sessionSeq === retrySeq) this.startSession(retrySeq);
      }, 2000);
    } else {
      this.setState('error', `${reason} — 최대 재시도 횟수를 초과했습니다.`);
    }
  }

  cleanupSession() {
    this.sessionSeq++;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.firstFrameTimer) {
      clearTimeout(this.firstFrameTimer);
      this.firstFrameTimer = null;
    }
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
    this.mockFeed = null;

    if (this.realStreams.heartbeatTimer) {
      clearInterval(this.realStreams.heartbeatTimer);
      this.realStreams.heartbeatTimer = null;
    }
    if (this.realStreams.socket) {
      try { this.realStreams.socket.close(1000, 'cleanup'); } catch (_) {}
      this.realStreams.socket = null;
    }
    this.realStreams.receiveBuffer = new Uint8Array(0);

    for (const name of ['wide', 'driver']) {
      const stream = this.realStreams[name];
      if (stream) {
        if (stream.frame) {
          try { stream.frame.close(); } catch (_) {}
          stream.frame = null;
        }
        if (stream.decoder && stream.decoder.state !== 'closed') {
          try { stream.decoder.close(); } catch (_) {}
        }
        stream.decoder = null;
        stream.ready = false;
        stream.keySeen = false;
        stream.droppingUntilKey = false;
        stream.lastTimestamp = -1;
      }
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    clearTimeout(this.deadlineTimer);
    this.sessionSeq++; // Invalidate pending callbacks

    this.cleanupSession();
    this.setState('stopped');

    this.wrapper.classList.remove('is-visible');
    const closeSeq = this.sessionSeq;
    this.closeTimer = setTimeout(() => {
      if (this.isOpen || this.sessionSeq !== closeSeq) return;
      this.wrapper.style.display = 'none';
      document.body.style.overflow = '';
      if (this.returnFocusElem && typeof this.returnFocusElem.focus === 'function') {
        this.returnFocusElem.focus();
      }
      this.onClose();
    }, 200);
  }

  destroy() {
    this.close();
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.wrapper && this.wrapper.parentElement) {
      this.wrapper.parentElement.removeChild(this.wrapper);
    }
  }
}
