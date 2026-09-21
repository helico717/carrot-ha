# Carrot HA — Volkswagen MEB

한국어 | [English](README.en.md)

Carrotpilot이 실행 중인 콤마에서 차량 정보를 수집하여 Cloudflare에 저장하고 Home Assistant에서 확인합니다. 주행 경로, 배터리 잔량, 충전 추정 기록, 최근 7일 배터리 그래프를 제공합니다. 차량 원격 제어 기능은 없습니다.

ID.4에서 사용한 구현을 일반화한 버전입니다. ID. Buzz 등 다른 MEB 차량과 모든 Carrotpilot 브랜치의 호환성을 보장하지 않습니다. HA 2026.3 이상이 필요하며 다른 차량은 아래 사전 확인을 거치세요. 현재 대시보드 API는 HA 관리자 계정만 사용할 수 있습니다.

## 사용 가이드

[대시보드·엔터티 상세 가이드](docs/GUIDE.md)에서 상태 배지의 문구·색상, 각 탭의 값, 모든 센서·위치 엔터티, 충전 추정과 미확인 값의 의미를 확인하세요.


콤마를 플래싱하거나 재설치했나요? [Windows/Mac 수집기 복구 가이드](docs/REINSTALL.md)에서 연결 정보 분실 대처와 HA 보고 검증까지 확인하세요.

## 처음 설치

1. [설치 안내](docs/INSTALL.md)에 따라 개인 Cloudflare 서버와 콤마 수집기를 준비합니다.
2. HACS → 오른쪽 위 메뉴 → Custom repositories에서 `https://github.com/helico717/carrot-ha`를 추가합니다. 유형은 **Integration**입니다.
3. Carrot HA를 다운로드하고 HA를 재시작합니다.
4. 설정 → 기기 및 서비스 → 통합 추가 → Carrot HA. 정해둔 장치 ID와 전용 토큰을 입력합니다.
5. 통합의 구성에서 Worker 주소, 읽기 토큰, 차량 모델, SOC 계산 용량을 입력합니다. 배터리 용량은 차량별로 확인하세요.
6. 대시보드 리소스에 `/carrot_ha_static/carrot-dashboard.js`을 **JavaScript 모듈**로 추가합니다.
7. 수동 카드에 다음을 입력합니다. 장치 ID는 통합과 콤마에 입력한 값과 같아야 합니다.

```yaml
type: custom:carrot-dashboard-card
device_id: my-meb
vehicle_name: ID. Buzz
# 본인 차량 이미지를 HA /config/www/에 넣은 경우:
# vehicle_image: /local/my-car.png
```

기본 이미지는 Carrot HA 아이콘입니다. 이미지 파일은 본인이 사용할 수 있는 것으로 준비하세요. 차량 상태 엔터티는 통합에서 자동으로 찾으므로 `test_id4` 같은 이름에 의존하지 않습니다. 필요하면 `charging_entity`, `online_entity`를 카드에 명시할 수 있습니다.

## 다른 MEB 차량

- Carrotpilot이 해당 차량에서 정상 작동하는 상태에서 시작합니다.
- `vw_meb` DBC와 수집기가 요구하는 CAN 메시지가 있어야 합니다. 설치기가 형식 확인을 하지만 실차 값의 정확성까지 검증하지는 않습니다.
- 주차 상태에서 SOC·총 주행거리·외기온을 실제 표시와 비교합니다. 짧은 주행 및 충전 후 기록을 확인합니다.
- ID. Buzz의 배터리 용량을 ID.4와 같다고 가정하지 마세요. 옵션의 SOC 계산 용량을 차량에 맞게 설정합니다.
- 충전 전력은 에너지 증가량으로 추정하며 완속/급속 구분도 추정입니다. 충전기 계량값이 아닙니다.
- 인터넷이 끊겨도 수집된 미전송 기록은 재전송합니다. 전원 꺼짐 또는 CAN 미수신 구간은 복원할 수 없습니다.

## 개인정보

사용자마다 본인의 Cloudflare 계정/서버를 사용합니다. 이 저장소로 토큰, DB, 주행 경로, 로그, 연결 설정을 올리지 마세요. 운영자는 사용자들의 데이터를 모으는 공용 서버를 제공하지 않습니다.

## 출처

Cloudflare 및 CAN 참조 코드: `cloudflare/SOURCE.md`, `cloudflare/LICENSE.upstream`, `collector/LICENSE.reference`.
지도: Leaflet 및 OpenStreetMap. 지도 출처 표시는 유지해야 합니다.
첨부 브랜드 이미지: 프로젝트 소유자가 제공한 이미지입니다. Carrotpilot·Volkswagen·Home Assistant의 공식 제품이나 공식 인증 통합이 아닙니다.

## 대시보드 언어

HA 사용자 언어가 한국어이면 한국어, 그 외에는 영어로 표시합니다. 카드 설정에 `language: en` 또는 `language: ko`를 넣으면 고정할 수 있고 `language: auto`는 HA를 따릅니다. HA 기기 페이지의 엔터티 이름은 변경하지 않습니다.
