# Reasoning Architecture Overview

This document captures the developer-facing view of the Agent Toolkit reasoning stack introduced on 2025-11-05.

## Components

- **ReActExecutor** — Deterministic ReAct loop with event emission (`reasoning.*`) and tool execution hooks. Inject tool executor + emitter for testability, supports abort semantics.
- **TreeOfThoughtsExecutor** — Beam-search explorer that expands proposals via injected `propose` and `score` functions. Caps depth/width to avoid runaway exploration.
- **TreeOfThoughtsExecutor.extractPath** — Produces an ordered trace of nodes for downstream consumers (Reasoning Graph, audits, evidence packs).
- **MultiAgentOrchestrator** — Coordinates reasoner/critic/verifier/synthesizer roles using injected `deliberate` callback + `ThoughtValidator`. Tracks consensus confidence and per-agent reasoning traces.
- **ThoughtValidator** — Rule-based validation of reasoning paths (`require-observation`, `non-empty-thoughts`, hallucination budgets) returning remediation suggestions.
- **ReflexionEngine** — Generates reflections from feedback, rewrites attempts, and persists episodes into `ReasoningMemoryManager`.
- **ReasoningGraphTracker** — Converts `ReActStep[]` into graph nodes with cycle detection and best-path scoring for observability.
- **ReasoningMemoryManager** — Maintains episodic/procedural slots, pattern success rates, and failure mitigations.
- **ProgramOfThoughtExecutor** — Produces dependency-ordered programs with timeout guards for programmatic reasoning traces.

## Event Model

New `reasoning.*` events (`started`, `step`, `completed`, `aborted`, `graph.updated`, `consensus`) are emitted by executors and validated via `packages/agent-toolkit/src/events/agent-toolkit-events.ts`.

`ReasoningToolExecutorUseCase` emits:

- `reasoning.graph.updated` — includes persisted graph nodes, best-path, and cycle flag for evidence packs.
- `reasoning.consensus` — summary of multi-agent deliberation with participants + confidence.

Consumers can turn ergonomic events into strongly typed payloads via `createAgentToolkitEvent.reasoningGraphUpdated/consensus` helpers.

### Reasoning Modes

`ReasoningToolExecutorUseCase.executeWithReasoning` now supports five deterministic modes:

| Mode | Summary |
| --- | --- |
| `react` | Original ReAct execution with confidence heuristics + graph summary |
| `tot` | Tree-of-Thoughts exploration, returning ordered `thoughtPath` and confidence from node score |
| `reflexion` | Runs ReAct then Reflexion using episodic memory to improve attempts |
| `multi-agent` | Delegates to `MultiAgentOrchestrator`, emits consensus event, returns aggregate traces |
| `program` | Executes Program-of-Thought with deterministic program steps + trace |

Every mode returns `path`, `confidence`, and optional metadata (`reasoningGraph`, `thoughtPath`, `consensus`, `program`).

## Determinism & Testing

All components accept injected dependencies and expose deterministic defaults so Vitest suites can run without live models. Aborts/timeouts are observable through emitted events or thrown errors.

## Extensibility

- Plug alternative search/scoring policies via dependency injection (Tree-of-Thoughts).
- Extend validator rules by adding new rule IDs + remediation mappings.
- Persist reasoning evidence by swapping `ReasoningMemoryManager` with storage-backed implementation respecting the same interface.
