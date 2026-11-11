## 2026-11-11 — TM_01 잠금·해제 시험 버튼 준비 (검증 중)

- 사용자 요청: 켜져 있는 Comma에서 잠든 차량 CAN을 대상으로 TM_01을 시험할 준비, 별도 ‘시험용 기능’ 디바이스의 ‘잠금 요청’·‘잠금해제 요청’ 버튼.
- 변경: button 플랫폼 등록, tm01_experiment.py의 관리자 단발/터미널 독점 경로, tm01_sensor.py의 관측 결과와 복귀 상태. 기존 차량/대시보드 엔터티는 유지. 사용자 정의 프론트엔드 변경 없음.
- Comma: openpilot 11a80a6ae에 선택형 mode35·부팅/만료 임대·서명 Init0 가설의 제한 송신·수신/반환/잠금 상태 구분을 구현·푸시. 기본 noOutput/주행 allowlist 유지, 현재 실차 설치·송신 없음.
- 로컬 검증: 실제 C 안전 훅/C++ 임대5개, CLI 의미/가드3개, HA 고정 명령/충돌/오류 정리3개 통과. 펌웨어/전체 pandad 빌드 추가 확인 중. GitHub 새 CI 실행은 아직 조회되지 않아 성공으로 보고하지 않는다.
- 배포: HA 커밋/직접 반영 준비 중, Comma 사용자 clean pull/재부팅 필요. 릴리즈/태그·실차 시험·재부팅은 하지 않음. 실제 도어 동작·네이티브 source bus·서명/깨우기 수용 미검증.

## 2026-11-11 — 원격 공조 연구의 하네스 접근 한계 확인

- 사용자가 설치 하네스는 첨부 도면 그대로라고 확인했다. PDF 전체 페이지를 새로 렌더링해 15/16번은 pass-through이며 Comma CAN 분기가 없음을 대조했다. meb-can-research의 독립 공조 후속 보고서에 근거·한계와 재개에 필요한 물리 접근/정상 동작 자료를 기록했다.
- 단계1 진단은 확보했으나 단계2의 명령/인증/wake 및 단계3 실차 프로필은 미완료다. 문서만 변경, 이전 코드26검사 결과 유지. 차량·제품 실행 코드·설정 변경·송신·설치·릴리즈 없음.

## 2026-11-11 — 독립 공조 EV-CAN 연구 근거 보완

- meb-can-research에서 meb-preheat 원저자의 실내 공조 수신 정의를 추가 확인했다. EV-CAN15/16 접근과 현재 하네스 분기를 구분하고 기존 전체 대장의 핵심 공조 ID 부재를 대조했다. 자세한 근거: docs/stationary-climate-route-followup-2026-11-11.md(연구 저장소).
- 오프라인 수신 해석기·반례 검증 추가, 전체26검사 통과. 시작/정지 명령 수용·깨우기·실차 송신 준비는 여전히 미완료. 차량 조회·송신·UDS·HA/Comma 실행 코드 변경·설치·릴리즈 없음.
- 이전 기록의 발행 보류는 승인 전 이력이다. 사용자가 구체적 내용·목적지를 승인한 뒤 연구 e04ee2c와 공통 기록 befa218의 GitHub main 반영을 확인했다. 이번 후속 기록도 같은 연구 범위로 Git에 보존한다.

## 2026-11-11 — 주차 원격 공조·잠금 제어 준비 읽기 진단

- 사용자 요청 1~3단계 중 HA 기존 관리자 역방향 터미널로 Comma·Panda 상태를 읽었다. 주차/noOutput/절전 활성화와 짧은 표본의 차량 CAN 프레임0을 확인하고, 설치 소스5개 해시를 대조했다. 빈 can 서비스 패킷을 차량 프레임이나 모든 차량 버스 절전의 증명으로 해석하지 않는다.
- 선행 MyID4 조사·현재 코드·기존 TM_01 수신 대장을 대조했다. 실제 독립 공조 명령과 잠금 인증/깨우기 경로가 미확보여서 2/3단계와 전체 목표는 미완료다. 비공개 meb-can-research의 docs/parked-remote-preparation-2026-11-11.md 및 오프라인 준비 코드에 근거/한계/후속 조건을 기록했다.
- 검증: 연구 신규9개/전체23개 검사 통과, 네 action 모두 검증 프로필 부재로0프레임. 차량 CAN·UDS 송신, 깨우기, 기기 소스·Panda 설정 변경, 배포·재부팅·릴리즈 없음.
- 발행 상태: 연구 커밋의 GitHub 푸시가 자동 승인 심사에서 차량별 진단 결과의 외부 반출에 대한 구체적 승인이 없다는 이유로 거절됐다. 연구 결과와 이 공통 기록은 로컬 보존하며, 대상 저장소/내용을 제시해 사용자 승인 후 발행한다.

## 2026-11-11 — 차계부 기록 창 시각 입력·입력칸 배치 수정 HA 직접 반영

- iPhone에서 시각 입력칸이 잘리던 문제, 시각을 지울 수 없던 문제(✕ 버튼 추가), 충전·주유·사고 기록 입력칸 줄이 다 차지 않던 문제를 고쳤다. 커밋 ef63ef9, main 푸시, HA SSH 직접 반영(파일·HTTP 해시 일치, 백업·rollback.sh 포함). 화면 전용이라 새로고침으로 적용. 상세: vehicle-journal/CHANGELOG.md.

## 2026-11-11 — 차계부 기록 시각 HA 직접 반영 (재시작 대기)

- a21069e의 store.py와 차계부 화면 2개 파일을 백업(`deployment-backups/record-time-a21069e`, rollback.sh 포함) 후 반영, 파일·HTTP 해시 일치 확인. HA 재시작 후 동작. 상세: `vehicle-journal/CHANGELOG.md`.

## 2026-11-11 — 차계부 기록 시각 표시·입력

- 상세 기록·최근 기록에 `11월 10일` / `오후 7시 5분` 형식으로 실제 시각을 표시(자동 주행·충전·충전 결제는 과거 기록 포함), 수동 기록에 선택 시각 입력, `보관 중` 표시 제거, 수동 주행 날짜 하루 밀림 수정. 상세: `vehicle-journal/CHANGELOG.md`.
- 로컬 검증 통과, HA 직접 반영 예정(Python 변경이라 HA 재시작 필요). 릴리즈 없음.

## 2026-11-11 — 자동 충전량 계산 적합성 후속 조사

- 추가 과거 세션과 수집기 누적 로직을 대조하고 기존 계산 시험 9건 통과를 확인했다. 산술 오류는 발견하지 못했으나 BMS 잔량 증가분을 단자 유입·충전기 공급 에너지와 동일시하는 한계를 확인했다.
- 고빈도 단자 전력 적산과 기존 BMS 증가분·청구량을 별도로 유지하는 개선안을 문서화했다. 상세: `vehicle-journal/charging-accounting-analysis-2026-11-11.md` 및 전용 변경 기록. 개인 데이터·실행 코드 변경·배포·릴리즈 없음.

## 2026-11-11 — 차계부 자동 충전량과 결제 단가의 기준 조사

- BMS 잔량 증가 기반 자동 충전량과 충전기 청구량의 차이, 실제금액 수정 후 단가 계산·수동 단가 우선 규칙을 조사했다. HA DB 읽기 전용 대조와 저장된 전력 표본 적산으로 단순 손실률만으로 해석할 수 없음을 확인했다.
- 분석·한계·기록 기준 제안: `vehicle-journal/charging-accounting-analysis-2026-11-11.md`, 전용 `vehicle-journal/CHANGELOG.md`. 개인 충전 기록은 문서화하지 않았다.
- 실행 코드·UI·운영 데이터 변경 및 배포·재시작·릴리즈 없음. 문서 작업만 수행.

## 2026-11-11 — 차계부 자주 가는 충전소·충전 행 표시 HA 직접 반영

- 차계부에 전기차 즐겨찾는 충전소(같은 주소에 충전소가 여러 곳이어도 이후 자동 충전에 이름 기록), 상세 기록 충전 행 3줄 표시, 자동 충전량 소수 1자리 표시를 추가했다. 커밋 de1fc73·8e115bd, main 푸시, HA SSH 직접 반영(해시 일치, 백업·rollback.sh 포함). 수신기·Comma 변경 없음.
- 상세·검증·미확인 사항: vehicle-journal/CHANGELOG.md 2026-11-11 항목. 즐겨찾기 기능은 사용자 HA 재시작 후 동작. 릴리즈 없음.

## 2026-11-09 — 오픈파일럿 사용 통계 패널(주행 탭)

- 변경: 한국어·영어 대시보드의 '주행' 탭, 지도·최근 주행 카드 아래에 오픈파일럿 사용 통계 패널을 추가했다. 270° 게이지(누적 사용률), 오픈파일럿·전체 주행 거리, 최장 연속 기록, N일 연속 기록(월~일 칩), 월별 거리·일별 사용률 막대(마우스 올림·탭 말풍선)로 구성한다. 게이지 위의 `누적 | 선택일` 탭으로 누적과 선택한 날짜를 전환하며, 호는 CSS 전환, 숫자는 0.55초 동안 올리거나 내린다. 요일 칩·일별 막대를 누르면 '최근 주행'의 날짜와 함께 선택된다.
- 이유: 백엔드(수집기 7862875·수신 앱 0.1.5·HA 영구 집계 `assist_stats`·`carrot_ha/assist/summary`)가 이미 데이터를 모으고 있어 화면만 없었다. 테슬라 'Self-Driving Stats' 화면을 참고했고, 프리뷰(`preview/assist-stats/`)에서 사용자가 구성을 승인했다.
- 동작: 데이터는 HA WebSocket `carrot_ha/assist/summary`(HA 로컬 집계, 서버 60초 캐시)만 읽는다. 수신 앱 요청은 추가하지 않는다. 주행 탭이 보일 때만 요청하고, 같은 카드는 60초 안에 다시 요청하지 않으며, 선택일 범위일 때만 날짜 요청을 더한다. 실패하면 기존 표시를 유지하고 15초 뒤에 한 번 다시 시도한다. 기록 없는 날은 0%가 아니라 '기록 없음'으로 표시하고, 시각은 HA 시간대로 변환한다. 계산 과정 설명 문구는 표시하지 않는다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-assist-stats.js(신규), carrot-dashboard-ko.js, carrot-dashboard-en.js, tests/dashboard-assist-stats.test.mjs(신규), tests/dashboard-dependency-version.test.mjs(의존 모듈 4→5개).
- 검증: 신규 10개 시험과 의존 모듈 시험 통과. 실제 HA 집계(11-09 조회분)를 `callWS` 목으로 연결해 운영 카드 코드를 브라우저에서 확인했다(한국어·영어, 누적↔선택일, 기록 없는 날, 최근 7일 밖 막대, 스크롤 위치 유지). 전체 `tests/*.test.mjs`에서 camera-360, charging-curve, debug-freshness, motion-status, range-c3-and-fixes 5개 파일은 변경 전 origin/main에서도 같은 방식으로 실패한다(이번 변경과 무관).
- 미확인·제외: 디버그 대시보드에는 적용하지 않았다. 실제 터치 기기, 게이지 전환의 움직임(검증 창이 숨김 상태라 끝 상태만 확인), 운영 HA 화면은 반영 후 확인이 필요하다. Python 시험은 변경이 없어 다시 돌리지 않았다. 릴리즈·태그 없음.
- 배포 상태: c272182를 origin/main에 푸시했고 HA SSH로 직접 반영했다(사용자 승인, 11:28 KST). 반영 전 HA의 ko/en 대시보드가 53340a0과 일치함(CR 제외)을 확인하고 `/homeassistant/carrot_ha/deployment-backups/assist-ui-c272182/before`에 백업(SHA256SUMS.before)했다. 신규 `carrot-assist-stats.js`와 ko/en 3개 파일의 크기·SHA-256이 커밋과 일치한다(24a8a951…, 7b622de3…, ba9330bd…). 서버가 반환하는 프런트엔드 버전이 `0.9.0-12d0e20a7de8`로 바뀌었고 정적 파일 200을 확인했다. HA 재시작은 필요 없고 브라우저 새로고침만 하면 된다. 운영 화면의 실제 표시와 사용자 브라우저 동작은 미확인이다. 릴리즈·태그 없음.

## 2026-11-09 — 오픈파일럿 사용 통계 준비 상태 조사

- FSD 형태 누적/일별 사용률·최장 연속 거리 조사. 전체 거리·enabled 기반은 있으나 활성 거리/구간 영속 집계·전용 API 미확인.
- 근거·필요 작업: docs/openpilot-usage-stats-readiness-2026-11-09.md. collector/engine.py, receiver.py, HA storage/cloud_feed/history 및 driving_logs 정적 조사.
- 검증: HEAD 6306496 기준. openpilot 경로 부재·pull 권한 제한으로 최신 차량 소스/운영 DB 미확인. 기존 사용자 변경과 복사본 보존.
- 배포: 코드/UI 수정·재시작·릴리즈 없음. 조사 기록은 로컬 작성, 커밋·푸시 미수행.
- 추가 기록(2026-11-11): 당시 로컬에만 남아 있던 이 조사 기록을 사용자 요청으로 커밋했다. 이후 사용 통계는 구현되어 루트 CHANGELOG.md의 2026-11-09 사용 통계 항목들에 기록돼 있다. 프리뷰 폴더 preview/assist-stats(약 40MB, 실제 주행 통계 포함)는 커밋하지 않았다.

## 2026-11-06 — 엔터티 ID 변경 HA 재시작 확인

- 확인(읽기 전용, HA 재시작 15:43 KST 이후): HA API에서 `sensor.id_4_openpilot_assist_ratio`·`sensor.id_4_openpilot_assist_distance`가 200(상태 unknown, 계획한 속성 존재)이고, 예전 `caryang_` ID는 404다. 엔터티 레지스트리 파일도 15:46:52 KST에 두 ID로 저장됐다. 플래그 `assist_entity_id_version: 1`이 기록됐다. Carrot 엔터티는 88개 그대로다(`caryang_` 19개는 기존 엔터티).
- 처음 확인 때 레지스트리 파일이 재시작 전 내용이라 변경 실패로 보였다. HA의 지연 저장 때문이었고, 같은 코드를 실제 등록 값으로 돌린 시험에서도 정상 변경을 확인했다. 비대화형 SSH에서는 `ha core logs`에 Supervisor 토큰이 넘어오지 않으므로, 토큰을 출력하지 않고 컨테이너 환경 파일에서 읽어 조회했다.
- 15:44:38 KST에 `Carrot cloud sync failed (OperationalError)`가 1회 기록됐다. 메시지에 오류 종류만 남아 원인 문장은 확인하지 못했다. HA 시작 직후 여러 작업이 같은 DB를 쓰는 시점이었고, 10-30에도 시작 시 같은 종류(database is locked)가 기록된 적이 있다. 다음 동기화부터 정상이다(상태 15:46:04 KST 수신). 이번 버전에서 추가한 시작 시 보충 처리의 영향이 없다고 단정하지 않으며, 다음 재시작 때 재발 여부를 본다.
- 코드·설정·DB 변경 없음.

## 2026-11-06 — 주행 전비 경계 측정값 반영 bd81b48 재시작 후 운영 확인

- 사용자 HA 재시작 후 읽기 전용 조회로 확인했다. 설치 `trip_repair.py` SHA-256 e12418338e53(bd81b48)과 일치.
- archive 10월 주행 162건 중 요약 사용 가능 153건(이전 68건), 4,034.9km. 차계부 DB가 15:44(KST)에 다시 집계되어 10월 일별 요약 합계가 주행 4,345.0km, 전비 거리 4,034.9km, 소비 전력 670.1kWh가 됐다. 커버리지 38% → 92.9%, 10월 전비 6.2 → 6.02km/kWh로 사전 계산과 일치.
- `ha core logs`는 SSH 앱 권한(401)으로 읽지 못해 HA 로그의 오류 여부는 미확인이다. 화면의 새 수치는 사용자 브라우저 새로고침 후 표시된다. 새 릴리즈/태그 없음.

## 2026-11-06 — 주행 전비 경계 측정값 반영 bd81b48 HA 직접 반영

- 배포 커밋: bd81b48(main 푸시, 원격 대비 미푸시 0). HA `trip_repair.py`가 직전 커밋과 SHA-256 일치(279bbd7f723d)함을 확인하고 `/config/carrot_ha/deployment-backups/trip-energy-bd81b48/before/`에 백업한 뒤 이 파일만 반영했다. 설치 파일 SHA-256 e12418338e53이 커밋과 일치하고 HA의 Python으로 구문 검사를 통과했다.
- 운영 DB·설정·사진·다른 코드 변경 없음. Python 변경이므로 **사용자 HA 재시작 후** 적용된다. 재시작 후 첫 조회에서 주행 판정이 다시 계산되고 차계부 다음 동기화에서 10월 전비 거리 약 4,035km(커버리지 약 93%) 반영을 확인해야 한다. 새 릴리즈/태그 없음.

## 2026-11-06 — 경계 몇 초 밖 배터리 측정값도 주행 전비 요약에 반영

- 커밋 제목: `fix(trip-energy): count near-boundary battery samples in summaries`
- 원인: 10월 차계부 주행거리 4,345km 중 전비 계산 거리는 1,649km(커버리지 38%)였다. 주행거리는 계기판 누적거리와 0.2% 이내로 일치해 정상이다. 주행 소비 전력은 출발·도착에 가장 가까운 배터리 Wh 측정값의 차이로 검증되는데, `trip_repair.derive`는 두 측정값이 주행 시간 안에 있을 때만 `summary_eligible`로 표시했다. 10월 주행 162건 중 86건은 소비 전력이 검증됐지만 측정값이 주행 시간 밖으로 최대 15초 벗어나 차계부·월간 전비 요약에서 빠졌다.
- 변경: `refresh()`가 모든 주행을 판정한 뒤 이웃 주행 시각만으로 후처리한다. 측정값이 주행 시간 밖 20초 이내이고 앞 주행 종료 이후·다음 주행 시작 이전이면 요약에 사용한다. 충전 혼입·구간 내 무효값·비정상 전력 검사는 기존 `derive` 조건을 그대로 유지한다. 30초 밖 측정값은 기존 테스트(`test_monthly_energy`) 의도대로 계속 제외한다. 주행 본문을 한 번만 디코딩한다.
- 관련 파일: `custom_components/carrot_ha/trip_repair.py`, `tests/test_trip_repair.py`(20초 이내 허용·이웃 주행과 측정값 공유 시 제외·허용 폭 초과 제외·시각 누락 4건), 이 변경 이력.
- 검증: 새 테스트 4건 통과, 완화 처리를 끄면 실패함을 확인. 전체 Python 테스트 450건은 변경 전 HEAD와 실패 목록이 동일(기존 실패 1·오류 19는 이번 변경과 무관). HA 원본 읽기 전용 실측: 10월 새로 반영될 주행 85건·2,386km·404kWh. 반영 후 예상 전비 거리 4,035km(커버리지 약 93%), 10월 전비 6.2 → 약 6.0km/kWh(배터리 사용량 교차 추정 약 6.27).
- 배포: main 커밋·푸시 후 `trip_repair.py`만 백업 후 HA 직접 반영 예정. Python 변경이라 사용자 HA 재시작 후 적용되며, 재시작 후 첫 조회 때 모든 주행 판정을 다시 계산한다. 결과는 후속 기록. 새 릴리즈·태그 없음.
- 제한: 원시 상태 보존 기간이 지나 측정값이 없는 오래된 주행은 기존 판정이 유지될 수 있다. 일별 전비는 이번 변경으로 날짜별 값이 바뀔 수 있다.

## 2026-11-06 — 추세 순위 막대 dbf56ff HA 직접 반영

- 배포 커밋: dbf56ff(main 푸시, 원격 대비 미푸시 0). HA 기존 두 화면 파일이 직전 배포 커밋 4cb71ac와 SHA-256 일치(카드 8e57fbcbb374, 디자인 f66e2372f66c)함을 확인한 뒤 `/config/carrot_ha/deployment-backups/trend-rank-dbf56ff/before/`에 백업했다.
- `carrot-vehicle-journal.js`, `carrot-journal-design.js` 두 파일만 반영했다. 설치 파일과 HA 로컬 HTTP(`/carrot_ha_static/`) 응답 SHA-256이 커밋과 일치(카드 b13d7364ff58, 디자인 7cbb90aaeb9a). `/api/carrot_ha/frontend-version` HTTP 200.
- 운영 DB·설정·사진·Python 코드 변경 및 HA 재시작 없음. 사용자 브라우저 새로고침 후 실제 화면(순위 막대·툴팁·강조·1,680px/3열) 확인은 대기. 이전 화면이 보이면 새 화면 버전 적용 또는 사용자 HA 재시작이 필요할 수 있다. 새 릴리즈/태그 없음.

## 2026-11-06 — 차계부 추세 순위 막대·기간 툴팁·넓은 화면 3열

- 커밋 제목: `vehicle-journal: rank trend bars with period tooltips and wide layout`. 상세는 `vehicle-journal/CHANGELOG.md`.
- 추세 차트를 기간 순위 막대로 바꾸고 막대 hover/탭 시 그 기간의 요약·관련 기록을 HA 로컬 조회로 보여준다. 변동 카드에 지표 색 상단 바와 개수 배지, 모든 탭 최대 1,680px·추세 영역 1,400px 이상 3열.
- 검증: 실제 HA 차계부 DB 읽기 전용 복제본으로 Chromium 1920/1280/375px·월/연·전기차/경유차 확인, `tests/dashboard-*` 통과. `browser-check.cjs`는 Playwright 부재로 미실행. 배포는 후속 기록. 새 릴리즈 없음.

## 2026-11-06 — 충전량·단가 입력값 표시 63197f0 HA 반영 완료

- 배포 커밋: 63197f0b12dcc0b0b4173e4c61cfcace1e93878d(main 푸시). 격리된 Git 파일로 Chromium 320/360/390/430/1280px 기록 수정 회귀와 변경값 저장/재열기·자동값 수동 승격 방지를 재검증했다.
- HA 기존 화면 JS가 d0e2c93 기준 SHA-256 03cfed5b8c77과 일치함을 확인하고 `/config/carrot_ha/deployment-backups/charge-input-prefill-63197f0b12dc/before/`에 백업했다. 변경 파일 하나만 반영했으며 설치/HA 로컬 HTTP SHA-256이 8e57fbcbb374로 일치했다.
- 운영 DB·설정·사진·Python 코드 변경 및 HA 재시작 없음. 사용자 브라우저 새로고침 후 실제 입력값/안내 제거 확인은 대기. 브라우저 캐시로 이전 화면이 보이면 새 화면 버전 적용 또는 사용자 HA 재시작이 필요할 수 있다. 새 릴리즈/태그 없음.
- 다른 추이 작업은 로컬 작업 파일/별도 디자인 변경/프리뷰 및 Git 066d7dc 이력에 보존했으며 이번 HA 반영에는 포함하지 않았다.

## 2026-11-06 — 충전 입력 수정 커밋 범위 정정

- 066d7dc 스테이징 직전 같은 JS 파일에 다른 작업의 추이 그래프 변경이 들어와 함께 포함됐다. HA에는 배포하지 않았다. 후속 커밋에서 d0e2c93 기준 openRecord/충전 저장 변경만 남겨 이번 배포 범위를 정정한다.
- 다른 추이 변경은 현재 로컬 작업 파일 및 066d7dc Git 이력에 보존했다. 작업 파일·다른 작업의 디자인 모듈·미추적 프리뷰를 원복/삭제하지 않았다. 이후 HA에는 격리된 Git 커밋 파일만 반영한다.

## 2026-11-06 — 충전량·단가 입력값 채우기와 안내 제거 승인 반영

- 사용자 2차 프리뷰 승인 후 자동 충전량·단가를 실제 입력값으로 표시했다. 수동 저장값/청구량을 먼저 사용하고 없을 때 자동 배터리량·계산 단가를 표시한다. 상단 자동 기록 안내와 두 입력칸 아래 보조 안내는 제거했다.
- 표시만 한 자동 배터리량·계산 단가는 메모 등 다른 항목만 저장할 때 수동 청구량/단가로 바꾸지 않는다. 사용자가 다른 값으로 바꾸면 기존 저장 API로 보정값을 저장하고 재열기 시 우선 표시한다. 운영 DB 직접 수정·백엔드 변경 없음.
- 프리뷰 두 주소는 실제 프로덕션 모듈을 직접 사용하도록 검토용 입력/저장 오버레이를 제거했다. 이전 주소에서도 동일한 화면을 제공한다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-vehicle-journal.js, vehicle-journal/tests/record-edit-layout.cjs, review-automatic-charge-edit.html, review-charge-input-prefill.html.
- 검증: node --check 통과. Chromium 320/360/390/430/1280px 기록 입력·위치·삭제 회귀, 18.4/320 자동 표시·안내 부재·가로 넘침 없음, 20/300 및 36.5/338 직접 변경 저장·재열기, 메모만 저장 시 자동값 수동 승격 방지 통과. 기존 테스트의 무변경 저장은 최신 dirty 버튼 정책상 숨겨져 메모 변경 시나리오로 갱신했다.
- 배포 준비: HA 설치 화면 파일 SHA-256 03cfed5b8c77이 현재 Git HEAD 파일과 일치 확인. 커밋·푸시 후 파일 하나만 백업·직접 반영 예정. 새 릴리즈/태그 없음. 실제 사용자 브라우저 적용·실기록 저장 확인은 대기.

## 2026-11-06 — 충전 입력 프리뷰 링크 혼동 수정

- 사용자 화면(12,000원 / 45,678km)은 이전 review-automatic-charge-edit.html 합성 데이터와 일치했다. 새 review-charge-input-prefill.html에만 입력 채우기 오버레이가 있어 이전 주소에서는 빈 입력이 남았다.
- 두 프리뷰 주소를 같은 2차 검토 내용(5,888원 / 84,531km / 18.4kWh / 320원)으로 맞췄다. 프로덕션은 수정하지 않았다. 신규 안내 제거/입력값 표시 수정의 운영 반영은 아직 아님.
- 검증: Chromium에서 두 URL의 실제 iframe 입력값 18.4 / 320 확인. 1280/390/320px 안내문 부재·가로 넘침 없음·수정/재열기 통과. 승인 전 운영 미반영.

## 2026-11-06 — 자동 충전량·단가 입력칸 재수정 프리뷰

- 사용자 실화면에서 자동 배터리 충전량·단가는 상단 안내에만 있고 입력칸은 비어 있음을 확인했다. 이전 구현은 배터리량/청구량 구분을 입력값 누락으로 표현해 요청을 충족하지 못했다.
- 요청대로 기존 자동값을 충전량·단가 입력칸에 표시하고 편집하도록 프리뷰를 준비했다. 상단 자동 기록 안내 및 두 입력칸 아래 보조 안내를 제거했다. 원본/보정 구분은 저장 로직에서 유지하며 자동 배터리량을 단순 열기/저장만으로 청구량으로 승격하지 않는다.
- 관련 파일: vehicle-journal/review-charge-input-prefill.html. 실제 프로덕션 Custom Element를 재사용한 검토 전용 오버레이이며 합성 데이터(18.4 kWh / 320원)를 사용한다.
- 검증: Chromium 1280/390/320px에서 충전량 18.4·단가 320 입력값 표시, 안내문 부재, 가로 넘침 없음 및 수정값 20·300 저장/재열기 통과(합성 응답).
- 상태: 프로덕션 미수정·커밋/배포/릴리즈 없음. 프리뷰 승인 및 실제 조회/저장 회귀 검증 대기. 기존 타 작업 변경 보존, git pull --ff-only 최신 확인.

## 2026-11-06 — 엔터티 ID 변경(28e7088) HA 직접 반영

- CI 성공 확인: https://github.com/helico717/carrot-ha/actions/runs/42171538435 (regression, radar-ha-python).
- 반영 전 HA의 entity_migration.py·sensors_v3.py SHA-256이 28e7088^와 일치했다. `/config/carrot_ha/deployment-backups/assist-entity-id-28e7088/before/`에 백업하고 SHA256SUMS.before로 검증했다.
- 문법 검사 후 root:root 644로 반영했다. SHA-256 앞 16자리가 커밋과 일치한다: entity_migration bccd9233a4a19418, sensors_v3 8899d756ab0816a5. 남은 임시 파일 없음.
- 사용자 HA 재시작 대기. 재시작 후 ID 변경 결과는 미확인. 릴리즈 없음.

## 2026-11-06 — 오픈파일럿 사용 통계 엔터티 ID를 계획대로 변경

- 확인(재시작 후, 읽기 전용): 엔터티 2개가 생겨 Carrot 엔터티가 86개에서 88개가 됐다. 두 엔터티 모두 일반·활성이다. 다만 ID가 계획서의 `sensor.id_4_…`가 아니라 `sensor.caryang_id_4_openpilot_assist_ratio`·`…_distance`였다. 이 HA는 새 엔터티에 `caryang_`을 붙이며, 기존 19개 엔터티도 이 형식이다. 등록 이름은 `ID.4`다.
- 변경(사용자 선택: 코드로 id_4_ 변경): entity_migration.py가 HA 시작 때 한 번만 두 엔터티의 생성된 형식 ID(`…_<key>`)를 `sensor.<등록 이름 slug>_<key>`로 바꾼다. 대상 ID가 이미 있거나, 사용자가 붙인 다른 형식이거나, 등록 이름에서 ASCII slug가 나오지 않으면 바꾸지 않는다. 실행 후 entry data에 `assist_entity_id_version: 1`을 남겨, 이후 사용자가 직접 바꾼 ID를 다시 덮어쓰지 않는다. 새로 설치할 때도 같은 ID가 되도록 두 엔터티가 처음 등록될 때 `sensor.id_4_<key>`를 요청한다(기존 등록 엔터티에는 영향 없음).
- 관련 파일: entity_migration.py, sensors_v3.py, tests/test_entity_migration.py, tests/test_assist_entities.py.
- 검증: test_entity_migration 8개(새 2개: 1회 변경·다른 엔터티 유지·이후 사용자 ID 보존 / 충돌·사용자 ID·비ASCII 등록 이름 건너뜀), test_assist_entities 4개(요청 ID 포함), test_new_sensors 24개, test_assist_stats 14개 통과.
- 배포 상태: 커밋·푸시 후 HA SSH 직접 반영 예정. 사용자 HA 재시작 후 실제 ID 확인 필요. 릴리즈 없음.

## 2026-11-06 — 오픈파일럿 사용 통계 엔터티(9f2ca74) HA 직접 반영

- CI 성공 확인: https://github.com/helico717/carrot-ha/actions/runs/42170192467 (regression, radar-ha-python).
- 반영 전 HA의 assist_stats.py·storage.py·sensors_v3.py·__init__.py SHA-256이 9f2ca74^와 일치했다. `/config/carrot_ha/deployment-backups/assist-entities-9f2ca74/before/`에 백업하고 SHA256SUMS.before로 검증했다.
- 커밋 파일을 staging에서 HA 서버 Python으로 문법 검사한 뒤 root:root 644로 반영했다. SHA-256 앞 16자리가 커밋과 일치한다: assist_stats 232248fcb0bf6816, storage d235edd8690bef21, sensors_v3 09d8e7aa51b2494f, __init__ d332184405c3915e. 남은 임시 파일 없음.
- 사용자 HA 재시작 대기. 재시작 뒤 실제 엔터티 ID와 값은 미확인. 아직 assist 주행이 없어 두 엔터티는 알 수 없음 상태가 정상이다. 릴리즈 없음.

## 2026-11-06 — 오픈파일럿 사용 통계 HA 엔터티 2개 추가

- 변경: docs/OPENPILOT_ASSIST_ENTITIES_PLAN_2026-11-06.md(사용자 승인)대로 새 엔터티 2개를 추가했다. `sensor.id_4_openpilot_assist_ratio`(오픈파일럿 사용률, %, measurement)와 `sensor.id_4_openpilot_assist_distance`(오픈파일럿 누적 주행거리, km, distance, total_increasing)이다. 세부 숫자는 속성으로 묶었다(누적 보조·수동·상태 모름 거리, 이번 달 사용률·거리, 최장 연속 거리·시작 시각, 현재·최장 연속 사용 일수, 사용한 날, 측정 주행 수, 해제 횟수, 기록되지 않은 거리 추정 / 조향만·가감속만·둘 다·시스템 활성·오늘 거리). 기존 `sensor.id_4_last_trip`에는 이 주행의 사용률·보조·수동 거리·최장 연속 거리·해제 횟수 속성을 더했다(측정 안 된 주행은 null).
- 구현: 엔터티는 공유 요약(overview, 동기화 60초마다 갱신)만 읽고 수신 앱에 따로 묻지 않는다. overview가 캐시된 전체·이번 달·오늘 집계에서 숫자만 만든다. 통계 계산이 실패해도 다른 센서 값은 영향받지 않게 분리했다. 수신 앱 연결이 없어도 날짜 의존 값이 바뀌도록 자정 00:00:30에 요약을 다시 계산한다. 새 엔터티 속성에는 분 단위로 바뀌는 측정 시각을 넣지 않아, 통계가 그대로면 기록 DB에 새 행이 생기지 않는다. 일별·월별 목록은 엔터티에 넣지 않았다. 요약에 시스템 활성(enabled) 거리 합계를 추가했다.
- 관련 파일: assist_stats.py, storage.py, sensors_v3.py, __init__.py, tests/test_assist_entities.py(신규), tests/test_assist_stats.py, docs/OPENPILOT_ASSIST_ENTITIES_PLAN_2026-11-06.md(신규).
- 검증: test_assist_entities 4개(이름·ID·단위·클래스, 첫 측정 전 알 수 없음, 값·속성, 최근 주행 null), test_assist_stats 14개(overview 연결, 통계 실패 분리 추가), test_new_sensors 24개 통과. 전체 Python 테스트 60개 파일은 지난 실행 대비 새 테스트 외 결과가 같다(16개 파일은 기존 PC 환경 문제). 주행 저장 경로 6개 파일 101개 통과. 프론트엔드 변경 없음.
- 배포 상태: 커밋·푸시 후 HA SSH 직접 반영 예정. 버전 상승·릴리즈 없음. 실제 엔터티 ID는 HA 재시작 후 확인 필요.

## 2026-11-06 — 위치 디버깅 UI 제거 fb2fe42 HA 반영 확인

- fb2fe4211f5f7290a410d06710b9dc0b04f7774d main 커밋·푸시 및 원격 대비 미푸시 커밋 0 확인. 동시 완료된 자동 충전 수정 6aeed30을 보존했다.
- HA 기존 두 파일이 직전 커밋과 일치함을 재확인하고 `/homeassistant/carrot_ha/deployment-backups/location-debug-fb2fe4211f5f/before/`에 원본 백업 및 deployment.json 해시 기록 후 두 화면 파일만 반영했다.
- 설치 파일과 HA HTTP 응답 SHA-256 일치: carrot-vehicle-journal.js `03cfed5b8c77`, carrot-journal-design.js `f66e2372f66c`. DB·사진·설정·Python·수신기·Comma 수정 및 HA 재시작·릴리즈 발행 없음.
- 실제 사용자 Chrome HTTPS 차계부를 새로고침하고 상세 기록 11월/10월을 확인했다. 10월 30행에서 진단 컨트롤 0개·일반 분류 30개를 확인하고 장소/금액/수정·삭제 버튼 렌더링을 시각 검증했다. 최초 기존 탭의 연결 끊김은 새로고침 후 정상 로딩됐다. 등록 패널과 하위 모듈의 Network URL 개별 추출은 미실시다.
- 로컬 node --check 및 합성 전체 모듈 Chromium 1280/390/320px의 진단 제거·분류/장소·수정창 통과. 기존 browser-check.cjs는 변경 전 HEAD에서도 jIcon 미정의로 실패한다. 하네스 아이콘을 메모리에서 보완한 추가 실행도 기존 저장 검증에서 actual_krw 미정의로 실패하여 전체 회귀 통과로 보고하지 않는다. 테스트 파일은 수정하지 않았다.
- 승인된 로컬 검토 HTML은 검토용으로 유지하며 운영 배포/커밋에는 포함하지 않았다. 다른 미커밋 작업과 변경 기록은 보존한다.

## 2026-11-06 — 상세 기록 위치 디버깅 UI 제거

- 커밋 제목: vehicle-journal: remove temporary location diagnostic UI
- 사용자 프리뷰 승인 후 상세 기록의 `주소만`·위치 조회 실패/대기 배지, 펼침 진단 패널, 진단 정보 복사, 전용 이벤트·상태·CSS를 제거한다. 일반 분류·장소·수정/사진 조작을 유지한다. 자동 위치 조회·재시도·저장 및 진단 API/DB는 변경하지 않는다.
- 관련 파일: frontend/carrot-vehicle-journal.js, carrot-journal-design.js. 같은 세션 동안 별도 작업에서 자동 충전 수정 6aeed30/배포 기록 2896421이 커밋되어 이를 보존하며, 이번 diff는 진단 UI 제거에 한정한다.
- 검증: 승인 전 실제 모듈 합성 프리뷰에서 기존 배지 11개 → 제거 후 0개, 1280/390/320px 및 pageerror 없음 확인. 프로덕션 node --check 및 실제 전체 모듈 Chromium 1280/390/320px에서 진단 UI 없음·분류/장소 표시·기록 수정창 열기 통과, pageerror 없음. 기존 browser-check.cjs는 제거 전 HEAD에서도 jIcon 미정의로 타임아웃(테스트 하네스 문제).
- 배포: main 최신 동기화 확인. 커밋·푸시·HA 백업/직접 반영 준비 중, 실제 HA 브라우저 적용은 미확인. 새 릴리즈·태그 없음.

## 2026-11-06 — 상세 기록 위치 디버깅 UI 제거 프리뷰 준비

- 요청: 상세 기록의 임시 `주소만` 등 위치 진단 표시 제거. 배지·진단 펼침·복사 UI와 관련 프론트엔드 코드가 대상이며 위치 자동 조회·저장·일반 기록 수정은 유지한다.
- 조사: carrot-vehicle-journal.js의 locDiagPill/locDiagPanel 및 관련 이벤트를 확인했다. 해당 파일·백엔드·변경 기록에 기존 미커밋 작업이 있어 보존한다.
- 관련 파일: vehicle-journal/review-remove-location-debug.html. 기존 진단 검토 하네스의 전체 실제 모듈과 합성 데이터를 재사용하며 제거 전후를 전환한다. 프로덕션 파일 미수정.
- 검증/배포: 프리뷰 실행 검증 준비 중. 사용자 프리뷰 승인 전 커밋·푸시·HA 반영·릴리즈 없음. 시작 git pull --ff-only는 .git/FETCH_HEAD 쓰기 권한 제한으로 실패했다.

## 2026-11-06 — 자동 충전 기록 수정 6aeed30 HA 직접 반영

- 커밋 6aeed30b88a1f37152e373227a9df02c005c3f50을 main에 푸시했다. 다른 작업의 변경 기록/미추적 프리뷰를 분리·보존했다. 원격 main 대비 미푸시 커밋 0 확인.
- HA 기존 4개 파일이 직전 Git 기준 SHA-256과 일치하고 새 charge_edit.py가 없음을 다시 확인한 뒤 `/config/carrot_ha/deployment-backups/automatic-charge-edit-6aeed30b88a1/before/`에 원본을 백업했다. deployment.json에 원본/변경 해시와 배포 커밋을 기록했다.
- 5개 파일 설치 해시 앞 12자리: frontend/carrot-vehicle-journal.js a6f22cda7ac5, vehicle_journal/store.py 0c672f34b2b9, source.py 3747d484b938, station_stats.py 768d1293aed7, charge_edit.py a0d2a3840467. Python 소스 compile 검증 및 HA 로컬 `/carrot_ha_static/carrot-vehicle-journal.js` HTTP 해시 일치.
- 첫 실행은 Windows 명령 길이 제한으로 전송 전 중단, 두 번째는 root 소유 백업 디렉터리 권한으로 파일 변경 전 중단했다. SSH 표준입력·sudo -n 경로로 최종 반영했다. DB/사진/설정 수정 및 HA 재시작을 실행하지 않았다.
- 상태: 파일 반영·HTTP 제공 확인. Python 변경 적용을 위한 사용자 HA 재시작, 등록 패널 URL/하위 모듈의 운영 브라우저 확인 및 실제 기록 저장·재동기화 검증은 대기. 기존에 충전 당시 상태가 보존되지 않은 기록의 누적거리는 자동 복구할 수 없어 직접 입력한다. 새 릴리즈/태그 없음.

## 2026-11-06 — 자동 충전 기록 누적거리·충전량·단가 수정 반영 준비

- 사용자 프리뷰 승인 후 실제 화면/조회/저장 경로를 수정했다. 자동 결제와 연결된 충전 세션의 누적거리·배터리량·청구량을 묶어서 조회하고 수동 보정값을 우선 적용한다. 조회 후 누적거리를 빈 값으로 덮어쓰던 오류를 수정했다.
- 충전 당시 90초 이내 로컬 상태에서 누적거리를 복원한다. 최초 1회 이관 후 새 충전 세션만 조회하며, 과거 상태가 만료되어도 이미 보존한 거리는 유지한다. 측정이 없거나 오래된 값/다른 차량 값은 미확인으로 남긴다. 수신기/Comma 요청·수정 없음.
- 수정창에 자동 원본 거리·배터리 충전량·단가를 안내한다. 누적거리·청구 충전량·단가를 편집하며 배터리량을 청구량으로 자동 복사하지 않는다. 수동 단가는 원장에도 표시하며 자동 원본과 보정값을 분리한다. 금액은 기존 charge_payment 내구성 큐를 유지한다.
- 관련 파일: frontend/carrot-vehicle-journal.js, vehicle_journal/store.py·source.py·station_stats.py·charge_edit.py, vehicle-journal/tests/test_payment_sync.py·record-edit-layout.cjs, review-automatic-charge-edit.html.
- 검증: node --check 통과. 실제 화면 Chromium 320/360/390/430/1280px 입력/위치/삭제 회귀 및 자동 거리/배터리·청구량 구분/단가/보정 저장·재열기 통과. 합성 DB 차계부 Python 110건 중 108 통과, 기존 NAS 백업 POSIX 디렉터리 fsync 2건은 Windows PermissionError(이번 수정 대상 아님). UTF-8 모드 및 임시 DB 정리 전 gc.collect로 Windows 테스트 환경 보완. 신규 수정 동기화·누락/0·차량 격리·상태 보존 검증 통과.
- 배포 사전 확인: HA 기존 4개 파일 SHA-256이 현재 HEAD와 일치, charge_edit.py 부재 확인. 커밋/푸시 후 5개 파일 백업·직접 반영 예정. 운영 DB를 직접 수정하지 않는다.
- 상태: 새 릴리즈/태그 없음. HA 반영 및 사용자 재시작·실사용 저장 확인은 아직 대기. 이전 프리뷰 조사와 기타 작업 변경은 보존한다.

## 2026-11-06 — 자동 충전 기록 수정값 누락 조사·프리뷰 준비

- 요청: 자동 충전 기록의 계기판 누적거리·충전량·단가 표시 및 수동 보정.
- 확인: store.py 조회 후 odometer_km을 input 값으로 덮어쓰며, 자동 결제 expense의 연결 mobility 수량을 수정 입력으로 투영하지 않는다. openRecord는 billed_charge_kwh·unit_price 표시값을 입력에 연결하지 않는다. 금액은 charge_payment 연결 경로로 수정하며 원본/수동 보정을 분리해야 한다.
- 관련 파일: custom_components/carrot_ha/vehicle_journal/store.py, station_stats.py, frontend/carrot-vehicle-journal.js(읽기 조사), vehicle-journal/review-automatic-charge-edit.html(합성 프리뷰).
- 프리뷰 검증: Edge Chromium 1280/390/320px 가로 넘침 없음, 누적거리 45,678 표시 및 45,680·36.5 kWh·338원 수정/저장/재열기 통과(합성 응답). 운영 DB 저장·동기화는 미검증. 로컬 검토 주소 http://127.0.0.1:8766/vehicle-journal/review-automatic-charge-edit.html.
- 상태: 프로덕션 미수정·미배포·릴리즈 없음. 프리뷰 승인 후 실제 조회/저장/재동기화 검증 예정. 기존 CHANGELOG.md 및 untracked 다른 작업 보존. git pull --ff-only: 최신 상태.

## 2026-11-06 — 오픈파일럿 사용 통계: Comma 업데이트 확인

- 읽기 전용 확인(UTC 05:29): Comma 최신 상태의 실행 커밋이 dbfaa535(carrot-wip-model_selector-ha)이며 assist 수집기 7862875를 포함한다(comma_git_measured_at UTC 05:28:22). 재부팅 뒤 상태 기록이 계속 수신된다(UTC 05:29:19, 주차 중).
- 아직 주행이 없어 assist 도착·HA 저장·값 분할은 미확인. 다음 주행 후 확인한다. 코드·설정·DB 변경 없음.

## 2026-11-06 — 오픈파일럿 사용 통계: 첫 주행 수집 확인(미수집, Comma 미업데이트)

- 읽기 전용 확인(UTC 05:21): HA 영구 테이블은 0행이다. 최근 주행 5건(최신 UTC 00:19 종료, 368.8m)의 수신 앱 응답에 assist 항목 자체가 없어, Comma가 보낸 원본에 assist가 없었다.
- 원인: Comma 최신 상태(comma_git_measured_at UTC 05:19:53)의 실행 커밋이 11ac6aa1이다. assist 수집기는 그다음 커밋 7862875에 있다. 원격 carrot-wip-model_selector-ha는 dbfaa535이며 7862875를 포함한다(그 위에 7da0657b indicator 정리, dbfaa535 자동 동기화). Comma의 git pull·재부팅이 아직 적용되지 않았다.
- 코드·설정·DB 변경 없음. 사용자 Comma 업데이트 후 재확인 필요.

## 2026-11-05 — 오픈파일럿 사용 통계: HA 재시작 확인·Comma 브랜치 병합

- HA 재시작 확인(읽기 전용): 사용 중인 기록 DB 01M23RJD…(414MB)에 assist_trips·assist_buckets·assist_streaks·assist_meta가 생성됐다(모두 0행, 아직 assist 주행 없음). 재시작 뒤에도 상태 기록이 계속 저장되어(UTC 11:47:16, 확인 시각 11:48:34) 바뀐 put_cloud 경로에서 동기화가 정상이다. HA 코어 로그는 비대화형 SSH의 `ha core logs`가 출력하지 않아 확인하지 못했다. websocket 응답은 미확인.
- Comma: openpilot `carrot-ha-assist-stats`의 7862875를 carrot-wip-model_selector-ha에 빨리 감기로 병합했다(11ac6aa1..7862875). 정정: 앞선 기록의 기준 커밋 1bfc105a는 틀렸고 실제 기준은 11ac6aa1이다. 푸시 전 test_assist_stats·test_trip_measurements·test_outbox_lanes·test_param_polling을 다시 통과했다.
- 수신 앱 0.1.5 실행 중(공개 /health). 사용자 Comma `git pull --ff-only`·재부팅 대기. 실차 첫 주행의 assist 도착·HA 저장은 미확인. 릴리즈 없음.

## 2026-11-05 — 오픈파일럿 사용 통계(5306594) HA 직접 반영

- CI 성공 확인: https://github.com/helico717/carrot-ha/actions/runs/42020031513 (regression, radar-ha-python).
- 반영 전 HA의 storage.py·__init__.py SHA-256이 5306594^와 일치했고, assist_stats.py·assist_ws.py는 없었다. `/config/carrot_ha/deployment-backups/assist-5306594/before/`에 백업하고 SHA256SUMS.before로 검증했다.
- 커밋 5306594의 파일을 staging에 올려 HA 서버 Python으로 문법을 검사한 뒤 root:root 644로 반영했다. SHA-256 앞 16자리가 커밋과 일치한다: assist_stats 6ed4e8473ec2c138, assist_ws 58c5076c4fc41658, storage 749eb9855810c533, __init__ 2f6cbcdf06c63012. 남은 임시 파일 없음.
- 수신 앱 공개 /health가 0.1.5를 반환했다(사용자가 이미 업데이트).
- 사용자 HA 재시작 대기. 재시작 뒤 영구 테이블 생성·보충 처리·websocket 응답은 미확인. Comma 변경은 아직 병합 전이라 새 통계는 아직 들어오지 않는다. 릴리즈 없음.

## 2026-11-05 — 오픈파일럿 사용 통계: HA 영구 저장·집계 (HA 반영 대기)

- 변경: 새 모듈 assist_stats.py가 주행별 assist를 영구 테이블 assist_trips·assist_buckets·assist_streaks·assist_meta에 저장한다. purge_expired(주행 90일·상태 14일)는 이 테이블을 지우지 않는다. 주행 이벤트 저장(put_cloud)과 같은 트랜잭션에서 기록하므로 실패한 페이지는 통째로 다시 받고, 같은 주행은 한 번만 집계된다. 같은 주행 재전송 규칙은 수신 앱과 같다(처음 유효값 유지, 다른 값은 충돌 1회). 통계 시작 이후 assist 없는 주행은 측정 안 된 거리로 상태 모름에 더한다. 집계는 HA 시간대의 일·주·월·연·전체 기간이며, 사용 비율 = 보조 ÷ (보조 + 수동), 사용한 날은 보조 1km 이상, 현재·최장 연속 사용 일수, 기간별 최장 연속 거리(시작일 귀속), 주행거리계 기준 기록되지 않은 거리(추정)를 낸다. 결과는 기기·기간별로 캐시한다(주행 변경 시 무효화, 그 외 60초). websocket carrot_ha/assist/summary를 추가했다. HA 시작 시 이 버전 이전에 받은 주행의 cloud_raw_trip 안 assist를 보충한다.
- 이유: docs/OPENPILOT_ASSIST_STATS_PLAN_2026-11-05.md 8-3절. 계획서에 구현 세부·용량 측정·남은 위험(DB 파일 삭제·재설치 시 함께 사라짐, NAS 백업 미포함)을 기록했다.
- 관련 파일: custom_components/carrot_ha/assist_stats.py(신규), assist_ws.py(신규), storage.py, __init__.py, tests/test_assist_stats.py(신규), docs/OPENPILOT_ASSIST_STATS_PLAN_2026-11-05.md.
- 검증: test_assist_stats 12개 통과. 수신 앱 0.1.5 실제 출력 → HA 피드 파서 → 저장소 경로로 돌렸다(사용 비율 80% 두 예, 분모 0, 보관 기간 삭제 뒤 유지, 재전송·충돌, 페이지 중단 후 재수신 1회 집계, 한국 자정·월말 분할과 연속 구간 시작일 귀속, 1km 사용한 날·연속 일수, 시작 전·후 측정 안 된 주행, 보충, 기록되지 않은 거리, 무효 assist, 캐시). 이 PC에 tzdata가 없어 테스트에서만 Asia/Seoul을 고정 UTC+9로 대체했다. 전체 Python 테스트 59개 파일을 변경 전후로 비교해 새 파일 외에 결과가 같다. 16개 파일은 변경 전부터 이 PC 환경 문제(tzdata 없음, import 경로, Windows 파일 잠금 등)로 실패한다. 주행 저장 경로를 거치는 test_trip_repair·test_trip_energy·test_trip_boundary_truth·test_rolling_energy·test_monthly_energy·test_range_efficiency는 tests 경로를 넣어 101개 통과. 1년 가정 측정: 영구 테이블 약 2.7MB/년, 1년치 집계 약 21ms.
- 배포 상태: 커밋·푸시만 했다. 버전 상승·릴리즈 없음(2026-10-21 정책). HA SSH 직접 반영과 사용자 HA 재시작 대기. Comma 변경은 병합 전. 실제 HA·실차 검증 없음.

## 2026-11-05 — 오픈파일럿 사용 통계: 수신 앱 0.1.5 (HAOS 앱 업데이트 대기)

- 변경: 수신 앱이 주행 기록의 `assist`를 검증해 `/api/trip-changes` 응답에 `assist`·`assist_error`·`assist_conflicts`로 내보낸다. `assist`가 없는 과거 주행의 응답 형식은 바뀌지 않는다. 합계 검증은 휠 적산 기준 거리(basisDistanceM)와 비교하며, 최종 distanceM과는 비교하지 않는다. 15분 경계 정렬, 연속 구간 범위, 버전 1만 허용한다. 같은 주행 재전송 때는 처음 받은 유효값을 지킨다: 없는 본문은 기존 값 유지, 다른 값은 기존 값 보존 후 서로 다른 본문마다 충돌 1회 기록, 같은 충돌 재전송은 새 리비전이 아님. 저장된 값이 무효일 때만 새 값으로 바꾼다. 잘못된 통계도 주행 기록 자체는 거부하지 않는다.
- 이유: docs/OPENPILOT_ASSIST_STATS_PLAN_2026-11-05.md 8-2·9절. 배포 순서 수신 앱 → HA → Comma의 첫 단계.
- 관련 파일: addons/carrot_receiver/receiver.py, config.yaml(0.1.5), CHANGELOG.md, tests/test_direct_receiver.py.
- 검증: test_direct_receiver 14개 통과(새 4개: 전달·과거 형식 유지, 재전송 보존·충돌, 무효값 5종, 무효 저장값 교체). openpilot carrot-ha-assist-stats 7862875 엔진이 만든 3시간 혼합 주행(15분 경계·공백·재시작·연속 구간 58개, 약 8KB)의 assist가 수신 앱 검증을 통과했다. 수신 앱 관련 test_direct_receiver_setup·test_receiver_diagnostics·test_receiver_recovery와 test_incremental_sync·test_history_cache 통과, test_cloud_live는 UTF-8 모드에서 통과. test_receiver_options는 이 PC에 voluptuous가 없어 실행되지 않았고, 변경 전에도 같았다.
- 배포 상태: 커밋·푸시만 했다. 사용자가 HAOS 앱 스토어에서 0.1.5로 업데이트해야 하며, HA 통합은 아직 assist를 저장하지 않는다. Comma 변경은 병합 전. 릴리즈·HA 직접 반영 없음.

## 2026-11-05 — 오픈파일럿 사용 통계: Comma 수집기 구현(기능 브랜치, 미배포)

- 변경: openpilot `carrot-ha-assist-stats` 브랜치 `7862875`(기준 carrot-wip-model_selector-ha `1bfc105a`). 수집기가 1초마다 휠 속도로 적산하는 거리 증가분을 직전 carControl 표본(수동/조향만/가감속만/둘 다)에 귀속하고, selfdriveState.enabled는 시스템 활성 거리로 따로 집계한다. 2초 넘게 끊긴 신호와 거리 공백은 상태 모름으로 남기고 연속 구간을 끊는다. 켜짐·해제는 1초 표본 기준이며 공백·재시작 뒤 재관측은 세지 않는다. 주행 기록에 `assist`(휠 적산 기준 거리, 다섯 칸, UTC 15분 소계, 100m 이상 연속 구간 최대 50개, 최장 연속 거리)를 추가했다. 기존 텔레메트리 enabled(10초)는 그대로다.
- 이유: docs/OPENPILOT_ASSIST_STATS_PLAN_2026-11-05.md 구현 1단계. 계획서에 실제 추가 항목 longestStreakM·longestStreakS를 기록했다.
- 관련 파일(openpilot): selfdrive/carrot/ha/engine.py, collector.py, tests/test_assist_stats.py.
- 검증: 새 인수 테스트 9개 통과(GPS 없는 터널, 표본 귀속·전환 횟수, enabled=false·latActive=true, 보조 중 신호 단절, 하향 주행거리계 복구 시 기준 거리 유지, 재시작, 15분 경계 시간 비율 분할, 연속 구간 상한, 제어 신호 없음). Windows 로컬에서 데몬 테스트 파일 25개를 변경 전후 비교했고 결과가 같다. camera_probe·camera_upgrade·direct_connection·driving_logs·sync_workflows 5개는 변경 전부터 같은 실패다. 실차 검증 없음.
- 배포 상태: 의도적으로 carrot-wip-model_selector-ha에 병합하지 않았다. 정정: 처음 기록한 "수신 앱이 ACK 후 원본을 지워 값을 잃는다"는 틀렸다. 수신 앱은 HA가 받아 간 주행을 90일이 지난 뒤에만 지운다(receiver.py 보관 정리). Comma를 먼저 올리면 assist는 수신 앱 원본에 90일간 남지만, 현재 수신 앱 응답과 HA 저장 경로가 assist를 넘기지 않아 HA에는 저장되지 않는다. 수신 앱·HA 구현 후 이미 받아 간 주행을 다시 읽는 1회 보충 동기화가 있어야 90일 안의 값을 살릴 수 있다. 현재는 수신 앱·HA 반영 후 병합하는 순서를 유지하며, 병합 뒤 사용자가 Comma에서 git pull·재부팅한다. 릴리즈·HA 직접 반영 없음.

## 2026-11-05 — 오픈파일럿 사용 통계 백엔드 구현 계획서

- 테슬라 FSD 통계와 같은 주행별·누적 오픈파일럿 사용 통계(보조 거리, 수동 거리, 사용 비율, 최장 연속 거리, 연속 사용 일수)를 위한 백엔드 계획서 docs/OPENPILOT_ASSIST_STATS_PLAN_2026-11-05.md를 작성했다.
- 근거: Comma 수집기는 selfdriveState.enabled를 30초 텔레메트리에만 싣고 trip에는 보조 상태가 없어 현재 데이터로는 정확한 통계가 불가함을 openpilot carrot-wip-model_selector-ha 1bfc105a5와 대조해 확인했다. HA 주행 기록 90일·상태 기록 14일 삭제로 영구 요약 테이블이 필요함도 확인했다.
- 설계: carControl latActive/longActive 4칸 판정, 휠 적산 기준 거리와 최종 거리 분리(복구 차이 음수 허용), 사용 비율 = 보조 ÷ (보조 + 수동), 1초 표본 기준 켜짐·해제, UTC 15분 소계, 같은 주행 재전송 시 최초 유효값 보존, 원본·요약 동일 트랜잭션 후 커서 전진, 배포 순서 수신 앱 → HA → Comma. Astra 1·2차 검토 반영.
- 사용자 결정: 사용한 날 1km 이상, 100m 미만 주행 미전송 유지, 과거 30초 추정치 숨김(같은 날 보여 줌에서 변경), 해제 위치·이유 미기록.
- 문서만 추가. 실행 코드·버전·릴리즈·HA 직접 반영·Comma 변경 없음. 구현·테스트는 미착수.

## 2026-11-05 — IQ.drive 실행 코드 제거(66f7162) HA 직접 반영

- CI 성공 확인: https://github.com/helico717/carrot-ha/actions/runs/42012464437
- 반영 전 HA의 대상 8개 파일 SHA-256이 0cd121a와 모두 일치함을 확인했다. `/config/carrot_ha/deployment-backups/iq-runtime-66f7162/before/`에 백업하고 SHA256SUMS.before로 검증했다.
- 6개 파일을 root:root 644로 반영하고 `driving_logs/pilot.py`, `frontend/carrot-pilot-pause.js`를 삭제했다. SHA-256 앞 16자리가 커밋과 일치한다: __init__ 0c444c20c5aa60bc, http ead55838a210f349, transfer_policy 52a7805fd7e7ee7c, logs-card c7c4d201085b7899, parameter-tuning-card d32d1abc438d51b0, terminal-card 87641a3eee11b897. `/carrot_ha_static/`의 세 카드 응답도 같은 해시이고, carrot-pilot-pause.js는 HTTP 404. 남은 pilot 참조 없음.
- 첫 시도는 Windows의 `git archive`가 CRLF로 바꾼 파일을 올려 해시가 달랐다(동작에는 영향 없는 줄바꿈 차이). 곧바로 Git blob 원본으로 다시 반영해 일치를 확인했다.
- Python 백엔드 변경은 HA 재시작 후 적용된다. 재시작과 실제 화면 확인은 사용자 대기. 원복은 백업 폴더 파일을 원위치로 복사하면 된다. 릴리즈 없음.

## 2026-11-05 — HA 실행 코드의 IQ.drive 분기 제거

- 사용자 요청으로 IQpilot 정리를 실행 코드까지 확대했다. fdb0c5a·8561893·6f38582의 실행 코드 부분만 되돌렸다.
- 제거: `driving_logs/pilot.py`, `frontend/carrot-pilot-pause.js`, devices API의 `pilot_software` 필드, 파라미터 대기열과 주행 로그 세션의 `iq-` 브랜치 409 거부, 장치 전송 정책의 IQ 일시정지(`device_policy_for`는 `policy_for`로 대체), 로그·파라미터 카드의 30초 IQ 재확인과 흐림 화면, 터미널 카드의 IQ.drive 업데이트 버튼 분기(Pull은 항상 당근 명령). 관련 테스트 `test_pilot_pause.py`와 IQ 케이스도 제거했다.
- 영향: Comma가 당근 브랜치일 때 동작은 이전과 같다. 로그 카드의 30초 장치 재조회가 사라져 HA 요청이 줄어든다.
- 검증: 이 PC에서 params-card·terminal-git-status·대시보드 회귀 4종과 driving_logs Python 묶음이 통과했다. 남은 Python 10개·JS 6개 실패는 수정 전 origin/main에서도 똑같이 실패하는 Windows 환경 문제다. Linux CI와 HA 직접 반영 결과는 아래 반영 기록에 남긴다. 릴리즈 없음.

## 2026-11-05 — IQpilot 이식 도구·문서 정리

- 사용자가 IQpilot을 더 이상 사용하지 않고 앞으로도 사용할 계획이 없다고 알려 IQ HA 이식 작업을 정리했다. openpilot `carrot-wip`의 IQ HA upstream refresh가 IQ.OS 4.9.9.9.2→4.9.9.9.4 요구 변경으로 매일 NEEDS_REVIEW(종료 코드 3) 실패 알림을 보내던 것이 계기다.
- 삭제: `compat/iqpilot/`, `scripts/{build_iqpilot_ha_candidate,fetch_iqpilot_can_runtime,prepare_iq_ha_recovery,prepare_iqpilot_ha,refresh_iq_ha}.py`, `tools/iq-ha-restore.py`, `tests/test_iqpilot_*.py`(8)·`test_iq_recovery_kit.py`·`test_iq_restore_transport.py`·`test_refresh_iq_ha.py`, `docs/IQPILOT_HA_*.md`(6), `preview/iq-pause/`·`preview/iq-pull/`와 `.claude/launch.json` 항목. `tools/receiver-recovery.py`의 `--iqpilot` 옵션과 해당 테스트도 제거했다.
- 유지: HA 실행 코드의 IQ 브랜치 감지·일시정지(`driving_logs/pilot.py`, `carrot-pilot-pause.js`, 터미널 카드 IQ 분기)는 `iq-` 브랜치에서만 동작하므로 이번에 바꾸지 않았다. 과거 변경 기록·평가·감사 문서와 원격 `iq-ha` 브랜치도 보존했다. 전체 내용은 Git 이력에서 복원 가능하다.
- 검증: 이 PC에서 test_receiver_recovery·test_pilot_pause와 대시보드 회귀 4종(12건)이 통과했다. 전체 Python 묶음에서 실패한 10개와 vehicle-journal, terminal-git-status는 수정 전 origin/main에서도 똑같이 실패해 Windows 환경 문제로 판단했다. Linux CI 결과로 최종 확인한다. HA 실행 코드 변경이 없어 버전 상승·릴리즈·HA 반영·재시작은 필요 없다.

## 2026-11-05 — 테마 되돌림(065eaac) HA 직접 반영

- 반영 전 HA의 carrot-dashboard-ko/en.js, carrot-vehicle-journal.js, carrot-charge-payment.js, carrot-journal-panel-runtime.js, carrot-ui-theme.js SHA-256이 6306496과 모두 일치함을 확인했다. 6개 파일을 `/homeassistant/carrot_ha/deployment-backups/ui-theme-revert-065eaac/before/`에 백업하고 SHA256SUMS.before로 검증했다.
- 065eaac의 5개 파일을 root:root 644로 반영하고 carrot-ui-theme.js를 삭제했다. HA 파일과 `/carrot_ha_static/` HTTP 응답의 SHA-256 앞 12자리가 커밋과 일치: ko a744aaaf2350, en b6202ed5f788, journal f87742e69c37, charge-payment aab0e2aa439b, journal-panel-runtime 20951b10481b. carrot-ui-theme.js는 HTTP 404.
- 첫 시도는 HA 로그인 셸이 변수를 단어 분리하지 않아 백업 복사에서 중단됐다(운영 파일 변경 없음). sh 스크립트로 다시 실행했다.
- 프런트 버전 값(manifest+JS 해시)은 HA 시작 시 계산되므로 HA 재시작 전까지 갱신되지 않는다. 브라우저 강력 새로고침(Ctrl+F5)으로 적용하며, 이전 화면이 남으면 HA 재시작이 필요하다. 실제 HA 화면 확인은 사용자 대기. 원복은 백업 폴더 파일을 frontend로 복사하면 된다. 릴리즈 없음.

## 2026-11-05 — HA 테마 연동·포인트 색상 설정 전체 되돌림(아카이브 보존)

- 사용자 요청으로 통합 화면 설정(HA 테마 따르기/라이트/다크 3단 모드, 포인트 색상, 공용 팝업 스킨, 차계부 라이트 팔레트)을 모두 되돌렸다. 대상 커밋: e0fd23a, 696ff48, 0d308ee, c76a571, b7cdd57, 6306496.
- 방법: 기능 파일을 직전 커밋 e84a87b 상태로 복원했다. carrot-dashboard-ko/en.js, carrot-vehicle-journal.js, carrot-journal-panel-runtime.js, carrot-charge-payment.js, tests/dashboard-dependency-version.test.mjs 복원. carrot-ui-theme.js, docs/dashboard-theme-settings.md, preview/theme-style/, scripts/ui-theme-rollback*.sh, tests/ui-theme.test.mjs 삭제. 변경 기록은 이력 보존을 위해 되돌리지 않았다. 11-03 차량 색상 피커(335fdbf)는 범위 밖이라 유지했다.
- 아카이브: 원격 브랜치 `archive/ui-theme-2026-11-04`(6306496)에 전체 작업을 보존했다. 재사용 시 `git cherry-pick e0fd23a 0d308ee b7cdd57` 또는 해당 브랜치에서 파일을 가져온다.
- 검증: e84a87b와 기능 파일 diff 없음(변경 기록만 차이). 대시보드 회귀 테스트 4개 파일 13건 통과.
- 배포 상태: Git 커밋·푸시만 수행했다. HA에는 아직 테마 코드(b7cdd57판)가 직접 반영된 상태이며 HA 직접 반영·릴리즈는 하지 않았다.

## 2026-11-05 — 실제 HA 테마 23종 점검에서 찾은 버그 4건 수정
- 배포 상태: 커밋 b7cdd57을 HA에 SSH 직접 반영(2026-11-05). 반영 전 ko·en·ui-theme(0d308ee판)이 HA 파일과 일치함을 확인하고 /homeassistant/carrot_ha/deployment-backups/ui-theme-fix2-b7cdd57/before 에 백업(rollback.sh 포함, 이 수정만 되돌림). 반영 후 HA 파일·HTTP 응답 SHA-256 앞 12자리가 커밋과 일치: carrot-ui-theme.js 5fff5a9e8cb1, carrot-dashboard-ko.js 6f4cd5fd1b8b, carrot-dashboard-en.js a7241e85c942, 프런트 버전 0.9.0-d08f92110a03. 재시작 불필요. 릴리즈 없음.
- 실제 HA 재측정: 버그1 설정 창이 라이브 갱신 약 22초 동안 모달·고정 위치(y=50) 유지, 강제 render()도 미뤘다가 닫을 때 반영. 버그2 visionOS·Liquid Glass 라이트·Graphite·E-ink Dark가 모두 글자색 극성(dark)으로 판정, 글자 변수가 테마 값. 버그3·4 차계부 HA 기본 라이트 글자 대비 미달 178→0, 기록 유형 팝업 10→0, 상단 버튼 어두운 글자+10% 오버레이, Frosted Glass Light 0, 다크 변동 없음(46). 남은 항목(수정 대상 아님): 차계부 설정 창 2~16건, 배경 사진 테마·Graphite 다크의 보조 글자 3~4대 대비, 대시보드 라이트 팔레트의 기존 문제.

- 점검: 사용자 Chrome(Claude in Chrome)으로 HA에 설치된 테마 23개를 라이트·다크로 전환하며 대시보드·차계부의 글자 대비(자동 측정)와 화면을 확인. 결과 목록은 대화에 정리(수정은 사용자 승인 후).
- 버그1 설정 창이 화면 갱신 때 모달에서 풀려 카드 아래로 밀림 → 열려 있는 동안 render()를 미루고 닫을 때 반영, DOM이 교체돼도 다시 모달로 연다(carrot-dashboard-ko/en.js render 가드, carrot-ui-theme.js).
- 버그2 visionOS 라이트·Liquid Glass 라이트·단일 다크 테마(Graphite)에서 글자 섞임 → 모드 판정을 테마 글자색 극성으로, `--ink/--muted/--line` 우선순위 상향.
- 버그3 차계부 상단 버튼(☰·설정)이 라이트에서 안 보임 → 패널 변수가 카드 범위 변수를 참조하던 것을 수정.
- 버그4 차계부 라이트 글자 대비(약 178개 요소가 1.0~1.3) → 글자색 규칙 변환 + 대비 보호막. 합성 데이터·패널 구조 흉내 환경에서 HA 라이트 따라가기 221건→0~7건, 고정 라이트 0건.
- 관련 파일: custom_components/carrot_ha/frontend/{carrot-ui-theme,carrot-dashboard-ko,carrot-dashboard-en}.js, tests/ui-theme.test.mjs(10개), docs/dashboard-theme-settings.md, preview/theme-style/audit.js.
- 검증(로컬): 신규 ui-theme 10개·의존성·lazy-runtime·view-state·live-loading·charge-payment 통과, 기존 실패 5건(camera-360·charging-curve·debug-freshness·motion-status·range-c3)은 변경 전과 동일. 배포 상태: 커밋 후 HA 직접 반영 예정(릴리즈 없음). 미확인: 실제 HA에서의 재측정.

## 2026-11-05 — 차계부 라이트 고정이 다크로만 보이던 버그 수정
- 배포 상태: 커밋 0d308ee를 HA에 SSH 직접 반영. 반영 전 carrot-ui-theme.js(e0fd23a판)·carrot-journal-panel-runtime.js를 /homeassistant/carrot_ha/deployment-backups/ui-theme-fix1-0d308ee/before 에 백업(rollback.sh 포함, 이 수정만 되돌림). 반영 후 HA 파일·HTTP 응답 SHA-256: carrot-ui-theme.js 0180806f9e7e, carrot-journal-panel-runtime.js 4008038b6c81, 프런트 버전 0.9.0-618e7c1e84b2. 재시작 불필요(새로고침).
- 사고 기록: 첫 반영 시도에서 배포 스크립트의 반복문이 파일 이름을 한 문자열로 처리해(zsh 단어 분리 없음) 원격 carrot-ui-theme.js가 약 1분간 0바이트가 되었다(그동안 대시보드·차계부가 새 모듈 로드 실패 가능). 백업 해시와 새 파일로 즉시 재반영해 크기·해시를 검증했다. 이후 배포는 파일 이름을 명시한 반복문만 쓴다.

- 사용자 보고(실제 HA): 차계부에서 라이트/다크를 골라도 계속 다크로만 보임. 원인 2가지: (1) 차계부 라이트 고정을 "기존에 다크만 있음"으로 처리해 다크를 유지하도록 구현했음, (2) HA 사이드바 패널 래퍼(carrot-journal-panel-runtime.js)가 배경·머리글 색을 다크 고정값으로 하드코딩해, 카드 안을 바꿔도 페이지 바깥 틀이 항상 다크였음.
- 변경: 차계부 라이트 고정 팔레트 추가(기본값+HA 라이트와 같은 오버레이 스타일, 히어로 카드는 어두운 포인트 색 면+밝은 글자 유지, 라이트에서 밝은 강조 글자색은 어둡게), 패널 래퍼 색을 CSS 변수(`--cui-panel-*`, 기본값은 기존 다크)로 바꾸고 모듈이 모드에 맞춰 설정.
- 관련 파일: custom_components/carrot_ha/frontend/{carrot-ui-theme,carrot-journal-panel-runtime}.js, docs/dashboard-theme-settings.md.
- 검증(로컬, 패널 구조 흉내): 라이트 고정에서 패널 배경 rgb(244,246,248)·카드 흰색·글자 어두움, 다크 고정은 기존 다크, 기본값은 HA 테마 따라가기. 실제 HA 화면 검증은 사용자 로그인 필요(에이전트는 HA 로그인 불가).

## 2026-11-05 — 화면 설정(모드 3선택·포인트 색·통일 팝업) 구현 — HA 직접 반영 준비

- 사용자 요청: 프리뷰(preview/theme-style)로 승인한 설계를 HA에 반영하고, 중대한 문제 시 롤백할 수 있게 준비. 기본값=Home Assistant 테마 따라가기, 라이트/다크=기존 모드 재사용, 포인트 색은 모드와 무관, 카드 곡률 유지, 모든 팝업 같은 스킨.
- 변경: 공용 모듈 carrot-ui-theme.js 추가(포인트 색 엔진·설정창·팝업 스킨·비상 끄기). 대시보드 ko/en, 차계부, 충전 금액 팝업에 연결(각 몇 줄). 프리셋 3색(주황·보라·민트), HA 아이콘 견본, 차계부 기존 설정창에 "화면" 항목 추가. 라이트 모드 선택 안 된 날짜 라벨(#d1d5db) 대비 결함 수정.
- 관련 파일: custom_components/carrot_ha/frontend/{carrot-ui-theme,carrot-dashboard-ko,carrot-dashboard-en,carrot-vehicle-journal,carrot-charge-payment}.js, tests/{ui-theme,dashboard-dependency-version}.test.mjs, docs/dashboard-theme-settings.md, preview/theme-style/.
- 검증(로컬): 신규 ui-theme 7개 통과, 의존성 테스트는 신규 모듈 포함으로 갱신해 통과, 기존 node 테스트는 변경 전과 동일(camera-360·charging-curve·debug-freshness·motion-status·range-c3 5건은 변경 전에도 실패). 브라우저에서 운영 코드 하네스로 HA 테마 따라가기·라이트/다크 고정·포인트 색·설정창·충전 금액 팝업·차계부 화면 항목 확인. 프리뷰의 가독성 전수 검사(40,400건)에서 포인트 색 때문에 악화된 곳 0건.
- 배포 상태: 커밋 e0fd23a(main 푸시 완료)를 2026-11-05(HA 시계 11/04 16:49~) HA에 SSH 직접 반영했다. 반영 전 4개 파일(ko·en·차계부·충전 팝업)이 직전 커밋 e84a87b과 일치함(CRLF 제외)을 확인하고 /homeassistant/carrot_ha/deployment-backups/ui-theme-e0fd23a/before 에 백업(SHA256SUMS.before)했다. 반영 후 HA 파일·내부 HTTP 응답 SHA-256 앞 12자리가 커밋과 일치: carrot-ui-theme.js fa3051b143d2, carrot-dashboard-ko.js 9e616d9c75db, carrot-dashboard-en.js 46d2a17cd161, carrot-vehicle-journal.js 4c7bfa757a03, carrot-charge-payment.js 5528a76f50e7. 프런트 버전 해시가 0.9.0-f52224b3a520 으로 바뀌었다(재시작 불필요, 브라우저 새로고침으로 적용). 릴리즈 발행 없음.
- 롤백: `sudo sh /homeassistant/carrot_ha/deployment-backups/ui-theme-e0fd23a/rollback.sh`(백업 검증 후 복원, 새 파일 제거, 반영 후 해시 검사). 재배포 없이 끄기: 주소 끝 ?carrot_ui=off. 스크립트 사본: scripts/ui-theme-rollback.sh. 미확인: 실제 HA 화면(사용자 테마·실기기)에서의 동작은 사용자 새로고침 후 확인 대기.

## 2026-11-04 — 충전 기록 개선 CI 성공·운영 반영 대기

- Carrot 코드27e02e26baa3c905f6de484fa501912ab2404639의 충전전용 Linux CI41765211369 success, 결과기록 cc0872fff까지carrot-wip-model_selector-ha게시/원격확인. https://github.com/helico717/openpilot/actions/runs/41765211369
- HA코드/분석06cbfc5e733e2085ea34fb65917ff0f12e53d1ac의 Direct receiver validation41766513568 success(radar-ha-python/regression). https://github.com/helico717/carrot-ha/actions/runs/41766513568
- 확보한원본시계열로재생26건/충전량보존/구형partial정상출발패턴5건검증. 분석보고서는 docs/charging-history-analysis-2026-11-04.md. 상세29후보를모두완전세션이나완충으로간주하지않음.
- HA직접반영,차량설치/pull/재부팅,실차충전확인은미완료. 사용자VPN불안정으로내부HA SSH추가시도중단. 외부HTTPS API/기존웹터미널은가능경로지만현재인증·접속가능성미검증. 버전/태그/릴리즈없음. 별도사용자작업 .claude/launch.json·preview/theme-style/은본커밋에서제외.

## 2026-11-04 — Carrot 충전 기록기 Git 게시·VPN 미사용 상태

- 27e02e26baa3c905f6de484fa501912ab2404639를 helico717/openpilot의 carrot-wip-model_selector-ha에 게시하고원격SHA일치확인. 정상출발보존·실제관측공백사유·회귀시험·전용CI포함. IQ게시없음.
- 사용자가외부이동중집VPN불안정을알려내부HA SSH추가시도를중단. 확보한로컬익명시계열로분석/재생은계속가능. HA charge_costs.py 사유보존은아직운영미반영이며재시작/실차설치미완료. 외부HTTPS API와기존웹터미널가능여부는별도확인대상. 원본DB/과거partial플래그불변,새버전/태그/릴리즈없음.

## 2026-11-04 — 충전 기록 분석·Carrot partial 개선 검증 완료(게시 준비)

- 사용자 정정: IQpilot은 현재 사용하지 않으며 배포 브랜치는 carrot-wip-model_selector-ha. 11/2 설치 문서를 현재 상태로 잘못 간주했던 IQ 후보 준비를 철회했다. IQ 어댑터·빌더·시험 변경을 제거했고 IQ 브랜치 게시/기기 설치는 하지 않았다.
- 운영 archive와 압축 전/직접 수신기 전환 전 백업을 읽기 전용으로 통합했다. 중복 제거한 요약 후보68개에서 상세 후보29건(AC13/DC16) 확보. CAN없는 과거 기록은 사용자 지시대로 속도 추정 출처로 구분. AC30분미만 제외. 초기2kW 전후에서6kW로 상승하는 실제 사례도 확인. 상세 기준·제외 사유·AC/DC ETA 탐색 결과는 docs/charging-history-analysis-2026-11-04.md.
- 종료 후 실제 관측을 연결한26건을 수정 전/후에 재생: 과거partial5건에서 정상 종료 패턴 재현,26건 모두 계산 충전량 보존. archive 공백9건은 차량 수집 중단/원격 전송 누락을 구분할 수 없어 실제 장애로 단정하지 않음. 종료 미관측3건 보류. 원본 기록/플래그 수정 없음.
- Carrot CAN 기록기는 정상 출발을 이미 결손으로 보지 않음. 해당 회귀를 고정하고, 수집기 중단 중호출이 없었던 암묵적90초 초과 CAN측정 공백 및 잔량관측 공백 감지·partial_reasons를 추가. 같은 모드 복원 공백도 확인시간과 구분해partial보존. HA요약에도사유보존. ETA운영공식은변경하지않았다.
- 검증: Carrot충전20개·기존CAN기록9개·파라미터polling4개·HA결제/사유보존12개 통과. 전체Carrot121개는118통과/카메라2·sync1실패이며 별도수정전HEAD사본에서도동일3건재현. 신규실패로보거나전체통과로보고하지않음. Git게시·CI·HA직접반영은다음상태기록참조. 사용자기기pull/재부팅·실차충전확인은아직미완료.

## 2026-11-04 — 충전 partial 사유·수집 공백 감지 개선 진행

- 사용자가정상충전종료후즉시주행의partial오판개선과기존기록재생검증을요청. 현재CAN기록기는구형정상출발오판이이미없음을확인하고회귀검증추가. 실제수집중단후같은모드로복귀해도확인시간에공백을합산하지않으며재구성한결손은partial로보존, partial_reasons를중복없이저장. HA요약에도사유보존. IQ빌더어댑터와Carrot원본동일하게개선.
- 관련파일: compat/iqpilot/charge_recorder.py, scripts/{prepare_iqpilot_ha,build_iqpilot_ha_candidate}.py, tests/test_iqpilot_charge_quality.py, custom_components/carrot_ha/charge_costs.py, openpilot의charge_recorder.py·test_charge_quality.py. 상세상태는driving-logs/CHANGELOG.md.
- 검증/배포: 합성품질8개·HA충전통계포함12개·openpilot충전20개통과. 실기록재생·전체데몬·게시·CI진행중. 아직실차설치/재부팅/새릴리즈없음.

## 2026-11-04 — 과거 충전 분석 partial 플래그 의미 재검증

- 사용자 질문: 구형partial=true28건의 실제 사유 확인. collector/engine.py 및9/14·9/19 Git 이력에서 충전 중 측정창 초기화(최대240초 초과/이전표본없음/주행상태변경), 주행상태미확인,250kW초과 에너지 증가율에서partial을 설정함을 확인. 특히 정상 주차→주행 전환에서도 충전종료 처리 전 _sample_energy가partial=True를 붙일 수 있으며 합성Store로 재현.
- 따라서partial불리언만으로28건을 모두 결손으로 판단한 선별은 철회. 시작/종료 경과와duration_s 차이는26건이180초이내,2건이각약3.5분·86.1분. 이는 누락사유 확정이 아니라요약 정합성 검사임. 원본에사유코드가없어각건의정확한이유는미확정.15건은현재상세상태보관시작(9/20)이전종료,13건은이후. 실제공백/신호/에너지연속성으로재선별중.
- 사용자추가지시: 과거CAN모드없는기록은충전속도로추정분류. 추정출처를CAN확정과구분하고저출력급속의오분류가능성을명시.30분미만완속·실제불완전기록제외유지. 승인된HA읽기전용SSH성공,DB mode=ro/query_only. 운영코드/DB/재시작/릴리즈변경없음.

## 2026-11-04 — 과거 충전 기록 기반 ETA 분석 착수·제외 조건

- 사용자 요청: 보관된 실제 충전 기록으로 AC/DC ETA 개선안을 검증. 추가 지시: 완속30분 미만 및 불완전 기록은 분석에서 제외. 제외 건수/사유를 별도 집계하며 충전 종료를100% 도달로 취급하지 않는다.
- 분석 계획: 원본 세션 시작/종료 경계·CAN 모드·신선한 연속 측정 확인, 모드 혼재/긴 공백/무효 SOC·에너지/부분 기록 제외. CAN SOC 사용 가능 시기와 에너지 환산SOC 시기는 구분. 세션 단위로 과거/검증 기록을 나눠 시작 출력 상승·안정 구간·SOC별 속도 및80/100% 실제 통과 오차 비교. 초기 출력2kW 및 특정9kW를 고정 기준으로 두지 않는다. 공백/커버리지 수치 기준은 원본 수집주기 확인 후 확정.
- 접근 상태: 기존 서버 읽기 전용 SSH 확인 시 샌드박스 네트워크 제한, 승격 자동검토1건 시간초과. 다른 기존 HA 주소 확인도 자동검토 시간초과, 허용된1회 재시도 역시 시간초과로 실행 전 거절됨. 위험 판정이 아닌 검토 기한 만료이며 실제 SSH 명령은 실행되지 않음. 아직 과거 데이터 분석 결과/유효 세션 수/개선 효과 없음. 실행코드/운영DB/배포/재시작/릴리즈 변경 없음.

## 2026-11-04 — 기존 급속 커브·CAN 충전 모드 연결 재조사

- 사용자 지적을 확인: charging_mode.py는 실제 CAN 0xCF BMS mode4=AC/mode6=DC를 구분하고, 구형 수집기는0x503 요청 모드로 호환한다. vehicle.py는 이 모드를 상태·요금에 사용하지만 ETA 호출에는 전달하지 않는다.
- 이력: 9/22 d2a0c16에서 ID.4 0~100% 커브+실측전력 상한 적분+3단계 스무딩 도입. 같은 날3c99d18에서 측정시각 기반 EMA/180~300초 잔량 증가율/조건부 감속으로 개편, 커브는 보존. 현재 기본은 min(유효전력, 구간 커브)이며 관측 감속 조건 충족 시에만 상대 커브 하락도 반영한다. 현재 출력 비율로 전체 커브를 항상 재조정하는 모델은 아니다.
- 운영 한국어/영어 카드는 Python ETA를 표시하며 debug JS 별도 모델과 구분. docs/CHARGING_ESTIMATION.md에 과거80% 도달1세션 재생 검증(평균절대오차12.609→6.921분), 100% 검증 불가가 명시되어 있음. 문서의 표시 SOC/설정용량 동일 기준 설명은10/28 CAN SOC 전환 이후 현행과 불일치.
- 상태: 코드·Git 이력·설계문서 읽기 전용 조사. 앞선 답변의 급속 커브 신규 제안은 기존 구현을 충분히 구분하지 못한 설명으로 정정. 실행 코드/설정/배포/재시작/릴리즈 변경 없음, 운영 설치본 동일성 미확인.

## 2026-11-04 — 새 주행가능거리 계산 읽기 전용 확인

- 요청: 재시작 전 최근 기록으로 SOC 20%의 새 추정 거리 확인. HA DB를 mode=ro/query_only로 열고 배포된 거리 계산 메서드만 실행했다. 운영 데이터·설정·실행 코드·재시작·릴리즈 변경 없음.
- 확인: 최근 50km 전비 6.13, 30일 최대300km 전비 6.2041, 혼합 6.18168km/kWh. 최신 데이터는 사용자 언급 20% 이후 충전 상태이므로 구분하고, 보관된 최근 CAN20% 표본의 잔량12.2kWh에 현재 혼합 전비를 적용하면 약75km다. 20%를 설정용량에 단순 곱하지 않는다. 계기판 값은 미확인. 개인 식별자·원본 데이터는 기록하지 않음.

## 2026-11-04 — 완속·급속 충전 ETA 계산 조사(코드 변경 없음)

- 사용자 화면: CAN 표시 SOC 27%, 실제 충전 전력 9.1~9.3kW, 80% 5시간11분·100% 7시간31분. 계산 경로 charging_mode/charging_power → vehicle.values → battery.estimate_charging_times → 대시보드 time_to_80_s/time_to_100_s 확인.
- 표시 SOC는 CAN 0x14A, ETA 목표는 battery_wh/설정 soc_capacity_kwh로 별도 계산해 목표 정합성이 보장되지 않음(10/28 전환 때 유지된 모델). ETA는 180초 이상·최대300초 에너지 증가율을 우선하며, 그 전에는 전력 EMA 및 완료시각 변동 제한을 사용. AC/DC 모드를 ETA 함수에 전달하지 않으며 ID.4 참고 곡선과 관측 감속으로 적분한다. 9.3kW는 참고 곡선 최저31.7kW보다 작아 초기 AC 계산에 곡선 감속이 발생하지 않는다.
- 검증: 현행 함수를 직접 호출. 에너지 SOC도27%라는 가정에서 64kWh·9.1~9.3kW는 80% 218.8~223.7분/100% 301.4~308.1분, 78kWh는 266.7~272.6분/367.4~375.4분. test_charging_smoothing 36개 통과. 64kWh 가정 시 화면의 목표 간140분은 단일 선형 유효전력 약5.49kW에 해당하나 스무딩 상태 때문에 실제 내부전력으로 확정할 수 없음.
- 상태/미확인: 운영 HA 현재 설정용량·battery_wh·최근 측정열·모델 상태·설치본은 미조회. 화면만으로 원인/정확한 완료시각 확정 불가. 실행 코드·운영 데이터·배포·재시작·릴리즈 변경 없음. 시작 시 존재한 주행가능거리 관련 미커밋6개 파일은 보존, dirty 상태에서 pull/혼합 커밋을 수행하지 않음.

## 2026-11-04 — 주행가능거리 장·단기 소비율 혼합

- 사용자 요청: 최근 50km만으로 계산해 비관적이고 흔들리는 추정치를 최근 30일·최대 300km 기준 70% + 최근 50km 30%로 조정해 관찰한다. km/kWh 산술 평균 대신 kWh/km 소비율을 혼합한다. SOC 표시·배터리 잔량 모델·공조 소비 계산은 변경하지 않는다.
- 장기 기록은 30일 안에서 확보된 만큼 사용하며 상태/주행 기록 중 거리 커버리지가 큰 한 경로만 선택해 중복 합산을 막는다. 장기 기록이 없으면 기존 최근 50km, 주행 기록 자체가 없으면 설정 참고 전비를 사용한다. 센서에 혼합 전비·각 기준 전비·거리·출처·가중치를 노출한다. 상태 구간의 마지막 경계도 목표 거리만큼 비례 반영한다.
- 관련 파일: custom_components/carrot_ha/storage.py, vehicle.py, sensors_v3.py, tests/test_range_efficiency.py, tests/test_new_sensors.py.
- 검증·배포: 관련 합성 회귀 96개 통과, diff 공백 검사 통과. 구현 커밋 567e54d를 main에 푸시하고 HA 기존 세 파일이 직전 기준 커밋과 일치함을 확인했다. /config/carrot_ha/deployment-backups/567e54d93d1a88976362881c73e734b49421f3a7/에 백업 후 세 파일 직접 반영 및 SHA-256 일치 확인. 실행 중 Python 적용은 사용자 HA 재시작 대기이며 실차/계기판 비교 미완료. 버전 상승·태그·릴리즈 없음. 추정 개선이 모든 SOC에서 계기판 일치를 보장하지 않는다.

## 2026-11-03 — 대시보드 차량 색상 피커 HA 직접 반영

- 335fdbf의 carrot-dashboard-ko.js·carrot-dashboard-en.js·carrot-vehicle-3d.js를 반영 전 해시가 직전 커밋과 같음을 확인하고 백업(`/config/carrot_ha/deployment-backups/335fdbf/frontend/`)한 뒤 반영했다. 파일·HTTP 응답 SHA-256이 커밋과 일치하고 권한(root:root 644)도 기존과 같다. 브라우저 새로고침으로 적용되며 HA 재시작은 필요 없다. 실제 HA 화면 확인은 사용자 대기. 릴리즈 발행 없음.

## 2026-11-03 — 대시보드 차량 색상 피커(기기별 localStorage 저장)

- 한국어·영어 대시보드의 화면 테마 왼쪽에 "차량 색상"(Vehicle colour) 피커를 추가했다. 8가지 기본 색, 직접 선택, 기본값 복귀를 제공하고 고르는 즉시 3D 차량 색이 바뀐다. 이유: 사용자 요청. 선택값은 이 브라우저의 localStorage `carrot-vehicle-color-<device_id>`에만 저장해 다른 기기에는 적용되지 않는다. 우선순위는 기기 선택 > 카드 설정 `vehicle_3d_color` > 기본색 `#333234`. `vehicle_3d: false` 카드에서는 숨긴다. 색 이름은 ID.4 색을 참고한 근삿값이다.
- 프리뷰에서 색상판이 Leaflet 지도 미리보기(z-index 400) 아래로 가려지던 문제를 z-index 1100으로 수정했다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-dashboard-ko.js, carrot-dashboard-en.js, carrot-vehicle-3d.js, preview/vehicle-color/index.html(실제 모듈 프리뷰).
- 검증: 프리뷰에서 데스크톱 라이트·모바일(375px) 다크 테마로 즉시 색 변경, 새로고침 후 유지, 갱신 중 열린 색상판 유지, 바깥 클릭 닫기, 기본값 복귀, 지도 위 표시를 확인했다. vehicle-3d-integration(25)·debug-3d(7)·dashboard-live-loading(6)·dashboard-view-state(3)·dashboard-lazy-runtime 테스트 통과. 실제 HA 화면 확인은 사용자 대기.

## 2026-11-03 — 차계부 모바일 위치 시트·현재 위치 수정 HA 직접 반영

- 507379b의 carrot-vehicle-journal.js·carrot-journal-design.js를 백업(`/config/carrot_ha/deployment-backups/507379b/`) 후 반영했고 파일·HTTP 응답 SHA-256이 커밋과 일치했다. 실제 iPhone 확인은 사용자 대기. 상세는 vehicle-journal/CHANGELOG.md.

## 2026-11-03 — 차계부 모바일 위치 시트 겹침 수정·지도 기본 중심을 현재 기기 위치로

- 실제 iPhone에서 위치 지도 시트가 기록창 머리글에 가려지던 문제를 화면 고정 시트·본문 잘라내기 해제·머리글 숨김으로 수정했다. 핀이 없을 때 지도 중심을 기기 현재 위치로 옮긴다(핀 자동 저장 없음). 관련 파일: carrot-vehicle-journal.js, carrot-journal-design.js. 상세는 vehicle-journal/CHANGELOG.md.

## 2026-11-03 — 차계부 기록 입력창 개편 HA 직접 반영

- 3e9b6ea의 carrot-vehicle-journal.js·carrot-journal-design.js를 백업(`/config/carrot_ha/deployment-backups/3e9b6ea/`) 후 HA에 반영했고 파일·HTTP 응답 SHA-256이 커밋과 일치했다. 브라우저 새로고침으로 적용되며 실제 화면 확인은 사용자 대기. 상세는 vehicle-journal/CHANGELOG.md.

## 2026-11-03 — 차계부 기록 입력창 개편(데스크톱 2단·모바일 위치 지도 시트·주유 방식 스위처)

- 데스크톱은 입력|지도 2단(창 크기 비례, 최대 1330×840), 모바일은 전체 화면 입력창과 전체 화면 위치 지도 시트로 바꿨다. "기록된 위치"→"위치 기록", 가득/부분 주유 세그먼트 스위처, 6칸 숫자 배열, 빈 이관 원본 정보 표시 버그 수정. 관련 파일: carrot-vehicle-journal.js, carrot-journal-design.js, vehicle-journal/tests/record-edit-layout.cjs, vehicle-journal/review-record-entry.html. 상세는 vehicle-journal/CHANGELOG.md.

## 2026-11-03 — 차계부 수동 충전 기록 저장 수정 HA 직접 반영

- 10754b6의 carrot-vehicle-journal.js·vehicle_journal/api.py를 백업(`/config/carrot_ha/deployment-backups/10754b6/`) 후 HA에 반영했고 파일·HTTP 응답 SHA-256이 커밋과 일치했다. 브라우저 적용·HA 재시작은 사용자 확인 대기. 상세는 vehicle-journal/CHANGELOG.md.

## 2026-11-03 — 차계부 수동 충전 기록 저장 실패 수정·단가 회색 미리 표시·충전량 라벨

- 장소 검색 결과의 `phone`·`category_name`이 기록 위치에 섞여 저장이 거부되던 문제를 수정했고, 연결 차량 저장 오류가 금액 오류로 잘못 표시되던 문구를 실제 검증 사유로 바꿨다. 충전 기록에 금액 ÷ 충전량 단가를 회색으로 미리 보여 주고 "청구 충전량" 라벨을 "충전량"으로 바꿨다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-vehicle-journal.js, custom_components/carrot_ha/vehicle_journal/api.py, vehicle-journal/tests/record-edit-layout.cjs, vehicle-journal/tests/test_api_authorization.py. 원인·검증·배포 상태 전체는 vehicle-journal/CHANGELOG.md 같은 날짜 항목에 있다.

## 2026-11-02 — 실제 Git 전환 성공 및 연결 CLI 환경 보완

- d955b931b13fed985c174f67a81497276d70951e Linux CI41449784671 success 후 사용자 예외 승인에 따라 에이전트 직접 설치 성공(IQ_HA_INSTALLED). 순정과 같은 IQ11fcd742/OS4.9.9.9.2를 유지하며 iq-ha 전환 및 vendor 독립 복제/추적 설정 완료.
- Python 캐시360개 /data/iq-ha-python-cache-dcmw9u4t에 보존, 기존 .iqpilot runtime은 /data/iqpilot-ha-runtime으로 이동 후 Git 링크 유지. 강제 삭제·서명/SELinux 우회·재부팅 없음.
- 최초 연결 설정 CLI는 bare SSH 환경에 iqdbc 모듈 경로가 없어 쓰기 전 거절됨. 읽기 전용 traceback으로 원인 확정. IQ 원본 launch_chffrplus.sh와 동일한 artifacts/package_runtime 경로를 Mac 전달 명령 PYTHONPATH에 지정하도록 보완. 진단 실패의 OS/소스 무결성·vendor 체크는 모두 통과했고 구성 저장은 아직 안 됨.
- 이번 보완은 Mac 실행 명령의 런타임 환경만 변경하며 Comma 프로그램 파일 수동 수정 없음. 복원과 실제 런타임 진단을 이어 수행.

## 2026-11-02 — 캐시 보존 경로 정규화 시험 보완

- 새 캐시 보존 단위 시험이 Mac /var→/private/var 경로 별칭 비교에서 실패해 후보 자동 검증이 게시를 막음(기기 후보는 a9018ea 그대로). 보존 함수 진입에서 repo.resolve()를 적용해 경로 이탈 검사 기준을 통일. 실제 실행 경로/사용자 데이터를 더 허용하는 우회가 아님.
- 로컬 설치 시험6개 재실행 및 전체 후보 재검증 후 게시. 실기 파일은 이 수정 검증 중 변경하지 않음.

## 2026-11-02 — 사용자 예외 승인 및 Python 캐시 충돌 보존

- 사용자 명시 지시: 이번에는 연동 성공까지 에이전트가 설치 재시도를 직접 진행. 반복 Enter 대기를 중단하되 Git 전용 소스 배포·보안 우회 금지 원칙은 유지.
- 후보 a9018ea Linux CI41448488444 success. 사용자 재실행에서 공식 origin fetch는 성공, 안전 검사에서 untracked/ignored 충돌로 전환 전 중단. 순정 HEAD11fcd742 유지 확인. 충돌360개가 모두 __pycache__/*.pyc임을 파일명/형식으로 확인(다른 설정·기록0).
- Git 설치 프로그램이 해당 Python 캐시만 Git 밖의 전용 디렉터리로 보존하도록 보완. 다른 파일·링크·경로 이탈은 여전히 거절하며 강제 삭제 없음. 혼합된 사용자 설정 충돌 시 캐시도 이동하지 않는 회귀 시험 추가.
- HA 터미널 카드 1개는 커밋6f38582 원본으로 백업 후 직접 반영했고 SHA256 전체 일치. 백업 /homeassistant/carrot_ha/deployment-backups/driving-logs-hud-6f385821da3b/before. HA runtime devices API에 pilot_software 필드가 실제 로드돼 있음 확인(장치정보·키 출력 없음). HA 재시작/릴리즈 없음.
- 상태: 캐시 보존 보완 검증·후보 갱신 후 에이전트가 같은 설치를 이어 수행. 연결 설정 복원·재부팅 후 실제 HA 수신은 아직 미완료.

## 2026-11-02 — IQ.OS 기본 Git 관리 인터페이스 대응

- 사용자가 설치 명령 실행. /usr/local/bin/git이 /data/iqpilot의 fetch/pull/checkout을 공식 iq-git-update로 전달하며 로컬 경로 fetch와 임의 옵션을 거절해 첫 fetch에서 중단. 순정 HEAD11fcd742/깨끗한 tracked 상태와 내부 .iqpilot 보존, 외부 runtime 미생성 확인. 기기 실행 소스·연결 설정·재부팅은 미변경.
- 공식 래퍼 텍스트와 관리 인터페이스만 읽음. 컴파일된 helper는 조사/변형하지 않고 /usr/bin/git 직접 호출·SELinux/서명 우회 없음.
- 설치기 restricted 경로는 정상 Git origin 설정과 fetch origin, branch 생성 및 checkout iq-ha를 사용. 미추적/ignored 충돌 사전 검사와 기존 runtime 보존 유지, 원본 fetch 실패 시 origin/fetch 설정 복구. 원격 후보와 준비 폴더 SHA 불일치도 거절.
- 신규 bootstrap/update_iq_ha.py: 주차·HA origin·clean·fast-forward 가능 여부 확인, vendor 파일을 먼저 받아 네트워크 오류 시 소스는 유지. pull.ff=only 설정 및 공식 pull origin 사용 후 로컬 vendor 적용. reset/clean·강제 전환·OS 쓰기·재부팅 없음.
- HA 터미널 버튼의 IQ 내부 명령만 Git 관리 updater 호출로 변경(화면 디자인/레이아웃 변경 없음). 기존 당근 명령/라벨 유지. JS5, restricted 설치 경로 포함 설치 시험5, updater 순서/실패/주차 시험3 통과. 실제 원격 helper 경로의 설치·버튼 검증은 아직 미완료.
- HA 설치본 터미널 카드 SHA256이 직전 Git 원본과 같음을 SSH로 확인. 커밋 후 백업/해시 검증을 갖춘 기존 배포 도구로 한 파일 직접 반영 예정. pre-release/태그/HA 재시작 없음.

## 2026-11-02 — 최종 후보 706bc97 준비 완료·사용자 설치 대기

- carrot-ha e0f20eb, iq-ha 706bc979c49b17710f584ef426aa3af59e63ce49 게시. Linux CI41445761367 success. 이전 후보45899f4 CI41444994340 및 기본 브랜치 e45592a 자동 갱신41444999717 success.
- 실제 자동 갱신 도구 --force로 새 후보 조립·시험·커밋 재현. 58개 고유 시험(기본/기록/실 IQ CAN 계약) 통과, CAN 별도 실행 전 중복 발견의 3개 skip은 별도 실제 입력 실행으로 통과. shallow 보완 시험 포함.
- 기기 /data/iq-ha-install은 706bc97, vendor=11fcd742 준비 완료. --no-local Git 복제로 shallow 원본 재사용 성공. 기기에서 source-only 11개 체크 및 installer validate 통과(INSTALL_READY_NO_SOURCE_SWITCH).
- 저장소 사용자 설치·재시작 원칙에 따라 크롬 IQ 터미널에 활성화 명령만 입력하고 Enter 실행은 사용자에게 넘김. 현재 실행 저장소 순정 및 연결 설정은 아직 변경하지 않음. 사용자 실행 결과·복원·재부팅·HA 수신을 이어 확인할 예정.

## 2026-11-02 — 설치 준비 중 순정 shallow Git 차이 보완

- 후보 45899f4 Linux CI41444994340 및 기본 브랜치 e45592a 자동 갱신 자체 검증41444999717 success 확인.
- 사용자 기기 SSH 키 재등록 후 iq@192.168.0.237 직접 로그인 성공. 실제 런타임 .iqpilot은 저장소 내부 일반 디렉터리로 확인.
- 실행 중인 순정은 그대로 두고 /data/iq-ha-install에 Git 후보를 clone. vendor 준비의 --reference가 순정 shallow 저장소를 거절해 중단됨(소스 전환/설정 복원/재부팅 없음).
- install_from_stock.py에 --prepare-vendor 추가: Git --no-local --depth 1 복제와 absorbgitdirs로 얕은 순정도 독립 보관, 외부 IQ 원본 URL 유지. 활성화 시에도 얕은 준비 폴더를 reference로 삼지 않고 독립 Git 복제. 실제 임시 shallow 저장소 회귀 시험 추가.
- 상태: 보완 로컬 시험 후 새 후보/CI 준비. 서버·차량 실행 소스·인증 설정은 아직 미전환. 비공개 키트는 Git에 포함하지 않음.

## 2026-11-02 — 최신 IQ.OS 4.9.9.9.2 HA 업데이트 경로 준비

- 사용자가 순정 IQ/OS 자동 갱신과 HA 유지 업데이트 경로 구현 및 실제 연결 복구를 요청. 업데이트 중 기기 읽기 전용 관찰, 재시작 후 /VERSION=4.9.9.9.2, release 11fcd742, UpdaterState=idle/실패0/주차 확인. 전원·재부팅 명령 실행 없음.
- 진단: IQ 웹 LocalAPI no_verification_key_configured 및 Device Errors Unauthorized 관찰. 웹 offline을 실제 재부팅으로 단정하지 않음. 기기 직접 SSH 계정은 iq. 사용자 승인 후 Mac 기존 공개키를 Konn3kt 계정에 추가, 사용자 기기 메뉴에서 GitHub SSH 키 재등록 완료. 직접 연결 결과/실기 적용은 후속 기록.
- 조립/진단 OS를 candidate manifest의 required_os와 정확히 비교. OS 변경은 reviewed_os_transitions.json의 정확한 원본 SHA만 검토 허용. 현재 전환은 소스/합성 계약 검토이며 실차 HA 검증을 뜻하지 않음.
- 실제 IQ CAN Parser/DBC 검사에서 HA 전압 신호 정의 차이 확인. 고정 donor의 DBC를 HA 수집기 전용으로 보존하고 IQ 주행 DBC는 그대로 유지. 실 CAN parser/packer 합성 bus0/1→HA 값 및 현 camera capnp 스키마 시험 3개 통과. 바이너리/보안 검증 우회 없음.
- Git 관리 설치기(업데이트 idle/주차/정확한 SHA·OS/무결성 확인, 런타임만 Git 밖 보존, 강제 checkout·reset·clean·재부팅 없음), 연결 전용 복원기 및 Mac stdin 전달 도구 준비. 임시 Git 설치 시험 3개, 후보 복원 시험 4개, 직접 전달 시험 2개 통과.
- 관련 파일: compat/iqpilot/, scripts/{prepare_iqpilot_ha,build_iqpilot_ha_candidate,refresh_iq_ha,fetch_iqpilot_can_runtime}.py, tools/{receiver-recovery,iq-ha-restore}.py, tests/test_iqpilot_*.py, tests/test_iq_restore_transport.py, 최신 경로 문서. 기본 브랜치 자동 갱신 워크플로 시험 의존성도 별도 반영 예정.
- 배포 상태: 개발/로컬 시험 진행 중. 후보 GitHub 게시·Linux CI·기기 전환·설정 복원·사용자 재부팅·HA 실제 수신/실차 검증은 아직 완료로 주장하지 않음. 릴리즈/태그/HA 서버 반영 없음.

## 2026-11-02 — 실제 클린 설치 후 HA 재연결 경로 조사

- 사용자 요청: IQ.OS 업데이트 중 크롬의 기기 화면에서 읽기 전용 조사. app.konn3kt.com 자체 CLOUD WEBSSH 연결 성공. 같은 LAN SSH 외에도 최초 진단 경로가 있음을 실측.
- 기기 읽기 결과: /VERSION=IQ.OS 4.9.9.4, release HEAD=11fcd74243ede4f1f5df24db1ed2d44e2ac22664, tracked status 비어 있음, IsOffroad=1/IsOnroad=0. launch_env AGNOS_VERSION=4.9.9.9.2. 웹에는 해당 버전 OS 업데이트 진행 표시. 현재 OS와 설치 목표를 구분하며 업데이트 완료 여부는 미확인.
- /data/carrot_ha/direct-connection.json 및 /data/carrot_ha/camera/camera.json 없음 확인(비밀값 열람/출력 없음).
- 공개 원본 release SHA가 기기와 동일하고, HA iq-ha는 9637e6c6e8287c96dbf12de7b79bb2cef3b585f5 그대로 확인. 기존 후보/진단 OS는 4.9.9.4 고정이며 refresh 도구는 OS 변경 시 NEEDS_REVIEW 중단. 기존 후보로 다운그레이드하지 않고 새 IQ 원본에 맞춘 연동 갱신·검증이 선행돼야 함.
- 원본 신규 공개 소스를 Mac의 /private/tmp/iqpilot-recovery-current-20261102에 filtered/no-checkout 조사 클론. 주행 제어 코드는 변경하지 않음.
- 기기에서는 cat/git status/rev-parse/branch/설정 존재 확인/rg만 실행. 설치·checkout·설정 복원·재부팅·OS 쓰기·HA 배포 없음. 기존 비공개 Mac 복구 키트는 보존. 실제 HA 연결 복원은 아직 수행하지 않음.

## 2026-11-02 — 플래싱 후 순정 IQpilot에서 HA 재연결 준비

- 사용자 요청으로 플래싱·순정 설치 이후를 위한 docs/IQPILOT_HA_CLEAN_RECOVERY.md 준비. 같은 Wi-Fi + SSH 공개키 재등록, 주차 확인, 순정/후보 SHA 일치 확인 후 Git 전환, 선택적 HA 설정 복원, 사용자 재부팅·실차 확인 순서를 기록.
- scripts/prepare_iq_ha_recovery.py: 원본 백업 SHA256 검사 후 허용된 수신기·카메라 JSON만 추출, ID 대조 및 비공개 권한 설정. Params/DB/큐/소스 미복원. .private-recovery/ Git 제외. 실제 Mac 키트 생성 성공(비밀값 출력 없음).
- tools/receiver-recovery.py: --iqpilot 및 --config로 Git 관리 IQ 설정 CLI를 호출. 비밀키는 SSH stdin 전달. 차량 소스 SSH/SCP 수정 없음.
- 검증: 수신기 SSH 전달 시험 3개, 합성 백업 추출 시험 1개 통과. 기존 설정 키트 생성 성공. 실차 SSH/checkout/카메라/수집/차계부 연속성 미검증.
- 운영 상태: 차량·HA 변경, 플래싱·설치·재부팅·릴리즈 발행 없음. 로컬 복구 준비 및 문서/도구 Git 배포만 수행.

## 2026-11-02 — Astra 검토 P1·P2 조치

- P1: 복귀 스크립트가 IsOnroad 누락·읽기 실패 시 진행하던 문제 수정. IsOffroad=1·IsOnroad=0 확인 시에만 진행, 불명 상태는 사용자의 명시적 --confirm-parked(복구 안내 시)에서만 진행, 주행 중이면 항상 거부. 회귀 시험 3개 추가, 11개 통과. carrot-ha 6604665, iq-ha 9637e6c(CI 41399208645 success).
- P2: 매뉴얼 2-7 실패를 "상태 미확인"으로 수정. 당근 OS/IQ.OS 구분용 읽기 전용 확인과 상태별 판단 기준 추가. 매뉴얼 후보 번호 9637e6c로 갱신, 바탕화면 사본 동기화. 검토 기록 docs/IQPILOT_HA_REVIEW_2026-11-02.md에 조치 추가.
- 기기·HA 변경 없음. pre-release 미발행. 실차 미검증.

## 2026-11-02 — Claude IQpilot HA 후속 변경 검토

- a7d1107 및 후보 a35b564 검토. 상세: docs/IQPILOT_HA_REVIEW_2026-11-02.md.
- 복귀 스크립트의 Params 누락 시 전환 허용(P1)을 로컬 Git fixture로 재현. 설치 안내의 로고 화면 기반 OS 상태 단정(P2) 확인.
- 복귀 8, 갱신 helper 2, 일시중지 3, Node 6 시험 통과. 공개 후보 CI41396971640 success 확인. 실차·OS 복귀·신규 IQ 자동 갱신 미검증.
- 실행 코드 수정·차량/HA 반영·재부팅·릴리즈 없음. 검토 문서와 조사 기록만 추가. P1 수정 후 재검토 필요.

## 2026-11-02 — IQ.drive 업데이트 버튼과 IQ 원본 자동 갱신 작업

- 사용자 승인(프리뷰 preview/iq-pull): 터미널 카드가 Comma 보고 브랜치가 iq- 이면 Git 버튼을 "📥 IQ.drive 업데이트"로 바꾸고 `git pull --ff-only && git submodule update --init --depth 1 -- vendor/iqpilot`를 실행한다(reset --hard 없음). 당근일 때는 기존과 같다. tests/terminal-git-status.test.mjs 5개 통과. 커밋 8561893을 HA에 SSH 직접 반영: 사전 충돌 검사 통과, 백업 /homeassistant/carrot_ha/deployment-backups/driving-logs-hud-85618934d4c7/before, 설치 SHA256 일치. HA 재시작은 사용자 작업(미확인).
- 자동 갱신: scripts/refresh_iq_ha.py 추가, 조립 스크립트가 IQ 원본 번호를 입력으로 받도록 변경. iq-ha를 (carrot-ha 조립 스크립트, 고정 당근 5ec4868a, IQ 원본 번호)의 조립 결과 그대로 만들고, 후보 시험 통과 시에만 커밋한다. IQ.OS 버전 변경·연동 수정 적용 실패는 NEEDS_REVIEW로 멈춘다. 필요한 공개 파일은 한 번에 받는다(IQ 942, 당근 48).
- 조사: IQ 원본 release는 배포마다 커밋 1개로 강제 갱신되며 태그가 없다. 이전 고정 번호는 원본 서버에서 사라질 수 있으므로 커밋 메시지에는 IQ 자체 CHANGELOG 상단을 넣는다. 매뉴얼에 영향 기록.
- helico717/openpilot 기본 브랜치 carrot-wip에 .github/workflows/iq_ha_upstream_refresh.yml 추가(77723f7→97a5ef3): 매일 04:17 KST, 수동 실행(force/dry_run), 워크플로 수정 시 강제 재조립·푸시 없는 자체 점검. 결과는 공개 주석으로 남는다. 이 푸시로 기존 tests/user docs 워크플로도 실행됐다(user docs 성공, tests는 기록 시점 진행 중, 이번 변경과 무관).
- 검증: 로컬 강제 재조립 IDENTICAL, IQ beta 끝 커밋으로 가상 갱신 시 조립·시험·커밋 성공(푸시 안 함). GitHub 자체 점검 첫 결과 COMMITTED(HA_CANDIDATE.json, PORTABILITY.json): macOS/Linux 폴더 순서 차이. 조립 스크립트에서 목록 정렬(6878528), iq-ha a35b564에 정렬된 manifest 게시(내용 동일, CI41396971640 success), 재점검 41396994577 IDENTICAL.
- 매뉴얼: 후보 a35b564로 갱신, 5절 "IQ 사용 중 업데이트" 추가, 자동 갱신으로 번호가 달라졌을 때의 대응 추가.
- 미검증: 실제 IQ 신규 release에서의 자동 커밋·푸시, 기기에서 버튼 동작, 실차 전반. pre-release 미발행 — 다음 pre-release 포함 대상.

## 2026-11-02 — IQ.drive 사용 중 당근 전용 기능 일시중지, FastSleep 점검, 설치 매뉴얼 보강

- 사용자 결정: IQ.drive 사용 시 당근 파라미터 대시보드와 당근웹 로그 대시보드는 지우지 않고 일시중지(전체 블러 + 중앙 "IQ.drive 사용 중" 안내). 로그는 업로드와 화면 모두 중지. FastSleep은 끄고 사용. pre-release는 발행하지 않고 HA SSH 직접 반영(사용자 VPN 연결).
- 판정: Comma가 이미 보내는 comma_git_branch가 iq-ha(또는 iq- 접두)이면 IQ 사용 중. 수신 앱 변경 없음. 당근 브랜치를 다시 보고하면 자동 해제.
- HA 통합(custom_components/carrot_ha): driving_logs/pilot.py 추가. devices API에 pilot_software 추가. IQ 사용 중 param_set은 409 paused_iqpilot로 거부(복귀 후 뒤늦은 적용 방지). 로그 화면 세션 409 거부. Comma가 보는 로그 전송 정책만 enabled=false(paused)로 바꾸고 저장된 사용자 선택은 유지. 기기 ActivationTracker 특성상 일시중지 중 녹화분은 당근 복귀 후에도 업로드되지 않는다.
- 프론트엔드: carrot-pilot-pause.js 공통 모듈(카드 둥근 모서리 안 blur 오버레이, 중앙 안내, 아래 내용 inert). 파라미터 카드는 일시중지 중 settings/param_status 조회 중단, 기기 목록은 30초마다 HA 내부 API로만 재확인. 로그 카드는 iframe을 about:blank로 닫고 세션을 만들지 않으며 복귀 시 다시 연다. 차량 수신기 조회 증가 없음.
- 검증: tests/test_pilot_pause.py 3개, 기존 driving_logs transport 6개(1 skip), params-card(스텁 하네스 갱신), dashboard lazy/live/view-state 통과. preview/iq-pause(실제 카드 코드 + mockHass, 실제 당근 설정 카탈로그)에서 IQ 전환 시 두 카드 블러·안내·inert·iframe 닫힘, 일시중지 35초 동안 devices 외 요청 없음, 당근 복귀 시 안내 제거·로그 세션 재생성 확인. 프리뷰의 당근 상태 파라미터 목록은 카탈로그 변환 차이로 일부만 표시됨.
- 후보 iq-ha 25d213b: 실기 진단에 fast_sleep_off 추가. CI41392571135 success.
- docs/IQPILOT_HA_INSTALL_AND_RETURN.md: 단계별 기대 결과·문제 대응표·Mac 보고 방법·FastSleep 끄기·일시중지 기능 설명으로 보강. 후보 SHA 25d213b로 갱신.
- 배포 상태: HA 설치본(0.9.0)의 대상 파일이 저장소 HEAD와 동일함을 SSH로 확인한 뒤 UI 승인을 받았다. HACS pre-release 미발행 — 다음 pre-release에 포함할 미발행 변경이다. 실기 미검증.
- HA 직접 반영(사용자 승인 후): 커밋 fdb0c5a의 7개 파일을 scripts/deploy_driving_logs_ha.py로 반영. 사전 충돌 검사 통과, 기존 5개 파일 백업 /homeassistant/carrot_ha/deployment-backups/driving-logs-hud-fdb0c5a8730c/before, 설치 SHA256 7개 일치(별도 재확인 포함), Python 4개 AST 통과. HA 재시작은 사용자 작업이며 아직 미확인. 현재 Comma는 당근이므로 재시작 후에도 화면 변화 없음이 정상. pre-release 미발행.
- 별도 발견(조치 안 함): 추적 파일 custom_components/carrot_ha/frontend/carrot-trip-days 2.js(커밋 5fc7cc6)는 iCloud 복사본 형식 이름이다. 사용자 확인 전 삭제하지 않는다.

## 2026-11-02 — IQ.OS→당근 복귀 위험 확인, 복귀 판정·Git 복귀 스크립트, 사용자 설치·복귀 절차

- 인계 후 원격 상태 재확인: iq-ha 1421eb45, ha-back 5ec4868a 고정, CI41386251075 success. 운영 carrot-wip-model_selector-ha는 a6a58ae9로 진행했고 5ec4868a는 그 조상임을 확인. 백업·로그인은 반복하지 않았다.
- 복귀 경로 소스 조사(공개 소스만, 비공개 바이너리 분석 없음): IQ 원본 utils.py에 IQ.OS 4.9.9.2부터 기기 owner root 제거가 명시돼 있다. 당근 agnos.py는 sudo 없이 비활성 슬롯 파티션에 직접 쓰고 abctl을 호출하므로 IQ.OS 위 당근 OS 재설치 가능 여부는 미확인 위험이다. 당근 런처는 /AGNOS 표식이 있을 때만 OS 재설치를 실행하고, 실패 시 포트6999 복구 터미널을 먼저 띄운다. IQ.OS 이미지는 공개 주소가 404이며 IQ 서버 기기 등록(일련번호·IMEI·공개키 전송) 인증 경로로만 받는다.
- 당근 기본 업데이터의 브랜치 선택으로 iq-ha 전환은 openpilot/system/hardware/tici/agnos.json 경로가 없어 OS 단계에서 실패하므로 사용하지 않는다. 빈 manifest 등으로 우회하지 않고, 강제 옵션 없는 Git checkout 절차를 사용한다.
- compat/iqpilot/iq_preflight.py: 실기 진단에 carrot_return 별도 보고 추가(passed와 분리). 읽기 전용으로 현재 슬롯, 비활성 슬롯 xbl/xbl_config/abl/aop/devcfg/boot/system 쓰기 권한(열지 않고 access만), /AGNOS 표식, sudo -n 가능 여부를 보고하고 SOFTWARE_RETURN_POSSIBLE_UNVERIFIED/BLOCKED를 판정. abctl 슬롯 변경 권한은 여전히 미검증.
- compat/iqpilot/switch_to_carrot.sh(후보 bootstrap/switch_to_carrot.sh): 고정 ha-back 5ec4868a로의 Git 전용 복귀. 주행 중·origin 불일치·추적 파일 변경·예상 외 커밋에서 거부, --force/reset/clean 없음, 미추적 파일 충돌 시 HEAD 유지, 재부팅 안 함. tests/test_iqpilot_return.py 8개(합성 파티션·로컬 Git 저장소) 통과. 빌더가 새 파일·테스트·안내를 조립하도록 갱신했고 재조립 결과가 게시 후보와 의도한 변경 외 동일함을 확인.
- iq-ha 후속 커밋 7118c2f, a9edcebe183fde1654ad84f7c9f7948fd4a0aff2 정상 push(force 없음). Linux CI41388595172, 41388791014 success. Mac 후보 source-only passed, test_iqpilot_* 15개 통과(PyAV 2개 skip, CI에서 실행).
- docs/IQPILOT_HA_INSTALL_AND_RETURN.md 추가: 사용자 실행용 시작 조건, 당근→IQ Git 전환 7단계, IQ.OS 진단·실기 확인표, IQ→당근 복귀와 OS 기록 실패 시 6999 복구 터미널에서 IQ로 되돌리는 경로, 운영 브랜치 ff-only 복귀, 소프트웨어 복귀 차단 시 대응.
- 미검증: 실제 Comma 설치·IQ.OS 기록/부팅, IQ.OS 위 실제 carrot_return 결과, 실제 CAN·카메라·차계부·로그 업로드, 당근 OS 재설치 복귀, USB 복구. iqdbc 합성 CAN 비교는 미수행. HA 운영 코드·Release·기기 변경 없음.

## 2026-11-02 — IQ HA 설치 후보 CI·원본 의존성 검증 및 Claude 인계

- 수정 후보1421eb452e693283fc75451e188bf2a68eaf1ec1을 iq-ha에 정상 게시. 새 Linux CI41386251075 success 확인: 소스검사10개, 기능35개. 최초43a58f1/CI41385112866 실패는 별도로 보존하며 성공으로 바꿔 보고하지 않음.
- Mac 별도 후보에서 실제 고정 Git 하위 저장소를 받아 5c9291b9 checkout/clean 확인. vendor 연결115개 전부 존재, camerad/encoderd 실행파일·params_pyx.so·env_sync.sh 존재 확인. vendor542MB/Git객체465MB 관측. 바이너리 실행·역공학·기기 설치는 하지 않았다. 실제 fetch 시험에는 --filter=blob:none을 사용했고 게시 bootstrap에는 아직 필터 최적화를 적용하지 않았다.
- docs/IQPILOT_HA_CLAUDE_HANDOFF_2026-11-02.md에 사용자 목표·정확한 SHA/CI·완료한 비공개 백업·구현/시험 폴더·남은 CAN/카메라/IQ.OS 왕복·설치 및 Git/사용자 재부팅 제약을 기록. docs/IQPILOT_HA_PREPARATION_2026-11-02.md의 후보 게시 상태도 갱신했다.
- 추가 CAN 파싱 시험용 Mac Python3.12.16 설치만 완료. 해당 환경에서 실제 iqdbc 합성/기록 CAN 비교는 미수행이며 인계 항목이다. 활성 인증/백업 전송 대기 프로세스 없음. 실기검증 전 정식 완성판으로 보고하지 않는다. 사용자 요청에 따라 후속 기능 개발을 멈추고 인계 문서·미커밋 작업을 정리한다.

## 2026-11-02 — IQ HA 후보 첫 CI 실패 원인 확인 및 보완

- IQ 후보43a58f1을 새 iq-ha 브랜치에 정상 게시, 원격 SHA 일치 확인. 실제 Linux 실행41385112866은 소스검사10개 통과 후 PTY 테스트1개 실패. GitHub 로그에서 Bash5 bracketed-paste ANSI sequence가 삽입되어 엄격한 CRLF 문자열 비교만 실패한 것을 확인했다. 실제 출력은 존재했다. 테스트가 ANSI/CR을 정규화한 뒤 독립 출력 행을 확인하도록 수정했다. 실제 오류 확인 전 주행/하드웨어 실패로 해석하지 않는다.
- 배포 시 Git이 경고한 nested .gitignore symlink는 정규 tracked 파일로 materialize. stock updated 프로세스만 비활성화해 고정 companion 브랜치가 일반 IQ 업데이트로 교체되는 것을 예방한다. 조향·롱컨 프로세스 정의는 변경하지 않음.
- iq_video.py 추가: ffmpeg CLI가 없으면 IQ의 기존 PyAV로 낮은 우선순위 subprocess에서 TS→MP4 stream-copy. 원본 유지·기존 출력 덮어쓰기 금지·실패 임시 파일 정리. 합성H264 TS4프레임의 MP4 디코딩/codec과 원본SHA 유지, 기존파일보존 2개 통과. 진단은 ffmpeg 또는 PyAV 존재 확인. IQ 설치 CI에는 PyAV를 설치해 테스트를 실행하고 일반 HA 환경에는 강제 의존성을 추가하지 않는다.
- 공식 Actions 문서 확인 후 새 후보 workflow에 Node24 기반 checkout/setup-python v6 및 ubuntu24.04 지정. 수정 후보 전체검증35개와 새 실제 CI는 진행 중. 기존 당근/HA/Comma 설치·OS·재부팅은 변경하지 않았다.

## 2026-11-02 — IQpilot HA 설치 후보 조립 및 게시 준비

- 사용자 요청으로 설치 가능한 개인 시험 후보 준비 계속. build_iqpilot_ha_candidate.py 추가: IQ 원본을 고정 Git 하위 저장소 vendor/iqpilot로 받고, 공개 Python·실행 스크립트와 HA 확장만 상위 Git에 공급. 대용량 바이너리는 원본에서 직접 받으며 서명·검증 경로를 끄거나 비공개 코드를 분석하지 않음. 처음 clone에서 vendor가 없어도 launch_openpilot 진입 후 Git 초기화를 할 수 있도록 실제 실행 파일을 제공한다.
- iq_camera.py 추가: compiled IsTakingSnapshot 키 대신 Git 밖 소유권 marker/lock 사용. 다른 살아 있는 소유자 marker를 지우지 않고 IQ Sentry/Live View 또는 알 수 없는 상태에서 HA 카메라 차단. IQ 제어 Params 쓰기/삭제 거부. 전용 테스트4개 통과.
- iq_preflight.py 추가: 읽기 전용 source/runtime 진단, 후보 소스 SHA256·submodule pin·실행 진입점·shell syntax 확인; 실제 기기에서는 ARM64/Python3.12/Params/DBC/카메라 schema/ffmpeg/OS/config 존재 확인. 카메라 시작/CAN송신/설정변경/재부팅 없음.
- 실제 조립 후보에서 소스검사10개 및 계산·기록·로그·PTY·카메라 기능33개 통과. 공개 원본의 기존 공백 경고는 별도 확인했으며 불필요한 원본 본문 수정은 하지 않음. 기존 운용 브랜치와 별도 iq-ha 후보 브랜치 생성/게시 및 Linux CI 검증을 준비 중. HA 운영 반영·Release·Comma 설치·OS변경·실차 검증은 아직 없음.

## 2026-11-02 — Comma 복귀 백업 Mac 반출 및 검증 완료

- 사용자 승인한 차량 백업을 같은 HA 인증 내 96KiB 블록으로 이어받아 완료. 최종 크기50288578 bytes, SHA256 ade4d0b3b447ad42ff9fdc559aa23e920744ef8f7c75b7f2f6beb22a2f24dad7로 기기 원본과 일치. 파일은 Git 밖 Mac 비공개 백업 폴더에 보관하며 사용자 파일/인증정보는 커밋하지 않는다.
- 독립 재검증: 전체 SHA256, private0600 권한, manifest의 원래 커밋5ec4868a 및 OS19.8-carrot-bt1, Params 포함 확인. archive 내 SQLite5개 각각 read-only quick_check 통과. 원본 Comma 백업 유지, 검증 완료 후 Mac 도구의 중간 .resume만 정리. 해시 sidecar 저장. 임시 HA refresh token 폐기 성공.
- 복귀 ref·기기 외부 설정/DB 백업 확보 단계 완료. IQpilot 설치본은 아직 아님. 공개 IQ MEB DBC의 필수8개 메시지 및 에너지/전압/용량/거리/외기온6개 신호 존재 확인. 실제 CAN/카메라/IQ.OS 왕복/실차 검증 대기 상태 유지. 운영 HA/Comma 프로그램·OS·설정·재부팅 변경 없음.

## 2026-11-02 — IQpilot 개인 시험용 소스 준비와 독립 PTY 어댑터

- scripts/prepare_iqpilot_ha.py 추가. 실제 당근 SHA5ec4868a 및 IQ 안정판 SHA5c9291b9를 고정해 공개 HA Python과 최소 manager 등록 검토 사본 생성. 47개 파일 AST 검사. opendbc.can CANParser를 iqdbc.can.parser에 연결, checkout 경로/data/openpilot와 영속 경로 보존. 기존 IQ 주행 프로세스·low_power 정책 유지. 설치 가능한 릴리즈가 아닌 REVIEW_ONLY_NOT_INSTALLABLE 표시.
- compat/iqpilot/iq_terminal.py 추가. 당근웹7000 없는 IQ에서 기존 HA relay와 연결할 자체 PTY 어댑터, 외부 리스너 없음. 관리자 lease는 기존 HA에서 유지, 명시적 offroad 검사·최대4096-byte 입력·세션ID·자체 자식 그룹 종료·출력 replay 미전송 보존. tests/test_iqpilot_terminal.py에서 실제 Mac PTY 출력, onroad/unknown 시작 차단, offroad 해제 후 쓰기 차단과 종료 2개 통과. 합성 base relay이며 IQ 실기 검증 아님.
- 당근 파라미터 동기화는 검토 사본에서 시작하지 않아 기존 큐를 소비/적용하지 않음. 배터리·충전·주행경계·outbox·로그 활성화 정책 기존 27개 테스트 통과. 최초 overlay 테스트의 PYTHONPATH 누락은 올바른 경로 지정 후 통과.
- docs/IQPILOT_HA_PREPARATION_2026-11-02.md에 근거·완료/미완료 구분 기록. 당근 OS manifest boot/system URL HEAD200 확인, 해시·실설치·IQ.OS 역전환은 미검증. 두 manifest bootloader 차이를 확인했으며 무조건 branch switch 호환을 주장하지 않음.
- 공개 IQpilot Cap’n Proto schema로 3개 livestream의 header/data/idx.timestampSof/idx.flags serialize/deserialize와 CarState canValid/vEgo/gearShifter 확인 통과. 실제 영상 디코딩·카메라 하드웨어 검증은 아님.
- 백업 반출은 같은 인증으로 진행 중. 실제 Mac 최종 SHA256 성공은 후속 기록 대상. IQ/HA 운영 코드 반영·새 IQ 배포 branch·릴리즈·기기 설치·재부팅 없음.

## 2026-11-02 — 블록 전송 운영 진행 및 속도 조정

- 사용자 로그인 후 12KiB 요청 방식으로 연속 전송이 진행됐다. 전체 백업 크기 50288578 bytes 확인, 최종 파일은 아직 미완료. 왕복 요청 비용을 줄이기 위해 96KiB 요청으로 조정하고 재연결 합성 테스트 포함 7개 재검증 통과.
- 기존 전송의 완료 블록 prefix를 비공개 .resume에 보존 후 기존 도구를 정상 인터럽트했다. 새 도구는 prefix를 재해시하여 이어받고 전체 SHA256이 원본과 같을 때만 최종 백업으로 확정한다. 기기 파일 변경 없음.
- IQpilot release의 공개 Git 커밋 5c9291b9df6d90007d73ecd749b135bd5008e80d 확인, blob-filter/no-checkout 임시 Git 조사 저장소 생성. 공개 manager/process_config.py의 PythonProcess 등록·iqpilot namespace·iqdbc CAN parser·livestream 세 서비스 확인. 별도 터미널 backend와 camera 관리 조정이 필요하며 현재 Carrot daemon 그대로 설치 가능한 상태는 아니다. prebuilt/비공개 바이너리 내부는 분석하지 않았다. 실제 IQ+HA 이식/설치/OS 변경 없음.

## 2026-11-02 — 원격 백업 블록 이어받기 및 IQpilot 공개 소스 점검 계속

- 세 번째 저속 전송도 종료: 마지막 서버 상태 connected/offroad/local_ready/ready 모두 true였고 최종 사유 device_disconnected. 실제 주행 때문이라고 단정하지 않는다. 미완성 파일 정리 및 OAuth 폐기 완료, Mac 최종 백업 없음.
- scripts/download_comma_backup.py에 12KiB 블록 요청/offset·크기·블록 SHA256 검증 및 같은 메모리 인증을 사용한 최대 8회 연결 재시도 추가. 완전히 검증된 블록만 저장하고 마지막 완성 offset부터 재요청하며 최종 전체 SHA256 대조 후 이름 확정. offroad/관리자 lease 규칙은 우회하지 않는다.
- 합성 검증 7개 통과: 실제 블록 생산 명령/분할 수신, 잘못된 해시/청크/경로 거부, 합성 HA WebSocket 강제 단절 후 같은 인증으로 다음 offset부터 재연결 및 원본 바이트 일치. 최초 localhost 바인드 권한 제한 후 승인된 로컬 테스트 환경에서 통과. 실기 반출은 재시도 대기.
- IQpilot 안정판 공개 API branches/tree 조회는 HTTP403, 공개 launch_iqpilot.sh는 launch_chffrplus.sh 실행 확인. Git/공개 파일 조사 계속. IQ+HA 이식·설치·OS 변경은 아직 없음.

## 2026-11-02 — 주차 중 원격 반출 재시도와 진단 보완

- 사용자가 실제 주차 상태이며 차량 이동 없음을 재확인. 두 번째 전송은 Mac partial 101376 bytes까지 수신했으나 terminal ended: device_not_offroad로 중단. 이 사유는 HA relay가 offroad/local_ready/status freshness 전체 ready 조건 실패에도 사용하므로 실제 주행 판정이라고 단정하지 않는다. UI는 이후 device_disconnected를 거쳐 주차·준비됨으로 복귀했다.
- Mac OAuth callback의 단일 HTTPServer가 브라우저 선행 연결 때문에 종료 대기할 수 있음을 확인. ThreadingHTTPServer로 변경하고 실패 시 마지막 비밀 없는 ready 상태를 오류에 포함. PTY 출력 부하를 줄이기 위해 3072-byte 단위 간격을 0.01s에서 0.10s로 제한. 이는 원인 확정이나 해결 완료가 아니다. 합성 테스트 4개 통과.
- 기존 시도는 인증 폐기 확인 후 종료 대기를 SIGINT로 해제했다. 미완료 partial만 정리하고 동일 파일/해시로 재시도할 예정. 실제 최종 다운로드 미완료. 사용자 기기 파일/주차 인터록/HA 실행 코드 변경 없음.

## 2026-11-02 — 사용자 승인 백업 반출 시도, offroad 조건 해제로 중단

- 사용자가 해당 차량 백업을 이 Mac으로 받도록 명시 승인. 지정 차량/파일/SHA256으로 다운로드 도구 실행, 사용자 HA 로그인 후 인증 성공.
- 전송 세션이 완료 전에 종료됐으며 실제 HA 카드에 사용 불가 및 ended: device_not_offroad 표시 확인. 주차/offroad 인터록을 우회하거나 기기 재시작하지 않았다. 다운로드 도구는 partial을 정리했고 Mac 대상 폴더에 최종 백업 파일 없음. 임시 HA refresh token 폐기 성공.
- scripts/download_comma_backup.py 오류 메시지에 서버 종료 이유를 포함하도록 보완. 합성 전송 테스트 4개 재실행 통과. Comma 원본 백업 수정/삭제 없음, HA/Comma 코드 배포 없음. 차량이 주차·offroad 준비 상태가 된 뒤 원격 반출 재시도 필요. 다운로드 완료·외부 백업 검증 완료로 보고하지 않는다.

## 2026-11-02 — 원격 백업 반출 운영 점검 및 승인 심사 차단

- Mac 도구 실제 HA OAuth 인증과 관리자 WebSocket 인증 성공 후 차량 자동 선택이 모호해 전송 전에 중단했다. 임시 refresh token 폐기 성공. 백업 바이트 전송/최종 파일 생성 없음.
- 사용자에게 열려 있던 HA 터미널에서 load_config()['device'] 읽기 전용 조회로 현재 차량 식별자를 확인했다. 첫 조회는 잘못된 키 device_id로 KeyError, 올바른 device 키로 재조회 성공. 비밀키/설정 전체는 출력하지 않았다. 브라우저 터미널 제어권은 다운로드 준비를 위해 해제했다.
- 정확한 차량·백업 파일·사전 SHA256을 지정한 재실행이 자동 승인 심사에서 거절됐다. 첫 이유: 식별자를 UI 예시값으로 판단. 기기 설정 조회 증거를 명시한 재검토도 거절: 민감한 백업 전송에는 사용자의 정확한 대상 확인이 필요하다고 판단. 우회 실행하지 않고 사용자 확인 대기. 실제 다운로드·Mac 해시 대조·OS 왕복 전환 미완료.

## 2026-11-02 — 같은 Wi-Fi 없이 Comma 백업 반출 준비

- 사용자 요청으로 현재 터미널 소스와 운영 HA 화면을 확인: 다운로드 버튼/API는 없으며 관리자 전용 HA WebSocket terminal subscribe/acquire/input과 base64 PTY 출력이 존재한다. 소스: terminal_ws.py, terminal_relay.py, frontend/carrot-terminal-card.js, openpilot terminal.py. 일반 로그 업로드 API를 백업 전송에 재사용하지 않는다.
- scripts/download_comma_backup.py 및 tests/test_backup_transfer.py 추가. Mac에서 HA HTTPS OAuth 로그인 후 기존 관리자 터미널로 지정 백업만 읽고 로컬 0600 파일에 저장한다. Comma 파일 쓰기·HA 배포·기기 Git 변경·외부 포트 개방 없음. OAuth 토큰은 메모리 보관, 정상/예외 종료 시 refresh token 폐기 시도. 강제 종료·네트워크 장애에는 폐기가 실패할 수 있다.
- 청크 순서·크기·기존 SHA-256 확인 후에만 최종 파일로 전환. 실패 시 partial 삭제, 제어권 보유 시 Ctrl+C와 세션 해제. 기존 브라우저 터미널 제어권은 먼저 해제해야 한다. 자동 차량 선택은 등록된 carrot_ha 기기가 하나일 때만 허용한다.
- 합성 테스트 4개 통과: 실제 생산 명령의 분할/CRLF 스트림 왕복, 해시 불일치, 청크 누락, 경로/명령 주입 거부. macOS Python3.9 timeout 호환 적용. 실제 HA OAuth 승인·차량 데이터 전송·외부 백업 완료는 아직 미검증. 사용자 승인 없는 로그인 자격증명 추출은 하지 않았다. 임시 환경 aiohttp 설치, 사용자 기기 재시작/업데이트 없음.

## 2026-11-02 — IQpilot 시험 전 당근 복귀 기준 및 비공개 백업 준비

- 사용자 요청: 작은 Comma 화면의 입력 오류를 줄이는 복귀 주소와 왕복 전환 준비. helico717/openpilot의 ha-back 브랜치를 실제 설치 커밋 5ec4868a12a9038547b373eb95be3a5fa86d30aa에 생성했다. 해당 ref의 launch_env.sh 조회 성공, 기본 OS 19.8-carrot-bt1 확인. 복귀 주소 installer.comma.ai/helico717/ha-back. 브랜치를 자동 업데이트하지 않는다. 설치 URL의 기기 실설치·OS 복구는 미검증.
- scripts/backup_comma.py 추가: Git checkout에서 실행하는 백업 전용 도구. 외부 상태 폴더·실제 Params·legacy ACK DB·설정 카탈로그를 비공개 tar.gz로 보관. SQLite online backup과 quick_check, 독립 DB 전환, SHA-256 및 압축 읽기 검증. 원본 변경·복원·재부팅 없음. 파일 복사 중 변경은 실패 처리, DB별 시점은 다를 수 있음. 중첩 symlink 제외를 manifest에 기록. 환경변수로 지정된 추가 경로·영상·모델·OS 이미지는 미포함.
- 합성 검증: 열린 WAL DB의 커밋 데이터 보존, 독립 DB quick_check, Params symlink 해제, 중첩 symlink 제외 통과. 최초 검증에서 백업 목적지 WAL 잔존을 발견해 DELETE journal 전환 후 재검증 통과.
- 실제 기기 백업·Mac 외부 보관·왕복 전환·IQpilot HA 이식은 미완료. 토큰·사용자 DB·원시 로그는 저장소에 포함하지 않았다. 기기 소스 SSH/SCP 수정·HA 반영·릴리즈·재부팅 없음.

## 2026-10-30 — v0.9.0 정식 발행 완료 확인

- 태그 대상 ca6f6e12c27e22cfff260cdf315848110a3ce90b, 새 annotated tag v0.9.0 원격 일치. 준비 CI 40985016234 및 HACS Release 40985134385 모두 success.
- https://github.com/helico717/carrot-ha/releases/tag/v0.9.0 공개 확인: draft=false, prerelease=false, 2026-10-30 10:19:27 KST 발행. 본문에 승인된 14개 분야 전체와 누적 Git 대조 링크·운영 검증·한계·업데이트 안내 존재 확인.
- Git 배포 ZIP에서 manifest 0.9.0과 기본 vehicle.glb SHA-256 61914d35…를 확인했다. HACS 설치 후 패키지 모델을 기본 사용하며 명시적 사용자 모델 URL은 유지된다.
- 운영 파일 추가 반영·HA/Comma 재시작·HACS 업데이트는 실행하지 않았다. 사용자가 HACS 0.9.0 다운로드 후 HA 전체 재시작 및 브라우저 새로고침한다. 수신 앱/Comma 업데이트는 별도 대상이다. 이 후속 문서 커밋은 발행된 태그의 실행 코드를 변경하지 않는다.

## 2026-10-30 — 사용자 승인 정식 v0.9.0 누적 발행 준비

- 사용자가 현재 사용에 불만 없음을 확인하고 정식 0.9.0 발행 및 앞서 제시한 14개 분야 전체 변경 목록 포함을 명시 승인했다. 이전 베타 승인 재사용이 아니다.
- 기준 정식 v0.8.12, 최신 베타 v0.9.0-beta.1, 기능 기준 b69da6c. 정식 이후 383커밋/502파일 및 베타 이후 183커밋을 Git log/diff와 네 변경 기록으로 대조했다. .github/release-notes/v0.9.0.md에 14개 분야 전체 기능·수정·문서·검증/제약·업데이트를 기록하고 docs/releases/0.9.0-audit.md에 전체 커밋/파일/변경 기록 제목을 보존한다.
- manifest를 0.9.0으로 변경. 현재 HA와의 3D 차이는 동일 모델의 기본 재질 내장이며 메모리 bake SHA-256 완전 일치로 해소했다. HACS 설치 시 패키지 모델을 기본 사용하고 명시적인 사용자 모델 URL은 유지한다. UI 실행 코드 수정 없음.
- 운영 확인: 통합 loaded, 전송 OFF API 활성화 및 begin/chunk/commit 403. 최신 코드 CI 40982887630 success. 발행 준비 커밋 CI·태그·GitHub 정식 Release/Actions 결과는 후속 기록으로 확정한다. HA/Comma 재시작·기기 소스 수정·운영 자료 변경 없음.

## 2026-10-30 — 디버그 대시보드 미니 지도 깜빡임·테마 드롭다운 선택 불가 수정

- 사용자 보고(화면 녹화): 디버그 대시보드를 가만히 둬도 개요 탭의 주차 위치·최근 주행 미니 지도가 1초에 약 2번 회색으로 비었다가 다시 그려졌고, 같은 이유로 화면 테마(라이트/다크) 드롭다운을 고를 수 없었다. 운영 대시보드에는 없는 현상.
- 원인: 디버그 카드의 `set hass`가 HA가 새 hass를 줄 때마다(시스템의 아무 엔티티 상태 변화) `updateCameraDevicesUI()`를 불렀고, 이 함수가 조건 없이 `dashCard.render()`를 실행했다. 대시보드는 렌더링 때마다 미니 지도를 지우고 새로 만들며(타일 재요청) 드롭다운 요소도 새로 만든다. 운영 카드의 `set hass`는 충전·온라인 상태가 바뀔 때만 렌더링해서 이 현상이 없다.
- 변경: 카메라 기기 옵션·엔티티 상태 HTML·실효 카메라 모드·언어로 서명을 만들어, 바뀌었을 때만 DOM 갱신과 `dashCard.render()`를 실행한다. 디버그 카드 전체를 다시 그리면 서명을 초기화한다. 운영 대시보드와 HA 백엔드는 바꾸지 않았다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-dashboard-debug.js.
- 검증: 로컬 `preview.html`(실제 모듈)에서 관련 없는 엔티티를 바꾼 hass를 0.5초 간격으로 10번 넘겨도 대시보드 렌더링 0회, 미니 지도 객체·테마 select 요소가 그대로 유지됐다. Carrot 기기 엔티티를 새로 추가하면 렌더링이 실행됨을 확인했다. 콘솔 오류 없음. debug-3d·charge-soc·trip-history·view-state 테스트 통과. `debug-freshness.test.mjs`는 수정 전 HEAD에서도 같은 `import.meta` SyntaxError로 실패하는 기존 문제다.
- 배포 상태: 커밋 `9244a4a` main 푸시 확인. 사용자 요청으로 HA SSH 직접 반영: 반영 전 설치 파일 SHA-256이 직전 커밋과 일치(369f5efe…). `/config/carrot_ha/deployment-backups/9244a4aabdddf7324947570dd583b8ab04c84c6e-debug-flicker/before`에 백업(before.sha256 포함) 후 임시 파일+mv로 교체. 반영 후 커밋과 일치(4522e977…), 권한 644 root:root, 임시 파일 없음. 새 버전·태그·릴리즈 없음.
- 미확인: 사용자 브라우저 새로고침(Ctrl+F5) 후 실제 HA 화면에서 깜빡임·드롭다운 해소. 사용자는 수정 전 아무 조작 없이도 깜빡였다고 확인했다(HA 상태 갱신이 원인이라는 진단과 일치).

## 2026-10-30 — 주행·충전 중 12V 배터리 값 앞 빈칸 제거

- 사용자 보고: 개요 탭의 외기/배터리 줄에서 주행 중에는 색 점이 사라지는데, "배터리"와 값(예: 13.8V) 사이에 빈칸이 크게 남았다.
- 원인: 점(`b::before`)은 주행·충전 중(`data-aux="none"`)에 배경만 투명해지고, 너비 8px와 여백(왼쪽 6px, 오른쪽 4px)은 그대로 남아 약 18px의 빈칸이 생겼다.
- 변경: `data-aux="none"`일 때 점의 너비를 0으로 하고 왼쪽 여백 6px만 남긴다. 옆의 "외기" 항목과 같은 간격이다. 주차 중 정상·주의·경고 점과 회색(판단 불가) 점은 그대로 둔다. 판단 로직과 HA 쪽 코드는 바꾸지 않았다.
- 프리뷰: `preview/aux-voltage/index.html`에 비교안 상자(현재/A. 공간 제거/B. 회색 점 유지)와 주차↔주행 번갈아 보기를 추가했다. 사용자가 A안을 승인했다. Windows용 미리보기 서버 설정(`aux-voltage-preview-win`, python, 8767 포트)을 `.claude/launch.json`에 추가했다.
- 관련 파일: custom_components/carrot_ha/frontend/{carrot-dashboard-ko.js,carrot-dashboard-en.js}, tests/dashboard-aux-battery.test.mjs, preview/aux-voltage/index.html, .claude/launch.json.
- 검증: dashboard-aux-battery·live-loading·lazy-runtime·view-state 16개 통과. 실제 운영 모듈을 쓰는 미리보기(한국어)에서 점 영역이 주행·충전 중 6px, 주차 중 18px로 측정됐고 콘솔 오류는 없었다. 영어 대시보드는 CSS 규칙을 테스트로만 확인했다. 확대 스크린샷은 브라우저 창이 그려지지 않아 남기지 못했다.
- 배포 상태: 커밋 `3e27b9b` main 푸시 확인. 반영 전 HA 설치 파일 2개의 SHA-256이 직전 커밋과 일치함을 확인했다(ko 20a62d6e…, en ddaa1754…). `/config/carrot_ha/deployment-backups/3e27b9b6ce0a943d5276b95e8c4a830852793d88-aux-dot-gap/before`에 백업하고(before.sha256 포함) HA SSH(`sudo`)로 임시 파일+mv 교체했다. 반영 후 커밋 해시와 일치(ko cc585900…, en 1204c3af…), 권한 644 root 유지, 임시 파일 없음. 새 버전·태그·릴리즈 없음.
- 미확인: 사용자 브라우저 새로고침(Ctrl+F5) 후 실제 HA 화면.

## 2026-10-30 — 토글 비활성·실행 API 구버전 잔존 확인

- 사용자 화면: 전송 설정 조회 실패, 회색 OFF 모양/disabled wait 커서. 운영 읽기 전용 확인: Carrot HA 엔트리loaded, switch.caryang_id_4_driving_log_transfer=off, 정책 파일0개(기본OFF).
- 중요: 차량용 GET state 실응답에 transfer 키가 없고 complete3109개를 반환했다. 현재 실행 중인 DeviceView는 파일 반영 전 구버전이다. 따라서 스위치 상태OFF만으로 실제 업로드 차단이 작동한다고 보고하지 않는다. 새 UI 정책 조회 실패도 새 API 미로딩과 일치한다.
- 원인: __init__.py async_setup에서 driving_logs HTTP view를 HA 프로세스 시작 시 등록한다. 08:42 시작실패 후09:11 통합reload는 엔트리/새 switch 모듈은 복구했으나 이미 import·등록된 기존 HTTP view를 교체하지 않았다. 앞선 reload 안내는 통합 복구에는 해당하지만 새 API 활성화에는 불충분했다.
- 사용자 조치: HA Core 전체 재시작 후 브라우저Ctrl+F5. Comma 업데이트 전에도 새 서버는 기본OFF로 구버전 업로드를 거부하게 된다. 이후 실 state transfer.enabled=false 및 정책조회 성공을 재확인해야 한다. 현재 재시작/설정변경/차량업데이트는 실행하지 않았다.
- 부수로그:09:11 can_capture.py upload KeyError can_capture 3건은 reload 중 런타임 초기화와 겹친 흔적, 현재 계속 발생하는지는 미확인. Docker보호설정 변경·DB조작·토큰출력 없음. 코드수정·배포·새릴리즈 없음.
## 2026-10-30 — HA 재시작 후 Carrot HA setup_error 읽기 전용 진단

- 사용자 보고: HA 재시작 후 구성요소 로딩 실패, Comma 업데이트/재부팅 전. 현재 운영 로그·Core 엔트리 상태·DB 잠금을 읽기 전용으로 조사했다.
- 오류: 2026-10-30 08:42:41.653 KST homeassistant.config_entries, async_setup_entry->__init__.py:113 Archive 생성->storage.py:31/58 transaction commit에서 sqlite3.OperationalError: database is locked. 이후 camera no-entries 경고는 통합 미로딩의 후속 증상. switch/transfer_policy/Comma 호환 오류 traceback은 확인되지 않았다. 오류시각은 토글 실행 커밋24d8d90(09:00:57 KST)과 직접 반영보다 이전이다.
- 현재09:06 KST API domain carrot_ha state=setup_error, disabled_by=null, supports_unload=true. 원본 archive414,400,512B, journal_mode=delete, WAL/rollback journal 없음. mode=ro/query_only 스키마 읽기 정상, /proc/locks에서 해당 inode 활성 잠금0, SSH 진단 Python 장기 실행0. 잠금 주체는 사후 확정 불가. 앞선 장시간 데이터 조회와 재시작이 겹친 가능성을 배제하지 않는다. DB 손상 여부 전체 검사를 수행한 것은 아님.
- 로그 접근: sudo 환경의 ha CLI는 인증누락401. 기존 SSH 앱 /run/s6/container_environment/SUPERVISOR_TOKEN을 메모리로만 읽어 기존 Supervisor read API/CLI에 전달해 정상 조회. 토큰은 출력/저장하지 않음. Docker protection mode는 변경하지 않았다.
- 사용자 조치: HA 설정→기기 및 서비스→Carrot HA→다시 불러오기(또는 사용자 HA 재시작)로 현재 해제된 일시 잠금 이후 재시도. Comma 업데이트는 이 DB 시작 실패 해결의 선행조건이 아님. 에이전트는 통합 reload/HA·Comma 재시작/DB 쓰기/잠금 파일 삭제/정책 변경을 실행하지 않았다. 코드 변경·새 릴리즈 없음. 통합 복구 성공은 사용자 재시도 후 미확인.
## 2026-10-30 — 신규 생성 주행 로그 전송 토글 구현·검증

- 사용자 프리뷰 승인: 원시 CAN 외 정보는 모두 유지, OFF 기간 로그는 향후에도 수신하지 않음. 첨부 두 빈 버튼은 분석 설정/로그 설정이며 프리뷰에 HA ha-icon 정의가 없어 생긴 표시 문제. 프리뷰에서만 아이콘 fallback을 추가, 운영 HA 아이콘 코드는 보존.
- HA: 설정 창 토글 및 switch 엔터티, 기본 OFF 영속 정책, ON/OFF 세대 식별값과 기준시각, 관리자 발급 쿠키 세션의 정책 API, begin/chunk/commit 허가 검사·OFF 수신 거부, 차량 적용 확인 표시. browsing·NAS·기존 저장 로그·일반 상태 경로 유지.
- Comma: 정책 미지원·기본 OFF는 전송 안 함. 새 활성 세대 확인 시 이미 존재하는 열린/완료 세그먼트를 기준선으로 제외, 이후 새 디렉터리만 허용하며 기기 Git 밖 영속 기록에 저장. OFF/ON 후 이전 대기·미완료 제외, 동일 ON 세대 재시작 시 허용 신기록 이어받기, 허가 오류 후 정책 재확인. 활성 확인 전에 시작된 현재 세그먼트도 보수적으로 제외한다.
- 파일: custom_components/carrot_ha/driving_logs/{transfer_policy.py,http.py}, switch.py, frontend/carrot-logs-settings.js; openpilot/selfdrive/carrot/ha/{driving_logs.py,tests/test_log_activation.py}; tests/test_log_transfer_policy.py/test_driving_logs_transport.py, scripts/preview_log_transfer.py.
- 검증: HA 정책2·실제 Comma 송신기→HA aiohttp 포함 transport6·runtime2·tiered9·store8·외부 upload7 통과(총34), Comma 활성 필터2+필수 polling4 통과. Comma 전체86 중81통과/환경 오류5(fcntl Linux 전용2, Windows symlink 권한1, bash/cp9492). 전체 성공으로 보고하지 않음. JS 구문 검사 통과, 실제 모듈 Chrome 토글ON/OFF 및 모바일390x844 경계 확인. 기기 실설치는 미확인.
- 상태: 커밋·푸시·HA 백업/해시 직접 반영 준비 중. 새 버전·태그·Release 발행 없음. 사용자 HA/Comma 재시작은 실행하지 않음.
## 2026-10-30 — SOC % 정수 표시를 반올림에서 버림으로 변경

- 요청/이유: 사용자가 SOC % 정수 표시에서 소수점을 반올림하지 말고 버리도록 요청했다. 표시 SOC 원본은 CAN 0x14A의 0.5% 단위라서, 기존에는 58.5가 59, 99.5가 100으로 올라가 보였다.
- 변경: 사용자에게 보이는 정수 SOC를 모두 버림으로 바꿨다(58.5→58, 99.5→99). 부동소수 오차로 80이 79.999…가 되는 경우를 막으려고 1e-6을 더한 뒤 버린다.
  - 차량 대시보드(ko/en): 현재 SOC 큰 숫자·타일·상세 행, 주행 카드·타임라인의 시작/종료 SOC(Wh 대체 계산 포함), 충전 기록의 시작/종료 SOC, 시간별 막대 툴팁, 배터리 아이콘 단계, 80% 표시 판단. 충전 기록에 시작/종료가 모두 있으면 충전 %p를 표시된 두 정수의 차이로 보여 줘 숫자끼리 어긋나지 않게 했다.
  - 차계부: 현재 상태의 `배터리 SOC`.
  - HA 엔터티 `sensor.id_4_battery`: 상태값을 버림 정수로 바꾸고(HA 기본 표시는 반올림이라 상태값에서 처리), 원본을 속성 `raw_soc_percent`, 방식을 `display_rounding=truncate`로 남겼다.
- 변경하지 않음: 저장·계산 값(0.5% 원본, 주행/충전 기록의 소수 첫째 자리 SOC, 에너지·전비·주행가능거리·ETA), 차계부의 %p 소모량 같은 계산 지표의 소수 표시, 디버그 대시보드. 레이아웃·디자인 변경 없음(숫자 처리만 바뀌어 프리뷰 절차는 적용하지 않았다).
- 관련 파일: custom_components/carrot_ha/{display_soc.py,sensors_v3.py}, frontend/{carrot-dashboard-ko.js,carrot-dashboard-en.js,carrot-vehicle-journal.js}, tests/{dashboard-soc-truncate.test.mjs,test_new_sensors.py,trip-ui.test.mjs}. trip-ui는 73.5%를 74가 아니라 73으로 기대하도록 갱신했다.
- 검증: 신규 JS 3개·Python 1개 통과. JS 전체 124개 중 118개 통과, 실패 6개(camera-360·charging-curve·debug-freshness·motion-status·range-c3-and-fixes·frontend-revision-bootstrap)는 HEAD 스냅숏에서도 똑같이 실패한다. Python: test_new_sensors 23개와 SOC·주행·충전·회귀 게이트 194개가 각각 통과. 같이 실행하면 test_new_sensors의 기존 3개와 신규 1개가 모듈 스텁 충돌로 실패하는 기존 격리 문제가 있다.
- 배포 상태: 커밋 `9b44244` main 푸시 확인. 반영 전 HA 설치 파일 5개의 SHA-256이 직전 커밋 `1889fb8`과 일치함을 확인했다. `/config/carrot_ha/deployment-backups/9b442441168e63cc3dcffa320773d936def9a722-soc-truncate/before`에 백업하고(before.sha256 포함) HA SSH(`sudo`)로 임시 파일+mv 교체했다. 반영 후 5개 모두 커밋 해시와 일치(display_soc.py d551774c…, sensors_v3.py b5c16cfb…, carrot-dashboard-ko.js 20a62d6e…, carrot-dashboard-en.js ddaa1754…, carrot-vehicle-journal.js 64b35de0…), 권한 644 root 유지, Python 컴파일 통과, 임시 파일 없음. 첫 시도는 권한 거부·BusyBox chmod 옵션 미지원으로 파일을 바꾸지 못했고 백업 후 재시도했다. 버전 상승·태그·릴리즈 없음.
- 미확인: 사용자 HA 재시작·브라우저 새로고침 후 실제 화면, 계기판의 표시 방식이 실제로 버림인지(실차 대조 양식의 값 전이 기록으로 확인).

## 2026-10-29 — 주유 영수증 OCR을 여러 번 인식·계산 검증 방식으로 개선

- 사용자 보고: 내연기관 주유 영수증을 찍어도 인식이 잘 안 돼 직접 입력하고 있었다. 목표는 대충 찍어도 날짜·금액·주유량·단가·주유소가 맞게 자동 입력되는 것이다.
- 원인 조사: 사용자가 준 GS 영수증 사진 두 장으로 확인했다. ① 품목명(`01 경유`)과 숫자(`44.077 1,815 80,000`)가 다른 줄에 있고 순서가 "수량→단가→금액"이라, "한 줄·단가 먼저" 규칙만 아는 파서가 글자를 정확히 읽어도 단가·주유량·금액을 비워 뒀다. ② `합 계`, `승인  금액`처럼 띄어 쓴 라벨을 찾지 못했다. ③ `선승인금액 149,900원 (취소)`를 승인금액으로 읽었다. ④ 주소의 도 이름은 약칭(전남)만 알았고, 줄바꿈으로 잘린 도로명("…산포면 영 / 산로 6022")을 "산로"로 잘못 이었다. ⑤ 실제 Tesseract 결과에서 세로로 두 배 큰 숫자 줄이 `4.07 1805 8000`처럼 틀렸고, 날짜(16→18)·상호도 인식 크기에 따라 매번 달랐다.
- 변경(carrot-receipt-ocr.js):
  - 사진에서 가장 큰 밝은 영역(영수증 종이)을 찾아 잘라낸다. 원본 비율로 두 가지 크기(폭 1000·1600px), 세로 0.55배 압축, 압축+영역별 이진화 등 최대 5번 인식한다. 세로 압축은 큰 숫자 줄을 정상 비율로 만들어 정확히 읽게 한다. 최소 3번 인식한 뒤 모든 항목이 정해지면 일찍 끝낸다. 영수증 단어가 거의 안 보이면 90°/270° 회전도 시도한다.
  - 단가·주유량·금액은 영수증 어디에 있든 `단가 × 수량 = 금액`이 맞는 숫자 세 개를 찾아 정한다(`solveFuelTriple`). 계산이 맞지 않으면 단가·주유량을 채우지 않는다(예전에는 검증 없이 채웠다). `80,0002`("원"을 2로 읽음), `8 ,000`, `80.000` 같은 인식 형태도 읽는다.
  - 날짜·유종·계산 결과·합계는 인식 결과끼리 투표로 정하고, 동률이면 비워 둔다. 상호·주소는 공백을 무시하고 다수결로 정하며, 영문 소문자 잡음이 섞인 상호와 0으로 시작하는 건물번호는 버린다.
  - 금액은 `실승인금액 > 승인·합계·주유금액` 순서로 고르고 `선승인`·`취소` 줄은 제외한다. 합계가 계산된 금액과 다를 때 할인·쿠폰·세차 같은 단어가 있으면 합계를, 없으면 계산으로 검증된 금액을 쓴다.
  - 띄어 쓴 라벨 정규화, 전라남도·경상북도 등 도 정식 명칭, 줄바꿈된 도로명 잇기, 품목 줄의 `경우`(경유 오인식) 처리를 추가했다. 쓰이지 않게 된 `extractFuelRow`를 제거했다.
  - 영수증 상단 전화번호를 읽는다(`station_phone`). 주유소 매칭은 전화번호가 하나만 일치하면 바로 확정하고, 주소를 못 읽었으면 구별되는 상호가 한 주유소에만 일치할 때만 확정한다. 상호 비교는 공백을 무시한다.
- 변경(carrot-vehicle-journal.js): 주유소 검색을 전화번호 → 주소 → 상호 순서로 시도하고 처음 확정되는 결과에서 멈춘다. HA 검색 API의 1초 제한에 맞춰 1.1초 간격으로 호출한다. 전화번호만 읽혀도 매칭을 시작한다. 화면·문구·레이아웃 변경은 없다.
- 변경(vehicle_journal/api.py): 카카오 키워드 검색 결과에 `phone`과 `category_name`을 함께 돌려준다. 기존 필드와 주소 검색 대체 경로는 그대로다.
- 검증: tests/receipt-parser.test.js 27개 통과(기존 20개 + 신규 7개: 열 배치·띄어쓴 라벨·줄바꿈 주소, 선승인 취소 제외, 여러 번 인식 투표, 오인식 합계보다 검증된 금액 우선, 무관한 숫자로 조합을 만들지 않음, `경우`·0 건물번호, 전화번호·상호 매칭). 신규 테스트의 상호·주소·전화·카드 값은 가상 값이다. 이 PC에 jsc가 없어 node에서 jsc의 readFile/print만 대신하는 실행기로 돌렸다. vehicle-journal/tests/test_location_search.py·test_api_authorization.py 통과(Windows 기본 인코딩 문제로 `PYTHONUTF8=1` 필요, 변경 전에도 같음). carrot-vehicle-journal.js `node --check` 통과.
- 실제 사진 검증: 사용자 사진 두 장을 로컬 브라우저에서 실제 Tesseract로 처리했다. 두 장 모두 날짜 2026-10-16, 경유, 단가 1,815원, 주유량 44.077L / 4.408L, 금액 80,000원 / 8,000원, 전화번호가 정확했고 계산 검증을 통과했다. 2번은 상호·주소도 맞았다. 1번은 다섯 번 모두 주소 둘째 줄을 잘못 읽어 주소가 비었지만 상호·전화번호는 맞았다. 데스크톱 기준 약 6~11초 걸렸다. 사진은 Git에 넣지 않았다.
- 배포 상태: 커밋 e7a4f00을 main에 푸시했다. 반영 전 HA 설치본 세 파일의 SHA-256이 직전 커밋 72f6c06의 파일과 일치함을 확인했다. 기존 파일을 /config/carrot_ha/deployment-backups/e7a4f00…/에 백업하고 임시 파일을 쓴 뒤 mv로 carrot-receipt-ocr.js·carrot-vehicle-journal.js·vehicle_journal/api.py 세 개를 반영했다. 설치본 SHA-256(62d767a4…, 3e906174…, f2b90043…)이 커밋과 일치하고, 두 화면 파일의 HTTP 제공본(200)도 일치한다. api.py는 HA에서 py_compile을 통과했다. frontend-version은 0.9.0-beta.1-445708268577이다. 영수증 인식·주유소 검색 순서는 새로고침만으로 적용된다. 검색 결과에 전화번호를 담는 api.py 변경은 사용자 HA 재시작 후 적용되며, 그 전에는 전화번호 일치 대신 주소·상호로 매칭한다. 실제 HA 화면에서의 동작은 아직 확인하지 않았다. 버전 상승·태그·Release는 없다.
- 알려진 제한·미확인: 휴대폰에서는 인식 시간이 더 길 수 있으며 아직 측정하지 않았다. 카카오 키워드 검색이 전화번호 검색어로 해당 주유소를 돌려주는지는 실제 HA에서 확인하지 않았다(실패하면 주소·상호 검색으로 넘어간다). 영수증 양식이 다른 주유소(SK·S-OIL·셀프 등)의 실제 사진으로는 아직 검증하지 않았다. 실제 HA 화면에서의 자동 입력은 아직 확인하지 않았다.

## 2026-10-29 — 차계부 사이드바 아이콘을 노트 아이콘으로 변경

- 사용자 요청: HA 사이드바의 차계부 메뉴가 차량 아이콘(`mdi:car-electric`)이라 차량 대시보드(ID.4)와 구분되지 않고 차계부답지 않았다.
- 변경: custom_components/carrot_ha/__init__.py의 `async_register_panel` 호출에서 `sidebar_icon`을 `mdi:notebook-edit-outline`(기록하는 노트)으로 바꿨다. 패널 URL·제목·관리자 제한·모듈은 그대로다. 사이드바의 "ID.4" 메뉴는 이 통합이 등록한 패널이 아니라 HA 대시보드 설정 항목이라 이번 변경 대상이 아니다.
- 검증: `python -m py_compile` 통과. 이 아이콘을 검사하는 테스트는 없다.
- 배포 상태: 커밋 f8a9b439b4feb33e16293e2a968bfbc5a0709ec8을 main에 푸시했다. 반영 전 HA 설치본 SHA-256(561bb306…)이 직전 커밋 bd401b3의 파일과 일치함을 확인했다. 기존 파일을 /config/carrot_ha/deployment-backups/f8a9b439b4feb33e16293e2a968bfbc5a0709ec8/에 백업하고, 임시 파일을 쓴 뒤 mv로 바꿔 __init__.py 한 개만 반영했다. 설치본 SHA-256 0c444c20…이 커밋과 일치한다. 패널 등록은 통합 시작 시 실행되므로 사용자 HA 재시작 후 적용되며, 실제 사이드바 표시는 아직 확인하지 않았다. 버전 상승·태그·Release는 없다.

## 2026-10-29 — 높은 모니터에서 차계부 배경이 화면 끝까지 이어지지 않던 문제 수정

- 사용자 보고: 높은 해상도 모니터에서 차계부의 어두운 배경이 내용 높이에서 끝나고, 그 아래로 HA 기본 밝은 배경이 보였다.
- 원인: carrot-journal-panel-runtime.js의 패널 `:host`가 `min-height:100%`였다. HA가 커스텀 패널을 넣는 상위 요소에는 정해진 높이가 없어서 브라우저가 이 퍼센트 값을 무시했다. 그래서 내용이 화면보다 짧을 때만 문제가 보였다.
- 변경: `min-height:100vh;min-height:100dvh`로 바꿔 화면 높이를 최소 높이로 쓴다. 모바일 주소창 높이 변화는 dvh로 반영하고, 지원하지 않는 브라우저는 vh를 쓴다. 내용이 길면 지금처럼 늘어난다. 레이아웃·카드·색상 변경은 없다.
- 프리뷰·검증: vehicle-journal/review-panel-height.html은 높이가 정해지지 않은 밝은 상위 요소 안에 실제 패널 runtime과 차계부를 띄운다. 2000×1500 화면에서 예전 값은 패널 높이가 1133px에서 끝나 문제가 재현됐고, 새 값은 1500px까지 채웠다. 가로 넘침은 없었다. `node --check` 통과. 실제 HA 화면은 아직 확인하지 않았다.
- 배포 상태: 커밋 e0a1bbb4abffc663585dc19b928c7e561d6221c6을 main에 푸시했다. 반영 전 HA 설치본 SHA-256(266ed944…)이 직전 커밋 4a2cbad의 파일과 일치함을 확인했다. 기존 파일을 /config/carrot_ha/deployment-backups/e0a1bbb4abffc663585dc19b928c7e561d6221c6/에 백업하고, 임시 파일을 쓴 뒤 mv로 바꿔 carrot-journal-panel-runtime.js 한 개만 반영했다. 설치본과 HTTP 제공본(200)의 SHA-256 20951b10…이 커밋과 일치하고, frontend-version은 0.9.0-beta.1-4374fee9fea2로 바뀌었다. HA 재시작 없이 새로고침하면 적용된다. 2026-10-29 사용자가 높은 모니터의 실제 HA 화면에서 배경이 끝까지 채워지는 것을 확인했다. 버전 상승·태그·Release는 없다.

## 2026-10-29 — 절약 비교 주행거리 선택을 세그먼트 선택기로 변경

- 사용자 요청: 절약 비교 탭의 주행거리 버튼(기록된 거리·1,000km·5,000km·10,000km·100,000km·직접 입력)을 상단 카테고리 탭처럼 보이게 바꾼다. 프리뷰에서 상단 탭형(A)과 월별·연도별형(B)을 비교했고, 사용자가 B를 선택했다.
- 변경: carrot-journal-design.js의 `#page2 .distance-choices` 스타일만 바꿨다. 한 묶음 바탕(`--j-bg`)과 테두리(`--j-border`) 안에 버튼을 한 줄로 배치하고, 선택한 칸은 `--j-raised` 바탕과 그림자, 굵은 글씨로 표시한다. 기존 민트 채움은 쓰지 않는다. 절약 비교 패널이 540px 이하이면 container query로 3칸×2줄로 바꿔 가로 잘림과 스크롤을 막는다. 버튼 구성·aria-pressed 상태·거리 계산·직접 입력 동작은 바꾸지 않았다.
- 프리뷰: vehicle-journal/review-distance-selector.html. 저장소 루트에서 `python -m http.server`로 연다. 실제 차계부 모듈에 합성 mockHass를 넣었고, 현재/A/B 스타일 전환과 데스크톱·모바일 폭 전환을 제공한다.
- 검증: 프리뷰에서 실제 디자인 파일을 불러와 확인했다. 2000px 폭에서는 한 줄로 표시되고(clientWidth=scrollWidth), 375px 폭에서는 3×2 grid로 표시되며 페이지 가로 넘침이 없다. 10,000km 선택 시 값과 aria-pressed가 갱신되고, 직접 입력 선택 시 입력칸이 열린다. `node --check` 통과. vehicle-journal/tests/browser-check.cjs는 이 Windows PC에 playwright가 없어 실행하지 못했다. 실제 HA 화면은 아직 확인하지 않았다.
- 배포 상태: 커밋 b15c8059382dde9cb59f063625c47182ed2fbeb7을 main에 푸시했다. 반영 전 HA 설치본 SHA-256(dfe53ef3…)이 직전 커밋 bf781c4의 파일과 일치함을 확인했다. 기존 파일을 /config/carrot_ha/deployment-backups/b15c8059382dde9cb59f063625c47182ed2fbeb7/에 백업하고, 임시 파일을 쓴 뒤 mv로 바꿔 carrot-journal-design.js 한 개만 반영했다. 설치본과 HTTP 제공본(200)의 SHA-256 46a77813…이 커밋과 일치하고, frontend-version은 0.9.0-beta.1-9a7dc0026046으로 바뀌었다. 화면 모듈만 바뀌었으므로 HA 재시작은 필요 없고 차계부를 새로고침하면 된다. 실제 사용자 브라우저 화면은 아직 확인하지 않았다. 버전 상승·태그·Release는 없다.

## 2026-10-28 — 수신 앱 SOC 설명 정정 및 기존 배터리 엔터티 실제 적용 확인

- 사용자 지적: 수신 앱 0.1.4 공지의 '비교 전용' 문구가 '기존 배터리 엔터티의 표시 SOC로 즉시 전환, 관찰 엔터티 없음'이라는 최신 지시와 맞지 않았다. addons/carrot_receiver/CHANGELOG.md를 CAN 표시 SOC 전달·기존 엔터티 사용·Wh/에너지 유지 안내로 바로잡았다. 수신 앱 실행 코드·버전·태그·Release 변경 없음.
- 운영 확인: /health에서 수신 앱 0.1.4 및 ok=True 확인. HA Recorder 최신 sensor.id_4_battery 값 58.5%, soc_source=can_0x14a_byte19, can_id=0x14A, signal=byte19_x0.5_percent를 확인했다. 기존 엔터티에 실제 새 코드가 적용돼 기록되고 있다. 관찰용 display_soc_candidate_percent unique_id 엔터티 등록은 없음.
- 시각/신선도: 새 Recorder 행은 2026-10-28 23:25 KST, 실제 후보 측정은 18:29:56 KST이며 stale=True다. 새 Recorder 행을 새 CAN 측정으로 해석하지 않는다. 58.5 원본 저장과 정수 화면 표시는 구분한다. 실제 사용자 브라우저의 렌더/클릭을 이번에 새로 검증하지 않았다.
- 검증/상태: 읽기 전용 DB·등록부·health 확인 및 문서 정정, diff 검사. 운영 DB·계산·설정·재시작·새 릴리즈 변경 없음. 이전의 '사용자 재시작 후 엔터티 확인 대기'는 이번 실제 기록 확인 범위에서 해소됐다.

## 2026-10-28 — CAN 표시 SOC 전환 후 CI 전체 성공 확인

- 실행 코드 57ead34 및 검증 보완 b8e9eda를 포함한 새 Actions https://github.com/helico717/carrot-ha/actions/runs/40690379321 완료 success. radar-ha-python·regression 모두 success 확인. 이전 실행 40689714991의 실패와 구분한다.
- HA 설치 코드는 57ead34의 14개 파일과 동일하고 b8e9eda 이후 운영 코드 추가 변경은 없다. 파일 백업/원자 교체/해시·HTTP 4개 파일 제공 확인 완료, 사용자 HA 재시작과 기존 sensor.id_4_battery의 실제 CAN SOC·Recorder 및 화면·차계부 확인은 대기다.
- 별도 관찰 엔터티 정의를 제거했고 기존 배터리 unique_id/entity_id를 보존한다. 원본 0.5%·정수 반올림 표시, 에너지/전비/비용/주행가능거리/충전 ETA 에너지 모델 유지. CAN이 없는 과거 기록은 출처를 구분해 보존한다. 버전 상승·태그·pre-release 없음.

## 2026-10-28 — 기존 배터리 엔터티의 표시 SOC를 CAN으로 전환

- 최신 지시가 이전 다일 검증 후 전환 보류보다 우선한다. 지금 표시 SOC를 CAN bus1 0x14A byte19×0.5%로 바꾸고 기존 sensor.id_4_battery를 유지한다. 별도 관찰용 엔터티는 제거한다. 며칠 실사용 후 별도 승인으로 beta.2를 발행하며 지금 발행하지 않는다.
- 범위: 현재 SOC·주행/충전 경계·배터리 사용 이력·차계부의 SOC 표시/집계. Wh/kWh/전비/충전량/비용/주행가능거리·기존 충전 ETA 에너지 모델은 유지한다. ETA 목표 정합성은 별도 검증 사항이다.
- 과거 CAN 값 없는 기록은 기존 환산 출처로 보존하고 현재 CAN 값으로 소급 채우지 않는다. 서로 다른 SOC 출처 사이의 증감은 계산하지 않는다. 원본 0.5%를 보존하고 정수 표시는 기존 반올림 계열로 유지한다.
- 구현: display_soc.py로 수신 CAN SOC 유효 범위/측정시각/last-known 정책을 공유한다. vehicle.py·sensors_v3.py는 기존 배터리 엔터티에 CAN SOC와 측정/출처/stale 속성을 제공하고 정수 표시만 적용한다. telemetry.py의 별도 엔터티 정의를 제거하고 entity_migration.py에서 기존 관찰 엔터티가 생겼으면 제거한다.
- 기록: trip_repair.py의 기존 배치 조회에 표시 SOC를 더해 Wh 파생과 독립적으로 양쪽 경계를 보존한다. storage.py·battery_history.py·vehicle_journal/{source,store}.py와 frontend/{carrot-trip-days,carrot-dashboard-ko,carrot-dashboard-en,carrot-vehicle-journal}.js에 적용. 차계부 출처 정책 버전으로 한 번 재동기화·재집계하며 원본 이벤트/수동 SOC는 덮어쓰지 않는다. 양쪽 CAN 경계가 없으면 기록 전체를 기존 환산 출처로 유지하고, source가 다른 시간 구간의 사용량/주행 병합은 막는다. 프론트엔드 변경은 데이터 선택/표시 자릿수이며 레이아웃·디자인 변경 없음.
- 에너지 불변: CAN SOC를 Wh로 역산하지 않는다. 기존 tripDisplayEnergyWh의 SOC 기반 에너지 대체식에는 교체 전 에너지 SOC만 전달한다. 충전량·비용·실측 전비·최근50km 전비·주행가능거리·충전 ETA 모델은 변경하지 않았다. 표시 SOC와 기존 ETA 목표의 정합성은 실사용 확인 대상이다.
- 검증: 관련 Python 13스위트 162개 실행 통과(신규 CAN 현재값/무효/미수신/미래/오래된 측정, 주행·충전 경계와 에너지 불변, SOC 사용 이력 및 기존 엔터티 ID 보존 포함). Node 41개 통과. 차계부 test_journal 26개는 Windows SQLite 잠금으로 기본 cleanup에 오류가 나며, 기존 코드 변경 없이 cleanup 직전 gc.collect를 수행하는 실행기에서 기능·신규 CAN 재집계 모두 26개 통과. runtime_schedule 1개 통과. tests/{test_display_soc_switch,test_display_soc_candidate,test_new_sensors,test_charging_smoothing,test_entity_migration}.py 및 display-soc-switch.test.mjs·vehicle-journal/tests/test_journal.py에 검증 근거를 보존. 전체 CI 통과로 확대하지 않는다.
- 배포 상태: 실행 코드 커밋 57ead346ff1a05fc3ea284a317cad9eacc50a7a1 main 푸시 후 HA 코드 14개를 직전 main과 줄바꿈 정규화 비교해 전부 일치함을 확인했다. /config/carrot_ha/deployment-backups/57ead346ff1a05fc3ea284a317cad9eacc50a7a1-display-soc/에 기존 파일과 before/after SHA-256 manifest를 백업하고 임시 파일+os.replace로 원자 반영했다. 모든 설치 파일이 Git 커밋 해시와 일치, Python compile 통과.
- 제공/동작 확인: 실제 사용자 주소의 carrot-dashboard-ko.js·carrot-dashboard-en.js·carrot-trip-days.js·carrot-vehicle-journal.js는 HTTP 200 및 설치본 SHA-256 일치. 새 코드를 보관된 최신 상태에 읽기 전용 실행해 CAN SOC 58.5%, 출처 can_0x14a_byte19, 측정 18:29:56 KST·stale=True, 에너지 37.0kWh 유지 확인. 이는 실행 중 HA 엔터티의 전환 확인이 아니다. 사용자 HA 재시작 뒤 기존 sensor.id_4_battery·화면·기록 생성·재집계 확인 대기. HA/Comma 재시작·DB 직접 수정·태그/Release 발행 없음.
- CI 후속: 57ead34 Actions 40689714991에서 radar-ha-python 성공, regression Python 단계 실패. 작업 전에도 재현한 test_receiver_options.py의 AST 실행 namespace가 새 DEFAULT_REFERENCE_EFFICIENCY_KPL을 누락하는 오류를 확인했다. 실제 battery.py 상수 AST를 읽도록 테스트만 보완했고 해당 테스트 통과. CI 상세 로그 API는 권한 오류로 읽지 못했으므로 이 오류가 유일한 CI 원인이라고 단정하지 않는다. 후속 커밋의 새 CI 결과를 별도 확인한다.

## 2026-10-28 — 전체 보관 SOC 후보 비교·64kWh 계산 영향·정수 표시 검토

- 사용자 요청: 이미 수집한 전체 기록에서 후보 신뢰도를 비교하고 전비·차계부 등 64kWh SOC 사용처 영향과 정수 표시의 소수 처리 방식을 검토한다. 운영 계산 변경은 하지 않는다.
- 조사: 활성 HA 상태 이력 47,262행 전체와 주행 438행 확인. 보존 CAN gzip 73,142파일 전체 읽기 완료/오류 0, 유효 후보 11,036,281프레임, 2초 이내 Wh 동시 비교 중복 제거 7,326쌍. KST 10/7~14·27~28, 후보 2.5~100%. 순환 삭제된 자료·다른 백업/NAS rlog까지 조사했다고 주장하지 않는다.
- 결과: 후보−Wh/640 평균 +0.149%p, 평균 절대 차이 0.538%p, ±1%p 94.16%, ±2%p 99.56%(초과 32쌍). 범위 −2.421875~+2.640625%p. +극값 10/10 08:16경 98.5% 대 95.859375%, −극값 10/10 23:35경 60% 대 62.421875%. 해당 시각 차이는 0.003~0.131초. 앞선 −0.81~+2.11은 최근 직접 수신 이력 범위의 결과이며 전체 범위와 구분한다.
- 해석: 실제 계기판 숫자의 독립 대조가 아니므로 후보 정확도 확정/용량·SOH 추정/전면 SOC 전환의 근거로 단정하지 않는다. 충전과 온로드에서 편향 방향이 다르고 중간 SOC에서도 큰 차이가 있어 다일 검증 유지.
- 발견: 수신 앱 /health는 0.1.3, 주행 이벤트 438행에 후보 경계 필드 없음. 0.1.4 업데이트 후 새 경계 보존 확인 필요. Docker 조회는 보호 모드로 차단돼 보호 설정 변경 없이 health 조회로 대체했다.
- 영향/정수 표시: docs/SOC_VALIDATION_2026-10-28.md에 전체 사용처·근거·후속 검증을 기록. Wh 기반 에너지·전비·kWh/비용은 유지하고 표시 SOC·%p/100km·충전 목표시간은 별도 검토한다. 64,000Wh 초과 시 주행 경계 SOC가 비워지는 기존 경로도 확인. 원본은 0.5% 유지, 정수 표시의 반올림/버림과 99.5% 처리·Python/JS 반올림 차이는 계기판 대조 후 확정한다.
- 상태: 검토 문서/변경 기록만 추가. 임시 센서 telemetry.py 파일 반영은 별도 항목 참조. 사용자 HA 재시작·엔터티/Recorder 생성 확인 대기, SOC 우선순위·기존 기록·계산·버전·태그·Release 변경 없음.

## 2026-10-28 — 검증용 SOC 후보 진단 센서 HA 직접 반영

- 사용자 요청: 기존 sensor.id_4_battery를 유지하고 후보를 임시 별도 엔터티로 등록해 기록한 뒤 신뢰도를 비교한다.
- 코드: 기존 main a763ea1의 telemetry.py 후보 정의·속성을 배포. sensors_v3.py는 이미 후보 진단 분류 및 measurement state_class를 지원하고 기본 활성화 대상이다. 기존 SOC 계산 변경·새 릴리즈 없음.
- 검증: test_display_soc_candidate.py 3개 통과. HA 설치본이 후보 변경만 빠진 예상 내용과 일치함을 확인하고 백업 후 한 파일만 반영, Python compile 구문 검사 통과. 설치/커밋 SHA-256 5ceb8817a8acc8418977d5f88d045d1b561896f935b39e525a90005e8016d4cd 일치. 백업 /config/carrot_ha/deployment-backups/a763ea1-soc-candidate-20261028T115037Z/telemetry.py.
- Recorder: 기존 배터리 states_meta 기록 존재, 후보는 아직 미등록. configuration.yaml의 recorder purge_keep_days=7, 제외 엔터티는 휠속도뿐으로 후보는 제외 대상 아님. 후보 %/measurement는 장기 통계 대상 조건을 갖추지만 실제 통계 생성은 미확인. 7일 원시 이력과 장기 집계 통계는 구분한다.
- 상태: 파일 반영 완료, 사용자 HA 재시작 후 엔터티 ID/활성화·숫자 수신·Recorder/통계 생성 확인 대기. 에이전트가 재시작하지 않았다. 검증 전 기존 SOC 우선순위를 유지한다.

## 2026-10-28 — 사용자 결정: SOC 후보 다일 검증 후 전환·beta.2 발행 판단

- 사용자 지시: bus 1 `0x14A`, byte19 × 0.5% 후보를 현재 사용 중인 모든 SOC 정보에 적용하기 전에 며칠간 검증하고 그때 전환한다. beta.2는 검증·전환 판단 이후 발행하며 이번 지시는 발행 승인이 아니다.
- 검증 기간 동안 대시보드·차계부·센서·주행/충전 계산의 기존 SOC 기준과 우선순위를 유지한다. 후보 수신 사실만으로 기본 SOC를 교체하지 않는다. 이전 main 후보 포함 준비 결정은 진단 기능 범위이며 전면 전환 허가로 해석하지 않는다.
- 검증 계획: 실제 계기판과 후보를 같은 시각에 대조하고 충전/주행/주차·재기동, 낮은/중간/높은 잔량에서 비교한다. 신호별 실제 측정시각과 신선도를 구분하고 반복 보관값은 독립 측정으로 세지 않는다. 100% 부근 +2.11%p 차이도 확인한다. 기존 계산과의 차이와 계기판 대비 정확도는 구분한다.
- 미정/후속: 정확한 검증 일수·허용오차·전체 SOC 사용처별 전환 설계는 아직 확정하지 않았다. HA 진단 센서는 미등록 상태로 별도 준비 필요. 자동 모니터링/일정은 생성하지 않았다. 결과 검토와 사용자 전환 결정 전까지 운영 계산·설정·재시작·버전·태그·Release 변경 없음.

## 2026-10-28 — Windows beta.2 사전 점검 및 SOC 후보 실제 수신 확인

- 범위: main `fb1ef34`, `v0.9.0-beta.1` 이후 157커밋/189파일. Windows 최신화 후 운영 HA 통합 파일을 읽기 전용 비교했다. 320개 중 줄바꿈 정규화 시 317개 동일, `telemetry.py`·`frontend/carrot-vehicle-3d.js` 내용 차이, 내장 `vehicle.glb` 미설치. Windows CRLF 차이를 코드 차이로 취급하지 않았다.
- 사용자 범위: beta.2에 main의 SOC 후보 센서와 내장 3D 모델도 포함해 준비. HA 사용자 모델과 내장 모델 SHA-256은 서로 달라 동일 모델로 단정하지 않는다. 버전·태그·Release 발행 승인은 아직 없음.
- SOC 조사: HA archive를 SQLite mode=ro로 조회. 10월 27일 이후 상태 3,118건 중 후보 숫자 포함 1,953건. 측정 후 180초 이내 967행/고유 측정시각 627개, 범위 58.5~100.0%. 같은 행의 Wh/640 대비 후보 차이는 평균 +0.520%p, -0.812~+2.109%p(동일 CAN 시각의 독립 계기판 대조는 아님). 최신 보관값 58.5%, 실제 측정 2026-10-28 18:29:56 KST이며 이후 반복값을 최신 측정으로 해석하지 않는다. HA 센서 등록이 없어도 수집·보관 값은 존재한다. 대시보드/차계부 SOC 계산 변경 없음.
- 극값 후속 확인: +2.109375%p는 2026-10-28 07:45:13~07:45:30 KST 보관 기록(고유 후보 측정 1개)에서 후보 100.0%, Wh 62,650/640=97.890625%. 후보 측정 07:45:12, Wh 측정 07:45:13으로 1초 차이이며 장시간 stale 값끼리의 비교가 아니다. 07:45:43에는 99.5%/97.8125%(+1.6875%p), 07:46:44에는 99.0%/97.734375%(+1.265625%p). 조사 집계의 -0.8125%p는 10월 27일 22:22:09 KST 충전 기록에서 89.5%/90.3125%(57,800Wh), 두 신호 측정시각 차이 1초. 실제 계기판 숫자 일치·차이의 원인은 아직 미확인.
- 검증: Node 전체 118건 중 112통과/6실패. 4개 파일은 vm import.meta 처리, 1개 motion-status 기대값 불일치, 1개 python3 실행 경로 오류. Python 기존 격리 venv에서 55스위트 중 47통과/8실패(Windows 잠금·cp949·numpy 누락 및 receiver_options NameError 포함). 별도 range 19개, aux 14개 통과. journal 25개 실행은 Windows 파일 잠금 cleanup 오류 8개로 전체 통과 아님.
- CI: 최신 코드 b258662의 Actions 40636283795에서 radar-ha-python 성공, regression의 Python 회귀 단계 실패. 공개 로그는 403으로 상세 원인 미확인. 로컬 실패와 CI 원인이 같다고 단정하지 않는다.
- 상태: 사용자 SOC 설명 요청으로 beta.2 종합 점검을 잠시 중단하고 수신 근거를 확인했다. 조사·기록만 수행, 운영 코드/DB/설정·HA/Comma 재시작·버전/태그/Release 변경 없음. 발행 준비 완료 아님.

## 2026-10-28 — beta.2 준비를 위한 현재 HA 읽기 전용 대조 및 과거 미확인 상태 정정

- 사용자 요청: changelog의 과거 미확인 상태를 현재 상태로 해석한 보고를 정정하고 실제 HA를 점검한다. 텔레포토 실제 Comma 영상·CPL 테두리는 사용자가 확인했고 문제 없다고 명시했다.
- 범위/기준: main `b258662`, 2026-10-28 15:45~15:55 KST. HA 설치 통합 추적 파일 320개를 SHA-256 비교: 312개 바이트 동일, 5개 CRLF/LF 차이만 있고 내용 동일, 2개 내용 차이, 1개 미설치. 원격 소스와 로컬 텍스트 diff로 차이를 확인했다.
- 실제 차이: `telemetry.py`에 계기판 SOC 후보 정의·속성이 빠져 있고 현재 HA 상태 화면에서도 해당 엔터티가 없다. `frontend/carrot-vehicle-3d.js`는 기존 `/carrot_ha_models/vehicle.glb` 경로를 사용한다. 저장소의 `frontend/carrot-assets/models/vehicle.glb`는 미설치지만 기존 사용자 모델은 존재하므로 3D 전체 미배포로 해석하지 않는다.
- 정정: 자동 사진 삭제 수정 `vehicle_journal/store.py`는 이미 최신 main과 SHA-256 동일. 설치 시각 14:06:19 KST, pycache 생성 14:08:16 KST 확인. 이전 항목의 반영 예정 상태는 현재 설치 상태와 다르다. 실제 사진 삭제·저장은 이번 읽기 전용 점검에서 실행하지 않았다.
- 실제 로그인 HA 화면: 배터리 정상 12.6V, 주행가능거리 344km 표시. 상태 도구의 range 센서도 344km이며 `efficiency_basis=recent_distance_window`, 전비 6.67, 거리 50km, source=states로 최종 계산 활성화 확인. 두 관찰용 전력 엔터티는 생성되어 있으나 현재 unknown/stale이므로 현재 값 수신 성공으로 해석하지 않는다. 차계부 화면 정상 렌더 확인(개인 기록 내용은 보존하지 않음).
- 로그 보관: HA 8주행/276완료 세그먼트/약 4.39GB, NAS 99주행/2940완료 세그먼트/약 46.17GB, replica_verified 2940. HA 276개 전부 NAS manifest 일치, 누락/불일치 0. 무료 로컬 분석은 reports 8개·segments 캐시 1500개가 존재해 실행 결과 생성 흔적 확인. 실제 Gemini 생성 성공은 이번에 확인하지 않았다.
- 한계: HA CLI core info/logs는 API token 401로 읽지 못했다. 보호 설정 변경·인증 우회 없음. 설치·pycache·실제 화면·저장 결과의 증거 범위를 구분한다. 수신 앱 버전과 Comma 설치 커밋은 이번에 직접 확인하지 않았다.
- 배포 상태: 읽기 전용 조사와 changelog 정정만 수행. 운영 코드/DB/설정 변경, HA/Comma 재시작, 버전 상승·태그·Release 발행 없음.

## 2026-10-28 — 자동 충전·주유 기록의 사진 삭제 저장 오류 수정

- 증상: 자동 충전 기록 수정 화면에서 사진을 지우고 저장하면 "입력한 충전 금액을 확인해 주세요."가 표시되며 저장되지 않는다(사용자 보고).
- 원인: `store.py` `save_manual()`이 `remove_attachment_ids`가 있을 때 `origin='manual'` 기록만 허용하고 자동 기록은 `ValueError('직접 기록의 사진만 수정할 수 있어요.')`로 거부했다. `api.py`가 모든 ValueError를 `invalid_input`/"입력한 충전 금액을 확인해 주세요."로 바꿔 원인과 무관한 문구가 나왔다. 사진 업로드 수정(`934205d`)과 같은 origin 규칙 불일치다.
- 변경: 사진 삭제 허용 대상을 `manual`과 `automatic` 기록으로 넓히고 문구를 '사진을 수정할 수 없는 기록이에요.'로 변경. 사진 존재·활성 검증은 그대로다. `api.py`의 ValueError 일괄 문구는 이번에 바꾸지 않았다.
- 관련 파일: `custom_components/carrot_ha/vehicle_journal/store.py`, `vehicle-journal/tests/test_journal.py`(자동 기록 사진 업로드·삭제 회귀 테스트 추가; 수정 전 코드에서 실패, 수정 후 통과 확인).
- 검증: `test_journal.py` 25개 통과(Python 3.9 + Pillow venv). 전체 스위트의 기존 9개 에러는 Python 3.9의 `ignore_cleanup_errors` 미지원 등 이번 변경과 무관하다.
- 배포 상태: 커밋 후 HA 직접 반영 예정(Python 변경, 사용자 HA 재시작 필요). 운영 화면 검증은 미확인.

## 2026-10-28 — 12V 배터리 전압 색상 표시 운영 반영 (HA 저전압 지속 시간·히스테리시스 포함)

- 요청: 프리뷰로 확정한 기준을 운영 대시보드에 반영한다. 라벨은 `배터리`(영어 `Battery`), 주행 중은 색 없음, 주차 중만 색 표시, 저전압 지속 시간 계산과 히스테리시스를 HA 쪽에 포함한다.
- 근거: 2026-10-14~28 기록 분석(아래 프리뷰 항목). Comma가 꺼질 때의 마지막 값(약 11.8V)은 방전이 아니라 차량 기상 순간의 강하이고, 정차 중에도 약 65~70분마다 1~4분 강하(최대 4분)가 반복된다. 그래서 낮은 값은 지속될 때만 경고로 올리고, 오래된 값은 색을 입히지 않는다.
- HA(`aux_battery.py` 신규, `vehicle.values()`에서 호출): 표시 자릿수와 같은 0.1V 단위로 판정한다. 12.2V 이상 정상, 12.0~12.2V 주의, 12.0V 미만은 10분 이상 이어질 때 경고(그 전에는 주의 `low-pending`), 주차 중 13.0V 이상(`dcdc`)과 주행·충전 중(`active`)은 판정하지 않는다. 히스테리시스: 좋은 쪽으로 돌아갈 때는 0.1V를 더 올라야 한다(주의→정상 12.3V, 경고→주의 12.1V). 정상→주의는 12.1V에서 바로. 그래서 하루 이상 주차 때 12.1/12.2V를 오가도 색이 깜빡이지 않는다. 측정이 3분 넘게 끊기면 저전압 지속 시간과 기억한 단계를 모두 지운다. 같은 측정 시각의 중복·과거 측정은 무시하므로 어느 클라이언트가 몇 번 읽어도 계산은 한 번이며 DB 조회가 없다(수신기 요청·쓰기 추가 없음). HA 시작 때 최근 1시간 상태 기록 60건으로 한 번 복원한다(실패해도 시작은 계속).
- 추가 값(`values()`): `aux_level`(ok/caution/warn/없음), `aux_level_reason`, `aux_low_minutes`, `aux_age_s`(측정 후 경과 초). `aux_voltage`는 기존처럼 마지막 알려진 값을 유지한다.
- 대시보드(`carrot-dashboard-ko.js`, `-en.js`, `-debug.js`): `auxBatteryView`/`auxBatterySpan`이 12V 줄을 그린다. 주행·충전은 색 없음, 주차는 서버 단계 색, 그 외 상태(데이터 지연·통신 지연·오프라인·확인 불가)와 측정 후 10분 초과, 전압 없음, DC-DC는 회색(오래된 값은 `N분/시간 전` 표기). 값은 항상 소수 한 자리(`12.0V`). 점은 값에 붙이고 라벨과 6px 띄웠으며 `외기`도 같은 간격으로 맞췄다. 글자색 선택자는 폭 820px 이상에서만 쓰이는 `.overview-col-visual .mini-condition span b`보다 우선하도록 `.mini-condition .aux-battery b[...]`로 지정했다. 디버그 시뮬레이터는 상태별 12V 값과 단계 필드를 내려준다. 센서 이름 `12V 배터리 전압`은 그대로다.
- 발견·수정: `aux_age_s`가 `null`이면 JS에서 `null>=0`이 참이라 측정 시각을 모르는 값이 최신으로 처리될 뻔했다(테스트가 잡음). 숫자인 경우만 신선도를 인정한다.
- 프리뷰(`preview/aux-voltage/`): 운영 코드가 줄을 그리고 슬라이더는 위 필드를 흉내 내 넘기는 검증 도구가 됐다. 온도 보정 입력은 판정 함수에 선택 기능(기본 꺼짐)으로 남아 있고 운영에는 넣지 않았다(이 차 기록의 온도 효과는 신뢰하기 어려움: +0.008 V/°C, 하루 단위 온도 변화와 섞임).
- 관련 파일: custom_components/carrot_ha/{aux_battery.py,vehicle.py,__init__.py,frontend/carrot-dashboard-ko.js,frontend/carrot-dashboard-en.js,frontend/carrot-dashboard-debug.js}, tests/{test_aux_battery.py,dashboard-aux-battery.test.mjs}, preview/aux-voltage/index.html.
- 검증: Python 신규 14개와 기존 test_new_sensors(22)·history_cache·incremental_sync·cloud_live·range_efficiency·trip_energy 통과. 프런트 신규 6개와 필수 회귀(`dashboard-live-loading`, `dashboard-lazy-runtime`, `dashboard-view-state`, `dashboard-calculation-regressions`) 통과. 운영 코드로 한국어·영어 × 다크·라이트 × 상태 5종·단계 10경우를 폭 1280/768/430/390px에서 점검(색·점·간격·기준선·넘침·라벨) 이상 없음. 사전 실패(수정 전 HEAD에서도 동일): `camera-360`·`charging-curve`·`debug-freshness`·`range-c3-and-fixes`(Node의 `export` 구문 오류), `motion-status`(단언 실패), Python `test_direct_receiver`(이 Mac에 `aiohttp` 없음). 이 중 `debug-freshness`는 실행되지 않아 디버그 대시보드 변경은 브라우저로 확인했다.
- 한계·미확인: 실제 차량에서의 경고 발생 시점과 HA 재시작 후 복원 결과, 사용자 브라우저에서의 실제 표시. 경고 기준(12.0V, 10분)은 이 차 2주 기록과 AGM 일반 특성에 기반하며 불량 배터리의 전압은 관찰된 적이 없다. 겨울 기록이 쌓이면 주의 경계(12.2V)를 다시 본다. 영어 390px 계열에서 카메라 버튼이 다음 줄로 넘어가는 동작은 사용자 결정으로 유지.
- 배포 상태: 커밋 `371d7fa` main 푸시 확인. HA SSH 직접 반영(2026-10-28): 반영 전 설치본 5개(`__init__.py`, `vehicle.py`, ko/en/debug 대시보드)를 `/homeassistant/carrot_ha/deployment-backups/371d7fa/before/`에 백업(`SHA256SUMS.before`, 신규 파일 표시 `NEW_FILES_ABSENT_BEFORE` 포함)했다. 반영 전 설치본은 `vehicle.py`·ko·en·debug가 직전 커밋과 해시 동일, `__init__.py`는 23행 주석 한 줄만 달랐다(코드 동일, 이전 커밋의 주석 변경 미반영). 반영 후 6개 파일(`aux_battery.py` 신규 포함)의 크기와 SHA-256이 저장소 `371d7fa` 원본과 일치하고 Python 3개 파일 문법 검사를 통과했다.
- 배포 사고(복구 완료): 첫 반영 시 zsh가 `$SHA:custom_components/…`를 변수 수정자로 해석해 `git show`가 실패했고, 빈 내용이 위 6개 HA 파일에 약 수 분간 덮어써졌다. 그 검증은 빈 파일끼리 해시를 비교해 "일치"로 잘못 나왔다. 곧바로 로컬에서 내용·크기를 확인한 파일로 재반영해 복구했고, 이번 검증은 크기 0 초과와 원본 해시 일치로 다시 했다. 그 사이 HA 재시작은 없었고 이미 메모리에 올라간 Python 코드는 영향이 없었다. 대시보드 JS는 그 시간에 불러온 화면이 있었다면 새로고침 전까지 비정상일 수 있었다. 재발 방지: 배포 스크립트는 `${변수}:경로` 형태와 "비어 있지 않음" 확인을 필수로 한다.
- 사용자 조치: HA를 **재시작**해야 Python 변경(12V 단계 계산)이 적용된다. 재시작 전에는 새 대시보드가 `aux_level`을 받지 못해 12V 줄이 회색으로 보인다. 브라우저는 강력 새로고침(Ctrl+F5)이 필요하다. 버전 번호(`0.9.0-beta.1`)·pre-release는 그대로이며 발행하지 않았다.
- 재시작 후 확인(2026-10-28 13:45 KST, 읽기 전용 SSH): 설치된 `aux_battery.py`·`vehicle.py`의 `__pycache__`가 13:40:46/13:40:57에 생성돼 재시작한 HA가 새 모듈을 불러왔음을 확인했다. 설치된 `aux_battery.py`와 `archive_codec.py`를 실제 archive의 최근 상태 60건에 시작 때와 같은 방식(`seed` 후 `apply`)으로 돌린 결과 `aux_voltage=12.78`, `aux_level=ok`, `aux_level_reason=ok`, `aux_low_minutes=0`, `aux_age_s=64`였고 최근 12개 분 단위 샘플이 모두 ok였다.
- 미확인: 실행 중인 HA 프로세스가 실제로 내려주는 값(대시보드 API는 관리자 인증이 필요해 직접 호출하지 못함, 컨테이너 로그는 SSH 보호 모드로 읽지 못함), `async_setup_entry`의 복원이 실제로 실행됐는지, 저전압·경고 경로의 실차 동작(현재 12.8V로 정상). 사용자 화면에서 `배터리 ● 12.8V`의 초록 점과 마우스 올림 설명 `정상`으로 확인한다.

## 2026-10-28 — 개요 `외기 / 배터리 / 카메라` 줄 세로 정렬 보정 (좁은 화면)

- 증상: 폭 820px 미만에서 `데이터 지연`(또는 카메라 상태) 항목만 약 11px 아래로 처져 보이고, 주차 중 카메라 버튼도 `외기`·`배터리` 글자와 높이가 맞지 않았다.
- 원인: 세로 가운데 정렬(`align-items:center`)이 `@media (min-width:820px)` 안의 `.overview-col-visual .mini-condition`에만 있었다. 좁은 화면의 기본 `.mini-condition` 규칙에는 없어서, `.mini-condition-camera-disabled`의 `min-height:38px`로 늘어난 줄에서 글자가 위쪽에 붙고 `데이터 지연`만 안쪽 가운데 정렬로 낮게 놓였다. 12V 색상 작업과 무관한 기존 결함이다(장식 제거 후에도 동일).
- 변경: 한국어·영어 대시보드의 기본 `.mini-condition` 규칙에 `align-items:center`만 추가했다(`carrot-dashboard-ko.js`, `carrot-dashboard-en.js` 각 1줄). 디버그 대시보드는 두 클래스를 상속하므로 별도 수정이 없다. 12V 색상·라벨 변경은 포함하지 않는다(미승인).
- 영향 범위: 폭 820px 이상은 이미 같은 값이라 변화 없음. 좁은 화면의 줄 높이·줄바꿈은 바꾸지 않았다. 영어 390px 계열에서 항목이 많아 카메라 버튼이 다음 줄로 넘어가는 동작은 그대로 둔다(사용자 결정).
- 검증: 운영 CSS만으로(프리뷰 임시 보정 제거) 한국어·영어 × 주차·충전·주행·데이터 지연·통신 지연에서 항목 글자 세로 중심 편차 0px(보정 전 데이터 지연 11px). 필수 회귀 `dashboard-live-loading`, `dashboard-lazy-runtime`, `dashboard-view-state`, `dashboard-calculation-regressions` 통과.
- 배포 상태: 커밋 `f3f8e8e` main 푸시 확인. HA SSH 직접 반영(2026-10-28): 반영 전 `carrot-dashboard-ko.js`·`carrot-dashboard-en.js`를 `/homeassistant/carrot_ha/deployment-backups/f3f8e8e/before/`에 백업(`SHA256SUMS.before` 포함)하고, 두 파일의 설치본 SHA-256이 저장소 `f3f8e8e` 버전과 일치함을 확인했다(ko `cdb60b44…`, en `4bfc27bd…`). 반영 전 설치본은 직전 커밋 `4fa6a66`과 해시가 같아 드리프트가 없었다. 디버그 대시보드 파일은 바뀌지 않았다. 버전 번호(`0.9.0-beta.1`)·pre-release는 그대로이며 발행하지 않았다.
- 미확인: 사용자 브라우저/HA 앱에서의 실제 표시. 버전이 같아 캐시가 남아 있을 수 있으므로 강력 새로고침(Ctrl+F5, 모바일 앱은 캐시 삭제 후 재진입)이 필요하다. HA 재시작은 필요 없다. 실제 HA 폰 폭에서의 영어 줄바꿈 동작도 미확인.

## 2026-10-28 — 12V 배터리 전압 색상 표시: 기준 분석과 인터랙티브 프리뷰 (운영 미반영)

- 요청: 대시보드 개요의 `외기 / 12V` 줄에서 12V 전압을 AGM 배터리 상태로 한눈에 보이게 색을 입힌다. 주행 중은 색 없음, 주차 중만 색 표시. 임계값은 조정 가능.
- 조사(HA archive 읽기 전용, 상태 기록 2026-10-14~28, 20,868건): Comma가 꺼질 때의 마지막 값(약 11.8V)은 방전이 아니라 차량이 깨어나는 순간의 전압 강하였다. 급락한 같은 분에 `hv_voltage`가 처음 들어오고 `charge_mode`가 `hv_off`로 바뀌며, openpilot `power_monitoring.py`의 `VBATT_PAUSE_CHARGING = 11.8`(저역통과 전압 기준 종료)과 맞는다. 정차 중에도 약 65~70분 간격으로 1~4분짜리 11.7~11.9V 강하가 65건 반복됐고 가장 긴 것이 4분이었다.
- 주차 전압 실측: 주행·충전 후 15분 이내 중앙값 12.73V, 12~18시간 12.38V, 24~36시간 12.19V(하위 5% 12.11V). 정상 범위 최저 11.96V. 외기온(대부분 9~23°C) 영향은 분리되지 않아 보정하지 않았다.
- 프리뷰 기준안: 주차 중 12.2V 이상 정상 / 12.0~12.2V 주의 / 12.0V 미만이 10분 이상 지속되면 경고. 주행·충전은 색 없음. 측정이 10분 넘게 오래됐거나 데이터 지연·통신 지연, 주차 중 13.0V 이상(DC-DC 동작)은 회색. 표시 자릿수에 맞춰 0.1V 단위로 판정한다. 경고 지속 시간은 처음 5분으로 제안했다가 실측 강하 최대 4분의 여유가 얇아 10분으로 올렸다.
- 추가 파일: `preview/aux-voltage/{index.html, aux-voltage-status.mjs, replay.json}`, `.claude/launch.json`에 `aux-voltage-preview`(포트 8766) 추가. 운영 대시보드·통합 코드는 변경하지 않았다.
- 검증: 실제 디버그 대시보드 카드 위에서 상태 5종 × 전압·경과 9조합, 한국어/영어, 다크/라이트, 폭 390/768/1280 오버플로·줄바꿈·겹침 점검 통과. 실측 재생 5개 구간에서 경고는 한 번도 뜨지 않았고 종료 후 회색으로 전환. 판정 함수 경계값 Node 점검 통과.
- 한계·미확인: 2주·차 1대·정상 배터리 기록이라 불량 배터리의 전압은 알 수 없고 12.0V 경계는 AGM 일반 특성 기반이다. 경고의 "10분 지속" 판정은 분 단위 기록이 필요해 운영 적용 시 HA 쪽에서 저전압 지속 시간을 계산해 대시보드에 내려줘야 한다(프론트엔드는 최신 값만 가진다). 12.1~12.2V 경계에서 주의와 정상이 번갈아 바뀔 수 있어 완충 구간(히스테리시스)은 승인 후 결정한다.
- 프리뷰 수정(같은 날): 점을 넣으려고 값을 `inline-flex`로 바꿨던 것이 기준선과 간격을 어긋나게 해 점을 일반 인라인 요소로 교체했다. 값의 기준선이 이웃 항목(`외기`)과 일치함을 측정으로 확인했다. 요청에 따라 제목 `12V`를 `배터리`(영어 `Battery`)로 바꿨다. 점 간격은 라벨과 6px 더 띄우고 숫자와는 4px로 붙였다(요청). 운영 대시보드(ko/en/debug)의 라벨은 아직 그대로이며 승인 후 함께 바꾼다. 센서 이름 `12V 배터리 전압`은 변경하지 않았다.
- 프리뷰 수정(같은 날, 2차): `외기` 항목의 라벨-숫자 간격을 배터리의 라벨-점 간격(6px+공백)과 같게 맞췄다(점 크기만큼 더 벌리지 않음, 사용자 정정). 점이 없는 상태(주행·충전)에서도 점 자리를 유지해 상태 전환 때 레이아웃이 움직이지 않는다. 온도 보정(`tempCoef`, 기본 0=끔, 기준 20°C)을 선택 입력으로 추가하고 프리뷰에 외기 온도 슬라이더를 넣었다. 이 차 기록(주차 중 전압 8,985건, 10.5~24°C)에서 경과 시간을 통제하고 구한 온도 계수는 +0.008 V/°C(R² 0.586→0.611)로 부호·크기 모두 신뢰하기 어렵다(온도가 하루 단위로만 바뀌어 날짜 효과와 섞임, 외기온≠배터리 온도). 참고: 앞서 말한 -20 mV/°C는 충전 전압 보정 값이며 휴지 전압(OCV)의 온도 계수는 이보다 훨씬 작다. 겨울 기록이 쌓이기 전에는 보정을 켜지 않는다.
- 기존 결함 발견(프리뷰에서 보정, 운영 미반영): `외기 / 배터리 / 카메라(또는 데이터 지연)` 줄의 세로 가운데 정렬 `align-items:center`가 폭 820px 이상 미디어쿼리 안에만 있다(`carrot-dashboard-ko.js` 528행 `.overview-col-visual .mini-condition`, 디버그 파일 3983행 부근). 더 좁은 화면에서는 `.mini-condition-camera-disabled`의 `min-height:38px`가 줄 높이를 38px로 늘리고 나머지 항목 글자는 위쪽에 붙은 채 `데이터 지연`(안쪽 가운데 정렬)만 약 11px 아래로 처져 보였다. 12V 색상 작업과 무관하게 이미 있던 문제이며(장식을 제거해도 동일), 프리뷰의 `.mini-condition{align-items:center}`로 정렬 편차 0px을 확인했다(보정을 끄면 11px). 운영 반영 때는 같은 규칙을 미디어쿼리 밖 기본 규칙으로 옮긴다.
- 좁은 화면 영향: 라벨을 `12V`→`Battery`로 바꾸면 영어에서 줄이 약 19px 길어져, 프리뷰의 390px(카드 322px)에서는 카메라 버튼이 아래 줄로 넘어간다(원래는 1px 여유로 겨우 한 줄). 한국어는 한 줄에 들어간다. 430px(카드 362px)에서는 영어도 한 줄이다. 실제 HA 폰 화면 폭에서의 동작은 미확인.
- 배포 상태: 프리뷰 단계이며 커밋·버전 상승·릴리즈·HA 반영 없음. 사용자 승인 후 운영 파일에 반영한다.

## 2026-10-28 — 관찰용 엔터티: 보조 장치 소비 전력, 공조 전력 요청 (주행가능거리에는 미반영)

- 요청: 원시 CAN 분석(연구 저장소 `docs/aux-power-analysis-2026-10-28.md`)에서 `0x5AC HVEM_02`의 `HVEM_IstLeistungNA`가 모터 출력이 없는 구간의 배터리 전력과 일치했다. 장기 관찰을 위해 별도 엔터티로만 추가하고 주행가능거리 계산에는 넣지 않는다.
- Comma(`helico717/openpilot`, `carrot-wip-model_selector-ha`, 커밋 `a07274381`): 이미 파싱하던 `HVEM_02`에서 `hv_aux_power_w`(IstLeistungNA, 0~25,450 W)와 `climate_power_request_w`(Leistung_Klima_Vorgabe, 0~12,650 W)를 읽는다. 초기값·오류 코드(raw 510/511, 254/255)와 미수신은 값으로 쓰지 않고 0은 값으로 유지한다. 새 CAN 송신 없음. 관련 파일은 `openpilot/selfdrive/carrot/ha/telemetry_fields.py`, 테스트 `tests/test_hvem_observation.py`(3건).
- HA: `보조 장치 소비 전력 (관찰용)`, `공조 전력 요청 (관찰용)` 센서를 W 단위, 진단 범주로 추가했다. 다른 하드웨어 필드처럼 180초가 지나면 만료된다. 속성에 `observation_only`와 출처 신호, 의미 설명을 둔다. 두 값은 `range_km` 계산에 쓰이지 않으며 테스트로 확인한다.
- 의미: `보조 장치 소비 전력`은 보조 장치 부하 후보이며 공조 소비가 포함되는지는 미검증이다. `공조 전력 요청`은 요청값으로 공조를 껐을 때도 1 kW대가 나온 값이고 실제 소비나 공조 사용 지표가 아니다.
- 한계: 값은 수집기 샘플링 시점의 순간값이다(1분 평균 아님). 정밀 분석은 원시 CAN 기록을 계속 사용한다.
- 관련 파일: custom_components/carrot_ha/{telemetry.py,sensors_v3.py,entity_migration.py}, tests/test_new_sensors.py.
- 검증: Comma 쪽 ha 테스트 6개 파일 통과(신규 3건 포함), HA 쪽 test_new_sensors(신규 1건 포함), entity_migration, range_efficiency, trip_repair, trip_energy, history_cache, incremental_sync, optional_telemetry 104개 통과. 실제 차량에서 값이 들어오는지는 미확인.
- 배포 상태: Comma 커밋 `a07274381` 원격 브랜치 푸시 확인(사용자의 `git pull --ff-only` 후 재부팅 필요). HA는 커밋 `785133a` main 푸시 확인 후 직접 반영했고 `/homeassistant/carrot_ha/deployment-backups/785133a/before`에 백업했다. `sensors_v3.py`·`entity_migration.py`는 직전 커밋과 일치함을 확인한 뒤 커밋 파일로 교체했다(해시 f2c267e7…, f509608f…). **`telemetry.py`는 HA 설치본에 계기판 SOC 후보 변경(`b972426`)이 아직 없어서, 이 항목 변경과 무관한 그 작업이 함께 배포되지 않도록 설치본에 이번 센서 정의 두 줄만 더해 반영했다(해시 649a5e52…).** 따라서 설치된 `telemetry.py`는 저장소 파일과 해시가 다르며 차이는 `b972426`의 계기판 SOC 후보 부분뿐이다. 다음에 `b972426`을 배포할 때 저장소 파일로 교체하면 정리된다. HA 구문 검사는 `__pycache__` 권한 문제로 HA에서 실행하지 못했고 반영한 `telemetry.py`는 로컬 컴파일만 확인했다. **Python 변경이므로 HA 재시작 전에는 적용되지 않는다.** 재시작 후 엔터티 생성과 차량 값 수신은 미확인. 버전 상승·태그·릴리즈 없음.

## 2026-10-28 — 주행가능거리가 항상 수치를 갖도록: 최근 50 km를 시점 제한 없이 + 부족하면 있는 만큼 + 참고 전비 옵션

- 요청: 기록이 부족해도 주행가능거리를 "알 수 없음"으로 두지 말고 항상 수치를 표시. 코드에 숨겨진 고정 기본값에 의존하지 않는다.
- 변경(A): 최근 50 km 구간 계산(`_window_efficiency`)의 7일 제한을 제거했다. 상태 기록(보관 약 14일)을 먼저 보고 50 km가 안 되면 보관 기간과 무관하게 남는 주행별 거리·에너지 기록(`trip_energy`)에서 최신 주행부터 50 km까지 모은다(마지막 주행은 비례 반영). 둘 중 거리가 더 많은 쪽을 쓰며 센서 속성 `window_efficiency_source`(states/trips)에 표시한다. 장기 평균이 아니라 "마지막으로 달린 50 km"이다.
- 변경(B): 총 주행 기록이 50 km 미만이어도 있는 만큼으로 계산한다. 최소 조건은 1 km·0.3 kWh이고 전비는 1~10으로 제한한다.
- 변경(C): 이 차의 주행 기록이 전혀 없을 때만 통합 옵션 "참고 전비(km/kWh)"(`reference_efficiency_kpl`, 범위 1~10, 옵션 화면에 표시되는 기본값 5.0)를 쓴다. 코드 안의 숨은 상수를 `battery.py`의 옵션 기본값으로 옮기고 사용자가 설정 화면에서 바꿀 수 있게 했다. 이 경우 `efficiency_basis`는 `reference_efficiency`이다.
- 대시보드 배터리 카드는 `range_km`를 쓰며, 배터리 값이 아예 없을 때만 `—`로 표시한다(`SOC × 4.6` 대체식은 제거 유지).
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,battery.py,config_flow.py,sensors_v3.py,strings.json,translations/ko.json}, tests/{test_range_efficiency.py,test_new_sensors.py}.
- 검증: Python 94개(range_efficiency, new_sensors, trip_repair, trip_energy, history_cache, incremental_sync) 통과. 전체 discover는 로컬에 `voluptuous`가 없어 기존 오류 10건(변경 전과 동일)이 있고 설정 화면 테스트(test_receiver_options)는 로컬에서 실행하지 못했다. `config_flow.py`는 컴파일만 확인했다.
- 한계: 주행 기록이 적을 때는 값이 크게 흔들릴 수 있다. 상태 기록 방식과 주행 기록 방식의 구간 선택은 거리가 더 많은 쪽 기준이다. 외기온 보정은 이번 범위가 아니다.
- 배포 상태: 커밋 `081df77` main 푸시 확인. HA 설치 파일 9개가 직전 커밋과 해시 일치함을 확인하고 `/homeassistant/carrot_ha/deployment-backups/081df77/before`에 백업한 뒤 직접 반영했다. 반영 후 해시가 로컬 파일과 모두 일치. 이 항목의 이전 항목(`c4a0841` 방식)은 HA에 반영된 적이 없다. **Python·설정 화면 변경이므로 HA 재시작 전에는 적용되지 않음.** 재시작 후 센서 값과 옵션 화면은 미확인. 버전 상승·태그·릴리즈 없음.

## 2026-10-28 — 주행가능거리 고정 대체값(5.0 km/kWh, SOC×4.6) 제거

- 요청: 기본 전비를 임의 숫자로 지정하는 방식이 부적절하므로 쓰지 않는다.
- 변경: 최근 50 km 주행 전비를 계산할 수 없으면 주행가능거리를 추정하지 않고 알 수 없음으로 둔다(`range_km` 없음, 센서 unknown). `DEFAULT_RANGE_EFFICIENCY`를 삭제했다. 한국어·영어 대시보드 배터리 카드는 값이 없을 때 `SOC × 4.6` 대신 `—`를 표시한다. 디버그 대시보드의 시뮬레이션 표기는 그대로 둔다.
- 영향: 최근 7일 안에 20 km 이상의 주행 기록이 없으면(예: 오래 주차, 설치 직후) 값이 비어 있다. 이 구간을 다른 방법으로 메울지는 미결정.
- 관련 파일: custom_components/carrot_ha/{vehicle.py,frontend/carrot-dashboard-ko.js,frontend/carrot-dashboard-en.js}, tests/test_new_sensors.py.
- 검증: Python 91개와 대시보드 JS 테스트(calculation-regressions 11, live-loading 6, lazy-runtime 1, view-state 3) 통과. 브라우저 실표시는 미확인.
- 배포 상태: HA에 반영하지 않았고, 사용자가 "알 수 없음은 절대 안 된다"고 하여 바로 위 항목의 방식으로 대체되었다(`range_km` 없음 방식은 폐기).

## 2026-10-28 — 주행가능거리에서 장기 평균 제거, 전비 하한 3 → 1 완화

- 요청: 장기 평균 전비로 주행가능거리를 계산하는 로직을 제거하고, 겨울철 전비가 3 미만일 수 있으므로 하한 3이 높다는 지적 반영.
- 변경: 주행가능거리는 최근 50 km 주행 전비(`recent_distance_window`)만 사용한다. 30일 가중 평균(`_range_efficiency` 삭제), 월 전비, 최근 20회 주행 평균 대체 경로를 제거했다. 50 km 구간 기록이 부족하면(20 km 미만) 기본 전비 5.0 km/kWh를 쓴다(`default_efficiency`). 센서의 `range_efficiency_*`·`recent_efficiency_*` 속성은 주행가능거리 센서에서 제거했다. 월·최근 전비 센서/대시보드 표시는 그대로다.
- 전비 클램프를 3~10에서 1~10 km/kWh로 바꿨다. 센서 오류 같은 이상치만 걸러내고 겨울철 실제 저전비(예: 2.5)는 그대로 반영한다. 신규 시즌이라 실제 겨울 전비 분포는 미확인이다.
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,sensors_v3.py}, tests/{test_range_efficiency.py,test_new_sensors.py}.
- 검증: test_range_efficiency(겨울 2.5 보존 신규), test_new_sensors(장기 평균 무시 신규), test_trip_repair, test_trip_energy, test_history_cache, test_incremental_sync 91개 통과.
- 배포 상태: 커밋 `7851220` main 푸시 확인. HA 설치 파일 3개가 직전 커밋과 일치함(vehicle.py는 주석 한 줄 차이)을 해시로 확인하고 `/homeassistant/carrot_ha/deployment-backups/7851220/before`에 백업한 뒤 직접 반영했다. 반영 후 해시가 커밋 파일과 일치(storage 8f6087d3…, vehicle ac3853d1…, sensors_v3 28b5b424…). HA의 구문 검사는 hassio 계정의 `__pycache__` 쓰기 권한 오류로 실행되지 못했고 로컬 py_compile만 통과했다. **Python 변경이므로 HA 재시작 전에는 적용되지 않음.** 재시작 후 센서 값은 미확인. 버전 상승·태그·릴리즈 없음.

## 2026-10-28 — 주행가능거리 기본 전비 주석의 차종 고정 표현 제거

- 요청: `vehicle.py`의 기본 전비 상수 주석에 특정 차종·국가 기준이 고정 개념처럼 적혀 있어 제거.
- 변경: 주석을 "주행 기록이 전혀 없을 때의 최후 대체값"으로 바꿨다. 값(5.0 km/kWh)과 동작은 그대로다.
- 관련 파일: custom_components/carrot_ha/vehicle.py.
- 검증: `py_compile` 통과. 주석만 바뀌어 HA 직접 반영·릴리즈 없음.

## 2026-10-28 — 대시보드 배터리 카드가 주행가능거리 엔터티 값을 사용하도록 수정

- 증상: 대시보드 배터리 카드는 약 370km, `주행가능거리 (추정)` 엔터티는 344km로 서로 달랐다.
- 원인: 카드가 존재하지 않는 키 `v.estimated_range_km`만 읽어(백엔드는 `range_km`만 생성, `estimated_` 접두어는 엔터티 ID에만 붙음) 항상 대체식 `SOC × 4.6`으로 표시했다. 최근 주행가능거리 계산 개선이 카드에 반영되지 않았다.
- 변경: 한국어·영어·디버그 대시보드가 `v.range_km`, `v.estimated_range_km` 순으로 유효한 숫자를 사용하고, 둘 다 없을 때만 SOC 근사값을 쓴다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-dashboard-{ko,en,debug}.js, tests/dashboard-calculation-regressions.test.mjs.
- 검증: dashboard-calculation-regressions(신규 1건 포함 11), live-loading, lazy-runtime, view-state 통과. 브라우저 실표시는 미확인.
- 배포 상태: 커밋 `dce6204` main 푸시 확인. HA 설치 대시보드 3개가 직전 커밋 파일과 해시가 일치함을 확인하고 `/homeassistant/carrot_ha/deployment-backups/dce6204-frontend/before`에 백업한 뒤 직접 반영했다. 반영 후 해시가 커밋 파일과 일치(ko a87931bb…, en 6954e4a7…, debug 5dd20d60…). 브라우저 강력 새로고침 후 실표시는 미확인. HA 재시작 불필요(프론트엔드만). 버전 상승·태그·릴리즈 없음.

## 2026-10-28 — 자동 충전·주유 기록에도 사진 업로드 허용

- 증상: 자동 충전 기록(origin=automatic) 수정 화면에서 사진을 골라 저장하면 "기록은 저장했지만 사진을 저장하지 못했어요" 오류. 운영 HA 브라우저에서 `POST …/attachments`가 400으로 실패하는 것을 직접 재현했고, 해당 기록은 `kind: expense`, `origin: automatic`이었다.
- 원인: `vehicle_journal/photos.py`의 `save_photo()`가 `origin='manual'` 기록에만 사진을 허용해 자동 기록은 `Manual record required`(ValueError)로 거부되었고, 업로드 뷰가 이를 400 `invalid_photo`로 변환했다. 기록 저장(`record/save`)은 자동 기록도 허용해 두 규칙이 어긋나 있었다.
- 변경: 대상 기록 조회를 `origin IN ('manual','automatic') AND status='active'`로 넓히고 오류 문구를 `Active record required`로 변경. 장수 제한은 기존 DB 트리거(`attachments_limit_insert`)가 origin과 무관하게 계속 적용한다.
- 관련 파일: `custom_components/carrot_ha/vehicle_journal/photos.py`.
- 검증·배포: `py_compile` 통과. 2026-10-28 `photos.py` 한 파일을 HA에 SSH 직접 반영했다(배포 커밋 `934205d`, 반영 전 HA 해시가 직전 배포 `ae7c424`와 일치 확인, 백업 `/config/carrot_ha/deployment-backups/934205d/photos.py`, 로컬·HA SHA-256 `112ac492…` 일치). 사용자 HA 재시작 후 사진 업로드 자체는 동작한다고 사용자가 보고했다. 운영 화면의 `POST …/attachments` 200 캡처는 미확인.

## 2026-10-27 — 주행가능거리를 최근 50km 주행 전비로 계산

- 요청/이유: 30일 동안 10km 이상 주행한 기록을 쓰면 반응이 느리다는 지적. 계기판은 오르막·주행 습관에 따라 주행가능거리가 바로 바뀐다.
- 변경: 상태 기록을 최신부터 거슬러 올라가며 주행거리계 기준 최근 50km의 배터리 에너지 감소량으로 전비를 계산한다(`window_efficiency_kpl`). 여러 주행에 걸쳐 합산하며 진행 중인 주행도 포함한다. 충전·오래된 상태 구간, 주행거리계/에너지 급변 구간, 주차 중 소모는 제외한다. 회생 제동은 부호를 유지한다. 3~10 km/kWh로 제한한다. 20km 미만이면 기존 30일 가중 평균, 월 전비 등의 순서로 대체한다. 조회는 (device, kind, observed DESC) 인덱스로 최대 7일·3,000행까지 500행 단위로 한다. 계산 기준 이름은 `recent_distance_window`이다.
- 실제 DB 재계산(읽기 전용): 계기판 100%·416km 시점(잔량 63.5 kWh)에 50km 전비는 6.71로 약 426km다. 30일 가중 평균은 396km, P25는 358km였다. 20km 구간은 6.15~7.55로 흔들림이 커 50km를 택했다. 2026-10-27 11:00 UTC(40.15 kWh)에는 6.54로 263km가 된다. 당시 계기판 값은 기록이 없어 비교할 수 없다.
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,sensors_v3.py}, tests/{test_range_efficiency.py,test_new_sensors.py}.
- 검증: test_range_efficiency(구간 경계·충전/주차 제외·최소 거리), test_new_sensors, test_trip_repair, test_trip_energy, test_history_cache, test_incremental_sync 95개 통과.
- 한계: 이력 동기화(약 60초) 때 갱신되며, 상태 기록 간격과 정수 km 주행거리계 해상도를 따른다. 공조 예측 등 계기판 내부 요소는 반영하지 않는다.
- 배포 상태: 커밋 `1e79ad1` main 푸시 확인. HA 설치 파일 3개가 직전 반영본 `c38e411`과 해시가 일치함을 확인하고 `/config/carrot_ha/deployment-backups/1e79ad1/`에 백업한 뒤 직접 반영했다. 반영 후 해시가 커밋 파일과 일치(storage.py 5ebbd173…, vehicle.py a09da23e…, sensors_v3.py e53cf8b9…)하고 구문 검사도 통과했다. HA 재시작과 재시작 후 센서 값·실주행 반응은 미확인. 버전 상승·태그·릴리즈 없음.

## 2026-10-27 — 주행가능거리 계산을 최근 가중 평균 전비로 재조정

- 요청/이유: 보수 전비(P25) 적용 후 너무 낮게 나온다는 보고. 차량이 100%일 때 계기판은 416km였지만 HA는 361km였다. 같은 시각 HA 기록 기준 잔량은 63.5 kWh이고(계기판 100% ≈ CAN 에너지 64 kWh), 계기판은 약 6.5 km/kWh를 적용하고 있었다. P25 5.63은 이보다 약 14% 낮았다.
- 운영 DB 읽기 전용 비교(63.5 kWh 기준): P25 5.63 → 358km. 최근 가중 평균(10km 이상, 30일): 반감기 3일 6.29 → 399km, 7일 6.23 → 396km, 14일 6.17 → 392km. 거리 기준 최근 150/300/500km 평균은 6.24/6.14/6.30.
- 변경: 하위 25% 대신 10km 이상 주행의 에너지 가중 평균(총 km ÷ 총 kWh)을 사용한다. 7일 반감기로 최근 주행 습관에 빠르게 맞춘다. 30일 기간, 단거리 제외, 최소 3회·50km 조건과 대체 순서는 유지한다. 계산 기준 이름은 `weighted_recent_trips`이다.
- 한계: 계기판 추정치는 충전·공조·배터리 온도에 따라 즉시 바뀐다. 같은 주행 기록으로 저녁(약 62% 표시)에는 차량 값이 더 낮았다는 보고가 있어 모든 시점에 일치시킬 수는 없다.
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,sensors_v3.py}, tests/{test_range_efficiency.py,test_new_sensors.py}.
- 검증: test_range_efficiency, test_new_sensors, test_trip_repair, test_trip_energy, test_history_cache, test_incremental_sync 92개 통과.
- 배포 상태: 커밋 `c38e411` main 푸시 확인. HA 설치 파일 3개가 직전 반영본 `cc7b3ba`과 해시가 일치함을 확인하고 `/config/carrot_ha/deployment-backups/c38e411/`에 백업한 뒤 직접 반영했다. 반영 후 해시가 커밋 파일과 일치(storage.py b5dfa14b…, vehicle.py 5dfd97bd…, sensors_v3.py 13fb94c5…)하고 구문 검사도 통과했다. HA 재시작과 재시작 후 센서 값은 미확인. 버전 상승·태그·릴리즈 없음.

## 2026-10-27 — 차계부 SOC 기준 64 실차 검증

- 오늘 급속 100% 충전에서 계기판 SOC 후보(`0x14A`)가 100%일 때 잔량이 64,200Wh(÷64 = 100.3%)였다. 50~100% 구간에서 64 기준과의 차이는 0.8%p 이내였다.
- HA 재시작 뒤 차계부 `100km당 배터리 소모`는 9월 25.9%, 10월 25.7%로 재계산됐다. 자세한 내용은 `vehicle-journal/CHANGELOG.md`에 있다. 코드 변경·릴리즈 없음.

## 2026-10-27 — 차계부 주행 SOC 기준 통일과 100km당 배터리 소모 수정

- 차계부 주행 SOC를 대시보드 주행 탭과 같은 Wh ÷ 설정 용량(`soc_capacity_kwh`, 64)으로 계산한다. 10월 3일부터 Comma 경계 측정값의 SOC가 비어 차계부 SOC가 대부분 사라졌던 문제와 78kWh 기준 혼용을 해결했다. 공용 `trip_repair.py`와 대시보드 경로는 변경하지 않았다.
- `100km당 배터리 소모`는 SOC가 측정된 거리만 분모로 쓰고, % 지표의 증감은 `%p`로 표시한다.
- 자세한 원인·64 검증·테스트는 `vehicle-journal/CHANGELOG.md`에 있다. HA 직접 반영, 사용자 HA 재시작 필요. 버전·태그·릴리즈 없음.

## 2026-10-27 — 차계부 충전 위치 실패 사유 표시 구현

- 승인된 미리보기대로 자동 충전 위치 조회의 사유 코드·단계·근거 값 저장(조회 버전 5), 상세 기록 조회 API의 `location_diagnostic`, 상세 기록 행의 작은 사유 표시와 진단 패널을 구현했다. 자세한 내용은 `vehicle-journal/CHANGELOG.md`에 있다.
- 배포는 HA 직접 반영으로 한다. Python 변경이라 사용자의 HA 재시작이 필요하다. 버전·태그·릴리즈 없음.

## 2026-10-27 — 계기판 SOC 후보(0x14A) 비교 전용 수집

- 요청/이유: 대시보드 SOC는 잔량 Wh ÷ 사용자 설정 64kWh 비례식이라 하단 버퍼 같은 오프셋을 반영하지 못하고, Comma `soc_percent`(Wh/780)와 기준도 다르다. 장기적으로 계기판 표시 SOC를 직접 읽기 위해 연구 저장소에서 찾은 후보(bus1 `0x14A` 32byte byte19 × 0.5%, 주행 r≈0.99991, 일부 시점 ±1%p 차이)를 별도 필드로 수집하고 실차 대조를 준비한다.
- Comma(openpilot `carrot-wip-model_selector-ha` `d718061f`): `display_soc_candidate_percent`를 CAN 수신 시각(`field_measured_at`)과 함께 텔레메트리에 추가하고, 주행 경계 `tripMeasurements` start/end에 값과 `display_soc_candidate_measured_at`(180초 초과 시 미확인)을 넣었다. bus1 32byte만 사용하며 raw 201 이상(초기화 254/255 포함)은 값을 지운다. 기존 `soc_percent`·`battery_wh`·에너지 완전성 판정은 변경하지 않았다.
- 수신 앱 0.1.4: `trip_measurements` 출력에 후보 필드를 보존한다. 수집기가 보낸 경우에만 추가하므로 이전 주행의 API 출력과 HA 주행 fingerprint는 그대로다. 후보만으로는 측정 경계를 만들지 않는다.
- HA: 진단 센서 `계기판 SOC 후보`(180초 신선도, 속성 can_id 0x14A·검증 대기·`used_for_dashboard_soc=false`)를 추가했다. 주행 원본의 `trip_measurements`는 그대로 보관된다. 대시보드·차계부의 SOC 계산과 우선순위는 변경하지 않았다.
- 관련 파일: addons/carrot_receiver/{receiver.py,config.yaml,CHANGELOG.md}, custom_components/carrot_ha/{telemetry.py,sensors_v3.py}, tests/test_display_soc_candidate.py. 실차 대조 양식: meb-can-research `docs/field-tests/display-soc-validation-2026-10-27.md`(`04e6f36`).
- 검증: openpilot 신규 5개 통과, ha/tests 전체 81개 중 기존 실패 4개(camera_probe·camera_upgrade 모듈 로드, driving_logs, sync_workflows)는 변경 전과 동일. carrot-ha 신규 4개와 test_direct_receiver·test_new_sensors 35개, 회귀 게이트(test_cloud_live·test_incremental_sync·test_history_cache)와 trip/energy 관련 158개 통과. test_archive_compression(Windows 파일 잠금)·test_driving_logs_ai/v2 실패는 변경 파일과 무관하다.
- 배포 상태: main 커밋·푸시. HA 직접 반영·버전 상승·태그·릴리즈 발행 없음(발행은 별도 승인 필요). 수신 앱 0.1.4는 사용자가 HAOS에서 업데이트, Comma는 사용자가 `git pull --ff-only` 후 재부팅.
- 미확인: 실차 수신(Comma 업데이트 후 0x14A 값 도착), 계기판 사진 대조. 대조 전에는 표시 SOC를 기본값으로 쓰지 않는다.

## 2026-10-27 — 차계부 충전 위치 실패 사유 표시 설계·미리보기 (승인 대기)

- 위치를 기록하지 못한 충전비 기록에 실패 단계·사유·근거 값을 보여 주는 설계와 승인용 미리보기 `vehicle-journal/review-location-diagnostics.html`을 추가했다. 상세 내용은 `vehicle-journal/CHANGELOG.md`에 있다.
- 프로덕션 코드 변경·HA 반영·릴리즈 없음. `.claude/launch.json`에 미리보기 서버 설정 `journal-review`를 추가했다.

## 2026-10-27 — 주행가능거리 보수적 전비 적용

- 요청/이유: 주행가능거리가 계기판보다 40~50km 낙관적이라는 보고. 운영 DB를 읽기 전용으로 조회한 결과, 계산은 최근 20회 주행의 평균 전비 6.22 km/kWh × 잔량 40.15 kWh = 250km였다. 2주 주행거리계 기준 실적(6.5 km/kWh)과 일치해 계산 오류는 아니었지만, 평균 전비가 계기판의 보수적 추정보다 약 18% 높았다. 10km 미만 단거리는 0.05 kWh 측정 단위 때문에 전비가 과대(10월 평균 6.86)했다.
- 변경: 최근 30일, 10km 이상 주행의 전비를 거리 × 반감기 14일 가중치로 정렬해 하위 25% 값을 `range_efficiency_kpl`로 계산한다. 3회·50km 이상일 때만 사용하며, 주행가능거리 계산에서 가장 먼저 적용한다(`range_efficiency_basis=conservative_recent_trips`). 자료가 부족하면 기존 월 전비·최근 평균·기본값 순서를 그대로 따른다. `recent_efficiency_kpl`와 월 전비 센서는 변경하지 않았다. 센서 속성에 보수 전비·주행 수·거리·방법을 추가했다.
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,sensors_v3.py}, tests/test_range_efficiency.py, tests/test_new_sensors.py.
- 검증: 운영 DB 읽기 전용 재계산 결과 28회, 1,565km, P25 5.63 km/kWh. SOC 51.5%에서 250→226km, 100% 485→439km, 15% 73→66km. 신규 테스트 3개 및 test_new_sensors·test_trip_repair·test_trip_energy 86개 통과. 회귀 게이트 test_cloud_live 1건(Windows cp949 인코딩)과 test_direct_receiver(aiohttp 미설치)는 변경 전에도 동일하게 실패하는 로컬 환경 문제다.
- 배포 상태: 커밋 `cc7b3ba` main 푸시 확인. HA 설치 파일 3개가 직전 커밋 `869debc`과 SHA-256 일치함을 확인한 뒤 `/config/carrot_ha/deployment-backups/cc7b3ba/`에 백업하고 직접 반영했다. 반영 후 해시가 커밋 파일과 일치(storage.py 8d0d992e…, vehicle.py a1e3921b…, sensors_v3.py cdbc8147…)하고 구문 검사도 통과했다.
- 미확인: HA 재시작은 사용자가 수행하며 재시작 전까지는 이전 계산이 동작한다. 재시작 후 센서 값과 계기판 값의 차이는 미확인. 버전 상승·태그·릴리즈 발행 없음.

## 2026-10-27 — 승인된 HA 기본 재질을 기존 vehicle.glb에 저장

- 사용자 승인: 프리뷰 후보 그대로 적용하고 기존 파일명을 유지해 커밋·푸시하도록 명시했다.
- 변경/이유: 차체 색상 #333234, 유리 틴팅, 도장·반사판 재질을 기존 frontend/carrot-assets/models/vehicle.glb에 저장했다. 별도 모델 파일명·새 URL 없이 기존 파일을 교체한다. 재현 도구와 문서도 포함한다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-assets/models/vehicle.glb, tools/vehicle3d/model/bake_ha_materials.py, docs/VEHICLE_3D_MODEL.md.
- 검증: 프리뷰 승인 모델과 교체 파일 일치. 원본 대비 바이너리 청크·형상·텍스처·애니메이션 보존 및 재질 저장 도구의 멱등성 확인. vehicle-3d-integration 25개와 git diff --check 통과.
- 배포 상태: main 커밋·푸시로 반영한다. HA 직접 배포·재시작·버전 상승·태그·릴리즈 발행은 하지 않는다. 외부 뷰어의 조명·톤 매핑·환경 반사는 각 뷰어 설정을 따른다.

## 2026-10-27 — HA 기본 재질을 GLB에 저장하는 후보 제작 (프리뷰 승인 대기)

- 요청/이유: 일반 GLB 뷰어에서도 HA의 기본 차체 색상·유리 틴팅·도장 재질을 사용하도록 모델 재질 저장을 요청했다.
- 변경: tools/vehicle3d/model/bake_ha_materials.py를 추가해 GLB JSON의 차체·반사판·유리 2종만 변경한다. Three.js의 sRGB→linear 변환을 적용한다. 프리뷰 후보는 .preview/vehicle-materials/after.glb(2,023,352바이트)이며 배포 모델은 아직 교체하지 않았다.
- 검증: GLB의 바이너리 청크·형상·내장 텍스처·노드·문 애니메이션이 원본과 동일하고 재실행 결과도 동일함을 확인했다. 실제 전체 대시보드 모듈과 mockHass를 사용한 로컬 HTML에서 기존/후보 모델 및 흰색 옵션의 3D 뷰어 생성·렌더링을 확인했다. 네트워크 제약으로 브라우저 테스트는 로컬 파일을 route로 직접 제공했다.
- 관련 파일: tools/vehicle3d/model/bake_ha_materials.py, .preview/vehicle-materials-preview.html 및 .preview/vehicle-materials/ (프리뷰는 Git 제외).
- 상태: AGENTS.md의 UI 사전 프리뷰 승인 절차에 따라 사용자 검토 대기. 프로덕션 GLB 교체·커밋·푸시·HA 반영·릴리즈 없음. 조명·환경 반사 강도·톤 매핑은 뷰어 설정으로 남는다.

## 2026-10-27 — 전체 문서 연결 방식 재점검 및 잔존 표현 보완

- 내용/이유: 앞선 49a5536 이후 전체 추적 문서를 다시 검색했다. 현행 엔티티/차계부 요구사항·지침/검증 계획/README의 잔존 cloud·D1/KV·Worker 설명을 수신기 기준으로 보완하고 과거 파라미터 안내의 문서 전체를 역사 기록으로 명시했다.
- 관련 파일/근거: docs/connection-document-audit-2026-10-27.md에 전체 파일 목록·검색 범위·잔존 이유를 기록했다. 독립 HTML 프리뷰에 남은 합성 Cloudflare 문구 1곳은 현행 연결 안내가 아니며 UI 수정 범위에서 제외했다.
- 검증/한계: 문서 검색·상대 링크·diff 검사. 과거 사건·라이선스·changelog 및 호환 식별자는 보존. 운영 연결 검증·실행 코드 변경·배포·재시작·릴리즈 없음. 문서 전용 커밋·main 푸시로 반영한다.

## 2026-10-27 — 기본 3D 차량 모델 저장소 포함

- 변경/이유: 사용자가 본인 모델임을 확인하고 다른 사용자와 공유하도록 요청했다. 모델 재배포 금지 문구와 모든 GLB 파일의 일괄 제외를 철회하고, HA에서 받은 완성 모델을 통합의 frontend/carrot-assets/models/vehicle.glb에 포함했다. 이전 개인 사용 확인·외부 출처 기록은 당시 에이전트 기록이며 이번 사용자 지시로 공유 정책을 정정한다.
- 동작: 기본 모델은 프론트엔드와 함께 설치되고 버전이 붙은 패키지 주소로 로딩된다. vehicle_3d_model 사용자 지정 주소와 기존 HA 모델 경로는 유지한다. 모델 형상·텍스처·화면 디자인은 변경하지 않았다.
- 관련 파일: .gitignore, custom_components/carrot_ha/{__init__.py,frontend/carrot-vehicle-3d.js,frontend/carrot-assets/models/vehicle.glb}, docs/{VEHICLE_3D_MODEL.md,DEBUG_DASHBOARD.md}, tools/vehicle3d/model/build_model.mjs, tests/vehicle-3d-integration.test.mjs.
- 모델 확인: 운영 HA HTTPS에서 수신한 GLB v2, 2,023,208바이트. WebP 이미지 36개가 내장되어 외부 텍스처 파일이 필요 없다. 빌드 중간 파일 폴더만 Git에서 제외한다.
- 검증: vehicle-3d-integration 테스트 25개 및 git diff --check 통과. 모델 SHA-256: 1f3c5488f32fbbeabf5b4e984a80b055d75eac34ab7bd6fb3e53411ec909e997.
- 배포 상태: main 커밋·푸시 대상으로 준비. HA 직접 반영·재시작·새 태그·릴리즈 발행은 이번 요청 범위에 포함하지 않는다. 운영 HA의 새 패키지 경로 로딩은 미검증이다.

## 2026-10-27 — Cloudflare 과거 중계 설명과 현재 직접 연결 문서 분리

- 변경/이유: 조사에서 멈추지 않고 현행 안내를 수정하라는 사용자 요청에 따라 AGENTS의 과거 구조도·Wrangler 실행 절차·D1/KV 무료 한도 규칙을 현재 수신기 구조로 교체했다. GUIDE의 클라우드 경로/60초 화면 조회 설명, entities의 저장 경로·cloud_status 설명, 모듈형 설계의 수집 계층과 부하 원칙을 수정했다.
- 관련 파일: AGENTS.md, docs/CURRENT_CONNECTION_ARCHITECTURE.md, docs/{GUIDE.md,entities.md,modular-ev-dashboard-architecture.md,DEVELOPMENT_WORKFLOW.md,CLEAN_INSTALL_RECOVERY.md,TERMINAL_SETUP.md,CAMERA_SETUP.md,COMMA_PARAM_SETUP.md,driving-logs-setup.md,cloudflare-retirement-audit-2026-10-14.md}.
- 내용: 독립 수신 앱 경로와 HA Core 직접 경로, 외부/내부 URL, 키 구분, 60초 이력·15초 최신 조회, HA Core 재시작 영향, 과거 호환 분기와 자동 fallback 부재를 명시했다. 과거 릴리즈·changelog·archive·라이선스와 원본 서버 소스는 보존했다.
- 검증: 코드 근거 대조 및 12개 문서의 상대 링크와 폐기 명령 잔존 검사 및 git diff --check 통과. 실행 코드 변경이 없어 런타임 테스트·배포·버전 상승·재시작은 해당하지 않는다. 운영 프록시/차량 상태 및 차량 최신 소스는 미검증이다.
- 배포 상태: 문서 전용 커밋·main 푸시 대상으로 준비했다. 다른 작업 파일은 제외했다. 최초 FETCH_HEAD 권한 오류 후 승인된 git fetch가 성공했고 원격 main과 HEAD가 일치함을 확인했다. 실행 배포·버전·태그·릴리즈·재시작 없음.


## 2026-10-27 — 절약 비교 화면 HA 직접 반영 완료

- 배포 커밋: `34d6e3c` (main 푸시 확인). 기존 설치 파일 2개가 직전 Git 버전과 일치함을 확인한 뒤 `/config/carrot_ha/deployment-backups/34d6e3c/`에 각각 백업하고 화면 코드·디자인 파일 반영.
- 검증: HA 설치 파일과 HTTP 200 응답 모두 로컬 커밋 파일 SHA-256 일치. `carrot-vehicle-journal.js`: `1b39622b3e5ce660e1931add47b1974e74a6c46d7b0b26fd1db18473b066c23a`, `carrot-journal-design.js`: `4585bdfc61843588d52ffb1ecf0dd7373b4eaa63328696cc479fdf3dd09ed58a`.
- 상태: 운영 파일·HTTP 제공 확인 완료. 사용자 로그인 HA 브라우저의 최상위 로더 URL·실제 화면 적용은 미확인, 차계부 화면 새로고침 필요. Python/고정 로더 변경 없으며 HA 재시작 실행하지 않음. 버전·태그·릴리즈 발행 없음. Comma·수신기·과거 Cloudflare 코드 변경 없음.
- 검증 한계: 기존 browser-check.cjs의 초기 42km 화면 대기 실패는 변경 전 코드에서도 동일. 이번 승인 UI의 실제 Chrome 합성 데이터 조작 검증은 통과(직전 항목 참조).

## 2026-10-27 — 승인한 절약 비교 화면 운영 반영 준비

- 사용자 승인: “일단 이대로HA에 반영하자”. 앞선 로컬 프리뷰 변경을 운영 구현으로 이관.
- 변경: 거리 버튼(기록된 거리·1,000·5,000·10,000·100,000km·직접 입력), 입력 중 쉼표, 중앙 비교 설명/금액, 간결한 유류비 안내, 슬라이더 min/max, 숫자·유종·원화 금액 틸 강조. 제목 괄호 없음. 차량/기간 전환 시 직접 입력 선택 상태 초기화.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle-journal/review-savings-wording.html`.
- 검증·배포: 운영 모듈을 직접 불러온 Chrome에서 거리 버튼 4개·직접 입력·쉼표·기록 거리 복귀·3종 유종 전환·안내 문구·강조·min/max·390px 모바일 통과. JS 구문·diff 검사 통과. 기존 browser-check.cjs는 첫 #headline(42km) 대기 시간 초과이며 수정 전 HEAD에서도 동일하게 실패함을 확인. HA 기존 파일 2개가 직전 Git 버전 SHA-256과 일치. HA 백업·직접 반영 예정, 릴리즈 없음.

## 2026-10-27 — 유종 이름·원화 금액만 강조하는 프리뷰

- 사용자 요청: “휘발유 유가 13원/L”에서 “휘발유”, “13원”만 틸 색상·글꼴 확대. “유가”와 “/L”은 기본 표시 유지. 거리·연비의 숫자 강조는 유지한다.
- 관련 파일: `vehicle-journal/review-savings-wording.html`.
- 검증·배포: 프리뷰 수정. 운영 소스·HA 미반영, 승인 대기.

## 2026-10-27 — 선택값 강조를 숫자로 한정·확대하는 프리뷰

- 사용자 정정: 선택값 전체가 아닌 숫자만 틸 색상 및 글자 크기 확대. 거리·유가·연비 숫자는 기존 크기의 1.22배로 표시하고 유종·단위는 기본 색상·크기 유지. 천 단위 쉼표는 숫자와 함께 유지한다.
- 관련 파일: `vehicle-journal/review-savings-wording.html`.
- 검증·배포: Chrome에서 숫자만 틸 색상·1.22배 확대, 유종/단위 기본 색상·크기 및 100,000 쉼표 유지 확인. 390px 모바일 가로 넘침 없음. 운영 소스·HA 미반영, 승인 대기.

## 2026-10-27 — 절약 비교 유류비 범위 안내 문구 프리뷰

- 사용자 요청: 주유 지출 추정·기간 차이 안내를 유류비만 비교하며 전체 유지비는 포함하지 않는다는 간결한 한 문장으로 변경.
- 문구: “유류비만 비교한 금액이며, 전체 차량 유지비는 포함하지 않아요.”
- 관련 파일: `vehicle-journal/review-savings-wording.html`.
- 검증·배포: 프리뷰에서 기존 비용 막대 상단 안내 문구만 대체. 운영 소스·HA 미반영, 승인 대기.

## 2026-10-27 — 절약 비교 현재 선택값 틸 강조 프리뷰

- 사용자 요청: 주행거리·비교 유종/유가·비교 차량 연비에서 현재 선택값을 차계부 틸 색상으로 강조.
- 변경: `distanceValue`, `priceValue`, `economyValue` 및 직접 거리 입력에 `--j-accent`와 굵은 글꼴 적용. min/max는 기존 흐린 표시 유지. 숫자 천 단위 쉼표 유지.
- 관련 파일: `vehicle-journal/review-savings-wording.html`.
- 검증·배포: Chrome에서 선택값 3곳의 색상 rgb(129, 230, 197), 100,000km 쉼표, min/max opacity 0.6 확인. 운영 소스·HA 미반영, 승인 대기.

## 2026-10-27 — 유가·연비 슬라이더 최솟값·최댓값 프리뷰

- 사용자 요청: 슬라이더 위 양 끝에 실제 min/max를 흐리게 표시. 유가는 원/L, 연비는 km/L 단위와 천 단위 쉼표 사용. 유가 범위가 동적으로 증가하면 끝값도 동기화한다.
- 관련 파일: `vehicle-journal/review-savings-wording.html`.
- 검증: 앞선 거리 버튼 4개·직접 입력 123,456.7km·기록된 거리 복귀·유종 전환 통과. 설명 20px, 결과 중앙 정렬 오프셋 0px, 390px 화면 가로 넘침 없음, Chrome 실행 오류 없음. min/max·단위 표시 및 동적 최댓값 7,500원/L 갱신 통과. 390px 모바일 가로 넘침 없음.
- 배포: 로컬 프리뷰만 변경. 운영 소스·HA 미반영, 승인 대기.

## 2026-10-27 — 절약 비교 거리 버튼·중앙 결과 프리뷰 갱신

- 사용자 요청: 거리 슬라이더 대신 기록된 거리·1,000km·5,000km·10,000km·100,000km·직접 입력 버튼. 제목의 “(유류비만)” 제거. 비교 설명 축소 후 금액 바로 위에 묶어 제목과 비용 막대 사이 중앙에 배치.
- 제안 문구: “연비 15km/L인 휘발유 차량으로 달렸다면”. 유종·연비에 따라 갱신하며 “차량보다”와 “더 들어요” 사이의 비교 방향 혼동을 피한다.
- 관련 파일: `vehicle-journal/review-savings-wording.html`. 숫자 표시는 거리·직접 입력·금액 모두 천 단위 쉼표를 유지한다.
- 검증·배포: 로컬 프리뷰 검증 중. 운영 소스·HA 변경 없음, 사용자 프리뷰 승인 대기.

## 2026-10-27 — 절약 비교 제목·비교 조건 문구 프리뷰

- 사용자 요청: 제목 옆 “(유류비만)”, 금액 윗줄에 선택한 유종·연비의 차량을 “~보다”로 설명. 제목과 같은 글자 크기 사용.
- 관련 파일: `vehicle-journal/review-savings-wording.html`. 실제 차계부 전체 모듈과 합성 전기차·내연기관 데이터로 검토하며 운영 소스는 변경하지 않았다.
- 검증·배포: 실제 Chrome에서 제목·설명 25px 일치, 휘발유 15km/L→경유 18km/L 설명 갱신 및 실행 오류 없음 확인. 인터랙티브 프리뷰 준비 완료. 사용자 승인 후 운영 수정·검증·커밋·HA 반영 예정. 릴리즈 없음.

## 2026-10-27 — 절약 비교 문구의 비교 방향 수정

- 커밋 제목: `vehicle-journal: correct comparison cost wording`.
- 변경·이유: “같은 거리를 다른 차로 달렸다면요.”에 맞춰 비교 차량 비용이 더 높으면 “더 들어요”, 낮으면 “덜 들어요”로 표시한다. 내연기관·전기차 두 경로의 문구만 교정하며 금액 계산·디자인은 유지한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`.
- 검증: 실제 renderSavings 함수를 합성 데이터로 실행해 내연기관·전기차 각각 양수(10,000원 더 들어요)·음수(5,000원 덜 들어요) 4건 통과. JavaScript 구문 및 git diff --check 통과.
- 배포: `1298fd7` main 푸시 및 HA 직접 반영 완료. 반영 전 HA 파일과 직전 Git 파일 해시 일치 확인, `/config/carrot_ha/deployment-backups/1298fd7/`에 백업. 반영 후 로컬·HA SHA-256 `c0ebfd2d95606da9f6672a9d71196109f0c045e4b84686f8df206eef0b9eecea` 일치. 운영 브라우저 적용은 미확인(화면 새로고침 필요). Python 변경 없음. 버전·태그·릴리즈 발행 없음.

## 2026-10-26 — 3D 차량: 주행 중 속도 0이면 정지 표시, 140 km/h 효과 상한 (HA 반영)

- 사용자 질문: 주행 중 속도가 0인데 왜 차량이 굴러가는가.
- 원인: 뷰어가 `Math.max(8, state.speedKph || 40)`으로 도로·바퀴 속도를 계산했다. JavaScript에서 0은 거짓이라 0 km/h가 40 km/h로 바뀌고, 최소 8 km/h도 강제됐다. 또 래퍼가 속도 값이 없을 때도 0을 넘겨 "정지"와 "모름"을 구분하지 못했다.
- 변경(뷰어): 주행 중 실제 속도(0 포함)를 그대로 쓰고 값이 없을 때만 40 km/h로 표시. 표시 속도는 15초 주기 갱신에 튀지 않도록 부드럽게 따라가며(시정수 약 0.4초), 0이면 바퀴·차선·차체 흔들림이 멈춘다(흔들림은 20 km/h까지 속도에 비례). 정지 중에는 렌더 루프도 쉰다(기존에는 주행 중이면 항상 매 프레임). 정지 상태에서도 차선 점선이 도로를 따라 배치되도록 위치 계산을 이동 여부와 분리(처음엔 모두 z=0에 겹쳐 하나만 보였음).
- 변경(래퍼 `carrot-vehicle-3d.js`): `speed_kph`가 숫자가 아니면 `speedKph: null`(모름).
- 관련 파일: `tools/vehicle3d/viewer.src.js`, `custom_components/carrot_ha/frontend/{carrot-vehicle-3d.js,carrot-assets/vehicle-3d.js}`, `tests/vehicle-3d-integration.test.mjs`.
- 검증: 3D 통합·디버그 테스트 31/31 통과(신규 1건, 기존 "알 수 없는 값" 테스트의 속도 기대값을 0→null로 갱신). 전체 JS 테스트 실패 6건은 기존과 동일. 로컬 프리뷰에서 주행·0 km/h는 주행 시점으로 전환 후 애니메이션이 멈춤(`settled: true`), 차선 점선이 정상 배치, 62 km/h는 계속 이동 확인. 실차 정차 화면은 미확인.
- 추가(사용자 질문 "140이 넘으면 MAX 140 속도 효과를 유지하는가"): 이전에는 유지하지 않았다. 140은 디버그 속도 슬라이더의 최대값일 뿐 뷰어에 상한이 없어 더 빠르게 움직였다. 뷰어에 `MAX_EFFECT_KPH = 140` 상한을 두어 140 km/h 초과는 140 km/h 효과로 표시한다. 디버그: 검사용 읽기 전용 `rollKph`(표시 속도) 추가, 속도 슬라이더 최대 140→200, 시나리오 `주행 180 km/h (효과 140 상한)` 추가(37→38개), 주행 0/60/120/180 시나리오가 표시 속도(0 / 각 속도 ±3% / 140)를 검사. 프리뷰 디버그 카드에서 네 시나리오 통과(표시 0·59·119·140 km/h). JS 테스트 106 통과/6 실패(기존과 동일).
- 배포 상태: `abee103`을 main에 푸시한 뒤 HA SSH(`sudo`)로 프론트엔드 3개(`carrot-vehicle-3d.js`, `carrot-debug-3d.js`, `carrot-assets/vehicle-3d.js`)를 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 해시가 같음을 확인하고 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-speed-abee103/before`에 백업(SHA256SUMS.before 포함). 반영 후 설치 파일과 HTTP 응답(200) SHA-256이 커밋과 일치(`carrot-vehicle-3d.js` `a93195d1…`, `carrot-debug-3d.js` `f490653c…`, `vehicle-3d.js` `7a99583e…`). Python 변경 없음(HA 재시작 불필요), 브라우저 강력 새로고침 필요. 실차 정차·고속 화면 미확인. 버전·태그·릴리즈 없음.

## 2026-10-26 — 외부 API 응답 부분 읽기 수정(차계부 충전소 자동 위치·주행 로그 AI)

- 원인: aiohttp `response.content.read(n)`은 첫 네트워크 조각만 반환할 수 있어 카카오 충전소 검색 JSON이 잘렸다. 2026-10-26 충전 기록의 위치가 자동 지정되지 않고 24시간 재시도 대기가 됐다.
- 변경: 응답을 EOF까지 읽는 `read_limited` 도입(`http_body.py`, 주행 로그 `ai.py`), 일시 실패는 15분부터 최대 24시간 백오프, 조회 버전 4로 대기 중 기록 재조회. 상세: `vehicle-journal/CHANGELOG.md`, `driving-logs/CHANGELOG.md`.
- 추가: 충전소 이름을 못 정하는 모든 경우(제공사 오류·결과 과다·결과 없음 포함)에 도로명 주소를 먼저 저장하고, 오류로 저장한 주소는 재조회 성공 시 충전소로 교체한다. 결과가 45건을 넘는 지역에서도 거리상 안전하면 단독 근접 충전소를 자동 선택한다.
- 배포 상태: `2730a92` HA 직접 반영·해시 확인 완료(백업 `/config/carrot_ha/deployment-backups/2730a920f993e7fc4e37dbabf8c4a0ba437b3044/`). 후속 `cfd291f`도 HA 직접 반영·해시 확인 완료(백업 `/config/carrot_ha/deployment-backups/cfd291fc8e2739429adc3ec5e19ebe4b8a7d63d5/`). 사용자 HA 재시작 필요. 버전·태그·릴리즈 없음. 상세: `vehicle-journal/CHANGELOG.md`.

## 2026-10-26 — 디버그 대시보드: 오픈파일럿 시나리오, 테스트 완료 패널 제거, 데스크톱 좌우 배치·기능 선택 (HA 반영)

- 사용자 요청: 디버그 대시보드에 OP 작동 유무 시나리오가 없다. 충전 시간 계산 모델·스무딩(BMS 전력 변동) 패널과 360° 카메라 모니터링(실기기·모의) 패널은 테스트가 끝났으니 제거. 상태를 바꾸고 위로 스크롤해 확인하는 것이 번거로우니 데스크톱에서만 좌우 배치. 이어서 "여전히 스크롤해서 조작해야 한다 → 카드·버튼 컴팩트화와 드롭다운으로 기능만 골라 표시", "지금처럼 유지하되 대시보드는 고정, 디버그 패널만 스크롤", "이상하게 나오는 버튼은 알아서 찾아서 해결".
- 변경(3D 시뮬레이터 `carrot-debug-3d.js`): `오픈파일럿 작동` 체크박스와 시나리오 3개(`주행 + 오픈파일럿 작동`, `주행 · 오픈파일럿 꺼짐`, `주행 + 오픈파일럿 + 문·트렁크 열림 값`) 추가(34→37개). 기존 `문 열림 → 주행 시작`은 문이 닫혀 보이는지, `문 열림 → 주행 종료`는 다시 열려 보이는지 검사한다. 차선 색은 뷰어 실제 값과 비교(채널당 3/255 허용, 선형 공간 보간 후 sRGB 반올림 차이). 차량 카드가 화면 밖일 때만 `scrollIntoView`.
- 변경(뷰어): 디버그 검사용 읽기 전용 `laneColor`, `doorsOpen` 추가. 차선 색 보간 종료 기준을 0.004→0.0005로 조여 목표 색에 정확히 도달(이전 기준은 어두운 채널에서 `#21ff5f`에 멈춤).
- 변경(디버그 `carrot-dashboard-debug.js`): 시뮬레이터 값으로 `v.enabled` 설정. 두 패널의 마크업 제거(이벤트 처리기는 이미 요소 없음을 처리; 카메라 모드는 기본 `auto` 유지). 호스트를 `carrot-debug` 컨테이너로 지정하고 폭 1300px 이상에서 대시보드(최소 840px, 데스크톱 레이아웃 유지)|컨트롤(400~500px) 그리드, 대시보드 영역은 `position: sticky`(HA 헤더 아래)·자체 세로 스크롤. 같은 우선순위의 기본 `.preview-pane{position:relative}`에 덮이던 문제를 선택자 구체화로 해결. 호스트 최대 폭 1440→1760px. `테스트할 기능` 드롭다운(전체·3D·잠금/도어/UI 후보·배터리·충전기/충전 계산·테마/언어, 기본 전체, 브라우저 localStorage 기억)과 `data-section` 필터, 동작 모드는 항상 표시. 패널·카드·버튼 여백과 글자 축소, 3D 시나리오는 자동 열 격자, 동작 모드 7개는 4열 격자, 캡션 있는 버튼 최소 폭 96px·캡션 줄바꿈 허용.
- 관련 파일: `custom_components/carrot_ha/frontend/{carrot-dashboard-debug.js,carrot-debug-3d.js,carrot-assets/vehicle-3d.js}`, `tools/vehicle3d/viewer.src.js`, `tests/{debug-3d.test.mjs,charging-curve.test.mjs}`, `docs/DEBUG_DASHBOARD.md`.
- 검증: 로컬 프리뷰(실제 디버그 카드 + 합성 hass + 운영 모델)에서 OP 시나리오 3개 자동 검사 통과(초록/회색 차선, 열림 값인데 문 닫혀 보임). 폭 1700/1400px에서 좌우 배치·대시보드 고정(스크롤 900·1800에서 상단 68px 유지)·시나리오 클릭 후 스크롤 위치 유지, 1100/390px은 기존 세로 배치. 드롭다운별 패널 높이: 전체 3001→2550px(컴팩트), 3D 1036, 배터리 412, 테마 400px. 보이는 버튼·라벨·선택 상자 89개를 1700/1400/1100/390px에서 자동 측정(글자 세로 쌓임·내용 넘침·과소 폭)해 발견된 동작 모드 7개·후보 버튼 5개·3D 첫 줄 버튼을 고친 뒤 0건. JS 테스트 104 통과/6 실패(실패 6건은 이번 변경 전부터 동일; charging-curve는 원래 import.meta 오류로 실패하며 제거 패널 검사 줄은 '없음' 확인으로 갱신). 실제 HA 화면 미확인.
- 배포 상태: `e5fb4ea`를 main에 푸시한 뒤 HA SSH(`sudo`)로 프론트엔드 3개(`carrot-dashboard-debug.js`, `carrot-debug-3d.js`, `carrot-assets/vehicle-3d.js`)를 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 해시가 같음을 확인하고 `/homeassistant/carrot_ha/deployment-backups/debug-dashboard-e5fb4ea/before`에 백업(SHA256SUMS.before 포함). 반영 후 설치 파일과 HTTP 응답(200) SHA-256이 커밋과 일치(`carrot-dashboard-debug.js` `8a6532b9…`, `carrot-debug-3d.js` `5523383a…`, `vehicle-3d.js` `60282b0d…`). Python 변경 없음(HA 재시작 불필요), 브라우저 강력 새로고침 필요. 운영 HA 화면 확인 미실시. 버전·태그·릴리즈 없음.

## 2026-10-26 — 3D 차량: 주행 중 문 닫힘 표시, 오픈파일럿 작동 시 초록 차선, 주행 시점 각도·축소 (HA 반영)

- 사용자 요청: (1) 주행 중에는 실제 상태와 무관하게 모든 문을 닫힌 상태로, 주행이 아니면 실제 상태로. (2) `binary_sensor.id_4_enabled`로 오픈파일럿 작동을 확인해 작동 중이면 주행 뷰의 차선을 초록, 꺼지면 기존 회색. (3) 주행 뷰를 조금 축소. 이어서 예시 사진을 주며 "축소랑 각도 조절", "예시 사진 정도면 충분".
- 변경(뷰어 `tools/vehicle3d/viewer.src.js`): 문·트렁크 애니메이션 목표를 `!state.driving && 실제 값`으로 바꿔 주행 중에는 닫히고 주행이 끝나면 실제 값으로 다시 열린다(충전 장면의 열린 문 강조도 이 값을 따른다). 새 상태 `openpilot`에 따라 점선 차선 색을 회색 `#9aa3a8`↔초록 `#34d873`로 부드럽게 전환. `drive` 시점은 조준점·수평 거리를 유지하고 카메라 높이를 2.6→4.3으로 올려 지붕이 보이게 했으며, 새 시점 속성 `pad: 1.15`로 모든 카드 크기에서 15% 물러난다(넓은 카드는 가로 맞춤 하한 0.8에 걸려 `need`만으로는 축소되지 않음).
- 변경(래퍼 `carrot-vehicle-3d.js`): `openpilotEngaged(v, hass, config)` 추가. 카드 설정 `openpilot_entity` 또는 서버가 주는 `entity_ids.enabled` 엔터티가 `on`/`off`이면 그 값을, 그 외(엔터티 없음·unavailable)에는 같은 출처인 카드 데이터 `enabled`를 쓴다. 추가 요청 없음.
- 변경(백엔드 `__init__.py`): 대시보드 응답의 `entity_ids`에 `enabled`를 추가(HA 재시작 후 적용). 재시작 전에도 카드 데이터 `enabled`로 동작한다.
- 문서: `docs/VEHICLE_3D_MODEL.md` 카드 옵션·상태 표 갱신.
- 관련 파일: `tools/vehicle3d/viewer.src.js`, `custom_components/carrot_ha/frontend/{carrot-vehicle-3d.js,carrot-assets/vehicle-3d.js}`, `custom_components/carrot_ha/__init__.py`, `tests/vehicle-3d-integration.test.mjs`, `docs/VEHICLE_3D_MODEL.md`.
- 검증: 3D 통합·디버그 테스트 28/28 통과(신규 2건). 전체 JS 테스트의 실패 6건(`camera-360`, `charging-curve`, `debug-freshness`, 백엔드 캐시 키, `motion-status`, `range-c3-and-fixes`)은 이번 변경을 제외한 상태에서도 동일하게 실패하는 기존 문제. Python 테스트는 이 PC에 pytest가 없어 미실행. 로컬 프리뷰에서 센서상 트렁크·운전석 문이 열린 주행 상태(오른쪽 잠금 카드는 "열림")에서 3D 문이 모두 닫혀 보임, 오픈파일럿 꺼짐 회색·켜짐 초록 차선, 1300px·390px에서 지붕이 보이는 높아진 각도와 축소 확인, 콘솔 오류 없음. 실제 엔터티 상태 전환·실차 주행 화면은 미확인.
- 추가 조정(사용자 피드백 "각도가 너무 올라갔다, 조금만 내려 달라, 차 앞(차선)이 조금 멀리 보이게, 너무 쨍하지 않은 조금 더 밝은 초록"): `drive` 카메라 높이 4.3→3.5(앙각 약 28°→23°, 원래 2.6은 약 18°), 조준점을 차 앞쪽으로 0.45 이동(`look` z 0.4→0.85, 카메라도 같이 이동해 수평 방향 유지)해 차량 앞 도로가 더 보이게 했다. 0.7 이동은 390px에서 뒷범퍼가 카드 가장자리에 닿아 0.45로 줄였다. 작동 중 차선 색 `#34d873`→`#7ee6a6`(더 밝고 채도 낮음), 불투명도 0.55→0.72(꺼짐 회색은 0.55 유지). 프리뷰 1300px·390px에서 확인, 3D 테스트 28/28 통과.
- 추가 조정(사용자 요청 "그냥 쨍한 초록색 사용해볼래?"): 작동 중 차선 색 `#7ee6a6`→`#1fff5e`(채도 높은 밝은 초록), 불투명도 0.72→0.9. 프리뷰 1300px 확인, 3D 테스트 28/28 통과.
- 배포 상태: `2879352`(두 항목 공통 커밋)를 main에 푸시한 뒤 HA SSH(`sudo`)로 3개 파일(`frontend/carrot-vehicle-3d.js`, `frontend/carrot-assets/vehicle-3d.js`, `__init__.py`)을 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 해시가 같음을 확인하고 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-framing-2879352/before`에 백업(SHA256SUMS.before 포함). 반영 후 설치 파일 SHA-256이 커밋과 일치(`carrot-vehicle-3d.js` `dc3c03e5…`, `vehicle-3d.js` `6ecf08b4…`, `__init__.py` `17d0dee8…`), 프론트엔드 2개의 HTTP 응답도 200·같은 해시. `__init__.py`(엔터티 ID `enabled` 노출)는 HA 재시작 후 적용(미수행, 재시작 전에도 카드 데이터 `enabled`로 동작). 브라우저 강력 새로고침 필요. 운영 화면·실차 주행·오픈파일럿 전환은 미확인. 버전·태그·릴리즈 없음.

## 2026-10-26 — 3D 차량: 카드 제목 아래 영역 기준 구도와 문·트렁크 열림 시점 줌 아웃 (HA 반영)

- 사용자 요청: 3D 시점이 카드 정중앙이지만 상단 상태 제목(`충전중` 등) 때문에 중앙으로 보이지 않으니 카드 크기에 맞게 정렬. 이어서 주차 중 문 열림 시점에서 열린 트렁크가 잘려 보이니 조금 줌 아웃.
- 원인: 3D 스테이지(`.v3d-stage`)는 `.vehicle3d`가 아닌 hero 전체(제목 포함)를 덮는다(`.hero .car-image{position:static}`이 `.vehicle3d{position:relative}`를 덮어씀). 카메라는 캔버스 중앙을 겨냥하므로 차량이 제목 높이의 절반만큼 위로 치우쳤다. 문·트렁크 시점(`top`)은 차체 아래쪽(y=0.45)을 겨냥하고 가로 폭만 맞춰, 위로 솟은 트렁크가 카드 위 가장자리에서 잘렸다.
- 변경(뷰어 `tools/vehicle3d/viewer.src.js`): 새 옵션 `frameTop`(px)으로 제목 아래 영역을 구도 기준으로 삼는다. `camera.setViewOffset`의 비축(off-axis) 투영으로 렌즈 중심을 그 영역 가운데에 두고 가로세로 맞춤도 그 영역 비율로 계산한다. 캔버스는 여전히 hero 전체에 그려지므로 제목 뒤로 솟는 부분이 잘리지 않는다. 인셋은 캔버스 높이의 40%로 제한. 시점별 세로 요구 높이 `needV`를 추가해 `fit`이 가로·세로 중 큰 쪽을 따른다. `top` 시점은 같은 각도로 조준점을 `[0,0.8,-0.3]`로 올리고 뒤로 옮겼으며 `needV: 4.6`을 둔다. 제목 문구가 바뀌면 `refreshFrame()`로 다시 측정한다.
- 추가 요청(같은 날): 데스크톱에서 마우스 휠로 축소가 안 되고(트랙패드 제스처는 됨), 충전 중 아래 공간이 크게 남는다.
  - 휠 원인: `wheel` 처리기가 항상 `preventDefault()`한 뒤 Ctrl(트랙패드 핀치가 보내는 ctrl+wheel) 또는 자유시점일 때만 줌했다. 일반 마우스 휠은 페이지 스크롤도 줌도 되지 않았다. 수정: 차량 위 휠은 항상 줌(줄·페이지 단위 deltaMode 환산, 한 번 입력당 변화량 제한). 페이지 스크롤 차단은 유지. `docs/VEHICLE_3D_MODEL.md` 조작 설명 갱신.
  - 충전 여백 원인: 충전 장면(충전기+케이블+차)은 가로로 길고 낮아 가로 폭 맞춤 시 정사각형에 가까운 카드에서 세로가 남는다. 수정: `charge` 시점의 카메라 높이를 3.1→5.8로 올려(조준점·수평 거리 동일) 장면을 세로로 키우고 배터리 팩이 더 잘 보이게 했다.
- 변경(래퍼 `carrot-vehicle-3d.js`): `headingBottom(box, stage)`로 `.hero-copy` 하단까지의 거리를 `frameTop`으로 넘기고, 렌더마다 `refreshFrame()`를 호출한다. 데이터 요청 추가 없음.
- 관련 파일: `tools/vehicle3d/viewer.src.js`, `custom_components/carrot_ha/frontend/{carrot-vehicle-3d.js,carrot-assets/vehicle-3d.js}`, `tests/vehicle-3d-integration.test.mjs`.
- 검증: three 0.170.0/esbuild 0.28.2로 번들 재생성. 3D 통합·디버그 테스트 26/26 통과(신규 1건, 휠 규칙 테스트를 새 동작으로 갱신). 실제 한국어 카드 + 합성 hass + 운영 모델(HA에서 읽기 전용 복사) 로컬 프리뷰에서 390/900/1300px 폭으로 주차·트렁크·문 전체·충전·충전+문 열림·주행 중(62km/h, 하향등)을 확인(주행 중은 사용자 지적 후 추가 검증: 인셋 1300px 58px·390px 39.6px 적용, 차량이 제목 아래 영역에 온전히 표시, 콘솔 오류 없음; 마우스 휠 아래로 축소·페이지 스크롤 없음 확인): 인셋 58px 적용, 정면·충전 장면이 제목 아래 영역 중앙, 열린 트렁크가 위 가장자리와 여백을 두고 전부 보임. 실기 모바일·운영 HA 화면은 미확인.
- 배포 상태: `2879352`(두 항목 공통 커밋)를 main에 푸시한 뒤 HA SSH(`sudo`)로 3개 파일(`frontend/carrot-vehicle-3d.js`, `frontend/carrot-assets/vehicle-3d.js`, `__init__.py`)을 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 해시가 같음을 확인하고 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-framing-2879352/before`에 백업(SHA256SUMS.before 포함). 반영 후 설치 파일 SHA-256이 커밋과 일치(`carrot-vehicle-3d.js` `dc3c03e5…`, `vehicle-3d.js` `6ecf08b4…`, `__init__.py` `17d0dee8…`), 프론트엔드 2개의 HTTP 응답도 200·같은 해시. `__init__.py`(엔터티 ID `enabled` 노출)는 HA 재시작 후 적용(미수행, 재시작 전에도 카드 데이터 `enabled`로 동작). 브라우저 강력 새로고침 필요. 운영 화면·실차 주행·오픈파일럿 전환은 미확인. 버전·태그·릴리즈 없음.

## 2026-10-26 — 3D 차량: 모바일 카드 높이를 조금 늘리고 시점별 폭 맞춤 구도 적용

- 사용자 요청: 모바일에서 인터랙티브 3D 카드 높이를 조금만 더 길게(메인·디버그 모두). 이어서 "너무 지나치게 늘리지 말고 조금만"이라고 정정했다.
- 변경(높이): 컨테이너 700px 이하(모바일)에서 3D 컨테이너(`.hero .car-image.vehicle3d`)만 155px에서 **195px**로 늘렸다(영역 전체 약 40px 증가). 이미지 폴백 전용 `.hero .car-image`의 155px는 그대로다. 디버그 대시보드는 같은 카드 스타일을 상속하므로 함께 바뀐다(디버그의 자체 규칙은 `max-height:250px`뿐이라 충돌 없음). 처음에는 225px로 올렸다가 과하다는 말씀에 195px로 줄였다.
- 변경(구도): 높이가 늘면 카메라가 가로 폭 기준으로 너무 물러나 차가 작아지는 문제가 있어, 뷰어가 시점마다 필요한 가로 폭(`need`, 미터: 정면 2.5, 측면 5.4, 탑 4.8, 주행 5.6, 충전 6.2 등)과 실제 보이는 폭으로 거리를 계산하도록 바꿨다(범위 0.8~1.7). 폭이 좁은 정면·후면은 가까이, 충전 시점은 충전기까지 들어오도록 유지한다. 넓은 카드에서는 이전과 같은 0.8 하한이다.
- 관련 파일: `custom_components/carrot_ha/frontend/{carrot-dashboard-ko.js,carrot-dashboard-en.js,carrot-assets/vehicle-3d.js}`, `tools/vehicle3d/viewer.src.js`, `tests/vehicle-3d-integration.test.mjs`.
- 검증: JS 테스트 102개 중 100개 통과(실패 2건은 변경 전부터). 실제 한국어 카드를 모바일 폭(375px)에서 열어 3D 영역이 195px(영역 전체 235px)이고 정면 차량이 카드를 알맞게 채우며 충전+문 열림에서 차와 충전기가 모두 들어옴을 확인했다. 폭 683px과 1250px 레이아웃에서도 충전 시점 구도를 확인했다.
- 배포 상태: `b5b893e`를 main에 푸시한 뒤 HA SSH(`sudo`)로 프론트엔드 파일 3개(`carrot-dashboard-ko.js`, `carrot-dashboard-en.js`, `carrot-assets/vehicle-3d.js`)를 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 동일함을 해시로 확인했고, 반영 후 3개 모두 커밋과 SHA-256이 일치한다. 반영 전 파일은 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-mobile-height-b5b893e/before`에 백업했다. 모델 파일은 바뀌지 않았고 HA 재시작은 필요 없다(강력 새로고침). 새 pre-release/정식 릴리즈 없음.
- 미확인: 실제 iPhone Safari/HA 앱 화면에서의 높이·구도(이 환경은 폭 375px 에뮬레이션만 확인), 아주 좁은 폭(360px 이하)의 구도.

## 2026-10-26 — 3D 차량: 충전 중 표시(X-ray·배터리 팩·케이블·충전기)와 디버그 충전 시나리오

- 사용자 승인: 로컬 프리뷰(`.preview/vehicle-3d`)에서 반복 확인·수정한 충전 장면을 메인과 디버그 대시보드에 반영하고 HA에 배포하도록 요청했다(디버그에는 충전 시나리오 포함).
- 변경(뷰어): 충전 장면 모듈 `tools/vehicle3d/charge-scene.js`를 추가했다. 충전 중에만 차체·창문을 X-ray(10%), 바퀴·타이어를 30%로 처리하고 실내를 숨기며, 열린 문·트렁크는 84% 불투명 + 호박색으로 강조한다. 차대 아래에 납작한 배터리 팩을 두고 SOC만큼 초록으로 채우며, 충전기 기둥(SOC·kW 화면), 위에서 30° 아래로 꽂히는 검은 커넥터, 케이블, 충전구에서 팩까지의 초록 선 두 가닥을 그린다. 빛 한 줄기가 충전기 → 케이블 → 충전구 → 초록 선 → 채워진 팩 순서로 한 바퀴 돌며 11kW 이하 4.4초, 초과 2.2초(대시보드 SOC 바와 같은 주기)다. 충전 중에는 실제 하향등 값과 무관하게 램프가 켜지고 끝나면 실제 값으로 돌아온다. 팩·케이블·충전기는 차체보다 먼저 깊이를 기록하며 그려서 열린 문이 팩 앞에서 정확히 가린다. 충전 기본 시점 `charge`(오른쪽 앞 3/4)를 추가했다.
- 변경(연동): `vehicleViewState`가 카드 상태(`charging`)와 이미 가진 값(`charge_power_kw`/`charge_power_w`, `charge_mode`, `soc_percent`)에서 충전 입력을 만든다. 새 요청은 없다. 한국어·영어 카드는 같은 모듈을 쓰므로 별도 수정이 없다. 뷰어에 읽기 전용 `lamp`, `charge`(활성·스윕 주기)를 추가했다. 충전 중 반복되는 스윕은 "시점 안정화" 판정에 포함하지 않는다.
- 변경(디버그): `carrot-debug-3d.js`의 시나리오를 22개에서 34개로 늘렸다. 기존 `충전 + 문 열림`의 기대 시점을 `top`에서 `charge`로 바꾸고, 충전 완속 7kW·11kW(경계)·급속 50kW·150kW·SOC 10%·95%·문·트렁크 전부 열림·하향등 켜짐(실제 꺼짐)·실제 하향등 켜짐, 충전 종료 후 하향등 원래대로(꺼짐/켜짐), 충전 중 주행 시작을 추가했다. 충전 시나리오는 시점뿐 아니라 충전 장면 활성, 램프 밝기, 스윕 속도 등급을 자동 검사한다.
- 문서: `docs/VEHICLE_3D_MODEL.md`에 충전 표시 절을 추가했다.
- 관련 파일: `tools/vehicle3d/{charge-scene.js,viewer.src.js}`, `custom_components/carrot_ha/frontend/{carrot-vehicle-3d.js,carrot-debug-3d.js,carrot-assets/vehicle-3d.js}`, `tests/{vehicle-3d-integration.test.mjs,debug-3d.test.mjs}`, `docs/VEHICLE_3D_MODEL.md`.
- 검증: JS 테스트 102개 중 100개 통과, 실패 2건(`motion-status`, `range-c3-and-fixes`)은 변경 전부터 실패한다. Chromium에서 디버그 대시보드의 `전체 순회 재생`이 34개 시나리오를 **통과 34 / 실패 0**으로 마쳤다(충전 13개 포함: 완속 7·11kW는 스윕 4.4초, 급속 50kW와 표시 전력 95kW는 2.2초). 실제 한국어 카드(`legacy_id4` 설정)에서 주차 → 완속 충전 → 급속 충전 → 충전+문 열림 → 종료를 확인했다(시점 `front`/`charge`, 스윕 주기, 램프 0/1).
- 배포 상태: `354457c`를 main에 푸시한 뒤 HA SSH(`sudo`)로 프론트엔드 파일 3개(`carrot-vehicle-3d.js`, `carrot-debug-3d.js`, `carrot-assets/vehicle-3d.js`)를 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 동일함을 해시로 확인했고, 반영 후 3개 모두 커밋과 SHA-256이 일치한다. HA에서 세 경로와 모델이 200이며 `/api/carrot_ha/frontend-version`이 `0.9.0-beta.1-232978018ccf`로 바뀌어 브라우저가 새 파일을 받는다. 반영 전 파일은 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-charging-354457c/before`에 백업했다. 모델 파일은 바뀌지 않았고 HA 재시작은 필요 없다. 새 pre-release/정식 릴리즈 없음.
- 미확인: 실제 HA 화면·모바일·저사양 기기에서의 렌더링 성능(충전 중에는 스윕 때문에 화면이 보이는 동안 계속 그린다), 실차에서 충전 신호(`charging`, `charge_power_kw`)가 이 대시보드 값으로 들어오는 경로, 충전구·팩·충전기의 실제 형상과의 차이(일반적인 형태로 만든 추정치).

## 2026-10-26 — 3D 차량 스와이프 스크롤 차단 제품 반영·HA 배포 완료

- 사용자 승인: 프리뷰 시연 후 “HA에 바로 반영해줘. 디버그, 메인 대시보드 둘다 포함.”으로 공통 뷰어 변경·직접 배포 승인.
- 변경/이유: 차량 캔버스 touch-action none을 기본 및 자유시점 해제 뒤에도 유지하고, 일반 wheel도 preventDefault하여 차량 조작이 페이지 스크롤로 이어지지 않도록 함. 드래그 회전·핀치/Ctrl+휠 확대·축소와 차량 바깥 페이지 스크롤은 유지. 공통 뷰어를 사용하므로 디버그 및 ko/en 메인에 모두 적용.
- 관련 파일: tools/vehicle3d/viewer.src.js, custom_components/carrot_ha/frontend/carrot-assets/vehicle-3d.js, tests/vehicle-3d-integration.test.mjs, docs/VEHICLE_3D_MODEL.md, frontend/carrot-vehicle-3d.js (공통 제스처 설명 및 프론트엔드 식별자 갱신).
- 검증: 프리뷰에서 차량 위 wheel 스크롤 차단, 대각선 드래그 회전, 차량 바깥 페이지 스크롤 확인. 신규 기본/자유시점 및 wheel 이벤트 계약 테스트 포함 전체 JS 100개 중 98개 통과, 기존 motion-status·range-c3-and-fixes 2개만 실패.
- 배포 상태: 제품 커밋 `e2d84b45529e54243c27ef6e3c8949677dafb7e9` main 푸시 후 HA 직접 반영 완료. 백업 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-swipe-e2d84b4/before`. 설치 및 HTTP 응답 SHA-256이 두 파일 모두 커밋과 일치: `carrot-vehicle-3d.js` = `3466b8df05fdad8de981169b530f4407984748f93aa8657024f619f308bb0140`, `carrot-assets/vehicle-3d.js` = `482b43936ee21b4922a36128c2544388c8925b4732a38b357cd4c94fa29561c9`. HA frontend-version `0.9.0-beta.1-5e56ec89ccf2` 확인. 디버그·ko/en 메인은 같은 공통 뷰어 사용. 모델·GLB·버전·태그·릴리즈 변경 없음. HA 재시작 불필요, 브라우저 강력 새로고침 필요.
- 미확인: 모바일 실기 터치·핀치, 로그인된 실제 HA 화면.

## 2026-10-26 — 3D 차량 스와이프의 페이지 스크롤 차단 프리뷰 (승인 대기)

- 요청/원인: 차량 조작 중 페이지가 함께 스크롤됨. 뷰어 기본 `touch-action: pan-y`가 세로 터치를 페이지로 넘기고, 일반 wheel도 페이지 스크롤을 허용하고 있었음.
- 프리뷰 변경: `.preview/dash3d/swipe/viewer.src.js` 사본에서 기본 및 자유시점 해제 후에도 touch-action none 유지. wheel은 preventDefault 후 Ctrl/핀치 또는 자유시점일 때만 기존 줌 적용. 제품 소스·번들은 아직 변경하지 않음.
- 검증: 로컬 실제 디버그 카드에서 차량 위 스크롤 입력 후 페이지 위치 유지, 대각선 드래그로 회전 확인, 차량 바깥 스크롤은 페이지 이동 확인. 기존 3D 통합 테스트 17/17 통과. 모바일 실기 터치·핀치는 미검증.
- 배포 상태: UI 사전 승인 대기. HA 반영·커밋·푸시·버전·태그·릴리즈 없음. 승인 후 tools/vehicle3d/viewer.src.js와 생성 번들, 관련 문서·테스트에 반영 예정.

## 2026-10-26 — 디버그 3D 시나리오 제품 반영·HA 직접 배포 완료

- 사용자 승인: 사전 프리뷰 시연 후 “HA에 일단 바로 반영해줘”로 제품 반영·직접 배포 승인.
- 변경: 프리뷰에서 확인한 22개 시나리오, 개별 문·트렁크 및 전체 토글, 하향등·181초 만료, 속도·모드 연동, 시점·자유시점·초기화, 3D 끔·모델 없음, 자동 순회·중지·통과/실패 패널을 제품 코드로 옮김. 운영 카드의 syncVehicle3d/vehicleViewState와 DOM 보존 경로를 재사용하며 운영 ko/en 파일은 변경하지 않음.
- 관련 파일: frontend/carrot-dashboard-debug.js, frontend/carrot-debug-3d.js, tests/debug-3d.test.mjs, docs/VEHICLE_3D_MODEL.md, docs/DEBUG_DASHBOARD.md.
- 검증: 프리뷰 22/22 통과·실패 0, 카드 안 실제 드래그 회전 확인. 제품 전체 JS 테스트 99개 중 97개 통과, 기존 motion-status·range-c3-and-fixes 2개만 실패. 디버그 신규 의존성까지 버전 쿼리를 검증하도록 기존 의존성 테스트를 확장함. HA SSH 연결·설치 경로 확인 완료. 백업·해시 결과는 아래 배포 기록에 추가함.
- 배포 상태: 제품 커밋 `0b11db5bb054b7d2269de41e78414a8cc37772f1` main 푸시 확인 후 HA SSH sudo 표준입력으로 프론트엔드 2개 반영 완료. 백업: `/homeassistant/carrot_ha/deployment-backups/debug-3d-0b11db5/before` (새 파일은 `.absent` 표식). 설치 및 HTTP 응답 SHA-256이 모두 커밋과 일치: `carrot-dashboard-debug.js` = `f041e28843e7f92c1364249c17e345694b79066ddccc5cc1a01be63c1a51445d`, `carrot-debug-3d.js` = `ed1094eb41a3891187a998eb6a4fe2b6d97a35656b06cb8122fb7946ee732f8e`. HA frontend-version = `0.9.0-beta.1-f1488c236ae6` 확인. 버전 상승·태그·릴리즈 없음. GLB 변경·커밋 없음. 프론트엔드만 변경하여 HA 재시작 불필요.
- 미확인: 실제 HA 로그인 화면·모바일. 프리뷰 검증과 운영 화면 검증은 구분함.

## 2026-10-26 — 디버그 3D 시나리오 사전 프리뷰·러브레이스 복구 안내 (승인 대기)

- 요청/이유: 디버그 카드에서 문 4개·트렁크·하향등·속도·시점·폴백과 22개 시나리오를 가상 값으로 시험하고, 제거한 러브레이스 디버그 카드를 다시 추가할 수 있도록 안내한다.
- 시작 점검: main 작업 트리 깨끗함, MERGE_HEAD·기존 스테이징 없음. `git pull --ff-only` 결과 최신 상태.
- 조사: hero의 `.vehicle3d`는 디버그 호스트가 아니라 `dashCard.shadowRoot` 안에 있다. `patchDashCard`가 보관한 운영 `origRender()`는 이미 `this.syncVehicle3d(v,state)`를 호출한다. 호출 누락이라는 가설은 현재 코드에서 확인되지 않았다. 운영의 `vehicleViewState`·동기화·뷰어를 그대로 사용한다.
- 프리뷰: `.preview/dash3d/index.html`, `frontend/carrot-dashboard-debug.js` 사본, `frontend/carrot-debug-3d.js`, `debug-3d.test.mjs` (모두 gitignore 대상). 실제 전체 프론트엔드 모듈을 복사해 Custom Element와 합성 hass로 구동한다. 로컬 모델만 사용하며 GLB는 커밋하지 않는다. ordinary telemetry 갱신은 기존 운영 DOM 패치 경로를 유지한다. 모델 옵션 변경 시에만 운영의 3D 비활성화 렌더 경로로 뷰어를 해제하고 다시 만든다.
- 검증: 첫 순회는 화면 밖 렌더 중지와 주행 중 계속 움직이는 뷰어의 settled 판정 때문에 실패했다. 검증 때 차량을 화면에 표시하고 주행은 1.8초 대기 뒤 실제 view를 비교하도록 수정한 뒤 22/22 통과, 실패 0. 카드 안 마우스 드래그로 정면에서 측면으로 회전 확인. 프리뷰 계약 테스트 3/3 통과. `node --test tests/*.test.mjs`: 96개 중 94개 통과, 기존 motion-status·range-c3-and-fixes 2개 실패.
- 관련 문서: `docs/DEBUG_DASHBOARD.md`에 실제 등록 이름 `custom:carrot-dashboard-debug-card`, 카드 YAML, 공통 리소스 경로와 복구 절차를 추가했다. `docs/VEHICLE_3D_MODEL.md`는 승인 후 운영 적용과 함께 갱신할 예정.
- 배포 상태: 사전 UI 승인 대기. 프로덕션 프론트엔드 수정·커밋·푸시·HA SSH 반영 없음. 버전·태그·릴리즈 없음. 프리뷰 서버 `http://127.0.0.1:8765/dash3d/` 유지.
- 미확인/후속: 실제 HA 화면·모바일·운영 배포는 미검증. 승인 후 프리뷰 변경을 제품 파일로 옮기고 신규 테스트를 tests에 추가해 전체 검증, main 커밋·푸시, 백업 후 HA 직접 반영과 커밋/설치 SHA-256 대조를 수행한다. HA 재시작은 필요 없는 프론트엔드 변경이다.

## 2026-10-26 — 3D 차량: 드래그 불가 수정과 로딩 속도 개선

- 사용자 보고: 3D 모델은 뜨지만 돌려 볼 수 없고(고정), 대시보드 진입 뒤 3D가 나오기까지 약 10~15초가 걸린다.
- 원인 1(조작 불가): 카드의 기존 스타일 `.hero .car-image{pointer-events:none}`가 3D 컨테이너(`class="car-image vehicle3d"`)와 그 자식 캔버스에도 상속되어 마우스·터치가 캔버스에 전달되지 않았다. 프리뷰 검증은 상태 전환만 확인했고 카드 안 드래그는 시험하지 않았다.
- 원인 2(느린 로딩): Mac에서 HA로 측정한 전송 속도가 약 105KB/s여서 모델 3,619,416바이트에 34초, 3D 모듈 616,497바이트에 5.7초가 걸렸다. 병목은 파싱이 아니라 전송이며, 기존 흐름은 모델 존재 확인(HEAD), 모듈, 모델을 순차로 받았고 정적 경로에 캐시 헤더가 없어 재방문 최적화가 없었다.
- 변경: ① `.hero .vehicle3d,.hero .vehicle3d .v3d-stage{pointer-events:auto}`를 기존 규칙 뒤에 추가하고 제목 영역(`.hero-copy`)은 포인터를 통과시킨다. ② 모델을 접속 기기의 IndexedDB에 저장하고 재방문 때 저장본을 바로 사용하며 ETag로 백그라운드 확인한다(변경은 다음 방문부터 적용). localStorage는 용량·바이너리 문제로 사용하지 않는다. ③ HEAD 확인을 없애고 모델과 3D 모듈을 병렬로 내려받으며, 카드 `setConfig` 시점에 미리 시작해 데이터 요청과 겹친다. ④ 모델 빌드에서 텍스처를 WebP로 압축하고 geometry는 meshopt `high`로 압축해 3,619,416바이트에서 2,023,208바이트로 줄였다(약 44% 감소, 화질 차이는 프리뷰에서 눈으로 비교했다). ⑤ 뷰어가 내려받은 바이트를 직접 받는다(`modelBuffer`).
- 관련 파일: `custom_components/carrot_ha/frontend/{carrot-vehicle-3d.js,carrot-dashboard-ko.js,carrot-dashboard-en.js,carrot-assets/vehicle-3d.js}`, `tools/vehicle3d/{viewer.src.js,model/build_model.mjs,model/package.json}`, `docs/VEHICLE_3D_MODEL.md`, `tests/vehicle-3d-integration.test.mjs`.
- 검증: JS 테스트 17개(포인터 이벤트 규칙 순서, 모델 1회 다운로드와 워밍업 공유, 3D 끔에서 요청 없음, 모델 없음 폴백, IndexedDB 사용·localStorage 미사용 등) 통과, 전체 JS는 기존 실패 2건 외 통과. Chromium에서 실제 한국어 카드(`legacy_id4` 설정)를 마우스로 드래그해 차가 회전함을 확인했다. IndexedDB를 비운 첫 로드는 `source: network`, 재로드는 `source: local`(다운로드 16ms)로 기록됨을 확인했다.
- 배포 상태: `6b940d2`를 main에 푸시한 뒤 HA SSH(`sudo`)로 프론트엔드 파일 4개와 새 모델을 직접 반영했다. 설치 SHA-256이 파일 4개 모두 커밋과 일치하고 모델도 로컬과 일치한다(2,023,208바이트, HA에서 200). `/api/carrot_ha/frontend-version`이 `0.9.0-beta.1-2ad6405ad6d4`로 바뀌어 브라우저가 새 파일을 받는다. 반영 전 파일 4개와 이전 모델은 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-drag-speed-6b940d2/before`에 백업했다. 프론트엔드·모델만 바뀌어 HA 재시작은 필요 없다. 새 pre-release/정식 릴리즈 없음.
- 미확인: 실제 HA 화면과 모바일에서의 체감 시간(이 환경은 HA에 로그인된 브라우저가 없다). 첫 방문의 전송 시간은 회선에 따라 여전히 길 수 있다. 모델을 바꾼 직후에는 기기에 저장본이 있으면 한 번 더 새로고침해야 새 파일이 적용된다.

## 2026-10-26 — 3D 차량: `vehicle_image_layout: legacy_id4` 카드에서 3D가 뜨지 않던 문제 수정

- 사용자 보고: HA 재시작 뒤에도 3D 대신 정적 이미지가 표시됨.
- 원인: 사용자 카드 설정에 `vehicle_image_layout: legacy_id4`가 있었고, `vehicleImage()`가 이 설정에서 3D 컨테이너를 만들기 전에 옛 SVG를 바로 반환했다. 서버 쪽은 정상이었다(HA에서 `/carrot_ha_models/vehicle.glb` 200·`model/gltf-binary`·3,619,416바이트, HEAD 200, `carrot-vehicle-3d.js`·`carrot-assets/vehicle-3d.js` 200). 프리뷰 설정에는 이 옵션이 없어 놓쳤다.
- 변경: 한국어·영어 `vehicleImage()`를 정리해, 3D가 켜져 있으면 모든 이미지 레이아웃에서 3D 컨테이너를 만들고 설정된 이미지(legacy 잘라내기 SVG 포함)를 컨테이너 안의 폴백으로 둔다. `vehicle_3d: false`이면 기존 마크업을 그대로 돌려준다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-dashboard-{ko,en}.js`, `tests/vehicle-3d-integration.test.mjs`.
- 검증: 신규 회귀 테스트(legacy 레이아웃·일반 이미지·이미지 없음에서 3D 컨테이너와 폴백, `vehicle_3d: false`에서 원본 마크업) 포함 JS 테스트 13개 통과. Chromium에서 사용자와 같은 설정(`legacy_id4` + 이미지)으로 3D 캔버스가 뜨고 폴백이 숨겨지며 문 열림 장면이 반영됨을 확인했다.
- 배포 상태: `45a4e9c`를 main에 푸시한 뒤 HA SSH(`sudo`)로 두 대시보드 파일만 직접 반영했다. 설치 SHA-256이 커밋과 일치하고, `/api/carrot_ha/frontend-version`이 `0.9.0-beta.1-d9851e5c8217`로 바뀌어 브라우저가 새 파일을 받는다. 반영 전 파일은 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-legacy-layout-45a4e9c/before`에 백업했다. 프론트엔드 파일만 바뀌어 HA 재시작은 필요 없다(페이지 강력 새로고침만). 실제 HA 화면은 로그인 상태가 없어 이 환경에서 확인하지 못했다. 새 pre-release/정식 릴리즈 없음.

## 2026-10-26 — 인터랙티브 3D 차량(선택 기능)과 하향등 엔터티 복구

- 사용자 승인: 로컬 인터랙티브 프리뷰(`.preview/vehicle-3d`)를 확인·승인한 뒤 하향등 엔터티 복구와 대시보드 통합을 요청했다. 모델 파일은 개인 사용 목적이며 제3자에게 배포하지 않는다고 사용자가 확인했다.
- 이유: 정적 이미지 대신 문 4개·트렁크·하향등·주행 상태를 보여 주는 3D 차량을 내 차 탭에 표시한다.
- 변경(HA 통합): `light_low_beam_requested`(하향등 요청) 바이너리 센서를 복구했다. 다른 램프 요청(상향등·미등·DRL·안개등·후진등)은 이전처럼 수집기에만 남긴다. 값은 일시적이므로 `OPTIONAL_FIELDS`에 넣어 180초 후 만료한다(차량이 잠든 뒤 켜짐이 남지 않음). 문·트렁크·잠금은 기존대로 마지막 값을 유지한다. 사용자 모델 폴더 `/config/carrot_ha/models`가 있으면 `/carrot_ha_models`로 정적 제공한다.
- 변경(프론트엔드): `carrot-vehicle-3d.js`(상태 연결·지연 로딩·폴백)와 `carrot-assets/vehicle-3d.js`(three.js 기반 뷰어, 약 0.6MB)를 추가했다. 한국어·영어 대시보드의 차량 이미지를 3D 컨테이너로 바꾸되 PNG를 폴백으로 유지한다(`vehicle_3d: false`로 끄기, `vehicle_3d_model`·`vehicle_3d_color` 옵션). `carrot-view-state.js`의 갱신 병합이 `.vehicle3d`를 Leaflet 지도처럼 소유 영역으로 두어, 15초 갱신에도 캔버스·시점이 유지된다. 디버그 대시보드는 정적 이미지를 쓴다.
- 동작: 주차는 전면, 문/트렁크 열림은 45° 탑뷰, 주행은 뒤쪽 위 3/4 시점이 기본이며 드래그로 어느 방향이든 돌릴 수 있다(카메라는 차 중심 높이의 수평선 아래로만 내려가지 않음). 하향등은 후미등·헤드램프와 바닥의 부채꼴 빛으로 표시한다. 대시보드가 이미 가진 값(`door_*_open`, `trunk_open`, `light_low_beam_requested`, `speed_kph`, 주행 상태)만 사용하며 모델 존재 확인 `HEAD` 1회 외에 요청을 만들지 않는다.
- 모델: 저장소에 포함하지 않는다(`.gitignore`의 `*.glb`). 원본 Sketchfab Standard 라이선스와 CC BY-NC 4.0 부품을 합친 개인용 파일이다. 재생성 스크립트는 `tools/vehicle3d/model/`, 사용법·출처·한계는 `docs/VEHICLE_3D_MODEL.md`에 기록했다. 스크립트로 다시 만든 결과가 승인된 프리뷰 모델과 바이트 단위로 동일함을 확인했다.
- 관련 파일: `custom_components/carrot_ha/{telemetry.py,__init__.py}`, `frontend/{carrot-assets/LICENSE.three,carrot-vehicle-3d.js,carrot-view-state.js,carrot-dashboard-ko.js,carrot-dashboard-en.js,carrot-assets/vehicle-3d.js}`, `tools/vehicle3d/`, `docs/VEHICLE_3D_MODEL.md`, `tests/{vehicle-3d-integration.test.mjs,test_new_sensors.py,test_optional_telemetry.py}`, `.gitignore`.
- 검증: 신규 JS 테스트 9개(상태 매핑, 만료·미확인 값, 모델 없음 폴백과 재탐색 방지, 3D 끄기·해제, 지연 로딩, 추가 요청 없음) 통과. 신규 하향등 Python 테스트(유일한 램프 엔터티, 180초 만료, 타임스탬프 없음) 통과. 기존 테스트는 변경 전과 동일한 결과다(JS: `motion-status`, `range-c3-and-fixes` 2건은 변경 전 HEAD에서도 실패, Python: 환경 모듈 부재 9건 동일). Chromium에서 실제 한국어 카드 + 합성 값으로 주차·문 열림·주행+하향등·모델 없음(PNG 폴백)을 확인했고, 반복 렌더링 뒤에도 같은 캔버스가 유지됨을 확인했다.
- 배포 상태: `8b9c777`을 main에 푸시했다. 같은 날 HA SSH(`sudo`)로 직접 반영했다: 통합·프론트엔드 파일 8개를 파일별 임시 파일 뒤 교체했고, 설치 SHA-256이 8개 모두 커밋과 일치하며 파이썬 구문 검사를 통과했다. 모델 `/config/carrot_ha/models/vehicle.glb`(3,619,416바이트)는 로컬 파일과 SHA-256 `089479a4…cbe8`이 일치한다. 반영 전 파일 5개와 해시는 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-8b9c777/before`에 백업했다(신규 3개는 백업 대상 아님). 반영 전 HA의 `__init__.py`와 두 대시보드는 저장소 직전 커밋과 줄바꿈(CRLF)만 달랐고 내용은 같음을 확인했다. **HA 재시작은 하지 않았다**(사용자 작업): 재시작해야 새 엔터티와 `/carrot_ha_models` 경로가 등록된다. 새 pre-release/정식 릴리즈·태그는 만들지 않았다.
- 미확인: 실제 HA 화면·모바일 터치·저사양 기기 성능, 실차 하향등 신호의 연속 수신(과거 3일 아카이브에서 켜짐/꺼짐 값이 들어오는 것만 확인). 새 pre-release/정식 릴리즈는 만들지 않았다(사용자 승인 없음).

## 2026-10-26 — 파라미터 대시보드 복구 및 실패 값 복원

- 사용자 승인: 보완 후 HA 직접 반영 및 사용 절차 안내. 기존/신규 비교 프리뷰를 제공한 뒤 운영 복구를 명시적으로 요청했다.
- 변경: 상위 당근웹 `05c1678033c1c778f0386fba00c1e105bb26c427`의 설정 화면·검색·스타일·번역을 이식하고 HA 검색 HTML 및 중복 복귀 이벤트를 보완했다. `carrot-params-card`는 다시 파라미터 화면을 표시하며 주행 로그는 `carrot-logs-card`를 사용한다. 공통 대시보드 리소스에서 명시적인 `carrot-parameter-tuning-card`도 등록한다.
- 실패 보완: 항목별 대기 표시·중복 조작 잠금, 실패 시 스위치/입력값과 내부 캐시를 마지막 확인값으로 복원, 성공 시 요청값 대신 실제 차량 확인값으로 확정한다. 시간 초과는 취소로 오인하지 않도록 미확인으로 표시하고 같은 요청 ID를 계속 추적하며 지연 적용 시 화면과 상태를 갱신한다. 스냅샷을 복사해 로컬 조작이 확인값을 오염시키지 않도록 한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-{dashboard-runtime,params-card,parameter-tuning-card}.js`, `frontend/carrot_web/`의 설정·공유 모듈·번역·HTML·CSS, `scripts/params_recovery_patch.py`, `scripts/build_params_preview.py`, 파라미터 브라우저 회귀 테스트.
- 검증: 파라미터 단위·대시보드 지연 로딩 테스트 통과. Chromium 실제 컨트롤에서 실패 복원, 대기 중 잠금, 요청과 다른 실제 값, 시간 초과 후 복원/추적, 지연 적용 확인 통과. 설정 전체 PC/모바일 브라우저 회귀(검색·카탈로그 교체·스크롤·높이·메시지 격리) 통과. 실차 변경은 실행하지 않았다.
- HA 사전 확인: SSH 연결 성공. 공통 `/carrot_ha_static/carrot-dashboard.js`가 JS 모듈로 이미 등록되어 있다. 기존 `/carrot_ha_static/carrot-params-card.js` 리소스는 잘못된 CSS 유형으로 등록되어 있어 사용자가 삭제할 수 있으며 공통 모듈을 사용하면 별도 등록은 불필요하다.
- 배포 상태: `6b3f58bd8a8bf02c7998ef8c778ba56b15300026` main 푸시 후 HA 파일 16개 사전 해시 확인·백업·직접 반영 완료. 설치 SHA-256 전부 일치. 백업 `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-6b3f58bd8a8b/before`. HA HTTP 제공본의 runtime/기존 별칭/신규 카드/설정 페이지/브리지 5개도 설치본과 일치. frontend-version `0.9.0-beta.1-ce73a41a5d39` 확인. 프론트엔드 파일만 변경해 HA 재시작 불필요. 새 태그/릴리즈 및 Comma 수정·재시작 없음. 실제 사용자 브라우저와 실차는 미확인.

## 2026-10-26 — 파라미터 복구 프리뷰 기존/신규 비교 보완

- 이유: 이전 프리뷰는 시험 항목 두 개와 단일 화면만 제공해 변경점을 식별할 수 없었다.
- 변경: 실제 HA 카드·전체 프론트엔드를 기존/신규로 각각 복사해 독립적으로 렌더링한다. 동일한 합성 설정 22개와 모바일/PC 폭 전환, 검색·상세·상위 복귀 비교 버튼을 제공한다. 최신 검색 HTML을 상위 원본과 맞추고 신규 쪽의 구형 HA 중복 뒤로 가기 리스너를 제거한다. 운영 파일은 수정하지 않았다.
- 관련 파일: `scripts/build_params_preview.py`, `scripts/fixtures/params-preview.html`, `scripts/fixtures/params-compare.html`, `tests/params-compare-browser.cjs`.
- 검증: Chromium에서 기존/신규 검색창 DOM 차이, 같은 검색어 입력, 신규 모바일 검색 결과 제자리 표시·포커스 유지, 상세 진입/검색 결과 복귀, 정확한 요청 ID의 변경 확인, PC/모바일 폭 전환 및 페이지 오류 없음 통과. 실제 비교 화면 스크린샷 시각 검토 완료. 로컬 HTTP 응답 200 확인.
- 배포: 비교 프리뷰 `/compare.html`만 제공. 운영 HA·Comma 미반영, 새 릴리즈/태그 없음. 실제 휴대폰 키보드·실차 검증 미수행.
- 추가 조사: 사용자가 보고한 변경 실패 후 값 잔류에 대해 기존/상위 `commitSettingValue`의 catch가 알림만 표시하고 컨트롤 값을 복원하지 않음을 확인했다. 이번 커밋은 비교 프리뷰 보완이며 실패 복원 기능은 아직 구현하지 않았다.

## 2026-10-26 — 파라미터 화면 복구: 최신 당근웹 프리뷰 준비

- 사용자 요청: 파라미터 대시보드 복구에 상위 당근웹의 최신 설정 화면·스타일 변경을 포함한다.
- 상위 기준: `ajouatom/openpilot:carrot-wip`의 `05c1678033c1c778f0386fba00c1e105bb26c427` (2026-10-24). 원격 fetch로 확인했다. 상위 `carrot-wip-model_selector` ref는 현재 조회되지 않는다.
- 변경: 프로덕션 파일은 유지하고 `/private/tmp/carrot-params-preview`의 전체 HA 프론트엔드 복사본에 상위 설정 런타임·페이지·CSS·번역·공유 모듈 차이 11개를 이식했다. 모바일 키보드 viewport 정책도 반영했다. HA 인증/값 조회/변경 큐 및 정확한 요청 ID의 차량 적용 확인을 담당하는 기존 브리지는 유지한다.
- 관련 파일: `scripts/build_params_preview.py` (프로덕션 경로를 차단하는 재현용 프리뷰 생성기), `scripts/fixtures/params-preview.html` (합성 데이터). 출처·파일별 SHA-256은 프리뷰의 `params-source.json`에 기록한다.
- 검증: 기존 단위 테스트 통과. 최신 프리뷰 대상 Chromium PC/모바일 회귀에서 카탈로그 표시·교체, 한글 검색, 외부 메시지 차단, 지원하지 않는 작업 거부, 정확한 큐 ID 적용 대기/확인, 실패 전달, 높이·알림 위치·스크롤 및 페이지 오류 없음 확인.
- 배포 상태: 프리뷰만 준비. 화면 승인 전 프로덕션 UI 수정·HA 배포·새 태그/릴리즈 없음. 실차 및 운영 HA 확인은 미수행. 승인 후 카드 연결 복구 및 운영 반영 예정.
- 병행 작업 보호: 조사 중 차계부 `automatic_locations.py`, `station_stats.py`, `stations.py`, `store.py`의 다른 변경을 발견했으며 이 작업에서 수정·스테이징하지 않는다.

## 2026-10-26 — 저장소 위치 이동 및 여러 Mac 작업·시작 점검 규칙 문서화

- 이유: 저장소가 iCloud 동기화 대상인 `~/Documents`에 있어 git 작업 중 `이름 2.js`·`api 2.py`·`CHANGELOG 2.md` 충돌 복사본이 생겼고(9월 19일의 `carrot-trip-days 2.js`도 확인), 같은 날 GitHub Desktop pull이 `driving-logs/` 충돌로 병합을 미완료로 남겨 303개 파일이 스테이징된 상태가 됐다.
- 변경: 저장소를 `/Users/davidlim/Documents/carrot-ha`에서 `/Users/davidlim/Developer/carrot-ha`로 `mv` 이동했다(새로 클론하지 않음). 이동 전 `git bundle`로 `~/carrot-ha-backup.bundle`에 백업했다. 루트 `AGENTS.md`에 저장소 위치·여러 Mac 작업 순서·에이전트 시작 점검·이동 절차를 추가하고, 차계부 지침 2곳(`vehicle-journal/AGENTS.md`, `.agents/rules/vehicle-journal.md`)에 프리뷰 선행 규칙 보강과 HA 반영 전 해시 확인을 추가했다. `vehicle-journal/deployment.md`와 일회성 스크립트 `patch_dashboard.js`·`replace_charge_cards.js`의 옛 절대 경로를 갱신했다.
- 검증: 이동 후 `git status`/`git fsck --connectivity-only`, 브랜치 9개(로컬 전용 4개 포함)와 스태시 1개 보존, git에 없는 `cloudflare/wrangler.json`·`.preview/` 존재, 새 위치가 iCloud 동기화 폴더 밖임을 확인했다.
- 미확인/후속: 두 번째 Mac의 클론·SSH 키·HA 키 등록은 사용자 작업이다. GitHub Desktop 저장소 경로와 Claude Code 프로젝트 경로는 새 위치로 다시 지정해야 한다. 추적되지 않은 `… 2.js` 복사본 4개는 삭제하지 않고 남겼다. 로컬 전용 브랜치 4개는 푸시하지 않았다.
- 배포 상태: 문서·경로 변경만이며 HA·Comma 반영, 릴리즈 없음.

## 2026-10-25 — vehicle-journal: 데스크톱 메모 입력 기본 높이 확대

- 사용자 요청으로 화면 너비 851px 이상에서 기록 추가/수정 메모 입력의 기본 높이를 180px로 확대했다. 850px 이하 모바일/좁은 화면은 기존 rows=3 및 수동 크기 조절을 유지한다. 앞선 사용자 지시에 따라 별도 프리뷰 없이 반영한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-design.js`.
- 검증: Node 구문 및 Chromium 전체 브라우저 회귀 통과. 실제 메모 높이는 너비 1280/851px에서 180px, 850/360px에서 기존 76.6875px 확인.
- 배포: `8872b45` main 푸시 및 HA 디자인 모듈 1개 직접 반영 완료. 백업 `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-8872b4573ee6/before`. 설치 파일 및 HTTP 200 응답이 커밋과 일치(SHA-256 `f18ce6e1bb82a684db00df3bb58c0a4c3bc1e2b6aeb86279a4b3b0046a54c3b6`). 운영 화면 확인 미실시로 사용자 새로고침 후 확인 필요. 새 태그/릴리즈 없음.

## 2026-10-25 — vehicle-journal: 수정 창 입력 드래그 시 잘못 닫히는 문제 수정

- 입력창에서 시작해 배경에서 끝난 드래그를 배경 클릭으로 오인하던 문제를 수정했다. 기본 포인터의 누르기/놓기가 모두 창 바깥이고 이동 거리가 5px 이하인 실제 배경 클릭만 창을 닫는다. 창 내부 여백 클릭과 반대 방향 드래그도 닫지 않으며 취소/닫기 시 포인터 상태를 초기화한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`.
- 검증: Node 구문 검사 및 Chromium 전체 브라우저 회귀 통과. 입력→배경 드래그의 창/입력값 유지, 배경→입력 드래그 유지, 일반 배경 클릭 닫기, 기존 저장·탭·차트·데스크톱/모바일 동작 확인.
- 배포 상태: `1574d70` main 푸시 및 HA 파일 1개 직접 반영 완료. 백업 `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-1574d702266c/before`. 설치 파일 및 HA HTTP 200 응답이 커밋과 일치(SHA-256 `c3f44fa196ae8f0d659edf811141a7c7ea5bea6a73a6cacd0c650165a377a70e`). 운영 브라우저 실제 적용은 미확인으로 사용자 새로고침 후 확인 필요. HA 재시작 불필요, 새 태그/릴리즈 없음.

## 2026-10-25 — vehicle-journal: 수정 창 드래그 닫힘 원인 조사

- 영상에서 입력값 선택 후 포인터를 창 밖으로 이동해 놓을 때 수정 창이 닫히는 현상을 확인했다. 개인 입력값·사진·영상은 기록/커밋 대상에서 제외한다.
- 원인: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`의 `recordDialog.onclick`이 click target이 dialog라는 조건만으로 close를 호출한다. 입력 내부 mousedown → 창 밖 mouseup에서 Chromium이 dialog 대상 click을 생성하여 배경 클릭으로 오인한다.
- 검증: 합성 입력값과 최소 dialog를 사용하는 실제 Chromium에서 mousedown INPUT → mouseup DIALOG → click DIALOG 및 open=false 재현.
- 상태: 원인 조사만 수행. 실행 코드 수정·HA 반영·릴리즈 없음. 수정 방향은 누르기/놓기 모두 배경에서 발생한 실제 클릭만 닫기로 처리하는 것이다.

## 2026-10-25 — vehicle-journal: 추세 카드 지표 제목 간소화 및 직관적 명칭 개편

- 사용자 요청에 따라 추세 카드 제목을 간결하고 직관적으로 개편했다.
- 전기차 지표: 일일 주행거리, 일일 충전량, 충전 단가, 일일 배터리 소모, 급속 충전 비중, 100km당 충전 비용, 총 차량 지출, 총 충전 횟수, 1회 평균 충전량, 100km당 배터리 소모, [분류] 지출.
- 내연기관차 지표: 계기판 주행거리, 구간 기록 주행거리, 총 주유량, 주유 단가, 총 주유 횟수, 총 차량 지출, [분류] 지출.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`.
- 검증: Node.js 구문 검사 및 `vehicle-journal/tests/browser-check.cjs` Chromium 데스크톱/모바일 회귀 통과.
- 배포: `9a817f0` main 푸시 및 HA 파일 1개 직접 반영 완료, SHA-256 일치(`9aba7231...`). 백업: `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-9a817f013e2e/before`. 운영 브라우저 화면은 미확인으로 사용자 새로고침 후 확인 필요. 새 릴리즈/태그 없음.

## 2026-10-25 — vehicle-journal: 추세 지도 기본 화면 반 단계 축소

- 사용자 요청에 따라 프리뷰를 생략하고 기본 진입 및 ‘전체 보기’ 배율을 7에서 6.5로 축소했다. 중심 좌표는 유지하고 Leaflet zoomSnap을 0.5로 설정해 반 단계 배율이 적용되도록 했다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`.
- 검증: Node 구문 검사 및 `vehicle-journal/tests/browser-check.cjs` Chromium 데스크톱/모바일 회귀 통과.
- 배포: `947b8dc` main 푸시 및 HA 파일 1개 직접 반영 완료, SHA-256 일치. 백업: `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-947b8dc4d42a/before`. 운영 브라우저 화면은 미확인으로 사용자 새로고침 후 확인 필요. 새 릴리즈/태그 없음.

# Carrot HA 변경 기록

## 2026-10-21 — 텔레포토 화면 HA 직접 반영 및 pre-release 승인 절차 재확인

- 사용자 지시: 텔레포토 변경을 HA에 직접 반영하고 changelog에 기록한다.
  pre-release는 “올려도 된다”는 별도 승인이 있을 때까지 발행하지 않는다.
- 반영 시각: 2026-10-21 01:00 KST. 기능 원본 커밋은 `03d6f59c129439c3a79b1119ec8bb6032daa4265`.
- 배포 파일: HA의 `/config/custom_components/carrot_ha/frontend/carrot-camera-360.js` 한 개.
  교체 전 HA 파일이 기능 커밋 직전 원본과 일치함을 확인하여 별도 미발행 수정이 없음을 검증했다.
  다른 화면·manifest·사용자 데이터·DB·설정 파일은 반영하지 않았다.
- 원본 백업: `/config/carrot_ha/deployment-backups/20261021-telephoto-03d6f59/carrot-camera-360.js`.
  백업 SHA-256: `8d7177b066f41bfe01c73581784aa8cd507172c598e60d1a629f9109a2a2d2e1`.
  원본/백업 일치를 확인한 후 임시 파일 해시 검증 및 원자적 교체를 수행했다.
- 배포본 SHA-256: `ca17777c9eb856e487459fb39e111ef87ef80848cbec069b7c5ea2155d1b77cc`.
  Git 추출본·HA 설치 파일·HA HTTP `/carrot_ha_static/carrot-camera-360.js` 응답이 모두 일치했다.
  `/api/carrot_ha/frontend-version`은 `0.9.0-beta.1-34c54e5c45cc`를 반환했다.
- 적용 상태: HA 서버 파일 및 HTTP 제공 확인 완료. 화면 모듈만 교체하여 HA 재시작은
  하지 않았다. 브라우저 새로고침 후 차량 카메라 보기 → 텔레포토 원본으로 확인한다.
  실제 사용자 브라우저 적용·Comma 영상 수신·CPL 테두리 확인은 아직 미검증이다.
- 공통 지침 보완: `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`에 pre-release도
  명시적 사용자 승인 후에만 발행하며, 그때 모든 관련 changelog와 Git 이력·diff를
  대조해 직전 pre-release 이후 전체 미발행 변경을 누적한다는 절차를 명확히 기록했다.
- 릴리즈 상태: 새 태그·pre-release·정식 릴리즈 발행 없음. 기존 `v0.8.15` 철회는 유지한다.
  Comma 소스·Worker·D1 배포 없음. 앞선 항목의 HA 반영 보류 상태는 이번 사용자 지시와
  직접 반영으로 갱신되었고 릴리즈 발행 대기는 유지된다.

## 2026-10-21 — 텔레포토 개발 변경 및 잘못 발행한 정식 릴리즈 철회

- 기능 커밋: `03d6f59c129439c3a79b1119ec8bb6032daa4265`.
- 변경/이유: 차량 카메라 보기에 텔레포토 원본 선택을 추가했다. 집에서 CPL 필터
  테두리의 가림을 확인하도록 전체 화각·원본 비율을 보존하고 영상 위 HUD/PTZ를 숨긴다.
  협각은 선택 시에만 디코딩하며 광각·실내 프레임 없이 독립 재생한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-camera-360.js`,
  `tests/camera-360-lifecycle.test.mjs`.
- 검증: 카메라 Python 23건, 카메라 JS 테스트 8건, 대시보드 로딩/상태 보존 10건 통과.
  Chrome PC/모바일에서 합성 영상 네 모서리·비율 보존 및 전환/해제를 확인했다.
  GitHub 전체 회귀 실행 39452806063 및 릴리즈 실행 39452832887은 성공했으나,
  이는 실제 기기 확인이나 사용자 필드 테스트 통과를 의미하지 않는다.
- 배포 오류: 다른 미발행 변경을 포함하는 최신 main에 대해 전체 릴리즈 범위 검토와
  사용자 필드 테스트/정식 발행 지시 없이 `v0.8.15` 정식 릴리즈를 발행했다.
- 철회: 사용자 지시에 따라 해당 GitHub Release와 원격 태그를 삭제했다.
  Release API 404와 원격 태그 부재를 확인했다. 이 작업에서 만든 로컬 태그도 삭제한다.
  manifest를 기능 커밋 이전 값 `0.9.0-beta.1`로 원복하고 잘못 추가한 정식 노트를 제거한다.
  이는 기존 버전 표기 복구이며 새 버전이나 pre-release 발행이 아니다.
- 보존: 텔레포토 기능 커밋, 다른 미발행 변경, 기존 로컬 staged/unstaged 작업은 보존한다.
  main 강제 푸시나 전체 커밋 되돌리기는 하지 않는다.
- 정책: `AGENTS.md`에 HA SSH 개발 반영 → 준비 후 pre-release → 사용자 필드 테스트
  통과 보고와 명시적 정식 발행 지시 후 정식 릴리즈 순서를 전체 HA 작업의 최우선 규칙으로 기록했다.
- 현재 상태: 텔레포토 기능은 Git에만 게시되어 있으며 이 세션에서 HA SSH 반영은 하지 않았다.
  사용자의 추가 보류 지시에 따라 새 pre-release·정식 릴리즈·HA 직접 배포를 진행하지 않는다.
  실제 Comma/CPL 확인은 미검증이다. Comma 소스·Worker·D1 배포는 없다.

## 2026-10-27 — 현재 직접 연결 경로 문서 정리를 위한 코드 조사

- 목적: 폐기된 Cloudflare 중계 설명과 현재 연결을 구분하기 위해 HA 통합·독립 수신기 코드를 읽기 전용으로 대조했다.
- 확인: 상태/일반 주행/파라미터/터미널 bootstrap은 자체 수신기, 터미널·카메라·영상/rlog는 HA Core 경로다. receiver_url이 있으면 해당 주소를 선택하며 실패에 따른 Cloudflare 주소 자동 전환은 없다. cloud_* 파일명·옵션은 현재 수신기 구현과 과거 호환 코드에 함께 남아 있다.
- 관련 파일: addons/carrot_receiver/{receiver.py,config.yaml,DOCS.md}, custom_components/carrot_ha/{cloud.py,cloud_live.py,terminal_bootstrap.py,terminal_http.py,camera_http.py,__init__.py,config_flow.py}, driving_logs/http.py, docs/CLEAN_INSTALL_RECOVERY.md.
- 검증/한계: 로컬 HEAD 3527e6b의 코드·설치 문서 대조. git pull은 FETCH_HEAD 권한 오류로 실패. 지정된 로컬 openpilot 경로가 없어 차량 실행 코드 대조 및 운영 HA/Comma 연결 상태 확인은 하지 못했다.
- 배포 상태: 조사 기록만 추가. 실행 코드·운영 설정·문서 본문 변경, 배포·재시작·태그·릴리즈 없음. 기존 사용자 작업은 유지했다.
- 원격 준비: Comma `5ec4868a12a9038547b373eb95be3a5fa86d30aa`를 carrot-wip-model_selector-ha에 푸시하고 ls-remote 일치 확인. HA CI companion pin을 이 커밋으로 갱신했다. HA 직접 반영 후 사용자 재시작 전까지는 새 Python 정책이 활성화되지 않는다.

## 2026-10-30 — 전송 토글 직접 반영 완료·사용자 재시작 대기

- HA 실행 커밋24d8d9001b90e7aff418afbddb75b5a465d2e0d8 main 푸시. Actions40976946905 전체 success 확인: https://github.com/helico717/carrot-ha/actions/runs/40976946905 . Comma 원격5ec4868a12a9038547b373eb95be3a5fa86d30aa 확인.
- HA 실행4파일을 기존 경로로 직접 반영하고 SHA-256 전부 일치, Python3 compile() 메모리 검사 통과. 백업 /config/carrot_ha/deployment-backups/driving-logs-hud-24d8d9001b90/before 및 상위 DEPLOYMENT.json에 실제 이전 해시·대상 해시·커밋 기록. http.py preflight 차이는 CRLF445개뿐이며 정규화SHA0b921103…가 기준과 일치함을 확인. 배포 도구는 CRLF만 정규화한 기준 해시 일치도 허용하도록 보강했다. 다른 내용 변경은 계속 거부한다.
- 정책 파일은 아직0개이며 새 코드 활성 시 기본OFF. HA Core 재시작·Comma Git Pull/재부팅·실차ON/OFF 검증은 사용자 단계로 남아 있다. 에이전트는 재시작하지 않았고 기존 원본 로그/보관 데이터/원시CAN 설정을 변경하지 않았다. 새 태그·버전·Release 없음.
## 2026-10-30 — 정식 0.9.0 적합성 및 운영 전송 차단 재검증

- 사용자 요청으로 HA 운영 상태를 읽기 전용 확인. 10:10 KST 차량 state API 200, transfer.enabled=false, complete 0, floor 0. 인증된 begin/commit 빈 요청 및 가상 경로 chunk 요청 모두 403 `Driving log transfer disabled or expired`. 설정·재시작·기기 변경 없음. 앞선 구버전 API 잔존 미확인 상태는 이번 실응답으로 해소됐다. ON 전송·실제 Comma 적용은 별도 검증이다.
- Carrot HA 엔트리 loaded/disabled_by=null, 전송 스위치 off. 조회한 최근 Core 로그 100줄에 Carrot 경고/오류 0건. 전체 과거 로그의 무오류를 뜻하지 않는다. 사용자 현재 불만 없음은 실사용 수용 근거로 반영한다.
- Git HEAD b69da6c 기준 통합 파일 322개 대조: 317개 SHA-256 일치, 3개 줄바꿈만 차이, 기본 vehicle.glb 1개 미설치, carrot-vehicle-3d.js 1개 실질 차이. HA 기본 URL은 /carrot_ha_models/vehicle.glb(200), Git은 패키지 모델. 두 모델 해시도 다름. 현재 HA 그대로와 main 발행본은 3D 기본 모델에서 동일하지 않으므로 발행 전 범위를 맞추거나 의도한 차이를 확인해야 한다. 운영 파일 덮어쓰기 없음.
- 최신 실행 코드 9244a4a의 Direct receiver validation 40982887630 success 확인. 현재 manifest 0.9.0-beta.1 유지. 정식 발행 후보로 판단하되 모델 차이 정리·0.9.0 메타데이터/누적 노트 준비는 남음. 버전·태그·Release 발행 없음.

## 2026-10-30 — 패키지 3D 모델과 실제 HA 모델의 내부 일치 검증

- 사용자 요청으로 Git HEAD의 패키지 GLB와 HA `/config/carrot_ha/models/vehicle.glb`, 실제 HTTP `/carrot_ha_models/vehicle.glb`를 읽기 전용 비교. HA 디스크와 HTTP SHA-256 동일(1f3c5488…); 패키지는 61914d35…로 원본 파일 자체는 다르다.
- GLB 바이너리 청크 완전 동일. meshes 135개·nodes 314개·animations 5개·images/textures 각 36개 및 accessors/bufferViews/scenes/extensions 모두 동일. 차이는 재질 45개 중 도장·주황 반사판·유리 2종 총 4개뿐이다.
- 현재 viewer가 실행 중 적용하는 기본 색·도장·유리·반사판 값을 패키지에 미리 저장한 차이임을 기존 viewer 코드와 bake_ha_materials.py로 대조. HA 원본에 bake()를 메모리에서 적용한 결과 2,023,352B 및 SHA-256 61914d356a99a9c6a82e8f303049ce6af0ecdd8411c879b33bb1b1d7983dc7f7로 Git 패키지와 완전 일치했다. 운영 파일·설정 쓰기 없음.
- 판단 정정: 앞선 해시 차이는 다른 형상의 모델이라는 근거가 아니다. 같은 형상/텍스처/애니메이션에 HA 기본 재질을 내장한 모델이다. 현재 viewer의 동일 설정에서 외관을 바꾸는 차이는 확인되지 않았고 모델 해시 차이만으로 정식 발행을 보류할 필요는 없다. 사용자 브라우저 IndexedDB/실제 렌더 픽셀 비교는 수행하지 않았으므로 화면 픽셀 완전 일치를 주장하지 않는다. 버전·태그·릴리즈·배포 없음.


## 2026-11-09 — 대시보드 주행기록 로딩 경로 조사

- 사용자 요청: 주행기록 탭 최신화·로딩 지연의 개선 방법 확인.
- 확인: 한국어·영어 카드 load()는 배터리 이력/dashboard·주행·충전 조회를 Promise.all로 기다린 후 주행 데이터를 반영한다. loadRecentTrips는 최근 8일을 100건씩 순차 조회하며 카드가 보이면 60초마다 다시 실행한다.
- 서버 후보: storage.history의 since 조회는 날짜 JSON 표현식으로 필터·정렬하고, trip 조회마다 기기 전체 trip_derivations를 읽는다. 실제 비용은 운영 데이터로 측정 필요.
- 관련 파일: frontend/carrot-dashboard-ko.js, carrot-dashboard-en.js, carrot-trip-days.js, __init__.py, storage.py.
- 제안: 주행 응답 독립 반영을 우선 검토하고, 페이지별 표시·선택일 상세 조회 및 HA 로컬 revision 기반 재사용을 후속 검토. 수신기 요청 증폭 금지와 선택·스크롤·지도 유지 준수.
- 검증/배포: 코드 정적 조사만 수행. 운영 API/DB 소요시간 미측정, 실행 코드 수정·테스트·커밋·푸시·직접 반영·릴리즈 없음. 기존 공통/차계부 changelog 수정 및 미추적 작업 보존. 작업 트리가 깨끗하지 않아 pull은 수행하지 않음.

## 2026-11-09 — 내 차 대시보드 캐시 없는 첫 로딩 개선

- 사용자 요청을 모든 내 차 탭의 캐시 없는 첫 진입으로 확대. 한국어·영어 카드의 독립 모듈 import를 병렬 실행하고 배터리·주행·충전 응답을 각각 도착 즉시 반영하도록 변경. 화면 디자인·레이아웃·로딩 인디케이터 변경 없음.
- Promise.allSettled로 느린 요청과 부분 실패를 격리하며 모든 이력 요청이 종료되기 전 busy를 풀지 않아 중복 실행 방지. 기존 live 상태·결제 변경 epoch·선택 주행 보존을 유지. 수신기 요청 수/주기 변경 없음.
- 파일: frontend/carrot-dashboard-ko.js, carrot-dashboard-en.js, tests/dashboard-live-loading.test.mjs, tests/dashboard-cold-loading-browser.cjs.
- 검증: Node 로딩/lazy runtime/view-state 14건 통과. 실제 Chromium 한국어·영어 캐시 없는 전체 5탭 접근, 독립 응답 반영 및 비동기 응답 후 2 animation frame 시점의 스크롤·카드 DOM 유지 통과. Python 서버 회귀 검사는 진행 중. 운영 지연 단축 수치 미측정.
- 배포: HA SSH 연결 확인. 실행 코드 커밋·푸시·백업·파일 해시 검증 후 직접 반영 준비 중. 릴리즈/버전 상승·HA/Comma 재시작 없음. 기존 사용자 작업은 분리 보존.


### 2026-11-09 — 첫 로딩 개선 통합 검증

- 원격 main의 주행 통계 패널 cbbdc06을 보존해 병렬 모듈 목록에 통합했다. 모듈 버전 테스트를 병렬 import 및 지연 import에도 적용하고, 통계 연결 테스트가 순차 await 문법에 의존하지 않게 수정했다.
- Node 회귀 27건 통과, 한국어·영어 Chromium 전체 탭과 비동기 갱신 후 스크롤 보존 재검증 통과. Python 서버 회귀는 로컬/번들 런타임에서 진행이 멈춰 통과 여부 미확인(서버 코드 변경 없음). pytest는 설치되지 않음.
- 사용자 기존 공통/차계부 changelog 수정은 별도 백업 후 최신 main에 병합·복구했고 다른 작업을 커밋하지 않았다. HA 직접 반영은 아래 후속 기록으로 확인한다.


### 2026-11-09 — 첫 로딩 개선 HA 직접 반영 완료

- main 게시: 54d79a4(실행 코드), 2d30114760c7d0ad9e96bb78a46f63d63a4332cb(통합 검증). origin/main과 로컬 미푸시 커밋 0 확인.
- HA 사전 검사: cbbdc06 기준 대시보드 ko/en 2파일 모두 일치. scripts/deploy_driving_logs_ha.py로 백업 후 두 파일 반영, 설치 SHA-256 모두 배포 커밋과 일치.
- 백업: /homeassistant/carrot_ha/deployment-backups/driving-logs-hud-2d30114760c7/before. HA/Comma 재시작·릴리즈·태그 없음. 사용자는 대시보드 강력 새로고침으로 적용 가능.
- 운영 브라우저 체감 지연과 실제 네트워크 응답시간은 미측정. Python 서버 회귀 검사는 런타임 진행 정체로 중단하여 미검증으로 남김. 프론트엔드 Node 27건/실제 Chromium 한영 검증 통과.


## 2026-11-09 — 운영 대시보드 10초 이상 로딩 실측 조사

- 사용자가 캐시 없는 충전 탭에서 10초 이상 로딩을 보고했고 날짜 클릭과 무관하게 실제 지연임을 재확인했다. 앞선 독립 응답 반영만으로 운영 조회 시간을 줄이지 못한 한계를 기록한다.
- scripts/profile_dashboard_readonly.py로 HA 설치 코드의 배터리/충전/주행 연산을 읽기 전용 SQLite 연결로 측정한다. Archive 초기화·마이그레이션·파생 갱신을 실행하지 않고 기존 파생값을 사용한다. 원본 위치·이벤트·토큰을 출력하지 않는다.
- 운영 대상 DB 414,400,512 bytes, state 29,300 / charge 74 / trip 349 확인. 개별 연산 소요시간은 후속 기록 예정. 운영 코드/DB 변경·재시작·발행 없음.

## 2026-11-09 — 배터리·충전 이력 실제 조회 병목 개선

- 운영 실측(읽기 전용): 414.4MB DB/state 약 29,300건에서 배터리 14일 이력 39.571초(재측정 36.480초), 충전 목록 0.111초, 충전 SOC 보정 21.612초. SQLite 잠금 오류도 관측했다. 화면 독립 반영만으로 해결되지 않는 서버 병목이다.
- 전체 상태 본문 대신 필요한 필드만 SQL로 추출한 중간 후보는 운영 메모리 실행에서 17.874초였으나 충분하지 않아, 최종 후보는 SQLite 표현식 인덱스 events_state_calculation_v1에 작은 계산 필드를 유지하도록 변경했다. 원본 이벤트·GPS·에너지 값 변경 없음. 별도 원격 DB DDL은 실행하지 않는다.
- 배터리 이력과 충전 SOC 보정이 공유 인덱스를 이용해 큰 본문 접근을 피한다. 충전 조회에는 UTC 텍스트 범위와 기존 julianday 판정을 함께 적용해 경계 의미를 보존한다. 압축 이벤트·필드 누락/명시 null/boolean·지역 시간대·갱신/롤백을 검증했다.
- 관련 파일: custom_components/carrot_ha/state_projection.py, storage.py, battery_history.py, tests/test_state_projection.py, scripts/profile_dashboard_readonly.py.
- 검증: projection 4건, 표시 SOC/주행 에너지 31건, 충전 SOC 6건, 충전 그래프 29건, 결제 12건 통과. SQLite bytecode에서 원본 테이블 본문을 읽지 않음 확인. 기존 DB 인덱스 생성 전후 원본 행 동일 확인. 압축 8건은 Windows 미수거 SQLite 핸들 때문에 기본 teardown 2건 실패, teardown 전에 gc.collect를 적용한 검증 실행은 8건 통과(제품/테스트 파일 수정 없음).
- 필수 서버 회귀 cloud_live/incremental_sync/history_cache/direct_receiver 26건은 aiohttp가 있는 기존 .receiver-venv에서 통과. 이전 asyncio 정체는 sandbox socketpair 생성에서 확인되어 로컬 서버 허용 실행으로 해소했다. Node 로딩/lazy/view-state 14건 통과.
- 배포: 검증·커밋·푸시 후 HA 코드 백업/해시 확인 예정. 새 인덱스 생성과 Python 코드 적용은 사용자 HA 재시작 필요. 초기 인덱스 구축 시간과 최종 운영 소요시간·잠금 재발 여부는 미검증. 새 릴리즈/태그 발행 없음.


### 2026-11-09 — 이력 조회 최적화 코드 HA 반영·재시작 대기

- aa0213152ffc2889d4405dbc35c6045013441bd6 main 게시, 미푸시 0. HA 기존 코드 3파일 사전 검사 통과 후 백업·반영, 설치 SHA-256 모두 일치.
- 백업: /homeassistant/carrot_ha/deployment-backups/driving-logs-hud-aa0213152ffc/before. HA 재시작·운영 인덱스 수동 생성은 실행하지 않음. 사용자 HA 재시작 시 Archive 초기화에서 인덱스가 생성된다. 최종 운영 속도·인덱스 크기·잠금 감소는 재시작 후 측정 필요. 릴리즈·태그 없음.


## 2026-11-09 — 첫 진입 추가 경량화·충전 탭 선택 유지

- 사용자: 재시작 후에도 첫 진입 10~15초, 충전 탭을 보던 중 갱신 시 내 차 탭으로 이동 보고. 첫 표시 5초 목표는 아직 운영에서 미달이다.
- 운영 읽기 전용 재측정: 배터리 이력 2.771초, 충전 목록 0.017초/SOC 보정 1.043초, 주행 목록 0.220초/보정 0.074초. 인덱스 적용 전 36~40초/21.6초 대비 서버 계산 단축 확인. 이는 브라우저 전체 응답시간 측정은 아니다.
- 첫 데이터가 준비되기 전 자동 3D 모델 warmup/뷰어와 내 차 미니지도 스크립트 요청을 보류하고 기존 정적 차량 이미지를 유지한다. 카메라 78KB 모듈은 실제 열기 요청 시 로드하며 다운로드 중 주행 전환·카드 분리 시 열지 않는다. 필수 모듈 4개만 버전된 modulepreload로 병렬 요청해 구현 파일 이후 추가 다운로드 왕복을 줄인다. 수신기 조회 주기·배터리 측정·계산 변경 없음.
- HA 갱신 중 locale 누락 시 현재 언어를 유지해 불필요한 카드 교체를 방지한다. 선택 탭/주행·충전 날짜/배터리 페이지를 경로·차량·카드 설정별 sessionStorage에 보존·복구해 카드 재생성 때 overview로 초기화되는 경로를 막는다. 저장소 접근 실패는 기존 동작으로 fallback한다.
- 파일: frontend/carrot-dashboard-ko.js, carrot-dashboard-en.js, carrot-dashboard-runtime.js, tests/dashboard-lazy-runtime.test.mjs, tests/dashboard-cold-loading-browser.cjs. 시각 디자인/레이아웃 변경 없음.
- 검증: Node 로딩·lazy runtime·view-state·의존 버전·통계·카메라 lifecycle 34건 통과. 한영 Chromium에서 초기 선택 자산 요청 없음(Leaflet CSS는 유지), 충전 탭 비동기 응답/카드 재생성 후 유지, 스크롤/DOM 유지, 카메라 다운로드 중 주행 interlock 통과. 별도 camera-360.test.mjs는 수정하지 않은 debug 모듈 VM 하네스의 CRLF/import.meta 및 export 처리 오류로 실패하여 전체 통과로 보고하지 않는다.
- 배포: main 커밋·푸시 및 HA 기존 파일 검사·백업·해시 검증 후 직접 반영 예정. 프론트엔드만 변경하므로 HA 재시작은 필요 없다. 사용자 네트워크의 시크릿 모드 5초 달성·탭 이동 증상 재발 여부는 반영 후 확인 필요. 릴리즈/태그 없음.


### 2026-11-09 — 첫 진입 경량화·탭 유지 HA 직접 반영 완료

- 실행 코드 72a6af92dff0fde2177292569e2c8747c62d4812 main 게시. HA ko/en/runtime 3파일은 기준 0261f9f와 사전 일치 확인, 백업·반영 후 SHA-256 모두 일치.
- 백업: /homeassistant/carrot_ha/deployment-backups/driving-logs-hud-72a6af92dff0/before. HA/Comma 재시작·릴리즈·태그 없음. 브라우저 강력 새로고침으로 새 프론트엔드를 적용한다. 사용자 회선의 첫 표시 5초 달성과 탭 강제 이동 실사용 재발 여부는 미확인이다.
