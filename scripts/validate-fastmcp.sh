#!/bin/bash
# FastMCP Validation Script Using CortexDx
# This script validates a FastMCP server against CortexDx diagnostic criteria

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
FASTMCP_ENDPOINT="${1:-}"
OUTPUT_DIR="${2:-./fastmcp-validation-results}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -z "$FASTMCP_ENDPOINT" ]; then
  echo -e "${RED}Error: FastMCP endpoint required${NC}"
  echo "Usage: $0 <fastmcp-endpoint> [output-dir]"
  echo "Example: $0 http://localhost:3000 ./results"
  exit 1
fi

echo -e "${GREEN}=== FastMCP Validation Using CortexDx ===${NC}"
echo "Endpoint: $FASTMCP_ENDPOINT"
echo "Output Directory: $OUTPUT_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Test 1: Critical Security - Unauthenticated Access
echo -e "${YELLOW}[1/5] Testing Unauthenticated Access (BLOCKER Priority)${NC}"
npx cortexdx diagnose "$FASTMCP_ENDPOINT" \
  --suites=auth \
  --output="$OUTPUT_DIR/01-auth-test-$TIMESTAMP.json" \
  || echo -e "${RED}⚠️  Auth test failed or found blockers${NC}"

# Test 2: Protocol Compliance
echo -e "${YELLOW}[2/5] Testing Protocol Compliance${NC}"
npx cortexdx diagnose "$FASTMCP_ENDPOINT" \
  --suites=protocol \
  --output="$OUTPUT_DIR/02-protocol-test-$TIMESTAMP.json" \
  || echo -e "${RED}⚠️  Protocol test failed${NC}"

# Test 3: SSE Streaming (if endpoint supports it)
echo -e "${YELLOW}[3/5] Testing SSE Streaming${NC}"
npx cortexdx diagnose "$FASTMCP_ENDPOINT" \
  --suites=streaming \
  --output="$OUTPUT_DIR/03-sse-test-$TIMESTAMP.json" \
  || echo -e "${YELLOW}⚠️  SSE test failed (may not be supported)${NC}"

# Test 4: MCP Compatibility
echo -e "${YELLOW}[4/5] Testing MCP Compatibility (120s timeout)${NC}"
npx cortexdx diagnose "$FASTMCP_ENDPOINT" \
  --suites=mcp-compatibility-checker \
  --output="$OUTPUT_DIR/04-compatibility-test-$TIMESTAMP.json" \
  || echo -e "${RED}⚠️  Compatibility test failed${NC}"

# Test 5: Comprehensive Security Scan
echo -e "${YELLOW}[5/5] Running Comprehensive Security Scan${NC}"
export CORTEXDX_ENFORCE_SECURITY=1
npx cortexdx probe "$FASTMCP_ENDPOINT" \
  --suites=security-scanner \
  --full \
  --output="$OUTPUT_DIR/05-security-scan-$TIMESTAMP.json" \
  || echo -e "${RED}⚠️  Security scan failed or found blockers${NC}"

# Generate summary report
echo -e "${GREEN}=== Generating Summary Report ===${NC}"

cat > "$OUTPUT_DIR/summary-$TIMESTAMP.md" << 'SUMMARY_TEMPLATE'
# FastMCP Validation Summary

**Endpoint:** FASTMCP_ENDPOINT_PLACEHOLDER
**Validation Date:** TIMESTAMP_PLACEHOLDER

## Test Results

### 1. Authentication & Authorization
- **Test Suite:** `auth`
- **Report:** [01-auth-test-TIMESTAMP_PLACEHOLDER.json](./01-auth-test-TIMESTAMP_PLACEHOLDER.json)
- **Critical Check:** Unauthenticated tool discovery
- **Expected:** No sessions created on auth failure, tools require authentication

### 2. Protocol Compliance
- **Test Suite:** `protocol`
- **Report:** [02-protocol-test-TIMESTAMP_PLACEHOLDER.json](./02-protocol-test-TIMESTAMP_PLACEHOLDER.json)
- **Critical Checks:**
  - JSON-RPC 2.0 message structure
  - MCP v2024-11-05 protocol version
  - Initialize handshake completeness
  - Capabilities declaration

### 3. SSE Streaming
- **Test Suite:** `streaming`
- **Report:** [03-sse-test-TIMESTAMP_PLACEHOLDER.json](./03-sse-test-TIMESTAMP_PLACEHOLDER.json)
- **Critical Checks:**
  - Endpoint connectivity
  - Heartbeat mechanism
  - Stream health

