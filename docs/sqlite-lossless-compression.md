# HA 로컬 SQLite 손실 없는 압축: 이유, 구현, 진단과 복구

작성: 2026-10-04 (한국 시간). 배포 대상: `v0.8.12-beta.2` pre-release.

## 왜 실행했는가

사용자가 한 달 미만 사용한 DB가 약 415MB에 달하고 차계부를 도입할 예정이라고 보고했다. 요구사항은 **현재 기능에 영향을 주지 않고 용량을 줄이며, 문제 발생 시 원인 파악 및 revert 계획을 확보**하는 것이다. 원본 다운로드 DB와 HA 서버 DB는 읽기 전용으로 조사했다.

제공 사본: 큰 DB 415,059,968 bytes, 상태 27,025건/본문 363,858,783 bytes, 주행 156건/10,844,877 bytes, 충전 42건/16,070 bytes. 작은 DB는 16KB/6건으로 이번 문제 대상이 아니다. 상태마다 정규화된 값 외에 중첩 원본 JSON과 충전 목록·월별 집계가 반복 저장된다. 운영 DB SSH 조회에서는 일일 보관 기간 정리도 작동하고 있었다. 수집 시작보다 오래된 클라우드 주행/충전 이력이 있으므로 전체 기록 기간을 사용자가 설치한 기간과 동일시하지 않는다.

415→118MB의 초기 필드 삭제 실험은 적용하지 않았다. `history(kind='state')` API는 원본 전체를 반환하고, `trip_repair.route_points`는 중첩 경로도 참조한다. 삭제는 과거 진단이나 보정 결과를 바꿀 수 있다. 보관 기간 단축·다운샘플·센서 시각 제거·인덱스 삭제도 이번 변경에서 제외했다. 차계부 장기 주행 요약의 보존 정책 변경은 별도 작업이다.

## 어떻게 구현했는가

- `archive_codec.py`는 큰 상태 이벤트 전체 JSON을 zlib level 6 + base64로 보관한다. UTF-8 원문을 바이트 단위로 복원한다. 4KB 미만, 압축 효과가 작은 데이터, 주행/충전은 변환하지 않는다.
- 저장 JSON은 기존 envelope의 메타데이터와 센서 `data`를 유지하고 `schema` 대신 내부 `_carrot_archive_v1`을 가진다. 센서 projection에서 `cloud_raw_state`, `charge_sessions`, `charge_months`만 생략하되 세 필드도 **압축 원문에는 전부 보존**된다. 사용자 이벤트에는 반드시 `schema=1`이 있으므로 내부 형식과 구분된다.
- 공개 latest/history 조회는 `loads()`로 원문을 복원한다. battery_history와 주행 에너지 계산은 사용 필드를 조사한 뒤 `calculation_event()`로 projection을 읽는다. SQL JSON 검색·표현식 인덱스는 기존 측정 필드를 계속 사용한다. 압축 바이너리를 기존 JSON 칼럼에 직접 넣지 않는다.
- `put`의 이벤트 ID 중복 검증과 `put_cloud`의 변경 판정은 `unpack()`한 원문으로 비교한다. 압축 표현이 달라도 같은 원문은 재작성·revision 증가·캐시 무효화를 만들지 않는다.
- 압축 서비스는 200건 단위로 작업하고 원래 body가 아직 같은 행만 UPDATE한다. 동시 수신된 새 클라우드 값을 덮어쓰지 않는다. 시작 시 최대 rowid를 고정하여 계속 수신되어도 종료된다. 논리 이벤트·rowid·커서·revision·보관 기간은 바꾸지 않는다.
- 모든 설정 항목은 기본 비활성이다. 해당 DB 옆 `.compression-enabled`가 있을 때만 새 상태를 압축 저장한다. 압축/복원 서비스는 설정 항목별로 직렬화한다. 복원 중에는 ingestion write lock으로 늦은 압축 INSERT를 막는다. 복원 동안 읽기는 가능하지만 새 저장은 기다릴 수 있으므로 정비 시간에 수행한다.
- 변환 전 `SQLite backup` API로 일관된 사본을 만들고 무결성을 검사한 뒤 `.partial`에서 정식 백업명으로 rename한다. 기존 백업은 덮어쓰지 않고 무결성을 재확인한다. 디스크 여유가 부족하면 변환 전에 실패한다. 백업/상태 파일은 git 디렉터리가 아닌 HA 설정 디렉터리에만 생성된다.
- VACUUM은 변환 커밋 후 별도로 실행한다. 회수 실패가 변환 내용을 잃게 하지 않는다. 상태 파일에 단계·시각·오류·완료 크기를 기록한다.

