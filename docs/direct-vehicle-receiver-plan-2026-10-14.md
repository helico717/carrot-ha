> **2026-10-14 서버 경로 변경:** Cloudflare Worker/D1/KV 관련 설치·배포·한도 설명은 폐기된 과거 기록입니다. 관련 코드 블록을 현재 설치에 실행하지 마세요. 현재 절차: [직접 수신기 설치·복구](CLEAN_INSTALL_RECOVERY.md). 과거 장애 증거·기록 ID는 보존합니다.

# ~~Cloudflare~~ 의존 제거와 HAOS 차량 수신 애드온 전환 기록

작성: 2026-10-14. 본 문서는 실행 코드 수정 전에 작성한 작업 기준이다.

## 왜 하는가

- 원작은 자체 서버 없이 ~~Cloudflare~~ Worker/D1을 차량과 앱 사이의 접점으로 사용했다.
- 현재 사용자는 Raspberry Pi 4 + HAOS 자체 서버를 운영하고 HA를 주 화면으로 사용한다.
- 2026-10-14 ~~D1~~ 물리 용량 499,998,720 bytes로 이력 업로드가 HTTP 500 실패했다.
  압축/중복 제거로 약 281MB로 복구했지만 무료 일일 100,000행 쓰기 제한은 별개다.
  이번 대량 변환과 구조/색인 변경도 쓰기 예산을 소비해 제한 알림이 발생했다.
- 이미 HA에 보관하는 기록을 Cloudflare에도 저장하고 다시 다운로드하는 중복,
  두 저장소의 커서/보관 확인과 외부 계정 제한 때문에 발생하는 장애를 줄인다.
- HA 본체 재시작 동안에도 차량 데이터를 받을 수 있도록 독립 애드온으로 수신한다.

## 사용자 요구와 범위

- 사용자는 자체 서버 직접 통신으로 변경을 요청했고, 본격 수정 전에 모든 이유와
  보존 기준을 기록하도록 요청했다. 단 하나의 기존 기능도 바뀌어서는 안 된다.
- 화면·카드·엔티티·계산·통계·분류·명령 의미·안전 차단·파일 보관 정책을 유지한다.
  추가하는 설치/연결 설정은 전환을 위한 관리 기능이다. 기능 삭제/통합/디자인 변경은 금지.
- Comma 원본 소스는 Git 커밋·푸시로만 배포한다. SSH/SCP 소스 수정 및 에이전트
  기기 재부팅은 금지. HA 본체 재시작과 Comma Pull/재부팅은 사용자가 실행한다.
- 현재 개별 주행 로그 지침의 버전·태그·Release 없이 개발하는 원칙을 유지한다.
  이번 요청만으로 새 pre-release 발행 권한을 추론하지 않는다.
- 운영 ~~Cloudflare~~ 삭제/Worker 중지/기존 DB 삭제는 전환 검증 전에 수행하지 않는다.
  이전 데이터는 기존 HA archive·차계부와 승인된 개인 백업을 보존한다.

## 수정 전 기준과 현재 경로

- HA main: manifest 0.8.14-beta.7. 실행 중 HA는 마지막 확인 beta.5.
- cloud.py/cloud_live.py: ~~Worker~~ latest-state, telemetry-history, trip-changes를 읽고
  Archive.put_cloud로 저장. 같은 이벤트 ID·동일 내용은 중복 갱신하지 않는다.
- HA 설정 조회/변경/처리 확인: __init__.py의 SettingsView/ParamSetView/ParamStatusView
  → ~~Worker~~ /api/settings 및 /api/params/{queue,status}.
- Comma collector.py: 독립 telemetry/trips 전송 lane + SQLite outbox. 성공 응답 이후 삭제.
- Comma param_sync.py: pending 조회 → 로컬 7000 검증·적용·readback → applied/failed ACK.
  처리 ID는 기기에 영속 저장한다. 서버 변경 시 숫자 ID 충돌을 막아야 한다.
