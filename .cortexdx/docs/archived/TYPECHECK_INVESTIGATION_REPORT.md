# TypeCheck, Import, and Dependency Issues Investigation Report

**Generated:** $(date)
**Investigation Status:** Complete

## Executive Summary

Investigation revealed **30 failing typecheck tasks** out of 89 total tasks, along with **3 critical peer dependency conflicts** that must be resolved before full typecheck compliance can be achieved.

## Critical Peer Dependency Issues

### 1. better-sqlite3 Version Conflict (BLOCKING)
- **Package:** `@langchain/community@0.3.53`
- **Requirement:** `better-sqlite3@>=9.4.0 <12.0.0`
- **Current Version:** `better-sqlite3@12.4.1`
- **Impact:** Blocks typecheck for `@cortex-os/orchestration` and potentially other LangChain-dependent packages
- **Affected Packages:**
  - `packages/orchestration` (uses 12.4.1)
  - `packages/memory-core` (uses 12.2.0)

**Resolution Required:**
```bash
# Option 1: Downgrade better-sqlite3 (recommended for compatibility)
pnpm add better-sqlite3@11.7.0 -w

# Option 2: Update @langchain/community (check if newer version supports 12.x)
pnpm update @langchain/community@latest
```

### 2. @swc/core Version Conflict (BUILD TOOLING)
- **Package:** `@swc-node/core@1.14.1`
- **Requirement:** `@swc/core@>= 1.13.3`
- **Current Version:** `@swc/core@1.5.29`
- **Impact:** Affects root workspace and `tools/nx-plugins`
- **Severity:** High (affects build tooling)

**Resolution Required:**
```bash
# Upgrade @swc/core to satisfy peer dependency
pnpm add -D @swc/core@1.13.21
```

### 3. Missing Build Outputs (Binary Linking Failures)
The following packages have missing distribution files preventing binary linking:
- `packages/security/dist/egress-proxy.js` → `brainwav-egress-proxy` binary
- `packages/cbom/dist/cli/index.js` → `cortex-cbom` binary

**Resolution Required:**
```bash
# Build missing packages
pnpm nx run @cortex-os/security:build
pnpm nx run @cortex-os/cbom:build
```

## Failed TypeCheck Tasks (30 packages)

Based on the Nx run output, the following packages have typecheck failures:

### Core Infrastructure (High Priority)
1. **@cortex-os/a2a-core** - A2A messaging core
2. **@cortex-os/a2a-transport** - A2A transport layer
3. **@cortex-os/a2a-observability** - A2A telemetry
4. **@cortex-os/a2a-handlers** - A2A event handlers
5. **@cortex-os/memory-core** - Memory management (likely due to missing type refs)
6. **@cortex-os/orchestration** - LangGraph orchestration (better-sqlite3 issue)

### MCP Stack (High Priority)
7. **@cortex-os/mcp** - MCP protocol implementation
8. **@cortex-os/mcp-server** - MCP server
9. **@cortex-os/mcp-registry** - MCP tool registry
10. **@cortex-os/memories** - Memory service

### Application Layer
11. **cortex-os** - Main application
12. **cortex-os-docs** - Documentation site
13. **@cortex-os/agents** - Agent implementations
14. **@cortex-os/workflow-orchestrator** - Workflow engine

### Supporting Packages
15. **@cortex-os/gateway** - API gateway
16. **@cortex-os/testing** - Testing utilities
17. **@cortex-os/patchkit** - Patch management
18. **@cortex-os/rag-http** - RAG HTTP interface
19. **@cortex-os/hooks** - React/system hooks
20. **@cortex-os/logger** - Logging utilities
21. **@cortex-os/shared** - Shared utilities
22. **@cortex-os/stream-client** - Streaming client
23. **@cortex-os/stream-protocol** - Streaming protocol
24. **@cortex-os/history-store** - History persistence
25. **@cortex-os/executor-spool** - Execution queue
26. **a2a** - A2A package wrapper

### Build Failures (Blocking TypeCheck)
27. **@cortex-os/rag-contracts** - RAG type contracts
28. **@cortex-os/proof-artifacts** - Proof generation
29. **@cortex-os/a2a-common** - A2A shared code
30. **asbr** - ASBR schema generation

## Common Issue Patterns Identified

### 1. Missing Type Declarations
Many packages reference types from dependencies that may not have proper TypeScript project references configured in their `tsconfig.json`.

