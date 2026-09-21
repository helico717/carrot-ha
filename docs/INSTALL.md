# 처음 설치하기

한국어 | [English](INSTALL.en.md)

대상: HA가 실행 중이며 콤마 SSH 접속을 할 수 있는 사용자. Carrotpilot은 차량에서 정상 실행 중이어야 합니다. 공장 초기화 기기는 먼저 제작자 안내로 Carrotpilot을 설치하세요. 브랜치 이름만 같다고 데이터 호환이 보장되지는 않습니다.

> 콤마만 초기화했다면 새 서버를 만들지 말고 [Windows/Mac 재설치·복구 가이드](REINSTALL.md)를 사용하세요.

## 1. PC에서 파일 준비

### Windows PowerShell

GitHub 저장소 → Code → Download ZIP → 압축 해제합니다. 아래 PC 명령은 압축 해제한 `cloudflare` 폴더에서 PowerShell을 연 상태로 실행합니다.

Node.js 공식 사이트에서 Windows x64 버전을 설치하세요. `node -p "process.arch"`가 `ia32`이면 32비트이므로 교체해야 합니다.

```powershell
npm.cmd install
.\node_modules\.bin\wrangler.cmd login
.\node_modules\.bin\wrangler.cmd d1 create id4-ha-db
.\node_modules\.bin\wrangler.cmd kv namespace create SNAPSHOTS
```

