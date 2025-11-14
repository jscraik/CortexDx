# LLM Integration for CortexDx

This module provides enhanced LLM integration for the CortexDx diagnostic system, enabling conversational development assistance and intelligent problem solving.

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
