// Carrot HA 공통 화면 설정: 모드(기본값=Home Assistant 테마 / 라이트 / 다크) · 포인트 색 · 통일된 팝업 스킨.
// 차량 대시보드(ko/en)와 차계부가 같은 모듈을 쓴다. 비상 끄기: localStorage 'carrot-ui-disable'='1' 또는 주소에 ?carrot_ui=off
// 설계: docs/dashboard-theme-settings.md
const SETTINGS_KEY = 'carrot-ui-settings';
const DEFAULT_SETTINGS = {accent: 'ha', mode: 'auto'};
const PRESETS = [['#ff9f43', {ko: '주황', en: 'Orange'}], ['#a78bfa', {ko: '보라', en: 'Purple'}], ['#38d9a9', {ko: '민트', en: 'Mint'}]];
const TEXT = {
  ko: {title: '설정', close: '닫기', closeAria: '설정 닫기', mode: '모드', auto: '기본값', light: '라이트', dark: '다크', accent: '포인트 색', car: '내 차 색상', reset: '초기화', done: '완료',
    nav: '화면', battery: '배터리 잔량', parking: '주차 위치', map: '지도 →', def: '기본 파랑', ha: 'Home Assistant 색', custom: '직접 고르기', gear: '설정'},
  en: {title: 'Settings', close: 'Close', closeAria: 'Close settings', mode: 'Mode', auto: 'Default', light: 'Light', dark: 'Dark', accent: 'Accent color', car: 'Vehicle color', reset: 'Reset', done: 'Done',
    nav: 'Display', battery: 'Battery', parking: 'Parking', map: 'Map →', def: 'Default blue', ha: 'Home Assistant color', custom: 'Custom', gear: 'Settings'}
};

