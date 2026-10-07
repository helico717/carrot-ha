# Antigravity 및 다른 개발 에이전트 인계: 차계부 배포

이 문서와 루트 `AGENTS.md`, `vehicle-journal/AGENTS.md`를 먼저 읽는다.
사용자가 2026-10-06 확정한 차계부 배포 순서는 다음과 같다.

**수정마다 검증·커밋·푸시 → HA에 직접 반영해 디버깅 → 버그 수정 완료 후
pre-release → 실사용 검증 통과 후 정식 릴리즈.**

차계부 개발 중에는 루트의 매 실행 코드 변경마다 릴리즈하는 기본 정책 대신 이
사용자 지정 정책을 따른다. 커밋 푸시 자체는 HA 설치 코드를 갱신하지 않는다.
개발 에이전트가 직접 반영·확인까지 담당하며 사용자는 필요한 HA 재시작을 수행한다.

## 현재 인계 상태

- 2026-10-07 `65c73eb`: 고정 로더·최신 버전 runtime/의존성 로딩·임시 업데이트 버튼
  HA 직접 배포 및 설치/외부 HTTP 해시 일치 확인. 버전 API `0.8.13-b05e079cc9b3`.
  **최초 전환의 사용자 HA 재시작 1회 및 운영 브라우저 확인은 대기**다.
  이후 화면 모듈 배포는 재시작 없이 갱신한다. 버튼/배너/주기 확인/뷰 저장은
  디버깅·실사용 검증 종료 후 제거하고 고정 로더는 유지한다.

- `v0.8.13`은 GitHub에서 **pre-release**로 전환했으며 기존 태그를 유지한다.
- 실행 코드 기준 마지막 수정 커밋은 `65c73eb`이다. 이후 문서 커밋이 추가될 수 있으므로
  실제 작업 시작 시 `git log`와 원격 main을 확인한다.
- `5a64826`: 비동기 패널 등록 전 할당된 HA 연결 속성을 다시 전달하도록 수정.
  HA 직접 반영 후 사용자 확인과 실제 화면에서 기존 원장 259건 표시를 확인했다.
- `0ec0afb`: 기존 전국 평균 유가 센서 제안과 gas_station_korea의 `원` 단위 지원.
  API와 화면 파일을 HA에 직접 반영하고 SHA-256 일치를 확인했다. **이 Python
  변경 후 HA 재시작·실제 유가 계산 검증은 이 문서 작성 시 아직 확인하지 않았다.**
- 기존 코드 백업은 HA `/config/carrot_ha/deployment-backups/5a64826/`,
  `/config/carrot_ha/deployment-backups/0ec0afb/`에 있다. 개인 DB·사진은 Git에 없다.
- 장기 기록의 원본은 HA 로컬 DB다. `.preview/`와 localhost 미리보기는 개발 확인용이며
  운영 데이터 수집·수동 쓰기 경로를 대체하지 않는다.

## 1. 수정·검증·커밋·푸시

저장소는 `/Users/davidlim/Documents/carrot-ha`, 작업 브랜치는 `main`이다.

```bash
git status --short
git branch --show-current
git fetch origin main
git log --oneline -5
```

다른 작업자의 변경을 덮어쓰지 않는다. 원격과 갈라졌으면 원인을 확인하고 정상 병합한다.
force push나 reset --hard로 해결하지 않는다. 변경에 맞는 검증을 실행한다.

```bash
python3 -m unittest discover -s vehicle-journal/tests -v
python3 vehicle-journal/schema/validate_schema.py
node --check custom_components/carrot_ha/frontend/carrot-vehicle-journal.js
node --check custom_components/carrot_ha/frontend/carrot-journal-panel.js
```

Python 검증에는 Pillow가 필요하다. UI 변경에는 `vehicle-journal/tests/browser-check.cjs`
브라우저 검증도 실행한다. 통합 연결부 변경은 루트의 해당 회귀 검증을 추가한다.
결과와 배포 상태를 `vehicle-journal/CHANGELOG.md`에 기록한다.

