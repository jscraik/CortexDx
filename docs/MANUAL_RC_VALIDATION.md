# Manual RC Validation Checklist (Build-Independent)

**Purpose**: Validate MCP SDK v1.22.0 compatibility without requiring a working build environment.

**Date**: November 16, 2025
**SDK Version**: v1.22.0 (published Nov 13, 2025)

---

## Why Manual Validation?

While the automated validation script (`scripts/rc-validation-quickstart.sh`) is the preferred approach, build environment issues may require manual code review and validation first.

This checklist allows you to:
1. Verify SDK compatibility by code inspection
2. Identify breaking changes without running tests
3. Document findings for the team
4. Proceed with confidence once build is fixed

---

## Manual Validation Checklist

### Phase 1: SDK Version Verification (10 minutes)

- [x] ✅ **Confirm SDK installed**: v1.22.0
  ```bash
  find node_modules -name "@modelcontextprotocol" -type d | head -1
  # Check package.json in that directory
  ```

- [x] ✅ **Verify publication date**: November 13, 2025
  ```bash
  npm view @modelcontextprotocol/sdk time.1.22.0
  ```

- [x] ✅ **Check if RC**: Published 1 day before RC target (Nov 14)
  - **Conclusion**: v1.22.0 is very likely the RC version

### Phase 2: Code Inspection (30-60 minutes)

#### 2.1 MCP SDK Import Analysis

Check how CortexDx imports and uses the MCP SDK:

```bash
# Find all MCP SDK imports
grep -r "@modelcontextprotocol/sdk" packages/cortexdx/src --include="*.ts"
```

**Files to Review**:
- [ ] `packages/cortexdx/src/server.ts` - MCP server setup
- [ ] `packages/cortexdx/src/instrumented-mcp-server.ts` - Server instrumentation
- [ ] `packages/cortexdx/src/providers/diagnostic-mcp-client.ts` - MCP client
- [ ] `packages/cortexdx/src/tools/*.ts` - MCP tool implementations
- [ ] `packages/cortexdx/src/resources/*.ts` - MCP resource handlers

**What to Look For**:
- Deprecated import paths (check SDK changelog)
- Type changes (interfaces, method signatures)
- New required parameters
- Removed methods or properties

#### 2.2 Async Operations Review

Review LangGraph checkpoint/resume implementation:

- [ ] **Check**: `packages/cortexdx/src/orchestration/agent-orchestrator.ts`
  - Thread management
  - Checkpoint storage (SQLite)
  - Resume logic

- [ ] **Check**: `packages/cortexdx/src/commands/orchestrate.ts`
  - `--resume-thread` flag handling
  - `--state-db` configuration
  - Error handling for interrupted operations

**Questions**:
- Does checkpoint format need updating for new spec?
- Are thread IDs compatible with new async operation model?
- Does resume logic align with spec requirements?

#### 2.3 OAuth/Identity Flow Review

Review Auth0 integration:

- [ ] **Check**: `packages/cortexdx/src/auth/oauth-auth.ts`
  - Client credentials flow
  - Token acquisition
  - Scope management

- [ ] **Check Current Scopes** (from `docs/AUTH0_SETUP.md`):
  - `search.read`
  - `docs.write`
  - `memory.read`
  - `memory.write`
  - `memory.delete`
  - `code.write`

**Questions**:
- Are these scopes aligned with new MCP resource model?
- Do we need more granular scopes?
- Are there any unused scopes to remove?

#### 2.4 Streaming Implementation Review

Review SSE and WebSocket support:

- [ ] **Check**: Streaming probe implementations
  - SSE endpoint testing
  - WebSocket connection lifecycle
  - Timeout handling

- [ ] **Files to Review**:
  - `packages/cortexdx/src/probe/` - Protocol probes
  - Streaming-related plugins

**Questions**:
- Does SSE handling align with new spec?
- Are WebSocket patterns compatible?
- Do we handle long-running streams correctly?

### Phase 3: Breaking Change Detection (20-30 minutes)

#### 3.1 Check SDK Changelog

Visit: https://github.com/modelcontextprotocol/typescript-sdk/releases

- [ ] Read v1.22.0 release notes
- [ ] Identify breaking changes
- [ ] Note deprecated features
- [ ] List new required features

**Document findings in**: `reports/rc-validation/sdk-changes.md`

#### 3.2 Search for Deprecated APIs

Common deprecation patterns:

```bash
# Search for potential deprecated usage
cd packages/cortexdx/src

# Check for old-style imports
grep -r "require('@modelcontextprotocol" .

# Check for deprecated methods (examples)
grep -r "\.initialize(" .
grep -r "\.connect(" .

# Look for TypeScript errors (if tsc available)
npx tsc --noEmit 2>&1 | grep -i "error"
```

- [ ] Document any deprecated API usage found
- [ ] Note line numbers and files
- [ ] Plan migration approach

### Phase 4: Architecture Alignment Review (20-30 minutes)

#### 4.1 Async Operations Alignment

Review against new spec requirements:

- [ ] **Status Polling**: Does CortexDx support querying operation status?
  - Current: ❌ No dedicated endpoint
  - Planned: Status polling for long-running diagnostics

- [ ] **Callbacks/Webhooks**: Can operations notify on completion?
  - Current: ❌ No webhook support
  - Planned: Callback URLs for async completion

- [ ] **Progress Tracking**: Can clients track operation progress?
  - Current: ⚠️ Partial (checkpoints store state)
  - Planned: Enhanced metadata with progress %

- [ ] **Timeout Management**: Are long-running ops properly bounded?
  - Current: ⚠️ Basic support
  - Planned: Configurable TTL

