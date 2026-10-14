"""Validate a private D1 SQL backup and build lossless in-place recovery SQL.

All production artifacts stay in the explicitly authorized backup directory.
Never print raw records, credentials, locations, or device identities.
Apply before installing archive budget triggers to avoid extra migration writes.
"""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import sqlite3


def prepare(source):
    source = Path(source).resolve()
    database = source.with_suffix('.verified.sqlite3')
    output = source.with_name('lossless-compression.sql')
    if database.exists() or output.exists():
        raise RuntimeError('Refusing to overwrite existing recovery artifacts')
    db = sqlite3.connect(database)
    try:
        statement = ''
        with source.open(encoding='utf-8') as stream:
            for line in stream:
                statement += line
                if sqlite3.complete_statement(statement):
                    db.executescript(statement)
                    statement = ''
        if statement.strip():
            db.executescript(statement)
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Backup integrity check failed')
        count = raw_bytes = packed_bytes = 0
        digest = hashlib.sha256()
        with output.open('x', encoding='utf-8', newline='\n') as stream:
            for seq, at, raw in db.execute('SELECT sequence,updated_at,raw_json FROM telemetry_history ORDER BY sequence'):
                value = json.loads(raw)
                if value.get('_carrot_cloud_archive_v1') == 1:
                    continue
                original = raw.encode()
                zipped = gzip.compress(original, compresslevel=6, mtime=0)
                if gzip.decompress(zipped) != original:
                    raise RuntimeError('Lossless roundtrip failed')
                packed = json.dumps({'_carrot_cloud_archive_v1':1, 'codec':'gzip',
                                     'data':base64.b64encode(zipped).decode()},separators=(',', ':'))
                if len(packed.encode()) >= len(original):
                    continue
                # Sequence identity is immutable; compare timestamp/byte length
                # and legacy encoding too. Do not overwrite concurrent new rows.
                quote = lambda text: "'" + text.replace("'", "''") + "'"
                stream.write(f'UPDATE telemetry_history SET raw_json={quote(packed)} WHERE sequence={int(seq)} '
                             f'AND updated_at={quote(at)} AND length(CAST(raw_json AS BLOB))={len(original)} '
                             "AND json_extract(raw_json,'$._carrot_cloud_archive_v1') IS NULL;\n")
                count += 1; raw_bytes += len(original); packed_bytes += len(packed.encode())
                digest.update(str(seq).encode()+b'\0'+original)
        summary = {'backup_integrity':'ok','rows':count,'original_bytes':raw_bytes,
                   'compressed_bytes':packed_bytes,'verified_original_sha256':digest.hexdigest(),
                   'sql_bytes':output.stat().st_size}
        source.with_name('compression-verification.json').write_text(json.dumps(summary,indent=2))
        print(json.dumps(summary))
    finally:
        db.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('backup')
    prepare(parser.parse_args().backup)