### 4. MCP Compatibility
- **Test Suite:** `mcp-compatibility-checker`
- **Report:** [04-compatibility-test-TIMESTAMP_PLACEHOLDER.json](./04-compatibility-test-TIMESTAMP_PLACEHOLDER.json)
- **Critical Checks:**
  - Multiple protocol version support
  - Client behavior patterns
  - Concurrent request handling
  - Performance < 120s

### 5. Security Comprehensive Scan
- **Test Suite:** `security` (full)
- **Report:** [05-security-scan-TIMESTAMP_PLACEHOLDER.json](./05-security-scan-TIMESTAMP_PLACEHOLDER.json)
- **Frameworks:**
  - OWASP ASVS (L1/L2/L3)
  - MITRE ATLAS
  - SAST (Semgrep)
  - Secrets (Gitleaks)
  - DAST (OWASP ZAP)

## Scoring Interpretation

| Score Range | Grade | Compliance | Meaning |
|-------------|-------|------------|---------|
| 90-100 | 🟢 Excellent | PASSED | Production ready |
| 70-89 | 🟡 Good | PASSED* | Minor improvements needed |
| 50-69 | 🟠 Attention | FAILED | Significant issues |
| 0-49 | 🔴 Critical | FAILED | Blocker issues present |

*PASSED only if: 0 blockers AND ≤2 major issues

## Review Claims Validation

### Claim: "Sessions created when authentication fails"
- **CortexDx Finding:** Check `01-auth-test` for finding ID `unauthenticated-tool-discovery`
- **Severity if found:** BLOCKER (-30 points)
- **Review Accurate?** [PENDING - Review JSON report]

### Claim: "Returns 400 instead of 401 for authentication failures"
- **CortexDx Finding:** Check `05-security-scan` for HTTP status code issues
- **Severity if found:** MAJOR (-10 points)
- **Review Accurate?** [PENDING - Review JSON report]

### Claim: "Correctly implements JSON-RPC 2.0"
- **CortexDx Finding:** Check `02-protocol-test` for JSON-RPC validation
- **Severity if failed:** BLOCKER (-30 points)
- **Review Accurate?** [PENDING - Review JSON report]

### Claim: "Supports multiple transport mechanisms"
- **CortexDx Finding:** Check `03-sse-test` and `04-compatibility-test`
- **Severity if failed:** MAJOR (-10 points)
- **Review Accurate?** [PENDING - Review JSON report]

## Next Steps

1. Review each JSON report for detailed findings
2. Calculate total score: `100 - (blockers × 30) - (major × 10) - (minor × 2)`
3. Determine compliance: `blockers === 0 && major <= 2`
4. Compare findings with original review claims
5. Document discrepancies
6. Fix any blocker issues in FastMCP
7. Re-validate

## CortexDx Validation Files Reference

- Auth validation: `/packages/cortexdx/src/plugins/auth.ts:35-54`
- Security scoring: `/packages/cortexdx/src/plugins/security-scanner.ts`
- Score calculation: `/packages/cortexdx/src/probe/mcp-probe-engine.ts:283-289`
- Protocol validation: `/packages/cortexdx/src/plugins/protocol.ts:147-192`
- SSE validation: `/packages/cortexdx/src/plugins/streaming-sse.ts`
SUMMARY_TEMPLATE

# Replace placeholders
sed "s|FASTMCP_ENDPOINT_PLACEHOLDER|$FASTMCP_ENDPOINT|g" "$OUTPUT_DIR/summary-$TIMESTAMP.md" > "$OUTPUT_DIR/summary-$TIMESTAMP.md.tmp" && mv "$OUTPUT_DIR/summary-$TIMESTAMP.md.tmp" "$OUTPUT_DIR/summary-$TIMESTAMP.md"
sed "s|TIMESTAMP_PLACEHOLDER|$TIMESTAMP|g" "$OUTPUT_DIR/summary-$TIMESTAMP.md" > "$OUTPUT_DIR/summary-$TIMESTAMP.md.tmp" && mv "$OUTPUT_DIR/summary-$TIMESTAMP.md.tmp" "$OUTPUT_DIR/summary-$TIMESTAMP.md"

echo -e "${GREEN}=== Validation Complete ===${NC}"
echo ""
echo "Results saved to: $OUTPUT_DIR"
echo "Summary report: $OUTPUT_DIR/summary-$TIMESTAMP.md"
echo ""
echo "Next steps:"
echo "1. Review summary: cat $OUTPUT_DIR/summary-$TIMESTAMP.md"
echo "2. Check for blockers: grep -l '\"severity\":\"blocker\"' $OUTPUT_DIR/*.json"
echo "3. Calculate score: See individual test reports"
echo ""
