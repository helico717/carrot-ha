// Stable bootstrap: keep this file small. Deploy screen changes in the runtime.
// HA registers this URL at startup; fetch the current disk version on each mount.
class CarrotJournalPanel extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});}
  connectedCallback(){
    for(const key of ['hass','panel','narrow'])if(Object.prototype.hasOwnProperty.call(this,key)){const value=this[key];delete this[key];this[key]=value;}
    this.mount();
  }
  disconnectedCallback(){this.cleanup?.();this.cleanup=null;this.generation=(this.generation||0)+1;}
  set hass(value){this._hass=value;if(this.card)this.card.hass=value;}
  get hass(){return this._hass;}
  set panel(value){this._panel=value;}
  set narrow(value){this._narrow=value;}
  async mount(){
    if(this.card){this.cleanup?.();this.cleanup=this.startMonitor?.();return;}
    const generation=this.generation=(this.generation||0)+1;
    this.shadowRoot.textContent='차계부 화면을 불러오고 있어요.';
    try{
      const response=await fetch('/api/carrot_ha/frontend-version',{cache:'no-store'});
      if(!response.ok)throw new Error('화면 버전을 확인하지 못했어요.');
      const {version}=await response.json();
      if(typeof version!=='string'||!/^\d+\.\d+\.\d+[\w.-]*$/.test(version))throw new Error('화면 버전이 올바르지 않아요.');
      const url=new URL('./carrot-journal-panel-runtime.js',import.meta.url);url.searchParams.set('v',version);
      const {mountJournalPanel}=await import(url.href);
      if(!this.isConnected||generation!==this.generation)return;
      this.cleanup=await mountJournalPanel(this,version);
    }catch(error){
      if(!this.isConnected||generation!==this.generation)return;
      this.shadowRoot.textContent=error.message||'차계부 화면을 불러오지 못했어요.';
      const retry=document.createElement('button');retry.textContent='다시 시도';retry.onclick=()=>this.mount();this.shadowRoot.append(retry);
    }
  }
}
if(!customElements.get('carrot-journal-panel'))customElements.define('carrot-journal-panel',CarrotJournalPanel);