**Conclusion**: Architecture foundation exists, needs enhancements

#### 4.2 OAuth/Identity Alignment

Review against new spec guidance:

- [ ] **Device Code Flow**: Interactive auth for CLI users?
  - Current: ❌ Not implemented
  - Planned: Phase 5 roadmap item

- [ ] **Consent Screens**: User-facing auth flows?
  - Current: ❌ Not implemented
  - Status: May not be required for diagnostic tool

- [ ] **Client Signing**: Certificate-based client auth?
  - Current: ❌ Not implemented
  - Status: Awaiting spec guidance

- [ ] **Scope Granularity**: Resource-specific scopes?
  - Current: ⚠️ Coarse-grained scopes
  - Action: Review against spec when published

**Conclusion**: Basic OAuth works, device code flow needed

#### 4.3 Streaming Alignment

Review streaming implementation:

- [ ] **SSE Support**: Server-Sent Events tested?
  - Current: ✅ Yes - probe engine tests SSE
  - Status: Likely compatible

- [ ] **WebSocket Support**: Bidirectional messaging?
  - Current: ✅ Yes - connection lifecycle managed
  - Status: Likely compatible

- [ ] **Backpressure**: Handle slow consumers?
  - Current: ⚠️ Basic support
  - Action: Review under load

**Conclusion**: Streaming foundation solid

### Phase 5: Documentation Review (15-20 minutes)

#### 5.1 Spec Version References

Find all hardcoded spec version references:

```bash
grep -r "v2024-11-05" docs/ packages/ --include="*.md" --include="*.ts"
```

- [ ] List all files with spec version references
- [ ] Prepare to update to new version (when published Nov 25)

#### 5.2 API Documentation

Check if API docs need updates:

- [ ] `packages/cortexdx/docs/API_REFERENCE.md`
- [ ] `packages/cortexdx/docs/USER_GUIDE.md`
- [ ] `README.md` - Examples and usage

**Questions**:
- Do examples use deprecated APIs?
- Are new async patterns documented?
- Does OAuth setup guide reflect latest?

### Phase 6: Risk Assessment (10-15 minutes)

#### Overall Risk Matrix

| Component | Current Status | Risk Level | Notes |
|-----------|---------------|------------|-------|
| **MCP SDK v1.22.0** | ✅ Installed | 🟢 Low | Published Nov 13, likely RC |
| **Async Operations** | ✅ Foundation exists | 🟡 Medium | Needs enhancements (status, webhooks) |
| **OAuth Flows** | ✅ Basic working | 🟡 Medium | Device code flow missing |
| **Streaming** | ✅ Implemented | 🟢 Low | SSE/WebSocket tested |
| **Build Environment** | ❌ Broken | 🔴 High | **BLOCKER for automated tests** |

#### Critical Gaps

1. **Build Environment** (CRITICAL)
   - Impact: Cannot run automated validation
   - Mitigation: Manual review + fix build ASAP

2. **Device Code Flow** (HIGH)
   - Impact: CLI users can't authenticate interactively
   - Mitigation: Already planned (Phase 5)

3. **Async Status Polling** (MEDIUM)
   - Impact: Can't query long-running operation status
   - Mitigation: Foundation exists (checkpoints)

4. **Spec Version References** (LOW)
   - Impact: Docs reference old spec
   - Mitigation: Easy global replace when new spec publishes

---

## Manual Validation Summary

### What We Can Validate Without Build

✅ **Yes - Manual Review**:
- SDK version and publication date
- Code imports and usage patterns
- Architecture alignment with spec
- OAuth scope configuration
- Streaming implementation
- Documentation accuracy

❌ **No - Requires Build**:
- Automated test suite
- Integration tests
- Self-diagnostics
- Performance benchmarks
- Security scans
- End-to-end workflows

### Findings Template

Copy this to `reports/rc-validation/manual-findings.md`:

```markdown
# Manual RC Validation Findings

**Date**: [Date]
**Reviewer**: [Name]
**SDK Version**: v1.22.0

## Breaking Changes Detected

- [ ] None found (pending automated tests)
- [ ] OR: List specific breaking changes

## Deprecated APIs Used

- [ ] None found
- [ ] OR: List deprecated usage with file:line

## Architecture Gaps

1. **Async Operations**: Missing status polling endpoint
2. **OAuth**: Device code flow not implemented
3. **Other**: [List any others]

## Recommendations

1. **Immediate**: Fix build environment
2. **Short-term**: Run automated validation
3. **Medium-term**: Implement missing features (status polling, device code)

## Confidence Level

- Build-independent validation: ✅ Complete
- Automated test validation: ⏸️ Blocked on build
- Overall confidence: 🟡 Medium (pending automated tests)
```

---

## Next Steps After Manual Review

Once manual review is complete:

1. **Document findings** in `reports/rc-validation/manual-findings.md`
2. **Fix build environment** to unblock automated testing
3. **Run automated validation**: `./scripts/rc-validation-quickstart.sh`
4. **Compare** manual vs automated findings
5. **Update** migration docs with any breaking changes
6. **Continue** with Days 2-3 validation (comprehensive testing)

---

## Timeline Reminder

- **Today (Nov 16)**: Manual review + fix build
- **Nov 17-18**: Automated validation (once build works)
- **Nov 19-21**: Deep testing
- **Nov 22-23**: Analysis & docs
- **Nov 24-25**: Final validation
- **Nov 25**: Final spec release

**Days remaining**: 9

---

**Status**: Use this checklist while build is being fixed
**Next**: Run `./scripts/rc-validation-quickstart.sh` when build works
**Questions**: See `docs/MCP_SPEC_MIGRATION.md` for full context
