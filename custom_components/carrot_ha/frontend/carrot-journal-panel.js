// HA sidebar entry: uses the same authenticated local card as Lovelace.
const cardURL=new URL('./carrot-vehicle-journal.js',import.meta.url);
cardURL.search=new URL(import.meta.url).search;
await import(cardURL.href);
class CarrotJournalPanel extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.innerHTML='<style>:host{display:block;min-height:100%;background:#0b1014;color:#f1f6fa;font-family:system-ui}header{display:flex;align-items:center;gap:16px;padding:12px 24px;border-bottom:1px solid #2a3945}button{font:inherit;color:inherit;background:#202c36;border:1px solid #2a3945;border-radius:10px;min-width:44px;min-height:44px;cursor:pointer}button:focus-visible{outline:3px solid #7bb6ff;outline-offset:2px}main{max-width:1320px;margin:auto;padding:16px 12px}</style><header><button type="button" aria-label="HA 메뉴 열기">☰</button><span>차계부</span></header><main><carrot-vehicle-journal></carrot-vehicle-journal></main>';this.card=this.shadowRoot.querySelector('carrot-vehicle-journal');this.card.setConfig({});this.shadowRoot.querySelector('button').onclick=()=>this.dispatchEvent(new CustomEvent('hass-toggle-menu',{bubbles:true,composed:true}));}
  set hass(hass){this.card.hass=hass;}
  set panel(panel){this._panel=panel;}
  set narrow(narrow){this._narrow=narrow;}
}
if(!customElements.get('carrot-journal-panel'))customElements.define('carrot-journal-panel',CarrotJournalPanel);
