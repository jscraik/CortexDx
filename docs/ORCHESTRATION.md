# LangGraph Orchestration & Checkpointing

CortexDx ships two orchestration stacks:

- **Plugin workflows** – deterministic sequences/parallel batches driven by `PluginOrchestrator`.
- **Agent workflows** – LangGraph-based flows (Req 17.x/18.x) that checkpoint state, resume threads, and reuse the same plugin catalog.

This guide documents the fastest way to run them via CLI or MCP, resume runs deterministically, and keep evidence aligned with ArcTDD.

## CLI Usage (`cortexdx orchestrate`)

```bash
# Inspect available workflows (LangGraph + plugin)
cortexdx orchestrate --list

# Run the default LangGraph baseline with deterministic behavior
cortexdx orchestrate https://mcp.example.com \
  --workflow agent.langgraph.baseline \
  --deterministic \
  --state-db .cortexdx/workflow-state.db

# Resume a prior thread from its last checkpoint
cortexdx orchestrate https://mcp.example.com \
  --workflow agent.langgraph.security \
  --resume-thread agent-thread-1731276251000
```

Key options:

- `--state-db <path>` or `CORTEXDX_STATE_DB` sets the SQLite checkpoint store (defaults to `.cortexdx/workflow-state.db`). Paths are resolved per invocation so you can isolate CI vs. local runs.
- `--resume-thread <id>`/`--resume-checkpoint <id>` reloads serialized LangGraph state. If the combination is missing, the CLI fails fast rather than re-running probes.
- `--mode development --expertise <level>` wraps the diagnostic context in the development helper so conversational/self-improvement plugins reuse the same Ollama-backed adapter.
- `--stream` emits LangGraph node events (ordered) for observability tools.

Always finish a phase by running `pnpm lint && pnpm test && pnpm build` plus at least one deterministic `cortexdx diagnose --suites security` so the reports and workflows stay in sync.

## Asynchronous Operations & MCP Spec Alignment

**Note**: The upcoming MCP specification (November 2025) emphasizes support for long-running operations with status polling and callbacks. CortexDx's LangGraph-based orchestration already provides the foundation for these capabilities.

### Current Async Capabilities

CortexDx already supports asynchronous, resumable operations through:

1. **Persistent State Storage**: SQLite checkpoints preserve workflow state across restarts
2. **Thread Resumption**: `--resume-thread` allows restarting interrupted runs from last checkpoint
3. **Deterministic Replay**: Checkpoint-based recovery without re-executing completed steps
4. **Long-Running Support**: Workflows can run for hours and resume across process restarts

Example of current async workflow:

```bash
# Start long-running diagnostic (may take hours)
cortexdx orchestrate https://mcp.example.com \
  --workflow agent.langgraph.comprehensive \
  --state-db .cortexdx/workflows.db

# Returns: thread_id=agent-thread-1731789600000

# Process can be stopped/restarted - resume from checkpoint:
cortexdx orchestrate https://mcp.example.com \
  --workflow agent.langgraph.comprehensive \
  --resume-thread agent-thread-1731789600000
```

### Upcoming Enhancements (MCP Spec Alignment)

To fully align with the new MCP async operation model, planned enhancements include:

#### Status Polling
```bash
# Future: Query status of long-running operation
cortexdx orchestrate --status agent-thread-1731789600000

# Returns: { status: 'in_progress', progress: 45, eta: '10m', currentStage: 'security-scan' }
```

#### Webhook Notifications
```bash
# Future: Register callback for completion
cortexdx orchestrate https://mcp.example.com \
  --workflow agent.langgraph.security \
  --callback https://your-server.com/webhook \
  --callback-events progress,complete,error
```

**Supported callback events:**
- `progress` - Workflow progress updates (percentage, stage changes)
- `complete` - Workflow completion with final results
- `error` - Workflow errors and failures
- `paused` - Workflow paused (if pause/resume is implemented)
- `resumed` - Workflow resumed after pause

Events should be specified as a comma-separated list. Invalid event names will be rejected at runtime.

#### Progress Tracking
Enhanced checkpoint metadata will expose:
- Current operation stage and substep
- Percentage complete (0-100)
- Estimated time to completion
- Partial results available for streaming
- Resource usage metrics

#### Timeout Configuration
```bash
# Future: Configure operation timeouts
cortexdx orchestrate https://mcp.example.com \
  --workflow agent.langgraph.baseline \
  --timeout 3600 \
  --checkpoint-interval 300
```

See [MCP Spec Migration](MCP_SPEC_MIGRATION.md) for full async operation roadmap and migration timeline.

## MCP Tool Exposure

Agent workflows are now exposed as first-class MCP tools (see `src/tools/agent-orchestration-tools.ts`):

| Tool | Purpose | Required Inputs |
|------|---------|-----------------|
| `cortexdx_agent_list_workflows` | Enumerate agent workflows + checkpoint metadata | *(optional)* `stateDb` |
| `cortexdx_agent_execute_workflow` | Run LangGraph workflows with deterministic/thread controls | `workflowId`, `endpoint` (plus optional `stateDb`, `threadId`, resume fields, headers, `mode`, `stream`) |
| `cortexdx_agent_checkpoint_history` | Inspect stored sessions + transitions | `workflowId` *(optional `threadId`, `limit`, `stateDb`)* |

When driving these tools from another MCP client:

1. Provide the target MCP endpoint plus any auth headers in the tool input.
2. Set `stateDb` if you want isolated checkpoint stores per workspace/CI job.
3. Capture the returned `threadId`/`checkpointId` and feed them back into future executions to resume without repeating probes.

## Checkpoint Hygiene & Determinism

- **SQLite pathing** – the orchestrator now caches state managers per database path, so swapping `--state-db` works without restarting the CLI. Keep CI paths (`$CI_ARTIFACTS/cortexdx/workflows.db`) separate from local runs to avoid permissions issues.
- **Cleanup** – remove old runs with `rm .cortexdx/workflow-state.db` if you want a clean slate, or prune via SQL (table `workflow_checkpoints`).
- **Thread naming** – pass a stable `--thread-id` (or `resume-thread`) when you want automation to attach to the same story; otherwise CortexDx auto-generates `agent-thread-<timestamp>` identifiers.
- **Deterministic seeds** – `--deterministic` plus stable thread ids ensure Ollama prompts, findings, and checkpoint snapshots align exactly between reruns, satisfying ArcTDD reproducibility.

## Related Commands & Scripts

- `pnpm security:*` scripts (Semgrep, gitleaks, ZAP) should run after orchestration updates so security suites and workflows stay aligned.
- `pnpm test` will now execute `agent-orchestration-tools.spec.ts` by default, confirming MCP tool surfaces keep working with the LangGraph checkpoint stack.

For architectural context, review `packages/cortexdx/src/orchestration/*` and the FASTMCP Phase 3 PRD inside `.insula/rules/vision.md`.
