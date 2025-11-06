# API Reference

Complete API documentation for Insula MCP.

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

- `id`: Unique identifier for the plugin
- `title`: Human-readable plugin name
- `order`: Execution order (lower numbers run first)
- `run`: Main plugin execution function

**Example**:

```typescript
export const myPlugin: DiagnosticPlugin = {
    id: 'my-plugin',
    title: 'My Custom Plugin',
    order: 100,
    async run(ctx) {
        return [{
            severity: 'info',
            message: 'Plugin executed',
            category: 'info',
            confidence: 1.0
        }];
    }
};
```

### DiagnosticContext

Context provided to plugins during execution.

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

- `endpoint`: MCP server endpoint being diagnosed
- `headers`: Optional HTTP headers
- `logger`: Logging function
- `request`: HTTP request helper
- `jsonrpc`: JSON-RPC request helper
- `sseProbe`: Server-Sent Events probe helper
- `governance`: Governance pack (if available)
- `llm`: LLM adapter (if available)
- `evidence`: Evidence collection function
- `deterministic`: Deterministic mode flag

### Finding

Represents a diagnostic finding.

```typescript
interface Finding {
    severity: 'low' | 'medium' | 'high' | 'critical' | 'info';
    message: string;
    category: string;
    confidence: number;
    evidence?: EvidencePointer[];
    suggestion?: string;
    autoFixable?: boolean;
}
```

**Properties**:

- `severity`: Finding severity level
- `message`: Human-readable description
- `category`: Finding category (e.g., 'protocol', 'security')
- `confidence`: Confidence score (0.0 to 1.0)
- `evidence`: Optional evidence pointers
- `suggestion`: Optional fix suggestion
- `autoFixable`: Whether finding can be auto-fixed

### EvidencePointer

Points to evidence supporting a finding.

```typescript
interface EvidencePointer {
    type: 'url' | 'file' | 'log';
    value: string;
    metadata?: Record<string, unknown>;
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
    backend: 'ollama' | 'mlx' | 'llamacpp';
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
import { createOllamaAdapter, createMlxAdapter } from '@brainwav/insula-mcp';

// Ollama adapter
const ollama = createOllamaAdapter({
    endpoint: 'http://localhost:11434',
    model: 'llama3'
});

// MLX adapter (Apple Silicon)
const mlx = createMlxAdapter({
    model: 'mlx-community/Llama-3-8B-Instruct-4bit'
});

// Use adapter
const response = await ollama.complete('Explain MCP protocol');
```

## Plugin Development

### Code Generator Plugin

```typescript
interface CodeGeneratorPlugin extends DiagnosticPlugin {
    generateCode: (spec: CodeSpec, ctx: DiagnosticContext) => Promise<GeneratedCode>;
    generateFromNaturalLanguage: (description: string, ctx: DiagnosticContext) => Promise<GeneratedCode>;
    generateAPIConnector: (apiSpec: APISpec, ctx: DiagnosticContext) => Promise<MCPConnector>;
    getTemplates: () => Promise<TemplateInfo[]>;
    customizeTemplate: (templateId: string, customizations: TemplateCustomization) => Promise<GeneratedCode>;
}
```

### Interactive Plugin

```typescript
interface InteractivePlugin extends DiagnosticPlugin {
    startSession: (problem: string, ctx: DiagnosticContext) => Promise<SessionId>;
    processInput: (sessionId: SessionId, input: string, ctx: DiagnosticContext) => Promise<Response>;
    endSession: (sessionId: SessionId) => Promise<void>;
    askDiagnosticQuestion: (sessionId: SessionId, context: ProblemContext) => Promise<Question>;
    suggestNextStep: (sessionId: SessionId, currentState: SessionState) => Promise<NextStep>;
    validateSolution: (sessionId: SessionId, solution: Solution) => Promise<ValidationResult>;
}
```

### Problem Resolver Plugin

```typescript
interface ProblemResolverPlugin extends DiagnosticPlugin {
    analyzeError: (error: Error, context: ErrorContext) => Promise<ErrorAnalysis>;
    generateFix: (problem: Problem, strategy: FixStrategy) => Promise<Fix>;
    applyFix: (fix: Fix, target: MCPImplementation) => Promise<FixResult>;
    validateFix: (fix: Fix, originalProblem: Problem) => Promise<ValidationResult>;
    suggestMultipleSolutions: (problem: Problem) => Promise<RankedSolution[]>;
}
```

## CLI Commands

### diagnose

Run diagnostic suite on MCP server.

