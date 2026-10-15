/** Original Carrot Web logs, backed by HA's bounded local segment archive. */
import {logsSettingsStyles, logsSettingsMarkup, bindLogSettings} from './carrot-logs-settings.js';
class CarrotLogsCard extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode:'open'}); this._config = {};
    this._onMessage = event => {
      const frame = this.shadowRoot.querySelector('iframe');
      if (event.origin === location.origin && event.source === frame?.contentWindow && event.data?.type === 'carrot:logs_ready') {
        this._ready = true; this._send();
      }
      if(event.origin!==location.origin || event.source!==frame?.contentWindow || event.data?.base!==this._session?.base)return;
      if(event.data.type==='carrot:logs_storage')this._updateStorage?.(event.data.storage,event.data.maintenance);
      if(event.data.type==='carrot:logs_storage_error')this._storageError?.(event.data.message);
      if(event.data.type==='carrot:logs_notice')this.shadowRoot.getElementById('error').textContent=event.data.message;
    };
    this._visible = () => { if (!document.hidden) this._connect(); };
  }
  static getStubConfig() { return {device_id:''}; }
  setConfig(config) {
    const changed = this._config.device_id !== config?.device_id;
    this._config = config || {};
    if (changed) {
      this._closeLogSettings?.(); this._storage=null; this._maintenance=null;
      this._resetLogSettings?.();
      const summary=this.shadowRoot.getElementById('storageSummary');if(summary)summary.textContent='';
      this._session = null; this._generation = (this._generation || 0) + 1; this._ready = false;
      const frame = this.shadowRoot.querySelector('iframe');
      if (frame) frame.src = '/carrot_ha_static/carrot_logs/logs.html';
    }
    this._render();
    if (this._hass) this._connect();
  }
  set hass(value) { const first = !this._hass; this._hass = value; if (first && this.isConnected) this._connect(); }
  connectedCallback() {
    window.addEventListener('message', this._onMessage);
    document.addEventListener('visibilitychange', this._visible);
    this._render(); this._connect();
    this._renew = setInterval(() => { if (!document.hidden) this._connect(); }, 45 * 60 * 1000);
  }
  disconnectedCallback() {
    this._closeLogSettings?.();
    window.removeEventListener('message', this._onMessage);
    document.removeEventListener('visibilitychange', this._visible);
    clearInterval(this._renew);
    this._generation = (this._generation || 0) + 1;
    this._session = null;
  }
  getCardSize() { return 12; }
  getGridOptions() { return {columns:36,rows:'auto',min_columns:6}; }
  _render() {
    if (this.shadowRoot.querySelector('iframe')) return;
    this.shadowRoot.innerHTML = `<style>:host{display:block;width:100%;min-width:0;max-width:100%}ha-card{display:block;width:100%;min-width:0;overflow:hidden;box-sizing:border-box}#error{color:var(--error-color);padding:0 16px}iframe{display:block;width:100%;height:calc(100dvh - 120px);min-height:360px;border:0}${logsSettingsStyles}</style><ha-card><div class="header"><div class="header-copy"><span class="header-title">당근웹 로그</span><span id="storageSummary" class="storage-summary" role="status"></span></div><button id="logSettingsButton" class="icon-button" type="button" title="주행 로그 설정" aria-label="주행 로그 설정"><ha-icon icon="mdi:cog-outline"></ha-icon></button></div><div id="error" role="status"></div><iframe title="당근웹 로그" src="/carrot_ha_static/carrot_logs/logs.html" sandbox="allow-scripts allow-same-origin allow-downloads allow-popups" allow="fullscreen"></iframe>${logsSettingsMarkup}</ha-card>`;
    bindLogSettings(this);
  }
  _send() {
    if (this._ready && this._session) this.shadowRoot.querySelector('iframe').contentWindow.postMessage(
      {type:'carrot:logs_session', ...this._session, language:this._hass?.locale?.language}, location.origin);
  }
  async _connect() {
    if (!this._hass || !this.isConnected || this._loading) return;
    if (this._session && Date.now() < this._expires) { this._send(); return; }
    this._loading = true;
    const generation = this._generation || 0;
    try {
      const result = await this._hass.callApi('GET','carrot_ha/v1/devices');
      const device = result.devices.find(item => this._config.device_id ? item.device_id === this._config.device_id : true);
      if (!device) throw new Error('Carrot HA 차량을 찾을 수 없습니다.');
      const session = await this._hass.callApi('POST',`carrot_ha/v1/driving_logs/${device.entry_id}/session`,{});
      if (generation !== (this._generation || 0) || !this.isConnected) return;
      this._session = session; this._expires = Date.now() + 50 * 60 * 1000;
      this.shadowRoot.getElementById('error').textContent = ''; this._send();
    } catch (error) {
      if (generation === (this._generation || 0)) this.shadowRoot.getElementById('error').textContent = error.message;
    } finally {
      this._loading = false;
      if (generation !== (this._generation || 0) && this.isConnected) this._connect();
    }
  }
}

if (!customElements.get('carrot-logs-card')) customElements.define('carrot-logs-card', class extends CarrotLogsCard {});
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'carrot-logs-card')) window.customCards.push({type:'carrot-logs-card', name:'Carrot HA — 당근웹 로그', description:'HA에 보관된 최신 주행 로그와 영상 조회'});
export default CarrotLogsCard;
