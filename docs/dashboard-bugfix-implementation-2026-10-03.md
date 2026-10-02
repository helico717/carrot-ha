# 주행 기록 및 충전 ETA 버그 수정 — 2026-10-03

## 변경

- 주행 탭의 빈 날짜/좌표 없는 주행은 현재 주차 위치를 표시하지 않는다. 위치 탭은 기존 동작을 유지한다. 지도 로딩 중 선택이 바뀌면 이전 비동기 결과를 버리고, 과거 주행 지도는 live 차량 좌표 변화에 재생성하지 않는다.
- 개별/병합 기록은 현재 SOC, 반대 경계 SOC, 최근/월간 전비, 고정 6.0으로 결측을 채우지 않는다. SOC/전비 결측은 기존 알약 형태의 붉은 표시로 남긴다. 순회생/순소비 없음은 별도 의미로 표시한다.
- 병합 SOC는 엄격히 첫 시작/마지막 종료를 따른다. 전체 구성 주행의 측정 에너지가 있을 때만 전체 거리/합계 에너지로 전비를 계산한다. 정차 에너지를 섞거나 부분 에너지로 전체 거리를 나누지 않는다. 기본 30분, 개별 보기, 날짜 경계 및 기존 충전 불연속 방지는 유지한다.
- 과거 경계 SOC 복구를 에너지 검증에서 분리했다. 신선한 당시 경계 측정값을 파생 기록에 영속화하며 retention 이후에도 유지한다. SOC만으로 Wh를 만들어 측정 전비를 계산하지 않는다. 잘못된 용량/Wh를 역사 SOC 100%로 강제 clamp하지 않는다.
- 같은 충전 세션에서 일시적인 raw 전력 결측/양자화 0이면 마지막 유효 ETA를 최대 180초 유지한다. 완료시각 기준 남은 시간을 계산하고 유지 상태를 UI 및 ETA 센서 속성으로 제공한다. 반복 조회는 TTL을 연장하지 않는다. 충전 종료/주행/stale/용량·세션 변경/명백한 측정 이상/만료 시 무효화한다. held 전력을 모델 학습에 넣지 않는다.
- Comma 수집기는 telemetry 업로드 간격과 독립적으로 trip 경계 SOC/Wh와 품질을 저장한다. 재시작/측정 공백/이상값은 energy complete로 오인하지 않는다. Worker는 한 trip 행에 제한된 측정 JSON을 보존하며, metadata만 바뀌어도 증분 revision을 올린다. 기존 read query 수와 KV 쓰기 정책은 유지한다.

## 소급 적용과 배포 경계

HA 새 코드 시작 후 파생 기록을 재계산하고, 기존 history API도 같은 결과를 표시한다. 당시 원측정이 없는 기록은 복구 숫자를 생성하지 않는다. 운영 SQLite DB/Comma/Worker 배포는 수행하지 않았다. 첨부 원격 마운트 DB의 전체 backup replay는 접근 지연으로 완료하지 못했으며, 실제 전체 복구 건수는 아직 미검증이다.

후속 배포에서는 기존 incremental migration이 적용된 D1에 `cloudflare/migration_trip_measurements.sql`을 **한 번**, Worker보다 먼저 적용한다. 이후 Worker → HA → Git 관리 Comma 수집기를 업데이트한다. HA/Comma만 업데이트하면 새 trip 경계 데이터 저장 경로가 완성되지 않는다. 사용자 요청대로 이번 작업은 commit/push까지만 수행하며 manifest 변경/태그/릴리스/배포는 하지 않는다.

## 검증

- carrot-ha Python suite: 191 tests, 통과(2 skipped). cloud live, incremental sync, history cache, auth/isolation, trip/charge, camera interlock 포함.
- 관련 Node gates: 32 tests 통과. live/lazy/view state, trip history/병합/결측, camera lifecycle 및 driving interlock.
- 전체 Node suite: 45/47 통과. 기존 실패 2건은 수정 전 HEAD에서도 재현: `motion-status.test.mjs`의 parked/unknown 기대 불일치, `range-c3-and-fixes.test.mjs`의 prerelease를 허용하지 않는 버전 정규식. manifest는 기존 `0.8.8-beta.3` 유지.
- Worker incremental test: 측정 필드 보존, metadata-only revision, 중복 재전송, 기기 격리, 단일 증분 read 및 기존 D1 schema migration 검증. history/auth test 통과.
- Worker benchmark: unchanged incremental 1 request/1 query/81 bytes (기존 100 trips × 1000 points fixture). 운영 quota 보장은 아님.
- 변경된 Comma engine을 사용한 기존 recorder tests: 25 tests 통과. 새 trip 경계 tests 및 필수 param polling tests: 6 tests 통과.
- Comma 전체 daemon suite(현대 Python runtime): 51 tests 중 기존 camera upgrade 실패 2건. 변경되지 않은 카메라 코드의 `encode_media` 부재와 PyAV compatibility 기대 불일치. Python 3.9에서는 기존 asyncio.timeout 미지원까지 추가되므로 현대 runtime으로 구분 검증했다.
- 실제 Chrome: 비동기 refresh 완료 후 후속 animation frames까지 scrollTop 129→129, 동일 ha-card DOM 유지. light/dark 붉은 알약, 기존 6px 모서리, 모바일 크기 확인. 빈 주행 지도는 현재 주차 마커 없이 결측 설명 표시.

실차 수집/새 Worker/HA 설치 버전 및 24시간 운영 관측은 배포 후 확인할 항목이다.
