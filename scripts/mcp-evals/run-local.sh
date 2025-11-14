#!/usr/bin/env bash
set -euo pipefail

# Default to local CortexDx server + stdio wrapper
export CORTEXDX_EVAL_ENDPOINT="${CORTEXDX_EVAL_ENDPOINT:-http://127.0.0.1:5001/mcp}"

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "[warn] OPENAI_API_KEY is unset; set it for OpenAI/Ollama-compatible endpoints." >&2
fi

SERVER_PATH=${1:-scripts/mcp-evals/stdio-auth-wrapper.ts}

pnpm dlx mcp-eval tests/mcp-evals/cortexdx-basic.evals.mjs "$SERVER_PATH"
