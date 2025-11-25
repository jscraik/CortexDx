---
applyTo: "**/src/orchestration/**/*.ts,**/src/self-healing/**/*.ts"
---

# Orchestration and Workflow Instructions

When working with CortexDx orchestration and self-healing workflows, follow these conventions:

## LangGraph Integration

CortexDx uses LangGraph for workflow orchestration:
- Graphs define workflow steps
- Policies enforce phase gates
- Checkpoints enable resumable runs

## Phase Machine

Follow the phase machine pattern (R→G→F→REVIEW):
- **R (Red)** - Write failing tests
- **G (Green)** - Implement to pass
- **F (Finished)** - Refactor, docs, a11y, security
- **REVIEW** - HITL permitted

> Any `human_input` before REVIEW is a policy violation.

## Required Conventions

- **Named exports only** - Never use `export default`
- **≤40 lines per function** - Split larger functions into helpers
- **No `any` types** - Use explicit types or type guards
- **ESM imports with `.js` extension** - Always use `from "./foo.js"`

## State Management

Workflow state uses SQLite checkpoints:
- Default: `.cortexdx/workflow-state.db`
- Override via `CORTEXDX_STATE_DB` or `--state-db`
- Treat state files as sensitive (never commit)

## Determinism

Support deterministic mode:
- Seed LLM adapter for reproducible conversations
- Respect `--deterministic` flag
- Use fixed timestamps when required

## Evidence Tokens

Emit required evidence tokens:
- `AGENTS_MD_SHA:<sha>` - AGENTS acknowledgement
- `brAInwav-vibe-check` - Vibe check log
- `PHASE_TRANSITION:*` - Phase transitions
- `MODELS:LIVE:OK` - Live model evidence

## Workflow Validation

Test workflows with:
```bash
pnpm test:integration                                    # Integration tests
cortexdx orchestrate --workflow agent.langgraph.baseline <endpoint>
```

## Self-Healing Patterns

For self-improvement workflows:
- Use pattern storage for learning
- Implement feedback loops
- Track confidence scores
- Include remediation suggestions

## Error Handling

Handle workflow failures gracefully:
- Emit findings for recoverable errors
- Checkpoint before risky operations
- Support resume from last checkpoint
