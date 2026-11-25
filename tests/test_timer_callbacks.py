"""Regression tests ensuring HA time-trackers never wrap async_create_task in sync lambdas."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'custom_components' / 'carrot_ha'
TRACKER_FUNCS = {
    'async_track_time_interval',
    'async_track_time_change',
    'async_track_utc_time_change',
}


def _call_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


class TestTimerCallbacks(unittest.TestCase):
    def test_no_sync_lambda_in_ha_time_trackers(self):
        offenders = []
        for path in sorted(ROOT.rglob('*.py')):
            tree = ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                if _call_name(node.func) not in TRACKER_FUNCS:
                    continue
                action_arg = node.args[1] if len(node.args) >= 2 else None
                for kw in node.keywords:
                    if kw.arg == 'action':
                        action_arg = kw.value
                if isinstance(action_arg, ast.Lambda):
                    offenders.append(f'{path.relative_to(ROOT)}:{node.lineno}')
        self.assertEqual(offenders, [], f'Sync lambda passed to HA time tracker: {offenders}')

    def test_init_registers_purge_vacuum_and_midnight_coroutines_directly(self):
        init_path = ROOT / '__init__.py'
        tree = ast.parse(init_path.read_text(encoding='utf-8'), filename=str(init_path))
        async_defs = {
            node.name for node in ast.walk(tree) if isinstance(node, ast.AsyncFunctionDef)
        }
        registered = {}
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            fname = _call_name(node.func)
            if fname in TRACKER_FUNCS and len(node.args) >= 2 and isinstance(node.args[1], ast.Name):
                registered[node.args[1].id] = fname
        for expected in ('run_daily_purge', 'run_weekly_vacuum', 'refresh_after_midnight'):
            self.assertIn(expected, async_defs)
            self.assertIn(expected, registered)


if __name__ == '__main__':
    unittest.main()
