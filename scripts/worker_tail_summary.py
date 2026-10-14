"""Print only route/status/CPU and exception types from Wrangler JSON tail.

Never print request headers, query parameters, client IPs, payloads, or raw logs.
"""
import json
import sys
from urllib.parse import urlsplit

buffer = ''
for line in sys.stdin:
    if not buffer and not line.lstrip().startswith('{'):
        continue
    buffer += line
    try:
        event = json.loads(buffer)
    except json.JSONDecodeError:
        continue
    buffer = ''
    request = event.get('event', {}).get('request', {})
    print(json.dumps({'route':urlsplit(request.get('url','')).path,
        'status':event.get('event',{}).get('response',{}).get('status'),
        'cpu_ms':event.get('cpuTime'),'wall_ms':event.get('wallTime'),
        'outcome':event.get('outcome'),
        'exceptions':[x.get('name') for x in event.get('exceptions',[])]}),flush=True)
