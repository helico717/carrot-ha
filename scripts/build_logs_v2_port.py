"""Reproducibly package the original Carrot Routes UI and production replay engine."""
import argparse
import ast
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--openpilot-root', type=Path, required=True)
parser.add_argument('--ref', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
def git(*values):
    return subprocess.check_output(['git', *values], cwd=args.openpilot_root)
commit = git('rev-parse', args.ref + '^{commit}').decode().strip()
builder = ast.parse(git('show', f'{commit}:tools/carrot_route_vault/build_bundle.py').decode())
paths = ast.literal_eval(next(n.value for n in builder.body if isinstance(n, ast.Assign) and n.targets[0].id == 'SOURCES'))
archive = tarfile.open(fileobj=io.BytesIO(git('archive', commit, *paths, 'LICENSE')))
files = {}
for item in archive:
    path = Path(item.name)
    if item.isfile() and ('tests' not in path.parts) and (path.suffix in {'.py', '.pyx', '.capnp', '.dbc'} or path.name == 'LICENSE'):
        files[item.name] = archive.extractfile(item).read()
# Namespace roots are explicit for Python and importlib.resources in the isolated child.
for name in list(files):
    if name.endswith('.py'):
        for parent in Path(name).parents:
            if str(parent) != '.':
                files.setdefault(parent.as_posix() + '/__init__.py', b'')
output = io.BytesIO()
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
        zipped.writestr(info, data)
engine = root / 'custom_components/carrot_ha/driving_logs/radar_engine'
engine.mkdir(exist_ok=True)
payload = output.getvalue()
(engine / 'source.zip').write_bytes(payload)
(engine / 'SOURCE.json').write_text(json.dumps({'commit': commit, 'sha256': hashlib.sha256(payload).hexdigest(),
    'files': {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}}, indent=2)+'\n', encoding='utf-8')
viewer = ast.parse(git('show', f'{commit}:tools/carrot_route_vault/viewer.py').decode())
constants = {}
for node in viewer.body:
    if not isinstance(node, ast.Assign) or not isinstance(node.targets[0], ast.Name): continue
    name = node.targets[0].id
    if name in ('COMMON_STYLE', 'BRAND'):
        constants[name] = ast.literal_eval(node.value)
    if name == 'SHARE_HTML':
        value = node.value
        while isinstance(value, ast.Call): value = value.func.value
        html = ast.literal_eval(value)
html = html.replace('__COMMON_STYLE__', constants['COMMON_STYLE']).replace('__BRAND__', constants['BRAND'])
html = html.replace('/assets/radar_view.js', '/carrot_ha_static/carrot_logs/v2/radar_view.js')
html = html.replace('Shared route', 'HA authenticated').replace('링크에 포함된 ${d.segmentCount}개 로그만 공개', '선택한 ${d.segmentCount}개 로그 · HA 인증')
html = html.replace('링크를 전달받은 사람만 접근할 수 있습니다.', 'Home Assistant 인증으로 보호되는 주행 로그입니다.').replace('hosted on Synology', 'Home Assistant · HA/NAS')
html = html.replace('<a class="brand" href="/">', '<a class="brand" href="#">')
html = html.replace('Shared Carrot Route · __ROUTE_TITLE__', 'Carrot Routes · Replay V2')
html = html.replace('</style></head>', '.segment summary{flex-wrap:wrap}.segment summary strong{overflow-wrap:anywhere;min-width:0}h1,h2,.brand{letter-spacing:0}.share-hero h1{font-size:36px}@media(max-width:600px){.share-hero h1{font-size:26px}.card-pad{padding:14px}.radar-transport{flex-wrap:wrap}}\n</style></head>')
html = html.replace('이 공유 링크가 허용한 route 하나만 조회됩니다.', '선택한 세그먼트만 조회됩니다. 명령의 접근 키는 15분 후 만료됩니다. 외부에 공유하지 마세요.')
target = root / 'custom_components/carrot_ha/frontend/carrot_logs/v2'; target.mkdir(exist_ok=True)
(target / 'route.html').write_text(html, encoding='utf-8')
(target / 'radar_view.js').write_bytes(git('show', f'{commit}:tools/carrot_route_vault/radar_view.js'))
(target / 'SOURCE.json').write_text(json.dumps({'commit':commit,'source':'tools/carrot_route_vault','adapters':['HA authenticated paths and labels']},indent=2)+'\n')
print(json.dumps({'commit':commit,'engine_files':len(files),'zip_bytes':len(payload)}))
