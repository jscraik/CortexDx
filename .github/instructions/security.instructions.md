---
applyTo: "**/src/security/**/*.ts"
---

# Security Module Instructions

When working with CortexDx security modules, follow these conventions:

## Core Principles

- **Security first** - No secrets in logs
- **HAR redaction** - Mask sensitive headers
- **OAuth handling** - Through adapters only
- **Stateless scanning** - Read-only analysis

## Required Conventions

- **Named exports only** - Never use `export default`
- **≤40 lines per function** - Split larger functions into helpers
- **No `any` types** - Use explicit types or type guards
- **ESM imports with `.js` extension** - Always use `from "./foo.js"`

## Secret Handling

Never hardcode secrets:
- Use environment variables
- Load via 1Password CLI (`op run --env-file=.env -- <command>`)
- Mask in all outputs

## Headers to Redact

Always redact these headers in HAR/logs:
- `authorization`
- `cookie`
- `token`
- `x-api-key`
- Any header containing `secret` or `key`

## Security Finding Severity

Use appropriate severity levels:
- **blocker** - Critical vulnerability (e.g., no authentication)
- **major** - Significant security issue
- **minor** - Recommended improvement
- **info** - Informational security note

## Rate Limiting

When testing 429/rate-limit semantics:
- Respect budgets
- Avoid DOS behavior
- Use reasonable delays between requests

## OAuth Simulations

For device/client credential flows:
- Simulate safely
- Log as diagnostics only
- Never store real tokens

## Security Tooling Integration

Reference existing security scripts:
```bash
pnpm security:semgrep   # MCP-focused rules
pnpm security:gitleaks  # Secret scanning
pnpm security:zap       # Dynamic scanning
```

## SBOM and Provenance

Maintain SBOM compliance:
- Use CycloneDX/SPDX formats
- Track all dependencies
- Include in CI artifacts
