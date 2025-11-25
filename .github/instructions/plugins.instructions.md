---
applyTo: "**/plugins/**/*.ts"
---

# Plugin Development Instructions

When working with CortexDx plugins, follow these conventions:

## Plugin Structure

Every plugin must implement the `DiagnosticPlugin` interface:

```typescript
export const myPlugin: DiagnosticPlugin = {
  id: 'unique-plugin-id',
  title: 'Human Readable Name',
  order: 100,  // Execution order (lower runs first)
  
  async run(ctx: DiagnosticContext): Promise<Finding[]> {
    // Implementation
  }
};
```

## Required Conventions

- **Named exports only** - Never use `export default`
- **≤40 lines per function** - Split larger functions into helpers
- **No `any` types** - Use explicit types or type guards
- **ESM imports with `.js` extension** - Always use `from "./foo.js"` not `from "./foo"`

## Finding Requirements

Every finding must include:
- `id` - Unique identifier (e.g., "security.xss.input")
- `area` - Diagnostic area ("protocol", "security", "performance", "governance")
- `severity` - One of: "info", "minor", "major", "blocker"
- `title` - Short description
- `description` - Detailed explanation
- `evidence` - Array of evidence pointers (REQUIRED - never empty)
- `confidence` - Score from 0.0 to 1.0 (optional but recommended)

## Evidence Pointers

Always include at least one evidence pointer:
```typescript
evidence: [
  { type: 'url', ref: ctx.endpoint },
  { type: 'file', ref: 'path/to/file.ts', lines: [10, 20] },
  { type: 'log', ref: 'PluginName' }
]
```

## Context API Usage

Use the diagnostic context for all interactions:
```typescript
await ctx.jsonrpc('tools/list');           // JSON-RPC calls
await ctx.request('/health');              // HTTP requests
await ctx.sseProbe('/sse-endpoint');       // SSE testing
ctx.evidence('key', data);                 // Store evidence
ctx.logger('message', metadata);           // Structured logging
```

## Sandbox Constraints

Plugins run in worker threads with budgets:
- No direct filesystem access (`fs`, `child_process`)
- No raw network modules (`net`)
- Memory budget: 32MB+
- Respect time limits

## Error Handling

Always wrap plugin logic in try-catch:
```typescript
try {
  const result = await ctx.jsonrpc('tools/list');
  // Process result
} catch (error) {
  findings.push({
    id: 'plugin-id.error',
    area: 'plugin-area',
    severity: 'major',
    title: 'Plugin execution failed',
    description: error instanceof Error ? error.message : String(error),
    evidence: [{ type: 'log', ref: 'PluginName' }]
  });
}
```