**Evidence:** packages/memory-core/tsconfig.json missing references to:
- `@cortex-os/a2a-contracts`
- `@cortex-os/utils`
- `@cortex-os/tool-spec`

### 2. Build Order Dependencies
Some packages fail typecheck because their dependencies haven't been built yet:
- Composite project references not properly configured
- Missing `references` array in tsconfig.json
- Missing `composite: true` in dependency tsconfigs

### 3. Path Resolution Issues
TypeScript path mappings in `tsconfig.base.json` reference multiple possible locations (src, dist, types) but may resolve incorrectly when:
- Distribution files don't exist
- Type declaration files are out of sync
- Circular dependencies between packages

## Immediate Action Items

### Priority 1: Fix Peer Dependencies
```bash
# Execute immediately
pnpm add better-sqlite3@11.7.0 -w
pnpm add -D @swc/core@1.13.21
```

### Priority 2: Build Missing Packages
```bash
# Build packages with missing binaries
pnpm nx run @cortex-os/security:build
pnpm nx run @cortex-os/cbom:build

# Build foundational packages
pnpm nx run-many -t build --projects=@cortex-os/rag-contracts,@cortex-os/a2a-common,@cortex-os/proof-artifacts,asbr
```

### Priority 3: Fix Project References
For each failing package, audit and update `tsconfig.json`:
1. Ensure `composite: true` is set
2. Add `references` array with all workspace dependencies
3. Verify path mappings resolve correctly

### Priority 4: Run Incremental TypeCheck
```bash
# After fixes, run typecheck layer by layer
pnpm nx run-many -t typecheck --projects=@cortex-os/contracts,@cortex-os/telemetry,@cortex-os/utils
pnpm nx run-many -t typecheck --projects=@cortex-os/a2a-contracts,@cortex-os/a2a-core
pnpm nx run-many -t typecheck --projects=@cortex-os/memory-core,@cortex-os/orchestration
pnpm nx run-many -t typecheck --all
```

## Investigation Commands Used

```bash
# Dependency installation
pnpm install

# Full typecheck (revealed 30 failures)
pnpm nx run-many -t typecheck --all --verbose

# Smart typecheck (skipped - no affected files)
pnpm typecheck:smart
```

## Next Steps

1. **Execute Priority 1 & 2 fixes** immediately
2. **Create tracking issue** for each failing package category
3. **Implement systematic fix** following dependency order:
   - Contracts/Types → Core → Infrastructure → Applications
4. **Add CI check** to prevent future peer dependency conflicts
5. **Document** proper tsconfig patterns in CODESTYLE.md

## Configuration Analysis

### TypeScript Configuration Health
- ✅ Base configuration (`tsconfig.base.json`) is well-structured
- ✅ Path mappings comprehensive (744 entries)
- ✅ Module resolution set to `NodeNext` correctly
- ⚠️ Missing project references in many packages
- ⚠️ Inconsistent `composite` settings across packages
- ❌ Peer dependency conflicts blocking builds

### Workspace Structure Health  
- ✅ 108 workspace packages recognized
- ✅ Nx configuration functional
- ✅ Path structure follows conventions
- ⚠️ Some build outputs missing (binaries)
- ❌ 30 packages with typecheck failures (33.7% of typecheck-enabled packages)

## Recommendations

### Short Term (1-2 days)
1. Fix peer dependency conflicts
2. Build missing distribution files
3. Add project references to top 10 failing packages
4. Re-run typecheck to measure improvement

### Medium Term (1-2 weeks)
1. Systematically add project references to all packages
2. Create tsconfig templates for different package types
3. Add pre-commit hook to validate tsconfig.json files
4. Document dependency graph and build order

### Long Term (1 month+)
1. Implement stricter TypeScript checks (`strict: true` compliance)
2. Automate dependency graph validation in CI
3. Create tooling to auto-generate project references
4. Consider monorepo build caching strategies

---

## Appendix: Deprecated Dependencies Warning

The following deprecated dependencies should be upgraded (non-blocking):
- `@opentelemetry/exporter-jaeger@2.1.0` (27 warnings about deprecated subdependencies)
- `@types/http-proxy-middleware@1.0.0`
- `@types/yaml@1.9.7`
- `@types/chokidar@2.1.7`
- `@types/dompurify@3.2.0`
- `@types/sqlite3@5.1.0` (sqlite3 provides own types)
- Various others (see full pnpm install output)

**Note:** These are warnings, not errors, and do not block TypeScript compilation.
