---
status: "documentation"
created: "2025-11-16"
purpose: "Track governance-referenced tools that are not yet implemented"
---

# Missing Tools Documentation

This document tracks tools referenced in governance documents that are not yet implemented in package.json scripts.

## Status Legend
- ❌ Not Implemented
- ⚠️ Partial Implementation
- ✅ Implemented
- 🔄 Alternative Exists

## Tool Inventory

### ArcTDD Workflow Tools

| Tool | Status | Referenced In | Priority | Notes |
|------|--------|---------------|----------|-------|
| `pnpm arc:new` | ❌ | agentic-coding-workflow.md:108 | HIGH | Scaffolds new arc with template |
| `pnpm arc:lint` | ❌ | agentic-coding-workflow.md:112 | HIGH | Validates arc manifest step budget ≤7 |
| `pnpm changelog:new` | ❌ | agentic-coding-workflow.md:567 | HIGH | Creates task folder structure |
| `pnpm session:reset` | ❌ | agentic-coding-workflow.md:490 | MEDIUM | Records session reset in manifest |

### Evidence & Verification Tools

| Tool | Status | Referenced In | Priority | Notes |
|------|--------|---------------|----------|-------|
| `pnpm evidence:triplet:verify` | ❌ | agentic-coding-workflow.md:592 | HIGH | Validates Evidence Triplet completeness |
| `pnpm evidence:collect` | ❌ | Analysis recommendation | MEDIUM | Automated evidence aggregation |
| `pnpm perf:verify` | ❌ | code-review-checklist.md:146 | MEDIUM | Generates performance verification reports |

### Governance Tools

| Tool | Status | Referenced In | Priority | Notes |
|------|--------|---------------|----------|-------|
| `pnpm governance:lint-checklist` | ❌ | code-review-checklist.md:46 | MEDIUM | Verifies checklist link format and tags |
| `pnpm governance:helpers` | ❌ | code-review-checklist.md:138 | MEDIUM | Validates helper introduction artifacts |
| `pnpm governance:validate` | ❌ | Analysis recommendation | LOW | Checks governance file integrity |

### Model & Research Tools

| Tool | Status | Referenced In | Priority | Notes |
|------|--------|---------------|----------|-------|
| `pnpm models:health` | ❌ | agentic-coding-workflow.md:583 | HIGH | Live model health check |
| `pnpm models:smoke` | ❌ | agentic-coding-workflow.md:583 | HIGH | Live model smoke tests |

### Supply Chain & Security Tools

| Tool | Status | Referenced In | Priority | Notes |
|------|--------|---------------|----------|-------|
| `pnpm sbom:generate` | ⚠️ | agentic-coding-workflow.md:115 | HIGH | Exists as `pnpm sbom` - needs rename/alias |
| `pnpm attest:sign` | ❌ | agentic-coding-workflow.md:115 | HIGH | Sign SLSA provenance with Cosign v3 |
| `pnpm verify:attest` | ❌ | agentic-coding-workflow.md:115 | HIGH | Verify Cosign bundle signatures |
| `pnpm structure:validate` | ❌ | agentic-phase-policy.md:72 | MEDIUM | Validates project structure against rules |

### Testing Tools

| Tool | Status | Referenced In | Priority | Notes |
|------|--------|---------------|----------|-------|
| `pnpm test:smart` | ❌ | agentic-coding-workflow.md:213 | MEDIUM | Nx affected tests |
| `pnpm lint:smart` | ❌ | agentic-coding-workflow.md:214 | MEDIUM | Nx affected linting |
| `pnpm typecheck:smart` | ❌ | agentic-coding-workflow.md:215 | MEDIUM | Nx affected type checking |
| `pnpm test:coverage` | ❌ | agentic-coding-workflow.md:344 | MEDIUM | Coverage with specific options |
| `pnpm test:a11y` | ❌ | agentic-coding-workflow.md:317 | HIGH | Accessibility testing |

### CI/CD Tools

| Tool | Status | Referenced In | Priority | Notes |
|------|--------|---------------|----------|-------|
| `pnpm telemetry:arc-tdd` | ❌ | agentic-coding-workflow.md:512 | LOW | Emit telemetry for arc completion |

## Existing Tools (For Reference)

These tools ARE implemented and should be used:

| Tool | Location | Purpose |
|------|----------|---------|
| `pnpm build` | root package.json | Build cortexdx package |
| `pnpm test` | root package.json | Run tests |
| `pnpm lint` | root package.json | Run Biome linting |
| `pnpm sbom` | root package.json | Generate SBOM (needs standardization to `sbom:generate`) |
| `pnpm security:semgrep` | packages/cortexdx/package.json | Run Semgrep security scan |
| `pnpm security:gitleaks` | packages/cortexdx/package.json | Run gitleaks secret scan |
| `pnpm security:zap` | packages/cortexdx/package.json | Run OWASP ZAP scan |
| `pnpm docs:validate` | root package.json | Validate documentation |

## Implementation Recommendations

### Phase 1 (Critical - Blocks Workflow)
1. Implement `pnpm arc:new` - Arc scaffolding is referenced extensively
2. Implement `pnpm models:health` and `pnpm models:smoke` - Required for phase transitions
3. Implement `pnpm evidence:triplet:verify` - Critical for G5 verification
4. Standardize `pnpm sbom` → `pnpm sbom:generate` (or create alias)

### Phase 2 (Important - Enhances Workflow)
1. Implement `pnpm attest:sign` and `pnpm verify:attest` - Supply chain requirements
2. Implement `pnpm structure:validate` - Referenced in phase machine
3. Implement `pnpm test:a11y` - WCAG compliance requirement
4. Implement `pnpm changelog:new` - Task scaffolding

### Phase 3 (Nice to Have - Improves DX)
1. Implement `pnpm test:smart`, `pnpm lint:smart`, `pnpm typecheck:smart` - Nx affected workflows
2. Implement `pnpm governance:*` tools - Automation helpers
3. Implement `pnpm evidence:collect` - Evidence aggregation
4. Implement `pnpm session:reset` - Session tracking

## Workarounds (Until Implementation)

### For missing arc tools
```bash
# Instead of: pnpm arc:new --slug foo
# Manually create: ~/Changelog/foo/{notes.md, implementation-plan.md, etc.}
```

### For missing evidence tools
```bash
# Instead of: pnpm evidence:triplet:verify
# Manually check for: milestone test, contract snapshot, reviewer JSON
```

### For missing model tools
```bash
# Instead of: pnpm models:health
# Manually check model endpoints or use package-specific health checks
```

### For SBOM
```bash
# Use existing command:
pnpm sbom
# Document that this generates CycloneDX 1.7 SBOM
```

## Next Steps

1. Create GitHub issues for each HIGH priority missing tool
2. Implement Phase 1 tools to unblock workflow
3. Update governance docs to reflect current tool availability
4. Consider adding deprecation notices for tools that won't be implemented
5. Create tool implementation ADRs for complex tools (arc scaffolding, attestation)

## Maintenance

- **Review Schedule**: Monthly
- **Owner**: Platform Team
- **Last Updated**: 2025-11-16
- **Next Review**: 2025-12-16
