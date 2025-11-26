# CortexDx – Developer Overview

📖 **[View Glossary](GLOSSARY.md)** for definitions of abbreviations and technical terms.

CortexDx is a stateless, plugin-first diagnostic tool for the Model Context Protocol (MCP) that validates server and client implementations across transports, security, and performance dimensions. It exists to give engineers actionable, evidence-backed findings before production deployments, with deterministic runs that slot into Continuous Integration/Continuous Deployment (CI/CD) and governance workflows.

## Table of Contents

- [Capabilities at a Glance](#capabilities-at-a-glance) — key features and limits
- [Primary Use Cases & Actors](#primary-use-cases--actors) — who uses CortexDx and why
- [System Architecture Overview](#system-architecture-overview) — structure and data flow
- [Tech Stack & Dependencies](#tech-stack--dependencies) — runtimes, libraries, storage
- [Key Modules & Entry Points](#key-modules--entry-points) — high-value starting points
- [Data & Integrations](#data--integrations) — entities and external systems
- [Generative/AI Capabilities](#generativeai-capabilities) — LLM routing and safety
- [Setup & Local Development](#setup--local-development) — commands and environment prep
- [How to Start Contributing](#how-to-start-contributing) — first tasks and norms
- [Known Gaps & Open Questions](#known-gaps--open-questions) — items to clarify

## Capabilities at a Glance
- **Diagnostic scans across Model Context Protocol (MCP) transports**: Exercises HTTP/HTTPS, Server-Sent Events (SSE), WebSocket, JSON-RPC (Remote Procedure Call), and optional gRPC shims to verify protocol compliance and streaming behavior; designed to remain stateless and read-only while honoring proxies and authentication settings.
- **Security and governance checks**: Evaluates Cross-Origin Resource Sharing (CORS), authentication flows (Auth0, API keys), rate limiting, and threat-model controls, emitting severity-gated findings that can fail CI when blocker/major issues remain.
- **Evidence-rich reporting**: Produces Markdown and JSON reports (plus optional SQLite index) with severity prefixes and citations suitable for accessibility and automated gating; supports comparisons between runs.
- **LangGraph-powered orchestration**: Runs deterministic workflows (agents or parallel plugins) with checkpointing, resumable threads, and research pre-flights; configurable state database for recovery.
- **Academic research aggregation**: Pulls contextual findings from providers like Context7, Vibe Check, OpenAlex, Exa, Wikidata, and arXiv with configurable limits and credentials, optionally exposed via MCP tools.
- **CLI tooling and monitoring**: Commands for diagnose, orchestrate, research, doctor, monitor, compare, tutorial, and generate; monitoring can persist scheduler state for restart-friendly health checks.
- **Plugin sandboxing and extensibility**: Sandboxed worker threads with CPU/memory budgets and a registry/loader pattern for adding protocol, security, performance, and development plugins.

## Primary Use Cases & Actors
- **MCP server implementers**: Run `cortexdx diagnose` or `--full` to validate protocol, streaming, and governance behavior before launch; success means zero blocker/major findings and accessible reports.
- **Platform/DevOps teams**: Integrate CortexDx into CI/CD using severity-based exit codes and SBOM/security scripts; success is automated gating and attached artifacts for auditors.
- **Security engineers**: Use security suites (CORS, auth, rate limiting) and semgrep/gitleaks/ZAP wrappers; success requires secrets redaction, deterministic results, and documented evidence pointers.
- **Researchers/QA**: Invoke `research` or orchestrated runs with academic providers to gather contextual evidence; success is reproducible findings with provider credentials scoped per run.
- **Self-diagnostics developers**: Use `self:diagnose` profiles to run CortexDx against itself with deterministic flags and proper secrets; success yields complete self-report artifacts and log capture.

## System Architecture Overview
CortexDx is a monorepo-based Node.js/TypeScript application centered on a Command Line Interface (CLI) and optional HTTP/SSE server. The CLI entrypoint routes commands to an orchestrator that coordinates plugins, transports, large language model (LLM) adapters, and reporters. LangGraph workflows provide resumable, checkpointed orchestration for complex diagnostic or research tasks.

Plugins run inside sandboxed worker threads managed by the plugin host. The diagnostic context mediates transports (HTTP/SSE/WebSocket/STDIO/JSON-RPC/gRPC), authentication, and telemetry. Findings flow to reporters that emit Markdown/JSON and can persist artifacts locally or to S3/R2. A state database (SQLite) is used only for workflow checkpoints and is not shared with target systems.

High-level flow:
```
CLI/Server -> Orchestrator -> Plugin Host -> Sandbox Workers -> Plugins -> Findings -> Reporter -> Artifacts (Markdown/JSON/SQLite/S3)
                                \-> Diagnostic Context -> Transports/LLM/Observability -> Target MCP Server
```

Orchestration and storage surfaces:
```
[CLI Command] -> [Workflow Graph] -> [Checkpoint Store (SQLite)] -> [Resume/Retry]
                                     -> [Reporter] -> [Artifacts + Evidence Pointers]
```

## Tech Stack & Dependencies
- **Runtime/Language**: Node.js 20.x, TypeScript (ESM, NodeNext resolution).
- **Frameworks/Libraries**: Commander (CLI), LangGraph/ LangChain, fastmcp, OpenTelemetry, Pino, AJV/Zod for validation, worker-thread sandboxing.
- **Storage**: Optional SQLite checkpoint DB for LangGraph; artifacts to filesystem and optional S3/R2 via AWS SDK; no persistent state on targets.
- **Infrastructure**: Nx monorepo with pnpm; tsup for bundling; Vitest for testing; Biome for lint/format; optional macOS LaunchAgents and Cloudflare tunnel scripts; accessibility checks via axe-core/playwright.
- **Version/constraints**: Engines node >=20; workspace-managed pnpm 9.12.2 and Nx 19.8.4; adheres to named exports and <40-line functions per repository standards.

## Key Modules & Entry Points
- `packages/cortexdx/src/cli.ts`: CLI entrypoint wiring commands to command handlers and orchestrator.
- `packages/cortexdx/src/server.ts`: HTTP/SSE server exposing MCP-compatible endpoints and tools.
- `packages/cortexdx/src/commands/`: Implementations for commands like diagnose, orchestrate, research, monitor, doctor, compare, tutorial, and generate.
- `packages/cortexdx/src/orchestration/`: LangGraph workflows, checkpoint handling, and resume logic.
- `packages/cortexdx/src/plugins/`: Core diagnostic plugins (protocol, security, performance, development) executed in sandboxed workers.
- `packages/cortexdx/src/context/`: Diagnostic context handling transports, auth, telemetry, and environment configuration.
- `packages/cortexdx/src/report/`: ReportManager and formatters for Markdown/JSON/SQLite artifacts.
- `packages/cortexdx/src/ml/`: LLM router/adapters (local Ollama and cloud providers) with priority profiles.
- `packages/cortexdx/src/providers/`: Academic research provider clients and normalization logic.
- `packages/cortexdx/src/storage/`: State management (SQLite) and pattern storage for checkpoints and learning.

## Data & Integrations
- **Main entities**: Diagnostics (suites/plugins), Findings (severity + evidence), Reports (Markdown/JSON plus SQLite index), Checkpoints (LangGraph state), Research artifacts.
- **External integrations**: MCP targets over HTTP/SSE/WS/JSON-RPC/gRPC; academic providers (Context7, Vibe Check, OpenAlex, Exa, Wikidata, arXiv, optional Semantic Scholar); Auth0 or API-key auth; optional S3/R2 for artifacts; OpenTelemetry exporters; Cloudflare tunnels; SBOM upload to Dependency Track.
- **Contracts/schemas**: MCP JSON-RPC schemas, LangGraph checkpoint format, report schemas validated via AJV/Zod, deterministic severity exit codes (blocker → 1, major → 2).

## Generative/AI Capabilities
- LLM routing supports local Ollama (e.g., llama3.1) and cloud providers selected via priority profiles; configured through environment variables for local vs. cloud backends.
- LangGraph workflows use LLM-backed agents for orchestration, self-improvement, and research summarization.
- Prompts and workflows live under `src/orchestration/`, `src/ml/`, and plugin-specific logic; deterministic flags and checkpoints keep runs reproducible.
- Safety mechanisms include sandboxed plugin execution, deterministic seeds, evidence pointers for findings, and auth/transport guardrails (no writes, no destructive actions).

## Setup & Local Development
1. **Clone**: `git clone https://github.com/jscraik/CortexDx.git && cd CortexDx`.
2. **Toolchain**: `mise install` to install pinned Node/pnpm, then `pnpm install` (workspace manages dependencies).
3. **Environment configuration**: Populate `.env` from 1Password; common keys include `EXA_API_KEY`, `CONTEXT7_API_KEY`, `VIBE_CHECK_HTTP_URL`, `OPENALEX_CONTACT_EMAIL`, `CORTEXDX_API_KEY`, `CORTEXDX_ADMIN_TOKEN`, optional Auth0 settings, and TLS certificate paths. Use `op run --env-file=.env -- pnpm <command>` to load secrets.
4. **Run locally**:
   - **CLI dev**: `pnpm --filter @brainwav/cortexdx dev` or `pnpm --filter @brainwav/cortexdx run dev`.
   - **Server**: `pnpm --filter @brainwav/cortexdx run server` (TLS/auth recommended for /mcp); `pnpm --filter @brainwav/cortexdx run server:prod` runs built output.
   - **Self-diagnostics**: copy `.env.self.example` → `.env.self`, then `pnpm self:diagnose` to start the server and run diagnose/orchestrate against it with deterministic flags.
5. **Tests/checks**: `pnpm lint`, `pnpm test`, `pnpm build`. Integration tests: `CORTEXDX_RUN_INTEGRATION=1 pnpm test:integration`. Research smoke (requires secrets for providers being tested, but automatically skips providers with missing credentials): `op run --env-file=.env -- pnpm research:smoke` (skips providers missing secrets but records gaps).
6. **Optional tooling**: Security scans via `pnpm security:semgrep`, `pnpm security:gitleaks`, `pnpm security:zap <url>`. Software Bill of Materials (SBOM) generation via `pnpm sbom --manifest package.json --out reports/sbom`.

## How to Start Contributing
- **Read first**: skim this overview, `README.md`, `docs/ARCHITECTURE.md`, and `.cortexdx/rules/vision.md` for roadmap alignment.
- **First code paths**: explore `src/commands/diagnose.ts` and `src/plugins/` to see plugin execution flow; review `src/report/` for evidence handling and severity exits.
- **Starter tasks**: (a) add or refine a plugin lint/test case in `packages/cortexdx/tests`, or (b) extend a report formatter with an accessibility tweak (severity prefixes, summary-first). Keep functions under 40 lines and use named exports.
- **Run checks**: for small changes run `pnpm lint && pnpm test && pnpm build`; add `pnpm test:integration` if touching orchestration or transports. Attach evidence paths when updating findings.
- **Code review norms**: deterministic outputs, no default exports, stateless interactions with targets, WCAG 2.2 AA text cues, and severity-based CI gating. Reference relevant docs/vision when filing PRs.

## Known Gaps & Open Questions
- **LLM provider specifics**: Assumption: Ollama + cloud providers are configured via `.env` and router priority, but exact cloud models in use are not enumerated; clarify default cloud model list.
- **Deployment targets**: Assumption: primary distribution is CLI + optional LaunchAgent; confirm if containerized deployments or k8s Helm charts are officially supported.
- **Report persistence**: Assumption: S3/R2 is optional and configured via AWS env vars; confirm any required bucket structure or retention policy.
- **Access policies**: Assumption: security scans (semgrep/gitleaks/ZAP) are optional unless rules change; confirm when they are mandatory for contributions.
