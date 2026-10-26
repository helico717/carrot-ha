/** Manual & menu-driven local/AI analysis of saved logs. No parameter writes. */
const css=`
#aiDialog{
  --sp-xs:4px;--sp-sm:8px;--sp-md:12px;--sp-lg:16px;--sp-xl:24px;
  --r-xs:4px;--r-sm:8px;--r-md:12px;--r-lg:16px;--r-round:999px;
  --control-radius:var(--r-sm);--control-min-height:44px;
  --dialog-sheet-radius:16px;--dialog-sheet-radius-mobile:18px;
  --font-sans:"Roboto",system-ui,-apple-system,sans-serif;
  --font-mono:ui-monospace,"Roboto Mono",SFMono-Regular,Menlo,monospace;
  --fs-title-lg:20px;--fs-title-md:18px;--fs-title-sm:16px;--fs-title-xs:14px;
  --fs-body-md:16px;--fs-body-sm:14px;--fs-label-lg:16px;--fs-label-md:14px;--fs-label-sm:13px;
  --md-surface:var(--card-background-color,#090c10);
  --md-surface-cont:var(--card-background-color,#11161d);
  --md-surface-cont-l:var(--secondary-background-color,#151b24);
  --md-surface-cont-h:var(--secondary-background-color,#1b222c);
  --md-surface-cont-hh:color-mix(in srgb,var(--md-surface-cont-h) 82%,var(--primary-text-color,#ffffff));
  --md-on-surface:var(--primary-text-color,#ffffff);
  --md-on-surface-var:var(--secondary-text-color,#eef2f8);
  --md-outline:color-mix(in srgb,var(--md-on-surface) 72%,var(--divider-color,#cbd2de));
  --md-outline-var:var(--divider-color,#7c8594);
  --md-stroke-soft:var(--divider-color,#788191);
  --md-primary:#ffb06d;--md-on-primary:#3a1800;
  --md-action-filled:#9f5a2c;--md-on-action-filled:#fff3ea;
  --md-primary-state:color-mix(in srgb,var(--md-primary) 18%,var(--md-surface-cont-h));
  --md-error:#ff9d94;--md-error-cont:#93000a;--md-on-error-cont:#ffdad6;
  --state-disabled-opacity:.46;
  --focus-ring-width:2px;--focus-ring-offset:2px;
  --focus-ring-color:color-mix(in srgb,var(--md-primary) 80%,transparent);
  --popup-bg:color-mix(in srgb,var(--md-surface-cont) 96%,#000);
  --popup-border-color:color-mix(in srgb,var(--md-stroke-soft) 92%,transparent);
  --popup-radius:var(--dialog-sheet-radius);
  --popup-shadow:0 18px 40px rgba(0,0,0,.34);
  --popup-backdrop:color-mix(in srgb,#000 62%,transparent);
  color-scheme:var(--ha-card-color-scheme,normal);
  width:min(820px,calc(100vw - 28px));
  max-height:calc(100dvh - 28px);
  max-width:none;
  box-sizing:border-box;
  padding:0;
  border:1px solid var(--popup-border-color);
  border-radius:var(--popup-radius);
  background:var(--popup-bg);
  color:var(--md-on-surface);
  overflow:hidden;
  box-shadow:var(--popup-shadow);
  font:14px/1.6 var(--font-sans)
}
#aiDialog *{box-sizing:border-box}
#aiDialog[open]{display:flex;flex-direction:column}
#aiDialog::backdrop{background:var(--popup-backdrop);backdrop-filter:blur(2px) saturate(106%);-webkit-backdrop-filter:blur(2px) saturate(106%)}
#aiDialog [hidden]{display:none!important}
#aiDialog button,#aiDialog input,#aiDialog textarea,#aiDialog select{font:inherit;color:inherit}
#aiDialog .smallBtn,#aiDialog .btn{padding:var(--sp-sm) var(--sp-md);border-radius:var(--control-radius);border:1px solid color-mix(in srgb,var(--md-outline-var) 46%,transparent);background:var(--md-surface-cont-h);color:var(--md-on-surface);cursor:pointer;font-size:var(--fs-label-lg);font-weight:750;min-height:44px;box-sizing:border-box;transition:background .14s ease,border-color .14s ease,color .14s ease,transform .12s ease}
#aiDialog .smallBtn:hover,#aiDialog .smallBtn:focus-visible,#aiDialog .btn:hover,#aiDialog .btn:focus-visible{border-color:color-mix(in srgb,var(--md-primary) 38%,var(--md-outline-var));background:color-mix(in srgb,var(--md-surface-cont-h) 88%,var(--md-primary));outline:none}
#aiDialog .smallBtn:active,#aiDialog .btn:active{background:color-mix(in srgb,var(--md-surface-cont-hh) 88%,var(--md-primary));transform:translateY(1px)}
#aiDialog .btn--filled,#aiDialog .smallBtn.btn--filled{background:var(--md-action-filled);border-color:color-mix(in srgb,var(--md-action-filled) 78%,var(--md-outline-var));color:var(--md-on-action-filled)}
#aiDialog .btn--filled:hover,#aiDialog .btn--filled:focus-visible,#aiDialog .smallBtn.btn--filled:hover,#aiDialog .smallBtn.btn--filled:focus-visible{background:color-mix(in srgb,var(--md-action-filled) 88%,#fff);border-color:color-mix(in srgb,var(--md-action-filled) 84%,var(--md-outline-var));color:var(--md-on-action-filled)}
#aiDialog .btn--filled:active,#aiDialog .smallBtn.btn--filled:active{background:color-mix(in srgb,var(--md-action-filled) 86%,#2a1204)}
#aiDialog .smallBtn:disabled,#aiDialog .btn:disabled,#aiDialog button:disabled{opacity:var(--state-disabled-opacity);cursor:not-allowed}
#aiDialog button:focus-visible,#aiDialog input:focus-visible,#aiDialog select:focus-visible,#aiDialog textarea:focus-visible{outline:var(--focus-ring-width) solid var(--focus-ring-color);outline-offset:var(--focus-ring-offset)}
#aiDialog .c-segmented-control{--segmented-control-gap:var(--sp-xs);--segmented-control-padding:0;--segmented-control-item-min-height:var(--control-min-height);--segmented-control-item-padding:var(--sp-sm) var(--sp-md);--segmented-control-item-flex:1 0 max-content;--segmented-control-item-font-size:inherit;--segmented-control-item-font-weight:750;--segmented-control-item-radius:var(--control-radius);--segmented-control-item-border:color-mix(in srgb,var(--md-outline-var) 46%,transparent);--segmented-control-item-bg:var(--md-surface-cont-h);--segmented-control-item-fg:var(--md-on-surface-var);--segmented-control-selected-border:var(--md-outline);--segmented-control-selected-bg:var(--md-surface-cont-hh);--segmented-control-selected-fg:var(--md-on-surface);--segmented-control-hover-border:var(--segmented-control-selected-border);--segmented-control-hover-fg:var(--segmented-control-selected-fg);display:flex;width:100%;min-width:0;max-width:100%;gap:var(--segmented-control-gap);padding:var(--segmented-control-padding);overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;scrollbar-width:thin;margin-bottom:16px}
#aiDialog .c-segmented-control__item{appearance:none;flex:var(--segmented-control-item-flex);min-width:0;min-height:var(--segmented-control-item-min-height);padding:var(--segmented-control-item-padding);border:1px solid var(--segmented-control-item-border);border-radius:var(--segmented-control-item-radius);background:var(--segmented-control-item-bg);color:var(--segmented-control-item-fg);font:inherit;font-size:var(--segmented-control-item-font-size);font-weight:var(--segmented-control-item-font-weight);line-height:1;text-align:center;white-space:nowrap;cursor:pointer}
#aiDialog .c-segmented-control__item:hover{border-color:var(--segmented-control-hover-border);color:var(--segmented-control-hover-fg)}
#aiDialog .c-segmented-control__item[aria-selected=true],#aiDialog .c-segmented-control__item.is-active{border-color:var(--segmented-control-selected-border);background:var(--segmented-control-selected-bg);color:var(--segmented-control-selected-fg)}
#aiDialog .c-segmented-control--equal{--segmented-control-item-flex:1 1 0}
#aiDialog .c-segmented-control--equal>.c-segmented-control__item{min-inline-size:0}
#aiDialog .chip{--chip-font-size:var(--fs-label-sm);--chip-font-weight:750;--chip-min-height:22px;--chip-padding-block:2px;--chip-padding-inline:10px;display:inline-flex;align-items:center;gap:6px;min-height:var(--chip-min-height);padding:var(--chip-padding-block) var(--chip-padding-inline);border:1px solid color-mix(in srgb,var(--md-outline-var) 42%,transparent);border-radius:var(--r-round);background:color-mix(in srgb,var(--md-surface-cont-h) 80%,var(--md-surface-cont));color:var(--md-on-surface-var);font-size:var(--chip-font-size);font-weight:var(--chip-font-weight);line-height:1;white-space:nowrap}
#aiDialog .chip--accent{border-color:color-mix(in srgb,var(--md-primary) 38%,transparent);background:color-mix(in srgb,var(--md-primary) 14%,var(--md-surface-cont-h));color:color-mix(in srgb,var(--md-primary) 70%,var(--md-on-surface))}
#aiDialog .app-progress__message{min-width:0;color:var(--md-on-surface);font-size:var(--fs-body-md);font-weight:800;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
#aiDialog .app-progress__track{display:block;width:min(360px,100%);min-width:0;height:10px;overflow:hidden;appearance:none;-webkit-appearance:none;box-sizing:border-box;border:0;border-radius:var(--r-round);background:color-mix(in srgb,var(--md-primary) 14%,var(--md-surface-cont-h));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--md-primary) 18%,transparent);margin:20px auto}
#aiDialog .app-progress__track::-webkit-progress-bar{border-radius:inherit;background:color-mix(in srgb,var(--md-primary) 14%,var(--md-surface-cont-h))}
#aiDialog .app-progress__track::-webkit-progress-value{border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--md-primary) 76%,var(--md-action-filled)),var(--md-primary));box-shadow:0 0 8px color-mix(in srgb,var(--md-primary) 62%,transparent)}
#aiDialog .app-progress__track::-moz-progress-bar{border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--md-primary) 76%,var(--md-action-filled)),var(--md-primary));box-shadow:0 0 8px color-mix(in srgb,var(--md-primary) 62%,transparent)}
#aiDialog .ai-head{padding:18px 24px;border-bottom:1px solid color-mix(in srgb,var(--md-outline-var) 42%,transparent);display:flex;justify-content:space-between;align-items:center;gap:14px}
#aiDialog h1{font-size:var(--fs-title-lg);font-weight:850;margin:3px 0 0;line-height:1.35}
#aiDialog .eyebrow{color:var(--md-primary);font-size:11px;letter-spacing:.08em;font-weight:800}
#aiDialog .ai-body{padding:18px 24px 24px;overflow:auto;flex:1;min-height:0;overscroll-behavior:contain}
#aiDialog h2{font-size:var(--fs-title-sm);font-weight:800;margin:18px 0 10px}
#aiDialog h3{font-size:var(--fs-body-sm);font-weight:800;margin:0 0 8px}
#aiDialog p{margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}
#aiDialog .muted{color:var(--md-on-surface-var);font-size:var(--fs-label-sm)}
#aiDialog .scope{border:1px solid color-mix(in srgb,var(--md-outline-var) 46%,transparent);border-radius:var(--r-md);background:var(--md-surface-cont-h);padding:14px;margin:12px 0}
#aiDialog .scope label,#aiDialog .checkline{display:flex;align-items:flex-start;gap:8px;font-size:13px;font-weight:650;margin:10px 0}
#aiDialog .scope input,#aiDialog .checkline input{accent-color:var(--md-primary);margin-top:3px;width:16px;height:16px;flex:none}
#aiDialog .ai-choices{border:1px solid color-mix(in srgb,var(--md-outline-var) 46%,transparent);border-radius:10px;overflow:hidden;max-height:260px;overflow-y:auto}
#aiDialog details{background:var(--md-surface-cont-h);padding:12px 14px;border-bottom:1px solid color-mix(in srgb,var(--md-outline-var) 42%,transparent)}
#aiDialog details:last-child{border:0}
#aiDialog summary{cursor:pointer;overflow-wrap:anywhere;font-weight:700}
#aiDialog .segments{display:flex;flex-wrap:wrap;gap:8px 18px;padding-top:12px}
#aiDialog .segments label{font-size:12px;display:flex;align-items:center;gap:5px}
#aiDialog input[type=checkbox]{accent-color:var(--md-primary);width:16px;height:16px;flex:none}
#aiDialog .field{display:flex;flex-direction:column;gap:7px;margin:14px 0;font-size:13px;font-weight:700}
#aiDialog input:not([type=checkbox]):not([type=radio]),#aiDialog textarea,#aiDialog select{background:var(--md-surface-cont);border:1px solid var(--md-outline-var);border-radius:var(--control-radius);padding:10px 12px;width:100%;min-width:0;color:var(--md-on-surface)}
#aiDialog textarea{resize:vertical;min-height:76px}
#aiDialog .actions{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:18px}
#aiDialog .actions--end{justify-content:flex-end}
#aiDialog .notice{padding:12px 14px;border:1px solid color-mix(in srgb,var(--md-outline-var) 46%,transparent);border-radius:var(--r-sm);background:var(--md-surface-cont-h);font-size:13px;margin:12px 0}
#aiDialog a{color:var(--md-primary)}
#aiDialog .ai-progress{text-align:center;padding:36px 8px}
#aiDialog .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}
#aiDialog .metric{background:var(--md-surface-cont-h);border:1px solid color-mix(in srgb,var(--md-outline-var) 46%,transparent);border-radius:var(--r-md);padding:12px}
#aiDialog .metric strong{font-size:18px;font-weight:850;display:block}
#aiDialog .metric span{font-size:12px;color:var(--md-on-surface-var)}
#aiDialog .finding,#aiDialog .recommendation{border:1px solid color-mix(in srgb,var(--md-outline-var) 46%,transparent);border-radius:var(--r-md);padding:16px;margin:12px 0;background:var(--md-surface-cont-h)}
#aiDialog .evidence{display:inline-flex;width:100%;justify-content:space-between;text-align:left;margin-top:10px;font-size:var(--fs-label-md)}
#aiDialog .value-pair{display:flex;gap:16px;align-items:center;font-size:22px;font-weight:850;margin:12px 0;color:var(--md-primary)}
#aiDialog .value-pair small{font-size:11px;color:var(--md-on-surface-var);display:block;font-weight:600}
#aiDialog .config-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
#aiDialog .report-summary{font-size:16px;line-height:1.65;margin:14px 0;font-weight:650}
#aiDialog .ai-status{min-height:22px;white-space:pre-wrap;color:var(--md-primary);font-size:13px;margin:0 0 8px}
#aiDialog .ai-status:empty{display:none}
#aiDialog .link-button{background:none;color:var(--md-primary);border:0;padding:5px 0;min-height:0}
#aiDialog code{font-family:var(--font-mono);font-size:12px;overflow-wrap:anywhere}
@media(max-width:560px){
  #aiDialog{width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:var(--dialog-sheet-radius-mobile)}
  #aiDialog .ai-head{padding:14px 16px}
  #aiDialog .ai-body{padding:14px 16px 18px}
  #aiDialog .config-grid{grid-template-columns:1fr;gap:0}
  #aiDialog .metrics{gap:7px}
  #aiDialog .metric{padding:9px}
  #aiDialog .metric strong{font-size:16px}
  #aiDialog h1{font-size:var(--fs-title-md)}
}
`;