```bash
# 실제 변경 파일을 명시한다. 아래 경로는 예시다.
git add custom_components/carrot_ha/frontend/carrot-vehicle-journal.js vehicle-journal/CHANGELOG.md
git diff --cached --check
git diff --cached --stat
git commit -m "vehicle-journal: describe the change"
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

이 단계에는 manifest 버전 상승·태그·Release가 필요 없다. DB·사진·토큰·개인 기록과
`.preview/`는 stage하지 않는다. 기존 `v0.8.13` 태그를 이동시키지 않는다.

## 2. 커밋 코드를 HA에 직접 반영

사용자가 이 차계부 작업에 SSH 직접 반영을 허용했다. HA 주소는
`hassio@192.168.0.140:22`, 이 Mac의 키는 `~/.ssh/id_ed25519`다.
WireGuard VPN 또는 집 LAN 연결이 필요하다. 개인키·토큰은 출력하지 않는다.
이 권한은 **HA**용이며 Comma SSH 소스 편집에는 적용되지 않는다.

아래는 푸시한 커밋에서 화면 파일 **한 개**를 추출해 배포하는 예시다.
실제 변경 파일마다 경로를 확인해 수행한다. 먼저 읽기 전용 SSH 연결 확인을 한다.

```bash
ssh -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10 \
  -i ~/.ssh/id_ed25519 hassio@192.168.0.140 'echo SSH_OK'

journal_commit=$(git rev-parse HEAD)
journal_file=custom_components/carrot_ha/frontend/carrot-vehicle-journal.js
journal_payload=$(mktemp /private/tmp/carrot-journal-deploy.XXXXXX)
git show "$journal_commit:$journal_file" > "$journal_payload"
shasum -a 256 "$journal_payload"

ssh -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10 \
  -i ~/.ssh/id_ed25519 hassio@192.168.0.140 \
  "sudo mkdir -p /config/carrot_ha/deployment-backups/$journal_commit && \
   sudo cp -n /config/$journal_file /config/carrot_ha/deployment-backups/$journal_commit/carrot-vehicle-journal.js && \
   sudo tee /config/$journal_file.deploy-tmp >/dev/null && \
   sudo chmod 644 /config/$journal_file.deploy-tmp && \
   sudo mv /config/$journal_file.deploy-tmp /config/$journal_file && \
   sudo sha256sum /config/$journal_file" < "$journal_payload"
