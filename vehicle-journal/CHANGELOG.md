# 차계부 변경 이력

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
