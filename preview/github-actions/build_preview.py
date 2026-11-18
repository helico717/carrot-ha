"""Patch only a preview copy until the owner approves the complete terminal UI."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('/private/tmp/carrot-github-actions-preview')
METHOD = r'''
  _paintActionsSync() {
    const root = this.shadowRoot.getElementById('actions-sync');
    if (!root) return;
    const data = this._gitStatus.actions_sync || {};
    const state = data.state || 'checking';
    const labels = {healthy:'예약 실행 정상', pending:'원본 업데이트 대기', overdue:'예약 실행 12시간 초과',
      failed:'최근 실행 실패', disabled:'워크플로 비활성', unavailable:'GitHub 확인 불가', running:'실행 중',
      no_schedule:'예약 실행 기록 없음', unconfirmed:'예약 성공 미확인', checking:'첫 확인 중'};
    root.dataset.state = state;
    const put = (id, value) => { root.querySelector('#' + id).textContent = value; };
    const date = value => {
      const d = new Date(value);
      return value && Number.isFinite(d.getTime()) ? d.toLocaleString('ko-KR', {
        timeZone: this._hass?.config?.time_zone || 'Asia/Seoul', month:'numeric', day:'numeric',
        hour:'2-digit', minute:'2-digit', hour12:false}) : '미확인';
    };
    const run = row => {
      if (!row) return '기록 없음';
      const result = {success:'성공',failure:'실패',cancelled:'취소',timed_out:'시간 초과',
        skipped:'건너뜀',neutral:'중립',action_required:'조치 필요'};
      return `${row.event === 'schedule' ? '예약' : row.event === 'workflow_dispatch' ? '수동' : '기타'} · ${row.status !== 'completed' ? '실행 중' : result[row.conclusion] || '확인 필요'} · ${date(row.created_at)}`;
    };
    put('actions-state', labels[state] || '상태 미확인');
    put('actions-latest', data.latest_run ? run(data.latest_run) : '기록 없음');
    put('actions-scheduled', data.scheduled_run ? run(data.scheduled_run) : '기록 없음');
    const pending = data.comparison?.upstream_pending;
    put('actions-pending', Number.isInteger(pending) ? `${pending.toLocaleString('ko-KR')}개${pending === 0 ? ' · 최신 반영' : ' · 병합 대기'}` : '확인 불가');
    put('actions-checked', date(data.last_attempt_at));
    let note = 'HA 서버에서 6시간마다 점검 · 기기 연결 없이 확인';
    if (state === 'overdue') note = '최근 수동 실행과 별개로, 예약 실행이 12시간 넘게 없습니다.';
    if (state === 'failed') note = '최근 실행 결과를 확인하세요. 이전 성공만으로 정상 판단하지 않습니다.';
    if (state === 'disabled') note = 'GitHub에서 워크플로 활성 상태를 확인하세요.';
    if (state === 'no_schedule' || state === 'unconfirmed') note = '수동 실행 성공과 예약 실행 복구는 별도로 확인합니다.';
    if (state === 'pending') note = '원본 변경이 아직 HA 브랜치에 병합되지 않았습니다.';
    if (state === 'unavailable') note = `이전 결과 표시 · 마지막 전체 확인 ${date(data.last_success_at)}. 조회 실패를 정상으로 표시하지 않습니다.`;
    if (this._gitStatus.error === 'ha_unavailable') {
      put('actions-state', 'HA 연결 확인 불가');
      root.dataset.state = 'unavailable';
      note = '화면 연결이 끊겼습니다. 아래 값은 마지막으로 받은 결과입니다.';
    }
    put('actions-note', note);
    const link = root.querySelector('#actions-run-link');
    const id = data.latest_run?.id;
    link.href = Number.isSafeInteger(id) && id > 0
      ? `https://github.com/helico717/openpilot/actions/runs/${id}`
      : 'https://github.com/helico717/openpilot/actions/workflows/sync_upstream_model_selector.yml';
  }
'''
CSS = '''
        .actions-sync { padding: 13px 16px; border-top:1px solid var(--divider-color, #343944); color:var(--primary-text-color,#e8eaf0); }
        .sync-heading { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .sync-heading strong { font-size:12px; font-weight:650; }
        .sync-state { display:inline-flex; align-items:center; gap:6px; font-size:11px; line-height:1.5; padding:3px 8px; border-radius:7px; color:var(--secondary-text-color,#a9b0be); background:color-mix(in srgb,currentColor 9%,transparent); }
        .sync-state::before { content:''; width:6px; height:6px; border-radius:50%; background:currentColor; flex:none; }
        .actions-sync[data-state="healthy"] .sync-state { color:var(--success-color,#43a878); }
        .actions-sync:is([data-state="pending"],[data-state="overdue"],[data-state="no_schedule"],[data-state="unconfirmed"]) .sync-state { color:var(--warning-color,#be8a21); }
        .actions-sync:is([data-state="failed"],[data-state="disabled"]) .sync-state { color:var(--error-color,#e36161); }
        .actions-sync[data-state="running"] .sync-state { color:var(--primary-color,#2196f3); }
        .sync-heading a { margin-left:auto; color:var(--primary-color,#2196f3); font-size:11px; text-decoration:none; padding:3px 0; }
        .sync-heading a:hover { text-decoration:underline; }
        .sync-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 18px; margin:13px 0 0; }
        .sync-grid div { min-width:0; }
        .sync-grid dt { font-size:10px; color:var(--secondary-text-color,#a9b0be); margin:0 0 4px; }
        .sync-grid dd { font-size:12px; line-height:1.5; margin:0; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
        .sync-note { font-size:10px; line-height:1.6; margin:12px 0 0; color:var(--secondary-text-color,#a9b0be); overflow-wrap:anywhere; }
        @media(max-width:360px) { .sync-grid { grid-template-columns:1fr; } }
'''
HTML = '''
        <section id="actions-sync" class="actions-sync" aria-label="원본 자동 동기화" role="status" aria-live="polite">
          <div class="sync-heading"><strong>원본 자동 동기화</strong><span id="actions-state" class="sync-state">첫 확인 중</span><a id="actions-run-link" target="_blank" rel="noopener noreferrer" href="https://github.com/helico717/openpilot/actions/workflows/sync_upstream_model_selector.yml">GitHub에서 보기 ↗</a></div>
          <dl class="sync-grid">
            <div><dt>최근 실행</dt><dd id="actions-latest">미확인</dd></div>
            <div><dt>최근 예약 실행</dt><dd id="actions-scheduled">미확인</dd></div>
            <div><dt>원본 미반영 커밋</dt><dd id="actions-pending">확인 중</dd></div>
            <div><dt>HA 마지막 점검</dt><dd id="actions-checked">미확인</dd></div>
          </dl>
          <p id="actions-note" class="sync-note">HA 서버에서 6시간마다 점검 · 기기 연결 없이 확인</p>
        </section>
'''


def patched(source):
    if '  _paintActionsSync() {' in source:
        return source
    assert source.count('  _fit() {') == 1
    source = source.replace('  _fit() {', METHOD + '\n  _fit() {')
    source = source.replace("    status.textContent += ' · 마지막 기기 보고 기준';", "    status.textContent += ' · 마지막 기기 보고 기준';\n    this._paintActionsSync();")
    source = source.replace('      <style>', '      <style>' + CSS)
    source = source.replace('        <!-- Navigation & Helper Keys -->', HTML + '\n        <!-- Navigation & Helper Keys -->')
    return source


def build():
    source = ROOT / 'custom_components/carrot_ha/frontend'
    # The complete production terminal element and its real xterm dependencies are mirrored.
    target = OUT / 'carrot_ha_static'
    target.mkdir(parents=True, exist_ok=True)
    (target / 'carrot-terminal-card.js').write_text(patched((source / 'carrot-terminal-card.js').read_text()))
    for relative in ['carrot_web/js/vendor/xterm.js', 'carrot_web/js/vendor/xterm-addon-fit.js', 'carrot_web/css/vendor/xterm.css']:
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / relative, destination)
    shutil.copy2(Path(__file__).with_name('index.html'), OUT / 'index.html')
    print(OUT)


if __name__ == '__main__':
    build()
