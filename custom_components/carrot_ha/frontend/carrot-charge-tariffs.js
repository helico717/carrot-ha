const format = new Intl.NumberFormat('ko-KR');

const styles = `
  #settingsNav button[data-settings-nav="tariffs"].active{color:var(--j-accent);border-color:var(--j-accent)}
  #favoriteTariffPane{--tariff-tint:color-mix(in srgb,var(--j-accent) 9%,var(--j-surface));--tariff-line:color-mix(in srgb,var(--j-accent) 27%,var(--j-border))}
  .tariff-heading{padding:17px 20px 19px;border:1px solid var(--tariff-line);border-radius:18px;overflow:hidden;
    background:radial-gradient(ellipse at 100% 0%,color-mix(in srgb,var(--j-accent) 13%,transparent),transparent 70%),var(--j-surface)}
  #favoriteTariffPane .tariff-heading h3{font-size:21px;letter-spacing:-.045em;margin:0 0 7px;color:var(--j-ink)}
  #favoriteTariffPane .tariff-heading p{margin:0;line-height:1.55}
  .tariff-list{display:grid;gap:11px;margin-top:15px}
  .tariff-section-title{margin:20px 0 0;font-size:15px;letter-spacing:-.02em}
  .tariff-default-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}
  .tariff-default-field{--rate-color:var(--j-accent);position:relative;isolation:isolate;display:flex;align-items:center;justify-content:space-between;gap:10px;
    background:linear-gradient(120deg,color-mix(in srgb,var(--rate-color) 16%,var(--j-surface)),var(--j-surface) 76%);
    border:1px solid color-mix(in srgb,var(--rate-color) 38%,var(--j-border));border-radius:16px;padding:13px 12px;min-width:0;overflow:hidden}
  .tariff-default-field[data-mode=slow]{--rate-color:#9ac0ff}
  :host([data-theme="light"]) .tariff-default-field[data-mode=slow]{--rate-color:#325eaa}
  .tariff-default-field::before{content:'';position:absolute;z-index:-1;inset:-30px auto -30px 36px;width:110px;transform:skewX(-28deg);
    background:repeating-linear-gradient(90deg,transparent 0 13px,color-mix(in srgb,var(--rate-color) 8%,transparent) 13px 14px);
    mask-image:linear-gradient(90deg,black,transparent);pointer-events:none}
  .tariff-default-field::after{content:'';position:absolute;left:0;top:15px;bottom:15px;width:3px;background:var(--rate-color);border-radius:0 4px 4px 0;pointer-events:none}
  .tariff-default-field:focus-within{border-color:var(--rate-color)}
  .tariff-rate-name{display:flex;align-items:center;gap:9px;min-width:0;white-space:nowrap}
  .tariff-rate-mode{display:grid;place-items:center;flex:none;width:35px;height:35px;border-radius:10px;color:var(--rate-color);font-size:10px;
    font-weight:800;letter-spacing:.035em;background:color-mix(in srgb,var(--rate-color) 11%,var(--j-surface));border:1px solid color-mix(in srgb,var(--rate-color) 27%,var(--j-border))}
  #favoriteTariffPane .tariff-default-field .tariff-input{gap:0;padding:2px 8px 2px 2px;border-radius:11px;border:1px solid var(--j-border);background:var(--j-bg);color:var(--j-sub);white-space:nowrap}
  #favoriteTariffPane .tariff-default-field .tariff-input:focus-within{border-color:var(--rate-color);outline:2px solid color-mix(in srgb,var(--rate-color) 30%,transparent);outline-offset:1px}
  #favoriteTariffPane .tariff-default-field input{box-sizing:border-box;width:76px;flex:0 0 76px;min-height:36px;padding:4px 7px;font-size:16px;
    font-weight:750;font-variant-numeric:tabular-nums;color:var(--rate-color);background:transparent;border:0;outline:0;box-shadow:none}
  .tariff-default-field .tariff-input>span{font-size:11px;line-height:1.2}
  .tariff-default-actions{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .tariff-default-feedback{font-size:12px;color:var(--j-sub);overflow-wrap:anywhere}
  #favoriteTariffPane .tariff-default-save{margin-left:auto;font-weight:700;color:var(--j-accent);border-color:var(--tariff-line);background:var(--tariff-tint)}
  .tariff-default-form[hidden]{display:none}
  .tariff-card{border:1px solid var(--j-border);border-radius:16px;background:var(--j-surface);padding:15px;min-width:0;overflow:hidden;
    transition:border-color .16s ease,box-shadow .16s ease}
  .tariff-card[data-priced=true]{border-color:var(--tariff-line);background:linear-gradient(119deg,var(--tariff-tint),var(--j-surface) 78%)}
  .tariff-card:focus-within{border-color:var(--tariff-line);box-shadow:0 0 0 2px color-mix(in srgb,var(--j-accent) 10%,transparent)}
  .tariff-info{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px 16px}
  .tariff-identity{display:flex;align-items:center;gap:12px;min-width:0}
  .tariff-icon{flex:0 0 38px;width:38px;height:38px;display:grid;place-items:center;border-radius:11px;font-size:17px;
    border:1px solid var(--j-border);background:var(--j-raised);color:var(--j-sub);line-height:1}
  .tariff-card[data-priced=true] .tariff-icon{border-color:var(--tariff-line);background:var(--tariff-tint);color:var(--j-accent)}
  .tariff-place{min-width:0;overflow-wrap:anywhere}
  .tariff-place strong{display:block;font-size:14px;line-height:1.35;margin-bottom:3px}
  .tariff-place small,.tariff-unset{font-size:12px;color:var(--j-sub)}
  .tariff-current{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--j-accent);display:flex;align-items:baseline;gap:3px}
  .tariff-current b{font-size:clamp(23px,3vw,30px);line-height:1;letter-spacing:-.045em}
  .tariff-current small{font-size:11px;font-weight:600;color:var(--j-sub)}
  .tariff-unset{padding:5px 8px;border:1px dashed var(--j-border);border-radius:999px;white-space:nowrap}
  .tariff-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:11px;border-top:1px solid var(--j-border)}
  .tariff-actions[hidden]{display:none}
  .tariff-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
  .tariff-input{display:flex;align-items:center;gap:8px;max-width:100%;min-width:0;color:var(--j-sub)}
  .tariff-input input{width:min(115px,100%);min-width:0;text-align:right}
  .tariff-card button{border-radius:10px;min-height:36px}
  .tariff-card button.tariff-primary{color:var(--j-accent);border-color:var(--tariff-line,var(--j-accent));background:var(--tariff-tint,var(--j-raised))}
  .tariff-card button.tariff-delete{color:var(--j-sub);border-color:transparent;background:transparent}
  .tariff-card button.tariff-delete:is(:hover,:focus-visible){color:var(--j-ink);border-color:var(--j-border)}
  @media(max-width:400px){
    .tariff-heading{padding:15px}
    .tariff-card{padding:12px}
    .tariff-info,.tariff-identity{gap:8px}
    .tariff-icon{flex-basis:32px;width:32px;height:32px;border-radius:9px;font-size:14px}
  }
  @media(max-width:600px){.tariff-default-form{grid-template-columns:1fr}}
  @media(pointer:coarse){#favoriteTariffPane .tariff-default-field input{min-height:44px}}
  @media(prefers-reduced-motion:reduce){.tariff-card{transition:none}}
  .tariff-status{min-height:1.35em;margin:12px 0 0;color:var(--j-sub);overflow-wrap:anywhere}
`;

