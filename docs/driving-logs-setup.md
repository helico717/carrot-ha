# 당근웹 로그 — HA 직접 반영 및 검증

2026-10-14 첫 단계: 실제 주행 로그 수신·목록·영상·구간 선택·원본 개별 다운로드.
사용자 요청에 따라 SSH 직접 반영으로 검증하며 버전 상승·태그·Release는 하지 않는다.
기능을 다듬은 뒤 별도 요청 시 pre-release를 발행한다.

## 이번 단계와 다음 단계

- 기존 당근웹 로그 화면과 조작을 재사용한다. 카드 이름은 **Carrot HA — 당근웹 로그**,
  타입은 `custom:carrot-logs-card`, 리소스는 `/carrot_ha_static/carrot-logs-card.js`다.
- 현재 로그 목록·날짜/시간 표시·구간 선택·정렬·영상 재생·원본 개별 다운로드를 연결했다.
- 분석 리플레이·레이더 검증·GPS 지도·선택 ZIP 내보내기·외부 서버 전송·화면 녹화
  동기화는 다음 단계다. 원본 UI의 해당 메뉴를 눌러도 지원 완료로 가장하지 않고 안내한다.
- 지금은 썸네일 대신 HA 로그 자리표시자가 보인다. 실제 영상은 재생 창에서 제공한다.
- 기록 끝 시각은 원본 qcamera의 최종 수정 시각을 사용한다. FFprobe가 영상 길이를
  제공하면 시작 시각을 계산한다. 길이가 없으면 시작 시각을 추측하지 않고 구간 번호를 표시한다.

## 저장·전송

HA 저장소는 `/config/carrot_ha/driving-logs/<entry_id>/`다. 텔레메트리 archive와
차계부 DB·Recorder를 사용하지 않는다. 원본 카메라와 rlog 및 재생용 MP4, 색인,
미완료 전송을 합쳐 5,000,000,000 bytes 예산을 적용한다. 최신 완성 구간부터 남기고
오래된 구간을 정리하며 보관 고정 예외를 두지 않는다. 파일 중간 절단은 하지 않는다.

Comma는 완성된 구간을 주행 중에도 하나씩 전송하고, 대기 중이면 최신 구간을 먼저
선택한다. 15초 간격 HA 보관 목록 대조로 누락·미완료 전송을 보충한다. 이어받기와
SHA-256 검증·원자적 공개를 사용한다. 원본 TS를 변경하지 않고 FFmpeg stream copy로
재생용 MP4를 만든다. 이 복사본도 HA 용량에 포함된다.

Comma의 FFmpeg와 기존 원격 터미널 HA 연결 설정이 필요하다. 전송은 기존 terminal
discovery 결과를 공유하므로 새 Worker polling은 추가하지 않는다. purpose별 HMAC
업로드 자격을 사용하며 HA 관리자 토큰은 기기에 넣지 않는다. 원격 터미널 연결 설정을
끄면 로그 전송도 종료된다. 터미널의 주행 중 명령 거부 규칙은 그대로 유지한다.

Comma 전송 상태·MP4 임시는 `/data/carrot_ha/driving_logs/`에 두고 Git에는 쓰지 않는다.
HA 원본 파일은 관리자 인증 후 발급하는 장치 범위·1시간 HttpOnly 세션으로 조회한다.
Worker/D1/KV 변경과 배포는 없다. 이동통신 데이터 사용과 주행 CPU/열은 실차 검증 대상이다.

## 사용자가 수행할 순서

1. HA SSH 파일 반영 확인 후 **HA 재시작**. 이번에는 HACS 업데이트/다시 다운로드를
   하지 않는다. 현재 설치 버전은 유지한다.
2. Comma 원격 터미널에서 대상 브랜치가 `carrot-wip-model_selector-ha`인지 확인한다.
   마지막 HA 수신 Git 상태(2026-10-14 13:45 KST)는 해당 브랜치였지만 실행 전 다시 확인한다.

   ```sh
   cd /data/openpilot && git branch --show-current
   cd /data/openpilot && git pull --ff-only && sudo reboot
   ```

   브랜치가 다르거나 pull이 실패하면 변경사항을 버리거나 강제 전환하지 말고 결과를
   전달한다. SSH/SCP로 Comma 파일을 복사하지 않는다.
3. HA 리소스에서 기존 `/carrot_ha_static/carrot-params-card.js`를 직접 등록했다면
   `/carrot_ha_static/carrot-logs-card.js`로 변경한다(JavaScript module).
   공통 `/carrot_ha_static/carrot-dashboard.js`만 등록한 구성은 새 로그 타입을 자동 로드한다.
4. [기존 8번 대시보드](https://homeassistant202604.duckdns.org/lovelace/8)의 카드 YAML:

   ```yaml
   type: custom:carrot-logs-card
   device_id: test-id4
   ```

   스크린샷의 device_id를 유지한 예시다. 실제 카드의 기존 device_id가 다르면 기존 값을
   그대로 쓴다. 기존 `carrot-params-card`는 이전 설정 호환용으로만 남는다.
5. 브라우저 강력 새로고침 후 로그 수신·목록·영상·시간 이동·다운로드를 확인한다.
   긴 backlog는 즉시 모두 도착하지 않는다. 가장 최근 완성 구간부터 표시된다.

## 검증 기록

- 최신 순서/도착 순서 역전, 과거 재전송 방지, 초과 구간 거부, 중단 후 offset 복구,
  미완료 비공개, 해시 불일치 파일 재시작 및 완료 idempotency 검사 통과.
- 실제 aiohttp 소켓의 장치 인증·HA 관리자 세션·파일 Range·원본 바이트 보존 검사 통과.
- 실제 Comma 전송 함수→HA 수신기 통합 검사 통과(합성 파일; 영상 디코딩 검증은 아님).
- Chromium에서 원본 로그 UI의 목록·선택·정렬 대화상자·영상 창 URL·닫기·모바일 배치 검사 통과.
- 기존 dashboard live/lazy/view-state, cloud live, incremental sync, history cache,
  Worker incremental/benchmark 및 Comma param polling/terminal 검사 통과.
- Comma 전체 92건 중 카메라 검사 2건 실패: `encode_media` 누락 및 PyAV 누락 검사 기대 불일치.
  해당 카메라 소스·테스트는 이번 변경에서 수정하지 않았고 HEAD와 동일하다.
- 실차 FFmpeg/전송 속도·CPU/열, HA 재시작 후 신규 API, 실제 로그 영상 재생,
  5GB 실운영 회전 및 장시간 관측은 설치 후 확인한다. 현재 통과로 보고하지 않는다.

배포 백업·원격 커밋·HTTP 파일 일치 결과는 직접 반영 완료 후 아래에 추가한다.

### 2026-10-14 직접 반영 결과

로그 파일 27개 설치·SHA-256 일치 확인. 기존 통합 등록부는 로그 API 등록만 추가했다.
백업: `/config/carrot_ha/deployment-backups/driving-logs-20261014/before`.
Comma 전송 원격 SHA: `05bc6d0af87a53569f91facef1c490c850786a73`.
HA 재시작·Comma Pull/재부팅은 사용자 완료 답장을 기다리는 중이며 실제 수신·재생은 미검증.
자세한 작업 기록은 `driving-logs/CHANGELOG.md`를 기준으로 한다.
