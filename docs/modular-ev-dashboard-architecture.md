# Carrot HA — 범용 EV 카드 호환 및 모듈형 대시보드 아키텍처 로드맵 (Modular EV Architecture)

> **문서 상태**: 설계 및 미래 구현 로드맵 (Draft & Planned Architecture)  
> **최초 작성일**: 2026-10-01  
> **핵심 과제**: 전용 모놀리식 대시보드 종속성 탈피 → 타사 EV 카드(Vehicle Status Card, Ultra Vehicle Card 등)와의 100% 호환 및 모듈형 서브 카드(Lego Block) 체계 구축

---

## 1. 문제 제기 및 배경 (The Dilemma)

### Q. "왜 다른 멋진 EV 대시보드 카드가 많은데, Carrot HA는 전용 대시보드만 써야 하나요?"
현재 Home Assistant 생태계에는 [Vehicle Status Card], [Ultra Vehicle Card], [Mushroom Cards] 등 유저들이 자유롭게 꾸밀 수 있는 뛰어난 범용 EV 카드들이 많습니다.

하지만 현재 Carrot HA는 다음과 같은 구조적 한계로 인해 **전용 올인원 대시보드(`carrot-dashboard.js`) 사용이 강제**되고 있습니다:
1. **복합 데이터의 엔티티 부재**:
   - 일반적인 EV 카드는 HA의 표준 엔티티(`sensor.*`, `binary_sensor.*`)의 `state`만 읽어옵니다.
   - 반면 Carrot HA의 핵심 가치인 **30분 단위 트립 병합, 일별 주행거리/전비, 정밀 충전 곡선, 충전 요금 계산, 24시간 타임라인**은 HA 센서에 존재하는 것이 아니라 대시보드 JS 내부와 Cloudflare Worker D1 DB에서 복합 계산되어 표시됩니다.
2. **모놀리식(Monolithic) UI 구조**:
   - 대시보드 전체(차량 상태 뷰, 충전 탭, 주행 기록 탭, 360° 카메라 뷰어)가 하나의 거대한 코드로 묶여 있어, 사용자가 "트립 기록만 떼어내어 내 대시보드에 붙이기"가 불가능합니다.

---

## 2. 해결 전략: 3단계 아키텍처 개편

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Layer 3. 프론트엔드 표현 계층 (Presentation)           │
│                                                                        │
│   [ 타사 범용 EV 카드 ]         [ Carrot 모듈형 서브 카드 ]    [ 기존 전용 대시보드 ]
│   - Ultra Vehicle Card         - carrot-trip-card             - carrot-dashboard-ko
│   - Vehicle Status Card        - carrot-charge-card           - carrot-dashboard-en
│   - Mushroom Chips/Tiles       - carrot-camera-360-chip                            │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│                   Layer 2. Universal EV Adapter (HA 표준화 계층)       │
│                                                                        │
│   • 파생 엔티티 확장 (Derived Sensors & Rich Attributes)                  │
│     - sensor.id4_last_trip (거리, 전비, 시간, 배터리 사용량)              │
│     - sensor.id4_charging_session (충전량, 요금, 예상 완료 시각, 완속/급속) │
│     - sensor.id4_today_summary (오늘 주행거리, 전비, 누적 충전량)          │
│   • HA WebSocket Service & Action API                                  │
│     - carrot_ha.get_trips (타임라인/경로 좌표 조회)                      │
│     - carrot_ha.open_camera_360 (어느 카드에서나 360 모달 트리거)         │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│                   Layer 1. Carrot Data Engine (CAN & Cloud Ingestion)  │
│                                                                        │
│   • Openpilot Comma 3/3X CAN Telemetry (1Hz 실시간)                    │
│   • Cloudflare Worker D1 Database (초단위 기록 & 이력)                  │
│   • Python Calculation Engine (trip_repair, battery_history)           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 핵심 구현 방안

### Track A. 데이터의 엔티티 표준화 (Rich Entity Attributes)
타사 EV 카드들이 Carrot의 고품질 데이터를 그대로 읽을 수 있도록, 단일 수치 센서를 넘어 **풍부한 속성(Attributes)**을 가진 종합 센서를 제공합니다.

1. **`sensor.<vehicle>_last_trip` (최근 주행 센서)**:
   - State: `15.4 km` (최근 주행 거리)
   - Attributes:
     ```yaml
     duration_minutes: 24
     energy_kwh: 2.85
     efficiency_km_kwh: 5.4
     start_soc: 82
     end_soc: 77
     start_time: "2026-10-01T14:20:00"
     end_time: "2026-10-01T14:44:00"
     ```
