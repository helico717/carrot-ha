/* Load the original recorded replay only when requested. No live-car sockets. */
(() => {
  const base = '/carrot_ha_static/carrot_logs/';
  let loading;
  async function script(name) {
    await new Promise((resolve, reject) => {
      const element = document.createElement('script'); element.src = base + name;
      element.onload = resolve; element.onerror = () => reject(new Error('리플레이 파일 로딩 실패: ' + name));
      document.body.append(element);
    });
  }
  async function load() {
    if (loading) return loading;
    loading = (async () => {
      const response = await fetch(base + 'replay_page.html', {cache:'no-store'});
      if (!response.ok) throw new Error('리플레이 화면을 불러오지 못했습니다.');
      const root = document.createElement('div'); root.id = 'haRecordedReplay'; root.hidden = true;
      root.innerHTML = await response.text();
      const page = root.querySelector('.page'); page.hidden = false; page.style.display = 'flex'; page.classList.add('page-active');
      document.body.append(root);
      for (const file of ['css/generated/drive.css','css/generated/replay.css','css/pages/drive.css','css/components/drive_workspace.css']) {
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = base + file; document.head.append(link);
      }
      const style = document.createElement('style');
      style.textContent = '#haRecordedReplay{position:fixed;inset:0;z-index:1000;background:#080d11;overflow:auto}#haRecordedReplay[hidden]{display:none}#haRecordedReplay .page{position:relative;inset:auto;transform:none!important;opacity:1!important;visibility:visible!important;width:100%;max-width:none;display:flex!important;min-height:100%;height:100%;padding:0}#carrotStage{min-height:320px}#haRecordedReplay #carrotRoadVideo{width:calc(100% - var(--carrot-replay-content-right,0px));height:calc(100% - 52px);object-fit:contain}#visionStartOverlay,#carrotNaviPane,#haRecordedReplay .carrot-stage__controls{display:none!important}#haReplayValues{position:absolute;top:60px;left:16px;z-index:30;color:white;background:#101820cc;padding:8px;border-radius:8px;font-size:13px;pointer-events:none}.carrot-stage:not(.is-replay-hud-visible) #haReplayValues{display:none}';
      document.head.append(style);
      const state = Object.create(null);
      window.CarrotHudState = state; window.CarrotOverlayState = state;
      window.CarrotWebSettingsState = {replay_hud_visible:true};
      window.getWebSettingByKey = (key, fallback) => window.CarrotWebSettingsState[key] ?? fallback;
      window.setWebSettingByKey = async (key, value) => { window.CarrotWebSettingsState[key] = value; };
      window.showPage = page => {
        CURRENT_PAGE = page === 'carrot' ? 'carrot' : 'logs';
        root.hidden = page !== 'carrot';
        window.dispatchEvent(new CustomEvent('carrot:pagechange', {detail:{page:CURRENT_PAGE}}));
      };
      window.CarrotVisionSetActive = active => { if (!active) root.hidden = true; };
      window.CarrotVisionSetPhase = (phase, options = {}) => {
        document.getElementById('carrotStage').classList.toggle('is-stream-ready', phase === 'ready');
        document.getElementById('carrotStageLoading').hidden = phase === 'ready' || phase === 'inactive' || phase === 'unavailable';
        document.getElementById('carrotStageLoadingText').textContent = options.statusText || '';
        document.getElementById('carrotStageLoadingDetail').textContent = options.detailText || '';
      };
      const values = document.createElement('div'); values.id = 'haReplayValues';
      document.getElementById('carrotStage').append(values);
      const render = () => {
        const car = state.carState || {}, radar = state.radarState || {};
        const speed = Number.isFinite(car.vEgo) ? (car.vEgo * 3.6).toFixed(1) + ' km/h' : '—';
        const acceleration = Number.isFinite(car.aEgo) ? car.aEgo.toFixed(2) + ' m/s²' : '—';
        const lead = radar.leadOne?.status && Number.isFinite(radar.leadOne.dRel) ? radar.leadOne.dRel.toFixed(1) + ' m' : '—';
        values.textContent = `기록 속도 ${speed} · 가속도 ${acceleration} · Lead 1 ${lead}`;
        window.CarrotVisionReplay.reportRenderable?.(document.getElementById('carrotRoadVideo').readyState >= 2);
      };
      window.requestCarrotVisionRender = render;
      document.getElementById('carrotRoadVideo').addEventListener('seeked', render);
      window.CarrotVisionRaw = {
        clearState(options = {}) { for (const key of Object.keys(state)) delete state[key]; if (options.render !== false) render(); },
        applyCompactFrames(frames, options = {}) {
          let applied = 0;
          for (const frame of frames) if (frame?.service && frame.decoded) { state[frame.service] = frame.decoded; applied++; }
          if (options.render !== false) render();
          return applied;
        },
        disconnectOverlay() {}, disconnectHud() {},
      };
      for (const file of ['js/realtime/vision_compact.js','js/generated/replay.js','js/realtime/replay_client.js','js/realtime/vision_replay.js']) await script(file);
    })();
    return await loading;
  }
  const call = (method, fallback, ...args) => window.CarrotHAReplayRuntime?.[method]?.(...args) ?? fallback;
  window.CarrotVisionReplay = {
    async start(options) { await load(); return window.CarrotHAReplayRuntime.start(options); },
    stop: options => call('stop', Promise.resolve(false), options),
    isActive: () => call('isActive', false), isReady: () => call('isReady', false),
    updateSegments: (...args) => call('updateSegments', undefined, ...args),
    status: () => call('status', {active:false}),
    reportRenderable: (...args) => call('reportRenderable', undefined, ...args),
    shouldHoldFrameDuringSeek: () => call('shouldHoldFrameDuringSeek', false),
    videoSourceKey: () => call('videoSourceKey',''),
    diagnosticPlayback: (...args) => call('diagnosticPlayback', undefined, ...args),
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.getElementById('carrotRoadVideo')?.pause();
  });
  window.addEventListener('pagehide', () => window.CarrotVisionReplay.stop({returnToLogs:true}));
})();
