"""Sync bundled Carrot HA blueprints into Home Assistant's blueprints directory."""

from __future__ import annotations

import logging
from pathlib import Path

_LOGGER = logging.getLogger(__name__)
_BUNDLED_BLUEPRINTS_DIR = Path(__file__).parent / 'blueprints'


def sync_blueprints(target_blueprints_dir: Path, source_dir: Path | None = None) -> list[str]:
    """Copy or update bundled YAML blueprints into HA's config/blueprints directory.

    Returns the list of relative blueprint paths that were created or updated.
    """
    src_root = source_dir or _BUNDLED_BLUEPRINTS_DIR
    if not src_root.is_dir():
        return []

    updated: list[str] = []
    for src_file in sorted(src_root.rglob('*.yaml')):
        if not src_file.is_file():
            continue
        rel = src_file.relative_to(src_root)
        dst_file = target_blueprints_dir / rel
        try:
            content = src_file.read_bytes()
            if dst_file.is_file() and dst_file.read_bytes() == content:
                continue
            dst_file.parent.mkdir(parents=True, exist_ok=True)
            dst_file.write_bytes(content)
            updated.append(rel.as_posix())
        except OSError as err:
            _LOGGER.warning('Failed to sync Carrot HA blueprint %s: %s', rel.as_posix(), err)
    return updated
