# Orchestration

This directory contains workflow orchestration logic using LangGraph for complex, stateful diagnostic workflows.

## Overview

CortexDx uses **LangGraph** (from LangChain) to orchestrate multi-step diagnostic workflows with:
- **Persistent state** across workflow steps
- **Conditional branching** based on diagnostic results
- **Human-in-the-loop** decision points
- **Checkpointing** for resumable workflows

## Components

### Core Files

#### `agent-orchestrator.ts`
Main orchestrator using LangGraph StateGraph to create and execute diagnostic workflows.

**Key Classes:**
- `AgentOrchestrator` - Creates and manages LangGraph workflows
- `WorkflowDefinition` - Defines workflow structure (nodes, edges, config)
- `CompiledWorkflow` - Ready-to-execute workflow graph

#### `workflow-types.ts`
Shared type definitions for workflow state and configuration.

**Key Interfaces:**
- `WorkflowState` - State that flows through the graph
- `WorkflowConfig` - Workflow metadata and settings
- `WorkflowNode` - Individual step in the workflow
- `WorkflowEdge` - Transitions between steps

#### `state-manager.ts`
Persistent state management using SQLite for workflow checkpointing.

**Features:**
- Save/restore workflow state
- Multi-version checkpointing
- State recovery after crashes
- Cleanup of expired checkpoints

#### `plugin-orchestrator.ts`
Orchestrates plugin execution in stages with dependency management.

**Features:**
- Parallel plugin execution within stages
- Inter-plugin dependencies
- Resource budgeting
- Progress tracking

### Workflow Features

#### `conditional-branching.ts`
Defines conditional logic for workflow routing.

```typescript
const workflow = createWorkflow({
  nodes: [/* ... */],
  edges: [
    {
      from: "analysis",
      to: "deep-dive",
      condition: (state) => state.hasBlockers // Conditional edge
    }
  ]
});
```

#### `human-in-loop.ts`
Implements human decision points in workflows.

```typescript
const humanDecision = await requestHumanInput({
  prompt: "Apply suggested fix?",
  options: ["yes", "no", "review"],
  timeout: 300000 // 5 minute timeout
});
```

#### `workflow-runtime.ts`
Runtime execution engine for workflows.

#### `workflow-visualization.ts`
Generate visual representations of workflows (Mermaid diagrams).

### Pre-built Workflows

#### `default-workflows.ts`
Common workflow templates:

- **Standard Diagnostic** - Basic plugin execution
- **Security Audit** - Security-focused deep scan
- **Performance Analysis** - Performance profiling workflow
- **Self-Healing** - Automated fix generation and application

## Usage Examples

### Basic Workflow Creation

```typescript
import { AgentOrchestrator } from './agent-orchestrator.js';

const orchestrator = new AgentOrchestrator();

// Define workflow
const workflow = orchestrator.createWorkflow({
  config: {
    workflowId: "my-workflow",
    name: "Custom Diagnostic",
    description: "Custom diagnostic workflow",
    enableCheckpointing: true
  },
  nodes: [
    {
      id: "discover",
      name: "Discovery",
      type: "plugin",
      pluginId: "discovery"
    },
    {
      id: "analyze",
      name: "Analysis",
      type: "aggregation",
      handler: async (state) => ({
        /* analysis logic */
      })
    }
  ],
  edges: [
    { from: "discover", to: "analyze" }
  ],
  entryPoint: "discover"
});

// Execute workflow
const result = await orchestrator.executeWorkflow(workflow, initialState);
```

### Conditional Workflow

```typescript
const workflow = orchestrator.createWorkflow({
  config: { /* ... */ },
  nodes: [
    { id: "scan", type: "plugin", pluginId: "security-scanner" },
    { id: "shallow-fix", type: "plugin", pluginId: "auto-fix" },
    { id: "deep-analysis", type: "plugin", pluginId: "deep-scan" }
  ],
  edges: [
    { from: "scan", to: "shallow-fix", condition: (s) => !s.hasBlockers },
    { from: "scan", to: "deep-analysis", condition: (s) => s.hasBlockers }
  ],
  entryPoint: "scan"
});
```

### Human-in-the-Loop Workflow

```typescript
import { createHumanInputNode } from './human-in-loop.js';

const workflow = orchestrator.createWorkflow({
  nodes: [
    { id: "analyze", type: "plugin", pluginId: "analyzer" },
    {
      id: "human-decision",
      type: "human_input",
      handler: createHumanInputNode({
        prompt: "Review findings and choose action:",
        options: ["auto-fix", "manual-review", "skip"],
        timeout: 600000 // 10 minutes
      })
    },
    { id: "auto-fix", type: "plugin", pluginId: "fixer" }
  ],
  edges: [
    { from: "analyze", to: "human-decision" },
    {
      from: "human-decision",
      to: "auto-fix",
      condition: (s) => s.userResponse === "auto-fix"
    }
  ]
});
```

## State Management

### Workflow State Schema

```typescript
interface WorkflowState {
  // Core data
  endpoint: string;
  findings: Finding[];
  errors: string[];

  // Execution metadata
  currentNode: string;
  visitedNodes: string[];
  executionPath: string[];

  // Decision data
  severity: "info" | "minor" | "major" | "blocker" | null;
  findingCount: number;
  hasBlockers: boolean;

  // Human-in-the-loop
  awaitingUserInput: boolean;
  userPrompt?: string;
  userResponse?: string;

  // Context
  context: DiagnosticContext;
  config: WorkflowConfig;

  // Performance
  startTime: number;
  nodeTimings: Record<string, number>;
}
```

### Checkpointing

```typescript
// Enable checkpointing
const workflow = orchestrator.createWorkflow({
  config: {
    workflowId: "resumable-workflow",
    enableCheckpointing: true,
    checkpointPath: "./.cortexdx/state/checkpoints.db"
  },
  /* ... */
});

// Resume from checkpoint
const recovered = await stateManager.recoverState({
  workflowId: "resumable-workflow",
  threadId: "abc123"
});
```

## Architecture

```
orchestration/
├── agent-orchestrator.ts      # Main LangGraph orchestrator
├── workflow-types.ts           # Shared type definitions
├── state-manager.ts            # SQLite persistence
├── plugin-orchestrator.ts      # Plugin execution orchestration
├── conditional-branching.ts    # Conditional routing
├── human-in-loop.ts            # Human decision points
├── workflow-runtime.ts         # Execution engine
├── workflow-visualization.ts   # Mermaid diagram generation
├── default-workflows.ts        # Pre-built workflows
├── state-manager-factory.ts    # State manager creation
├── orchestrate-options.ts      # Configuration options
└── index.ts                    # Public exports
```

## Performance Considerations

- **Checkpointing overhead**: ~50ms per checkpoint write
- **State size**: Keep state small (<10MB) for fast serialization
- **Long-running workflows**: Use timeouts to prevent indefinite execution
- **Memory**: Each workflow instance uses ~50-100MB RAM

## Testing

```bash
pnpm test tests/langgraph-integration.spec.ts
pnpm test tests/agent-orchestration-tools.spec.ts
pnpm test tests/integration-workflow.spec.ts
```

## Related

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Self-Healing System](../self-healing/README.md)
- [Plugin System](../plugins/README.md)
- [Architecture Diagrams](../../../docs/ARCHITECTURE.md#diagnostic-workflow)
