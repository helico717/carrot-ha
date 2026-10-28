## 0.1.4

- 차량 CAN에서 읽은 표시 SOC와 측정 시각을 주행 시작·종료 기록에 보존해 HA에 전달합니다.
- 현재 HA 통합에서는 이 값을 기존 배터리 엔터티의 표시 SOC로 사용합니다. 별도 관찰용 엔터티를 생성하지 않습니다.
- 배터리 잔량 Wh·소비/충전 에너지·전비 계산은 유지합니다. 표시 SOC가 없는 과거 주행은 기존 형식으로 제공합니다.

## 0.1.3

- 수신/저장/HA ACK/명령 처리 결과·UTC 시각·익명 요청/차량 식별·분당 요약을 로그 화면에 출력.
- DEBUG 1~60분 후 INFO 자동 복귀, 반복 오류 30초 제한, 파일 약 8MiB 순환 보관.
- 토큰/GPS/원본 본문·예외 메시지 비기록 및 검증 추가.
- 초기화 복구 안내와 Windows/Mac 비밀번호 안전 입력 도구 연결.

# 0.1.2

- Preserve existing trip measurement bounds, maximum speed and missing quality metadata behavior.

# 0.1.1

- Authenticated setup using the previous device upload identity, without Git secrets or device file editing.

# 0.1.0

- Independent durable telemetry/trips, scoped credentials and HA incremental API.
- Parameter queue with server identity, durable ACK, validation and active leases.
- Short-lived terminal discovery without Cloudflare.
- HAOS persistent data and cold backup; ARM64/AMD64 container support.
