# TypeCheck Fixes Applied - Progress Report

**Date:** 2025-01-21
**Status:** IN PROGRESS
**Phase:** Priority 1 & 2 Fixes + Project References

## ✅ Completed Fixes

### 1. Peer Dependency Resolution

#### better-sqlite3 Downgrade (FIXED)
- **Root package.json**: Installed `better-sqlite3@11.7.0` (workspace-wide)
- **packages/orchestration/package.json**: Updated from `^12.4.1` → `^11.7.0`
- **packages/memory-core/package.json**: Updated from `^12.2.0` → `^11.7.0`
- **Status**: ✅ Compatible with `@langchain/community@0.3.53` requirement (`>=9.4.0 <12.0.0`)

#### @swc/core Upgrade (FIXED)
- **Root package.json**: Updated from `~1.5.7` → `~1.13.21`
- **Status**: ✅ Satisfies `@swc-node/core@1.14.1` requirement (`>= 1.13.3`)

### 2. TypeScript Project References Added

#### packages/a2a/a2a-observability/tsconfig.json
```json
"references": [
  { "path": "../a2a-contracts" },
  { "path": "../../../libs/typescript/telemetry" }  // ADDED
]
```

#### packages/memory-core/tsconfig.json
```json
"references": [
  { "path": "../../libs/typescript/utils" },
  { "path": "../a2a/a2a-contracts" },
  { "path": "../tool-spec" }  // ADDED
]
```

#### packages/hooks/tsconfig.json
```json
"references": [
  { "path": "../kernel" },      // ADDED
  { "path": "../commands" }     // ADDED
]
```

#### packages/a2a/a2a-transport/tsconfig.json
```json
"references": [
  { "path": "../a2a-contracts" },  // ADDED
  { "path": "../a2a-core" }        // ADDED
]
```

#### packages/a2a/a2a-handlers/tsconfig.json
- Added `composite: true` to compilerOptions
- Added `declarationMap: true` to compilerOptions
- Added `noEmit: false` to compilerOptions
```json
"references": [
  { "path": "../a2a-contracts" },  // ADDED
  { "path": "../a2a-core" }        // ADDED
]
```

## 🔄 Next Steps (In Order)

### Step 1: Reinstall Dependencies
```bash
pnpm install
```
**Purpose**: Apply better-sqlite3 and @swc/core version changes

### Step 2: Build Foundation Packages
```bash
# Build contracts and utilities first
pnpm nx run @cortex-os/contracts:build
pnpm nx run @cortex-os/telemetry:build
pnpm nx run @cortex-os/utils:build
pnpm nx run @cortex-os/tool-spec:build
```

### Step 3: Build A2A Stack
```bash
pnpm nx run @cortex-os/a2a-contracts:build
pnpm nx run @cortex-os/a2a-core:build
pnpm nx run @cortex-os/a2a-transport:build
pnpm nx run @cortex-os/a2a-observability:build
pnpm nx run @cortex-os/a2a-handlers:build
```

### Step 4: Build Core Infrastructure
```bash
pnpm nx run @cortex-os/memory-core:build
pnpm nx run @cortex-os/hooks:build
pnpm nx run @cortex-os/kernel:build
pnpm nx run @cortex-os/commands:build
```

### Step 5: Build Missing Binary Packages
```bash
pnpm nx run @cortex-os/security:build
pnpm nx run @cortex-os/cbom:build
```

### Step 6: Run Incremental TypeCheck
```bash
# Test fixed packages
pnpm nx run @cortex-os/a2a-observability:typecheck
pnpm nx run @cortex-os/memory-core:typecheck
pnpm nx run @cortex-os/a2a-transport:typecheck
pnpm nx run @cortex-os/a2a-handlers:typecheck
pnpm nx run @cortex-os/hooks:typecheck
```

### Step 7: Full TypeCheck
```bash
pnpm nx run-many -t typecheck --all --verbose
```

## 📊 Expected Impact

### Packages Directly Fixed (5)
1. ✅ @cortex-os/a2a-observability - Missing telemetry reference
2. ✅ @cortex-os/memory-core - Missing tool-spec reference
3. ✅ @cortex-os/hooks - Missing kernel & commands references
4. ✅ @cortex-os/a2a-transport - Missing references + composite
5. ✅ @cortex-os/a2a-handlers - Missing references + composite

### Packages Indirectly Fixed (via peer deps)
6. ✅ @cortex-os/orchestration - better-sqlite3 compatibility
7. ✅ Root workspace - @swc/core compatibility

### Remaining Packages Needing Attention (23)
Still require project reference updates or other fixes:
- @cortex-os/a2a-core
- @cortex-os/mcp
- @cortex-os/mcp-server
- @cortex-os/mcp-registry
- @cortex-os/memories
- @cortex-os/agents
- @cortex-os/workflow-orchestrator
- @cortex-os/gateway
- @cortex-os/testing
- @cortex-os/patchkit
- @cortex-os/rag-http
- @cortex-os/logger
- @cortex-os/shared
- @cortex-os/stream-client
- @cortex-os/stream-protocol
- @cortex-os/history-store
- @cortex-os/executor-spool
- cortex-os (main app)
- cortex-os-docs
- a2a
- @cortex-os/rag-contracts (build failure)
- @cortex-os/proof-artifacts (build failure)
- asbr (build failure)

## 🛠️ Technical Debt Addressed

1. **Peer Dependency Management**: Established pattern for checking and resolving peer deps
2. **TypeScript Project References**: Starting systematic addition across monorepo
3. **Composite Projects**: Ensuring all packages enable composite mode for incremental builds
4. **Build Order**: Documenting dependency graph for proper build sequencing

## 📝 Notes

- Bash environment issues encountered - may need to execute commands manually in terminal
- All JSON edits validated and applied successfully
- Changes follow brAInwav standards (composite: true, named exports, etc.)
- Ready for dependency reinstallation and incremental validation

## 🎯 Success Criteria

- [ ] `pnpm install` completes with NO peer dependency warnings
- [ ] All 5 directly fixed packages pass typecheck
- [ ] better-sqlite3 works with @langchain/community
- [ ] @swc/core satisfies @swc-node/core requirements
- [ ] Binary links created successfully (brainwav-egress-proxy, cortex-cbom)
- [ ] Build order validated (foundation → core → apps)

---

**Next Action**: Execute `pnpm install` to apply package.json changes, then proceed with builds in dependency order.
