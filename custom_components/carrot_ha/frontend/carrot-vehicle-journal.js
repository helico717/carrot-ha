import {journalDesign} from './carrot-journal-design.js?v=journal-20261006-3';
import {preserveView} from './carrot-view-state.js';
// HA-local EV journal. No remote polling, browser token or localStorage records.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=(value,digits=1)=>Number.isFinite(value)?value.toLocaleString('ko-KR',{maximumFractionDigits:digits}):'—';
const money=value=>Number.isFinite(value)?numeric(value,0)+'원':'미확인';
const categories={charging:'충전비',maintenance:'정비 / 소모품',washing:'세차비',tuning:'튜닝',insurance:'보험',tax:'세금',parking:'주차비',toll:'통행료',other:'기타'};
const uuid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;};
const kindNames={trip:'주행',charge:'충전',expense:'지출'};
const styles=`
:host{display:block;--j-bg:#0b1014;--j-surface:#161e25;--j-raised:#202c36;--j-border:#2a3945;--j-ink:#f1f6fa;--j-sub:#a8bdca;--j-accent:#81e6c5;--j-blue:#7bb6ff;color:var(--j-ink);font:15px/1.65 system-ui,-apple-system,sans-serif}
*{box-sizing:border-box}button,input,select,textarea{font:inherit;color:inherit}button{background:var(--j-raised);border:1px solid var(--j-border);border-radius:12px;padding:10px 15px;min-height:44px;cursor:pointer}button:disabled{opacity:.5;cursor:wait}input,select,textarea{background:var(--j-bg);border:1px solid var(--j-border);border-radius:10px;padding:10px;width:100%;min-width:0}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--j-blue);outline-offset:3px}h1,h2,h3,p{margin:0}h1{font-size:clamp(28px,4vw,44px);line-height:1.25;letter-spacing:-1px}h2{font-size:20px}small,.muted{color:var(--j-sub)}.shell{background:var(--j-bg);border-radius:24px;max-width:1280px;margin:auto;padding:30px;min-width:0}.mast,.row{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.mast{justify-content:space-between;margin-bottom:24px}.brand{color:var(--j-sub);font-size:12px;letter-spacing:2px}.mast h2{font-size:26px}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.controls input,.controls select{width:auto;max-width:100%}.tabs{display:flex;background:var(--j-surface);padding:6px;gap:5px;border-radius:15px;margin:24px 0;flex-wrap:wrap}.tabs button{flex:1;background:transparent;color:var(--j-sub);border:0;white-space:nowrap}.tabs button[aria-selected=true]{background:var(--j-raised);color:var(--j-ink)}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:18px}.panel{background:var(--j-surface);border:1px solid var(--j-border);border-radius:23px;padding:25px;min-width:0}.wide{grid-column:span 8}.narrow{grid-column:span 4}.half{grid-column:span 6}.full{grid-column:span 12}.hero{padding:35px;background:linear-gradient(130deg,#183b37,var(--j-surface))}.accent{color:var(--j-accent)}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:25px 0}.stat small:first-child{min-height:28px;display:flex;align-items:flex-end;margin-bottom:4px}.stat strong{display:block;font-size:21px;font-variant-numeric:tabular-nums;white-space:nowrap}.stat-unit{font-size:12.5px;font-weight:normal;margin-left:2px}.stat-empty{color:var(--j-sub);font-size:15px;font-weight:normal}.kicker{font-size:12px;letter-spacing:2px;color:var(--j-sub);margin-bottom:15px}.primary{background:var(--j-accent);color:#07221b;border:0}.spaced{justify-content:space-between}.list-row{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--j-border)}.list-row small{display:block}.note{color:var(--j-sub);font-size:13px;margin-top:16px}.status{border:1px solid var(--j-border);border-radius:12px;padding:12px;margin-bottom:18px}.error{color:#ffadad}.cost-layout{display:flex;align-items:center;gap:24px;flex-wrap:wrap}.donut{width:150px;height:150px;flex-shrink:0}.cost-list{flex:1;min-width:160px}.chart{width:100%;height:240px;display:block;margin-top:20px}.chart text{fill:var(--j-sub);font-size:12px}.chart-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.chart-controls select{max-width:210px}.table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse;font-size:13px;margin-top:15px}.table th,.table td{text-align:left;border-bottom:1px solid var(--j-border);padding:12px 6px}.table td:last-child{white-space:nowrap}.table small{display:block}.table button{padding:6px 9px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}.fields label{font-size:13px}.fields input,.fields select,.fields textarea{margin-top:7px}.fullfield{grid-column:1/-1}.fieldhelp{font-size:12px;color:var(--j-sub)}dialog{color:var(--j-ink);background:var(--j-surface);border:1px solid var(--j-border);border-radius:24px;width:min(620px,calc(100% - 24px));padding:25px;max-height:90dvh;overflow:auto}dialog::backdrop{background:#000b}.badge{display:inline-block;background:var(--j-raised);border-radius:30px;padding:4px 10px;font-size:12px}.footer{font-size:12px;color:var(--j-sub);margin-top:24px}.preview img{max-width:110px;max-height:90px;border-radius:10px}.compare-value{font-size:34px;color:var(--j-accent);margin:20px 0}[hidden]{display:none!important}@media(max-width:850px){.wide,.narrow,.half{grid-column:span 12}.shell{padding:24px 20px}.tabs button{flex:1 1 140px}}@media(max-width:520px){.shell{padding:20px 12px}.panel,.hero{padding:20px}.stats{grid-template-columns:1fr 1fr}.fields{grid-template-columns:1fr}.tabs button{flex:1 1 90px;padding:10px 6px;font-size:12px}.controls{width:100%}.controls label{flex:1}.controls input{width:100%}.mast h2{font-size:23px}.table th,.table td{padding:10px 4px}.cost-layout{justify-content:center}.stat strong{font-size:18px}.stat-unit{font-size:11.5px}.stat-empty{font-size:13.5px}.stat small:first-child{min-height:26px}}
`;

