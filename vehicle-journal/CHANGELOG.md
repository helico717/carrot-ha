# 차계부 변경 이력

## 2026-10-09 — 미래 기간 차단 HA 반영 확인

- 커밋 제목: `vehicle-journal: record future period guard deployment`.
- 대상: `1f28d55` 미래 기간 차단. main 푸시·두 모듈 백업·HA 직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/1f28d55cf5dbee03b442528f5f6f191c08d088ae/`.
- 검증: 최종 실제 Chromium 회귀 통과. 설치/HA 로컬 HTTP SHA-256 카드 `0354271504849915606b7aef8d4d18131e1ec1efc8095c37e3032d81d95f3375`, 디자인 `acb24e4e0ec87d05fd9373a7dc9c6d16f7b8b935c025bf2cc7684a103944098e` 일치.
- 제한: 실제 사용자 접속 주소 운영 브라우저 적용은 미확인, 새로고침 후 확인 대기. HA 재시작·신규 릴리즈·Worker·Comma 변경 없음.

## 2026-10-09 — 날짜 선택기 미래 기간 선택 차단

- 커밋 제목: `vehicle-journal: prevent selecting future journal periods`.
- 변경·이유: HA 시간대의 현재 월/연도를 입력 max로 설정. 현재 기간의 다음 버튼 비활성화 및 비활성 스타일 적용. 직접 입력 또는 복원된 미래 값은 조회 전 현재 기간으로 보정. 이동 함수와 range 검증에서도 미래 값 거부. 기존 월/연도 범위 의미 유지.
- 관련 파일: `carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: JS 구문 및 실제 Chromium 회귀 통과. 월/연도 max·입력 rangeOverflow·현재 기간 다음 버튼 비활성화·직접 미래 입력 보정·이동 함수 우회 차단·월/연도 과거 이동 및 현재 복귀 확인. 기존 모바일/입력/금액/스크롤 회귀 유지. 최초 검사에서 Playwright fill이 change를 발생시켜 이미 보정된 값을 검사한 테스트 순서 문제를 수정한 뒤 통과.
- 배포: main 커밋·푸시 후 HA 두 모듈 백업 및 직접 반영 예정. 운영 브라우저 확인은 별도 상태로 기록. 신규 릴리즈·Worker·Comma 변경 없음.

## 2026-10-09 — 날짜 선택기 버튼 HA 반영 확인

- 커밋 제목: `vehicle-journal: record date navigation deployment`.
- 대상: `1ff8bd5` 날짜 이동/현재 기간 복귀. main 푸시 및 두 모듈 백업/HA 직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/1ff8bd5b84ef7ebb6692723917b7c0728d85c734/`.
- 검증: 최종 실제 Chromium 회귀 통과. 설치/HA 로컬 HTTP SHA-256 카드 `0fbff875399f35f88d391dbee8810b5b8aa2abae9cca6efd44a6491ea55f2e2a`, 디자인 `e39b537d8d5914783ee4bb2691a38fc7e6e615c18a36f9b91c59bb4945995a4d` 일치.
- 제한: 실제 사용자 접속 주소 운영 브라우저 적용은 미확인, 새로고침 후 확인 대기. HA 재시작·신규 릴리즈·Worker·Comma 변경 없음.

## 2026-10-09 — 날짜 선택기 이전·다음 및 현재 기간 복귀 버튼

- 커밋 제목: `vehicle-journal: add date navigation and current period buttons`.
- 변경·이유: 날짜 입력 왼쪽 이전/오른쪽 다음 버튼과 그 오른쪽 현재 범위 복귀 버튼 추가. 월별은 한 달씩 이동·‘이번 달’, 연도별은 한 해씩 이동·‘올해’. 현재 범위는 HA 설정 시간대 기준. 기존 입력과 선택 탭 유지, 기간 변경 시 상세 기록 페이지 초기화, 기존 오래된 응답 거부 경로 사용.
- 관련 파일: `carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: JS 구문 및 실제 Chromium 회귀 통과. 12월→1월/역방향·연도 이동·현재 월/연도 복귀·레이블·페이지 초기화·탭 유지 검증. 320–850px 모바일 가로 넘침 및 기존 입력/금액/스크롤 회귀 통과. 모바일 합성 화면 육안 확인.
- 배포: main 커밋·푸시 후 두 모듈 백업/HA 직접 반영 예정. 운영 화면 적용은 후속 상태로 구분. 신규 릴리즈·Worker·Comma 변경 없음.

## 2026-10-09 — 화폐 구분 쉼표 수정 HA 반영 확인

- 커밋 제목: `vehicle-journal: record grouped currency deployment`.
- 대상: `e6d122d` 화폐 표시·공통 지침. main 푸시 및 HA 코드 백업/직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/e6d122d1098494e7b1384aa5f561437153915634/`.
- 검증: 카드 설치 및 HA 로컬 HTTP SHA-256 `b4a4dc7a38b7e94952050a3299a1bb37a8e19b0f515c0eefbaab443c56671903` 일치. 배포 도구가 함께 반영한 디자인은 기존 해시와 동일. Node 10건 및 실제 Chromium 차계부 회귀 통과.
- 제한: 실제 사용자 접속 주소 운영 브라우저 적용은 미확인, 새로고침 후 확인 대기. HA 재시작·신규 릴리즈·Worker·Comma 변경 없음.

## 2026-10-09 — 모든 대시보드 화폐 천 단위 구분 규칙

- 커밋 제목: `vehicle-journal: enforce grouped currency labels across trends`.
- 변경·이유: 사용자 공통 규칙을 루트/차계부 AGENTS 및 `.agents/rules/vehicle-journal.md`에 명시. 모든 화면의 금액·단가·증감·비교·차트·툴팁은 세 자리마다 쉼표 표시. 계산/저장은 숫자 유지.
- 실행 변경: 차계부 추세 이전 기간 비교 금액, 과거/현재 그래프 수치, 막대 SVG 툴팁에서 누락된 천 단위 쉼표 적용. 기존 변화량·요약·원장·도넛·절약 비교는 이미 locale 포매터 사용. 한국어/영어/디버그 차량 대시보드와 결제 창도 기존 locale 금액 표시를 확인해 불필요한 실행 코드 변경 없음.
- 관련 파일: `AGENTS.md`, `vehicle-journal/AGENTS.md`, `.agents/rules/vehicle-journal.md`, `carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`, `tests/dashboard-calculation-regressions.test.mjs`, 이 변경 이력.
- 검증: 차량 계산/표시 Node 10건 통과(한국어/영어 충전 금액 1,234,567 및 단가 123,457 포함). 실제 Chromium 차계부 회귀 통과(월/연도 금액 라벨/툴팁/비교, 기존 모바일/입력/스크롤). git diff whitespace 검사 통과.
- 배포: 커밋·main 푸시 후 HA 직접 반영 예정. 설치/HTTP 및 운영 브라우저 적용은 후속 기록. 디버깅 정책에 따라 신규 릴리즈 없음. Worker/Comma 변경 없음.

## 2026-10-09 — 추세 제목·비교 문구 HA 반영 확인

- 커밋 제목: `vehicle-journal: record simplified trend deployment`.
- 대상: `4ea12c3` 승인 제목과 부가 설명 제거. 최종 Chromium 검증 통과 및 main 푸시 완료.
- 배포: 기존 코드 백업 후 카드 반영 완료. 배포 도구가 디자인 모듈도 동일 커밋에서 다시 반영했으며 디자인은 이전과 동일. 백업 `/config/carrot_ha/deployment-backups/4ea12c389f8db865fd5db59f491ff5a1a4811ed8/`.
- 검증: 카드 설치/HA 로컬 HTTP SHA-256 `1f21361eec7774ad22e727eb780983747aa87ecc36c22252541d9024da1b7d71` 일치. 디자인 기존 해시 `dcdd3ddb97b1dad4420ace5004dd489c6d60cad5c8aa0211d55f40739d5a4705` 일치.
- 제한: 실제 사용자 접속 주소 운영 브라우저 적용은 미확인, 새로고침 후 확인 대기. HA 재시작·신규 릴리즈·Worker·Comma 변경 없음.

## 2026-10-09 — 승인된 추세 제목 및 비교 문구 간소화

- 커밋 제목: `vehicle-journal: clarify metric titles and simplify trend summaries`.
- 변경·이유: 사용자 승인 제목 적용. ‘평균 전비’와 ‘kWh당 충전 단가’는 유지. 하루 평균·주행 사용률·급속 충전 분모·100km 비용/배터리 비율·1회 평균 충전량 명시. 총 지출/충전 횟수/분류별 지출은 선택한 달 또는 연도를 제목에 명시.
- 셋째 줄: 기록일 기준 평균, 추정 계산식, 실제·추정 포함, 누적 지출, SOC 기록 범위 등 모든 부가 설명 제거. 비교 수치·변화량 및 일관/수집 상태만 유지. 계산과 데이터는 변경하지 않음.
- 관련 파일: `carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: JS 구문 및 실제 Chromium 회귀 통과. 승인 제목과 유지 대상 두 제목, 부가 설명 제거, 비교 문장, 월/연도·입력·스크롤·모바일 320–850px 확인.
- 배포: main 커밋·푸시 후 코드 백업 및 HA 카드 모듈 직접 반영 예정. 설치/HTTP/운영 브라우저 상태는 후속 기록. 신규 릴리즈·Worker·Comma 변경 없음.

## 2026-10-09 — 글자 크기 교환 및 테마 강조 HA 반영 확인

- 커밋 제목: `vehicle-journal: record trend typography deployment`.
- 대상: `1e6e2a0` 문구·강조 및 `2e63285` 원래 크기 교환. 최종 두 화면 모듈을 `2e632858cfb8ef928181b26fbcb307c11a82889c`에서 추출해 배포.
- 검증: 최종 Chromium 회귀 통과. 설치 파일 및 HA 로컬 HTTP 응답 SHA-256 모두 커밋 코드와 일치. 카드 `3618001cb4a22f91bb3b73eb66cbff780810e12f78c001501b1c5cd633aa160e`, 디자인 `dcdd3ddb97b1dad4420ace5004dd489c6d60cad5c8aa0211d55f40739d5a4705`.
- 배포: main 푸시·기존 코드 백업·두 모듈 HA 직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/2e632858cfb8ef928181b26fbcb307c11a82889c/`. 실제 사용자 접속 주소의 운영 브라우저 적용은 미확인으로 사용자 새로고침 후 확인 대기. HA 재시작은 실행하지 않음.
- 제한: 카드 제목 명칭은 사용자 검토 후 변경. 신규 릴리즈·Worker·Comma 변경 없음. 운영 브라우저 적용 완료를 주장하지 않음.

## 2026-10-09 — 기존 첫째·둘째 줄 글자 크기를 정확히 교환

- 커밋 제목: `vehicle-journal: swap original trend title and headline sizes`.
- 변경·이유: 사용자 추가 요청에 따라 원래 크기를 그대로 교환. 데스크톱 첫째 줄 19.5px/둘째 줄 16.5px, 모바일 첫째 줄 16.5px/둘째 줄 14.5px. `1e6e2a0`의 확대 수치를 대체하며 문구·테마 색상 강조 유지.
- 관련 파일: `carrot-journal-design.js`, 이 변경 이력.
- 검증: 실제 Chromium 회귀 재실행 예정. 배포: 두 변경을 합쳐 최종 커밋 코드만 백업 후 HA 직접 반영 예정. 운영 브라우저 확인은 별도 기록. 제목 명칭은 사전 검토 대기.

## 2026-10-09 — 추세 카드 제목 위계 및 변화 단어 강조

- 커밋 제목: `vehicle-journal: clarify trend text hierarchy and direction emphasis`.
- 변경·이유: 첫 줄 지표 제목을 둘째 줄보다 크게 표시(데스크톱 21.5/17.5px, 모바일 18.5/15.5px). 둘째 줄 증가·감소·일관 단어에 카드 테마 색상과 굵기를 적용. ‘안정적인 패턴이에요’를 ‘일관된 추세예요’로 변경.
- 범위: 카드 제목 명칭 변경은 사용자 사전 검토 대상으로 남기며 이번 수정에는 포함하지 않음. 계산·집계 유지.
- 관련 파일: `carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: JS 두 모듈 구문 및 실제 Chromium 회귀 통과. 월/연도 비교, 증가·감소·일관 강조 색상, 데스크톱/모바일 글자 위계, 320–850px 레이아웃, 입력·escaping·스크롤 검증 포함.
- 배포: main 커밋·푸시 및 두 모듈 백업 후 HA 직접 반영 예정. 설치/HTTP/운영 브라우저 확인 상태는 후속 기록으로 구분. 신규 릴리즈·Worker·Comma 변경 없음.

## 2026-10-07 — 추가 추이 및 모바일 한 열 운영 검증 완료

