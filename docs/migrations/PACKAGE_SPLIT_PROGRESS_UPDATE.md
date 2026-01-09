# Package Split Progress Update

## Current Status: Making Progress on ML Package

### ✅ Completed Today:
1. **Moved Additional Modules to Plugins:**
   - `auth/` - Moved from server to plugins
   - `research/` - Academic research functionality
   - `deepcontext/` - Semantic code search
   - `envelope/` - Message envelope handling
   - `telemetry/` - Telemetry and observability
   - `storage/` - Storage implementations
   - `resources/` - Resource management

2. **Added Dependencies to Plugins:**
   - `eventsource-parser`
   - `@opentelemetry/api`
   - `better-sqlite3`
   - `ws`
   - `@aws-sdk/client-s3`
   - `@aws-sdk/s3-request-presigner`
   - `axios`

3. **Fixed Import Paths:**
   - Ran import fixer on 70+ files
   - Updated imports to use workspace packages

4. **ML Package Setup:**
   - Moved `ollama.ts` adapter to ML package
   - Fixed imports in `router.ts` and `orchestrator.ts`
   - Updated package exports

### 🔧 Current Issues:

1. **Circular Dependencies:**
   - ML package's `orchestrator.ts` was importing `ModelManager` and `ModelPerformanceMonitor` from plugins
   - These create a circular dependency (ML -> Plugins -> ML)
   - **Solution:** Removed these imports temporarily to get ML building

2. **TypeScript Module Resolution:**
   - Core package subpath exports need `.js` extension removed for TypeScript
   - Current: `"./utils/*": "./dist/utils/*"`
   - This works for ESM but TypeScript can't find `.d.ts` files

3. **Remaining Lint Errors:**
   - 200+ errors in plugins package (mostly `../types.js` imports)
   - Need to run comprehensive import fixer

### 📋 Next Steps:

1. **Get ML Package Building:**
   - Comment out or stub ModelManager/ModelPerformanceMonitor usage
   - Try building ML package
   - Once it builds, we can use it in plugins

2. **Fix Plugins Package:**
   - Run comprehensive import fixer for all remaining `../types.js` references
   - Add missing dependencies
   - Build plugins package

3. **Address Circular Dependencies:**
   - Move ModelManager and ModelPerformanceMonitor to ML package
   - Or create a separate monitoring package
   - Update imports accordingly

### 💡 Key Learning:

The circular dependency between ML and Plugins is a design issue. The orchestrator in ML shouldn't depend on plugin-specific code. We have two options:

**Option A:** Move model management to ML package (makes sense - it's ML-related)
**Option B:** Create a separate `@brainwav/cortexdx-monitoring` package

For now, I've removed the dependencies to unblock ML package building.

### Time Estimate:
- ML package build: 30 minutes
- Plugins package fixes: 1-2 hours  
- Circular dependency resolution: 1 hour
- **Total remaining:** 2.5-3.5 hours
