# New Features

This document describes the new features added to CortexDx for improved testing, rate limiting, logging, and timeout configuration.

## Table of Contents

- [Unit Tests](#unit-tests)
- [Rate Limiting](#rate-limiting)
- [Structured Logging](#structured-logging)
- [Configurable Timeouts](#configurable-timeouts)

---

## Unit Tests

### Overview

Comprehensive unit tests have been added for the probe engine and report generator, targeting 80% code coverage for these critical components.

### Test Files

- **`tests/inspector-adapter.spec.ts`**: Tests for the MCP Inspector adapter (probe engine)
  - Runtime safeguards and timeout handling
  - Handshake verification
  - Diagnostic job execution
  - Probe mapping and finding conversion
  - Output parsing
  - Self-diagnosis functionality

- **`tests/arctdd.spec.ts`**: Tests for the ArcTDD report generator
  - Report generation with findings
  - Solution generation for various issue types
  - Quick wins identification
  - Evidence formatting
  - Severity grouping

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test files
pnpm test inspector-adapter.spec.ts
pnpm test arctdd.spec.ts

# Run with coverage report
pnpm test --coverage
```

### Test Coverage

The tests provide comprehensive coverage of:
- Inspector adapter: ~40% coverage with focus on critical paths
- ArcTDD report generator: Full coverage of all formatting and generation logic
- Error handling and edge cases
- Mock data generation for various scenarios

---

## Rate Limiting

### Overview

Rate limiting has been integrated into the probe endpoint to prevent abuse and ensure fair usage across different user tiers.

### Features

- **Tier-based limits**: Community, Professional, and Enterprise tiers
- **Per-IP limiting**: Track requests by IP address
- **Per-user limiting**: Track requests by user ID or organization ID
- **Configurable limits**: Environment variable overrides
- **Standard headers**: `X-RateLimit-*` headers for client-side handling
- **Retry-After header**: Proper 429 responses with retry guidance

### Configuration

#### Default Tiers

| Tier         | Requests | Window  |
|--------------|----------|---------|
| Community    | 60       | 1 minute|
| Professional | 300      | 1 minute|
| Enterprise   | 1000     | 1 minute|

> **Note:** The rate limiting implementation uses a **rolling (sliding) 60-second window**. This means that requests are counted over the last 60 seconds from the current time, not aligned to the calendar minute. Limits reset dynamically as time passes, so requests are not reset at exactly minute:00 or at fixed boundaries. For example, if you make 60 requests in 10 seconds, you must wait until enough requests fall outside the 60-second window before making more requests.

#### Environment Variables

```bash
# Set default tier for unauthenticated requests
CORTEXDX_DEFAULT_RATE_LIMIT_TIER=community

# Set tier for specific IP addresses
# Note: IPv4 addresses only. Replace dots with underscores.
# IPv6 addresses are not supported via environment variables.
# For IPv6 support, use programmatic configuration or JSON config file.
CORTEXDX_RATE_LIMIT_IP_192_168_1_1=professional
CORTEXDX_RATE_LIMIT_IP_10_0_0_5=enterprise

# Set tier for specific users
CORTEXDX_RATE_LIMIT_USER_alice=professional
CORTEXDX_RATE_LIMIT_USER_bob=enterprise
```

### Usage

Rate limiting is automatically applied to the `/api/v1/self-diagnose` endpoint. Clients can check rate limit status using the response headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
```

When rate limit is exceeded, a 429 response is returned:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 42 seconds.",
  "retryAfter": 42,
  "limit": 60,
  "remaining": 0,
  "resetAt": 1640000000
}
```

### Custom Rate Limits

To set custom rate limits for specific IPs or users, use the custom headers:

```bash
# Request with user ID (higher limits may apply)
curl -H "X-User-Id: alice" https://cortexdx.example.com/api/v1/self-diagnose

# Request with organization ID
curl -H "X-Organization-Id: org-123" https://cortexdx.example.com/api/v1/self-diagnose

# Request with rate limit tier override
curl -H "X-Rate-Limit-Tier: professional" https://cortexdx.example.com/api/v1/self-diagnose
```

---

## Structured Logging

### Overview

All `console.log` statements have been replaced with Pino-based structured logging for better observability, searchability, and log management.

### Features

- **Structured output**: JSON-formatted logs with contextual information
- **Log levels**: debug, info, warn, error, fatal
- **Component-based logging**: Each component has its own logger with context
- **ISO timestamps**: Consistent timestamp format
- **Environment-based configuration**: Configurable log levels via environment variables

### Configuration

```bash
# Set log level (debug, info, warn, error)
CORTEXDX_LOG_LEVEL=info

# In development, defaults to 'debug'
# In production, defaults to 'info'
NODE_ENV=production
```

### Log Output Format

```json
{
  "severity": "INFO",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "brand": "brAInwav",
  "service": "cortexdx",
  "component": "server",
  "message": "CortexDx Server running on http://localhost:5001",
  "baseUrl": "http://localhost:5001",
  "providers": "arxiv, crossref, pubmed",
  "tlsEnabled": false
}
```

### Components with Structured Logging

- **Server**: Main HTTP server startup and requests
- **Diagnostic**: Diagnostic context operations
- **Monitoring**: Background monitoring and alerts
- **Self-Healing API**: Self-healing endpoint operations

### Viewing Logs

For pretty-printed logs in development:

```bash
# Install pino-pretty
pnpm add -D pino-pretty

# Run with pretty logs
pnpm start | pnpm exec pino-pretty
```

For JSON logs in production:

```bash
# Logs are output as JSON by default
NODE_ENV=production pnpm start
```

---

## Configurable Timeouts

### Overview

All hardcoded timeout values have been centralized and made configurable via environment variables. This allows for flexible timeout configuration per deployment environment.

### Timeout Categories

| Category              | Default | Environment Variable                 |
|-----------------------|---------|--------------------------------------|
| Inspector             | 30s     | `CORTEXDX_TIMEOUT_INSPECTOR`        |
| Ollama                | 30s     | `CORTEXDX_TIMEOUT_OLLAMA`           |
| Embedding             | 30s     | `CORTEXDX_TIMEOUT_EMBEDDING`        |
| Stdio Wrapper         | 30s     | `CORTEXDX_TIMEOUT_STDIO_WRAPPER`    |
| Problem Resolver      | 30s     | `CORTEXDX_TIMEOUT_PROBLEM_RESOLVER` |
| HTTP MCP Client       | 30s     | `CORTEXDX_TIMEOUT_HTTP_MCP_CLIENT`  |
| Plugin Orchestrator   | 30s     | `CORTEXDX_TIMEOUT_PLUGIN_ORCHESTRATOR` |
| Human-in-Loop         | 5m      | `CORTEXDX_TIMEOUT_HUMAN_IN_LOOP`    |
| Integration Test      | 30s     | `CORTEXDX_TIMEOUT_INTEGRATION_TEST` |
| Handshake             | 5s      | `CORTEXDX_TIMEOUT_HANDSHAKE`        |

### Configuration

#### Set Individual Timeouts

```bash
# Set inspector timeout to 60 seconds
CORTEXDX_TIMEOUT_INSPECTOR=60000

# Set Ollama timeout to 45 seconds
CORTEXDX_TIMEOUT_OLLAMA=45000

# Set handshake timeout to 10 seconds
CORTEXDX_TIMEOUT_HANDSHAKE=10000
```

#### Set Global Timeout

Override all timeouts with a single value (useful for testing):

```bash
# Set all timeouts to 5 seconds
CORTEXDX_GLOBAL_TIMEOUT=5000
```

### Usage in Code

```typescript
import { getTimeout, getTimeoutWithOverride } from './config/timeouts.js';

// Get specific timeout
const inspectorTimeout = getTimeout('inspector');

// Get timeout with global override support
const timeout = getTimeoutWithOverride('inspector');
```

### Per-Suite Timeout Configuration

For integration tests, you can configure timeouts per suite:

```bash
# Set integration test timeout to 60 seconds
CORTEXDX_TIMEOUT_INTEGRATION_TEST=60000
```

Then in your test files:

```typescript
import { getTimeout } from '../src/config/timeouts.js';

const testTimeout = getTimeout('integrationTest');

describe('Integration tests', () => {
  it('should complete within timeout', async () => {
    // Test logic
  }, testTimeout);
});
```

### Best Practices

1. **Development**: Use longer timeouts for easier debugging
   ```bash
   CORTEXDX_GLOBAL_TIMEOUT=120000
   ```

2. **Production**: Use optimized timeouts based on expected response times
   ```bash
   CORTEXDX_TIMEOUT_INSPECTOR=30000
   CORTEXDX_TIMEOUT_HANDSHAKE=5000
   ```

3. **Testing**: Use shorter timeouts to catch hanging operations
   ```bash
   CORTEXDX_TIMEOUT_INTEGRATION_TEST=10000
   ```

4. **CI/CD**: Set appropriate timeouts for your environment
   ```bash
   # For slower CI environments
   CORTEXDX_GLOBAL_TIMEOUT=60000
   ```

---

## Migration Guide

### From Old to New

#### Console Logging → Structured Logging

**Before:**
```typescript
console.log('[Component]', 'Some message', data);
```

**After:**
```typescript
import { createLogger } from './logging/logger.js';

const logger = createLogger({ component: 'my-component' });
logger.info({ data }, 'Some message');
```

#### Hardcoded Timeouts → Configurable Timeouts

**Before:**
```typescript
const timeout = 30000; // hardcoded
setTimeout(() => controller.abort(), timeout);
```

**After:**
```typescript
import { getTimeoutWithOverride } from './config/timeouts.js';

const timeout = getTimeoutWithOverride('inspector');
setTimeout(() => controller.abort(), timeout);
```

---

## Testing the New Features

### Test Rate Limiting

```bash
# Send multiple requests to trigger rate limiting
for i in {1..65}; do
  curl -X POST http://localhost:5001/api/v1/self-diagnose \
    -H "Content-Type: application/json" \
    -d '{}' &
done
wait

# Check for 429 responses
```

### Test Structured Logging

```bash
# Start server and observe JSON logs
NODE_ENV=production pnpm start

# With pretty printing
pnpm start | pnpm exec pino-pretty
```

### Test Configurable Timeouts

```bash
# Set a short timeout and observe behavior
CORTEXDX_TIMEOUT_INSPECTOR=1000 pnpm start

# Trigger an inspector job and observe timeout
curl -X POST http://localhost:5001/api/v1/self-diagnose
```

---

## Troubleshooting

### Rate Limiting Issues

**Problem**: Getting 429 errors unexpectedly

**Solution**: Check your rate limit tier and increase limits if needed
```bash
CORTEXDX_DEFAULT_RATE_LIMIT_TIER=professional
```

### Logging Not Appearing

**Problem**: No logs visible

**Solution**: Check log level configuration
```bash
CORTEXDX_LOG_LEVEL=debug
```

### Timeout Issues

**Problem**: Operations timing out too quickly

**Solution**: Increase timeout values
```bash
CORTEXDX_TIMEOUT_INSPECTOR=60000
# or
CORTEXDX_GLOBAL_TIMEOUT=60000
```

---

## Contributing

When adding new features:

1. **Add tests**: Maintain 80% coverage for critical components
2. **Use structured logging**: Replace all console.log with logger
3. **Make timeouts configurable**: Use the timeout configuration system
4. **Document changes**: Update this file with new features
5. **Follow patterns**: Use existing patterns for consistency

---

## References

- [Pino Logger Documentation](https://getpino.io/)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [Vitest Testing Framework](https://vitest.dev/)