- 커밋 제목: `vehicle-journal: record new trends and mobile deployment`.
- 대상: `209359b` 추가 지표·관측일 평균·600px 모바일 한 열, `7bd6278` 표시 상태 테스트, `82afccd` 청구량 fallback.
- 검증: 실제 Chromium 전체 회귀 통과, 운영 Chrome 12개 카드(현재 지출 분류 1개), 추정 비용 막대 3개 확인. 440px 운영 viewport에서 두 grid 모두 단일 384px 열 확인, 테스트 520/360/320px 한 열·가로 넘침 검사 통과. 임시 viewport 원복.
- 배포: main 푸시, HA 두 모듈 백업/부분 반영 및 최종 카드 재배포 완료. 백업 `/config/carrot_ha/deployment-backups/209359b/`, `/config/carrot_ha/deployment-backups/82afccd/`. 설치/외부 HTTP 커밋 파일 일치. 버전 `0.8.13-bc9b01c12e01`. 카드 SHA-256 `ef7d38f76491baa8f86bbb081eb5b31365df2a41959564ac16089e0c82134f4f`, 디자인 `f39ddd5ee785aa587b1a236968c6d72aff83e430443648343f826f330892a1b1`.
- HA 재시작 및 신규 릴리즈 없음. Worker/Comma 변경 없음. iOS 앱의 실제 갱신은 사용자 새로고침 후 확인 필요.

## 2026-10-07 — 추정 비용 막대의 충전량 대체 경로 수정

- 커밋 제목: `vehicle-journal: use battery charge when billed energy is absent`.
- 이유: 운영 확인에서 합산 bin의 청구량 기본값 0이 배터리 충전량 fallback을 막아 추정 비용 막대가 사라짐. 양수 청구량이 있을 때만 우선 사용하고 나머지는 배터리 충전량 사용.
- 관련 파일: `carrot-vehicle-journal.js`, 이 변경 이력. 회귀 및 재배포 결과는 후속 기록.

## 2026-10-07 — 모바일 추이 열 수 테스트의 표시 상태 수정

- 커밋 제목: `vehicle-journal: inspect mobile columns while trends are visible`.
- 이유·관련 파일: `browser-check.cjs`가 숨겨진 추이 탭의 grid 폭을 검사해 520px에서 잘못 실패. 탭을 먼저 열고 실제 열 수 검사. 구현 `209359b`의 기본 계산 회귀는 통과했고 새 열 수 검사만 이 원인으로 실패했으며, 수정 후 재실행 결과와 배포를 후속 기록.

## 2026-10-07 — 비용·충전 패턴·거리당 배터리 소모 추이 추가

- 커밋 제목: `vehicle-journal: add spending and charging pattern trends`.
- 변경·이유: 주차 중 배터리 소모는 수집 불가로 제외. 100km당 전기비용(추정), 월/연간 총 차량 지출, 기록된 분류별 지출, 충전 횟수, 회당 충전량, 100km당 주행 SOC 소모 카드 추가. 기존 HA 로컬 daily/totals 재사용으로 별도 요청·엔터티·DB 변경 없음.
- 계산: 전기비용은 기간 충전비/청구량(없으면 배터리 충전량)/전비×100; 충전 횟수는 완속·급속·미확인 합계; 회당 충전량은 배터리 충전량/횟수; 거리당 SOC는 주행 SOC/거리×100. 총/분류별 지출은 effective 비용 합계로 실제·추정 포함 문구와 누적 기간 표시. 비용 카드 평균선은 합계로 명명.
- 평균 개선: 기존 일일 거리·충전·SOC를 전체 월 일수가 아닌 해당 값의 기록일 수로 계산하고 관측일 평균이라고 표시. 이전 기간도 동일 기준. 비교 데이터 없으면 추세 단정 대신 수집 중 표시, 계산 불가면 0 평균 대신 미표시. 새 지표 미관측 구간의 막대 생략. 기존 막대의 미관측 0 처리는 후속 개선 대상.
- 관련 파일: `carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: JS 구문, 실제 Chromium 월/연도·기존 6개+추가 7개(합성 지출 2분류) 카드·금액/횟수/거리당 SOC 계산·모바일·스크롤·수동 기록 회귀. 배포는 main 푸시 및 백업 후 HA 카드만 부분 반영 예정, 실제 결과 후속 기록.
- 제한: SOC 기록 범위가 불완전하면 거리당 SOC가 실제 전체 주행과 다를 수 있어 설명 표시. 진행 중 기간 총액과 이전 전체 기간 비교는 일수 보정하지 않음. 주차 소모·Worker/Comma 변경·신규 릴리즈 없음.
- 모바일 수정: 기존 420px 이하 한 열 기준으로 440px 휴대폰 등이 두 열로 남던 문제를 600px 이하 한 열로 확대. `carrot-journal-design.js` 포함. 실제 grid 열 수 회귀 추가.

## 2026-10-07 — 평균선 및 실제 단위 변경 운영 적용 확인

- 커밋 제목: `vehicle-journal: record average chart and metric unit deployment`.
- 대상: 평균선/여백/글꼴 및 % 접미사 변경 `6aaf7c4`, 실제 단위 변화량 `a40d67c`.
- 검증: 두 변경 Chromium 회귀 통과. 설치 및 외부 HTTP 응답이 커밋 파일과 일치. 운영 Chrome에서 6개 추이, km/kWh/원/% 변화량, p 제거, 평균값 글꼴 16px 및 라벨 높이에 추가 8px 이격, 굵어진 평균선을 확인.
- 배포: main 푸시 및 HA 직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/6aaf7c4/`, `/config/carrot_ha/deployment-backups/a40d67c/`. 최종 버전 API `0.8.13-e2d8cc5b72ce`. 카드 SHA-256 `99ea699ab17cb3a82a2c84c1d98dc7139e26b9e613cb039c1e7657f947616df0`, 디자인 `49d53f7d176afdeda5a073fe1063cd6945d664860f3ea7d1df2fcfc6e5f95972`.
- HA 재시작·신규 릴리즈·Worker/Comma 변경 없음. 기존 추이 집계의 부분 월 평균 및 미관측 0 표시 한계는 유지되며 후속 계산 개선 대상으로 남음.

## 2026-10-07 — 추이 변화량을 지표의 실제 단위로 표시

- 커밋 제목: `vehicle-journal: show trend changes in metric units`.
- 변경·이유: 상대 퍼센트 대신 이전/현재 평균의 실제 차이를 표시. 거리 km, 충전 kWh, 전비 km/kWh, 단가 원, SOC/급속 비중 % 사용. 원은 정수, 나머지는 소수 한 자리 이내와 천 단위 구분. 카드 색상 강조 유지. 변동 분류 기준(상대 차이 5%)은 유지.
- 관련 파일: `carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증·배포: Chromium 회귀 후 main 푸시 및 기존 코드 백업 후 HA 부분 반영 예정. 실제 결과는 후속 기록.
- 제한: SOC/급속 비중 변화는 두 비율의 산술 차이이며 요청에 따라 p 접미사 생략. 집계 계산은 변경하지 않음. Worker/Comma 변경 없음.

## 2026-10-07 — 추이 평균선과 수치 간격 개선

- 커밋 제목: `vehicle-journal: improve average line spacing and labels`.
- 변경·이유: 사용자 요청으로 SOC 추이 표시 단위를 `%p`에서 `%`로 변경(계산값 유지). 모든 추이 평균값 라벨을 선 중심에서 8px 추가 이격하고 차트 위 24px 공간 확보. 평균선은 이전 3.5px/현재 및 단일 4px로 확대. 수치 글꼴은 데스크톱 16px, 모바일 14.5px로 확대하고 그래프 높이 10px 증가.
- 관련 파일: `carrot-vehicle-journal.js`, `carrot-journal-design.js`, 이 변경 이력.
- 검증·배포: JS 구문 및 Chromium 회귀 검증 후 main 푸시, 백업 후 두 모듈만 HA 직접 반영 예정. 실제 결과는 후속 기록. 신규 릴리즈 없음.
- 제한: 단위 표기 변경이며 SOC 소모량 계산 변경 없음. Worker/Comma 변경 없음.

## 2026-10-07 — 글꼴 확대 및 추이 변화율 색상 강조

- 구현 커밋: `98c7ebf`, `vehicle-journal: improve text readability and highlight trend changes`. 변경 이력 작성 명령이 Python 별칭의 인코딩 오류로 실패하여 바로 이 후속 기록으로 보완.
- 변경·이유: 차계부 디자인의 26px 이하 명시 글꼴을 1.5px 확대. 비교 설명의 변화율과 상승/감소를 해당 지표 색상과 굵은 글씨로 강조하며 텍스트 escaping 유지. 420px 이하 화면은 추이 카드를 한 열로 배치.
- 관련 파일: `carrot-journal-design.js`, `carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: 두 JS 구문 검사 및 실제 Chromium browser-check 통과. 월/연도 6개 지표, 비교 유무, 색상 일치, 빈 데이터, 수동 저장, HTML escaping, 320–850px 모바일 가로 넘침 확인.
- 배포: `98c7ebf` main 푸시 및 두 화면 모듈 HA 직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/98c7ebf/`. 설치·외부 HTTP SHA-256 일치: 카드 `2ca7177220d1ed19e9b2df1bd4950419269830c6ed18252ad893aab1a13e7ed8`, 디자인 `9f1f54ab16264253f99c9ed454fe7d63185ce124ef556a70bab7cd4fd4083d18`. 버전 API `0.8.13-53d7337406eb`. 실제 사용자 접속 Chrome 새로고침 후 6개 카드와 설명 15.5px, 변화율 5개 지표 색상 일치 및 시각적 강조 확인. HA 재시작 불필요. 개발 정책에 따라 신규 릴리즈 없음.
- 운영 확인 기록 커밋 제목: `vehicle-journal: record deployed readability verification`. 이 항목의 배포 예정 상태를 실제 결과로 갱신.
- 제한: 표시만 변경하며 기존 집계·데이터 보존 유지. Worker/Comma 변경 없음.

## 2026-10-07 — 패널 런타임 상태 복원 null 참조 버그 수정 (metric/period null value 예외 해소)

- 커밋 제목: `fix(vehicle-journal): guard against null metric and period select elements during state restoration in panel runtime`.
- 변경 내용 및 이유:
  1. **패널 런타임(`carrot-journal-panel-runtime.js`) 상태 복원 시 `null` 프로퍼티 할당 예외 해결**:
     - 사용자가 화면 새로고침 또는 '새 화면 버전 적용'을 실행할 때 `sessionStorage`에 보관된 마지막 상태(`saved`)를 복원하는 과정에서, 구형 `page1` 차트에 존재했던 `#metric` 및 `#period` select 요소를 `card.$('metric').value = saved.metric;`으로 직접 설정하려다 `TypeError: Cannot set properties of null (setting 'value')`가 발생하며 패널 마운트 전체가 중단되던 버그 수정.
     - `card.$('metric')` 및 `card.$('period')`에 안전한 존재 유무 검사(`if(card.$('...'))`) 및 `card.$('month')?.value` 옵셔널 체이닝을 추가하여 예외 발생을 원천 차단.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-panel-runtime.js`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포 상태:
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee`로 직접 배포 완료 및 `carrot-journal-panel-runtime.js` SHA-256 해시(`af7541eb...`) 일치 확인 완료.
  - HTTP 정적 서빙 엔드포인트(`http://192.168.0.140:8123/carrot_ha_static/...`) 최신 수정본 응답 확인 완료.

## 2026-10-07 — 추세 탭 렌더링 중단 버그 수정 (레거시 에너지 통계 null 참조 해소)

- 커밋 제목: `fix(vehicle-journal): resolve null reference error on legacy energyStats and restore trends dashboard rendering`.
- 변경 내용 및 이유:
  1. **레거시 DOM 노드(`energyStats`, `qualityNote`) null 참조 예외 해결**:
     - 기존 `page1` 차트에 존재하던 `#energyStats` 및 `#qualityNote` 요소가 새 Apple Health 추세 대시보드로 개편되면서 제거되었으나, `renderData()` 내에서 해당 요소의 `.innerHTML`에 직접 접근하던 코드가 남아있어 `TypeError: Cannot set properties of null (setting 'innerHTML')` 예외가 발생하던 문제를 해결.
     - 해당 예외로 인해 `renderData()`의 후속 실행인 `this.renderTrendsDashboard()` 호출이 차단되고 `#message`에 에러가 출력되던 현상을 원천 차단.
  2. **추세 지표 생성(`createMetric`) 및 차트 렌더러 안전성 강화**:
     - 지표 값이 0인 경우(예: 급속 충전 0%) 및 이전 기간 데이터가 없는 경우 `NaN` 또는 `Infinity`가 발생하지 않도록 유효성 검사 강화.
     - `maxVal` 계산 시 기본 최솟값 1을 보장하여 0으로 나누기 오류 완전 차단.
  3. 캐시 버스팅 파라미터(`journal-20261007-trends-fix-1`) 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포 상태:
  - Python 유닛 테스트 310개 전수 통과 (`OK, skipped=4`).
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee`로 직접 배포 완료 및 `carrot-vehicle-journal.js` SHA-256 해시(`14bf2333...`) 일치 확인 완료.
  - HTTP 정적 서빙 엔드포인트(`http://192.168.0.140:8123/carrot_ha_static/...`) 최신 수정본 응답 확인 완료.

## 2026-10-07 — 주행&에너지 탭 '추세' 개편, Apple Health 스타일 2열 추세 대시보드 및 폰트 왜곡 해소

