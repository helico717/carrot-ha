"""Bounded diagnostics without request bodies, credentials, GPS or device identifiers."""
from collections import Counter
from contextvars import ContextVar
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import time

request_id = ContextVar('receiver_request_id', default='-')
vehicle_label = ContextVar('receiver_vehicle_label', default='-')
ROUTES = frozenset(('/health', '/api/source', '/api/provision', '/api/telemetry', '/api/trips',
    '/api/latest-state', '/api/telemetry-history', '/api/trip-changes', '/api/archive-ack',
    '/api/settings/sync', '/api/settings', '/api/params/queue', '/api/params/pending',
    '/api/params/ack', '/api/params/status', '/api/terminal/bootstrap'))


class ContextFilter(logging.Filter):
    def filter(self, record):
        record.request, record.vehicle = request_id.get(), vehicle_label.get()
        return True


def configure(data, level='INFO'):
    if level not in ('DEBUG', 'INFO', 'WARNING', 'ERROR'):
        raise ValueError('invalid_log_level')
    directory = Path(data) / 'logs'
    directory.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter('%(asctime)sZ %(levelname)s request=%(request)s vehicle=%(vehicle)s %(message)s',
                                  datefmt='%Y-%m-%dT%H:%M:%S')
    formatter.converter = time.gmtime
    logger = logging.getLogger('carrot_receiver')
    logger.setLevel(level)
    logger.propagate = False
    for old in logger.handlers[:]:
        logger.removeHandler(old)
        old.close()
    for handler in (logging.StreamHandler(), RotatingFileHandler(directory / 'receiver.log',
                         maxBytes=2 * 1024 * 1024, backupCount=3, encoding='utf-8')):
        handler.addFilter(ContextFilter())
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger


class Diagnostics:
    def __init__(self, logger, clock=time.monotonic):
        self.logger, self.clock = logger, clock
        self.counts, self.errors, self.max_ms = Counter(), {}, 0

    def record(self, method, path, status, duration_ms, error=None):
        path = path if path in ROUTES else 'unknown'
        method = method if method in ('GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD') else 'OTHER'
        self.counts[(method, path, status)] += 1
        self.max_ms = max(self.max_ms, duration_ms)
        self.logger.debug('http method=%s endpoint=%s status=%d duration_ms=%.1f', method, path, status, duration_ms)
        if status < 400:
            return
        key = (method, path, status, error or 'http_error')
        now = self.clock()
        previous, suppressed = self.errors.get(key, (float('-inf'), 0))
        if now - previous < 30:
            self.errors[key] = (previous, suppressed + 1)
            return
        self.errors[key] = (now, 0)
        self.logger.log(logging.ERROR if status >= 500 else logging.WARNING,
            'http_failed method=%s endpoint=%s status=%d error_type=%s repeated_suppressed=%d',
            method, path, status, error or 'http_error', suppressed)

    def summary(self):
        if self.counts:
            entries = ['%s:%s:%d=%d' % (*key, count) for key, count in sorted(self.counts.items())]
            self.logger.info('traffic_summary requests=%d max_duration_ms=%.1f results=%s',
                             sum(self.counts.values()), self.max_ms, ' '.join(entries))
            self.counts.clear()
            self.max_ms = 0
