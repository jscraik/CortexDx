# Plugin Development Guide

This guide explains how to develop custom diagnostic plugins for CortexDx.

## Table of Contents

- [Overview](#overview)
- [Plugin Architecture](#plugin-architecture)
- [Creating a Basic Plugin](#creating-a-basic-plugin)
- [Plugin Types](#plugin-types)
- [DiagnosticContext API](#diagnosticcontext-api)
- [Finding Structure](#finding-structure)
- [Best Practices](#best-practices)
- [Testing Plugins](#testing-plugins)
- [Plugin Registration](#plugin-registration)
- [Advanced Features](#advanced-features)
- [Examples](#examples)

---

## Overview

CortexDx uses a **plugin-first architecture** where diagnostic capabilities are implemented as independent, composable plugins. Each plugin:

- Analyzes a specific aspect of an MCP server (e.g., protocol compliance, security, performance)
- Returns structured findings with severity levels and evidence
- Runs independently with access to a diagnostic context
- Can be orchestrated in workflows using LangGraph

### Plugin Benefits

- **Modularity**: Each plugin focuses on a single responsibility
- **Reusability**: Plugins can be shared across projects
- **Composability**: Combine plugins to create comprehensive diagnostic workflows
- **Testability**: Each plugin can be unit tested independently
- **Extensibility**: Add new diagnostic capabilities without modifying core code

---

## Plugin Architecture

### DiagnosticPlugin Interface

Every plugin implements the `DiagnosticPlugin` interface:

```typescript
interface DiagnosticPlugin {
  /** Unique identifier (e.g., "discovery", "security-scanner") */
  id: string;

  /** Human-readable title */
  title: string;

  /** Execution order (lower numbers run first) */
  order: number;

  /** Optional: Plugin category for organization */
  category?: 'core' | 'security' | 'performance' | 'development';

  /** Optional: Plugin version */
  version?: string;

  /** Main plugin execution function */
  run: (ctx: DiagnosticContext) => Promise<Finding[]>;

  /** Optional: Plugin initialization hook */
  initialize?: (config?: Record<string, unknown>) => Promise<void>;

  /** Optional: Plugin cleanup hook */
  cleanup?: () => Promise<void>;
}
```

### Plugin Lifecycle

1. **Registration**: Plugin is registered in the plugin registry
2. **Initialization**: `initialize()` is called with configuration (if provided)
3. **Execution**: `run(ctx)` is called with diagnostic context
4. **Cleanup**: `cleanup()` is called after execution (if provided)

---

## Creating a Basic Plugin

### Minimal Plugin Example

```typescript
import type { DiagnosticPlugin, Finding } from '../types.js';

export const MyPlugin: DiagnosticPlugin = {
  id: 'my-plugin',
  title: 'My Custom Plugin',
  order: 200,

  async run(ctx) {
    const findings: Finding[] = [];

    try {
      // Perform diagnostic checks
      const result = await ctx.jsonrpc('tools/list');

      if (result?.tools?.length > 0) {
        findings.push({
          id: 'my-plugin.success',
          area: 'custom',
          severity: 'info',
          title: 'Check passed',
          description: `Found ${result.tools.length} tools`,
          evidence: [{ type: 'url', ref: ctx.endpoint }],
        });
      } else {
        findings.push({
          id: 'my-plugin.warning',
          area: 'custom',
          severity: 'minor',
          title: 'No tools found',
          description: 'Server reported no available tools',
          evidence: [{ type: 'url', ref: ctx.endpoint }],
        });
      }
    } catch (error) {
      findings.push({
        id: 'my-plugin.error',
        area: 'custom',
        severity: 'major',
        title: 'Plugin execution failed',
        description: error instanceof Error ? error.message : String(error),
        evidence: [{ type: 'log', ref: 'MyPlugin' }],
      });
    }

    return findings;
  },
};
```

---

## Plugin Types

### 1. Core Diagnostic Plugins

Analyze fundamental MCP protocol aspects.

**Examples:**
- Discovery plugin (tools/prompts/resources enumeration)
- Protocol compliance validation
- MCP version compatibility checks

### 2. Security Plugins

Identify security vulnerabilities and compliance issues.

**Examples:**
- Authentication/authorization checks
- Input validation scanning
- Secret detection
- CVE vulnerability scanning
- SBOM generation

### 3. Performance Plugins

Measure and analyze performance characteristics.

**Examples:**
- Response time measurement
- Throughput analysis
- Resource utilization monitoring
- Connection pool health

### 4. Development Plugins

Assist with MCP server development and debugging.

**Examples:**
- Code generation helpers
- Template generators
- Documentation generators
- Testing framework integration

---

## DiagnosticContext API

The `DiagnosticContext` provides utilities for interacting with the MCP server being diagnosed.

### Available Methods

```typescript
interface DiagnosticContext {
  /** MCP server endpoint URL */
  endpoint: string;

  /** Custom headers for requests */
  headers: Record<string, string>;

  /** Structured logger */
  logger: (message: string, metadata?: Record<string, unknown>) => void;

  /** Make JSON-RPC request to MCP server */
  jsonrpc: <T>(method: string, params?: unknown) => Promise<T>;

  /** Make HTTP request to endpoint */
  request: <T>(options: RequestOptions) => Promise<T>;

  /** Test SSE endpoint connection */
  sseProbe: (options?: SseProbeOptions) => Promise<SseResult>;

  /** Store evidence for findings */
  evidence: (key: string, data: unknown) => void;

  /** Deterministic mode flag */
  deterministic: boolean;

  /** Deterministic seed for reproducible results */
  deterministicSeed?: number;
}
```

### Using jsonrpc()

```typescript
async run(ctx) {
  // List tools
  const toolsResponse = await ctx.jsonrpc<{ tools: Tool[] }>('tools/list');

  // Call a specific tool
  const result = await ctx.jsonrpc('tools/call', {
    name: 'my-tool',
    arguments: { param: 'value' },
  });

  // List resources
  const resourcesResponse = await ctx.jsonrpc('resources/list');

  return findings;
}
```

### Using request()

```typescript
async run(ctx) {
  // Make custom HTTP request
  const response = await ctx.request({
    method: 'GET',
    path: '/health',
    headers: { 'Accept': 'application/json' },
  });

  return findings;
}
```

### Using sseProbe()

```typescript
async run(ctx) {
  // Test SSE connection
  const sseResult = await ctx.sseProbe({
    timeoutMs: 5000,
    headers: ctx.headers,
  });

  if (!sseResult.ok) {
    findings.push({
      id: 'sse.failure',
      area: 'connectivity',
      severity: 'major',
      title: 'SSE connection failed',
      description: sseResult.reason || 'Unknown SSE error',
      evidence: [{ type: 'url', ref: ctx.endpoint }],
    });
  }

  return findings;
}
```

---

## Finding Structure

### Finding Interface

```typescript
interface Finding {
  /** Unique finding identifier (e.g., "security.xss.input") */
  id: string;

  /** Diagnostic area (e.g., "security", "performance") */
  area: string;

  /** Severity level */
  severity: 'info' | 'minor' | 'major' | 'blocker';

  /** Short title */
  title: string;

  /** Detailed description */
  description: string;

  /** Supporting evidence */
  evidence: EvidencePointer[];

  /** Optional: Categorization tags */
  tags?: string[];

  /** Optional: Confidence score (0-1) */
  confidence?: number;

  /** Optional: Fix recommendation */
  recommendation?: string;

  /** Optional: Automated remediation */
  remediation?: {
    filePlan?: FilePlan;
    steps?: string[];
    codeSamples?: CodeSample[];
  };
}
```

### Severity Guidelines

- **info**: Informational, no action required
- **minor**: Low-impact issue, recommended to fix
- **major**: Significant issue, should be fixed
- **blocker**: Critical issue, must be fixed immediately

### Evidence Types

```typescript
type EvidencePointer =
  | { type: 'url'; ref: string }           // Link to resource
  | { type: 'file'; ref: string; lines?: [number, number] }  // File path
  | { type: 'log'; ref: string }           // Log entry reference
  | { type: 'resource'; ref: string };     // Named resource
```

### Example Findings

```typescript
// Info finding
{
  id: 'protocol.version',
  area: 'protocol',
  severity: 'info',
  title: 'MCP Protocol Version',
  description: 'Server supports MCP protocol version 1.0',
  evidence: [{ type: 'url', ref: ctx.endpoint }],
  tags: ['protocol', 'version'],
  confidence: 1.0,
}

// Security blocker
{
  id: 'security.auth.missing',
  area: 'security',
  severity: 'blocker',
  title: 'No authentication required',
  description: 'Server accepts unauthenticated requests, exposing sensitive tools',
  evidence: [{ type: 'url', ref: `${ctx.endpoint}/tools/list` }],
  tags: ['security', 'authentication'],
  confidence: 0.95,
  recommendation: 'Implement OAuth 2.0 or API key authentication',
  remediation: {
    steps: [
      'Install authentication middleware',
      'Configure auth provider',
      'Add auth checks to routes',
    ],
  },
}
```

---

## Best Practices

### 1. Error Handling

Always wrap plugin logic in try-catch blocks:

```typescript
async run(ctx) {
  const findings: Finding[] = [];

  try {
    // Plugin logic
    const result = await ctx.jsonrpc('tools/list');
    // ... process result
  } catch (error) {
    findings.push({
      id: `${this.id}.error`,
      area: this.id,
      severity: 'major',
      title: 'Plugin execution failed',
      description: error instanceof Error ? error.message : String(error),
      evidence: [{ type: 'log', ref: this.id }],
    });
  }

  return findings;
}
```

### 2. Performance Considerations

- Set reasonable timeouts for network requests
- Avoid blocking operations in the main thread
- Use `ctx.deterministic` mode for reproducible results
- Target <30s total execution time for plugins

```typescript
async run(ctx) {
  const timeout = ctx.deterministic ? 5000 : 10000;

  const result = await Promise.race([
    ctx.jsonrpc('tools/list'),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    ),
  ]);

  return findings;
}
```

### 3. Evidence Collection

Store relevant data using `ctx.evidence()`:

```typescript
async run(ctx) {
  const response = await ctx.jsonrpc('tools/list');

  // Store evidence for later review
  ctx.evidence('tools-response', response);

  findings.push({
    id: 'tools.discovered',
    area: 'discovery',
    severity: 'info',
    title: `Found ${response.tools.length} tools`,
    description: 'Tools enumerated successfully',
    evidence: [{ type: 'resource', ref: 'tools-response' }],
  });

  return findings;
}
```

### 4. Structured Logging

Use `ctx.logger()` for debugging:

```typescript
async run(ctx) {
  ctx.logger('Starting plugin execution', {
    pluginId: this.id,
    endpoint: ctx.endpoint,
  });

  // ... plugin logic

  ctx.logger('Plugin execution complete', {
    findingCount: findings.length,
    duration: Date.now() - startTime,
  });

  return findings;
}
```

### 5. Confidence Scores

Include confidence scores for findings that involve heuristics:

```typescript
// High confidence - explicit check
{
  id: 'security.https',
  // ...
  confidence: 1.0,  // 100% certain
}

// Medium confidence - heuristic check
{
  id: 'performance.slow',
  // ...
  confidence: 0.75,  // 75% confident
}

// Low confidence - educated guess
{
  id: 'code.smell',
  // ...
  confidence: 0.5,  // 50% confident
}
```

---

## Testing Plugins

### Unit Testing with Vitest

```typescript
import { describe, it, expect } from 'vitest';
import { MyPlugin } from './my-plugin.js';
import type { DiagnosticContext } from '../types.js';

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

describe('MyPlugin', () => {
  it('should return findings', async () => {
    const ctx = createMockContext();
    const findings = await MyPlugin.run(ctx);

    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    const ctx = createMockContext();
    ctx.jsonrpc = async () => {
      throw new Error('Network error');
    };

    const findings = await MyPlugin.run(ctx);

    expect(findings.some((f) => f.severity === 'major')).toBe(true);
  });

  it('should include evidence in findings', async () => {
    const ctx = createMockContext();
    const findings = await MyPlugin.run(ctx);

    expect(findings.every((f) => f.evidence.length > 0)).toBe(true);
  });
});
```

### Integration Testing

```typescript
import { runDiagnostic } from '../cli/diagnostic.js';

describe('MyPlugin Integration', () => {
  it('should work with real MCP server', async () => {
    const result = await runDiagnostic({
      endpoint: 'http://localhost:3000',
      plugins: ['my-plugin'],
    });

    expect(result.findings).toBeDefined();
  });
});
```

---

## Plugin Registration

### Adding to Plugin Registry

Create your plugin file in `src/plugins/`:

```typescript
// src/plugins/my-plugin.ts
export const MyPlugin: DiagnosticPlugin = {
  // ... plugin implementation
};
```

Register in `src/plugins/index.ts`:

```typescript
import { MyPlugin } from './my-plugin.js';

export const allPlugins: DiagnosticPlugin[] = [
  // ... existing plugins
  MyPlugin,
];
```

### Using Custom Plugin Path

```bash
# Load plugin from custom path
cortexdx diagnose http://localhost:3000 --plugin-path ./my-plugins
```

---

## Advanced Features

### 1. Plugin Initialization

Plugins can perform setup during initialization:

```typescript
export const AdvancedPlugin: DiagnosticPlugin = {
  id: 'advanced-plugin',
  title: 'Advanced Plugin',
  order: 300,

  async initialize(config) {
    // Load configuration
    this.config = config;

    // Initialize resources
    await this.loadPatterns();
  },

  async run(ctx) {
    // Use initialized resources
    const findings = await this.analyzeWithPatterns(ctx);
    return findings;
  },

  async cleanup() {
    // Clean up resources
    await this.closeConnections();
  },
};
```

### 2. Cross-Plugin Dependencies

Use plugin ordering to ensure dependencies run first:

```typescript
export const DependentPlugin: DiagnosticPlugin = {
  id: 'dependent-plugin',
  title: 'Dependent Plugin',
  order: 500,  // Runs after discovery (order: 100)

  async run(ctx) {
    // Access evidence from previous plugins
    const toolsData = ctx.evidence.get('tools-list');

    // Analyze based on previous findings
    return findings;
  },
};
```

### 3. LLM Integration

Plugins can use LLM adapters for AI-powered analysis:

```typescript
export const LlmPlugin: DiagnosticPlugin = {
  id: 'llm-analyzer',
  title: 'LLM-Powered Analyzer',
  order: 600,

  async run(ctx) {
    // Use LLM for analysis
    const code = await fetchServerCode(ctx);
    const analysis = await ctx.llm.analyzeCode(code, {
      focus: 'security',
      depth: 'comprehensive',
    });

    return convertAnalysisToFindings(analysis);
  },
};
```

### 4. Pattern Learning

Plugins can learn from feedback to improve accuracy:

```typescript
export const LearningPlugin: DiagnosticPlugin = {
  id: 'learning-plugin',
  title: 'Adaptive Learning Plugin',
  order: 700,

  async run(ctx) {
    // Retrieve learned patterns
    const patterns = await ctx.patternStorage.retrievePatternsByRank({
      minConfidence: 0.7,
      problemType: 'security',
    });

    // Apply patterns to current analysis
    const findings = await this.applyPatterns(ctx, patterns);

    return findings;
  },
};
```

---

## Examples

### Example 1: Performance Monitor Plugin

```typescript
export const PerformanceMonitorPlugin: DiagnosticPlugin = {
  id: 'performance-monitor',
  title: 'Performance Monitoring',
  order: 400,

  async run(ctx) {
    const findings: Finding[] = [];
    const startTime = Date.now();

    try {
      // Measure response time
      const response = await ctx.jsonrpc('tools/list');
      const duration = Date.now() - startTime;

      if (duration > 5000) {
        findings.push({
          id: 'perf.slow-response',
          area: 'performance',
          severity: 'major',
          title: 'Slow response time',
          description: `tools/list took ${duration}ms (threshold: 5000ms)`,
          evidence: [{ type: 'url', ref: ctx.endpoint }],
          confidence: 1.0,
          recommendation: 'Optimize server response time or add caching',
        });
      } else {
        findings.push({
          id: 'perf.good-response',
          area: 'performance',
          severity: 'info',
          title: 'Good response time',
          description: `tools/list completed in ${duration}ms`,
          evidence: [{ type: 'url', ref: ctx.endpoint }],
          confidence: 1.0,
        });
      }
    } catch (error) {
      findings.push({
        id: 'perf.error',
        area: 'performance',
        severity: 'major',
        title: 'Performance check failed',
        description: error instanceof Error ? error.message : String(error),
        evidence: [{ type: 'log', ref: 'PerformanceMonitorPlugin' }],
      });
    }

    return findings;
  },
};
```

### Example 2: Security Scanner Plugin

```typescript
export const SecurityScannerPlugin: DiagnosticPlugin = {
  id: 'security-scanner',
  title: 'Security Scanner',
  order: 250,

  async run(ctx) {
    const findings: Finding[] = [];

    // Check HTTPS
    if (!ctx.endpoint.startsWith('https://')) {
      findings.push({
        id: 'security.no-https',
        area: 'security',
        severity: 'major',
        title: 'Insecure connection',
        description: 'Server not using HTTPS encryption',
        evidence: [{ type: 'url', ref: ctx.endpoint }],
        tags: ['security', 'encryption'],
        confidence: 1.0,
        recommendation: 'Enable HTTPS with valid TLS certificate',
      });
    }

    // Check for authentication
    const unauthResponse = await ctx.request({
      method: 'POST',
      path: '/',
      headers: {}, // No auth headers
      body: { method: 'tools/list', id: 1 },
    });

    if (unauthResponse.status === 200) {
      findings.push({
        id: 'security.no-auth',
        area: 'security',
        severity: 'blocker',
        title: 'No authentication required',
        description: 'Server accepts requests without authentication',
        evidence: [{ type: 'url', ref: ctx.endpoint }],
        tags: ['security', 'authentication'],
        confidence: 0.95,
        recommendation: 'Implement OAuth 2.0 or API key authentication',
      });
    }

    return findings;
  },
};
```

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture overview
- [API Reference](./API.md) - Complete API documentation
- [Security](../src/security/README.md) - Security scanning tools
- [Orchestration](../src/orchestration/README.md) - Workflow orchestration
- [Contributing](./CONTRIBUTING.md) - Contribution guidelines

---

## Support

For questions or issues with plugin development:

1. Check the [examples](../packages/cortexdx/src/plugins/) directory
2. Review existing plugin implementations
3. Open an issue on GitHub with the `plugin` label
4. Join the community Discord for real-time help

Happy plugin development! 🚀
