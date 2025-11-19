# MCP Diagnostic Envelope

TAP/JUnit-style test envelope for MCP diagnostics with signed URL evidence support.

## Overview

The diagnostic envelope provides a structured, standardized format for MCP diagnostic results that is:

- **Agent-friendly**: Stable schema optimized for LLM consumption and diffing
- **Evidence-rich**: Supports presigned URLs for logs, traces, HTTP captures, diffs, and more
- **Test-oriented**: Native pass/fail/skip/error status tracking with timing metrics
- **Hierarchical**: Organize assertions into test cases for better structure
- **Actionable**: Includes remediation patches and commands for failed assertions

## Quick Start

### Basic Usage

```typescript
import { RunCollector, AssertionEmitter } from './index.js';

// Create a run collector
const collector = new RunCollector(
  'cortex-dx@1.4.0',
  'MCP 2025-06-18',
  { target_mcp_url: 'http://localhost:8777' }
);

// Build a test case with assertions
const handshakeCase = collector.buildCase(
  'handshake',
  'MCP Handshake',
  [
    // Passing assertion
    {
      id: 'hs-001',
      title: 'Server returns capabilities on initialize',
      status: 'pass',
      duration_ms: 142
    },
    // Failing assertion with remediation
    {
      id: 'hs-002',
      title: 'Rejects unknown method',
      status: 'fail',
      severity: 'medium',
      message: 'Server responded 200 with empty result instead of error',
      remediation: {
        summary: 'Return JSON-RPC error -32601 for unknown methods',
        patch_unified: `--- a/server/rpc.ts
+++ b/server/rpc.ts
@@ -9,7 +9,7 @@
 function handleRpc(id, method) {
-   return { id, result: null }
+   return { id, error: { code: -32601, message: 'Method not found' } }
 }`,
        commands: ['pnpm -w test:rpc:unknown']
      },
      tags: ['jsonrpc', 'error-handling']
    }
  ],
  ['protocol', 'required']
);

collector.addCase(handshakeCase);

// Build the envelope
const envelope = collector.build();

console.log(JSON.stringify(envelope, null, 2));
```

### Using AssertionEmitter

For complex assertions with evidence, use `AssertionEmitter`:

