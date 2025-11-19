# Phase 2 Progress: Import Path Fixes

## ✅ Core Package - COMPLETE

**Status:** Successfully built!  
**Build Time:** 711ms  
**Output:** `dist/index.js` (27.86 KB), `dist/index.d.ts` (39.40 KB)

### Changes Made:
1. Fixed `ajv` import to use named export: `import { Ajv, ... } from 'ajv'`
2. Fixed `ajv-formats` import with proper type casting for ESM compatibility
3. Removed accidental code fence artifact
4. Added missing dependencies (`ajv`, `ajv-formats`) to `package.json`

### Files Modified:
- `/packages/core/src/utils/validation.ts` - Fixed ajv imports
- `/packages/core/package.json` - Added dependencies

### Internal Imports:
All imports within the core package use relative paths (e.g., `../types.js`) which is correct since they're in the same package.

## 📋 Next: Plugins Package

The plugins package has **240+ lint errors** all related to missing imports from the core package.

### Required Changes:
All files in `packages/plugins/src/plugins/` need to change:
- `from "../types.js"` → `from "@brainwav/cortexdx-core"`
- `from "../utils/json.js"` → `from "@brainwav/cortexdx-core/utils"`
- `from "../../types.js"` → `from "@brainwav/cortexdx-core"`

### Affected Files (Sample):
- `auth.ts`
- `cors.ts`
- `devtool-env.ts`
- `discovery.ts`
- `governance.ts`
- `jsonrpc-batch.ts`
- `mcp-docs.ts`
- `performance/types.ts`
- `performance/utils.ts`
- `performance/measurements/http.ts`
- ... and 50+ more

### Strategy:
Use a systematic find-and-replace approach:
1. Replace all `from "../types.js"` with `from "@brainwav/cortexdx-core"`
2. Replace all `from "../../types.js"` with `from "@brainwav/cortexdx-core"`  
3. Replace all `from "../../../types.js"` with `from "@brainwav/cortexdx-core"`
4. Replace all `from "../utils/` with `from "@brainwav/cortexdx-core/utils/`
5. Install dependencies and build

## Estimated Time Remaining:
- Plugins package: ~30-40 files to fix, 15-20 minutes
- ML package: ~20 files to fix, 10 minutes
- Server package: ~10 files to fix, 5 minutes
- Root package updates: 5 minutes

**Total:** ~40 minutes of systematic refactoring
