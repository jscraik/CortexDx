#!/bin/bash
# MCP RC Validation Quick Start
# Run this script to begin RC validation testing (Nov 16, 2025)


echo "🚀 MCP RC Validation Quick Start"
echo "================================="
echo "Date: $(date)"
echo "SDK Version: v1.22.0 (published Nov 13, 2025)"
echo ""

# Create validation directories
echo "📁 Creating validation directories..."
mkdir -p reports/rc-validation/{baseline,rc}

# Check current SDK version
echo ""
echo "📦 Checking SDK version..."
npm list @modelcontextprotocol/sdk | grep @modelcontextprotocol/sdk

echo ""
echo "🔨 Phase 1: Build & Test (20-30 minutes)"
echo "========================================"

# Build
echo ""
echo "Building project..."
pnpm build 2>&1 | tee reports/rc-validation/rc/build-$(date -u +%Y%m%d).log
BUILD_STATUS=$?

if [ $BUILD_STATUS -eq 0 ]; then
  echo "✅ Build successful"
else
  echo "❌ Build failed - see reports/rc-validation/rc/build-$(date -u +%Y%m%d).log"
  exit 1
fi

# Run tests
echo ""
echo "Running test suite..."
pnpm test 2>&1 | tee reports/rc-validation/rc/test-$(date -u +%Y%m%d).log
TEST_STATUS=$?

if [ $TEST_STATUS -eq 0 ]; then
  echo "✅ Tests passed"
else
  echo "⚠️  Tests failed - see reports/rc-validation/rc/test-$(date -u +%Y%m%d).log"
  echo "   (Non-critical - continuing with diagnostics)"
fi

echo ""
echo "🔍 Phase 2: Quick Smoke Test (5-10 minutes)"
echo "==========================================="

# Quick diagnostic
echo ""
echo "Running connectivity smoke test..."
cortexdx diagnose https://cortex-mcp.brainwav.io/mcp \
  --suites connectivity \
  --out reports/rc-validation/rc/smoke-test

SMOKE_STATUS=$?

if [ $SMOKE_STATUS -eq 0 ]; then
  echo "✅ Smoke test passed"
else
  echo "❌ Smoke test failed"
  echo "   This may indicate breaking changes in v1.22.0"
fi

echo ""
echo "📊 Phase 1 Results Summary"
echo "========================="
echo "Build: $([ $BUILD_STATUS -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "Tests: $([ $TEST_STATUS -eq 0 ] && echo '✅ PASS' || echo '⚠️  FAIL (review logs)')"
echo "Smoke: $([ $SMOKE_STATUS -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo ""
echo "Results saved to: reports/rc-validation/rc/"
echo ""

if [ $BUILD_STATUS -eq 0 ] && [ $SMOKE_STATUS -eq 0 ]; then
  echo "✅ Phase 1 Complete - Ready for comprehensive testing"
  echo ""
  echo "Next Steps:"
  echo "1. Run self-diagnostics: pnpm self:diagnose"
  echo "2. Run full diagnostic: cortexdx diagnose <endpoint> --deterministic --full"
  echo "3. Test async operations: cortexdx orchestrate <endpoint> --workflow agent.langgraph.baseline"
  echo ""
  echo "See docs/MCP_SPEC_MIGRATION.md for detailed validation plan"
else
  echo "⚠️  Phase 1 Issues Detected"
  echo ""
  echo "Action Required:"
  echo "1. Review build logs: reports/rc-validation/rc/build-$(date +%Y%m%d).log"
  echo "2. Review test logs: reports/rc-validation/rc/test-$(date +%Y%m%d).log"
  echo "3. Review smoke test: reports/rc-validation/rc/smoke-test/"
  echo "4. Document issues in reports/rc-validation/day1-issues.md"
  echo "5. Escalate critical failures to team"
fi

echo ""
echo "Validation start time: $(date)" > reports/rc-validation/validation-log.txt
echo "SDK version: v1.22.0" >> reports/rc-validation/validation-log.txt
echo "Build status: $BUILD_STATUS" >> reports/rc-validation/validation-log.txt
echo "Test status: $TEST_STATUS" >> reports/rc-validation/validation-log.txt
echo "Smoke status: $SMOKE_STATUS" >> reports/rc-validation/validation-log.txt