```typescript
import { AssertionEmitter, RunCollector } from '@cortexdx/envelope';
import { createCloudStorageFromEnv } from '@cortexdx/adapters';

// Setup
const cloudStorage = createCloudStorageFromEnv();
const collector = new RunCollector(
  'cortex-dx@1.4.0',
  'MCP 2025-06-18',
  { target: 'localhost:8777' },
  cloudStorage
);

const runId = collector.getRunId();
const caseId = 'protocol-validation';

// Build assertion with evidence
const emitter = AssertionEmitter.fail(
  'pv-001',
  'Invalid JSON-RPC response format',
  runId,
  caseId,
  'high',
  'Response missing required "jsonrpc" field',
  cloudStorage
);

// Add log evidence (uploads to cloud storage)
await emitter.addLog(JSON.stringify({
  request: { jsonrpc: '2.0', method: 'initialize', id: 1 },
  response: { id: 1, result: {} }  // Missing "jsonrpc" field
}));

// Add diff evidence
await emitter.addDiff(`--- expected
+++ actual
@@ -1,4 +1,3 @@
 {
-  "jsonrpc": "2.0",
   "id": 1,
   "result": {}`);

// Add remediation
emitter.remediation({
  summary: 'Add "jsonrpc": "2.0" to all responses',
  commands: ['npm test protocol']
});

// Build and add to case
const assertion = emitter.build();

const testCase = collector.buildCase(
  caseId,
  'Protocol Validation',
  [assertion]
);

collector.addCase(testCase);

// Build envelope and upload
const envelope = collector.build();
const envelopeUrl = await collector.uploadEnvelope();

console.log(`Envelope uploaded: ${envelopeUrl}`);
```

## Evidence Types

The envelope supports multiple evidence kinds:

| Kind | Description | Content Type |
|------|-------------|--------------|
| `log` | Log files (JSON, text) | `application/json`, `text/plain` |
| `trace` | JSON-RPC message traces | `application/json` |
| `http` | HTTP captures (HAR format) | `application/json` |
| `screenshot` | Visual evidence | `image/png`, `image/jpeg` |
| `diff` | Unified diff patches | `text/x-diff` |
| `artifact` | Generic artifacts | `application/octet-stream` |

### Evidence Storage

Evidence is automatically uploaded to cloud storage (R2, S3, GCS) with presigned URLs:

```typescript
// Evidence stored at:
// bucket/reports/runs/{run_id}/{case_id}/{assertion_id}/{artifact_name}

const evidence = await cloudStorage.uploadEvidence(
  runId,
  'handshake',
  'hs-001',
  'trace.json',
  JSON.stringify(traceData),
  'trace'
);

// Returns:
{
  kind: 'trace',
  url: 'https://r2.example.com/...?sig=...',
  sha256: '9b1c...ef',
  content_type: 'application/json',
  expires_at: '2025-11-16T12:00:00Z'
}
```

## Cloud Storage Setup

### Cloudflare R2 (Recommended)

```bash
export CORTEXDX_CLOUD_PROVIDER=r2
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export R2_BUCKET_NAME=cortexdx-reports
export R2_ACCESS_KEY_ID=your-access-key
export R2_SECRET_ACCESS_KEY=your-secret-key
export CORTEXDX_REPORT_TTL_SECONDS=900  # 15 minutes
```

### AWS S3

```bash
export CORTEXDX_CLOUD_PROVIDER=s3
export CORTEXDX_CLOUD_BUCKET=cortexdx-reports
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Google Cloud Storage

```bash
export CORTEXDX_CLOUD_PROVIDER=gcs
export CORTEXDX_CLOUD_BUCKET=cortexdx-reports
export R2_ACCESS_KEY_ID=your-hmac-key
export R2_SECRET_ACCESS_KEY=your-hmac-secret
```

## Validation

All envelopes are validated against the JSON schema:

```typescript
import { validateEnvelope, formatValidationErrors } from '@cortexdx/envelope';

const result = validateEnvelope(envelope);

if (!result.success) {
  const errors = formatValidationErrors(result.errors!);
  console.error('Validation failed:', errors);
}
```

## Run Summary

The envelope automatically calculates summary statistics:

```typescript
const collector = new RunCollector('cortex-dx@1.4.0');

// Add cases...

const summary = collector.getSummary();
// {
//   total: 15,
//   passed: 12,
//   failed: 2,
//   skipped: 1,
//   errored: 0,
//   duration_ms: 8542
// }

// Check for issues
if (collector.hasFailures()) {
  const failed = collector.getFailedAssertions();
  console.log(`${failed.length} assertions failed`);
}
```

## Diffing Envelopes

Compare two diagnostic runs:

```bash
# Get summary diff
jq '.summary' run_A.json run_B.json

# Compare specific assertions
jq '.cases[0].assertions[] | select(.status == "fail")' run_A.json run_B.json

# Check for improvements
diff <(jq -S '.summary' run_A.json) <(jq -S '.summary' run_B.json)
```

## Schema Version

Current schema version: **1.0.0**

The version follows semver:
- Major: Breaking schema changes
- Minor: Backward-compatible additions
- Patch: Documentation or validation fixes

## Integration with Existing CortexDx

The envelope system works alongside existing diagnostic reports:

```typescript
import { DiagnosticReport } from '@cortexdx/types';
import { RunCollector } from '@cortexdx/envelope';

// Transform existing findings to envelope format
function transformToEnvelope(report: DiagnosticReport): DxEnvelope {
  const collector = new RunCollector(
    `cortex-dx@${report.metadata?.version}`,
    undefined,
    report.metadata
  );

  const assertions = report.findings.map(finding => ({
    id: finding.id,
    title: finding.title,
    status: finding.severity === 'info' ? 'pass' : 'fail',
    severity: mapSeverity(finding.severity),
    message: finding.description,
    tags: finding.tags
  }));

  collector.addCase(
    collector.buildCase(
      report.sessionId,
      report.diagnosticType,
      assertions
    )
  );

  return collector.build();
}
```

## Best Practices

1. **Use meaningful IDs**: Assertion IDs should be stable across runs for diffing
2. **Tag appropriately**: Use tags like `protocol`, `security`, `performance` for filtering
3. **Include context**: Set `agent_context` with target URL, profile, config
4. **Upload evidence**: Store large artifacts in cloud storage, not inline
5. **Set severity**: Use severity levels to prioritize fixes
6. **Provide remediation**: Include patches and commands for actionable failures

## File Structure

```
packages/cortexdx/
├── schemas/
│   └── mcp-dx/
│       └── envelope.schema.json     # JSON Schema definition
├── src/
│   └── envelope/
│       ├── types.ts                 # TypeScript types
│       ├── validator.ts             # Zod validation
│       ├── assertion-emitter.ts     # Assertion builder
│       ├── run-collector.ts         # Run aggregator
│       └── index.ts                 # Exports
└── tests/
    └── envelope-schema.spec.ts      # Comprehensive tests
```

## License

Same as CortexDx parent project.
