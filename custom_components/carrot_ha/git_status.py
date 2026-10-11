"""GitHub comparison from persisted telemetry, independent of terminal reachability."""
import asyncio
from datetime import datetime, timezone
import re
import time
from urllib.parse import quote

TTL = 600
DEFAULT_REPOSITORY = 'helico717/openpilot'
DEFAULT_BRANCH = 'carrot-wip-model_selector-ha'

class GitStatus:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.lock = asyncio.Lock()
        self.cache = {}
        self.key = None
        self.until = 0

    async def get(self, data, fetch):
        sha = data.get('comma_git_commit')
        sha = sha if isinstance(sha, str) and re.fullmatch(r'[0-9a-f]{40}', sha) else None
        repo = data.get('comma_git_repository') or DEFAULT_REPOSITORY
        branch = data.get('comma_git_branch') or DEFAULT_BRANCH
        if not isinstance(repo, str) or not re.fullmatch(r'[\w.-]+/[\w.-]+', repo):
            repo = DEFAULT_REPOSITORY
        if not isinstance(branch, str) or not branch or len(branch) > 200:
            branch = DEFAULT_BRANCH
        key = (repo, branch, sha)
        async with self.lock:
            if key != self.key or self.clock() >= self.until:
                old = self.cache if key == self.key else {}
                self.key = key
                # Successful and failed requests are both bounded/coalesced.
                self.until = self.clock() + TTL
                try:
                    head = await fetch(f'/repos/{repo}/commits/{quote(branch, safe="")}')
                    latest = head['sha']
                    if not re.fullmatch(r'[0-9a-f]{40}', latest):
                        raise ValueError('Invalid GitHub commit')
                    result = {'latest_commit': latest,
                              'latest_message': str(head['commit']['message'])[:4096],
                              'latest_url': f'https://github.com/{repo}/commit/{latest}',
                              'checked_at': datetime.now(timezone.utc).isoformat(),
                              'behind': None, 'ahead': None, 'comparison': 'unknown', 'error': None}
                    if sha == latest:
                        result.update(behind=0, ahead=0, comparison='identical')
                    elif sha:
                        try:
                            comparison = await fetch(f'/repos/{repo}/compare/{sha}...{latest}')
                            result.update(behind=int(comparison['ahead_by']), ahead=int(comparison['behind_by']),
                                          comparison=comparison['status'])
                        except Exception:
                            result['error'] = 'comparison_unavailable'
                    self.cache = result
                except Exception:
                    self.cache = {**old, 'error': 'github_unavailable'}
            return {**self.cache, 'repository': repo, 'branch': branch, 'installed_commit': sha,
                    'installed_measured_at': data.get('comma_git_measured_at'),
                    'cached': self.cache.get('error') == 'github_unavailable'}
