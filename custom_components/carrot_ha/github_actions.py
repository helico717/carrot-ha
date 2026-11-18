"""Read-only upstream sync health, shared by HA entries and independent of Comma."""
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
from urllib.parse import quote

INTERVAL = 6 * 60 * 60
SCHEDULE_TIMEOUT = 12 * 60 * 60
REPOSITORY = 'helico717/openpilot'
BRANCH = 'carrot-wip-model_selector-ha'
UPSTREAM = 'ajouatom:happymaj11r/carrot-wip-model_selector'
WORKFLOW = 'sync_upstream_model_selector.yml'
WORKFLOW_URL = f'https://github.com/{REPOSITORY}/actions/workflows/{WORKFLOW}'
API = f'/repos/{REPOSITORY}'
FAILED = {'failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale'}


def timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.timestamp() if parsed.tzinfo else None
    except (AttributeError, TypeError, ValueError, OverflowError):
        return None


def iso(now):
    return datetime.fromtimestamp(now, timezone.utc).isoformat()


def run_summary(payload, event=None):
    rows = payload['workflow_runs']
    if not isinstance(rows, list):
        raise ValueError('Invalid run list')
    if not rows:
        return None
    row = rows[0]
    if (not isinstance(row.get('id'), int) or timestamp(row.get('created_at')) is None
            or row.get('status') not in {'completed', 'in_progress', 'queued', 'requested', 'waiting', 'pending'}
            or (event and row.get('event') != event)):
        raise ValueError('Invalid workflow run')
    return {key: row.get(key) for key in
            ('id', 'created_at', 'updated_at', 'event', 'status', 'conclusion', 'head_branch')}


class ActionsHealth:
    def __init__(self, now, saved=None):
        self.now = now
        self.lock = asyncio.Lock()
        self.saved = deepcopy(saved) if isinstance(saved, dict) and saved.get('version') == 1 else {'version': 1}

    def due(self):
        attempted = timestamp(self.saved.get('last_attempt_at'))
        # A future timestamp must not suppress checks after a host clock correction.
        return attempted is None or self.now() < attempted or self.now() - attempted >= INTERVAL

    async def check(self, fetch):
        async with self.lock:
            if not self.due():
                return False
            checked_at = iso(self.now())
            paths = {
                'workflow': f'{API}/actions/workflows/{WORKFLOW}',
                'latest_run': f'{API}/actions/workflows/{WORKFLOW}/runs?per_page=1',
                'scheduled_run': f'{API}/actions/workflows/{WORKFLOW}/runs?event=schedule&per_page=1',
                'comparison': f'{API}/compare/{quote(BRANCH, safe="")}...{quote(UPSTREAM, safe=":")}?per_page=1',
            }
            # A failed comparison must not erase successful run observations, or vice versa.
            async def read(key, path):
                try:
                    payload = await fetch(path)
                    if key == 'workflow':
                        state = payload['state']
                        if state not in {'active', 'disabled_manually', 'disabled_inactivity', 'disabled_fork', 'deleted'}:
                            raise ValueError('Invalid workflow state')
                        result = {'state': state}
                    elif key.endswith('_run'):
                        result = run_summary(payload, 'schedule' if key == 'scheduled_run' else None)
                    else:
                        ahead, behind = payload['ahead_by'], payload['behind_by']
                        if (type(ahead) is not int or type(behind) is not int or min(ahead, behind) < 0
                                or payload['status'] not in {'ahead', 'behind', 'identical', 'diverged'}):
                            raise ValueError('Invalid comparison')
                        result = {'upstream_pending': ahead, 'fork_only': behind, 'status': payload['status']}
                    return key, result, None
                except Exception:
                    # Never persist response bodies, credentials, or arbitrary exception strings.
                    return key, None, 'unavailable'
            results = await asyncio.gather(*(read(key, path) for key, path in paths.items()))
            # Publish a whole observation. Cancellation during unload must not leave a
            # half-checked, six-hour-cached result that looks successful on reattach.
            errors = {}
            self.saved['last_attempt_at'] = checked_at
            for key, result, error in results:
                if error:
                    errors[key] = error
                else:
                    self.saved[key] = {'checked_at': checked_at, 'data': result}
            self.saved['errors'] = errors
            if not errors:
                self.saved['last_success_at'] = checked_at
            return True

    def snapshot(self):
        def part(key):
            value = self.saved.get(key)
            return value.get('data') if isinstance(value, dict) else None
        latest, scheduled, workflow, comparison = (part(k) for k in
            ('latest_run', 'scheduled_run', 'workflow', 'comparison'))
        now = self.now()
        schedule_at = timestamp((scheduled or {}).get('created_at'))
        age = max(0, now - schedule_at) if schedule_at is not None else None
        errors = dict(self.saved.get('errors') or {})
        checked = timestamp(self.saved.get('last_attempt_at'))
        if checked is not None and now - checked >= SCHEDULE_TIMEOUT:
            errors['monitor'] = 'check_overdue'
        overdue = age is not None and age > SCHEDULE_TIMEOUT
        if errors:
            state = 'unavailable'
        elif checked is None:
            state = 'checking'
        elif workflow and workflow['state'] != 'active':
            state = 'disabled'
        elif latest and latest.get('conclusion') in FAILED:
            state = 'failed'
        elif overdue:
            state = 'overdue'
        elif scheduled is None:
            state = 'no_schedule'
        elif scheduled.get('conclusion') in FAILED:
            state = 'failed'
        elif latest and latest.get('status') != 'completed':
            state = 'running'
        elif scheduled.get('conclusion') != 'success':
            state = 'unconfirmed'
        elif comparison is None or workflow is None or latest is None:
            state = 'unconfirmed'
        elif comparison['upstream_pending'] > 0:
            state = 'pending'
        else:
            state = 'healthy'
        def public_run(row):
            return {**row, 'url': f'https://github.com/{REPOSITORY}/actions/runs/{row["id"]}'} if row else None
        return {
            'state': state, 'repository': REPOSITORY, 'branch': BRANCH, 'upstream': UPSTREAM,
            'workflow_url': WORKFLOW_URL, 'latest_run': public_run(latest),
            'scheduled_run': public_run(scheduled), 'schedule_overdue': overdue,
            'schedule_age_seconds': age, 'comparison': deepcopy(comparison),
            'last_attempt_at': self.saved.get('last_attempt_at'),
            'last_success_at': self.saved.get('last_success_at'),
            'comparison_checked_at': (self.saved.get('comparison') or {}).get('checked_at'),
            'errors': errors, 'interval_seconds': INTERVAL, 'schedule_timeout_seconds': SCHEDULE_TIMEOUT,
        }
