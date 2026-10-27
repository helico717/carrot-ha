# 현재 차량·HA 연결 구조

2026-10-27 코드 대조 기준. 현재 운영 방식은 Comma가 집 서버에 직접 연결하는 방식이다.
Cloudflare Worker/D1/KV는 설치하거나 배포하지 않는다. 직접 연결에도 집 서버의 HTTPS
역방향 프록시가 있으며, 기능에 따라 독립 수신 앱과 HA Core로 전달한다.

```text
Comma → 외부 HTTPS 역방향 프록시
          ├─ /carrot-receiver/* → Carrot Vehicle Receiver :8099
          │                       ↕ HAOS 내부 HTTP
          │                      HA 통합 → 로컬 기록·센서·화면
          └─ /api/carrot_ha/* → HA Core ↔ 인증된 브라우저
                               터미널·카메라·영상/rlog
```

## 기능별 경로

| 기능 | 경로와 역할 |
| --- | --- |
| 차량 상태·일반 주행 기록 | Comma가 수신 앱의 `/api/telemetry`, `/api/trips`에 POST한다. 수신 앱은 자체 SQLite에 보관한다. HA는 내부 주소에서 최신 상태·이력을 조회해 HA 로컬 archive에 저장한다. |
| 파라미터 | 차량 설정은 `/api/settings/sync`로 수신한다. HA가 `/api/params/queue`에 명령을 넣고 Comma가 `/api/params/pending`을 조회해 적용·검증 후 `/api/params/ack`로 결과를 보낸다. |
| 터미널 접속 안내 | HA가 수신 앱의 `/api/terminal/bootstrap`에 외부 HA 주소·터미널 인증을 60초마다 게시한다. 정보 유효기간은 180초다. 차량은 이를 읽어 HA에 연결한다. |
| 터미널 본 통신 | Comma가 HA의 `/api/carrot_ha/v1/terminal/{device_id}`에 역방향 WebSocket을 연결한다. 명령·출력은 브라우저 ↔ HA ↔ Comma로 전달한다. 수신 앱은 본 통신을 중계하지 않는다. |
| 주차 카메라 | Comma → HA의 `/api/carrot_ha/v1/camera/{device_id}` → 브라우저의 `/live` 연결. HA가 실시간 영상을 중계하며 독립 수신 앱은 영상을 받지 않는다. |
| 주행 영상·rlog | Comma → HA의 `/api/carrot_ha/v1/driving_logs_upload/{device_id}/…`로 파일·청크·완료 정보를 전송한다. 일반 주행 요약과 별도 저장·보관 경로다. HA/NAS 보관은 주행 로그 정책을 따른다. |

## 주소와 인증

- 차량용 수신기 주소: `https://<집 서버 도메인>/carrot-receiver`. 프록시는 이 접두사를 제거해 수신 앱에 전달한다.
- HA 통합의 `receiver_url`: `http://<실제 수신기 hostname>:8099`. 차량용 외부 주소와 구분한다.
- 터미널·카메라용 HA 외부 기본 주소: `https://<집 서버 도메인>`. `/carrot-receiver`를 붙이지 않는다. WebSocket 전달을 허용해야 한다.
- 수신 앱은 차량별 upload/view 키를 구분한다. 상태 업로드·명령 조회/응답·bootstrap은 upload 인증, HA 조회·명령 등록 등은 view 인증을 사용한다.
- 터미널은 별도 terminal 키, 카메라는 별도 camera 키를 사용한다. 주행 로그 업로드는 terminal 키에서 HMAC으로 파생한 전용 인증을 사용하며 터미널 활성화 설정도 검사한다.
- 자동 전환용 provision 키는 기존 설치 전환용이다. 신규 수동 설정에 필수인 키가 아니다. 실제 키는 문서·로그·Git에 넣지 않는다.

## 조회·저장·장애 범위

HA 이력 동기화는 60초 간격이다. 화면의 최신 상태 조회는 이력 처리와 분리하고,
동일 HA 항목의 요청을 성공·실패 모두 최대 15초마다 병합한다. 조회 성공 시각은
차량 측정 시각과 다르며, 화면을 새로고침해도 차량을 깨우거나 새 CAN 측정을 요청하지 않는다.

수신 앱은 `/data/receiver.sqlite3`에 보관한다. HA는 `/config/carrot_ha/` 아래에
로컬 기록을 유지하고 영속 저장 완료 후 `/api/archive-ack`로 확인한다. 수신 앱의
기록 정리는 ACK와 보관기간을 기준으로 한다. 수신 앱은 전체 과거 기록의 영구 백업이 아니다.

HA Core만 다시 시작하면 독립 수신 앱은 계속 기록을 받을 수 있다. 터미널·카메라·
영상/rlog 업로드는 HA Core에 의존하므로 중단·재연결 대상이다. HAOS 전체 재부팅,
정전·회선·프록시 장애는 두 경로 모두에 영향을 줄 수 있다. 차량 재전송 가능 범위는
차량 대기열·저장 공간·실제 실행 상태에 따라 달라진다.

## 과거 설정과 현재 경로를 구분하는 법

`receiver_url`이 설정되면 자체 수신기를 사용하며, 실패 때문에 `cloud_url`로 자동
전환하지 않는다. `receiver_url`이 없는 이전 설정용 호환 분기는 코드에 남아 있다.
`cloud.py`, `cloud_live.py`, `cloud_status` 등 내부 이름은 현재 수신기 통신에도 사용되므로
파일명이나 엔티티 이름을 Cloudflare 사용의 증거로 해석하지 않는다.

`cloudflare/`, 과거 changelog·릴리즈·장애 조사 자료는 이전 구현의 증거와 라이선스를
보존한다. 과거 명령은 현재 설치 절차가 아니다. 과거 자료를 수정할 때 기록 ID·사건의
서비스명을 현재 수신기로 치환하지 않는다. 전환용 과거 URL 식별자도 접속 fallback과 구분한다.

## 설치와 검증 범위

설치·복구는 [CLEAN_INSTALL_RECOVERY.md](CLEAN_INSTALL_RECOVERY.md), 배포는
[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md)를 따른다.

이 문서는 로컬 HA·수신 앱 코드와 설치 문서의 대조 결과다. 운영 서버의 프록시·기기
설정·최신 배포 성공을 새로 검증한 보고서가 아니다. 이번 조사 환경에는 지정된 로컬
openpilot 경로가 없어 차량 측 최신 소스는 대조하지 못했다. 차량 동작은 HA의 수신 API와
기존 설치 문서에 근거해 설명한다.

코드 근거: `addons/carrot_receiver/receiver.py`, HA 통합의 `cloud.py`, `cloud_live.py`,
`terminal_bootstrap.py`, `terminal_http.py`, `camera_http.py`, `driving_logs/http.py`, `__init__.py`.
