import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CarrotCamera360Modal} from '../custom_components/carrot_ha/frontend/carrot-camera-360.js';

function fixture() {
  const m = Object.create(CarrotCamera360Modal.prototype);
  Object.assign(m, {
    isOpen: true,
    sessionSeq: 1,
    state: 'connecting',
    retryCount: 0,
    maxRetries: 3,
    firstFrameTimeoutMs: 45000,
    lang: 'ko',
    realStreams: {
      socket: null,
      heartbeatTimer: null,
      receiveBuffer: new Uint8Array(0),
      wide: { decoder: null, frame: null, ready: false, keySeen: false, droppingUntilKey: false, lastTimestamp: -1 },
      driver: { decoder: null, frame: null, ready: false, keySeen: false, droppingUntilKey: false, lastTimestamp: -1 },
    },
    cameraEntities: { wide: 'camera.wide', driver: 'camera.driver' },
    hass: { states: { 'camera.wide': { state: 'idle', attributes: { live_ws_url: '/api/camera/test/live' } } } },
    setState(s) { this.state = s; },
  });
  return m;
}

test('cleanupSession safely closes websocket, decoders, and clears buffers', () => {
  const m = fixture();
  let socketClosed = false;
  let decoderClosed = false;
  let frameClosed = false;

  m.realStreams.socket = {
    close() { socketClosed = true; }
  };
  m.realStreams.heartbeatTimer = setInterval(() => {}, 1000);
  m.realStreams.receiveBuffer = new Uint8Array([1, 2, 3]);
  m.realStreams.wide.decoder = {
    state: 'configured',
    close() { decoderClosed = true; }
  };
  m.realStreams.wide.frame = {
    close() { frameClosed = true; }
  };

  m.cleanupSession();

  assert.equal(socketClosed, true);
  assert.equal(decoderClosed, true);
  assert.equal(frameClosed, true);
  assert.equal(m.realStreams.heartbeatTimer, null);
  assert.equal(m.realStreams.receiveBuffer.length, 0);
  assert.equal(m.realStreams.wide.decoder, null);
  assert.equal(m.realStreams.wide.frame, null);
});

test('WLV1 binary frame parsing demuxes wide and driver payloads', () => {
  const m = fixture();
  const decoded = [];
  m._decodeVideo = (name, payload, isKey, timestamp) => {
    decoded.push({ name, payload, isKey, timestamp });
  };

  // Build a 24-byte WLV1 header for Wide Keyframe
  // Magic: 'WLV1' (87, 76, 86, 49)
  // FrameType: 1 (Wide)
  // Flags: 1 (Keyframe)
  // Timestamp: 1000 us
  // Payload: 4 bytes [10, 20, 30, 40]
  const buf = new Uint8Array(28);
  buf.set([87, 76, 86, 49, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 232, 0, 0, 0, 4, 10, 20, 30, 40]);

  m.realStreams.receiveBuffer = buf;
  m._consumeFrames(1);

  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].name, 'wide');
  assert.equal(decoded[0].isKey, true);
  assert.equal(decoded[0].timestamp, 1000);
  assert.deepEqual(Array.from(decoded[0].payload), [10, 20, 30, 40]);
  assert.equal(m.realStreams.receiveBuffer.length, 0);
});

test('stale session completion cannot update state after close', () => {
  const m = fixture();
  m.startRealRenderLoop = () => { m.renderLoopStarted = true; };

  // Simulate frames ready on a superseded session
  m.sessionSeq = 2; // user closed or reopened
  m.realStreams.wide.ready = true;
  m.realStreams.wide.frame = {};
  m.realStreams.driver.ready = true;
  m.realStreams.driver.frame = {};

  m._checkStreamsReady(1); // targeting old seq 1

  assert.equal(m.state, 'connecting'); // remains unchanged
  assert.equal(m.renderLoopStarted, undefined);
});
