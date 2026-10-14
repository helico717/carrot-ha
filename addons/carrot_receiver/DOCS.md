# Carrot 차량 수신기

HAOS 안에서 HA 본체와 독립적으로 차량 상태·주행·파라미터 명령을 보관합니다.
HA Core 다시 시작 중에도 수신하며, HAOS 전체 재부팅·정전·회선 중단 중에는
차량 대기열에서 재전송합니다. 카메라·터미널·영상 파일은 기존 HA 경로를 유지합니다.

## 설치와 설정

저장소 `https://github.com/helico717/carrot-ha`를 애드온 스토어에 추가하고
Carrot Vehicle Receiver를 설치합니다. ARM64 HAOS와 AMD64를 지원합니다.
장치 ID, 서로 다른 32자 이상 랜덤 upload_token/view_token을 설정합니다.
토큰은 대시보드 자산·로그·Git·공개 문서에 넣지 않습니다.

```yaml
devices:
  - device_id: YOUR_DEVICE_ID
    upload_token: YOUR_RANDOM_UPLOAD_TOKEN
    view_token: YOUR_DIFFERENT_RANDOM_VIEW_TOKEN
max_database_mb: 1024
```

자동 시작과 Watchdog를 켭니다. HA 통합에서 자체 수신기 주소를
`http://<수신기 애드온 hostname>:8099`로, 조회/업로드 토큰을 동일하게 설정합니다.
원격 차량은 HTTPS 프록시의 `/carrot-receiver`를 통해 연결합니다. HTTP 포트는
기본 외부 노출하지 않으며 HA UI ingress를 차량 업로드 경로로 쓰지 않습니다.
HAOS 정보 API에서 실제 hostname을 확인하고 설치 방식에 따른 값을 사용합니다.

HA에 자체 수신기 주소가 있으면 상태/주행/파라미터/연결 게시를 해당 수신기에만
보냅니다. 실패해도 Cloudflare로 자동 전환하지 않습니다. 기존 Cloudflare 설정과
DB는 전환 검증 및 명시적 rollback을 위해 그대로 보존합니다.

## 이전 설정에서 직접 연결로 전환

이번 설치에서는 Git 관리 공개 URL 매핑과 기존 장치 upload 인증을 통해 신규
설정을 자동으로 받습니다. 사용자 HA 재시작 후, Comma에서 지정 브랜치 Git Pull과
재부팅을 하면 직접 연결 설정을 받습니다. Cloudflare API 호출 없이 자체 서버의
`/api/provision`을 사용합니다. 초기 설정 실패 시 cloud로 자동 복귀하지 않습니다.
기존 HA 원격 터미널이 연결되지 않으면 당근웹 또는 이미 가능한 로컬/VPN 경로에서
첫 Git 업데이트를 실행해야 합니다. 새 코드 설치 전에는 새 연결을 사용할 수 없습니다.

코드는 Git Pull로 설치합니다. Git 관리 `direct_connection` 명령이 JSON stdin을
검증하고 `/data/carrot_ha/direct-connection.json` 영구 설정을 원자적으로 저장합니다.
기존 connection.json과 원본 소스는 건드리지 않습니다. 사용자 토큰을 shell history에
넣지 않도록 HA 관리 경로에서 입력합니다. 설정 후 사용자 기기 재부팅이 필요합니다.
새 url은 `https://<직접 접속 도메인>/carrot-receiver`, device는 기존 ID 그대로입니다.

rollback은 이 모듈의 `--rollback`으로 직접 설정만 제거한 뒤 사용자가 재부팅합니다.
명시적 rollback 표시를 남겨 자동 provisioning이 다시 직접 연결을 켜지 않게 합니다.
HA 쪽 자체 수신기 주소도 비우고 사용자 재시작해야 기존 source로 돌아갑니다.
차량 outbox·파라미터 처리 DB·HA archive/journal 기록은 지우지 않습니다.
파라미터 queue namespace는 수신 DB identity별로 분리하여 Cloudflare 숫자 ID와 충돌하지 않습니다.

## 보관과 제한

