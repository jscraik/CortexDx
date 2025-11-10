# CortexDx – Agentic Self-Healing Suite (Draft)

> _Scope_: Defines the LangGraph-powered self-healing/self-improvement system that exercises every diagnostic and academic plugin, reasons with Ollama, and feeds auto-healer outputs back into CortexDx. This document is Step 1 of the implementation plan.

## 1. Goals

- Provide an **agentic control plane** that can orchestrate Inspector, internal diagnostics, third-party (academic) plugins, and auto-healing in a single run.
- Treat every diagnostic/academic capability as a callable **tool** so the suite “puts CortexDx through its paces.”
- Use **LangGraph + Ollama** for reasoning, summarisation, and remediation planning.
- Produce deterministic evidence (JSON + Markdown reports) suitable for CI gating and human review.

## 2. High-Level Architecture

```
┌────────────────┐
│ ContextBuilder │
└──────┬─────────┘
       ▼
┌────────────────┐
│ InspectorProbe │───┐
└──────┬─────────┘   │ transcripts/logs
       ▼             │
┌────────────────┐   │
│ SelfImprovement│   │
└──────┬─────────┘   │
       ▼             │
┌────────────────┐   │ findings
│ PluginRunner   │◄──┘ (diagnostics)
└──────┬─────────┘
       ▼
┌────────────────┐
│ AcademicCheck  │
└──────┬─────────┘
       ▼
┌────────────────┐
│ LLMReasoner    │  (Ollama via EnhancedLlmAdapter)
└──────┬─────────┘
       ▼
┌────────────────┐
│ AutoHealer     │
└──────┬─────────┘
       ▼
┌────────────────┐
│ ReportAssembler│→ JSON/MD + artifacts
└────────────────┘
```

### 2.1 LangGraph State
```ts
interface SelfHealingState {
  context: DevelopmentContext;
  findings: Finding[];
  artifacts: Record<string, string>;
  transcripts: {
    inspector?: string;
    plugins: Record<string, string>;
  };
  remediationPlans: AutoHealPlan[];
  severitySummary: Record<Severity, number>;
}
```

### 2.2 Node Responsibilities

| Node | Role | Inputs | Outputs |
| --- | --- | --- | --- |
| `ContextBuilder` | Assemble `DevelopmentContext` (endpoint, history, project metadata, auth). | CLI flags/env. | `SelfHealingState.context`. |
| `InspectorProbe` | Run MCP Inspector via stdio wrapper, capture transcript. | `context`. | Inspector findings + transcripts. |
| `SelfImprovement` | Execute existing plugin (handshake, transport, dependency checks). | `context`. | Findings + logs. |
| `PluginRunner` | Iterate over diagnostic plugins (security, performance, accessibility, transport, sandbox health, etc.). | `context`. | Normalised findings + plugin logs. |
| `AcademicCheck` | Run smoke tests on academic providers (capability queries, sample prompts). | `context`. | Findings tagged `academic`. |
| `LLMReasoner` | Summarise findings, prioritise severities, propose remediation steps. Uses Ollama via `EnhancedLlmAdapter`. | All findings. | Annotated findings + remediation suggestions. |
| `AutoHealer` | Consume LLM guidance + structured findings, generate `AutoHealPlan`s, optionally run file plans (sandboxed). | Findings + remediation hints. | Plans + execution evidence. |
| `ReportAssembler` | Write JSON + Markdown summary, archive artifacts under `reports/self-healing/<timestamp>/`. | Final state. | Files + exit status. |

## 3. Tool Wrapping (Plugins & Providers)

### 3.1 Diagnostic Plugins (initial set)
- `security-scanner`
- `performance`
- `transport`
- `sandbox-health`
- `accessibility`
- `governance`
- `atlas-threat-detector`

Each plugin will expose a LangGraph tool signature:
```ts
type DiagnosticTool = (ctx: DevelopmentContext) => Promise<NormalizedFinding[]>;
```

### 3.2 Academic Providers
- For each provider, define a health/smoke tool (e.g., `academic.providerId.healthCheck(ctx)`).
- Provide sample queries that validate schema, prompt packs, and licensing rules.

## 4. Ollama Integration

- Reuse `EnhancedLlmAdapter` but lock the backend to Ollama:
  - `backend: 'ollama'`.
  - `modelId` configurable via CLI/env (defaults to `gpt-oss-safeguard:latest`).
- Model metadata resolves through `config/ollama-models.json` so that only vetted Ollama builds (no MLX fallbacks) are available to the suite.
- Reasoner prompts are cached by SHA-256 of `{model, prompt, findings}` with YAML prompt records under `reports/_cache/ollama/` for deterministic replays.
- `LLMReasoner` node tasks:
  1. Summarise multi-plugin findings.
  2. Cluster related issues.
  3. Suggest remediation steps referencing evidence pointers.
  4. Detect regression patterns (compare to previous run stored in reports directory).
- Deterministic mode: allow `--deterministic` flag to skip LLM or use cached responses for CI.

## 5. Auto-Healer Loop

- Auto-healer receives structured findings + LLM proposals, then:
  - Maps severity to action (`patch`, `open issue`, `request human`).
  - Executes file plans in sandbox (if allowed) or logs proposed diffs.
  - Records success/failure per finding.
- Feedback loop: successful heals update pattern-learning storage so future runs can recognise identical issues quickly.

## 6. Report & Artifact Strategy

- Directory: `reports/self-healing/YYYYMMDD-HHMMSS/`
  - `summary.json` – canonical data for CI.
  - `summary.md` – human-readable report, severity-first (WCAG compliant).
  - `inspector.log`, `plugins/<name>.log`, `auto-healer.log`.
  - `remediation-plans.json` – executed or pending auto-heal steps.
- Exit codes: 
  - 0 = no findings ≥ minor.
  - 1 = minor-only findings (warning mode).
  - 2 = ≥ major (block CI).

## 7. CLI & Automation

- New target: `pnpm internal:self-healing-suite --endpoint ...`
- Flags: `--model <id>` (Ollama), `--plugins <list>`, `--skip-auto-heal`, `--deterministic`.
- CI: add Nx target + GitHub Action to run suite on PRs touching diagnostics; nightly job runs full sweep against LaunchAgent-managed CortexDx instance.
- LaunchAgent: schedule suite to run after each release candidate deployment; artifacts publish to internal dashboard.

## 8. Next Steps

1. **Implement LangGraph scaffold + CLI (Step 2).**
2. Onboard diagnostic plugins & academic providers as tools.
3. Integrate Ollama + auto-healer logic.
4. Build reporting layer and CI wiring.
5. Iterate with Brainwav dev team for refinements.

---

_Draft v0.1 — to be updated as implementation progresses._
