const version=new URL(import.meta.url).searchParams.get('v');
if(!version)throw new Error('Carrot HA: load carrot-dashboard.js, not the runtime directly.');
const moduleURL=name=>{const url=new URL(name,import.meta.url);url.searchParams.set('v',version);return url.href;};
// Register lightweight shells synchronously; load only cards actually mounted.
function lazyCard(tag, filename) {
  if(customElements.get(tag))return;
  customElements.define(tag,class extends HTMLElement {
    static getStubConfig(){return {device_id:''};}
    connectedCallback(){this.style.display='block';this.mount();}
    setConfig(config){this.config=config;if(this.card)this.card.setConfig(config);else this.mount();}
    set hass(hass){this._hass=hass;if(this.card)this.card.hass=hass;else this.mount();}
    getCardSize(){return this.card?.getCardSize?.()??8;}
    getGridOptions(){return this.card?.getGridOptions?.()??{columns:36,rows:'auto',min_columns:6};}
    async mount(){
      if(this.loading||this.card||!this.config||!this.isConnected)return;
      this.loading=true;
      try{
        const {default:Card}=await import(moduleURL(filename));
        if(!this.isConnected)return;
        const implementation=tag+'-implementation';
        if(!customElements.get(implementation))customElements.define(implementation,Card);
        this.card=document.createElement(implementation);
        this.card.setConfig(this.config);
        this.replaceChildren(this.card);
        if(this._hass)this.card.hass=this._hass;
      }catch(error){
        this.textContent='Carrot HA: '+error.message;
      }finally{this.loading=false;}
    }
  });
}
lazyCard('carrot-dashboard-ko','./carrot-dashboard-ko.js');
lazyCard('carrot-dashboard-en','./carrot-dashboard-en.js');
lazyCard('carrot-dashboard-debug-card','./carrot-dashboard-debug.js');
lazyCard('carrot-params-card','./carrot-params-card.js');
class LocalizedDashboard extends HTMLElement {
  constructor(){super();}
  connectedCallback(){this.style.display='block';}
  setConfig(config){this.config=config;this.updateLanguage();}
  set hass(hass){this._hass=hass;this.updateLanguage();}
  getCardSize(){return this.card?.getCardSize()??8;}
  getGridOptions(){return {columns:36,rows:'auto',min_columns:6};}
  updateLanguage(){
    if(!this.config)return;
    const requested=this.config.language;
    if((!requested||requested==='auto')&&!this._hass)return;
    const language=(!requested||requested==='auto')?(this._hass?.locale?.language||this._hass?.language||navigator.language):requested;
    const lang=String(language).toLowerCase().startsWith('ko')?'ko':'en';
    if(this.lang!==lang){
      this.card?.remove();this.lang=lang;
      this.card=document.createElement('carrot-dashboard-'+lang);
      this.replaceChildren(this.card);
    }
    if(this.appliedConfig!==this.config||this.configuredCard!==this.card){this.card.setConfig(this.config);this.appliedConfig=this.config;this.configuredCard=this.card;}
    if(this._hass)this.card.hass=this._hass;
  }
}
if(!customElements.get('carrot-history-card'))customElements.define('carrot-history-card',LocalizedDashboard);
if(!customElements.get('carrot-dashboard-card'))customElements.define('carrot-dashboard-card',class extends LocalizedDashboard{});
window.customCards=window.customCards||[];
window.customCards.push({type:'carrot-dashboard-card',name:'Carrot HA — MEB',description:'Vehicle, trips, charging and battery history / 차량·주행·충전'});
window.customCards.push({type:'carrot-params-card',name:'Carrot HA — 당근파일럿 파라미터 튜닝',description:'당근파일럿의 모든 파라미터와 상세 설명(Wiki)을 원격으로 확인하고 조절하는 전용 카드'});
window.customCards.push({type:'carrot-dashboard-debug-card',name:'Carrot HA — 실시간 UI 디버깅 대시보드',description:'슬라이더와 토글로 충전/배터리 상태를 실시간 시뮬레이션하는 개발자 디버거 카드'});