const markup=`<header class="ai-head"><div><span id="aiEyebrow" class="eyebrow">CARROT · 무료 로컬 분석</span><h1 id="aiTitle">AI 주행 분석</h1></div><button id="aiClose" class="smallBtn" type="button" aria-label="AI 주행 분석 닫기">닫기</button></header><div class="ai-body"><nav id="aiTopNav" class="ai-tabs c-segmented-control c-segmented-control--equal" aria-label="AI 분석 메뉴"><button id="aiAnalysisTab" class="c-segmented-control__item is-active" type="button" aria-selected="true">로그 분석</button><button id="aiConfigTab" class="c-segmented-control__item" type="button" aria-selected="false">분석 설정 · AI 연결</button></nav><p id="aiStatus" class="ai-status" role="status"></p><section id="aiAnalysisPane"><div id="aiConfirm" hidden><p id="aiConfirmRoute" class="muted"></p><div id="aiConfirmScope" class="scope"></div><div id="aiConfirmModeTabs" class="c-segmented-control c-segmented-control--equal" role="tablist" aria-label="분석 방식"><button id="aiModeFree" class="c-segmented-control__item is-active" type="button" aria-selected="true">무료 분석</button><button id="aiModeGemini" class="c-segmented-control__item" type="button" aria-selected="false">Gemini AI 분석</button></div><div id="aiConfirmFreeBox"><p class="notice">API 키·외부 AI 호출 없이 선택한 구간의 가속·감속·조향 신호를 순차 분석하고, 현재 차량 파라미터 카탈로그와 대조해 변경 검토 후보를 제안합니다.</p></div><div id="aiConfirmAiBox" hidden><label class="field">확인하고 싶은 증상<select id="aiConfirmSymptom"><option value="">전체적인 주행 검토</option><option value="가속·출발 시 반응이 급하게 느껴집니다.">가속 · 출발</option><option value="앞차 감속에 대한 반응과 차간거리를 확인하고 싶습니다.">감속 · 차간거리</option><option value="조향 반응과 목표·실제 각도 차이를 확인하고 싶습니다.">조향 반응</option></select></label><label class="field">궁금한 점 · 선택 사항 <span class="muted">개인정보는 입력하지 마세요.</span><textarea id="aiConfirmIssue" maxlength="1300" placeholder="예: 정차 후 출발할 때 가속이 급하게 느껴졌어요."></textarea></label><label class="checkline"><input id="aiConfirmOverrides" type="checkbox">운전자 수동 개입도 관찰에 포함</label><p id="aiConfirmConnection" class="notice"></p><label class="checkline"><input id="aiConfirmConsent" type="checkbox">선택 로그에서 추출한 수치·상대 시각·차종, 현재 설정과 위 설명을 Google Gemini API로 전송하는 데 동의합니다.</label></div><div class="actions actions--end"><button id="aiConfirmCancel" class="smallBtn" type="button">취소</button><button id="aiConfirmStart" class="smallBtn btn--filled" type="button">무료 분석 시작</button></div></div><div id="aiSelection"><div class="actions"><h2>분석할 저장 로그</h2><span id="aiCount" class="muted"></span></div><p class="muted">로그 카드나 세그먼트의 ⋮ 메뉴에서도 바로 무료 분석·AI 분석을 시작할 수 있습니다. 아래에서 직접 완료된 rlog 세그먼트를 최대 8개 선택할 수도 있습니다.</p><div id="aiChoices" class="ai-choices"></div><button id="aiMore" class="smallBtn link-button" type="button" hidden>이전 주행 더 보기</button><label class="field">확인하고 싶은 증상<select id="aiSymptom"><option value="">전체적인 주행 검토</option><option value="가속·출발 시 반응이 급하게 느껴집니다.">가속 · 출발</option><option value="앞차 감속에 대한 반응과 차간거리를 확인하고 싶습니다.">감속 · 차간거리</option><option value="조향 반응과 목표·실제 각도 차이를 확인하고 싶습니다.">조향 반응</option></select></label><label class="field">추가 설명 <span class="muted">선택 사항 · 개인정보는 입력하지 마세요.</span><textarea id="aiIssue" maxlength="1300" placeholder="어떤 상황에서 불편했는지 적어주세요."></textarea></label><label class="checkline"><input id="aiOverrides" type="checkbox">운전자 수동 개입도 관찰에 포함</label><p id="aiConnection" class="muted"></p><label class="checkline"><input id="aiConsent" type="checkbox">선택 로그에서 추출한 수치·상대 시각·차종, 현재 설정과 위 설명을 Google Gemini API로 전송하는 데 동의합니다.</label><p class="muted">원본 로그·영상·GPS·기기 ID는 전송하지 않습니다. 무료 API는 전송 내용이 Google 제품 개선에 사용될 수 있습니다.</p><div class="actions"><span class="muted">버튼을 누를 때만 분석 · 추천값 자동 적용 없음</span><button id="aiStart" class="smallBtn btn--filled" type="button" disabled>선택 로그 분석 시작</button></div></div><div id="aiProgress" class="ai-progress" hidden><span id="aiProgressEyebrow" class="eyebrow">주행 근거 확인 중</span><h2 id="aiPhase" class="app-progress__message"></h2><progress id="aiProgressBar" class="app-progress__track" max="100" value="0"></progress><p id="aiProgressHint" class="muted">선택 구간과 HA의 처리 상태에 따라 수 분 걸릴 수 있습니다.</p><button id="aiCancel" class="smallBtn" type="button">분석 취소</button><p id="aiProgressCostNote" class="muted">취소 전 Google에 전달된 요청은 한도·비용에 반영될 수 있습니다.</p></div><div id="aiResult" hidden></div></section><section id="aiConfigPane" hidden><h2>마지막 주행 자동 무료 분석</h2><label class="checkline"><input id="localAutoLatest" type="checkbox" checked>주행 종료 후 로그 수신이 안정되면 마지막 주행 전체 무료 분석</label><p class="muted">외부 AI 호출 없이 HA 서버에서 마지막 주행의 모든 완료 구간을 순차 분석합니다. 새 구간이 추가되면 수신 안정 후 결과를 다시 갱신합니다.</p><h2>Gemini API 연결</h2><p class="muted">Google AI Pro 앱 구독과 API 프로젝트의 결제·한도는 별개입니다. API 키는 HA 서버에만 저장하며 다시 표시하지 않습니다. 무료 분석에는 키가 필요하지 않습니다.</p><label class="field">Gemini API 키<input id="aiKey" type="password" autocomplete="new-password" spellcheck="false" placeholder="새 키를 입력하면 교체됩니다."></label><div class="actions"><a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">AI Studio에서 키 발급</a><button id="aiClearKey" class="smallBtn" type="button">저장된 키 삭제</button></div><label class="field">분석 모델<select id="aiModel"></select></label><button id="aiCheckModels" class="smallBtn" type="button">키 권한 · 모델 목록 확인</button><p class="muted">모델 목록 조회는 분석을 실행하지 않습니다. 무료 제공 여부·잔여량은 AI Studio가 기준입니다.</p><div class="config-grid"><label class="field">월 예약 예산 (USD)<input id="aiBudget" type="number" min="0" max="100" step="0.1"></label><label class="field">일일 분석 요청 상한<input id="aiDaily" type="number" min="1" max="500" step="1"></label></div><p id="aiUsage" class="notice"></p><p class="muted">표시 금액은 유료 단가와 최대 출력량으로 보수적으로 예약한 값입니다. 무료 이용도 합산하며 실제 청구액·크레딧 잔액은 아닙니다. 이 차량 기능만 제한하고 다른 앱의 사용량은 포함하지 않습니다. 취소·실패에도 예약액을 보존하며 월/일 기준은 UTC입니다.</p><p class="muted">Google의 가격 변경으로 실제 비용과 차이가 생길 수 있습니다. 자동 재시도·다른 유료 모델로의 자동 전환은 없습니다.</p><div class="actions"><a href="https://aistudio.google.com/usage?tab=rate-limit" target="_blank" rel="noopener noreferrer">API 사용량 · 실제 한도 확인</a><button id="aiSave" class="smallBtn btn--filled" type="button">연결 설정 저장</button></div></section></div>`;