```bash
insula-mcp diagnose <endpoint> [options]
```

**Options**:

- `--suite <suites>`: Comma-separated list of suites to run
- `--severity <level>`: Minimum severity level (low, medium, high, critical)
- `--timeout <ms>`: Request timeout in milliseconds
- `--verbose`: Enable verbose logging
- `--debug`: Enable debug logging
- `--output <format>`: Output format (json, markdown, arctdd)
- `--deterministic`: Enable deterministic mode

**Example**:

```bash
insula-mcp diagnose http://localhost:3000 --suite protocol,security --verbose
```

### interactive

Start interactive development session.

```bash
insula-mcp interactive [options]
```

**Options**:

- `--model <name>`: LLM model to use
- `--backend <type>`: LLM backend (ollama, mlx, llamacpp)
- `--context <file>`: Load context from file

**Example**:

```bash
insula-mcp interactive --model llama3 --backend ollama
```

### generate

Generate MCP server or connector.

```bash
insula-mcp generate <type> [options]
```

**Types**:

- `server`: Generate MCP server
- `connector`: Generate API connector
- `tool`: Generate tool definition

**Options**:

- `--name <name>`: Server/connector name
- `--template <id>`: Template to use
- `--output <dir>`: Output directory

**Example**:

```bash
insula-mcp generate server --name my-server --template basic
```

### validate

Validate MCP protocol compliance.

```bash
insula-mcp validate <endpoint> [options]
```

**Options**:

- `--protocol <version>`: Protocol version to validate against
- `--strict`: Enable strict validation

**Example**:

```bash
insula-mcp validate http://localhost:3000 --protocol 2024-11-05
```

### compatibility

Test compatibility across MCP clients.

```bash
insula-mcp compatibility <endpoint> [options]
```

**Options**:

- `--clients <list>`: Comma-separated list of clients to test

**Example**:

```bash
insula-mcp compatibility http://localhost:3000 --clients claude-desktop,vscode
```

### doctor

Check Insula MCP installation and configuration.

```bash
insula-mcp doctor
```

Checks:

- LLM backend availability
- Plugin installation
- Configuration validity
- Network connectivity
- System requirements

## Configuration

### Configuration File

Create `.insula-mcp.json` in project root:

```json
{
  "llm": {
    "backend": "ollama",
    "model": "llama3",
    "endpoint": "http://localhost:11434",
    "quantization": "q4_0",
    "maxHistoryLength": 20
  },
  "diagnostics": {
    "suites": ["protocol", "security", "performance"],
    "severity": "medium",
    "parallel": true,
    "maxConcurrency": 4,
    "timeout": 30000
  },
  "templates": {
    "organization": "my-org",
    "conventions": {
      "naming": "kebab-case",
      "testing": "vitest",
      "codeStyle": "biome"
    }
  },
  "licenses": {
    "approved": ["MIT", "Apache-2.0", "BSD-3-Clause"],
    "strictMode": true,
    "autoApprove": []
  },
  "plugins": {
    "enabled": ["protocol", "security", "performance"],
    "disabled": [],
    "config": {
      "security-scanner": {
        "owaspLevel": "high"
      }
    }
  }
}
```

### Environment Variables

- `INSULA_MCP_CONFIG`: Path to configuration file
- `INSULA_MCP_LLM_BACKEND`: LLM backend (ollama, mlx, llamacpp)
- `INSULA_MCP_LLM_MODEL`: LLM model name
- `INSULA_MCP_LOG_LEVEL`: Log level (debug, info, warn, error)
- `INSULA_MCP_CACHE_DIR`: Cache directory path

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

All operations must meet these performance targets:

- LLM response: <2 seconds
- License validation: <3 seconds
- Protocol analysis: <30 seconds
- Interactive debugging session start: <10 seconds
- Code generation: <15 seconds
- Error interpretation: <5 seconds
- Performance profiling: millisecond precision
- Real-time monitoring: 1-second intervals

## TypeScript Types

All types are exported from the main package:

```typescript
import type {
    DiagnosticPlugin,
    DiagnosticContext,
    Finding,
    EvidencePointer,
    LlmAdapter,
    EnhancedLlmAdapter,
    CodeGeneratorPlugin,
    InteractivePlugin,
    ProblemResolverPlugin
} from '@brainwav/insula-mcp';
```

## Resources

- [Getting Started](./GETTING_STARTED.md)
- [Plugin Development](./PLUGIN_DEVELOPMENT.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [GitHub Repository](https://github.com/brainwav/insula-mcp)
