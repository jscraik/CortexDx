---
applyTo: "**/tests/**/*.{ts,spec.ts}"
---

# Test Development Instructions

When writing or modifying tests for CortexDx, follow these conventions:

## Testing Framework

CortexDx uses **Vitest** for all testing. Import from vitest:
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
```

## Test Structure

Follow the describe/it pattern:
```typescript
describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should handle specific case', () => {
    expect(actualResult).toEqual(expectedResult);
  });

  it('should handle edge case', () => {
    expect(edgeCaseResult).toBeTruthy();
  });
});
```

## ArcTDD Methodology

Follow Red → Green → Refactor:
1. Write failing test first
2. Implement minimal code to pass
3. Refactor while keeping tests green
4. Each arc should be ≤7 steps

## Mock Patterns

Create mock contexts for plugin testing:
```typescript
const createMockContext = (): DiagnosticContext => ({
  endpoint: 'http://localhost:3000',
  headers: {},
  logger: () => {},
  request: async () => ({}),
  jsonrpc: async () => ({ tools: [] }),
  sseProbe: async () => ({ ok: true }),
  evidence: () => {},
  deterministic: true,
});
```

## Determinism

Tests must be deterministic:
- Use `deterministic: true` in test contexts
- Mock time-dependent operations
- Use fixed seeds for random operations
- Avoid real network calls (use mocks)

## Required Conventions

- **Named exports only** - No `export default`
- **ESM imports with `.js` extension** - `from "./module.js"`
- **No `any` types** - Use explicit types
- **Descriptive test names** - Start with "should"

## Test Files Location

Place tests in `packages/cortexdx/tests/`:
- Unit tests: `feature.spec.ts`
- Integration tests: `tests/integration/`
- Plugin tests: `tests/plugins/`

## Mock Servers

Use mock servers from `scripts/mock-servers/` for integration tests:
```typescript
const mockCtx = createDiagnosticContext({
  endpoint: 'http://localhost:mock-port',
  deterministic: true
});
```

## Running Tests

```bash
pnpm test              # Run all tests (includes build)
pnpm test:integration  # Integration tests (CORTEXDX_RUN_INTEGRATION=1)
```

## Evidence in Tests

When testing plugins, verify evidence pointers:
```typescript
it('should include evidence in findings', async () => {
  const ctx = createMockContext();
  const findings = await MyPlugin.run(ctx);
  expect(findings.every((f) => f.evidence.length > 0)).toBe(true);
});
```
