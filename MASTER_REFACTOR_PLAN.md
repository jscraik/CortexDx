# Master Refactor Plan: CortexDx Package Split

**Date:** 2025-11-19
**Objective:** Complete the decomposition of the monolithic `@brainwav/cortexdx` package into focused workspace packages.

## 1. Current State Assessment

*   **`@brainwav/cortexdx-core`**: ✅ Built and ready.
*   **`@brainwav/cortexdx-ml`**: ⚠️ Partially set up. `orchestrator.ts` has circular dependencies with `plugins`. `ollama.ts` moved here. Build failing due to missing types/imports.
*   **`@brainwav/cortexdx-plugins`**: ❌ Contains majority of code. Many broken imports (`../types.js`). Depends on `core` and `ml`.
*   **`@brainwav/cortexdx-server`**: ⏸️ Skeleton created. Depends on all above.
*   **`@brainwav/cortexdx` (Root)**: ⚠️ Still contains legacy code and files that need to be moved or deleted.

## 2. Execution Strategy

We will follow a **bottom-up** build strategy. We must ensure each layer builds before moving to the next.

### Phase 1: Stabilize ML Package (`packages/ml`)
**Goal:** Get `pnpm build` to pass for `packages/ml`.

1.  **Resolve Circular Dependencies in `orchestrator.ts`**:
    *   The `LlmOrchestrator` depends on `ModelManager` and `ModelPerformanceMonitor` (currently in `plugins`).
    *   *Action:* Temporarily comment out/stub these dependencies in `orchestrator.ts` to break the cycle.
    *   *Long-term:* Move Model management logic into `ml` or a shared `monitoring` package.
2.  **Fix Imports**:
    *   Ensure all imports point to `@brainwav/cortexdx-core` or relative paths.
    *   Verify `ollama.ts` imports are correct.
3.  **Build**: Run `pnpm build` and verify `dist/` output.

### Phase 2: Stabilize Plugins Package (`packages/plugins`)
**Goal:** Get `pnpm build` to pass for `packages/plugins`.

1.  **Bulk Fix Imports**:
    *   Run `fix-all-plugins-imports.mjs` to update all `../types.js`, `../utils/`, etc. to `@brainwav/cortexdx-core`.
2.  **Fix ML Imports**:
    *   Update imports to use `@brainwav/cortexdx-ml` for `orchestrator`, `ollama`, etc.
3.  **Address Missing Modules**:
    *   Identify any modules still left in `packages/cortexdx` that `plugins` needs (e.g., `commands/`, `auth/`).
    *   Move them to `plugins` or `server` as appropriate.
4.  **Build**: Run `pnpm build`.

### Phase 3: Stabilize Server Package (`packages/server`)
**Goal:** Get `pnpm build` to pass for `packages/server`.

1.  **Move Remaining Server Code**:
    *   Ensure `src/index.ts` (FastMCP) has all necessary dependencies.
2.  **Fix Imports**:
    *   Update imports to point to `core`, `plugins`, and `ml`.
3.  **Build**: Run `pnpm build`.

### Phase 4: Root Package Cleanup (`packages/cortexdx`)
**Goal:** Restore CLI functionality.

1.  **Update CLI**:
    *   Update `src/cli.ts` to import from the new packages.
2.  **Cleanup**:
    *   Delete moved files from `packages/cortexdx/src`.
    *   Update `package.json` dependencies.

## 3. Detailed Step-by-Step

### Step 1: Fix `orchestrator.ts` (ML)
- [ ] Open `packages/ml/src/ml/orchestrator.ts`.
- [ ] Comment out `ModelManager` and `ModelPerformanceMonitor` imports and usage.
- [ ] Verify no other errors.
- [ ] Build `ml`.

### Step 2: Fix Plugins Imports
- [ ] Run `node fix-all-plugins-imports.mjs`.
- [ ] Manually check for remaining red squiggles in `packages/plugins/src`.
- [ ] Build `plugins`.

### Step 3: Integration
- [ ] Check if `server` builds.
- [ ] Run a test script to verify the packages work together.

## 4. Contingency
If circular dependencies persist (e.g. Plugins -> ML -> Plugins), we will:
1.  Define interfaces in `core` that both packages use.
2.  Inject dependencies at runtime (Dependency Injection) instead of importing concrete classes.
