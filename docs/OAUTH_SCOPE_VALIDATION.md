# OAuth Scope Validation for MCP Spec Compliance

**Purpose**: Validate CortexDx OAuth/identity implementation against upcoming MCP specification guidance (November 2025).

**Last Updated**: 2025-11-16
**Related**: [AUTH0_SETUP.md](AUTH0_SETUP.md), [MCP_SPEC_MIGRATION.md](MCP_SPEC_MIGRATION.md)

## Current OAuth Configuration

### Authentication Methods Supported

1. **Auth0 JWT Tokens** (OAuth2 client credentials flow)
2. **MCP API Keys** (static API key authentication)
3. **Dual Authentication** (JWT + MCP API key)

**Configuration Location**: `docs/AUTH0_SETUP.md`, `src/auth/oauth-auth.ts`

### Current Scopes

| Scope | Resource | Permission | Current Usage | Justification |
|-------|----------|------------|---------------|---------------|
| `search.read` | Search API | Read | MCP server discovery, tool enumeration | Discovery operations |
| `docs.write` | Documentation | Write | Not actively used | Legacy scope |
| `memory.read` | Memory/State | Read | Checkpoint history queries | LangGraph state inspection |
| `memory.write` | Memory/State | Write | Checkpoint creation, thread updates | Workflow persistence |
| `memory.delete` | Memory/State | Delete | Checkpoint cleanup | State management |
| `code.write` | Code Generation | Write | Not actively used | Legacy scope |

**Auth0 Application**: CortexDx (Machine-to-Machine)
**Audience**: `https://cortex-mcp.brainwav.io/mcp`
**Grant Type**: `client_credentials`

## MCP Spec Alignment Checklist

### Pre-RC Validation (Before November 14, 2025)

#### Scope Hygiene
- [ ] **Remove unused scopes**: Audit `docs.write` and `code.write` - remove if not actively used
- [ ] **Minimal privilege**: Verify each scope is necessary for diagnostic operations
- [ ] **Document usage**: Map each scope to specific CortexDx features/operations

#### Resource Scoping
- [ ] **Resource granularity**: Review if scopes should be more resource-specific (e.g., `memory:checkpoints.read` vs. `memory.read`)
- [ ] **Namespace alignment**: Ensure scope names align with MCP resource model (when spec published)
- [ ] **Wildcard scopes**: Identify and eliminate any overly broad permissions

#### Client Configuration
- [ ] **Client type validation**: Confirm Machine-to-Machine is appropriate for diagnostic tool use case
- [ ] **Audience specificity**: Verify audience matches target MCP server exactly
- [ ] **Grant type restriction**: Ensure only `client_credentials` is enabled (no implicit/authorization_code)

### OAuth Flow Support

#### Current Implementation Status

| Flow Type | Status | Priority | Notes |
|-----------|--------|----------|-------|
| Client Credentials | ✅ Implemented | High | Primary authentication for automated diagnostics |
| Device Code | 🚧 Planned (Phase 5) | Medium | Interactive/CLI usage without browser |
| Authorization Code | ❌ Not planned | Low | Not applicable for diagnostic tool |
| Implicit | ❌ Not applicable | N/A | Deprecated, insecure |

#### Device Code Flow (Planned)
**Requirement**: Support interactive authentication for CLI users without client secrets.

**Implementation Checklist**:
- [ ] Add device code initiation endpoint call
- [ ] Implement polling mechanism for user authorization
- [ ] Add user-friendly terminal prompts with auth URL
- [ ] Handle timeout and cancellation gracefully
- [ ] Store tokens securely after user consent
- [ ] Document user flow in AUTH0_SETUP.md

**Phase 5 Roadmap Reference**: `docs/PHASE5_ROADMAP.md:13`

### Identity & Consent

#### Consent Screen (For User-Facing Deployments)
**Applicability**: Required if CortexDx runs on behalf of end users (not just M2M).

**Checklist**:
- [ ] Determine if user consent is required for diagnostic operations
- [ ] Design consent screen copy explaining scope permissions
- [ ] Document consent revocation process
- [ ] Add consent bypass for trusted first-party scenarios
- [ ] Test consent flow with Auth0 Universal Login

#### Client Signing & Verification
**Requirement**: MCP spec may require signed clients for enhanced security.

**Checklist**:
- [ ] Review MCP spec guidance on client signing (post-RC)
- [ ] Determine if diagnostic tools require signing
- [ ] Implement certificate-based client authentication if required
- [ ] Add client identity verification in server handshake
- [ ] Document client certificate management

## Scope Validation Testing

### Test Scenarios

#### Scenario 1: Minimal Scope Set
**Goal**: Verify CortexDx functions with minimum required scopes.

```bash
# Test with only essential scopes
# Expected scopes: search.read, memory.read, memory.write

cortexdx diagnose https://cortex-mcp.brainwav.io/mcp \
  --deterministic --full --out reports/minimal-scopes
```

**Expected Results**:
- ✅ MCP server discovery succeeds
- ✅ Checkpoint creation/resume works
- ✅ Diagnostic report generation completes
- ❌ Any unused features gracefully disabled

#### Scenario 2: Scope Denial Handling
**Goal**: Verify graceful degradation when scopes are denied.

