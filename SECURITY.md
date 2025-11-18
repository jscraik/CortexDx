# Security Policy

CortexDx is a stateless MCP diagnostic framework that inspects MCP servers, clients, and LangGraph workflows. It never executes user code directly, but it does analyze prompts, HAR traces, and evidence via configurable LLM backends. This document describes how we keep those diagnostics secure and how you can report issues. For architectural context and deployment guidance, refer to the hardening checklist in [README.md](README.md) and the operational governance rules in [AGENTS.md](AGENTS.md).

## Supported Versions

Only the latest CortexDx release receives security fixes. Please stay on the most recent version to benefit from ongoing hardening work across the CLI, launchd services, and Docker images.

## Threat Model

- **Prompt injection & LLM manipulation** – CortexDx uses version-controlled system prompts embedded in plugin
  code (see `packages/cortexdx/src/plugins/development/self-improvement.ts`) and validates the required JSON schema
  after each completion. The MCP Inspector prompt that powers `pnpm internal:self-improvement` uses deterministic
  temperature/stop settings configured in `config/ollama-models.json` so reviewers can verify that academic plug-ins
  and cloud models (e.g., `kimi-k2:1t-cloud`) interpret findings consistently. Findings are tagged when a fallback
  parser is used so reviewers can spot inconsistent outputs.
- **Tool or plugin misuse** – Core plugins are read-only with strict export lists (no filesystem writes or shell
  access by design). Custom plugins must pass Biome lint + Vitest in CI before they can run. Worker thread
  sandboxing is planned but not yet enforced in production.
- **Data leakage** – Diagnostics forward captured evidence to the configured LLM backend (local Ollama, Ollama
  Cloud, or frontier APIs). Do not include production secrets unless you control the backend. Use
  `CORTEXDX_DISABLE_LLM=1` for air-gapped workflows and prefer `op run --env-file=.env.cloud -- …` when booting
  cloud experiments to avoid storing raw secrets in the workspace.
- **Impersonation / supply chain** – Install CortexDx from this repository. The package is configured as
  `@brainwav/cortexdx` but not yet published to npm. Verify tags and SBOM output (`pnpm sbom`) before deployment.
  Launchd plists are stored in the repository root (e.g., `com.brainwav.cortexdx.plist`); avoid unreviewed forks.
- **Tunnel abuse** – The bundled Cloudflare launcher enforces dependency health checks, rate-limited restarts,
  and log rotation to prevent tunnel hijacking.
- **Service orchestration drift** – Launchd plists installed to `~/Library/LaunchAgents` (sourced from repository
  root) declare resource budgets, restart policies, and health/maintenance cronlets. Keep those files aligned with
  the guidance in `SERVICE_SETUP.md` so that `com.brainwav.cortexdx-cloudflared`, `com.brainwav.cortexdx.healthcheck`,
  and `com.brainwav.cortexdx.maintenance` can be monitored centrally.

## Reporting a Vulnerability

Report issues privately via GitHub security advisories or email the maintainer listed in `package.json`. Expect
acknowledgement within 48 hours; fixes are prioritized by severity and coordinated with downstream consumers
(launchd services, Docker images, npm release).

## Continuous Security

- `pnpm security:semgrep` and `pnpm security:gitleaks` run locally and in CI.
- CI gates (Biome lint, Vitest, `pnpm build`, Semgrep) run on every pull request.
- Nightly DeepContext + MCP inspector baselines detect drift in MCP adapters.
- The self-improvement suite (`pnpm internal:self-improvement`) runs with strict JSON output and uploads reports
  under `reports/`, producing an auditable trail of remediation steps for each release.

For high-level safety guidelines, see [README.md](README.md) and the operational rules in [AGENTS.md](AGENTS.md).