```

새 파일은 백업할 기존 파일이 없으므로, 생성 전에 존재 여부를 확인한다.
기존 파일 백업에 실패하면 배포를 중단한다. 예시 명령을 실제 변경에 맞게 조정하고
종료 코드와 각 단계의 결과를 확인한다. 삭제·의존성 추가·DB 변경은 이 예시만으로
처리하지 않고 변경에 맞는 적용·복구 절차를 마련한다.

로컬과 HA의 SHA-256 일치를 확인하고 커밋·대상 파일·백업 위치·검증 결과를 변경
이력에 남긴다. DB·사진·`.storage`·configuration.yaml을 묶어 동기화하지 않는다.
DB 장애에 대응해 기존 DB를 삭제하고 재생성하지 않는다.

Python 변경은 사용자에게 HA 재시작을 요청한다. 고정 로더 구조로 최초 전환할 때도
사용자가 HA를 한 번 재시작한 뒤 새로고침해야 한다. 이후 고정 로더를 유지한 화면
모듈 변경은 새로고침으로 최신 파일 해시 버전을 조회하므로 HA 재시작 없이 적용한다.
열린 화면에는 디버깅 기간에만 임시 ‘새 화면 버전 적용’ 버튼을 표시한다. 입력·사진·
저장 중에는 적용을 막고, 적용 시 선택 기간/탭/페이지/스크롤을 복원한다. 수정과
실사용 검증이 끝나면 임시 버튼·버전 확인 타이머·뷰 복원 저장을 함께 제거한다.
고정 로더는 유지한다. 상세 조건은 [AGENTS.md](AGENTS.md)의 재시작 없는 화면 배포
항목을 따른다. 로더 자체가 바뀌면 캐시된 최상위 URL 문제를 다시 검토한다.
파일 해시·curl 성공은 서버 배포 검증이며, 실제 브라우저의 모듈 URL·화면·버튼
검증과 구분한다. bf6cd33 사례를 근거로 강력 새로고침만 반복해 해결을 주장하지 않는다.

HACS 업데이트·재다운로드는 직접 배포한 개발 코드를 덮어쓸 수 있다. 테스트 중에는
혼용하지 않고, 사용했다면 배포 커밋과 파일을 다시 확인한다. 롤백은 백업한
**코드만** 복원하며 필요한 경우 사용자가 재시작한다.

## 3. 버그 수정 완료 후 pre-release

먼저 아래의 변경 기록 검증 절차를 완료한다. 릴리즈 노트에는 이번 개발 주기의 누적
변경과 이전 pre-release 대비 새 변경을 구분하고 기준 태그·대상 커밋을 명시한다.

사용하지 않은 다음 `0.8.x-beta.N`을 선택하고 manifest와 태그를 일치시킨다.
릴리즈 노트를 `.github/release-notes/<tag>.md`에 준비한다. 커밋·main 푸시 후
새 태그를 푸시한다. 기존 태그는 덮어쓰지 않는다.

`.github/workflows/release.yml`이 GitHub Release를 생성한다. Actions 성공,
**pre-release=true**, 대상 커밋·manifest 일치를 확인한다. 사용자는 HACS에서
베타 버전 표시를 켜고 업데이트·HA 재시작한다. 미검증 항목과 알려진 버그도 기록한다.

## 4. 실사용 검증 후 정식 릴리즈

정식 릴리즈 노트의 기준은 직전 **정식 릴리즈**다. 중간 pre-release에 이미 나온
변경도 전부 누적해 포함한다. 이전 베타 이후의 수정만 적고 앞선 변경을 빠뜨리지 않는다.

HA 실기에서 표시·자동 수집·과거 기록·수동 입력·권한·사진·재시작 후 기록 유지·기존
차량 화면 회귀 등 변경에 맞는 검증을 확인한다. 미실시 항목을 통과했다고 보고하지
않는다. 사용자 실사용 확인 후 새로운 정식 `0.8.x`의 manifest·태그·Release를
발행한다. Actions 성공과 정식 Release 여부를 확인한다. Cloudflare·Comma 변경은
이 차계부 배포에 필요하지 않다.

## 각 커밋과 릴리즈의 changelog 작성·검증

모든 수정 커밋에 `vehicle-journal/CHANGELOG.md`를 함께 넣는다. 실행 코드뿐 아니라
문서·지침·테스트·설정·배포 방법 변경과 기능 제거·롤백도 기록 대상이다.
같은 날짜의 변경도 커밋 제목으로 구분하고 다음 형식을 사용한다.

```markdown
## YYYY-MM-DD — 변경 제목

- 커밋 제목: vehicle-journal: ... (생성 후 다음 기록 또는 릴리즈에서 해시 연결)
- 변경·이유: 사용자에게 달라지는 동작과 전체 변경 내용
- 관련 파일: 실행 코드·문서·테스트 경로
- 검증: 실행한 검사와 결과, 미검증 항목
- 배포: 푸시/HA 반영/사용자 재시작/실사용 확인을 각각 구분
- 제한·후속 작업: 남아 있는 문제
```

릴리즈 준비 시 Git에서 확인한 실제 기준 태그와 대상 커밋으로 아래를 실행한다.
예시의 BASE_TAG/TARGET은 확인한 값으로 바꾼다.

```bash
git log --reverse --format='%h %s' BASE_TAG..TARGET
git diff --stat BASE_TAG..TARGET
git diff --name-status BASE_TAG..TARGET
```

각 커밋·파일 변경을 CHANGELOG.md와 대조해 누락을 보완한다. 그 전체 변경을
`.github/release-notes/<tag>.md`에 반영하고 해당 노트에 기준 태그·대상 커밋·검증·
알려진 제한을 명시한다. 여러 커밋의 같은 문제를 묶어 서술할 수 있지만 변경 자체는
빠뜨리지 않는다. 문서 변경도 별도 항목으로 남긴다. 자동 생성 커밋 목록만으로
사용자용 설명을 대신하지 않는다.

현재 release.yml은 태그별 노트 파일을 Release 본문으로 사용하고 자동 노트도 추가한다.
따라서 위 파일을 태그 푸시 전에 준비하고 발행 후 GitHub 본문에 실제로 들어갔는지
확인한다. 누락되면 노트와 기록을 보완한다. 개인 데이터·인증정보는 기록하지 않는다.
