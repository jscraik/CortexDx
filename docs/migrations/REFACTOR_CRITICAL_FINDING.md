# Package Refactor - Critical Finding

## Issue Discovered

The package split approach has revealed a **circular dependency problem**:

### Problem:
- `plugin-host.ts` (moved to plugins package) imports from:
  - `./context/` (still in cortexdx)
  - `./ml/` (moved to ml package, but ml depends on plugins)
  - `./learning/` (still in cortexdx)
  - `./utils/` (moved to core)
  - `./providers/` (still in cortexdx)

### Root Cause:
The monolithic package has **tightly coupled** dependencies that cannot be easily separated without significant refactoring.

## Recommendation: Revised Approach

Given the complexity and tight coupling, I recommend **pausing the package split** and instead focusing on:

### Option 1: Keep Monolithic, Improve Structure (RECOMMENDED)
1. **Keep** `@brainwav/cortexdx` as a single package
2. **Extract only** `@brainwav/cortexdx-core` (types, utils) - **DONE ✅**
3. Update all imports in cortexdx to use `@brainwav/cortexdx-core`
4. Improve internal organization within cortexdx using better folder structure

**Benefits:**
- Avoids circular dependencies
- Faster to implement
- Less risk of breaking changes
- Core package can still be reused by other projects

### Option 2: Complete Refactoring (HIGH EFFORT)
1. Analyze all dependencies using a dependency graph tool
2. Identify and break circular dependencies
3. Create clear boundaries with interfaces
4. Gradually extract packages in dependency order

**Estimated Time:** 10-20 hours of careful refactoring

## Current Status

### ✅ Completed:
- Core package extracted and building successfully
- 49 files in plugins package have updated imports
- Technical review completed
- Server migration completed (legacy removed)

### ❌ Blocked:
- Plugins package build (missing dependencies)
- ML package (not started)
- Server package (not started)

## Proposed Next Steps

1. **Revert** the plugins/ml/server package splits
2. **Keep** the core package (it's working and useful)
3. **Update** all imports in the main cortexdx package to use `@brainwav/cortexdx-core`
4. **Document** the internal module structure better
5. **Consider** package split as a future Phase 3 after dependency analysis

## Decision Point

**Question for User:** Should we:
- A) Continue with full package split (high effort, high risk)
- B) Keep monolithic with extracted core (pragmatic, lower risk)
- C) Pause and analyze dependencies first (methodical approach)

My recommendation is **Option B** - it gives us the benefits of a shared core package while avoiding the complexity of untangling the tightly coupled modules.