/* ---------------- 설정 저장 ---------------- */
function readSettings() {
  try { return {...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')}; } catch { return {...DEFAULT_SETTINGS}; }
}
let settings = readSettings();
function writeSettings(patch) {
  settings = {...settings, ...patch};
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 저장소를 쓸 수 없어도 현재 화면에는 적용 */ }
}
export function isDisabled() {
  try { if (localStorage.getItem('carrot-ui-disable') === '1') return true; } catch { /* ignore */ }
  try { return new URLSearchParams(location.search).get('carrot_ui') === 'off'; } catch { return false; }
}

/* ---------------- 포인트 색 엔진 ----------------
   기본 파랑 계열 전체를 '색상·선명도만' 포인트 색으로 바꾼다. 밝기는 WCAG 상대휘도를 그대로 맞춰서
   글자·배경 대비가 원래와 같다. 사용자는 밝기를 고를 수 없다. */
const lin = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
const unlin = c => c <= .0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - .055;
function toOk([r, g, b]) {
  r = lin(r / 255); g = lin(g / 255); b = lin(b / 255);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, B = .0259040371 * l + .7827717662 * m - .808675766 * s;
  return {L: .2104542553 * l + .793617785 * m - .0040720468 * s, C: Math.hypot(A, B), h: Math.atan2(B, A)};
}
function fromOk(L, C, h) {
  const rgb = c => {
    const A = c * Math.cos(h), B = c * Math.sin(h);
    const l = (L + .3963377774 * A + .2158037573 * B) ** 3, m = (L - .1055613458 * A - .0638541728 * B) ** 3, s = (L - .0894841775 * A - 1.291485548 * B) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
  };
  const ok = v => v.every(x => x >= -.0005 && x <= 1.0005);
  let lo = 0, hi = C, v = rgb(C);
  if (!ok(v)) { for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; ok(rgb(mid)) ? lo = mid : hi = mid; } v = rgb(lo); }
  return v.map(x => Math.round(Math.min(1, Math.max(0, unlin(Math.min(1, Math.max(0, x))))) * 255));
}
const REF = toOk([0x12, 0x60, 0xe8]);
const MINT = toOk([0x81, 0xe6, 0xc5]);
function lumOf([r, g, b]) { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); }
function fromY(Y0, C, h) { let lo = 0, hi = 1, best = [0, 0, 0]; for (let i = 0; i < 22; i++) { const L = (lo + hi) / 2; const rgb = fromOk(L, C, h); best = rgb; if (lumOf(rgb) < Y0) lo = L; else hi = L; } return best; }
function isAccentRgb([r, g, b], mint) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
  if (mx === mn) return false;
  const d = (mx - mn) / 255, sat = l > .5 ? d / (2 - (mx + mn) / 255) : d / ((mx + mn) / 255);
  let h;
  if (mx === b) h = 60 * ((r - g) / (mx - mn) + 4); else if (mx === g) h = 60 * ((b - r) / (mx - mn) + 2); else h = 60 * (((g - b) / (mx - mn)) % 6);
  if (h < 0) h += 360;
  return (h >= 195 && h <= 260 || (mint && h >= 155 && h < 195)) && sat > .25;
}
function parseColor(c) {
  c = String(c).trim(); let m;
  if ((m = c.match(/^#([0-9a-f]{3,8})$/i))) { let x = m[1]; if (x.length <= 4) x = [...x].map(q => q + q).join(''); return {rgb: [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)), a: x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : null, hex: true}; }
  if ((m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i))) return {rgb: [+m[1], +m[2], +m[3]], a: m[4] == null ? null : +m[4]};
  return null;
}
// 이름·hsl() 등 어떤 CSS 색이든 rgb로 정규화
function normalizeColor(value) {
  const direct = parseColor(value);
  if (direct) return direct;
  try {
    const probe = document.createElement('span'); probe.style.color = value; probe.style.display = 'none'; document.body.append(probe);
    const resolved = getComputedStyle(probe).color; probe.remove();
    return parseColor(resolved.replace(/\s+/g, ' ').replace(/rgba?\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)/, (m0, r, g, b, a) => a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`));
  } catch { return null; }
}
let ACC = null;   // {h,k,C} 또는 null(기본 파랑 그대로)
const remapCache = new Map();
function remapColor(str, mint = false, dim = false) {
  const p = parseColor(str);
  if (!p || !ACC || !isAccentRgb(p.rgb, mint)) return str;
  const key = str + '|' + ACC.h.toFixed(4) + '|' + ACC.k.toFixed(3) + (mint ? 'm' : '') + (dim ? 'd' : '');
  let hit = remapCache.get(key);
  if (!hit) { const o = toOk(p.rgb); hit = fromY(lumOf(p.rgb) * (dim ? .2 : 1), o.C * ACC.k, ACC.h); remapCache.set(key, hit); }
  const [r, g, b] = hit;
  if (p.a == null) return p.hex ? '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('') : `rgb(${r},${g},${b})`;
  return `rgba(${r},${g},${b},${+p.a.toFixed(3)})`;
}
const COLOR_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/g;
const remapText = (t, mint = false, dim = false) => t.replace(COLOR_RE, c => remapColor(c, mint, dim));
// 카테고리·지표를 구분하는 색(기록 유형 아이콘, 추세 카드, --cat-* 팔레트)은 원래 값을 유지한다.
const EXEMPT = /type-icon-box|tint-|trend-card|receipt-source/;
function remapRule(r, mint, lightText) {
  // CSSOM 재직렬화는 var()가 든 단축 속성을 잃어버리므로 cssText 문자열을 그대로 쓴다.
  let t = r.cssText; const held = [];
  t = t.replace(/(--cat-[\w-]+)\s*:\s*([^;}]*)/g, (m0, prop, val) => { held.push(val); return `${prop}:@@${held.length - 1}@@`; });
  if (lightText) t = t.replace(/(^|[{;\s])((?:-webkit-text-fill-)?color)\s*:\s*([^;}]*)/g, (m0, pre, prop, val) => { held.push(remapText(val, mint, true)); return `${pre}${prop}:@@${held.length - 1}@@`; });
  t = remapText(t, mint);
  return t.replace(/@@(\d+)@@/g, (m0, i) => held[+i]);
}
function remapCss(text, mint, lightText = false) {
  let sh;
  try { sh = new CSSStyleSheet(); sh.replaceSync(text); } catch { return remapText(text, mint); }
  const walk = rules => {
    let out = '';
    for (const r of rules) {
      if (r.type === 1) out += EXEMPT.test(r.selectorText) ? r.cssText : remapRule(r, mint, lightText);
      else if (r.type === 4) out += `@media ${r.conditionText}{${walk(r.cssRules)}}`;
      else out += remapText(r.cssText, mint);
    }
    return out;
  };
  return walk(sh.cssRules);
}
const tones = () => ['#1260e8', '#60a5fa'].map(c => remapColor(c));
function accentTone(dark) {
  const a = ACC || {h: REF.h, C: REF.C};
  return fromY(dark ? lumOf([0x81, 0xe6, 0xc5]) : .12, Math.min(MINT.C, a.C), a.h);
}
function accentParams() {
  if (settings.accent === 'default') return null;
  let hex = settings.accent;
  if (hex === 'ha') hex = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#03a9f4';
  const p = normalizeColor(hex);
  if (!p) return null;
  const o = toOk(p.rgb);
  return {h: o.h, k: Math.min(1.15, Math.max(.35, o.C / REF.C)), C: o.C};
}

/* ---------------- 스타일 문자열 ---------------- */
const HELPER_VARS = `--cui-card:var(--ha-card-background,var(--card-background-color,#1c1c1c));--cui-ink:var(--primary-text-color,#e1e1e1);--cui-sub:var(--secondary-text-color,#9b9b9b);--cui-line:var(--divider-color,rgba(127,127,127,.25));--cui-blur:var(--ha-card-backdrop-filter,none);--cui-dialog:var(--ha-dialog-surface-background,var(--mdc-theme-surface,var(--card-background-color,#1c1c1c)));--cui-base:var(--primary-background-color,#111)`;
const ov = p => `color-mix(in srgb,var(--cui-ink) ${p}%,transparent)`;
const DARK_TOK = '--j-bg:#0b1014;--j-surface:#161e25;--j-raised:#202c36;--j-border:#2a3945;--j-ink:#f1f6fa;--j-sub:#a8bdca';
const LIGHT_TOK = '--j-bg:#f4f6f8;--j-surface:#ffffff;--j-raised:#f1f4f7;--j-border:rgba(0,0,0,.14);--j-ink:#1d2125;--j-sub:#5d656d';
const LIGHT_VARS = ':host{--cui-card:#ffffff;--cui-ink:#1d2125;--cui-sub:#5d656d;--cui-line:rgba(0,0,0,.14);--cui-blur:none;--cui-dialog:#ffffff;--cui-base:#ffffff}';
const FOLLOW_DIALOG_TOK = `--j-bg:${ov(6)};--j-surface:var(--cui-dialog);--j-raised:${ov(10)};--j-border:var(--cui-line);--j-ink:var(--cui-ink);--j-sub:var(--cui-sub)`;
// 기존 결함 수정: 라이트 모드에서 선택되지 않은 날짜 라벨(.trip-day b)이 연회색(#d1d5db)이라 흰 배경에서 안 보임
const DASH_FIX_CSS = `.trip-day:not([aria-pressed="true"]) b,.charge-day:not([aria-pressed="true"]) b{color:var(--ink)!important}.display-controls{display:none!important}`;
const dashFollowCss = () => `
  :host{--ink:var(--cui-ink);--muted:var(--cui-sub);--line:var(--cui-line)}
  ha-card{background:var(--cui-card)!important;border:1px solid var(--cui-line)!important;-webkit-backdrop-filter:var(--cui-blur);backdrop-filter:var(--cui-blur);color:var(--cui-ink)}
  .nav{background:${ov(6)}!important}
  .nav button.active{background:${ov(14)}!important;color:var(--cui-ink)!important}
  .hero{background:${ov(8)}!important;color:var(--cui-ink)!important}
  .hero h2,.hero small{color:var(--cui-ink)!important}
  .metric,.panel,.status-group,.raw-data-card,.trip-history,.charge-history,.trip-grid-container,.day-timeline-wrap,.sleek-trip-card,.charge-info-stack,.mini-condition,.battery-history,.parking-heading{background:${ov(7)}!important;border:1px solid var(--cui-line)!important}
  .refresh,.badge,.trip-day:not([aria-pressed="true"]),.charge-day:not([aria-pressed="true"]){background:${ov(9)}!important;color:var(--cui-ink)!important;border-color:var(--cui-line)!important}`;
// 라이트에서도 히어로 카드는 어두운 포인트 색 면 + 밝은 글자로 유지(기존 디자인 의도). 면 색은 포인트 색 계열의 어두운 톤.
const journalHeroLight = () => {
  const a = ACC || {h: MINT.h, C: MINT.C * .5};
  const c1 = fromY(.045, Math.min(.09, a.C), a.h), c2 = fromY(.02, Math.min(.06, a.C), a.h);
  return `.hero,.savings-hero{--j-ink:#f1f6fa;--j-sub:#c9d6de;color:#f1f6fa;background:linear-gradient(130deg,rgb(${c1}),rgb(${c2}))!important;border:1px solid rgba(255,255,255,.12)!important}`;
};
const journalFollowCss = () => `
  :host{--j-bg:var(--cui-card);--j-surface:${ov(6)};--j-raised:${ov(11)};--j-border:var(--cui-line);--j-ink:var(--cui-ink);--j-sub:var(--cui-sub)}
  .shell{-webkit-backdrop-filter:var(--cui-blur);backdrop-filter:var(--cui-blur)}
  .trend-card,.trends-map-wrapper,.savings-hero{background:${ov(7)}!important;border:1px solid var(--cui-line)!important}`;
// 모든 대화상자가 같은 면·테두리·모서리·배경막·버튼 모양을 쓰는 공통 스킨
const dialogSkin = (sel, follow) => `
${sel}{border-radius:18px!important;background:linear-gradient(var(--j-surface),var(--j-surface)),var(--cui-base)!important;border:1px solid var(--j-border)!important;color:var(--j-ink)!important;box-shadow:0 24px 70px rgba(0,0,0,.45);-webkit-backdrop-filter:${follow ? 'var(--cui-blur)' : 'none'};backdrop-filter:${follow ? 'var(--cui-blur)' : 'none'}}
${sel}::backdrop{background:rgba(5,8,11,.75)!important;backdrop-filter:blur(8px)!important}
${sel} h2{font-weight:750;letter-spacing:-.3px}
${sel} button:not(.cui-sw):not(.type-icon-box):not(.receipt-source-card){border-radius:12px}
${sel} input,${sel} select,${sel} textarea{border-radius:10px}
`;
const MENU_CSS = `
.cui-gear{width:40px;height:40px;min-width:40px;min-height:40px;border-radius:50%;border:1px solid var(--line,var(--j-border,rgba(255,255,255,.14)));background:transparent;color:var(--muted,var(--j-sub,#aaa));display:inline-grid;place-items:center;cursor:pointer;margin-left:10px;padding:0}
.cui-gear:hover{color:var(--ink,var(--j-ink,#fff));background:rgba(127,127,127,.15)}
.top .badge{margin-left:auto}
.cui-hrow{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px}
.cui-hrow h4{margin:0!important}
.cui-seg{display:flex;gap:8px}
.cui-seg button{flex:1 1 0;text-align:center;min-width:0}
.cui-seg button.active{color:var(--cui-a);background:var(--cui-a12);border-color:var(--cui-a35)}
.cui-swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:10px 6px;justify-items:center;align-items:center}
.cui-swatches .cui-sw{box-sizing:border-box!important;width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border:0!important;border-radius:50%!important;clip-path:circle(50%);cursor:pointer;position:relative;background:var(--c)!important;display:inline-grid;place-items:center;overflow:hidden;flex:none;--ring:var(--j-border)}
.cui-swatches .cui-sw::after{content:"";position:absolute;inset:0;border-radius:50%;pointer-events:none;box-shadow:inset 0 0 0 2px var(--ring)}
.cui-swatches .cui-sw[aria-pressed=true]{--ring:var(--j-ink)}
.cui-swatches .cui-sw[aria-pressed=true]::after{box-shadow:inset 0 0 0 2px var(--j-ink),inset 0 0 0 4px var(--j-surface)}
.cui-swatches .cui-sw.follow{background:#18bcf2!important}
.cui-swatches .cui-sw.follow svg{width:20px;height:20px;fill:#fff;position:relative;z-index:1}
.cui-swatches .cui-sw.def{background:#1260e8!important}
.cui-swatches .cui-sw.custom{background:conic-gradient(from 90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)!important}
.cui-swatches .cui-sw.custom[aria-pressed=true]{background:var(--c)!important}
.cui-swatches .cui-sw.custom input{position:absolute;inset:0;width:100%;height:100%;min-height:0;opacity:0;cursor:pointer;border:0;padding:0;margin:0;-webkit-appearance:none;appearance:none;z-index:2}
.cui-cap{font-size:12.5px;color:var(--j-sub)}
.cui-prev{display:flex;gap:8px;margin-top:14px}
.cui-tile{flex:1;border-radius:14px;padding:10px 13px;color:#fff;font-weight:650;display:flex;flex-direction:column;justify-content:center;min-height:52px}
.cui-tile small{font-weight:500;opacity:.92;font-size:12px}
.cui-seg button:focus-visible,.cui-swatches .cui-sw:focus-visible,.cui-gear:focus-visible{outline:3px solid var(--cui-a);outline-offset:2px}
`;
const HA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.8 13H20v8h-7v-3.33l2.79-2.79.71.12a2.1 2.1 0 1 0-2.1-2.1l.1.71L13 15.13V9.65a2.1 2.1 0 1 0-2 0v5.48l-1.5-1.52.1-.71a2.1 2.1 0 1 0-2.1 2.1l.71-.12L11 17.67V21H4v-8H2.25c-.42 0-.83 0-.83-.21 0-.22.43-.64.86-1.07L11 3c.33-.33.66-.5 1-.5s.67.17 1 .5l3 3V5h3v4l2.8 2.72c.43.43.86.84.87 1.07 0 .21-.4.21-.87.21z"/></svg>';
const GEAR_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

/* 차계부 설정 대화상자 CSS를 그대로 가져와 대시보드 설정창에 쓴다(스타일 연속성). 필요할 때만 불러온다. */
let journalDialogCssPromise = null;
function loadJournalDialogCss() {
  if (!journalDialogCssPromise) {
    journalDialogCssPromise = (async () => {
      const url = new URL('./carrot-journal-design.js', import.meta.url);
      const version = new URL(import.meta.url).searchParams.get('v'); if (version) url.searchParams.set('v', version);
      const {journalDesign} = await import(url.href);
      const sh = new CSSStyleSheet(); sh.replaceSync(journalDesign);
      const want = r => /#vehicleManageDialog|\.settings-/.test(r.selectorText || '');
      const fix = t => t.replace(/#vehicleManageDialog/g, 'dialog.cui-dialog');
      let out = '';
      for (const r of sh.cssRules) {
        if (r.type === 1 && want(r)) out += fix(r.cssText) + '\n';
        else if (r.type === 4) { const inner = [...r.cssRules].filter(x => x.type === 1 && want(x)).map(x => fix(x.cssText)).join('\n'); if (inner) out += `@media ${r.conditionText}{${inner}}\n`; }
      }
      return out;
    })().catch(() => '');
  }
  return journalDialogCssPromise;
}
let journalDialogCss = '';

/* ---------------- 컨트롤러 ---------------- */
const controllers = new Set();
const sec = (title, inner, cap) => `<section class="settings-section"><div class="cui-hrow"><h4>${title}</h4>${cap ? `<span class="cui-cap" data-k="${cap}"></span>` : ''}</div>${inner}</section>`;

class Controller {
  constructor(card, opts) {
    this.card = card; this.kind = opts.kind; this.lang = opts.lang === 'en' ? 'en' : 'ko'; this.t = TEXT[this.lang];
    this.vehicleColors = opts.vehicleColors || []; this.showCarOpt = opts.showCar;
    this.signature = ''; this.running = false; this.pending = null;
  }
  get root() { return this.card.shadowRoot; }
  wantCar() { const v = this.showCarOpt; return this.kind === 'dash' && this.vehicleColors.length > 0 && (typeof v === 'function' ? !!v() : v !== false); }
  // 3D 차량을 쓰지 않는 카드에는 차량 색상 항목을 두지 않는다(설정창을 열 때마다 확인).
  ensureCar() {
    const body = this.dialog?.querySelector('.cui-body'); if (!body) return;
    if (this.wantCar() && !this.carEl) { this.carEl = this.carNode(); body.append(this.carEl); }
    else if (!this.wantCar() && this.carEl) { this.carEl.remove(); this.carEl = null; }
  }
  /* --- 모드 --- */
  getMode() {
    if (this.kind === 'dash') { const m = this.card.themeMode; return m === 'light' || m === 'dark' ? m : 'auto'; }
    return settings.mode === 'light' || settings.mode === 'dark' ? settings.mode : 'auto';
  }
  setMode(mode) {
    if (this.kind === 'dash') {
      this.card.themeMode = mode;
      try { localStorage.setItem('carrot-theme-' + (this.card.config?.device_id || 'default'), mode); } catch { /* ignore */ }
      this.card.applyTheme?.();
    } else writeSettings({mode});
    syncAll(true);
  }
  styleHA() { return this.getMode() === 'auto'; }
  isDark() {
    if (this.kind === 'dash') return this.card.getAttribute('data-theme') !== 'light';
    const m = this.getMode();
    if (m === 'dark') return true;
    if (m === 'light') return false;                      // 차계부 라이트 고정(Carrot 라이트 팔레트)
    const d = this.card._hass?.themes?.darkMode;
    return d == null ? matchMedia('(prefers-color-scheme: dark)').matches : !!d;
  }
  start() {
    if (this.running) return;
    this.running = true; controllers.add(this);
    this.observer = new MutationObserver(muts => this.onMutations(muts));
    this.observer.observe(this.root, {childList: true, subtree: true});
    this.sync(true);
  }
  stop() { this.running = false; controllers.delete(this); this.observer?.disconnect(); clearTimeout(this.pending); this.pending = null; }
  onMutations(muts) {
    const added = [];
    for (const m of muts) {
      if (m.target.nodeType === 1 && m.target.closest?.('[data-cui]')) continue;
      for (const n of m.addedNodes) if (n.nodeType === 1 && !n.dataset?.cui) added.push(n);
    }
    this.queue = (this.queue || []).concat(added);
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null; const nodes = this.queue || []; this.queue = [];
      try { this.ensure(); if (ACC) for (const n of nodes) this.remapTree(n); } catch (e) { console.warn('Carrot UI theme:', e); }
    }, 0);
  }
  /* --- 동기화(설정·HA 테마 변경 시) --- */
  sync(force = false) {
    if (!this.running || !this.root) return;
    const hvar = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    const sig = [this.getMode(), settings.accent, this.isDark(), settings.accent === 'ha' ? hvar : '', this.card._hass?.themes?.theme || ''].join('|');
    if (!force && sig === this.signature) return;
    this.signature = sig;
    try { ACC = accentParams(); this.apply(); } catch (e) { console.warn('Carrot UI theme:', e); }
  }
  apply() {
    const root = this.root, follow = this.styleHA(), dark = this.isDark();
    if (!this.styleEl) { this.styleEl = document.createElement('style'); this.styleEl.dataset.cui = '1'; }
    if (!this.menuStyle) { this.menuStyle = document.createElement('style'); this.menuStyle.dataset.cui = '1'; this.menuStyle.textContent = MENU_CSS; this.buildMenu(); }
    let css = `:host{${HELPER_VARS}}`;
    if (this.kind === 'dash') {
      css += (follow ? dashFollowCss() : '') + DASH_FIX_CSS + this.dashDialogCss(follow, dark);
    } else {
      const lightFixed = !follow && !dark;                  // 라이트 고정: Carrot 라이트 팔레트로 같은 오버레이 스타일을 쓴다
      css += (follow ? journalFollowCss() : lightFixed ? LIGHT_VARS + journalFollowCss() : '') + (!dark ? journalHeroLight() : '') + `dialog{${follow ? FOLLOW_DIALOG_TOK : (dark ? DARK_TOK : LIGHT_TOK)}}` + `@media (max-width:600px){.settings-nav{grid-template-columns:repeat(5,1fr)!important}}` + dialogSkin('dialog', follow);
      this.applyPanelVars(follow, dark);
    }
    if (this.styleEl.textContent !== css) this.styleEl.textContent = css;
    this.ensure();
    this.remapTree(root, true);
    this.paint();
    applyBodySkin();
  }
  // HA 사이드바 패널(차계부 화면)의 바깥 틀(배경·머리글)도 같은 모드를 따른다. 변수가 없으면 기존 다크 값.
  applyPanelVars(follow, dark) {
    const host = this.card.getRootNode?.()?.host;
    if (!host || host.tagName !== 'CARROT-JOURNAL-PANEL') return;
    const set = (k, v) => v == null ? host.style.removeProperty(k) : host.style.setProperty(k, v);
    if (follow) {
      set('--cui-panel-bg', 'var(--primary-background-color,#111)'); set('--cui-panel-fg', 'var(--primary-text-color,#e1e1e1)');
      set('--cui-panel-line', 'var(--divider-color,rgba(127,127,127,.25))'); set('--cui-panel-raised', ov(10)); set('--cui-panel-surface', 'var(--card-background-color,#1c1c1c)');
    } else if (!dark) {
      set('--cui-panel-bg', '#f4f6f8'); set('--cui-panel-fg', '#1d2125'); set('--cui-panel-line', 'rgba(0,0,0,.14)'); set('--cui-panel-raised', '#f1f4f7'); set('--cui-panel-surface', '#ffffff');
    } else for (const k of ['bg', 'fg', 'line', 'raised', 'surface']) set('--cui-panel-' + k, null);
  }
  dashDialogCss(follow, dark) {
    const tok = follow ? FOLLOW_DIALOG_TOK : (dark ? DARK_TOK : LIGHT_TOK);
    const keep = ACC; ACC = ACC || {h: REF.h, k: 1, C: REF.C};
    const journalCss = remapCss(journalDialogCss, true, !dark || follow && !dark);
    ACC = keep;
    return `
dialog.cui-dialog{${tok};color:var(--j-ink);font:15px/1.65 system-ui,-apple-system,sans-serif}
dialog.cui-dialog *{box-sizing:border-box}
dialog.cui-dialog:not([open]){display:none!important}
dialog.cui-dialog button{font:inherit;color:var(--j-ink);background:var(--j-raised);border:1px solid var(--j-border);cursor:pointer}
dialog.cui-dialog h2,dialog.cui-dialog h3,dialog.cui-dialog h4,dialog.cui-dialog p{margin:0}
${journalCss}
dialog.cui-dialog{width:min(560px,calc(100vw - 24px))!important;height:fit-content!important;max-height:calc(100dvh - 48px)!important;margin:auto!important}
dialog.cui-dialog[open]{display:flex!important;flex-direction:column}
dialog.cui-dialog .cui-body{display:grid;gap:12px;padding:18px 22px;overflow:auto;min-height:0}
dialog.cui-dialog .cui-body>div{display:contents}
dialog.cui-dialog .cui-body .settings-section{margin:0!important}
dialog.cui-dialog .cui-foot{display:flex;justify-content:space-between;gap:8px;padding:14px 22px;border-top:1px solid var(--j-border)}
dialog.cui-dialog .cui-foot .primary{color:var(--cui-a);background:var(--cui-a12);border-color:var(--cui-a35)}
@media (max-width:600px){dialog.cui-dialog .cui-body{padding:14px 14px}dialog.cui-dialog .cui-foot{padding:12px 14px}}
${dialogSkin('dialog.cui-dialog', follow)}`;
  }
  /* --- 노드 유지(렌더가 DOM을 교체해도 다시 붙인다) --- */
  ensure() {
    const root = this.root; if (!root) return;
    for (const n of [this.styleEl, this.menuStyle, this.dialog]) if (n && n.parentNode !== root) root.append(n);
    if (this.kind === 'dash') {
      const top = root.querySelector('.top');
      if (top && this.gear && this.gear.parentNode !== top) top.append(this.gear);
    } else this.injectJournal();
  }
  injectJournal() {
    const root = this.root, nav = root.querySelector('#settingsNav'), main = root.querySelector('.settings-content');
    if (!nav || !main || nav.querySelector('[data-settings-nav=appearance]')) return;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.settingsNav = 'appearance'; b.dataset.cui = '1'; b.textContent = this.t.nav; nav.append(b);
    const pane = document.createElement('section'); pane.dataset.settingsPane = 'appearance'; pane.dataset.cui = '1'; pane.hidden = true; pane.innerHTML = `<h3>${this.t.nav}</h3>`;
    pane.append(this.appearanceNode(true)); main.append(pane); this.scope = pane;
  }
  /* --- 설정 UI --- */
  swatch(parent, value, name, cls) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cui-sw ' + (cls || ''); b.title = name; b.setAttribute('aria-label', name); b.dataset.v = value;
    if (value[0] === '#') b.style.setProperty('--c', value); parent.append(b); return b;
  }
  customSwatch(parent, onInput, initial) {
    const l = document.createElement('label'); l.className = 'cui-sw custom'; l.title = this.t.custom; l.dataset.v = 'custom';
    l.innerHTML = `<input type="color" value="${initial}" aria-label="${this.t.custom}">`; parent.append(l); l.querySelector('input').oninput = e => onInput(e.target.value); return l;
  }
  appearanceNode(withReset) {
    const t = this.t, wrap = document.createElement('div'); wrap.dataset.cui = '1'; wrap.className = 'cui-appearance';
    wrap.innerHTML =
      sec(t.mode, `<div class="cui-seg" data-k="mode"><button type="button" data-v="auto">${t.auto}</button><button type="button" data-v="light">${t.light}</button><button type="button" data-v="dark">${t.dark}</button></div>`) +
      sec(t.accent, `<div class="cui-swatches" data-k="accent"></div><div class="cui-prev"><div class="cui-tile" data-k="t1">${t.battery}<small>68%</small></div><div class="cui-tile" data-k="t2">${t.parking}<small>${t.map}</small></div></div>`, 'accCap') +
      (withReset ? `<div class="settings-actions"><button type="button" data-k="reset">${t.reset}</button></div>` : '');
    const q = k => wrap.querySelector(`[data-k=${k}]`), acc = q('accent');
    this.swatch(acc, 'default', t.def, 'def');
    this.swatch(acc, 'ha', t.ha, 'follow').insertAdjacentHTML('afterbegin', HA_ICON);
    PRESETS.forEach(([c, names]) => this.swatch(acc, c, names[this.lang]));
    this.customSwatch(acc, v => { writeSettings({accent: v}); syncAll(true); }, '#ff9f43');
    acc.addEventListener('click', e => { const b = e.target.closest('button.cui-sw'); if (!b) return; writeSettings({accent: b.dataset.v}); syncAll(true); });
    q('mode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.setMode(b.dataset.v); });
    if (withReset) q('reset').onclick = () => this.resetAll();
    return wrap;
  }
  carNode() {
    const wrap = document.createElement('div'); wrap.dataset.cui = '1';
    wrap.innerHTML = sec(this.t.car, '<div class="cui-swatches" data-k="car"></div>', 'carCap');
    const car = wrap.querySelector('[data-k=car]');
    this.vehicleColors.forEach(([hex, name]) => this.swatch(car, hex, name));
    this.customSwatch(car, v => { this.card.setVehicleColor(v); this.paint(); }, '#333234');
    car.addEventListener('click', e => { const b = e.target.closest('button.cui-sw'); if (!b) return; this.card.setVehicleColor(b.dataset.v); this.paint(); });
    return wrap;
  }
  resetAll() {
    writeSettings({accent: DEFAULT_SETTINGS.accent});
    if (this.kind === 'dash') { try { localStorage.removeItem('carrot-theme-' + (this.card.config?.device_id || 'default')); } catch { /* ignore */ } this.card.themeMode = 'auto'; this.card.applyTheme?.(); this.card.setVehicleColor?.(null); }
    else writeSettings({mode: 'auto'});
    syncAll(true);
  }
  buildMenu() {
    if (this.kind !== 'dash') return;
    const t = this.t, d = this.dialog = document.createElement('dialog'); d.className = 'cui-dialog'; d.dataset.cui = '1'; d.setAttribute('aria-labelledby', 'cuiTitle');
    d.innerHTML = `<header class="settings-dialog-header"><div><h2 id="cuiTitle">${t.title}</h2></div><button type="button" data-k="close" aria-label="${t.closeAria}">${t.close}</button></header><div class="cui-body"></div><footer class="cui-foot"><button type="button" data-k="reset">${t.reset}</button><button type="button" data-k="done" class="primary">${t.done}</button></footer>`;
    d.querySelector('.cui-body').append(this.appearanceNode(false));
    this.scope = d;
    d.querySelector('[data-k=close]').onclick = () => d.close(); d.querySelector('[data-k=done]').onclick = () => d.close();
    d.querySelector('[data-k=reset]').onclick = () => this.resetAll();
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => this.gear?.focus());
    const g = this.gear = document.createElement('button'); g.type = 'button'; g.className = 'cui-gear'; g.dataset.cui = '1'; g.setAttribute('aria-label', t.gear); g.title = t.gear; g.innerHTML = GEAR_ICON;
    g.onclick = async () => { journalDialogCss = await loadJournalDialogCss(); this.ensureCar(); this.signature = ''; this.sync(true); this.paint(); d.showModal(); };
  }
  paint() {
    const sc = this.scope; if (!sc) return;
    const q = k => sc.querySelector(`[data-k=${k}]`), dark = this.isDark();
    const [r, g, b] = accentTone(dark);
    sc.style.setProperty('--cui-a', `rgb(${r},${g},${b})`); sc.style.setProperty('--cui-a12', `rgba(${r},${g},${b},.12)`); sc.style.setProperty('--cui-a35', `rgba(${r},${g},${b},.35)`);
    this.gear?.style.setProperty('--cui-a', `rgb(${r},${g},${b})`);
    const tn = tones(); q('t1').style.background = tn[0]; q('t2').style.background = `linear-gradient(135deg,${tn[0]},${remapColor('#0c43ad')})`;
    sc.querySelectorAll('[data-k=mode] button').forEach(x => x.classList.toggle('active', x.dataset.v === this.getMode()));
    const known = ['default', 'ha', ...PRESETS.map(p => p[0])], isPreset = known.includes(settings.accent);
    sc.querySelectorAll('[data-k=accent] .cui-sw').forEach(x => { const on = x.dataset.v === settings.accent || (x.dataset.v === 'custom' && !isPreset); x.setAttribute('aria-pressed', String(on)); if (x.dataset.v === 'custom' && !isPreset) x.style.setProperty('--c', settings.accent); });
    const preset = PRESETS.find(p => p[0] === settings.accent);
    q('accCap').textContent = settings.accent === 'default' ? this.t.def : settings.accent === 'ha' ? this.t.ha : (preset ? preset[1][this.lang] : settings.accent);
    if (this.carEl && q('car')) {
      const cv = this.card.vehicleColorValue?.() || '#333234', named = this.vehicleColors.find(([x]) => x === cv);
      sc.querySelectorAll('[data-k=car] button.cui-sw').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === cv)));
      const cc = sc.querySelector('[data-k=car] .custom'); cc.setAttribute('aria-pressed', String(!named)); if (!named) cc.style.setProperty('--c', cv);
      q('carCap').textContent = named ? named[1] : cv.toUpperCase();
    }
  }
  /* --- 포인트 색 적용: <style>/인라인 색을 변환(원본은 보존) --- */
  remapTree(rootNode, full = false) {
    const mint = this.kind === 'journal', lightText = this.kind === 'journal' && !this.isDark();
    const els = rootNode.nodeType === 1 ? [rootNode, ...rootNode.querySelectorAll('*')] : [...rootNode.querySelectorAll('*')];
    for (const el of els) {
      if (el.closest?.('[data-cui="1"]')) continue;
      if (el.tagName === 'STYLE') {
        if (!el.__cuiOrig) el.__cuiOrig = el.textContent;
        const key = ACC ? `${ACC.h.toFixed(4)}|${ACC.k.toFixed(3)}|${mint}|${lightText}|${el.__cuiOrig.length}|${hashText(el.__cuiOrig)}` : null;
        let t = el.__cuiOrig;
        if (ACC) { t = styleCache.get(key); if (t == null) { t = remapCss(el.__cuiOrig, mint, lightText); if (styleCache.size > 24) styleCache.clear(); styleCache.set(key, t); } }
        if (el.textContent !== t) el.textContent = t;
      }
      for (const att of ['style', 'fill', 'stroke', 'stop-color']) {
        if (!el.hasAttribute?.(att)) continue;
        const key = 'data-cui-orig-' + att;
        if (!el.hasAttribute(key)) el.setAttribute(key, el.getAttribute(att));
        const t = ACC ? remapText(el.getAttribute(key), mint) : el.getAttribute(key);
        if (el.getAttribute(att) !== t) el.setAttribute(att, t);
      }
    }
  }
}
const styleCache = new Map();
function hashText(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; }

/* document.body 에 붙는 대화상자(충전 금액 직접 입력·삭제 확인): 같은 스킨 */
let bodySkin = null;
function applyBodySkin() {
  const first = [...controllers].find(c => c.kind === 'dash') || [...controllers][0];
  if (!first) return;
  if (!bodySkin) { bodySkin = document.createElement('style'); bodySkin.id = 'carrot-ui-body-skin'; document.head.append(bodySkin); }
  const follow = first.styleHA(), dark = first.isDark(), [r, g, b] = accentTone(dark);
  bodySkin.textContent = `
body>dialog.carrot-ui-dialog{${HELPER_VARS};${follow ? FOLLOW_DIALOG_TOK : (dark ? DARK_TOK : LIGHT_TOK)};--cui-a:rgb(${r},${g},${b});--cui-a12:rgba(${r},${g},${b},.12);--cui-a35:rgba(${r},${g},${b},.35);box-sizing:border-box!important;padding:24px 26px!important;font:15px/1.65 system-ui,-apple-system,sans-serif!important}
body>dialog.carrot-ui-dialog{border-radius:18px!important;background:linear-gradient(var(--j-surface),var(--j-surface)),var(--cui-base)!important;border:1px solid var(--j-border)!important;color:var(--j-ink)!important;box-shadow:0 24px 70px rgba(0,0,0,.45);-webkit-backdrop-filter:${follow ? 'var(--cui-blur)' : 'none'};backdrop-filter:${follow ? 'var(--cui-blur)' : 'none'}}
body>dialog.carrot-ui-dialog::backdrop{background:rgba(5,8,11,.75)!important;backdrop-filter:blur(8px)!important}
body>dialog.carrot-ui-dialog h2{font-size:20px!important;font-weight:750;letter-spacing:-.3px}
body>dialog.carrot-ui-dialog input{background:var(--j-bg)!important;border:1px solid var(--j-border)!important;border-radius:10px!important;color:var(--j-ink)!important}
body>dialog.carrot-ui-dialog button{border-radius:12px!important;border:1px solid var(--j-border)!important;background:var(--j-raised)!important;color:var(--j-ink)!important;min-height:40px;padding:8px 16px!important;font-weight:600}
body>dialog.carrot-ui-dialog button.save,body>dialog.carrot-ui-dialog button.confirm{color:var(--cui-a)!important;background:var(--cui-a12)!important;border-color:var(--cui-a35)!important}
body>dialog.carrot-ui-dialog button.delete{color:#ff8585!important}`;
}
function syncAll(force) { for (const c of controllers) c.sync(force); }
if (typeof addEventListener === 'function') addEventListener('storage', e => { if (e.key === SETTINGS_KEY) { settings = readSettings(); syncAll(true); } });

/* ---------------- 공개 API ----------------
   attachCarrotUiTheme(card,{kind:'dash'|'journal', lang:'ko'|'en', vehicleColors:[[hex,name],...], showCar:boolean})
   어떤 오류가 나도 카드 본래 동작을 막지 않는다. */
export function attachCarrotUiTheme(card, opts = {}) {
  try {
    if (isDisabled()) return null;
    if (card._carrotUi) { card._carrotUi.start(); return card._carrotUi; }
    const c = new Controller(card, opts); card._carrotUi = c; c.start(); return c;
  } catch (error) { console.warn('Carrot UI theme disabled:', error); return null; }
}
export function detachCarrotUiTheme(card) { card?._carrotUi?.stop(); }
export const _test = {toOk, fromOk, fromY, lumOf, remapText, remapCss, isAccentRgb, parseColor, setAccent: a => { ACC = a; }, PRESETS};
