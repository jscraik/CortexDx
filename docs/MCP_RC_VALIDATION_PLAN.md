# MCP Specification RC Validation Test Plan

**Target RC Date**: November 14, 2025
**Final Spec Date**: November 25, 2025
**Validation Window**: 11 days (Nov 14-25)

**Purpose**: Validate CortexDx compatibility with the MCP specification Release Candidate and identify any breaking changes before the final spec release.

## RC Validation Baseline (Historical Context)

### Environment Setup

#### Test Environment Matrix
Set up isolated test environments:

| Environment | Purpose | SDK Version | State DB | Notes |
|-------------|---------|-------------|----------|-------|
| `prod-baseline` | Current production baseline | v1.22.0 | `.cortexdx/baseline.db` | Baseline for comparison |
| `rc-validation` | RC testing | RC version | `.cortexdx/rc-test.db` | Primary RC validation |
| `rc-regression` | Regression testing | RC version | `.cortexdx/rc-regression.db` | Compare against baseline |

#### Monitoring Setup
- [ ] Set up npm watch for `@modelcontextprotocol/sdk` RC release
- [ ] Configure GitHub notifications for MCP spec repository
- [ ] Create Slack/Discord webhook for team notifications
- [ ] Prepare evidence collection directory: `reports/rc-validation/`

### Baseline Capture

Run comprehensive baseline tests before RC:

```bash
# Capture current state (pre-RC baseline)
mkdir -p reports/rc-validation/baseline

# Full diagnostic suite
pnpm build && pnpm test && pnpm test:integration

# Self-diagnostics
pnpm self:diagnose

# Capture baseline reports
cortexdx diagnose https://cortex-mcp.brainwav.io/mcp \
  --deterministic --full \
  --out reports/rc-validation/baseline

# Orchestration baseline
cortexdx orchestrate https://cortex-mcp.brainwav.io/mcp \
  --workflow agent.langgraph.baseline \
  --deterministic \
  --state-db .cortexdx/baseline.db \
  --report-out reports/rc-validation/baseline/orchestration

# Save SDK version info
npm list @modelcontextprotocol/sdk > reports/rc-validation/baseline/sdk-version.txt
```

## Day 1: RC Installation & Initial Validation (November 14)

### Phase 1: SDK Installation (2 hours)

#### Install RC SDK
```bash
# Create RC validation branch
git checkout -b rc-validation-nov-2025

# Install RC SDK (v1.22.0-rc is the current RC version)
pnpm --filter @brainwav/cortexdx add @modelcontextprotocol/sdk@1.22.0-rc

# Document installed version
npm list @modelcontextprotocol/sdk > reports/rc-validation/rc/sdk-version.txt

# Commit changes
git add packages/cortexdx/package.json pnpm-lock.yaml
git commit -m "chore: install MCP SDK RC for validation"
```

**Exit Criteria**:
- [ ] RC SDK installed successfully
- [ ] Version documented
- [ ] Branch created and committed

### Phase 2: Build & Test Suite (3 hours)

#### Run Full Test Suite
```bash
# Build with RC SDK
pnpm build 2>&1 | tee reports/rc-validation/rc/build.log

# Check for build errors
if [ $? -ne 0 ]; then
  echo "❌ Build failed - document errors"
  # Document build failures in reports/rc-validation/rc/build-failures.md
fi

# Run unit tests
pnpm test 2>&1 | tee reports/rc-validation/rc/unit-tests.log

# Run integration tests
pnpm test:integration 2>&1 | tee reports/rc-validation/rc/integration-tests.log

# Check test results
# Document any failures in reports/rc-validation/rc/test-failures.md
```

**Exit Criteria**:
- [ ] Build log captured
- [ ] Test results documented
- [ ] Failures analyzed and categorized (breaking vs. non-breaking)

### Phase 3: Quick Smoke Test (1 hour)

