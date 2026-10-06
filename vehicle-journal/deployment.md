# Antigravity 및 다른 개발 에이전트 인계: 차계부 배포

이 문서와 루트 `AGENTS.md`, `vehicle-journal/AGENTS.md`를 먼저 읽는다.
사용자가 2026-10-06 확정한 차계부 배포 순서는 다음과 같다.

**수정마다 검증·커밋·푸시 → HA에 직접 반영해 디버깅 → 버그 수정 완료 후
pre-release → 실사용 검증 통과 후 정식 릴리즈.**

차계부 개발 중에는 루트의 매 실행 코드 변경마다 릴리즈하는 기본 정책 대신 이
사용자 지정 정책을 따른다. 커밋 푸시 자체는 HA 설치 코드를 갱신하지 않는다.
개발 에이전트가 직접 반영·확인까지 담당하며 사용자는 필요한 HA 재시작을 수행한다.

## 현재 인계 상태

- `v0.8.13`은 GitHub에서 **pre-release**로 전환했으며 기존 태그를 유지한다.
- 실행 코드 기준 마지막 수정 커밋은 `0ec0afb`이다. 이후 문서 커밋이 추가될 수 있으므로
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

Python 변경은 사용자에게 HA 재시작을 요청한다. 화면 파일만 변경하면 강력 새로고침
(Mac: ⌘+Shift+R, Windows: Ctrl+F5)으로 적용을 확인한다. 브라우저에 이전 모듈이
남을 수 있으므로 파일 배치만으로 화면 적용 완료를 주장하지 않는다.

HACS 업데이트·재다운로드는 직접 배포한 개발 코드를 덮어쓸 수 있다. 테스트 중에는
혼용하지 않고, 사용했다면 배포 커밋과 파일을 다시 확인한다. 롤백은 백업한
**코드만** 복원하며 필요한 경우 사용자가 재시작한다.

## 3. 버그 수정 완료 후 pre-release

사용하지 않은 다음 `0.8.x-beta.N`을 선택하고 manifest와 태그를 일치시킨다.
릴리즈 노트를 `.github/release-notes/<tag>.md`에 준비한다. 커밋·main 푸시 후
새 태그를 푸시한다. 기존 태그는 덮어쓰지 않는다.

`.github/workflows/release.yml`이 GitHub Release를 생성한다. Actions 성공,
**pre-release=true**, 대상 커밋·manifest 일치를 확인한다. 사용자는 HACS에서
베타 버전 표시를 켜고 업데이트·HA 재시작한다. 미검증 항목과 알려진 버그도 기록한다.

## 4. 실사용 검증 후 정식 릴리즈

HA 실기에서 표시·자동 수집·과거 기록·수동 입력·권한·사진·재시작 후 기록 유지·기존
차량 화면 회귀 등 변경에 맞는 검증을 확인한다. 미실시 항목을 통과했다고 보고하지
않는다. 사용자 실사용 확인 후 새로운 정식 `0.8.x`의 manifest·태그·Release를
발행한다. Actions 성공과 정식 Release 여부를 확인한다. Cloudflare·Comma 변경은
이 차계부 배포에 필요하지 않다.
