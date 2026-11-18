"""Versioned journal saves with aggregate, content-free latency diagnostics."""
from contextlib import contextmanager
import logging
from time import perf_counter

from .source import sync

_LOGGER = logging.getLogger(__name__)


class SaveTimings:
    """One request, one worker; never retain payloads or record identities."""

    def __init__(self):
        self.started = perf_counter()
        self.stages = {}

    def since(self, name, started):
        self.stages[name] = (perf_counter() - started) * 1000

    @contextmanager
    def measure(self, name):
        started = perf_counter()
        try:
            yield
        finally:
            self.since(name, started)

    def log(self, outcome):
        total = (perf_counter() - self.started) * 1000
        # Slow requests remain visible with HA's default warning-level logging.
        log = _LOGGER.warning if total >= 2000 else _LOGGER.debug
        log('Journal save timing outcome=%s total_ms=%.1f stages_ms=%s',
            outcome, total, {k: round(v, 1) for k, v in self.stages.items()})


def save_linked(archive, journal, key, expected, payload, timings, queued_at):
    """Preserve the durable payment bridge and full-sync fallback when needed.

    sync() reconciles committed payment writes before testing its cursor. A real
    payment edit advances the archive generation and still gets projected before
    success; an unchanged archive avoids reading all historical trips twice.
    """
    timings.since('executor_wait', queued_at)
    waiting = perf_counter()
    with journal.lock:
        timings.since('journal_lock_wait', waiting)
        with timings.measure('sync_before'):
            sync(archive, journal)
        with timings.measure('save_manual'):
            journal.save_manual(key, expected, payload)
        with timings.measure('sync_after'):
            sync(archive, journal)
        with timings.measure('read_version'):
            with journal.connect() as db:
                version = db.execute('SELECT version FROM records WHERE vehicle_id=? AND id=?',
                                     (journal.vehicle, key)).fetchone()[0]
        return {'id': key, 'version': version}
