# Plugin Development Guide

Learn how to create custom plugins for Insula MCP to extend its diagnostic and development assistance capabilities.

## Plugin Architecture

Insula MCP uses a plugin-based architecture where all diagnostic and development assistance features are implemented as plugins that extend the `DiagnosticPlugin` interface.

### Plugin Types

1. **Diagnostic Plugins**: Analyze MCP servers for issues
2. **Development Assistance Plugins**: Help build and generate code
3. **Security Plugins**: Scan for vulnerabilities
4. **Performance Plugins**: Profile and optimize
5. **Academic Plugins**: Integrate research validation

## Creating Your First Plugin

### Basic Plugin Structure

```typescript
import type { DiagnosticPlugin, DiagnosticContext, Finding } from '@brainwav/insula-mcp';

export const myCustomPlugin: DiagnosticPlugin = {
    id: 'my-custom-plugin',
    title: 'My Custom Plugin',
    order: 100,
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        try {
            // Your plugin logic here
            const result = await ctx.jsonrpc('tools/list');
            
            if (!result.tools || result.tools.length === 0) {
                findings.push({
                    severity: 'medium',
                    message: 'No tools defined',
                    category: 'configuration',
                    confidence: 0.9
                });
            }
            
            // Attach evidence
            ctx.evidence({
                type: 'url',
                value: ctx.endpoint
            });
            
        } catch (error) {
            findings.push({
                severity: 'high',
                message: `Plugin error: ${error.message}`,
                category: 'error',
                confidence: 1.0
            });
        }
        
        return findings;
    }
};
```

### DiagnosticContext API

The `DiagnosticContext` provides utilities for plugin execution:

```typescript
interface DiagnosticContext {
    // Server endpoint being diagnosed
    endpoint: string;
    
    // Logging function
    logger: (...args: unknown[]) => void;
    
    // HTTP request helper
    request: <T>(input: RequestInfo, init?: RequestInit) => Promise<T>;
    
    // JSON-RPC helper
    jsonrpc: <T>(method: string, params?: unknown) => Promise<T>;
    
    // SSE probe helper
    sseProbe: (url: string, opts?: unknown) => Promise<SseResult>;
    
    // Governance pack (if available)
    governance?: GovernancePack;
    
    // LLM adapter (if available)
    llm?: LlmAdapter | null;
    
    // Evidence collection
    evidence: (ev: EvidencePointer) => void;
    
    // Deterministic mode flag
    deterministic?: boolean;
}
```

## Plugin Best Practices

### 1. Keep Functions Small

Follow the ≤40 line rule from CODESTYLE.md:

```typescript
// Good: Small, focused function
async function validateToolDefinition(tool: Tool): Promise<Finding | null> {
    if (!tool.name) {
        return {
            severity: 'high',
            message: 'Tool missing name',
            category: 'protocol',
            confidence: 1.0
        };
    }
    return null;
}

// Use in plugin
async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const result = await ctx.jsonrpc('tools/list');
    const findings = await Promise.all(
        result.tools.map(validateToolDefinition)
    );
    return findings.filter(Boolean);
}
```

### 2. Use Named Exports

```typescript
// Good: Named export
export const securityScannerPlugin: DiagnosticPlugin = { ... };

// Bad: Default export
export default { ... };
```

### 3. Attach Evidence

Always attach evidence to findings:

```typescript
// Collect evidence
ctx.evidence({
    type: 'url',
    value: ctx.endpoint
});

ctx.evidence({
    type: 'log',
    value: 'Protocol validation completed'
});

ctx.evidence({
    type: 'file',
    value: '/path/to/config.json'
});
```

### 4. Handle Errors Gracefully

```typescript
async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
        const result = await ctx.jsonrpc('initialize');
        // Process result
    } catch (error) {
        ctx.logger('Error during initialization:', error);
        findings.push({
            severity: 'high',
            message: `Initialization failed: ${error.message}`,
            category: 'connection',
            confidence: 0.95
        });
    }
    
    return findings;
}
```

### 5. Respect Deterministic Mode

```typescript
async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Use deterministic timestamps when required
    const timestamp = ctx.deterministic 
        ? '2024-01-01T00:00:00Z'
        : new Date().toISOString();
    
    findings.push({
        severity: 'info',
        message: `Scan completed at ${timestamp}`,
        category: 'info',
        confidence: 1.0
    });
    
    return findings;
}
```

## Advanced Plugin Features

### LLM-Enhanced Plugins

