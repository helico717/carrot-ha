"""Local-only preview: original log card/modules with synthetic API data."""
import http.server
import json
from pathlib import Path
import time

ROOT = Path(__file__).resolve().parents[1] / 'custom_components/carrot_ha/frontend'
POLICY = {'enabled': False, 'online': True, 'since': None}
STORAGE = {'used': 3733600006, 'limit': 5000000000, 'nas': {'status': 'available', 'retention_days': 30, 'used': 48889872785, 'routes': 99, 'segments': 3109, 'verified_segments': 3109, 'nas_only_segments': 2800, 'disk_free': 1900000000000, 'path': '/share/synthetic/driving-logs', 'checked_at': time.time()}}
HTML = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>주행 로그 전송 · 프리뷰</title><style>
body{margin:0;background:#111;color:#eee;font-family:Arial;--card-background-color:#1c1c1c;--primary-text-color:#eee;--secondary-text-color:#aaa;--divider-color:#444;--secondary-background-color:#242424}body.light{background:#f5f5f5;color:#222;--card-background-color:white;--primary-text-color:#222;--secondary-text-color:#666;--divider-color:#ddd;--secondary-background-color:#f4f4f4}aside{padding:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}button{cursor:pointer;padding:8px;border-radius:8px}carrot-logs-card{display:block}ha-card{display:block}</style>
<aside><b>합성 데이터 프리뷰 · 실제 전송 없음</b><button id="theme">다크 / 라이트</button><button id="online">차량 연결 / 오프라인</button><button id="settings">전송 설정 열기</button></aside><carrot-logs-card></carrot-logs-card>
<script type="module">customElements.define('ha-icon', class extends HTMLElement {connectedCallback(){this.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="'+({'mdi:cog-outline':'M12 3v3m0 12v3M3 12h3m12 0h3M5 5l2 2m10 10l2 2M5 19l2-2M17 7l2-2M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0','mdi:tune-vertical':'M6 3v5m0 4v9M12 3v10m0 4v4M18 3v2m0 4v12M3 8h6m0 5h6m0-8h6','mdi:close':'M6 6l12 12M6 18L18 6','mdi:refresh':'M20 10a8 8 0 1 0 0 6M20 3v7h-7'}[this.getAttribute('icon')]||'M4 12h16')+'"/></svg>';}});import Card from '/carrot-logs-card.js';const card=document.querySelector('carrot-logs-card');card.setConfig({});card.hass={locale:{language:'ko'},callApi:async(method,url,data)=>{const r=await fetch('/'+url,{method,headers:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(data||{})})});return r.json()}};document.querySelector('#theme').onclick=()=>document.body.classList.toggle('light');document.querySelector('#settings').onclick=()=>card.shadowRoot.querySelector('#logSettingsButton').click();document.querySelector('#online').onclick=async()=>{await fetch('/simulate/online',{method:'POST'});card._previewRefresh?.()};</script></html>'''


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send(self, data, content_type='application/json'):
        body = data.encode() if isinstance(data, str) else json.dumps(data).encode()
        self.send_response(200)
        self.send_header('Content-Type', content_type + '; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/':
            return self.send(HTML, 'text/html')
        if path == '/preview-policy' or path.endswith('/transfer/policy'):
            return self.send({**POLICY, 'applied': POLICY['online']})
        if path.endswith('/devices'):
            return self.send({'devices': [{'entry_id': 'preview', 'device_id': 'synthetic'}]})
        if path.endswith('carrot-logs-settings.js'):
            text = (ROOT / 'carrot-logs-settings.js').read_text(encoding='utf-8')
            return self.send(text, 'application/javascript')
        if path.startswith('/api/'):
            if 'thumbnail' in path or '/dashcam/preview/' in path:
                self.send_response(204); self.end_headers(); return
            if path.endswith('/routes'):
                routes = []
                for idx in range(4):
                    name = f'00000315--4742c01c35--{idx}'
                    routes.append({'route': f'00000315--4742c01c35-{idx}', 'segmentFolders': [name], 'segmentCount': 1, 'routeStartEpoch': 1791949800 + idx*7200, 'routeEndEpoch': 1791949860 + idx*7200, 'latestModifiedEpoch': 1791949860 + idx*7200, 'segmentTimes': {name: {'startEpoch': 1791949800+idx*7200, 'endEpoch': 1791949860+idx*7200}}})
                return self.send({'routes': routes, 'total': 4, 'hasMore': False, 'storage': STORAGE})
            if path.endswith('/storage'):
                return self.send({'storage': STORAGE, 'maintenance': {'phase': 'ready'}})
            return self.send({'ok': True, 'recentSegment': '', 'reports': [], 'jobs': []})
        if path.startswith('/carrot_ha_static/'):
            self.path = self.path.replace('/carrot_ha_static/', '/', 1)
        return super().do_GET()

    def do_POST(self):
        size = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(size)) if size else {}
        if self.path == '/preview-policy' or self.path.endswith('/transfer/policy'):
            POLICY['enabled'] = body.get('enabled', not POLICY['enabled'])
            POLICY['since'] = time.time() if POLICY['enabled'] else None
            return self.send({**POLICY, 'applied': POLICY['online']})
        if self.path == '/simulate/online':
            POLICY['online'] = not POLICY['online']
            return self.send({**POLICY, 'applied': POLICY['online']})
        if self.path.endswith('/session'):
            return self.send({'base': '/api/carrot_ha/v1/driving_logs/preview', 'enabled': True})
        return self.send({'ok': True})


if __name__ == '__main__':
    print('Preview http://127.0.0.1:8089', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', 8089), Handler).serve_forever()
