> 현재 연결: Comma → 자체 수신 앱 → HA. [초기화 후 복구 안내](docs/CLEAN_INSTALL_RECOVERY.md).

# Carrot HA — Volkswagen MEB

한국어 | [English](README.en.md)

Carrotpilot이 실행 중인 콤마에서 차량 정보를 수집하여 집 서버의 차량 수신 앱 Home Assistant에서 확인합니다. 주행 경로, 배터리 잔량, 충전 추정 기록, 14일 단위 배터리 이력를 제공하며, 당근파일럿의 모든 파라미터를 원격으로 확인·조절하고 공식 Wiki 상세 설명을 열람할 수 있는 파라미터 튜닝 카드를 지원합니다. (주행/도어 등 실차 원격 제어 기능은 없습니다.)

ID.4에서 사용한 구현을 일반화한 버전입니다. ID. Buzz 등 다른 MEB 차량과 모든 Carrotpilot 브랜치의 호환성을 보장하지 않습니다. HA 2026.9 이상이 필요하며 다른 차량은 아래 사전 확인을 거치세요. 현재 대시보드 API는 HA 관리자 계정만 사용할 수 있습니다.

## 사용 가이드

- [개발 및 배포 워크플로우 가이드](docs/DEVELOPMENT_WORKFLOW.md) / [AI 에이전트 개발 지침 (AGENTS.md)](AGENTS.md): **필독**. 2개 저장소 분리 아키텍처 및 Comma Git 기반 배포 원칙 (SSH 수동 파일 조작 금지).
- [원격 터미널 설정 가이드](docs/TERMINAL_SETUP.md): 셀룰러 연결에서도 주차 중 Home Assistant에서 Comma 터미널을 열고 원클릭 Git Pull 및 재부팅을 수행하는 방법.
- [대시보드·엔터티 상세 가이드](docs/GUIDE.md): 상태 배지의 문구·색상, 각 탭의 값, 모든 센서·위치 엔터티, 충전 추정과 미확인 값의 의미.
- [파라미터 원격 제어 설정 가이드](docs/COMMA_PARAM_SETUP.md): HA에서 당근파일럿 설정을 원격 튜닝하는 방법과 안전 정책.
- [파라미터 동기화 아키텍처 및 안전 정책](docs/PARAMETERS_0_6_1.md): 큐 ID 기반 적용 확인, 로컬 서버 유효성 검증, 우회 쓰기 배제 정책.
- [Windows/Mac 수집기 복구 가이드](docs/REINSTALL.md): 콤마를 플래싱하거나 재설치했을 때 연결 정보 복구 절차.
- [주차 카메라 설치·테스트](docs/CAMERA_SETUP.md): 실험적 광각·실내 camera 엔터티, 별도 콤마 서비스와 HTTPS 영상 연결.

## 처음 설치·초기화 복구

[쉬운 설치·복구 안내](docs/CLEAN_INSTALL_RECOVERY.md)를 따릅니다. HAOS 수신 앱 설치, HA 설정, Windows/Mac Comma 연결 명령을 포함합니다.

## 다른 MEB 차량

- Carrotpilot이 해당 차량에서 정상 작동하는 상태에서 시작합니다.
- `vw_meb` DBC와 수집기가 요구하는 CAN 메시지가 있어야 합니다. 설치기가 형식 확인을 하지만 실차 값의 정확성까지 검증하지는 않습니다.
- 주차 상태에서 SOC·총 주행거리·외기온을 실제 표시와 비교합니다. 짧은 주행 및 충전 후 기록을 확인합니다.
- ID. Buzz의 배터리 용량을 ID.4와 같다고 가정하지 마세요. 옵션의 SOC 계산 용량을 차량에 맞게 설정합니다.
- 충전 전력은 에너지 증가량으로 추정하며 완속/급속 구분도 추정입니다. 충전기 계량값이 아닙니다.
- 인터넷이 끊겨도 수집된 미전송 기록은 재전송합니다. 전원 꺼짐 또는 CAN 미수신 구간은 복원할 수 없습니다.

## 개인정보

사용자마다 본인의 집 서버의 차량 수신 앱 계정/서버를 사용합니다. 이 저장소로 토큰, DB, 주행 경로, 로그, 연결 설정을 올리지 마세요. 운영자는 사용자들의 데이터를 모으는 공용 서버를 제공하지 않습니다.

## 출처

집 서버의 차량 수신 앱 및 CAN 참조 코드: `cloudflare/SOURCE.md`, `cloudflare/LICENSE.upstream`, `collector/LICENSE.reference`.
지도: Leaflet 및 OpenStreetMap. 지도 출처 표시는 유지해야 합니다.
첨부 브랜드 이미지: 프로젝트 소유자가 제공한 이미지입니다. Carrotpilot·Volkswagen·Home Assistant의 공식 제품이나 공식 인증 통합이 아닙니다.

## 대시보드 언어

HA 사용자 언어가 한국어이면 한국어, 그 외에는 영어로 표시합니다. 카드 설정에 `language: en` 또는 `language: ko`를 넣으면 고정할 수 있고 `language: auto`는 HA를 따릅니다. HA 기기 페이지의 엔터티 이름은 변경하지 않습니다.
