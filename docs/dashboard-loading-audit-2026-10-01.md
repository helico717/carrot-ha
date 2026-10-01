# 대시보드 최신 정보 지연 및 무료 플랜 검토 — 2026-10-01

## 조사 범위와 결론

분석 기준: carrot-ha `abfa94d`부터 현재 `6c8b9fb`, openpilot `4448c79c`의 로컬 Git 이력과 코드.
관련 파일의 전체 로컬 이력을 수집하고, 캐시·상태 조회·동기화·이력 조회·무료 한도와 직접 관련된 변경을 추적했다. 하단은 재현 가능한 커밋 목록이다. 운영 D1 Insights를 읽기 전용으로 조회하여 최근 rolling 24시간의 쿼리 비용도 확인했다. 운영 배포본 일치 여부와 실제 화면 지연은 미확인이다. 아래 운영 수치는 변경 전 기준이며, 변경 후 수치가 아니다.

**9월 30일 변경에는 최신 정보를 늦게 표시하는 회귀가 있다. 전체 롤백보다 현재 상태와 이력의 대기 경로를 분리하는 것이 적절하다.**

무료 플랜을 유지하려면 모든 조회를 느리게 만들기보다, 최신 상태의 작은 조회는 빠르게 하고 이력 재조회·경로 다운로드·KV 쓰기를 줄여야 한다. 이번 패치는 현재 상태 대기 문제를 해결하며, 시스템 전체의 무료 한도 준수는 운영 지표로 검증해야 한다.

## 관련 변경의 효과

| 커밋 | 의도/변경 | 판단 |
| --- | --- | --- |
| `9fcf64b` | HA/Cloudflare 보존기간 및 삭제 | 유지. 저장공간 관리이며 현재 화면 조회 주기를 늘린 변경은 아님. 삭제도 D1 쓰기 예산에 포함해야 함. |
| `6faf434` | localStorage 캐시, 현재 상태를 먼저 표시한 뒤 이력 조회 | 캐시는 최초 빈 화면을 줄임. 이 시점의 상태 우선 표시는 타당. 저장한 시각이 있어도 캐시 만료 제한은 없음. |
| `7d5b6b1` | 오프라인 복구 이력을 현재 상태로 재생하지 않음 | 유지. 오래된 값으로 되돌아가는 오류 방지. |
| `b930399` | Comma 최신 데이터 업로드 우선, 이력 실패에도 최신값 반영 | 유지. 회선 복구 시 중요한 개선. |
| `19b936c`, `36c3d20` | 주행 거리/에너지 보정 및 조회 시 계산 | 데이터 품질 개선. 반복 조회 시 HA CPU/SQLite 비용도 발생. |
| `fb22114`, `209da66`, `13d045d`, `abfa94d` | 주행 합치기·기간별 목록·SOC/에너지 표시 개선 | 기능은 유지하되 이 계산을 최신 상태 표시의 선행조건으로 두지 않아야 함. 최근 8일 주행은 100개씩 끝까지 읽음. |
| `224482d` | `/api/latest-state` 추가, 주행 페이지 제한·재개 | 최신 상태는 장치 PK 조회 1개로 가벼움. 다만 HA에서 그 뒤 이력 처리를 같은 sync 실행에 묶음. |
| `8475469` | Worker 실패 시 레거시 API 대체, 누락 테이블/경로 방어 | 복구 기능은 유효. 대체 `/api/json`은 더 무거움. 빠른 상태 조회에 반복적인 무거운 대체 호출을 넣으면 안 됨. |
| `7a5c59e` → `f5ae59c` | 터미널 discovery를 KV에서 D1으로 이동 | 유지. 60초 publish는 하루 약 1,440회로 KV 무료 쓰기 1,000회/일을 넘길 수 있었음. |
| `487f2b7` | 프런트 버전 파일 읽기를 HA executor로 이동 | 유지. HA 이벤트 루프 차단 방지. |
| `448f369` | 캐시 복원/지도 안정화, 현재 상태와 모든 이력을 Promise.all로 결합 | **최신 상태 표시 회귀.** 기존에는 dashboard 응답 즉시 render, 이후 이력 조회. 변경 후 가장 느린 이력이 완료되어야 최신값 표시. 지도 lifecycle 수정은 유지 가능. |
| `8a9fd10` | legacy snapshot/camera 엔티티 제거 | 불필요한 폴링을 줄이는 방향. 재도입할 이유 없음. |

