# 주행 로그 변경 기록

## 2026-10-14 — 애드온 진단 로그 범위 검토

- 사용자 질문: 추후 troubleshooting을 위해 애드온 로그 화면에 모든 로그를 표시하는
  방향의 장단점. 이번 요청은 설계 상담이며 구현 요청으로 확대하지 않는다.
- 현재 receiver.py는 access_log=None, 오류 종류/시간별 정리만 logging 출력하므로
  정상 수신·DB 저장·HA ACK 단계는 로그 화면에서 추적하기 어렵다.
- 권고: 중요 단계의 시각·처리 결과·지연·cursor/건수·오류/재시도·부팅 버전 기록,
  기본 INFO/WARNING/ERROR와 일시 DEBUG, 반복 오류 제한·용량/기간 제한 보관.
  토큰·인증 헤더·GPS/영상/전체 CAN·원본 payload를 상시 로그에 넣지 않는다.
- HAOS 애드온 로그는 해당 앱 로그이다. HA Core/Comma 전체 원본 로그를 자동
  포함하는 화면이 아니며 통합 진단은 별도 연결/권한 설계가 필요하다. 수신기 기존
  telemetry/trip/ACK 이벤트 로그 확대는 Comma 추가 업데이트 없이 가능한 범위다.
- 관련: addons/carrot_receiver/receiver.py와 공식 Supervisor log endpoints.
  코드·설정·배포·기기 Pull/재부팅·릴리즈 변경 없이 조사 기록만 게시한다.

## 2026-10-14 — 대시보드 Cloudflare 상태 문구 조사

- 사용자 첨부: 대시보드 footer에 Cloudflare · ok 잔존.
- 원인: carrot-dashboard-ko.js/en.js footer의 서버 이름이 Cloudflare 문자열로
  고정되어 있다. 상태값은 live_status/cloud_status 공통 키이며 실제 연결 대상을
  나타내는 이름이 아니다. 직접 source 적용 후에도 동일 상태 키를 재사용한다.
- 현재 직접 receiver 적용은 앞선 운영 점검으로 확인. 이번 질문의 표시가 Cloudflare
  통신 재개를 증명하지 않는다. 표시 문구 전환 누락과 실제 통신 경로를 구분해 안내.
- 코드 읽기 조사만 수행. 실행 코드·배포·기기 업데이트·재부팅·릴리즈 변경 없음.

## 2026-10-14 — 전환 후 새 당근웹 로그 표시 확인

- 사용자 실기 보고/첨부 화면: 최신 Git·HA에서 22:20:38~22:20:49의 짧은 새 파일
  로그가 당근웹 로그/대시캠 목록에 표시됨. 세그먼트 1개 표시 확인.
- 구분: 첨부 화면은 영상/rlog 파일 로그이며 일반 차량 대시보드 trip 목록이 아니다.
  서버 읽기 확인으로 자체 수신기 trip feed는 0건, cursor=0, has_more=false.
- 확인된 범위: 사용자 업데이트 후 새 파일 로그 HA 목록 표시. 영상 재생·rlog 내용
  전체·일반 주행 내역 업로드·장거리/충전·장기 운영은 이 화면만으로 확인하지 않음.
- 기록만 갱신. 기기 명령·코드 수정·재부팅·새 릴리즈·Cloudflare 변경 없음.

## 2026-10-14 — 사용자 재시작 후 직접 연결 운영 확인

- 사용자 보고: HA와 Comma 업데이트/재부팅 완료. HA 원격 터미널 접속과 주차 카메라
  보기를 사용자가 직접 확인했다. 원격 접속 복구 최우선 요구의 실사용 확인으로 기록.
- 서버 읽기 확인: 수신기 0.1.2 started, HA receiver_url 적용, 비공개 일회 setup 소비.
  자체 서버의 상태 이력 HA cursor=103. 마지막 실제 측정 2026-10-14 22:23:51 KST.
  telemetry가 보고한 기기 commit=40148b0dc66744636ea4fcfe270e7365b758a4b5,
  branch=carrot-wip-model_selector-ha로 원격 게시 코드 설치 확인.
- 새 수신기 trip feed는 0건/has_more=false, HA 해당 cursor=0. 기존 HA 과거 기록은
  보존되어 있으며 새 실제 주행 업로드/표시 검증과 장기 부하·백업 복원은 아직 미완료.
- 개인정보/토큰/GPS 원문 미출력. 기기 명령·추가 Pull·재부팅·운영 코드 변경 없음.
  이번 작업은 검증 기록만 커밋·푸시하며 새 버전·태그·Release/Worker 배포 없음.

## 2026-10-14 — 직접 수신 전환 전 기록

- 사용자 요청: Cloudflare 의존을 자체 HAOS 수신 애드온으로 이전하되 기존 기능
  하나도 변경하지 않고, 본격 수정 전에 이유와 전체 보존·복구·검증 기준을 기록.
- docs/direct-vehicle-receiver-plan-2026-10-14.md에 원인·현재 경로·기능 목록·인증/
  cursor/queue-ID·보관·백업·이전·네트워크·가용성 차이·검증/전환 순서를 작성.
- 실행 코드 수정 전 작성. 이전 기능·날짜 기록/설정·결제·파일·안전 차단 보존.
  기존 Cloudflare DB 삭제/기기 수동 소스 수정/에이전트 재부팅/새 Release 발행 없음.
- 검증: 현재 코드 경로와 이전 누적 릴리즈 기록 대조. 실제 애드온/외부 연결 미검증.
  본 문서와 기록을 먼저 커밋·푸시 후 구현 진행 예정.
- 사전 기록은 3c9e4f0로 main 커밋·원격 게시 후 실행 코드 작업 시작.
- 구현 진행: 독립 HAOS 수신기/SQLite/인증/증분 feed/명령 namespace/연결 게시,
  HA 직접 source 설정과 source별 cursor, Git 관리 Comma 영구 연결 설정 모듈 작성.
