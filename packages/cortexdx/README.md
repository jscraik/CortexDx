# @brainwav/cortexdx

[![npm version](https://img.shields.io/npm/v/@brainwav/cortexdx.svg)](https://www.npmjs.com/package/@brainwav/cortexdx)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/docker/v/brainwav/cortexdx?label=docker)](https://hub.docker.com/r/brainwav/cortexdx)

**Comprehensive diagnostic meta-inspector and AI-powered development assistant for Model Context Protocol (MCP) servers and clients.** Provides stateless, plugin-based analysis with evidence-backed findings, local LLM integration, academic research validation, and actionable remediation guidance.

## 🎉 v1.0.0 Released

CortexDx v1.0.0 is now available with major enhancements:

- 🤖 **Local LLM Integration**: Conversational development with Ollama
- 🎓 **Academic Research Validation**: 7 integrated academic providers with license compliance
- 💼 **Commercial Licensing**: Three tiers (Community, Professional, Enterprise)
- 🧠 **Learning System**: Pattern recognition and RAG-based knowledge accumulation
- 📊 **Enhanced Diagnostics**: Real-time monitoring and performance profiling

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for complete details and [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for upgrade instructions.

## 🚀 Installation

### NPM Package

```bash
# Install globally
npm install -g @brainwav/cortexdx

# Or use with npx (recommended)
npx @brainwav/cortexdx diagnose https://your-mcp-server.com
```

### Docker (Recommended for Production)

```bash
# Quick deploy Community Edition
curl -fsSL https://raw.githubusercontent.com/brainwav/cortexdx/main/packages/cortexdx/scripts/quick-deploy.sh | bash -s community

# Or manually with Docker
docker run -p 3000:3000 brainwav/cortexdx:1.0.0-community

# Professional Edition (requires license)
docker run -p 3000:3000 \
  -e CORTEXDX_LICENSE_KEY=your-key \
  -e OLLAMA_HOST=ollama:11434 \
  brainwav/cortexdx:1.0.0-professional

# Enterprise Edition (requires license and Auth0)
docker run -p 3000:3000 \
  -e CORTEXDX_LICENSE_KEY=your-key \
  -e AUTH0_DOMAIN=your-domain.auth0.com \
  -e AUTH0_CLIENT_ID=your-client-id \
  -e AUTH0_CLIENT_SECRET=your-secret \
  brainwav/cortexdx:1.0.0-enterprise
```

### Docker Compose

```bash
# Clone repository
git clone https://github.com/brainwav/cortexdx.git
cd cortexdx/packages/cortexdx

# Start with docker-compose
docker-compose up cortexdx-community
```

### Development Setup

```bash
# For development/contribution
git clone https://github.com/brainwav/cortexdx.git
cd cortexdx
mise install && pnpm install && pnpm build
```

## 📋 Quick Start

### Basic Diagnostic

```bash
# Simple diagnostic scan
cortexdx diagnose https://mcp.example.com

# Full comprehensive analysis
cortexdx diagnose https://mcp.example.com --full --out reports

# With authentication
cortexdx diagnose https://mcp.example.com --auth bearer:your-token
```

### Interactive Mode

```bash
# Start interactive diagnostic session
cortexdx interactive

# Debug specific issues
cortexdx debug "SSE connection timeout"

# Get implementation guidance
cortexdx best-practices https://mcp.example.com
```

### Example Output

```bash
$ cortexdx diagnose https://cortex-mcp.brainwav.io/mcp --full

[brAInwav] CortexDx Diagnostic Report
🔍 Analyzing: https://cortex-mcp.brainwav.io/mcp
⚡ Duration: 2.2s

✅ [INFO] MCP server responding (200 OK)
⚠️  [MAJOR] SSE endpoint not streaming (HTTP 502)
ℹ️  [MINOR] No 'rpc.ping' response - method may differ
ℹ️  [MINOR] Could not enumerate tools via JSON-RPC

📊 Reports generated:
  • reports/cortexdx-report.md (human-readable)
  • reports/cortexdx-findings.json (machine-readable)
  • reports/cortexdx-arctdd.md (implementation plan)
  • reports/cortexdx-fileplan.patch (code diffs)

🎯 Next steps: Review ArcTDD plan for remediation guidance
```

## 🛠️ CLI Commands Reference

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `diagnose <endpoint>` | Run diagnostic analysis | `cortexdx diagnose https://api.example.com/mcp` |
| `orchestrate [endpoint]` | Execute LangGraph or plugin workflows | `cortexdx orchestrate --workflow agent.langgraph.baseline https://mcp.example.com` |
| `interactive` | Interactive diagnostic mode | `cortexdx interactive` |
| `debug <problem>` | Debug specific issues | `cortexdx debug "connection timeout"` |
| `generate` | Code generation assistance | `cortexdx generate` |
| `best-practices [endpoint]` | Implementation analysis | `cortexdx best-practices` |
| `tutorial <topic>` | Interactive tutorials | `cortexdx tutorial mcp-basics` |
| `doctor` | Environment diagnostics | `cortexdx doctor` |
| `compare <old> <new>` | Compare diagnostic results | `cortexdx compare old.json new.json` |

`cortexdx tutorial "<topic>" --exercises` now produces a research-backed outline with DeepContext code references and practice exercises so teams can replay the same guidance every run (pass `--no-research` for an offline-only preview).

### Diagnose Command Options

```bash
cortexdx diagnose <endpoint> [options]

# Core Options
--full                    # Run comprehensive analysis (all suites)
--suites <csv>           # Specific suites: streaming,governance,cors,ratelimit
--out <dir>              # Output directory (default: reports)
--file-plan              # Generate unified diff patches

# Authentication
--auth bearer:TOKEN      # Bearer token authentication
--auth basic:user:pass   # Basic authentication
--auth header:Name:Value # Custom header authentication

# Output Control
--a11y                   # Screen-reader friendly output
--no-color              # Disable ANSI colors
--deterministic         # Stable timestamps and seeds for CI/CD

# Advanced
--simulate-external     # Probe as remote client
--otel-exporter <url>   # OpenTelemetry endpoint
--har                   # Capture redacted HAR on failures
--budget-time <ms>      # Per-plugin time budget (default: 5000)
--budget-mem <mb>       # Per-plugin memory limit (default: 96)
```

### Orchestrate Command

```bash
cortexdx orchestrate [endpoint] [options]

# List available workflows (LangGraph + plugin)
cortexdx orchestrate --list

# Run LangGraph baseline workflow with deterministic checkpoints
cortexdx orchestrate https://mcp.example.com \
  --workflow agent.langgraph.baseline \
  --deterministic \
  --state-db .cortexdx/workflow-state.db
```

Key options:

- `--workflow <id>`: Executes LangGraph workflows (prefers `agent.*`, falls back to plugin workflows).
- `--plugin <id>` / `--parallel <csv>`: Target individual plugins or comma-separated batches.
- `--state-db <path>`: Stores checkpoints in a deterministic SQLite DB for resume support.
- `--resume-checkpoint <id>` / `--resume-thread <id>`: Restart from saved runs without repeating earlier stages.
- `--mode development --expertise <level>`: Switches to a development context with conversational LLM access for self-improvement plugins.
- `--stream`: Streams workflow node events (useful for CI telemetry).
- `--research` / `--research-topic <text>` / `--research-providers <csv>` / `--research-limit <n>` / `--research-out <dir>`: Configure the pre-flight academic research probe (Context7, Vibe Check, OpenAlex, Exa, Wikidata, arXiv). The probe runs by default—use `--no-research` only when you intentionally need to skip it.
- `--report-out <dir>`: Persist a consolidated report (JSON/Markdown/HTML + SQLite index) via the ReportManager.
- `--auth0-device-code`: Force the Auth0 device code flow when client secrets aren’t available.

### Security Tooling Scripts

Reusable security automation lives under `packages/cortexdx/scripts/security` and is surfaced via pnpm:

```bash
pnpm security:semgrep      # MCP-focused Semgrep suite
pnpm security:gitleaks     # gitleaks CLI (auto-detects binary on PATH)
pnpm security:zap <url>    # OWASP ZAP baseline scan via API
pnpm sbom --manifest package.json --out reports/sbom   # Generate CycloneDX/SPDX SBOM artifacts
```

All three commands emit JSON summaries and exit non-zero when high/critical issues are discovered, making them suitable for CI/CD gating. The SBOM run writes artifacts under `reports/sbom/<type>/<timestamp>/` with a `summary.json` reviewers can inspect in PRs, and you can push directly to OWASP Dependency Track using `--dt-url/--dt-api-key` or the `CORTEXDX_DT_*` env vars.

### DeepContext Semantic Search

Wildcard's DeepContext MCP server is bundled as a first-class tool for semantic code intelligence. Supply secrets exclusively through the 1Password-managed `.env` and run commands via `op run`:

```bash
op run --env-file=.env -- cortexdx deepcontext index packages/cortexdx
op run --env-file=.env -- cortexdx deepcontext search packages/cortexdx "handshake initialize failures"
op run --env-file=.env -- cortexdx deepcontext status
op run --env-file=.env -- cortexdx deepcontext clear packages/cortexdx
```

- `WILDCARD_API_KEY` (or `DEEPCONTEXT_API_KEY`), `JINA_API_KEY`, and `TURBOPUFFER_API_KEY` are read from `.env`; do **not** duplicate them in GitHub secrets.
- The self-improvement plugin automatically indexes and queries DeepContext whenever `CORTEXDX_PROJECT_ROOT` (or `projectContext.rootPath`) and the API keys are available, so `cortexdx self-diagnose` and AutoHealer runs inherit semantic evidence automatically.
- DeepContext stores its semantic index under `${CODEX_CONTEXT_DIR}` (defaults to `<project>/.codex-context`) and mirrors each run into `.cortexdx/deepcontext-status.json`; `cortexdx deepcontext status <codebase>` fetches the live MCP status, while running it without arguments prints the cached status snapshots.
- To scope DeepContext to another workspace, set `CORTEXDX_PROJECT_ROOT=/abs/path/to/project` before invoking CLI commands or diagnostic suites.
- CI runs `pnpm deepcontext:status`, so make sure you’ve run `cortexdx deepcontext index <repo>` locally (and committed `.cortexdx/deepcontext-status.json` to your branch) before pushing; otherwise the workflow will fail and upload an empty cache artifact.

Reviewers should follow [`docs/DEEPCONTEXT_ARTIFACT.md`](../../docs/DEEPCONTEXT_ARTIFACT.md) when interpreting the uploaded artifact and include the checklist item in every PR description.

### Academic Research CLI

Run real-time research sweeps against the live providers with the secrets sourced from the 1Password-managed `.env` (no GitHub secrets required):

```bash
op run --env-file=.env -- cortexdx research "MCP streaming stability" \
  --question "How do modern inspectors validate SSE reconnects?" \
  --providers context7,openalex,vibe-check,exa,wikidata \
  --limit 5 --out reports/research
```

Environment / header mapping (all loaded automatically when present):

- `SEMANTIC_SCHOLAR_API_KEY` → `x-api-key` header for the preview-only Semantic Scholar provider (excluded from defaults)
- `OPENALEX_CONTACT_EMAIL` → appended to every OpenAlex request as the required `mailto` parameter
- `EXA_API_KEY` → `x-exa-api-key` header (required)
- `CONTEXT7_API_KEY` → `Authorization: Bearer …` header (required)
- `CONTEXT7_API_BASE_URL`, `CONTEXT7_PROFILE` → forwarded as `context7-base-url` / `x-context7-profile` headers so the provider knows which MCP endpoint/profile to hit
- `VIBE_CHECK_API_KEY`, `VIBE_CHECK_HTTP_URL`, `VIBE_CHECK_PROFILE`, `VIBE_CHECK_STRICT` → forwarded as `x-vibe-api-key`, `vibe-check-url`, `x-vibe-profile`, `x-vibe-strict`

The `resolveCredentialHeaders` helper also accepts CLI overrides (`--credential context7:token`, `--header context7-base-url:https://…`) so CI can point at staging endpoints without mutating the `.env`. All documentation assumes commands are wrapped with `op run --env-file=.env -- …` to keep credentials in 1Password only.

Supported providers: **Context7**, **Vibe Check**, **OpenAlex**, **Exa**, **Wikidata**, **arXiv**, plus the preview-only **Semantic Scholar** integration. Provider ids are normalized case-insensitively and deduplicated before execution—`--providers context7,Context7,EXA` still runs Context7 + Exa exactly once. Skip the flag altogether to run the production set above, or use the `research:smoke` test (`op run --env-file=.env -- CORTEXDX_RUN_INTEGRATION=1 CORTEXDX_RESEARCH_SMOKE=1 pnpm research:smoke`) to validate your secret bundle against the live endpoints.

#### Smoke Tests

- Local: set `CORTEXDX_RUN_INTEGRATION=1 CORTEXDX_RESEARCH_SMOKE=1` (or run `op run --env-file=.env -- CORTEXDX_RUN_INTEGRATION=1 CORTEXDX_RESEARCH_SMOKE=1 pnpm research:smoke`) to execute `tests/academic-provider-smoke.spec.ts`. The suite skips automatically when the required provider secrets are missing.
- CI: set the repository/workflow variable `RESEARCH_SMOKE=true` to enable the smoke step (`pnpm research:smoke`) inside the GitHub Actions workflow. This keeps the default fast path off but makes it easy to opt-in for staging runs.
- Use `CORTEXDX_RESEARCH_SMOKE_PROVIDERS` (comma-delimited) to scope the smoke harness to a subset. Providers missing required secrets are logged and skipped so the rest of the suite can still execute. Context7, Vibe Check, OpenAlex, Exa, and Wikidata mirror the CLI defaults; only Exa mandates an API key, while Vibe Check just needs `VIBE_CHECK_HTTP_URL`.
- **Semantic Scholar preview:** we’re still finalizing API access, so treat the Semantic Scholar provider as **not production ready**. It’s excluded from the default provider set—only include it with `--providers semantic-scholar` or `CORTEXDX_RESEARCH_SMOKE_PROVIDERS=semantic-scholar,...` when explicitly testing the preview key.

## 🔍 Diagnostic Suites

CortexDx includes comprehensive diagnostic suites covering all aspects of MCP implementations:

### Protocol Suites

- **`discovery`**: Tool enumeration and capability detection
- **`jsonrpc`**: JSON-RPC 2.0 compliance and batch processing
- **`streaming`**: Server-Sent Events and WebSocket validation
- **`protocol`**: Core MCP protocol adherence

### Security & Governance

- **`cors`**: Cross-Origin Resource Sharing configuration
- **`auth`**: Authentication and authorization mechanisms
- **`ratelimit`**: Rate limiting and throttling policies
- **`threat-model`**: Security vulnerability assessment
- **`permissioning`**: Access control and permissions

### Quality & Performance

- **`governance`**: Policy compliance and drift detection
- **`devtool`**: Development environment security
- **`tool-drift`**: API consistency and versioning

### Development Features

- **`interactive-debugger`**: Real-time debugging assistance with academic research backing
- **`code-generation`**: Research-validated code generation with quality scoring
- **`performance-analysis`**: Academic research-backed performance optimization

## 🧠 Local LLM Backend (Ollama)

CortexDx relies on a single local adapter managed by `src/ml/router.ts`:

- **Ollama** (default): requires the Ollama daemon on `http://localhost:11434`. Set `CORTEXDX_LLM_PRIORITY=ollama` to explicitly pin the backend.

Deterministic runs (`--deterministic`) seed the adapter, ensuring LangGraph orchestrations and self-improvement plugins can replay identical conversations.

### Narrative Stories (Preview)

Set `CORTEXDX_STORIES_ENABLED=true` to expose the experimental narrative diagnostics stack:

- `story.list` returns normalized story payloads validated against `schemas/story.schema.yaml` and `src/story/story-schema.ts`.
- `story.get` fetches a single story by id for UI consumers or MCP clients.
- `story.reprobe` executes a dry-run remediation from `src/actions/library.ts` (no remote mutations).

Before opening a PR, run the new validation gates:

```bash
pnpm -w nx run cortexdx:schema:check
pnpm -w nx run cortexdx:test
```

Vitest now enforces ≥70% line coverage for the story/anomaly/graph modules, ensuring the conversational diagnostics layer remains deterministic and well-tested.

## 📊 Output Formats

### 1. Markdown Report (`cortexdx-report.md`)

Human-readable diagnostic report with findings organized by severity:

```markdown
# CortexDx Diagnostic Report (brAInwav)
- Endpoint: https://mcp.example.com
- Date: 2025-11-06T21:50:59.157Z

## [MAJOR] SSE endpoint not streaming
Probe failed: HTTP 502
- Evidence: url:https://mcp.example.com/events
```

### 2. JSON Findings (`cortexdx-findings.json`)

Machine-readable structured data for automation:

```json
{
  "endpoint": "https://mcp.example.com",
  "inspectedAt": "2025-11-06T21:50:59.157Z",
  "findings": [
    {
      "id": "sse.missing",
      "area": "streaming",
      "severity": "major",
      "title": "SSE endpoint not streaming",
      "description": "Probe failed: HTTP 502",
      "evidence": [{"type": "url", "ref": "https://mcp.example.com/events"}]
    }
  ]
}
```

### 3. ArcTDD Plan (`cortexdx-arctdd.md`)

Test-driven implementation plan with prioritized remediation steps:

```markdown
# ArcTDD Implementation Plan
## 🚨 Critical Issues (Blockers)
## ⚠️ Major Issues
### MAJOR: SSE endpoint not streaming
**Solution Steps:**
1. Implement SSE endpoint: Add `/events` route
2. Set proper headers: `Content-Type: text/event-stream`
3. Add keepalive: Send periodic heartbeat messages
```

### SSE Troubleshooting Shortcuts

- `--disable-sse` flag or `CORTEXDX_DISABLE_SSE=1` will skip the streaming probe for workflows where the inspector tunnel can’t stream yet. The plugin emits an info-level finding instead of blocking the run.
- `--sse-endpoint http://127.0.0.1:5001/events` (or `CORTEXDX_SSE_ENDPOINT`) points the probe at a dedicated heartbeat endpoint so long-running `/events` shells don’t stall orchestrate. Ideal when a Cloudflared tunnel fronts the inspector.
- Both toggles are scoped per `cortexdx orchestrate` invocation; the CLI resets your previous env values when it exits so global automation remains deterministic.

### 4. File Plan (`cortexdx-fileplan.patch`)

Unified diff patches for direct code remediation:

```diff
+++ server.js
@@ -10,6 +10,12 @@
   res.json({status: 'ok'});
 });
 
+app.get('/events', (req, res) => {
+  res.writeHead(200, {
+    'Content-Type': 'text/event-stream',
+    'Cache-Control': 'no-cache'
+  });
+});
```

## 🏗️ Development Commands

### Building and Testing

```bash
# Development workflow
pnpm install              # Install dependencies
pnpm build               # Build TypeScript → JavaScript (tsup)
pnpm test                # Run Vitest test suite
pnpm lint                # Biome linting and formatting
pnpm doctor              # Environment diagnostics

# Advanced testing
pnpm test --coverage     # Test with coverage report
pnpm test --watch        # Watch mode for development
pnpm test:integration    # Run long-running integration suites (LLM, self-healing, performance)
```

`pnpm test:integration` sets `CORTEXDX_RUN_INTEGRATION=1`, enabling the longer suites only when explicitly requested.

#### Doctor Command

Run environment checks, provider readiness, and (by default) an academic research probe in one shot:

```bash
cortexdx doctor --providers context7,exa --research-topic "SSE hardening"
```

- `--providers <csv>` limits the readiness scan. Use `--skip-providers` if you only want the runtime diagnostics.
- `--research`, `--research-topic`, `--research-providers`, `--research-limit`, and `--research-out` tune the pre-flight research probe (Context7, Vibe Check, OpenAlex, Exa, Wikidata, arXiv). Use `--no-research` to disable it when you truly need an offline run.
- `--json` emits a structured report for CI logs.

#### Monitoring CLI

Continuous monitoring now persists its state so you can restart schedulers without losing job metadata:

```bash
cortexdx monitor --start --config monitor-config.json --state-file .cortexdx/monitoring-status.json
```

- `--state-file <path>` (defaults to `.cortexdx/monitoring-status.json`) stores scheduler status, next-run timestamps, and configured jobs.
- `--status` reads from the persisted file when the scheduler isn’t running, making audits possible in CI or local verification.

### Plugin Development

```bash
# Create new plugin
mkdir src/plugins/custom
touch src/plugins/custom/my-plugin.ts

# Test plugin in isolation
pnpm test src/plugins/custom/my-plugin.test.ts

# Register plugin
# Add to src/plugins/index.ts
```

## 🔧 Configuration

### Environment Variables

```bash
# OpenTelemetry configuration
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector.com
OTEL_SERVICE_NAME=cortexdx

# Plugin budgets (can also use CLI flags)
CORTEXDX_BUDGET_TIME=10000    # 10 seconds per plugin
CORTEXDX_BUDGET_MEM=128       # 128MB memory limit

# Debug logging
DEBUG=cortexdx:*            # Enable debug logging

# Monitoring state file (optional override for --state-file)
CORTEXDX_MONITOR_STATE=.cortexdx/monitoring-status.json

# Enforce security control coverage (ASVS/MITRE)
CORTEXDX_ENFORCE_SECURITY=1

# Force Auth0 device code flow
CORTEXDX_AUTH0_DEVICE_CODE=1
# Override Auth0 device authorization endpoint
CORTEXDX_AUTH0_DEVICE_CODE_ENDPOINT=https://tenant.auth0.com/oauth/device/code

# Dependency Track integration
CORTEXDX_DT_API_URL=https://dt.example.com
CORTEXDX_DT_API_KEY=dt-api-key
CORTEXDX_DT_PROJECT=cortexdx
CORTEXDX_DT_PROJECT_VERSION=1.0.0
```

### CI/CD Integration

#### GitHub Actions

```yaml
name: MCP Diagnostics
on: [push, pull_request]

jobs:
  diagnose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          
      - name: Run MCP Diagnostics
        run: |
          npx @brainwav/cortexdx diagnose ${{ secrets.MCP_ENDPOINT }} \
            --full --out reports --deterministic
            
      - name: Upload Reports
        uses: actions/upload-artifact@v4
        with:
          name: mcp-diagnostic-reports
          path: reports/
          
      - name: Fail on Major Issues
        run: |
          # Exit code 2 indicates major findings
          if [ $? -eq 2 ]; then
            echo "Major MCP issues detected - failing build"
            exit 1
          fi
```

#### Exit Codes

- **0**: Success (no blockers or majors)
- **1**: Blocker findings detected (critical issues)
- **2**: Major findings detected (important issues)

## 🔒 Security & Privacy

### Data Handling

- **Read-Only**: Never mutates target MCP servers
- **Local Processing**: All analysis performed locally
- **Optional HAR**: Network capture only with `--har` flag
- **Credential Redaction**: Automatic sanitization of sensitive data

### Sandbox Security

- **Worker Threads**: Plugins run in isolated Node.js workers
- **Resource Limits**: Configurable CPU time and memory budgets
- **API Restrictions**: Blocked access to `fs`, `child_process`, raw sockets
- **Fallback Safety**: Graceful degradation if worker threads unavailable

## 🐛 Troubleshooting

### Common Issues

**Connection Timeouts**

```bash
# Increase timeout budgets
cortexdx diagnose <endpoint> --budget-time 15000

# Check network connectivity
cortexdx doctor
```

**Memory Issues**

```bash
# Increase memory budget
cortexdx diagnose <endpoint> --budget-mem 256

# Use lighter suite selection
cortexdx diagnose <endpoint> --suites discovery,protocol
```

**Authentication Problems**

```bash
# Test different auth methods
cortexdx diagnose <endpoint> --auth bearer:token
cortexdx diagnose <endpoint> --auth basic:user:pass
cortexdx diagnose <endpoint> --auth header:Authorization:"Bearer token"
```

**CI/CD Integration**

```bash
# Use deterministic mode for consistent results
cortexdx diagnose <endpoint> --deterministic --no-color

# Generate machine-readable output only
cortexdx diagnose <endpoint> --out reports
cat reports/cortexdx-findings.json | jq '.findings[].severity'
```

### Debug Logging

```bash
# Enable debug output
DEBUG=cortexdx:* cortexdx diagnose <endpoint>

# Plugin-specific debugging
DEBUG=cortexdx:plugin:* cortexdx diagnose <endpoint>

# Network debugging
DEBUG=cortexdx:adapter:* cortexdx diagnose <endpoint>
```

## 📚 Documentation

### Core Documentation

- **[Getting Started](docs/GETTING_STARTED.md)**: Installation and first steps
- **[User Guide](docs/USER_GUIDE.md)**: Comprehensive usage documentation
- **[API Reference](docs/API_REFERENCE.md)**: Complete CLI and programmatic API
- **[Troubleshooting](docs/TROUBLESHOOTING.md)**: Common issues and solutions

### Developer Resources

- **[Plugin Development](docs/PLUGIN_DEVELOPMENT.md)**: Creating custom diagnostic plugins
- **[IDE Integration](docs/IDE_INTEGRATION.md)**: Editor setup and extensions
- **[Contributing](docs/CONTRIBUTING.md)**: Development and contribution guide
- **[Phase 5 Roadmap](../../docs/PHASE5_ROADMAP.md)**: Upcoming OWASP/Auth0/SBOM/tutorial milestones
- **[Report Manager](../../docs/REPORT_MANAGER.md)**: How consolidated reports (`--report-out`) are stored and reviewed

### Operations

- **[Deployment](docs/DEPLOYMENT.md)**: Production deployment guidance

### Quick Links

- 🚀 **First time?** → [Getting Started](docs/GETTING_STARTED.md)
- 🔧 **Having issues?** → [Troubleshooting](docs/TROUBLESHOOTING.md)
- 🛠️ **Want to contribute?** → [Contributing](docs/CONTRIBUTING.md)
- 🔌 **Building plugins?** → [Plugin Development](docs/PLUGIN_DEVELOPMENT.md)

## 🤝 Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development setup, coding standards, and contribution guidelines.

## 📄 License

Licensed under the [Apache License 2.0](LICENSE).
