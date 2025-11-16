# MCP Specification Migration Tracker

**Current Status**: Preparing for MCP Spec November 2025 Release
**Last Updated**: 2025-11-16

## Timeline

| Milestone | Date | Status | CortexDx Action Required |
|-----------|------|--------|-------------------------|
| RC (Release Candidate) | November 14, 2025 | ⏳ Upcoming | Validation testing |
| Final Specification | November 25, 2025 | ⏳ Upcoming | SDK upgrade & compliance |

## Current State

### SDK Version
- **Current**: `@modelcontextprotocol/sdk` v1.22.0
- **Target Protocol**: MCP v2024-11-05
- **Next Action**: Monitor npm releases for RC-aligned SDK version

### CortexDx Capabilities Already Aligned

#### ✅ Async/Long-Running Operations Support
**What's Required**: Support for operations that may take minutes or hours, with status polling and callbacks.

**Current Implementation**:
- LangGraph-based workflow orchestration (`packages/cortexdx/src/orchestration/`)
- SQLite checkpoint storage (`.cortexdx/workflow-state.db`)
- Thread resumption via `--resume-thread` flag
- State persistence across diagnostic runs
- **Location**: `docs/ORCHESTRATION.md`, `src/orchestration/agent-orchestrator.ts`

**Gaps to Address**:
- [ ] Add status polling endpoint for in-progress diagnostics
- [ ] Implement callback/webhook support for async completion notifications
- [ ] Enhance checkpoint metadata to include operation status/progress
- [ ] Add timeout/TTL management for long-running operations

#### ✅ OAuth/Identity Flow Support
**What's Required**: Proper integration with OAuth flows, signed clients, consent screens, and resource scopes.

**Current Implementation**:
- Auth0 JWT token authentication (client credentials flow)
- MCP API key authentication
- Dual authentication support (JWT + API key)
- Scope management: `search.read`, `docs.write`, `memory.*`, `code.write`
- **Location**: `docs/AUTH0_SETUP.md`, `src/auth/oauth-auth.ts`

**Gaps to Address**:
- [ ] Device code flow fallback (planned in Phase 5: `docs/PHASE5_ROADMAP.md:13`)
- [ ] Consent screen integration for user-facing flows
- [ ] Review scopes against new MCP resource scope guidance
- [ ] Implement token refresh strategy for long-running operations
- [ ] Add client signing/verification for enhanced security

#### ✅ Streaming Support
**What's Required**: SSE (Server-Sent Events) and WebSocket support for real-time communication.

**Current Implementation**:
- SSE endpoint testing and validation
- WebSocket connection lifecycle management
- Streaming diagnostic in probe engine
- **Location**: `src/plugins/` (various streaming tests)

**Gaps to Address**:
- [ ] Verify SSE timeout behavior for long-running async operations
- [ ] Add backpressure handling for streaming results
- [ ] Test SSE reconnection logic with async operation state

## Pre-RC Checklist (Before November 14, 2025)

### Immediate Actions
- [ ] Subscribe to `@modelcontextprotocol/sdk` npm releases
- [ ] Monitor MCP GitHub repository for RC announcement
- [ ] Review MCP spec change log when RC is published
- [ ] Set up test environment for RC validation

### Code Preparation
- [ ] Add status polling interface to `DiagnosticSession`
- [ ] Implement webhook notification system for async completions
- [ ] Document current OAuth scope usage and validate against guidelines
- [ ] Create async operation timeout configuration

### Testing Preparation
- [ ] Create RC validation test suite
- [ ] Document regression test scenarios
- [ ] Set up CI job for RC SDK testing
- [ ] Prepare rollback strategy if RC breaks compatibility

## RC Validation Plan (November 14-25, 2025)

### Phase 1: SDK Compatibility (Days 1-3)
1. Install RC version of `@modelcontextprotocol/sdk`
2. Run full test suite (`pnpm test`)
3. Run integration tests (`pnpm test:integration`)
4. Document any breaking changes or deprecations

### Phase 2: Feature Validation (Days 4-7)
1. Test async operation support
   - Long-running diagnostic scenarios
   - Status polling endpoints
   - Callback/webhook delivery
2. Test OAuth/identity flows
   - Token exchange
   - Scope validation
   - Client signing (if applicable)
3. Test streaming operations
   - SSE connection stability
   - WebSocket message handling
   - Backpressure scenarios

### Phase 3: Regression Testing (Days 8-10)
1. Run self-diagnostics: `pnpm self:diagnose`
2. Test against reference MCP servers
3. Validate all CLI commands
4. Check report generation accuracy