- 로컬 검증: 수신기 HTTP 8건, HA 증분 5·latest 6·ACK 1·압축 2·history cache 1,
  대시보드 10건 통과. Windows 기본 cp949 읽기 오류는 UTF-8 실행으로 통과.
  Comma 69건 중 65 통과; 기존 Windows fcntl 2·symlink 권한 1·bash 경로 1 실패.
- 사용자 확인: 외부 HA homeassistant202604.duckdns.org(443). Supervisor 읽기 확인으로
  Nginx Proxy Manager가 443을 처리하며 사용자 include 경로 존재 확인.
- 사용자 지시: Comma는 별도 답장 전까지 오프라인으로 간주. 연결 시도/실기 검증 없음.
- 현재: 애드온 실제 설치·독립 HTTPS 경로·HA 코드 반영 준비 단계. 전환 완료 아님.
- 설치 진행: 8303aae 수신기 저장소 기반 ARM64 빌드/실행 성공, 애드온 slug
  874ccb4c_carrot_receiver. 기존 프록시 사용자 include로 /carrot-receiver 경로 추가,
  독립 health 및 HA 기존 root 경로 모두 외부 HTTPS 200 확인.
- HA 소스 62개 기존 백업·SHA-256·문법 확인 후 반영(54 변경/8 동일). 사용자 재시작과
  실제 source 설정 적용은 대기. 설정·DB·사진은 동기화 대상에서 제외.
- 후속 구현: 기존 장치 upload identity로 인증된 자체 서버 provisioning과 Git 공개 URL
  매핑, HA 일회 준비 옵션 적용. Git에 토큰/장치 ID 없음. 수신 10/일회 setup 2,
  Comma 직접 설정 4/polling 4 검증 통과. 원격 기기 실행은 아직 미검증.
- 기능 보존: 충전 74/주행 73/카메라 17(1 skip)/터미널 4/파일 로그 15(1 skip),
  Worker 기존 증분/benchmark 통과. 차계부 환경 제약은 별도 CHANGELOG에 기록.
- 자동 설정 967beff main 게시 후 HA 최종 소스 63개 hash/문법 확인. 자체 서버
  실제 HTTPS provisioning 200과 장치/새 credential 내부 대조 성공(원문 미출력).
  HA 비공개 일회 source 설정 준비, 기존 terminal_enabled와 직접 HA 주소 보존 확인.
- Comma 원격 58553e23 및 명시적 rollback 보정 b5e73218 게시·브랜치 SHA 확인.
  기기 Pull/재부팅 미실행. 처음은 기존 터미널 불가 시 당근웹/로컬/VPN에서 설치 필요.
- 기존 trip 측정 범위·최고속도·부분 품질 메타데이터 유지 점검을 수신기 0.1.2에 반영.
  관련 API wire와 계산을 유지하며 UI·CAN·차계부 실행 코드 변경 없음.
- 최종 준비: 수신기 0.1.2 실제 started/boot auto/Watchdog, 외부 HTTPS 200 확인.
  기존 HA archive의 동일 서버 비공개 online backup integrity=ok, 마지막 상태 1건
  자체 수신기 seed 및 원래 측정 시각 보존 확인. 원문/토큰은 출력·Git에 없음.
- Comma 최종 원격 40148b0d. 초기 인증 지연 중 수집/outbox 보존 및 공유 credential
  회복 보정(537f5d90/cd24a0ec/40148b0d), 직접 연결 6/polling 4/outbox 1 통과.
- HA 소스 반영·비공개 일회 옵션 준비 완료지만 사용자 HA Core 재시작 미실행.
  Comma Pull/재부팅 미실행. 실차·HA 재시작 중 수신·실제 백업 복원·24시간 관측은 대기.
  새 HA 버전·태그·Release 없음. Cloudflare DB 삭제·Worker 변경/배포 없음.

## 2026-10-14 — 자체 서버 직접 통신 가능성 조사

- 요청: 코드 변경 없이 Cloudflare 의존 제거의 기능 보존 가능성·장단점 검토.
- 확인: 일반 상태/주행은 Worker 저장 후 cloud.py가 HA로 동기화하며, 파라미터
  큐/ACK/설정 동기화도 Worker에 의존한다. 영상/rlog·주차 카메라·터미널의 본
  전송은 HA 직접 경로가 있지만 초기 주소/토큰 발견은 terminal_bootstrap에 의존한다.
- 판단: 수신 저장·인증·명령 큐·직접 연결 설정을 자체 서버로 옮기면 현재 HA 기능
  보존 가능. 주소만 교체하는 작업은 아니며 기존 안드로이드 호환은 별도 API 검증 필요.
- 장기 조건: 외부 HTTPS/WSS 또는 VPN 도달성, 기기 오프라인 큐 한도/재전송,
  중복 방지·영속 ACK·백업·디스크 보관 및 재시작 복구 검증. HA와 별도 프로세스
  수신 서비스는 HA 재시작 중 수신 가능하나 동일 서버/회선 장애는 공유한다.
- 관련: cloudflare/src/worker.js, HA cloud.py/terminal_bootstrap.py/terminal_relay.py/
  camera_http.py/driving_logs/http.py, openpilot collector.py/param_sync.py/terminal.py.
- 검증: 로컬 코드 읽기와 HA 공식 외부 접근 문서 검토. 운영 네트워크의 Cloudflare
  프록시/터널 사용 여부 및 원작 앱의 전체 활성 기능은 미확인. 실행 코드·설정·DB·
  릴리즈·배포 변경 없음. 조사 기록만 로컬 반영.

## 2026-10-14 — 저장 용량과 프리릴리즈 범위 재점검

