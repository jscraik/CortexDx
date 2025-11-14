# Circular Dependency Fix Complete

## Problem
Circular dependency chain:
- `mcp-server` → `agent-toolkit` → `security` → `mcp-server` (via `egress-guard.ts`)

## Solution
Moved `egress-guard.ts` from `@cortex-os/mcp-server/security/` to `@cortex-os/security/egress/`

## Changes Made

### 1. Moved egress-guard.ts
- **From:** `packages/mcp-server/src/security/egress-guard.ts`
- **To:** `packages/security/src/egress/egress-guard.ts`

### 2. Updated @cortex-os/security
- Added egress exports to `src/index.ts`
- Added egress export path to `package.json` exports
- Updated `tsup.config.ts` to build egress-guard.ts
- Created `tsconfig.dts.json` for type declarations
- Created post-build patch script `scripts/patch-index-dts.mjs` to fix tsup re-export issue
- Updated build script to run patch after tsup

### 3. Updated @cortex-os/mcp-server  
- Updated `src/security/brainwav-security-manager.ts` to import from `@cortex-os/security`
- Updated `src/server/pieces-proxy-factory.ts` to import from `@cortex-os/security`
- Updated test mock in `src/security/__tests__/brainwav-security-manager.test.ts`
- Removed obsolete type declaration from `src/types/external-modules.d.ts`
- Deleted old `src/security/egress-guard.ts`

### 4. Updated @cortex-os/security/mcp-enhanced
- Updated `src/mcp-enhanced/enhanced-security.ts` to use local import `../egress/egress-guard.js`

## Verification
✅ @cortex-os/security builds successfully with type declarations
✅ @cortex-os/mcp-server builds successfully
✅ Egress functions exported from @cortex-os/security main entry point
✅ No circular dependency warnings

## New Dependency Flow
```
mcp-server → agent-toolkit → security (no cycle!)
                             ↓
                        egress-guard
```

## Files Modified
1. packages/security/src/egress/egress-guard.ts (moved)
2. packages/security/src/index.ts
3. packages/security/package.json
4. packages/security/tsconfig.json
5. packages/security/tsup.config.ts
6. packages/security/scripts/patch-index-dts.mjs (new)
7. packages/mcp-server/src/security/brainwav-security-manager.ts
8. packages/mcp-server/src/server/pieces-proxy-factory.ts
9. packages/mcp-server/src/security/__tests__/brainwav-security-manager.test.ts
10. packages/mcp-server/src/types/external-modules.d.ts
11. packages/security/src/mcp-enhanced/enhanced-security.ts

## Files Deleted
1. packages/mcp-server/src/security/egress-guard.ts

## brAInwav Compliance
✅ All changes maintain brAInwav branding in system outputs
✅ Named exports only (no default exports)
✅ Function length ≤ 40 lines maintained
✅ Async/await pattern preserved

---
**Completed:** 2025-01-26
**Author:** GitHub Copilot CLI
**Co-authored-by:** brAInwav Development Team
