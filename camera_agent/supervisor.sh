#!/usr/bin/env bash
cd /data/carrot-camera || exit 1
exec 9>supervisor.lock
flock -n 9 || exit 0
export PYTHONPATH="/data/openpilot:/data/openpilot/pydeps${PYTHONPATH:+:$PYTHONPATH}"
while [ -f enabled ]; do
  if [ -f agent.log ] && [ "$(stat -c %s agent.log)" -gt 1048576 ]; then
    mv agent.log agent.previous.log
  fi
  /usr/local/venv/bin/python3 -u agent.py >>agent.log 2>&1 &
  agent_pid=$!
  echo "$agent_pid" > agent.pid
  wait "$agent_pid"
  rm -f agent.pid
  [ -f enabled ] || break
  sleep 10
done