Plugins can use the LLM adapter for intelligent analysis:

```typescript
export const llmEnhancedPlugin: DiagnosticPlugin = {
    id: 'llm-enhanced',
    title: 'LLM Enhanced Analysis',
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        if (!ctx.llm) {
            return [{
                severity: 'info',
                message: 'LLM not available',
                category: 'info',
                confidence: 1.0
            }];
        }
        
        const code = await fetchServerCode(ctx);
        const analysis = await ctx.llm.analyzeCode(code, 'MCP server');
        
        return analysis.issues.map(issue => ({
            severity: issue.severity,
            message: issue.description,
            category: 'code-quality',
            confidence: issue.confidence
        }));
    }
};
```

### Interactive Plugins

Create plugins that support conversational debugging:

```typescript
export const interactiveDebuggerPlugin: DiagnosticPlugin = {
    id: 'interactive-debugger',
    title: 'Interactive Debugger',
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        if (!ctx.llm) return [];
        
        const sessionId = await ctx.llm.startConversation({
            sessionType: 'debugging',
            mcpContext: { endpoint: ctx.endpoint }
        });
        
        // Analyze initial context
        const initialAnalysis = await ctx.llm.continueConversation(
            sessionId,
            'Analyze this MCP server for common issues'
        );
        
        return [{
            severity: 'info',
            message: initialAnalysis,
            category: 'analysis',
            confidence: 0.85
        }];
    }
};
```

### Performance-Aware Plugins

Implement performance requirements:

```typescript
export const performancePlugin: DiagnosticPlugin = {
    id: 'performance-profiler',
    title: 'Performance Profiler',
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        // Measure with millisecond precision
        const start = performance.now();
        await ctx.jsonrpc('tools/list');
        const duration = performance.now() - start;
        
        if (duration > 1000) {
            findings.push({
                severity: 'medium',
                message: `Slow response: ${duration.toFixed(2)}ms`,
                category: 'performance',
                confidence: 1.0
            });
        }
        
        return findings;
    }
};
```

## Plugin Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { myCustomPlugin } from './my-custom-plugin.js';

describe('My Custom Plugin', () => {
    const mockContext = {
        endpoint: 'http://localhost:3000',
        logger: () => {},
        jsonrpc: async () => ({ tools: [] }),
        evidence: () => {},
        deterministic: true
    };
    
    it('should detect missing tools', async () => {
        const findings = await myCustomPlugin.run(mockContext);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe('medium');
    });
});
```

### Integration Tests

```typescript
describe('Plugin Integration', () => {
    it('should work with real MCP server', async () => {
        const ctx = createRealContext('http://localhost:3000');
        const findings = await myCustomPlugin.run(ctx);
        expect(findings).toBeDefined();
    });
});
```

## Plugin Registration

### Register Your Plugin

```typescript
// src/plugins/index.ts
export { myCustomPlugin } from './my-custom-plugin.js';

// Register in plugin host
import { registerPlugin } from '@brainwav/insula-mcp';
import { myCustomPlugin } from './plugins/my-custom-plugin.js';

registerPlugin(myCustomPlugin);
```

### Plugin Configuration

```json
{
  "plugins": {
    "my-custom-plugin": {
      "enabled": true,
      "order": 100,
      "config": {
        "threshold": 1000,
        "strict": true
      }
    }
  }
}
```

## Publishing Your Plugin

### Package Structure

```
my-insula-plugin/
├── src/
│   └── index.ts
├── tests/
│   └── plugin.spec.ts
├── package.json
├── tsconfig.json
└── README.md
```

### package.json

```json
{
  "name": "@myorg/insula-plugin-custom",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "exports": {
    ".": "./dist/index.js"
  },
  "peerDependencies": {
    "@brainwav/insula-mcp": "^0.1.0"
  }
}
```

## Examples

See the `examples/` directory for complete plugin examples:

- `examples/basic-plugin/` - Simple diagnostic plugin
- `examples/llm-plugin/` - LLM-enhanced analysis
- `examples/security-plugin/` - Security scanner
- `examples/performance-plugin/` - Performance profiler

## Resources

- [API Reference](./API_REFERENCE.md)
- [Plugin SDK](../src/sdk/plugin-sdk.ts)
- [Plugin Templates](../src/sdk/plugin-templates.ts)
- [Testing Guide](./TESTING.md)

## Support

- Ask questions in interactive mode: `insula-mcp interactive`
- GitHub Discussions: Share your plugins
- GitHub Issues: Report bugs
