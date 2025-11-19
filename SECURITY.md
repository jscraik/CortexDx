# Security Policy

CortexDx is a stateless MCP diagnostic framework that inspects MCP servers, clients, and LangGraph workflows. It never executes user code directly, but it does analyze prompts, HAR traces, and evidence via configurable LLM backends. This document describes how we keep those diagnostics secure and how you can report issues. For architectural context and deployment guidance, refer to the hardening checklist in [README.md](README.md) and the operational governance rules in [AGENTS.md](AGENTS.md).

📖 **[View Glossary](packages/cortexdx/docs/GLOSSARY.md)** for definitions of abbreviations and technical terms.

---

## Table of Contents

- [Supported Versions](#supported-versions)
- [Threat Model](#threat-model)
- [Authentication & Authorization](#authentication--authorization)
- [Reporting a Vulnerability](#reporting-a-vulnerability)
- [Continuous Security](#continuous-security)

---

## Supported Versions

Only the latest CortexDx release receives security fixes. Please stay on the most recent version to benefit from ongoing hardening work across the CLI, launchd services, and Docker images.

## Threat Model

- **Prompt injection & LLM manipulation** – CortexDx uses version-controlled system prompts (see `config/ollama-models.json`) and validates the required JSON schema after each completion. The Meta-Mentor prompt that powers `pnpm internal:self-improvement` is published alongside deterministic temperature/stop settings so reviewers can verify that academic plug-ins and cloud models (e.g., `kimi-k2:1t`) interpret findings consistently. Findings are tagged when a fallback parser is used so reviewers can spot inconsistent outputs.

- **Tool or plugin misuse** – Core plugins are read-only and run inside worker threads with strict export lists (no filesystem writes or shell access). Custom plugins must pass Biome lint + Vitest in CI before they can run.
- **Data leakage** – Diagnostics forward captured evidence to the configured LLM backend (local Ollama, Ollama Cloud, or frontier APIs). Do not include production secrets unless you control the backend. Use `CORTEXDX_DISABLE_LLM=1` for air-gapped workflows and prefer `op run --env-file=.env.cloud -- …` when booting cloud experiments to avoid storing raw secrets in the workspace.
- **Impersonation / supply chain** – Install CortexDx from this repository or the published `@brainwav/cortexdx` package. Verify tags and SBOM output (`pnpm sbom`) before deployment. Launchd plists and Docker files live under `.Cortex-OS`; avoid unreviewed forks.
- **Tunnel abuse** – The bundled Cloudflare launcher enforces dependency health checks, rate-limited restarts, and log rotation to prevent tunnel hijacking.
- **Service orchestration drift** – Launchd plists under `~/Library/LaunchAgents` declare resource budgets, restart policies, and health/maintenance cronlets. Keep those files aligned with the guidance in `SERVICE_SETUP.md` so that `cortexdx-cloudflared`, `cortexdx.healthcheck`, and `cortexdx.maintenance` can be monitored centrally.

## Authentication & Authorization

CortexDx implements **OAuth 2.0 authentication** via Auth0 to secure API endpoints and restrict access to sensitive operations.

### OAuth 2.0 Integration

- **JWT (JSON Web Token) Validation**: All non-public endpoints require a valid JWT in the `Authorization: Bearer <token>` header
- **JWKS (JSON Web Key Set) Verification**: Tokens are verified against Auth0's published key set
- **Role-Based Access Control**: User roles are extracted from JWT claims to authorize specific operations

### Protected Resources

| Resource Type | Protection Level | Required Role |
|--------------|------------------|---------------|
| Public endpoints (`/health`, `/providers`) | None | - |
| Standard API endpoints | Authentication required | Any authenticated user |
| Admin endpoints (`/admin/*`) | Admin role required | `admin` |
| Restricted tools | Admin role required | `admin` |

### Restricted Tools

The following tools require **admin role authorization** and can only be accessed via dedicated admin endpoints:

- **`wikidata_sparql`** → `POST /admin/tools/wikidata-sparql` – Direct SPARQL (SPARQL Protocol and RDF Query Language) queries to Wikidata
- **`cortexdx_delete_workflow`** → `POST /admin/tools/delete-workflow` – Delete workflow state data

These restrictions prevent unauthorized users from executing potentially destructive operations or arbitrary database queries.

### License Enforcement

CortexDx supports **three-tier licensing** (Community, Professional, Enterprise) with feature gating:

- **Community**: Basic diagnostics, protocol validation, core MCP tools
- **Professional**: Advanced diagnostics, LLM backends, academic validation, performance profiling
- **Enterprise**: All features including custom integrations

Enable license enforcement with `REQUIRE_LICENSE=true`.

### Configuration

```bash
# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_AUDIENCE=https://api.cortexdx.com
REQUIRE_AUTH=true

# License Configuration
REQUIRE_LICENSE=true
DEFAULT_TIER=community
```

For detailed setup instructions, see the [OAuth 2.0 Authentication section](packages/cortexdx/README.md#oauth-20-authentication) in the main README.

## Reporting a Vulnerability

Report issues privately via GitHub security advisories or email the maintainer listed in `package.json`. Expect
acknowledgement within 48 hours; fixes are prioritized by severity and coordinated with downstream consumers
(launchd services, Docker images, npm release).

## Continuous Security

- `pnpm security:semgrep` and `pnpm security:gitleaks` run locally and in CI.
- CI gates (Biome lint, Vitest, `pnpm build`, Semgrep) run on every pull request.
- Nightly DeepContext + MCP inspector baselines detect drift in MCP adapters.
- The self-improvement suite (`pnpm internal:self-improvement`) runs with strict JSON output and uploads reports under `reports/`, producing an auditable trail of remediation steps for each release.
- **OAuth 2.0 tokens** are validated on every request with automatic JWKS rotation support.
- **Role-based access control** ensures only authorized users can execute admin operations.

For high-level safety guidelines, see [README.md](README.md) and the operational rules in [AGENTS.md](AGENTS.md).
