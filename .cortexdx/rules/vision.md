---
trigger: always_on
alwaysApply: true
---
<!-- filename: /.cortexdx/rules/vision.md -->

# CortexDx MCP Vision Document (v1.1, 2025-11-05)

## 0) North Star (End State)

**CortexDx MCP** is the stateless, read-only **Model Context Protocol (MCP) Meta-Inspector** that every brAInwav delivery uses to harden MCP servers and clients *before* production. It:

1. exercises MCP HTTP(S)/SSE entrypoints, WebSocket bridges, JSON-RPC envelopes, and (optional) gRPC shims with policy-driven probes;
2. detects MCP transport, streaming, auth, rate-limit, permissioning, governance, and threat-model drift with reproducible evidence;
3. emits branded Markdown/JSON/ArcTDD reports, confidence scoring, and actionable file plans ready for remediation;
4. integrates cleanly with Nx, pnpm, Biome, and Mise so teams can slot CortexDx into CI/CD without bespoke wiring.

> **Governance is code.** CortexDx acknowledges the nearest `AGENTS.md`, honors the Constitution + CODESTYLE gates, and treats time freshness and determinism as first-class requirements.

---

## 1) Core Principles

- **Stateless & Read-Only.** Diagnostics never mutate MCP targets; HAR capture is opt-in and redacted client-side.
- **Plugin-First Surface.** Every suite (discovery, auth, streaming, threat-model, etc.) lives behind a worker-thread sandbox with explicit CPU/time/memory budgets and denylisted APIs (`fs`, `child_process`, raw sockets).
- **Deterministic by Design.** `--deterministic` fixes seeds, clocks, and retry jitter; repeat runs produce comparable outputs.
- **Evidence Everywhere.** Findings carry evidence pointers (URLs, logs, files), run stamps, OTEL spans, and optional HAR artifacts.
- **Security & A11y Baseline.** OAuth2 device/client cred simulations, secret hygiene, WCAG 2.2 AA CLI output (no color-only, summary-first).
- **Governance Integration.** `.cortex` packs, policy-drift checks, ArcTDD plans, Constitution branding, and SBOM/license scans enforced via Nx targets.
- **TDD Mandatory.** Tests precede code; Vitest suites cover each plugin; mocks live under `scripts/mock-servers/` with chaos toggles.
- **Toolchain Alignment.** pnpm workspace, Nx smart targets, Biome lint/format, Mise version pinning, tsup for packaging; outputs stay MCP-first and stateless.

---

## 2) System Boundaries & Interfaces (MCP-First)

- **CLI (`cortexdx`).** Commands: `diagnose`, `compare`, `doctor`; Commander-based with structured exit codes (`0/1/2`). All probes assume MCP-compatible transports and schema contracts.
- **Reports.** Markdown + JSON findings, ArcTDD plan, optional file plan patches, redacted HAR bundles—each finding mapped to an MCP suite or capability tag.
- **Observability.** Optional OTLP exporter; structured console logs with `brand:"brAInwav"`; span helper wraps probes and annotates MCP endpoint/suite metadata.
- **Extensibility.** Plugins shipped under `src/plugins/`; additional suites register via the canonical registry module and MUST focus on MCP behaviours (tools/resources/prompts notifications, transport, auth, governance).
- **CI Hooks.** GitHub Action uploads artifacts, enforces severity-based failures, runs SBOM and Biome/Nx gates, and is scoped to MCP diagnostics.
- **Mock Infrastructure.** Scripted MCP endpoints for OK / broken SSE / malformed JSON-RPC / bad CORS cases to reproduce protocol faults deterministically.

Non-MCP diagnostics (generic REST fuzzing, GraphQL, SOAP, etc.) are **explicitly out of scope**. Context adapters and frontier surfaces remain roadmap items (Milestone M2+) and must still mediate through MCP contracts when introduced.

---

## 3) Architecture Overview

### 3.1 CLI Orchestrator
- Commander command tree with consistent branding.
- Parses auth, suite filters, determinism, OTEL, HAR, compare, a11y, and budget flags.
- Hands execution to `runDiagnose`, capturing run stamps and writing artifacts.

### 3.2 Orchestrator & Reporting Core
- `runDiagnose` resolves suites → plugin host, consolidates findings, and writes Markdown/JSON/ArcTDD/file plan outputs.
- `buildJsonReport`, `buildMarkdownReport`, `buildArcTddPlan`, and `buildFilePlan` are named exports enabling downstream automation.

