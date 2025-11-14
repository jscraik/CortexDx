#!/usr/bin/env bash
# Launch wrapper for the CortexDx Cloudflare tunnel.
# Provides lightweight log rotation and tunnel health notifications so launchd
# restarts cloudflared if it exits unexpectedly.

set -euo pipefail

LOG_DIR="${CORTEXDX_CLOUDFLARED_LOG_DIR:-$HOME/Library/Logs/cortexdx-cloudflared}"
LOG_FILE="$LOG_DIR/cloudflared.log"
HEALTH_LOG="$LOG_DIR/cloudflared.health.log"
MAX_LOG_BYTES="${CORTEXDX_CLOUDFLARED_LOG_BYTES:-10485760}"
HEALTH_INTERVAL="${CORTEXDX_CLOUDFLARED_HEALTH_INTERVAL:-60}"
CORTEXDX_DEPENDENCY_URL="${CORTEXDX_DEPENDENCY_URL:-http://127.0.0.1:5001/health}"
CORTEXDX_DEPENDENCY_TIMEOUT="${CORTEXDX_DEPENDENCY_TIMEOUT:-120}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$(command -v cloudflared || true)}"
CONFIG_PATH="${CORTEXDX_CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}"
METRICS_PORT="${CORTEXDX_CLOUDFLARED_METRICS:-127.0.0.1:4319}"
HEALTH_URLS_STRING="${CORTEXDX_CLOUDFLARED_HEALTH_URLS:-https://cortexdx-mcp.brainwav.io/health}"
TUNNEL_NAME="${CORTEXDX_CLOUDFLARED_TUNNEL:-}"

if [[ -z "$CLOUDFLARED_BIN" ]]; then
  echo "[cloudflared] cloudflared binary not found on PATH" >&2
  exit 1
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "[cloudflared] config file not found: $CONFIG_PATH" >&2
  exit 1
fi

if [[ -z "$TUNNEL_NAME" ]]; then
  TUNNEL_NAME=$(python3 - <<'PY' "$CONFIG_PATH"
import sys
from pathlib import Path
for line in Path(sys.argv[1]).read_text().splitlines():
    stripped = line.strip()
    if stripped.startswith('tunnel:'):
        print(stripped.split(':', 1)[1].strip())
        break
PY
  )
fi

if [[ -z "$TUNNEL_NAME" ]]; then
  echo "[cloudflared] tunnel name not provided (set CORTEXDX_CLOUDFLARED_TUNNEL)" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

wait_for_dependency() {
  local url="$1"
  local timeout="$2"
  local start
  start=$(date +%s)
  while true; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      printf '[cloudflared] dependency %s is ready\n' "$url"
      return 0
    fi
    local now
    now=$(date +%s)
    if (( now - start >= timeout )); then
      printf '[cloudflared] dependency %s not ready after %ss\n' "$url" "$timeout" >&2
      return 1
    fi
    sleep 2
  done
}

rotate_log() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local size
  size=$(stat -f%z "$file" 2>/dev/null || echo 0)
  if (( size > MAX_LOG_BYTES )); then
    local ts
    ts=$(date +%Y%m%dT%H%M%S)
    mv "$file" "$file.$ts"
    touch "$file"
  fi
}

log_health() {
  local level="$1"; shift
  local message="$1"; shift
  rotate_log "$HEALTH_LOG"
  printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$level" "$message" >> "$HEALTH_LOG"
}

health_loop() {
  local pid="$1"
  IFS=' ,' read -r -a urls <<< "$HEALTH_URLS_STRING"
  while kill -0 "$pid" >/dev/null 2>&1; do
    for url in "${urls[@]}"; do
      if curl -fsS --max-time 10 "$url" >/dev/null 2>&1; then
        log_health INFO "${url} reachable"
      else
        log_health WARN "${url} unreachable"
      fi
    done
    sleep "$HEALTH_INTERVAL"
  done
}

rotate_log "$LOG_FILE"
if ! wait_for_dependency "$CORTEXDX_DEPENDENCY_URL" "$CORTEXDX_DEPENDENCY_TIMEOUT"; then
  log_health WARN "Dependency $CORTEXDX_DEPENDENCY_URL unreachable"
  exit 1
fi
"$CLOUDFLARED_BIN" tunnel --config "$CONFIG_PATH" --metrics "$METRICS_PORT" run "$TUNNEL_NAME" >> "$LOG_FILE" 2>&1 &
CLOUDFLARED_PID=$!

health_loop "$CLOUDFLARED_PID" &
HEALTH_PID=$!

terminate() {
  kill "$CLOUDFLARED_PID" 2>/dev/null || true
  kill "$HEALTH_PID" 2>/dev/null || true
}

trap terminate INT TERM HUP

wait "$CLOUDFLARED_PID"
exit_code=$?
kill "$HEALTH_PID" 2>/dev/null || true
exit "$exit_code"