- terminal_bootstrap.py 및 ~~Worker~~ terminal_bootstrap.js: HA가 주소/별도 토큰을
  짧은 유효기간으로 게시, Comma가 조회한다. 터미널/카메라/파일 본 통신은 HA 직접 경로.
- 파일 driving_logs/http.py: HA 원본 수신; 영상·rlog 완료와 일반 주행 저장은 독립.
- Worker에는 원작 Android/FCM/impact/snapshot/AI/별도 외부 서버 관련 함수도 존재한다.
  현재 실제 fetch 라우팅·호출 여부와 HA 기능을 구분한다. 비활성 함수를 운영 기능으로
  단정하지 않으며 원작 앱 전체 호환은 별도 검증 없이 완료 주장하지 않는다.

## 보존할 기능 목록

| 영역 | 반드시 유지할 동작 | 근거 파일/검증 |
| --- | --- | --- |
| 차량 상태 | CAN 수집/주기, 최신 상태 우선, SOC·전압·온도·GPS·온라인 시각 구분, 오래된 응답 거절 | telemetry.py, cloud_live.py, connectivity.py, openpilot collector/telemetry_fields |
| 주행 내역 | 거리·시간·경로·측정 품질·부분 관측, 기존 동일 ID 갱신, 긴 주행/병합과 날짜 탐색 | cloud_feed.py, storage.py, trip_repair.py, test_incremental_sync |
| 충전/배터리 | 실제 충전 증거·AC/DC·SOC/에너지·금액·원본/추정, 14일 배터리 페이지 | charging_mode/power.py, charge_costs.py, battery_history.py 및 기존 테스트 |
| 대시보드 | 한국어/영어/디버그·lazy 로딩·15초 최신 확인·공유 HA 캐시·스크롤/포커스/지도/선택 보존 | dashboard-live/lazy/view-state 테스트 |
| 차계부 | 자동 주행/충전 투영, 결제 양방향 수정, 수동 분류/메모/사진·차량·OCR·이관·복구·NAS 백업·장소/가격/통계 | vehicle_journal 기존 전 파일 및 별도 지침, 실행 코드 비수정 원칙 |
| 파라미터 | catalog/values, 15초 idle/3초 active와 backoff, 범위 검증, 내구성 queue-ID 중복 방지·readback·명시적 실패·ACK 재시도 | param_sync.py, HA 튜너 카드, test_param_polling |
| 터미널 | 관리자 전용, 주차 중 연결·권한 취소·PTY 제한·Git 상태, 사용자 Pull/재부팅 버튼 | terminal_relay/http/ws.py, openpilot terminal.py 및 테스트 |
| 주차 카메라 | WebCodecs·WLV1·360°/PTZ·기존 enabled/token 설정·주행 전환 중단 | camera_relay/session/http.py, openpilot camera 및 안전 차단 테스트 |
| 파일 로그 | 목록·썸네일·영상·원본 다운로드·리플레이/HUD·GPS, 기존 HA 저장 위치, 최신 10GB 전체 주행 단위 정리 | driving_logs 전 모듈 및 UI 테스트 |
| CAN 분석 | 수동 수집/다운로드와 별도 제한 저장, 차량 제어 CAN TX 없음 | can_capture.py |
| 기존 자료 | HA archive·journal·사진·설정·과거 날짜 기록 보존, 새 서버 커서 독립 관리 | source cursor 테스트·실제 전환 전후 비교 |

## 목표 구조와 구현 원칙

Comma → HTTPS 차량 수신 애드온(영속 SQLite) → HA 로컬 동기화 → 기존 엔티티/화면.
파일 영상/rlog·카메라·터미널은 기존 HA 직접 전송을 유지한다.

- 수신 애드온은 HA Core와 별도 컨테이너로 실행하고 HA API/화면 없이 수신 가능하다.
- device별 전용 upload/view 자격 증명. 다른 차량·권한·인증 실패는 거절한다.
  토큰과 GPS 원문은 기록/로그/Git에 포함하지 않는다.
