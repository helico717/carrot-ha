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
      style.textContent = '#haRecordedReplay{position:fixed;inset:0;z-index:1000;background:#080d11;overflow:auto}#haRecordedReplay[hidden]{display:none}#haRecordedReplay .page{position:relative;inset:auto;transform:none!important;opacity:1!important;visibility:visible!important;width:100%;max-width:none;display:flex!important;min-height:100%;height:100%;padding:0}#carrotStage{min-height:320px}#visionStartOverlay,#carrotNaviPane,#btnWebSound{display:none!important}';
      document.head.append(style);
      const heading = root.querySelector('.carrot-replay-controls__heading');
      const mapButton = document.createElement('button');mapButton.type='button';mapButton.className='smallBtn ha-replay-map';mapButton.textContent='지도';mapButton.title='기록된 실제 GPS 지도';
      mapButton.onclick=()=>window.CarrotLogExplorer?.openForReplay().catch(error=>showAppToast(error.message));
      heading.append(mapButton);
      for (const [direction, originalId, label] of [
        ['Previous', 'btnCarrotReplayPrevious', CURRENT_LANG === 'en' ? 'Previous' : '이전'],
        ['Next', 'btnCarrotReplayNext', CURRENT_LANG === 'en' ? 'Next' : '다음'],
      ]) {
        const original = document.getElementById(originalId);
        const button = document.createElement('button');
        button.id = 'haReplay' + direction; button.type = 'button';
        button.className = 'smallBtn ha-replay-step'; button.textContent = label;
        button.title = label; button.setAttribute('aria-label', label);
        button.addEventListener('click', () => original.click());
        const sync = () => { button.disabled = original.disabled || original.hidden; };
        new MutationObserver(sync).observe(original, {attributes:true, attributeFilter:['disabled','hidden']});
        sync(); heading.append(button);
      }
      const hudRoot = document.createElement('div'); hudRoot.id = 'driveHudCard'; root.append(hudRoot);
      window.CarrotWebSettingsState = {replay_hud_visible:true};
      window.getWebSettingByKey = (key, fallback) => window.CarrotWebSettingsState[key] ?? fallback;
      window.setWebSettingByKey = async (key, value) => { window.CarrotWebSettingsState[key] = value; };
      window.showPage = page => {
        CURRENT_PAGE = page === 'carrot' ? 'carrot' : 'logs';
        document.body.dataset.page = CURRENT_PAGE;
        root.hidden = page !== 'carrot';
        if (page === 'carrot') window.DriveVisionHudContent?.activate();
        else window.DriveVisionHudContent?.deactivate();
        window.dispatchEvent(new CustomEvent('carrot:pagechange', {detail:{page:CURRENT_PAGE}}));
      };
      // Recorded data is the only producer. The original raw decoder and GPU
      // renderer share the same state, projection and frame scheduler as Carrot Web.
      window.shouldRunCarrotHudData = () => false;
      window.shouldRunCarrotHudRealtime = () => false;
      window.shouldRunCarrotVisionRealtime = () => false;
      window.isCarrotDriveDataRequested = () => false;
      window.emitCarrotRenderRequest = detail => window.HomeDrive?.requestRender(detail);
      window.requestCarrotVisionRender = window.emitCarrotRenderRequest;
      const vision = await import(base + 'src/features/drive/contents/vision/index.js');
      vision.installDriveVisionLeafFacades(window);
      for (const file of ['js/realtime/vision_state.js','js/realtime/vision_compact.js','js/realtime/vision_raw.js','js/realtime/vision_webgl2.js','js/realtime/home_drive.js','js/generated/replay.js','js/realtime/replay_client.js','js/realtime/vision_replay.js']) await script(file);
      if (!vision.finalizeDriveVisionFacade(window)) throw new Error('원본 주행 HUD 렌더러 초기화 실패');
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
