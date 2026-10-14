# 당근웹 로그 UI 원본

openpilot commit: `baf47a6facfe692bf27b1084931b7dd04ea39f40`

`openpilot/selfdrive/carrot/web/`의 로그 HTML·생성된 UI/로그 번들·스타일을 재사용한다.
생성 로그 번들의 파일 URL 함수만 HA 장치 범위 URL 변환기로 연결한다.
추가 브리지와 카드의 API는 HA 로컬을 사용한다.

리플레이는 같은 고정 커밋의 replay client/workers·insights·HTML/CSS를 사용한다.
정적 worker 경로와 원본 입력 조회 주소를 HA 범위로 바꾸고, 등록 이름을 전용 runtime으로 분리한다.
라이브 차량 연결 없이 기록만 재생하는 `ha_replay_loader.js`가 화면·상태를 연결한다.
기록 수치 HUD는 HA 어댑터로 표시한다. 원본 Carrot Vision의 GPU 차선/AR 오버레이 전체 연결은 별도 작업이다.