openpilot의 `07be35fe`는 수집기를 Git 관리 daemon으로 통합했다. 현재 코드의 업로드는 주행 30초/주차 60초 또는 상태 변경 시이며, CAN 샘플링 자체에도 약 30초 주기가 있다. `663fc996`, `e96fd20a`는 터미널/발견 경로이며 `ddd6ec74`~`4448c79c`의 카메라 변경은 현재 차량 값 표시 지연과는 다른 경로다.

## 지연이 누적되는 지점

1. **Comma → Worker:** 원천 CAN 샘플과 주행 30초/주차 60초 업로드 주기. 장치가 잠들거나 회선이 끊기면 새 측정값 자체가 없을 수 있음.
2. **Worker → HA:** 60초 sync. 최신 상태를 한 번 읽은 뒤 telemetry backlog를 끝까지 읽고, 주행은 최대 10페이지 × 10건을 순차 처리. sync가 끝나지 않으면 다음 실행을 건너뜀. HTTP 요청별 timeout은 45초이고 전체 실행 시간 제한은 없음.
3. **HA dashboard API:** 메모리의 현재 상태를 읽고도 응답 전에 7일치 배터리 이력과 세션을 SQLite에서 계산함.
4. **브라우저:** 별도의 60초 폴링. 현재 상태, 최근 주행 여러 페이지, 충전 100개가 모두 끝나야 최신 상태를 표시함. 이력 하나가 실패하면 정상 도착한 현재 상태도 적용되지 않았음.
5. **다시 열기:** 숨겨진 탭은 폴링을 건너뛰지만 visible 복귀 즉시 조회는 없었음. 다음 timer까지 기다림.

HA와 브라우저의 독립적인 60초 timer만으로도, 정상 네트워크에서 Worker 도착 후 화면 반영까지 거의 120초가 누적될 수 있다. 원천 샘플/업로드, 네트워크, 이력 계산 시간은 별도다. 실제 환경에서 측정한 latency 수치는 아니다.

## 이번 로컬 패치 (0.8.6)

- `/dashboard/{entry}?live=1`: 배터리 이력 계산 없이 HA 현재 상태 반환.
- `live=1&refresh=1`: `/api/latest-state`만 조회하여 최신 상태 갱신. 역사 데이터 다운로드/DB 계산과 독립.
- 첫 접속은 HA 메모리 값을 먼저 표시하고 이어서 Cloudflare 최신값 확인.
- 브라우저가 보이는 동안 15초마다 현재 상태 확인. 이력은 기존 60초 주기.
- 탭 visible 복귀/카드 재접속 시 바로 확인. 분리된 timer/listener를 disconnect에서 정리.
- 장치별 HA lock과 단조시계 기준 15초 제한으로 동시 클라이언트 요청 및 실패 재시도를 합침. timeout 8초. 실패 시 마지막 값 보존, live 상태를 표시.
- 오래된 응답은 더 새로운 HA 상태를 덮어쓰지 않음. charge 세션은 current state로 적용하지 않음.
- 이력 응답은 배터리 이력만 갱신하므로, 늦게 도착해도 현재 값을 되돌리지 않음.
- 측정값이 동일하면 단순 age 증가만으로 지도를 다시 만들지 않음. 화면에 표시되는 확인 시각은 분 단위로 반영.
- 계정 인증·관리자 제한 유지, 응답 `Cache-Control: no-store`.
- 기존 배경 sync는 지속. live 조회는 HA 메모리만 갱신하며 archive 영속화는 기존 sync가 담당. 새 경로는 D1/KV 쓰기와 Comma 업로드 빈도를 증가시키지 않음.

추가로 다음을 구현했다.