- 이유: 사용자 요청으로 장기 용량 위험 및 beta.6/beta.7의 이전 변경 포함 여부를 재검토.
- 운영 조회: D1 280,588,288 bytes. 압축·중복 제거·용량 예산·ACK 기반 정리로 여유를
  확보했으나 예산은 본문 기준이며 물리 DB 전체 상한 보장은 아니다.
- HA 설치 버전은 0.8.14-beta.5이며 자동 archive ACK와 새 압축 응답 해독 코드가
  설치되지 않았음을 읽기 전용 확인. 일회성 ACK 이후의 지속 정리와 실제 cron 실행,
  정상 24시간 부하 및 장기 보관 주기 검증은 미완료다.
- 릴리즈 대조: beta.7은 beta.5 이전 실행 코드와 beta.6의 로그 기능을 포함한다.
  beta.5 이후 차계부 경로 변경은 기록 문서뿐이며 이전 결제 수정도 조상 커밋이다.
  beta.7 이후 main에 추가 HA 실행 코드 변경은 없다.
- 설명 한계: beta.7 노트는 beta.6을 요약 참조했고, 이전 누적 기능과 기존
  carrot-params-card의 로그 화면 전환/파라미터 튜너 이동을 충분히 설명하지 않았다.
- 발행 판단 오류: 이 파일의 개별 작업 지침은 버전·태그·Release 없이 진행하도록
  했으나 일반 배포 지침을 우선해 beta.6/beta.7을 발행했다. 사용자에게 오류를 인정.
- 관련: cloudflare 저장 정책, HA cloud.py/cloud_archive.py, frontend 카드,
  beta.5~beta.7 릴리즈 및 Git 이력. 이번 점검에서 실행 코드·운영 DB·릴리즈 수정,
  HA/Comma 설치·재시작은 수행하지 않았다. 점검 기록만 로컬 반영.

주행 로그 관련 모든 작업을 기록한다. 계획·로컬 검증·Git 게시·HA 반영·실차 설치는
별도 상태이며, 하나의 성공을 다른 단계의 성공으로 대신하지 않는다.

## 2026-10-14 — 환경 탐색과 구현 계획

- 요청: 당근웹 로그 UI 및 상세 레이더 분석을 HA에 이식하고 날짜별 GPS 지도와 최신
  5GB 보관을 추가. 첫 단계는 기존 파라미터 화면 자리의 실제 로그 조회까지.
- 조사: 집 VPN 경유 HA SSH 성공. ARM64, HA Core 2026.9.0, 통합 0.8.14-beta.5,
  확인 시 파일시스템 여유 약 116GB. DuckDNS HTTPS GET/TLS 검증 성공.
  Nginx Proxy Manager의 대상 도메인→HA:8123 전달 경로 확인.
- 소스: 당근웹 로그 모듈과 `tools/carrot_route_vault/`의 첨부 분석 화면 원본 발견.
  로그 UI와 레이더 계산 엔진 재사용, 분석 서비스 분리 방안을 계획.
- 정책: 완성 구간 즉시 직접 업로드+주차/연결 후 누락 보충. 실제 기록 시각 최신부터
  최대 5GB. Worker/D1/KV에 원본을 중계·저장하지 않는다.
- 관련 파일: `docs/driving-log-ha-implementation-plan-2026-10-14.md`.
- 게시: 계획서 커밋 `18adfa0`, 원격 main 반영 확인.
- 한계: 프록시 유효 업로드 제한·실차 성능·분석 ARM64 실행은 당시 미검증.

## 2026-10-14 — 실제 로그 수신·조회 첫 단계 구현

- 이유: UI만 복사하면 HA에 원본 파일·조회 API가 없어서 실제 로그를 볼 수 없다.
- HA 저장소: 전용 `driving_logs/store.py`. 최신 시각부터 구간 단위 보관, 5,000,000,000
  bytes 예약·색인·미완료 파일 포함, 과거 재업로드 방지, 이어받기, SHA-256, 완료 후 공개.
  차계부/텔레메트리 archive와 별도 파일 저장.
- HA API: `driving_logs/http.py`, 통합 `__init__.py` 등록. 목적별 장치 HMAC 인증,
  관리자 인증 이후 장치 범위 1시간 HttpOnly 조회 세션, 목록·구간·파일·영상 Range 응답.
- Comma: `ha/driving_logs.py`와 `terminal.py` 연결. 기존 discovery 결과 공유로 새 Worker
  polling 없이 HA 직접 전송. 완료·잠금 해제 원본만 최신부터 순차 전송, 원본 TS 보존,
  FFmpeg stream-copy MP4 생성, FFprobe 길이가 있으면 시작시각 계산. 전송 상태는 Git 밖.
- UI: `frontend/carrot_logs/`는 원본 당근웹 로그 HTML·생성 UI/로그 번들·스타일 재사용.
  `ha_logs_bridge.js`는 HA 로컬 범위로 연결. `carrot-logs-card.js`는 정식 새 카드.
  `carrot-dashboard-runtime.js`는 lazy 등록. 옛 `carrot-params-card.js`는 호환용이며 기존
  파라미터 구현은 `carrot-parameter-tuning-card.js`로 분리.
- 이름 수정: 사용자 피드백에 따라 정식 타입 `custom:carrot-logs-card`, 리소스
  `/carrot_ha_static/carrot-logs-card.js`, 표시 이름 **Carrot HA — 당근웹 로그**.
- 검증 대상: 사용자 지정 `https://homeassistant202604.duckdns.org/lovelace/8`.
- 지원: 목록·정렬·선택·영상 창·원본 개별 다운로드. 분석·지도·외부 전송·선택 ZIP·
  화면 녹화 수신·실제 썸네일은 다음 단계이며 현재 UI에서 미지원 안내.
- 재현: `scripts/build_logs_port.py`, 원본 commit `baf47a6f` 고정·provenance 저장.
- 테스트: `tests/test_driving_logs.py`, `test_driving_logs_transport.py`,
  `driving-logs-port-browser.cjs`, 기존 params 검사 경로 보정;
  openpilot `ha/tests/test_driving_logs.py`.
