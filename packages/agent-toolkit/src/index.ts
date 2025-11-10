// Domain exports

export {
	ensureAgentsCompliant,
	verifyAgents,
	verifyAgentsFast,
} from './agents/governance/verifyAgents.js';
export { DefaultToolRegistry } from './app/ToolRegistry.js';
// Application layer exports
export {
	BatchToolExecutorUseCase,
	CodeQualityUseCase,
	CodeSearchUseCase,
	ToolExecutorUseCase,
} from './app/UseCases.js';
export {
	ReasoningToolExecutorUseCase,
	type ReasoningMode,
} from './use-cases/ReasoningToolExecutorUseCase.js';
export {
	MultiAgentOrchestrator,
	type AgentRole,
} from './agents/MultiAgentOrchestrator.js';
export {
	ThoughtValidator,
	type ValidationCriteria,
} from './agents/ThoughtValidator.js';
export type {
	ToolExecutionContext,
	ToolExecutionEvents,
	ToolExecutor,
} from './domain/ToolExecutor.js';
export type {
	CodemapTool,
	CodemodTool,
	SearchTool,
	ToolRegistry,
	ValidationTool,
} from './domain/ToolInterfaces.js';
export { CodemapAdapter } from './infra/CodemapAdapter.js';
export { CombyAdapter } from './infra/CodemodAdapters.js';
// Infrastructure adapters
export {
	AstGrepAdapter,
	RipgrepAdapter,
	SemgrepAdapter,
} from './infra/SearchAdapters.js';
export {
	CargoAdapter,
	ESLintAdapter,
	MultiValidatorAdapter,
	RuffAdapter,
} from './infra/ValidationAdapters.js';

// Convenience factory function
import { DefaultToolRegistry } from '@cortex-os/agent-toolkit/app/ToolRegistry.js';
// Direct import to avoid relying on dist type generation for newly added tooling events
// Local duplication of tooling event type constants to avoid direct cross-package source import
// when contracts build output (dist) is not present. Keep in sync with contracts tooling/events.ts.
import type { AgentToolkitCodemapInput, AgentToolkitResult } from '@cortex-os/contracts';

const TOOLING_EVENT_TYPES = {
	TOOL_RUN_COMPLETED: 'tool.run.completed',
	PIPELINE_RUN_COMPLETED: 'pipeline.run.completed',
} as const;

const getResultError = (result: AgentToolkitResult): string | undefined =>
	'error' in result && typeof (result as { error?: string }).error === 'string'
		? (result as { error?: string }).error
		: undefined;

const getResultCount = (result: AgentToolkitResult): string | undefined =>
	Array.isArray(result.results) ? `results=${result.results.length}` : undefined;

import {
	CodeQualityUseCase,
	CodeSearchUseCase,
	ToolExecutorUseCase,
} from '@cortex-os/agent-toolkit/app/UseCases.js';
import {
	CodemapAdapter,
	type CodemapAdapterOptions,
} from '@cortex-os/agent-toolkit/infra/CodemapAdapter.js';
import { CombyAdapter } from '@cortex-os/agent-toolkit/infra/CodemodAdapters.js';
import {
	AstGrepAdapter,
	RipgrepAdapter,
	SemgrepAdapter,
} from '@cortex-os/agent-toolkit/infra/SearchAdapters.js';
import {
	CargoAdapter,
	ESLintAdapter,
	MultiValidatorAdapter,
	RuffAdapter,
} from '@cortex-os/agent-toolkit/infra/ValidationAdapters.js';

/**
 * Factory function to create a fully configured agent toolkit instance
 */
export interface AgentToolkitOptions {
	toolsPath?: string;
	// Optional event publisher for tooling events (CloudEvents or internal bus)
	publishEvent?: (event: {
		type: string; // e.g. tool.run.completed
		data: Record<string, unknown>;
	}) => void | Promise<void>;
	// Optional run identifier/grouping for pipeline events
	pipelineRunId?: string;
	codemap?: CodemapAdapterOptions;
}

