# Technical Review Report: CortexDx

**Date:** 2025-11-19
**Scope:** `packages/cortexdx` and root configuration.

## 1. Executive Summary

The `CortexDx` project is a monorepo containing a primary package `@brainwav/cortexdx`. While the project has a strong foundation with clear coding standards (`CODESTYLE.md`) and modern tooling (Nx, Biome, Vitest), there are significant issues with **bloat**, **architectural complexity**, and **code style violations** that need to be addressed to ensure scalability and maintainability.

## 2. Bloat & Cleanup

### 2.1. Log Files
The root of `packages/cortexdx` is cluttered with numerous log files (e.g., `background-indexing-*.log`).
- **Issue**: These files are not gitignored and pollute the workspace.
- **Recommendation**: 
    - Move logs to a `logs/` directory.
    - Add `*.log` or `logs/` to `.gitignore`.
    - Delete existing log files.

### 2.2. Recursive Package Structure
There is a nested directory `packages/cortexdx/packages/cortexdx` which appears to be a recursive copy or a mistake.
- **Issue**: Confusing structure, potential for duplication.
- **Recommendation**: Investigate and remove `packages/cortexdx/packages`.

### 2.3. Lockfile Conflict
The root uses `pnpm-lock.yaml`, but `packages/cortexdx` contains a `package-lock.json`.
- **Issue**: Conflicting package managers. `pnpm` should be the single source of truth.
- **Recommendation**: Delete `packages/cortexdx/package-lock.json`.

### 2.4. Root Directory Clutter
The root directory contains over 20 markdown files, many of which seem to be documentation that should be organized.
- **Issue**: Hard to navigate the root.
- **Recommendation**: Move non-essential markdown files to `docs/`.

## 3. Complexity & Architecture

### 3.1. Monolithic Package
`packages/cortexdx` is a massive package with 44 subdirectories in `src`.
- **Issue**: It mixes concerns: CLI, Server, Web, ML, Security, Providers, etc.
- **Recommendation**: Refactor into smaller, focused packages:
    - `@brainwav/cortexdx-core` (Shared types, utils)
    - `@brainwav/cortexdx-server` (Server implementation)
    - `@brainwav/cortexdx-cli` (CLI)
    - `@brainwav/cortexdx-web` (Frontend)
    - `@brainwav/cortexdx-plugins` (Plugin system)

### 3.2. Dual Server Implementations
There are two server implementations:
- `src/server.ts` (Legacy/Manual HTTP + JSON-RPC)
- `src/server-fastmcp.ts` (Newer `fastmcp` based)
- **Issue**: Maintenance burden of keeping two servers. `server.ts` is 64KB+ and complex.
- **Recommendation**: Deprecate `server.ts` and fully migrate to `server-fastmcp.ts`. Remove legacy code once migration is complete.

## 4. Code Style & Quality Infractions

### 4.1. Placeholder Code (Violation of CODESTYLE.md)
`CODESTYLE.md` strictly prohibits "Placeholder stubs" in production.
- **Found**:
    - `server.ts`: `// This would integrate with the LLM for code generation`
    - `server.ts`: `// This would implement license validation logic`
    - `server.ts`: `// License database (in production, this would be backed by a database)`
- **Recommendation**: Implement the logic or remove the stubs. Use proper feature flags if needed.

### 4.2. TypeScript Violations
- **Found**: `// @ts-ignore` usage in `server-fastmcp.ts`.
- **Recommendation**: Fix the types instead of ignoring them.

### 4.3. Large Files
- **Found**: `server.ts` (2200+ lines) and `server-fastmcp.ts` (1000+ lines).
- **Recommendation**: Break these files down into smaller modules (e.g., route handlers, middleware, tool registration).

## 5. Pain Points

- **Manual JSON-RPC Implementation**: `server.ts` manually implements JSON-RPC over `fetch`. This is error-prone and reinvents the wheel.
- **Hardcoded Configuration**: `server/config.js` likely contains hardcoded values or environment variable fallbacks that should be managed more robustly.
- **Navigation**: The size of `src` makes it difficult to find specific functionality.

## 6. Refinement Plan

1.  **Immediate Cleanup**:
    - Delete `packages/cortexdx/package-lock.json`.
    - Delete `packages/cortexdx/background-indexing-*.log`.
    - Update `.gitignore`.
    - Remove `packages/cortexdx/packages`.

2.  **Code Quality**:
    - Address `// @ts-ignore` in `server-fastmcp.ts`.
    - Remove or implement placeholder stubs.

3.  **Architecture**:
    - Plan the split of `@brainwav/cortexdx` into smaller packages.
    - Finalize the migration to `fastmcp` and remove `server.ts`.
