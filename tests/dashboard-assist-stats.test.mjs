import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assistPanelHtml, ensureAssist, assistState, weekKeys, lastDays, clock, dayKey, scopeValues, axisStep, pct, km, dayLabel}
  from '../custom_components/carrot_ha/frontend/carrot-assist-stats.js';

const TZ = 'Asia/Seoul';
const NOW = new Date('2026-11-09T03:00:00Z'); // 월요일 12:00 KST
const ALL = {
  measured: true, since: '2026-11-06T13:01:24+00:00', trips: 11,
  total: {assist_m: 135702.5, manual_m: 140838.2, unknown_m: 1723.2, ratio: 0.4907},
  days: [
    {date: '2026-11-06', active: false, assist_m: 203.6, manual_m: 3267.5, ratio: 0.0587},
    {date: '2026-11-07', active: true, assist_m: 90857.9, manual_m: 110033.3, ratio: 0.4523},
    {date: '2026-11-09', active: true, assist_m: 44641, manual_m: 27537.4, ratio: 0.6185},
  ],
  months: [{month: '2026-11', assist_m: 135702.5, manual_m: 140838.2, ratio: 0.4907}],
  current_streak_days: 1, best_streak_days: 1, disengagements: 27,
  longest_streak: {distance_m: 23376.8, start_at: '2026-11-06T16:24:43+00:00', end_at: '2026-11-06T16:38:19+00:00', broken_by_gap: false},
};
const DAY = {measured: true, longest_streak: {distance_m: 14429, start_at: '2026-11-08T23:08:00+00:00', end_at: '2026-11-08T23:19:00+00:00', broken_by_gap: false}, disengagements: 12, measured_trips: 3};
const card = (over = {}) => ({_hass: {config: {time_zone: TZ}, callWS: async () => ALL}, device: {entry_id: 'e1'}, tripDay: '2026-11-09', isConnected: true, render() {}, ...over});

test('API 시각(UTC)은 HA 시간대로 표시하고 날짜 키도 같은 시간대로 계산한다', () => {
  assert.equal(clock('2026-11-06T16:24:43+00:00', TZ), '01:24');
  assert.equal(clock('2026-11-08T23:08:00+00:00', TZ), '08:08');
  assert.equal(dayKey(0, TZ, new Date('2026-11-08T16:00:00Z')), '2026-11-09');
  assert.equal(dayLabel('2026-11-07', 'ko'), '11월 7일(토)');
  assert.equal(dayLabel('2026-11-07', 'en'), 'Sat, Nov 7');
});

