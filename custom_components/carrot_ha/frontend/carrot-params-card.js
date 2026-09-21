/**
 * CarrotPilot Parameter Tuning Card for Home Assistant.
 *
 * Integrates the authentic Carrot Web interface directly into Home Assistant
 * via an embedded sandboxed view (/carrot_ha_static/carrot_web/settings.html)
 * communicating with Home Assistant and Cloudflare Relay.
 */

class CarrotParamsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._device = null;
    this._entryId = null;
    this._deviceId = '';
    this._catalog = null;
    this._values = {};
    this._pending = new Map();
    this._sending = new Set();
    this._searchQuery = '';
    this._activeCategory = 'ALL';
    this._expandedParams = new Set();
    this._loading = false;
    this._waitingForSync = false;
    this._error = null;
    this._pollTimer = null;
    this._toastMsg = null;
    this._toastTimer = null;
    this._initialized = false;
    this._iframeReady = false;
    this._snapshotData = null;

    this._onWindowMessage = this._handleWindowMessage.bind(this);
  }

  static getStubConfig() {
    return { device_id: '' };
  }

  setConfig(config) {
    if (this._config.device_id !== config?.device_id) {
      for (const request of this._pending.values()) request.reject(new Error('장치가 변경되었습니다.'));
      this._pending.clear();
      this._device = this._entryId = this._snapshotData = this._catalog = null;
    }
    this._config = config || {};
    this._render();
    if (this._hass) {
      this._loadData();
    }
  }

  set hass(hass) {
    const isFirst = !this._hass && hass;
    this._hass = hass;
    if (isFirst || (!this._initialized && hass)) {
      this._initialized = true;
      this._loadData();
    }
  }

  connectedCallback() {
    window.addEventListener('message', this._onWindowMessage);
    this._startPolling();
  }

  disconnectedCallback() {
    window.removeEventListener('message', this._onWindowMessage);
    this._stopPolling();
    for (const request of this._pending.values()) request.reject(new Error('화면 연결이 종료되었습니다. 적용 여부를 다시 확인하세요.'));
    this._pending.clear();
  }

  _startPolling() {
    this._stopPolling();
    this._lastSnapshotFetch = 0;
    this._pollTimer = setInterval(() => {
      if (!this._entryId || document.hidden) return;
      if (this._pending.size) this._checkPendingStatus();
      if (Date.now() - this._lastSnapshotFetch >= 15000) this._loadData();
    }, 4000);
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  _handleWindowMessage(event) {
    const frame = this.shadowRoot.getElementById('carrotSettingsFrame');
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
    const msg = event?.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'carrot:ready') {
      this._iframeReady = true;
      if (this._snapshotData) {
        this._sendSnapshotToIframe();
      } else {
        this._loadData();
      }
    } else if (msg.type === 'carrot:param_set' && typeof msg.requestId === 'string') {
      const source = event.source;
      this._setParam(msg.name, msg.value).then(
        value => source.postMessage({type: 'carrot:response', requestId: msg.requestId, ok: true, name: msg.name, value}, window.location.origin),
        error => source.postMessage({type: 'carrot:response', requestId: msg.requestId, ok: false, error: error.message}, window.location.origin)
      );
    } else if (msg.type === 'carrot:resize' && typeof msg.height === 'number') {
      const iframe = this.shadowRoot.getElementById('carrotSettingsFrame');
      if (iframe && msg.height > 400) {
        iframe.style.height = `${Math.min(Math.max(msg.height, 650), 2000)}px`;
      }
    }
  }

  _sendSnapshotToIframe() {
    const iframe = this.shadowRoot.getElementById('carrotSettingsFrame');
    if (!iframe || !iframe.contentWindow || !this._snapshotData) return;
    try {
      iframe.contentWindow.postMessage({
        type: 'carrot:snapshot',
        data: this._snapshotData,
      }, window.location.origin);
    } catch (err) {
      console.warn('[carrot-params-card] postMessage snapshot error:', err);
    }
  }

  async _resolveDevice() {
    if (this._device && this._entryId) return this._entryId;
    try {
      const resp = await this._hass.callApi('GET', 'carrot_ha/v1/devices');
      const devices = resp && resp.devices ? resp.devices : [];
      const requested = this._config?.device_id;
      const device = devices.find(d => d.device_id === requested) || (!requested ? devices[0] : null);
      if (device) {
        this._device = device;
        this._entryId = device.entry_id;
        this._deviceId = device.device_id;
        return this._entryId;
      }
    } catch (err) {
      console.warn('[carrot-params-card] devices lookup error:', err);
    }
    return null;
  }

  async _loadData() {
    if (!this._hass || this._loading) return;
    this._lastSnapshotFetch = Date.now();
    this._loading = true;
    this._error = null;
    this._waitingForSync = false;
    this._renderHeaderStatus();

    try {
      const entryId = await this._resolveDevice();
      if (!entryId) {
        this._error = 'Carrot HA 장치를 찾을 수 없습니다. 설정 > 기기 및 서비스에서 Carrot HA를 확인하세요.';
        this._loading = false;
        this._render();
        return;
      }

      const res = await this._hass.callApi('GET', `carrot_ha/v1/settings/${encodeURIComponent(entryId)}`);
      if (res && res.ok) {
        this._catalog = res.catalog || {};
        this._values = Object.assign({}, res.values || {});
        this._deviceId = res.device_id || this._deviceId;
        this._updatedAt = res.updated_at || '';
        this._waitingForSync = false;
        this._snapshotData = res;

        if (this._iframeReady) {
          this._sendSnapshotToIframe();
        }
      } else {
        if (res && (res.error === 'settings_not_found' || res.status === 404)) {
          this._waitingForSync = true;
        } else {
          this._error = res?.error || res?.message || '설정을 불러오지 못했습니다.';
        }
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('404') || msg.includes('settings_not_found')) {
        this._waitingForSync = true;
      } else {
        this._error = `설정 조회 오류: ${msg}`;
      }
    } finally {
      this._loading = false;
      this._render();
      if (this._snapshotData && this._iframeReady) {
        this._sendSnapshotToIframe();
      }
    }
  }

  async _checkPendingStatus() {
    if (!this._hass || !this._entryId || this._checkingStatus) return;
    this._checkingStatus = true;
    try {
      for (const [id, req] of this._pending) {
        if (Date.now() - req.started > 100000) {
          req.reject(new Error('차량 적용 확인 시간이 초과되었습니다. 요청은 남아 있을 수 있으므로 재조회하세요.'));
          this._pending.delete(id);
        }
      }
      if (!this._pending.size) return;
      const ids = [...this._pending.keys()].join(',');
      const data = await this._hass.callApi('GET', `carrot_ha/v1/param_status/${encodeURIComponent(this._entryId)}?ids=${encodeURIComponent(ids)}`);
      for (const item of data.queue || []) {
        const req = this._pending.get(String(item.id));
        if (!req || item.param_name !== req.name) continue;
        if (item.status === 'applied') {
          // Confirm against the vehicle snapshot, not a previous command with the same name.
          const snapshot = await this._hass.callApi('GET', `carrot_ha/v1/settings/${encodeURIComponent(this._entryId)}`);
          const actual = snapshot.values?.[req.name];
          if (actual === undefined) continue;
          this._values[req.name] = actual;
          req.resolve(actual);
          this._pending.delete(String(item.id));
          this._showToast(`✓ ${req.name} 차량 적용 확인: ${actual}`);
        } else if (item.status !== 'pending') {
          req.reject(new Error(`차량이 요청을 적용하지 못했습니다: ${item.status}`));
          this._pending.delete(String(item.id));
        }
      }
    } catch (err) {
      this._showToast('변경 상태 조회 실패. 다음 조회에서 다시 확인합니다.');
    } finally {
      this._checkingStatus = false;
      this._renderHeaderStatus();
    }
  }

  async _setParam(name, value) {
    if (!this._hass || !this._entryId) throw new Error('HA 장치 연결이 없습니다.');
    if (this._snapshotData?.param_queue_protocol !== 1) throw new Error('Worker를 최신 버전으로 배포한 뒤 새로고침하세요. 현재 서버는 적용 확인을 지원하지 않습니다.');
    const item = this._getAllItems().find(item => item.name === name);
    if (!item || !Number.isFinite(Number(value)) || value === '' || value === null ||
        Number(value) < Number(item.min) || Number(value) > Number(item.max)) throw new Error('현재 카탈로그에 없는 파라미터이거나 허용 범위를 벗어난 값입니다.');
    if ([...this._pending.values()].some(req => req.name === name) || this._sending.has(name)) throw new Error('이 파라미터는 차량 적용 대기 중입니다.');
    this._sending.add(name);
    const entryId = this._entryId;
    let res;
    try {
      res = await this._hass.callApi('POST', `carrot_ha/v1/param_set/${encodeURIComponent(entryId)}`, {name, value});
    } finally {
      this._sending.delete(name);
    }
    if (this._entryId !== entryId || !this.isConnected) throw new Error('화면 연결이 변경되었습니다. 실제 적용 여부를 다시 확인하세요.');
    if (!res?.ok || !res.ids?.length) throw new Error(res?.error || '변경 요청 ID를 받지 못했습니다. 적용 여부를 다시 확인하세요.');
    this._showToast(`⏳ ${name}: 차량 적용 대기 중`);
    return new Promise((resolve, reject) => {
      this._pending.set(String(res.ids[0]), {name, value, resolve, reject, started: Date.now()});
      this._renderHeaderStatus();
    });
  }

  _showToast(msg) {
    this._toastMsg = msg;
    clearTimeout(this._toastTimer);
    this._renderToast();
    this._toastTimer = setTimeout(() => {
      this._toastMsg = null;
      this._renderToast();
    }, 3500);
  }

  _renderToast() {
    const toastEl = this.shadowRoot.getElementById('toast');
    if (!toastEl) return;
    if (this._toastMsg) {
      toastEl.textContent = this._toastMsg;
      toastEl.classList.add('visible');
    } else {
      toastEl.classList.remove('visible');
    }
  }

  _renderHeaderStatus() {
    const subEl = this.shadowRoot.getElementById('cardSubtitle');
    if (!subEl) return;
    const count = this._getAllItems().length;
    subEl.innerHTML = `
      ${this._deviceId ? `기기: ${this._escapeHtml(this._deviceId)} · ${count}개 파라미터` : '당근파일럿 원격 설정'}
      ${this._pending.size > 0 ? `<span class="pending-badge">대기 ${this._pending.size}건</span>` : ''}
    `;
  }

  // ── Backward-compatible helper methods for tests & catalog inspection ──
  _getAllItems() {
    if (!this._catalog) return [];
    if (this._catalog.items_by_group && typeof this._catalog.items_by_group === 'object') {
      const all = [];
      const seen = new Set();
      for (const [groupName, items] of Object.entries(this._catalog.items_by_group)) {
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item && item.name && !seen.has(item.name)) {
              seen.add(item.name);
              all.push({ ...item, group: item.group || groupName });
            }
          }
        }
      }
      if (all.length) return all;
    }
    if (Array.isArray(this._catalog.params)) return this._catalog.params;
    if (Array.isArray(this._catalog.items)) return this._catalog.items;
    return [];
  }

  _buildCategoryMap() {
    const map = new Map();
    if (!this._catalog) return map;
    const categories = this._catalog.categories || this._catalog.menu;
    if (Array.isArray(categories)) {
      const walk = (node, topId) => {
        if (Array.isArray(node.params || node.items)) {
          for (const p of (node.params || node.items)) {
            map.set(typeof p === 'string' ? p : p.name, topId);
          }
        }
        if (Array.isArray(node.groups || node.sections)) {
          for (const child of (node.groups || node.sections)) {
            walk(child, topId);
          }
        }
      };
      for (const top of categories) {
        const topId = top.id || top.ko || top.en;
        walk(top, topId);
      }
    }
    return map;
  }

  _getCategories() {
    if (!this._catalog) return [{ id: 'ALL', name: '전체' }];
    const cats = [{ id: 'ALL', name: '전체' }];
    const tree = this._catalog.categories || this._catalog.menu;
    if (Array.isArray(tree) && tree.length) {
      for (const c of tree) {
        cats.push({ id: c.id || c.ko || c.en, name: c.ko || c.en || c.id });
      }
    } else if (this._catalog.items_by_group) {
      for (const g of Object.keys(this._catalog.items_by_group)) {
        cats.push({ id: g, name: g });
      }
    }
    return cats;
  }

  _filterItems(items) {
    const query = (this._searchQuery || '').trim().toLowerCase();
    const activeCat = this._activeCategory;
    const catMap = this._buildCategoryMap();

    return items.filter(item => {
      if (activeCat !== 'ALL') {
        const topCat = catMap.get(item.name);
        if (topCat) {
          if (topCat !== activeCat) return false;
        } else {
          const itemGroup = (item.group || item.cgroup || item.egroup || '').toLowerCase();
          const activeLower = activeCat.toLowerCase();
          if (!itemGroup || (!itemGroup.includes(activeLower) && !activeLower.includes(itemGroup))) {
            return false;
          }
        }
      }
      if (query) {
        const name = (item.name || '').toLowerCase();
        const title = (item.title || item.etitle || '').toLowerCase();
        const descr = (item.descr || item.edescr || '').toLowerCase();
        return name.includes(query) || title.includes(query) || descr.includes(query);
      }
      return true;
    });
  }

  _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _bindEvents() {
    const refreshBtn = this.shadowRoot.getElementById('btnRefresh');
    if (refreshBtn) refreshBtn.onclick = () => this._loadData();

    const searchInput = this.shadowRoot.getElementById('searchInput');
    const searchClear = this.shadowRoot.getElementById('searchClear');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this._searchQuery = e.target.value;
        if (searchClear) searchClear.hidden = !this._searchQuery;
        const list = this.shadowRoot.querySelector('.params-list');
        if (list) {
          const items = this._getAllItems();
          const filtered = this._filterItems(items);
          if (!filtered.length) {
            list.innerHTML = '<div class="state-container"><div class="state-desc">검색 결과가 없습니다.</div></div>';
          } else {
            list.innerHTML = filtered.map(i => `<div class="param-card">${this._escapeHtml(i.name)}</div>`).join('');
          }
        }
      };
    }
    if (searchClear && searchInput) {
      searchClear.onclick = () => {
        searchInput.value = '';
        searchInput.oninput({ target: searchInput });
        searchInput.focus();
      };
    }
  }

  _render() {
    // Keep the original UI, focus, scroll and in-flight dialogs mounted.
    if (this.shadowRoot.getElementById('carrotSettingsFrame')) {
      this._renderHeaderStatus();
      if (this._error) this._showToast(this._error);
      return;
    }
    // If waiting for first synchronization from vehicle
    if (this._waitingForSync) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          ha-card {
            background: var(--ha-card-background, var(--card-background-color, #1a1e24));
            border-radius: var(--ha-card-border-radius, 16px);
            padding: 32px 24px;
            text-align: center;
            color: var(--primary-text-color, #e1e1e1);
          }
          .icon { font-size: 40px; margin-bottom: 12px; }
          .title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
          .desc { font-size: 13px; line-height: 1.6; color: var(--secondary-text-color, #8e99a4); margin-bottom: 16px; }
          .btn { background: #ff7a29; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        </style>
        <ha-card>
          <div class="icon">📡</div>
          <div class="title">차량 동기화 대기 중</div>
          <div class="desc">
            차량(Comma 3X)에서 CarrotPilot 파라미터가 아직 클라우드로 동기화되지 않았습니다.<br>
            차량 전원이 켜지고 네트워크가 연결되면 자동으로 업로드됩니다.
          </div>
          <button class="btn" id="btnRetrySync">다시 확인</button>
        </ha-card>
      `;
      const retryBtn = this.shadowRoot.getElementById('btnRetrySync');
      if (retryBtn) retryBtn.onclick = () => this._loadData();
      return;
    }

    // If an error occurred
    if (this._error && !this._catalog) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          ha-card {
            background: var(--ha-card-background, var(--card-background-color, #1a1e24));
            border-radius: var(--ha-card-border-radius, 16px);
            padding: 32px 24px;
            text-align: center;
            color: var(--primary-text-color, #e1e1e1);
          }
          .icon { font-size: 36px; margin-bottom: 12px; color: #ff5252; }
          .title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
          .desc { font-size: 13px; line-height: 1.6; color: var(--secondary-text-color, #8e99a4); margin-bottom: 16px; }
          .btn { background: #ff7a29; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        </style>
        <ha-card>
          <div class="icon">⚠️</div>
          <div class="title">설정 조회 오류</div>
          <div class="desc">${this._escapeHtml(this._error)}</div>
          <button class="btn" id="btnRetryError">다시 시도</button>
        </ha-card>
      `;
      const retryBtn = this.shadowRoot.getElementById('btnRetryError');
      if (retryBtn) retryBtn.onclick = () => this._loadData();
      return;
    }

    const items = this._getAllItems();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: var(--primary-text-color, #e1e1e1);
        }
        ha-card {
          background: var(--ha-card-background, var(--card-background-color, #121316));
          border-radius: var(--ha-card-border-radius, 16px);
          box-shadow: var(--ha-card-box-shadow, 0 4px 20px rgba(0, 0, 0, 0.25));
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.08));
          overflow: hidden;
          padding: 0;
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .card-header {
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.08));
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .header-icon {
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255, 122, 41, 0.15);
          color: #ff7a29;
        }
        .header-titles {
          display: flex;
          flex-direction: column;
        }
        .card-title {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.3px;
          color: var(--primary-text-color, #ffffff);
        }
        .card-subtitle {
          font-size: 12px;
          color: var(--secondary-text-color, #8e99a4);
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
        }
        .pending-badge {
          font-size: 11px;
          background: rgba(255, 187, 0, 0.2);
          color: #ffbb00;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-icon {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--primary-text-color, #e1e1e1);
          border-radius: 8px;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 15px;
          transition: all 0.2s ease;
        }
        .btn-icon:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        /* Authentic Carrot Web Iframe Container */
        .iframe-container {
          position: relative;
          width: 100%;
          min-height: 360px;
          height: clamp(360px, 80vh, 1200px);
          height: clamp(360px, 80dvh, 1200px);
          background: #121316;
          border: none;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
          background: #121316;
        }

        /* Toast */
        #toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(100px);
          background: rgba(20, 24, 30, 0.95);
          color: var(--primary-text-color, #e1e1e1);
          padding: 10px 22px;
          border-radius: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 122, 41, 0.5);
          font-size: 13px;
          font-weight: 600;
          pointer-events: none;
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
          z-index: 99999;
        }
        #toast.visible {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      </style>

      <ha-card>
        <!-- Header -->
        <div class="card-header">
          <div class="header-left">
            <div class="header-icon">🥕</div>
            <div class="header-titles">
              <span class="card-title">CarrotPilot 설정</span>
              <span class="card-subtitle" id="cardSubtitle">
                ${this._deviceId ? `기기: ${this._escapeHtml(this._deviceId)} · ${items.length}개 파라미터` : '당근파일럿 원격 설정'}
                ${this._pending.size > 0 ? `<span class="pending-badge">대기 ${this._pending.size}건</span>` : ''}
              </span>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn-icon" id="btnRefresh" title="새로고침">🔄</button>
          </div>
        </div>

        <!-- Authentic Carrot Web Embedded Iframe -->
        <div class="iframe-container">
          <iframe
            id="carrotSettingsFrame"
            src="/carrot_ha_static/carrot_web/settings.html?v=0.6.2"
            allow="fullscreen"
            loading="eager"
            title="CarrotPilot Authentic Settings"
          ></iframe>
        </div>

        <div id="toast"></div>
      </ha-card>
    `;

    this._bindEvents();
    const frame = this.shadowRoot.getElementById('carrotSettingsFrame');
    if (frame) {
      frame.onload = () => {
        this._iframeReady = true;
        if (this._snapshotData) {
          this._sendSnapshotToIframe();
        }
      };
    }
  }
}

if (!customElements.get('carrot-params-card')) {
  customElements.define('carrot-params-card', CarrotParamsCard);
}

const hostGlobal = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
hostGlobal.customCards = hostGlobal.customCards || [];
if (!hostGlobal.customCards.some(c => c.type === 'carrot-params-card')) {
  hostGlobal.customCards.push({
    type: 'carrot-params-card',
    name: 'CarrotPilot Parameter Tuning Card',
    description: 'Authentic CarrotPilot parameter tuning and Wiki documentation view.',
    preview: true,
  });
}

export default CarrotParamsCard;