#### Basic Functionality Validation
```bash
# Quick diagnostic smoke test
cortexdx diagnose https://cortex-mcp.brainwav.io/mcp \
  --suites connectivity \
  --out reports/rc-validation/rc/smoke-test

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ Basic connectivity works with RC"
else
  echo "❌ Critical failure - RC breaks basic functionality"
fi
```

**Exit Criteria**:
- [ ] Basic connectivity validated
- [ ] Critical blockers identified (if any)
- [ ] Team notified of Day 1 status

### Day 1 Deliverables
- Installation log
- Build status report
- Test failure summary
- Go/No-Go decision for deeper validation

## Days 2-4: Comprehensive Feature Validation (November 15-17)

### Protocol Compliance Testing

#### Test Suite: Core MCP Operations
```bash
# Run comprehensive diagnostic with RC SDK
cortexdx diagnose https://cortex-mcp.brainwav.io/mcp \
  --deterministic --full \
  --out reports/rc-validation/rc/comprehensive

# Compare findings against baseline
cortexdx compare \
  reports/rc-validation/baseline/cortexdx-findings.json \
  reports/rc-validation/rc/comprehensive/cortexdx-findings.json \
  > reports/rc-validation/findings-diff.md
```

#### Validation Checklist

**Connectivity & Transport**:
- [ ] HTTP/HTTPS connection establishment
- [ ] JSON-RPC 2.0 message format
- [ ] Server-Sent Events (SSE) streaming
- [ ] WebSocket connection lifecycle
- [ ] gRPC basic probing (if applicable)

**Authentication & Authorization**:
- [ ] Auth0 JWT token acquisition
- [ ] Token validation and expiration
- [ ] MCP API key authentication
- [ ] Dual authentication (JWT + API key)
- [ ] Scope enforcement and validation

**MCP Protocol Operations**:
- [ ] Server discovery and capability negotiation
- [ ] Tool enumeration and invocation
- [ ] Resource listing and reading
- [ ] Prompt template discovery
- [ ] Batch request handling
- [ ] Error response format

**Async Operations (NEW - Spec Focus)**:
- [ ] Long-running operation initiation
- [ ] Status polling (if endpoint exposed)
- [ ] Operation cancellation
- [ ] Timeout handling
- [ ] Checkpoint-based resumption

**Streaming**:
- [ ] SSE heartbeat validation
- [ ] Event stream parsing
- [ ] Reconnection logic
- [ ] Streaming timeout behavior

### Async Operations Deep Dive

#### Test Long-Running Workflows
```bash
# Start long-running orchestration (target: 30+ minutes)
cortexdx orchestrate https://cortex-mcp.brainwav.io/mcp \
  --workflow agent.langgraph.comprehensive \
  --deterministic \
  --state-db .cortexdx/rc-async-test.db \
  > reports/rc-validation/rc/async-operation.log 2>&1 &

ORCHESTRATE_PID=$!
THREAD_ID=$(awk -F'thread_id=' '{if (NF>1) print $2}' reports/rc-validation/rc/async-operation.log | awk '{print $1}' | head -1)

# Monitor and interrupt after 10 minutes
sleep 600
kill $ORCHESTRATE_PID

# Attempt resume from checkpoint
cortexdx orchestrate https://cortex-mcp.brainwav.io/mcp \
  --workflow agent.langgraph.comprehensive \
  --resume-thread $THREAD_ID \
  --state-db .cortexdx/rc-async-test.db \
  --report-out reports/rc-validation/rc/async-resumed
```

**Validation Points**:
- [ ] Checkpoint created during execution
- [ ] Resume starts from last checkpoint (not from beginning)
- [ ] No duplicate probe execution
- [ ] Final report matches expected results

### OAuth/Identity Validation

