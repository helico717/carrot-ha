"""Build a credential-free comma camera bundle and a manual HA installation ZIP."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    output = ROOT / '.preview' / 'camera-release'
    output.mkdir(parents=True, exist_ok=True)
    version = json.loads((ROOT / 'custom_components/carrot_ha/manifest.json').read_text())['version']
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip())
    build_info = json.dumps({'version': version, 'source_commit': revision, 'working_tree_modified': dirty}, indent=2) + '\n'
    agent_path = output / f'carrot-camera-agent-{version}.zip'
    with zipfile.ZipFile(agent_path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted((ROOT / 'camera_agent').iterdir()):
            if path.suffix in ('.py', '.sh'):
                archive.writestr('carrot-camera/' + path.name, path.read_bytes().replace(b'\r\n', b'\n'))
        archive.write(ROOT / 'custom_components/carrot_ha/camera_session.py', 'carrot-camera/camera_session.py')
        archive.write(ROOT / 'scripts/camera_smoke_test.py', 'carrot-camera/camera_smoke_test.py')
        archive.writestr('carrot-camera/build_info.json', build_info)
    integration_path = output / f'carrot_ha-{version}.zip'
    with zipfile.ZipFile(integration_path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted((ROOT / 'custom_components/carrot_ha').rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix not in ('.pyc', '.pyo'):
                archive.write(path, str(path.relative_to(ROOT)).replace('\\', '/'))
        archive.writestr('custom_components/carrot_ha/build_info.json', build_info)
    checksums = []
    for path in (agent_path, integration_path):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        checksums.append(f'{digest}  {path.name}')
        print(str(path))
        print('sha256: ' + digest)
    (output / 'SHA256SUMS.txt').write_text('\n'.join(checksums) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
