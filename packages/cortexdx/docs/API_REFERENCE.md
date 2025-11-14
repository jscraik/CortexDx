# API Reference

Complete API documentation for CortexDx - the diagnostic meta-inspector for Model Context Protocol servers.

## Table of Contents

- [Core Interfaces](#core-interfaces)
- [CLI Commands](#cli-commands)
- [Programmatic API](#programmatic-api)
- [Configuration](#configuration)
- [Output Formats](#output-formats)
- [Plugin Development](#plugin-development)
- [LLM Integration](#llm-integration)
- [Error Handling](#error-handling)
- [TypeScript Types](#typescript-types)

## Core Interfaces

### DiagnosticPlugin

Base interface for all diagnostic plugins.

```typescript
interface DiagnosticPlugin {
    id: string;
    title: string;
    order?: number;
    run: (ctx: DiagnosticContext) => Promise<Finding[]>;
}
```

**Properties**:

- `id`: Unique identifier for the plugin (must be unique across all plugins)
- `title`: Human-readable plugin name displayed in reports
- `order`: Optional execution order (lower numbers run first, default: 100)
- `run`: Main plugin execution function that returns diagnostic findings

**Example**:

```typescript
export const myPlugin: DiagnosticPlugin = {
    id: 'my-custom-plugin',
    title: 'My Custom Diagnostic Plugin',
    order: 50,
    async run(ctx) {
        const findings: Finding[] = [];
        
        try {
            // Perform diagnostic checks
            const response = await ctx.request('/health');
            
            findings.push({
                id: 'health-check',
                area: 'connectivity',
                severity: 'info',
                title: 'Health Check Passed',
                description: 'Server responded to health check',
                evidence: [{
                    type: 'url',
                    ref: `${ctx.endpoint}/health`
                }],
                confidence: 1.0
            });
        } catch (error) {
            findings.push({
                id: 'health-check-failed',
                area: 'connectivity',
                severity: 'major',
                title: 'Health Check Failed',
                description: `Server health check failed: ${error.message}`,
                evidence: [{
                    type: 'log',
                    ref: error.stack || error.message
                }],
                confidence: 0.9,
                recommendation: 'Check server status and network connectivity'
            });
        }
        
        return findings;
    }
};
```

### DiagnosticContext

Context provided to plugins during execution, containing all necessary tools and configuration.

```typescript
interface DiagnosticContext {
    endpoint: string;
    headers?: Record<string, string>;
    logger: (...args: unknown[]) => void;
    request: <T>(input: RequestInfo, init?: RequestInit) => Promise<T>;
    jsonrpc: <T>(method: string, params?: unknown) => Promise<T>;
    sseProbe: (url: string, opts?: unknown) => Promise<SseResult>;
    governance?: GovernancePack;
    llm?: LlmAdapter | null;
    evidence: (ev: EvidencePointer) => void;
    deterministic?: boolean;
}
```

**Properties**:

- `endpoint`: MCP server base URL being diagnosed (e.g., "<https://api.example.com>")
- `headers`: Optional HTTP headers for authentication or custom headers
- `logger`: Logging function for debug output (respects verbosity settings)
- `request`: Generic HTTP request helper with automatic error handling
- `jsonrpc`: JSON-RPC 2.0 request helper for MCP protocol communication
- `sseProbe`: Server-Sent Events probe helper for streaming diagnostics
- `governance`: Optional governance pack for policy validation
- `llm`: Optional LLM adapter for AI-powered analysis
- `evidence`: Function to collect evidence pointers for findings
- `deterministic`: Flag indicating deterministic mode (stable timestamps/seeds)

**Usage Example**:

```typescript
async function run(ctx: DiagnosticContext): Promise<Finding[]> {
    // Log diagnostic start
    ctx.logger('Starting custom diagnostic for', ctx.endpoint);
    
    // Make JSON-RPC call
    try {
        const capabilities = await ctx.jsonrpc('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {}
        });
        
        // Collect evidence
        ctx.evidence({
            type: 'url',
            ref: `${ctx.endpoint}/initialize`
        });
        
        return [{
            id: 'initialization-success',
            area: 'protocol',
            severity: 'info',
            title: 'MCP Initialization Successful',
            description: `Server supports capabilities: ${Object.keys(capabilities).join(', ')}`,
            evidence: [],
            confidence: 1.0
        }];
    } catch (error) {
        return [{
            id: 'initialization-failed',
            area: 'protocol',
            severity: 'blocker',
            title: 'MCP Initialization Failed',
            description: `Failed to initialize MCP connection: ${error.message}`,
            evidence: [{
                type: 'log',
                ref: error.stack
            }],
            confidence: 0.95,
            recommendation: 'Verify MCP server is running and supports the protocol version'
        }];
    }
}
```

### Finding

Represents a diagnostic finding with complete metadata and evidence.

```typescript
interface Finding {
    id: string;
    area: string;
    severity: Severity;
    title: string;
    description: string;
    evidence: EvidencePointer[];
    tags?: string[];
    confidence?: number;
    recommendation?: string;
    remediation?: {
        filePlan?: FilePlan;
        steps?: string[];
        codeSamples?: CodeSample[];
    };
}

type Severity = "info" | "minor" | "major" | "blocker";
```

**Properties**:

- `id`: Unique identifier for the finding (used for tracking and comparison)
- `area`: Diagnostic area (e.g., 'protocol', 'security', 'performance', 'governance')
- `severity`: Finding severity level affecting exit codes
  - `info`: Informational, no action required (exit code 0)
  - `minor`: Minor issue, should be addressed (exit code 0)
  - `major`: Major issue, should be fixed (exit code 2)
  - `blocker`: Critical issue, must be fixed (exit code 1)
- `title`: Short, descriptive title for the finding
- `description`: Detailed description of the issue or observation
- `evidence`: Array of evidence pointers supporting the finding
- `tags`: Optional tags for categorization and filtering
- `confidence`: Confidence score (0.0 to 1.0, default: 1.0)
- `recommendation`: Optional human-readable fix suggestion
- `remediation`: Optional structured remediation information

**Example Finding**:

```typescript
const finding: Finding = {
    id: 'cors-missing-headers',
    area: 'security',
    severity: 'major',
    title: 'Missing CORS Headers',
    description: 'Server does not include proper CORS headers, which may prevent browser-based clients from connecting.',
    evidence: [
        {
            type: 'url',
            ref: 'https://api.example.com/mcp'
        },
        {
            type: 'log',
            ref: 'Response headers: {"content-type": "application/json"}'
        }
    ],
    tags: ['cors', 'security', 'browser-compatibility'],
    confidence: 0.9,
    recommendation: 'Add Access-Control-Allow-Origin and other CORS headers',
    remediation: {
        steps: [
            'Configure server to include CORS headers',
            'Add Access-Control-Allow-Origin: *',
            'Add Access-Control-Allow-Methods: GET, POST, OPTIONS',
            'Test with browser-based client'
        ],
        codeSamples: [
            {
                language: 'javascript',
                title: 'Express.js CORS Configuration',
                snippet: `app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});`
            }
        ]
    }
};
```

### EvidencePointer

Points to evidence supporting a finding, providing traceability and verification.

```typescript
interface EvidencePointer {
    type: 'url' | 'file' | 'log';
    ref: string;
    lines?: [number, number];
}
```

**Properties**:

- `type`: Type of evidence
  - `url`: HTTP endpoint or web resource
  - `file`: Local file path or configuration file
  - `log`: Log entry, error message, or diagnostic output
- `ref`: Reference string (URL, file path, or log content)
- `lines`: Optional line range for file-based evidence [start, end]

**Examples**:

```typescript
// URL evidence
const urlEvidence: EvidencePointer = {
    type: 'url',
    ref: 'https://api.example.com/mcp/capabilities'
};

// File evidence with line numbers
const fileEvidence: EvidencePointer = {
    type: 'file',
    ref: '/etc/mcp/server.json',
    lines: [15, 20]
};

// Log evidence
const logEvidence: EvidencePointer = {
    type: 'log',
    ref: 'Error: Connection refused at port 3000'
};
```

## Programmatic API

### Installation

```bash
npm install @brainwav/cortexdx
```

### Basic Usage

```typescript
import { runDiagnose } from '@brainwav/cortexdx';

// Run diagnostics programmatically
const exitCode = await runDiagnose({
    endpoint: 'http://localhost:3000',
    opts: {
        suites: 'protocol,security',
        out: './reports',
        deterministic: true
    }
});

console.log('Diagnostic completed with exit code:', exitCode);
```

### Core Exports

```typescript
// Main diagnostic function
export { runDiagnose } from './orchestrator.js';

// Type definitions
export type { 
    EnhancedLlmAdapter, 
    FilePlan, 
    Finding, 
    LlmAdapter,
    DiagnosticContext,
    DiagnosticPlugin,
    Severity,
    EvidencePointer
} from './types.js';

// LLM integration
export {
    LlmOrchestrator,
    createLlmAdapter,
    createLlmOrchestrator,
    getEnhancedLlmAdapter,
    getLlmAdapter,
    hasMlx,
    hasOllama,
    pickLocalLLM
} from './ml/index.js';

// Adapter creation
export { 
    createMlxAdapter, 
    createOllamaAdapter 
} from './adapters/index.js';
```

### runDiagnose Function

Main programmatic entry point for running diagnostics.

```typescript
function runDiagnose(options: {
    endpoint: string;
    opts: DiagnoseOptions;
}): Promise<number>;

interface DiagnoseOptions {
    out?: string;              // Output directory (default: "reports")
    full?: boolean;            // Run full suite
    suites?: string;           // Comma-separated suite names
    deterministic?: boolean;   // Deterministic mode
    budgetTime?: number;       // Time budget per plugin (ms)
    budgetMem?: number;        // Memory budget per plugin (MB)
}
```

**Example**:

```typescript
import { runDiagnose } from '@brainwav/cortexdx';

async function diagnoseServer() {
    const result = await runDiagnose({
        endpoint: 'https://api.example.com',
        opts: {
            suites: 'protocol,security,performance',
            out: './diagnostic-results',
            deterministic: true,
            budgetTime: 10000,
            budgetMem: 128
        }
    });
    
    // Handle exit codes
    switch (result) {
        case 0:
            console.log('✓ No critical issues found');
            break;
        case 1:
            console.error('✗ Blocker issues detected');
            break;
        case 2:
            console.warn('⚠ Major issues detected');
            break;
    }
    
    return result;
}
```

## LLM Integration

### LlmAdapter

Base interface for LLM adapters.

```typescript
interface LlmAdapter {
    complete: (prompt: string, maxTokens?: number) => Promise<string>;
}
```

### EnhancedLlmAdapter

Extended LLM adapter with conversational capabilities.

```typescript
interface EnhancedLlmAdapter extends LlmAdapter {
    backend: 'ollama';
    loadModel: (modelId: string) => Promise<void>;
    unloadModel: (modelId: string) => Promise<void>;
    getSupportedModels: () => Promise<string[]>;
    getModelInfo: (modelId: string) => Promise<ModelInfo>;
    startConversation: (context: ConversationContext) => Promise<ConversationId>;
    continueConversation: (id: ConversationId, message: string) => Promise<string>;
    endConversation: (id: ConversationId) => Promise<void>;
    analyzeCode: (code: string, context: string) => Promise<CodeAnalysis>;
    generateSolution: (problem: Problem, constraints: Constraints) => Promise<Solution>;
    explainError: (error: Error, context: Context) => Promise<Explanation>;
}
```

**Methods**:

- `loadModel`: Load a specific model
- `unloadModel`: Unload a model from memory
- `getSupportedModels`: List available models
- `getModelInfo`: Get model metadata
- `startConversation`: Begin conversational session
- `continueConversation`: Continue existing conversation
- `endConversation`: End conversation session
- `analyzeCode`: Analyze code with LLM
- `generateSolution`: Generate solution for problem
- `explainError`: Explain error in user-friendly terms

### Creating LLM Adapters

```typescript
import { createOllamaAdapter } from '@brainwav/cortexdx';

// Ollama adapter
const ollama = createOllamaAdapter({
    endpoint: 'http://localhost:11434',
    model: 'llama3'
});

// Use adapter
const response = await ollama.complete('Explain MCP protocol');

// CortexDx supports the Ollama backend exclusively. Remove any legacy local adapters to avoid runtime errors.
```

## Plugin Development

### Plugin Architecture

CortexDx uses a plugin-based architecture where each diagnostic capability is implemented as a separate plugin. Plugins run in sandboxed worker threads with resource budgets.

#### Basic Plugin Structure

```typescript
import type { DiagnosticPlugin, DiagnosticContext, Finding } from '@brainwav/cortexdx';

export const myPlugin: DiagnosticPlugin = {
    id: 'unique-plugin-id',
    title: 'Human Readable Plugin Name',
    order: 100, // Execution order (optional)
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        // Plugin implementation
        try {
            // Perform diagnostics using context helpers
            const response = await ctx.request('/endpoint');
            
            // Create findings based on analysis
            findings.push({
                id: 'finding-id',
                area: 'protocol',
                severity: 'info',
                title: 'Finding Title',
                description: 'Detailed description',
                evidence: [{
                    type: 'url',
                    ref: ctx.endpoint + '/endpoint'
                }],
                confidence: 1.0
            });
        } catch (error) {
            // Handle errors gracefully
            ctx.logger('Plugin error:', error.message);
        }
        
        return findings;
    }
};
```

#### Plugin Categories

##### Diagnostic Plugins

Standard diagnostic plugins that analyze MCP server behavior.

```typescript
export const protocolPlugin: DiagnosticPlugin = {
    id: 'protocol-compliance',
    title: 'MCP Protocol Compliance Check',
    order: 10,
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        // Test protocol initialization
        try {
            const capabilities = await ctx.jsonrpc('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {}
            });
            
            // Validate response structure
            if (!capabilities.protocolVersion) {
                findings.push({
                    id: 'missing-protocol-version',
                    area: 'protocol',
                    severity: 'major',
                    title: 'Missing Protocol Version',
                    description: 'Server response missing required protocolVersion field',
                    evidence: [{
                        type: 'log',
                        ref: JSON.stringify(capabilities)
                    }],
                    confidence: 1.0,
                    recommendation: 'Include protocolVersion in initialize response'
                });
            }
            
            // Test capabilities
            if (capabilities.capabilities?.tools) {
                const tools = await ctx.jsonrpc('tools/list');
                findings.push({
                    id: 'tools-available',
                    area: 'protocol',
                    severity: 'info',
                    title: 'Tools Available',
                    description: `Server provides ${tools.tools?.length || 0} tools`,
                    evidence: [{
                        type: 'url',
                        ref: ctx.endpoint + '/tools/list'
                    }],
                    confidence: 1.0
                });
            }
        } catch (error) {
            findings.push({
                id: 'protocol-initialization-failed',
                area: 'protocol',
                severity: 'blocker',
                title: 'Protocol Initialization Failed',
                description: `Failed to initialize MCP protocol: ${error.message}`,
                evidence: [{
                    type: 'log',
                    ref: error.stack || error.message
                }],
                confidence: 0.9,
                recommendation: 'Verify server implements MCP protocol correctly'
            });
        }
        
        return findings;
    }
};
```

##### Development Plugins

Enhanced plugins that provide development assistance and code generation.

```typescript
import type { DevelopmentPlugin, DevelopmentContext } from '@brainwav/cortexdx';

export const codeGeneratorPlugin: DevelopmentPlugin = {
    id: 'code-generator',
    title: 'MCP Code Generator',
    category: 'development',
    order: 200,
    requiresLlm: true,
    supportedLanguages: ['typescript', 'javascript', 'python'],
    
    async run(ctx: DevelopmentContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        if (!ctx.conversationalLlm) {
            return [{
                id: 'llm-required',
                area: 'development',
                severity: 'info',
                title: 'LLM Required for Code Generation',
                description: 'Code generation requires LLM backend',
                evidence: [],
                confidence: 1.0
            }];
        }
        
        // Analyze existing code structure
        if (ctx.projectContext) {
            const analysis = await ctx.conversationalLlm.analyzeCode(
                ctx.projectContext.sourceFiles.join('\n'),
                'MCP server implementation analysis'
            );
            
            // Generate improvement suggestions
            if (analysis.issues.length > 0) {
                findings.push({
                    id: 'code-improvements-available',
                    area: 'development',
                    severity: 'minor',
                    title: 'Code Improvements Available',
                    description: `Found ${analysis.issues.length} potential improvements`,
                    evidence: [{
                        type: 'log',
                        ref: JSON.stringify(analysis.issues)
                    }],
                    confidence: analysis.confidence,
                    recommendation: 'Review suggested improvements and apply as appropriate',
                    remediation: {
                        steps: analysis.suggestions.map(s => s.description),
                        codeSamples: analysis.suggestions
                            .filter(s => s.code)
                            .map(s => ({
                                language: ctx.projectContext?.language || 'typescript',
                                title: s.description,
                                snippet: s.code!
                            }))
                    }
                });
            }
        }
        
        return findings;
    }
};
```

##### Conversational Plugins

Interactive plugins that provide conversational assistance.

```typescript
import type { ConversationalPlugin, ConversationSession } from '@brainwav/cortexdx';

export const debugAssistantPlugin: ConversationalPlugin = {
    id: 'debug-assistant',
    title: 'Interactive Debug Assistant',
    category: 'conversational',
    order: 300,
    requiresLlm: true,
    
    async run(ctx: DevelopmentContext): Promise<Finding[]> {
        // Standard diagnostic run
        return [];
    },
    
    async initiateConversation(ctx: DevelopmentContext, intent: string): Promise<ConversationSession> {
        const session: ConversationSession = {
            id: `debug-${Date.now()}`,
            pluginId: this.id,
            context: ctx,
            state: {
                intent,
                step: 'initial',
                problemAnalysis: null
            },
            startTime: Date.now(),
            lastActivity: Date.now()
        };
        
        return session;
    },
    
    async continueConversation(session: ConversationSession, userInput: string) {
        const { conversationalLlm } = session.context;
        
        if (!conversationalLlm) {
            return {
                message: 'LLM not available for conversational assistance',
                completed: true,
                session
            };
        }
        
        // Analyze user input and provide assistance
        const response = await conversationalLlm.chat([
            {
                role: 'system',
                content: 'You are a helpful MCP debugging assistant. Help users diagnose and fix MCP server issues.'
            },
            {
                role: 'user',
                content: userInput
            }
        ]);
        
        session.lastActivity = Date.now();
        
        return {
            message: response,
            needsInput: true,
            session
        };
    }
};
```

### Plugin Development Guidelines

#### Resource Management

Plugins run in sandboxed environments with strict resource budgets:

```typescript
// Plugin execution budgets (configurable)
interface SandboxBudgets {
    timeMs: number;    // Default: 5000ms
    memMb: number;     // Default: 96MB
}
```

**Best Practices**:

- Keep plugin execution time under budget
- Avoid memory leaks and excessive allocations
- Use streaming for large data processing
- Implement proper error handling and cleanup

#### Error Handling

```typescript
async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
        // Plugin logic
    } catch (error) {
        // Log error for debugging
        ctx.logger('Plugin error:', error.message);
        
        // Create finding for user
        findings.push({
            id: 'plugin-execution-error',
            area: 'diagnostic',
            severity: 'minor',
            title: 'Diagnostic Check Failed',
            description: `Unable to complete diagnostic: ${error.message}`,
            evidence: [{
                type: 'log',
                ref: error.stack || error.message
            }],
            confidence: 0.5,
            recommendation: 'Check server availability and configuration'
        });
    }
    
    return findings;
}
```

#### Evidence Collection

Always provide evidence for findings:

```typescript
// Collect evidence during diagnostics
ctx.evidence({
    type: 'url',
    ref: `${ctx.endpoint}/capabilities`
});

// Include evidence in findings
findings.push({
    id: 'capability-check',
    area: 'protocol',
    severity: 'info',
    title: 'Capabilities Retrieved',
    description: 'Successfully retrieved server capabilities',
    evidence: [{
        type: 'url',
        ref: `${ctx.endpoint}/capabilities`
    }, {
        type: 'log',
        ref: JSON.stringify(capabilities, null, 2)
    }],
    confidence: 1.0
});
```

#### Deterministic Mode

Support deterministic mode for reproducible results:

```typescript
async run(ctx: DiagnosticContext): Promise<Finding[]> {
    // Use deterministic timestamps when in deterministic mode
    const timestamp = ctx.deterministic 
        ? '2024-01-01T00:00:00.000Z'
        : new Date().toISOString();
    
    // Use seeded random values if needed
    const randomValue = ctx.deterministic 
        ? 0.5  // Fixed value
        : Math.random();
    
    return findings;
}
```

### Plugin Testing

#### Unit Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { myPlugin } from './my-plugin.js';
import type { DiagnosticContext } from '@brainwav/cortexdx';

describe('MyPlugin', () => {
    it('should detect missing headers', async () => {
        const mockContext: DiagnosticContext = {
            endpoint: 'http://localhost:3000',
            logger: vi.fn(),
            request: vi.fn().mockResolvedValue({
                headers: {}
            }),
            jsonrpc: vi.fn(),
            sseProbe: vi.fn(),
            evidence: vi.fn(),
            deterministic: true
        };
        
        const findings = await myPlugin.run(mockContext);
        
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe('major');
        expect(findings[0].title).toContain('Missing Headers');
    });
});
```

#### Integration Testing

```typescript
import { runDiagnose } from '@brainwav/cortexdx';

describe('Plugin Integration', () => {
    it('should work with real server', async () => {
        const exitCode = await runDiagnose({
            endpoint: 'http://localhost:3000',
            opts: {
                suites: 'my-plugin',
                deterministic: true
            }
        });
        
        expect(exitCode).toBe(0);
    });
});
```

## CLI Commands

### diagnose

Run comprehensive diagnostic suite on MCP server endpoint.

```bash
cortexdx diagnose <endpoint> [options]
```

**Arguments**:

- `<endpoint>`: MCP server base URL (e.g., `https://api.example.com`, `http://localhost:3000`)

**Options**:

- `--full`: Run complete diagnostic suite (all plugins)
- `--auth <scheme:value>`: Authentication configuration
  - `bearer:TOKEN`: Bearer token authentication
  - `basic:username:password`: Basic authentication
  - `header:Name:Value`: Custom header authentication
- `--suites <csv>`: Comma-separated list of diagnostic suites to run
  - Available suites: `streaming`, `governance`, `cors`, `ratelimit`, `protocol`, `security`, `performance`
- `--simulate-external`: Probe server as if from external client (bypasses localhost optimizations)
- `--out <dir>`: Output directory for reports (default: `reports`)
- `--file-plan`: Generate unified diff patches for suggested fixes
- `--a11y`: Enable screen-reader friendly output format
- `--no-color`: Disable ANSI color codes in output
- `--deterministic`: Enable deterministic mode (stable timestamps and seeds for reproducible results)
- `--otel-exporter <url>`: OpenTelemetry OTLP/HTTP endpoint for observability
- `--har`: Capture redacted HTTP Archive (HAR) files on failures
- `--compare <files...>`: Compare two JSON findings files (requires 2+ files)
- `--budget-time <ms>`: Per-plugin execution time budget in milliseconds (default: 5000)
- `--budget-mem <mb>`: Per-plugin memory budget in megabytes (default: 96)

**Exit Codes**:

- `0`: Success (no blockers or majors found)
- `1`: Blocker severity findings detected
- `2`: Major severity findings detected (no blockers)

**Examples**:

```bash
# Basic diagnostic
cortexdx diagnose http://localhost:3000

# Full suite with authentication
cortexdx diagnose https://api.example.com --full --auth bearer:abc123

# Specific suites with custom output
cortexdx diagnose http://localhost:3000 \
  --suites protocol,security,cors \
  --out ./diagnostics \
  --deterministic

# External simulation with HAR capture
cortexdx diagnose https://api.example.com \
  --simulate-external \
  --har \
  --otel-exporter http://localhost:4318/v1/traces

# Compare two diagnostic runs
cortexdx diagnose http://localhost:3000 \
  --compare reports/old-findings.json reports/new-findings.json
```

### interactive

Start interactive conversational development session with AI assistance.

```bash
cortexdx interactive [options]
```

**Alias**: `i`

**Options**:

- `--expertise <level>`: Set user expertise level for tailored responses
  - `beginner`: Detailed explanations with step-by-step guidance
  - `intermediate`: Balanced technical detail (default)
  - `expert`: Concise, technical responses
- `--no-color`: Disable ANSI color codes in interactive output

**Features**:

- Conversational MCP development assistance
- Real-time problem solving and debugging
- Code generation and explanation
- Best practices recommendations
- Interactive tutorials and guidance

**Example**:

```bash
# Start interactive session
cortexdx interactive

# Start with beginner-friendly explanations
cortexdx interactive --expertise beginner

# Start without colors (for screen readers)
cortexdx interactive --no-color --expertise expert
```

### generate

Code generation commands for MCP servers, connectors, and documentation.

```bash
cortexdx generate <subcommand> [arguments] [options]
```

#### generate template

Generate MCP server template from scratch.

```bash
cortexdx generate template <name> [options]
```

**Arguments**:

- `<name>`: Server name (will be used for package name and directory)

**Options**:

- `--lang <language>`: Programming language (default: `typescript`)
  - `typescript`: TypeScript with modern ESM
  - `javascript`: JavaScript with ESM
  - `python`: Python with asyncio
  - `go`: Go with standard library
- `--features <csv>`: Comma-separated feature list
  - `tools`: MCP tools implementation
  - `resources`: MCP resources implementation
  - `prompts`: MCP prompts implementation
  - `authentication`: Authentication middleware
  - `streaming`: Server-Sent Events streaming
- `--transport <csv>`: Transport protocols (default: `http`)
  - `http`: HTTP/HTTPS transport
  - `sse`: Server-Sent Events
  - `websocket`: WebSocket transport
  - `stdio`: Standard I/O transport
- `--no-tests`: Skip test file generation
- `--no-docs`: Skip documentation generation
- `--out <dir>`: Output directory (default: current directory)

**Example**:

```bash
cortexdx generate template my-mcp-server \
  --lang typescript \
  --features tools,resources,authentication \
  --transport http,sse \
  --out ./servers
```

#### generate connector

Generate MCP connector from API specification.

```bash
cortexdx generate connector <name> <spec> [options]
```

**Arguments**:

- `<name>`: Connector name
- `<spec>`: API specification (OpenAPI/Swagger URL or file path)

**Options**:

- `--auth <type>`: Authentication type (default: `none`)
  - `none`: No authentication
  - `api-key`: API key authentication
  - `oauth2`: OAuth 2.0 flow
  - `bearer`: Bearer token
  - `basic`: Basic authentication
- `--lang <language>`: Programming language (default: `typescript`)
- `--no-tests`: Skip test generation
- `--out <dir>`: Output directory (default: current directory)

**Example**:

```bash
cortexdx generate connector github-api \
  https://api.github.com/openapi.json \
  --auth oauth2 \
  --lang typescript
```

#### generate docs

Generate documentation for MCP implementation.

```bash
cortexdx generate docs <target> <source> [options]
```

**Arguments**:

- `<target>`: Documentation target type
  - `server`: MCP server documentation
  - `connector`: MCP connector documentation
  - `tool`: Individual tool documentation
  - `api`: Complete API documentation
  - `deployment`: Deployment guide
- `<source>`: Source code path or MCP endpoint

**Options**:

- `--format <fmt>`: Output format (default: `markdown`)
  - `markdown`: Markdown documentation
  - `html`: HTML documentation
  - `pdf`: PDF documentation
- `--no-examples`: Skip usage examples
- `--out <file>`: Output file path

**Example**:

```bash
cortexdx generate docs server ./my-server \
  --format markdown \
  --out ./docs/server-api.md
```

### debug

Start interactive debugging session for MCP problems.

```bash
cortexdx debug <problem> [options]
```

**Arguments**:

- `<problem>`: Problem description or error message to debug

**Options**:

- `--errors <files...>`: Error log files to analyze for context
- `--configs <files...>`: Configuration files to include in analysis
- `--code <files...>`: Relevant source code files for context
- `--expertise <level>`: User expertise level (default: `intermediate`)

**Example**:

```bash
cortexdx debug "Connection refused on port 3000" \
  --errors ./logs/server.log \
  --configs ./config/mcp.json \
  --expertise beginner
```

### explain

Explain errors or MCP concepts with AI assistance.

```bash
cortexdx explain <subcommand> [arguments] [options]
```

#### explain error

Interpret and explain error messages in user-friendly terms.

```bash
cortexdx explain error <error> [options]
```

**Arguments**:

- `<error>`: Error message or stack trace to explain

**Options**:

- `--context <file>`: Context file (JSON/YAML) with additional information
- `--expertise <level>`: User expertise level (default: `intermediate`)
- `--technical`: Include detailed technical information

**Example**:

```bash
cortexdx explain error "ECONNREFUSED 127.0.0.1:3000" \
  --context ./debug-context.json \
  --expertise beginner
```

#### explain concept

Explain MCP concepts, patterns, and best practices.

```bash
cortexdx explain concept <concept> [options]
```

**Arguments**:

- `<concept>`: MCP concept to explain (e.g., `tools`, `resources`, `prompts`, `streaming`)

**Options**:

- `--expertise <level>`: User expertise level (default: `intermediate`)
- `--no-examples`: Skip code examples
- `--no-usecases`: Skip use case examples

**Example**:

```bash
cortexdx explain concept tools --expertise beginner
cortexdx explain concept streaming --no-examples
```

### best-practices

Analyze implementation and provide best practices recommendations.

```bash
cortexdx best-practices [endpoint] [options]
```

**Alias**: `bp`

**Arguments**:

- `[endpoint]`: Optional MCP server endpoint to analyze

**Options**:

- `--code <path>`: Local codebase path to analyze
- `--focus <csv>`: Focus areas for analysis
  - `protocol`: MCP protocol compliance
  - `security`: Security best practices
  - `performance`: Performance optimization
  - `maintainability`: Code maintainability
  - `testing`: Testing strategies
  - `documentation`: Documentation quality
- `--standards <file>`: Organization standards file (JSON format)
- `--no-samples`: Skip code sample generation

**Example**:

```bash
cortexdx best-practices http://localhost:3000 \
  --focus protocol,security,performance

cortexdx bp --code ./my-mcp-server \
  --focus maintainability,testing \
  --standards ./org-standards.json
```

### tutorial

Create interactive tutorial for MCP development topics.

```bash
cortexdx tutorial <topic> [options]
```

**Arguments**:

- `<topic>`: Tutorial topic (e.g., "creating first MCP server", "implementing tools")

**Options**:

- `--expertise <level>`: User expertise level (default: `beginner`)
- `--lang <language>`: Programming language for examples (default: `typescript`)
- `--no-exercises`: Skip hands-on exercises

**Example**:

```bash
cortexdx tutorial "creating first MCP server" \
  --expertise beginner \
  --lang python

cortexdx tutorial "advanced streaming patterns" \
  --expertise expert \
  --no-exercises
```

### doctor

Perform environment and system checks.

```bash
cortexdx doctor
```

**Checks Performed**:

- Node.js version compatibility
- Required dependencies availability
- LLM backend status (Ollama)
- Network connectivity
- System requirements
- Configuration validity
- Plugin installation status

**Example Output**:

```
[brAInwav] Doctor: Node v20.11.1 ✓
[brAInwav] Doctor: Dependencies ✓
[brAInwav] Doctor: Ollama available ✓
[brAInwav] Doctor: Network connectivity ✓
```

### compare

Compare diagnostic findings between two runs.

```bash
cortexdx compare <old> <new>
```

**Arguments**:

- `<old>`: Path to old findings JSON file
- `<new>`: Path to new findings JSON file

**Output**:

- Added findings (new issues)
- Removed findings (resolved issues)
- Changed findings (severity or details changed)
- Summary statistics

**Example**:

```bash
cortexdx compare reports/baseline.json reports/current.json
```

## Configuration

### Configuration File Schema

CortexDx supports configuration via `.cortexdx.json` file in your project root or via environment variables.

```json
{
  "$schema": "https://schemas.brainwav.dev/cortexdx/config.json",
  "llm": {
    "backend": "ollama",
    "model": "llama3.1",
    "endpoint": "http://localhost:11434",
    "quantization": "q4_0",
    "maxHistoryLength": 20,
    "temperature": 0.7,
    "maxTokens": 2048,
    "timeout": 30000
  },
  "diagnostics": {
    "suites": ["protocol", "security", "performance", "governance"],
    "severity": "minor",
    "parallel": true,
    "maxConcurrency": 4,
    "timeout": 30000,
    "budgets": {
      "timeMs": 5000,
      "memMb": 96
    },
    "retries": 3,
    "deterministic": false
  },
  "output": {
    "directory": "reports",
    "formats": ["json", "markdown", "arctdd"],
    "filePlan": true,
    "accessibility": false,
    "colors": true,
    "har": false
  },
  "authentication": {
    "defaultScheme": "none",
    "schemes": {
      "bearer": {
        "token": "${BEARER_TOKEN}"
      },
      "basic": {
        "username": "${BASIC_USER}",
        "password": "${BASIC_PASS}"
      },
      "header": {
        "name": "X-API-Key",
        "value": "${API_KEY}"
      }
    }
  },
  "templates": {
    "organization": "my-org",
    "author": "My Name <my.email@example.com>",
    "license": "MIT",
    "conventions": {
      "naming": "kebab-case",
      "testing": "vitest",
      "codeStyle": "biome",
      "linting": "biome"
    },
    "features": {
      "typescript": true,
      "esm": true,
      "tests": true,
      "docs": true,
      "ci": true
    }
  },
  "licenses": {
    "approved": ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC"],
    "strictMode": true,
    "autoApprove": [],
    "checkDependencies": true,
    "allowPrerelease": false
  },
  "plugins": {
    "enabled": ["protocol", "security", "performance", "cors", "streaming"],
    "disabled": ["experimental-ai"],
    "loadPath": ["./plugins", "./node_modules/@my-org/cortexdx-plugins"],
    "config": {
      "security-scanner": {
        "owaspLevel": "high",
        "checkHeaders": true,
        "validateCerts": true
      },
      "performance-monitor": {
        "thresholds": {
          "responseTime": 1000,
          "memoryUsage": 100
        }
      }
    }
  },
  "observability": {
    "otel": {
      "enabled": true,
      "endpoint": "http://localhost:4318/v1/traces",
      "serviceName": "cortexdx",
      "headers": {}
    },
    "logging": {
      "level": "info",
      "format": "json",
      "destination": "stdout"
    },
    "metrics": {
      "enabled": true,
      "interval": 5000
    }
  },
  "networking": {
    "timeout": 30000,
    "retries": 3,
    "userAgent": "CortexDx-MCP/0.1.0",
    "proxy": {
      "http": "${HTTP_PROXY}",
      "https": "${HTTPS_PROXY}",
      "noProxy": ["localhost", "127.0.0.1"]
    },
    "tls": {
      "rejectUnauthorized": true,
      "ca": [],
      "cert": "",
      "key": ""
    }
  }
}
```

### Configuration Properties

#### LLM Configuration

- `backend`: LLM backend (`ollama` only)
- `model`: Model name (e.g., `gpt-oss-safeguard:latest`)
- `endpoint`: Backend endpoint URL
- `quantization`: Model quantization level
- `maxHistoryLength`: Maximum conversation history length
- `temperature`: Sampling temperature (0.0-1.0)
- `maxTokens`: Maximum tokens per response
- `timeout`: Request timeout in milliseconds

#### Diagnostics Configuration

- `suites`: Array of diagnostic suites to run by default
- `severity`: Minimum severity level to report
- `parallel`: Enable parallel plugin execution
- `maxConcurrency`: Maximum concurrent plugins
- `timeout`: Global timeout for diagnostics
- `budgets`: Resource budgets for plugin execution
- `retries`: Number of retries for failed operations
- `deterministic`: Enable deterministic mode

#### Output Configuration

- `directory`: Output directory for reports
- `formats`: Array of output formats to generate
- `filePlan`: Generate file plan patches
- `accessibility`: Enable accessibility-friendly output
- `colors`: Enable ANSI color codes
- `har`: Capture HTTP Archive files

#### Authentication Configuration

- `defaultScheme`: Default authentication scheme
- `schemes`: Named authentication configurations

#### Templates Configuration

- `organization`: Organization name for generated code
- `author`: Author information
- `license`: Default license for generated code
- `conventions`: Code style and naming conventions
- `features`: Default features to include in templates

#### Plugins Configuration

- `enabled`: Array of enabled plugin IDs
- `disabled`: Array of disabled plugin IDs
- `loadPath`: Additional paths to search for plugins
- `config`: Plugin-specific configuration

### Environment Variables

Environment variables override configuration file settings and support variable substitution in config files.

#### Core Variables

- `CORTEXDX_MCP_CONFIG`: Path to configuration file
- `CORTEXDX_MCP_LOG_LEVEL`: Log level (`debug`, `info`, `warn`, `error`)
- `CORTEXDX_MCP_CACHE_DIR`: Cache directory path
- `CORTEXDX_MCP_DATA_DIR`: Data directory path

#### LLM Variables

- `CORTEXDX_MCP_LLM_BACKEND`: LLM backend (must be `ollama`)
- `CORTEXDX_MCP_LLM_MODEL`: LLM model name
- `CORTEXDX_MCP_LLM_ENDPOINT`: LLM endpoint URL
- `CORTEXDX_MCP_LLM_TIMEOUT`: LLM request timeout

#### Authentication Variables

- `BEARER_TOKEN`: Bearer token for authentication
- `BASIC_USER`: Basic authentication username
- `BASIC_PASS`: Basic authentication password
- `API_KEY`: API key for header-based authentication

#### Network Variables

- `HTTP_PROXY`: HTTP proxy URL
- `HTTPS_PROXY`: HTTPS proxy URL
- `NO_PROXY`: Comma-separated list of hosts to bypass proxy

#### Observability Variables

- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry endpoint
- `OTEL_SERVICE_NAME`: Service name for tracing
- `OTEL_RESOURCE_ATTRIBUTES`: Additional resource attributes

### Configuration Validation

CortexDx validates configuration on startup and provides detailed error messages for invalid settings.

```bash
# Validate configuration
cortexdx doctor

# Example validation output
[brAInwav] Config: Loading from .cortexdx.json ✓
[brAInwav] Config: LLM backend 'ollama' available ✓
[brAInwav] Config: Model 'llama3.1' accessible ✓
[brAInwav] Config: All plugins loadable ✓
[brAInwav] Config: Authentication schemes valid ✓
```

### Configuration Examples

#### Minimal Configuration

```json
{
  "diagnostics": {
    "suites": ["protocol", "security"]
  }
}
```

#### Development Configuration

```json
{
  "llm": {
    "backend": "ollama",
    "model": "llama3.1"
  },
  "diagnostics": {
    "suites": ["protocol", "security", "performance"],
    "parallel": true,
    "deterministic": true
  },
  "output": {
    "formats": ["json", "markdown"],
    "colors": true
  }
}
```

#### Production Configuration

```json
{
  "diagnostics": {
    "suites": ["protocol", "security", "performance", "governance"],
    "severity": "major",
    "timeout": 60000,
    "budgets": {
      "timeMs": 10000,
      "memMb": 256
    }
  },
  "output": {
    "directory": "/var/log/cortexdx",
    "formats": ["json"],
    "accessibility": true,
    "colors": false,
    "har": true
  },
  "observability": {
    "otel": {
      "enabled": true,
      "endpoint": "https://otel-collector.example.com/v1/traces"
    },
    "logging": {
      "level": "warn",
      "format": "json"
    }
  }
}
```

## Output Formats

CortexDx generates multiple output formats to support different use cases and integrations.

### JSON Format

Machine-readable format for programmatic processing and CI/CD integration.

**File**: `cortexdx-findings.json`

**Structure**:

```json
{
  "endpoint": "https://api.example.com",
  "inspectedAt": "2024-11-06T10:30:00.000Z",
  "durationMs": 2500,
  "node": "v20.11.1",
  "findings": [
    {
      "id": "cors-missing-headers",
      "area": "security",
      "severity": "major",
      "title": "Missing CORS Headers",
      "description": "Server does not include proper CORS headers, which may prevent browser-based clients from connecting.",
      "evidence": [
        {
          "type": "url",
          "ref": "https://api.example.com/mcp"
        },
        {
          "type": "log",
          "ref": "Response headers: {\"content-type\": \"application/json\"}"
        }
      ],
      "tags": ["cors", "security", "browser-compatibility"],
      "confidence": 0.9,
      "recommendation": "Add Access-Control-Allow-Origin and other CORS headers"
    }
  ]
}
```

**Usage**:

```bash
# Generate JSON output
cortexdx diagnose http://localhost:3000 --out ./reports

# Process with jq
cat reports/cortexdx-findings.json | jq '.findings[] | select(.severity == "blocker")'

# CI/CD integration
if [ $(cat reports/cortexdx-findings.json | jq '.findings[] | select(.severity == "blocker") | length') -gt 0 ]; then
  echo "Blocker issues found, failing build"
  exit 1
fi
```

### Markdown Format

Human-readable format for documentation and reporting.

**File**: `cortexdx-report.md`

**Structure**:

```markdown
# CortexDx Diagnostic Report (brAInwav)

- Endpoint: https://api.example.com
- Date: 2024-11-06T10:30:00.000Z
- Duration: 2500ms

## [MAJOR] Missing CORS Headers

Server does not include proper CORS headers, which may prevent browser-based clients from connecting.

- Evidence: url:https://api.example.com/mcp, log:Response headers: {"content-type": "application/json"}

## [INFO] Protocol Version Supported

Server correctly implements MCP protocol version 2024-11-05.

- Evidence: url:https://api.example.com/mcp/capabilities

---

_Data policy: read-only; optional redacted HAR if --har._
```

**Features**:

- GitHub-flavored markdown
- Severity-based organization
- Evidence links
- Accessibility-friendly formatting
- Professional branding

### ArcTDD Format

Architecture Test-Driven Development format for technical implementation guidance.

**File**: `cortexdx-arctdd.md`

**Structure**:

```markdown
# ArcTDD Implementation Plan

## Overview

Based on diagnostic findings, this plan provides step-by-step implementation guidance following Architecture Test-Driven Development principles.

## Phase 1: Critical Issues (Blockers)

### 1.1 Fix Authentication Issues

**Problem**: Missing authentication headers causing connection failures.

**Test First**:
```typescript
describe('Authentication', () => {
  it('should accept valid bearer tokens', async () => {
    const response = await request(app)
      .get('/mcp/capabilities')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);
  });
});
```

**Implementation**:

1. Add authentication middleware
2. Validate bearer tokens
3. Return 401 for invalid tokens

**Verification**:

- Run authentication tests
- Verify with `cortexdx diagnose --auth bearer:test-token`

## Phase 2: Major Issues

### 2.1 Add CORS Support

**Problem**: Missing CORS headers preventing browser clients.

**Test First**:

```typescript
describe('CORS', () => {
  it('should include CORS headers', async () => {
    const response = await request(app)
      .options('/mcp/capabilities')
      .expect('Access-Control-Allow-Origin', '*');
  });
});
```

**Implementation**:

1. Install CORS middleware
2. Configure allowed origins
3. Add preflight handling

## Phase 3: Optimizations

### 3.1 Performance Improvements

**Problem**: Slow response times affecting user experience.

**Implementation**:

1. Add response caching
2. Optimize database queries
3. Implement connection pooling

```

### File Plan Format

Unified diff format for automated code fixes.

**File**: `cortexdx-fileplan.patch`

**Structure**:

```diff
--- a/src/server.ts
+++ b/src/server.ts
@@ -10,6 +10,12 @@ import express from 'express';
 
 const app = express();
 
+// Add CORS middleware
+app.use((req, res, next) => {
+  res.header('Access-Control-Allow-Origin', '*');
+  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
+  next();
+});
+
 app.get('/mcp/capabilities', (req, res) => {
   res.json({
     protocolVersion: '2024-11-05',

--- a/package.json
+++ b/package.json
@@ -15,6 +15,7 @@
   "dependencies": {
     "express": "^4.18.0",
+    "cors": "^2.8.5",
     "ws": "^8.18.0"
   }
 }
```

**Usage**:

```bash
# Generate file plan
cortexdx diagnose http://localhost:3000 --file-plan

# Apply patches (review first!)
git apply reports/cortexdx-fileplan.patch

# Or apply selectively
patch -p1 < reports/cortexdx-fileplan.patch
```

### HAR Format

HTTP Archive format for detailed network analysis (when `--har` flag is used).

**File**: `cortexdx-{timestamp}.har`

**Features**:

- Complete HTTP request/response capture
- Automatic credential redaction
- Performance timing data
- Network error details
- Browser DevTools compatible

**Security**:

- Authorization headers automatically redacted
- Cookie values masked
- Sensitive query parameters removed
- Custom redaction rules supported

### Custom Output Formats

#### Accessibility Format

When `--a11y` flag is used, output is optimized for screen readers:

```
BLOCKER: Authentication Required
Description: Server requires authentication but no credentials provided
Evidence: URL https://api.example.com/mcp returned 401 Unauthorized
Recommendation: Configure authentication using --auth flag

MAJOR: Missing CORS Headers  
Description: Server missing Cross-Origin Resource Sharing headers
Evidence: URL https://api.example.com/mcp missing Access-Control-Allow-Origin header
Recommendation: Add CORS middleware to server configuration
```

#### No-Color Format

When `--no-color` flag is used, ANSI color codes are stripped:

```
[BLOCKER] Authentication Required
[MAJOR] Missing CORS Headers
[INFO] Protocol Version Supported
```

### Output Integration

#### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run MCP Diagnostics
  run: |
    cortexdx diagnose ${{ env.MCP_ENDPOINT }} \
      --out ./reports \
      --deterministic

- name: Check for blockers
  run: |
    if [ $(jq '.findings[] | select(.severity == "blocker") | length' reports/cortexdx-findings.json) -gt 0 ]; then
      echo "::error::Blocker issues found"
      exit 1
    fi

- name: Upload reports
  uses: actions/upload-artifact@v3
  with:
    name: mcp-diagnostic-reports
    path: reports/
```

#### Monitoring Integration

```javascript
// Prometheus metrics from JSON output
const findings = JSON.parse(fs.readFileSync('reports/cortexdx-findings.json'));
const blockerCount = findings.findings.filter(f => f.severity === 'blocker').length;
const majorCount = findings.findings.filter(f => f.severity === 'major').length;

prometheus.register.getSingleMetric('mcp_blocker_findings').set(blockerCount);
prometheus.register.getSingleMetric('mcp_major_findings').set(majorCount);
```

## Events

### Plugin Events

```typescript
// Listen for plugin events
pluginHost.on('plugin:start', (plugin) => {
    console.log(`Plugin ${plugin.id} started`);
});

pluginHost.on('plugin:complete', (plugin, findings) => {
    console.log(`Plugin ${plugin.id} completed with ${findings.length} findings`);
});

pluginHost.on('plugin:error', (plugin, error) => {
    console.error(`Plugin ${plugin.id} failed:`, error);
});
```

### LLM Events

```typescript
// Listen for LLM events
llmAdapter.on('model:loaded', (modelId) => {
    console.log(`Model ${modelId} loaded`);
});

llmAdapter.on('conversation:start', (sessionId) => {
    console.log(`Conversation ${sessionId} started`);
});

llmAdapter.on('response:stream', (chunk) => {
    process.stdout.write(chunk);
});
```

## Error Handling

### Error Types

```typescript
class PluginError extends Error {
    constructor(
        public pluginId: string,
        message: string,
        public cause?: Error
    ) {
        super(message);
    }
}

class LlmError extends Error {
    constructor(
        public backend: string,
        message: string,
        public cause?: Error
    ) {
        super(message);
    }
}

class ProtocolError extends Error {
    constructor(
        public code: number,
        message: string
    ) {
        super(message);
    }
}
```

### Error Handling Example

```typescript
try {
    const findings = await plugin.run(ctx);
} catch (error) {
    if (error instanceof PluginError) {
        console.error(`Plugin ${error.pluginId} failed:`, error.message);
    } else if (error instanceof LlmError) {
        console.error(`LLM ${error.backend} error:`, error.message);
    } else {
        console.error('Unexpected error:', error);
    }
}
```

## Performance Requirements

CortexDx is designed for high-performance diagnostic operations with the following targets:

### Response Time Targets

- **Basic diagnostics**: <5 seconds for standard protocol checks
- **Full diagnostic suite**: <30 seconds for comprehensive analysis
- **LLM-powered analysis**: <10 seconds for AI-assisted diagnostics
- **Interactive responses**: <2 seconds for conversational interactions
- **Code generation**: <15 seconds for template generation
- **Error interpretation**: <3 seconds for error explanation

### Resource Limits

- **Memory usage**: <256MB total, <96MB per plugin
- **CPU usage**: <80% sustained, burst allowed for short periods
- **Network timeout**: 30 seconds default, configurable
- **Plugin execution**: 5 seconds per plugin, configurable

### Scalability Targets

- **Concurrent diagnostics**: Support 10+ parallel diagnostic runs
- **Plugin concurrency**: 4 plugins executing simultaneously
- **Large servers**: Handle servers with 100+ tools/resources
- **High-frequency monitoring**: 1-minute diagnostic intervals

### Performance Monitoring

```typescript
// Performance metrics are automatically collected
interface PerformanceMetrics {
    responseTimeMs: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    llmInferenceTimeMs?: number;
    diagnosticTimeMs: number;
    timestamp: number;
}

// Access metrics programmatically
const metrics = await runDiagnose({
    endpoint: 'http://localhost:3000',
    opts: { 
        suites: 'performance',
        collectMetrics: true 
    }
});
```

## TypeScript Types

### Core Type Exports

All types are exported from the main package for TypeScript development:

```typescript
import type {
    // Core interfaces
    DiagnosticPlugin,
    DiagnosticContext,
    Finding,
    EvidencePointer,
    Severity,
    
    // LLM interfaces
    LlmAdapter,
    EnhancedLlmAdapter,
    ConversationalLlmAdapter,
    ModelInfo,
    ChatMessage,
    
    // Development interfaces
    DevelopmentPlugin,
    DevelopmentContext,
    ConversationalPlugin,
    ConversationSession,
    
    // Configuration types
    DiagnoseOptions,
    SandboxBudgets,
    
    // Output types
    FilePlan,
    FilePlanItem,
    CodeSample,
    
    // Problem resolution types
    Problem,
    Solution,
    RankedSolution,
    CodeAnalysis,
    
    // Utility types
    SseResult,
    GovernancePack,
    PerformanceMetrics
} from '@brainwav/cortexdx';
```

### Type Definitions

#### Severity Levels

```typescript
type Severity = "info" | "minor" | "major" | "blocker";
```

#### Evidence Types

```typescript
interface EvidencePointer {
    type: 'url' | 'file' | 'log';
    ref: string;
    lines?: [number, number];
}
```

#### Plugin Categories

```typescript
type PluginCategory = "diagnostic" | "development" | "conversational";
```

#### LLM Backends

```typescript
type LlmBackend = 'ollama';
```

#### Authentication Schemes

```typescript
type AuthScheme = 'none' | 'bearer' | 'basic' | 'header';
```

### Generic Types

```typescript
// Generic request/response types
interface McpRequest<T = unknown> {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: T;
}

interface McpResponse<T = unknown> {
    jsonrpc: '2.0';
    id: string | number;
    result?: T;
    error?: McpError;
}

interface McpError {
    code: number;
    message: string;
    data?: unknown;
}
```

## Error Handling

### Error Types

CortexDx defines specific error types for different failure scenarios:

```typescript
// Plugin execution errors
class PluginError extends Error {
    constructor(
        public pluginId: string,
        message: string,
        public cause?: Error
    ) {
        super(message);
        this.name = 'PluginError';
    }
}

// LLM integration errors
class LlmError extends Error {
    constructor(
        public backend: string,
        message: string,
        public cause?: Error
    ) {
        super(message);
        this.name = 'LlmError';
    }
}

// MCP protocol errors
class ProtocolError extends Error {
    constructor(
        public code: number,
        message: string,
        public endpoint?: string
    ) {
        super(message);
        this.name = 'ProtocolError';
    }
}

// Configuration errors
class ConfigError extends Error {
    constructor(
        public configPath: string,
        message: string
    ) {
        super(message);
        this.name = 'ConfigError';
    }
}
```

### Error Handling Patterns

```typescript
// Graceful error handling in plugins
async function run(ctx: DiagnosticContext): Promise<Finding[]> {
    try {
        const result = await ctx.jsonrpc('method', params);
        return processResult(result);
    } catch (error) {
        if (error instanceof ProtocolError) {
            return [{
                id: 'protocol-error',
                area: 'protocol',
                severity: 'major',
                title: 'Protocol Error',
                description: `MCP protocol error: ${error.message}`,
                evidence: [{
                    type: 'log',
                    ref: `Error code: ${error.code}`
                }],
                confidence: 0.9
            }];
        }
        
        // Handle unexpected errors
        ctx.logger('Unexpected error:', error);
        return [{
            id: 'unexpected-error',
            area: 'diagnostic',
            severity: 'minor',
            title: 'Diagnostic Failed',
            description: 'Unexpected error during diagnostic',
            evidence: [{
                type: 'log',
                ref: error.message
            }],
            confidence: 0.5
        }];
    }
}
```

### Error Recovery

```typescript
// Retry logic with exponential backoff
async function requestWithRetry<T>(
    ctx: DiagnosticContext,
    method: string,
    params?: unknown,
    maxRetries = 3
): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await ctx.jsonrpc<T>(method, params);
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                ctx.logger(`Retry attempt ${attempt + 1} after ${delay}ms`);
            }
        }
    }
    
    throw lastError!;
}
```

## Resources

### Documentation

- [Getting Started Guide](./GETTING_STARTED.md) - Installation and basic usage
- [User Guide](./USER_GUIDE.md) - Comprehensive user documentation
- [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md) - Creating custom plugins
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment guidance
- [IDE Integration Guide](./IDE_INTEGRATION.md) - IDE setup and configuration

### External Resources

- [GitHub Repository](https://github.com/brainwav/cortexdx) - Source code and issues
- [npm Package](https://www.npmjs.com/package/@brainwav/cortexdx) - Package registry
- [MCP Specification](https://spec.modelcontextprotocol.io/) - Official MCP protocol specification
- [brAInwav Documentation](https://docs.brainwav.dev/) - Organization documentation

### Community

- [GitHub Discussions](https://github.com/brainwav/cortexdx/discussions) - Community support
- [Issue Tracker](https://github.com/brainwav/cortexdx/issues) - Bug reports and feature requests
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute to the project

### Examples

- [Example Plugins](https://github.com/brainwav/cortexdx/tree/main/examples/plugins) - Sample plugin implementations
- [Integration Examples](https://github.com/brainwav/cortexdx/tree/main/examples/integrations) - CI/CD and monitoring integrations
- [Configuration Examples](https://github.com/brainwav/cortexdx/tree/main/examples/configs) - Sample configuration files