### 3.3 Plugin Host & Sandbox
- Worker-thread sandbox per plugin with configurable budgets (`--budget-time`, `--budget-mem`).
- Fallback to in-process execution only if platform lacks worker support (logged and surfaced as major finding).
- Message channel relays evidence/logs/findings; type guards prevent `any` leakage.

### 3.4 Adapters & Probes
- MCP HTTP/S, JSON-RPC, SSE, WS (with `eventsource-parser`), and optional gRPC shims; deterministic SSE probes with keepalive heuristics.
- Batch JSON-RPC tests cover mixed ID types, notifications, and error data.
- CORS, rate-limit, permissioning, threat-model, devtool-env, tool-drift, streaming suites map to spec hardening deltas.

### 3.5 Observability & Evidence Pipeline
- OTEL helper (`withSpan`) sets attributes (endpoint, suite, severity, confidence, version, duration).
- Optional HAR redactor ensures secrets/tokens replaced; outputs stay local.
- Logger emits evidence tokens for governance auditing.

### 3.6 Packaging & Distribution
- tsup bundles CLI + index + plugin registry + worker.
- Package metadata: `@brainwav/cortexdx`, Node 20+, sideEffects false, Commander entrypoint.
- Nx `project.json` orchestrates build/test/lint/doctor targets; Biome handles lint/format; Mise pins Node/pnpm.

### 3.7 Developer Experience & Doctor Command
- `doctor` surfaces Node version, Playwright deps, MLX/Ollama availability, DNS/proxy tips, Windows WSL guidance (roadmap for deeper checks).
- `scripts/mock-servers/` offer deterministic repro of protocol failures.

---

## 4) Roadmap Alignment (from PRD v1.1)

| Milestone | Focus | Key Deliverables |
|-----------|-------|------------------|
| **M0** | Scaffold & Core Plugins | CLI, orchestrator, HTTP/JSON-RPC/SSE adapters, discovery/auth/protocol plugins, reporting pipeline. |
| **M0.5 (Hardening)** | Spec-integrated additions | CORS, JSON-RPC batch, SSE reconnect, rate-limit, threat-model, permissioning, devtool-env, tool drift, worker sandbox, OTEL, HAR redactor, compare command, doctor, mock servers, CI workflows, deterministic mode. |
| **M1** | Streaming & Governance Depth | Heartbeat/sticky session policies, `.cortex` drift detection, enhanced security heuristics, chaos toggles. |
| **M2** | Context Adapters & Performance | AVIX/arXiv/Context7 adapters, performance lab, compare-run diff UX, richer evals. |
| **M3** | Packaging Options | Optional prebuilt binaries, minimal TUI/Web dashboard, polished gRPC adapter. |

All milestones must uphold TDD, coverage/mutation gates, WCAG compliance, Semgrep/OSV/gitleaks scans, and determinism guarantees.

---

## 5) Success Metrics

- **Coverage & Quality.** ≥90% unit coverage on plugins/adapters; zero lint violations; mutation testing baseline tracked.
- **Reliability.** Golden-path diagnose run completes under 60s with ≤2% variance under deterministic mode.
- **Security.** 100% findings carry evidence pointers; no secrets in logs or artifacts; SBOM/license step green.
- **Governance.** ArcTDD plan generated per run; policy-drift plugin flags version mismatches; branding/a11y checks enforced in CI.
- **Adoption.** CLI integrated into brAInwav standard Nx workflow; GitHub Action uploads artifacts on every PR/nightly.

---

## 6) Non-Goals

- Running arbitrary target-side mutations or exploit attempts.
- Maintaining long-lived state, credential stores, or telemetry beyond local artifacts.
- Shipping multiple MCP servers or managing remote agents; CortexDx remains a diagnostic client.
- Implementing full frontier adapters before roadmap Milestone M2.
- Acting as a generic API/security scanner for non-MCP protocols (REST/GraphQL/SOAP/etc.).

---

## 7) Shared Responsibilities

- **Engineers/Agents**: Follow ArcTDD, keep plugin functions ≤40 lines, ensure named exports, update tests before code, cite evidence.
- **DevOps**: Maintain Nx workflow, GitHub Actions, secrets policy for HAR/OTEL, Mise tool chain, SBOM pipelines.
- **Security**: Review new plugins for sandbox compliance, secret-handling, and determinism; approve rate-limit/auth heuristics.
- **Docs**: Keep README/vision in sync with PRD changes; document new flags and governance impacts.

> **Reminder:** Before shipping, run `pnpm lint && pnpm test && pnpm build` and validate reports against at least one mock server.