- 통과: 저장/해시/중단 재개/용량/경로 검증 4건, 실제 HTTP 및 Comma sender→HA receiver
  통합 2건, Chromium 목록·선택·정렬·영상 창 URL·닫기·모바일, dashboard live/lazy/view-state,
  cloud live/incremental/history cache, Worker incremental/benchmark, Comma param/terminal/logs 12건.
- 전체 Comma 92건 중 기존 카메라 검사 2건 실패: `encode_media` 누락 및 PyAV 누락 기대
  불일치. 카메라 소스·테스트의 HEAD 대비 변경 없음 확인. 기기 장애로 판단하지 않는다.
- 환경 보정: Mac 기본 Python 3.9에는 `asyncio.timeout`이 없어 기존 terminal 검사 실패.
  Python 3.12 재검증에서 관련 검사 통과. 브라우저·HTTP 소켓은 sandbox 제한 때문에
  승인 경로의 분리 테스트 환경에서 실행했다.
- 게시 준비: 최신 openpilot 원격 자동 동기화 변경 위에 단일 부모 커밋으로 rebase.
  Comma 전송 커밋 `05bc6d0a`; 원격 게시 결과는 다음 배포 항목에 기록.
- 배포 정책 변경: 사용자 요청으로 이번에는 릴리즈 없이 HA SSH 직접 반영·검증.
  버전/태그/Release/Worker 배포 없음. 필요한 파일 백업 후 반영 예정.
- 미확인: 설치 후 실제 기기 FFmpeg·전송/재개·CPU/열, 실제 영상 디코딩, 5GB 회전,
  장시간 기존 서비스 영향. 합성 파일 검사는 실제 영상 재생 성공의 증거가 아니다.

## 2026-10-14 — 주행 로그 전용 기록 의무화

- 요청에 따라 `driving-logs/AGENTS.md`, 이 `CHANGELOG.md`를 만들고 루트 `AGENTS.md`에
  작업 전 지침 확인·모든 로그 작업 즉시 기록 의무를 연결한다.
- 배포 절차는 `docs/driving-logs-setup.md`에 기록. 다음 작업도 내용·이유·관련 파일·검증·
  Git/HA/Comma 배포 상태·미확인 사항을 누락 없이 추가한다.

## 2026-10-14 — HA 직접 파일 반영 및 사용자 적용 대기

- 사용자 요청에 따라 릴리즈 없이 SSH 직접 반영. 로그 관련 파일 27개 SHA-256 일치
  확인, 운영 `__init__.py`는 기존 내용을 보존하고 로그 API 등록 2줄만 추가했다.
- 백업: `/config/carrot_ha/deployment-backups/driving-logs-20261014/before`.
  manifest·차계부·기존 설정·운영 DB는 변경하지 않았다.
- Comma 원격 게시: `05bc6d0af87a53569f91facef1c490c850786a73`,
  `origin/carrot-wip-model_selector-ha`의 SHA 일치 확인.
- 사용자에게 HA 재시작과 Comma `git pull --ff-only && sudo reboot`를 요청했다.
  사용자는 시간이 걸리며 완료 후 추가 답장하겠다고 했다. 현재 적용 완료로 간주하지 않는다.
- 대기 중인 검증: 재시작 후 신규 HA API, 실제 Comma 로그 도착·영상 재생,
  새 카드 타입/리소스 적용 후 사용자 지정 Lovelace 8번 화면.
- HA 저장소 코드와 문서의 Git 게시·최종 운영 검증 기록은 후속 답장 후 이어간다.

## 2026-10-14 — 사용자 재시작 후 실제 수신 확인

- 사용자가 HA 재시작과 Comma Pull·재부팅 완료를 알렸다.
- 외부 frontend-version 응답 `0.8.14-beta.5-a4071aa720bf`로 HA 새 코드 재시작 확인.
- 실제 HA 로그 색인: 4개 구간, 수신 완료 3개, 예약량 52,046,367 bytes 확인.
  기기 원본→운영 HA 수신이 시작됐다는 증거이며 장시간 전송·영상 디코딩의 증거는 아니다.
- 다음 사용자 작업: 리소스를 `/carrot_ha_static/carrot-logs-card.js`로 바꾸고 8번
  대시보드 카드 타입을 `custom:carrot-logs-card`로 변경, 기존 device_id 유지, 강력 새로고침.
- 실제 대시보드 목록·영상 재생·시간 이동·다운로드와 장시간 용량 회전은 후속 검증 대기.

## 2026-10-14 — 사용자 실재생 확인 및 화면 누락 보정 중

- 사용자 스크린샷과 보고로 실제 운영 HA의 영상 재생 확인. 목록·구간 목록 썸네일은
  자리표시자이며 주행 리플레이는 모듈 미연결로 동작하지 않는 상태가 드러났다.
- 리플레이의 “이 브라우저에서는 사용할 수 없음”은 원본 런타임 미로딩 안내였다.
  브라우저 미지원으로 확인된 것이 아니다. 원본 worker·재생 화면 연결을 진행한다.
- 구간 목록 누락 원인: 원본 CSS wide media query와 HA 브리지의 축약된
  `isCompactLandscapeMode` 조건 불일치. 넓은 화면에서 DOM 내용을 만들지 않았는데
  CSS는 펼침 컨트롤을 숨겼다. 원본과 같은 media query로 수정했다.
- 썸네일: `ha_log_thumbnails.js`에서 HA 저장 MP4의 보이는 항목만 단일 디코더로
  프레임 추출, 최대 48개·각 128KiB JPEG 메모리 캐시. 숨김 시 중단, 종료 시 해제.
  HA 디스크/Comma/Cloudflare 변경 없음. 원본 bridge HTML·빌드 스크립트에 연결.
