/* Adapt the original log UI to the entry-scoped HA local API. */
let CURRENT_PAGE = 'logs';
let CURRENT_LANG = 'ko';
let logsBase = '';
let logsStarted = false;
function getUIText(key, fallback = '', values = {}) {
  let text = window.CarrotTranslations?.strings?.[CURRENT_LANG]?.[key] || fallback;
  for (const [name, value] of Object.entries(values || {})) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function isCompactLandscapeMode() {
  return window.matchMedia('(min-aspect-ratio: 13/10), (horizontal-viewport-segments: 2), (vertical-viewport-segments: 2), (min-width: 640px) and (min-height: 650px)').matches;
}
function setDashcamHeaderStatus() {}
function waitMs(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function showAppToast(message) { document.getElementById('haLogsStatus').textContent = message; }
window.carrotLogsURL = function(url) {
  if (!logsBase || !/^\/api\/(dashcam|screenrecord)\//.test(url)) throw new Error('HA 로그 주소를 확인해 주세요.');
  return logsBase + url.slice(4);
};
async function getJson(url) {
  const response = await fetch(window.carrotLogsURL(url), {cache:'no-store', credentials:'same-origin'});
  if (!response.ok) throw new Error(response.status === 401 ? 'HA 로그 인증이 만료되었습니다. 새로고침해 주세요.' : `로그 조회 실패 (${response.status})`);
  const data = await response.json();
  if (data.storage) {
    const bytes = data.storage.used;
    const nas = data.storage.nas;
    const archive = nas ? ` · NAS 30일 ${nas.segments.toLocaleString()}개 구간 · ${nas.status === 'available' ? '연결됨' : '연결 확인 필요 (HA 기록 사용 가능)'}` : '';
    document.getElementById('haLogsStatus').textContent = `HA 보관 ${(bytes/1e9).toFixed(2)} / ${(data.storage.limit/1e9).toFixed(2)} GB · 최신 주행부터 보관${archive}`;
  }
  return data;
}
async function postJson(url, body) {
  if (url !== '/api/dashcam/read-state' && !/^\/api\/dashcam\/upload\/(summary|start|cancel)$/.test(url)) throw new Error('지원하지 않는 로그 요청입니다.');
  const response = await fetch(window.carrotLogsURL(url), {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || `로그 요청 실패 (${response.status})`);
    error.status = response.status; error.payload = data; throw error;
  }
  return data;
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'carrot:logs_session') return;
  const data = event.data;
  if (!/^\/api\/carrot_ha\/v1\/driving_logs\/[A-Za-z0-9_-]+$/.test(data.base)) return;
  logsBase = data.base;
  CURRENT_LANG = data.language === 'en' ? 'en' : 'ko';
  if (!logsStarted) {
    logsStarted = true;
    window.CarrotLogsRuntime.init();
  }
  if (!data.enabled) document.getElementById('haLogsStatus').textContent = '원격 터미널의 기존 HA 연결 설정을 활성화해야 Comma 로그를 자동 수신할 수 있습니다.';
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && logsStarted) window.CarrotLogsRuntime.dashcam.load({silent:true});
});
