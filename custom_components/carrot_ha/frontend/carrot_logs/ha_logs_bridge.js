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
    document.getElementById('haLogsStatus').textContent = `HA 보관 ${(bytes/1e9).toFixed(2)} / 5.00 GB · 최신 로그부터 보관 · 레이더 검증·외부 전송·지도는 다음 단계`;
  }
  return data;
}
async function postJson(url, body) {
  if (url !== '/api/dashcam/read-state') throw new Error('로그 서버 전송은 다음 단계에서 연결됩니다. 원본 다운로드와 리플레이를 이용해 주세요.');
  const response = await fetch(window.carrotLogsURL(url), {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  if (!response.ok) throw new Error('HA 로그 상태 저장 실패');
  return response.json();
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