- 검사: 합성 영상 실제 Chromium 디코딩으로 썸네일 480px 생성, 목록·선택·정렬·영상
  창·모바일 검사 통과. wide 구간 목록 가시성 회귀 검사를 추가해 재검증 예정.
- HA FFmpeg 확인을 위한 Docker 읽기는 SSH 앱 protection mode 때문에 불가했다.
  보호 설정은 변경하지 않았다. 썸네일 구현은 브라우저 영상 디코딩을 사용한다.
- 관련 파일: `frontend/carrot_logs/ha_log_thumbnails.js`, `ha_logs_bridge.js`, `logs.html`,
  `scripts/build_logs_port.py`, `tests/driving-logs-port-browser.cjs`.
- 배포: 이번 보정은 아직 로컬 작업 중. 리플레이 연결과 관련 검증 후 SSH 직접 반영한다.

## 2026-10-14 — 원본 리플레이 연결 및 실로그 검증

- `driving_logs/http.py`에 장치 범위·기존 조회 세션을 사용하는 replay-source 설명과
  rlog/영상 파일 응답 추가. API 인증·Range·원본 바이트 보존 검사 통과.
- 같은 원본 커밋의 replay client, 압축/Cap'n Proto 해석 워커, 이벤트·그래프·전방·
  분석 모듈, 리플레이 HTML·CSS를 이식. worker 경로와 입력 URL을 HA로 연결하고
  전용 runtime 등록 이름으로 분리한다. 원본 계산·해석 로직은 재작성하지 않는다.
- `ha_replay_loader.js`에서 클릭 시에만 리플레이 자산을 로드하고 저장된 자료로 재생한다.
  라이브 WebSocket이나 기기 설정 쓰기는 없다. 재생/정지/배속/시간 이동/구간 선택은
  원본 모듈을 사용한다. 기록 속도·가속도·Lead 수치 HUD를 HA 상태 어댑터로 연결한다.
- 원본 drive workspace 스타일과 stream-ready 상태도 필요했다. 이를 연결하고
  실제 영상 표시·닫기 버튼 위치를 Chromium에서 확인했다.
- 원본 Carrot Vision의 GPU 차선/AR 오버레이 전체는 이번 어댑터에 포함되지 않는다.
  레이더 검증 상세 화면·지도·외부 전송과 함께 남은 범위를 별도로 추적한다.
- 운영 HA의 실제 한 구간 rlog/MP4를 임시 비공개 파일로 읽어 원본 worker 해석,
  재생 진행·정지·seek 후 기록 상태, SVG 그래프, 모바일 폭, 닫기 검증 통과.
  테스트 자료·GPS 원문·영상은 Git에 포함하지 않았다.
- 썸네일 디코더는 리플레이/숨김 시 중단하고 제거된 DOM 관찰·큐를 정리한다.
- `scripts/build_logs_port.py`에 재현 가능한 리플레이 자산/페이지 생성도 추가했다.
- Git 게시·HA 직접 반영은 아래 후속 배포 결과를 기준으로 한다. HA 재시작 후 운영
  대시보드의 새 리플레이는 사용자 확인 대기이며, 로컬 실로그 검증과 구분한다.

## 2026-10-14 — 원본 HUD 복구·10GB 주행 단위 보관 수정 중

- 원인: 이전 이식이 GPU 렌더러·원본 HUD를 제외하고 간단한 수치 어댑터로 대체했다.
- 동일 원본 커밋의 렌더러·raw 상태 해석·투영·HUD 모듈을 기록 전용으로 연결한다.
- 저장 한도 10,000,000,000 bytes, 오래된 주행 전체 삭제와 삭제 주행 재전송 방지를 구현한다.
- 관련 파일: `driving_logs/store.py`, `frontend/carrot_logs/`, `scripts/build_replay_renderer.py`, 저장·브라우저 테스트.
- 사용자 지시: 버전 상승·태그·릴리즈 없이 검증·커밋·푸시 후 HA 직접 반영.
- 후속 요청 반영: 드롭다운 현재 구간 텍스트·접근성 표시를 유지하고 같은 스타일의
  이전·다음 버튼을 선택기 옆에 추가. 좁은 화면에서 줄바꿈하며 경계에서 비활성화한다.
- 너비 변동 원인: `.logs-shell`의 너비 미지정과 max-width/auto margin이 콘텐츠 고유
  너비에 의존했다. HA 카드·iframe·로그 shell에 안정적인 전체 너비를 적용한다.
- 당근 서버 전송: 원본 `web_upload.py`와 결과 포매터를 고정 커밋에서 재사용한다.
  HA 장치 범위 summary/start/job/cancel, 원본 확인·진행률·결과 UI, 크기 응답 불일치·
  서버 한도 거절·재시도·취소·보관 정리 시 업로드 중단을 연결한다. 별도 Discord 전송 없음.
- 합성 파일 로컬 서버 검사 15건 중 14건 통과·Comma 송신기 통합 1건 환경 미지정으로 제외.
  원작자 서버에 테스트 파일을 올리거나 NAS 내부 수신 확인을 수행하지 않는다.
- 실주행 자료의 로컬 복사는 자동 승인 심사가 민감 자료 복사 대상 허가 및 경로 검증
  부족으로 거절해 수행하지 않았다. GPU·HUD·탐색·아이콘은 합성 기록 Chromium 검사로 검증한다.
- 전송 결과 화면까지의 브라우저 검사에서 원본 API의 `waitMs` 전역 helper 누락을
  추가로 발견해 HA 브리지에 연결했다. 원본 범위 선택·전송 확인·진행·결과 흐름을 검사한다.
- 검증·배포: 진행 중. 운영 적용·재시작·실차 검증 완료로 보고하지 않는다.
- Chromium: 합성 영상의 목록·썸네일·첫 표시 전체 너비·디코딩 후 폭 유지·선택·원본
  전송 확인/진행/결과·정렬·영상·모바일 검사 통과. 원본 HUD/GPU 픽셀·아이콘·전후
  seek·상단 이전/다음·현재 구간 표시·HUD 토글·닫기·라이브 소켓 0개 검사 통과.
