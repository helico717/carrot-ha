const journalVersion=new URL(import.meta.url).searchParams.get('v')||'journal-20261007-trends-fix-1';
const journalModuleURL=name=>{const url=new URL(name,import.meta.url);url.searchParams.set('v',journalVersion);return url.href;};
const {journalDesign}=await import(journalModuleURL('./carrot-journal-design.js'));
const {preserveView}=await import(journalModuleURL('./carrot-view-state.js'));
// HA-local EV journal. No remote polling, browser token or localStorage records.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=(value,digits=1)=>Number.isFinite(value)?value.toLocaleString('ko-KR',{maximumFractionDigits:digits}):'—';
const money=value=>Number.isFinite(value)?numeric(value,0)+'원':'미확인';
const trendValue=(value,unit)=>unit==='원'?numeric(value,0):String(value);
const categories={charging:'충전비',maintenance:'정비 / 소모품',washing:'세차비',tuning:'튜닝',insurance:'보험',tax:'세금',parking:'주차비',toll:'통행료',other:'기타'};
const uuid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;};
// Normalize locally before upload; camera originals never leave this browser.
async function prepareJournalPhoto(file){
  const maxInput=20*1024*1024,maxStored=2*1024*1024;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>maxInput)
    throw new Error('사진당 20MiB 이하 JPG·PNG·WEBP 사진을 골라 주세요.');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>80000000)
      throw new Error('사진 해상도가 너무 커요. 8000만 픽셀 이하 사진을 골라 주세요.');
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
    if(!context)throw new Error('이 브라우저에서 사진을 압축하지 못했어요.');
    let edge=2560;
    while(edge>=1024){
      const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [.92,.85,.78,.70]){
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
        if(blob&&blob.size<=maxStored){
          return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
        }
      }
      edge=Math.floor(edge*.8);
    }
    throw new Error('사진을 저장 크기로 압축하지 못했어요. 다른 사진을 골라 주세요.');
  }catch(error){
    if(error.name==='EncodingError')throw new Error('사진을 읽지 못했어요. JPG·PNG·WEBP 사진을 골라 주세요.');
    throw error;
  }finally{URL.revokeObjectURL(url);}
}
const kindNames={trip:'주행',charge:'충전',expense:'지출'};
const styles=`
:host{display:block;--j-bg:#0b1014;--j-surface:#161e25;--j-raised:#202c36;--j-border:#2a3945;--j-ink:#f1f6fa;--j-sub:#a8bdca;--j-accent:#81e6c5;--j-blue:#7bb6ff;color:var(--j-ink);font:15px/1.65 system-ui,-apple-system,sans-serif}
*{box-sizing:border-box}button,input,select,textarea{font:inherit;color:inherit}button{background:var(--j-raised);border:1px solid var(--j-border);border-radius:12px;padding:10px 15px;min-height:44px;cursor:pointer}button:disabled{opacity:.5;cursor:wait}input,select,textarea{background:var(--j-bg);border:1px solid var(--j-border);border-radius:10px;padding:10px;width:100%;min-width:0}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--j-blue);outline-offset:3px}h1,h2,h3,p{margin:0}h1{font-size:clamp(28px,4vw,44px);line-height:1.25;letter-spacing:-1px}h2{font-size:20px}small,.muted{color:var(--j-sub)}.shell{background:var(--j-bg);border-radius:24px;max-width:1280px;margin:auto;padding:30px;min-width:0}.mast,.row{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.mast{justify-content:space-between;margin-bottom:24px}.brand{color:var(--j-sub);font-size:12px;letter-spacing:2px}.mast h2{font-size:26px}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.controls input,.controls select{width:auto;max-width:100%}.tabs{display:flex;background:var(--j-surface);padding:6px;gap:5px;border-radius:15px;margin:24px 0;width:100%}.tabs button{flex:1 1 0px;min-width:0;background:transparent;color:var(--j-sub);border:0;white-space:nowrap}.tabs button[aria-selected=true]{background:var(--j-raised);color:var(--j-ink)}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:18px}.panel{background:var(--j-surface);border:1px solid var(--j-border);border-radius:23px;padding:25px;min-width:0}.wide{grid-column:span 8}.narrow{grid-column:span 4}.half{grid-column:span 6}.full{grid-column:span 12}.hero{padding:35px;background:linear-gradient(130deg,#183b37,var(--j-surface))}.accent{color:var(--j-accent)}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:25px 0}.stat small:first-child{min-height:28px;display:flex;align-items:flex-end;margin-bottom:4px}.stat strong{display:block;font-size:21px;font-variant-numeric:tabular-nums;white-space:nowrap}.stat-unit{font-size:12.5px;font-weight:normal;margin-left:2px}.stat-empty{color:var(--j-sub);font-size:15px;font-weight:normal}.kicker{font-size:12px;letter-spacing:2px;color:var(--j-sub);margin-bottom:15px}.primary{background:var(--j-accent);color:#07221b;border:0}.spaced{justify-content:space-between}.list-row{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--j-border)}.list-row small{display:block}.note{color:var(--j-sub);font-size:13px;margin-top:16px}.status{border:1px solid var(--j-border);border-radius:12px;padding:12px;margin-bottom:18px}.error{color:#ffadad}.cost-layout{display:flex;align-items:center;gap:24px;flex-wrap:wrap}.donut{width:150px;height:150px;flex-shrink:0}.cost-list{flex:1;min-width:160px}.chart{width:100%;height:240px;display:block;margin-top:20px}.chart text{fill:var(--j-sub);font-size:12px}.chart-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.chart-controls select{max-width:210px}.table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse;font-size:13px;margin-top:15px}.table th,.table td{text-align:left;border-bottom:1px solid var(--j-border);padding:12px 6px}.table td:last-child{white-space:nowrap}.table small{display:block}.table button{padding:6px 9px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}.fields label{font-size:13px}.fields input,.fields select,.fields textarea{margin-top:7px}.fullfield{grid-column:1/-1}.fieldhelp{font-size:12px;color:var(--j-sub)}dialog{color:var(--j-ink);background:var(--j-surface);border:1px solid var(--j-border);border-radius:24px;width:min(620px,calc(100% - 24px));padding:25px;max-height:90dvh;overflow:auto}dialog::backdrop{background:#000b}.badge{display:inline-block;background:var(--j-raised);border-radius:30px;padding:4px 10px;font-size:12px}.footer{font-size:12px;color:var(--j-sub);margin-top:24px}.preview img{max-width:110px;max-height:90px;border-radius:10px}.compare-value{font-size:34px;color:var(--j-accent);margin:20px 0}[hidden]{display:none!important}@media(max-width:850px){.wide,.narrow,.half{grid-column:span 12}.shell{padding:24px 20px}}@media(max-width:520px){.shell{padding:20px 12px}.panel,.hero{padding:20px}.stats{grid-template-columns:1fr 1fr}.fields{grid-template-columns:1fr}.controls{width:100%}.controls label{flex:1}.controls input{width:100%}.mast h2{font-size:23px}.table th,.table td{padding:10px 4px}.cost-layout{justify-content:center}.stat strong{font-size:18px}.stat-unit{font-size:11.5px}.stat-empty{font-size:13.5px}.stat small:first-child{min-height:26px}}
`;

