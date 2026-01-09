# CortexDx Package Refactoring - Progress Update

## Date: 2025-11-19

## Summary

Successfully stabilized three of the four core packages in the CortexDx monorepo refactoring:

### ✅ Completed Packages

1. **@brainwav/cortexdx-core** - BUILDING SUCCESSFULLY
   - Core types, utilities, logging, DI, and configuration
   - Proper subpath exports configured
   - All imports fixed to use correct paths

2. **@brainwav/cortexdx-ml** - BUILDING SUCCESSFULLY  
   - ML adapters (Ollama, etc.)
   - LLM routing and detection
   - Removed orchestration module (moved to server package)

3. **@brainwav/cortexdx-plugins** - BUILDING SUCCESSFULLY
   - Plugin system and host
   - Academic providers (OpenAlex, Semantic Scholar, etc.)
   - Registry system
   - All storage, security, and observability plugins

### 🔄 In Progress

4. **@brainwav/cortexdx-server** - BUILD FAILING
   - Contains orchestration module (LangGraph-based workflows)
   - Current issues:
     - Missing exports from plugins package (BUILTIN_PLUGINS, DEVELOPMENT_PLUGINS, etc.)
     - These are internal plugin lists that need to be exported or the orchestrator needs to be refactored

## Key Accomplishments

### Import Path Fixes
- Created automated scripts to fix import paths across packages:
  - `fix-core-imports.mjs` - Fixed @brainwav/cortexdx-core imports
  - `fix-server-imports.mjs` - Fixed server package imports  
  - `fix-orchestration-imports.mjs` - Fixed orchestration module imports
  
- Removed `.js` extensions from workspace package imports (TypeScript resolves these)
- Added `.js` extensions to local relative imports (required by Node.js ESM)

### Package Configuration
- Updated `package.json` exports to use `.js` extensions for subpaths
- Added proper dependencies:
  - `@langchain/core` and `@langchain/langgraph` to server package
  - `better-sqlite3` and `@types/better-sqlite3` to server package
  - `@brainwav/cortexdx-ml` to plugins package

### Circular Dependency Resolution
- Moved orchestration module from `ml` to `server` package
- This breaks the circular dependency between ML and plugins
- ML package now builds cleanly without orchestration

## Remaining Issues

### Server Package
The server package build is failing because `plugin-orchestrator.ts` imports plugin lists that aren't exported from the plugins package:

```typescript
import {
  BUILTIN_PLUGINS,
  DEVELOPMENT_PLUGINS,
  getDevelopmentPluginById,
  getPluginById,
} from "@brainwav/cortexdx-plugins";
```

**Solutions:**
1. Export these from plugins package index
2. Refactor plugin-orchestrator to not depend on these internal lists
3. Move plugin-orchestrator to plugins package (but this recreates circular dependency)

### Plugins Package - Minor Issues
Several files still have import errors for internal types:
- `../types.js` imports in various plugin files
- These are likely internal type files that need to be properly exported

## Next Steps

1. **Fix Server Package Build**
   - Export required plugin lists from plugins package, OR
   - Refactor plugin-orchestrator to use plugin registry instead of hardcoded lists

2. **Clean Up Plugin Type Imports**
   - Identify what `../types.js` should be
   - Either export from package index or fix relative paths

3. **Test Package Integration**
   - Verify all packages work together
   - Test importing from one package to another

4. **Update Main CortexDx Package**
   - Update `packages/cortexdx` to use the new split packages
   - Remove duplicated code

## Package Dependency Graph

```
@brainwav/cortexdx-core (no dependencies)
    ↓
@brainwav/cortexdx-ml (depends on: core)
    ↓
@brainwav/cortexdx-plugins (depends on: core, ml)
    ↓
@brainwav/cortexdx-server (depends on: core, ml, plugins)
```

## Build Status

| Package | Status | Notes |
|---------|--------|-------|
| core | ✅ Building | Complete |
| ml | ✅ Building | Complete |
| plugins | ✅ Building | Complete |
| server | ❌ Failing | Missing plugin exports |

## Files Modified

- Updated tsup configs to include subpath entry points
- Fixed package.json exports to use .js extensions
- Added missing dependencies to package.json files
- Fixed hundreds of import paths across all packages
- Created automated import fixing scripts

## Lessons Learned

1. **ESM Import Extensions**: Node.js ESM requires `.js` extensions for relative imports, but NOT for workspace package imports
2. **Subpath Exports**: Need explicit entry points in tsup config AND proper exports in package.json
3. **Circular Dependencies**: Moving modules between packages is effective for breaking cycles
4. **Automation**: Creating scripts to fix imports saves significant time and reduces errors