- 기존 dashboard live/lazy/view-state 10건, incremental 5건·history 1건·Comma param
  polling 4건 통과. Worker benchmark 통과. Worker incremental은 기존 스키마의
  `measurements_json` 중복 마이그레이션 오류에서 실패(해당 코드 변경 없음).
- UTF-8 모드에서 cloud-live 6건 통과. 로그 HTTP 검사에 미인증 summary 거부·
  인증된 원본 크기 요약·다른 엔트리 작업 ID 조회 거부를 추가했다.
- Git 게시: 실행 코드 커밋 `136592135652322184764ab4c61d34531dbf6ccc`를 main에 푸시했다.
- HA 사전 검사에서 기존 설치 파일이 수정 전 Git 내용과 일치함을 확인한 뒤 코드·자산
  107개를 직접 설치했다. 모든 설치 파일 SHA-256 일치 확인. 백업:
  `/config/carrot_ha/deployment-backups/driving-logs-hud-136592135652/before`
  (실제 경로 `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-136592135652/before`).
- 외부 DuckDNS HTTPS의 카드·리플레이 로더·레이아웃 CSS·원본 HUD 모듈 4개가
  게시 커밋과 같은 SHA-256임을 확인했다. 운영 데이터와 토큰·로그·영상을 복사하지 않았다.
- 배포 완료, 사용자 HA 재시작 1회·강력 새로고침 후 실제 HUD·용량·선택 전송 확인 대기.
  백엔드는 재시작 전까지 이전 코드다. Comma 변경/Pull·Worker/D1/KV 배포 없음.
  manifest 버전·태그·GitHub Release 변경 없음. 원작자 NAS 내부 수신 검증은 하지 않았다.

## 2026-10-14 — 썸네일·목록·리플레이 SSH 반영 완료

- 수정 파일 23개를 기존 파일 백업 후 HA에 직접 설치하고 SHA-256 일치 확인.
- 백업: `/config/carrot_ha/deployment-backups/driving-logs-replay-20261014/before`.
- 외부 DuckDNS에서 제공되는 `ha_replay_loader.js`도 로컬 SHA-256 일치 확인.
- 최종 검사: 실제 수신 rlog/MP4로 재생 진행·일시정지·seek 기록 갱신, SVG 그래프,
  모바일 크기, 닫기 및 목록·썸네일·선택 검사 통과. API/저장/전송 통합 6건 및
  기존 dashboard live/lazy/view-state 회귀 통과.
- Comma·Worker·D1/KV·manifest 변경 없음. 버전 상승·태그·Release 발행 없음.
- 새 replay-source API 활성화를 위해 사용자 HA 재시작 1회와 강력 새로고침이 필요하다.
  운영 8번 대시보드에서 수정 리플레이를 확인한 것은 아직 아니다.
- 코드 게시: HA 첫 단계 `4d16902`, 썸네일·목록·리플레이 보정 `5d082d2`를 원격 main에
  푸시한 결과 확인. 기본 작업 폴더도 해당 변경으로 fast-forward 반영했으며 기존
  차계부·manifest 등 다른 작업의 staged/unstaged 변경은 유지했다.
- 이 후속 기록은 Git 게시·작업 폴더 반영 결과를 추가하는 문서 변경이다. 운영 코드
  재배포·버전 변경·릴리즈는 하지 않는다.
## 2026-10-14 — 오후 일반 주행 내역 누락 조사

- 최적화 구현 시작(사용자 전체 적용 요청): cloudflare/src/archive_storage.js,
  worker.js·wrangler.json·schema.sql·migration_archive_storage.sql, HA cloud.py,
  openpilot collector.py·engine.py 및 회귀 검사. gzip 무손실 압축과 장치/해시별
  충전 목록·월별 집계 분리, 한 번의 JOIN으로 기존 raw_json 복원, durable HA ACK
  이전 자료 보존, 시간/바이트 예산과 시간당 정리, 주행/상태 송신 lane 분리를 구현한다.
- 자동 승인 심사는 운영 DB 전체 백업의 개인정보 전송을 거절했다. 사용자가 GPS·
  주행 이력을 포함한 전체 백업을 PC 비공개 Temp 경로에 저장하도록 명시적으로 허용한
  뒤 D1 export 성공. 백업 SQLite integrity_check 및 54,950개 변환 행의 원문 gzip
  복원 동등성을 확인. 본문 440,750,825→169,225,858 bytes; 원본 백업 유지.
  민감 원문·장치 ID·토큰·백업 다운로드 링크는 문서/Git에 포함하지 않는다.
- 합성 Worker storage/history/incremental/benchmark, HA live 6·incremental 5·history 1,
  dashboard 10건 통과. Windows에서 Comma 전체 69건 중 fcntl 부재 2·symlink 권한 1·
  기존 workflow bash 경로 1 실패. 실행 코드 배포·운영 DB 변환은 아직 진행 전이다.
- Git 게시: HA/Worker 구현 `83ed541`, Comma 기능 `e9c9f4cd`와 동시 upstream을
  보존한 병합 `0522a86662ecf48949dd37cb1a2aedcd573486b9` 원격 확인.
- 운영 복구: 호환 모드 Worker dee4175f 배포 후 54,950행 무손실 본문 압축 적용.
  DB bytes 499,998,720→274,784,256. 원문/행/커서 삭제 없음. 이어 additive
  migration_archive_storage.sql 적용, 최종 Worker 8703ca54 배포. 크기 약276MB,
  telemetry 본문/공유 context 예산 사용169.3MB/250MB, trips9.6MB/75MB.
- beta.6 manifest/태그 일치·GitHub Release 생성 확인. Actions 38556238637 성공.
  HA 수신 ACK 실행 코드는 HACS 설치·사용자 재시작 대기이다.