#### Test Authentication Flows
```bash
# Test 1: Client credentials flow (current)
cortexdx diagnose https://cortex-mcp.brainwav.io/mcp \
  --deterministic \
  --out reports/rc-validation/rc/oauth-client-creds

# Test 2: Device code flow (planned for Phase 5)
# NOTE: Device code flow support is not yet implemented in CortexDx (planned for Phase 5).
# The following commands are provided as examples for future use.
# Do not use or uncomment these until device code flow support is available.
# Example (for future use only):
# cortexdx diagnose https://cortex-mcp.brainwav.io/mcp \
#   --auth0-device-code \
#   --out reports/rc-validation/rc/oauth-device-code

# Test 3: Token expiration handling
# (Simulate expired token and verify refresh or error handling)
```

**Validation Points**:
- [ ] Token acquisition succeeds
- [ ] Scopes correctly requested and granted
- [ ] Token expiration handled gracefully
- [ ] Error messages clear and actionable

## Days 5-7: Regression Testing (November 18-20)

### Regression Test Matrix

Run all existing test suites against RC:

```bash
# All diagnostic suites
for suite in connectivity security governance streaming performance; do
  cortexdx diagnose https://cortex-mcp.brainwav.io/mcp \
    --suites $suite \
    --deterministic \
    --out reports/rc-validation/rc/suite-$suite
done

# MCP evals harness
npx mcp-eval tests/mcp-evals/cortexdx-basic.evals.mjs \
  packages/cortexdx/src/adapters/stdio-wrapper.ts \
  > reports/rc-validation/rc/mcp-evals.log 2>&1

# Security tooling
pnpm security:semgrep
pnpm security:gitleaks
# pnpm security:zap https://cortex-mcp.brainwav.io/mcp

# Self-diagnostics
CORTEXDX_SELF_ENV=.env.self pnpm self:diagnose
```

### Performance Benchmarking

Compare RC performance against baseline:

```bash
# Run performance benchmarks
pnpm test:bench > reports/rc-validation/rc/benchmark-results.txt

# Compare against baseline
diff reports/rc-validation/baseline/benchmark-results.txt \
     reports/rc-validation/rc/benchmark-results.txt \
     > reports/rc-validation/performance-diff.txt
```

**Performance Regression Thresholds**:
- 🔴 **Critical**: >50% performance degradation
- 🟡 **Warning**: 20-50% degradation
- ✅ **Acceptable**: <20% variation

## Days 8-9: Breaking Change Analysis (November 21-22)

### Identify Breaking Changes

Review all failures and categorize:

#### Breaking Changes Template
```markdown
# Breaking Change: [Description]

**Category**: API Change | Type Change | Behavior Change | Removal
**Severity**: Critical | High | Medium | Low
**Impact**: [Describe what breaks]
**Affected Components**: [List CortexDx modules]

## Current Behavior (v1.22.0)
[Describe current implementation]

## RC Behavior
[Describe new behavior]

## Required Migration
[Describe code changes needed]

## Estimated Effort
[Hours/Days to fix]

## Workaround (if any)
[Temporary solution]
```

### Migration Strategy

For each breaking change:

1. **Document**: Capture full details in `reports/rc-validation/breaking-changes/`
2. **Assess**: Determine criticality and migration complexity
3. **Plan**: Create migration tasks with time estimates
4. **Prototype**: Test migration approach in isolated branch
5. **Review**: Team review of migration strategy

## Days 10-11: Documentation & Final Validation (November 23-24)

### Update Documentation

#### Files to Update

```bash
# Update version references
grep -r "v2024-11-05" docs/ packages/ | \
  tee reports/rc-validation/version-references.txt

# Update CHANGELOG
# Add RC validation results to CHANGELOG.md [Unreleased] section

# Update MCP_SPEC_MIGRATION.md
# Document RC findings, breaking changes, migration plan

# Update README.md
# Update SDK version badge, spec compliance status
```

### Create Migration Guide

```markdown
# docs/MCP_RC_MIGRATION_GUIDE.md

## Summary
[Overview of changes from v1.22.0 to RC]

## Breaking Changes
[List all breaking changes with migration steps]

## New Features
[List new MCP features supported in RC]

## Deprecated Features
[List deprecated features with sunset timeline]

## Migration Steps
1. [Step-by-step migration instructions]
2. ...

## Testing Checklist
- [ ] [Validation steps for migration]

## Rollback Plan
[How to rollback if issues occur]
```

