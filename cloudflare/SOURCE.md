> **2026-10-14 서버 경로 변경:** Cloudflare Worker/D1/KV 관련 설치·배포·한도 설명은 폐기된 과거 기록입니다. 관련 코드 블록을 현재 설치에 실행하지 마세요. 현재 절차: [직접 수신기 설치·복구](../docs/CLEAN_INSTALL_RECOVERY.md). 과거 장애 증거·기록 ID는 보존합니다.

Based on https://github.com/leehyuk1108/Wayon commit 1870bfc9998e9bca6d379a3c266c5e9ce5f47a46, cloudflare/wayon-cloud.
Original D1/KV handlers and bearer upload/view authentication retained.
Changes: only telemetry/json/trips routes exposed; trip offset and include_route added; external Firebase disabled; author bindings removed.

v0.3: append-only telemetry_history with idempotent timestamps, authenticated cursor read API, reject older latest state overwrites.
