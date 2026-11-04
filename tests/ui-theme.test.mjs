// 화면 설정(포인트 색·모드·통일 팝업) 회귀 테스트. 실행: node --test tests/ui-theme.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const frontend = new URL('../custom_components/carrot_ha/frontend/', import.meta.url);
const read = name => readFileSync(new URL(name, frontend), 'utf8');
const {_test, isDisabled, attachCarrotUiTheme} = await import(new URL('carrot-ui-theme.js', frontend));
const {toOk, fromY, lumOf, remapText, remapCss, parseColor, isAccentRgb, setAccent} = _test;

const contrast = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const accents = ['#ff9f43', '#a78bfa', '#38d9a9', '#03a9f4', '#9aa0a6', '#ffd43b'];

test('포인트 색은 대비를 보존한다: 모든 파랑 계열 색의 상대휘도가 같다', () => {
  const css = read('carrot-dashboard-ko.js') + read('carrot-vehicle-journal.js');
  const colors = [...new Set(css.match(/#[0-9a-fA-F]{6}\b/g))].filter(c => isAccentRgb(parseColor(c).rgb, true));
  assert.ok(colors.length > 40, 'fixture should contain many accent-family colors');
  for (const hex of accents) {
    const o = toOk(parseColor(hex).rgb);
    setAccent({h: o.h, k: Math.min(1.15, Math.max(.35, o.C / toOk([0x12, 0x60, 0xe8]).C)), C: o.C});
    let worst = 0;
    for (const c of colors) {
      const before = parseColor(c).rgb, after = parseColor(remapText(c, true)).rgb;
      worst = Math.max(worst, Math.abs(contrast(before, [255, 255, 255]) - contrast(after, [255, 255, 255])));
    }
    assert.ok(worst < 1.1, `${hex}: contrast drift ${worst.toFixed(2)}`);
  }
  setAccent(null);
});

test('색 변환은 알파·중립색·의미 색을 건드리지 않는다', () => {
  setAccent({h: toOk([255, 159, 67]).h, k: .8, C: .16});
  assert.equal(remapText('#ffffff'), '#ffffff');
  assert.equal(remapText('#5ad46d'), '#5ad46d');                 // 충전 중 초록
  assert.equal(remapText('#dc2626'), '#dc2626');                 // 위험 빨강
  assert.match(remapText('rgba(18,96,232,0.35)'), /^rgba\(\d+,\d+,\d+,0\.35\)$/);
  assert.notEqual(remapText('#1260e8'), '#1260e8');
  setAccent(null);
  assert.equal(remapText('#1260e8'), '#1260e8');                  // 기본 파랑이면 그대로
});

test('규칙 변환은 var()가 든 단축 속성과 카테고리 팔레트를 보존한다', () => {
  if (typeof CSSStyleSheet === 'undefined') return;               // 브라우저 전용 API
  setAccent({h: toOk([255, 159, 67]).h, k: .8, C: .16});
  const out = remapCss('.energy{background:linear-gradient(90deg,#1260e8 0 var(--soc),#0c43ad var(--soc) 100%)}:host{--cat-washing:#60a5fa;--j-blue:#7bb6ff}.type-icon-box{color:#60a5fa}', true);
  assert.match(out, /var\(--soc\)/);
  assert.match(out, /--cat-washing:\s*#60a5fa/);
  assert.match(out, /type-icon-box[^}]*#60a5fa/);
  assert.doesNotMatch(out, /--j-blue:\s*#7bb6ff/);
  setAccent(null);
});

test('비상 끄기 스위치: localStorage 또는 주소 인자', () => {
  globalThis.localStorage = {getItem: key => key === 'carrot-ui-disable' ? '1' : null};
  assert.equal(isDisabled(), true);
  assert.equal(attachCarrotUiTheme({}, {kind: 'dash'}), null);    // 끄면 카드에 아무것도 붙이지 않음
  globalThis.localStorage = {getItem: () => null};
  globalThis.location = {search: '?carrot_ui=off'};
  assert.equal(isDisabled(), true);
  globalThis.location = {search: ''};
  assert.equal(isDisabled(), false);
  delete globalThis.localStorage; delete globalThis.location;
});

test('모든 카드가 같은 모듈을 연결한다(대시보드 ko/en·차계부·충전 금액 팝업)', () => {
  for (const name of ['carrot-dashboard-ko.js', 'carrot-dashboard-en.js']) {
    const src = read(name);
    assert.match(src, /await import\(dependencyURL\('\.\/carrot-ui-theme\.js'\)\)/, name);
    assert.match(src, /attachCarrotUiTheme\(this,\{kind:'dash'/, name);
    assert.match(src, /detachCarrotUiTheme\(this\)/, name);
    assert.match(src, /this\._carrotUi\?\.sync\(\)/, name);
  }
  const journal = read('carrot-vehicle-journal.js');
  assert.match(journal, /await import\(journalModuleURL\('\.\/carrot-ui-theme\.js'\)\)/);
  assert.match(journal, /attachCarrotUiTheme\(this,\{kind:'journal'/);
  const pay = read('carrot-charge-payment.js');
  assert.equal((pay.match(/dialog\.className='carrot-ui-dialog'/g) || []).length, 2);
});

test('설정은 카드 모서리 곡률을 바꾸지 않는다', () => {
  const src = read('carrot-ui-theme.js');
  const ha = src.slice(src.indexOf('const dashFollowCss'), src.indexOf('const journalFollowCss'));
  assert.doesNotMatch(ha, /border-radius/);
});

test('프리셋은 3개', () => assert.equal(_test.PRESETS.length, 3));
