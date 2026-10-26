> **2026-10-14 서버 경로 변경:** Cloudflare Worker/D1/KV 관련 설치·배포·한도 설명은 폐기된 과거 기록입니다. 관련 코드 블록을 현재 설치에 실행하지 마세요. 현재 절차: [직접 수신기 설치·복구](CLEAN_INSTALL_RECOVERY.md). 과거 장애 증거·기록 ID는 보존합니다.

# 충전 표시 및 주차 GPS 수정 — 2026-10-11

HA 0.8.14-beta.2 운영 DB를 읽기 전용으로 확인했다. 좌표·인증 정보는 기록하지 않는다.
10월 10일 한국 시간 17:00~23:17 충전은 37.7kWh, 상태 377건에 BMS mode=4와 charging=true가 남았다. GPS는 16:58:37에서 멈췄으나 마지막 속도 약 6.5km/h가 충전 표시를 차단했다. 주행 종료 16:59:27과 경로 끝 16:58:36이 존재해도 parking은 15:08:15를 유지했다. 17시 이후 상태 966건이 수신되어 통신 단절만으로 설명할 수 없다.

수정: 30초 이내 GPS만 현재 속도로 사용. 실제 주행 중 충전 표시 차단 유지. 유효 주차 후보의 기록 시각 비교로 최신 후보 선택. 주행 마지막 GPS 사용 시 추정 표시 및 GPS 측정 시각 분리. 정상 주차 GPS가 더 최신이면 추정 해제. 운영 DB·~~Worker~~·Comma 변경과 cloud 조회 증가는 없다.

검증: 위치 Python 4, 양 언어 화면 4, 대시보드 loading/lazy/view-state/dependency/trip 포함 25, cloud live 6, incremental 5, history cache 1, CAN charging 8, power/lock 9, emergency 3, smoothing 36, Comma parameter polling 4 통과. ~~Worker~~ benchmark 기존 1요청/1쿼리 경로 유지.
기존 검사 제약: ~~Worker~~ incremental의 LF 전용 schema replace가 Windows CRLF에서 실패하여 measurements_json 중복 컬럼 오류. camera-360 테스트 기존 vm의 import.meta 오류. 해당 소스 변경 없음. camera lifecycle 3건 통과.

배포: 2026-10-11 21:02 KST main 및 v0.8.14-beta.3 태그 f348766521355922a9ee53f46f2abbd212224a0b 푸시. GitHub prerelease=true 및 릴리스 노트 확인. HACS Release Actions 성공: https://github.com/helico717/carrot-ha/actions/runs/38137787339 . 릴리스: https://github.com/helico717/carrot-ha/releases/tag/v0.8.14-beta.3 . HACS 설치·HA 재시작 후 실차 확인은 남아 있다.
