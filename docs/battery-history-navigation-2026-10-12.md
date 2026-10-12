# 배터리 기록 이전 주 조회 — 2026-10-12

요청: 배터리 사용량 카드 우측 상단의 미니멀 `< >` 버튼으로 7일 이전 기록 조회. 이동 한계에서 회색·흐림·비활성 처리.

원본 SOC/state 보관은 기존 14일 그대로다. battery_history.py 계산 범위를 14개 HA 현지 날짜로 확장했다. history_cache.py 공유 계산과 live 독립 경로는 유지한다. 한국어/영어 카드가 7일 창을 선택하고, 원본 배열 인덱스 및 날짜로 시간별 SOC와 충전 기록을 연결한다. 페이지 변경은 로컬 렌더만 수행한다. 월별 충전 집계에는 영향을 주지 않는다. 차계부/Worker/D1/Comma 소스는 변경하지 않는다.

검증: Node 대시보드 30개, Python 관련 회귀 39개, Worker incremental 테스트와 benchmark 통과(unchanged incremental 1 query / 81 bytes). Comma param polling 4개 통과. Chromium 합성 데스크톱/390px 모바일에서 `< >` 순서, 이동 경계 disabled, 날짜 선택, 넘침 없음 확인. 비동기 갱신 및 2 animation frames 후 scrollY 250 유지, 동일 ha-card DOM 및 선택 날짜 유지. 합성 화면 검증이며 실제 HA 설치는 아직 수행하지 않았다.

배포: manifest 0.8.14, release notes v0.8.14. GitHub main/태그 및 Release Action으로 발행하며 사용자 설치는 HACS 업데이트 후 HA 재시작. Worker/D1/Comma 배포 없음.
