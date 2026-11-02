/** IQ.drive notice: blur a Carrot-only card and center a status message while it is paused. */
export const IQPILOT = 'iqpilot';
export const PILOT_CHECK_MS = 30000;
const STYLE_ID = 'carrotPilotPauseStyle';
const LAYER_ID = 'carrotPilotPause';
const CSS = `
:host([data-pilot-paused]){position:relative;display:block;min-height:320px}
#${LAYER_ID}{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;
  padding:24px;box-sizing:border-box;border-radius:var(--ha-card-border-radius,12px);overflow:hidden;
  background:color-mix(in srgb,var(--card-background-color,#1c1c1c) 55%,transparent);
  -webkit-backdrop-filter:blur(10px) saturate(.85);backdrop-filter:blur(10px) saturate(.85)}
#${LAYER_ID} .panel{max-width:380px;padding:24px 22px;border-radius:16px;text-align:center;
  background:var(--card-background-color,#1c1c1c);color:var(--primary-text-color,#e1e1e1);
  border:1px solid var(--divider-color,rgba(127,127,127,.25));box-shadow:0 8px 32px rgba(0,0,0,.25);
  font-family:var(--paper-font-body1_-_font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif)}
#${LAYER_ID} ha-icon{--mdc-icon-size:40px;color:var(--primary-color,#03a9f4)}
#${LAYER_ID} .title{margin:10px 0 8px;font-size:18px;font-weight:700}
#${LAYER_ID} .desc{margin:0;font-size:13px;line-height:1.6;color:var(--secondary-text-color,#9aa0a6)}
`;

export function isPilotPaused(device) {
  return device?.pilot_software === IQPILOT;
}

/** Idempotent; call after every render because some cards rebuild their shadow root. */
export function syncPilotPause(card, paused, feature) {
  const root = card.shadowRoot;
  if (!root) return;
  let layer = root.getElementById(LAYER_ID);
  if (!paused) {
    layer?.remove();
    root.getElementById(STYLE_ID)?.remove();
    card.removeAttribute('data-pilot-paused');
    for (const element of root.querySelectorAll('[data-pilot-inert]')) {
      element.inert = false;
      element.removeAttribute('data-pilot-inert');
    }
    return;
  }
  card.setAttribute('data-pilot-paused', '');
  if (!root.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    root.append(style);
  }
  if (!layer) {
    layer = document.createElement('div');
    layer.id = LAYER_ID;
    layer.setAttribute('role', 'status');
    layer.innerHTML = '<div class="panel"><ha-icon icon="mdi:pause-circle-outline"></ha-icon>'
      + '<div class="title">IQ.drive 사용 중</div><p class="desc"></p></div>';
    root.append(layer);
  }
  layer.querySelector('.desc').textContent = `현재 Comma가 IQ.drive로 실행 중이라 당근파일럿 전용 기능인 ${feature} 화면을 일시중지했습니다. `
    + '당근파일럿으로 돌아오면 자동으로 다시 열립니다.';
  // Keep focus and clicks away from the blurred content, including embedded frames.
  for (const element of root.children) {
    if (element === layer || element.tagName === 'STYLE' || element.inert) continue;
    element.inert = true;
    element.setAttribute('data-pilot-inert', '');
  }
}