2. **`sensor.<vehicle>_current_charge` (충전 세션 센서)**:
   - State: `charging` / `complete` / `unplugged`
   - Attributes:
     ```yaml
     power_kw: 62.4
     added_kwh: 18.2
     start_soc: 24
     target_soc: 80
     current_soc: 55
     estimated_cost_krw: 5820
     time_remaining_minutes: 28
     charger_type: "DC_FAST"
     ```
3. **`sensor.<vehicle>_today_driving` (오늘의 주행 요약)**:
   - State: `오늘 총 주행거리`
   - Attributes: 오늘 총 소모 전력, 평균 전비, 주행 횟수, 총 주행 시간.

👉 **효과**: Ultra Vehicle Card, Vehicle Status Card 등에서 엔티티 선택만으로 Carrot의 정확한 CAN 기반 트립/충전 데이터를 그대로 매핑하여 사용할 수 있습니다.

---

### Track B. 모듈형 레고 블록 카드 (Micro Lovelace Cards)
기존 모놀리식 대시보드를 독립적인 개별 카드로 분할하여, 사용자가 원하는 카드만 골라 자신의 대시보드 그리드에 배치할 수 있도록 합니다:

1. **`carrot-trip-history-card`**:
   - 일자별 주행 목록, 24시간 타임라인, 지도 GPS 경로 뷰어만 담당하는 독립 카드.
2. **`carrot-charge-monitor-card`**:
   - 실시간 충전 곡선, 완속/급속 프리셋, 충전 비용 및 이력만 담당하는 독립 카드.
3. **`carrot-camera-360-chip` (또는 버튼 액션)**:
   - 어떤 카드(Mushroom, Tile, Picture Elements 등)에나 심을 수 있는 1줄짜리 버튼 컴포넌트 또는 탭 액션(`tap_action: fire-dom-event`). 클릭 시 360° WebGL 뷰어 모달 팝업 실행.
4. **`carrot-tire-card`**:
   - 4륜 공기압 및 온도 시각화 전용 미니 카드.

---

### Track C. 블루프린트 & 대시보드 템플릿 제공
타사 카드를 사용하는 유저들을 위한 공식 YAML 템플릿(Recipe) 제공:
- **Recipe 1**: "Ultra Vehicle Card + Carrot HA 연동 완벽 가이드"
- **Recipe 2**: "Mushroom Dashboard로 꾸미는 미니멀 Carrot 전기차 대시보드"

---

## 4. 로드맵 및 단계별 마일스톤

| 단계 | 목표 | 주요 작업 내용 |
| :--- | :--- | :--- |
| **Phase 1** | **엔티티 속성 확장 (Adapter Layer)** | • `sensor.*_last_trip`, `sensor.*_current_charge` 등 복합 파생 센서 추가<br>• 타사 카드가 엔티티 바인딩만으로 주행거리/전비/충전요금을 읽을 수 있도록 지원 |
| **Phase 2** | **360° 카메라 독립 호출 분리** | • 대시보드 종속적인 카메라 모달을 HA 전역 커스텀 액션(`carrot_ha_open_camera_360`)으로 분리<br>• 사용자가 아무 버튼/카드에서나 탭 액션으로 360 카메라를 띄울 수 있도록 지원 |
| **Phase 3** | **서브 카드 분리 (Micro Cards)** | • `carrot-dashboard.js`에서 트립 카드, 충전 카드를 독립 패키징<br>• HACS Lovelace 리소스로 개별 등록 가능하도록 모듈화 |

---

## 5. 결론 및 사용자 질문에 대한 명쾌한 답변 요약

> **"왜 Carrot 대시보드만을 써야 하는가?"에 대한 답:**
> 현재는 대시보드가 단순 뷰어가 아니라 **"데이터 복원 엔진"** 역할을 함께 수행하고 있기 때문입니다.  
> 하지만 궁극적으로 Carrot HA는 **"완벽한 데이터 백엔드(엔진)"**와 **"자유로운 프론트엔드(타사 카드 호환 + 모듈형 블록)"**로 진화할 것이며, 사용자는 자신이 좋아하는 어떤 EV 대시보드 카드에서도 Carrot의 초정밀 CAN 텔레메트리 데이터를 자유자재로 조합해 쓸 수 있게 됩니다.
