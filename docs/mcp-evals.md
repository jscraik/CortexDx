# CortexDx MCP Evals

This guide explains how to run the `mclenhard/mcp-evals` harness against CortexDx itself and remote client MCP servers, including Auth0/token exchange.

## Prerequisites

- `mise install && pnpm install`
- Local CortexDx server (`pnpm --filter @brainwav/cortexdx run server`) when testing `cortexdx-basic.evals.ts`
- Access to the MCP endpoint under test (e.g., `https://client.example.com/mcp`)
- LLM credentials (Ollama Cloud or OpenAI-compatible endpoint)

### Environment variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Token for Ollama Cloud/openai-compatible endpoint (required) |
| `OPENAI_API_BASE` | Base URL (e.g., `https://api.ollama.ai/v1`) |
| `CORTEXDX_EVAL_ENDPOINT` | Local server endpoint (defaults to `http://127.0.0.1:5001/mcp`) |
| `CLIENT_EVAL_ENDPOINT` | Remote MCP endpoint when running client suites |
| `CLIENT_EVAL_AUTH_HEADER` | Static header (`Name: Value`) for client auth (optional) |
| `MCP_EVAL_AUTH0_DOMAIN`, `MCP_EVAL_AUTH0_CLIENT_ID`, `MCP_EVAL_AUTH0_CLIENT_SECRET`, `MCP_EVAL_AUTH0_AUDIENCE` | Auth0 client-credentials exchange (optional) |

## Local Runs

### CortexDx self-evals

```
export OPENAI_API_KEY=...        # Ollama/OpenAI token
export OPENAI_API_BASE=https://api.ollama.ai/v1
pnpm --filter @brainwav/cortexdx run server &
SERVER_PID=$!
npx mcp-eval tests/mcp-evals/cortexdx-basic.evals.mjs packages/cortexdx/src/adapters/stdio-wrapper.ts
kill $SERVER_PID
```

### Client evals with Auth0

```
export CLIENT_EVAL_ENDPOINT=https://client.example.com/mcp
export MCP_EVAL_AUTH0_DOMAIN=client-domain.auth0.com
export MCP_EVAL_AUTH0_CLIENT_ID=...
export MCP_EVAL_AUTH0_CLIENT_SECRET=...
export MCP_EVAL_AUTH0_AUDIENCE=https://client.example.com/api
export OPENAI_API_KEY=...
export OPENAI_API_BASE=https://api.ollama.ai/v1
npx mcp-eval tests/mcp-evals/client-routing.evals.mjs scripts/mcp-evals/stdio-auth-wrapper.ts
```

The `stdio-auth-wrapper.ts` script requests an Auth0 access token and injects the resulting `Authorization: Bearer ...` header into every MCP call.

## GitHub Actions

- Workflow: `.github/workflows/mcp-evals.yml`
- Matrix targets:
  - `cortexdx-local`: spins up the local server and runs `cortexdx-basic.evals.mjs`
  - `client-staging`: uses the auth wrapper and remote endpoint

### Required secrets

| Secret | Description |
| --- | --- |
| `OLLAMA_API_KEY` | LLM key |
| `CLIENT_MCP_URL` | Client MCP endpoint |
| `CLIENT_MCP_AUTH_HEADER` | Static header (optional if Auth0 used) |
| `CLIENT_AUTH0_DOMAIN`, `CLIENT_AUTH0_CLIENT_ID`, `CLIENT_AUTH0_CLIENT_SECRET`, `CLIENT_AUTH0_AUDIENCE` | Auth0 credentials |

Trigger manually:

```
gh workflow run mcp-evals.yml --ref main
gh run watch
```

Artifacts are uploaded under `cortexdx-mcp-evals/<target>/latest.txt`.

## Troubleshooting

- Missing env/secret → evaluator fails before calling MCP; ensure `.env.cloud` values are mirrored into GitHub secrets.
- Auth0 401 → confirm audience/client IDs match the client’s Auth0 API.
- MCP 403 → verify the wrapper is forwarding the correct header (`CLIENT_EVAL_AUTH_HEADER` or generated bearer token).

For additional eval suites, duplicate `tests/mcp-evals/*.evals.ts`, adjust prompts, and add another matrix row referencing the new file and secrets.
