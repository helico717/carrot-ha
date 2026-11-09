// 오픈파일럿 사용 통계 패널 (주행 탭). / Openpilot usage statistics panel (Trips tab).
// 데이터는 HA 로컬 집계(`carrot_ha/assist/summary`)만 읽는다. 수신 앱에 직접 요청하지 않으며,
// 카드는 이 모듈의 공유 캐시(card._assist)만 사용한다(질의 증폭 금지).
const TTL_MS = 60000; // HA도 같은 60초 동안 결과를 캐시한다.

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const TEXT = {
  ko: {
    locale: 'ko-KR', title: '오픈파일럿 사용 통계', pending: '측정 대기',
    emptyBody: '아직 측정된 주행이 없습니다. 차량 업데이트 후 첫 주행부터 통계가 쌓입니다.',
    loading: '불러오는 중…', failed: '통계를 불러오지 못했습니다. 잠시 후 다시 시도합니다.',
    since: (d, trips) => `${d}부터 측정 · ${trips}회 주행`, sinceDate: (m, d) => `${m}월 ${d}일`,
    all: '누적', pickDay: '날짜 선택', gaugeLabel: '오픈파일럿 주행', noRecord: '기록 없음',
    assistKm: '오픈파일럿 주행', totalKm: '전체 주행', longest: '최장 연속 기록',
    dayLongest: d => `${d} 최장 연속 기록`, noDayTrips: '이 날은 측정된 주행이 없습니다', noStreak: '100 m 이상 이어진 구간 없음',
    gap: ' · 신호 공백으로 끊김', diseng: n => ` · 해제 ${n}회`,
    streak: n => `${n}일 연속 기록`, bestStreak: n => `최장 ${n}일 · 하루 1 km 이상`,
    chartMonth: '월별 오픈파일럿 주행거리', chartDay: '일별 오픈파일럿 사용률', month: '월별', day: '일별',
    weekdays: ['일', '월', '화', '수', '목', '금', '토'], monthName: m => `${m}월`,
    dayLabel: (m, d, w) => `${m}월 ${d}일(${w})`, shortDay: (m, d) => `${m}/${d}`,
    ariaGauge: (scope, v) => `${scope} 오픈파일럿 사용률 ${v}%`, chipTitle: (d, v) => `${d} · ${v}`,
  },
  en: {
    locale: 'en-US', title: 'Openpilot Usage Stats', pending: 'Waiting for data',
    emptyBody: 'No measured trips yet. Statistics start accumulating from the first drive after the vehicle update.',
    loading: 'Loading…', failed: 'Could not load statistics. Retrying shortly.',
    since: (d, trips) => `Measured since ${d} · ${trips} trips`, sinceDate: (m, d) => `${MONTHS_EN[m - 1]} ${d}`,
    all: 'All time', pickDay: 'Pick a date', gaugeLabel: 'on Openpilot', noRecord: 'No record',
    assistKm: 'Openpilot', totalKm: 'Total', longest: 'Longest streak',
    dayLongest: d => `${d} longest streak`, noDayTrips: 'No measured trips on this day', noStreak: 'No stretch of 100 m or more',
    gap: ' · broken by signal gap', diseng: n => ` · ${n} disengagement${n === 1 ? '' : 's'}`,
    streak: n => `${n} day streak`, bestStreak: n => `Best ${n} day${n === 1 ? '' : 's'} · 1 km or more per day`,
    chartMonth: 'Openpilot distance by month', chartDay: 'Openpilot share by day', month: 'Month', day: 'Day',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], monthName: m => MONTHS_EN[m - 1],
    dayLabel: (m, d, w) => `${w}, ${MONTHS_EN[m - 1]} ${d}`, shortDay: (m, d) => `${m}/${d}`,
    ariaGauge: (scope, v) => `${scope} openpilot share ${v}%`, chipTitle: (d, v) => `${d} · ${v}`,
  },
};
var MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---- 순수 계산(테스트 대상) ----
export const nf = (v, d = 0, locale = 'ko-KR') => v.toLocaleString(locale, {minimumFractionDigits: d, maximumFractionDigits: d});
export const km = (m, d = 1, locale = 'ko-KR') => nf(m / 1000, d, locale);
export const pct = (r, locale = 'ko-KR') => r == null ? '—' : nf(r * 100, 1, locale);
const dow = key => new Date(key + 'T12:00:00Z').getUTCDay();
const ymd = (date, tz) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit'})
    .formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