test('요일 칩은 월~일 달력 주이고, 최근 N일 키는 오늘까지 순서대로 나온다', () => {
  assert.deepEqual(weekKeys(TZ, NOW), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.deepEqual(weekKeys(TZ, new Date('2026-11-15T03:00:00Z'))[0], '2026-11-09'); // 일요일도 같은 주
  const days = lastDays(14, TZ, NOW);
  assert.equal(days.length, 14);assert.equal(days.at(-1), '2026-11-09');assert.equal(days[0], '2026-10-27');
});

test('선택일 범위: 기록 없는 날은 0%가 아니라 null이며 누적은 전체 합계를 쓴다', () => {
  const by = Object.fromEntries(ALL.days.map(d => [d.date, d]));
  assert.deepEqual(scopeValues('all', ALL, by, '2026-11-07'), {ratio: 0.4907, assist: 135702.5, manual: 140838.2});
  assert.equal(scopeValues('day', ALL, by, '2026-11-07').ratio, 0.4523);
  assert.deepEqual(scopeValues('day', ALL, by, '2026-11-08'), {ratio: null, assist: null, manual: null});
  assert.equal(pct(null), '—');assert.equal(pct(0.4907), '49.1');assert.equal(km(135702.5), '135.7');
  assert.equal(axisStep(135), 100);assert.equal(axisStep(1074), 500);
});

test('패널: 누적 기본 표시, 월별 막대, 요일 칩과 한국어 문구', () => {
  const c = card();assistState(c).all = ALL;
  const html = assistPanelHtml(c, 'ko', NOW);
  assert.match(html, /오픈파일럿 사용 통계/);assert.match(html, /11월 6일부터 측정 · 11회 주행/);
  assert.match(html, /49\.1<small>%<\/small>/);assert.match(html, /135\.7 km/);assert.match(html, /276\.5 km/);
  assert.match(html, /23\.4<i>km<\/i>/);assert.match(html, /11월 7일\(토\) 01:24 → 01:38/);
  assert.match(html, /1일 연속 기록/);assert.equal((html.match(/class="as-chip /g) || []).length, 7);
  assert.equal((html.match(/as-chip future/g) || []).length, 6);
  assert.match(html, /data-assist-chart="month" class="on"/);
  assert.doesNotMatch(html, /사용률 = /); // 계산 과정 설명 문구는 표시하지 않는다
});

test('패널: 선택일 범위와 기록 없는 날 표시', () => {
  const c = card({tripDay: '2026-11-09'});const a = assistState(c);a.all = ALL;a.scope = 'day';a.days['2026-11-09'] = {...DAY, at: Date.now()};
  let html = assistPanelHtml(c, 'ko', NOW);
  assert.match(html, /61\.9<small>%<\/small>/);assert.match(html, /44\.6 km/);assert.match(html, /14\.4<i>km<\/i>/);assert.match(html, /08:08 → 08:19/);assert.match(html, /해제 12회/);
  a.day = '2026-11-08';
  html = assistPanelHtml(c, 'ko', NOW);
  assert.match(html, /<b id="assistNum">—<\/b>/);assert.match(html, /기록 없음/);assert.match(html, /이 날은 측정된 주행이 없습니다/);
  assert.equal(a.target, null);
});

test('패널: 영어 화면에는 한글이 섞이지 않는다', () => {
  const c = card();const a = assistState(c);a.all = ALL;a.chart = 'day';
  const html = assistPanelHtml(c, 'en', NOW).replace(/<style>[\s\S]*?<\/style>/, '');
  assert.doesNotMatch(html, /[가-힣]/);
  assert.match(html, /Openpilot Usage Stats/);assert.match(html, /Measured since Nov 6 · 11 trips/);assert.match(html, /Sat, Nov 7/);assert.match(html, /Sun/);
});

test('패널: 로딩·실패·측정 전 상태', () => {
  const c = card();
  assert.match(assistPanelHtml(c, 'ko', NOW), /불러오는 중/);
  assistState(c).error = true;assert.match(assistPanelHtml(c, 'ko', NOW), /불러오지 못했습니다/);
  assistState(c).all = {measured: false, trips: 0, days: [], months: []};
  assert.match(assistPanelHtml(c, 'ko', NOW), /측정 대기/);
});

test('요청은 60초 안에 중복되지 않고, 선택일 범위에서만 날짜 요청을 추가한다(질의 증폭 금지)', async () => {
  const calls = [];
  const c = card({_hass: {config: {time_zone: TZ}, callWS: async m => {calls.push(m.period + (m.date ? ':' + m.date : ''));return m.period === 'all' ? ALL : DAY;}}});
  await ensureAssist(c, 1000);await ensureAssist(c, 20000);await ensureAssist(c, 59000);
  assert.deepEqual(calls, ['all']);
  assistState(c).scope = 'day';
  await ensureAssist(c, 30000);await ensureAssist(c, 31000);
  assert.deepEqual(calls, ['all', 'day:2026-11-09']);
  await ensureAssist(c, 62000); // 누적은 60초가 지나 새로 고치지만, 30초에 받은 선택일은 아직 유효하다(누적 갱신이 날짜 캐시를 지우지 않는다)
  assert.deepEqual(calls, ['all', 'day:2026-11-09', 'all']);
  await ensureAssist(c, 95000); // 선택일도 60초가 지나면 새로 고친다
  assert.deepEqual(calls, ['all', 'day:2026-11-09', 'all', 'day:2026-11-09']);
});

test('실패하면 기존 표시를 유지하고 15초 뒤에 다시 시도하며 연속 호출하지 않는다', async () => {
  let n = 0, ok = false;
  const c = card({_hass: {config: {time_zone: TZ}, callWS: async () => {n++;if (!ok) throw Error('boom');return ALL;}}});
  await ensureAssist(c, 1000);assert.equal(assistState(c).error, true);assert.equal(n, 1);
  await ensureAssist(c, 5000);assert.equal(n, 1);
  ok = true;await ensureAssist(c, 17000);assert.equal(n, 2);assert.equal(assistState(c).error, false);assert.ok(assistState(c).all);
});

test('한국어·영어 대시보드는 같은 모듈을 쓰고 주행 탭 레이아웃 뒤에서만 패널을 그린다', () => {
  for (const lang of ['ko', 'en']) {
    const src = readFileSync(new URL(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`, import.meta.url), 'utf8');
    assert.match(src, /await import\(dependencyURL\('\.\/carrot-assist-stats\.js'\)\)/);
    assert.ok(src.includes(`\${this.tripHistory(isTrip)}</div>\${isTrip?assistPanelHtml(this,'${lang}'):''}`));
    assert.ok(src.includes("if(this.tab==='trips'){animateAssist(this);ensureAssist(this);}"));
  }
});
