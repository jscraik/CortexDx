---
applyTo: "**/adapters/**/*.ts"
---

# Adapter Development Instructions

When working with CortexDx adapters, follow these conventions:

## Adapter Types

CortexDx supports multiple protocol adapters:
- **HTTP** - Standard HTTP/HTTPS requests
- **SSE** - Server-Sent Events streaming
- **WebSocket** - Bidirectional communication
- **JSON-RPC** - Batch and notification support
- **gRPC** - Optional gRPC shim

## Required Conventions

- **Named exports only** - Never use `export default`
- **≤40 lines per function** - Split larger functions into helpers
- **No `any` types** - Use explicit types or type guards
- **ESM imports with `.js` extension** - Always use `from "./foo.js"`

## Statelessness

All adapters must be stateless and read-only:
- No writes to target servers
- No destructive actions
- No persistence beyond local artifacts (`reports/`, HAR)

## HAR Redaction

When generating HAR files, always redact sensitive headers:
- `authorization`
- `cookie`
- `token`
- API keys

## Session Management

For MCP sessions:
- Generate session ID: `cortexdx-<timestamp>` or UUID
- Include `MCP-Session-ID` header in all JSON-RPC requests
- Reuse session ID for all requests in a diagnostic run
- Include session ID in SSE probes

## Error Handling

Implement robust error handling:
```typescript
try {
  const response = await makeRequest(options);
  return processResponse(response);
} catch (error) {
  if (error instanceof TimeoutError) {
    return { ok: false, reason: 'Request timed out' };
  }
  throw error;
}
```

## Observability

Use the `withSpan` helper for long-running probes:
- Tag spans with endpoint, suite, severity, confidence
- Include durations and versions
- Follow OpenTelemetry conventions

## Proxy Support

Streaming probes must honor proxy settings:
- Implement retry semantics
- Handle ID semantics properly
- Support configurable timeouts