- 커밋 제목: `feat(vehicle-journal): revamp trends tab with Apple Health style 2-column dashboard and fix text distortion`.
- 변경 내용 및 이유:
  1. **탭 명칭 및 용어 개편 (`주행 & 에너지` ➔ `추세`, '추이' ➔ '추세')**:
     - 상단 네비게이션 2번째 탭 명칭을 `주행 & 에너지`에서 **`추세`**로 변경 (`['대시보드', '추세', '절약 비교', '상세 기록']`).
     - 지출 비교 문구, 차트 라벨, 툴팁, 설명문 등 UI 전반에서 사용되던 용어 '추이'를 전부 **`추세`**로 통일.
  2. **Apple Health 공식 추세(Trends) 대시보드 완벽 재현**:
     - 상단 헤더: `추세` 타이틀 & 안내 문구 (`주행 및 충전 데이터의 패턴을 분석하고, 변동 사항이 있을 때 알려드려요.`).
     - **섹션 1: 변동 있는 추세**: 최근 기간 기준 ±5% 이상 유의미한 변동이 감지된 항목 배치 (없으면 `최근 감지된 유의미한 변동이 없어요.` 배너 노출).
     - **섹션 2: 변동 없는 추세**: 안정적인 패턴을 유지 중인 항목 배치.
     - **Apple 공식 3가지 추세 시각화 패턴 정밀 구현**:
       * **증가 추세 (`up`)**: 과거 회색 기준선(좌측) vs 최근 컬러 기준선(우측 상단 상승 스텝) + 헤드라인 `... 동안 증가 추세`.
       * **감소 추세 (`down`)**: 과거 회색 기준선(좌측) vs 최근 컬러 기준선(우측 하단 하강 스텝) + 헤드라인 `... 동안 감소 추세`.
       * **일관된 추세 (`consistent`)**: 전체 기간을 관통하는 단일 컬러 기준선 + 헤드라인 `... 동안 일관된 추세`.
  3. **2열 그리드 및 2대 예외 레이아웃 규칙 구현**:
     - 기본 2열 카드 그리드 레이아웃 (`repeat(2, minmax(0, 1fr))`).
     - **[예외 1]** 변동 있는 추세 항목이 1개일 경우: 2열이 아닌 1열(전폭 100%)로 표시 (`.trends-grid.single-item`).
     - **[예외 2]** 2열 배열에서 홀수로 인해 최하단에 혼자 남은 카드: 1열(전폭 100%)로 자동 확장 (`:last-child:nth-child(odd)`).
  4. **바(Bar) 그래프 집계 단위 사용자 맞춤 사양 적용**:
     - **월별 (`month`)**: 31일을 2일씩 묶은 평균값(16개 바)으로 표시하여 가독성 극대화 + X축 `1일` / `31일`.
     - **연도별 (`year`)**: 1년 12개월을 각 달 단위(12개 바)로 표시 + X축 `1월` / `12월`.
  5. **핵심 6대 지표 선정 (팬텀 드레인 완전 배제)**:
     - ⚡ 평균 전비 (`efficiency`, km/kWh, #81e6c5)
     - 🚗 일일 주행거리 (`distance`, km, #ff9f0a)
     - 🔌 일일 충전량 (`charge_kwh`, kWh, #30b0c7)
     - 💳 kWh당 충전 단가 (`charge_rate`, 원, #ffd60a)
     - 🔋 주행 소모 SOC (`drive_soc`, %p, #af52de)
     - ⚡ 급속 충전 비중 (`fast_ratio`, %, #ff453a)
     - 실측 불가능한 '주차 중 대기 방전(팬텀 드레인)'은 사용자 지침에 따라 완전히 배제.
  6. **데스크톱/모바일 텍스트 눌림/왜곡 100% 해소**:
     - SVG `<text>`의 비율 찌그러짐 문제를 해결하기 위해, SVG는 순수 그래픽(바, 기준선)만 렌더링하고 모든 수치와 축 라벨은 HTML 네이티브 레이어로 오버레이 분리하여 모든 해상도에서 폰트 선명도 보장.
  7. 프로토타입 HTML(`review_journal_spending.html`) 및 컴포넌트(`carrot-vehicle-journal.js`, `carrot-journal-design.js`) 동기화 및 캐시 버스팅 파라미터(`journal-20261007-trends-dashboard-1`) 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`
  - `review_journal_spending.html`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포 상태:
  - Headless Chrome을 통해 모바일(402px) 및 데스크톱(1400px) 추세 탭, 2열 레이아웃, 예외 규칙, 글자 눌림 해소 렌더링 검증 완료.
  - Python 유닛 테스트 310개 전수 통과 (`OK, skipped=4`).
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee`로 직접 배포 완료 및 2개 파일(`carrot-vehicle-journal.js`, `carrot-journal-design.js`) SHA-256 해시 일치 확인 완료.

## 2026-10-07 — 상세 기록 사진 썸네일 프리뷰, 라이트박스 확대 뷰어 및 관리 열 액션 버튼 배열

- 커밋 제목: `feat(vehicle-journal): add photo thumbnail preview, lightbox viewer and rearrange action buttons in records table`.
- 변경 내용 및 이유:
  1. **기록 / 메모 셀 우측 썸네일 프리뷰(`memo-thumb-btn`)**:
     - 사용자가 어떤 기록이었는지 빠르게 식별할 수 있도록, 사진이 첨부된 기록의 `기록 / 메모` 셀 우측에 작은 썸네일(44x44px)을 우측 정렬하여 표시.
     - 사진이 2장 이상인 경우 썸네일 우측 하단에 `+N` 배지를 달아 여러 장의 사진이 있음을 직관적으로 안내.
     - 중복 요청을 방지하기 위해 `this.thumbnailCache`(Map) 및 `disconnectedCallback` 시 blob URL 해제(`URL.revokeObjectURL`) 최적화 적용.
  2. **사진 확대 라이트박스 뷰어 (`dialog#photoViewerDialog`) 구현**:
     - 썸네일 또는 관리 열의 `[사진 N장]` 버튼을 누르면 사진을 크게 감상할 수 있는 라이트박스 모달 다이얼로그 노출.
     - 2장 이상의 사진이 있는 경우 좌/우 넘기기 버튼(`‹`, `›`)과 키보드 좌/우 방향키(`ArrowLeft`, `ArrowRight`)로 탐색 지원.
     - 현재 인덱스(예: `사진 (1 / 2)`), 메타 정보, 기록 메모를 하단 캡션으로 상세히 표시.
     - 모달 바깥 영역 클릭 또는 `[닫기]` 버튼, ESC 키를 통한 편리한 닫기 지원.
  3. **테이블 열 배치 및 관리 액션 버튼 정렬 순서 개편**:
     - 기존 `거리·충전·금액` 열에 섞여 있던 사진 버튼을 제거하여 순수한 수치/금액만 정렬되도록 정리.
     - 관리 열로 사진 버튼을 이동하여 사용자가 명시한 **`[사진 ~장]`, `[수정]`, `[삭제]`** 순서로 정확하게 배열.
     - 버튼 스타일도 `.btn-table-action`, `.btn-photo`를 통해 줄바꿈 없이 한 줄로 단정하게 표시.
  4. 프로토타입 HTML(`review_journal_spending.html`) 동일 마크업/스타일/인터랙션 동기화 및 캐시 버스팅 파라미터(`journal-20261007-photo-viewer-1`) 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`
  - `review_journal_spending.html`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포 상태:
  - Headless Chrome을 통해 모바일(402px) 및 데스크톱(1400px) 상세 기록 탭 썸네일/버튼 렌더링 검증 완료.
  - 라이트박스 뷰어 모달(사진 확대, 네비게이션 버튼, 캡션) 렌더링 검증 완료.
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee`로 직접 배포 완료 및 2개 파일(`carrot-vehicle-journal.js`, `carrot-journal-design.js`) SHA-256 해시 일치 확인 완료.

## 2026-10-07 — 모바일 탭 균등 분할, 최근 기록 카드 높이 고정, 도넛 시인성 및 상세 기록보기 버튼 정렬

- 커밋 제목: `fix(vehicle-journal): enhance mobile tabs layout, fix recent panel overflow, improve donut visibility and align hero action button`.
- 변경 내용 및 이유:
  1. **모바일 최근 기록 카드(`recent-panel`) 무한 세로 확장 해결**:
     - `@media(max-width:600px)` 미디어쿼리에서 `height: auto;`로 인해 카드가 자식 항목 수만큼 세로로 무한히 길어지던 문제를 해결하고, 모바일에서도 `height: 270px; display: flex; flex-direction: column;`로 적절한 높이를 유지하도록 수정.
     - 내부 `.recent-list-wrap`의 `flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;`를 통해 약 3~4건이 노출되고 부드러운 터치 스크롤로 이번 달 전체 목록을 훑어볼 수 있도록 복원.
  2. **모바일 상단 네비게이션 탭(`tabs`) 4개 25% 균등 분할 및 정렬 정상화**:
     - 레거시 인라인/미디어쿼리의 `flex: 0 0 auto; min-width: 72px/90px/140px;` 잔재를 완전히 제거.
     - `.tabs`에 `display: flex; width: 100%; box-sizing: border-box; padding: 4px; gap: 4px;`, `.tabs button`에 `flex: 1 1 0px; min-width: 0; font-size: 12.5px; padding: 8px 2px; text-align: center;`를 적용하여 4개 탭(`대시보드`, `주행 & 에너지`, `절약 비교`, `상세 기록`)이 모바일 화면 폭을 1/4(25%)씩 가로 스크롤이나 여백 없이 꽉 채우도록 완벽 수정.
  3. **'어디에 썼을까요?' 도넛 차트 및 카테고리 목록 폰트 크기 확대 및 시인성 대폭 개선**:
     - 도넛 차트 SVG 중앙 라벨: `font-size: 13px, font-weight: 600`, 중앙 금액: `font-size: 18.5px, font-weight: 850, fill: #ffffff`로 굵고 선명하게 확대.
     - 도넛 SVG 크기 모바일 120px -> 132px (데스크톱 146px)로 확대.
     - 오른쪽 카테고리 목록: 카테고리명 `font-size: 15px; font-weight: 600;`, 색상 도트 `9px`, 금액 `font-size: 16px; font-weight: 750; color: #ffffff;`로 시인성 확보.
  4. **영웅 카드 '상세 기록보기' 버튼 위치 및 수직 기준선 정렬**:
     - 모바일에서 위의 통계 수치(`233.7 kWh`)와 너무 붙어있던 문제를 `.hero-btn-wrap`에 `padding-top: 18px; margin-top: 14px;` (데스크톱 `padding-top: 22px; margin-top: auto;`)를 적용하여 넉넉하고 시원한 상하 간격 유지.
     - 버튼 클래스 `.btn-hero-action`에 `margin: 0; box-sizing: border-box;`를 부여하고, 영웅 카드의 헤드라인(`10월 달에는`) 및 통계 텍스트(`이번달 충전량`)가 시작하는 좌측 수직 기준선(0px)과 1px의 오차 없이 완벽히 일치시켜 통일감 확보.
  5. 프로토타입 HTML(`review_journal_spending.html`) 동일 스타일 동기화 및 캐시 버스팅 파라미터(`journal-20261007-mobile-align-1`) 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `review_journal_spending.html`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포 상태:
  - Headless Chrome 뷰포트(402x1400 및 1280x900) 렌더링 검증 완료.
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee`로 직접 배포 완료 및 2개 파일(`carrot-journal-design.js`, `carrot-vehicle-journal.js`) SHA-256 해시 일치 확인 완료.
  - HTTP 정적 서빙 엔드포인트(`http://192.168.0.140:8123/carrot_ha_static/...`) 최신 버전(`journal-20261007-mobile-align-1`) 응답 검증 완료.

## 2026-10-07 — 고정 로더의 main 및 HA 배포 확인

- 커밋 제목: `vehicle-journal: record stable loader HA deployment and initial restart requirement`.
- 구현 커밋 `65c73ebc3ce9e47910dd870e163524cacb75c4bb`의 원격 main 반영 확인.
  해당 커밋에서 추출한 runtime/카드/패널 3개를 순서대로 HA에 직접 반영했다.
- 기존 파일 백업: `/config/carrot_ha/deployment-backups/65c73ebc3ce9e47910dd870e163524cacb75c4bb/`.
  새 runtime은 기존 파일 부재 마커를 남겼다. DB·사진·설정은 배포/백업 대상이 아니다.
- 설치 SHA-256 및 사용자 외부 HA HTTP 응답이 커밋과 모두 일치:
  - panel: `d77bcf6dc8c96a4bfceadb46c952cb5aabc6a1e0509d23b794c59ac3700294fd`
  - runtime: `b130a5ecefd09d7159d5743ebdeb4a3c07fc56cdddb02cc9764f699274b9e7f0`
  - card: `6afffa093447fecd900c1cb7eff45147656ad29bec3010ee389719dc6fc46bb2`
- 버전 API 응답 `0.8.13-b05e079cc9b3` 확인. 서버 배포는 완료했지만 기존 운영
  브라우저의 패널 등록 URL은 HA 시작 시 값이므로 **사용자 HA 재시작 1회 및
  새로고침 이후 실제 전환 확인은 대기**다. 에이전트가 재시작하지 않았다.
- 새 로더/업데이트/복원 동작의 합성 Chrome 및 기존 UI·사진 회귀는 통과했다.
  향후 JS 화면 모듈 변경은 재시작 없이 갱신 가능하다. 사용자 요청에 따라 임시
  디버깅 버튼/모니터/뷰 저장은 수정·실사용 검증 완료 후 제거하며 고정 로더는 유지한다.
- 관련 파일: CHANGELOG.md 및 deployment.md 현재 인계 상태. 문서만 추가 수정했고
  main 커밋·푸시한다. 새 릴리즈·Cloudflare·Comma 변경/배포 없음.

## 2026-10-07 — 고정 로더 및 임시 화면 업데이트 버튼

- 커밋 제목: `vehicle-journal: load current frontend modules without HA restarts`.
- 변경·이유: 시작 시 고정된 패널 URL이 이전 모듈을 계속 사용하는 문제를 해결한다.
  패널은 고정 로더로 유지하고 마운트 시 no-store 로컬 버전 API를 조회하여 최신
  runtime/카드/디자인/뷰 도우미 전체에 동일한 파일 해시 버전을 전달한다.
- 열린 패널은 표시 중 60초마다 및 visibility 복귀 때 버전을 확인한다. 변경이 있으면
  임시 ‘새 화면 버전 적용’ 버튼을 표시하며 자동으로 페이지를 재로딩하지 않는다.
  대화상자·사진·미저장 비교 입력·진행 중 쓰기가 있으면 갱신을 차단한다.
- 적용 버튼은 기간/차량/탭/페이지/추이 설정/비교 분류/스크롤만 탭별 sessionStorage에
  보관하고 새 문서 API 렌더 후 animation frame 두 번을 거쳐 복원한다. 2분 유효,
  같은 경로로 제한하며 읽은 즉시 삭제한다. 기록·메모·사진·토큰 저장 없음.
- 사용자 추가 지시: 버튼은 **디버깅용 임시 기능**이다. 수정·실사용 검증이 끝나면
  버튼/배너/주기 버전 확인/visibility 리스너/뷰 복원 저장을 제거한다. 고정 로더와
  최신 버전 모듈 로딩은 유지한다. AGENTS 및 deployment에 제거 범위를 명시했다.
- 카드의 비교 입력이 백그라운드 렌더로 덮어써지지 않도록 보호하고, 기록 창을
  닫아 취소하면 선택 사진을 정리한다. 저장/상태변경 등 진행 중 쓰기도 갱신을 막는다.
- 관련 파일: frontend/carrot-journal-panel.js, carrot-journal-panel-runtime.js,
  carrot-vehicle-journal.js; vehicle-journal/AGENTS.md, deployment.md, CHANGELOG.md;
  .agents/rules/vehicle-journal.md; tests/loader-update.cjs, browser-check.cjs,
  photo-selection.cjs. frontend 경로는 custom_components/carrot_ha/frontend/ 아래다.
- 검증: Python 차계부 14개 및 schema 9개 통과. Chrome 최신 모듈 체인/초기 hass 전달/
  입력 보호/재로딩 선택·스크롤 복원/임시 저장 제거 통과. 사진 선택·압축·저장·수정
  회귀 및 기존 UI/탭/차트/수동 저장/escaping/데스크톱·모바일 검증 통과.
  browser-check의 이미 제거된 day scope 버튼 검증을 정리했으며 비동기 패널 초기
  속성 검증은 실제 import를 사용하는 loader-update로 이동했다. JS 문법/diff 확인.
- 배포 상태: 검증 후 main 커밋·푸시 및 승인된 HA 직접 배포 대상. 최초 로더 전환은
  사용자 HA 재시작 1회가 필요하며 운영 브라우저의 전환 후 검증은 대기한다.
  이후 화면 모듈은 HA 재시작 없이 새로고침/임시 적용 버튼으로 갱신한다. Python
  또는 고정 로더 자체 변경은 별도 재시작 판단이 필요하다.
- Cloudflare/Comma/DB/사진/설정/manifest/태그/Release 변경 없음. 디버깅 정책에
  따라 이번에는 새 릴리즈를 발행하지 않는다. 백업/서버 배포 확인은 후속 기록에 남긴다.

## 2026-10-07 — bf6cd33 화면 미반영 원인 및 배포 검증 지침 보완

- 커밋 제목: `vehicle-journal: document stale sidebar entrypoint cache and deployment verification`.
- 조사 대상: bf6cd33b9bef8a6c2b28bd2dc6b2db61f94b16e5. 이전 기록의 파일 배포·HTTP
  검증은 확인됐지만 실제 브라우저 적용을 보장하지 못했다. 특정 에이전트의 행동은
  추측하지 않고 코드와 운영 응답·Chrome에서 확인한 누락 단계를 기록한다.
- 확인 시각: 한국 시간 2026-10-07 11:28~11:35 전후.
- 서버 검증: HA 설치 패널 SHA-256 `41489a45c4c8dfe736f2609571f7e16296e4b68be1c4bdb3f5e9defa35fcadf1`,
  카드 `e886ddcd1fc68afbc455264b099190823ab4e5a4a8253efbfabac7d53adca7b3`.
  로컬 bf6cd33과 일치하며 내부 HTTP 응답 및 외부 패널 HTTP 응답도 일치했다.
  내부 압축 허용 요청도 같은 해시였다. 설치 파일 누락은 재현되지 않았다.
- 브라우저 검증: 실제 사용자 Chrome에서 강력 새로고침 후에도 이전 제목·탭·버튼을
  확인했다. DOM 최상위 패널 URL은 `carrot-journal-panel.js?v=0.8.13-b7431cc4e5b2`.
  Network에서 이전 `carrot-vehicle-journal.js?v=journal-20261007-chart-fix-1`과
  design 모듈 요청을 확인했고 Workbox `StrategyHandler.js:160`·디스크 캐시가 표시됐다.
- 원인: `async_setup`이 시작 시 등록한 최상위 URL이 JS 직접 배포 후 유지된다.
  이전 패널 캐시가 이전 import를 계속 사용하므로 하위 import 버전 갱신만으로는 부족하다.
- 관련 파일: `vehicle-journal/AGENTS.md`, `vehicle-journal/deployment.md`,
  `.agents/rules/vehicle-journal.md`, `vehicle-journal/CHANGELOG.md`.
- 변경·이유: 최상위 URL부터 실제 화면·클릭 결과까지 배포 검증하도록 지침 보완.
  JS 변경이면 재시작이 항상 불필요하다는 기존 배포 문구를 정정했다.
- 검증·배포 상태: 문서만 수정, diff/지침 동기화 확인. main 커밋·푸시 대상.
  실행 코드 재배포·HA 재시작·새 릴리즈는 수행하지 않았다. 현재 화면 적용 해결은
  사용자 HA 재시작 후 최상위 URL 갱신 및 화면 확인이 남아 있다.
- 제한: HA Docker 읽기는 SSH 앱 보호 모드로 불가했으며 보호 설정을 변경하지 않았다.
  캐시 전체 삭제·운영 DB/사진/설정 변경 없음. Cloudflare·Comma 변경/배포 없음.

## 2026-10-07 — 헤더 타이틀 간소화, 최근 지출 전체 스크롤 표시 및 상세 기록 탭 이동 연동

- 커밋 제목: `vehicle-journal: simplify header title, expand recent expenses to full list, and link detail records tab`.
- 변경·이유:
  1. **헤더 브랜드 및 타이틀 개편**:
     - 상단 영문 키커 `CARROT HA · EV JOURNAL`을 완전히 삭제하여 시각적 노이즈 제거.
     - 메인 타이틀 `내 차의 생활`을 사용자 요청에 따라 직관적인 `차계부`로 변경.
  2. **최근 기록이에요 표시 범위 확장 (이번달 전체 지출 스크롤)**:
     - `renderRecentExpenses()`에서 기존 4개 제한(`slice(0, 4)`)을 완전히 제거.
     - 이번달(선택된 기간)에 발생한 모든 활성 지출 기록(`status === 'active' && kind === 'expense'`)을 스크롤 컨테이너(`.recent-list-wrap`)에 누락 없이 전체 렌더링하도록 확장.
     - 지출 건수가 많아져도 부드러운 스크롤을 통해 이번달의 모든 지출 내역을 한눈에 탐색 가능.
  3. **상세 기록 탭 명칭 변경 및 원클릭 이동 버튼 연동**:
     - 네비게이션 탭의 맨 오른쪽 4번째 탭 명칭을 `차계부`에서 `상세 기록`으로 변경 (`['대시보드', '주행 & 에너지', '절약 비교', '상세 기록']`).
     - 영웅 카드의 액션 버튼 텍스트를 `절약 계산 살펴보기 →`에서 `상세 기록보기 →`로 변경.
     - 버튼 클릭 시 3번째 탭(절약 비교) 대신 4번째 탭(인덱스 3: `상세 기록`)으로 즉시 전환(`this.selectTab(3)`)되도록 연결.
  4. **프로젝트 규칙 동기화**:
     - `.agents/rules/vehicle-journal.md` 생성 및 루트 `AGENTS.md` 상단에 차계부 작업 지침 및 CHANGELOG 기록 필수 규칙을 등록.
  5. **캐시 버스팅 갱신**:
     - `carrot-journal-panel.js` 및 `carrot-vehicle-journal.js` 모듈 버전을 `?v=journal-20261007-detail-link-1`로 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `custom_components/carrot_ha/frontend/carrot-journal-panel.js`
  - `review_journal_spending.html`
  - `AGENTS.md`
  - `.agents/rules/vehicle-journal.md`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포:
  - JS 문법 검사(`node --check`) 및 Python 300 tests 전체 통과.
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee` 직접 배포 완료 및 파일 SHA-256 일치 확인.
  - HA HTTP 정적 엔드포인트 응답 검증 완료 (브랜드 삭제, 타이틀 `차계부`, 탭 `상세 기록`, 버튼 `상세 기록보기 →` 확인).

## 2026-10-07 — 지출 비교 바 차트 비율 복원 및 상단 카드 높이 균형 최적화

- 커밋 제목: `vehicle-journal: restore bar chart scale to 175px and balance hero card proportions`.
- 변경·이유:
  1. 지출 비교 카드(#targetCard)의 SVG 바 차트 높이를 80px에서 175px로 복원:
     - 80px로 축소 시 320x185 viewBox가 0.44배로 축소되어 막대 및 금액 라벨("162,688원", "74,566원", "▼ 절약")이 비정상적으로 작아 보이던 축소 왜곡 현상 완전 해결.
     - 175px 높이에서 차트 폰트, 막대 두께(54px), 추이 연결선 및 뱃지가 원래의 선명하고 또렷한 크기로 복원됨.
  2. 영웅 카드(#heroCard)와 비교 카드 간 높이 균형 완성:
     - 영웅 카드의 헤드라인과 통계 지표, 버튼 간격을 세련되게 배치하고 `padding: 26px 28px 22px 28px` 적용.
     - 양쪽 카드가 약 350px 높이로 자연스럽고 균형 잡힌 비율을 이루며, 버튼 아래의 광활한 여백 없이 꽉 찬 완성도 높은 레이아웃 유지.
  3. 캐시 버스팅 갱신:
     - `carrot-journal-panel.js` 및 `carrot-vehicle-journal.js` 모듈 버전을 `?v=journal-20261007-chart-fix-1`로 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `custom_components/carrot_ha/frontend/carrot-journal-panel.js`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포:
  - Headless Chrome 데스크톱(1280px) 렌더링 검증 완료.
  - HA 실서버(`192.168.0.140`)에 SSH 직접 배포 및 3개 파일 SHA-256 일치 확인 완료.

## 2026-10-07 — 사진 수정의 main 및 HA 반영 확인

- 커밋 제목: vehicle-journal: record verified photo compression and cancellation deployment.
- 사진 기능 커밋 7212fe3ca4389017b2b6a715d65554102eaf6068은 동시 대시보드 커밋 19bac1435d7720efe53eee5e7e05de7788919e64의 부모이며 원격 main에 포함된 것을 확인했다. 현재 진행 중인 디자인 수정도 함께 유지된다.
- HA 설치 카드 SHA-256 d81226f75f8b38169b423f23a87e8a2cf36c5ebbc4de54f64d416f51ed58d3fc 및 패널 9503738a2e6aa98b570988323c0c225ca5a17851e4a39ff8fd93fb2661622279가 최신 소스와 일치한다. 사진당 20MiB 입력·브라우저 자동 압축·개별/전체 선택 취소가 설치 소스에 포함됨을 확인했다.
- Chrome 사진 압축 및 선택 취소·입력 유지·기록 수정 검증 통과. 실제 사용자의 영수증·iOS 저장 검증은 대기 중이다. 화면 강력 새로고침이 필요하며 HA 재시작·새 릴리즈·HACS 재다운로드는 수행하지 않았다.


## 2026-10-07 — 차계부 UI 전면 개편 및 상단 카드 하단 여백 제거 (컴팩트 레이아웃)

- 커밋 제목: `vehicle-journal: compact dashboard layout, eliminate hero bottom void, and refine period/tab copy`.
- 변경·이유:
  1. **상단 영웅 카드 하단 광활한 여백(약 230px) 완전 제거**:
     - 원인: 데스크톱 CSS Grid에서 1행의 '지난달 지출과 비교' 카드(#targetCard)가 대형 차트(180px SVG)와 다중 줄바꿈 범례 버튼 등으로 인해 451px 높이로 팽창하면서, 같은 행의 영웅 카드(#heroCard)까지 451px로 강제 확장(align-items: stretch)되어 버튼 하단에 약 230px에 달하는 거대한 공백이 발생함.
     - 해결:
       - `.comparison-panel`의 `.bar-chart-svg` 높이를 80px로 비례 축소하고 범례(`.legend-row`, `.legend-item`) 및 헤더 여백을 컴팩트하게 정돈하여 비교 카드 높이를 451px ➔ 298px로 대폭 압축.
       - `.hero`에 `display: flex; flex-direction: column; justify-content: space-between;` 및 상하 패딩 최적화(`20px 24px 16px 24px`)를 적용하여 헤드라인(상단), 지표(중앙), 버튼(하단)을 고르게 배치.
       - 버튼 하단부터 카드 하단 테두리까지의 여백이 230px에서 15px(카드 패딩)로 축소되어 하단 공백 완벽 제거.
  2. **기간 선택기 개편**:
     - 실효성이 떨어지는 '일별(day)' 선택 버튼을 완전히 제거하고 '월별'과 '연도별' 2개 버튼만 제공.
     - 탭 전환 시 오늘 날짜(현재 월 `YYYY-MM`, 현재 연도 `YYYY`)가 기본 선택되도록 수정.
  3. **네비게이션 탭 정리**:
     - '한눈에' ➔ '대시보드'로 명칭 변경.
     - 전용 대시보드가 존재하는 '차량 상태' 탭을 완전 제거하여 4개 탭('대시보드', '주행 & 에너지', '절약 비교', '차계부')으로 재편.
  4. **헤드라인 및 문구 전면 개편**:
     - "기록했어요" ➔ "소비했어요"로 문구 수정.
     - 월별: `${m}월 달에는<br>${km}km를 달리고,<br><span class="accent">${cost}</span>을 소비했어요.`
     - 연도별: `${y}년 에는<br>${km}km를 달리고,<br><span class="accent">${cost}</span>을 소비했어요.`
     - 영문 Kicker 문구(`YOUR MONTH, IN ONE SENTENCE`, `MONTHLY SPENDING COMPARISON`) 및 부제목(`주행은 자동으로 모으고...`), 비교 날짜 줄(`9월 대비 10월 지출 추이`) 완전 삭제.
     - 도넛 및 지표에서 '선택 기간' 문구 제거 (`이번 달 지출`/`올해 지출`, `이번달 전비`, `이번달 충전량`).
  5. **충전비 세부 항목 명칭 개선**:
     - `store.py`의 `records` 조회 쿼리에서 `expense_members`와 `mobility`를 조인하여 `charge_mode`(`slow`/`fast`)를 연동.
     - 최근 기록 목록에서 완속/고속 여부에 따라 `완속 충전 요금` 또는 `고속 충전 요금`으로 구체화하여 노출.
  6. **원장 상태 배너 위치 이동**:
     - "HA에 264개의 원장을 보관하고 있어요..." 배너를 카드 상단에서 페이지 최하단(footer 바로 위)으로 이동.
  7. **캐시 버스팅 갱신**:
     - `carrot-journal-panel.js` 및 `carrot-vehicle-journal.js`의 모듈 임포트 버전을 `?v=journal-20261007-compact-1`로 갱신하여 브라우저 캐시 문제 원천 방지.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `custom_components/carrot_ha/frontend/carrot-journal-panel.js`
  - `custom_components/carrot_ha/vehicle_journal/store.py`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포:
  - Headless Chrome 측정 검증 완료: 1행 카드 높이 451px ➔ 298px 압축, 버튼 하단 여백 230px ➔ 15px 축소 확인.
  - HA 서버(`192.168.0.140`)에 SSH `sudo tee`로 실배포 완료 및 4개 파일 SHA-256 해시 일치 확인 완료.
  - HTTP 정적 서빙 엔드포인트(`http://192.168.0.140:8123/carrot_ha_static/...`) 응답 검증 완료.

## 2026-10-07 — 사진 자동 압축과 선택 취소

- 커밋 제목: vehicle-journal: compress selected photos and cancel attachments without losing input.
- 변경·이유: JPG·PNG·WEBP 원본을 사진당 20MiB·8000만 픽셀까지 선택하고 브라우저에서 긴 쪽 2560px 이하 JPEG로 변환한다. 품질 조정 후 필요하면 추가 축소하여 저장 한도 2MiB를 지키며 휴대폰 원본은 변경하지 않는다. 사진은 순차 처리하고 메타데이터는 전송 전 픽셀 재인코딩으로 제거한다.
- 미리보기별 선택 취소와 전체 선택 취소를 제공하며 날짜·금액·메모를 유지한다. 압축 실패는 기록 생성 전에 처리한다. 저장 중 중복 제출과 사진 선택 변경을 막는다. 패널 import revision을 갱신한다.
- 관련 파일: frontend/carrot-vehicle-journal.js, carrot-journal-panel.js, vehicle-journal/tests/photo-compression.cjs, photo-selection.cjs. 서버·DB 스키마는 기존 저장 한도를 유지한다.
- 검증: Chrome에서 11~13MiB JPG·PNG·WEBP 자동 압축, 최대 해상도, 투명 배경, 잘못된 파일·20MiB 초과 거부를 검증했다. 선택 취소 입력 보존·JPEG 업로드·압축 실패 시 무저장·수동 수정 동일 ID/version 검증. Python 차계부 14건·스키마 9건 통과. 진행 중인 로컬 UI의 기존 browser-check는 제거된 day 선택자를 기다려 실패하므로 커밋 소스와 별도로 검증한다.
- 배포: main 커밋·푸시 후 HA 설치본에 이번 사진 변경만 백업·부분 반영하고 SHA-256을 확인한다. 다른 대시보드 작업을 포함하거나 덮어쓰지 않는다. Python 변경·HA 재시작·HACS 재다운로드·새 릴리즈는 수행하지 않는다.
- 제한: HEIC 미지원. 자동 변환은 손실 압축이며 원본 보관 기능이 아니다. 이번 취소는 아직 저장하지 않은 선택 사진 대상이다. iOS 실사용 및 운영 기록 사진 저장은 사용자 확인 대기다.


## 2026-10-07 — v0.8.14-beta.1 실제 발행 확인

- 커밋 제목: vehicle-journal: record verified beta release and HA deployment.
- 태그 v0.8.14-beta.1은 447a165b6e3742eb42564299b49c944a730cc304를 가리키며 manifest 0.8.14-beta.1과 일치한다. 기존 태그는 이동하지 않았다.
- GitHub Release pre-release=true 및 누적 본문을 확인했다: https://github.com/helico717/carrot-ha/releases/tag/v0.8.14-beta.1
- HACS Release Actions completed/success: https://github.com/helico717/carrot-ha/actions/runs/37483882735
- 최종 화면 파일 3개를 HA에 직접 반영하고 해시 일치를 확인했다. 백업: deployment-backups/447a165b6e3742eb42564299b49c944a730cc304. DB·사진·설정은 변경하지 않았다.
- 운영 설치 manifest는 기존 0.8.13이며 직접 배포한 실행 수정본이다. HACS의 새 베타에는 동일한 수정본이 포함된다. iOS 실사용·장기간 관측은 아직 미확인으로 정식 릴리즈는 발행하지 않았다.


## 2026-10-07 — 전체 디자인 실기 적용·베타 노트 확정

- 커밋 제목: vehicle-journal: finalize approved dashboard beta verification.
- 전체 디자인 원격 커밋 0b12115를 HA에 직접 배포하고 3개 파일 SHA-256 일치를 확인했다. 백업은 deployment-backups/0b1211576466b90ee8a24692ad090c3611c9e22e다.
- Chrome 새로고침 후 기간 선택·3단 hero·이전 기간 지출 비교·분류 범례·도넛·지출 목록과 실제 HA 기록 표시를 확인했다. 최초 SPA 이동에는 기존 모듈이 남았고 전체 새로고침으로 최신 모듈을 확인했다.
- 기존 입력 스타일이 원본의 차량/기간 selector를 전체 폭으로 만드는 것을 보정했고 분류 버튼 기본 스타일과 숨겨진 prototype tooltip 접근성을 정리했다.
- 누적 베타 노트에 전체 디자인과 실제 주행 복구 결과를 반영했다. iOS 실사용은 아직 미확인이다. Worker/D1/Comma 변경은 없다.


## 2026-10-06 — 승인된 spending prototype 전체 반영

- 커밋 제목: vehicle-journal: apply approved spending prototype to live HA records.
- review_journal_spending.html 원본은 보존했다. 3단 hero, 일/월/연도 선택, 이전 기간 스택 비교와 분류 선택, 고정 분류 색상, 지출 전용 최근 기록, 모바일 레이아웃과 수기 지출 4개 분류를 적용했다. 샘플 수치와 장치 프레임은 제외했다.
- 기존 HA 로컬 query만 사용하며 이전 조회 실패가 현재 기록을 차단하지 않는다. Worker·D1·Comma 변경은 없다.
- 관련 파일: frontend/carrot-vehicle-journal.js, carrot-journal-design.js, carrot-journal-panel.js, tests/browser-check.cjs.
- Chromium 저장·escaping·오래된 응답 거부·스크롤/스타일 유지·320/360/520/850px·윤년 범위·분류 토글 검증 통과. 실기 화면과 iOS 검증은 대기 중이다.
- HA 재시작 이후 장거리 주행 동기화와 원장 복구를 확인했다. 전체 디자인 실기 확인 전 베타 발행은 보류한다.


## 2026-10-06 — v0.8.14-beta.1 배포 준비

- 커밋 제목: vehicle-journal: prepare cumulative 0.8.14 beta notes.
- manifest `0.8.14-beta.1` 및 태그별 누적 릴리즈 노트를 준비했다. 기준은
  pre-release `v0.8.13` (`c8ad4aa`)이고 수정 실행 코드는 `4489ba0`이다.
  `v0.8.13..4489ba0`의 20개 커밋과 파일 diff를 대조하여 승인 UI, 유가 센서,
  loader/동기화, 문서·prototype·자산 보관과 이미지 원복 이력을 포함했다.
- SSH 개발본의 승인된 UI를 베타 소스에 포함하여 이 베타 다운로드가 이전
  화면을 되돌리지 않도록 했다. 다른 로컬 삭제 파일은 커밋에 포함하지 않았다.
- 직접 반영된 파일은 기존 manifest `0.8.13` 상태다. HACS 재다운로드가 이번
  SSH 검증의 필수 단계는 아니다. Python 재시작·실기 복구·iOS 확인은 대기 중이다.
- 이 준비 커밋은 버전/노트/기록 변경만 포함하며 Worker·D1·Comma는 유지한다.
  pre-release 발행 및 Actions 결과는 확인 후 별도 기록한다. 정식 발행은
  실사용 검증 후이며 기존 태그를 이동하지 않는다.

## 2026-10-06 — 패널 캐시 갱신과 백그라운드 동기화 스레드 수정

- 원격 커밋: `4489ba0` — vehicle-journal: repair long-trip ingestion, panel cache and HA loop scheduling.
  로컬 검증 커밋 두 개의 내용과 원격 tree 해시가 동일함을 확인했다.
- 승인된 충전량·전비·평균 충전요금 지표, 도넛 라벨, 수기 지출 전용 모달 및
  금액 콤마 서식을 그대로 유지했다. HA 설치본과 최신 Git UI 파일 해시 일치를
  확인했으며 기존 Chrome 실화면에서 원장과 승인된 지표 표시를 확인했다.
- 패널 URL은 manifest 고정값 대신 기존 전체 frontend 내용 해시를 사용한다.
  카드 dependency는 revision이 있는 정적 import를 사용하여 top-level await를
  도입하지 않고 패널과 카드 각각의 모듈 URL을 갱신한다.
- HA 실제 traceback에서 60초 timer의 schedule이 executor thread로 넘어가
  background task 생성이 실패하는 것을 확인했다. HA callback 표시로 event
  loop에서 실행하도록 수정했고 실행 중 작업 중복 방지 회귀 검증을 추가했다.
- browser-check의 수기 저장 테스트를 최신 승인된 지출 전용 폼에 맞췄다.
- 관련 파일: __init__.py, frontend/carrot-journal-panel.js,
  vehicle_journal/runtime.py, tests/browser-check.cjs, tests/test_runtime_schedule.py.
- 검증: 차계부 Python 14 tests, schema 9 tests 및 Chromium tabs/chart/manual
  expense/escaping/desktop/mobile/패널 정의 전 hass 전달 검증 통과. HA Python
  299 tests 통과(3 skip). 기존 Python3에는 Pillow가 없어 사진 2 tests가 실패했지만
  번들 Python 환경으로 전체 차계부 tests 통과했다.
- 배포: `4489ba0` main 반영 완료. HA 기존 코드 백업 후 선택 6개 파일 직접 반영 및
  SHA-256 일치 확인 완료. 백업: `/config/carrot_ha/deployment-backups/4489ba05620cbff77cfcc8d4921401e4395c5546/`.
  Python 변경 적용은 사용자가 HA를 재시작한다. DB·사진·설정은 배포 대상이 아니다.
- 한계: iOS의 이전 세션/캐시 원인은 아직 실화면으로 확인되지 않았다. 새 모듈
  URL 등록은 HA 재시작 후 적용된다. 운영 재시작 후 주행 복구와 timer 재검증이 필요하다.


## 2026-10-06 — 패널 로더 정적 임포트 전환 및 초기 로딩 보장

- 커밋 제목: `vehicle-journal: switch panel loader to static import and ensure load on connect`.
- 변경·이유:
  1. `carrot-journal-panel.js`에서 동적 타임스탬프 기반 `await import(cardURL.href)`를 표준 정적 임포트(`import './carrot-vehicle-journal.js';`)로 전환하여 top-level await 지연 및 모바일 웹뷰(WKWebView) 환경 등에서의 비동기 로딩 멈춤 현상을 원천 방지.
  2. `CarrotJournalPanel.connectedCallback()` 및 `set hass()`에서 `this.card.load()`를 명시적으로 호출하여 DOM 연결 및 `hass` 주입 시점에 항상 데이터 조회가 안정적으로 트리거되도록 보장.
  3. `carrot-vehicle-journal.js`의 `build()` 및 `load()` 내 DOM 참조(`actualKrw`, `recordForm`, `month` 등)에 null 안전 가드를 추가하여 초기화 중단 방지.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-panel.js`, `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `vehicle-journal/CHANGELOG.md`.
- 검증: `node --check` 통과 및 모의 DOM 라이프사이클 테스트 통과. HA SSH 직접 배포 및 SHA-256 일치 확인 (`carrot-vehicle-journal.js`: `2234105ecf9dec53c0dedaf3c69991ba60aa00325f385dadab808a3c0c2e1111`, `carrot-journal-panel.js`: `9eaa9fe4b734260c7eaed218f2de4203496dab89a38222f0991c7d725d847891`). 백업: `/config/carrot_ha/deployment-backups/3d87c3f/`.

## 2026-10-06 — HA 차계부 카드 UI/UX 최적화 반영 및 HA 직접 배포

- 커밋 제목: `vehicle-journal: apply approved hero metrics, clean donut labels, and simplified record modal to HA card` (`eab0a4e`).
- 사용자 요청에 따라 검토 프로토타입(`review_journal_spending.html`)에서 승인된 3대 핵심 개선사항을 실제 HA 카드(`custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`)에 그대로 반영:
  1. **영웅 카드 지표 3종 최적화**:
     - 1번 지표: 중복 '차량 총 지출'을 대체하여 `이번달 충전량` (kWh) 적용, 데이터 부재 시 `기록 없음`.
     - 2번 지표: `이번달 전비` (km/kWh) 적용, 데이터 부재 시 `기록 없음`. 모바일 줄바꿈 방지 (`white-space: nowrap`, 18px 모바일 / 21px 데스크톱, 단위 분리).
     - 3번 지표: 기존 1km당 충전비 대신 `kWh 당 평균 충전요금` (원) 적용, 데이터 부재 시 `기록 없음`.
     - 지표 상단 라벨 베이스라인 수평 정렬(`min-height: 28px`).
  2. **도넛 카드 카테고리 라벨 정돈**:
     - 카테고리 하단 세부 텍스트(`HA 자동 집계` 등)를 완전히 제거하고, 색상 도트 + 라벨 + 금액만 간결하게 정렬.
  3. **기록 모달 간소화 및 금액 자동 콤마**:
     - 수기 입력 불필요 항목인 `누락 충전`, `누락 주행` 및 `충전비`를 제외하고 `정비 / 지출` 전용 모달로 전환.
     - `실제 금액 · 원` 입력창에 세 자릿수 단위 콤마 자동 서식(`50,000`) 적용.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `vehicle-journal/CHANGELOG.md`.
- 검증: `node --check` 문법 검사 통과. HA SSH 직접 반영 후 로컬-원격 SHA-256 일치 확인 (`01efd2a9b60400488592f17856bdad2bf5db0d66d9a46a164f87060bbfd58565`).
- 배포: SSH를 통해 HA 서버(`/config/custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`)에 안전 백업(`/config/carrot_ha/deployment-backups/eab0a4e/`) 후 직접 배포 완료.

## 2026-10-06 — 영웅 카드 지표 최적화, 도넛 라벨 정돈 및 기록 모달 간소화

- 커밋 제목: `vehicle-journal: refine hero metrics, clean donut labels, and streamline record modal`.
- 사용자 요청에 따른 3가지 핵심 UI/UX 개선:
  1. **영웅 카드 지표 개편 및 모바일 줄바꿈 해결**:
     - 기존 `확인된 전비`(5.4 km/kWh)가 402px 모바일에서 `5.4`와 `km/kWh`로 2줄 분리되던 현상을 해결하기 위해 `.stat strong`에 `white-space: nowrap`, `font-size: 18px`(모바일)/`21px`(데스크톱), 단위 분리 태그(`.stat-unit`)를 적용하여 1줄 유지를 보장함.
     - 대형 헤드라인(`68,400원`)과 100% 중복되던 `차량 총 지출`을 대체하여 EV 핵심 에너지 지표인 `총 충전량`(262.8 kWh)을 기본 표시하도록 전환. (추천 후보: 총 충전량 / 유류비 절감액 / 순수 충전비).
     - 전비 라벨을 기간 선택기에 연동하여 `오늘 전비`, `이번달 전비`, `올해 전비`로 동적 갱신하며, 데이터 부재 시 `기록 없음`으로 표시.
     - 기존 `1km당 충전비`를 `kWh 당 평균 충전요금`으로 변경하고 단가 수치(예: 248원) 및 데이터 부재 시 `기록 없음` 지원.
  2. **"어디에 썼을까요?" 도넛 카드 라벨 정돈**:
     - 카테고리명 하단에 표시되던 세부 텍스트(`HA 자동 집계`, `직접 기록`, `트렁크 미끄럼방지 패드` 등)를 완전히 제거하여 카테고리 색상 도트, 라벨, 금액만 간결하고 명확하게 수평 정렬되도록 개선.
  3. **"놓친 기록을 남겨요" 모달 다이얼로그 간소화 및 금액 자동 콤마**:
     - 수기 입력 불필요 항목인 `누락 충전`, `누락 주행` 및 `충전비`를 전면 제외하고, 수기 지출 관리 대상인 4대 카테고리(`정비 / 소모품비`, `세차비`, `튜닝`, `기타`)로 통합.
     - `실제 금액 · 원` 입력 필드에 키 입력 시 실시간으로 세 자리 단위 콤마(`50,000`)가 자동 생성되는 `formatAmountInput` 적용.
- 관련 파일: `review_journal_spending.html`, `vehicle-journal/references/prototypes/review-spending-comparison.html`, `vehicle-journal/CHANGELOG.md`.
- 검증: 모바일 402px, 데스크톱 1280px, 기록 없음 모드(?empty=1), 모달 팝업(?modal=1) 스크린샷 캡처 및 육안 검증 완료.
- 배포: 검토 프로토타입 및 변경 이력 main 커밋·푸시.

## 2026-10-06 — 차량 이미지 추가 전 원본 복원

- 커밋 제목: `vehicle-journal: restore original review without vehicle image`.
- 사용자 요청으로 review_journal_spending.html을 이미지 추가 직전 백업과 동일하게 복원했다.
  이미지·오버레이·관련 반응형 수정이 제거되고 원래 제목·설명·통계 구성이 돌아왔다.
- 이전 이미지 자산과 오버레이 검사 파일은 작업 이력으로 유지한다. 오버레이 검사는
  이미지가 없는 현재 원본에 적용하지 않는다.
- 검증: 백업과 파일 일치, HTML 내 JS 구문 검사, 모바일·데스크톱 렌더링·이미지 없음 확인.
- 배포: 검토 HTML 및 변경 기록만 main 커밋·푸시. HA·Cloudflare·릴리즈 변경 없음.

## 2026-10-06 — 차량 우측 하단 고정과 겹침 중간값 조정

- 커밋 제목: `vehicle-journal: anchor hero vehicle at bottom right`.
- 이전 배치는 일반 문서 흐름에서 음수 margin으로 겹침을 만들어 중앙에 걸쳐 보였다.
  차량을 상단 hero-scene의 right: 0 / bottom: 0에 고정하고 폭을 86%로 줄였다.
  제목은 좌측 상단, 통계는 장면 아래에 유지한다. 전체 카드의 통계·버튼 영역을
  차량으로 덮는 구성은 아니며 차량은 카드 상단 시각 영역의 우측 하단에 놓인다.
- 장면에 반응형 예약 공간을 확보해 제목 길이가 달라도 차량의 우측·하단 기준을 유지한다.
  겹침은 직전보다 줄여 마지막 줄 아래쪽만 가리도록 조정했다.
- 관련 파일: review_journal_spending.html, assets/README.md, tests/review-hero.cjs,
  CHANGELOG.md. 새 이미지 생성이나 이미지 자산 변경은 없다.
- 검증: 21개 화면·기간 조합에서 경계·겹침·JS 오류 및 장면 우측 하단 정렬 검사.
  모바일 402px·데스크톱 1280px 월간 스크린샷 육안 확인.
- 배포: 검토 파일만 main 커밋·푸시. 운영 HA·Cloudflare·릴리즈 변경 없음.

## 2026-10-06 — 좌측 제목·우측 차량 구도와 이미지 제작 기준

- 커밋 제목: `vehicle-journal: align vehicle right and deepen headline overlap`.
- 큰 제목은 좌측 상단에 유지하고 차량 영역을 카드 내용 폭의 92%로 줄여 우측 정렬했다.
  이전보다 지붕이 제목 마지막 줄 아래쪽을 더 덮도록 간격을 조정했다.
- 관련 파일: review_journal_spending.html, assets/README.md, CHANGELOG.md.
- 검증: 모바일·큰 모바일·데스크톱, 320~1920px, 일/월/연도 21개 조합 통과.
  모바일 402px와 데스크톱 1280px의 월간 카드 스크린샷에서 겹침을 육안 확인했다.
- 배포: 로컬 검토 파일만 main에 커밋·푸시. HA·Cloudflare·버전·릴리즈 변경 없음.

### 다른 차량 이미지 형식과 재사용 편집 프롬프트

- 형식: 배경이 투명한 RGBA PNG, 1536×1024(3:2) 캔버스.
- 차량은 전면이 왼쪽을 향하는 앞쪽 3/4 구도, 전체 범퍼·바퀴·미러가 잘리지 않아야 한다.
- 차량 중심을 캔버스 중앙에 두고 가장자리에 약 4~6% 안전 여백을 둔다.
  차량 외부 배경은 완전히 투명하게, 유리창과 실내는 원래 표현을 유지한다.
- 흰 바닥·배경 안개·광택 테두리를 넣지 않는다. 그림자는 CSS에서 처리한다.
- 이미지는 contain으로 표시하고 우측 정렬·텍스트 겹침은 CSS에서 조정한다.
  차량마다 높이와 지붕 위치가 달라 교체 후 모바일·데스크톱 재검증이 필요하다.

```text
Edit the supplied vehicle photo into a dashboard cutout. Preserve the exact
vehicle identity, paint, badges, wheels, mirrors, proportions, tinted glass
and cabin details. Use a front three-quarter view facing left. Keep the entire
vehicle visible, including every tire and bumper, with no cropping. Place it
centered on a 1536x1024 RGBA PNG canvas with approximately 4-6% safe margins.
Remove the background completely: all pixels outside the vehicle silhouette
must be transparent (alpha zero), with clean antialiased edges. Preserve the
original glass and cabin appearance; do not punch transparent holes through
the windows. No white floor, smoky halo, background haze, glow, external shadow,
text, or added objects. Do not include dashboard text in the image; overlapping
text and right alignment will be implemented separately in CSS.
```

## 2026-10-06 — 큰 헤드라인 오버레이로 요청 정정

- 커밋 제목: `vehicle-journal: overlap vehicle with large headline and remove helper copy`.
- 이전 작업은 겹칠 대상을 작은 설명으로 잘못 이해했다. 작은 설명을 삭제하고
  큰 헤드라인의 마지막 줄 아래쪽과 차량 지붕만 조금 겹치도록 배치했다.
- 설명 DOM 갱신 코드와 CSS를 제거하고 모바일·데스크톱의 이미지 상단 간격을 조정했다.
- 관련 파일: review_journal_spending.html, assets/README.md, tests/review-hero.cjs,
  vehicle-journal/CHANGELOG.md.
- 검증: 320~1920px·세 화면 모드·일/월/연도 21개 조합에서 큰 제목과 차량의
  실제 알파 겹침, 작은 설명 제거, 차량·텍스트 경계, 지표 단위, JS 오류 검사 통과.
  모바일 월간 스크린샷을 육안 확인했다.
- 검토 HTML만 커밋·푸시한다. 운영 HA·Cloudflare·manifest·태그·릴리즈는 변경하지 않는다.

## 2026-10-06 — 차량 이미지 규격화와 오버레이 재수정

- 커밋 제목: `vehicle-journal: fit complete vehicle art and verify hero overlays`.
- 이전 `20f9e5b`의 차량 뒷부분 잘림·설명 대비·과도한 여백 문제를 해결했다.
  음수 right와 100% 초과 확대를 없애고 고정 비율 영역에서 차량 전체를 contain으로 표시한다.
- 원본 사진을 built-in image_gen으로 배경 제거한 새 1536×1024 RGBA 이미지를 추가했다.
  기존 컷아웃에 있던 유리창 투명 구멍 대신 유리·실내 표현을 보존한 파생 이미지를 사용한다.
  원본·기존 이미지는 유지한다. 작은 설명은 가벼운 대비 처리를 적용해 차체 가장자리와 겹친다.
- 좁은 뷰포트에 프레임 폭을 맞추고, 320px 연도별 지표는 두 열로 표시해 금액과
  전비 단위가 글자 중간에서 끊기거나 인접 지표를 침범하지 않도록 했다.
- 관련 파일: review_journal_spending.html, vehicle-journal/assets/id4-hero.png,
  assets/README.md, tests/review-hero.cjs 및 이 변경 기록.
- 검증: 320~1920px·세 화면 모드·일/월/연도 21개 조합의 이미지 경계·텍스트 경계,
  실제 차체 알파와 설명의 겹침·단위 한 줄 유지·JS 오류 검사 통과. 모바일 월간,
  320px 연간, 좁은 데스크톱 및 넓은 데스크톱 스크린샷을 육안 검토했다.
- 배포: 검토용 로컬 HTML과 자산만 커밋·푸시. 운영 HA·DB·API·manifest·태그·
  pre-release·정식 릴리즈는 변경하지 않는다. 이미지 생성 프롬프트와 배치 원칙을 문서화했다.

## 2026-10-06 — 검토 HTML의 차량·설명 오버레이

- 커밋 제목: `vehicle-journal: compose vehicle and overlay copy in review hero`.
- 사용자 지정 review_journal_spending.html의 요약 카드를 하나의 상대 좌표 영역으로
  구성하고 기존 투명 ID.4 이미지와 작은 설명을 겹쳐 배치했다. 설명은 차량 앞면
  가장자리 위에 표시하고 주요 수치와 하단 지표는 읽기 쉽게 유지했다.
- 모바일·큰 모바일·데스크톱 모드별 크기·위치와 좁은 카드 컨테이너 규칙을 추가했다.
- 관련 파일: review_journal_spending.html, 기존 vehicle_id4_transparent.png, 이 변경 기록.
- 검증: 세 화면 모드 이미지 로드·JS 실행·카드 렌더링을 확인했다. 차량 가장자리는
  카드 내부에서 잘라 표현한다. 원본 HTML 백업은 /private/tmp에 보관했다.
- 검토용 로컬 HTML만 수정했다. 운영 HA·manifest·태그·릴리즈는 변경하지 않는다.

## 2026-10-06 — 문서 언어 전수 확인과 혼입 표현 정리

- 커밋 제목: `vehicle-journal: normalize reference text and document language policy`.
- 숨김 폴더를 포함한 저장소 문서 93개를 문자별로 검사했다. 현재 작성 문서에는
  일본어 문장이 남아 있지 않으며, 참고 ev-zero-base.html의 한자 혼입 두 곳을 발견했다.
- 한자를 한국어로 치환하던 두 표현을 처음부터 한국어로 쓰도록 정리했다.
  참고 원문 해시는 유지하고 현재 파일 해시와 원문 보관 커밋을 별도 기록했다.
- 루트·차계부 AGENTS.md에 한국어/영어 문서 작성 및 커밋 전 혼입 확인 규칙을 추가했다.
- 관련 파일: references/prototypes/ev-zero-base.html, references/README.md,
  루트·차계부 AGENTS.md 및 이 CHANGELOG.md. 의도적인 제품 중국어 번역은 변경하지 않았다.
- 검증: 문서 전체 문자 검사·HTML 내 JS 구문·diff/공백·파일 해시 확인.
  문서·참고 파일만 커밋·푸시한다. HA 코드 반영·재시작·새 릴리즈는 필요 없다.

## 2026-10-06 — 전체 변경의 누적 changelog 기록 의무화

- 커밋 제목: `vehicle-journal: require complete changelogs for commits and releases`.
- 사용자 요청에 따라 모든 차계부 커밋의 기능·수정·제거·테스트·문서·배포 변경을
  기록하고, pre-release 및 정식 릴리즈 노트에 해당 범위의 변경 전체를 반영하도록 명시했다.
- 정식 노트는 직전 정식 릴리즈 이후 중간 베타의 변경까지 누적한다. 기준 태그·대상
  커밋과 git log·diff 대조, GitHub/HACS 노트 확인 절차 및 커밋 기록 양식을 추가했다.
- 관련 파일: 루트 AGENTS.md, vehicle-journal/AGENTS.md, deployment.md, CHANGELOG.md.
- 검증·배포: 문서 diff/공백 검증 대상. 문서만 커밋·main 푸시하며 HA 반영·재시작,
  manifest 상승·태그·릴리즈 발행은 필요 없다. 실제 새 릴리즈 내용 검증은 발행 시 수행한다.

### 이전 차계부 커밋과 기록 연결

| 커밋 | 변경 기록 항목 |
| --- | --- |
| `c0db509` | 기반 설계와 빈 HA DB 생성 |
| `c8ad4aa` | v0.8.13 차계부 첫 구현 |
| `9a293ee` | 개발 배포 정책 정정 |
| `5a64826` | 사이드바 첫 로딩 수정 |
| `0ec0afb` | 기존 전국 평균 유가 센서 연결 |
| `8867de5` | Antigravity 인계 절차 보완 |

`v0.8.13` 태그에는 `c8ad4aa`까지 포함되어 있다. 이후 커밋은 main의 개발 변경이며,
기존 v0.8.13 릴리즈를 재발행한 것으로 표현하지 않는다. 로딩 수정의 실사용 표시와
HA 배포 파일 해시 일치는 확인했다. 유가 최신 API의 재시작·계산 검증은 아직 미확인이다.

## 2026-10-06 — Antigravity 인계 절차 보완

- deployment.md에 커밋·main 푸시 명령, 커밋에서 코드 추출, HA SSH 백업·직접 반영·
  해시 확인, 사용자 재시작·강력 새로고침, 롤백과 단계별 릴리즈 절차를 정리했다.
- 루트 및 차계부 AGENTS.md에서 문서를 연결하고 충돌하는 기존 릴리즈 문구를 정리했다.
- 문서만 변경했다. HA 실행 코드·DB·사진·manifest·태그·Release는 변경하지 않았다.

## 2026-10-06 — 기존 전국 평균 유가 센서 연결

- gas_station_korea의 전국 평균 휘발유·경유·고급휘발유 센서를 비교 폼에서 찾아
  유종에 맞춰 제안한다. 사용자 비교 연비 확인·저장 후 계산한다.
- 해당 통합이 사용하는 단위 `원`을 리터당 유가로 허용한다. 다른 통합의 일반
  원 단위 센서는 허용하지 않으며 기존 원/L·KRW/L 지원은 유지한다.
- 단위 허용/차단 검증 추가. Python API 변경 적용에는 사용자 HA 재시작이 필요하다.

## 2026-10-06 — 사이드바 첫 로딩 수정

- 비동기 패널 정의 전 HA가 할당한 hass 속성이 setter를 가려 카드에 전달되지 않는
  순서를 재현했다. 업그레이드 후 속성을 setter로 재전달하도록 수정했다.
- 해당 순서의 브라우저 회귀 검증을 추가했다. 화면 파일만 커밋 기반 직접 배포하며
  manifest·태그·pre-release는 유지한다. DB·사진·Python 코드는 변경하지 않는다.

## 2026-10-06 — 개발 배포 정책 정정

- 운영 검증 전 정식 발행한 v0.8.13을 사용자 요청으로 GitHub pre-release로 전환했다.
  릴리즈 화면의 Pre-release 표시를 확인했다. 기존 태그·manifest는 유지한다.
- 이후 순서는 수정마다 검증·커밋·푸시 → 버그 수정 완료 후 pre-release → 실사용
  검증 통과 후 정식 릴리즈다. 디버깅 코드 테스트는 HA SSH 직접 동기화를 사용한다.
- 이 정책 변경에서는 HA 코드 동기화·설치·재시작을 실행하지 않았다.

## 2026-10-06 — 기반 설계와 사용자 요청에 따른 빈 HA DB 생성

- 전용 지침·요구사항·DB/집계/이관/백업/API/검증 계획, schema v1,
  독립 합성 검증 스크립트, 미선정 원본 HTML 후보 2개와 SHA-256 출처 기록 추가.
- 변경 범위: vehicle-journal/ 및 루트 AGENTS.md 안내. HA 실행 코드·manifest,
  Cloudflare·Comma 변경 없음. 0.8.12 버전 유지, HACS Release/Worker 배포 없음.
- 로컬 SQL 9개 검증 통과. null 결제 금액 허용과 실제 0원의 구분을 포함하며
  새 DB 생성·재실행·FK·unique·JSON·사진·transaction rollback 확인.
- 사용자 추가 요청에 따라 WireGuard 경유 HA SSH 연결 성공. 읽기 전용 source
  진단(한국 시간 13:47 전후): 활성 통합 1개, state 25,563건(9/22~10/6 UTC),
  trip 171건(7/28~10/6 UTC), charge 46건(7/28~10/5 UTC).
  trip_derivations 171, trip_energy 52, charge_summaries 46, charge_payments 6,
  charge_exclusions 0, charge_deletions 1. 이는 조회 시점 값이며 완전 복원 판정은 아니다.
- HA 신규 journal DB 생성: schema 1, 차량 mapping 1개, 원장 0건, 196,608 bytes,
  integrity_check=ok, foreign_key_check=0. 첨부파일 폴더 준비. 기존 파일 덮어쓰기 없음.
  HA 설정 시간대 확인에는 기존 sudo 권한을 사용했으며 서버 권한 설정은 변경하지 않음.
- 운영 DB/사진·entry/device 식별자·개인 본문·토큰은 Git에 포함하지 않음.
- 미완료: 과거 이관, automatic outbox/집계, 수동 쓰기, API, 대시보드, 실제 백업 복원.
  빈 DB 생성은 자동 기록 수집 시작을 의미하지 않음. HA 재시작·HACS 업데이트 불필요.

## 2026-10-06 — v0.8.13 차계부 첫 구현

- 사용자 선택 후보 1번 ‘오늘의 브리핑’을 바탕으로 HA Lovelace 카드 구현.
  월간 요약·지출 도넛·일/주/월 추이·페이지 원장·현재 유가 비교·최신 수신 상태 표시.
  HA 관리자 사이드바에 차계부를 자동 등록하며 별도 수동 리소스 설정 불필요.
- `custom_components/carrot_ha/vehicle_journal/`: packaged schema, compact 원장·일별
  요약·배치 이관, 수동 주행/충전/비용 저장·수정·삭제·복원, 관리자 WS·인증 사진 API.
  사진 픽셀 재인코딩, EXIF 제거, 크기/장수·차량 매핑 검증.
- 기존 storage mutation transaction에 기기별 durable outbox triggers 추가.
  target 사실/집계 완료 후 ACK, 원본 purge/slimming 전 확인·실패 시 유예.
  기존 결제 helper 재사용; actual=0 보존, 그룹 비용 중복 방지.
- HA source 읽기 전용으로 실제 과거 기록 이관, target 사전 backup과 integrity/FK
  확인. 운영 소스 파일 직접 복사 없음. Git 제외 로컬 실제 기록 미리보기 확인.
- 제한: parking/전체 SOC, 표본 기반 자정 정밀 배분, 당시 유가, 자동/수동 링크·
  필드 보정·export API는 후속 범위. 같은 날 자동 기록은 수동 행에 경고만 표시.
- Cloudflare·Comma 코드/배포 변경 없음. HACS 설치·HA 재시작은 사용자 작업.
  실행 코드의 실제 운영 수집/쓰기 확인은 설치 이후에 별도로 기록한다.
# 2026-10-07 — 최근 30일 주행 엔티티와 월간 요약 속성

- 배포 확정: 구현 커밋 `1aed5a94f95b82506b1c55ca7e0aabcaf55d1684`를 main에
  푸시하고 원격 일치를 확인했다. HA 센서 Python 4개 파일을 해당 커밋에서 추출해
  기존 해시 검사·전체 백업 후 부분 반영하고 배포 해시 및 Python 구문을 재검증했다.
  백업은 `/config/carrot_ha/deployment-backups/1aed5a94f95b82506b1c55ca7e0aabcaf55d1684/`.
  배포 스크립트 첫 시도는 구문 검사에서 중단돼 운영 파일을 수정하지 않았고,
  스크립트 수정·구문 확인 후 다시 실행해 성공했다.
  차계부 화면 4개 해시가 배포 전과 같음을 확인했다. HA 재시작은 실행하지 않았다.
  새 엔티티 실제 등록·실행 값 확인은 사용자 재시작 후 검증 대기다.

- 커밋 제목: `vehicle-journal: add rolling 30-day driving sensors with monthly attributes`.
- 변경·이유: 매월 1일 월간 기록이 비는 위젯을 위해 최근 720시간의 전비·전체
  주행거리 엔티티 두 개를 추가한다. 주행횟수는 별도 엔티티 대신 속성으로 제공한다.
  두 엔티티에 이번 달 전비·거리·횟수·에너지·커버리지 속성을 함께 제공하고
  기존 월간 엔티티는 호환성을 위해 유지한다. 기간은 주행 observed_at 기준이며
  진행 중인 주행을 시간 비례로 분할하지 않는다.
- 측정 정책: 기존 전비의 검증·거리 보정·순 에너지·회생제동 기준과 1km/0.5kWh
  표시 조건을 재사용한다. 누락된 에너지는 추정으로 채우지 않는다. 90일 주행 및
  에너지 캐시가 30일 집계를 지원하고, 원시 상태/경로의 14일 보존은 변경하지 않는다.
- 성능: 기존 60초 이력 동기화의 공유 로컬 요약만 확장한다. 클라우드 요청 및 KV
  쓰기 없음. 캐시 거리가 동일할 때 재쓰기를 생략해 월간/30일 집계가 같은 이벤트의
  차계부 outbox 세대를 반복 증가시키지 않게 한다.
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,sensors_v3.py,
  entity_migration.py}, tests/{test_rolling_energy.py,test_new_sensors.py}, docs/entities.md.
  위젯 제목·⚡ 전비·🚘 정수 거리·데이터 수집 중 템플릿도 문서에 추가했다.
- 검증: 새 기간 경계/월 경계/미래 기록/차량 격리/회생/누락/원시 정리/거리 수정/
  불필요한 쓰기 방지 4건, 센서 18건, 기존 월간 4건·주행 에너지 13건·보정 35건 통과.
  latest 6건·증분 5건·이력 캐시 1건, 필수 dashboard 10건, Worker 증분 및 benchmark,
  Comma parameter polling 4건, 카메라 4건, 충전 mode 8건·power 9건 통과.
  차계부 14건·schema 9건 통과. 기본 Mac Python의 Pillow 누락은 번들 Python으로
  재검증했고 충전 power 테스트의 독립 import 환경은 기존 센서 stub을 먼저 로드해
  검증했다. 실제 기기 장애로 해석하지 않는다.
- 배포: 현재 차계부 개발 정책에 따라 main 커밋·푸시 및 센서 Python 파일 4개만
  백업·부분 반영 대상이다. 기존 설치 4개 해시가 수정 전 Git 커밋과 일치함을 확인했다.
  차계부 화면 4개도 Git과 설치본 해시 일치 확인. 화면·DB·사진·설정은 배포 대상에서
  제외한다. manifest/태그/새 Release/Cloudflare/Comma 변경 없음.
- 적용 상태: 커밋·푸시·서버 반영 결과는 후속 기록으로 확정한다. Python 변경이므로
  사용자 HA 재시작 후 엔티티 등록/실제 값 확인은 대기다. 현재 개발 기간에는 HACS
  재다운로드를 혼용하지 않으며, 이후 새 베타 릴리즈에 최신 차계부 수정도 포함해
  태그·파일 해시와 누적 변경 기록을 검증한다.
# 2026-10-07 — 중복 차량 엔티티 12개를 속성으로 통합

- 배포 확정: 구현 커밋 `021c33c321302ea44c07d83c6c5625075ef553e4`를 main에
  푸시하고 원격 일치를 확인했다. 센서/migration 2개를 기존 해시 검사·백업 후 HA에
  부분 반영했고 배포 해시·Python 구문 재검증 완료. 백업 위치:
  `/config/carrot_ha/deployment-backups/021c33c321302ea44c07d83c6c5625075ef553e4/`.
  차계부 화면 4개 해시가 기존과 같음을 재확인했다. 재시작 전 실제 등록/활성은
  81/81개이며 아직 migration은 실행되지 않았다. 사용자 HA 재시작 후 81/69개와
  복합 속성/자동화 실사용 확인이 남아 있다. 에이전트는 재시작하지 않았다.

- 커밋 제목: `vehicle-journal: compact duplicate vehicle sensors with reversible migration`.
- 변경·이유: 최근 주행 상세 5개·충전 ETA 2개·월 완속/급속량 2개·월 주행횟수 1개·
  누적 기록 횟수/거리 2개를 기존 복합 센서 속성으로 제공하고 기본 비활성화한다.
  Comma 엔티티는 전부 유지한다. 자동화에서 참조하는 배터리/충전/연결/남은시간,
  현재 아이폰 위젯의 월 전비·거리는 유지한다. 별도 요약 엔티티를 추가하지 않는다.
- 전환: config entry data의 버전 마커로 최초 1회만 비활성화한다. 등록 ID·기록을
  삭제하지 않고 사용자가 다시 활성화한 선택을 재시작·옵션 저장 후에도 유지한다.
  새 설치도 상세 센서를 기본 비활성화하지만 설정에서 다시 활성화할 수 있다.
- 속성: 월 충전량에 slow_kwh/fast_kwh, 월 거리 및 최근 30일 거리에
  month_trip_count/recorded_trip_count/recorded_distance_km을 추가한다. 최근 주행 및
  충전 세션의 기존 속성으로 상세값을 제공한다. 누적 기록은 보존 중인 archive 기준이다.
- 영향 확인: HA 등록 81개/활성 81개와 축소 대상 12개를 읽기 전용 확인했다.
  조회한 HA YAML/Lovelace 설정에 대상 ID 직접 참조 없음. 아이폰·외부 카드의
  모든 설정을 조회한 것은 아니며 필요한 상세 센서는 재활성화할 수 있다.
  기본 적용 후 등록 81개·활성 69개 예상. 실제 전환은 사용자 HA 재시작 후 확인한다.
- 관련 파일: custom_components/carrot_ha/{entity_migration.py,sensors_v3.py},
  tests/{test_entity_migration.py,test_new_sensors.py}, docs/entities.md.
- 검증: 마이그레이션 4건(12개 한정/Comma·필수 보존/재활성화/다른 차량/옵션 저장),
  센서 속성·기본 활성 정책 포함 19건 통과. rolling/monthly 각 4건·latest 6건·증분 5건·
  이력 캐시 1건, dashboard/카메라 14건, Worker 증분·benchmark 및 Comma parameter
  polling 4건 통과. 차계부 14건·schema 9건 통과. 프론트엔드 변경 없음.
- 배포: main 커밋·푸시 후 현재 개발 정책의 백업·부분 배포 대상으로 센서 및
  migration Python 2개만 반영한다. 기존 설치 파일 해시와 수정 전 커밋 일치 확인.
  코드 반영/해시·백업 확인은 후속 기록으로 확정하고 사용자 재시작·69개 확인은 대기다.
  manifest/태그/새 Release/Cloudflare/Comma/운영 DB/사진/화면 코드 변경 없음.
# 2026-10-07 — 원시 CAN 수집 공유 용량 상한 10GB

- 배포 확정: `5a0e8fa77f5ef59283651428316ce453f51969c6`를 main에 푸시했다.
  can_capture.py/services.yaml을 백업 후 HA에 부분 반영하고 커밋 SHA-256과 일치 확인.
  백업: `/config/carrot_ha/deployment-backups/5a0e8fa77f5ef59283651428316ce453f51969c6/`.
  운영 로그 직접 삭제·HA 재시작은 수행하지 않았다. 실행 중 상한의 10GB 전환은
  사용자 HA 재시작 후 상태 센서 limit_bytes 확인 대기다.

- 커밋 제목: `vehicle-journal: lower HA raw CAN storage ceiling to 10 GB`.
- 변경·이유: 사용자 요청으로 HA 원시 CAN 파일의 모든 엔트리 공유 상한을
  20,000,000,000에서 10,000,000,000 bytes로 낮춘다. 기존 메타데이터 예약량과
  오래된 수신 파일부터 정리하는 정책은 유지한다. 시작 API의 max_gb 기본/검증
  상한과 서비스 설명을 10GB로 맞춘다. 원래와 같이 max_gb는 공유 상한을
  엔트리별 별도 예산으로 바꾸지 않는다.
- 영향: 시작 시 및 새 수신 시 새 상한을 적용한다. 기존 용량이 상한 초과라면
  다음 사용자 HA 재시작 시 오래된 원시 로그부터 정리된다. 운영 원시 로그 총량은
  읽기 전용 확인에서 새 상한 미만이었다. archive/차계부 DB·사진은 정리 대상이 아니다.
- 관련 파일: custom_components/carrot_ha/{can_capture.py,services.yaml},
  tests/test_can_capture.py, docs/raw-can-capture.md.
- 검증: CAN 테스트 10건 중 8건 통과, aiohttp 미설치로 실제 HTTP 2건 skip.
  새 10GB 상태/시작 검증 및 재시작 하향 상한·오래된 파일 우선 정리 검증 포함.
  실제 운영 파일 정리·수집 중 상한 도달은 수행하지 않았다.
- 배포: main 커밋·푸시 후 현 개발 정책으로 Python/서비스 설명 2개를 기존 해시
  확인·백업 후 부분 반영 대상. 확정 배포 및 사용자 재시작 대기는 후속 기록한다.
  차계부/차량 화면·Comma·Worker·D1·manifest·태그·새 Release 변경 없음.
# 2026-10-07 — 추이 카드의 미정의 이전 기간 변수 수정

- 배포/실화면 확정: `f597575dac65d507b8ece8017d50a0b2702ce99c` main 푸시 후
  카드 한 파일 백업·부분 반영. 백업은 `/config/carrot_ha/deployment-backups/f597575dac65d507b8ece8017d50a0b2702ce99c/`.
  설치·사용자 외부 주소 HTTP SHA-256 `9610587f9cb806f038249d2f787719982895f67ed826fbb0ff6269446e3588b5`
  일치, frontend-version `0.8.13-a0781aefca83` 확인. 실제 Chrome의 기존 오류를
  먼저 확인하고 새로고침 후 월/연도 6개 추이 카드·SVG와 비교 문구 표시를 확인했다.
  월별 화면으로 복원했다. HA 재시작·HACS 재다운로드는 실행하지 않았다.
- 별도 계산 제한: 기존 추이 코드는 진행 중인 월의 누적량을 월 전체 일수로 나누고,
  이전 월 분모를 30일로 고정한다. 미관측/미래 bin은 0으로 표현한다. 이번 수정은
  렌더링 오류 복구이며 이 비교 기준의 정확성까지 검증·수정했다고 보고하지 않는다.
  관측 범위·누락을 분리하는 후속 보완이 필요하며 원시 DB나 집계 결과는 변경하지 않았다.

- 커밋 제목: `vehicle-journal: fix undefined comparison values in trends dashboard`.
- 원인: e057203에서 추이 화면을 개편한 뒤 이전 기간 계산의 prevDist/prevCharge/
  prevRate/prevDriveSoc/prevFastRatio 선언과 카드 생성의 past* 참조가 불일치했다.
  d5aad74의 legacy energyStats 제거 및 d4ca68b의 null 요소 보호는 이 별도 오류를
  해결하지 못했다. 운영 파일에서도 동일한 참조 5개와 화면 `pastDist is not defined`
  오류를 확인했다. DB 누락이 아니라 첫 카드 생성 시 ReferenceError로 렌더링 중단이다.
- 수정: 5개 참조를 선언된 prev* 이름으로 맞춰 모든 추이 카드 렌더링을 복구한다.
  기간 계산·API·집계 정의·기록은 변경하지 않는다.
- 회귀: 이전 browser-check의 삭제된 metric/chart 선택자를 현재 6개 trend-card/SVG
  검증으로 교체한다. 월/연도·이전 기간 존재/없음·빈 데이터·NaN/undefined·비교 카드,
  기존 탭·수기 저장·HTML escaping·비동기 기간 전환·scroll/style·모바일 검증 통과.
  loader-update의 실제 모듈 로딩/입력 보호/뷰 복원 검증도 통과했다. node 구문 검사 통과.
- 지침: node --check만으로 미정의 변수 실행 오류를 잡지 못하므로 실제 Chromium
  렌더 및 화면 error 표시를 검사하도록 AGENTS와 .agents 규칙에 동일하게 추가했다.
- 관련 파일: frontend/carrot-vehicle-journal.js (custom_components/carrot_ha/ 아래),
  vehicle-journal/tests/browser-check.cjs, vehicle-journal/AGENTS.md,
  .agents/rules/vehicle-journal.md, vehicle-journal/CHANGELOG.md.
- 배포: 검증 후 main 커밋·푸시 및 카드 JS 한 파일의 백업·부분 반영 대상.
  운영 설치 hash가 수정 전 커밋과 일치함을 확인하고, 서버/HTTP/실제 브라우저 적용
  결과는 후속 기록한다. 현재 개발 정책에 따라 새 릴리즈 없음. Python/DB/사진/
  Cloudflare/Comma 변경 없음.
