# 콤마(Comma 4) 파라미터 원격 제어 가이드

홈 어시스턴트(HA)에서 CarrotPilot 파라미터를 원격으로 제어하고 튜닝하기 위한 아키텍처 및 안전 설정 안내입니다.

> [!NOTE]
> **수동 SCP 파일 복사가 필요 없습니다!**  
> `param_sync.py`를 포함한 파라미터 동기화 모듈은 [`helico717/openpilot`](https://github.com/helico717/openpilot)의 `carrot-wip-model_selector-ha` 브랜치(`openpilot/selfdrive/carrot/ha/param_sync.py`)에 이미 정식 내장되어 있습니다.  
> 콤마 기기에서 해당 브랜치를 사용 중이라면 별도의 파일 복사 없이 즉시 사용할 수 있습니다.

---

## 1. 동작 원리 및 아키텍처

```
┌──────────────────────────────────────────────┐
│  Home Assistant                              │
│  custom:carrot-params-card                   │
│  (UI 슬라이더/토글 조작)                      │
└──────────────────────┬───────────────────────┘
                       │ HTTPS POST (변경 요청 큐 추가)
                       ▼
┌──────────────────────────────────────────────┐
│  Cloudflare Worker + D1 Database             │
│  - param_queue 테이블에 요청 등록             │
│  - SNAPSHOTS KV에 현재 설정 스냅샷 캐싱       │
└──────────────────────▲───────────────────────┘
                       │ HTTPS Polling (매 5~10초 주기)
                       ▼
┌──────────────────────────────────────────────┐
│  Comma 4 (selfdrive/carrot/ha/param_sync)    │
│  1. 큐에서 변경 요청 확인                     │
│  2. 로컬 carrot_server(:7000) 검증 및 적용   │
│  3. 적용 후 실제 저장값 역조회 검증          │
│  4. Cloudflare D1 큐에 완료(Ack) 전송        │
└──────────────────────────────────────────────┘
```

---

## 2. 안전 정책 (Safety Policy)

파라미터 원격 제어는 차량 주행 및 조향 안전과 직결될 수 있으므로 엄격한 안전 정책이 적용됩니다:

1. **활성 카탈로그 및 범위 검증**:
   - `param_sync.py`는 기기의 활성 카탈로그에 존재하는 파라미터 및 정해진 허용 범위 내의 값만 검증하여 수용합니다.
2. **로컬 당근 웹 서버 API 경유 필수**:
   - 변경 요청은 반드시 로컬 당근 웹 서버 API(`http://127.0.0.1:7000/api/param_set`)를 통해서만 전달됩니다.
   - **직접 `Params()` 쓰기 우회(Fallback)는 안전 및 정합성 보장을 위해 전면 배제**되어 있습니다.
3. **적용 후 역조회 검증 (Round-trip Verification)**:
   - 파라미터 적용 직후 실제 저장된 값을 다시 읽어 검증한 후 Cloudflare 큐에 완료(Ack)를 전송합니다.
4. **멱등성 및 중복 방지**:
   - 동일한 요청 ID는 SQLite 로컬 저장소에 기록되어 중복 실행되지 않으며, 이미 처리된 요청은 즉시 Ack만 재전송합니다.

---

## 3. 대시보드 카드 추가 방법

대시보드 리소스에 `/carrot_ha_static/carrot-dashboard.js`가 등록되어 있으면 바로 사용할 수 있습니다:

```yaml
type: custom:carrot-params-card
device_id: my-buzz
```

- 실제 콤마 당근 웹(포트 7000)의 고유 디자인과 카테고리 계층, 토글, 숫자 스텝퍼, 다이얼로그를 그대로 제공합니다.
- 파라미터 클릭 시 공식 GitHub Wiki(`Settings-Catalog.json`)의 상세 마크다운 문서를 직접 로드하여 표시합니다.
- 상단 상태 스트립을 통해 실시간 동기화 상태(`연결됨`, `대기 중`, `Comma 적용 확인`, `오류` 등)와 마지막 수신 시각을 표시합니다.

---

## 4. 업데이트 및 유지보수

- 로직 수정이 필요한 경우:
  - Comma 기기 내부에서 파일을 직접 수정(SSH/SCP)하지 마세요!
  - `helico717/openpilot` 저장소의 `openpilot/selfdrive/carrot/ha/param_sync.py`를 수정한 후 커밋 & 푸시합니다.
  - Comma 기기에서는 Home Assistant의 **Comma 원격 터미널** 카드에서 **`[📥 당근 Git Pull]`** 버튼을 누르거나 당근 웹 UI를 통해 간편하게 업데이트합니다.
