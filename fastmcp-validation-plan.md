# FastMCP Validation Plan Using CortexDx

## Objective
Validate the FastMCP review claims against actual CortexDx diagnostic results.

## Critical Tests Based on Review

### 1. Session Management Security (BLOCKER Priority)
**Review Claim:** "Sessions created even when authentication fails"

**CortexDx Test:**
```bash
# Run CortexDx probe with auth plugin enabled
npx cortexdx probe <fastmcp-endpoint> --suites=auth,security

# Expected findings if issue exists:
# - ID: unauthenticated-tool-discovery
# - Severity: BLOCKER
# - Score impact: -30 points
```

**Validation Criteria:**
- [ ] Test unauthenticated tool/list request
- [ ] Verify session is NOT created on auth failure
- [ ] Confirm proper 401 HTTP status on auth failure
- [ ] Check that no tools are exposed without valid auth

### 2. HTTP Status Code Validation
**Review Claim:** "Returns 400 instead of 401 for authentication failures"

**CortexDx Test:**
```bash
# Security scanner will flag improper auth responses
npx cortexdx probe <fastmcp-endpoint> --suites=security --full
```

**Validation Criteria:**
- [ ] 401 for missing/invalid credentials
- [ ] 403 for valid credentials but insufficient permissions
- [ ] 400 only for malformed requests

### 3. Protocol Compliance
**Review Claim:** "Correctly implements JSON-RPC 2.0"

**CortexDx Test:**
```bash
npx cortexdx probe <fastmcp-endpoint> --suites=protocol
```

**Validation Criteria:**
- [ ] JSON-RPC 2.0 message structure
- [ ] MCP v2024-11-05 protocol version
- [ ] Proper initialize handshake
- [ ] Capabilities declaration

### 4. Transport Interoperability
**Review Claim:** "Supports STDIO, HTTP Streaming, SSE"

**CortexDx Test:**
```bash
# Test each transport
npx cortexdx probe <fastmcp-http-endpoint> --suites=streaming-sse
npx cortexdx probe <fastmcp-ws-endpoint> --suites=mcp-compatibility
```

**Validation Criteria:**
- [ ] SSE endpoint responds within timeout
- [ ] SSE heartbeat mechanism active
- [ ] HTTP streaming handles concurrent requests
- [ ] Completes compatibility tests within 120s

### 5. Security Comprehensive Scan
**CortexDx Test:**
```bash
# Full security assessment with ASVS, ATLAS, SAST, DAST
export CORTEXDX_ENFORCE_SECURITY=1
npx cortexdx probe <fastmcp-endpoint> --suites=security --full

# This will test:
# - OWASP ASVS L1/L2/L3 compliance
# - MITRE ATLAS AI/ML threats
# - Semgrep SAST for insecure patterns
# - Gitleaks for exposed secrets
# - OWASP ZAP DAST for transport vulns
```

**Expected Score Calculation:**
```typescript
let score = 100;
score -= (blockerFindings * 30);
score -= (majorFindings * 10);
score -= (minorFindings * 2);

// Compliance: blockerFindings === 0 && majorFindings <= 2
```

## Testing FastMCP Variants

### Test Matrix

| Transport | Auth Method | Test Suite | Expected Result |
|-----------|-------------|------------|-----------------|
| HTTP      | None        | auth       | BLOCKER if tools exposed |
| HTTP      | Bearer      | auth       | PASS if properly enforced |
| HTTP      | OAuth       | auth       | PASS if JWKS validated |
| SSE       | Bearer      | streaming-sse | PASS if heartbeat present |
| WebSocket | Bearer      | mcp-compatibility | PASS if < 120s |
| STDIO     | N/A         | protocol   | PASS if JSON-RPC compliant |

## CortexDx Scoring Interpretation

| Score | Grade | Status | Meaning |
|-------|-------|--------|---------|
| 90-100 | 🟢 Excellent | Production Ready | Minor/no issues |
| 70-89 | 🟡 Good | Needs Improvements | Some major issues |
| 50-69 | 🟠 Attention | Significant Issues | Multiple major issues |
| 0-49 | 🔴 Critical | Not Compliant | Blocker issues present |

## Expected FastMCP Results

### If Review is Accurate:
- **Session management issue** = 1 BLOCKER
- **Score:** ≤70 (100 - 30 = 70, minus any additional findings)
- **Compliance:** FAILED
- **Grade:** 🟡 Good to 🟠 Attention (depending on additional findings)

### If Session Issue Fixed:
- **Blockers:** 0
- **Score:** 80-100 (depending on minor/major findings)
- **Compliance:** PASSED (if ≤2 major issues)
- **Grade:** 🟢 Excellent to 🟡 Good

## Commands to Run

```bash
# 1. Quick validation (5-10 minutes)
npx cortexdx probe <fastmcp-endpoint> --suites=protocol,auth

# 2. Comprehensive validation (30-60 minutes)
npx cortexdx probe <fastmcp-endpoint> --suites=protocol,auth,security,mcp-compatibility,streaming-sse --full

# 3. Generate detailed report
npx cortexdx probe <fastmcp-endpoint> --suites=all --full --output=fastmcp-report.json

# 4. Security-enforced mode (strictest)
export CORTEXDX_ENFORCE_SECURITY=1
npx cortexdx probe <fastmcp-endpoint> --suites=security --full
```

## Files to Review for Validation Logic

- `/home/user/CortexDx/packages/cortexdx/src/plugins/auth.ts:35-54` - Unauthenticated access test
- `/home/user/CortexDx/packages/cortexdx/src/plugins/security-scanner.ts` - Security scoring
- `/home/user/CortexDx/packages/cortexdx/src/probe/mcp-probe-engine.ts:283-289` - Score calculation
- `/home/user/CortexDx/packages/cortexdx/src/plugins/protocol.ts:147-192` - JSON-RPC validation
- `/home/user/CortexDx/packages/cortexdx/src/plugins/streaming-sse.ts` - SSE transport validation

## Next Steps

1. Deploy a FastMCP test server with authentication
2. Run CortexDx validation suite
3. Compare actual findings with review claims
4. Document discrepancies
5. Update FastMCP if blockers found
6. Re-validate until compliant