export class VehicleJournal extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.tab=0;this.offset=0;this.metric='distance_km';this.period='day';this.scope='month';this.comparisonCategory=null;this.entries=[];this.request=0;}
  setConfig(config){this.config=config||{};if(!this.ready)this.build();if(this.config.entry_id&&this.entry!==this.config.entry_id){this.entry=this.config.entry_id;this.data=null;this.offset=0;}this.load();}
  set hass(hass){this._hass=hass;if(!this.ready)this.build();this.load();}
  getCardSize(){return 12;}
  getGridOptions(){return {columns:36,rows:'auto',min_columns:6};}
  static getStubConfig(){return {entry_id:''};}
  connectedCallback(){if(!this.ready)this.build();else this.resize?.observe(this.$('chart'));this.visibility=()=>{if(!document.hidden)this.load(true);};document.addEventListener('visibilitychange',this.visibility);this.timer=setInterval(()=>{if(!document.hidden&&!this.$('recordDialog').open)this.load(true);},60000);this.load();}
  disconnectedCallback(){this.resize?.disconnect();clearInterval(this.timer);document.removeEventListener('visibilitychange',this.visibility);this.request++;}
  $(id){return this.shadowRoot.getElementById(id);}
  build(){
    this.ready=true;
    this.shadowRoot.innerHTML=`<style>${styles}${journalDesign}</style><div class="shell">
    <header class="mast"><div class="mast-left"><div class="brand">CARROT HA · EV JOURNAL</div><div class="title-controls-row"><h2>내 차의 생활</h2><select class="select-pill" id="entry" aria-label="차량"></select><input class="date-pill" id="month" type="month" aria-label="기록 기간"></div></div><div class="mast-right"><button id="add" class="btn-record-primary">＋ 기록 남기기</button><div class="period-segmented" role="group" aria-label="집계 기간 선택">${[['day','일별'],['month','월별'],['year','연도별']].map(([key,label])=>`<button class="period-tab-btn ${key==='month'?'active':''}" data-scope="${key}" aria-pressed="${key==='month'}">${label}</button>`).join('')}</div></div></header>
    <p class="status" id="message" role="status" aria-live="polite">HA 기록을 불러오고 있어요.</p>
    <nav class="tabs" role="tablist" aria-label="차계부 메뉴">${['한눈에','주행 & 에너지','절약 비교','차계부','차량 상태'].map((n,i)=>`<button type="button" role="tab" id="tab${i}" aria-controls="page${i}" aria-selected="${i===0}">${n}</button>`).join('')}</nav>
    <section id="page0" role="tabpanel" aria-labelledby="tab0">
          <div class="grid">

            <!-- 1. 영웅 카드 (클린 3단 큼직한 타이포그래피 문장형) -->
            <article class="panel wide hero" id="heroCard">
              <div class="kicker" id="heroKicker">YOUR MONTH, IN ONE SENTENCE</div>
              <h1 id="headline">기록을 불러오고 있어요.</h1>
              <p class="muted note" id="heroNote">주행은 자동으로 모으고, 놓친 기록은 직접 남겨요.</p>
              <div class="stats" id="briefStats"></div>
<div style="margin-top: 8px;">
                <button id="gotoCompare" style="font-size:13px; padding:8px 14px; min-height:36px;">절약 계산 살펴보기 →</button>
              </div>
            </article>

            <!-- 2. 스택형 전월/전일/전년 대비 지출 비교 카드 -->
            <article class="panel narrow comparison-panel is-more" id="targetCard">
              <div class="card-header-row">
                <div>
                  <div class="kicker" id="compareKicker" style="margin-bottom:3px;">MONTHLY SPENDING COMPARISON</div>
                  <h2 id="cardTitle">지난달 지출과 비교</h2>
                </div>
                <span id="trendPill" class="trend-badge">비교 중</span>
              </div>

              <div class="spend-headline">
                <div class="spend-context" id="compareContext"></div>
                <div class="spend-statement" id="spendStatement"></div>
              </div>

              <div class="chart-container" id="chartBox">
                <div class="chart-tooltip" id="chartTooltip">
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
    <section id="page1" role="tabpanel" aria-labelledby="tab1" hidden><article class="panel"><h2>달리고 충전한 흐름이에요.</h2><div class="chart-controls"><select id="metric" aria-label="추이 지표"><option value="distance_km">주행거리 · km</option><option value="drive_energy_kwh">주행 소비 · kWh</option><option value="battery_charge_kwh">충전량 · kWh</option><option value="charge_effective_krw">충전비 · 원</option><option value="efficiency">전비 · km/kWh</option><option value="drive_soc_used_pp">주행 사용 SOC · %p</option></select><select id="period" aria-label="집계 단위"><option value="day">1일 단위</option><option value="week">1주 단위</option><option value="month">1개월 단위</option></select></div><svg id="chart" class="chart" role="img" aria-label="날짜별 추이"></svg><div class="stats" id="energyStats"></div><p class="note" id="qualityNote"></p></article></section>
    <section id="page2" role="tabpanel" aria-labelledby="tab2" hidden><div class="grid"><article class="panel wide hero"><h2>같은 거리를 다른 차로 달렸다면요.</h2><div class="compare-value" id="saving">유가 센서를 먼저 연결해 주세요.</div><div id="compareDetail"></div><p class="note">선택 기간의 충전비와 현재 유가 기준 예상 유류비만 비교해요. 전체 차량 유지비 절감은 아니에요.</p></article><article class="panel narrow"><h2>비교 기준을 정해요.</h2><form id="compareForm"><div class="fields"><label class="fullfield">비교 유종<select id="fuel"><option value="gasoline">휘발유</option><option value="diesel">경유</option><option value="premium">고급유</option></select></label><label class="fullfield">비교 연비 · km/L<input id="economy" type="number" min="1" max="50" step="0.1" value="12" required></label><label class="fullfield">HA 유가 센서<input id="fuelEntity" placeholder="sensor.fuel_price" required></label></div><button class="primary" type="submit">HA에 비교 기준 저장</button><p class="note" id="compareMessage" role="status"></p></form></article></div></section>
    <section id="page3" role="tabpanel" aria-labelledby="tab3" hidden><article class="panel"><div class="row spaced"><h2>차에 남긴 기록이에요.</h2><button id="addLedger" class="btn-record-primary">＋ 기록 남기기</button></div><p class="note">자동 주행·충전·결제와 직접 남긴 기록을 함께 보여줘요. 삭제한 수동 기록은 복원할 수 있어요.</p><div class="table-wrap"><table class="table"><thead><tr><th>날짜 / 출처</th><th>기록 / 메모</th><th>거리·충전·금액</th><th>관리</th></tr></thead><tbody id="records"></tbody></table></div><div class="row" style="margin-top:16px"><button id="previous">이전 기록</button><button id="next">다음 기록</button><span id="pageLabel" class="muted"></span></div></article></section>
    <section id="page4" role="tabpanel" aria-labelledby="tab4" hidden><article class="panel"><h2>마지막으로 확인한 차량 상태예요.</h2><div class="stats" id="stateStats"></div><p class="note" id="stateNote"></p></article></section>
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
    <label id="socStartField" hidden>시작 SOC · % (선택)<input name="soc_start_percent" type="number" min="0" max="100" step="0.1"></label><label id="socEndField" hidden>종료 SOC · % (선택)<input name="soc_end_percent" type="number" min="0" max="100" step="0.1"></label><label id="odometerField" hidden>계기판 누적거리 · km (선택)<input name="odometer_km" type="number" min="0" step="0.1"></label><label class="fullfield">메모<textarea name="memo" maxlength="4000" rows="3"></textarea></label><label class="fullfield">사진 · JPG / PNG / WEBP<input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>사진당 2MiB 이하, 최대 5장이에요.</small><div class="preview" id="photoPreview"></div></label></div>
    <p class="note">모르는 소비량·시각은 비워 주세요. 자동 기록과 겹치는 날짜는 저장 전에 확인해 주세요.</p><p class="error" id="recordError" role="alert"></p><div class="row" style="margin-top:16px"><button id="save" class="btn-record-primary" type="submit">HA에 기록 저장</button></div></form></dialog></div>`;
    if(this.$('month'))this.$('month').value=new Date().toLocaleDateString('sv-SE').slice(0,7);
    if(this.$('entry'))this.$('entry').onchange=()=>{this.entry=this.$('entry').value;this.offset=0;this.load(true);};
    if(this.$('month'))this.$('month').onchange=()=>{this.offset=0;this.load(true);};
    for(const button of this.shadowRoot.querySelectorAll('[data-scope]'))button.onclick=()=>this.setScope(button.dataset.scope);
    this.$('legendRow').onclick=event=>{const button=event.target.closest('[data-cat]');if(button){this.comparisonCategory=this.comparisonCategory===button.dataset.cat?null:button.dataset.cat;this.renderSpendingComparison();}};
    for(let i=0;i<5;i++)if(this.$('tab'+i))this.$('tab'+i).onclick=()=>this.selectTab(i);
    for(const id of ['add','addRecent','addLedger'])if(this.$(id))this.$(id).onclick=()=>this.openRecord();
    if(this.$('close'))this.$('close').onclick=()=>this.$('recordDialog')?.close();
    if(this.$('gotoCompare'))this.$('gotoCompare').onclick=()=>this.selectTab(2);
    if(this.$('recordForm'))this.$('recordForm').onsubmit=event=>this.saveRecord(event);
    const actualInput=this.$('actualKrw');
    if(actualInput)actualInput.oninput=e=>{const raw=e.target.value.replace(/[^\d]/g,'');e.target.value=raw?Number(raw).toLocaleString('ko-KR'):'';};
    if(this.$('metric'))this.$('metric').onchange=()=>{this.metric=this.$('metric').value;this.drawChart();};
    if(this.$('period'))this.$('period').onchange=()=>{this.period=this.$('period').value;this.drawChart();};
    if(this.$('previous'))this.$('previous').onclick=()=>{this.offset=Math.max(0,this.offset-100);this.load(true);};
    if(this.$('next'))this.$('next').onclick=()=>{this.offset+=100;this.load(true);};
    if(this.$('records'))this.$('records').onclick=e=>{const button=e.target.closest('button[data-record]');if(!button)return;const record=this.data?.records?.find(r=>r.id===button.dataset.record);if(!record)return;if(button.dataset.action==='photos'){this.showPhotos(record);return;}if(button.dataset.action==='edit')this.openRecord(record);else this.changeStatus(record,button.dataset.action);};
    if(this.$('compareForm'))this.$('compareForm').onsubmit=async event=>{event.preventDefault();try{await this.call('comparison/save',{fuel:this.$('fuel').value,economy_km_l:Number(this.$('economy').value),entity_id:this.$('fuelEntity').value});this.$('compareMessage').textContent='비교 기준을 저장했어요.';await this.load(true);}catch(e){this.$('compareMessage').textContent=e.message||'저장하지 못했어요.';}};
    if(this.$('photos'))this.$('photos').onchange=()=>{this.$('photoPreview').replaceChildren();for(const file of this.$('photos').files){const img=document.createElement('img');const url=URL.createObjectURL(file);img.src=url;img.alt='사진 미리보기';img.onload=()=>URL.revokeObjectURL(url);this.$('photoPreview').append(img);}};
    if(this.$('fuel'))this.$('fuel').onchange=()=>{const entity=this.data?.fuel_sensors?.[this.$('fuel').value];if(entity)this.$('fuelEntity').value=entity;};
    if(this.$('chart')){this.resize=new ResizeObserver(()=>this.drawChart());this.resize.observe(this.$('chart'));}
  }
  selectTab(index){this.tab=index;for(let i=0;i<5;i++){const page=this.$('page'+i);if(page)page.hidden=i!==index;const tab=this.$('tab'+i);if(tab)tab.setAttribute('aria-selected',String(i===index));}if(index===1)this.drawChart();}
  call(type,params={}){return this._hass.callWS({type:'carrot_ha/journal/'+type,entry_id:this.entry,...params});}
  async load(force=false){
    if(!this._hass?.callWS||!this.isConnected)return;
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
      const selectedEntry=this.entry,selectedOffset=this.offset;
      const [data,previous]=await Promise.all([this.call('query',{from:range.from,to:range.to,offset:selectedOffset}),this.call('query',{from:range.previousFrom,to:range.previousTo,offset:0}).catch(()=>null)]);
      data.previous=previous;
      if(generation!==this.request||!this.isConnected||this.entry!==selectedEntry||this.offset!==selectedOffset||this.$('month')?.value!==month||this.scope!==scope)return;
      this.data=data;preserveView(this,()=>this.renderData());
    }catch(error){
      if(this.$('message')){
        this.$('message').textContent=error.message||'HA 차계부에 연결하지 못했어요.';
        this.$('message').classList.add('error');
      }
    }
    finally{this.loading=false;if(this.reloadPending){this.reloadPending=false;this.load(true);}}
  }
  setScope(scope){
    if(!['day','month','year'].includes(scope)||scope===this.scope)return;
    const value=this.$('month').value,today=new Date().toLocaleDateString('sv-SE'),date=value.length===4?value+'-01-01':value.length===7?(value===today.slice(0,7)?today:value+'-01'):value;
    this.scope=scope;this.offset=0;
    const input=this.$('month');input.type=scope==='day'?'date':scope==='month'?'month':'number';
    if(scope==='year'){input.min='1900';input.max='2100';input.value=date.slice(0,4);}else{input.removeAttribute('min');input.removeAttribute('max');input.value=scope==='day'?date:date.slice(0,7);}
    for(const button of this.shadowRoot.querySelectorAll('[data-scope]')){const active=button.dataset.scope===scope;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    this.load(true);
  }
  range(){
    const value=this.$('month')?.value;
    if(!value||!({day:/^\d{4}-\d{2}-\d{2}$/,month:/^\d{4}-\d{2}$/,year:/^\d{4}$/}[this.scope]).test(value))return null;
    const [year,month=1,day=1]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));
    if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
    const iso=d=>d.toISOString().slice(0,10),end=new Date(date),previous=new Date(date),previousEnd=new Date(date);
    if(this.scope==='day'){previous.setUTCDate(day-1);previousEnd.setUTCDate(day-1);}
    if(this.scope==='month'){end.setUTCMonth(month,0);previous.setUTCMonth(month-2,1);previousEnd.setUTCDate(0);}
    if(this.scope==='year'){end.setUTCMonth(11,31);previous.setUTCFullYear(year-1);previousEnd.setUTCFullYear(year-1);previousEnd.setUTCMonth(11,31);}
    return {from:iso(date),to:iso(end),previousFrom:iso(previous),previousTo:iso(previousEnd)};
  }
  categoryColor(key){return {charging:'#81e6c5',maintenance:'#f59e0b',washing:'#60a5fa',tuning:'#c084fc',other:'#94a3b8'}[key]||'#94a3b8';}
  costCategories(totals){
    const result={};for(const [category,cost] of Object.entries(totals?.categories||{})){
      const key=['charging','maintenance','washing','tuning'].includes(category)?category:'other';
      const target=result[key]||(result[key]={actual_krw:0,estimated_krw:0,effective_krw:0});
      for(const field of Object.keys(target))target[field]+=cost[field]||0;
    }return result;
  }
  renderRecentExpenses(){
    const expenses=this.data.records.filter(record=>record.status==='active'&&record.kind==='expense').slice(0,4);
    this.$('recent').innerHTML=expenses.map(record=>{const key=['charging','maintenance','washing','tuning'].includes(record.category)?record.category:'other',color=this.categoryColor(key);
      return `<div class="recent-expense-row"><div class="recent-left"><div class="recent-title-line"><span class="cat-highlight-pill" style="color:${color};background:${color}22;border:1px solid ${color}66">${esc(categories[record.category]||'기타')}</span><span class="recent-item-title">${esc(record.subcategory||record.memo||categories[record.category]||'지출')}</span></div><small class="recent-date-sub">${esc(record.accounting_date||'미확인')} · ${record.origin==='manual'?'직접 기록':'자동 기록'}</small></div><strong class="recent-amount">${money(record.actual_krw??record.estimated_krw)}</strong></div>`;
    }).join('')||'<p class="muted note">이 기간의 지출 기록이 없어요.</p>';
  }
  renderSpendingComparison(){
    if(!this.data)return;
    const previous=this.costCategories(this.data.previous?.totals),current=this.costCategories(this.data.totals),key=this.comparisonCategory;
    const sum=data=>Object.values(data).reduce((total,item)=>total+item.effective_krw,0);
    const oldValue=key?(previous[key]?.effective_krw||0):sum(previous),newValue=key?(current[key]?.effective_krw||0):sum(current),diff=newValue-oldValue;
    const observed=Boolean(this.data.previous?.daily?.length);
    this.$('cardTitle').textContent={day:'이전 날 지출과 비교',month:'지난달 지출과 비교',year:'지난해 지출과 비교'}[this.scope];
    this.$('compareKicker').textContent={day:'DAILY SPENDING COMPARISON',month:'MONTHLY SPENDING COMPARISON',year:'YEARLY SPENDING COMPARISON'}[this.scope];
    const range=this.range();this.$('compareContext').textContent=`${range.previousFrom} ~ ${range.previousTo} 대비 ${range.from} ~ ${range.to}`;
    const color=diff>0?'#ff5c5c':diff<0?'#60a5fa':'#81e6c5';
    this.$('targetCard').classList.toggle('is-more',observed&&diff>0);this.$('targetCard').classList.toggle('is-less',observed&&diff<0);
    this.$('trendPill').className='trend-badge '+(observed?(diff>0?'more':diff<0?'less':''): '');
    this.$('trendPill').textContent=observed&&oldValue>0?`${diff>0?'▲':diff<0?'▼':'—'} ${numeric(Math.abs(diff/oldValue*100))}%`:'비교율 미확인';
    this.$('spendStatement').innerHTML=observed?`이전 기간에 비해 <span class="domain-tag" style="color:${key?this.categoryColor(key):'var(--j-accent)'}">${esc(key?categories[key]:'전체 지출')}</span>에서<br><span class="amount-highlight">${money(Math.abs(diff))}</span>을 <span style="color:${color}">${diff>0?'더 소비':diff<0?'덜 소비':'동일하게 소비'}</span>했어요.`:'이전 기간의 관측 기록이 없어 지출 차이를 계산하지 않아요.';
    for(const button of this.$('legendRow').querySelectorAll('[data-cat]')){button.classList.toggle('active',button.dataset.cat===key);button.setAttribute('aria-pressed',String(button.dataset.cat===key));}
    const amounts=data=>Object.fromEntries(Object.entries(data).map(([category,cost])=>[category,cost.effective_krw]));
    this.$('barChartSvg').setAttribute('aria-label',observed?'이전 기간과 선택 기간의 지출 비교':'이전 기간 기록 없음 · 선택 기간 지출');
    this.drawStackedChart(amounts(previous),amounts(current),sum(previous),sum(current),sum(current)-sum(previous),observed?range.previousFrom.slice(this.scope==='year'?0:5,this.scope==='year'?4:10):'기록 없음',range.from.slice(this.scope==='year'?0:5,this.scope==='year'?4:10));
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

        <!-- 추이 연결선 & 마커 -->
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
    const periodLabel={day:'선택한 날',month:'선택한 달',year:'선택한 해'}[this.scope];
    this.$('heroKicker').textContent={day:'YOUR DAY, IN ONE SENTENCE',month:'YOUR MONTH, IN ONE SENTENCE',year:'YOUR YEAR, IN ONE SENTENCE'}[this.scope];
    this.$('headline').innerHTML=`<span class="h-phrase">${periodLabel}</span><br><span class="h-phrase">${numeric(t.distance_km)}km를 달리고,</span><br><span class="h-phrase"><span class="accent">${money(t.total_cost_krw)}</span>을 기록했어요.</span>`;

    const isThisMonth=this.$('month').value===new Date().toLocaleDateString('sv-SE').slice(0,7);
    const effLabel=this.scope==='day'?'선택일 전비':this.scope==='year'?'선택 연도 전비':isThisMonth?'이번달 전비':'선택 월 전비';
    const chargeLabel=this.scope==='day'?'선택일 충전량':this.scope==='year'?'선택 연도 충전량':isThisMonth?'이번달 충전량':'선택 월 충전량';

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

    const state=this.stat('배터리 SOC',numeric(latest.soc_percent)+'%')+this.stat('주행가능거리',numeric(latest.range_km??latest.estimated_range_km)+' km')+this.stat('차량 상태',latest.driving||latest.onroad?'주행 중':latest.charging?'충전 중':'마지막 수신 상태');
    this.$('stateStats').innerHTML=state+this.stat('도어 잠금',latest.doors_locked===true?'잠겨 있어요':latest.doors_locked===false?'열려 있어요':'미확인')+this.stat('계기판 누적거리',numeric(latest.odometer_km)+' km')+this.stat('외기 온도',numeric(latest.outside_temp_c)+' °C');
    this.$('stateNote').textContent=`마지막 수신 ${latest.last_received||latest.measured_at||'미확인'} · 실시간 카드와 같은 HA 최신 기록을 사용해요. 수신 공백 동안 값은 새 측정이 아니에요.`;
    const amounts=Object.entries(this.costCategories(t)).filter(([,v])=>v.effective_krw>0);
    const colors=amounts.map(([key])=>this.categoryColor(key));
    this.$('costs').innerHTML=amounts.map(([k,v],i)=>`<div class="list-row"><span style="display:inline-flex;align-items:center"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:${colors[i]}"></span>${esc(categories[k]||k)}</span><strong style="font-variant-numeric:tabular-nums">${money(v.effective_krw)}</strong></div>`).join('')||'<p class="note">이 기간의 지출 기록이 아직 없어요.</p>';
    const total=amounts.reduce((sum,[,v])=>sum+v.effective_krw,0);let offset=0;
    this.$('donut').innerHTML=`<title>선택 기간 지출 ${money(total)}</title><circle cx="80" cy="80" r="59" fill="none" stroke="var(--j-raised)" stroke-width="20"/>`+amounts.map(([key,value],i)=>{const length=value.effective_krw/total*370.708;const html=`<circle cx="80" cy="80" r="59" fill="none" stroke="${colors[i]}" stroke-width="20" stroke-dasharray="${length} ${370.708-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"><title>${esc(categories[key])} ${money(value.effective_krw)}</title></circle>`;offset+=length;return html;}).join('')+`<text x="80" y="78" text-anchor="middle" fill="var(--j-sub)" font-size="12">선택 기간 지출</text><text x="80" y="98" text-anchor="middle" fill="var(--j-ink)" font-size="15">${money(total)}</text>`;
    this.renderRecentExpenses();
    this.renderSpendingComparison();
    this.$('energyStats').innerHTML=this.stat('충전량',numeric(t.battery_charge_kwh)+' kWh')+this.stat('완속 / 급속',`${numeric(t.slow_count,0)} / ${numeric(t.fast_count,0)}회`,`미확인 ${numeric(t.unknown_count,0)}회`)+this.stat('주행 소비 SOC',numeric(t.drive_soc_used_pp)+' %p','주차 소비·하루 전체 소비는 미확인');
    this.$('qualityNote').textContent=`관측된 주행의 에너지 커버리지는 ${numeric(t.energy_coverage_percent)}%예요. 원본이 없는 기간의 전비는 복원하지 않아요. 자정을 넘는 기록은 시간 비례 추정으로 배분해요. 수동 소비량은 측정값과 구분해요.`;
    this.$('records').innerHTML=d.records.map(r=>`<tr><td>${esc(r.accounting_date||r.started_at?.slice(0,10))}<small>${r.origin==='manual'?'직접 기록':'자동 기록'} · ${r.status==='deleted'?'삭제됨':r.status==='excluded'?'제외됨':'보관 중'}</small></td><td>${esc(categories[r.category]||kindNames[r.kind])}${r.subcategory?' · '+esc(r.subcategory):''}<small>${esc(r.memo)}</small>${r.duplicate_candidates?.length?'<small class="error">같은 날 자동 기록이 있어요. 중복 여부를 확인해 주세요.</small>':''}</td><td>${this.recordValue(r)}${r.attachments?.length?`<br><button data-record="${r.id}" data-action="photos">사진 ${r.attachments.length}장</button>`:''}</td><td>${r.origin==='manual'&&r.input?(r.status==='deleted'?`<button data-record="${r.id}" data-action="restore">복원</button>`:`<button data-record="${r.id}" data-action="edit">수정</button> <button data-record="${r.id}" data-action="delete">삭제</button>`):'<small>자동 원장</small>'}</td></tr>`).join('')||'<tr><td colspan="4">이 기간의 기록이 없어요. 누락 기록을 직접 남겨 보세요.</td></tr>';
    this.$('previous').disabled=this.offset===0;this.$('next').disabled=!d.has_more;this.$('pageLabel').textContent=`${this.offset+1}~${this.offset+d.records.length}번째 기록`;
    if(d.comparison&&this.shadowRoot.activeElement?.closest('#compareForm')==null){this.$('fuel').value=d.comparison.fuel;this.$('economy').value=d.comparison.economy_km_l;this.$('fuelEntity').value=JSON.parse(d.comparison.sensor_entities_json)[d.comparison.fuel]||'';}
    if(!d.comparison&&this.shadowRoot.activeElement?.closest('#compareForm')==null){const entity=d.fuel_sensors?.[this.$('fuel').value];if(entity){this.$('fuelEntity').value=entity;this.$('compareMessage').textContent='기존 전국 평균 유가 센서를 찾았어요. 비교 연비를 확인하고 저장해 주세요.';}}
    if(d.fuel_price&&d.comparison&&t.distance_km!=null&&t.charge_effective_krw!=null){const ice=t.distance_km/d.comparison.economy_km_l*d.fuel_price.price;const saving=ice-t.charge_effective_krw;this.$('saving').textContent=money(Math.abs(saving))+(saving>=0?'을 아꼈어요.':'이 더 들었어요.');this.$('compareDetail').innerHTML=`<p>내 전기차 ${money(t.charge_effective_krw)} · 비교 차량 ${money(ice)}</p><small>현재 HA 유가 ${money(d.fuel_price.price)}/L · ${esc(d.fuel_price.observed_at)}</small>`;}else{this.$('saving').textContent='비교에 필요한 거리·충전비·유가를 확인해 주세요.';this.$('compareDetail').textContent='원/L·KRW/L 센서 또는 gas_station_korea의 원 단위 유가 센서를 사용할 수 있어요. 비교 기준을 저장해 주세요.';}
    this.drawChart();
  }
  recordValue(r){return r.kind==='trip'?numeric(r.distance_km)+' km':r.kind==='charge'?numeric(r.battery_charge_kwh)+' kWh':money(r.actual_krw??r.estimated_krw);}
  drawChart(){
    if(!this.data||!this.$('chart')||this.tab!==1)return;
    const groups=new Map();for(const row of this.data.daily){let key=row.day;if(this.period==='month')key=key.slice(0,7);if(this.period==='week'){const dt=new Date(key+'T00:00:00Z');dt.setUTCDate(dt.getUTCDate()-((dt.getUTCDay()+6)%7));key=dt.toISOString().slice(0,10);}const group=groups.get(key)||{key,value:null,distance:0,energy:0};if(this.metric==='efficiency'){group.distance+=row.energy_distance_km||0;group.energy+=row.drive_energy_kwh||0;group.value=group.energy?group.distance/group.energy:null;}else if(row[this.metric]!=null)group.value=(group.value||0)+row[this.metric];groups.set(key,group);}
    const values=[...groups.values()],w=Math.max(280,this.$('chart').getBoundingClientRect().width),h=240,l=64,r=16,b=40,t=25,pw=w-l-r,ph=h-b-t,max=Math.max(1,...values.map(v=>v.value||0))*1.15;
    this.$('chart').setAttribute('viewBox',`0 0 ${w} ${h}`);
    const points=values.map((v,i)=>({...v,x:l+(i+.5)*pw/Math.max(1,values.length),y:t+ph*(1-(v.value||0)/max)}));
    let path='',previousValid=false;for(const p of points){if(p.value==null){previousValid=false;continue;}path+=(previousValid?'L':'M')+p.x+','+p.y+' ';previousValid=true;}
    this.$('chart').innerHTML=`<title>${esc(this.$('metric').selectedOptions[0].textContent)} 추이</title>`+Array.from({length:4},(_,i)=>{const y=t+ph*i/3;return `<line x1="${l}" y1="${y}" x2="${w-r}" y2="${y}" stroke="var(--j-border)"/><text x="${l-8}" y="${y+4}" text-anchor="end">${numeric(max*(1-i/3),1)}</text>`;}).join('')+points.map((p,i)=>`${p.value!=null?`<rect x="${p.x-pw/Math.max(1,values.length)*.28}" y="${p.y}" width="${pw/Math.max(1,values.length)*.56}" height="${t+ph-p.y}" rx="3" fill="var(--j-accent)" opacity=".25"><title>${esc(p.key)} · ${numeric(p.value)}</title></rect>`:''}${i%Math.max(1,Math.ceil(points.length/(w<420?3:6)))===0?`<text x="${p.x}" y="${h-12}" text-anchor="middle">${p.key.slice(5)}</text>`:''}`).join('')+`<path d="${path}" stroke="var(--j-accent)" stroke-width="2" fill="none"/><text x="${l}" y="14">${esc(this.$('metric').selectedOptions[0].textContent.split(' · ')[1])}</text>`;
    if(!points.length)this.$('chart').innerHTML=`<text x="${w/2}" y="120" text-anchor="middle">이 기간의 기록이 없어요.</text>`;
  }
  async showPhotos(record){
    this.openRecord(record);this.$('save').hidden=true;
    try{for(const photo of record.attachments){const response=await this._hass.fetchWithAuth(`/api/carrot_ha/v1/journal/${encodeURIComponent(this.entry)}/attachments/${encodeURIComponent(photo.id)}`);if(!response.ok)throw new Error('사진을 읽지 못했어요.');const url=URL.createObjectURL(await response.blob());const img=document.createElement('img');img.src=url;img.alt=photo.name;img.onload=()=>URL.revokeObjectURL(url);this.$('photoPreview').append(img);}}catch(e){this.$('recordError').textContent=e.message;}
  }
  formFields(){const kind=this.$('kind').value||'expense';for(const id of ['categoryField','subcategoryField'])this.$(id).hidden=kind!=='expense';for(const id of ['distanceField','energyField'])this.$(id).hidden=kind!=='trip';for(const id of ['chargeField','modeField','billedField'])this.$(id).hidden=kind!=='charge';this.$('odometerField').hidden=kind!=='trip';for(const id of ['startField','endField','socStartField','socEndField'])this.$(id).hidden=kind==='expense';this.$('amountField').hidden=kind==='trip';}
  openRecord(record){
    this.$('save').hidden=false;this.editing=record||null;this.pendingId=record?.id||uuid();this.$('recordForm').reset();this.$('recordError').textContent='';this.$('photoPreview').replaceChildren();
    const form=this.$('recordForm');form.elements.date.value=new Date().toLocaleDateString('sv-SE');
    if(record?.input)for(const [key,value] of Object.entries(record.input))if(form.elements[key]){let text=value??'';if(value&&['started_at','ended_at'].includes(key)){const time=new Date(value);text=new Date(time.getTime()-time.getTimezoneOffset()*60000).toISOString().slice(0,16);}if(key==='actual_krw'&&value!=null){text=Number(value).toLocaleString('ko-KR');}form.elements[key].value=text;}
    this.formFields();this.$('recordDialog').showModal();
  }
  async saveRecord(event){
    event.preventDefault();const form=this.$('recordForm'),payload={kind:this.$('kind').value||'expense',date:form.elements.date.value,memo:form.elements.memo.value};
    if(payload.kind==='expense'){payload.category=form.elements.category.value;payload.subcategory=form.elements.subcategory.value;}
    const rawAmt=form.elements.actual_krw?.value?.replace(/[^\d]/g,'');
    if(rawAmt)payload.actual_krw=Number(rawAmt);
    const photos=[...this.$('photos').files];if(photos.length>5||photos.some(f=>f.size>2097152||!['image/jpeg','image/png','image/webp'].includes(f.type))){this.$('recordError').textContent='2MiB 이하 JPG·PNG·WEBP 사진을 최대 5장 골라 주세요.';return;}
    this.$('save').disabled=true;
    try{
      const result=await this.call('record/save',{record_id:this.pendingId,expected_version:this.editing?.version||0,payload});
      this.editing={id:result.id,version:result.version,input:payload};
      for(const file of photos){const body=new FormData();body.append('record_id',result.id);body.append('file',file);const response=await this._hass.fetchWithAuth(`/api/carrot_ha/v1/journal/${encodeURIComponent(this.entry)}/attachments`,{method:'POST',body});if(!response.ok)throw new Error('기록은 저장했지만 사진을 저장하지 못했어요. 사진을 다시 골라 주세요.');}
      this.$('recordDialog').close();this.offset=0;await this.load(true);
    }catch(error){this.$('recordError').textContent=error.message||'기록을 저장하지 못했어요.';}
    finally{this.$('save').disabled=false;}
  }
  async changeStatus(record,action){try{await this.call('record/status',{record_id:record.id,expected_version:record.version,status:action==='restore'?'active':'deleted'});await this.load(true);}catch(error){this.$('message').textContent=error.message||'기록을 변경하지 못했어요.';}}
}
if(!customElements.get('carrot-vehicle-journal'))customElements.define('carrot-vehicle-journal',VehicleJournal);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='carrot-vehicle-journal'))window.customCards.push({type:'carrot-vehicle-journal',name:'Carrot HA 차계부',description:'HA 로컬 장기 기록과 수동 누락 기록을 함께 살펴봐요.'});
export default VehicleJournal;