- 장치별 증가 sequence와 DB trigger로 **변경된 주행/품질만** 동기화. 기존 주행 수정·품질 삭제도 포함하며, 페이지 저장 완료 후 cursor를 확정한다. cloud 보존기간 삭제가 HA 과거 이력을 지우지는 않는다.
- 변경 없는 주행 조회는 인덱스 쿼리 1개. 레거시 품질 조회는 주행별 2개에서 페이지별 일괄 2개로 축소. telemetry는 device/cursor 인덱스와 10페이지 상한을 사용한다.
- HA 중복 이벤트 저장/계산 무효화를 제거하고, 배터리 이력 계산을 revision·설정·분 단위로 공유한다. 요청 취소가 다른 사용자의 계산을 취소하지 않는다.
- 실제 쓰는 카드와 언어만 지연 로딩한다. 디버그 카드나 반대 언어를 먼저 다운로드하지 않는다.
- 파라미터 폴링은 평상시 15초, 설정 화면 사용·대기 명령이 있을 때 3초. 만료되는 activity lease를 사용하며 오류는 최대 120초 backoff. 같은 설정 snapshot이면 catalog를 재전송하거나 iframe을 갱신하지 않는다.
- 거절된 명령도 failed ACK로 종료하고, 이미 적용된 명령은 durable ID로 재적용을 막는다. Comma queue DB는 Git 디렉터리 밖 `/data/carrot_ha`로 이전하며 기존 적용 이력을 보존한다.
- 갱신 시 HA 상위 shadow root의 스크롤과 카드 내부 스크롤, 펼친 상세, 포커스를 보존한다. 같은 경로의 지도는 인스턴스를 재사용하고, 경로 내용만 변경되면 같은 선택 문맥의 확대/위치를 복원한다. 신규 주행으로 배열 인덱스가 밀려도 선택 페이지를 불필요하게 바꾸지 않는다.

아직 배포하지 않았다. 이번 전체 패키지는 Worker migration, Worker, HA, Comma의 순서로 적용해야 한다. HA live 경로 자체는 기존 `/api/latest-state`와 호환된다.

## 무료 한도와 산정

공식 기준:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): Free 요청 100,000회/일, CPU 제한 등 별도 제한 존재.
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): 읽기 5,000,000행/일, 쓰기 100,000행/일. 응답 건수가 아닌 **스캔한 행 수** 기준. 인덱스 갱신/삭제도 고려.
- [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/): 읽기 100,000회/일, 쓰기 1,000회/일.

이번 live 경로의 추가분, HA entry 1개 기준:

| 화면 사용 시간 | 추가 Worker 요청 상한(지속 polling 근사) | D1 접근 | D1/KV 쓰기 |
| --- | ---: | --- | ---: |
| 1시간/일 | 약 240 | 장치 PK 상태 조회 240회 | 0 |
| 24시간/일 | 약 5,760 | 장치 PK 상태 조회 5,760회 | 0 |

여러 탭이 동일 HA entry를 조회해도 이 상한을 공유한다. 서로 다른 HA 설치/entry나 다른 기기는 별도다. 기존 정기 sync 요청은 이 상한과 별도로 유지된다. 날짜 경계의 단발 요청/재시작은 별도이며 이는 하드 계정 quota가 아닌 요청 간격 기반 예산이다.

기존 비용에서 중요한 항목:

