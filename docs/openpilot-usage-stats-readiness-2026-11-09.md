# 오픈파일럿 사용 통계 준비 상태 조사 — 2026-11-09

결론: 전체 거리·현재 활성 여부 기반은 있으나 누적/일별 거리 사용률·최장 연속 사용 거리를 정확히 제공하는 영속 집계와 전용 API는 확인되지 않았다.

근거(로컬 HEAD 6306496 정적 조사):
- collector/collector.py는 selfdriveState.enabled를 읽는다. collector/engine.py는 CAN 속도로 전체 distanceM을 적분하지만 trip에는 활성 거리·연속 구간이 없다. enabled는 주행 기본 30초 텔레메트리에만 포함된다. 이 collector가 현재 차량 설치본과 같다는 확인은 아니다.
- addons/carrot_receiver/receiver.py의 trip 정규화는 distance_m/duration_s/route/distance_quality를 제공하나 사용 통계 필드는 없다. ACK 기반 정리 기준은 telemetry 14일/trips 90일이다.
- custom_components/carrot_ha/cloud_feed.py는 enabled를 state에 전달한다. storage.py overview의 recorded/month/today_distance_km은 전체 거리이며 사용 거리가 아니다. purge_expired 기본값은 state 14일/trip 90일/경로 축소 14일이며 운영 설정·실행 여부는 미확인.
- __init__.py history API는 기존 이벤트 조회 기반이다. driving_logs의 원본 분석/리플레이 기반과 차량 전체 누적·일별 영속 통계 API 준비 완료는 구분한다.

추가 구현 필요:
1. 차량 수집기에서 활성 상태 전환과 속도를 함께 적분해 전체/활성/미확인 거리 및 연속 구간 저장. enabled와 횡방향·종방향 제어의 표시 정의 확정.
2. 구간/주행 스키마를 수신기·HA까지 전달. 재시작·수집 공백은 품질 표시 및 연속성 단절, 재전송은 중복 합산 금지.
3. 자정·시간대를 반영하는 일별 집계 및 원시 자료 삭제와 독립적인 누적 저장. 거리 합계끼리 나눠 비율 계산, 일별 비율 단순 평균 금지.
4. 차량/기간별 summary·daily·선택 날짜 최장 구간 API. 관측 시작일·coverage·추정/누락 상태도 반환.
5. 과거 자료는 완전한 rlog가 있는 범위에서 재계산 가능성 평가. 저주기 enabled 표본만으로 정확한 해제 시점·연속 거리는 복원 불가. 미수집은 0%로 처리하지 않는다.

제약: /Users/davidlim/Documents/openpilot 경로 부재. git pull --ff-only는 FETCH_HEAD 쓰기 권한 제한으로 실패. 원격 최신·차량 설치본·운영 DB 미확인. 실행 코드/UI 변경·테스트·배포·릴리즈 없음. 기존 .claude/launch.json 변경 보존. frontend/carrot-trip-days 2.js 복사본 발견, 삭제·수정하지 않음. 조사 기록은 로컬 작성 상태, 커밋·푸시 미수행.
