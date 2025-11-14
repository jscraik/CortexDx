#!/usr/bin/env bash
# Ensures only the launchd-managed CortexDx services are running and captures
# lightweight resource trends for capacity planning.

set -euo pipefail

LOG_DIR="${CORTEXDX_MAINTENANCE_LOG_DIR:-$HOME/Library/Logs/cortexdx-maintenance}"
LOG_FILE="$LOG_DIR/maintenance.log"
MAX_LOG_BYTES="${CORTEXDX_MAINTENANCE_LOG_BYTES:-5242880}"

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
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >> "$LOG_FILE"
}

kill_orphans() {
  local pattern="$1"
  local label="$2"
  mapfile -t pids < <(pgrep -f "$pattern" || true)
  local keepers=()
  for pid in "${pids[@]}"; do
    if launchctl procinfo "$pid" 2>/dev/null | grep -q "com.brainwav.cortexdx"; then
      keepers+=("$pid")
    fi
  done
  if (( ${#keepers[@]} > 1 )); then
    for pid in "${keepers[@]:1}"; do
      log_line "[cleanup] Terminating duplicate $label process $pid"
      kill "$pid" 2>/dev/null || true
    done
  fi
}

capture_metrics() {
  local label="$1"
  local pattern="$2"
  mapfile -t pids < <(pgrep -f "$pattern" || true)
  for pid in "${pids[@]}"; do
    local usage
    usage=$(ps -o pid,ppid,%cpu,%mem,rss,command -p "$pid" | tail -n 1)
    log_line "[metrics][$label] $usage"
  done
}

kill_orphans "packages/cortexdx/(src|dist)/server" "cortexdx-server"
kill_orphans "cloudflared.*tunnel" "cloudflared"

capture_metrics "server" "packages/cortexdx/(src|dist)/server"
capture_metrics "cloudflared" "cloudflared.*tunnel"