### Final Validation Run

> **Note:** The automation script `./scripts/rc-validation/final-validation.sh` referenced in planning does **not** yet exist. The following commands should be run manually until the script is implemented. This section is a placeholder for future automation.
```bash
# Complete end-to-end validation
pnpm build           # Full build
pnpm test            # All test suites
pnpm run self-diagnose   # Self-diagnostics (if available)
pnpm run benchmark   # Performance benchmarks (if available)
pnpm run security-scan   # Security scans (if available)
pnpm run docs        # Documentation generation

# If any of the above commands are not available, refer to the README for manual steps.
```

## RC Validation Report Template

### Executive Summary
- **RC Version**: [X.Y.Z-rc.N]
- **Validation Period**: November 14-24, 2025
- **Overall Status**: ✅ Pass | 🟡 Pass with Changes | 🔴 Fail

### Compatibility Matrix

| Component | Status | Notes |
|-----------|--------|-------|
| Build | ✅ | No issues |
| Unit Tests | ✅ | 100% pass |
| Integration Tests | 🟡 | 2 failures (non-critical) |
| Protocol Compliance | ✅ | All checks pass |
| Authentication | ✅ | No issues |
| Async Operations | ✅ | Checkpoint/resume validated |
| Streaming | ✅ | SSE/WebSocket working |
| Performance | 🟡 | 15% slower (acceptable) |

### Breaking Changes
- [List with severity and migration status]

### New Features Validated
- [List new MCP features tested]

### Known Issues
- [List any unresolved issues]

### Recommendation
**Proceed** | **Proceed with Caution** | **Do Not Upgrade**

[Justification]

### Next Steps
1. [Action items for final spec release]

---

**Validation Lead**: [Name]
**Report Date**: November 24, 2025

## Post-Validation Actions

### If RC Passes (✅)
1. Merge `rc-validation` branch to `main`
2. Update CHANGELOG with RC findings
3. Prepare for final spec release (Nov 25)
4. Monitor community for any late-breaking RC issues

### If RC Fails (🔴)
1. Document critical blockers
2. File issues with MCP spec repository
3. Engage with MCP community for guidance
4. Plan workarounds for final release
5. Re-evaluate timeline for CortexDx release

### If RC Needs Changes (🟡)
1. Implement required migrations
2. Test migrations thoroughly
3. Document breaking changes for users
4. Prepare migration guide
5. Plan staged rollout for final spec

## Communication Plan

### Internal Updates
- **Daily**: Team standup with RC validation status
- **Critical Issues**: Immediate Slack notification
- **End of Day**: Summary email to stakeholders

### External Communication
- **Day 1**: "RC validation in progress" GitHub issue
- **Day 5**: Interim findings published
- **Day 11**: Final RC validation report published
- **Post-Final Spec**: Blog post on CortexDx MCP compliance

## Rollback Strategy

If critical issues discovered:

```bash
# Revert to baseline SDK
git checkout main
git branch -D rc-validation-nov-2025

# Reinstall baseline SDK
pnpm --filter @brainwav/cortexdx add @modelcontextprotocol/sdk@1.22.0

# Validate rollback
pnpm build && pnpm test
```

## Success Criteria

RC validation considered successful when:

1. ✅ All critical tests pass (build, unit, integration)
2. ✅ No critical breaking changes without migration path
3. ✅ Async operations validated (checkpoint/resume working)
4. ✅ OAuth flows validated (Auth0 integration working)
5. ✅ Performance within acceptable thresholds (<20% degradation)
6. ✅ Documentation updated with findings
7. ✅ Migration guide prepared (if needed)
8. ✅ Team consensus on go/no-go for final spec

---

**Document Owner**: CortexDx Engineering Team
**Review Frequency**: Daily during validation window
**Next Update**: November 14, 2025 (RC Release Day)