### Phase 4: Documentation Update (Days 10-11)
1. Update CHANGELOG with RC notes
2. Update docs with new spec version references
3. Document migration steps for users
4. Update API reference if needed

## Post-Final Release Actions (After November 25, 2025)

### Immediate (Week 1)
- [ ] Upgrade to final SDK version
- [ ] Update all spec version references (`v2024-11-05` → new version)
- [ ] Run full validation suite
- [ ] Update CHANGELOG.md
- [ ] Cut release with MCP spec compliance notes

### Short-term (Weeks 2-4)
- [ ] Enhance async operation examples in documentation
- [ ] Add new async patterns to `mcp-evals` test suite
- [ ] Update tutorial content with new features
- [ ] Blog post on CortexDx MCP spec compliance

### Long-term (Months 2-3)
- [ ] Optimize async operation performance
- [ ] Add metrics/observability for long-running operations
- [ ] Expand OAuth provider support beyond Auth0
- [ ] Community feedback integration

## Key Files to Update

When spec releases, update these files:

| File | Current Reference | Update Needed |
|------|------------------|---------------|
| `packages/cortexdx/CHANGELOG.md:22` | MCP v2024-11-05 | New spec version |
| `packages/cortexdx/package.json` | SDK v1.22.0 | RC/Final SDK version |
| `README.md:8` | Generic MCP reference | Spec version + compliance badge |
| `docs/ORCHESTRATION.md` | Current async patterns | New async operation patterns |
| `docs/AUTH0_SETUP.md` | Current OAuth setup | Updated scope guidance |

## Validation Gaps Analysis

### Async Operations
**Requirement**: Long-running operations with status checks and callbacks

**Current Gaps**:
1. No dedicated status polling endpoint
2. No webhook/callback mechanism
3. Checkpoint metadata doesn't expose progress
4. No operation timeout configuration

**Proposed Implementation**:
```typescript
// packages/cortexdx/src/server.ts
interface AsyncOperationStatus {
  operationId: string;
  threadId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number; // 0-100
  startedAt: string;
  estimatedCompletion?: string;
  result?: unknown;
  error?: string;
}

// New MCP tools to expose:
// - cortexdx_async_operation_status
// - cortexdx_async_operation_subscribe
```

### OAuth/Identity
**Requirement**: Proper OAuth integration with consent, scopes, and client signing

**Current Gaps**:
1. Device code flow not implemented (planned Phase 5)
2. No consent screen integration
3. Scopes not validated against latest MCP guidance
4. No client signing/verification

**Proposed Implementation**:
- Complete Phase 5 Auth0 device code flow
- Add consent screen docs for user-facing deployments
- Review and align scopes with MCP resource model
- Add client certificate support for signed clients

## Monitoring Strategy

### Pre-RC
- Weekly check of `@modelcontextprotocol/sdk` releases
- Monitor MCP GitHub issues/discussions for RC updates
- Track community adoption of async operation patterns

### Post-RC
- Daily monitoring of breaking changes or errata
- Community feedback on RC compatibility
- Performance benchmarks for async operations

### Post-Final
- Monthly review of MCP spec updates
- Quarterly compatibility audits
- Community contribution integration

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking SDK changes | Medium | High | Maintain RC branch, test early |
| OAuth scope changes | Low | Medium | Document current usage, prepare mapping |
| Async API redesign | Low | High | Abstract async layer, keep current checkpoints |
| Timeline slips beyond Nov 25 | Low | Low | Continue current development, defer non-critical |

## Questions for MCP Spec Review (When RC Published)

- [ ] Are current checkpoint/resume patterns compatible with new async model?
- [ ] Do our Auth0 scopes align with resource scope guidance?
- [ ] Is SSE still the recommended streaming transport?
- [ ] What's the recommended timeout strategy for long operations?
- [ ] Are there new required capabilities for MCP diagnostic tools?
- [ ] Does client signing apply to diagnostic/testing tools?

## Success Criteria

CortexDx will be considered "MCP Spec November 2025 Compliant" when:

1. ✅ Using final SDK version with all tests passing
2. ✅ Async operation support validated with >1 hour test runs
3. ✅ OAuth flows tested against MCP reference implementation
4. ✅ All documentation updated with new spec version
5. ✅ Self-diagnostics show 100% compliance with new spec
6. ✅ Community validation via mcp-evals harness

---

**Next Review**: November 14, 2025 (RC release date)
**Owner**: CortexDx Development Team
**Status Page**: This document
