const CARROT_TERMINAL_ASSET = '/carrot_ha_static/carrot_web/js/vendor/xterm.js';
const CARROT_TERMINAL_FIT_ASSET = '/carrot_ha_static/carrot_web/js/vendor/xterm-addon-fit.js';
const CARROT_TERMINAL_CSS = '/carrot_ha_static/carrot_web/css/vendor/xterm.css';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`${src}를 불러오지 못했습니다.`));
    document.head.appendChild(script);
  });
}

let carrotTerminalAssets;
function loadCarrotTerminalAssets() {
  if (carrotTerminalAssets) return carrotTerminalAssets;
  carrotTerminalAssets = (async () => {
    if (!window.Terminal) await loadScript(CARROT_TERMINAL_ASSET);
    if (!window.FitAddon) {
      try { await loadScript(CARROT_TERMINAL_FIT_ASSET); } catch (_) {}
    }
  })();
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
    this._fitAddon = null;
    this._status = {};
    this._active = false;
    this._queue = '';
    this._flushTimer = null;
    this._sending = false;
    this._ctrlActive = false;
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
    this._fitAddon?.dispose?.();
    this._fitAddon = null;
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
      cursorStyle: 'block',
      convertEol: false,
      scrollback: 5000,
      fontSize: 13,
      lineHeight: 1.25,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
      theme: {
        background: '#000000',
        foreground: '#e6e9ef',
        cursor: '#7ee0a0',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(126, 224, 160, 0.3)',
      },
    });
    if (window.FitAddon?.FitAddon) {
      this._fitAddon = new window.FitAddon.FitAddon();
      this._terminal.loadAddon(this._fitAddon);
    }
    this._terminal.open(host);
    if (this._fitAddon) {
      try { this._fitAddon.fit(); } catch (_) {}
    }
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
      if (this._fitAddon) {
        setTimeout(() => { try { this._fitAddon.fit(); } catch (_) {} }, 50);
      }
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
    if (this._ctrlActive && typeof data === 'string' && data.length === 1) {
      const code = data.toUpperCase().charCodeAt(0);
      if (code >= 64 && code <= 95) {
        data = String.fromCharCode(code - 64);
      }
      this._ctrlActive = false;
      const ctrlBtn = this.shadowRoot?.getElementById('ctrl-toggle');
      if (ctrlBtn) ctrlBtn.classList.remove('active');
    }
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
      <link rel="stylesheet" href="${CARROT_TERMINAL_CSS}">
      <style>
        :host { display: block; }
        ha-card { overflow: hidden; background: var(--card-background-color, #1c1c1e); border-radius: 12px; }
        header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12)); }
        h2 { margin: 0; flex: 1; font-size: 15px; font-weight: 600; color: var(--primary-text-color); }
        #badge { font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 999px; background: var(--secondary-background-color, rgba(255,255,255,0.08)); color: var(--secondary-text-color); }
        #badge.ready { background: color-mix(in srgb, var(--success-color, #43a047) 18%, transparent); color: var(--success-color, #43a047); }
        .actions { display: inline-flex; gap: 6px; }
        .actions button, .keys button { border: 1px solid var(--divider-color, rgba(255,255,255,0.14)); border-radius: 7px; background: var(--secondary-background-color, #2c2c2e); color: var(--primary-text-color, #fff); padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.15s ease; }
        .actions button:hover, .keys button:hover { background: color-mix(in srgb, var(--primary-text-color, #fff) 15%, transparent); }
        button:disabled { opacity: 0.35; cursor: not-allowed; }
        .keys button.active { background: var(--primary-color, #03a9f4) !important; color: #fff !important; border-color: var(--primary-color, #03a9f4) !important; }
        
        /* Terminal Shell */
        .shell { background: #000; padding: 10px; overflow: auto; box-sizing: border-box; }
        #terminal { width: 100%; min-width: 600px; height: 420px; box-sizing: border-box; }
        
        /* Mobile Keys Bar */
        .keys { display: flex; gap: 6px; padding: 8px 12px; background: var(--secondary-background-color, #18181a); overflow-x: auto; -webkit-overflow-scrolling: touch; border-top: 1px solid var(--divider-color, rgba(255,255,255,0.08)); }
        .keys::-webkit-scrollbar { height: 4px; }
        .keys::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        
        #message { padding: 8px 16px; font-size: 11px; color: var(--secondary-text-color); border-top: 1px solid var(--divider-color, rgba(255,255,255,0.08)); background: var(--card-background-color); }
        #message.error { color: var(--error-color, #f44336); }

        /* Synchronous Shadow DOM xterm fallback styles */
        .xterm { cursor: text; position: relative; user-select: none; -webkit-user-select: none; }
        .xterm.focus, .xterm:focus { outline: none; }
        .xterm .xterm-helpers { position: absolute; top: 0; z-index: 5; }
        .xterm .xterm-helper-textarea {
          padding: 0; border: 0; margin: 0;
          position: absolute; opacity: 0; left: -9999em; top: 0;
          width: 0; height: 0; z-index: -5;
          white-space: nowrap; overflow: hidden; resize: none;
        }
        .xterm .xterm-viewport { background-color: #000; overflow-y: scroll; cursor: default; position: absolute; right: 0; left: 0; top: 0; bottom: 0; }
        .xterm .xterm-screen { position: relative; }
        .xterm .xterm-screen canvas { position: absolute; left: 0; top: 0; }
        .xterm-char-measure-element { display: inline-block; visibility: hidden; position: absolute; top: 0; left: -9999em; line-height: normal; }

        @media (max-width: 600px) {
          header { flex-wrap: wrap; }
          #terminal { height: 50vh; }
        }
      </style>
      <ha-card>
        <header>
          <h2>${this._config?.title || 'Comma 원격 터미널'}</h2>
          <span id="badge">상태 확인 중</span>
          <div class="actions">
            <button id="connect">연결</button>
            <button id="disconnect" disabled>연결 해제</button>
          </div>
        </header>
        <div class="shell"><div id="terminal"></div></div>
        <div class="keys">
          <button data-key="esc">Esc</button>
          <button id="ctrl-toggle" class="key-toggle">Ctrl</button>
          <button data-action="ctrl_c">Ctrl+C</button>
          <button data-key="ctrl_d">Ctrl+D</button>
          <button data-action="clear">Clear</button>
          <button data-key="detach">Detach</button>
          <button data-key="tab">Tab</button>
          <button data-key="home">Home</button>
          <button data-key="end">End</button>
          <button data-key="pgup">PgUp</button>
          <button data-key="pgdn">PgDn</button>
          <button data-key="up">↑</button>
          <button data-key="down">↓</button>
          <button data-key="left">←</button>
          <button data-key="right">→</button>
        </div>
        <div id="message">관리자만 연결할 수 있습니다.</div>
      </ha-card>`;

    this.shadowRoot.getElementById('connect').onclick = () => this._connect();
    this.shadowRoot.getElementById('disconnect').onclick = () => this._release();
    this.shadowRoot.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = () => this._control(btn.dataset.action);
    });

    const ctrlBtn = this.shadowRoot.getElementById('ctrl-toggle');
    if (ctrlBtn) {
      ctrlBtn.onclick = () => {
        this._ctrlActive = !this._ctrlActive;
        ctrlBtn.classList.toggle('active', this._ctrlActive);
        this._terminal?.focus();
      };
    }

    const keys = {
      esc: '\u001b',
      ctrl_d: '\u0004',
      detach: '\u0060d',
      tab: '\t',
      home: '\u001b[H',
      end: '\u001b[F',
      pgup: '\u001b[5~',
      pgdn: '\u001b[6~',
      up: '\u001b[A',
      down: '\u001b[B',
      left: '\u001b[D',
      right: '\u001b[C',
    };
    this.shadowRoot.querySelectorAll('[data-key]').forEach(btn => {
      btn.onclick = () => {
        const char = keys[btn.dataset.key];
        if (char) this._enqueue(char);
        this._terminal?.focus();
      };
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
