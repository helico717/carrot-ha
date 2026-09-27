# 카메라 연동 조사 및 검증 순서

조사일: 2026-09-27. 소스 조사와 실기기 검증 이력이다. 설치 가능한 초기 구현은 [CAMERA_SETUP.md](CAMERA_SETUP.md)를 따른다. HAOS/iOS 최종 재생과 실차 장시간 검증은 아직 남아 있다.

## 확인한 환경

- comma four, ajouatom/openpilot `happymaj11r/carrot-wip-model_selector`, 커밋 `5cb0f3e590a28d0138ad9f48506f65743cdaa326`.
- HAOS ARM64, HA Core 2026.9.0. DuckDNS를 통한 외부 접속. DuckDNS만으로 실제 TLS/포트/미디어 연결 경로까지 확인되지는 않는다.
- 기존 collector는 HTTPS Worker 업로드 방식이다. 저장소 설치 절차에는 VPN/Tunnel 구성이 없다.
- 사용자가 보낸 프로세스 목록은 차량에서 분리한 상태다. 주차 중 실차 상태의 증거로 사용하지 않는다.
- 목표: 외부에서 광각/실내 카메라 엔터티 조회, Android/iOS 지원, 현재 브랜치와 텔레메트리 유지. HAOS 중계 애드온 추가는 허용된다.

## 원본에서 찾은 동작과 증거의 한계

첨부 MyID4 ZIP은 README만 포함한다. APK의 `assets/wayon_live.js`는 H.264 프레임을 WebSocket으로 수신하고 WebCodecs로 재생한다. 두 카메라를 분리하며 3초마다 `WLP1`을 보내고 화면을 숨기면 연결을 종료한다.

현재 저장소의 `cloudflare/SOURCE.md`가 명시한 Wayon 커밋에서 서버 구현을 확인했다. 이는 프로젝트의 확인 가능한 참조 원본이며, 비공개 MyID4 v1.29 서버와 완전히 동일하다고 입증된 것은 아니다.