export function createAgentToolkit(toolsPathOrOptions?: string | AgentToolkitOptions) {
	const opts: AgentToolkitOptions =
		typeof toolsPathOrOptions === 'string'
			? { toolsPath: toolsPathOrOptions }
			: toolsPathOrOptions || {};
	const { toolsPath } = opts;
	const registry = new DefaultToolRegistry();

	// Register search tools
	registry.registerSearchTool('ripgrep', new RipgrepAdapter(toolsPath));
	registry.registerSearchTool('semgrep', new SemgrepAdapter(toolsPath));
	registry.registerSearchTool('ast-grep', new AstGrepAdapter(toolsPath));

	// Register codemod tools
	registry.registerCodemodTool('comby', new CombyAdapter(toolsPath));

	// Register validation tools
	registry.registerValidationTool('eslint', new ESLintAdapter(toolsPath));
	registry.registerValidationTool('ruff', new RuffAdapter(toolsPath));
	registry.registerValidationTool('cargo', new CargoAdapter(toolsPath));
	registry.registerValidationTool('multi-validator', new MultiValidatorAdapter(toolsPath));

	const codemapOptions: CodemapAdapterOptions = {
		workingDirectory: opts.codemap?.workingDirectory ?? process.cwd(),
		scriptPath: opts.codemap?.scriptPath,
		pythonExecutable: opts.codemap?.pythonExecutable,
		timeoutMs: opts.codemap?.timeoutMs,
	};
	registry.registerCodemapTool('codemap', new CodemapAdapter(codemapOptions));

	// Wrap ToolExecutorUseCase with emission callbacks when publisher provided
	let executor = new ToolExecutorUseCase(registry);
	if (opts.publishEvent) {
		// Generate correlation ID for each execution context
		const correlationIds = new WeakMap<object, string>();

		executor = new ToolExecutorUseCase(registry, {
			onStart: (ctx) => {
				try {
					// Generate and store correlation ID
					const correlationId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
					correlationIds.set(ctx, correlationId);

					const p = opts.publishEvent?.({
						type: 'cortex.agent_toolkit.tool.execution.started',
						data: {
							tool: ctx.toolId.split('-')[0], // Extract tool name
							correlationId,
							startedAt: new Date().toISOString(),
							sessionId: ctx.sessionId,
							requestedBy: ctx.requestedBy,
						},
					});
					if (p && typeof (p as Promise<unknown>).then === 'function')
						(p as Promise<unknown>).catch(() => {});
				} catch {
					/* ignore */
				}
			},
			onComplete: (ctx, result, duration) => {
				try {
					const errorMessage = getResultError(result);
					const contextSummary = getResultCount(result);
					const correlationId = correlationIds.get(ctx);

					const p = opts.publishEvent?.({
						type: 'cortex.agent_toolkit.tool.execution.completed',
						data: {
							tool: result.tool,
							correlationId,
							finishedAt: new Date().toISOString(),
							durationMs: duration,
							status: errorMessage ? 'error' : 'success',
							resultSource: 'direct',
							errorMessage,
							contextSummary,
						},
					});
					if (p && typeof (p as Promise<unknown>).then === 'function')
						(p as Promise<unknown>).catch(() => {});

					// Also emit legacy event for backward compatibility
					const legacyP = opts.publishEvent?.({
						type: TOOLING_EVENT_TYPES.TOOL_RUN_COMPLETED,
						data: {
							toolName: result.tool,
							durationMs: duration,
							success: !errorMessage,
							error: errorMessage,
							contextSummary,
						},
					});
					if (legacyP && typeof (legacyP as Promise<unknown>).then === 'function')
						(legacyP as Promise<unknown>).catch(() => {});
				} catch {
					/* ignore */
				}
			},
			onError: (ctx, error, duration) => {
				try {
					const correlationId = correlationIds.get(ctx);

					const p = opts.publishEvent?.({
						type: 'cortex.agent_toolkit.tool.execution.completed',
						data: {
							tool: ctx.toolId.split('-')[0],
							correlationId,
							finishedAt: new Date().toISOString(),
							durationMs: duration,
							status: 'error',
							resultSource: 'direct',
							errorCode: 'internal_error',
							errorMessage: error.message,
						},
					});
					if (p && typeof (p as Promise<unknown>).then === 'function')
						(p as Promise<unknown>).catch(() => {});

					// Also emit legacy event for backward compatibility
					const legacyP = opts.publishEvent?.({
						type: TOOLING_EVENT_TYPES.TOOL_RUN_COMPLETED,
						data: {
							toolName: 'unknown',
							durationMs: duration,
							success: false,
							error: error.message,
						},
					});
					if (legacyP && typeof (legacyP as Promise<unknown>).then === 'function')
						(legacyP as Promise<unknown>).catch(() => {});
				} catch {
					/* ignore */
				}
			},
		});
	}

	const api = {
		executor,
		registry,
		// Convenience methods
		search: (pattern: string, path: string) => executor.execute('ripgrep', { pattern, path }),
		multiSearch: (pattern: string, path: string) =>
			new CodeSearchUseCase(executor).multiSearch(pattern, path),
		multiSearchWithContext: (
			pattern: string,
			path: string,
			opts?: {
				tokenBudget?: { maxTokens: number; trimToTokens?: number };
				useTreeSitter?: boolean;
			},
		) => new CodeSearchUseCase(executor).multiSearchWithContext(pattern, path, opts),
		codemod: (find: string, replace: string, path: string) =>
			executor.execute('comby', { find, replace, path }),
		validate: (files: string[]) => executor.execute('multi-validator', { files }),
		validateProject: (files: string[]) => new CodeQualityUseCase(executor).validateProject(files),
		generateCodemap: (input: AgentToolkitCodemapInput) => executor.execute('codemap', input),
		validateProjectSmart: (
			files: string[],
			opts?: {
				tokenBudget?: { maxTokens: number; trimToTokens?: number };
				useTreeSitter?: boolean;
				maxFiles?: number;
			},
		) => new CodeQualityUseCase(executor).validateProjectSmart(files, opts),
	} as const;

	// Optionally emit a synthetic pipeline.run.completed when pipelineRunId provided
	if (opts.publishEvent && opts.pipelineRunId) {
		try {
			const p = opts.publishEvent({
				type: TOOLING_EVENT_TYPES.PIPELINE_RUN_COMPLETED,
				data: { runId: opts.pipelineRunId, status: 'success', artifactRefs: [] },
			});
			if (p && typeof (p as Promise<unknown>).then === 'function')
				(p as Promise<unknown>).catch(() => {});
		} catch {
			/* ignore */
		}
	}

	return api;
}

