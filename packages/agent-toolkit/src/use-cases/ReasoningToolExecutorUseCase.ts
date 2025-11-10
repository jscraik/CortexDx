import type { ReActResult, ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';
import { ReActExecutor } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';
import type { ToolExecutor } from '@cortex-os/agent-toolkit/domain/ToolExecutor.js';
import type { AgentToolkitInput, AgentToolkitResult } from '@cortex-os/contracts';
import type { ThoughtNode } from '@cortex-os/agent-toolkit/reasoning/TreeOfThoughts.js';
import { TreeOfThoughtsExecutor } from '@cortex-os/agent-toolkit/reasoning/TreeOfThoughts.js';
import type { AgentRole } from '@cortex-os/agent-toolkit/agents/MultiAgentOrchestrator.js';
import { MultiAgentOrchestrator } from '@cortex-os/agent-toolkit/agents/MultiAgentOrchestrator.js';
import type { ReflexionEpisode } from '@cortex-os/agent-toolkit/reasoning/ReflexionEngine.js';
import { ReflexionEngine } from '@cortex-os/agent-toolkit/reasoning/ReflexionEngine.js';
import type { ReasoningNode } from '@cortex-os/agent-toolkit/reasoning/ReasoningGraph.js';
import { ReasoningGraphTracker } from '@cortex-os/agent-toolkit/reasoning/ReasoningGraph.js';
import type { ProgramStep } from '@cortex-os/agent-toolkit/reasoning/ProgramOfThought.js';
import { ProgramOfThoughtExecutor } from '@cortex-os/agent-toolkit/reasoning/ProgramOfThought.js';

export type ReasoningMode = 'react' | 'tot' | 'reflexion' | 'multi-agent' | 'program';

interface ReasoningToolExecutorDeps {
	readonly toolExecutor: ToolExecutor;
	readonly reAct: ReActExecutor;
	readonly treeOfThoughts?: TreeOfThoughtsExecutor;
	readonly orchestrator?: MultiAgentOrchestrator;
	readonly reflexion?: ReflexionEngine;
	readonly reasoningGraph?: ReasoningGraphTracker;
	readonly programOfThought?: ProgramOfThoughtExecutor;
	readonly emit?: (event: string, payload: Record<string, unknown>) => void;
}

interface ExecuteWithReasoningOptions {
	readonly signal?: AbortSignal;
	readonly agents?: readonly AgentRole[];
	readonly tot?: { maxDepth?: number; beamWidth?: number };
	readonly reflexionFeedback?: string;
	readonly consensusRounds?: number;
	readonly program?: { timeoutMs?: number };
}

interface ReasoningGraphSummary {
	readonly nodes: ReasoningNode[];
	readonly bestPath: readonly string[];
	readonly hasCycles: boolean;
}

interface ModeOutcome {
	readonly path: ReActStep[];
	readonly confidence: number;
	readonly graph?: ReasoningGraphSummary;
	readonly thoughtPath?: ThoughtNode[];
	readonly reflection?: string;
	readonly consensus?: {
		readonly outcome: string;
		readonly participants: readonly string[];
		readonly confidence: number;
	};
	readonly agentPaths?: Map<string, ReActStep[]>;
	readonly program?: {
		readonly steps: ProgramStep[];
		readonly result: unknown;
		readonly trace: readonly string[];
	};
}

export class ReasoningToolExecutorUseCase {
	constructor(private readonly deps: ReasoningToolExecutorDeps) {}

	async executeWithReasoning<T = AgentToolkitResult>(
		toolName: string,
		inputs: AgentToolkitInput,
		mode: ReasoningMode = 'react',
		opts?: ExecuteWithReasoningOptions,
	): Promise<{
		result: T;
		path: readonly ReActStep[];
		confidence: number;
		mode: ReasoningMode;
		reasoningGraph?: ReasoningGraphSummary;
		thoughtPath?: ThoughtNode[];
		reflection?: string;
		consensus?: {
			readonly outcome: string;
			readonly participants: readonly string[];
			readonly confidence: number;
		};
		agentPaths?: Map<string, ReActStep[]>;
		program?: {
			readonly steps: ProgramStep[];
			readonly result: unknown;
			readonly trace: readonly string[];
		};
	}> {
		const goal = this.buildGoal(toolName, inputs);
		const outcome = await this.runMode(goal, mode, opts);
		const result = (await this.deps.toolExecutor.execute(toolName, inputs)) as T;

		return {
			result,
			path: outcome.path,
			confidence: outcome.confidence,
			mode,
			reasoningGraph: outcome.graph,
			thoughtPath: outcome.thoughtPath,
			reflection: outcome.reflection,
			consensus: outcome.consensus,
			agentPaths: outcome.agentPaths,
			program: outcome.program,
		};
	}

	private async runMode(
		goal: string,
		mode: ReasoningMode,
		opts: ExecuteWithReasoningOptions | undefined,
	): Promise<ModeOutcome> {
		switch (mode) {
			case 'react':
				return this.wrapWithGraph(goal, await this.runReAct(goal, opts?.signal));
			case 'tot':
				return this.wrapWithGraph(goal, await this.runTreeOfThoughts(goal, opts));
			case 'reflexion':
				return this.wrapWithGraph(goal, await this.runReflexion(goal, opts));
			case 'multi-agent':
				return this.wrapWithGraph(goal, await this.runMultiAgent(goal, opts));
			case 'program':
				return this.wrapWithGraph(goal, await this.runProgram(goal, opts));
			default:
				throw new Error(`Reasoning mode '${mode}' not yet supported`);
		}
	}

	private buildGoal(toolName: string, inputs: AgentToolkitInput): string {
		return `Run ${toolName} for ${this.describeInputs(inputs)}`;
	}

	private describeInputs(inputs: AgentToolkitInput): string {
		if ('pattern' in inputs && typeof inputs.pattern === 'string') {
			return inputs.pattern;
		}

		if ('find' in inputs && 'replace' in inputs) {
			return `${inputs.find} -> ${inputs.replace}`;
		}

		if ('files' in inputs && Array.isArray(inputs.files)) {
			return inputs.files.slice(0, 3).join(', ');
		}

		return 'the requested task';
	}

	private async wrapWithGraph(goal: string, outcome: ModeOutcome): Promise<ModeOutcome> {
		if (!this.deps.reasoningGraph || outcome.path.length === 0) {
			return outcome;
		}

		const graph = await this.buildGraph(outcome.path);
		if (graph) {
			this.emit('reasoning.graph.updated', { goal, graph, iterations: outcome.path.length });
			return { ...outcome, graph };
		}

		return outcome;
	}

	private async buildGraph(path: readonly ReActStep[]): Promise<ReasoningGraphSummary | undefined> {
		const tracker = this.deps.reasoningGraph;
		if (!tracker || path.length === 0) {
			return undefined;
		}

		const cloned = path.map((step) => ({ ...step }));
		const result = await tracker.build(cloned);
		const nodes = result.nodes;
		return {
			nodes,
			bestPath: tracker.bestPath(nodes),
			hasCycles: tracker.hasCycles(nodes),
		};
	}

	private async runReAct(goal: string, signal?: AbortSignal): Promise<ModeOutcome> {
		const outcome = await this.deps.reAct.execute(goal, signal);
		const confidence = this.calculateReactiveConfidence(outcome);
		return { path: [...outcome.path], confidence };
	}

	private async runTreeOfThoughts(
		goal: string,
		opts: ExecuteWithReasoningOptions | undefined,
	): Promise<ModeOutcome> {
		const executor = this.ensureTreeOfThoughts();
		const node = await executor.explore(goal, opts?.tot);
		const pathNodes = executor.extractPath(node.id);
		const path = pathNodes.map((entry) => ({
			thought: entry.content,
			trace: [] as string[],
			observation: undefined,
		}));
		const confidence = this.estimateTotConfidence(node);
		return { path, confidence, thoughtPath: pathNodes };
	}

	private async runReflexion(
		goal: string,
		opts: ExecuteWithReasoningOptions | undefined,
	): Promise<ModeOutcome> {
		const engine = this.ensureReflexion();
		const baseline = await this.deps.reAct.execute(goal, opts?.signal);
		const episode: ReflexionEpisode = await engine.improve({
			attempt: [...baseline.path],
			feedback: opts?.reflexionFeedback ?? 'Auto-reflection requested',
		});
		const path = episode.improvedAttempt ?? episode.attempt;
		const confidence = this.estimateReflexionConfidence(episode, baseline.success);
		return { path, confidence, reflection: episode.reflection };
	}

	private async runMultiAgent(
		goal: string,
		opts: ExecuteWithReasoningOptions | undefined,
	): Promise<ModeOutcome> {
		const orchestrator = this.ensureOrchestrator();
		const agents = opts?.agents;
		if (!agents || agents.length === 0) {
			throw new Error('Reasoning mode "multi-agent" requires at least one agent role');
		}
		const outcome = await orchestrator.coordinate(goal, agents, { rounds: opts?.consensusRounds });
		const consensus = {
			outcome: outcome.consensus,
			participants: Array.from(outcome.paths.keys()),
			confidence: outcome.confidence,
		};
		this.emit('reasoning.consensus', {
			goal,
			consensus: outcome.consensus,
			confidence: outcome.confidence,
			participants: consensus.participants,
		});
		const aggregated = this.flattenAgentPaths(outcome.paths);
		return {
			path: aggregated,
			confidence: Number(outcome.confidence.toFixed(2)),
			consensus,
			agentPaths: outcome.paths,
		};
	}

	private async runProgram(
		goal: string,
		opts: ExecuteWithReasoningOptions | undefined,
	): Promise<ModeOutcome> {
		const executor = this.ensureProgramOfThought();
		const program = await executor.run(goal, opts?.program);
		const path = program.trace.map((line) => ({
			thought: line,
			trace: [] as string[],
			observation: undefined,
		}));
		const confidence = this.estimateProgramConfidence(program);
		return {
			path,
			confidence,
			program: {
				steps: program.program,
				result: program.result,
				trace: program.trace,
			},
		};
	}

	private calculateReactiveConfidence(outcome: ReActResult): number {
		if (!outcome.success) {
			return 0.35;
		}
		const steps = Math.max(1, outcome.path.length);
		const confidence = 1 - (steps - 1) * 0.1;
		return Number(Math.max(0.5, confidence).toFixed(2));
	}

	private estimateTotConfidence(node: ThoughtNode): number {
		const base = node.score ?? 0.5;
		return Number(Math.min(0.95, 0.5 + base * 0.5).toFixed(2));
	}

	private estimateReflexionConfidence(episode: ReflexionEpisode, baselineSuccess: boolean): number {
		const boost = episode.improvedAttempt && episode.improvedAttempt.length > 0 ? 0.2 : 0;
		const base = baselineSuccess ? 0.6 : 0.45;
		return Number(Math.min(0.95, base + boost).toFixed(2));
	}

	private estimateProgramConfidence(program: { trace: readonly string[] }): number {
		return Number(Math.min(0.9, 0.6 + program.trace.length * 0.05).toFixed(2));
	}

	private flattenAgentPaths(paths: Map<string, ReActStep[]>): ReActStep[] {
		const [first] = paths.values();
		if (!first) {
			return [];
		}
		return [...first].map((step) => ({ ...step, trace: Array.from(step.trace) }));
	}

	private ensureTreeOfThoughts(): TreeOfThoughtsExecutor {
		if (!this.deps.treeOfThoughts) {
			throw new Error('Reasoning mode "tot" requires TreeOfThoughtsExecutor dependency');
		}
		return this.deps.treeOfThoughts;
	}

	private ensureReflexion(): ReflexionEngine {
		if (!this.deps.reflexion) {
			throw new Error('Reasoning mode "reflexion" requires ReflexionEngine dependency');
		}
		return this.deps.reflexion;
	}

	private ensureOrchestrator(): MultiAgentOrchestrator {
		if (!this.deps.orchestrator) {
			throw new Error('Reasoning mode "multi-agent" requires MultiAgentOrchestrator dependency');
		}
		return this.deps.orchestrator;
	}

	private ensureProgramOfThought(): ProgramOfThoughtExecutor {
		if (!this.deps.programOfThought) {
			throw new Error('Reasoning mode "program" requires ProgramOfThoughtExecutor dependency');
		}
		return this.deps.programOfThought;
	}

	private emit(event: string, payload: Record<string, unknown>) {
		this.deps.emit?.(event, payload);
	}
}
