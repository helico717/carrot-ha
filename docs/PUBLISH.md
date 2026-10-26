# 개발·배포 담당과 현재 구성

현재 운영: Comma → 자체 HAOS 차량 수신 앱 → HA. Cloudflare 경로는 폐기된 참고 구현입니다.
HA Core를 재시작해도 수신 앱은 동작합니다. 기기 전체 전원·회선 장애는 분리되지 않습니다.

| 수정 대상 | 저장소 / 위치 | 배포 |
| --- | --- | --- |
| HA 통합·화면 | helico717/carrot-ha / custom_components/carrot_ha | 검증·main 푸시·새 HACS Release, 사용자가 설치/HA 재시작 |
| 독립 수신 앱 | 같은 저장소 / addons/carrot_receiver | 앱 버전 갱신·검증·푸시, 앱 스토어 업데이트 |
| 차량 수집기·카메라·터미널 | helico717/openpilot / carrot-wip-model_selector-ha | 검증·커밋·푸시, 사용자가 clean Git Pull/재부팅 |
| 문서 | 해당 저장소 | 검토·커밋·푸시, 실행 코드 변경 없으면 불필요한 버전 상승 없음 |

Comma 소스는 SSH/SCP/터미널로 직접 복사·편집하지 않습니다. 설정은 Git에 들어 있는
설정 프로그램을 사용하고 저장 위치는 Git 바깥입니다. 사용자 데이터·키는 커밋하지 않습니다.
주행 로그/차계부 변경은 해당 AGENTS와 CHANGELOG 지침을 따릅니다.

2026-10-14 사용자가 전체 요청 반영 후 **v0.9.0-beta.1** 발행을 명시했습니다.
이 지시는 이전 0.8.x 유지 및 발행 대기 지침보다 우선합니다. 새 태그를 만들고 기존 태그는 덮어쓰지 않습니다.
릴리즈 노트에는 이전 베타를 포함한 누적 변경과 검증/운영 대기를 구분합니다.
Worker 배포·D1 변경은 이 직접 수신기 배포에 필요하지 않습니다.

설치·복구: [안내](CLEAN_INSTALL_RECOVERY.md). 폐기된 배포 명령:
[과거 자료](archive/cloudflare-guides-before-direct-receiver.md) — 실행 금지.
