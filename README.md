# CortexDx — Diagnostic Meta-Inspector

[![GitHub Actions](https://github.com/jscraik/CortexDx/workflows/CortexDx%20Diagnose/badge.svg)](https://github.com/jscraik/CortexDx/actions)
[![npm version](https://img.shields.io/npm/v/@brainwav/cortexdx.svg)](https://www.npmjs.com/package/@brainwav/cortexdx)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

**Stateless, plugin-based diagnostics for Model Context Protocol (MCP) servers and clients.** CortexDx is the comprehensive diagnostic tool that helps you harden MCP implementations before production deployment.

> **📖 New to MCP or CortexDx?** See the [Glossary](docs/GLOSSARY.md) for definitions of technical terms.

## TL;DR

**CortexDx validates MCP server implementations** by testing protocol compliance, security, and performance. Install with `npm install -g @brainwav/cortexdx`, run `cortexdx diagnose <your-server-url>`, and get actionable reports with evidence-based findings.

**Quick Links:**
- [Installation](#installation) - Get started in 60 seconds
- [Getting Started Guide](packages/cortexdx/docs/GETTING_STARTED.md) - Step-by-step walkthrough
- [User Guide](packages/cortexdx/docs/user-guide/README.md) - Complete usage documentation
- [Glossary](docs/GLOSSARY.md) - Technical terms explained

> **🚨 URGENT: MCP Specification Update**

> **Status:**  
> RC likely published (v1.22.0 on Nov 13) — validation window **NOW ACTIVE**

> **Deadline:**  
> Final Spec: **November 25, 2025**

> **Action Required:**  
> Run `./scripts/rc-validation-quickstart.sh` to start validation testing.
> See [MCP Spec Migration](docs/MCP_SPEC_MIGRATION.md) for details.

## 🚀 Key Features

- **🔍 Comprehensive Protocol Testing**: Validates HTTP/HTTPS, Server-Sent Events (SSE), WebSocket, JSON-RPC, and gRPC transports
- **🛡️ Security & Governance**: Tests Cross-Origin Resource Sharing (CORS), rate-limiting, authentication, and threat models
- **📊 Evidence-Based Reports**: Generates Markdown summaries, JSON data, test-driven implementation plans (ArcTDD), and code patches
- **🔧 Plugin Architecture**: Extensible system with sandboxed plugins (isolated execution with CPU and memory limits)
- **⚡ CI/CD Ready**: Integrates with Continuous Integration/Deployment pipelines (GitHub Actions, GitLab CI, Jenkins) using severity-based exit codes
- **♿ Accessibility**: Web Content Accessibility Guidelines (WCAG) 2.2 AA compliant with screen reader support
- **🎯 Deterministic Testing**: Produces reproducible results with stable timestamps and random seeds for reliable regression testing
- **🧠 Internal Self-Improvement** *(Brainwav dev builds only)*: Diagnostic plugin that identifies regressions in CortexDx's own implementation

## 📦 Quick Start

### Installation

```bash
# Install globally
npm install -g @brainwav/cortexdx

# Or use with npx (no installation required)
npx @brainwav/cortexdx diagnose https://your-mcp-server.com
```

### Basic Usage

```bash
# Quick diagnostic scan
cortexdx diagnose https://mcp.example.com

# Full comprehensive analysis
cortexdx diagnose https://mcp.example.com --full

# Generate implementation plan
cortexdx diagnose https://mcp.example.com --file-plan --out reports

# Compare two diagnostic runs
cortexdx compare reports/old.json reports/new.json
```

### Example Output

```bash
$ cortexdx diagnose https://cortex-mcp.brainwav.io/mcp

[brAInwav] CortexDx Diagnostic Report
✅ [INFO] MCP server responding
⚠️  [MAJOR] SSE endpoint not streaming (HTTP 502)
ℹ️  [MINOR] No 'rpc.ping' response
📊 Generated: reports/cortexdx-report.md, reports/cortexdx-arctdd.md
```

## 🛠️ Advanced Usage

### Development Environment Setup

```bash
# Clone and setup (for contributors)
git clone https://github.com/jscraik/CortexDx.git
cd CortexDx
mise install          # Install Node/pnpm versions
pnpm install          # Install dependencies
pnpm build           # Build the project
pnpm test            # Run tests
```

#### CortexDx LaunchAgent (macOS)

Need CortexDx listening on `127.0.0.1:5001` without touching `.Cortex-OS`? Use the
bundled service scripts:

```bash
./install-service.sh      # render + install com.brainwav.cortexdx
./manage-service.sh logs  # tail /var/log/cortexdx.log
./uninstall-service.sh    # remove the LaunchAgent
```

The plist template renders with your absolute paths and the label stays
`com.brainwav.cortexdx`, so it can co-exist with `.Cortex-OS`'s
`com.brainwav.cortexdx-local-memory` profile. See `SERVICE_SETUP.md` for details
and environment overrides like `PORT=5002 ./install-service.sh`.

> 💡 **Port allocation tip:** keep every reserved port (server, inspector proxy,
> future tunnels) in `config/port.env`, then `set -a && source config/port.env`
> before installing or restarting services. This guarantees LaunchAgent,
> self-healing, and MCP Inspector CLI runs stay in sync when you shift ports.

#### Cloudflare Tunnel LaunchAgent

If you expose CortexDx via Cloudflare, install the companion LaunchAgent so
`cloudflared` restarts automatically and emits health logs:

```bash
./install-cloudflared.sh
# manage-cloudflared.sh {start|stop|status|logs}
```

By default it reads `~/.cloudflared/config.yml`, writes logs to
`~/Library/Logs/cortexdx-cloudflared`, and pings
`https://cortexdx.brainwav.io/health` every 60 seconds. Override the config
or health targets with `CORTEXDX_CLOUDFLARED_*` env vars before installing.

#### Optional: reuse `.Cortex-OS` toggle (Cortex ↔ CortexDx)

If you prefer the shared profile switcher that ships with `.Cortex-OS`, you can
still flip between Cortex profiles:

```bash
# From ~/.Cortex-OS
pnpm mcp:profile cortexdx   # MCP-only (REST disabled, Qdrant still on 6333)
pnpm mcp:profile cortex     # Restore Cortex profile (REST 3002 + MCP bridge)
```

Each command wraps `scripts/launchd/toggle-local-memory.sh`, which renders the
correct plist, bootouts the previous LaunchAgent, and bootstraps the new one via
`launchctl`. Confirm the active profile before diagnostics:

```bash
launchctl print gui/$UID/com.brainwav.cortexdx-local-memory | rg -i state
lsof -i :3002   # should be empty for CortexDx profile
lsof -i :6333   # Qdrant should listen in both profiles
```

Share these commands in runbooks/PRs when asking reviewers to reproduce CortexDx
issues so everyone flips the same profile without editing plist files manually.

### Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `diagnose` | Run diagnostic analysis | `cortexdx diagnose <endpoint> [options]` |
| `interactive` | Start interactive mode | `cortexdx interactive` |
| `debug` | Interactive debugging session | `cortexdx debug "connection timeout"` |
| `orchestrate` | Run LangGraph agent or plugin workflows | `cortexdx orchestrate <endpoint> --workflow agent.langgraph.baseline` |
| `research` | Aggregate academic findings from providers | `cortexdx research "MCP streaming" --providers semantic-scholar,exa` |
| `generate` | Code generation assistance | `cortexdx generate` |
| `best-practices` | Implementation analysis | `cortexdx best-practices <endpoint>` |
| `tutorial` | Interactive tutorials | `cortexdx tutorial "mcp-basics"` |
| `doctor` | Environment diagnostics | `cortexdx doctor` |
| `compare` | Compare diagnostic results | `cortexdx compare old.json new.json` |

The `tutorial` command now stitches academic research highlights and DeepContext references into the generated outline/exercises—run `cortexdx tutorial "<topic>" --exercises` to see the full flow, or `--no-research` if you need an offline run.

#### LangGraph Orchestrator

Use `cortexdx orchestrate` when you need deterministic LangGraph workflows, checkpoint recovery, or MCP-aware plugin batching:

- `cortexdx orchestrate --list` surfaces both plugin and LangGraph agent workflows.
- `--workflow <id>` prefers LangGraph workflows (e.g., `agent.langgraph.baseline`); `--plugin`/`--parallel` execute standalone plugins.
- `--state-db <path>` or `CORTEXDX_STATE_DB` sets the SQLite checkpoint store (default `.cortexdx/workflow-state.db`).
- `--resume-thread` / `--resume-checkpoint` restart interrupted runs without reprobing earlier stages.
- `--mode development --expertise <level>` layers deterministic development contexts so self-improvement plugins can reuse the same Ollama-backed adapter.
- `--disable-sse` (or `CORTEXDX_DISABLE_SSE=1`) skips the streaming probe when localhost tunnels can’t keep `/events` open yet.
- `--sse-endpoint <url>` (or `CORTEXDX_SSE_ENDPOINT`) targets a clean heartbeat endpoint so SSE diagnostics don’t hang behind Cloudflared tunnels.
- `--research` / `--research-topic <text>` / `--research-providers <csv>` / `--research-limit <n>` / `--research-out <dir>` configure the pre-flight academic research probe (Context7, Vibe Check, OpenAlex, Exa, Wikidata, arXiv). The probe is **enabled by default** for every orchestrate run—pass `--no-research` if you truly need to skip it.
- `--report-out <dir>` writes a consolidated report (JSON/Markdown/HTML plus SQLite index) via the ReportManager so LangGraph runs emit a single artifact.
- `--auth0-device-code` toggles the Auth0 device code flow (interactive) when client secrets aren’t available.

See [docs/ORCHESTRATION.md](docs/ORCHESTRATION.md) for workflow diagrams, MCP tool names, and checkpoint hygiene guidance.

#### Academic Research Sweep

Use `cortexdx research "<topic>"` to pull cross-provider findings (Context7, Vibe Check, OpenAlex, Exa, Wikidata, arXiv—with Semantic Scholar available as an opt-in preview) and emit artifacts you can attach to diagnostics. MCP clients can call the same workflow via the `cortexdx_academic_research` tool exposed on the CortexDx MCP server:

```bash
cortexdx research "MCP streaming" \
  --question "How do SSE probes degrade under load?" \
  --providers context7,openalex,exa \
  --limit 5 \
  --out reports/research \
  --credential exa=$EXA_API_KEY
```

Key flags:

- `--providers <csv>`: focus on specific providers (defaults to the full registry set).
- `--limit <n>`: cap per-provider findings.
- `--credential provider:value`: inject provider secrets without exporting env vars (e.g., `--credential exa=sk-*`).
- `--header name:value`: forward custom HTTP headers to all providers (useful for corporate proxies).
- `--json`: emit the full `AcademicResearchReport` structure to stdout.
- MCP clients can call the `cortexdx_academic_research` tool and then fetch the generated `cortexdx://research/<id>` resource (via `resources/list` → `resources/read`) to persist the JSON artifact in evidence stores.

Supported providers today: **Context7**, **Vibe Check**, **OpenAlex**, **Exa**, **Wikidata**, **arXiv**, plus the preview-only **Semantic Scholar** integration. The CLI normalizes and deduplicates whatever you pass to `--providers` (so `--providers Context7,context7,EXA` executes each provider only once) and reverts to the production-ready set above when the flag is omitted. Provider-specific headers and credentials automatically flow from the environment variables listed below—override any of them inline with repeatable `--credential` or `--header` flags.

Need a live sanity check? Run `op run --env-file=.env -- CORTEXDX_RUN_INTEGRATION=1 CORTEXDX_RESEARCH_SMOKE=1 pnpm research:smoke` to exercise the real providers end-to-end. The suite self-skips when secrets are missing, so CI stays fast until you explicitly opt in.

By default the smoke harness targets Context7, Vibe Check, OpenAlex, Exa, and Wikidata so it mirrors the CLI defaults. Set `CORTEXDX_RESEARCH_SMOKE_PROVIDERS` (comma-delimited) to focus on a subset, and note that the harness automatically filters out any providers missing the required secrets (logging the skipped ones instead of failing the whole run). Vibe Check only needs `VIBE_CHECK_HTTP_URL`; the API key is optional for live checks.

> **Heads-up:** Semantic Scholar remains in “preview” while the team finalizes API access. It is excluded from the default provider list; treat it as **not production ready**, avoid using it in CI or customer flows, and exclude it via `--providers`/`CORTEXDX_RESEARCH_SMOKE_PROVIDERS` unless you are explicitly testing the preview endpoint.

Context7 and Vibe Check now proxy directly to their hosted MCP HTTP APIs. Set `CONTEXT7_API_BASE_URL` + `CONTEXT7_API_KEY` (or pass `--credential context7:<token>`) so contextual analyses hit the latest dataset, and configure `VIBE_CHECK_HTTP_URL` (plus optional `VIBE_CHECK_API_KEY`) when running quality checks. All of these secrets should continue to flow through `op run --env-file=.env -- …` both locally and in CI.

### Securing the local MCP endpoint

Self-diagnostics now expect `/mcp` to be HTTPS-only and gated by either Auth0 or a local API key:

1. Provide a cert/key pair (self-signed is fine for localhost) and export
   `CORTEXDX_TLS_CERT_PATH=/absolute/path/to/cert.pem` and
   `CORTEXDX_TLS_KEY_PATH=/absolute/path/to/key.pem` before `pnpm run server`.
2. Enable auth by setting `REQUIRE_AUTH=true` plus `CORTEXDX_API_KEY=local-dev-key`
   (or the full Auth0 trio `AUTH0_DOMAIN/CLIENT_ID/AUDIENCE`). Requests must now
   send `X-CortexDx-Api-Key: local-dev-key` or a valid Auth0 bearer token.
3. Restrict high-risk MCP tools with `CORTEXDX_ADMIN_TOKEN=admin-secret`; callers
   must present `X-CortexDx-Admin-Token` before `cortexdx_delete_workflow`,
   `wikidata_sparql`, and future destructive tools run. Without the token those
   tools respond with a JSON-RPC error, which keeps the heuristics happy.

Diagnose/orchestrate runs will flag `auth.zero` and transport-policy findings
until these env vars are set, so add them to your `.env` or the self-test file
described below.

### Self Diagnostics checklist

We ship a tiny helper to run CortexDx against itself with the correct secrets,
pattern DB, and deterministic flags:

1. Copy `.env.self.example` → `.env.self` and populate:
   `CONTEXT7_API_KEY`, `VIBE_CHECK_API_KEY`, `OPENALEX_CONTACT_EMAIL`,
   `EXA_API_KEY`, `CORTEXDX_PATTERN_KEY`, `CORTEXDX_PATTERN_DB`,
   `CORTEXDX_API_KEY`, and `CORTEXDX_ADMIN_TOKEN`.
2. Run `pnpm self:diagnose` (loads `.env.self`, starts the server, runs
   `diagnose` + `orchestrate`, and stores reports under `reports/self`).
3. Inspect `/tmp/cortexdx_self_server.log` if you need raw server output, and
   upload `reports/self/*` with your PR or CI artifact bundle.

Set `CORTEXDX_SELF_ENV=/path/to/other.env pnpm self:diagnose` if you keep
different profiles (e.g., staging vs. prod creds). The script exits early when
required secrets are missing so we no longer ship half-complete evidence.

Artifacts (JSON + Markdown) land in `reports/research/<topic>/<timestamp>/` when `--out` is supplied, and the CLI exit code respects severity (`blocker` → 1, `major` → 2) so CI can gate on academic findings.

#### Doctor Command

`cortexdx doctor` now performs academic provider readiness checks (Context7, Vibe Check, Exa, OpenAlex, etc.) and automatically runs a smoke-sized research probe before emitting the report:

```bash
cortexdx doctor --providers context7,exa --research-topic "MCP streaming errors" --json
```

- `--providers <csv>` restricts the readiness scan, while `--skip-providers` disables it entirely.
- `--research` + `--research-topic`, `--research-providers`, `--research-limit`, `--research-out` tune the academic probe (enabled by default). Pass `--no-research` if you truly need to skip it.
- `--json` emits a structured report you can stash in CI logs or attach to issue trackers.

#### Monitoring CLI

`cortexdx monitor` continues to manage background health checks, and it now persists scheduler status so restarts pick up previous jobs:

```bash
cortexdx monitor --start --config monitor-config.json --state-file .cortexdx/monitoring-status.json
```

- `--state-file <path>` (default `.cortexdx/monitoring-status.json`) keeps job definitions and last-run metadata in sync across runs.
- `--status` reads from the persisted state even when the scheduler isn’t actively running, making it easier to verify coverage in CI.

### Configuration Options

```bash
# Authentication
cortexdx diagnose <endpoint> --auth bearer:your-token
cortexdx diagnose <endpoint> --auth basic:user:pass

# Auth0 (client credentials)
cortexdx diagnose <endpoint> \
--auth0-domain tenant.auth0.com \
--auth0-client-id <client_id> \
--auth0-client-secret <client_secret> \
--auth0-audience https://api.cortexdx.com
--auth0-device-code             # Use device code flow (interactive) when client secret isn’t available

# Suite Selection
cortexdx diagnose <endpoint> --suites streaming,governance,cors

# Output Control
cortexdx diagnose <endpoint> --out custom-reports --file-plan --har
# Consolidated reports (ReportManager + SQLite index)
cortexdx diagnose <endpoint> --report-out .cortexdx/reports

# Performance Tuning
cortexdx diagnose <endpoint> --budget-time 10000 --budget-mem 128

# Accessibility & CI/CD
cortexdx diagnose <endpoint> --a11y --no-color --deterministic
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXA_API_KEY` | Required for the Exa academic provider. Stored in the 1Password-managed `.env` and injected at runtime or via `--credential exa:<key>`. |
| `SEMANTIC_SCHOLAR_API_KEY` | Optional API key for the preview-only Semantic Scholar provider (excluded from defaults until GA). |
| `OPENALEX_CONTACT_EMAIL` | Contact email sent with OpenAlex API requests (per OpenAlex rate-limit policy). |
| `CONTEXT7_API_BASE_URL` | Base URL for the Context7 MCP HTTP API (e.g., `https://api.context7.com`). |
| `CONTEXT7_API_KEY` | Bearer token for the Context7 API; required for live contextual analysis. |
| `VIBE_CHECK_HTTP_URL` / `VIBE_CHECK_PROFILE` / `VIBE_CHECK_STRICT` | Configure the Vibe Check quality provider (endpoint, profile slug, and strict-mode flag). |
| `VIBE_CHECK_API_KEY` | Optional API key forwarded to the Vibe Check MCP server (`X-Vibe-Api-Key`). |
| `LLM_PROVIDER` / `LLM_MODEL` | Defaults for the local LLM router (e.g., `ollama` + `llama3.1:8b`). |
| `CORTEXDX_LLM_PRIORITY` | Comma-separated priority order for LLM backends (e.g., `local,cloud`). Defaults to trying local first, then the cloud profile. |
| `CORTEXDX_ENABLE_LOCAL_LLM` / `CORTEXDX_ENABLE_CLOUD_LLM` | Set either flag to `false` to temporarily disable a backend without touching secrets. |
| `CORTEXDX_CLOUD_ENV_FILE` | Optional path to the remote env file (defaults to `.env.cloud`). |
| `CORTEXDX_CLOUD_OLLAMA_BASE_URL` / `CORTEXDX_CLOUD_LLM_MODEL` / `CORTEXDX_CLOUD_OLLAMA_API_KEY` | Overrides for the cloud profile. If unset, the router reads these keys from `.env.cloud`. |
| `OLLAMA_BASE_URL` | Host/port for the Ollama runtime (defaults to `http://localhost:11434`). |
| `CLOUDFLARE_API_KEY` | Used by the Cloudflare shield/diagnostics adapters when running protected MCP suites. |
| `CORTEXDX_AUTH0_DOMAIN` | Auth0 tenant domain (`example.auth0.com`) used to secure the MCP endpoint. |
| `CORTEXDX_AUTH0_CLIENT_ID` | Machine-to-machine client id for CortexDx to request tokens. |
| `CORTEXDX_AUTH0_CLIENT_SECRET` | Client secret paired with the Auth0 client id (store securely). |
| `CORTEXDX_AUTH0_AUDIENCE` | API audience / identifier configured in Auth0. |
| `CORTEXDX_AUTH0_SCOPE` | Optional scopes (space-delimited) to request during the client credential flow. |
| `CORTEXDX_AUTH0_DEVICE_CODE` | Set to `1` to force the Auth0 device code (user interaction) flow. |
| `CORTEXDX_AUTH0_DEVICE_CODE_ENDPOINT` | Override the Auth0 device authorization endpoint (defaults to `https://<domain>/oauth/device/code`). |
| `CORTEXDX_ENFORCE_SECURITY` | When `1`, fail builds if high-severity ASVS/MITRE controls lack evidence. |
| `CORTEXDX_STATE_DB` | Overrides the default LangGraph checkpoint database used by `cortexdx orchestrate` and MCP orchestration tools. |
| `CORTEXDX_MONITOR_STATE` | Default path for `cortexdx monitor --state-file` (falls back to `.cortexdx/monitoring-status.json`). |
| `CORTEXDX_DT_API_URL` | Base URL for Dependency Track (e.g., `https://dt.example.com`). |
| `CORTEXDX_DT_API_KEY` | API key for Dependency Track uploads. |
| `CORTEXDX_DT_PROJECT` | Default Dependency Track project name when using `pnpm sbom`. |
| `CORTEXDX_DT_PROJECT_VERSION` | Default project version for Dependency Track uploads. |

All secrets live in the shared 1Password vault—run `op run --env-file=.env -- pnpm <command>` (or source the generated `.env`) before invoking `pnpm lint/test/build`, `cortexdx research`, or any MCP tooling so Context7/Exa/Vibe Check and the LLM adapters have access to their keys. CI mirrors this pattern: set `OP_SERVICE_ACCOUNT_TOKEN` in the repository secrets, and every workflow step shells through `op run --env-file=.env -- …` (see `.github/workflows/cortexdx.yml`).

When `.env.cloud` exists (or `CORTEXDX_CLOUD_ENV_FILE` points elsewhere) the router transparently reads those credentials so cloud-only models can step in whenever the local runtime is disabled or unreachable—no manual env swapping required.

When CI uploads the DeepContext artifact, reviewers should follow the quick interpretation steps in [`docs/DEEPCONTEXT_ARTIFACT.md`](docs/DEEPCONTEXT_ARTIFACT.md) and record the checklist item in their PR description. For the full threat model, supported versions, and coordinated disclosure process, see [SECURITY.md](SECURITY.md).

## 🛡️ Security Tooling Scripts

Phase 2 introduced deterministic wrappers around our Semgrep, gitleaks, and ZAP integrations. Run them locally (and in CI) via pnpm:

```bash
pnpm security:semgrep      # Semgrep rules scoped to MCP transports + plugins
pnpm security:gitleaks     # gitleaks CLI (auto-detects the binary on PATH or respects CORTEXDX_GITLEAKS_BIN)
pnpm security:zap <url>    # OWASP ZAP baseline scan streamed through the CortexDx reporter
pnpm sbom --manifest package.json --out reports/sbom   # Generate CycloneDX/SPDX SBOM artifacts
```

Each command emits JSON summaries, redacts secrets, and exits non-zero for MAJOR/BLOCKER findings, so they slot directly into CI/CD. The SBOM generator writes artifacts under `reports/sbom/<type>/<timestamp>/` (including `summary.json`) so reviewers can diff dependencies quickly, and you can push the SBOM straight to OWASP Dependency Track by passing `--dt-url/--dt-api-key` (or setting `CORTEXDX_DT_*` env vars).

## 📚 Documentation

⏱️ **Quick Navigation:** Choose the right guide for your needs

### 🟢 Getting Started (New Users)

| Document | Description | Reading Time |
|----------|-------------|--------------|
| [Getting Started](packages/cortexdx/docs/GETTING_STARTED.md) | Installation and first steps | ~15 min |
| [User Guide Hub](packages/cortexdx/docs/user-guide/README.md) | Focused guides organized by topic | ~5 min |
| [FAQ](packages/cortexdx/docs/user-guide/faq.md) | Common questions and quick answers | ~5 min |
| [Glossary](docs/GLOSSARY.md) | Technical terms and abbreviations explained | Reference |

### 🟡 Usage & Configuration (All Users)

| Document | Description | Reading Time |
|----------|-------------|--------------|
| [User Guide: Basics](packages/cortexdx/docs/user-guide/basics.md) | Installation, quick start, authentication | ~10 min |
| [User Guide: Commands](packages/cortexdx/docs/user-guide/commands.md) | Complete command reference | ~15 min |
| [User Guide: Configuration](packages/cortexdx/docs/user-guide/configuration.md) | Config files and environment variables | ~20 min |
| [Troubleshooting](packages/cortexdx/docs/TROUBLESHOOTING.md) | Common issues and solutions | Reference |

### 🔴 Advanced Topics (Developers & DevOps)

| Document | Description | Reading Time |
|----------|-------------|--------------|
| [API Reference](packages/cortexdx/docs/API_REFERENCE.md) | CLI and programmatic API | Reference |
| [Plugin Development](packages/cortexdx/docs/PLUGIN_DEVELOPMENT.md) | Creating custom diagnostic plugins | ~30 min |
| [CI/CD Integration](packages/cortexdx/docs/user-guide/ci-cd.md) | GitHub Actions, GitLab CI, Jenkins | ~25 min |
| [Deployment](packages/cortexdx/docs/DEPLOYMENT.md) | Production deployment patterns | ~20 min |
| [IDE Integration](packages/cortexdx/docs/IDE_INTEGRATION.md) | Editor setup (VS Code, IntelliJ, etc.) | ~15 min |
| [Auth0 Setup](docs/AUTH0_SETUP.md) | OAuth2 authentication configuration | ~20 min |

### 🔧 Project Resources (Contributors)

| Document | Description | Reading Time |
|----------|-------------|--------------|
| [Architecture](docs/ARCHITECTURE.md) | System design and components | ~25 min |
| [Contributing](packages/cortexdx/docs/CONTRIBUTING.md) | Development workflow and standards | ~20 min |
| [Orchestration Guide](docs/ORCHESTRATION.md) | LangGraph workflows and MCP tools | ~15 min |
| [Report Manager](docs/REPORT_MANAGER.md) | Consolidated report artifacts | ~10 min |
| [Phase 5 Roadmap](docs/PHASE5_ROADMAP.md) | Upcoming features and milestones | ~10 min |

### Quick Links by Task

- **❓ "How do I get started?"** → [Getting Started Guide](packages/cortexdx/docs/GETTING_STARTED.md)
- **❓ "What does this term mean?"** → [Glossary](docs/GLOSSARY.md)
- **❓ "How do I use authentication?"** → [User Guide: Basics](packages/cortexdx/docs/user-guide/basics.md#authentication)
- **❓ "My diagnostic is failing, what now?"** → [FAQ: Troubleshooting](packages/cortexdx/docs/user-guide/faq.md#troubleshooting)
- **❓ "How do I integrate with GitHub Actions?"** → [CI/CD Integration](packages/cortexdx/docs/user-guide/ci-cd.md)
- **❓ "How do I create a plugin?"** → [Plugin Development](packages/cortexdx/docs/PLUGIN_DEVELOPMENT.md)
- **❓ "How do I contribute?"** → [Contributing Guide](packages/cortexdx/docs/CONTRIBUTING.md)

## 🏗️ Architecture

CortexDx follows a **plugin-first architecture** with these core principles:

- **Stateless & Read-Only**: Never mutates target MCP servers
- **Sandboxed Plugins**: Worker-thread isolation with CPU/memory budgets
- **Evidence-Based**: Every finding includes verifiable evidence pointers
- **Deterministic**: Reproducible results for reliable CI/CD integration
- **Accessible**: WCAG 2.2 AA compliant output for inclusive development

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CLI Interface │────│   Orchestrator   │────│  Plugin System  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Report Engine   │    │   Adapters      │
                       └──────────────────┘    └─────────────────┘
                                │                        │
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Evidence System  │    │ Protocol Probes │
                       └──────────────────┘    └─────────────────┘
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork & Clone**: Fork the repository and clone your fork
2. **Setup**: Run `mise install && pnpm install`
3. **Develop**: Follow [ArcTDD methodology](AGENTS.md) (Test → Code → Refactor)
4. **Test**: Ensure `pnpm lint && pnpm test && pnpm build` passes
5. **Submit**: Create a pull request with clear description

### Code Standards

- **TypeScript ESM**: Modern module system with strict typing
- **Named Exports**: No default exports, explicit interfaces
- **Function Size**: ≤40 lines per function for maintainability
- **Test Coverage**: ≥90% coverage with mutation testing
- **Documentation**: Update docs for any user-facing changes

## 🔧 CI/CD Integration

### GitHub Actions

```yaml
- name: MCP Diagnostic
  run: |
    npx @brainwav/cortexdx diagnose ${{ secrets.MCP_ENDPOINT }} --out reports
    
- name: Upload Reports
  uses: actions/upload-artifact@v4
  with:
    name: mcp-diagnostic-reports
    path: reports/
```

### Exit Codes

- `0`: Success (no blockers or majors)
- `1`: Blocker findings detected
- `2`: Major findings detected

## 🌟 Use Cases

- **Pre-Production Validation**: Ensure MCP servers meet production standards
- **Security Auditing**: Identify authentication, CORS, and rate-limiting issues
- **Performance Analysis**: Detect streaming, timeout, and resource problems
- **Compliance Checking**: Validate against MCP protocol specifications
- **Regression Testing**: Compare diagnostic results across deployments
- **Developer Onboarding**: Interactive tutorials and debugging assistance

## 📊 Supported Protocols & Features

| Protocol | Support | Features |
|----------|---------|----------|
| **HTTP/HTTPS** | ✅ Full | Headers, status codes, response validation |
| **JSON-RPC 2.0** | ✅ Full | Batch requests, notifications, error handling |
| **Server-Sent Events** | ✅ Full | Streaming, reconnection, heartbeat validation |
| **WebSocket** | ✅ Full | Bidirectional messaging, connection lifecycle |
| **gRPC** | 🚧 Beta | Basic probing (roadmap: full validation) |

## 🏷️ Versioning & Releases

We follow [Semantic Versioning](https://semver.org/). See [Releases](https://github.com/brainwav/cortexdx/releases) for changelog.

- **Major**: Breaking changes to CLI or API
- **Minor**: New features, plugins, or diagnostic capabilities
- **Patch**: Bug fixes, documentation updates, performance improvements

## 📄 License

Licensed under the [Apache License 2.0](LICENSE). See LICENSE file for details.

## 🆘 Support & Community

- **Issues**: [GitHub Issues](https://github.com/jscraik/CortexDx/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jscraik/CortexDx/discussions)
- **Documentation**: [docs.brainwav.io/mcp](https://docs.brainwav.io/mcp)
- **Security**: Report security issues to <security@brainwav.io>

---

<div align="center">

**Built with ❤️ by [brAInwav](https://brainwav.io)**

*Empowering developers to build robust MCP implementations*

</div>