- Comma parameter pending은 sleep 3초: HTTP 처리시간 제외 약 28,800요청/일 상한. catalog sync 180초: 약 480회/일. 최신 상태의 15초 조회보다 이 경로가 요청 예산에서 더 큼.
- telemetry는 주차 1,440/주행 2,880회/일 수준에 상태 전환/재전송 추가. D1 최신값+history+인덱스 쓰기는 요청 수와 다르므로 meta로 계측해야 함.
- HA 기본 sync: 최신 상태 약 1,440, 빈 telemetry-history 약 1,440, trip 1~10페이지면 약 1,440~14,400요청/일. backlog 및 fallback은 추가.
- trip 완료 후 offset=0으로 돌아가 **변하지 않은 전체 경로를 반복 다운로드**함. 10건마다 quality 조회 최대 20개 추가. 페이지별 D1 쿼리 수/행 스캔 비용이 요청 수보다 문제일 수 있음.
- D1 fallback trip 목록은 전체 장치 `ORDER BY ended_at DESC,id DESC`; 기존 `(device_id, ended_at)` 인덱스와 맞지 않음. LIMIT 10이라고 10행만 읽는다고 계산하면 안 됨.
- terminal discovery publish는 약 1,440회/일. KV→D1 이전을 되돌리면 무료 KV 쓰기 초과 위험.
- 카메라/다른 Worker/재시도/설정 UI/보존기간 purge까지 포함한 계정 합계는 미계측. 따라서 '모든 기능 무료 보장'이라고 단정할 수 없음.

## 운영에서 확인한 변경 전 병목

2026-10-01에 `wrangler d1 insights id4-ha-db --time-period 1d --sort-by reads --limit 20 --json`으로 조회했다. 반환된 19개 쿼리 그룹의 합계이며 계정 전체 UTC 일일 청구 수치나 Worker HTTP 요청 수와 동일하지 않다.

| 항목 | 쿼리 실행 | 읽은 행 |
| --- | ---: | ---: |
| 전체 주행 목록/경로 반복 조회 | 10,226 | 2,752,812 |
| 주행별 품질 조회 | 89,601 | 86,928 |
| 주행별 거리 품질 조회 | 92,555 | 9,176 |
| 모든 반환 그룹 합계 | 258,054 | 2,892,195 |

전체 주행 목록 조회가 반환된 읽기 행의 **95.18%**였다. 같은 기간 반환 그룹의 쓰기는 11,663행이었다. 파라미터 pending 조회도 22,629회였다. 반복 경로와 idle polling을 먼저 줄여야 한다는 판단이 운영 데이터와 일치한다. SQL 실행 수를 Workers 요청 수로 간주해서는 안 된다.

합성 벤치마크(100개 주행 × 경로 1,000점, 변경 없음):

| 항목 | 기존 전체 목록 방식 | 새 증분 방식 |
| --- | ---: | ---: |
| HTTP 요청 | 10 | 1 |
| SQL 쿼리 | 30 | 1 |
| 응답 바이트 | 5,806,700 | 81 |

기존 방식의 SQL 수는 이미 일괄 품질 조회를 적용한 비교값이다. 실제 구버전의 주행별 쿼리 증폭은 더 컸다. 99.999% payload 감소는 이 fixture의 **변경 없는 동기화** 결과이며 운영 전체 비용 감소율이 아니다. 최초 이력 적재와 실제 변경 경로는 전송한다. 별도 목록/경로 API 분리를 추가해 HA의 오프라인 지도를 약화시키는 대신, HA에 경로를 유지하고 클라우드 중복 전송을 없앴다.

## 적용 순서 및 완료 기준

1. `cloudflare/migration_incremental_sync.sql` 적용. 기존 trip/quality 테이블을 전제로 한다. 초기 revision backfill 및 인덱스 생성의 일회성 비용을 고려한다.
2. Worker 배포. 새 endpoint, activity lease, failed ACK 지원을 먼저 제공한다.
3. HA 0.8.6 업데이트·재시작 및 프런트 새로고침.
4. openpilot의 지정 브랜치에 Git-managed daemon을 배포하고 Comma에서 clean pull·재시작한다. SSH/SCP로 소스를 복사하지 않는다.
5. 아래 24시간 운영 검증으로 마감한다.

404/외부 원천 사용 409는 레거시 호환 모드이며 1시간 후 새 endpoint를 다시 확인한다. 임시 503은 전체 재다운로드로 전환하지 않는다. `WAYON_SERVER_API`가 authoritative source인 설치는 D1으로 몰래 바꾸지 않으며 레거시 비용이 남는다. 그 설치의 증분 개선에는 외부 서버 계약이 추가로 필요하다.

