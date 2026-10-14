> **2026-10-14 서버 경로 변경:** Cloudflare Worker/D1/KV 관련 설치·배포·한도 설명은 폐기된 과거 기록입니다. 관련 코드 블록을 현재 설치에 실행하지 마세요. 현재 절차: [직접 수신기 설치·복구](../../../../docs/CLEAN_INSTALL_RECOVERY.md). 과거 장애 증거·기록 ID는 보존합니다.

# 당근웹 로그 UI 원본

openpilot commit: `baf47a6facfe692bf27b1084931b7dd04ea39f40`

`openpilot/selfdrive/carrot/web/`의 로그 HTML·생성된 UI/로그 번들·스타일을 재사용한다.
생성 로그 번들의 파일 URL 함수만 HA 장치 범위 URL 변환기로 연결한다.
추가 브리지와 카드의 API는 HA 로컬을 사용한다.

리플레이는 같은 고정 커밋의 replay client/workers·insights·HTML/CSS를 사용한다.
정적 worker 경로와 원본 입력 조회 주소를 HA 범위로 바꾸고, 등록 이름을 전용 runtime으로 분리한다.
라이브 차량 연결 없이 기록만 재생하는 `ha_replay_loader.js`가 화면·상태를 연결한다.
`scripts/build_replay_renderer.py`는 같은 커밋의 원본 GPU 렌더러·HUD·상태 해석과 ES 모듈 의존성·아이콘·폰트를 가져온다.
기록 데이터를 원본 렌더러에 연결해 모델 경로·차선·도로 경계·선행 차량 및 HUD를 표시한다.
라이브 소켓·실차 설정 쓰기는 비활성화한다. 별도 AR 내비게이션 표지 활성화는 이번 범위 밖이다.

`scripts/build_logs_upload_port.py`는 같은 커밋의 `web_upload.py`와 서버 결과 포매터를
`driving_logs/upstream_upload*.py`로 가져온다. HA 작업 수명·인증·보관 파일 선택만 어댑터에서 담당한다.