## 검증 결과

- 실제 제공 사본 전체: 415,059,968 → 218,419,200 bytes (약 47.4% 감소). 27,025건 변환. Mac 변환+VACUUM 약 9.19초. 일반 JSON 복원 후 원문/rowid를 포함한 모든 테이블 논리 해시 동일.
- 최신 상태, 배터리 7일 그래프, overview, state/trip/charge history 및 since 조회, 그룹 충전 내역의 변환 전후·복원 후 결과 동일. 모든 이벤트 원문은 전체 테이블 해시로 검증했다.
- Raspberry Pi HAOS 운영 DB는 **읽기 전용**으로 1,000건만 읽고 메모리에서 테스트했다. 원문 및 SQL 계산값 동일. 마지막 표본: 일반 파싱 831.01ms, 계산 projection 154.04ms, SQL 측정값 조회 104.04→30.07ms. 전체 원문 복원은 1380.73ms, 압축 비용 2.631ms/건. 이는 단일 표본이며 실제 전체 HA 지연이나 장시간 보증이 아니다.
- 대량 계산에서 원문을 중복 파싱하던 초기 구현은 Pi 성능 측정 후 제거했다. 원문 조회에는 여전히 복원 비용이 있다. 1,000건 일반 history 조회가 계산 전용 경로와 동일한 속도라는 주장은 하지 않는다.
- 자동 회귀: 전체 Python 검사, 새 압축/복원 검사, dashboard-live-loading/lazy-runtime/view-state 등 JS 검사, Worker incremental/benchmark, Comma param_polling. 최종 집계와 Actions 링크는 아래 배포 기록에 추가한다.
- 기존 `tests/motion-status.test.mjs`: parked/unknown 기대값 충돌. 변경 전 `637a7ef` 사본에서도 동일 실패 재현. 이 변경에서 frontend는 수정하지 않았으며 기존 실패를 압축 기능의 성공으로 숨기지 않는다.

## 적용 계획 — 사용자는 HACS 설치·재시작만

1. 에이전트가 검증·커밋·main push·새 태그·GitHub pre-release 및 Actions 성공을 확인한다.
2. 사용자는 HACS에서 베타 버전 표시를 켜 `0.8.12-beta.2` 설치 후 HA 재시작한다. 업데이트만으로 DB가 압축되지 않는다.
3. 에이전트가 설치된 manifest/파일과 DB 디스크 여유, 실제 화면/API 기준값을 확인한 후 대상 entry에서 `carrot_ha.compress_archive`를 실행한다. 작은 16KB DB는 대상에서 제외한다. 사용자에게 개발/SQL/파일 교체 명령을 떠넘기지 않는다.
4. 대상 entry_id는 DB 파일명의 `.sqlite3` 앞부분. 서비스 데이터 예:

```yaml
entry_id: 01M23RJD5A9H29TRSYCXV4HJ80
```

5. 시작/진행/완료는 `<DB>.compression-status.json` 및 HA 로그에서 확인한다. 서비스 응답이나 UI 대기 종료만으로 성공 판단하지 않는다. `phase=complete`, `operation=compress_archive`, 무결성/기능 동일성/새 수신을 확인한다.
6. 그래프·전비·충전 결제·상태 진단·과거 페이지·카메라 안전 차단 및 새 데이터 수신을 확인한다. 기존 auth/isolation과 shared local cache 구조를 유지한다. 24시간 관측은 별도 실제 운영 검증이며 현재 완료했다고 주장하지 않는다.

주의: 백업 약 415MB를 보존하므로 변환 직후 총 디스크 사용량은 오히려 늘 수 있다. 운영 DB 감소와 백업을 포함한 전체 사용량을 구분한다. 백업 자동 삭제는 하지 않으며 안정화·외부 백업 보관 이후 삭제는 별도 결정한다. `VACUUM` 잠금/IO는 정비 시간에 관리한다.

## 문제가 생기면: 원인 분류와 조치