function element(tag,text,className){
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  if(className)node.className=className;
  if(tag==='button'){
    node.type='button';
    if(!node.classList.contains('c-segmented-control__item')&&!node.classList.contains('smallBtn'))node.classList.add('smallBtn');
    if(node.classList.contains('primary')){node.classList.remove('primary');node.classList.add('btn--filled');}
  }
  return node;
}
const clock=seconds=>`${Math.floor(Number(seconds||0)/60).toString().padStart(2,'0')}:${Math.floor(Number(seconds||0)%60).toString().padStart(2,'0')}`;

export function bindDrivingAi(card){
  card.shadowRoot.getElementById('aiDialog')?.remove();card.shadowRoot.getElementById('aiStyle')?.remove();
  const style=element('style');style.id='aiStyle';style.textContent=css;card.shadowRoot.append(style);
  const dialog=element('dialog');dialog.id='aiDialog';dialog.setAttribute('aria-label','AI 주행 분석');dialog.innerHTML=markup;card.shadowRoot.append(dialog);
  const $=id=>dialog.querySelector('#'+id), selected=new Set();
  let base='',config=null,localConfig={auto_latest:true},offset=0,hasMore=false,jobId='',jobKind='ai',active=false,timer=null,disposed=false,controller=new AbortController(),report=null,confirmCtx=null,confirmMode='free',scopeChoices=[];
  const status=text=>{$('aiStatus').textContent=text||'';};
  function notifyExplorer(){
    card.shadowRoot.querySelector('iframe')?.contentWindow?.postMessage({type:'carrot:logs_refresh_analysis',base},location.origin);
  }
  async function api(path,body){
    const response=await fetch(base+'/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(disposed)throw new Error('화면이 닫혔습니다.');
    if(response.status===401)throw new Error('로그 세션이 만료되었습니다. 화면을 새로고침해 주세요.');
    let data;try{data=await response.json();}catch{throw new Error('분석 API를 불러오지 못했습니다. HA 재시작·업데이트 상태를 확인해 주세요.');}
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'요청을 처리하지 못했습니다.');return data;
  }
  async function action(work){try{await work();}catch(error){if(!disposed&&error.name!=='AbortError')status(error.message);}}
  function setHeading(title,mode='free'){
    $('aiTitle').textContent=title;
    $('aiEyebrow').textContent=mode==='free'?'CARROT · 무료 로컬 분석':'CARROT · GEMINI';
  }
  function view(name){
    for(const [id,key] of [['aiConfirm','confirm'],['aiSelection','selection'],['aiProgress','progress'],['aiResult','result']])$(id).hidden=name!==key;
    $('aiTopNav').hidden=name==='confirm';
  }
  function tab(settings){
    $('aiAnalysisPane').hidden=settings;$('aiConfigPane').hidden=!settings;
    $('aiAnalysisTab').classList.toggle('is-active',!settings);$('aiConfigTab').classList.toggle('is-active',settings);
    $('aiAnalysisTab').setAttribute('aria-selected',String(!settings));$('aiConfigTab').setAttribute('aria-selected',String(settings));
    if(settings)setHeading('분석 설정','free');
  }
  function chosenConfirmSegments(){
    return scopeChoices.find(item=>item.input.checked)?.names||[];
  }
  function updateConfirmState(){
    const names=chosenConfirmSegments();
    const isFree=confirmMode==='free';
    $('aiModeFree').classList.toggle('is-active',isFree);$('aiModeGemini').classList.toggle('is-active',!isFree);
    $('aiModeFree').setAttribute('aria-selected',String(isFree));$('aiModeGemini').setAttribute('aria-selected',String(!isFree));
    $('aiConfirmFreeBox').hidden=!isFree;$('aiConfirmAiBox').hidden=isFree;
    $('aiConfirmConnection').textContent=config?.configured?`${config.model} · 키 저장됨 (선택 구간의 요약 근거만 전송)`:'Gemini API 키가 없습니다. 무료 분석은 바로 사용할 수 있으며, Gemini AI 분석은 분석 설정에서 키를 먼저 등록해 주세요.';
    const startBtn=$('aiConfirmStart');
    if(isFree){
      startBtn.textContent='무료 분석 시작';
      startBtn.disabled=active||!names.length;
    }else{
      startBtn.textContent=names.length>8?`AI 분석 시작 (앞 8개 구간)`:'AI 분석 시작';
      startBtn.disabled=active||!names.length||!config?.configured||!$('aiConfirmConsent').checked;
    }
  }
  function update(){
    $('aiCount').textContent=`${selected.size} / 8개 선택`;
    $('aiStart').disabled=active||!selected.size||!config?.configured||!$('aiConsent').checked;
    $('aiConnection').textContent=config?.configured?`${config.model} · 키 저장됨 (권한·잔여 한도는 별도 확인)`:'API 키가 필요합니다. 분석 설정 · AI 연결에서 설정해 주세요.';
    for(const id of ['aiSave','aiClearKey','aiCheckModels','localAutoLatest'])$(id).disabled=active;
    updateConfirmState();
  }
  function showConfig(value){
    config=value;
    const options=(value.models||[]).map(m=>{const option=element('option',m.title);option.value=m.id;return option;});
    $('aiModel').replaceChildren(...options);$('aiModel').value=value.model||'';$('aiBudget').value=value.monthly_budget_usd??2;$('aiDaily').value=value.daily_requests??10;
    $('aiUsage').textContent=`이번 달 예약 $${Number(value.reserved_usd||0).toFixed(3)} / $${Number(value.monthly_budget_usd||0).toFixed(2)} · 오늘 ${value.requests_today||0} / ${value.daily_requests||0}회 (UTC)`;
    update();
  }
  async function loadConfigs(){
    try{showConfig(await api('ai/config'));}catch{}
    try{localConfig=await api('local/config');$('localAutoLatest').checked=Boolean(localConfig.auto_latest);}catch{}
  }
  async function routes(reset=false){
    if(reset){offset=0;$('aiChoices').replaceChildren();}
    const page=await api('dashcam/routes?offset='+offset+'&limit=40');
    for(const route of page.routes||[]){
      const details=element('details');details.open=offset===0&&$('aiChoices').childElementCount===0;
      const time=Number(route.routeStartEpoch)>0?new Date(route.routeStartEpoch*1000).toLocaleString('ko-KR',{hour12:false}):route.route;
      const summary=element('summary',`${time} · ${route.segmentFolders.length}개 구간`),group=element('div',undefined,'segments');
      for(const segment of route.segmentFolders){
        const label=element('label'),input=element('input');input.type='checkbox';input.checked=selected.has(segment);input.setAttribute('aria-label',segment);
        input.onchange=()=>{if(input.checked&&selected.size>=8){input.checked=false;status('Gemini 수동 선택은 한 번에 최대 8개 구간을 선택할 수 있습니다.');return;}input.checked?selected.add(segment):selected.delete(segment);update();};
        label.append(input,document.createTextNode('구간 '+segment.split('--').at(-1)));group.append(label);
      }
      details.append(summary,element('p',route.route,'muted'),group);$('aiChoices').append(details);
    }
    offset+=page.routes?.length||0;hasMore=Boolean(page.hasMore);$('aiMore').hidden=!hasMore;
    if(!offset)$('aiChoices').append(element('p','저장된 주행 로그가 없습니다.','notice'));
  }
  async function ensureRouteSegments(route,fallback=[]){
    if(Array.isArray(fallback)&&fallback.length)return fallback;
    try{
      const page=await api('dashcam/routes?offset=0&limit=80');
      const found=(page.routes||[]).find(r=>r.route===route)||(route==='latest'?page.routes?.[0]:null);
      if(found?.segmentFolders?.length)return found.segmentFolders;
    }catch{}
    return [];
  }
  async function openConfirm(ctx,mode=ctx?.mode||'free'){
    const allSegments=await ensureRouteSegments(ctx.route,ctx.allSegments);
    const checked=Array.isArray(ctx.checkedSegments)?ctx.checkedSegments:[];
    const single=ctx.segment?[ctx.segment]:null;
    confirmCtx={...ctx,route:ctx.route||(allSegments[0]?.split('--').slice(0,-1).join('--')||''),allSegments,checkedSegments:checked};
    confirmMode=mode==='ai'?'ai':'free';
    tab(false);view('confirm');status('');
    setHeading(single?'이 구간을 분석하시겠습니까?':'이 주행을 분석하시겠습니까?',confirmMode);
    $('aiConfirmRoute').textContent=confirmCtx.route||'선택한 주행';
    const scope=$('aiConfirmScope');scope.replaceChildren();scopeChoices=[];
    function addScope(id,label,names,isChecked){
      const wrap=element('label'),input=element('input');input.type='radio';input.name='aiConfirmScopeRadio';input.value=id;
      input.checked=Boolean(isChecked&&names.length);input.disabled=!names.length;
      input.onchange=updateConfirmState;
      wrap.append(input,document.createTextNode(label));scope.append(wrap);
      scopeChoices.push({id,input,names});
    }
    if(single){
      addScope('single','지금 누른 구간 '+single[0].split('--').at(-1),single,true);
    }else{
      addScope('all',`이 주행 전체 ${allSegments.length}개 구간`,allSegments,!checked.length);
    }
    addScope('selected',`목록에서 체크한 ${checked.length}개 구간`,checked,!single&&checked.length>0);
    if(!scopeChoices.some(c=>c.input.checked)){
      const firstEnabled=scopeChoices.find(c=>!c.input.disabled);
      if(firstEnabled)firstEnabled.input.checked=true;
    }
    scope.append(element('p','구간 선택은 뒤의 로그 목록 체크박스를 사용합니다. 이 창에는 별도 구간 선택기가 없습니다.','muted'));
    updateConfirmState();
  }
  function evidenceButtons(ids,result){
    return (ids||[]).map(id=>{
      const evidence=(result.evidence||[]).find(e=>e.id===id);if(!evidence)return null;
      const button=element('button',`${evidence.title} · 구간 ${evidence.segment.split('--').at(-1)} ${clock(evidence.sec)} → 리플레이`,'evidence');
      button.onclick=()=>{dialog.close();card.shadowRoot.querySelector('iframe')?.contentWindow.postMessage({type:'carrot:ai_evidence',base,segment:evidence.segment},location.origin);};return button;
    }).filter(Boolean);
  }
  function resultView(result,ctx=confirmCtx){
    report=result;
    const isFree=result.engine==='local-rules'||result.external_requests===0;
    tab(false);view('result');
    setHeading(isFree?'무료 주행 분석 결과':'AI 주행 분석 결과',isFree?'free':'ai');
    const root=$('aiResult');root.replaceChildren();
    const count=result.scope?.length||result.stats?.segments||0;
    const badge=element('span',isFree?'무료 로컬 규칙 분석 · 외부 API 호출 0회':`${result.model||'Gemini'} · AI 분석`,'chip chip--accent');
    root.append(badge,element('p',`${result.model||'분석'} · ${count}개 구간 분석 완료`,'muted'));
    const metrics=element('div',undefined,'metrics');
    for(const [val,label] of [[`${count} / ${count}`,'처리한 구간'],[`${(result.recommendedParams||[]).length}건`,'변경 검토 후보'],['자동 적용 없음','적용 상태']]){
      const m=element('div',undefined,'metric');m.append(element('strong',val),element('span',label));metrics.append(m);
    }
    root.append(metrics,element('p',result.summary,'report-summary'));
    if((result.findings||[]).length){
      root.append(element('h2','주행 관찰'));
      for(const finding of result.findings){
        const section=element('article',undefined,'finding');
        section.append(element('h3',finding.title),element('p',finding.detail),...evidenceButtons(finding.evidence_ids,result));
        root.append(section);
      }
    }
    root.append(element('h2','파라미터 변경 검토 후보'));
    if(!(result.recommendedParams||[]).length)root.append(element('p','근거가 충분한 변경 후보가 없습니다. 현재 설정을 유지하며 추가 로그를 확인하세요.','notice'));
    for(const param of result.recommendedParams||[]){
      const section=element('article',undefined,'recommendation'),values=element('div',undefined,'value-pair'),current=element('span',String(param.current)),next=element('span',String(param.recommended));
      current.append(element('small','분석 시점 현재값'));next.append(element('small','검토 후보 · 저장 단위'));values.append(current,element('span','→'),next);
      section.append(element('h3',param.title),element('code',param.name),values,element('p',param.reason),element('p','예상 영향·부작용: '+param.tradeoff,'muted'),...evidenceButtons(param.evidence_ids,result));root.append(section);
    }
    root.append(element('h2','분석 범위와 한계'));
    for(const limitation of result.limitations||[])root.append(element('p','· '+limitation,'muted'));
    root.append(element('p','차량 신호는 약 0.25초 간격 표본과 제한된 관찰로 요약됩니다. 모든 순간의 사건·원인·설정 효과를 판정하는 기능은 아닙니다. 리플레이는 구간 시작부터 열리므로 표시된 상대 시각을 직접 확인하세요.','muted'));
    const scopeNames=(result.scope||[]).map(item=>item.segment).filter(Boolean);
    const routeName=result.route||ctx?.route||(scopeNames[0]?.split('--').slice(0,-1).join('--')||'');
    const buttons=element('div',undefined,'actions'),copy=element('button','분석 내용 복사'),reanalyze=element('button','다시 분석…'),other=element('button','다른 로그 분석');
    copy.onclick=()=>action(async()=>{await navigator.clipboard.writeText(JSON.stringify(report,null,2));status('분석 내용을 복사했습니다.');});
    reanalyze.onclick=()=>action(async()=>{
      await openConfirm({route:routeName,segment:scopeNames.length===1?scopeNames[0]:'',checkedSegments:ctx?.checkedSegments||[],allSegments:ctx?.allSegments?.length?ctx.allSegments:scopeNames},isFree?'free':'ai');
    });
    other.onclick=()=>action(async()=>{if(!offset)await routes(true);setHeading('AI 주행 분석','ai');view('selection');status('');});
    buttons.append(copy,reanalyze,other);
    if(isFree){
      const toAi=element('button','이 범위로 Gemini AI 분석…','primary');
      toAi.onclick=()=>action(async()=>{
        await openConfirm({route:routeName,segment:scopeNames.length===1?scopeNames[0]:'',checkedSegments:scopeNames.length>1?scopeNames:[],allSegments:ctx?.allSegments?.length?ctx.allSegments:scopeNames},'ai');
      });
      buttons.append(toAi);
    }
    root.append(buttons);
  }
  async function poll(){
    clearTimeout(timer);if(disposed||!dialog.open||document.hidden||!jobId)return;
    try{
      const endpoint=(jobKind==='local'?'local':'ai')+'/job?id='+encodeURIComponent(jobId);
      const job=await api(endpoint);active=!job.done;update();
      if(job.done){
        notifyExplorer();
        if(job.status==='done'){
          status('추천은 검토용이며 차량에 자동 적용되지 않습니다.');
          resultView(job.result);
        }else{
          view(confirmCtx?'confirm':'selection');
          status(job.error||job.message||'분석이 종료됐습니다.');
        }
        if(jobKind==='ai'){try{showConfig(await api('ai/config'));}catch{}}
        return;
      }
      view('progress');
      setHeading('선택한 저장 로그를 분석하고 있습니다.',jobKind==='local'?'free':'ai');
      $('aiProgressEyebrow').textContent=jobKind==='local'?'CARROT · 무료 로컬 분석':'CARROT · GEMINI';
      $('aiPhase').textContent=job.message||'저장 구간을 분석하고 있습니다.';
      $('aiProgressBar').max=100;$('aiProgressBar').value=job.progress||0;
      $('aiCancel').disabled=job.phase==='canceling';
      $('aiProgressCostNote').hidden=jobKind==='local';
      timer=setTimeout(poll,jobKind==='local'?500:1500);
    }catch(error){if(!disposed&&error.name!=='AbortError')status(error.message+' · 다시 화면을 열면 상태를 확인합니다.');}
  }
  $('aiClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{clearTimeout(timer);$('aiKey').value='';});
  $('aiAnalysisTab').onclick=()=>{tab(false);setHeading('AI 주행 분석',confirmCtx&&!$('aiConfirm').hidden?confirmMode:'ai');};
  $('aiConfigTab').onclick=()=>tab(true);
  $('aiConsent').onchange=update;
  $('aiConfirmConsent').onchange=updateConfirmState;
  $('aiModeFree').onclick=()=>{confirmMode='free';setHeading($('aiTitle').textContent,'free');updateConfirmState();};
  $('aiModeGemini').onclick=()=>{confirmMode='ai';setHeading($('aiTitle').textContent,'ai');updateConfirmState();};
  $('aiConfirmCancel').onclick=()=>dialog.close();
  $('aiConfirmStart').onclick=()=>action(async()=>{
    if($('aiConfirmStart').disabled)return;
    const names=chosenConfirmSegments();if(!names.length)return;
    active=true;update();status('');
    try{
      if(confirmMode==='free'){
        const isFull=confirmCtx?.allSegments?.length>0&&names.length===confirmCtx.allSegments.length&&names.every((n,i)=>n===confirmCtx.allSegments[i]);
        const body=isFull&&confirmCtx.route?{route:confirmCtx.route}:{segments:names};
        const started=await api('local/start',body);
        jobKind='local';jobId=started.job_id;await poll();
      }else{
        const issue=[$('aiConfirmSymptom').value,$('aiConfirmIssue').value].filter(Boolean).join('\n');
        const started=await api('ai/start',{segments:names.slice(0,8),issue,include_overrides:$('aiConfirmOverrides').checked,consent:$('aiConfirmConsent').checked});
        jobKind='ai';jobId=started.job_id;await poll();
      }
    }catch(error){active=false;update();throw error;}
  });
  $('aiMore').onclick=()=>action(async()=>{const button=$('aiMore');button.disabled=true;try{await routes();}finally{button.disabled=false;}});
  $('aiStart').onclick=()=>action(async()=>{
    if($('aiStart').disabled)return;confirmCtx=null;active=true;update();status('');
    try{
      const issue=[$('aiSymptom').value,$('aiIssue').value].filter(Boolean).join('\n');
      const job=await api('ai/start',{segments:[...selected],issue,include_overrides:$('aiOverrides').checked,consent:$('aiConsent').checked});
      jobKind='ai';jobId=job.job_id;await poll();
    }catch(error){active=false;update();throw error;}
  });
  $('aiCancel').onclick=()=>action(async()=>{
    $('aiCancel').disabled=true;
    try{await api((jobKind==='local'?'local':'ai')+'/cancel',{id:jobId});await poll();}
    finally{$('aiCancel').disabled=false;}
  });
  $('localAutoLatest').onchange=()=>action(async()=>{
    const enabled=$('localAutoLatest').checked;
    localConfig=await api('local/config',{auto_latest:enabled});
    $('localAutoLatest').checked=Boolean(localConfig.auto_latest);
    status(localConfig.auto_latest?'마지막 주행 자동 무료 분석을 켰습니다.':'마지막 주행 자동 무료 분석을 껐습니다.');
    notifyExplorer();
  });
  $('aiSave').onclick=()=>action(async()=>{
    const body={model:$('aiModel').value,monthly_budget_usd:Number($('aiBudget').value),daily_requests:Number($('aiDaily').value)};
    if($('aiKey').value.trim())body.api_key=$('aiKey').value.trim();$('aiSave').disabled=true;
    try{
      await api('local/config',{auto_latest:$('localAutoLatest').checked}).catch(()=>{});
      showConfig(await api('ai/config',body));$('aiKey').value='';
      status('HA에 연결 설정을 저장했습니다. 모델 목록으로 키 권한을 확인할 수 있습니다.');
      notifyExplorer();
    }finally{update();}
  });
  $('aiClearKey').onclick=()=>action(async()=>{showConfig(await api('ai/config',{clear_key:true}));$('aiKey').value='';status('저장된 Gemini API 키를 삭제했습니다.');});
  $('aiCheckModels').onclick=()=>action(async()=>{const button=$('aiCheckModels');button.disabled=true;try{const result=await api('ai/models');status(result.message+'\n사용 가능한 모델: '+(result.models.map(m=>m.title).join(', ')||'없음'));}finally{update();}});
  const visible=()=>{if(!document.hidden&&dialog.open&&active)poll();};document.addEventListener('visibilitychange',visible);
  card._detachAi=()=>{disposed=true;clearTimeout(timer);controller.abort();dialog.close();document.removeEventListener('visibilitychange',visible);dialog.remove();style.remove();};
  return {async open(request){
    await card._connect();base=card._session?.base;if(!base)throw new Error('로그 세션이 없습니다.');
    if(!dialog.open)dialog.showModal();
    status('설정과 저장 로그를 확인하고 있습니다.');
    await action(async()=>{
      await loadConfigs();
      status('');
      if(request?.action==='settings'){
        if(!offset)await routes(true).catch(()=>{});
        tab(true);view('selection');update();return;
      }
      if(request?.action==='job'&&request.jobId){
        tab(false);jobKind=request.mode==='ai'?'ai':'local';jobId=request.jobId;await poll();return;
      }
      if(request?.action==='result'||request?.action==='route_free'){
        const route=request.route||'latest';
        try{
          const current=await api('local/result?route='+encodeURIComponent(route));
          if(current.status==='done'&&current.result){
            confirmCtx={route:current.route||route,allSegments:request.allSegments||[],checkedSegments:request.checkedSegments||[]};
            status('추천은 검토용이며 차량에 자동 적용되지 않습니다.');
            resultView(current.result,confirmCtx);
            return;
          }
        }catch{}
        await openConfirm({...request,route:route==='latest'?'':route},'free');
        return;
      }
      if(request?.action==='confirm'){
        await openConfirm(request,request.mode||'free');
        return;
      }
      if(!offset)await routes(true);
      confirmCtx=null;tab(false);setHeading('AI 주행 분석','ai');view('selection');
      if(config?.last_job_id){jobKind='ai';jobId=config.last_job_id;await poll();}
      update();
    });
  }};
}
