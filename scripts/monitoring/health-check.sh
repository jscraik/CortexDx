#!/usr/bin/env bash
# Periodic health check for CortexDx services.
# Hits the local MCP endpoint and the public tunnel, logging latency and
# surfacing alerts via syslog/notifications when failures occur.

set -euo pipefail

LOG_DIR="${CORTEXDX_HEALTH_LOG_DIR:-$HOME/Library/Logs/cortexdx-health}"
LOG_FILE="$LOG_DIR/healthcheck.log"
MAX_LOG_BYTES="${CORTEXDX_HEALTH_LOG_BYTES:-5242880}"
URLS_STRING="${CORTEXDX_HEALTH_URLS:-http://127.0.0.1:5001/health https://cortexdx.brainwav.io/health}"
ALERT_TAG="CortexDx Health"

mkdir -p "$LOG_DIR"

rotate_log() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local size
  size=$(stat -f%z "$file" 2>/dev/null || echo 0)
  if (( size > MAX_LOG_BYTES )); then
    mv "$file" "$file.$(date +%Y%m%dT%H%M%SZ)"
    touch "$file"
  fi
}

log_line() {
  rotate_log "$LOG_FILE"
  printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" >> "$LOG_FILE"
}

notify_failure() {
  local message="$1"
  logger -p user.err -- "$ALERT_TAG: $message" || true
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display notification \"$message\" with title \"$ALERT_TAG\""
  fi
}

IFS=' ,' read -r -a urls <<< "$URLS_STRING"
failure_count=0

for url in "${urls[@]}"; do
  start=$(date +%s%3N)
  if response=$(curl -fsS --max-time 10 --write-out ' status=%{http_code}' "$url" 2>&1); then
    end=$(date +%s%3N)
    latency=$((end - start))
    status=$(grep -o 'status=[0-9]*' <<<"$response" | cut -d= -f2)
    log_line INFO "$url healthy (status=$status, latency=${latency}ms)"
  else
    log_line WARN "$url unhealthy ($response)"
    notify_failure "$url failed health check"
    failure_count=$((failure_count + 1))
  fi
done

if (( failure_count > 0 )); then
  exit 1
fi