- 기존 telemetry/trip wire 형태와 응답을 지원해 계산/품질을 바꾸지 않는다.
  DB commit 이후 성공 응답, 재전송은 idempotent. 최신 상태와 catch-up 독립.
- HA는 local receiver 전용 설정을 사용하고 cloud 설정을 남겨 명시적 rollback 가능하게 한다.
  direct mode 실패 시 Cloudflare로 몰래 fallback하지 않는다.
- source identity별 telemetry/trip cursor를 분리한다. 기존 HA 이벤트 키를 유지해
  새 source에서 재수신해도 같은 기록이 중복되지 않도록 한다.
- 명령 namespace를 서버마다 분리하고 Comma에 보존한 이전 처리 ID를 지우지 않는다.
- bootstrap 게시·조회도 자체 수신기에 둔다. HA restarts 중 telemetry/trip 수신은 계속,
  기존 짧은 유효기간/취소 의미는 유지하여 shell 권한을 무한 연장하지 않는다.
- CPU 작업/SQLite는 HA event loop 밖에서 처리. HA 데이터 조회가 추가 외부 쿼리를 만들지 않는다.
- 통신 destination 전환은 Git 관리 설정 적용 기능/HA 관리 경로를 사용하고
  Comma 소스·connection.json 수동 덮어쓰기를 요구하지 않는다.

## 관리·백업·이전·복구

- HAOS 저장소에 설치 가능한 애드온, 자동 시작/비정상 종료 재시작과 상태 로그 제공.
- 데이터와 설정은 애드온 /data 영속 저장, HA 백업에 해당 애드온을 명시적으로 포함.
  DB 일관성은 백업 전 checkpoint/안전 종료 또는 SQLite 일관된 backup으로 검증한다.
- HA 기존 archive/journal와 수신기 DB를 함께 복원해야 한다. 영상은 별도 선택 백업.
- ARM64 Raspberry Pi와 AMD64 이전을 고려한다. HA Container 이전은 동일 서비스의
  독립 컨테이너 실행과 DB/설정 복원 방법을 제공한다.
- 고정 도메인을 유지하고 IP 변경만 갱신. 새 장치 복원 후 자격 증명·주소·수신과
  오래된 기록을 확인하며 기존 수신기를 중지해 이중 서버 분기를 방지한다.
- 같은 장치 밖의 백업과 암호화 복구 키 보관 필요. 인증/로그/개인 자료 외부 공개 금지.

## 외부 도달성과 피할 수 없는 차이

- 직접 HTTPS/WSS 접속 또는 VPN 도달성 확인이 필요하다. HA의 UI ingress 경로만으로
  차량 수신을 만들면 HA 중단 시 끊기므로 수신기의 독립 포트/외부 경로가 필요하다.
- ~~Cloudflare~~ Tunnel/프록시 주소를 쓰면 D1/Worker는 없어도 네트워크는 여전히 Cloudflare를
  통과한다. 완전 제거와 DB 제거를 혼동하지 않는다. 현재 외부 네트워크는 확인 대상.
- HA Core 재시작 시 애드온 수신 가능. HAOS/호스트 재부팅·정전·회선 장애 시 모두 중단.
  Comma outbox로 기록은 재전송하지만 실시간 화면·카메라·명령은 지연된다.
- "기능 변경 없음"은 기존 기능 의미·데이터·사용 흐름 보존이며, Cloudflare와 집 서버의
  가용성이 같다는 보장은 불가능하다. 이 차이를 숨기거나 검증 없이 무중단 주장하지 않는다.

## 검증 및 전환 순서

1. 본 기록 저장·커밋·푸시를 먼저 완료하고 이후 실행 코드 수정.
2. 자체 수신기 auth/isolation·중복/순서 역전·재시작/부분 실패·SQLite 복원·명령 충돌/
   ACK·보관 예산·이력 catch-up 테스트. backlog 중 latest/trip 독립성 확인.
3. 기존 HA regression gates와 charge/journal/camera safety/log 테스트 및 Comma daemon
   suite 실행. Windows 환경 실패를 실제 기기 장애와 구분한다.