Cloudflare 계정은 각 사용자가 따로 만듭니다. D1은 기록 저장소, KV는 서버가 사용하는 보조 저장소입니다. 결과의 database_id와 KV id를 메모합니다. 아래 설정 프로그램에 두 값을 입력하세요. `id4`가 들어간 서버/폴더 이름은 호환성을 위한 내부 이름이며 ID. Buzz에서도 그대로 사용합니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
.\node_modules\.bin\wrangler.cmd d1 execute id4-ha-db --remote --file .\schema.sql
.\node_modules\.bin\wrangler.cmd deploy
```

배포 결과에 나온 전체 HTTPS 주소를 보관합니다. 본인 계정 부분이 포함된 workers.dev 주소입니다. 별도 도메인이나 HA 포트 개방은 필요 없습니다. 사용 한도와 요금은 Cloudflare에서 확인하세요.

```powershell
node -e "const c=require('node:crypto'); for(const k of ['UPLOAD','VIEW','HA_LOCAL']) console.log(k+': '+c.randomBytes(32).toString('hex'))"
.\node_modules\.bin\wrangler.cmd secret put WAYON_UPLOAD_TOKEN
.\node_modules\.bin\wrangler.cmd secret put WAYON_VIEW_TOKEN
```

생성된 세 비밀번호를 개인 비밀번호 관리 도구에 보관합니다. 첫 secret 질문에는 UPLOAD 값을, 두 번째에는 VIEW 값을 넣습니다. 제목은 빼고 문자열만 입력합니다. HA_LOCAL은 HA 통합 최초 등록에 사용합니다. 공개 저장소에 올리지 마세요.

### Mac 터미널

Node.js 공식 사이트에서 Mac CPU에 맞는 버전을 설치하세요(Apple Silicon은 arm64, Intel은 x64). ZIP을 풀고 터미널에서 해당 `cloudflare` 폴더로 이동합니다. 예: `cd "$HOME/Downloads/carrot-ha-main/cloudflare"`.
이 절의 서버 생성 명령은 **서버까지 처음 만드는 경우에만** 실행합니다.

```bash
npm install
npx wrangler login
npx wrangler d1 create id4-ha-db
npx wrangler kv namespace create SNAPSHOTS
```
D1 database_id와 KV id를 기록합니다. Windows 전용 `setup.ps1` 대신, 코드 편집기로 `cloudflare/wrangler.json`을 만들고 아래 두 `YOUR_…` 값을 실제 ID로 교체하세요. 기존 설정 파일이 있으면 덮어쓰기 전에 내용을 확인합니다.

```json
{
  "name": "id4-ha-cloud",
  "main": "src/worker.js",
  "compatibility_date": "2026-05-14",
  "workers_dev": true,
  "d1_databases": [
    {"binding": "DB", "database_name": "id4-ha-db", "database_id": "YOUR_D1_DATABASE_ID"}
  ],
  "kv_namespaces": [
    {"binding": "SNAPSHOTS", "id": "YOUR_KV_NAMESPACE_ID"}
  ]
}
```
같은 cloudflare 폴더에서 아래 명령을 한 줄씩 실행합니다. 오류가 나면 중단하세요.

```bash
npx wrangler d1 execute id4-ha-db --remote --file schema.sql
npx wrangler deploy
node -e "const c=require('node:crypto'); for(const k of ['UPLOAD','VIEW','HA_LOCAL']) console.log(k+': '+c.randomBytes(32).toString('hex'))"
npx wrangler secret put WAYON_UPLOAD_TOKEN
npx wrangler secret put WAYON_VIEW_TOKEN
```
배포된 Worker HTTPS 주소와 세 토큰을 보관합니다. 첫 Secret 입력에는 UPLOAD, 두 번째에는 VIEW를 입력합니다. HA_LOCAL은 HA 최초 등록용입니다. Mac에서는 `.cmd`, `powershell.exe`, `setup.ps1` 명령을 실행하지 않습니다.

## 2. HA 설정

README의 HACS 설치 순서로 설치합니다. 장치 ID는 본인이 정한 영문 이름(예: `my-buzz`)입니다. 차량 VIN이나 HA 엔터티 ID가 아닙니다. 최초 등록 토큰은 HA_LOCAL, 구성의 읽기 토큰은 VIEW입니다. 차량 모델과 SOC 계산 용량은 본인 차량에 맞춥니다.

## 3. 콤마에 수집기 복사

주차한 상태에서 진행합니다. [복구 가이드 2~3절](REINSTALL.md#2-pc에서-ssh-접속-준비)의 **Windows PowerShell 또는 Mac 터미널** 절차로 SSH를 준비하고 수집기 파일을 `/data/id4-collector`에 복사하세요. 최초 설치에서도 같은 전송 명령을 사용합니다. Windows는 WinSCP도 사용할 수 있습니다.

콤마 SSH에서:

```bash
cd /data/id4-collector
python3 configure.py
```

Worker URL, HA와 같은 장치 ID, UPLOAD 토큰을 입력합니다. 이어서:

```bash
PYTHONPATH="/data/openpilot/pydeps:/data/openpilot${PYTHONPATH:+:$PYTHONPATH}" /usr/local/venv/bin/python3 install.py
python3 /data/id4-collector/status.py >&2
```

install.py는 시작 파일과 DBC 구조를 확인하고 자동 실행을 등록합니다. 지원하지 않는 시작 파일/모듈 오류가 나오면 강제로 우회하지 말고 브랜치 정보를 포함하여 문의하세요. 수집기는 별도 프로세스이므로 추가 메모리를 사용합니다. 모든 브랜치에서 무부하를 보장하지 않습니다.

## 4. 다른 MEB 차량의 확인 순서

1. 주차 중 현재 배터리·주행거리·외기온이 실제 값과 합리적으로 맞는지 확인합니다. 값이 없으면 센서를 지원한다고 판단하지 마세요.
2. 첫 설치 직후 로그 확인: `tail -n 30 /data/id4-collector/collector.log >&2`.
3. 정상 사용 후 주행 경로·충전 기록을 확인합니다. 데이터는 수신 전용이며 CAN 명령을 보내지 않습니다.
4. 인터넷 단절 후 복귀하면 status의 pending이 줄고 delivery가 ok인지 확인합니다. 차량이 잠들어 데이터를 주지 않거나 콤마가 꺼진 구간은 복구할 수 없습니다.
5. 문제가 있으면 `python3 /data/id4-collector/disable.py`로 중단합니다. 데이터와 Git 체크아웃은 보존합니다.

ID. Buzz는 현재 실차 검증 전입니다. 연식, 배터리 사양, Carrotpilot 브랜치와 commit을 기록해 주세요. 개인정보·토큰을 제외한 오류로 호환성을 확인합니다.

## 알려진 범위

충전 분류/전력/SOC는 추정값입니다. 상세 표본이 없는 구간은 그래프의 마지막 확인값으로 표시할 수 있지만 사용량 계산에는 포함하지 않습니다. 기록은 현재 서버·HA의 보관 정책에 따라 삭제될 수 있으므로 [종합 설명서](GUIDE.md)의 기록 범위를 확인하세요.
