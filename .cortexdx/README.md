# .cortexdx/ Governance Hub

<div align="center">

[![CI](https://github.com/cortex-os/cortex-os/actions/workflows/ci.yml/badge.svg)](https://github.com/cortex-os/cortex-os/actions/workflows/ci.yml)
[![GitHub Issues](https://img.shields.io/github/issues/cortex-os/cortex-os)](https://github.com/cortex-os/cortex-os/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/cortex-os/cortex-os)](https://github.com/cortex-os/cortex-os/pulls)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

This directory is the **single source of truth** for all Cortex-OS governance, policies, and validation rules.

## Authority Chain

1. **[`.cortexdx/rules/AGENTS.md`](https://github.com/cortex-os/cortex-os/blob/main/.cortexdx/rules/AGENTS.md)** - "AGENTS.md is the boss" - Core agentic behavior rules
2. **[`.cortexdx/rules/RULES_OF_AI.md`](https://github.com/cortex-os/cortex-os/blob/main/.cortexdx/rules/RULES_OF_AI.md)** - Fundamental AI governance principles
3. **[`.cortexdx/rules/COPILOT-INSTRUCTIONS.md`](https://github.com/cortex-os/cortex-os/blob/main/.cortexdx/rules/COPILOT-INSTRUCTIONS.md)** - GitHub Copilot specific guidelines
4. **[`.cortexdx/policy/`](https://github.com/cortex-os/cortex-os/tree/main/.cortexdx/policy)** - Machine-readable policies (validated by schemas)
5. **Package-level configs** - Local overrides (must comply with global policies)

## Directory Structure

- **`schemas/`** - JSON Schemas for all policies and data structures
- **`policy/`** - Runtime policies in JSON format (validated against schemas)
- **`rules/`** - Human-readable governance documents (Markdown)
- **`prompts/`** - Agent personas, capability packs, and workflows
- **`gates/`** - Validation scripts that enforce policies
- **`runbooks/`** - Operational procedures and incident response
- **`audit/`** - Compliance tracking and audit logs
- **`commands/`** - CLI command definitions and utilities
- **`docs/`** - Governance reference documentation
- **`indexes/`** - Search indexes used by agents
- **`library/`** - Shared utility modules
- **`tools/`** - Automation scripts executed by agents
- **`tooling/`** - Development helpers and scaffolding

## Usage

All policies and schemas in this directory are enforced by:

1. **Pre-commit hooks** - Local validation before commits
2. **CI/CD pipelines** - Automated validation on PRs
3. **Runtime enforcement** - Policy engines during execution

## Validation

Run all governance validation:

```bash
cd .cortexdx/gates
pnpm run validate
```