4. HAOS 실제 설치/외부 도달성 및 수신기 실행 확인. 기존 DB 백업과 비교 자료 확보.
5. HA 설치 코드·기기 Git 커밋 준비와 원격 확인. 사용자 restart/Pull 후 direct 전환.
6. 차량 새 상태/주행/파라미터 성공·실패·재시도, 카메라/터미널/영상/로그와 과거 자료,
   HA Core 재시작 중 수신·이후 catch-up·backup restore 검증.
7. 실제 검증 전 기존 ~~Cloudflare~~ DB 삭제/수신 중단 금지. 잔존 의존 확인 후 사용 종료.
   24시간 부하·디스크 증가/보관 정리 및 실차 결과는 로컬 테스트와 별도 기록.

## 사전 작성 시 상태

실행 코드 수정 전. 이 문서와 CHANGELOG만 작성. 네트워크·운영 설치·실차 검증 미완료.
후속 구현·검증·배포 기록을 각 단계에 추가하며 미완료를 완료로 보고하지 않는다.

## 구현·검증 중간 기록

- 3c9e4f0 사전 계획 원격 게시 후 실행 코드 작성. 8303aae 독립 수신기/HA 직접 경로 게시.
- 실제 HAOS 18.1/rpi4-64, 수신 애드온 저장소 등록·ARM64 빌드 및 실행 성공.
  독립 hostname/8099 health와 기존 DuckDNS/443의 /carrot-receiver/health 모두 200.
  Nginx Proxy Manager 공식 사용자 include에 경로 추가, HA 기존 / 응답 200 확인.
- HA 소스는 기존 파일 백업 후 62개 hash/문법 확인(54개 변경, 8개 동일).
  DB·사진·설정은 동기화하지 않았으며 사용자 HA Core 재시작은 미실행.
- 초기 SSH 사용자에게 /addons 쓰기 권한이 없어 직접 로컬 설치는 진행하지 않았고,
  공식 Supervisor store repository/install 경로로 설치했다. 보호 모드 변경 없음.
- 직접 전환을 위해 Git 관리 공개 URL 매핑을 추가한다. 원래 장치 upload 인증으로
  자체 서버 /api/provision에서 새 전용 연결 설정을 받아 runtime /data에 저장한다.
  공개 Git에는 도메인 매핑만 포함하고 토큰/장치 식별은 포함하지 않는다.
  일시 실패 때 이전 cloud로 보내지 않고 대기한다. 장치 Pull/재부팅은 사용자 수행.
- HA는 operator가 준비한 비공개 일회 설정을 다음 사용자 재시작 때 적용하고 나머지
  options를 보존한다. 적용된 준비값이 이후 사용자 설정을 덮어쓰지 않도록 소비 표시한다.
- Comma는 사용자 확인으로 켜짐/인터넷 연결 상태로 갱신. ~~Cloudflare~~ 장애 가능성만
  보고됐으며 실제 기기 원인 단정/에이전트 기기 재부팅은 하지 않았다.
- 기능 회귀: 수신 10·HA 증분 5/latest 6/ACK 1/압축 2/cache 1·대시보드 10,
  충전 74/주행 73/카메라 17(1 skip)/터미널 4/로그 15(1 skip) 통과.
  Comma 기존 69 중 Windows fcntl 2·symlink 1·bash 경로 1 실패, 나머지 65 통과.
  신규 연결 4·기존 polling 4 통과. 차계부는 CHANGELOG에 환경 실패를 구분 기록.
- 아직 사용자 재시작·Comma Git 업데이트/전환·실차 동작·24시간 관측·HAOS 실제
  백업 복원은 미완료다. 전체 기능 무영향/전환 완료를 주장하지 않는다.

## 2026-10-14 최종 배포 준비·인계

- 수신기 0.1.2 설치/실행, boot auto/Watchdog 확인. 실제 외부 HTTPS health 200,
  provisioning 200 및 scoped credential 내부 대조 성공. 기존 HA / 응답 200.
