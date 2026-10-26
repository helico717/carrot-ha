# Gemini 수동 주행 분석 연결

2026-10-19 확인. HA 로그 화면의 **AI 주행 분석**은 보관된 세그먼트를 사용자가 선택한
뒤 버튼으로 실행한다. 예약/자동 분석이나 추천 파라미터 자동 쓰기는 하지 않는다.

## 현재 계정에서 권하는 경로

사용자 허용 브라우저 조사에서 Google AI Pro(PRO) 표시를 확인했다. 별도로 AI Studio의
기존 API 키 프로젝트는 **무료 등급**, API 결제 화면은 **결제 계정 없음**이었다.
그 프로젝트의 표시 한도는 다음과 같았다. 한도는 바뀔 수 있으며 모델 접근/프로젝트별로
다르다. 이 기능 외 다른 앱도 같은 프로젝트를 쓰면 API 한도를 공유한다.

| 모델 | 분당 요청 | 일일 요청 | 용도 |
| --- | ---: | ---: | --- |
| Gemini 3.8 Flash | 5 | 20 | 우선 사용할 수동 분석 기본 모델 |
| Gemini 3.5 Flash-Lite | 15 | 500 | 더 많은 횟수의 간단한 검토를 원할 때 |

우선 기존 무료 프로젝트에 **HA 전용 키**를 만들어 연결하는 것을 권한다. 키를 여러 개
만든다고 프로젝트 한도가 늘어나지는 않는다. 실제 남은 한도는
[AI Studio 사용량](https://aistudio.google.com/usage?tab=rate-limit)에서 확인한다.
[공식 한도 설명](https://ai.google.dev/gemini-api/docs/rate-limits)

Google AI Pro의 Gemini 앱/개발용 채팅 한도를 외부 HA API에서 그대로 사용할 수는 없다.
다만 현행 Pro 혜택에는 **매월 $10 GenAI·Cloud 개발자 크레딧**이 안내된다.
수령·결제 계정 적용 및 API 프로젝트 연결이 필요하며, 이번 조사에서 활성화/잔액은
확인하지 못했다. 실제 혜택 페이지는 프로그램 참여 안내를 표시했으며 가입/약관 수락은
진행하지 않았다. 결제 설정이나 크레딧 사용 등록도 수행하지 않았다.
[공식 요금제](https://developers.google.com/program/plans-and-pricing),
[혜택 적용 안내](https://developers.google.com/profile/help/benefits#google-cloud-credits)

크레딧을 쓰려면 Google Developer Program의 My Benefits에서 혜택을 확인하고 사용할
Cloud Billing 계정에 적용한 뒤 Gemini API 프로젝트에 연결한다. Gemini 결제 방식에
따라 선불 잔액이 별도로 필요할 수 있다. 크레딧은 지출 상한을 뜻하지 않으므로
API 프로젝트 지출 제한과 청구 화면을 함께 확인한다.
[Gemini 결제 안내](https://ai.google.dev/gemini-api/docs/billing)

## AI Studio와 Cloud Console의 키 차이

| 발급/관리 화면 | 의미 | HA에 사용할 때 |
| --- | --- | --- |
| AI Studio **API keys** | Google Cloud 프로젝트에 연결된 Gemini Developer API 키 | 가장 간단한 경로. 이 통합이 사용하는 API |
| Cloud Console **APIs & Services → Credentials** | 여러 Google API용 키/서비스 계정 관리 | Gemini 접근 권한과 API 제한이 맞으면 같은 Developer API 호출 가능 |
| Cloud Console의 Vertex AI | 별도 Google Cloud AI 서비스와 인증·결제 체계 | 이 통합의 Developer API 키 설정과 호환되는 경로로 간주하지 않음 |
| AI Studio **Apps/Build** | 앱을 만들고 실행·배포하는 화면 | 키 발급 페이지 자체가 아님. 서버 비밀 설정에 Gemini 키를 주입함 |

같은 프로젝트에 속하고 같은 API를 호출하면 발급 화면만 바꿔도 무료/유료 한도가
달라지지 않는다. 현재 Gemini는 표준 키에서 서비스 계정에 묶인 authorization 키로
전환 중이다. AI Studio 신규 키는 이 방식을 기본으로 쓰고, 제한 없는 표준 키는
거부된다. 오래된 일반 Cloud 키라면 Generative Language API 제한/권한을 확인한다.
[공식 키 안내](https://ai.google.dev/gemini-api/docs/api-key)

별도 Openpilot AI Commit Notifier 앱의 표시된 서버 코드는 `@google/genai`의
`GoogleGenAI`에 `process.env.GEMINI_API_KEY`를 전달한다. AI Studio가 관리하는
서버 환경변수 방식이다. **편집 Chat**에는 Pro 구독을 사용한다는 표시가 있었다.
게시 설정의 관리 키와 Cloud Run 컨테이너의 `GEMINI_API_KEY`가 연결된 것을 확인했다.
배포는 기존 Generative Language Client와 다른 **Google 관리 Starter 프로젝트**다.
일반 Credentials 목록은 비어 있고 서비스 계정 목록은 권한 오류이므로 실행 키의
API 과금 계정·정확한 한도까지 확인한 것은 아니다. Chat의 Pro 표시만으로 봇 실행
API도 Pro 무제한이라고 판단하지 않는다. Starter는 결제 계정 없이 관리 배포를
제공하는 별도 환경이다.
[AI Studio 서버 키 관리](https://ai.google.dev/gemini-api/docs/aistudio-build-mode#api-key-management)
및 [공식 Starter 설명](https://cloud.google.com/blog/topics/developers-practitioners/the-starter-tier-for-google-ai-studio-explained)

## HA에 연결하기

1. 새 Python API가 설치된 뒤 사용자가 HA를 재시작한다. 당근웹 로그 화면을 새로고침한다.
2. [AI Studio 키 관리](https://aistudio.google.com/api-keys)에서 사용할 프로젝트에
   HA 전용 Gemini 키를 만든다. 키는 채팅·스크린샷·Git에 붙여넣지 않는다.
3. HA **당근웹 로그 → AI 주행 분석 → AI 연결 · 사용 한도**에서 키를 직접 입력하고
   모델·월 예약 예산·일일 요청 상한을 저장한다. 기본 모델은 `gemini-3.8-flash`다.
4. **키 권한 · 모델 목록 확인**으로 연결을 확인한다. 이 검사는 분석을 실행하지 않는다.
   성공해도 무료 잔여량과 실제 생성 성공까지 보장하지는 않는다.
5. **로그 분석**에서 완료된 세그먼트 1~8개를 선택하고 증상을 적는다. Google에 보내는
   정보에 동의한 뒤 **선택 로그 분석 시작**을 누른다.
6. 관찰 근거의 세그먼트·상대 시각과 설정 후보의 현재값/추천값/부작용을 검토한다.
   리플레이 버튼은 해당 구간을 열며 표시 시각은 사용자가 직접 찾아 확인한다.

키를 입력한 직후 브라우저 입력은 비우며 서버에서도 키를 다시 응답하지 않는다.
완료 결과는 메모리에 임시 보관하며 HA 재시작 시 사라진다. 보관하려면 결과 화면에서
분석 내용을 복사한다.
HA의 `carrot_ha/ai-driving/<entry_id>.json`에 파일 권한 0600으로 저장하므로
HA 설정 백업 역시 비밀 정보로 취급한다. 키 삭제는 저장된 연결 키만 제거하며
이미 예약한 사용량을 초기화하지 않는다. HA 관리자 세션만 이 API에 접근할 수 있다.

## 데이터·결과·한도의 의미

- HA/NAS 원본 rlog를 별도 제한 프로세스에서 읽는다. 압축 로그는 개별 64MiB/합계
  128MiB, 해제 데이터는 구간별 256MiB, 해석 프로세스는 90초로 제한한다.
- 수치는 약 0.25초 간격으로 읽고 구간별 최대 32개 표본/16개 관찰을 만든다.
  Google에는 숫자·상대 시각·차종/제어 방식·증상·현재 설정 설명만 보낸다.
  원본 파일·영상·GPS·기기 ID·실제 세그먼트 이름은 전송하지 않는다.
- 현재 설정은 직접 수신 앱의 읽기 전용 snapshot으로 받으며 주행 당시 값과
  다를 수 있다. 카탈로그를 받지 못하면 주행 피드백만 제공한다.
- 범위/정수형/허용 파라미터/실제 관찰 ID와 맞지 않는 추천은 버린다. 표본 분석이라
  모든 사건을 발견하거나 원인·설정 효과를 검증하는 것은 아니다.
- 무료 API는 전송 내용이 Google 제품 개선에 사용될 수 있다. 유료 표준 API의
  처리 조건은 다르다. 키의 프로젝트 결제 상태를 기준으로 확인한다.
  [데이터 처리·요금표](https://ai.google.dev/gemini-api/docs/pricing)
- 기본 로컬 제한은 일일 10회/월 예약 $2다. Google 청구액이 아니라 현재 단가·입력
  바이트·최대 출력 8,192토큰·2배 여유로 보수적으로 예약한 금액이다. 무료 요청도
  예약한다. 설정 변경은 Google 결제/플랜을 변경하지 않는다.
- 요청 전 예약액을 저장하고 취소/오류/재시작 후에도 보존한다. 월·일은 UTC다.
  Google의 한도 초기화 시각과는 별개이며 이 차량 기능 외 사용량은 포함하지 않는다.
  전체 계정의 절대 청구 상한을 보장하지 않는다. 단가 기준은 2026-10-18이며
  Gemini 3.8 Flash는 2027-01-01 인상 예정이므로 이후 가격을 다시 확인해야 한다.
- 자동 재시도·다른 유료 모델 자동 전환·파일 업로드/검색 도구·자동 파라미터 적용은 없다.
  429가 나오면 AI Studio의 프로젝트별 요청/토큰/일일 한도를 확인한다.

실제 사용자 키로 Gemini 생성 요청과 운영 로그 분석은 별도 검증 대상이다.
합성 데이터와 가짜 제공자 응답을 사용한 로컬 검사를 실제 API 성공으로 보고하지 않는다.