- 변환 직후 D1 metadata API 7009 및 HA cloud API timeout이 일시 발생했으나 이후
  읽기/쓰기 재개 확인. HA 실제 latest 약0.305s/history66건 약0.604s/trips 약0.307s,
  history 원래 deviceId 포함 payload 복원 확인. 오래된 오전 미전송 trip이 서버에
  수신되기 시작했으나 오후 주행 수신 완료는 아직 확인하지 않았다.
- 일회성 변환/ALTER/index에서 각각54,950/54,988 rows_written 발생. 이후 D1 info
  최근24h117,303 writes 측정. 현재 요청은 동작하지만 계정 전체/UTC 일일 한도와
  장기 무료 플랜 보장은 미검증. 정상 유지보수 부담을 줄이도록 정리를200행/시간으로
  제한한다(초기 오래된 자료 정리에 수일 소요 가능; 미수신 자료는 삭제하지 않음).
- 실제 첫 HA durable cursor ACK 성공(telemetry55278/trip395), 14일 초과 확인 자료
  200건 정리. 초기 응답의400은 D1 meta.changes에 예산 트리거200쓰기가 포함된
  것이므로 RETURNING 행 수로 보정했다. 보정 커밋0ee0c0e·Worker3473f4ad 배포.
- 운영 CPU 검증에서 100건 압축 복원이73~78ms로 측정돼 무료 CPU 기준 대비
  보정한다. opt-in 압축 전송을 HA executor에서 복원하고 shared context는 페이지당
  한 번 전송한다. 새 HA는100건×최대10페이지, 이전 HA는 원문 호환8건 페이지.
  최신 상태 경로는 그대로 두고 beta.7로 HA 수정본을 발행한다. 2개 복원/손상/상한
  검사와 기존 ACK/incremental/live 검사 통과. 실제 새 CPU·오후 주행 수신은 후속 확인.
- beta.7 압축 전송 구현2b206ff 게시·Worker e18e1cef 배포. 운영 HA 서버 메모리에서
  게시된 cloud_archive.py로 실제100건을 복원해 장치 ID/값 형식 검사 통과(파일 설치 없음).
  요청 CPU4ms 확인. 기존8건 원문 복원은21ms 표본이 있어2건으로 추가 제한한다.
  새 HA100건×10페이지는 유지하며 이전 HA catch-up은 느려질 수 있다. unchanged
  context의 압축 결과64개를 메모리에 캐시해 송신 CPU를 줄인다.
- 누락 복구 확인: 16:06:35~17:50:18 KST·101,000m 주행이 클라우드 최근 주행 및
  HA archive trip 종료2026-10-14T08:50:18+00:00로 확인됐다. 화면 검증은 별도 후속.
- 최종 CPU 표본: 기존2건 원문/신규100건 압축 전송4/5ms·ACK2ms·latest0~2ms,
  telemetry 송신9~13ms. 작은 snapshot 나머지는 JSON+immutable context 참조로
  저장해 매건 gzip 비용을 줄이고, 큰 나머지/반복 context/기존 이력은 gzip을 유지한다.
  HA beta.7 복원기는 JSON/gzip을 이미 지원하므로 추가 HA 버전 상승은 필요 없다.
- 최종 게시/배포: Worker ed8b0f6 코드·dff4cdad-9c35-49fc-bb79-15ca3a884e3e 배포,
  POST telemetry4~9ms/200 표본 확인. 새 JSON 경로의 missing-context 회귀가 검증 중
  실패해 guard를 추가하고 storage/history/sync/benchmark 및 HA 복원·ACK·history·
  dashboard 검사를 다시 통과했다. 민감 자료 없는 일시 tail은 모두 종료했다.
- 최적화 후 운영 수치: DB280,555,520 bytes, telemetry/context172,071,968/250MB,
  trips9,641,263/75MB, context391개, durable consumer1개. 현재 잔존/신규 자료와
  최초 압축 직후 크기를 구분한다. 미수신 이력을 용량 때문에 임의 삭제하지 않는다.
- 자동 심사는 원문 유래 해시를 HA에 보내는 추가 대조를 거절했다. 동일 PC/동일
  사용자 허용 백업 폴더에 after 백업을 받아 전후 로컬 전체 대조로 대체 완료:
  기존54,965건 중54,765건 모든 원문 값 일치, 정상 ACK/14일 초과 정리200건,
  미설명 손실0·after SQLite integrity_check 통과. 민감 원문/해시 서버 전송 없음.
- 실제 Chromium 대시보드 오늘 주행 탭에서 오후04:06·101km·1시간43분 카드,
  오늘180.37km 요약과 오전 병합 카드 확인. 초기 캐시 표시와 비동기 갱신 후를 구분했다.
- HA 최종beta.7 Release/Actions38558241866 success 확인. HA HACS 설치/사용자
  재시작 및 Comma b2260cf0ae2812d872bcb1228bb9441b0dcea001 Pull/재부팅 대기.
  lane 인덱스/재시도보존/param polling5건 추가검사 통과. docs 검토에최종결과추가.
  실제 첫cron/24시간계정전체쿼터/보관주기안정화/새송신기실차검증은미완료다.

- 장기 개선 검토: docs/cloudflare-storage-review-2026-10-14.md 작성.
  최근 날짜별 본문 집계에서 평균 크기 10/1 8.2KB→10/13 15.6KB 증가 확인.
  15,685 bytes/행 고정 시 14일 본문 316~632MB(60~30초 간격), 압축률 50%
  가정도 158~316MB이며 D1에서 검증된 압축률은 아니다. 압축 단독 영구 해결로
  권하지 않고 반복 데이터 분리·기간/용량 예산·정리 검증·전송 장애 격리를 함께 권한다.
  공식 D1/Workers 한도 확인. 운영 데이터·실행 코드·보관 정책 변경/배포 없음.

