"""Vendor the original Carrot HTTP upload protocol and result formatting."""
import argparse
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--openpilot-root', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
ref = re.search(r'`([0-9a-f]{40})`', (root / 'custom_components/carrot_ha/frontend/carrot_logs/SOURCE.md').read_text(encoding='utf-8'))[1]
for source, target in [('web_upload.py', 'upstream_upload.py'),
                       ('server/services/dashcam_upload_report.py', 'upstream_upload_report.py')]:
    data = subprocess.check_output(['git', 'show', f'{ref}:openpilot/selfdrive/carrot/{source}'], cwd=args.openpilot_root)
    (root / 'custom_components/carrot_ha/driving_logs' / target).write_bytes(data)
print(f'Copied original upload protocol from {ref}')