- 항상 설치 버전·문제 발생 시각(KST)·해당 entry·status 파일·HA traceback·디스크 여유를 먼저 수집한다. GPS/전체 원문/인증정보는 로그나 공개 이슈에 노출하지 않는다.
- `backing_up`: free space, backup integrity, `.partial` 파일과 SQLite lock 확인. 압축 시작 전 실패면 DB 내용은 그대로이다.
- `compressing`: 마지막 진행 rowid 및 오류 확인. 일부만 압축되어도 새 버전은 일반/압축 혼합 기록을 읽는다. 재실행은 원문 기준으로 멱등이며 원래 백업을 덮어쓰지 않는다.
- `vacuuming`: 압축은 이미 커밋되었을 수 있다. 파일 크기가 그대로라는 이유로 데이터 손실로 판단하지 않는다. 디스크 여유와 lock을 조사하고 회수만 재시도하거나 복원한다.
- 읽기 오류: base64/zlib/크기/원문 schema/projection 검증은 실패를 명시한다. 잘못된 측정값으로 조용히 대체하지 않는다. 정상 압축/일반 행과 실제 손상 행을 구분한다.
- 값 변화/느려짐: 동일 기간과 측정 시각으로 API·그래프·전비·충전 금액을 비교한다. elapsed cloud check와 measurement freshness를 혼동하지 않는다. 최신 상태부터 독립 확인하고 압축을 중단·복원한다.

## 정상 복구 — 신규 기록을 보존하는 첫 선택

1. 압축 대응 버전을 유지한 채 `carrot_ha.restore_archive`를 같은 entry_id로 실행한다.
2. 시작 시 `.compression-enabled`를 제거해 새 압축 저장을 중지한다. 기존 압축 원문을 200건씩 일반 JSON으로 복원한다. **변환 후 새로 수신한 기록도 포함**하며 오래된 백업으로 DB를 덮어쓰지 않는다.
3. `phase=complete`, `operation=restore_archive`, 모든 상태 행 `schema=1`, marker 비활성, integrity_check, 새 수신 및 기준 기능을 확인한다.
4. 그 뒤에만 HACS에서 이전 `v0.8.12-beta.1`로 내려 재시작한다. 사용자에게 요구하는 조작은 HACS 설치·재시작이다. DB 진단/복구 서비스는 에이전트가 담당한다.

복원 중 중단되어도 새 버전에서 혼합 기록이 읽힌다. 상태를 확인하고 복원 서비스를 재실행한다. 중단된 상태로 이전 버전을 설치하지 않는다.

## HA가 기동하지 않거나 서비스가 실행되지 않을 때

에이전트가 SSH로 진단하고, 압축 대응 checkout의 `scripts/restore_archive_json.py`로 **현재 DB의 새 복구 사본**을 생성한다. SQLite backup API를 쓰며 입력 파일은 read-only이고 출력이 이미 있으면 거부한다. 현재 DB의 추가 기록까지 복원한다.

```bash
python3 scripts/restore_archive_json.py current.sqlite3 restored.sqlite3
```

출력 무결성·원문·커서·rowid 및 현재 기록을 확인하고 HA를 정지한 상태에서만 DB 교체를 수행한다. 원본 DB·WAL/journal·sidecar를 함께 보존하여 진단/재복구 가능성을 유지한다. 압축 enabled marker를 비활성화하고 새 버전으로 확인한 뒤 downgrade한다. 실제 파일 교체·정지는 에이전트가 구체적 복구 대상을 확인하여 수행하며 사용자가 수동 복사할 필요는 없다.

**최후 수단**: 원본 자체가 손상되어 복원이 불가능한 경우에만 `.before-compression.sqlite3` 또는 HA 백업을 이용한다. 이는 백업 이후 신규 기록을 잃을 수 있으므로 자동 적용하지 않고 손실 범위를 조사·보고한 뒤 결정한다.

## Git revert 정책

압축 대응 코드만 `git revert`하고 먼저 이전 버전을 설치하면 wrapper를 일반 이벤트로 해석하는 장애가 생길 수 있다. DB 복원을 먼저 완료한다. 안전한 rollback 릴리즈는 decoder를 유지한 채 새 압축 저장/변환을 중지하는 방식으로 준비하고, 필요하면 복원 완료 후 기능 커밋을 revert하여 **새 버전/새 태그**로 발행한다. 기존 태그는 덮어쓰지 않는다. 코드 revert와 DB 포맷 rollback을 반드시 함께 추적한다.

## 배포 기록 및 미확인 사항

- 운영 DB와 HA 소스에 직접 변경하지 않았다. Worker·D1·Comma 변경/배포 없음.
- pre-release 설치 후 운영 변환·실제 화면/API·24시간 관측은 아직 미실행이다.

### 최종 로컬 검증 집계