export const dayKey = (offset, tz, now = new Date()) => ymd(new Date(+now + offset * 86400000), tz);
export const lastDays = (n, tz, now) => Array.from({length: n}, (_, i) => dayKey(i - n + 1, tz, now));
// 월~일 달력 주(HA 시간대). 오늘 이후는 'future'로 표시한다.
export const weekKeys = (tz, now) => {
  const today = dayKey(0, tz, now), back = (dow(today) + 6) % 7;
  return Array.from({length: 7}, (_, i) => dayKey(i - back, tz, now));
};
// API 시각은 UTC로 온다. 표시는 HA 시간대로 변환한다.
export const clock = (iso, tz) => iso ? new Intl.DateTimeFormat('en-GB', {timeZone: tz || undefined, hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date(iso)) : '';
export const dayLabel = (key, lang) => { const t = TEXT[lang] || TEXT.ko, d = new Date(key + 'T12:00:00Z'); return t.dayLabel(d.getUTCMonth() + 1, d.getUTCDate(), t.weekdays[d.getUTCDay()]); };

// 선택 범위(누적/선택일)에 따라 게이지·합계에 쓸 값을 정한다. 기록 없는 날은 0%가 아니라 null.
export function scopeValues(scope, all, byDate, sel) {
  if (scope === 'day') {
    const d = sel ? byDate[sel] : null;
    return d ? {ratio: d.ratio, assist: d.assist_m, manual: d.manual_m} : {ratio: null, assist: null, manual: null};
  }
  return {ratio: all.total.ratio, assist: all.total.assist_m, manual: all.total.manual_m};
}

export function axisStep(maxKm) { return maxKm > 800 ? 500 : maxKm > 300 ? 200 : maxKm > 120 ? 100 : maxKm > 50 ? 50 : 20; }

export const ASSIST_CSS = `
.assist{margin:14px 0 0;--as:#3b82f6;--as-soft:rgba(59,130,246,.18);--as-track:rgba(255,255,255,.10);--as-dim:#4a5056;--as-green:#4ade80;--as-white:#f3f4f4}
:host([data-theme="light"]) .assist{--as:#2563eb;--as-soft:rgba(37,99,235,.14);--as-track:rgba(0,0,0,.09);--as-dim:#c5cdd2;--as-green:#16a34a;--as-white:#111827}
.assist-body{display:grid;grid-template-columns:minmax(230px,330px) minmax(0,1fr);gap:20px 40px;padding:6px 26px 28px}
.as-left{display:flex;flex-direction:column;align-items:center;min-width:0}
.as-gauge{position:relative;width:100%;max-width:300px;aspect-ratio:200/172;container-type:inline-size}
.as-gauge svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.as-gauge .track,.as-gauge .fill{fill:none;stroke-linecap:round}
.as-gauge .track{stroke:var(--as-track);stroke-width:3}.as-gauge .fill{stroke:var(--as);stroke-width:5;transition:stroke-dasharray .55s cubic-bezier(.22,.8,.3,1)}
.as-center{position:absolute;left:50%;top:53.5%;transform:translate(-50%,-50%);text-align:center;white-space:nowrap;pointer-events:none}
.as-center b{display:block;font-size:19cqw;font-weight:600;letter-spacing:-.03em;line-height:1;color:var(--as-white)}
.as-center b small{font-size:.5em;font-weight:500;margin-left:.06em}
.as-center span{display:block;margin-top:2.5cqw;font-size:max(12px,4.6cqw);color:var(--muted)}
.as-ends{position:absolute;top:89%;font-size:10.5px;color:var(--muted);transform:translateX(-50%)}
.as-ends.l{left:22.5%}.as-ends.r{left:77.5%}
.as-scope{margin-bottom:12px;align-self:center}
.as-rows{width:100%;margin-top:14px;display:flex;flex-direction:column;gap:9px;font-size:13px}
.as-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.as-row span{color:var(--muted)}.as-row b{font-weight:600;color:var(--as-white);font-size:15px}
.as-row.on b{color:var(--as)}
.as-best{width:100%;margin-top:4px;padding-top:12px;border-top:1px solid var(--line)}
.as-best>div{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.as-best small{color:var(--muted);font-size:12px}.as-best b{font-size:24px;font-weight:600;color:var(--as-green);letter-spacing:-.02em}.as-best b i{font-style:normal;font-size:13px;margin-left:3px;font-weight:500}
.as-best p{margin:3px 0 0;font-size:11px;color:var(--muted);text-align:right}
.as-right{display:flex;flex-direction:column;gap:22px;min-width:0}
.as-h{margin:0 0 12px;font-size:14px;font-weight:600;color:var(--as-white);display:flex;justify-content:space-between;align-items:center;gap:8px}
.as-h em{font-style:normal;font-weight:500;font-size:11px;color:var(--muted)}
.as-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;justify-items:center}
.as-chip{display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:0;padding:0;font-size:11px;color:var(--muted);cursor:pointer}
.as-chip i{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:13px;line-height:1;color:#fff}
.as-chip.on i{background:var(--as)}.as-chip.low i{background:var(--as-soft);color:var(--as)}
.as-chip.none i,.as-chip.future i{background:none}
.as-chip.none i::before,.as-chip.future i::before{content:"";width:4px;height:4px;border-radius:50%;background:var(--as-dim)}
.as-chip.future{cursor:default;opacity:.6}
.as-chip.sel{color:var(--as-white);font-weight:700}.as-chip.sel i{box-shadow:0 0 0 3px var(--as-soft)}
.as-chip.sel.none i{box-shadow:0 0 0 2px var(--as-dim)}
.as-tabs{display:inline-flex;background:var(--as-track);border-radius:9px;padding:2px}
.as-tabs button{border:0;background:none;color:var(--muted);font-size:11px;padding:4px 11px;border-radius:7px;font-weight:600;cursor:pointer}
.as-tabs button.on{background:var(--as-dim);color:var(--as-white)}
:host([data-theme="light"]) .as-tabs button.on{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.15)}
.as-tabs button:disabled{opacity:.4;cursor:default}
.as-plot{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:6px;height:170px}
.as-bars{display:flex;justify-content:space-around;align-items:stretch;gap:clamp(6px,2.6cqw,22px);border-bottom:1px solid var(--line);position:relative;padding:0 2px}
.as-grid{position:absolute;left:0;right:0;border-top:1px solid var(--line);opacity:.55;pointer-events:none}
.as-col{flex:1;min-width:0;max-width:72px;display:flex;align-items:flex-end;position:relative;background:none;border:0;padding:0;z-index:1;cursor:pointer}
.as-col span{display:block;position:relative;width:100%;background:var(--as-dim);border-radius:4px 4px 0 0;min-height:3px;transition:height .45s ease}
.as-col span::after{content:attr(data-tip);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:7px;padding:6px 9px;border-radius:8px;background:var(--as-white);color:#0c0e10;font-size:11px;line-height:1.45;font-weight:600;white-space:pre;text-align:center;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .12s;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,.35)}
:host([data-theme="light"]) .as-col span::after{color:#fff}
.as-bars.dense .as-col:first-of-type span::after{left:0;transform:none}
.as-bars.dense .as-col:last-of-type span::after{left:auto;right:0;transform:none}
.as-col.tip{z-index:10}.as-col.tip span::after{opacity:1;visibility:visible}
@media (hover:hover){.as-col:hover{z-index:11}.as-col:hover span::after{opacity:1;visibility:visible}.as-col:hover span{filter:brightness(1.3)}}
.as-col.cur span,.as-col.sel span{background:var(--as-white)}
.as-col.none span{min-height:0;height:0!important}
.as-col.none::after{content:"";position:absolute;left:25%;right:25%;bottom:-2px;height:2px;border-radius:1px;background:var(--as-dim);opacity:.6}
.as-y{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;font-size:10.5px;color:var(--muted);text-align:right}
.as-x{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:6px;margin-top:7px}
.as-xl{display:flex;justify-content:space-around;gap:clamp(6px,2.6cqw,22px);padding:0 2px;font-size:11px;color:var(--muted)}
.as-xl span{flex:1;min-width:0;max-width:72px;text-align:center;white-space:nowrap}.as-xl span.cur{color:var(--as-white);font-weight:600}
.as-empty{padding:26px 22px 34px;text-align:center;color:var(--muted);font-size:13px;line-height:1.7}
.as-state{padding:0 26px 14px;font-size:11px;color:var(--muted)}
@container(max-width:700px){
 .assist-body{grid-template-columns:1fr;padding:2px 16px 18px;gap:22px}
 .as-plot{height:150px}.as-state{padding:0 16px 12px}
}`;

// ---- 상태·데이터 ----
export function assistState(card) {
  return card._assist || (card._assist = {all: null, days: {}, at: 0, seq: 0, error: false, loading: false, scope: 'all', day: null, chart: 'month', tip: null, shown: null, target: null});
}

// 주행 탭이 보일 때만 호출된다. 60초 안의 재호출은 요청하지 않는다.
export async function ensureAssist(card, now = Date.now()) {
  const a = assistState(card), hass = card._hass, entry = card.device?.entry_id;
  if (!hass?.callWS || !entry || a.loading || now < (a.retryAt || 0)) return;
  const sel = a.day || card.tripDay;
  const needDay = a.scope === 'day' && sel && !(a.days[sel] && now - a.days[sel].at < TTL_MS);
  const needAll = !a.all || now - a.at >= TTL_MS;
  if (!needAll && !needDay) return;
  a.loading = true;
  const seq = ++a.seq;
  try {
    const job = [];
    if (needAll) job.push(hass.callWS({type: 'carrot_ha/assist/summary', entry_id: entry, period: 'all'}).then(r => { if (seq === a.seq) { a.all = r; a.at = now; } }));
    if (needDay) job.push(hass.callWS({type: 'carrot_ha/assist/summary', entry_id: entry, period: 'day', date: sel}).then(r => { if (seq === a.seq) a.days[sel] = {...r, at: now}; }));
    await Promise.all(job);
    a.error = false;a.retryAt = 0;
  } catch (e) {
    a.error = true;
    a.retryAt = now + 15000; // 실패하면 15초 뒤에 다시 시도(조용히 백오프)
  } finally {
    a.loading = false;
    if (card.isConnected !== false) card.render?.();
  }
}

// ---- 화면 ----
function chartHtml(a, all, byDate, sel, mode, t, tz) {
  const tip = a.tip, L = t.locale;
  let cols, xl, ylab, title;
  if (mode === 'month') {
    const months = all.months.slice(-6), max = Math.max(1, ...months.map(m => m.assist_m));
    const yTop = Math.ceil(max / 1000 / axisStep(max / 1000)) * axisStep(max / 1000);
    cols = months.map((m, i) => {
      const mo = +m.month.slice(5);
      return `<button type="button" class="as-col${i === months.length - 1 ? ' cur' : ''}${tip === m.month ? ' tip' : ''}" data-assist-tip="${esc(m.month)}"><span data-tip="${esc(t.monthName(mo))}\n${km(m.assist_m, 1, L)} km · ${pct(m.ratio, L)}%" style="height:${(m.assist_m / 1000 / yTop) * 100}%"></span></button>`;
    }).join('');
    xl = months.map((m, i) => `<span${i === months.length - 1 ? ' class="cur"' : ''}>${esc(t.monthName(+m.month.slice(5)))}</span>`).join('');
    ylab = [yTop, yTop * 0.75, yTop * 0.5, yTop * 0.25, 0].map(v => `<span>${nf(v, 0, L)} km</span>`).join('');
    title = t.chartMonth;
  } else {
    const keys = lastDays(14, tz);
    cols = keys.map(k => {
      const d = byDate[k], h = d && d.ratio != null ? Math.max(3, d.ratio * 100) : 0;
      return `<button type="button" class="as-col${d ? '' : ' none'}${k === sel ? ' sel' : ''}${tip === k ? ' tip' : ''}" data-assist-day="${esc(k)}" data-assist-tip="${esc(k)}"><span data-tip="${esc(dayLabel(k, a.lang))}\n${d ? pct(d.ratio, L) + '% · ' + km(d.assist_m, 1, L) + ' km' : esc(t.noRecord)}" style="height:${d ? h : 100}%"></span></button>`;
    }).join('');
    xl = keys.map((k, i) => `<span${k === sel ? ' class="cur"' : ''}>${i % 2 === 0 || i === 13 ? +k.slice(8) : ''}</span>`).join('');
    ylab = [100, 75, 50, 25, 0].map(v => `<span>${v}%</span>`).join('');
    title = t.chartDay;
  }
  const grid = [0, 25, 50, 75].map(p => `<i class="as-grid" style="top:${p}%"></i>`).join('');
  const tabs = `<div class="as-tabs"><button type="button" data-assist-chart="month" class="${mode === 'month' ? 'on' : ''}">${t.month}</button><button type="button" data-assist-chart="day" class="${mode === 'day' ? 'on' : ''}">${t.day}</button></div>`;
  return `<div class="as-chart"><h3 class="as-h"><span>${title}</span>${tabs}</h3><div class="as-plot"><div class="as-bars${mode === 'day' ? ' dense' : ''}">${grid}${cols}</div><div class="as-y">${ylab}</div></div><div class="as-x"><div class="as-xl">${xl}</div><span></span></div></div>`;
}

export function assistPanelHtml(card, lang = 'ko', now = new Date()) {
  const t = TEXT[lang] || TEXT.ko, L = t.locale, a = assistState(card);
  a.lang = lang;
  const tz = card._hass?.config?.time_zone;
  const head = sub => `<div class="paneltitle"><h2>${t.title}</h2><span class="sub">${esc(sub)}</span></div>`;
  const all = a.all;
  if (!all) {
    return `<style>${ASSIST_CSS}</style><section class="panel assist">${head(a.error ? t.failed : t.loading)}</section>`;
  }
  if (!all.measured) {
    a.target = null;
    return `<style>${ASSIST_CSS}</style><section class="panel assist">${head(t.pending)}<div class="as-empty">${t.emptyBody}</div></section>`;
  }
  const sel = a.day || card.tripDay;
  const scope = a.scope === 'day' && sel ? 'day' : 'all', mode = a.chart === 'day' ? 'day' : 'month';
  const byDate = Object.fromEntries((all.days || []).map(d => [d.date, d]));
  const since = t.sinceDate(+all.since.slice(5, 7), +all.since.slice(8, 10)), today = dayKey(0, tz, now);
  const dayS = scope === 'day' ? a.days[sel] : null, dRow = sel ? byDate[sel] : null;
  const v = scopeValues(scope, all, byDate, sel);
  const ratio = v.ratio ?? 0;
  a.target = v.ratio == null ? null : ratio;
  const scopeName = scope === 'day' ? dayLabel(sel, lang) : t.all;
  const gauge = `<svg viewBox="0 0 200 172" role="img" aria-label="${esc(t.ariaGauge(scopeName, pct(v.ratio, L)))}"><circle class="track" cx="100" cy="92" r="78" pathLength="100" stroke-dasharray="75 100" transform="rotate(135 100 92)"/><circle class="fill" cx="100" cy="92" r="78" pathLength="100" stroke-dasharray="${ratio * 75} 100" transform="rotate(135 100 92)"/></svg>
    <div class="as-center"><b id="assistNum">${v.ratio == null ? '—' : `${nf(ratio * 100, 1, L)}<small>%</small>`}</b><span>${v.ratio == null ? t.noRecord : t.gaugeLabel}</span></div><span class="as-ends l">0</span><span class="as-ends r">100</span>`;
  const scopeBar = `<div class="as-tabs as-scope"><button type="button" data-assist-scope="all" class="${scope === 'all' ? 'on' : ''}">${t.all}</button><button type="button" data-assist-scope="day" class="${scope === 'day' ? 'on' : ''}"${sel ? '' : ' disabled'}>${esc(sel ? dayLabel(sel, lang) : t.pickDay)}</button></div>`;
  const wd = t.weekdays;
  const week = weekKeys(tz, now).map(k => {
    const d = byDate[k], fut = k > today, cls = fut ? 'future' : !d ? 'none' : d.active ? 'on' : 'low';
    const title = fut ? dayLabel(k, lang) : t.chipTitle(dayLabel(k, lang), d ? pct(d.ratio, L) + '%' : t.noRecord);
    return `<button type="button" class="as-chip ${cls}${k === sel ? ' sel' : ''}"${fut ? ' disabled' : ` data-assist-day="${esc(k)}"`} title="${esc(title)}"><i>${d && d.active ? '✓' : d ? '·' : ''}</i>${wd[dow(k)]}</button>`;
  }).join('');
  let best;
  if (scope === 'all') {
    const l = all.longest_streak, ld = l ? ymd(new Date(l.start_at), tz) : null;
    best = `<div class="as-best"><div><small>${t.longest}</small><b>${l ? km(l.distance_m, 1, L) : '—'}<i>${l ? 'km' : ''}</i></b></div><p>${l ? `${esc(dayLabel(ld, lang))} ${clock(l.start_at, tz)} → ${clock(l.end_at, tz)}${l.broken_by_gap ? t.gap : ''}` : t.noStreak}${all.disengagements ? t.diseng(all.disengagements) : ''}</p></div>`;
  } else {
    const ls = dayS?.longest_streak;
    best = !dRow ? `<div class="as-best"><div><small>${esc(t.dayLongest(dayLabel(sel, lang)))}</small><b>—</b></div><p>${t.noDayTrips}</p></div>`
      : `<div class="as-best"><div><small>${esc(t.dayLongest(dayLabel(sel, lang)))}</small><b>${ls ? km(ls.distance_m, 1, L) : '—'}<i>${ls ? 'km' : ''}</i></b></div><p>${dayS ? (ls ? `${clock(ls.start_at, tz)} → ${clock(ls.end_at, tz)}${ls.broken_by_gap ? t.gap : ''}` : t.noStreak) + (dayS.disengagements ? t.diseng(dayS.disengagements) : '') : t.loading}</p></div>`;
  }
  const kmv = x => x == null ? '—' : `${km(x, 1, L)} km`;
  return `<style>${ASSIST_CSS}</style><section class="panel assist">${head(t.since(since, all.trips))}
    <div class="assist-body">
      <div class="as-left">${scopeBar}<div class="as-gauge">${gauge}</div>
        <div class="as-rows"><div class="as-row on"><span>${t.assistKm}</span><b>${kmv(v.assist)}</b></div><div class="as-row"><span>${t.totalKm}</span><b>${v.assist == null ? '—' : kmv(v.assist + v.manual)}</b></div></div>
        ${best}</div>
      <div class="as-right">
        <div><h3 class="as-h"><span>${t.streak(all.current_streak_days)}</span><em>${t.bestStreak(all.best_streak_days)}</em></h3><div class="as-week">${week}</div></div>
        ${chartHtml(a, all, byDate, sel, mode, t, tz)}
      </div>
    </div>${a.error ? `<div class="as-state">${t.failed}</div>` : ''}</section>`;
}

// ---- 렌더 직후 / 이벤트 ----
// 호는 기존 SVG 요소의 속성이 바뀌므로 CSS 전환이 저절로 일어난다. 숫자만 직접 올리거나 내린다.
export function animateAssist(card) {
  const a = card._assist, num = card.shadowRoot?.getElementById?.('assistNum');
  if (!a || !num) return;
  if (a.target == null) { a.shown = null; return; }
  const to = a.target, from = a.shown;
  a.shown = to;
  if (from == null || from === to) return;
  const node = num.firstChild, L = (TEXT[a.lang] || TEXT.ko).locale, t0 = Date.now(), D = 550;
  const step = () => {
    const k = Math.min(1, (Date.now() - t0) / D), e = 1 - Math.pow(1 - k, 3);
    node.nodeValue = nf((from + (to - from) * e) * 100, 1, L);
    if (k < 1 && num.isConnected) setTimeout(step, 16);
  };
  step();
}

export function bindAssist(card) {
  const root = card.shadowRoot;
  if (!root || card._assistBound) return;
  card._assistBound = true;
  root.addEventListener('click', e => {
    const a = assistState(card), hit = sel => e.target.closest?.(sel);
    const tr = hit('[data-trip-day]');
    if (tr) { if (a.day) { a.day = null; card.render(); } return; } // 기존 날짜 칩: 통계 패널도 그 날짜를 따른다
    const sc = hit('[data-assist-scope]');
    if (sc) { if (sc.disabled) return; a.scope = sc.dataset.assistScope; a.tip = null; card.render(); ensureAssist(card); return; }
    const ch = hit('[data-assist-chart]');
    if (ch) { a.chart = ch.dataset.assistChart; a.tip = null; card.render(); return; }
    const col = hit('[data-assist-tip]');
    if (col) a.tip = a.tip === col.dataset.assistTip && !col.dataset.assistDay ? null : col.dataset.assistTip;
    else if (hit('.as-chart')) a.tip = null;
    if (col && !col.dataset.assistDay) { card.render(); return; }
    const b = hit('[data-assist-day]');
    if (!b) return;
    a.day = b.dataset.assistDay; a.scope = 'day';
    const day = root.querySelector(`[data-trip-day="${b.dataset.assistDay}"]`);
    if (day) day.click(); else card.render(); // 최근 7일 밖의 날짜는 통계 패널만 해당 날짜로
    ensureAssist(card);
  });
}
