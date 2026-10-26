"""Build a latest-upstream settings candidate without changing production files.

Usage: python3 scripts/build_params_preview.py --openpilot PATH --ref SHA
Copies the complete HA frontend and supplies synthetic settings data.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import shutil
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--openpilot', required=True)
parser.add_argument('--ref', required=True)
parser.add_argument('--target', default='/private/tmp/carrot-params-preview/carrot_ha_static/carrot_web')
args = parser.parse_args()
target = Path(args.target).resolve()
production = Path(__file__).resolve().parents[1] / 'custom_components/carrot_ha/frontend/carrot_web'
if target == production.resolve() or production.resolve() in target.parents:
    raise SystemExit('Preview target must be outside production assets')
if target.parent.name != 'carrot_ha_static':
    raise SystemExit('Target must end in carrot_ha_static/carrot_web')
shutil.copytree(production.parent, target.parent, dirs_exist_ok=True)
fixture = Path(__file__).parent / 'fixtures/params-preview.html'
shutil.copyfile(fixture, target.parent.parent / 'index.html')

def git(*arguments):
    return subprocess.check_output(['git', '-C', args.openpilot, *arguments])

commit = git('rev-parse', args.ref).decode().strip()
prefix = 'openpilot/selfdrive/carrot/web/'
paths = git('ls-tree', '-r', '--name-only', commit, prefix).decode().splitlines()
available = {name[len(prefix):] for name in paths}
mapping = {
    'js/app.js': 'js/generated/app.js',
    'js/settings.js': 'js/generated/settings.js',
    'js/setting_page.js': 'js/pages/setting.js',
    'css/design-tokens.css': 'css/generated/design-tokens.css',
    'css/design-system.css': 'css/generated/design-system.css',
    'css/settings.css': 'css/generated/settings.css',
}
changed = {}
# These retained full-app assets are not used by the standalone settings page.
excluded = {
    'css/generated/logs.css', 'css/generated/tools.css',
    'css/components/nav_status_badges.css', 'js/shared/ui/nav_status_badges.js',
}
# Use the installed HA file list, retaining the standalone HTML and HA bridge.
for installed in production.rglob('*'):
    if not installed.is_file():
        continue
    relative = installed.relative_to(production).as_posix()
    if relative in excluded:
        continue
    source = mapping.get(relative, relative)
    if source not in available:
        continue
    data = git('show', f'{commit}:{prefix}{source}')
    if data == installed.read_bytes():
        continue
    destination = target / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    changed[relative] = {'source': source, 'sha256': hashlib.sha256(data).hexdigest()}

html = target / 'settings.html'
content = html.read_text()
if 'interactive-widget=' not in content:
    content = content.replace('maximum-scale=1,', 'maximum-scale=1, interactive-widget=resizes-visual,')
# Match the upstream search DOM as well as its JavaScript/CSS.
upstream_html = git('show', f'{commit}:{prefix}index.html').decode()
search_pattern = r'<form id="settingInlineSearch"[\s\S]*?</form>'
upstream_search = re.search(search_pattern, upstream_html).group(0)
content = re.sub(search_pattern, lambda _: upstream_search, content)
html.write_text(content)
# The upstream navigation now owns parent navigation. Remove the legacy HA
# listener, which otherwise runs in addition to upstream's onclick handler.
bridge = target / 'js/ha_bridge.js'
bridge_source = bridge.read_text()
start = bridge_source.index("    document.getElementById('itemsTitle')?.addEventListener")
end = bridge_source.index("    send({type: 'carrot:ready'});", start)
bridge.write_text(bridge_source[:start] + bridge_source[end:])
(target.parent.parent / 'params-source.json').write_text(json.dumps({
    'repository': 'ajouatom/openpilot', 'commit': commit,
    'files': changed, 'status': 'preview only; not deployed',
}, ensure_ascii=False, indent=2) + '\n')
# Independent complete module trees prevent the two implementations sharing
# registered custom elements, globals, settings state or fixed iframe URLs.
preview_root = target.parent.parent
for variant, source in [('before', production.parent), ('after', target.parent)]:
    static = preview_root / variant / 'carrot_ha_static'
    shutil.copytree(source, static, dirs_exist_ok=True)
    for asset in static.rglob('*'):
        if asset.is_file() and asset.suffix in ('.js', '.css', '.html'):
            text = asset.read_text()
            asset.write_text(text.replace('/carrot_ha_static/', f'/{variant}/carrot_ha_static/'))
    child = fixture.read_text().replace('/carrot_ha_static/', f'/{variant}/carrot_ha_static/')
    (preview_root / variant / 'index.html').write_text(child)
shutil.copyfile(Path(__file__).parent / 'fixtures/params-compare.html', preview_root / 'compare.html')
print(json.dumps({'commit': commit, 'changed_files': len(changed), 'target': str(target)}))