/**
 * Default instance using standard tools path
 */
export const agentToolkit = createAgentToolkit();

// Diagnostics / Observability
export {
	generateHomebrewFormula,
	generatePrometheusMetrics,
	type HomebrewFormulaOptions,
	type RunDiagnosticsOptions,
	runDiagnostics,
} from './diagnostics/diagnostics.js';
// A2A Events
export {
	type CodeModificationEvent,
	createAgentToolkitEvent,
	type SearchResultsEvent,
	type ToolExecutionStartedEvent,
	type ValidationReportEvent,
	type ReasoningAbortedEvent,
	type ReasoningCompletedEvent,
	type ReasoningStartedEvent,
	type ReasoningStepEvent,
} from './events/agent-toolkit-events.js';
export {
	ReActExecutor,
	type ReActResult,
	type ReActStep,
} from './reasoning/ReActExecutor.js';
export {
	TreeOfThoughtsExecutor,
	type ThoughtNode,
	type ThoughtStatus,
} from './reasoning/TreeOfThoughts.js';
export {
	ProgramOfThoughtExecutor,
	type ProgramStep,
} from './reasoning/ProgramOfThought.js';
export {
	ReflexionEngine,
	type ReflexionEpisode,
} from './reasoning/ReflexionEngine.js';
export {
	ReasoningGraphTracker,
	type ReasoningNode,
	type ReasoningNodeType,
} from './reasoning/ReasoningGraph.js';
export { AgentToolkitMcpRuntime } from './mcp/runtime.js';
// MCP Integration
export { createAgentToolkitMcpTools } from './mcp/tools.js';
// Resilient execution (Phase 3.5)
export {
	type CircuitBreakerOptions,
	createResilientExecutor,
	type ResilientExecutor,
	type ResilientExecutorOptions,
	type RetryOptions,
} from './resilience/ResilientExecutor.js';
export {
	type BuildContextOptions,
	buildChunkedContext,
	type ChunkedContext,
} from './semantics/ContextBuilder.js';
// Semantics
export {
	type Chunk,
	type ChunkOptions,
	chunkText,
	createSemanticChunker,
} from './semantics/SemanticChunker.js';
export {
	createTreeSitterProvider,
	type TsBoundary,
	type TsProvider,
} from './semantics/TreeSitterBoundary.js';
// Session management (Phase 1)
export {
	createSessionContextManager,
	type SessionContextManager,
	type SessionContextOptions,
	type SessionSnapshot,
	type ToolCallRecord,
} from './session/SessionContextManager.js';
// Session persistence (Phase 3.3)
export {
	createSessionPersistence,
	type SessionMetadata,
	type SessionPersistence,
	type SessionPersistenceOptions,
} from './session/SessionPersistence.js';
export {
	createTokenBudget,
	type TokenBudget,
	type TokenBudgetConfig,
	type TokenizedItem,
} from './session/TokenBudget.js';
export {
	createToolCallHistory,
	type ToolCallEntry,
	type ToolCallHistory,
	type ToolCallHistoryOptions,
} from './session/ToolCallHistory.js';
export {
	ReasoningMemoryManager,
	type EpisodicRecord,
	type FailureMode,
	type Procedure,
	type ReasoningPattern,
} from './session/ReasoningMemory.js';