- 후속 직접 확인(약 20:00 KST): HA 원격 터미널은 주차·준비됨, 실제 연결 성공.
  최신 상태 19:58:36 KST와 Git 측정 19:58:05 KST 확인. 설치 커밋은
  `05bc6d0af87a53569f91facef1c490c850786a73`. 현재 오프라인 가정은 철회한다.
- 기기 상태 파일을 HA 역방향 터미널에서 읽음: 수집기 running, delivery retrying,
  reason `HTTPError HTTP 500`, pending 약 818건. SQLite mode=ro·query_only 조회 결과
  telemetry 816건, trips 2건. 대기열 선두는 09:25:50 KST 텔레메트리.
- 미전송 주행은 09:29:22~09:31:18(369.2m)와 16:06:35~17:50:18(101,000m,
  durationS 6,221). 오후 기록은 기기 outbox에 보존돼 있으나 클라우드 미수신이다.
- 실행 커밋의 collector.py·engine.py를 GitHub에서 확인: 최신 텔레메트리와
  oldest outbox를 번갈아 전송하며 oldest 실패 시 최신 텔레메트리로 되돌아간다.
  따라서 온라인 상태 갱신과 오래된 행 뒤의 주행 업로드 정체가 공존할 수 있다.
  영상/rlog 송신 완료를 기다리는 주행 API 조건은 해당 수집기 코드에 없다.
- HTTP 500 응답 원문의 원인은 아직 미확인. Worker 오류 스트림 접속은 응답 대기;
  HA SSH 앱 Docker 보호 모드로 컨테이너 로그 조회 불가, 보호 모드는 변경하지 않았다.
  기기 파일 수정·대기열 삭제·재부팅·수동 원본 재전송은 수행하지 않았다.
- 후속 원인 확정: 운영 Worker 오류 스트림에서 `/api/telemetry` HTTP 500과
  `D1_ERROR: Exceeded maximum DB size`, handleArchivedTelemetry 저장 실패 확인.
  D1 info 실제 bytes=499,998,720. 읽기 전용 단일 집계 결과 telemetry_history
  54,965행·본문 합계 440,754,890 bytes, 14일 초과 29,865행, 가장 오래된 시각
  2026-07-28, 가장 최근 저장 2026-10-14 09:24:50 KST.
- 인과관계: D1 용량 초과 → 09:25:50 상태 이력 저장 실패 → oldest-first 대기열
  정체 → 뒤의 오후 주행 미전송. latest 우선 경로로 온라인 상태는 갱신될 수 있다.
  영상/rlog 완료 조건이 일반 주행 업로드를 막았다는 증거는 없다.
- 보관 정리 관련: 로컬 Worker는 기본 14일 telemetry purge 및 scheduled handler가
  있으나 wrangler.json에 cron 설정이 없다. 실제 원격 예약 설정·과거 정리 실패 원인은
  미확인으로 남긴다. 장기 잔존 행은 운영 집계로 확인했다.
- 조사 완료 후 HA 원격 터미널 연결 해제. 복구·DB 삭제·보관 정책 변경·코드 배포는
  이번 원인 분석 요청에서 수행하지 않았다. 조사 문서만 커밋·푸시 대상이다.
- 과거 다이어트 범위 대조: 2026-10-04 `68d6a28`은 HA 로컬 archive_codec/storage
  압축 구현이며 Cloudflare 파일 변경 없음. docs/sqlite-lossless-compression.md에도
  Worker·D1·Comma 변경/배포 없음이 명시돼 있다. 운영 HA 압축 결과는 약
  415MB→213MB로 별도 기록돼 있다. Cloudflare 압축의 배포 누락으로 해석하지 않는다.
- 별도 보관 정책 커밋 `9fcf64b`(2026-09-17)은 HA와 Worker purge를 추가했다.
  운영 Worker 배포 조회 최신은 2026-10-03 02:25:46 KST,
  version d73bcf6c-1ac4-48cd-84ae-0eaeec74a866. 원격 예약 실제 설정은 미확인.

- 사용자 범위: 16~17시 일반 차량 대시보드 주행 내역. 영상/rlog 로그 목록과 구분한다.
- HA 읽기 전용 조사: 상태 최신 19:51:31 KST, 주행 최신 종료 09:18:31 KST.
  클라우드 최근 주행도 같은 오전 기록이며 trip-changes after=392 응답은 빈 목록,
  next_cursor=392, has_more=false. HA 커서도 392로 일치한다.
- 당근웹 파일 로그는 314개 구간 모두 완료, 최신 17:51:41 KST. 따라서 일반 주행
  누락을 영상/rlog 완료 조건 탓으로 설명하지 않는다. 일반 주행 생성·클라우드 업로드
  구간으로 원인 범위를 좁혔으나 기기 원인·전송 대기열은 아직 확인하지 못했다.
- 사용자 보고: Comma 현재 오프라인. 오프라인 발생 원인·시각과 누락 인과관계 미확인.
- 사용자 요구: 파일 로그 업로드와 일반 주행 내역 업로드는 서로 의존하면 안 된다.
  HA 경로는 파일 직접 수신과 클라우드 주행 동기화로 분리돼 있다. Comma 실행판의
  작업·자원 결합 여부는 추가 확인 필요. 로컬 코드만으로 실기 상태를 단정하지 않는다.
- 관련: HA driving_logs/store.py, cloud.py, 로컬 openpilot ha/collector.py·engine.py.
- 검증: 운영 색인·DB·클라우드의 제한된 시각/집계/커서만 조회. GPS·영상·토큰 미출력.
  광범위 진단 필드 출력은 자동 승인 심사에서 거절되어 수행하지 않고 안전한 집계로 제한했다.
- 배포: 실행 코드·설정·운영 DB 변경 및 재시작 없음. Worker/D1/KV 배포 없음.