- HA 최종 실행 소스 63개 SHA-256/문법 검증. 코드는 967beff와 동일하며 이후
  main 21b358d는 수신기 측 기존 주행 품질 보존 보정이다. 새 HA 태그/Release 없음.
- 일회 직접 연결 설정은 HA 서버 내부 0600 파일에 준비했다. 다음 사용자 HA Core
  재시작 때 기존 모든 options를 보존하고 receiver 필드만 적용한다. HACS 재다운로드는
  직접 배포한 개발 코드를 덮어쓸 수 있으므로 이번 설치 절차와 혼용하지 않는다.
- 기존 HA archive를 같은 서버의 비공개 복구 폴더에 SQLite online backup으로 저장,
  integrity_check=ok. 마지막 상태 1건은 자체 수신기에 초기화했고 원래 측정 시각을
  보존했다. GPS/토큰/본문을 PC·출력·Git으로 옮기지 않았다. 과거 HA 기록은 삭제하지 않음.
- Comma 최종 원격 40148b0dc66744636ea4fcfe270e7365b758a4b5 확인.
  537f5d90·cd24a0ec·40148b0d로 초기 인증 실패 중에도 CAN/outbox 보관 지속,
  인증 완료 후 공유 전송/CAN 파일/파라미터 credential 갱신을 보정했다.
  신규 직접 연결 6·기존 parameter polling 4·outbox lane 1 통과.
- 사용자 적용 순서: HA 화면의 Home Assistant 다시 시작 → Comma 지정 브랜치에서
  당근웹 Git 업데이트·재부팅 또는 `cd /data/openpilot && git pull --ff-only && sudo reboot`.
  기존 HA 터미널이 불가하면 첫 설치는 당근웹/기존 로컬·VPN 경로가 필요하다.
  이후 장치 인증으로 자체 서버에서 연결 설정을 받아 영구 저장하며 ~~Cloudflare~~ 호출 없음.
- 현재 HA 실행 프로세스와 Comma 설치 소스는 사용자 재시작/업데이트 전이다.
  새로운 실제 telemetry/trip/params/camera/terminal/log와 HA Core 재시작 중 수신,
  실제 HAOS backup restore·24시간 부하 검증은 사용자 적용 후 확인 대상이다.
- ~~Cloudflare~~ 원본 DB·기존 옵션은 검증 중 복구용으로 보존한다. 직접 mode 오류에
  자동 cloud fallback은 없으며 cloud 복귀는 명시적 rollback만 가능하다.

## 사용자 적용 후 운영 확인

- 추가 사용자 확인: 22:20:38~22:20:49 새 당근웹 대시캠 파일 로그(1세그먼트)가
  HA 목록에 표시됨. 파일 로그 표시의 실기 확인으로 기록한다. 별도 자체 수신기
  일반 trip feed는 여전히 0건/cursor=0이며 일반 주행 저장·표시 확인과 구분한다.

- 사용자는 HA와 Comma 업데이트/재부팅 완료, HA 원격 터미널과 주차 카메라 정상
  사용을 직접 확인했다. 원격 접속 복구를 우선한 실사용 확인은 완료 상태다.
- 읽기 전용 서버 점검으로 수신기 0.1.2 started, HA 직접 source 옵션 적용과 일회
  setup 소비, HA 상태 이력 cursor=103 확인. 마지막 기기 측정은 22:23:51 KST.
  기기 telemetry는 게시한 40148b0d와 carrot-wip-model_selector-ha를 보고한다.
- 아직 새 수신기에 trip은 0건이며 기존 HA 과거 기록은 보존한다. 다음 실제 주행
  저장/표시·명령 applied/failed 확인·영상/rlog 신규 동기화·HA Core 재시작 동안
  수신·실제 HAOS 백업 복원·24시간 부하는 별도 확인 대상이다.
- 추가 기기 업데이트/재부팅은 요구하거나 실행하지 않았다. 기능 변경 없이 확인
  기록만 추가하며, 이 확인을 모든 기능/장기 검증 완료로 확대하지 않는다.