export class VehicleJournal extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.tab=0;this.offset=0;this.metric='distance_km';this.period='day';this.scope='month';this.comparisonCategory=null;this.recordCategories=new Set();this.recordSort='time';this.entries=[];this.request=0;this.thumbnailCache=new Map();this.lightboxRecord=null;this.lightboxIndex=0;}
  setConfig(config){this.config=config||{};if(!this.ready)this.build();if(this.config.entry_id&&this.entry!==this.config.entry_id){this.entry=this.config.entry_id;this.data=null;this.offset=0;}this.load();}
  set hass(hass){this._hass=hass;if(!this.ready)this.build();this.load();}
  getCardSize(){return 12;}
  getGridOptions(){return {columns:36,rows:'auto',min_columns:6};}
  static getStubConfig(){return {entry_id:''};}
  connectedCallback(){if(!this.ready)this.build();this.visibility=()=>{if(!document.hidden)this.load(true);};document.addEventListener('visibilitychange',this.visibility);this.timer=setInterval(()=>{if(!document.hidden&&!this.$('recordDialog').open&&!this.$('photoViewerDialog')?.open)this.load(true);},60000);this.load();}
  disconnectedCallback(){for(const url of this.photoURLs||[])URL.revokeObjectURL(url);for(const url of this.thumbnailCache.values())URL.revokeObjectURL(url);this.thumbnailCache.clear();this.resize?.disconnect();clearInterval(this.timer);document.removeEventListener('visibilitychange',this.visibility);this.request++;}
  $(id){return this.shadowRoot.getElementById(id);}
  build(){
    this.ready=true;
    this.shadowRoot.innerHTML=`<style>${styles}${journalDesign}</style><div class="shell">
    <header class="mast"><div class="mast-left"><div class="title-controls-row"><h2>차계부</h2><select class="select-pill" id="entry" aria-label="차량"></select><div class="date-navigation" role="group" aria-label="기록 기간 이동"><button class="date-step" id="periodPrev" type="button" aria-label="이전 달" title="이전 달">‹</button><input class="date-pill" id="month" type="month" aria-label="기록 기간"><button class="date-step" id="periodNext" type="button" aria-label="다음 달" title="다음 달">›</button><button class="date-current" id="periodCurrent" type="button" title="현재 기간으로 돌아가기">이번 달</button></div></div></div><div class="mast-right"><button id="add" class="btn-record-primary">＋ 기록 남기기</button><div class="period-segmented" role="group" aria-label="집계 기간 선택">${[['month','월별'],['year','연도별']].map(([key,label])=>`<button class="period-tab-btn ${key==='month'?'active':''}" data-scope="${key}" aria-pressed="${key==='month'}">${label}</button>`).join('')}</div></div></header>
    <nav class="tabs" role="tablist" aria-label="차계부 메뉴">${['대시보드','추세','절약 비교','상세 기록'].map((n,i)=>`<button type="button" role="tab" id="tab${i}" aria-controls="page${i}" aria-selected="${i===0}">${n}</button>`).join('')}</nav>
    <section id="page0" role="tabpanel" aria-labelledby="tab0">
          <div class="grid">

            <!-- 1. 영웅 카드 (클린 3단 큼직한 타이포그래피 문장형) -->
            <article class="panel wide hero" id="heroCard">
              <h1 id="headline">기록을 불러오고 있어요.</h1>
              <div class="stats" id="briefStats"></div>
              <div class="hero-btn-wrap">
                <button id="gotoCompare" class="btn-hero-action" type="button">상세 기록보기 →</button>
              </div>
            </article>

            <!-- 2. 스택형 전월/전년 대비 지출 비교 카드 -->
            <article class="panel narrow comparison-panel is-more" id="targetCard">
              <div class="card-header-row">
                <div>
                  <h2 id="cardTitle">지난달 지출과 비교</h2>
                </div>
                <span id="trendPill" class="trend-badge">비교 중</span>
              </div>

              <div class="spend-headline">
                <div class="spend-statement" id="spendStatement"></div>
              </div>

              <div class="chart-container" id="chartBox">
                <div class="chart-tooltip" id="chartTooltip" aria-hidden="true">
                  <span class="tooltip-dot" id="tooltipDot"></span>
                  <strong id="tooltipCat">충전비</strong>: <span id="tooltipAmount">0원</span> (<span id="tooltipPct">0%</span>)
                </div>

                <svg class="bar-chart-svg" id="barChartSvg" viewBox="0 0 320 185">
                  <!-- 동적 SVG 바 렌더링 -->
                </svg>

                <div class="legend-row" id="legendRow">
                  <button type="button" class="legend-item" data-cat="charging" aria-pressed="false">
                    <span class="legend-dot" style="background:var(--cat-charging);"></span>충전비
                  </button>
                  <button type="button" class="legend-item" data-cat="maintenance" aria-pressed="false">
                    <span class="legend-dot" style="background:var(--cat-maintenance);"></span>정비/소모품
                  </button>
                  <button type="button" class="legend-item" data-cat="washing" aria-pressed="false">
                    <span class="legend-dot" style="background:var(--cat-washing);"></span>세차
                  </button>
                  <button type="button" class="legend-item" data-cat="tuning" aria-pressed="false">
                    <span class="legend-dot" style="background:var(--cat-tuning);"></span>튜닝
                  </button>
                  <button type="button" class="legend-item" data-cat="other" aria-pressed="false">
                    <span class="legend-dot" style="background:var(--cat-other);"></span>기타
                  </button>
                </div>
              </div>
            </article>

            <!-- 3. [사용자 요청 반영] 어디에 썼을까요? (고정 높이 & 상하 중앙 정렬) -->
            <article class="panel half donut-panel" id="donutPanel">
              <h2 id="donutTitle">어디에 썼을까요?</h2>
              <div class="cost-layout">
                <svg class="donut" id="donut" viewBox="0 0 160 160" role="img" aria-label="차량 지출 분류">
                  <!-- 동적 도넛 SVG 렌더링 -->
                </svg>
                <div class="cost-list" id="costs">
                  <!-- 동적 카테고리 목록 (1개든 3개든 중앙 정렬) -->
                </div>
              </div>
            </article>

            <!-- 4. [사용자 요청 반영] 최근 기록이에요 (지출만 표시 & 카테고리별 색상 하이라이트 & +기록 버튼 스타일 일치) -->
            <article class="panel half recent-panel" id="recentPanel">
              <div class="recent-panel-header">
                <h2 id="recentTitle">최근 기록이에요.</h2>
                <button class="btn-recent-record" id="addRecent">
                  <span style="font-size:15px;line-height:1;">＋</span> 기록
                </button>
              </div>
              <div class="recent-list-wrap" id="recent">
                <!-- 동적 최근 지출 내역 렌더링 -->
              </div>
            </article>

          </div>
        </section>
    <section id="page1" role="tabpanel" aria-labelledby="tab1" hidden><div class="trends-container"><div class="trends-header"><h2 class="trends-main-title">추세</h2><p class="trends-main-desc">주행 및 충전 데이터의 패턴을 분석하고, 변동 사항이 있을 때 알려드려요.</p></div><div class="trends-section" id="changingTrendsSection"><h3 class="trends-section-title">변동 있는 추세</h3><div class="trends-grid" id="changingTrendsGrid"></div></div><div class="trends-section" id="stableTrendsSection"><h3 class="trends-section-title">변동 없는 추세</h3><div class="trends-grid" id="stableTrendsGrid"></div></div></div></section>
    <section id="page2" role="tabpanel" aria-labelledby="tab2" hidden><div class="grid"><article class="panel wide hero"><h2>같은 거리를 다른 차로 달렸다면요.</h2><div class="compare-value" id="saving">유가 센서를 먼저 연결해 주세요.</div><div id="compareDetail"></div><p class="note">선택 기간의 충전비와 현재 유가 기준 예상 유류비만 비교해요. 전체 차량 유지비 절감은 아니에요.</p></article><article class="panel narrow"><h2>비교 기준을 정해요.</h2><form id="compareForm"><div class="fields"><label class="fullfield">비교 유종<select id="fuel"><option value="gasoline">휘발유</option><option value="diesel">경유</option><option value="premium">고급유</option></select></label><label class="fullfield">비교 연비 · km/L<input id="economy" type="number" min="1" max="50" step="0.1" value="12" required></label><label class="fullfield">HA 유가 센서<input id="fuelEntity" placeholder="sensor.fuel_price" required></label></div><button class="primary" type="submit">HA에 비교 기준 저장</button><p class="note" id="compareMessage" role="status"></p></form></article></div></section>
    <section id="page3" role="tabpanel" aria-labelledby="tab3" hidden><article class="panel"><div class="row spaced"><h2>차량 지출 내역이에요.</h2><button id="addLedger" class="btn-record-primary">＋ 기록 남기기</button></div><p class="note">자동 충전 결제와 직접 남긴 차량 지출을 함께 보여줘요. 삭제한 수동 기록은 복원할 수 있어요.</p><div class="ledger-filters" id="ledgerFilters"><details class="ledger-dropdown" id="ledgerDropdown"><summary>분류 선택 <span id="ledgerFilterSummary">전체</span></summary><div class="ledger-category-filters" role="group" aria-label="기록 분류 선택 (복수 선택)"><label class="ledger-filter-option"><input type="checkbox" id="ledgerAll" checked>전체</label>${Object.entries(categories).map(([key,label])=>`<label class="ledger-filter-option" style="--category-color:${this.categoryColor(key)}"><input type="checkbox" data-ledger-category="${key}">${esc(label)}</label>`).join('')}</div></details></div><div class="table-wrap"><table class="table ledger-table"><colgroup><col class="ledger-date-col"><col class="ledger-memo-col"><col class="ledger-value-col"><col class="ledger-actions-col"></colgroup><thead><tr><th>날짜 / 출처</th><th>기록 / 메모</th><th id="ledgerAmountHeader" aria-sort="none"><button id="ledgerSort" type="button" aria-label="금액 정렬 변경">금액 · 시간순</button></th><th>관리</th></tr></thead><tbody id="records"></tbody></table></div><div class="row" style="margin-top:16px"><button id="previous">이전 기록</button><button id="next">다음 기록</button><span id="pageLabel" class="muted"></span></div></article></section>
    <p class="status" id="message" role="status" aria-live="polite">HA 기록을 불러오고 있어요.</p>
    <p class="footer" id="footer">차계부는 HA 로컬 DB에 보관해요. 누락 데이터는 0으로 채우지 않아요.</p>
    <dialog id="recordDialog" aria-labelledby="dialogTitle"><form id="recordForm"><div class="row spaced"><h2 id="dialogTitle">놓친 기록을 남겨요.</h2><button id="close" class="modal-close-btn" type="button" aria-label="닫기">닫기</button></div><div class="fields">
    <input type="hidden" name="kind" id="kind" value="expense">
    <label>기록 날짜<input name="date" type="date" required></label>
    <label id="categoryField">비용 분류<select name="category">${Object.entries(categories).filter(([k])=>['maintenance','washing','tuning','other'].includes(k)).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label>
    <label id="subcategoryField">세부 작업<input name="subcategory" placeholder="타이어 · 와이퍼 · 워셔액 등" maxlength="100"></label>
    <label id="distanceField" hidden>주행거리 · km<input name="distance_km" type="number" min="0" step="0.001"></label><label id="energyField" hidden>주행 소비 · kWh (선택)<input name="drive_energy_kwh" type="number" min="0" step="0.001"></label>
    <label id="chargeField" hidden>배터리 충전량 · kWh<input name="battery_charge_kwh" type="number" min="0" step="0.001"></label><label id="modeField" hidden>충전 종류<select name="charge_mode"><option value="unknown">미확인</option><option value="slow">완속</option><option value="fast">급속</option></select></label>
    <label id="billedField" hidden>청구 충전량 · kWh (선택)<input name="billed_charge_kwh" type="number" min="0" step="0.001"></label>
    <label id="amountField">실제 금액 · 원<input name="actual_krw" id="actualKrw" type="text" inputmode="numeric" placeholder="0" required></label>
    <label id="startField" hidden>시작 시각 (선택)<input name="started_at" type="datetime-local"></label><label id="endField" hidden>종료 시각 (선택)<input name="ended_at" type="datetime-local"></label>
    <label id="socStartField" hidden>시작 SOC · % (선택)<input name="soc_start_percent" type="number" min="0" max="100" step="0.1"></label><label id="socEndField" hidden>종료 SOC · % (선택)<input name="soc_end_percent" type="number" min="0" max="100" step="0.1"></label><label id="odometerField" hidden>계기판 누적거리 · km (선택)<input name="odometer_km" type="number" min="0" step="0.1"></label><label class="fullfield">메모<textarea name="memo" maxlength="4000" rows="3"></textarea></label><label class="fullfield">사진 · JPG / PNG / WEBP<input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>사진당 20MiB 이하, 최대 5장. 저장할 때 자동으로 축소·압축해요.</small><button id="clearPhotos" type="button" hidden>사진 선택 모두 취소</button><div class="preview" id="photoPreview"></div></label></div>
    <p class="note">모르는 소비량·시각은 비워 주세요. 자동 기록과 겹치는 날짜는 저장 전에 확인해 주세요.</p><p class="error" id="recordError" role="alert"></p><div class="row" style="margin-top:16px"><button id="save" class="btn-record-primary" type="submit">HA에 기록 저장</button></div></form></dialog><dialog id="photoViewerDialog" aria-labelledby="lightboxTitle"><div class="lightbox-header"><div class="lightbox-title-wrap"><h2 id="lightboxTitle">사진</h2><small id="lightboxMeta" class="muted"></small></div><button id="closeLightbox" class="modal-close-btn" type="button" aria-label="닫기">닫기</button></div><div class="lightbox-body"><button id="lightboxPrev" class="lightbox-nav-btn prev" type="button" aria-label="이전 사진">‹</button><div class="lightbox-stage"><img id="lightboxImg" alt="기록 사진" /><div id="lightboxSpinner" class="lightbox-spinner" hidden>사진을 불러오고 있어요...</div></div><button id="lightboxNext" class="lightbox-nav-btn next" type="button" aria-label="다음 사진">›</button></div><div class="lightbox-footer"><p id="lightboxCaption" class="lightbox-caption"></p></div></dialog></div>`;
    if(this.$('month'))this.$('month').value=this.currentPeriodDate().slice(0,7);
    this.updatePeriodNavigation();
    if(this.$('entry'))this.$('entry').onchange=()=>{this.entry=this.$('entry').value;this.offset=0;this.load(true);};
    if(this.$('month'))this.$('month').onchange=()=>{this.offset=0;this.load(true);};
    this.$('periodPrev').onclick=()=>this.stepPeriod(-1);
    this.$('periodNext').onclick=()=>this.stepPeriod(1);
    this.$('periodCurrent').onclick=()=>this.selectCurrentPeriod();
    for(const button of this.shadowRoot.querySelectorAll('[data-scope]'))button.onclick=()=>this.setScope(button.dataset.scope);
    this.$('ledgerSort').onclick=()=>{this.recordSort={time:'amount_desc',amount_desc:'amount_asc',amount_asc:'time'}[this.recordSort];this.changeLedgerFilters();};
    this.$('ledgerAll').onclick=()=>{this.recordCategories.clear();this.changeLedgerFilters();};
    for(const button of this.shadowRoot.querySelectorAll('[data-ledger-category]'))button.onclick=()=>{const key=button.dataset.ledgerCategory;if(this.recordCategories.has(key))this.recordCategories.delete(key);else{this.recordCategories.add(key);}this.changeLedgerFilters();};
    this.$('legendRow').onclick=event=>{const button=event.target.closest('[data-cat]');if(button){this.comparisonCategory=this.comparisonCategory===button.dataset.cat?null:button.dataset.cat;this.renderSpendingComparison();}};
    for(let i=0;i<4;i++)if(this.$('tab'+i))this.$('tab'+i).onclick=()=>this.selectTab(i);
    for(const id of ['add','addRecent','addLedger'])if(this.$(id))this.$(id).onclick=()=>this.openRecord();
    if(this.$('close'))this.$('close').onclick=()=>this.$('recordDialog')?.close();
    if(this.$('closeLightbox'))this.$('closeLightbox').onclick=()=>this.$('photoViewerDialog')?.close();
    if(this.$('lightboxPrev'))this.$('lightboxPrev').onclick=()=>this.stepLightbox(-1);
    if(this.$('lightboxNext'))this.$('lightboxNext').onclick=()=>this.stepLightbox(1);
    if(this.$('photoViewerDialog'))this.$('photoViewerDialog').onclick=e=>{if(e.target===this.$('photoViewerDialog'))this.$('photoViewerDialog').close();};
    this.shadowRoot.addEventListener('keydown',e=>{if(!this.$('photoViewerDialog')?.open)return;if(e.key==='ArrowLeft'){e.preventDefault();this.stepLightbox(-1);}if(e.key==='ArrowRight'){e.preventDefault();this.stepLightbox(1);}});
    if(this.$('gotoCompare'))this.$('gotoCompare').onclick=()=>this.selectTab(3);
    if(this.$('recordForm'))this.$('recordForm').onsubmit=event=>this.saveRecord(event);
    const actualInput=this.$('actualKrw');
    if(actualInput)actualInput.oninput=e=>{const raw=e.target.value.replace(/[^\d]/g,'');e.target.value=raw?Number(raw).toLocaleString('ko-KR'):'';};
    if(this.$('previous'))this.$('previous').onclick=()=>{this.offset=Math.max(0,this.offset-100);this.load(true);};
    if(this.$('next'))this.$('next').onclick=()=>{this.offset+=100;this.load(true);};
    if(this.$('records'))this.$('records').onclick=e=>{const button=e.target.closest('button[data-record]');if(!button)return;const record=this.data?.records?.find(r=>r.id===button.dataset.record);if(!record)return;if(button.dataset.action==='photos'){this.showPhotos(record);return;}if(button.dataset.action==='edit')this.openRecord(record);else this.changeStatus(record,button.dataset.action);};
    this.$('recordForm').addEventListener('input',()=>{this.draftDirty=true;});
    this.$('compareForm').addEventListener('input',()=>{this.comparisonDirty=true;});
    this.$('recordDialog').addEventListener('close',()=>{if(!this.$('save').disabled){this.draftDirty=false;this.selectedPhotos=[];this.$('photos').value='';this.renderSelectedPhotos();}});
    if(this.$('compareForm'))this.$('compareForm').onsubmit=async event=>{event.preventDefault();try{await this.call('comparison/save',{fuel:this.$('fuel').value,economy_km_l:Number(this.$('economy').value),entity_id:this.$('fuelEntity').value});this.comparisonDirty=false;this.$('compareMessage').textContent='비교 기준을 저장했어요.';await this.load(true);}catch(e){this.$('compareMessage').textContent=e.message||'저장하지 못했어요.';}};
    if(this.$('photos'))this.$('photos').onchange=()=>{this.selectedPhotos=[...this.$('photos').files];this.renderSelectedPhotos();};
    this.$('clearPhotos').onclick=e=>{e.preventDefault();this.selectedPhotos=[];this.$('photos').value='';this.renderSelectedPhotos();};
    if(this.$('fuel'))this.$('fuel').onchange=()=>{const entity=this.data?.fuel_sensors?.[this.$('fuel').value];if(entity)this.$('fuelEntity').value=entity;};
  }
  selectTab(index){this.tab=index;for(let i=0;i<4;i++){const page=this.$('page'+i);if(page)page.hidden=i!==index;const tab=this.$('tab'+i);if(tab)tab.setAttribute('aria-selected',String(i===index));}if(index===1)this.renderTrendsDashboard();}
  hasPendingInput(){return !!(this.$('recordDialog')?.open||this.$('save')?.disabled||this.draftDirty||this.comparisonDirty||this.pendingWrites||this.selectedPhotos?.length);}
  async call(type,params={}){const write=['record/save','record/status','comparison/save'].includes(type);if(write)this.pendingWrites=(this.pendingWrites||0)+1;try{return await this._hass.callWS({type:'carrot_ha/journal/'+type,entry_id:this.entry,...params});}finally{if(write)this.pendingWrites--;}}
  async load(force=false){
    if(!this._hass?.callWS||!this.isConnected)return;
    this.updatePeriodNavigation();
    if(this.loading){if(force)this.reloadPending=true;return;}
    if(!force&&this.data)return;
    this.loading=true;const generation=++this.request;
    try{
      if(!this.entries.length){
        this.entries=await this._hass.callWS({type:'carrot_ha/journal/entries'});
        if(this.$('entry'))this.$('entry').innerHTML=this.entries.map(e=>`<option value="${esc(e.entry_id)}">${esc(e.title)}</option>`).join('');
        this.entry=this.entry||this.entries[0]?.entry_id;
        if(this.$('entry'))this.$('entry').value=this.entry||'';
      }
      if(!this.entry)throw new Error('HA에서 차계부 통합을 아직 찾지 못했어요. 업데이트와 재시작을 확인해 주세요.');
      const month=this.$('month')?.value;const range=this.range();if(!range)throw new Error('기록 기간을 골라 주세요.');const scope=this.scope;
      const selectedEntry=this.entry,selectedOffset=this.offset,selectedFilters=this.ledgerFilterKey();
      const filterParams=this.recordFiltersSupported?{include_trips:false,expenses_only:true,record_sort:this.recordSort,record_categories:[...this.recordCategories]}:{};
      const [data,previous]=await Promise.all([this.call('query',{from:range.from,to:range.to,offset:selectedOffset,...filterParams}),this.call('query',{from:range.previousFrom,to:range.previousTo,offset:0}).catch(()=>null)]);
      data.previous=previous;
      if(generation!==this.request||!this.isConnected||this.entry!==selectedEntry||this.offset!==selectedOffset||this.$('month')?.value!==month||this.scope!==scope||this.ledgerFilterKey()!==selectedFilters)return;
      if(data.expense_sort_supported&&!this.recordFiltersSupported){this.recordFiltersSupported=true;this.reloadPending=true;}
      this.data=data;preserveView(this,()=>this.renderData());this.dispatchEvent(new Event('journal-rendered'));
    }catch(error){
      if(this.$('message')){
        this.$('message').textContent=error.message||'HA 차계부에 연결하지 못했어요.';
        this.$('message').classList.add('error');
      }
    }
    finally{this.loading=false;if(this.reloadPending){this.reloadPending=false;this.load(true);}}
  }
  setScope(scope){
    if(!['month','year'].includes(scope)||scope===this.scope)return;
    const today=this.currentPeriodDate();
    this.scope=scope;this.offset=0;
    const input=this.$('month');input.type=scope==='year'?'number':'month';
    if(scope==='year'){input.min='1900';input.value=today.slice(0,4);}else{input.removeAttribute('min');input.value=today.slice(0,7);}
    for(const button of this.shadowRoot.querySelectorAll('[data-scope]')){const active=button.dataset.scope===scope;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    this.updatePeriodNavigation();
    this.load(true);
  }
  currentPeriodDate(){return new Date().toLocaleDateString('sv-SE',{timeZone:this._hass?.config?.time_zone||undefined});}
  currentPeriodValue(){return this.currentPeriodDate().slice(0,this.scope==='year'?4:7);}
  updatePeriodNavigation(){
    const input=this.$('month'),current=this.currentPeriodValue();
    input.max=current;
    if(input.value>current)input.value=current;
    this.$('periodNext').disabled=!input.value||input.value>=current;
    const unit=this.scope==='year'?'해':'달';
    for(const [id,label] of [['periodPrev',`이전 ${unit}`],['periodNext',`다음 ${unit}`]]){this.$(id).setAttribute('aria-label',label);this.$(id).title=label;}
    this.$('periodCurrent').textContent=this.scope==='year'?'올해':'이번 달';
  }
  selectCurrentPeriod(){
    const today=this.currentPeriodDate();
    this.$('month').value=today.slice(0,this.scope==='year'?4:7);
    this.updatePeriodNavigation();
    this.offset=0;this.load(true);
  }
  stepPeriod(direction){
    const range=this.range();if(!range)return;
    const date=new Date(range.from+'T00:00:00Z');
    if(this.scope==='year')date.setUTCFullYear(date.getUTCFullYear()+direction);else date.setUTCMonth(date.getUTCMonth()+direction);
    const year=date.getUTCFullYear();if(year<1||year>9999||(this.scope==='year'&&year<1900))return;
    const value=date.toISOString().slice(0,this.scope==='year'?4:7);
    if(value>this.currentPeriodValue())return;
    this.$('month').value=value;
    this.updatePeriodNavigation();
    this.offset=0;this.load(true);
  }
  range(){
    const value=this.$('month')?.value;
    if(!value||!({month:/^\d{4}-\d{2}$/,year:/^\d{4}$/}[this.scope]).test(value))return null;
    if(value>this.currentPeriodValue())return null;
    const [year,month=1]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,1));
    if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1)return null;
    const iso=d=>d.toISOString().slice(0,10),end=new Date(date),previous=new Date(date),previousEnd=new Date(date);
    if(this.scope==='month'){end.setUTCMonth(month,0);previous.setUTCMonth(month-2,1);previousEnd.setUTCDate(0);}
    if(this.scope==='year'){end.setUTCMonth(11,31);previous.setUTCFullYear(year-1);previousEnd.setUTCFullYear(year-1);previousEnd.setUTCMonth(11,31);}
    return {from:iso(date),to:iso(end),previousFrom:iso(previous),previousTo:iso(previousEnd)};
  }
  ledgerFilterKey(){return JSON.stringify([this.recordSort,[...this.recordCategories].sort()]);}
  recordCategory(record){return record.kind==='trip'?'trip':record.kind==='charge'?'charging':record.category||'other';}
  changeLedgerFilters(){this.offset=0;this.updateLedgerFilters();this.load(true);}
  updateLedgerFilters(){
    this.$('ledgerSort').textContent='금액 · '+({time:'시간순',amount_desc:'높은 순',amount_asc:'낮은 순'}[this.recordSort]);
    this.$('ledgerAmountHeader').setAttribute('aria-sort',{time:'none',amount_desc:'descending',amount_asc:'ascending'}[this.recordSort]);
    this.$('ledgerAll').checked=this.recordCategories.size===0;
    this.$('ledgerFilterSummary').textContent=this.recordCategories.size?`${this.recordCategories.size}개 선택`:'전체';
    for(const button of this.shadowRoot.querySelectorAll('[data-ledger-category]'))button.checked=this.recordCategories.has(button.dataset.ledgerCategory);
  }
  categoryColor(key){return {trip:'#7bb6ff',charging:'#81e6c5',maintenance:'#f59e0b',washing:'#60a5fa',tuning:'#c084fc',other:'#94a3b8'}[key]||'#94a3b8';}
  costCategories(totals){
    const result={};for(const [category,cost] of Object.entries(totals?.categories||{})){
      const key=['charging','maintenance','washing','tuning'].includes(category)?category:'other';
      const target=result[key]||(result[key]={actual_krw:0,estimated_krw:0,effective_krw:0});
      for(const field of Object.keys(target))target[field]+=cost[field]||0;
    }return result;
  }
  renderRecentExpenses(){
    const expenses=(this.data.recent_records||this.data.records).filter(record=>record.status==='active'&&record.kind==='expense');
    this.$('recent').innerHTML=expenses.map(record=>{
      const key=['charging','maintenance','washing','tuning'].includes(record.category)?record.category:'other',color=this.categoryColor(key);
      let title=record.subcategory||record.memo;
      if(record.category==='charging'||record.kind==='charge'){
        let mode=record.charge_mode;
        if(!mode||mode==='unknown'){
          const dateStr=(record.accounting_date||record.started_at||'').slice(0,10);
          const match=this.data.records?.find(r=>r.kind==='charge'&&(r.started_at||'').slice(0,10)===dateStr&&r.charge_mode&&r.charge_mode!=='unknown');
          if(match)mode=match.charge_mode;
        }
        if(mode==='fast')title='고속 충전 요금';
        else if(mode==='slow')title='완속 충전 요금';
        else title='충전 요금';
      }else{
        title=title||categories[record.category]||'지출';
      }
      return `<div class="recent-expense-row"><div class="recent-left"><div class="recent-title-line"><span class="cat-highlight-pill" style="color:${color};background:${color}22;border:1px solid ${color}66">${esc(categories[record.category]||'기타')}</span><span class="recent-item-title">${esc(title)}</span></div><small class="recent-date-sub">${esc(record.accounting_date||'미확인')} · ${record.origin==='manual'?'직접 기록':'자동 기록'}</small></div><strong class="recent-amount">${money(record.actual_krw??record.estimated_krw)}</strong></div>`;
    }).join('')||'<p class="muted note">지출 기록이 아직 없어요.</p>';
  }
  renderSpendingComparison(){
    if(!this.data)return;
    const previous=this.costCategories(this.data.previous?.totals),current=this.costCategories(this.data.totals),key=this.comparisonCategory;
    const sum=data=>Object.values(data).reduce((total,item)=>total+item.effective_krw,0);
    const oldValue=key?(previous[key]?.effective_krw||0):sum(previous),newValue=key?(current[key]?.effective_krw||0):sum(current),diff=newValue-oldValue;
    const observed=Boolean(this.data.previous?.daily?.length);
    const prevName=this.scope==='year'?'지난해':'지난달';
    this.$('cardTitle').textContent=this.scope==='year'?'지난해 지출과 비교':'지난달 지출과 비교';
    const range=this.range();
    const color=diff>0?'#ff5c5c':diff<0?'#60a5fa':'#81e6c5';
    this.$('targetCard').classList.toggle('is-more',observed&&diff>0);this.$('targetCard').classList.toggle('is-less',observed&&diff<0);
    this.$('trendPill').className='trend-badge '+(observed?(diff>0?'more':diff<0?'less':''): '');
    this.$('trendPill').textContent=observed&&oldValue>0?`${diff>0?'▲':diff<0?'▼':'—'} ${numeric(Math.abs(diff/oldValue*100))}%`:'비교율 미확인';
    this.$('spendStatement').innerHTML=observed?`${prevName}에 비해 <span class="domain-tag" style="color:${key?this.categoryColor(key):'var(--j-accent)'}">${esc(key?categories[key]:'전체 지출')}</span>에서<br><span class="amount-highlight">${money(Math.abs(diff))}</span>을 <span style="color:${color}">${diff>0?'더 소비':diff<0?'덜 소비':'동일하게 소비'}</span>했어요.`:'이전 기간의 관측 기록이 없어 지출 차이를 계산하지 않아요.';
    for(const button of this.$('legendRow').querySelectorAll('[data-cat]')){button.classList.toggle('active',button.dataset.cat===key);button.setAttribute('aria-pressed',String(button.dataset.cat===key));}
    const amounts=data=>Object.fromEntries(Object.entries(data).map(([category,cost])=>[category,cost.effective_krw]));
    this.$('barChartSvg').setAttribute('aria-label',observed?`${prevName}와 ${this.scope==='year'?'올해':'이번달'}의 지출 비교`:'이전 기간 기록 없음 · 이번달 지출');
    const prevLabel=observed?(this.scope==='year'?range.previousFrom.slice(0,4)+'년':Number(range.previousFrom.slice(5,7))+'월'):'기록 없음';
    const currLabel=this.scope==='year'?range.from.slice(0,4)+'년':Number(range.from.slice(5,7))+'월';
    this.drawStackedChart(amounts(previous),amounts(current),sum(previous),sum(current),sum(current)-sum(previous),prevLabel,currLabel);
  }
  drawStackedChart(prevData, currData, prevTotal, currTotal, diff, prevLabel, currLabel) {
      const svg=this.$('barChartSvg'),hoveredCategory=this.comparisonCategory;
      const CATEGORIES=Object.fromEntries(['charging','maintenance','washing','tuning','other'].map(key=>[key,{label:categories[key],rawColor:this.categoryColor(key)}]));
      const won=money;
      const bottomY = 145;
      const topLimitY = 38;
      const maxDrawHeight = bottomY - topLimitY; // 107px

      const maxVal = Math.max(prevTotal, currTotal, 1000) * 1.18;
      const hPrev = Math.max(8, (prevTotal / maxVal) * maxDrawHeight);
      const hCurr = Math.max(8, (currTotal / maxVal) * maxDrawHeight);
      const yPrev = bottomY - hPrev;
      const yCurr = bottomY - hCurr;

      const xPrev = 82;
      const xCurr = 238;
      const barW = 54;

      const isMore = diff > 0;
      const isLess = diff < 0;
      const trendColor = isMore ? '#ff5c5c' : isLess ? '#60a5fa' : '#81e6c5';

      function generateSegments(dataObj, totalVal, barX, barHeight, monthKey) {
        let segs = [];
        let currY = bottomY;
        const catKeys = Object.keys(CATEGORIES);

        for (const cat of catKeys) {
          const val = dataObj[cat] || 0;
          if (val <= 0) continue;

          const segH = Math.max(2, (val / totalVal) * barHeight);
          const segY = currY - segH;

          segs.push({
            cat,
            val,
            pct: ((val / totalVal) * 100).toFixed(1),
            x: barX - barW / 2,
            y: segY,
            width: barW,
            height: segH,
            color: CATEGORIES[cat].rawColor,
            label: CATEGORIES[cat].label,
            monthKey
          });

          currY = segY;
        }
        return segs;
      }

      const prevSegs = generateSegments(prevData, prevTotal, xPrev, hPrev, prevLabel);
      const currSegs = generateSegments(currData, currTotal, xCurr, hCurr, currLabel);

      const midX = (xPrev + xCurr) / 2;
      const midY = (yPrev + yCurr) / 2;

      svg.innerHTML = `
        <defs>
          <clipPath id="clipPrev">
            <rect x="${xPrev - barW/2}" y="${yPrev}" width="${barW}" height="${hPrev}" rx="8" />
          </clipPath>
          <clipPath id="clipCurr">
            <rect x="${xCurr - barW/2}" y="${yCurr}" width="${barW}" height="${hCurr}" rx="8" />
          </clipPath>
          <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${trendColor}" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="${trendColor}" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <line x1="30" y1="${bottomY}" x2="290" y2="${bottomY}" stroke="var(--j-border)" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="${xPrev},${yPrev} ${xCurr},${yCurr} ${xCurr},${bottomY} ${xPrev},${bottomY}" fill="url(#trendAreaGrad)"/>

        <!-- 이전 기간 스택 바 -->
        <g clip-path="url(#clipPrev)">
          ${prevSegs.map(s => `
            <rect class="bar-segment ${hoveredCategory === s.cat ? 'highlighted' : ''}"
                  data-cat="${s.cat}" data-val="${s.val}" data-pct="${s.pct}" data-label="${s.label}" data-month="${prevLabel}"
                  x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${s.color}">
            <title>${esc(s.label)} · ${won(s.val)} (${s.pct}%)</title></rect>
          `).join('')}
        </g>
        <rect x="${xPrev - barW/2}" y="${yPrev}" width="${barW}" height="${hPrev}" rx="8"
              fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.2" pointer-events="none"/>

        <!-- 현재 기간 스택 바 -->
        <g clip-path="url(#clipCurr)">
          ${currSegs.map(s => `
            <rect class="bar-segment ${hoveredCategory === s.cat ? 'highlighted' : ''}"
                  data-cat="${s.cat}" data-val="${s.val}" data-pct="${s.pct}" data-label="${s.label}" data-month="${currLabel}"
                  x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${s.color}">
            <title>${esc(s.label)} · ${won(s.val)} (${s.pct}%)</title></rect>
          `).join('')}
        </g>
        <rect x="${xCurr - barW/2}" y="${yCurr}" width="${barW}" height="${hCurr}" rx="8"
              fill="none" stroke="${trendColor}" stroke-width="1.5" pointer-events="none"/>

        <!-- 추세 연결선 & 마커 -->
        <line x1="${xPrev}" y1="${yPrev}" x2="${xCurr}" y2="${yCurr}" stroke="${trendColor}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${xPrev}" cy="${yPrev}" r="5" fill="#f1f6fa" stroke="#32485c" stroke-width="2.5"/>
        <circle cx="${xCurr}" cy="${yCurr}" r="6" fill="#fff" stroke="${trendColor}" stroke-width="3"/>

        <!-- 상단 금액 -->
        <text x="${xPrev}" y="${yPrev - 11}" text-anchor="middle" fill="var(--j-sub)" font-size="13" font-weight="600">${won(prevTotal)}</text>
        <text x="${xCurr}" y="${yCurr - 11}" text-anchor="middle" fill="${trendColor}" font-size="14.5" font-weight="750">${won(currTotal)}</text>

        <!-- 연결선 뱃지 -->
        <g transform="translate(${midX}, ${midY - 14})">
          <rect x="-32" y="-11" width="64" height="22" rx="11" fill="#161e25" stroke="${trendColor}" stroke-width="1.2"/>
          <text x="0" y="4" text-anchor="middle" fill="${trendColor}" font-size="11" font-weight="700">
            ${isMore ? '▲ 증가' : isLess ? '▼ 절약' : '— 유지'}
          </text>
        </g>

        <!-- X축 라벨 -->
        <text x="${xPrev}" y="${bottomY + 22}" text-anchor="middle" fill="var(--j-sub)" font-size="12" font-weight="500">${prevLabel}</text>
        <text x="${xCurr}" y="${bottomY + 22}" text-anchor="middle" fill="var(--j-ink)" font-size="12.5" font-weight="700">${currLabel}</text>
      `;
      svg.onclick=event=>{const segment=event.target.closest('[data-cat]');if(segment){this.comparisonCategory=this.comparisonCategory===segment.dataset.cat?null:segment.dataset.cat;this.renderSpendingComparison();}};
    }

  stat(label,value,note=''){return `<div class="stat"><small>${esc(label)}</small><strong>${value}</strong>${note?`<small>${esc(note)}</small>`:''}</div>`;}
  renderData(){
    const d=this.data,t=d.totals,latest=d.latest||{};
    this.$('footer').textContent=`집계 시간대 ${d.timezone} · HA 로컬 DB에 보관해요. 누락 데이터는 0으로 채우지 않아요.`;
    this.$('message').classList.remove('error');this.$('message').textContent=d.sync_error||`HA에 ${numeric(d.record_count,0)}개의 원장을 보관하고 있어요. ${d.status.phase==='complete'?'기존 기록을 연결했어요.':'기존 기록을 가져오고 있어요.'}`;
    const monthVal=this.$('month')?.value||new Date().toLocaleDateString('sv-SE').slice(0,7);
    const monthNum=Number(monthVal.slice(5,7));
    const yearNum=monthVal.slice(0,4);
    const todayStr=new Date().toLocaleDateString('sv-SE');
    const isThisMonth=monthVal===todayStr.slice(0,7);
    const isThisYear=yearNum===todayStr.slice(0,4);
    const periodHeadline=this.scope==='year'?`${yearNum}년 에는`:`${monthNum}월 달에는`;
    this.$('headline').innerHTML=`<span class="h-phrase">${periodHeadline}</span><br><span class="h-phrase">${numeric(t.distance_km)}km를 달리고,</span><br><span class="h-phrase"><span class="accent">${money(t.total_cost_krw)}</span>을 소비했어요.</span>`;

    const effLabel=this.scope==='year'?(isThisYear?'올해 전비':`${yearNum}년 전비`):(isThisMonth?'이번달 전비':`${monthNum}월 전비`);
    const chargeLabel=this.scope==='year'?(isThisYear?'올해 충전량':`${yearNum}년 충전량`):(isThisMonth?'이번달 충전량':`${monthNum}월 충전량`);

    const chargeKwhStr=(Number.isFinite(t.battery_charge_kwh)&&t.battery_charge_kwh>0)
      ?`${numeric(t.battery_charge_kwh)}<span class="stat-unit">kWh</span>`
      :`<span class="stat-empty">기록 없음</span>`;

    const effStr=(Number.isFinite(t.efficiency_km_kwh)&&t.efficiency_km_kwh>0)
      ?`${numeric(t.efficiency_km_kwh)}<span class="stat-unit">km/kWh</span>`
      :`<span class="stat-empty">기록 없음</span>`;

    const avgRate=(Number.isFinite(t.battery_charge_kwh)&&t.battery_charge_kwh>0&&Number.isFinite(t.charge_effective_krw)&&t.charge_effective_krw>0)
      ?`${numeric(Math.round(t.charge_effective_krw/t.battery_charge_kwh),0)}<span class="stat-unit">원</span>`
      :`<span class="stat-empty">기록 없음</span>`;

    this.$('briefStats').innerHTML=
      this.stat(chargeLabel,chargeKwhStr)+
      this.stat(effLabel,effStr)+
      this.stat('kWh 당 평균 충전요금',avgRate);

    if(this.$('stateStats')){
      const state=this.stat('배터리 SOC',numeric(latest.soc_percent)+'%')+this.stat('주행가능거리',numeric(latest.range_km??latest.estimated_range_km)+' km')+this.stat('차량 상태',latest.driving||latest.onroad?'주행 중':latest.charging?'충전 중':'마지막 수신 상태');
      this.$('stateStats').innerHTML=state+this.stat('도어 잠금',latest.doors_locked===true?'잠겨 있어요':latest.doors_locked===false?'열려 있어요':'미확인')+this.stat('계기판 누적거리',numeric(latest.odometer_km)+' km')+this.stat('외기 온도',numeric(latest.outside_temp_c)+' °C');
      if(this.$('stateNote'))this.$('stateNote').textContent=`마지막 수신 ${latest.last_received||latest.measured_at||'미확인'} · 실시간 카드와 같은 HA 최신 기록을 사용해요. 수신 공백 동안 값은 새 측정이 아니에요.`;
    }
    const amounts=Object.entries(this.costCategories(t)).filter(([,v])=>v.effective_krw>0);
    const colors=amounts.map(([key])=>this.categoryColor(key));
    this.$('costs').innerHTML=amounts.map(([k,v],i)=>`<div class="list-row"><span style="display:inline-flex;align-items:center;font-size:15px;font-weight:600;color:var(--j-ink)"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:9px;flex-shrink:0;background:${colors[i]}"></span>${esc(categories[k]||k)}</span><strong style="font-size:16px;font-weight:750;font-variant-numeric:tabular-nums;color:#ffffff">${money(v.effective_krw)}</strong></div>`).join('')||'<p class="note">이 기간의 지출 기록이 아직 없어요.</p>';
    const total=amounts.reduce((sum,[,v])=>sum+v.effective_krw,0);let offset=0;
    const donutLabel=this.scope==='year'?(isThisYear?'올해 지출':`${yearNum}년 지출`):(isThisMonth?'이번 달 지출':`${monthNum}월 지출`);
    this.$('donut').innerHTML=`<title>${donutLabel} ${money(total)}</title><circle cx="80" cy="80" r="59" fill="none" stroke="var(--j-raised)" stroke-width="19"/>`+amounts.map(([key,value],i)=>{const length=value.effective_krw/total*370.708;const html=`<circle cx="80" cy="80" r="59" fill="none" stroke="${colors[i]}" stroke-width="19" stroke-dasharray="${length} ${370.708-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"><title>${esc(categories[key])} ${money(value.effective_krw)}</title></circle>`;offset+=length;return html;}).join('')+`<text x="80" y="74" text-anchor="middle" fill="var(--j-sub)" font-size="13" font-weight="600" letter-spacing="-0.2">${donutLabel}</text><text x="80" y="96" text-anchor="middle" fill="#ffffff" font-size="18.5" font-weight="850" letter-spacing="-0.5">${money(total)}</text>`;
    this.renderRecentExpenses();
    this.renderSpendingComparison();
    this.updateLedgerFilters();
    const visibleRecords=d.records.filter(r=>(r.kind==='expense')&&(!this.recordCategories.size||this.recordCategories.has(this.recordCategory(r))));
    if(this.recordSort!=='time')visibleRecords.sort((a,b)=>{const av=a.actual_krw??a.estimated_krw,bv=b.actual_krw??b.estimated_krw;return av==null?(bv==null?0:1):bv==null?-1:(av-bv)*(this.recordSort==='amount_desc'?-1:1);});
    this.$('records').innerHTML=visibleRecords.map(r=>{
      const hasPhotos=r.attachments?.length>0;
      const photoBtn=hasPhotos?`<button class="btn-table-action btn-photo" data-record="${r.id}" data-action="photos">사진 ${r.attachments.length}장</button>`:'';
      let actionButtons='';
      if(r.origin==='manual'&&r.input){
        if(r.status==='deleted'){
          actionButtons=`${photoBtn}<button class="btn-table-action" data-record="${r.id}" data-action="restore">복원</button>`;
        }else{
          actionButtons=`${photoBtn}<button class="btn-table-action" data-record="${r.id}" data-action="edit">수정</button><button class="btn-table-action" data-record="${r.id}" data-action="delete">삭제</button>`;
        }
      }else{
        actionButtons=hasPhotos?photoBtn:'<small>자동 원장</small>';
      }

      const memoHtml=`<div class="memo-cell-wrap"><div class="memo-text-col"><span class="memo-cat-title" style="color:${this.categoryColor(this.recordCategory(r))}">${esc(categories[r.category]||kindNames[r.kind])}${r.subcategory?' · '+esc(r.subcategory):''}</span>${r.memo?`<small class="memo-desc">${esc(r.memo)}</small>`:''}${r.duplicate_candidates?.length?'<small class="error">같은 날 자동 기록이 있어요. 중복 여부를 확인해 주세요.</small>':''}</div>${hasPhotos?`<button class="memo-thumb-btn" type="button" data-record="${r.id}" data-action="photos" aria-label="사진 보기 (${r.attachments.length}장)"><div class="thumb-box" data-thumb-record="${r.id}"><span class="thumb-spinner">📷</span></div>${r.attachments.length>1?`<span class="thumb-badge">+${r.attachments.length}</span>`:''}</button>`:''}</div>`;

      return `<tr><td>${esc(r.accounting_date||r.started_at?.slice(0,10))}<small>${r.origin==='manual'?'직접 기록':'자동 기록'} · ${r.status==='deleted'?'삭제됨':r.status==='excluded'?'제외됨':'보관 중'}</small></td><td>${memoHtml}</td><td>${money(r.actual_krw??r.estimated_krw)}</td><td>${actionButtons}</td></tr>`;
    }).join('')||'<tr><td colspan="4">이 기간의 기록이 없어요. 누락 기록을 직접 남겨 보세요.</td></tr>';
    this.$('previous').disabled=this.offset===0;this.$('next').disabled=!d.has_more;this.$('pageLabel').textContent=visibleRecords.length?`${this.offset+1}~${this.offset+visibleRecords.length}번째 기록`:'표시할 기록이 없어요.';
    if(!this.recordFiltersSupported)this.$('pageLabel').textContent+=' · 전체 기간 필터 적용을 위해 HA 재시작이 필요해요.';
    if(d.comparison&&!this.comparisonDirty&&this.shadowRoot.activeElement?.closest('#compareForm')==null){this.$('fuel').value=d.comparison.fuel;this.$('economy').value=d.comparison.economy_km_l;this.$('fuelEntity').value=JSON.parse(d.comparison.sensor_entities_json)[d.comparison.fuel]||'';}
    if(!d.comparison&&!this.comparisonDirty&&this.shadowRoot.activeElement?.closest('#compareForm')==null){const entity=d.fuel_sensors?.[this.$('fuel').value];if(entity){this.$('fuelEntity').value=entity;this.$('compareMessage').textContent='기존 전국 평균 유가 센서를 찾았어요. 비교 연비를 확인하고 저장해 주세요.';}}
    if(d.fuel_price&&d.comparison&&t.distance_km!=null&&t.charge_effective_krw!=null){const ice=t.distance_km/d.comparison.economy_km_l*d.fuel_price.price;const saving=ice-t.charge_effective_krw;this.$('saving').textContent=money(Math.abs(saving))+(saving>=0?'을 아꼈어요.':'이 더 들었어요.');this.$('compareDetail').innerHTML=`<p>내 전기차 ${money(t.charge_effective_krw)} · 비교 차량 ${money(ice)}</p><small>현재 HA 유가 ${money(d.fuel_price.price)}/L · ${esc(d.fuel_price.observed_at)}</small>`;}else{this.$('saving').textContent='비교에 필요한 거리·충전비·유가를 확인해 주세요.';this.$('compareDetail').textContent='원/L·KRW/L 센서 또는 gas_station_korea의 원 단위 유가 센서를 사용할 수 있어요. 비교 기준을 저장해 주세요.';}
    this.renderTrendsDashboard();
    this.loadThumbnails();
  }
  renderTrendsDashboard(){
    const changingContainer=this.$('changingTrendsGrid');
    const stableContainer=this.$('stableTrendsGrid');
    if(!changingContainer||!stableContainer||!this.data)return;

    const daily=this.data.daily||[];
    const prevDaily=this.data.previous?.daily||[];
    const totals=this.data.totals||{};
    const prevTotals=this.data.previous?.totals||{};
    const isYear=this.scope==='year';
    const monthVal=this.$('month')?.value||new Date().toLocaleDateString('sv-SE').slice(0,7);
    const yearStr=monthVal.slice(0,4);
    const monthNum=Number(monthVal.slice(5,7));
    const periodName=isYear?`${yearStr}년`:`${monthNum}월`;
    const prevPeriodName=isYear?'지난해':'지난달';

    if(daily.length===0){
      changingContainer.classList.remove('single-item');
      changingContainer.innerHTML='<div class="trends-empty-pill" style="grid-column: 1 / -1;">이 기간에 기록된 주행 및 충전 데이터가 아직 없어요.</div>';
      stableContainer.innerHTML='';
      return;
    }

    let numBins=16;
    let daysInMonth=31;
    if(!isYear){
      const yr=Number(yearStr),mo=monthNum;
      daysInMonth=new Date(yr,mo,0).getDate();
      numBins=Math.ceil(daysInMonth/2);
    }else{
      numBins=12;
    }

    const bins=Array.from({length:numBins},()=>({
      distance_km:0,energy_distance_km:0,drive_energy_kwh:0,
      battery_charge_kwh:0,billed_charge_kwh:0,charge_effective_krw:0,
      drive_soc_used_pp:0,slow_count:0,fast_count:0,unknown_count:0,day_count:0
    }));

    for(const row of daily){
      const dayStr=row.day;
      let binIdx=0;
      if(!isYear){
        const d=Number(dayStr.slice(8,10));
        binIdx=Math.min(numBins-1,Math.floor((d-1)/2));
      }else{
        const m=Number(dayStr.slice(5,7));
        binIdx=Math.min(11,m-1);
      }
      const b=bins[binIdx];
      b.distance_km+=row.distance_km||0;
      b.energy_distance_km+=row.energy_distance_km||0;
      b.drive_energy_kwh+=row.drive_energy_kwh||0;
      b.battery_charge_kwh+=row.battery_charge_kwh||0;
      b.billed_charge_kwh+=row.billed_charge_kwh||0;
      b.charge_effective_krw+=row.charge_effective_krw||0;
      b.drive_soc_used_pp+=row.drive_soc_used_pp||0;
      b.slow_count+=row.slow_count||0;
      b.fast_count+=row.fast_count||0;
      b.unknown_count+=row.unknown_count||0;
      b.day_count++;
    }

    const currEff=totals.efficiency_km_kwh!=null&&totals.efficiency_km_kwh>0?+totals.efficiency_km_kwh.toFixed(1):(totals.drive_energy_kwh?+(totals.energy_distance_km/totals.drive_energy_kwh).toFixed(1):null);
    const pastEff=prevTotals.efficiency_km_kwh!=null&&prevTotals.efficiency_km_kwh>0?+prevTotals.efficiency_km_kwh.toFixed(1):(prevTotals.drive_energy_kwh?+(prevTotals.energy_distance_km/prevTotals.drive_energy_kwh).toFixed(1):null);
    const effBars=bins.map(b=>b.drive_energy_kwh>0?+(b.energy_distance_km/b.drive_energy_kwh).toFixed(1):0);

    const observedDays=(rows,key)=>Math.max(1,rows.filter(r=>r[key]!=null).length);
    const currDist=totals.distance_km!=null?+(totals.distance_km/observedDays(daily,'distance_km')).toFixed(1):null;
    const prevDist=prevTotals.distance_km!=null?+(prevTotals.distance_km/observedDays(prevDaily,'distance_km')).toFixed(1):null;
    const distBars=bins.map(b=>+(b.distance_km/Math.max(1,b.day_count)).toFixed(1));

    const currCharge=totals.battery_charge_kwh!=null?+(totals.battery_charge_kwh/observedDays(daily,'battery_charge_kwh')).toFixed(1):null;
    const prevCharge=prevTotals.battery_charge_kwh!=null?+(prevTotals.battery_charge_kwh/observedDays(prevDaily,'battery_charge_kwh')).toFixed(1):null;
    const chargeBars=bins.map(b=>+(b.battery_charge_kwh/Math.max(1,b.day_count)).toFixed(1));

    const currChargeKwhTotal=totals.billed_charge_kwh||totals.battery_charge_kwh||0;
    const currRate=(totals.charge_effective_krw&&currChargeKwhTotal>0)?Math.round(totals.charge_effective_krw/currChargeKwhTotal):null;
    const prevChargeKwhTotal=prevTotals.billed_charge_kwh||prevTotals.battery_charge_kwh||0;
    const prevRate=(prevTotals.charge_effective_krw&&prevChargeKwhTotal>0)?Math.round(prevTotals.charge_effective_krw/prevChargeKwhTotal):null;
    const rateBars=bins.map(b=>{const kwh=b.billed_charge_kwh||b.battery_charge_kwh||0;return (b.charge_effective_krw&&kwh>0)?Math.round(b.charge_effective_krw/kwh):0;});

    const currDriveSoc=totals.drive_soc_used_pp!=null?+(totals.drive_soc_used_pp/observedDays(daily,'drive_soc_used_pp')).toFixed(1):null;
    const prevDriveSoc=prevTotals.drive_soc_used_pp!=null?+(prevTotals.drive_soc_used_pp/observedDays(prevDaily,'drive_soc_used_pp')).toFixed(1):null;
    const driveSocBars=bins.map(b=>+(b.drive_soc_used_pp/Math.max(1,b.day_count)).toFixed(1));

    const currSlowFast=(totals.slow_count||0)+(totals.fast_count||0);
    const currFastRatio=currSlowFast>0?Math.round(((totals.fast_count||0)/currSlowFast)*100):null;
    const prevSlowFast=(prevTotals.slow_count||0)+(prevTotals.fast_count||0);
    const prevFastRatio=prevSlowFast>0?Math.round(((prevTotals.fast_count||0)/prevSlowFast)*100):null;
    const fastRatioBars=bins.map(b=>{const tot=(b.slow_count||0)+(b.fast_count||0);return tot>0?Math.round((b.fast_count/tot)*100):0;});

    const createMetric=(id,name,icon,color,unit,currVal,pastVal,bars,options={})=>{
      const hasCurrent=currVal!=null&&Number.isFinite(currVal)&&currVal>=0;
      const hasPast=pastVal!=null&&Number.isFinite(pastVal)&&pastVal>=0;
      let isChanging=false;
      let trendStatus='consistent';
      let headline=`${periodName} 동안 일관된 추세`;
      let subDesc='현재 관측된 패턴을 안정적으로 유지하고 있어요.';
      let changeText='';

      if(hasCurrent&&hasPast){
        const diff=currVal-pastVal;
        const diffPct=pastVal>0?(diff/pastVal)*100:(currVal>0?100:0);
        if(Math.abs(diffPct)>=5.0){
          isChanging=true;
          const changeValue=unit==='원'?Math.round(Math.abs(diff)):Number(Math.abs(diff).toFixed(1));
          changeText=`${changeValue.toLocaleString('ko-KR')}${unit} ${diff>0?'증가':'감소'}`;
          if(diff>0){
            trendStatus='up';
            headline=`${periodName} 동안 증가 추세`;
            subDesc=`${prevPeriodName} 평균 ${trendValue(pastVal,unit)} ${unit} 대비 ${changeText}했어요.`;
          }else{
            trendStatus='down';
            headline=`${periodName} 동안 감소 추세`;
            subDesc=`${prevPeriodName} 평균 ${trendValue(pastVal,unit)} ${unit} 대비 ${changeText}했어요.`;
          }
        }else{
          trendStatus='consistent';
          headline=`${periodName} 동안 일관된 추세`;
          subDesc=`${prevPeriodName}과 비슷한 일관된 추세예요.`;
        }
      }else if(hasCurrent){
        headline='이전 기간 비교 데이터 수집 중';
        subDesc='현재 기록을 표시하고 있어요.';
      }else{
        headline='데이터 수집 중';
        subDesc='이 지표를 계산할 기록이 아직 없어요.';
      }

      if(options.total){
        subDesc=subDesc.replace(' 평균 ',' 합계 ');
      }

      return {
        id,name,icon,color,unit,isChanging,trendStatus,headline,subDesc,changeText,
        pastAvg:hasPast?pastVal:null,avg:hasCurrent?currVal:null,
        pastPeriodLabel:`${isYear?`${Number(yearStr)-1}년`:prevPeriodName} ${options.total?'합계':'평균'}`,
        currPeriodLabel:`${isYear?`${yearStr}년`:`${monthNum}월`} ${options.total?'합계':'평균'}`,
        startLabel:isYear?'1월':'1일',
        endLabel:isYear?'12월':`${daysInMonth}일`,
        bars:bars||[]
      };
    };

    const metrics=[
      createMetric('efficiency','평균 전비','⚡','#81e6c5','km/kWh',currEff,pastEff,effBars),
      createMetric('distance','하루 평균 주행거리','🚗','#ff9f0a','km',currDist,prevDist,distBars),
      createMetric('charge_kwh','하루 평균 배터리 충전량','🔌','#30b0c7','kWh',currCharge,prevCharge,chargeBars),
      createMetric('charge_rate','kWh당 충전 단가','💳','#ffd60a','원',currRate,prevRate,rateBars),
      createMetric('drive_soc','하루 평균 주행 배터리 사용률','🔋','#af52de','%',currDriveSoc,prevDriveSoc,driveSocBars),
      createMetric('fast_ratio','완속·급속 충전 중 급속 충전 비율','⚡','#ff453a','%',currFastRatio,prevFastRatio,fastRatioBars)
    ];

    const round=value=>value==null?null:Number(value.toFixed(1));
    const chargeCount=t=>(t.slow_count||0)+(t.fast_count||0)+(t.unknown_count||0);
    const cost100=(t,eff)=>{
      const kwh=t.billed_charge_kwh>0?t.billed_charge_kwh:t.battery_charge_kwh;
      eff=t.efficiency_km_kwh??eff;
      return eff>0&&kwh>0&&t.charge_effective_krw!=null?Math.round(t.charge_effective_krw/kwh/eff*100):null;
    };
    const soc100=t=>t.drive_soc_used_pp!=null&&t.distance_km>0?round(t.drive_soc_used_pp/t.distance_km*100):null;
    const perCharge=t=>chargeCount(t)>0&&t.battery_charge_kwh!=null?round(t.battery_charge_kwh/chargeCount(t)):null;
    const spending=row=>Object.values(row.cost_categories||{}).reduce((sum,v)=>sum+(v.effective_krw||0),0);
    const extraBins=bins.map(()=>[]);
    for(const row of daily){
      const i=isYear?Number(row.day.slice(5,7))-1:Math.floor((Number(row.day.slice(8,10))-1)/2);
      if(extraBins[i])extraBins[i].push(row);
    }
    const observed=(fn)=>bins.map((b,i)=>extraBins[i].length?fn(b,i):null);
    metrics.push(
      createMetric('cost100','100km를 달리는 데 드는 충전 비용 (추정)','💰','#64d2ff','원',cost100(totals,currEff),cost100(prevTotals,pastEff),observed(b=>cost100(b,b.drive_energy_kwh>0?b.energy_distance_km/b.drive_energy_kwh:null)),{}),
      createMetric('total_cost',isYear?'선택한 연도의 총 차량 지출':'선택한 달의 총 차량 지출','💸','#ff9f0a','원',totals.total_cost_krw??null,prevDaily.length?prevTotals.total_cost_krw??null:null,observed((b,i)=>extraBins[i].reduce((sum,r)=>sum+spending(r),0)),{total:true}),
      createMetric('charge_count',isYear?'선택한 연도의 총 충전 횟수':'선택한 달의 총 충전 횟수','🔌','#30b0c7','회',daily.length?chargeCount(totals):null,prevDaily.length?chargeCount(prevTotals):null,observed(b=>chargeCount(b)),{total:true}),
      createMetric('per_charge','충전 1회당 평균 배터리 충전량','🔋','#81e6c5','kWh',perCharge(totals),perCharge(prevTotals),observed(b=>perCharge(b))),
      createMetric('soc100','100km를 달릴 때 사용한 배터리 비율','🚗','#af52de','%',soc100(totals),soc100(prevTotals),observed(b=>soc100(b)),{})
    );
    for(const [category,label] of Object.entries(categories)){
      const current=totals.categories?.[category],past=prevTotals.categories?.[category];
      if(!current&&!past)continue;
      metrics.push(createMetric(`cost_${category}`,`선택한 ${isYear?'연도':'달'}의 ${label} 총지출`,'💳','#ffd60a','원',daily.length?current?.effective_krw??0:null,prevDaily.length?past?.effective_krw??0:null,observed((b,i)=>extraBins[i].reduce((sum,r)=>sum+(r.cost_categories?.[category]?.effective_krw||0),0)),{total:true}));
    }

    const changingItems=metrics.filter(m=>m.isChanging);
    const stableItems=metrics.filter(m=>!m.isChanging);

    changingContainer.classList.toggle('single-item',changingItems.length===1);

    if(changingItems.length===0){
      changingContainer.innerHTML='<div class="trends-empty-pill" style="grid-column: 1 / -1;">최근 감지된 유의미한 변동이 없어요.</div>';
    }else{
      changingContainer.innerHTML=changingItems.map(m=>this.renderTrendCard(m)).join('');
    }

    stableContainer.innerHTML=stableItems.map(m=>this.renderTrendCard(m)).join('');
  }
  generateTrendCardChartHtml(m){
    if(m.avg==null)return '<div class="trends-empty-pill">데이터 수집 중</div>';
    const bars=m.bars||[];
    const isChanging=m.isChanging&&m.pastAvg!=null;
    const maxVal=Math.max(1,...bars,m.avg||0,(m.pastAvg||0))*1.25;
    const n=Math.max(1,bars.length);

    const barElements=bars.map((val,idx)=>{
      if(val==null)return '';
      const heightPct=Math.max(3,(val/maxVal)*100);
      const stepPct=100/n;
      const barWPct=stepPct*0.58;
      const xPct=idx*stepPct+(stepPct-barWPct)/2;
      const yPct=100-heightPct;
      return `<rect x="${xPct.toFixed(2)}%" y="${yPct.toFixed(2)}%" width="${barWPct.toFixed(2)}%" height="${heightPct.toFixed(2)}%" rx="2" fill="rgba(255,255,255,0.18)"><title>${trendValue(val,m.unit)}${m.unit}</title></rect>`;
    }).join('');

    let baselineLinesSvg='';
    let overlayLabelsHtml='';
    let axisLabelsHtml='';

    if(isChanging){
      const pastYPct=Math.max(8,Math.min(92,(1-m.pastAvg/maxVal)*100));
      const currYPct=Math.max(8,Math.min(92,(1-m.avg/maxVal)*100));
      const splitXPct=((n-4)/n)*100;

      baselineLinesSvg=`
        <line x1="0%" y1="${pastYPct.toFixed(1)}%" x2="${(splitXPct-1.5).toFixed(1)}%" y2="${pastYPct.toFixed(1)}%" stroke="#718698" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="${(splitXPct+1.5).toFixed(1)}%" y1="${currYPct.toFixed(1)}%" x2="100%" y2="${currYPct.toFixed(1)}%" stroke="${m.color}" stroke-width="4" stroke-linecap="round"/>
      `;

      overlayLabelsHtml=`
        <span class="trend-chart-avg-label pos-left" style="top:${pastYPct.toFixed(1)}%; color:#8fa4b5;">${trendValue(m.pastAvg,m.unit)}${m.unit}</span>
        <span class="trend-chart-avg-label pos-right" style="top:${currYPct.toFixed(1)}%; color:${m.color};">${trendValue(m.avg,m.unit)}${m.unit}</span>
      `;

      axisLabelsHtml=`
        <div class="trend-chart-axis-labels">
          <span style="color:#718698;">${m.pastPeriodLabel}</span>
          <span style="color:${m.color}; font-weight:750;">${m.currPeriodLabel}</span>
        </div>
      `;
    }else{
      const avgYPct=Math.max(8,Math.min(92,(1-m.avg/maxVal)*100));

      baselineLinesSvg=`
        <line x1="0%" y1="${avgYPct.toFixed(1)}%" x2="100%" y2="${avgYPct.toFixed(1)}%" stroke="${m.color}" stroke-width="4" stroke-linecap="round"/>
      `;

      overlayLabelsHtml=`
        <span class="trend-chart-avg-label pos-left" style="top:${avgYPct.toFixed(1)}%; color:${m.color};">${trendValue(m.avg,m.unit)}${m.unit}</span>
      `;

      axisLabelsHtml=`
        <div class="trend-chart-axis-labels">
          <span>${m.startLabel}</span>
          <span>${m.endLabel}</span>
        </div>
      `;
    }

    return `
      <div class="trend-chart-box">
        <div class="trend-chart-svg-wrap">
          <svg class="trend-chart-svg" width="100%" height="100%">
            <g>${barElements}</g>
            ${baselineLinesSvg}
          </svg>
          ${overlayLabelsHtml}
        </div>
        ${axisLabelsHtml}
      </div>
    `;
  }
  renderTrendCard(m){
    const chartHtml=this.generateTrendCardChartHtml(m);
    const changeIndex=m.changeText?m.subDesc.indexOf(m.changeText):-1;
    const summaryHtml=changeIndex<0?esc(m.subDesc):`${esc(m.subDesc.slice(0,changeIndex))}<strong class="trend-change">${esc(m.changeText)}</strong>${esc(m.subDesc.slice(changeIndex+m.changeText.length))}`;
    const headlineHtml=esc(m.headline).replace(/증가|감소|일관/g,word=>`<strong class="trend-direction">${word}</strong>`);
    return `
      <article class="trend-card" data-trend="${esc(m.id)}" style="--trend-color:${m.color};">
        <div class="trend-card-top">
          <div class="trend-title-group">
            <span class="trend-badge-icon">${m.icon}</span>
            <span class="trend-metric-name" style="color:${m.color};">${esc(m.name)}</span>
          </div>
          <span class="trend-arrow">›</span>
        </div>
        <h4 class="trend-headline">${headlineHtml}</h4>
        <p class="trend-card-summary">${summaryHtml}</p>
        <div class="trend-divider"></div>
        ${chartHtml}
      </article>
    `;
  }
  async loadThumbnails(){
    if(!this.data?.records?.length||!this._hass?.fetchWithAuth)return;
    const recordsWithPhotos=this.data.records.filter(r=>r.attachments?.length);
    for(const r of recordsWithPhotos){
      const thumbBox=this.shadowRoot?.querySelector(`.thumb-box[data-thumb-record="${r.id}"]`);
      if(!thumbBox)continue;
      const photo=r.attachments[0];
      if(!photo?.id)continue;
      let url=this.thumbnailCache.get(photo.id);
      if(!url){
        try{
          const res=await this._hass.fetchWithAuth(`/api/carrot_ha/v1/journal/${encodeURIComponent(this.entry)}/attachments/${encodeURIComponent(photo.id)}`);
          if(res.ok){
            const blob=await res.blob();
            url=URL.createObjectURL(blob);
            this.thumbnailCache.set(photo.id,url);
          }
        }catch(e){
          console.warn('[carrot-vehicle-journal] Thumbnail load failed:',photo.id,e);
        }
      }
      if(url){
        thumbBox.innerHTML=`<img src="${url}" alt="${esc(photo.name||'사진 썸네일')}" loading="lazy" />`;
      }
    }
  }
  openPhotoViewer(record,initialIndex=0){
    if(!record?.attachments?.length)return;
    this.lightboxRecord=record;
    this.lightboxIndex=Math.max(0,Math.min(initialIndex,record.attachments.length-1));
    this.renderLightboxPhoto();
    this.$('photoViewerDialog')?.showModal();
  }
  stepLightbox(delta){
    if(!this.lightboxRecord?.attachments?.length)return;
    const len=this.lightboxRecord.attachments.length;
    this.lightboxIndex=(this.lightboxIndex+delta+len)%len;
    this.renderLightboxPhoto();
  }
  async renderLightboxPhoto(){
    if(!this.lightboxRecord?.attachments?.length)return;
    const photos=this.lightboxRecord.attachments;
    const photo=photos[this.lightboxIndex];
    if(!photo)return;

    const countStr=photos.length>1?` (${this.lightboxIndex+1} / ${photos.length})`:'';
    if(this.$('lightboxTitle'))this.$('lightboxTitle').textContent=`사진${countStr}`;
    if(this.$('lightboxMeta'))this.$('lightboxMeta').textContent=photo.name||'';

    const caption=this.lightboxRecord.memo||this.lightboxRecord.subcategory||'';
    if(this.$('lightboxCaption')){
      this.$('lightboxCaption').textContent=caption?`메모: ${caption}`:'';
      this.$('lightboxCaption').hidden=!caption;
    }

    const hasMultiple=photos.length>1;
    if(this.$('lightboxPrev'))this.$('lightboxPrev').hidden=!hasMultiple;
    if(this.$('lightboxNext'))this.$('lightboxNext').hidden=!hasMultiple;

    const img=this.$('lightboxImg');
    const spinner=this.$('lightboxSpinner');
    if(!img)return;

    let url=this.thumbnailCache.get(photo.id);
    if(url){
      img.src=url;
      img.hidden=false;
      if(spinner)spinner.hidden=true;
      return;
    }

    img.hidden=true;
    if(spinner){spinner.hidden=false;spinner.textContent='사진을 불러오고 있어요...';}
    try{
      const res=await this._hass.fetchWithAuth(`/api/carrot_ha/v1/journal/${encodeURIComponent(this.entry)}/attachments/${encodeURIComponent(photo.id)}`);
      if(!res.ok)throw new Error('사진을 불러오지 못했어요.');
      const blob=await res.blob();
      url=URL.createObjectURL(blob);
      this.thumbnailCache.set(photo.id,url);
      img.src=url;
      img.hidden=false;
      if(spinner)spinner.hidden=true;
    }catch(e){
      if(spinner){spinner.hidden=false;spinner.textContent=e.message||'사진 로딩 실패';}
    }
  }
  showPhotos(record){
    this.openPhotoViewer(record);
  }
  formFields(){const kind=this.$('kind').value||'expense';for(const id of ['categoryField','subcategoryField'])this.$(id).hidden=kind!=='expense';for(const id of ['distanceField','energyField'])this.$(id).hidden=kind!=='trip';for(const id of ['chargeField','modeField','billedField'])this.$(id).hidden=kind!=='charge';this.$('odometerField').hidden=kind!=='trip';for(const id of ['startField','endField','socStartField','socEndField'])this.$(id).hidden=kind==='expense';this.$('amountField').hidden=kind==='trip';}
  renderSelectedPhotos(){
    for(const url of this.photoURLs||[])URL.revokeObjectURL(url);
    this.photoURLs=[];this.$('photoPreview').replaceChildren();
    this.$('clearPhotos').hidden=!this.selectedPhotos?.length;
    this.$('recordError').textContent='';
    for(const [index,file] of (this.selectedPhotos||[]).entries()){
      const item=document.createElement('div'),img=document.createElement('img'),name=document.createElement('small'),button=document.createElement('button');
      item.style.cssText='display:inline-flex;flex-direction:column;gap:6px;margin:8px;max-width:140px';
      const url=URL.createObjectURL(file);this.photoURLs.push(url);img.src=url;img.alt=file.name;
      name.textContent=file.name;name.style.overflowWrap='anywhere';
      button.type='button';button.textContent='선택 취소';button.setAttribute('aria-label',file.name+' 사진 선택 취소');
      button.onclick=e=>{e.preventDefault();this.selectedPhotos.splice(index,1);this.$('photos').value='';this.renderSelectedPhotos();};
      item.append(img,name,button);this.$('photoPreview').append(item);
    }
  }
  openRecord(record){
    this.$('save').hidden=false;this.editing=record||null;this.pendingId=record?.id||uuid();this.$('recordForm').reset();this.selectedPhotos=[];this.renderSelectedPhotos();
    const form=this.$('recordForm');form.elements.date.value=new Date().toLocaleDateString('sv-SE');
    if(record?.input)for(const [key,value] of Object.entries(record.input))if(form.elements[key]){let text=value??'';if(value&&['started_at','ended_at'].includes(key)){const time=new Date(value);text=new Date(time.getTime()-time.getTimezoneOffset()*60000).toISOString().slice(0,16);}if(key==='actual_krw'&&value!=null){text=Number(value).toLocaleString('ko-KR');}form.elements[key].value=text;}
    this.formFields();this.$('recordDialog').showModal();
  }
  async saveRecord(event){
    event.preventDefault();const form=this.$('recordForm'),payload={kind:this.$('kind').value||'expense',date:form.elements.date.value,memo:form.elements.memo.value};
    if(payload.kind==='expense'){payload.category=form.elements.category.value;payload.subcategory=form.elements.subcategory.value;}
    const rawAmt=form.elements.actual_krw?.value?.replace(/[^\d]/g,'');
    if(rawAmt)payload.actual_krw=Number(rawAmt);
    const photos=[...(this.selectedPhotos||[])];if(photos.length>5||photos.some(f=>!f.size||f.size>20*1024*1024||!['image/jpeg','image/png','image/webp'].includes(f.type))){this.$('recordError').textContent='20MiB 이하 JPG·PNG·WEBP 사진을 최대 5장 골라 주세요.';return;}
    this.$('save').disabled=true;this.$('photos').disabled=true;this.$('clearPhotos').disabled=true;for(const button of this.$('photoPreview').querySelectorAll('button'))button.disabled=true;
    try{
      const preparedPhotos=[];
      for(let i=0;i<photos.length;i++){
        this.$('recordError').textContent=`사진을 압축하고 있어요 (${i+1}/${photos.length})`;
        preparedPhotos.push(await prepareJournalPhoto(photos[i]));
      }
      this.$('recordError').textContent='';
      const result=await this.call('record/save',{record_id:this.pendingId,expected_version:this.editing?.version||0,payload});
      this.editing={id:result.id,version:result.version,input:payload};
      for(const file of preparedPhotos){const body=new FormData();body.append('record_id',result.id);body.append('file',file);const response=await this._hass.fetchWithAuth(`/api/carrot_ha/v1/journal/${encodeURIComponent(this.entry)}/attachments`,{method:'POST',body});if(!response.ok)throw new Error('기록은 저장했지만 사진을 저장하지 못했어요. 사진을 다시 골라 주세요.');}
      this.draftDirty=false;this.selectedPhotos=[];this.$('photos').value='';this.renderSelectedPhotos();this.$('recordDialog').close();this.offset=0;await this.load(true);
    }catch(error){this.$('recordError').textContent=error.message||'기록을 저장하지 못했어요.';}
    finally{this.$('save').disabled=false;this.$('photos').disabled=false;this.$('clearPhotos').disabled=false;for(const button of this.$('photoPreview').querySelectorAll('button'))button.disabled=false;}
  }
  async changeStatus(record,action){try{await this.call('record/status',{record_id:record.id,expected_version:record.version,status:action==='restore'?'active':'deleted'});await this.load(true);}catch(error){this.$('message').textContent=error.message||'기록을 변경하지 못했어요.';}}
}
if(!customElements.get('carrot-vehicle-journal'))customElements.define('carrot-vehicle-journal',VehicleJournal);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='carrot-vehicle-journal'))window.customCards.push({type:'carrot-vehicle-journal',name:'Carrot HA 차계부',description:'HA 로컬 장기 기록과 수동 누락 기록을 함께 살펴봐요.'});
export default VehicleJournal;
