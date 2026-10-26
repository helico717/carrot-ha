"""Copy the pinned original renderer and its ES module dependency graph."""
import argparse
from pathlib import Path, PurePosixPath
import posixpath
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--openpilot-root', required=True, type=Path)
args = parser.parse_args()
dest = Path(__file__).resolve().parents[1] / 'custom_components/carrot_ha/frontend/carrot_logs'
ref = re.search(r'`([0-9a-f]{40})`', (dest / 'SOURCE.md').read_text(encoding='utf-8'))[1]
copied = set()


def copy(name):
    if name in copied:
        return
    copied.add(name)
    data = subprocess.check_output(['git', 'show', f'{ref}:openpilot/selfdrive/carrot/web/{name}'], cwd=args.openpilot_root).decode('utf-8')
    if name.startswith('src/'):
        for dependency in re.findall(r'(?:from\s*|import\s*)[\'"](\.[^\'"]+)[\'"]', data):
            if not dependency.startswith('.'):
                raise ValueError(f'Unexpected external import: {dependency}')
            copy(posixpath.normpath(str(PurePosixPath(name).parent / dependency)))
    data = data.replace('"/js/', '"/carrot_ha_static/carrot_logs/js/').replace("'/js/", "'/carrot_ha_static/carrot_logs/js/")
    if name.endswith('/hud/assets.js'):
        data = data.replace('"/shared-assets"', '"/carrot_ha_static/carrot_logs/shared-assets"')
    output = dest / name
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(data, encoding='utf-8')


copy('src/features/drive/contents/vision/index.js')
for name in ['vision_state', 'vision_raw', 'vision_webgl2', 'home_drive']:
    copy(f'js/realtime/{name}.js')
assets = (dest / 'src/features/drive/contents/vision/hud/assets.js').read_text(encoding='utf-8')
for name in re.findall(r'\$\{ROOT\}/([^`]+)', assets):
    data = subprocess.check_output(['git', 'show', f'{ref}:openpilot/selfdrive/assets/{name}'], cwd=args.openpilot_root)
    output = dest / 'shared-assets' / name
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)
print(f'Copied {len(copied)} renderer files from {ref}')