본문은 무손실 압축해 저장합니다. HA 영속 저장 확인 이후 14일 지난 telemetry,
90일 지난 주행만 시간당 제한 정리합니다. 기존 HA 보관 정책은 그대로입니다.
수신기 공간 한도는 기본 1GiB이며 초과하면 재시도 가능한 503을 반환합니다.
미수신 기록을 삭제하거나 저장 실패를 성공으로 응답하지 않습니다. 인덱스·WAL도
공간에 포함됩니다. 저장장치 전체 공간·수명·정상 부하와 유지 관리 관측은 별도로 필요합니다.

## 백업·복원·이전

HA 백업에 **이 애드온과 HA 설정/Carrot 데이터 모두** 포함합니다. 애드온 /data에
SQLite DB와 설정을 저장합니다. 백업 시 Supervisor가 수신기를 잠시 정지하는 cold
백업으로 일관성을 확보합니다. 그동안 차량은 기록을 보관했다가 다시 보냅니다.
일반 HA Core 재시작은 이 애드온을 중지하지 않습니다.

새 HAOS에 백업을 복원하면 기록과 receiver identity/명령 큐를 유지합니다. 새 서버
외부 도메인·프록시 설정·인증서와 hostname을 확인하고 이전 수신기는 중지합니다.
복원 후 과거 기록·새 상태·주행 수신·파라미터 처리를 확인하기 전 기존 백업을 삭제하지 않습니다.
백업은 기기 밖에도 보관하고 암호화 복구 키를 따로 보관합니다. 영상/rlog는 기존
HA 파일 저장소에 있으며 크기가 커서 별도 선택 백업합니다.

HA Container로 이전할 때는 이 Dockerfile의 서비스에 영구 /data 볼륨을 마운트해
실행합니다. 기존 options.json과 SQLite 온라인 backup 또는 정지 상태의 DB/WAL
전체를 복원합니다. 실행 중 DB 파일만 복사하지 않습니다. 새 데이터베이스를 만들면
source identity가 바뀌고 HA가 독립 커서로 재수신합니다.

## 배포 상태

자세한 검증/실기/설치 결과: `docs/direct-vehicle-receiver-plan-2026-10-14.md`.
코드/테스트 성공과 실차 검증을 구분합니다. 이 문서만으로 전환 완료를 주장하지 않습니다.

## 로그 화면 사용법 — 0.1.3

앱의 **로그** 탭에서 시각, 시작 버전, 수신·저장·HA 저장 확인(ACK), 명령 처리 결과와
분당 요청 요약을 확인합니다. 로그 끝의 Z 시각은 한국보다 9시간 느립니다.
예를 들어 13:00Z는 한국 22:00입니다. 기본 `log_level: INFO`를 사용합니다.
문제 발생 시 구성에서 `log_level: DEBUG`, `debug_minutes: 15`를 저장하고 앱을 재시작합니다.
설정한 1~60분 뒤 실행 중 로그 수준은 INFO로 돌아갑니다. 다음 재시작 전에 구성도 INFO로 돌려놓으세요.
같은 오류는 30초 동안 묶어 출력합니다. `/data/logs/receiver.log`와 이전 파일 3개를
각각 최대 2MiB로 순환 보관합니다(대략 최대 8MiB). 무기한 보관이 아닙니다.
HA의 로그 다운로드는 앱 출력이며 과거 순환 파일 전체를 자동 합친 파일은 아닙니다.
토큰·GPS·전체 CAN·영상·인증 헤더·실제 장치 ID·오류의 원본 메시지는 기록하지 않습니다.

이 화면은 **수신 앱 처리 로그**입니다. HA 본체와 Comma의 모든 로그를 합친 화면은 아닙니다.
문제 분석에는 발생 시각과 관련 HA/Comma 로그도 함께 확인해야 할 수 있습니다.

신규 설치 및 HA만/Comma만/둘 다 초기화: [쉬운 복구 안내](../../docs/CLEAN_INSTALL_RECOVERY.md).
이전 키가 없는 신규 Comma는 복구 안내의 설정 도구로 직접 설정합니다.
자동 전환용 `provision_token`은 기존 설치 전환 때만 필요하며 신규 설치에는 필수가 아닙니다.
