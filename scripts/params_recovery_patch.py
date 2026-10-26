"""HA adaptations to the vendored upstream settings page (also used in previews)."""
from pathlib import Path


def apply_recovery(root):
    root = Path(root)
    api = root / 'js/shared/api.js'
    s = api.read_text()
    s = s.replace('await getParamCommitter().commit(name, value, options);\n  return true;',
                  'const result = await getParamCommitter().commit(name, value, options);\n  return result.value;')
    api.write_text(s)
    page = root / 'js/setting_page.js'
    s = page.read_text()
    if 'ha-param-state' in s:
        return
    s = s.replace('    async function commitSettingValue(next, commitOptions = {}) {\n      try {', '''    let haCommitPending = false;
    const haState = document.createElement('div');
    haState.className = 'ha-param-state';
    haState.setAttribute('role', 'status');
    haState.style.cssText = 'font-size:13px;line-height:1.5;padding:6px 0;color:var(--md-primary);overflow-wrap:anywhere';
    el.appendChild(haState);
    async function commitSettingValue(next, commitOptions = {}) {
      if (haCommitPending) return;
      haCommitPending = true;
      const confirmed = val.dataset.committedValue ?? val.dataset.rawValue;
      const controls = [...el.querySelectorAll('button,input,select')];
      const disabled = controls.map(node => node.disabled);
      controls.forEach(node => node.disabled = true);
      el.setAttribute('aria-busy', 'true');
      haState.textContent = `適用待機`.replace('適用待機', `適用待機`);
      haState.textContent = `적용 대기 · 마지막 확인 ${confirmed} → 요청 ${next}`;
      try {''')
    s = s.replace("      haState.textContent = `適用待機`.replace('適用待機', `適用待機`);\n", '')
    s = s.replace('          await setParam(name, next, commitOptions);', '          next = await setParam(name, next, commitOptions);')
    start = s.index('    async function commitSettingValue(')
    end = s.index('\n    function bindPopularDetailRows()', start)
    section = s[start:end]
    section = section.replace('        syncSettingControlState(el, next);', "        haState.textContent = `차량 확인값: ${next}`;\n        syncSettingControlState(el, next);")
    section = section.replace('      } catch (e) {\n        showAppToast', '''      } catch (e) {
        // Restore every kind of control, including native toggles/selects,
        // and the value cache; the requested value is never a confirmed value.
        syncSettingControlState(el, confirmed);
        val.dataset.committedValue = String(confirmed);
        if (!profile) {
          cacheSettingValue(name, confirmed, group);
          if (originGroup !== group) cacheSettingValue(name, confirmed, originGroup);
        }
        haState.textContent = e.uncertain
          ? `적용 여부 미확인 · 마지막 확인값 ${confirmed} 표시 · 차량 값 재확인 중`
          : `변경 실패 · 마지막 확인값 ${confirmed} 복원`;
        showAppToast''')
    section = section.replace('tone: "error" });\n      }\n', '''tone: "error" });
      } finally {
        haCommitPending = false;
        el.removeAttribute('aria-busy');
        controls.forEach((node, i) => node.disabled = disabled[i]);
      }
''')
    s = s[:start] + section + s[end:]
    page.write_text(s)
    bridge = root / 'js/ha_bridge.js'
    s = bridge.read_text().replace("return cachedSnapshot;", "return structuredClone(cachedSnapshot);")
    s = s.replace("reject(new Error('적용 확인 시간 초과. 차량 재연결 후 실제 값을 확인하세요.'));", "reject(Object.assign(new Error('적용 여부 미확인. 마지막 확인값을 표시합니다.'), {uncertain: true}));")
    s = s.replace("} else req.reject(new Error(msg.error || '변경 실패'));", "} else req.reject(Object.assign(new Error(msg.error || '변경 실패'), {uncertain: !!msg.uncertain}));")
    bridge.write_text(s)
