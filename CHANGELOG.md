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
