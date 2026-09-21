/**
 * CarrotPilot Parameter Tuning Card for Home Assistant.
 *
 * Exclusively designed for viewing and modifying CarrotPilot parameters remotely.
 * Automatically discovers parameters and descriptions dynamically from CarrotPilot schema.
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
    this._pending = new Set();
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
  }

  setConfig(config) {
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
    this._startPolling();
  }

  disconnectedCallback() {
    this._stopPolling();
  }

  _startPolling() {
    this._stopPolling();
    this._pollTimer = setInterval(() => {
      if (this._pending.size > 0 && this._entryId) {
        this._checkPendingStatus();
      }
    }, 4000);
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
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
    if (!this._hass) return;
    this._loading = true;
    this._error = null;
    this._waitingForSync = false;
    this._render();

    try {
      const entryId = await this._resolveDevice();
      if (!entryId) {
        this._error = 'Carrot HA 장치를 찾을 수 없습니다. 기기 및 서비스에서 Carrot HA가 설정되어 있는지 확인하세요.';
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
    }
  }

  async _checkPendingStatus() {
    if (!this._hass || !this._entryId) return;
    try {
      const data = await this._hass.callApi('GET', `carrot_ha/v1/param_status/${encodeURIComponent(this._entryId)}`);
      if (data && data.ok && Array.isArray(data.queue)) {
        const activePending = new Set();
        for (const item of data.queue) {
          if (item.status === 'pending') {
            activePending.add(item.param_name);
          } else if (this._pending.has(item.param_name) && item.status === 'applied') {
            this._showToast(`✓ ${item.param_name} 차량 적용 완료!`);
          }
        }
        this._pending = activePending;
        this._render();
      }
    } catch (_) {}
  }

  async _setParam(name, value) {
    if (!this._hass || !this._entryId) return;
    const oldVal = this._values[name];
    this._values[name] = value;
    this._pending.add(name);
    this._render();
    this._showToast(`⏳ ${name}: ${value} 변경 요청 전송 중...`);

    try {
      const res = await this._hass.callApi('POST', `carrot_ha/v1/param_set/${encodeURIComponent(this._entryId)}`, {
        name,
        value
      });
      if (res && res.ok) {
        this._showToast(`⏳ ${name}: 차량 대기열에 등록됨`);
      } else {
        this._values[name] = oldVal;
        this._pending.delete(name);
        this._showToast(`❌ ${name} 변경 실패: ${res?.error || '오류'}`);
        this._render();
      }
    } catch (err) {
      this._values[name] = oldVal;
      this._pending.delete(name);
      this._showToast(`❌ 네트워크 전송 오류`);
      this._render();
    }
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

  _getAllItems() {
    if (!this._catalog) return [];
    // 1. If catalog has items_by_group
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
    // 2. If catalog has params array directly
    if (Array.isArray(this._catalog.params)) {
      return this._catalog.params;
    }
    if (Array.isArray(this._catalog.items)) {
      return this._catalog.items;
    }
    return [];
  }

  _buildCategoryMap() {
    // Map param_name -> top_level_category_id
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
      // Category filter
      if (activeCat !== 'ALL') {
        const topCat = catMap.get(item.name);
        if (topCat) {
          if (topCat !== activeCat) return false;
        } else {
          // Fallback to group name match
          const itemGroup = (item.group || item.cgroup || item.egroup || '').toLowerCase();
          const activeLower = activeCat.toLowerCase();
          if (!itemGroup || (!itemGroup.includes(activeLower) && !activeLower.includes(itemGroup))) {
            return false;
          }
        }
      }

      // Search filter
      if (query) {
        const name = (item.name || '').toLowerCase();
        const title = (item.title || item.etitle || '').toLowerCase();
        const descr = (item.descr || item.edescr || '').toLowerCase();
        return name.includes(query) || title.includes(query) || descr.includes(query);
      }

      return true;
    });
  }

  _render() {
    const items = this._getAllItems();
    const filtered = this._filterItems(items);
    const categories = this._getCategories();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: var(--primary-text-color, #e1e1e1);
        }
        ha-card {
          background: var(--ha-card-background, var(--card-background-color, #1a1e24));
          border-radius: var(--ha-card-border-radius, 16px);
          box-shadow: var(--ha-card-box-shadow, 0 4px 20px rgba(0, 0, 0, 0.25));
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.08));
          overflow: hidden;
          padding: 0;
        }

        /* Header */
        .card-header {
          padding: 16px 20px;
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
          font-size: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(255, 122, 41, 0.15);
          color: #ff7a29;
        }
        .header-titles {
          display: flex;
          flex-direction: column;
        }
        .card-title {
          font-size: 17px;
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

        /* Search Bar */
        .search-container {
          padding: 12px 16px 8px 16px;
          position: relative;
        }
        .search-input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 38px 10px 36px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: var(--primary-text-color, #e1e1e1);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s ease;
        }
        .search-input:focus {
          border-color: #ff7a29;
        }
        .search-icon {
          position: absolute;
          left: 28px;
          top: 21px;
          font-size: 14px;
          color: #8e99a4;
          pointer-events: none;
        }
        .search-clear {
          position: absolute;
          right: 26px;
          top: 18px;
          background: none;
          border: none;
          color: #8e99a4;
          font-size: 16px;
          cursor: pointer;
          padding: 4px;
        }

        /* Categories Bar */
        .categories-bar {
          display: flex;
          overflow-x: auto;
          gap: 8px;
          padding: 6px 16px 14px 16px;
          scrollbar-width: none;
        }
        .categories-bar::-webkit-scrollbar {
          display: none;
        }
        .cat-pill {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--secondary-text-color, #9faab6);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .cat-pill:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--primary-text-color, #e1e1e1);
        }
        .cat-pill.active {
          background: #ff7a29;
          color: #fff;
          border-color: #ff7a29;
          box-shadow: 0 2px 10px rgba(255, 122, 41, 0.35);
        }

        /* Parameter List */
        .params-list {
          padding: 0 16px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 640px;
          overflow-y: auto;
        }
        .param-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 12px 14px;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .param-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.12);
        }
        .param-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          user-select: none;
        }
        .param-info {
          flex: 1;
          min-width: 0;
          padding-right: 12px;
        }
        .param-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .param-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--primary-text-color, #ffffff);
        }
        .param-name-badge {
          font-size: 11px;
          font-family: monospace;
          background: rgba(255, 255, 255, 0.08);
          color: #ff9f5a;
          padding: 2px 6px;
          border-radius: 4px;
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

        /* Controls */
        .param-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Toggle Switch */
        .switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 26px;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider-round {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(255, 255, 255, 0.15);
          transition: .3s;
          border-radius: 26px;
        }
        .slider-round:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }
        input:checked + .slider-round {
          background-color: #ff7a29;
        }
        input:checked + .slider-round:before {
          transform: translateX(22px);
        }

        /* Stepper Buttons */
        .stepper {
          display: flex;
          align-items: center;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        .step-btn {
          background: none;
          border: none;
          color: var(--primary-text-color, #e1e1e1);
          font-size: 16px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .step-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .step-value {
          padding: 0 10px;
          font-size: 14px;
          font-weight: 700;
          min-width: 34px;
          text-align: center;
          color: #ff9f5a;
        }

        /* Expand Button */
        .btn-expand {
          background: none;
          border: none;
          color: #8e99a4;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: transform 0.2s ease;
        }
        .btn-expand.expanded {
          transform: rotate(180deg);
        }

        /* Detailed Description Drawer */
        .param-detail {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          animation: slideDown 0.2s ease-out;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .param-descr {
          font-size: 13px;
          line-height: 1.6;
          color: var(--secondary-text-color, #a2acb7);
          white-space: pre-wrap;
          word-break: break-word;
          background: rgba(0, 0, 0, 0.2);
          padding: 10px 12px;
          border-radius: 8px;
          border-left: 3px solid #ff7a29;
        }
        .param-meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: 8px;
          margin-top: 10px;
        }
        .meta-pill {
          background: rgba(255, 255, 255, 0.04);
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 12px;
          text-align: center;
        }
        .meta-label {
          font-size: 10px;
          color: #7b8794;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .meta-val {
          font-weight: 600;
          color: #d1d8e0;
        }
        .range-slider-row {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .param-range {
          flex: 1;
          accent-color: #ff7a29;
          cursor: pointer;
        }
        .btn-reset-default {
          font-size: 11px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #c4cdd5;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-reset-default:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        /* States (Loading / Empty / Sync Wait) */
        .state-container {
          text-align: center;
          padding: 40px 24px;
          color: var(--secondary-text-color, #8e99a4);
        }
        .state-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }
        .state-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--primary-text-color, #e1e1e1);
          margin-bottom: 8px;
        }
        .state-desc {
          font-size: 13px;
          line-height: 1.6;
          max-width: 420px;
          margin: 0 auto 16px auto;
        }
        .state-action-btn {
          background: #ff7a29;
          color: #fff;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .state-action-btn:hover {
          background: #ff8c42;
        }
        .loading-spinner {
          display: inline-block;
          width: 28px;
          height: 28px;
          border: 3px solid rgba(255, 122, 41, 0.25);
          border-radius: 50%;
          border-top-color: #ff7a29;
          animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Toast */
        #toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%) translateY(100px);
          background: rgba(20, 24, 30, 0.95);
          color: var(--primary-text-color, #e1e1e1);
          padding: 10px 20px;
          border-radius: 24px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 122, 41, 0.5);
          font-size: 13px;
          font-weight: 600;
          pointer-events: none;
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
          z-index: 9999;
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
              <span class="card-title">CarrotPilot 파라미터</span>
              <span class="card-subtitle">
                ${this._deviceId ? `기기: ${this._deviceId} · ${items.length}개 파라미터` : '당근파일럿 원격 설정'}
                ${this._pending.size > 0 ? `<span class="pending-badge">대기 ${this._pending.size}건</span>` : ''}
              </span>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn-icon" id="btnRefresh" title="새로고침">🔄</button>
          </div>
        </div>

        ${items.length > 0 ? `
          <!-- Search Bar -->
          <div class="search-container">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" id="searchInput" placeholder="파라미터 검색 (예: 오토크루즈, AlwaysLateral, 조향)..." value="${this._escapeHtml(this._searchQuery)}">
            <button class="search-clear" id="searchClear" ${this._searchQuery ? '' : 'hidden'}>✕</button>
          </div>

          <!-- Category Tabs -->
          <div class="categories-bar">
            ${categories.map(c => `
              <div class="cat-pill ${this._activeCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
                ${c.name}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Parameter List or Status States -->
        <div class="params-list">
          ${this._loading ? `
            <div class="state-container">
              <div class="loading-spinner"></div>
              <p style="margin-top: 14px;">설정 데이터를 불러오는 중...</p>
            </div>
          ` : this._waitingForSync ? `
            <div class="state-container">
              <div class="state-icon">📡</div>
              <div class="state-title">콤마 동기화 대기 중</div>
              <div class="state-desc">
                아직 Cloudflare에 저장된 파라미터 스냅샷이 없습니다.<br>
                콤마 기기에서 <b>param_sync.py</b> 또는 <b>collector.py</b>가 실행되면 파라미터 목록이 자동으로 여기에 나타납니다.
              </div>
              <button class="state-action-btn" id="btnRetrySync">다시 확인하기</button>
            </div>
          ` : this._error ? `
            <div class="state-container">
              <div class="state-icon">⚠️</div>
              <div class="state-title">데이터 조회 실패</div>
              <div class="state-desc">${this._error}</div>
              <button class="state-action-btn" id="btnRetrySync">다시 시도</button>
            </div>
          ` : filtered.length === 0 ? `
            <div class="state-container">
              <p>${!this._hass ? 'Home Assistant 연결을 기다리는 중입니다.' : !this._catalog ? '상단 새로고침으로 설정을 불러오세요.' : !items.length ? '파라미터 정의가 없습니다. 카탈로그 동기화 상태를 확인하세요.' : '검색 결과가 없습니다.'}</p>
            </div>
          ` : filtered.map(item => this._renderParamCard(item)).join('')}
        </div>

        <div id="toast"></div>
      </ha-card>
    `;

    this._bindEvents();
  }

  _escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  _renderSearchResults() {
    if (this._loading || this._error || this._waitingForSync) return;
    const list = this.shadowRoot.querySelector('.params-list');
    const items = this._filterItems(this._getAllItems());
    if (list) list.innerHTML = items.length
      ? items.map(item => this._renderParamCard(item)).join('')
      : '<div class="state-container"><p>검색 결과가 없습니다.</p></div>';
    const clear = this.shadowRoot.getElementById('searchClear');
    if (clear) clear.hidden = !this._searchQuery;
    this._bindEvents();
  }

  _renderParamCard(item) {
    const name = item.name;
    const title = item.title || item.etitle || name;
    const descr = item.descr || item.edescr || '상세 설명이 등록되지 않았습니다.';
    const isExpanded = this._expandedParams.has(name);
    const isPending = this._pending.has(name);

    const min = item.min !== undefined ? Number(item.min) : 0;
    const max = item.max !== undefined ? Number(item.max) : 100;
    const step = item.unit !== undefined ? Number(item.unit) : 1;
    const defaultVal = item.default !== undefined ? item.default : 0;

    let currentVal = this._values[name];
    if (currentVal === undefined) {
      currentVal = defaultVal;
    }
    const isBool = (min === 0 && max === 1 && (step === 1 || !item.unit));
    const numVal = Number(currentVal) || 0;

    return `
      <div class="param-card">
        <div class="param-header" data-param="${name}">
          <div class="param-info" data-expand="${name}">
            <div class="param-title-row">
              <span class="param-title">${title}</span>
              <span class="param-name-badge">${name}</span>
              ${isPending ? '<span class="pending-badge">⏳ 대기</span>' : ''}
            </div>
          </div>

          <div class="param-controls">
            ${isBool ? `
              <label class="switch">
                <input type="checkbox" data-bool-param="${name}" ${Boolean(numVal) ? 'checked' : ''}>
                <span class="slider-round"></span>
              </label>
            ` : `
              <div class="stepper">
                <button class="step-btn" data-step-down="${name}" data-min="${min}" data-step="${step}">−</button>
                <span class="step-value">${currentVal}</span>
                <button class="step-btn" data-step-up="${name}" data-max="${max}" data-step="${step}">+</button>
              </div>
            `}
            <button class="btn-expand ${isExpanded ? 'expanded' : ''}" data-expand="${name}">▼</button>
          </div>
        </div>

        ${isExpanded ? `
          <div class="param-detail">
            <div class="param-descr">${descr}</div>
            <div class="param-meta-grid">
              <div class="meta-pill"><div class="meta-label">기본값</div><div class="meta-val">${defaultVal}</div></div>
              <div class="meta-pill"><div class="meta-label">최소값</div><div class="meta-val">${min}</div></div>
              <div class="meta-pill"><div class="meta-label">최대값</div><div class="meta-val">${max}</div></div>
              <div class="meta-pill"><div class="meta-label">단위</div><div class="meta-val">${step}</div></div>
            </div>

            ${!isBool ? `
              <div class="range-slider-row">
                <input type="range" class="param-range" data-range-param="${name}" min="${min}" max="${max}" step="${step}" value="${numVal}">
                <button class="btn-reset-default" data-reset-default="${name}" data-default="${defaultVal}">기본값 복원</button>
              </div>
            ` : `
              <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                <button class="btn-reset-default" data-reset-default="${name}" data-default="${defaultVal}">기본값 복원 (${defaultVal})</button>
              </div>
            `}
          </div>
        ` : ''}
      </div>
    `;
  }

  _bindEvents() {
    const root = this.shadowRoot;

    // Refresh / Retry
    const btnRefresh = root.getElementById('btnRefresh');
    if (btnRefresh) {
      btnRefresh.onclick = () => this._loadData();
    }
    const btnRetrySync = root.getElementById('btnRetrySync');
    if (btnRetrySync) {
      btnRetrySync.onclick = () => this._loadData();
    }

    // Search
    const searchInput = root.getElementById('searchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this._searchQuery = e.target.value;
        // Keep the input node alive: replacing it interrupts Korean IME composition.
        this._renderSearchResults();
      };
    }
    const searchClear = root.getElementById('searchClear');
    if (searchClear) {
      searchClear.onclick = () => {
        this._searchQuery = '';
        searchInput.value = '';
        this._renderSearchResults();
        searchInput.focus();
      };
    }

    // Categories
    root.querySelectorAll('.cat-pill').forEach(pill => {
      pill.onclick = () => {
        this._activeCategory = pill.dataset.cat;
        this._render();
      };
    });

    // Expand/Collapse
    root.querySelectorAll('[data-expand]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const name = el.dataset.expand;
        if (this._expandedParams.has(name)) {
          this._expandedParams.delete(name);
        } else {
          this._expandedParams.add(name);
        }
        this._render();
      };
    });

    // Boolean switch
    root.querySelectorAll('[data-bool-param]').forEach(sw => {
      sw.onchange = (e) => {
        const name = sw.dataset.boolParam;
        const val = e.target.checked ? 1 : 0;
        this._setParam(name, val);
      };
    });

    // Stepper down
    root.querySelectorAll('[data-step-down]').forEach(btn => {
      btn.onclick = () => {
        const name = btn.dataset.stepDown;
        const min = Number(btn.dataset.min);
        const step = Number(btn.dataset.step) || 1;
        const current = Number(this._values[name] !== undefined ? this._values[name] : min);
        let next = current - step;
        if (next < min) next = min;
        next = Math.round(next * 1000) / 1000;
        this._setParam(name, next);
      };
    });

    // Stepper up
    root.querySelectorAll('[data-step-up]').forEach(btn => {
      btn.onclick = () => {
        const name = btn.dataset.stepUp;
        const max = Number(btn.dataset.max);
        const step = Number(btn.dataset.step) || 1;
        const current = Number(this._values[name] !== undefined ? this._values[name] : 0);
        let next = current + step;
        if (next > max) next = max;
        next = Math.round(next * 1000) / 1000;
        this._setParam(name, next);
      };
    });

    // Range slider
    root.querySelectorAll('[data-range-param]').forEach(slider => {
      slider.onchange = (e) => {
        const name = slider.dataset.rangeParam;
        const val = Number(e.target.value);
        this._setParam(name, val);
      };
    });

    // Reset default
    root.querySelectorAll('[data-reset-default]').forEach(btn => {
      btn.onclick = () => {
        const name = btn.dataset.resetDefault;
        const def = Number(btn.dataset.default);
        this._setParam(name, def);
      };
    });
  }

  getCardSize() {
    return 6;
  }
}

if (!customElements.get('carrot-params-card')) {
  customElements.define('carrot-params-card', CarrotParamsCard);
}

export default CarrotParamsCard;
