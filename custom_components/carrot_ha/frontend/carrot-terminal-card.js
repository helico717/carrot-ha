const CARROT_TERMINAL_ASSET = '/carrot_ha_static/carrot_web/js/vendor/xterm.js';
const CARROT_TERMINAL_CSS = '/carrot_ha_static/carrot_web/css/vendor/xterm.css';

let carrotTerminalAssets;
function loadCarrotTerminalAssets() {
  if (carrotTerminalAssets) return carrotTerminalAssets;
  carrotTerminalAssets = new Promise((resolve, reject) => {
    if (window.Terminal) return resolve();
    if (!document.querySelector(`link[href="${CARROT_TERMINAL_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CARROT_TERMINAL_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = CARROT_TERMINAL_ASSET;
    script.onload = resolve;
    script.onerror = () => reject(new Error('xterm.js를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });
  return carrotTerminalAssets;
}

class CarrotTerminalCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this._hass = null;
    this._config = null;
    this._unsubscribe = null;
    this._terminal = null;
    this._terminalData = null;
    this._status = {};
    this._active = false;
    this._queue = '';
    this._flushTimer = null;
    this._sending = false;
    this._decoder = new TextDecoder('utf-8');
  }

  static getStubConfig() { return {device_id: ''}; }

  setConfig(config) {
    if (!config || typeof config.device_id !== 'string' || !config.device_id.trim()) {
      throw new Error('device_id가 필요합니다.');
    }
    const changed = this._config?.device_id !== config.device_id;
    this._config = {...config, device_id: config.device_id.trim()};
    this._render();
    if (changed) this._resubscribe();
  }

  set hass(value) {
    const first = !this._hass && value;
    this._hass = value;
    if (first) this._resubscribe();
  }

  connectedCallback() {
    this._render();
    this._resubscribe();
  }

  disconnectedCallback() {
    this._release();
    this._unsubscribe?.();
    this._unsubscribe = null;
    this._terminalData?.dispose?.();
    this._terminalData = null;
    this._terminal?.dispose?.();
    this._terminal = null;
    if (this._flushTimer) clearTimeout(this._flushTimer);
  }

  async _resubscribe() {
    if (!this.isConnected || !this._hass || !this._config?.device_id) return;
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    try {
      this._unsubscribe = await this._hass.connection.subscribeMessage(
        event => this._event(event),
        {type: 'carrot_ha/terminal/subscribe', device_id: this._config.device_id},
      );
    } catch (error) {
      this._setMessage(error.message || '터미널 상태 구독 실패', true);
    }
  }

  async _ensureTerminal() {
    await loadCarrotTerminalAssets();
    if (this._terminal) return this._terminal;
    const host = this.shadowRoot.getElementById('terminal');
    if (!host) throw new Error('터미널 화면을 찾을 수 없습니다.');
    this._terminal = new window.Terminal({
      cols: 100,
      rows: 30,
      cursorBlink: true,
      convertEol: false,
      scrollback: 5000,
      fontSize: 13,
      lineHeight: 1.25,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      theme: {background: '#0b0f14', foreground: '#e6e9ef', cursor: '#7ee0a0'},
    });
    this._terminal.open(host);
    this._terminalData = this._terminal.onData(data => this._enqueue(data));
    return this._terminal;
  }

  async _connect() {
    if (!this._hass || this._active) return;
    try {
      const terminal = await this._ensureTerminal();
      terminal.focus();
      this._setMessage('연결 요청 중…');
      await this._hass.connection.sendMessagePromise({
        type: 'carrot_ha/terminal/acquire',
        device_id: this._config.device_id,
      });
      this._active = true;
      this._setMessage('연결됨');
      this._renderState();
    } catch (error) {
      this._active = false;
      this._setMessage(error.message || '터미널 연결 실패', true);
      this._renderState();
    }
  }

  async _release() {
    if (!this._hass || !this._config?.device_id || !this._active) return;
    this._active = false;
    this._renderState();
    try {
      await this._hass.connection.sendMessagePromise({
        type: 'carrot_ha/terminal/release',
        device_id: this._config.device_id,
      });
    } catch (_) {}
  }

  _enqueue(data) {
    if (!this._active || !data) return;
    this._queue += data;
    if (this._queue.length >= 1024) {
      this._flush();
    } else if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => this._flush(), 20);
    }
  }

  async _flush() {
    if (this._flushTimer) clearTimeout(this._flushTimer);
    this._flushTimer = null;
    if (this._sending || !this._queue || !this._active) return;
    const data = this._queue.slice(0, 1024);
    this._queue = this._queue.slice(1024);
    this._sending = true;
    try {
      await this._hass.connection.sendMessagePromise({
        type: 'carrot_ha/terminal/input',
        device_id: this._config.device_id,
        message: {type: 'raw', data},
      });
    } catch (error) {
      this._setMessage(error.message || '입력이 거부되었습니다.', true);
    } finally {
      this._sending = false;
      if (this._queue) this._flush();
    }
  }

  async _control(action) {
    if (!this._active) return;
    await this._flush();
    try {
      await this._hass.connection.sendMessagePromise({
        type: 'carrot_ha/terminal/input',
        device_id: this._config.device_id,
        message: {type: 'control', action},
      });
      this._terminal?.focus();
    } catch (error) {
      this._setMessage(error.message || '제어 입력이 거부되었습니다.', true);
    }
  }

  async _event(event) {
    if (!event || typeof event !== 'object') return;
    if (event.type === 'status') {
      this._status = event;
      if ((!event.ready || !event.active) && this._active) this._active = false;
      this._renderState();
      return;
    }
    if (event.type === 'ended') {
      this._active = false;
      this._setMessage(`종료됨: ${event.reason || 'session ended'}`, true);
      this._renderState();
      return;
    }
    if (event.type === 'started') {
      this._active = true;
      this._setMessage('연결됨');
      this._renderState();
      return;
    }
    if (event.type !== 'terminal' || !event.message) return;
    const message = event.message;
    const terminal = await this._ensureTerminal();
    if (message.type === 'pty_output' && typeof message.b64 === 'string') {
      const raw = atob(message.b64);
      const bytes = Uint8Array.from(raw, character => character.charCodeAt(0));
      terminal.write(bytes);
    } else if (message.type === 'pty_exit') {
      this._setMessage(`셸 종료 (${message.exit_code ?? '?'})`, true);
    } else if (message.type === 'error') {
      this._setMessage(message.error || message.message || '터미널 오류', true);
    }
  }

  _setMessage(text, error = false) {
    const node = this.shadowRoot?.getElementById('message');
    if (node) {
      node.textContent = text;
      node.classList.toggle('error', error);
    }
  }

  _renderState() {
    const connect = this.shadowRoot?.getElementById('connect');
    const disconnect = this.shadowRoot?.getElementById('disconnect');
    const badge = this.shadowRoot?.getElementById('badge');
    if (connect) connect.disabled = this._active || !this._status.ready || (this._status.controller && !this._active);
    if (disconnect) disconnect.disabled = !this._active;
    if (badge) {
      badge.textContent = this._active ? '터미널 연결됨' : this._status.controller ? '다른 관리자 사용 중' : this._status.ready ? '주차 · 준비됨' :
        this._status.connected ? '사용 불가' : 'Comma 오프라인';
      badge.className = this._active || this._status.ready ? 'ready' : '';
    }
  }

  _render() {
    if (!this.shadowRoot || this.shadowRoot.childElementCount) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}ha-card{overflow:hidden}header{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--divider-color)}
        h2{margin:0;flex:1;font-size:16px}#badge{font-size:11px;padding:4px 8px;border-radius:999px;background:var(--secondary-background-color);color:var(--secondary-text-color)}
        #badge.ready{background:color-mix(in srgb,var(--success-color,#43a047) 18%,transparent);color:var(--success-color,#43a047)}
        .actions,.keys{display:flex;gap:7px;overflow:auto}.actions button,.keys button{border:1px solid var(--divider-color);border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color);padding:7px 11px;white-space:nowrap}
        button:disabled{opacity:.45}.shell{background:#0b0f14;padding:8px;overflow:auto}#terminal{width:max(100%,820px);height:430px}.keys{padding:9px 12px;background:var(--secondary-background-color)}
        #message{padding:8px 14px;font-size:12px;color:var(--secondary-text-color);border-top:1px solid var(--divider-color)}#message.error{color:var(--error-color,#db4437)}
        @media(max-width:600px){header{align-items:flex-start;flex-wrap:wrap}.actions{width:100%}#terminal{height:55vh}}
      </style>
      <ha-card>
        <header><h2>${this._config?.title || 'Comma 원격 터미널'}</h2><span id="badge">상태 확인 중</span>
          <div class="actions"><button id="connect">연결</button><button id="disconnect" disabled>연결 해제</button></div>
        </header>
        <div class="shell"><div id="terminal"></div></div>
        <div class="keys"><button data-action="ctrl_c">Ctrl+C</button><button data-action="clear">Clear</button><button data-key="tab">Tab</button><button data-key="up">↑</button><button data-key="down">↓</button><button data-key="left">←</button><button data-key="right">→</button></div>
        <div id="message">관리자만 연결할 수 있습니다.</div>
      </ha-card>`;
    this.shadowRoot.getElementById('connect').onclick = () => this._connect();
    this.shadowRoot.getElementById('disconnect').onclick = () => this._release();
    this.shadowRoot.querySelectorAll('[data-action]').forEach(button => button.onclick = () => this._control(button.dataset.action));
    const keys = {tab: '\t', up: '\u001b[A', down: '\u001b[B', left: '\u001b[D', right: '\u001b[C'};
    this.shadowRoot.querySelectorAll('[data-key]').forEach(button => button.onclick = () => {
      this._enqueue(keys[button.dataset.key]);
      this._terminal?.focus();
    });
    this._renderState();
  }

  getCardSize() { return 7; }
}

customElements.define('carrot-terminal-card', CarrotTerminalCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'carrot-terminal-card',
  name: 'Carrot Remote Terminal',
  description: '주차 상태의 Comma 당근웹 PTY에 연결합니다.',
});