```bash
# Test with missing memory.write scope
# Expected behavior: Read-only mode, no checkpoint persistence

cortexdx orchestrate https://mcp.example.com \
  --workflow agent.langgraph.baseline \
  # (Auth0 client configured without memory.write)
```

**Expected Results**:
- ✅ Diagnostic proceeds in read-only mode
- ⚠️  Warning logged about checkpoint persistence disabled
- ✅ Results still generated (without state saving)

#### Scenario 3: Dual Auth Validation
**Goal**: Verify JWT + MCP API key authentication works correctly.

```bash
# Test with both Auth0 JWT and MCP API key
cortexdx diagnose https://cortex-mcp.brainwav.io/mcp \
  --mcp-api-key "$CORTEXDX_MCP_API_KEY" \
  --deterministic --full --out reports/dual-auth
```

**Expected Results**:
- ✅ Both authorization methods accepted
- ✅ Server validates JWT signature + API key
- ✅ Access granted to all scoped resources

### Automated Validation

Create test suite for OAuth scope validation:

```typescript
// tests/oauth-scope-validation.spec.ts

describe('OAuth Scope Validation', () => {
  it('should function with minimal scope set', async () => {
    // Test with search.read + memory.read + memory.write only
  });

  it('should degrade gracefully without memory.write', async () => {
    // Verify read-only mode when write scope denied
  });

  it('should reject operations requiring missing scopes', async () => {
    // Attempt checkpoint write without memory.write scope
    // Expected: Clear error message, graceful failure
  });

  it('should handle token expiration gracefully', async () => {
    // Simulate expired JWT token
    // Expected: Clear error, prompt for re-authentication
  });
});
```

## Post-RC Actions (After November 14, 2025)

### Specification Review
- [ ] Download and review MCP OAuth/identity specification section
- [ ] Compare CortexDx scopes against recommended resource model
- [ ] Identify any new required scopes or deprecated patterns
- [ ] Document migration path for scope changes

### Scope Migration
If spec introduces breaking changes:

1. **Backward Compatibility**: Support both old and new scope formats during transition
2. **Migration Guide**: Document scope mapping for existing deployments
3. **Deprecation Timeline**: Announce sunset date for old scopes
4. **Automated Migration**: Provide CLI tool to update Auth0 configuration

### Client Signing
If spec requires client signing:

1. **Certificate Generation**: Document cert creation process
2. **Signing Implementation**: Add signature to MCP handshake
3. **Verification**: Server-side signature validation
4. **Certificate Rotation**: Document renewal process

## Compliance Dashboard

Track OAuth compliance status:

| Requirement | Current Status | Target | Blocker |
|-------------|---------------|--------|---------|
| Minimal scopes | 🟡 Needs audit | ✅ Remove unused | Scope usage mapping incomplete |
| Resource-specific scopes | 🔴 Not implemented | 🟡 Evaluate post-RC | Awaiting spec guidance |
| Device code flow | 🔴 Not implemented | ✅ Implement (Phase 5) | Scheduled for Phase 5 |
| Consent screens | 🔴 Not implemented | 🟡 Evaluate use case | Determine if user-facing |
| Client signing | 🔴 Not implemented | 🟡 Awaiting spec | MCP spec not published |
| Token refresh | 🟡 Basic support | ✅ Long-running ops | Need async operation tokens |

**Legend**:
- 🔴 Not started
- 🟡 In progress / Needs evaluation
- ✅ Complete

## Monitoring & Audit

### Token Usage Metrics
Track OAuth token usage to validate scope necessity:

```bash
# Log token requests with scope breakdown
# Location: logs/oauth-token-requests.jsonl

{
  "timestamp": "2025-11-16T10:30:00Z",
  "client_id": "...",
  "scopes_requested": ["search.read", "memory.read", "memory.write"],
  "scopes_granted": ["search.read", "memory.read"],
  "scopes_denied": ["memory.write"],
  "operation": "cortexdx diagnose",
  "result": "success_degraded"
}
```

### Scope Audit Frequency
- **Weekly**: Review token request logs for scope denials
- **Monthly**: Audit unused scopes and request removal
- **Pre-Release**: Full scope validation against MCP spec
- **Post-Incident**: Review scope permissions if auth-related issues

## Security Considerations

### Token Storage
- ✅ Tokens stored in memory only (not persisted to disk)
- ✅ Automatic token expiration respected
- ⚠️  Long-running operations may need token refresh strategy

### Scope Creep Prevention
- Document justification for each new scope request
- Require security team approval for scope additions
- Sunset unused scopes within 90 days of identification

### Least Privilege
- Default to read-only scopes when possible
- Use write scopes only for specific operations (checkpoints, reports)
- Separate admin scopes from regular diagnostic scopes

## References

- [Auth0 Setup Documentation](AUTH0_SETUP.md)
- [MCP Spec Migration Tracker](MCP_SPEC_MIGRATION.md)
- [Phase 5 Roadmap](PHASE5_ROADMAP.md)
- [OAuth 2.0 Best Practices (RFC 8252)](https://tools.ietf.org/html/rfc8252)
- [Auth0 Machine-to-Machine Documentation](https://auth0.com/docs/get-started/applications/application-settings#machine-to-machine-applications)

---

**Next Review**: November 14, 2025 (MCP Spec RC Release)
**Owner**: CortexDx Security Team
