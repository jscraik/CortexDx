export interface ReActStep {
	thought: string;
	action?: { tool: string; input: Record<string, unknown> };
	observation?: unknown;
	trace: readonly string[];
}

export interface ReActResult {
	finalAnswer?: string;
	path: readonly ReActStep[];
	success: boolean;
}

interface ReActExecutorDeps {
	readonly toolExec: (tool: string, input: Record<string, unknown>) => Promise<unknown>;
	readonly emit: (event: string, payload: Record<string, unknown>) => void;
	readonly maxIters?: number;
}

export class ReActExecutor {
	private readonly maxIters: number;

	constructor(private readonly deps: ReActExecutorDeps) {
		this.maxIters = Math.max(1, deps.maxIters ?? 10);
	}

	async execute(goal: string, signal?: AbortSignal): Promise<ReActResult> {
		const path: ReActStep[] = [];
		this.deps.emit('reasoning.started', { goal });

		for (let index = 0; index < this.maxIters; index += 1) {
			if (signal?.aborted) {
				return this.abort(goal, path, 'aborted');
			}

			const step = this.createStep(goal, index, path);
			const input = this.createInput(goal, index, path);
			step.action = { tool: 'reasoning.plan', input };

			try {
				step.observation = await this.deps.toolExec(step.action.tool, step.action.input);
			} catch (error) {
				step.observation = { error: (error as Error).message };
				path.push(step);
				this.deps.emit('reasoning.step', { goal, index, step, errored: true });
				return this.complete(goal, path, undefined, false);
			}

			path.push(step);
			this.deps.emit('reasoning.step', { goal, index, step });

			const answer = this.extractAnswer(step);
			if (answer) {
				return this.complete(goal, path, answer, true);
			}

			if (signal?.aborted) {
				return this.abort(goal, path, 'aborted');
			}
		}

		return this.complete(goal, path, undefined, false);
	}

	private createStep(goal: string, index: number, history: readonly ReActStep[]): ReActStep {
		const prefix = history.length === 0 ? 'plan' : 'reflect';
		const trace = this.buildTrace(history, goal);
		const thought = `${prefix} step ${index + 1} for ${goal}`;
		return { thought, trace };
	}

	private createInput(
		goal: string,
		index: number,
		history: readonly ReActStep[],
	): Record<string, unknown> {
		const prior = history.map((entry) => ({
			thought: entry.thought,
			observation: entry.observation,
		}));
		return { goal, step: index, prior };
	}

	private extractAnswer(step: ReActStep): string | undefined {
		const observation = step.observation as
			| { done?: boolean; value?: unknown; summary?: unknown }
			| undefined;
		if (observation?.done === true) {
			const value = observation.value ?? observation.summary;
			return typeof value === 'string' ? this.stripFinalAnswerPrefix(value) : undefined;
		}

		const lowerThought = step.thought.toLowerCase();
		const marker = 'final answer';
		const markerIndex = lowerThought.indexOf(marker);
		if (markerIndex === -1) {
			return undefined;
		}

		const colonIndex = step.thought.indexOf(':', markerIndex);
		if (colonIndex === -1) {
			return undefined;
		}

		return step.thought.slice(colonIndex + 1).trim();
	}

	private stripFinalAnswerPrefix(value: string): string {
		const lower = value.toLowerCase();
		const marker = 'final answer';
		const markerIndex = lower.indexOf(marker);
		if (markerIndex === -1) {
			return value.trim();
		}

		const colonIndex = value.indexOf(':', markerIndex);
		if (colonIndex === -1) {
			return value.slice(markerIndex + marker.length).trim();
		}

		return value.slice(colonIndex + 1).trim();
	}

	private buildTrace(history: readonly ReActStep[], goal: string): string[] {
		if (history.length === 0) {
			return [`goal:${goal}`];
		}

		return history.slice(-3).map((entry, offset) => `${history.length - offset}:${entry.thought}`);
	}

	private abort(goal: string, path: readonly ReActStep[], reason: string): ReActResult {
		this.deps.emit('reasoning.aborted', { goal, reason, iterations: path.length });
		this.deps.emit('reasoning.completed', { goal, success: false, iterations: path.length });
		return { path, success: false };
	}

	private complete(
		goal: string,
		path: readonly ReActStep[],
		answer: string | undefined,
		success: boolean,
	): ReActResult {
		this.deps.emit('reasoning.completed', {
			goal,
			success,
			iterations: path.length,
			finalAnswer: answer,
		});
		return answer ? { finalAnswer: answer, path, success } : { path, success };
	}
}
