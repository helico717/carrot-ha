> **2026-10-14 서버 경로 변경:** Cloudflare Worker/D1/KV 관련 설치·배포·한도 설명은 폐기된 과거 기록입니다. 관련 코드 블록을 현재 설치에 실행하지 마세요. 현재 절차: [직접 수신기 설치·복구](CLEAN_INSTALL_RECOVERY.md). 과거 장애 증거·기록 ID는 보존합니다.

# 원격 터미널 하단 커밋 비교

업데이트 확인·Git Pull·재부팅 버튼 아래 한 줄에 마지막 기기 커밋, 최신 브랜치와의 차이, 최신 커밋 제목을 표시한다. 좁은 화면에서는 줄바꿈한다. 전체 커밋 메시지와 각 조회시각은 마우스 툴팁으로 제공한다. 터미널 연결을 열거나 셸 명령을 보내지 않아도 조회하며, 기존 버튼의 주행/권한 interlock은 유지한다.

## 데이터와 오프라인 의미

- Comma의 기존 CAN sample 스레드에서 60초 캐시로 로컬 Git HEAD·branch·origin을 읽는다. Git 명령은 rev-parse/remote get-url뿐이며 fetch/pull/쓰기·추가 스레드가 없다. 각 명령 timeout2초. Github https/SSH origin을 owner/repo로 정규화하고 인증정보가 포함된 remote는 전송하지 않는다.
- `comma_git_commit`, `comma_git_branch`, `comma_git_repository`, `comma_git_measured_at`를 기존 텔레메트리에 실어 보낸다. 기존 HA archive가 이를 보존하므로 Comma 연결과 HA 재시작 이후에도 마지막 설치 커밋을 사용할 수 있다.
- 오프라인 기기의 현재 HEAD를 직접 알 수는 없다. 항상 마지막 보고 기준이라고 표시한다. 업데이트한 수집기가 한 번도 보고하지 않으면 설치 커밋 미확인으로 표시하며 기본 대상 `helico717/openpilot:carrot-wip-model_selector-ha`의 최신 메시지는 독립 조회한다.
- HA 관리자 전용 `carrot_ha/terminal/git_status` WebSocket 작업은 relay 준비/온라인 상태에 종속되지 않는다. GitHub 공개 API branch HEAD를 조회하고, 보고된 SHA와 비교한다. ahead_by는 기기가 뒤처진 개수, behind_by는 기기만 가진 개수다. 동일·분기·기기 추가 커밋·응답 미확인을 구분한다.
- 브라우저는 표시 중30초마다 HA에 요청, HA는 성공/실패 모두600초 캐시와 lock으로 병합한다. 최악2개의 공개 GitHub 요청/10분/차량이며 기존 ~~Cloudflare~~ 조회·KV/D1 쓰기 추가 없음. GitHub는 공인 IP 공유 제한으로 실패할 수 있다. 조회 실패는 저장된 비교/시각과 오류 표시를 유지한다. HA 자체 인터넷 장애나 최초 미보고 상태를 정상 비교로 표시하지 않는다.
- 메시지는 textContent/title로만 표시한다. GitHub 메시지의 HTML은 실행하지 않는다. device 변경/카드 해제 후 오래된 비동기 응답은 버린다.

## 검증

- 신규 HA 비교3 + 기존 terminal relay4 + UI4 =11테스트 통과. Comma Git 읽기/캐시/오류·인증정보 제외3 및 parameter polling4 통과.
- 전체 Comma 데몬66개 중63개 통과. 기존 Windows 플랫폼 오류3개(fcntl 카메라2, Bash Windows경로 sync1)는 동일하게 남아 있으며 이번 변경과 무관하다.
- 로컬 Edge Chromium1300px/390px에서 workflow 바로 아래/keys 바로 위 배치, 모바일 줄바꿈, 가로 넘침 없음 확인. 표시된 SHA/메시지는 미리보기 합성 데이터다. 실제 기기·HA 설치 검증은 아직 하지 않았다.
- 릴리즈 게이트: 대시보드10, cloud live6, incremental HA5, history cache1 통과. benchmark 증분 조회1쿼리/81bytes 확인. 미변경 ~~Worker~~ test_incremental_sync.mjs는 선행 테스트 통과 후 legacy fixture에 migration_trip_measurements.sql을 적용할 때 이미 존재하는 measurements_json 컬럼 때문에 실패했다. Worker/SQL/test 파일은 이번 변경 대상이 아니며 수정하지 않았다.
- Comma 원격 커밋 `33bdf08488011be23b5659a3d223af038f61efd5` 확인. HA는 `0.8.14-beta.4`로 발행한다.
- Worker/D1·차계부 수정이나 배포 없음. 사용자 요청에 따라 이번 변경과 배터리 온도를 다음 pre-release에 포함한다. 설치는 HACS beta 표시 후 업데이트·HA 재시작, Comma는 clean Git pull·재부팅이 필요하다.
