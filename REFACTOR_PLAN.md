# Architecture Refactor Plan: CortexDx

**Objective:** Decompose the monolithic `@brainwav/cortexdx` package into smaller, focused packages to improve maintainability, reduce build times, and enforce clearer boundaries.

## 1. Proposed Package Structure

We will create the following packages in `packages/`:

### 1.1. `@brainwav/cortexdx-core`
**Purpose:** Shared types, utilities, and interfaces.
**Contents:**
- `src/types.ts`
- `src/utils/`
- `src/logging/`
- `src/config/` (Base config)
- `src/di/`

### 1.2. `@brainwav/cortexdx-plugins`
**Purpose:** Plugin system and core plugins.
**Contents:**
- `src/plugin-host.ts`
- `src/plugins/`
- `src/registry/`

### 1.3. `@brainwav/cortexdx-server`
**Purpose:** Server implementation (FastMCP).
**Contents:**
- `src/server-fastmcp.ts` (Renamed to `index.ts`)
- `src/server/`
- `src/middleware/`
- `src/auth/`
- `src/mcp-server/`

### 1.4. `@brainwav/cortexdx-cli`
**Purpose:** Command-line interface.
**Contents:**
- `src/cli.ts`
- `src/commands/`

### 1.5. `@brainwav/cortexdx-web`
**Purpose:** Frontend assets and serving logic.
**Contents:**
- `src/web/`

### 1.6. `@brainwav/cortexdx-ml`
**Purpose:** Machine Learning and LLM orchestration.
**Contents:**
- `src/ml/`
- `src/orchestration/`
- `src/orchestrator.ts`

## 2. Migration Steps

1.  **Initialize Packages**: Create directories and `package.json` for each new package.
2.  **Move Core**: Move `types.ts`, `utils`, `logging` to `core`. Update imports in the main package to point to the new location (or use aliases temporarily).
3.  **Move Plugins**: Move plugin system to `plugins`.
4.  **Move ML**: Move ML components to `ml`.
5.  **Move Server**: Move server code to `server`.
6.  **Move CLI**: Move CLI code to `cli`.
7.  **Update Root**: The original `packages/cortexdx` can remain as a "metapackage" or "shell" that imports and composes these, or be replaced by `cli` as the entry point.

## 3. Server Deprecation

- **Action**: Delete `src/server.ts` (Legacy).
- **Verification**: Ensure `server-fastmcp.ts` covers all use cases. (No TODOs found in `server-fastmcp.ts`).

## 4. Immediate Action Items

1.  **Delete Legacy Server**: `src/server.ts` is confirmed to be legacy and `server-fastmcp.ts` is the target. We should delete `src/server.ts` to reduce confusion during the refactor.
2.  **Create Core Package**: Start by extracting `core` as it has the fewest dependencies.

