# LLM Integration for CortexDx

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../../../../LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Ollama](https://img.shields.io/badge/Ollama-supported-black.svg)](https://ollama.ai/)
[![AI/ML](https://img.shields.io/badge/AI/ML-enabled-purple.svg)]()
[![Response Time](https://img.shields.io/badge/response-<2s-brightgreen.svg)]()

This module provides enhanced LLM integration for the CortexDx diagnostic system, enabling conversational development assistance and intelligent problem solving through local Ollama models.

## Features

- **Ollama-First Support**: Optimized local adapter for Apple Silicon and Linux hosts
- **Conversation Management**: Persistent sessions with context awareness
- **Performance Optimization**: <2s response time targeting with caching
- **Specialized Methods**: Code analysis, solution generation, and error explanation
- **Evidence Integration**: Full integration with existing diagnostic systems

## Quick Start

```typescript
import { createLlmOrchestrator, getEnhancedLlmAdapter } from '@brainwav/cortexdx';

// Create an orchestrator for managing LLM interactions
const orchestrator = createLlmOrchestrator({
  preferredBackend: 'auto', // or 'ollama'
  maxConcurrentSessions: 10,
  responseTimeoutMs: 2000
});

// Start a diagnostic session
const sessionId = await orchestrator.startDiagnosticSession(diagnosticContext, 'debugging');

// Analyze and explain a problem
const { explanation, suggestedActions } = await orchestrator.analyzeAndExplain(
  sessionId, 
  problem, 
  diagnosticContext
);

// Generate a solution
const solution = await orchestrator.generateSolution(
  sessionId,
  problem,
  constraints,
  diagnosticContext
);
```

## Adapters

### Ollama Adapter

- **Use Case**: General-purpose local LLM inference
- **Models**: Supports Llama, CodeLlama, Mistral, and other Ollama-compatible models
- **Features**: Model management, conversation context, streaming support

## Configuration

### Orchestrator Configuration

```typescript
interface OrchestratorConfig {
  preferredBackend?: 'ollama' | 'auto';
  maxConcurrentSessions?: number;
  sessionTimeoutMs?: number;
  responseTimeoutMs?: number;
  enableCaching?: boolean;
  cacheSize?: number;
}
```

### Adapter Configuration

```typescript
// Ollama
interface OllamaConfig {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
}

```

## Integration with Diagnostic Context

The LLM integration seamlessly works with the existing CortexDx diagnostic system:

```typescript
// The orchestrator integrates with DiagnosticContext
const diagnosticContext: DiagnosticContext = {
  endpoint: 'http://localhost:3000',
  logger: console.log,
  evidence: (ev) => console.log('Evidence:', ev),
  // ... other context properties
};

// Evidence is automatically created for LLM operations
await orchestrator.analyzeAndExplain(sessionId, problem, diagnosticContext);
// Creates evidence: { type: 'log', ref: 'llm-explanation-...' }
```

## Performance Monitoring

The orchestrator provides comprehensive metrics:

```typescript
// Get session metrics
const metrics = orchestrator.getSessionMetrics(sessionId);
console.log({
  messageCount: metrics.messageCount,
  averageResponseTime: metrics.averageResponseTime,
  backend: metrics.backend
});

// Get all active sessions
const allMetrics = orchestrator.getAllSessionMetrics();
console.log(`Active sessions: ${orchestrator.getActiveSessionCount()}`);
```

## Error Handling

All LLM operations include robust error handling with fallback responses:

```typescript
try {
  const solution = await orchestrator.generateSolution(sessionId, problem, constraints, context);
} catch (error) {
  // Fallback solution is provided even on errors
  console.error('LLM operation failed:', error.message);
}
```

## Requirements

- **Ollama**: Requires Ollama to be installed and running locally
- **Node.js**: Version 20+ for optimal performance

## Development

The LLM integration follows brAInwav CODESTYLE standards:

- Named exports only
- Functions ≤40 lines
- Proper TypeScript typing
- AbortSignal support for async operations
- Integration with existing adapter patterns

See the main [Contributing Guide](../../../../CONTRIBUTING.md) for complete development setup and coding standards.

## Support

For issues or questions:

- **GitHub Issues**: [CortexDx Issues](https://github.com/jscraik/CortexDx/issues)
- **Documentation**: See main [CortexDx Documentation](../../../../README.md)
- **Ollama Documentation**: <https://ollama.ai/docs>

## License

Licensed under the [Apache License 2.0](../../../../LICENSE)
