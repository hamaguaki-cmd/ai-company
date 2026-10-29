#!/usr/bin/env bash
# Usage: log.sh <AGENT> <working|done|error> <case-slug> <message>
# Appends one activity event for the office screen.
set -euo pipefail
dir="$(cd "$(dirname "$0")/.." && pwd)/state"
mkdir -p "$dir"
python3 - "$@" >> "$dir/activity.jsonl" <<'PY'
import json, sys, datetime
agent, status, case, msg = sys.argv[1:5]
print(json.dumps({"ts": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
                  "case": case, "agent": agent, "status": status, "msg": msg}, ensure_ascii=False))
PY