function element(tag, name, text) {
  const node = document.createElement(tag);
  if (name) node.className = name;
  if (text != null) node.textContent = text;
  return node;
}

function button(label, action) {
  const node = element('button', '', label);
  node.type = 'button';
  if (action) node.addEventListener('click', action);
  return node;
}

function rateInput(label) {
  const input = element('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.required = true;
  input.setAttribute('aria-label', label);
  return input;
}

function readRate(input) {
  const raw = input.value.trim();
  const value = Number(raw.replaceAll(',', ''));
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw) && Number.isSafeInteger(value) ? value : null;
}

export function installChargeTariffs(card) {
  const style = element('style', '', styles);
  card.shadowRoot.append(style);
  const nav = button('');
  nav.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>충전 단가</span>';
  nav.dataset.settingsNav = 'tariffs';
  card.$('settingsNav').children[0].after(nav);

  const pane = element('section');
  pane.id = 'favoriteTariffPane';
  pane.dataset.settingsPane = 'tariffs';
  pane.hidden = true;
  const list = element('div', 'tariff-list');
  const status = element('p', 'tariff-status');
  status.setAttribute('role', 'status');
  const heading = element('header', 'tariff-heading');
  heading.append(
    element('h3', '', '충전 단가 설정'),
    element('p', 'note', '차계부와 내 차 대시보드가 같은 단가로 충전금액을 추정해요. 장소별 단가가 있으면 먼저 적용해요.'),
  );
  const autoLocCard = element('label', 'j-switch-card');
  autoLocCard.innerHTML = '<div><div style="font-weight:750;font-size:14px;color:var(--j-ink)">충전 · 주유 장소 자동 선택</div><div style="font-size:12px;color:var(--j-sub);margin-top:2px">자주 가는 충전소·주유소 반경 내 기록 시 장소 이름을 자동으로 연결해요.</div></div><span class="j-switch"><input id="automaticLocations" type="checkbox" checked><span class="j-slider"></span></span>';
  const autoLocInput = autoLocCard.querySelector('#automaticLocations');
  autoLocInput.onchange = async () => {
    const enabled = Boolean(card.$('nasEnabled')?.checked);
    const path = card.$('nasPath')?.value?.trim() || '/share/CarrotJournalBackup/vehicle-journal';
    autoLocInput.disabled = true;
    try {
      await card.call('nas/config', {enabled, path, automatic_locations: autoLocInput.checked});
      card.automaticLocations = autoLocInput.checked;
      card.$('vehicleManageError').textContent = autoLocInput.checked
        ? '충전 · 주유 장소 자동 선택을 켰어요.'
        : '충전 · 주유 장소 자동 선택을 껐어요.';
    } catch (error) {
      autoLocInput.checked = !autoLocInput.checked;
      card.$('vehicleManageError').textContent = error.message || '장소 자동 선택 설정을 저장하지 못했어요.';
    } finally {
      autoLocInput.disabled = false;
    }
  };
  const defaultsTitle = element('h4', 'tariff-section-title', '기본 충전 단가');
  const defaults = element('form', 'tariff-default-form');
  defaultsTitle.hidden = defaults.hidden = true;
  const inputs = {};
  for (const [mode, title, electricalMode] of [['fast', '급속', 'DC'], ['slow', '완속', 'AC']]) {
    const label = element('label', 'tariff-default-field');
    label.dataset.mode = mode;
    const name = element('span', 'tariff-rate-name');
    const indicator = element('span', 'tariff-rate-mode', electricalMode);
    indicator.setAttribute('aria-hidden', 'true');
    name.append(indicator, element('strong', '', title));
    const pair = element('span', 'tariff-input');
    inputs[mode] = rateInput(`기본 ${title} 단가`);
    inputs[mode].name = mode;
    pair.append(inputs[mode], element('span', '', '원/kWh'));
    label.append(name, pair);
    defaults.append(label);
  }
  const saveDefaults = button('기본 단가 저장');
  saveDefaults.type = 'submit';
  saveDefaults.className = 'tariff-default-save';
  const defaultActions = element('div', 'tariff-default-actions');
  const defaultFeedback = element('span', 'tariff-default-feedback');
  defaultFeedback.setAttribute('role', 'status');
  defaultActions.append(defaultFeedback, saveDefaults);
  defaults.append(defaultActions);
  defaults.onsubmit = async event => {
    event.preventDefault();
    const rates = {};
    for (const [mode, input] of Object.entries(inputs)) {
      const value = readRate(input);
      if (value === null || value > 1_000_000) {
        defaultFeedback.textContent = '0~1,000,000원/kWh 범위의 정수 단가를 입력해 주세요.';
        input.focus();
        return;
      }
      rates[mode] = value;
    }
    const entry = card.entry;
    saveDefaults.disabled = true;
    try {
      const saved = await card.call('charge/rates', {entry_id: entry, rates});
      if (entry === card.entry) {
        for (const mode of Object.keys(inputs)) inputs[mode].value = format.format(saved[mode]);
        defaultFeedback.textContent = '저장했어요. 진행 중인 충전의 추정과 새 기록에 적용돼요.';
      }
    } catch (error) {
      defaultFeedback.textContent = error.message || '기본 단가를 저장하지 못했어요.';
    } finally {
      saveDefaults.disabled = false;
    }
  };
  pane.append(heading, autoLocCard, defaultsTitle, defaults, element('h4', 'tariff-section-title', '즐겨찾기 충전 단가'), list, status);
  card.$('vehicleManageDialog').querySelector('.settings-content').append(pane);

  async function render(message = '') {
    const entry = card.entry;
    status.textContent = message;
    list.replaceChildren();
    try {
      const [favorites, rates] = await Promise.all([
        card.call('favorite/list', {entry_id: entry}), card.call('charge/rates', {entry_id: entry}),
      ]);
      if (entry !== card.entry || pane.hidden) return;
      defaultsTitle.hidden = defaults.hidden = !rates;
      defaultFeedback.textContent = '';
      if (rates) for (const mode of Object.keys(inputs)) inputs[mode].value = format.format(rates[mode]);
      if (!rates) {
        list.append(element('p', 'note', '연결된 전기차에서 충전 단가를 설정할 수 있어요.'));
        return;
      }
      list.replaceChildren(...favorites.map(favorite => renderFavorite(favorite, entry)));
      if (!favorites.length) list.append(element('p', 'note', '이 차량에 등록된 즐겨찾기 충전소가 없어요.'));
    } catch (error) {
      status.textContent = error.message || '즐겨찾기 충전소를 불러오지 못했어요.';
    }
  }

  function renderFavorite(favorite, entry) {
    const section = element('section', 'tariff-card');
    section.dataset.favoriteTariff = favorite.id;
    const price = favorite.unit_price_krw;
    section.dataset.priced = String(price != null);
    const info = element('div', 'tariff-info');
    const place = element('div', 'tariff-place');
    const name = favorite.location.name;
    place.append(element('strong', '', name), element('small', '', favorite.location.address));
    const identity = element('div', 'tariff-identity');
    const icon = element('span', 'tariff-icon', '★');
    icon.setAttribute('aria-hidden', 'true');
    identity.append(icon, place);
    const current = element('div', price == null ? 'tariff-unset' : 'tariff-current');
    if (price == null) current.textContent = '단가 미설정';
    else current.append(element('b', '', format.format(price)), element('small', '', '원/kWh'));
    info.append(identity, current);
    const actions = element('div', 'tariff-actions');
    const edit = button(price == null ? '단가 추가' : '단가 수정', openEditor);
    if (price == null) edit.classList.add('tariff-primary');
    actions.append(edit);
    if (price != null) {
      const remove = button('단가 삭제', confirmRemoval);
      remove.classList.add('tariff-delete');
      actions.append(remove);
    }
    const editor = element('form', 'tariff-actions');
    editor.hidden = true;
    const label = element('label', 'tariff-input');
    const input = rateInput(`${name} 고정 충전 단가`);
    label.append(input, element('span', '', '원/kWh'));
    const save = button('저장');
    save.type = 'submit';
    save.classList.add('tariff-primary');
    const cancel = button('취소', closeEditor);
    const controls = element('div', 'tariff-controls');
    controls.append(save, cancel);
    editor.append(label, controls);
    editor.addEventListener('submit', async event => {
      event.preventDefault();
      const value = readRate(input);
      if (value === null || value > 1_000_000) {
        status.textContent = '0~1,000,000원/kWh 범위의 정수 단가를 입력해 주세요.';
        input.focus();
        return;
      }
      save.disabled = true;
      try { await update(value); } finally { save.disabled = false; }
    });
    section.append(info, actions, editor);
    return section;

    function openEditor() {
      status.textContent = '';
      input.value = price == null ? '' : format.format(price);
      actions.hidden = true;
      editor.hidden = false;
      input.focus();
      input.select();
    }

    function closeEditor() {
      editor.hidden = true;
      actions.hidden = false;
      status.textContent = '';
      edit.focus();
    }

    async function confirmRemoval(event) {
      if (!confirm(`${name}의 고정 단가를 삭제할까요? 이미 기록에 적용된 단가는 보관돼요.`)) return;
      const control = event.currentTarget;
      control.disabled = true;
      try { await update(null); } finally { control.disabled = false; }
    }

    async function update(value) {
      try {
        await card.call('favorite/rate', {entry_id: entry, favorite_id: favorite.id, unit_price_krw: value});
        await render(value == null ? `${name}의 고정 단가를 삭제했어요.` : `${name}에 ${format.format(value)}원/kWh를 저장했어요.`);
        list.querySelector(`[data-favorite-tariff="${CSS.escape(favorite.id)}"] button`)?.focus();
      } catch (error) {
        status.textContent = error.message || '단가를 저장하지 못했어요.';
      }
    }
  }

  return render;
}
