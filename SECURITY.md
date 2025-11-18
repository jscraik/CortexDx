# Security Policy

CortexDx is a stateless MCP diagnostic framework that inspects MCP servers, clients, and LangGraph workflows. It never executes user code directly, but it does analyze prompts, HAR traces, and evidence via configurable LLM backends. This document describes how we keep those diagnostics secure and how you can report issues. For architectural context and deployment guidance, refer to the hardening checklist in [README.md](README.md) and the operational governance rules in [AGENTS.md](AGENTS.md).

## Supported Versions

Only the latest CortexDx release receives security fixes. Please stay on the most recent version to benefit from ongoing hardening work across the CLI, launchd services, and Docker images.

## Threat Model

- **Prompt injection & LLM manipulation** – CortexDx uses version-controlled system prompts (see `config/ollama-models.json`) and validates the required JSON schema after each completion. The Meta-Mentor prompt that powers `pnpm internal:self-improvement` is published alongside deterministic temperature/stop settings so reviewers can verify that academic plug-ins and cloud models (e.g., `kimi-k2:1t`) interpret findings consistently. Findings are tagged when a fallback parser is used so reviewers can spot inconsistent outputs.

  **Enhanced System Prompts (v2.0)**: All system prompts now enforce strict output schemas for determinism and include explicit tool awareness sections. Key security-focused prompts include:

  - **SECURITY_SCANNER_PROMPT** (`security-scanner.ts`): Maps findings to OWASP Top 10 and CWE, enforces severity classification (critical/high/medium/low), and requires actionable remediation with code fixes
  - **PROBLEM_RESOLVER_PROMPT** (`problem-resolver.ts`): Includes mandatory security impact assessment and rollback mechanisms for all generated fixes
  - **DISCOVERY_ANALYSIS_PROMPT** (`discovery.ts`): Validates MCP server capabilities and flags potential security concerns in tool configurations
  - **PERFORMANCE_ANALYSIS_PROMPT** (`performance-analysis.ts`): Detects resource exhaustion patterns and bottlenecks that could indicate security issues

  All prompts enforce:
  - **Deterministic output**: Same input produces same JSON structure
  - **Tool awareness**: Prompts reference available CortexDx security tools (threat-model, compliance-check, asvs-compliance)
  - **Priority ordering**: Security findings always prioritized over performance issues
  - **No unsafe recommendations**: Prompts explicitly forbid suggesting disabling security features

- **Tool or plugin misuse** – Core plugins are read-only and run inside worker threads with strict export lists (no filesystem writes or shell access). Custom plugins must pass Biome lint + Vitest in CI before they can run.
- **Data leakage** – Diagnostics forward captured evidence to the configured LLM backend (local Ollama, Ollama Cloud, or frontier APIs). Do not include production secrets unless you control the backend. Use `CORTEXDX_DISABLE_LLM=1` for air-gapped workflows and prefer `op run --env-file=.env.cloud -- …` when booting cloud experiments to avoid storing raw secrets in the workspace.
- **Impersonation / supply chain** – Install CortexDx from this repository or the published `@brainwav/cortexdx` package. Verify tags and SBOM output (`pnpm sbom`) before deployment. Launchd plists and Docker files live under `.Cortex-OS`; avoid unreviewed forks.
- **Tunnel abuse** – The bundled Cloudflare launcher enforces dependency health checks, rate-limited restarts, and log rotation to prevent tunnel hijacking.
- **Service orchestration drift** – Launchd plists under `~/Library/LaunchAgents` declare resource budgets, restart policies, and health/maintenance cronlets. Keep those files aligned with the guidance in `SERVICE_SETUP.md` so that `cortexdx-cloudflared`, `cortexdx.healthcheck`, and `cortexdx.maintenance` can be monitored centrally.

## Reporting a Vulnerability

Report issues privately via GitHub security advisories or email the maintainer listed in `package.json`. Expect acknowledgement within 48 hours; fixes are prioritized by severity and coordinated with downstream consumers (launchd services, Docker images, npm release).

## Continuous Security

- `pnpm security:semgrep` and `pnpm security:gitleaks` run locally and in CI.
- CI gates (Biome lint, Vitest, `pnpm build`, Semgrep) run on every pull request.
- Nightly DeepContext + MCP inspector baselines detect drift in MCP adapters.
- The self-improvement suite (`pnpm internal:self-improvement`) runs with strict JSON output and uploads reports under `reports/`, producing an auditable trail of remediation steps for each release.

For high-level safety guidelines, see [README.md](README.md) and the operational rules in [AGENTS.md](AGENTS.md).
