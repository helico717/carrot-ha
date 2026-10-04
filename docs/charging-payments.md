# 충전 실제 결제 금액과 비용 요약

충전 탭에서 완료 충전마다 요금 위의 **직접 입력** 버튼을 눌러 실제 결제 총액을 저장합니다. 입력 후 **수정**으로 바뀌며 입력 삭제 시 기존 추정 금액으로 돌아갑니다. 0원은 무료 충전이며 미입력과 다릅니다. 원 단위 정수와 천 단위 쉼표를 허용하며 입력 범위는 0~999,999,999원입니다. 조회·변경은 기존 대시보드와 동일하게 HA 관리자 계정으로 제한합니다.

병합된 한 줄 전체에 결제 금액 하나를 입력합니다. 결제한 원본 충전 ID 목록은 고정되므로 이후 인접 충전이 추가되거나 금액 입력을 삭제해도 기존 범위에 자동 편입하지 않습니다. 동시 수정이나 병합 범위 변경으로 충돌하면 창을 취소하고 새로고침 후 다시 입력합니다. 저장 실패 시 입력값은 유지됩니다.

월간 요금은 실제 입력액을 우선 사용하고 미입력 건의 기존 완속·급속 추정 비용을 합산합니다. `(실제)`, `(추정)`, `(실제+추정)`으로 출처를 구분합니다. 진행 중 충전과 기존 ‘추정’ 센서는 기존 의미를 유지합니다. 장기 비용 요약은 현재 HA에 관측·보존된 완료 충전만 포함하므로 과거 기록이 누락된 기간의 전체 비용을 보장하지 않습니다.

## 보존과 향후 차계부

HA의 `carrot_ha/<entry_id>.sqlite3` 안에 `charge_summaries`, `charge_payments`, `charge_payment_parts` 테이블을 추가합니다. 수기 입력 여부와 관계없이 완료 충전의 ID·일시·충전량·추정 비용·실제 비용 연결·생성/수정 시각을 보존합니다. 원본 이벤트는 변경하지 않으며 기존 90일 정리에서 비용 요약은 제외합니다. HA 백업에는 이 데이터베이스도 포함해야 합니다. HA 재설치 후 백업 없이 복원하거나 데이터베이스를 수동 삭제하면 입력 금액도 사라집니다. 클라우드에는 저장하지 않습니다.

초기 시작 시 남아 있는 충전 원본을 요약으로 보충하며, 새 원본 수신과 요약 저장은 같은 SQLite 트랜잭션으로 처리합니다. 동일 원본 ID 재수신은 중복 요약을 만들지 않습니다. 과거에 이미 삭제된 기록은 복원하지 않습니다. 차량 ID와 원본 ID가 복합 키이며 원본 하나는 한 결제 범위에만 연결됩니다.

귀속 날짜는 HA 시간대의 충전 시작일입니다. 병합 건은 첫 충전 시작일에 전체 금액을 귀속합니다. UTC 시작/종료 시각, 귀속 날짜와 시간대를 보존해 향후 일·주·월·연 집계에 사용할 수 있습니다. 현재 일·주·연 차계부 화면과 주 시작일 설정, 소모품비·정비비 저장 구조는 구현하지 않습니다.

## 인터페이스

충전 history 응답은 `charge_costs_grouped: true`와 이미 병합된 `events`를 제공합니다. 클라이언트는 다시 병합하지 않습니다. 각 `data`에는 `payment_id`, `source_event_ids`, `payment_version`, `estimated_cost_krw`, `actual_cost_krw` (미입력은 null), `effective_cost_krw`, `cost_source`, `currency`, `accounting_date`, `accounting_timezone`, `created_at`, `updated_at`을 포함합니다. `cost_krw`는 추정값으로 유지합니다.

HA WebSocket `carrot_ha/charge_payment/save`와 `carrot_ha/charge_payment/delete`는 `entry_id`, `payment_id`, `source_event_ids`, `expected_version`을 받습니다. save는 정수 `actual_cost_krw`도 필요합니다. 차량 소속과 서버가 계산한 병합 범위를 검증합니다. 변경 버전이 다르면 `conflict`, 잘못된 금액은 `invalid_payment`, 비관리자는 `unauthorized`를 반환합니다. 성공 시 변경 버전을 반환합니다.

대시보드의 `charge_cost_totals`는 `month`, `effective_cost_krw`, `actual_cost_krw`, `estimated_cost_krw` (미입력 건만), `actual_count`, `count`, `cost_source`를 제공합니다. 최신 상태 조회는 메모리에 준비된 합계를 사용해 원본 히스토리 계산을 기다리지 않습니다. 수신·결제 변경 후 갱신하며 월 전환은 로컬 60초 갱신에서 반영합니다. 추가 클라우드 요청·KV 쓰기는 없습니다.

## 검증 기록 — 2026-10-04

저장·수정·삭제·0원·병합 범위 고정·재동기화·재시작·90일 정리·차량 격리·권한·수정 충돌·귀속 날짜 경계를 자동 검사합니다. `tests/charge-payment-browser.cjs`는 Chromium에서 한국어/영어, 390/1200px, 밝은/어두운 테마의 8개 조합과 입력 중 비동기 갱신 후 두 animation frame을 검사합니다.

기존 전체 Node 검사 중 `motion-status.test.mjs`의 연결 상태 unavailable 기대값(unknown)과 현재 구현(parked) 차이는 변경 전 HEAD에서도 재현됩니다. 이번 충전비 작업에서 차량 연결 분류는 변경하지 않습니다. 로컬 검증은 실제 HA 설치 후 사용 검증을 대신하지 않습니다.