- [Wayon live server](https://github.com/leehyuk1108/Wayon/blob/1870bfc9998e9bca6d379a3c266c5e9ce5f47a46/system/wayon_live_stream.py): **offroad 전용**. CameraLease 획득, IsTakingSnapshot 및 `/tmp/wayon_live.active` 설정 후 카메라/인코더를 기다린다. heartbeat 12초 만료, 기본 세션 300초(설정 범위 30–900초), onroad 전환/연결 종료 시 정리한다.
- [Wayon process manager](https://github.com/leehyuk1108/Wayon/blob/1870bfc9998e9bca6d379a3c266c5e9ce5f47a46/system/manager/process_config.py): live 표시 파일을 읽고 offroad에서 camerad와 `encoderd --stream`을 시작하는 별도 조건이 있다.
- 1.5 Mbps 인코더 설정을 사용하지만 실제 전체 트래픽은 카메라 수와 프로토콜 오버헤드를 포함해 측정해야 한다. 가령 **합산** 3 Mbps라면 5분에 약 112.5 MB이며 이는 실측값이 아니다.

## 현재 브랜치와의 차이

[대상 process_config.py](https://github.com/ajouatom/openpilot/blob/5cb0f3e590a28d0138ad9f48506f65743cdaa326/openpilot/system/manager/process_config.py)의 camerad는 started 또는 IsDriverViewEnabled 조건이다. 일반 stream_encoderd는 notCar 조건이고, Carrot Vision은 별도 설정과 연결된 road 중심 경로다. Wayon 표시 파일을 감시하는 조건은 없다.

[대상 encoderd](https://github.com/ajouatom/openpilot/blob/5cb0f3e590a28d0138ad9f48506f65743cdaa326/openpilot/system/loggerd/encoderd.cc)는 `--stream`을 지원하고 loggerd.h에는 H.264 wide/driver 스트림 정의가 있다. 이 소스의 존재는 설치된 바이너리와 comma four에서의 실행 성공을 보장하지 않는다. 선택하지 않은 카메라까지 인코딩되는지도 검증해야 한다.

대상 snapshot.py는 offroad에서 camerad를 직접 시작하는 선례가 있다. 그러나 이 경로를 장시간 라이브로 확대했을 때 manager와의 동시 시작, onroad 전환, 비정상 종료를 처리할 수 있는지는 별도 검증 대상이다. Python 파일 복사만으로 원본과 동일한 동작을 보장하지 않는다. Driver Monitoring 설정 변경을 영상 활성화 수단으로 사용하지 않는다.

## 권장 방향과 보류된 결정

표준 camera 엔터티 두 개와 시청 수요 기반 영상 세션을 기본으로 한다. 평소에는 중립 이미지를 반환하고 썸네일 요청만으로 카메라를 깨우지 않는다. 실제 사진 캐시를 추가하면 촬영 시각과 오래된 상태를 명시한다. 상시 전송/주기적 사진/녹화는 초기 기본값으로 활성화하지 않는다.

차량의 하드웨어 H.264 출력을 재인코딩 없이 HAOS ARM64 중계 서비스에서 표준 재생 형식으로 전달하는 구성을 우선 평가한다. [HA camera WebRTC 인터페이스](https://developers.home-assistant.io/docs/core/entity/camera/)를 사용하되, HTTPS HA 접속이 WebRTC 미디어 연결까지 보장하지 않으므로 외부 iOS 네트워크에서 ICE/TURN 또는 HLS 경로를 실제 검증한다.

사용자는 추가 VPN 계정 없이 기존 HTTPS 접속을 활용하는 방향을 선택했다. 콤마가 HA HTTPS origin으로 outbound WSS 연결하는 방식을 채택한다. 원본 Cloudflare TCP 중계는 별도 네트워크 binding을 필요로 하므로 기존 Worker API를 단순 재활성화하지 않는다. 공용 카메라 포트를 열지 않는다.

원본의 검증 가능한 동작 범위에 맞춰 첫 실험은 offroad로 한정한다. 주행 중 조회는 지원 완료로 간주하지 않는다. 마지막 시청자가 나가면 전송을 정리하고 비정상 종료에는 장치 측 timeout을 적용한다. 여러 시청자는 차량 upstream을 공유해야 한다. 종료 시 다른 기능이 시작한 프로세스나 상태를 해제하지 않도록 소유권을 추적한다.

## 단계별 검증 및 완료 기준

1. `scripts/camera_preflight.py`를 콤마에서 실행해 정확한 소스 변경 여부, 바이너리 존재, offroad 상태를 확인한다. 설정/프로세스를 변경하지 않고 토큰, DongleId, 전체 argv를 출력하지 않는다. 누락 상태는 false가 아닌 null/미확인으로 보고한다.
2. 실기기 실험 설계를 확정한 뒤, 차량에서 분리된 상태에서 제한 시간 동안 wide/driver 프레임을 확인한다. 자동 시작에 등록하지 않는다. 단계 1은 촬영 테스트가 아니다.
3. 독립 프로세스가 manager와 공존 가능한지 검증한다. 충돌하거나 종료 소유권을 보장하지 못하면 서비스를 배포하지 않고 최소 manager 연동 변경안을 별도로 제시한다.
4. 연결 종료, 클라이언트 강제 종료, 네트워크 단절, 중계 재시작, 세션 만료, 다중 시청, onroad 전환을 검증한다. onroad 전환 검증은 먼저 모의 상태 입력으로 수행하고 실차 검증은 별도 절차로 진행한다.
5. HA 엔터티/중계/원격 연결을 통합하고 iOS·Android에서 외부 재생을 확인한다. 유휴 영상 업로드 0, 종료 후 자원 회수, CPU/온도/메모리/실측 전송량과 재생 지연을 기록한다. 주차 장시간 동작은 실제 차량 전원 정책을 바탕으로 검증한다.

## 실제 기기 진단 결과와 다음 실행

사용자가 제공한 preflight 결과에서 aarch64, 지정 커밋, offroad=true/onroad=false, 카메라 프로세스 없음, camerad/encoderd 실행 파일 존재, 조사 대상 소스의 tracked_changes 없음이 확인됐다. IsTakingSnapshot은 null이었다. 이 정적 결과는 프레임 생성 성공을 의미하지 않는다.

`scripts/camera_smoke_test.py`는 해당 커밋의 차량에서 분리된 기기 전용 실험이다. `/data/camera_smoke_test.py`에 복사하고 다음을 실행한다.

```bash
/usr/local/venv/bin/python3 /data/camera_smoke_test.py --vehicle-disconnected
```

이 명령은 읽기 전용이 아니다. IsTakingSnapshot을 임시 설정하고 기존 camerad 및 `encoderd --stream`을 실행한다. 기존 --stream은 **세 카메라**를 인코딩한다. wide/driver 메시지와 코덱 헤더·데이터 도착만 세며 최대 관찰 20초, 부모 alarm 30초, 각 자식 GNU timeout 35초(+강제 종료 유예 3초)로 제한한다. 정상/예외/일반 종료 신호에서 소유한 프로세스 그룹만 종료하고 임시 파라미터를 복원한다. SIGKILL·전원 단절에서는 Python 정리 코드 실행을 보장할 수 없다. 다른 카메라 기능과 동시에 사용하거나 차량에 다시 연결하지 않는다.

영상 파일을 저장하거나 외부로 전송하지 않는다. 임시 진단 로그는 종료 시 삭제한다. passed=true는 메시지 도착과 정리 성공이며 화질·브라우저 재생 검증은 아니다.

사용자 실기기 결과: passed=true, 관찰 2.54초, wide/driver 상태 메시지 각 12개, 인코딩 메시지 각 10개, 코덱 헤더 각 1개. 수신 payload는 wide 7,952바이트/driver 24,000바이트. cleanup_errors=[], remaining_camera_pids=[], snapshot_flag_restored=true. 관찰 시간은 전체 시작 지연이 아니며 이 짧은 샘플로 정상 비트레이트를 추정하지 않는다. 이는 차량에서 분리된 기기의 단기 테스트 성공이며 실차 주차/장시간/주행 전환 성공을 의미하지 않는다.

`--verify-decode` 실기기 결과도 passed=true다. 두 스트림 각각 9프레임을 디코딩했고 해상도는 모두 1344×760이었다. 관찰 시간 2.25초, 상태 메시지 각 13개, 인코딩 메시지 각 10개, 헤더 각 1개, payload wide 9,744바이트/driver 30,704바이트. cleanup_errors=[], remaining_camera_pids=[], snapshot_flag_restored=true. 화질을 직접 본 것은 아니며 외부 브라우저 재생은 아직 검증하지 않았다. 현재 모의 테스트 12개가 통과했다.

실기기 사전 검증 완료 범위는 H.264 수신/디코딩과 일반 HA WebSocket greeting까지다. 같은 영상 생성 테스트를 다시 요구하지 않는다. 이후 HA 전용 영상 endpoint와 두 카메라 엔터티, 콤마 서비스, 설치 패키지를 구현했다. 별도 애드온은 사용하지 않는다. 화질·실제 HA 브라우저 재생·실차 장시간 동작은 아직 확인하지 않았다.

## HA 전달 단계의 설계 선택

두 엔터티는 wide/driver에 대응한다. 첫 시청 요청이 차량 세션을 시작하고 마지막 시청 종료가 차량 세션을 해제하도록 제어한다. 썸네일 요청과 HA 재시작/엔터티 조회는 세션을 시작하지 않는다. 같은 장치의 두 카메라와 여러 시청자는 하나의 카메라/인코더 수명주기를 공유한다. 기존 stream 인코더가 세 카메라를 인코딩하는 비용은 현재 브랜치를 수정하지 않는 초기 구현의 제약으로 명시한다.

[HA go2rtc](https://www.home-assistant.io/integrations/go2rtc/)는 default_config를 사용하는 HAOS에서 자동 설정될 수 있다. 따라서 WebRTC를 위해 별도 go2rtc를 무조건 중복 설치하지 않는다. 내장 인스턴스에 임의 명령을 주입하지 않으며, 차량 프로토콜 어댑터와 표준 스트림 제공에 별도 서비스가 필요한지 먼저 검증한다.

### 선택한 HTTPS 구성

- 콤마의 별도 camera agent가 HA 외부 HTTPS origin의 전용 WSS endpoint에 연결한다. 기존 collector/Worker는 그대로 둔다. 평소에는 제어 메시지와 heartbeat만 교환하며 영상은 생성/전송하지 않는다.
- 장치별 영상 전용 credential을 사용한다. 기존 Worker UPLOAD/VIEW 토큰이나 HA 관리자 장기 토큰을 영상 장치 인증에 재사용하지 않는다. 시작/정지 제어는 세션 ID에 묶고 임의 명령 실행을 제공하지 않는다.
- agent는 wide/driver의 H.264를 재인코딩하지 않고 각각 MPEG-TS로 포장하여 카메라 식별자와 함께 WSS binary message로 보낸다. 카메라별 timestamp, SPS/PPS/키프레임, 스트림 재시작 처리는 구현 검증 대상이다.
- HA 통합은 bounded queue로 수신하여 HA 컨테이너의 loopback HTTP feed로 제공한다. loopback listener는 127.0.0.1에만 바인딩하고 임의 세션 토큰을 검사한다. 외부 영상 포트를 추가하지 않는다. 느린 소비자에게 무제한 버퍼링하지 않고 스트림을 재시작한다.
- 표준 camera 엔터티는 해당 feed를 HA stream에 제공한다. 첫 버전의 브라우저 출력은 **HLS**로 정한다. HTTPS HA 접속 경로를 그대로 활용하며 iOS/Android를 검증한다. 내장 go2rtc/WebRTC 자동 선택으로 외부 연결 성공을 가정하지 않고, 초기 재생 경로를 HLS로 검증한다. WebRTC 저지연 최적화는 후속 단계다.
- 추가 애드온 없이 HA stream과 통합 내부 relay를 먼저 구현한다. ARM64 HA에서 디코딩 없는 재포장과 stream 처리 부하를 측정한다. 필요성이 확인되기 전에는 별도 go2rtc를 설치하지 않는다.
- 시작은 실제 stream consumer 요청에서만 발생한다. 엔터티 생성/썸네일 조회/HA 재시작은 시작 조건이 아니다. preload는 끈다. HA HLS의 소비자/유휴 처리 때문에 UI를 닫는 순간 차량 upstream이 즉시 닫힌다고 약속하지 않는다. 차량에는 12초 lease timeout 및 5분 절대 세션 상한을 두고, 닫기 후 실제 정지 지연을 측정해 문서화한다. 재접속만으로 만료 세션을 자동 재시작하지 않는다.

첫 네트워크 검증은 `scripts/camera_network_preflight.py`다. 콤마에서 외부 HTTPS base URL을 입력하면 `/api/websocket`의 인증 전 auth_required greeting까지만 확인한다. 인증정보 전송, 카메라 활성화, 설정 변경은 하지 않는다. TLS 인증서 검증을 끄지 않는다. 같은 Wi-Fi에서 성공해도 이동통신망 연결/지속 전송/새 전용 endpoint까지 입증되는 것은 아니다.

사용자 기기에서 네트워크 probe passed=true, ha_auth_required_received=true가 확인됐다. `/data/openpilot/pydeps`를 PYTHONPATH에 포함해야 aiohttp를 불러올 수 있었다. 외부 주소나 인증정보는 이 문서에 저장하지 않는다. 이 결과는 테스트 당시 네트워크에서 TLS/WebSocket greeting 수신 성공이며 지속 미디어 전송과 이동통신 환경의 성공을 의미하지 않는다.

### 구현 상태

`camera_session.py`에 HA와 분리해 검증 가능한 세션 로직을 구현했다. 첫 reader만 start를 생성하고 wide/driver 및 여러 reader가 하나의 upstream을 공유한다. 마지막 reader 종료, offroad 상태 해제/미확인, 상태 heartbeat 12초 만료, 세션 300초 제한에서 종료한다. 장치 연결 generation과 session UUID로 오래된 연결/프레임을 구별한다. 중복 장치 연결은 거부한다.

바이너리 포맷은 `!4s16sB`(CHV1, session UUID 16바이트, camera ID wide=1/driver=2) 뒤 MPEG-TS payload다. payload는 188바이트 단위, 최대 96,256바이트이며 TS sync byte를 검사한다. reader는 최대 8개, 각 큐는 최대 16청크다. 느린 reader만 종료하고 다른 시청자는 유지한다. 인증은 이 모듈의 책임이 아니며 향후 WSS adapter에서 먼저 검증해야 한다.

세션 모듈은 HA transport adapter에 연결됐다. 인증된 WSS adapter, loopback feed, camera 플랫폼, 콤마의 지속 실행 agent, MPEG-TS mux와 설치/비활성화 도구를 구현했다. 기본값은 꺼짐이고 영상 전용 credential을 설정해야 활성화된다. 합성 H.264를 실제 WebSocket/HTTP로 전달한 뒤 디코딩하고, 별도로 fMP4 HLS로 재포장하여 재생 프레임 수·시간을 확인했다. 이 검증이 실제 HAOS HLS 및 iOS UI 재생을 대신하지 않는다.

카메라 관련 로컬 테스트 50개 통과. 전체 Python 테스트에서는 168개 중 166개가 기본 실행으로 통과했고, 기존 param_sync의 2개 테스트가 Windows에서 열린 NamedTemporaryFile을 SQLite로 재개방하는 문제로 실패했다. 해당 파일을 재개방 가능하게 하는 테스트 실행 환경 보정으로 param_sync 5개 전부 별도 통과했다. 기존 param_sync 소스나 테스트 파일은 변경하지 않았다.
