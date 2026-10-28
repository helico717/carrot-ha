// 12V 보조 배터리 전압 상태 판정 (프리뷰 단계: 아직 운영 대시보드에 연결되지 않음).
// 2026-10-14~28 HA 기록 분석 결과를 기준으로 한 기본값이며 모두 조정 가능하다.
export const DEFAULT_CFG = Object.freeze({
  normalMin: 12.2,      // 주차 중 이 값 이상이면 정상
  warnBelow: 12.0,      // 이 값 미만이 계속되면 경고
  dcdcAbove: 13.0,      // 주차 상태라도 이 값 이상이면 DC-DC 동작 중 -> 판단 불가
  staleAfterMin: 10,    // 12V 측정이 이보다 오래되면 판단 불가
  warnSustainMin: 10,   // 경고는 저전압이 이 시간 이상 지속될 때만 (실측 일시 강하는 최대 4분)
  tempCoef: 0,          // 온도 보정 V/°C (0=끔). 기준 온도보다 따뜻하면 그만큼 빼서 비교한다.
  tempRefC: 20,         // 보정 기준 온도
});

// 시간대별 실측 참고 범위(주차, 측정 최신, 11.95V<V<13.0V). [시작h, 끝h, p5, 중앙값, p95]
export const RESTING_REFERENCE = Object.freeze([
  [0, 0.25, 12.12, 12.73, 12.98], [0.25, 1, 12.61, 12.81, 12.94],
  [1, 3, 12.33, 12.73, 12.85], [3, 6, 12.30, 12.58, 12.75],
  [6, 12, 12.28, 12.44, 12.58], [12, 18, 12.24, 12.38, 12.51],
  [18, 24, 12.18, 12.25, 12.38], [24, 36, 12.11, 12.19, 12.29],
]);

export function referenceFor(hours) {
  return RESTING_REFERENCE.find(([a, b]) => hours >= a && hours < b) || null;
}

// state: 대시보드 표시 상태 키(parked/charging/driving/stale/offline/...).
// ageMin: 12V 측정 후 경과 분. lowForMin: warnBelow 미만이 연속된 분.
// level: none(색 없음) | ok | caution | warn | unknown(회색)
// 온도 보정 적용 전압(표시·판정 공통). tempC가 없거나 보정 계수가 0이면 원본 그대로.
export function compensatedVoltage(raw, tempC, cfg = DEFAULT_CFG) {
  if (!Number.isFinite(raw)) return raw;
  return cfg.tempCoef && Number.isFinite(tempC) ? raw - cfg.tempCoef * (tempC - cfg.tempRefC) : raw;
}

export function judgeAuxVoltage({ state, voltage: rawIn, tempC, ageMin, lowForMin = 0 }, cfg = DEFAULT_CFG) {
  if (!Number.isFinite(rawIn)) return { level: 'unknown', reason: 'no-data' };
  const raw = compensatedVoltage(rawIn, tempC, cfg);
  // 대시보드는 소수 한 자리로 표시하므로 화면의 숫자와 색이 어긋나지 않게 같은 자릿수로 판정한다.
  const voltage = Math.round(raw * 10) / 10;
  if (state === 'driving' || state === 'charging') return { level: 'none', reason: 'active' };
  if (state !== 'parked') return { level: 'unknown', reason: 'state' };
  if (!Number.isFinite(ageMin) || ageMin > cfg.staleAfterMin) return { level: 'unknown', reason: 'stale' };
  if (voltage >= cfg.dcdcAbove) return { level: 'unknown', reason: 'dcdc' };
  if (voltage >= cfg.normalMin) return { level: 'ok', reason: 'ok' };
  if (voltage >= cfg.warnBelow) return { level: 'caution', reason: 'caution' };
  return lowForMin >= cfg.warnSustainMin
    ? { level: 'warn', reason: 'warn' }
    : { level: 'caution', reason: 'low-pending' };
}
