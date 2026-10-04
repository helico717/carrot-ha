"""Create a plain-JSON recovery copy; never overwrite or mutate the source.

Usage: python3 scripts/restore_archive_json.py source.sqlite3 restored.sqlite3
Run from a checkout of the compression-capable release. The result can be opened
by older Carrot HA versions. Stop HA before replacing its database with this copy.
"""
import argparse
import importlib.util
import sqlite3
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.output.exists() or args.output.resolve() == args.source.resolve():
        parser.error('Output must be a new file distinct from source')
    codec_path = Path(__file__).resolve().parents[1] / 'custom_components/carrot_ha/archive_codec.py'
    spec = importlib.util.spec_from_file_location('archive_codec', codec_path)
    codec = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(codec)
    source = sqlite3.connect(args.source.resolve().as_uri() + '?mode=ro', uri=True)
    target = sqlite3.connect(args.output)
    try:
        source.backup(target, pages=256)
        changed = 0
        after = 0
        while True:
            rows = target.execute('SELECT rowid,body FROM events WHERE rowid>? ORDER BY rowid LIMIT 200', (after,)).fetchall()
            if not rows:
                break
            with target:
                for rowid, body in rows:
                    raw = codec.unpack(body)
                    if raw != body:
                        target.execute('UPDATE events SET body=? WHERE rowid=?', (raw, rowid))
                        changed += 1
            after = rows[-1][0]
        target.execute('VACUUM')
        if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Restored database failed integrity check')
        print(f'Restored {changed} records to {args.output}; source unchanged')
    finally:
        target.close()
        source.close()


if __name__ == '__main__':
    main()
