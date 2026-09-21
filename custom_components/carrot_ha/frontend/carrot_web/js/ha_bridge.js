"use strict";

// Only the owning HA card may supply data or acknowledge a vehicle write.
(function () {
  const origin = window.location.origin;
  let cachedSnapshot = {ok: true, settings: null, values: {}, favorites: [], profiles: [], popular: {}};
  let initialized = false;
  let catalogKey = '';
  let deferredSnapshot = null;
  let composing = false;
  const requests = new Map();
  const send = message => window.parent.postMessage(message, origin);
  const unsupported = () => { throw new Error('HA 원격 설정에서 지원하지 않는 기능입니다.'); };

  window.getJson = async function (url) {
    if (url === '/api/settings/snapshot') return cachedSnapshot;
    if (url === '/api/settings') return cachedSnapshot.settings;
    if (url.startsWith('/api/params_bulk')) return {ok: true, values: {...cachedSnapshot.values}};
    if (url === '/api/setting_favorites') return {ok: true, favorites: []};
    if (url === '/api/setting_profiles') return {ok: true, profiles: []};
    if (url === '/api/setting_popular_values') return {ok: true, popular: {}};
    if (url.startsWith('/api/param_changes')) return {ok: true, changes: [], unsupported: true};
    return unsupported();
  };

  window.postJson = async function (url, body) {
    if (url === '/api/setting_unit_index') {
      // Display-only preference for this mounted view, not a vehicle write.
      Object.assign(cachedSnapshot.unit_index ||= {}, body?.units || {});
      return {ok: true};
    }
    if (url !== '/api/param_set') return unsupported();
    if (!body?.name) throw new Error('파라미터 이름이 없습니다.');
    if ([...requests.values()].some(req => req.name === body.name)) throw new Error('차량 적용 대기 중입니다.');
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        requests.delete(requestId);
        reject(new Error('적용 확인 시간 초과. 차량 재연결 후 실제 값을 확인하세요.'));
        flushDeferred();
      }, 110000);
      requests.set(requestId, {name: body.name, resolve, reject, timer});
      send({type: 'carrot:param_set', requestId, name: body.name, value: body.value});
    });
  };

  function busy() {
    return composing || requests.size > 0 ||
      document.activeElement?.matches('input,textarea,[contenteditable="true"]') ||
      !document.getElementById('appDialog')?.hidden;
  }
  function flushDeferred() {
    if (deferredSnapshot && !busy()) {
      const data = deferredSnapshot;
      deferredSnapshot = null;
      hydrate(data).catch(showError);
    }
  }
  function showError(error) {
    const loader = document.getElementById('haBridgeLoading');
    loader.style.display = 'flex';
    loader.textContent = `설정 화면 오류: ${error.message || error}`;
  }
  async function hydrate(data) {
    if (!data?.catalog || !data.values || typeof data.values !== 'object') throw new Error('잘못된 설정 스냅샷');
    if (initialized && busy()) { deferredSnapshot = data; return; }
    const nextKey = JSON.stringify(data.catalog);
    cachedSnapshot = {ok: true, settings: data.catalog, values: data.values, unit_index: cachedSnapshot.unit_index || {}, favorites: [], profiles: [], popular: {}};
    // navigation.js defaults to "carrot"; the port has no full-app router.
    // Without this assignment syncSettingViewportLayout silently skips rendering.
    CURRENT_PAGE = 'setting';
    const page = document.getElementById('pageSetting');
    page.hidden = false;
    page.style.display = 'block';
    if (!initialized) setWebLanguage('ko', {persist: false, render: false});
    if (!initialized || nextKey !== catalogKey) {
      if (typeof loadSettings !== 'function') throw new Error('설정 UI 모듈을 불러오지 못했습니다.');
      await loadSettings({force: true});
      catalogKey = nextKey;
    } else {
      window.CarrotSettingsRuntime.values.applyValues(data.values);
      window.dispatchEvent(new CustomEvent('carrot:paramsrestored', {detail: {source: 'ha_sync', values: data.values}}));
    }
    initialized = true;
    document.getElementById('haBridgeLoading').style.display = 'none';
  }

  window.addEventListener('message', event => {
    if (event.origin !== origin || event.source !== window.parent) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'carrot:snapshot') hydrate(msg.data).catch(showError);
    if (msg.type === 'carrot:response') {
      const req = requests.get(msg.requestId);
      if (!req) return;
      clearTimeout(req.timer);
      requests.delete(msg.requestId);
      if (msg.ok) {
        cachedSnapshot.values[req.name] = msg.value;
        req.resolve({ok: true, name: req.name, value: msg.value});
      } else req.reject(new Error(msg.error || '변경 실패'));
      // An older snapshot must not overwrite the just-confirmed result.
      deferredSnapshot = null;
    }
  });
  document.addEventListener('compositionstart', () => { composing = true; });
  document.addEventListener('compositionend', () => { composing = false; });
  document.addEventListener('focusout', () => setTimeout(flushDeferred, 0));
  setInterval(flushDeferred, 1000);

  function ready() {
    // Hide unimplemented operations instead of claiming they succeeded.
    for (const id of ['settingTabDevice', 'btnSettingFabProfileAdd', 'btnSettingFabResetDefaults', 'btnSettingFabFingerprint']) {
      const el = document.getElementById(id);
      if (el) { el.hidden = true; el.disabled = true; }
    }
    document.getElementById('itemsTitle')?.addEventListener('click', () => {
      if (CURRENT_SETTING_DETAIL) {
        CURRENT_SETTING_DETAIL = null;
        renderItems(CURRENT_GROUP, {scrollMode: 'restore', animateItems: false}).catch(showError);
      } else {
        CURRENT_GROUP = null;
        showSettingScreen('groups', false);
        renderGroups({animateGroups: false});
      }
    });
    send({type: 'carrot:ready'});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
