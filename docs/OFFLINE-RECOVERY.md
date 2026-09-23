# 오프라인 복구 업데이트

이번 수정은 최신 스냅샷을 우선 전송하고, 이후 최신 telemetry와 FIFO 대기 기록을 번갈아 전송합니다. 재시작 시에도 첫 새 스냅샷 생성 후 업로드를 시작합니다. 업로드 실패 후에는 최신 스냅샷부터 재시도합니다. 과거 기록을 삭제하거나 대기열 DB를 초기화하지 않습니다.

HA는 history를 DB에 저장한 뒤 최신 상태를 한 번 반영하며, 중간 HTTP 오류가 나도 이미 저장한 상태를 반영합니다. 기존의 측정 시각 기반 stale 판정은 유지합니다. 네트워크가 끊겨 있거나 유효한 차량 신호가 없으면 실제 현재 상태를 알 수는 없습니다.

## 교체 파일

현재 저장소 버전의 수집기가 설치된 경우 다음 두 파일을 함께 교체합니다.

| 저장소 파일 | comma 대상 |
| --- | --- |
| `collector/collector.py` | `/data/id4-collector/collector.py` |
| `collector/engine.py` | `/data/id4-collector/engine.py` |

[기존 배포 절차](COMMA-DEPLOY-ENGINE.md)의 파일 전송 → 검증·백업 → 수집기 중단 → 두 파일 교체 → 재시작 순서를 따릅니다. 이 작업은 현재 로컬 체크아웃의 파일을 사용합니다. 아직 원격 저장소에 게시되지 않은 수정본을 원격 URL에서 다운로드하면 안 됩니다.

`connection.json`, `state/collector.sqlite3`, openpilot 파일은 교체하지 않습니다. 이전 버전에서 올라오는 경우 기존 배포 문서 상단의 `telemetry_fields.py` 등 필수 의존 파일 안내도 확인합니다.

HA에서도 `custom_components/carrot_ha/cloud.py`를 `/config/custom_components/carrot_ha/cloud.py`에 적용하고 HA를 재시작합니다. 이번 수정에 Cloudflare Worker 재배포는 필요하지 않습니다.

## 확인

comma에서 `python3 /data/id4-collector/status.py`와 `tail -n 30 /data/id4-collector/collector.log`로 실행 상태와 업로드 오류를 확인합니다. 네트워크 복구 후 새 스냅샷 전송이 성공하면 HA의 다음 동기화(기본 60초 간격)에 반영됩니다. 전송 속도가 기록 생성 속도보다 빠르면 pending이 줄어야 합니다.

대시보드를 닫아 둔 동안에도 HA 동기화는 계속됩니다. 화면을 다시 열어 과거 기록이 저장되어 있는지 확인합니다. 오프라인 기간 자체의 원인은 이 수정의 대상이 아니므로 문제가 계속되면 수집기 로그와 HA 동기화 오류를 확인합니다.
