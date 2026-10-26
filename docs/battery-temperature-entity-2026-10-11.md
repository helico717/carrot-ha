> **2026-10-14 서버 경로 변경:** Cloudflare Worker/D1/KV 관련 설치·배포·한도 설명은 폐기된 과거 기록입니다. 관련 코드 블록을 현재 설치에 실행하지 마세요. 현재 절차: [직접 수신기 설치·복구](CLEAN_INSTALL_RECOVERY.md). 과거 장애 증거·기록 ID는 보존합니다.

# 배터리 온도 대표 엔터티 — 릴리즈 대기

후속 요청: 터미널 커밋 표시와 함께 `0.8.14-beta.4` pre-release 발행으로 전환한다.

사용자 요청: 대표 배터리 온도 엔터티를 추가하고 기존 최고·최저 온도를 세부 속성으로 제공한다. 다른 수정과 함께 발행할 예정이므로 이번 작업에서는 manifest 버전·태그·GitHub Release를 만들지 않는다.

## 표시와 호환성

- `battery_temperature_c`, 이름 **배터리 온도**, 단위 °C, 소수1자리. BMS 대표값이며 최고·최저 평균이 아니다.
- 세부 속성: `min_temperature_c`, `max_temperature_c`, 각 `*_temperature_measured_at`, `*_temperature_stale`, `extrema_can_id`.
- 대표·최고·최저는 별도 CAN 메시지/시각이다. 각각 180초 유효기간을 적용하며 오래되거나 미수신인 값은 null로 표시한다. 대표값이 만료되더라도 아직 유효한 극값은 속성에 유지한다.
- 기존 최고·최저 엔터티는 ID를 보존하고 최초 마이그레이션 때 통합에 의해 비활성화한다. 사용자에 의해 이미 비활성화된 상태는 유지하며, 이후 사용자가 다시 활성화한 엔터티는 다음 재시작에 재비활성화하지 않는다. 새 설치에서는 두 엔터티가 기본 비활성화된다.

## CAN와 전달 경로

Comma `openpilot/selfdrive/carrot/ha/telemetry_fields.py`와 수신 루프에 `0x1A555551`을 추가한다. 검증한 물리bus1, 정확히8byte, byte5×0.5−40°C. raw254/255는 초기/무효로 null을 보내 기존 값을 지운다. 기존 패킷 수신 시각 기반 `field_measured_at` 경로를 사용하며 새 CAN 송신/스레드/주기/클라우드 조회는 추가하지 않는다.

근거: [전체 보존 CAN 분석](https://github.com/helico717/meb-can-research/blob/main/docs/raw-can-expanded-audit-2026-10-11.md), 354,149유효 프레임 15.5~35.5°C, 초기48건. [공개 BMS 수신 구현](https://github.com/dalathegreat/Battery-Emulator/blob/main/Software/src/battery/MEB-BATTERY.cpp). OEM 계기·독립 온도계 대조는 미완료이며 이를 엔터티 validation 속성에 명시한다. 미수신 대표값을 최고/최저 평균으로 대체하지 않는다.

Worker는 기존 동적 텔레메트리 전달을 사용한다. Worker/D1·대시보드·차계부 변경 및 배포는 없다. `collector/`와 `dist/`의 레거시 사본은 변경하지 않는다.

## 검증·배포 상태

- HA 새 센서/속성/독립 만료/기본 활성 상태 및 기존 마이그레이션 후 일회성 비활성화/사용자 재활성화 보존 테스트 추가.
- Comma 디코더 sentinel/길이/단위·수신시각/오래된 응답 거부·null 초기값 처리 테스트.
- 초기 Windows sandbox TEMP의 SQLite 접근 실패는 쓰기 가능한 테스트 임시 디렉터리로 변경하여 재실행했다. 차량·HA 장애가 아니다.
- HA 관련29테스트 통과. Comma 전체 데몬63개 중60개 통과. 기존 카메라 probe/upgrade 2개는 Windows에 `fcntl`이 없어 import 오류, upstream sync 1개는 Bash의 Windows 경로 해석 오류로 실행 불가. 수정 경로인 배터리 디코더/엔진·기존 충전·수집·parameter polling 테스트는 통과했다. 미변경 플랫폼 전용 테스트를 통과로 주장하지 않는다.
- Git 커밋·푸시 후 릴리즈 대기. 실제 Comma 업데이트·재부팅과 HA 설치는 수행하지 않음. HACS는 신규 릴리즈 전에는 이 변경을 내려받지 못한다. 다음 묶음 릴리즈 때 Comma와 HA 양쪽을 함께 적용한다.