- Python: 232 tests, 성공, 2 skipped. 신규 압축/복원 8 tests 포함.
- JavaScript 전체: 55 tests 중 54 성공, 1 기존 motion-status 실패. 변경 전 HEAD 별도 checkout에서도 같은 실패 재현.
- 지정 dashboard-live-loading/lazy-runtime/view-state 및 camera lifecycle: 13 tests 모두 성공.
- Worker incremental_sync와 benchmark 성공. unchanged revision은 1 indexed query/81 bytes 유지.
- Comma param_polling: 4 tests 성공. Comma 코드는 변경하지 않음.
- Python 구문 컴파일 및 git diff --check 성공.

### 실제 발행 확인 — 2026-10-04

- 기능 커밋: `68d6a28c` (main push 및 원격 새 태그 확인).
- 태그/manifest: `v0.8.12-beta.2` / `0.8.12-beta.2`.
- GitHub Release: https://github.com/helico717/carrot-ha/releases/tag/v0.8.12-beta.2
- 한국 시간 15:39:45 게시, `prerelease=true`, `draft=false`, 지정 릴리즈 노트 존재 확인.
- Release Actions: https://github.com/helico717/carrot-ha/actions/runs/37183447459 — completed / success.
- 운영 DB 활성화는 아직 실행하지 않았으며 기존 DB의 내용/파일을 변경하지 않았다. 사용자의 HACS 베타 업데이트와 HA 재시작 후, 에이전트가 실제 설치 버전과 baseline을 확인하여 활성화·사후 검증을 수행한다.

### 운영 압축·원격 검증 — 2026-10-04 16:14~16:20 KST

사용자가 운영 압축 실행과 대시보드/DB 사용 기능 검증을 승인했다. 설치 beta.3, 여유 공간 약 171GB 확인. 기존 Supervisor 토큰을 출력 없이 사용하여 compress_archive 서비스를 호출했다. 코드/DB 수동 패치 없음.

- 작업 시작 16:14:21, complete 16:17:57(약 216초). HTTP 호출은 180초 timeout이었지만 상태 파일에서 진행 확인 후 중복 호출 없이 완료 확인.
- 백업 415,420,416 bytes -> 운영 DB 완료 213,381,120 bytes(약 48.6% 감소). 새 이벤트 수집 후 조회 시 213,417,984 bytes. 백업은 유지했으므로 둘의 합은 약 628.8MB, 압축 전보다 총디스크 사용량은 증가.
- 압축 25,745행. 백업 공통 25,946개 이벤트 전체 codec 복원 비교: 누락 0, 원문 불일치 0. 비교 시 새 이벤트 4개.
- 운영 quick_check=ok, 백업 integrity_check=ok.
- 공통 이벤트 본문 원문 368,099,979 -> 저장 176,228,123 bytes. 상태 projection+압축 원문을 함께 보존하므로 과거 zlib-only 실험의 84% 절감과 비교하면 안 된다.
- 주행 API 100개 및 충전 API 39개 응답 전후 완전 동일. 상태 API의 공통 96개 중 1개 차이는 cloud_raw_state의 cloud feed 표현(str/dict 및 메타키)과 gps.source이며, 저장 백업 비교는 모든 원문 일치. 배터리 이력은 오늘 received_samples/stale_samples만 증가; SOC/사용량/주행·충전시간/그래프 데이터는 동일.
- API 단회 응답시간 전->후: live 0.123->0.104s, dashboard 13.034->5.221s, trip 13.429->2.001s, charge 4.096->2.156s, state 1.660->0.360s. 캐시/부하/워밍업이 달라 성능 향상률로 일반화 금지. 작업 중 live도 0.297s 정상.
- 실제 Chrome에서 주행 경로·전비·배터리 날짜 선택·충전 내역·결제 입력창 열기/취소 확인. 결제 값은 변경하지 않음.
- 이후 새로고침에서는 tripDisplayEfficiency export 오류 발생. 설치 파일 및 내부/외부 HTTP에서 해당 export 존재를 확인. 상위 모듈은 ?v=버전이 있으나 하위 정적 import는 버전 없는 URL이라 캐시 혼합 재발 경로가 존재한다. 압축 DB 내용과 별개의 프론트엔드 로딩 문제이며 새로고침 후 사용성 전체 성공으로 보고하면 안 된다. 근본 해결은 하위 의존 모듈까지 동일 release version URL을 전파하는 것이다. 브라우저 재설치는 권하지 않는다.

운영 압축 완료/무손실 및 API 동등성은 확인. 프론트엔드 캐시 문제와 장기 성능 관찰은 별도 과제로 남는다. compression-enabled가 있어 신규 기록도 압축 저장한다. 되돌릴 필요 시 restore_archive 서비스로 새 기록 포함 복원; 백업을 운영 DB 위에 덮어쓰지 않는다.