평상시 parameter 요청은 약 28,800 → 5,760/일(80% 감소). 설정 화면이 계속 열려 있으면 3초 주기를 유지한다. 최초 idle-to-active 발견은 최대 약 15초와 네트워크 시간이 필요하다. 최신 telemetry 전송 주기는 늦추지 않았다.

AGENTS의 성능 계약을 이후 변경의 기준으로 삼는다. 측정된 회귀·사용량 변화 없이 캐시/폴링을 다시 전면 변경하지 않는다. 코드와 로컬 검증 완료를 운영 종결과 혼동하지 않는다.

## 운영 검증 기준

- 동일 휴대폰에서 첫 접속/탭 복귀/충전 시작·종료/주행 전환을 비교.
- 측정 시각, Worker updated_at, HA live_checked_at, 브라우저 반영 시각을 각각 기록. '서버 확인 성공'과 '차량 새 측정 수신'을 구분.
- history 조회가 늦거나 실패해도 현재 SOC·충전·안전 상태는 갱신되어야 함.
- Worker에 새 상태가 이미 있다면, 화면 활성 상태에서 통상 다음 15초 조회와 네트워크 시간 안에 반영하는 것을 목표로 함. Comma 수면/수집/업로드 주기는 이 목표에 포함되지 않음.
- 최소 하루, 주행/충전/카메라/설정 사용을 포함해 Workers 요청·CPU, D1 read/write, KV write를 확인. 100%를 운영 목표로 삼지 말고 재시도·다른 서비스를 위한 여유 확보.

## 로컬 검증

- HA Python: 156개 실행, 154개 통과, 2개 skip.
- 프런트 전체 Node: 36개 중 32개 통과. 기존 에너지 계산 2건, motion-status 1건, trip-ui 표시 기대값 1건 실패. 수정 전 추출본에서도 같은 실패를 재현했다. 해당 계산을 이번 성능 작업에서 바꾸지 않았다.
- Worker 기존 schema/auth/history/sync 테스트와 새 증분·품질 변경·재전송·장치 격리·삭제/커서·migration 재실행·인덱스·파라미터 lease/failed ACK 테스트 통과.
- 새 테스트는 live/history 격리, 동시 20클라이언트 병합, 실패 throttle, 오래된 응답 거부, 취소 복구, cursor durable 저장, catch-up 상한, 중복 archive 및 계산 공유, lazy loading, 스크롤/포커스/지도 보존을 검증한다.
- 실제 브라우저의 가짜 HA 응답으로 느린 이력 대기 중 SOC 80 표시, 늦게 온 SOC 30 이력이 최신값을 덮지 않음, KO 모듈만 로딩됨을 확인했다. 별도 SOC 갱신에서도 scrollY 400 → 400을 확인했다. 실제 차량/운영 HA 지연 측정은 아니다.
- Comma parameter 신규 테스트 4개 통과. 전체 HA daemon suite의 기존 camera/API 및 Python 3.9의 asyncio.timeout 호환 실패는 별도이며 전체 통과로 보고하지 않는다.
- JavaScript 문법 및 git diff whitespace 검사 통과. 테스트 fixture의 감소율을 실제 Cloudflare 청구 감소율로 제시하지 않는다.

## 수집 커밋 목록 (관련 경로 전체 로컬 이력)

### carrot-ha

