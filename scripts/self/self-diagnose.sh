#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${CORTEXDX_SELF_ENV:-.env.self}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ ! -f "${ROOT_DIR}/${ENV_FILE}" ]]; then
  echo "Self-diagnostics environment file '${ENV_FILE}' not found in ${ROOT_DIR}."
  echo "Create one (e.g., cp .env.self.example .env.self) and populate CONTEXT7_*, VIBE_CHECK_*, OPENALEX_CONTACT_EMAIL, EXA_API_KEY, and CORTEXDX_PATTERN_KEY."
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "${ROOT_DIR}/${ENV_FILE}"
set +a

echo "▶ Running CortexDx self diagnostics against http://127.0.0.1:5001/mcp"

pnpm --dir "${ROOT_DIR}/packages/cortexdx" run server >/tmp/cortexdx_self_server.log 2>&1 &
SERVER_PID=$!
trap 'kill ${SERVER_PID} >/dev/null 2>&1 || true' EXIT

sleep 2

pnpm --dir "${ROOT_DIR}/packages/cortexdx" exec tsx src/cli.ts diagnose http://127.0.0.1:5001/mcp --full --deterministic --out "${ROOT_DIR}/reports/self"
pnpm --dir "${ROOT_DIR}/packages/cortexdx" exec tsx src/cli.ts orchestrate http://127.0.0.1:5001/mcp --workflow agent.langgraph.baseline --deterministic

echo "✅ Self diagnostics completed. Reports stored under reports/self"
