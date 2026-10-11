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
    this._resizeObserver = null;
    this._status = {};
    this._active = false;
    this._queue = '';
    this._flushTimer = null;
    this._sending = false;
    this._ctrlActive = false;
    this._decoder = new TextDecoder('utf-8');
    this._promptTimer = null;
    this._hasOutputThisSession = false;
    this._gitStatus = {};
    this._gitTimer = null;
    this._gitRequest = 0;
    this._gitVisibility = () => {
      clearTimeout(this._gitTimer);
      if (!document.hidden) this._refreshGitStatus();
    };
  }

  static getStubConfig() { return {device_id: 'test-id4'}; }

  setConfig(config) {
    if (!config || typeof config.device_id !== 'string' || !config.device_id.trim()) {
      throw new Error('device_id가 필요합니다.');
    }
    const changed = this._config?.device_id !== config.device_id;
    if (changed) {
      this._gitStatus = {};
      this._gitRequest++;
    }
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
    document.addEventListener('visibilitychange', this._gitVisibility);
  }

  disconnectedCallback() {
    document.removeEventListener('visibilitychange', this._gitVisibility);
    clearTimeout(this._gitTimer);
    this._gitRequest++;
    this._release();
    this._unsubscribe?.();
    this._unsubscribe = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._terminalData?.dispose?.();
    this._terminalData = null;
    this._fitAddon?.dispose?.();
    this._fitAddon = null;
    this._terminal?.dispose?.();
    this._terminal = null;
    if (this._flushTimer) clearTimeout(this._flushTimer);
    if (this._promptTimer) clearTimeout(this._promptTimer);
  }

  async _resubscribe() {
    if (!this.isConnected || !this._hass || !this._config?.device_id) return;
    this._refreshGitStatus();
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

  async _refreshGitStatus() {
    clearTimeout(this._gitTimer);
    if (!this.isConnected || !this._hass || !this._config?.device_id || document.hidden) return;
    const request = ++this._gitRequest;
    try {
      const result = await this._hass.callWS({type: 'carrot_ha/terminal/git_status', device_id: this._config.device_id});
      if (request !== this._gitRequest || !this.isConnected) return;
      this._gitStatus = result;
    } catch (_) {
      if (request !== this._gitRequest || !this.isConnected) return;
      this._gitStatus = {...this._gitStatus, error: 'ha_unavailable'};
    }
    this._paintGitStatus();
    this._gitTimer = setTimeout(() => this._refreshGitStatus(), 30000);
  }

  _paintGitStatus() {
    const status = this.shadowRoot.getElementById('git-status');
    const message = this.shadowRoot.getElementById('git-message');
    const details = this.shadowRoot.getElementById('git-info');
    if (!status || !message || !details) return;
    const git = this._gitStatus;
    const sha = git.installed_commit?.slice(0, 8);
    let comparison = !sha ? '설치 커밋 미확인' : git.comparison === 'identical' ? '최신 커밋과 동일' :
      git.comparison === 'diverged' ? `분기됨 · 최신 쪽 ${git.behind}개 / 기기 쪽 ${git.ahead}개` :
      git.ahead > 0 ? `기기 쪽 ${git.ahead}개 추가 커밋` : Number.isInteger(git.behind) ? `${git.behind}개 커밋 뒤처짐` : '차이 확인 불가';
    status.textContent = `${sha || '—'} · ${comparison}${git.error ? ' · 조회 오류' : ''}`;
    message.textContent = git.latest_message ? `최신 ${git.latest_commit.slice(0, 8)}: ${git.latest_message.split('\n')[0]}` : '최신 커밋 확인 중 또는 조회 불가';
    message.title = git.latest_message || '';
    const format = value => {
      const date = new Date(value);
      return value && Number.isFinite(date.getTime()) ? date.toLocaleString() : '미확인';
    };
    details.title = `${git.branch || ''} · 기기 마지막 보고 ${format(git.installed_measured_at)} · GitHub 확인 ${format(git.checked_at)}${git.cached ? ' (저장된 결과)' : ''}`;
    status.textContent += ' · 마지막 기기 보고 기준';
  }

  _fit() {
    if (this._fitAddon && this._terminal && this.isConnected) {
      try {
        this._fitAddon.fit();
      } catch (_) {}
    }
  }

  async _ensureTerminal() {
    await loadCarrotTerminalAssets();
    if (this._terminal) return this._terminal;
    const host = this.shadowRoot.getElementById('terminal');
    if (!host) throw new Error('터미널 화면을 찾을 수 없습니다.');
    this._terminal = new window.Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: false,
      scrollback: 10000,
      fontSize: 14,
      lineHeight: 1.28,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#000000',
        foreground: '#f0f3f6',
        cursor: '#7ee0a0',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(126, 224, 160, 0.35)',
      },
    });

    if (window.FitAddon?.FitAddon) {
      this._fitAddon = new window.FitAddon.FitAddon();
      this._terminal.loadAddon(this._fitAddon);
    }

    this._terminal.open(host);

    if (this._fitAddon) {
      setTimeout(() => this._fit(), 50);
      if (window.ResizeObserver) {
        this._resizeObserver = new ResizeObserver(() => {
          requestAnimationFrame(() => this._fit());
        });
        this._resizeObserver.observe(host);
      }
    }

    this._terminalData = this._terminal.onData(data => this._enqueue(data));
    return this._terminal;
  }

  _schedulePromptFallback() {
    if (this._promptTimer) clearTimeout(this._promptTimer);
    // If output is not received within 400ms (e.g. re-attached to an idle, existing shell session
    // where historical output was suppressed), send a single newline to reveal the prompt.
    this._promptTimer = setTimeout(() => {
      this._promptTimer = null;
      if (this._active && !this._hasOutputThisSession) {
        this._enqueue('\r');
      }
    }, 400);
  }

  async _connect() {
    if (!this._hass || this._active) return;
    try {
      const terminal = await this._ensureTerminal();
      terminal.focus();
      this._setMessage('연결 요청 중…');
      this._hasOutputThisSession = false;
      await this._hass.connection.sendMessagePromise({
        type: 'carrot_ha/terminal/acquire',
        device_id: this._config.device_id,
      });
      this._active = true;
      this._setMessage('연결됨');
      this._renderState();
      this._fit();
      this._schedulePromptFallback();
    } catch (error) {
      this._active = false;
      if (this._promptTimer) clearTimeout(this._promptTimer);
      this._promptTimer = null;
      this._setMessage(error.message || '터미널 연결 실패', true);
      this._renderState();
    }
  }

  async _release() {
    if (!this._hass || !this._config?.device_id || !this._active) return;
    if (this._promptTimer) clearTimeout(this._promptTimer);
    this._promptTimer = null;
    this._hasOutputThisSession = false;
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
    if (action === 'clear') {
      this._enqueue('clear\r');
      this._terminal?.focus();
      return;
    }
    if (action === 'ctrl_c') {
      this._enqueue('\u0003');
      this._terminal?.focus();
      return;
    }
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
      if (this._promptTimer) clearTimeout(this._promptTimer);
      this._promptTimer = null;
      this._hasOutputThisSession = false;
      this._active = false;
      this._setMessage(`종료됨: ${event.reason || 'session ended'}`, true);
      this._renderState();
      return;
    }
    if (event.type === 'started') {
      this._active = true;
      this._setMessage('연결됨');
      this._renderState();
      this._fit();
      if (!this._hasOutputThisSession) {
        this._schedulePromptFallback();
      }
      return;
    }
    if (event.type !== 'terminal' || !event.message) return;
    const message = event.message;
    const terminal = await this._ensureTerminal();
    if (message.type === 'pty_output' && typeof message.b64 === 'string') {
      this._hasOutputThisSession = true;
      if (this._promptTimer) {
        clearTimeout(this._promptTimer);
        this._promptTimer = null;
      }
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
    this.shadowRoot?.querySelectorAll('.workflows button, .keys button').forEach(btn => {
      btn.disabled = !this._active;
    });
  }

  _render() {
    if (!this.shadowRoot || this.shadowRoot.childElementCount) return;
    const customHeight = this._config?.height || 'clamp(520px, 68vh, 850px)';

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="${CARROT_TERMINAL_CSS}">
      <style>
        :host { display: block; width: 100%; }
        ha-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--card-background-color, #101216);
          border-radius: 12px;
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
        }
        header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          background: var(--card-background-color, #14171d);
          border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.08));
        }
        #git-info { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 10px 22px;
          border-bottom: 1px solid var(--divider-color, rgba(255,255,255,.08)); font-size: 12px; }
        #git-status { color: var(--primary-text-color); }
        #git-message { color: var(--secondary-text-color); overflow-wrap: anywhere; }
        h2 { margin: 0; flex: 1; font-size: 15px; font-weight: 700; color: var(--primary-text-color, #fff); }
        #badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--secondary-background-color, rgba(255, 255, 255, 0.08));
          color: var(--secondary-text-color, #9e9e9e);
        }
        #badge.ready {
          background: color-mix(in srgb, var(--success-color, #43a047) 20%, transparent);
          color: var(--success-color, #43a047);
        }
        .actions { display: inline-flex; gap: 8px; }
        .actions button {
          border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
          border-radius: 8px;
          background: color-mix(in srgb, var(--primary-text-color, #fff) 6%, var(--card-background-color, #242730));
          color: var(--primary-text-color, #fff);
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .actions button:hover:not(:disabled) {
          background: color-mix(in srgb, var(--primary-text-color, #fff) 14%, var(--card-background-color, #242730));
        }
        .actions button:disabled, .workflows button:disabled, .keys button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* Terminal Shell Viewport */
        .shell {
          flex: 1 1 auto;
          background: #000;
          padding: 12px 16px;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
          height: ${customHeight};
          min-height: 480px;
        }
        #terminal {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
        }
        .xterm {
          height: 100%;
        }

        /* Workflows Quick Toolbar */
        .workflows {
          display: flex;
          gap: 8px;
          padding: 10px 14px;
          background: var(--card-background-color, #13151b);
          border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.15));
          overflow-x: auto;
          align-items: center;
          -webkit-overflow-scrolling: touch;
        }
        .workflow-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
          border-radius: 8px;
          background: color-mix(in srgb, var(--primary-text-color, #fff) 6%, var(--card-background-color, #20232c));
          color: var(--primary-text-color, #fff);
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .workflow-btn:hover:not(:disabled) {
          background: color-mix(in srgb, var(--primary-text-color, #fff) 14%, var(--card-background-color, #20232c));
        }
        .workflow-btn.primary {
          border-color: color-mix(in srgb, var(--primary-color, #03a9f4) 60%, transparent);
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 15%, transparent);
          color: var(--primary-color, #03a9f4);
        }
        .workflow-btn.primary:hover:not(:disabled) {
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 25%, transparent);
        }
        .workflow-btn.danger {
          border-color: color-mix(in srgb, var(--error-color, #f44336) 50%, transparent);
          background: color-mix(in srgb, var(--error-color, #f44336) 15%, transparent);
          color: var(--error-color, #e53935);
        }
        .workflow-btn.danger:hover:not(:disabled) {
          background: color-mix(in srgb, var(--error-color, #f44336) 25%, transparent);
        }

        /* Mobile / Navigation Keys Bar */
        .keys {
          display: flex;
          gap: 6px;
          padding: 8px 14px;
          background: var(--secondary-background-color, #0d0f13);
          border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.12));
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .keys button {
          border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.22));
          border-radius: 7px;
          background: color-mix(in srgb, var(--primary-text-color, #fff) 8%, var(--card-background-color, #1c1f26));
          color: var(--primary-text-color, #e0e0e0);
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .keys button:hover:not(:disabled) {
          background: color-mix(in srgb, var(--primary-text-color, #fff) 16%, var(--card-background-color, #1c1f26));
        }
        .keys button.active {
          background: var(--primary-color, #03a9f4) !important;
          color: #ffffff !important;
          border-color: var(--primary-color, #03a9f4) !important;
        }

        #message {
          padding: 8px 16px;
          font-size: 11px;
          color: var(--secondary-text-color, #888);
          border-top: 1px solid var(--divider-color, rgba(255, 255, 255, 0.08));
          background: var(--card-background-color, #101216);
        }
        #message.error { color: var(--error-color, #f44336); }

        /* Synchronous Shadow DOM xterm styles */
        .xterm { cursor: text; position: relative; user-select: none; -webkit-user-select: none; }
        .xterm.focus, .xterm:focus { outline: none; }
        .xterm .xterm-helpers { position: absolute; top: 0; z-index: 5; }
        .xterm .xterm-helper-textarea {
          padding: 0; border: 0; margin: 0;
          position: absolute; opacity: 0; left: -9999em; top: 0;
          width: 0; height: 0; z-index: -5;
          white-space: nowrap; overflow: hidden; resize: none;
        }
        .xterm .xterm-viewport { background-color: #000; overflow-y: auto !important; cursor: default; position: absolute; right: 0; left: 0; top: 0; bottom: 0; }
        .xterm .xterm-screen { position: relative; }
        .xterm .xterm-screen canvas { position: absolute; left: 0; top: 0; }
        .xterm-char-measure-element { display: inline-block; visibility: hidden; position: absolute; top: 0; left: -9999em; line-height: normal; }

        @media (max-width: 600px) {
          header { flex-wrap: wrap; }
          .shell { height: 55vh; min-height: 380px; }
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
        
        <!-- Workflow Quick Actions -->
        <div class="workflows">
          <button id="btn-check" class="workflow-btn" disabled>
            🔍 업데이트 확인
          </button>
          <button id="btn-pull" class="workflow-btn primary" disabled>
            📥 당근 Git Pull
          </button>
          <button id="btn-reboot" class="workflow-btn danger" disabled>
            🔄 기기 재부팅
          </button>
        </div>

        <div id="git-info" role="status" aria-live="polite">
          <span id="git-status">커밋 확인 중</span><span id="git-message"></span>
        </div>

        <!-- Navigation & Helper Keys -->
        <div class="keys">
          <button data-key="esc" disabled>Esc</button>
          <button id="ctrl-toggle" class="key-toggle" disabled>Ctrl</button>
          <button data-action="ctrl_c" disabled>Ctrl+C</button>
          <button data-key="ctrl_d" disabled>Ctrl+D</button>
          <button data-action="clear" disabled>Clear</button>
          <button data-key="detach" disabled>Detach</button>
          <button data-key="tab" disabled>Tab</button>
          <button data-key="home" disabled>Home</button>
          <button data-key="end" disabled>End</button>
          <button data-key="pgup" disabled>PgUp</button>
          <button data-key="pgdn" disabled>PgDn</button>
          <button data-key="up" disabled>↑</button>
          <button data-key="down" disabled>↓</button>
          <button data-key="left" disabled>←</button>
          <button data-key="right" disabled>→</button>
        </div>
        <div id="message">관리자만 연결할 수 있습니다.</div>
      </ha-card>`;

    this.shadowRoot.getElementById('connect').onclick = () => this._connect();
    this.shadowRoot.getElementById('disconnect').onclick = () => this._release();

    // Workflows: Check, Pull, Reboot
    this.shadowRoot.getElementById('btn-check').onclick = () => {
      if (!this._active) return;
      this._enqueue('cd /data/openpilot && git fetch origin && git status -sb && git log --oneline -n 5 HEAD..@{u}\r');
      this._terminal?.focus();
    };

    this.shadowRoot.getElementById('btn-pull').onclick = () => {
      if (!this._active) return;
      this._enqueue('cd /data/openpilot && git reset --hard && git pull --ff-only\r');
      this._terminal?.focus();
    };

    this.shadowRoot.getElementById('btn-reboot').onclick = () => {
      if (!this._active) return;
      if (confirm('Comma 기기를 재부팅하시겠습니까?\n재부팅 시 약 1~2분 동안 터미널 연결이 종료됩니다.')) {
        this._enqueue('sudo reboot\r');
      }
      this._terminal?.focus();
    };

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
    this._paintGitStatus();
  }

  getCardSize() { return 10; }
}

customElements.define('carrot-terminal-card', CarrotTerminalCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'carrot-terminal-card',
  name: 'Carrot Remote Terminal',
  description: '주차 상태의 Comma 당근웹 PTY에 연결합니다.',
});