```text
6c8b9fb 2026-10-01 fix(frontend): expand mobile 360 camera modal, fix trip day picker crash, and strip charge time parentheses
abfa94d 2026-10-01 feat: mobile camera modal fix, trip & charge badging improvements, entity categorization, and GPS stabilization (v0.8.5)
448f369 2026-09-30 Improve dashboard loading and map stability
5059146 2026-09-30 feat(frontend): integrate 360 camera monitoring into ko and en main dashboards
8a9fd10 2026-09-30 feat(camera): remove snapshot entities, purge legacy image/camera registry, and route 360 viewer directly to WSS
b20de47 2026-09-30 feat(camera-360): support Option A image entities, PTZ controls, theme-adaptive loading, and SOC blue styling
487f2b7 2026-09-30 fix: offload frontend version reads from HA event loop
f5ae59c 2026-09-30 fix: move terminal discovery from KV to D1
99226e9 2026-09-30 feat: convert camera to snapshot entity and upgrade 360 viewer to ultra-low-latency WebCodecs WSS
13d045d 2026-09-30 fix: resolve trip energy rejection on short trips and preserve merged trip SoC and efficiency
8475469 2026-09-29 Harden cloud sync and trip resilience
7a5c59e 2026-09-29 feat: auto-bootstrap remote terminal discovery via worker without Comma file edits
cdf1b5a 2026-09-29 feat: add parked reverse terminal relay
224482d 2026-09-28 Add lightweight state and trip resume
e47e97b 2026-09-27 Add experimental parked camera support
da96aad 2026-09-27 Center battery icon vertically in charging SoC pill badges and bump version to 0.6.13
eddde67 2026-09-27 Use ha-icon battery icons for SoC badges
96368a2 2026-09-27 Switch default SoC capacity to Default Capacity
209da66 2026-09-27 Fix trip timeline and SOC/energy merging
fb22114 2026-09-27 Add trip merge, timeline UI, pagination & tests
fddd252 2026-09-27 Add charge SoC enrichment and history UI
f46fd29 2026-09-26 trip_repair: preserve energy & handle source changes
19b936c 2026-09-25 Add trip distance derivation & repair tooling
6d9c71e 2026-09-24 Fix lock icon alignment and bump version
b930399 2026-09-24 Prioritize live telemetry recovery and sync
7d5b6b1 2026-09-24 fix: prevent dashboard from replaying stale telemetry during offline recovery
fb97c3f 2026-09-23 Dashboard: range/charging UI fixes & tests
e6bfe92 2026-09-23 Add entity migration & mark estimated sensors
811bcb6 2026-09-22 Add recent efficiency & default range estimation
961ad1e 2026-09-22 Add optional vehicle telemetry & trip energy
d2a0c16 2026-09-22 feat(backend): add ID.4 charging curve and 3-stage ETA smoothing to entities & main dashboard
bfb10a0 2026-09-21 fix(collector): enforce idempotent param sync and safe ACK handling
51389dc 2026-09-21 Confirm param writes and secure iframe bridge
8fb2d6f 2026-09-21 Inline panda helpers into worker.js
e704d37 2026-09-21 Add Carrot parameter sync and UI
3cbeb23 2026-09-21 Sync battery/charge day; improve map markers
ecd2bcf 2026-09-21 Fix trip dashboard day summary selection
b07f8f0 2026-09-21 Compute SOC from battery_wh when present
b69c6c9 2026-09-21 Add reinstall guide and charging metric fix
6faf434 2026-09-21 Add local cache and improve dashboard status
cd61c2d 2026-09-20 Fix parking duration and debug simulation
4c83fd4 2026-09-19 Support battery Wh and direct SOC fallback for trip start and arrival SOC
c09f345 2026-09-19 Fix date picker grid layout and refine trip SOC/efficiency badge UI
70e7653 2026-09-19 Refine trip UI and efficiency hints
fea83d4 2026-09-19 Include SOC% in archive; improve trip UI/icons
4f6fad6 2026-09-19 Simplify vehicle status detection
36c3d20 2026-09-19 Add trip energy enrichment and UI metrics
c73aa64 2026-09-19 Clarify last-known vehicle state when measurements stop
d115f25 2026-09-19 Fix charge metrics fallback and full-width card alignment in charging tab (v0.5.2)
f5ee14e 2026-09-19 Merge main and resolve charging validation dashboard conflicts
76baba3 2026-09-19 Revert comma charging validation changes after CAN fault diagnosis
9fcf64b 2026-09-17 feat: implement database retention and purge policy across HA and Cloudflare (v0.5.1)
4d1ce12 2026-09-16 feat(frontend): port 2-column overview layout, 50% wide mini-maps, and freshness indicators to core dashboard (v0.5.0)
419f63a 2026-09-16 feat: add emergency charging binary sensor and 1kW debug option for ID.4
a492cd9 2026-09-16 Highlight low battery SOC states
4899180 2026-09-16 Frontend: theme, safety fixes, trips & version bump
eeb041f 2026-09-16 Improve debug dashboard UX and charge history
5fc7cc6 2026-09-16 Add trip analytics and debug dashboard
4517ceb 2026-09-15 Improve dashboard charging visuals
98e42dc 2026-09-15 Adjust EV charging marker styling
1f4fba7 2026-09-15 feat(frontend): 충전 시 좌측통합/미충전 시 좌우분리, 상하 여백 격리 및 모바일 2x2 카드 복구 (v0.4.16)
4445763 2026-09-15 feat(frontend): 충전 시각화(80/100% 마커, 스윕 애니메이션, 동적 2x2 카드) 추가 (v0.4.15)
8c40dac 2026-09-15 Add charging ETA and charging power fields
6994617 2026-09-15 Keep charging detection with 60s parking uploads
018cf20 2026-09-14 feat(frontend): 위치 탭 주차/운행 상태별 UI 개선 및 차량 컨디션 카드 추가 (v0.4.12)
cf9db39 2026-09-14 Normalize charge metrics and trip history
6723be7 2026-09-14 fix(frontend): 상태 탭 아이콘 정렬 기준선 보정 및 테마 컬러 일치 (주황색 제거, v0.4.10)
3333756 2026-09-14 feat(frontend): 상태 탭 카드형 아이콘 UI 개편 및 수신 데이터 전체 복사 기능 추가 (v0.4.9)
ce4147e 2026-09-14 fix(frontend): 모바일 충전목록 줄바꿈 방지 및 프론트엔드 캐시 무효화 버전 0.4.8 갱신
6a169c9 2026-09-14 fix(frontend): 충전 날짜 텍스트 왼쪽 정렬 강제 (병합 배지로 인한 우측 쏠림 해결)
ebf05e5 2026-09-14 feat(frontend): 15분 이내 인접 충전 기록 자동 병합 및 병합 사유 표기
bc1ebb2 2026-09-14 feat(frontend): 충전 탭 날짜별 필터 추가 및 완속/급속 UI·아이콘 시인성 개선
9d85b63 2026-09-14 feat(frontend): 주행 탭 날짜별 필터링 및 UI 개편
231fde6 2026-09-14 Validate inferred charging and report confirmed charging every 30 seconds
80e0a64 2026-09-14 Reorder and relabel quick metrics in dashboard
a1f0ca1 2026-09-14 Update charging tab tile layout: remove charging status and reorder metrics
c182312 2026-09-14 Replace hatched pattern with gray gradient for parked and last-known battery bars
a7fa25b 2026-09-14 Center charging bolt on the merged band and keep bar widths uniform
be66e19 2026-09-14 Merge adjacent charging backgrounds in battery history chart
d3f1145 2026-09-13 Load manifest in executor to avoid blocking
cef66cc 2026-09-13 Add automatic frontend version loading
c794d38 2026-09-13 English md added, Added English support for HA dashbaord card
888fa99 2026-09-13 Fix repository folder structure
```

### openpilot daemon

```text
e4dab1a3 2026-10-01 feat(carrot-ha): set fresh flag on valid GPS telemetry
4448c79c 2026-09-30 feat(carrot-ha): upgrade camera streaming to low-latency WLV1 wire protocol
26dbb82d 2026-09-30 fix(carrot-ha): prevent camera capture crash on negative PTS and guard mux errors
205b8a67 2026-09-30 feat(carrot-ha): synchronize multi-camera PTS timestamps with shared origin
ddd6ec74 2026-09-29 fix(carrot-ha): run parked camera from git without revision pinning
e96fd20a 2026-09-29 feat(carrot-ha): bootstrap remote terminal config automatically via worker discovery
663fc996 2026-09-29 feat(carrot-ha): add native remote terminal client
07be35fe 2026-09-28 feat(carrot-ha): integrate Carrot HA as native openpilot daemon with auto-sync workflow
```
