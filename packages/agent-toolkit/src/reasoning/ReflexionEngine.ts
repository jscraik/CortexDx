import type { ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';

import { ReasoningMemoryManager } from '@cortex-os/agent-toolkit/session/ReasoningMemory.js';

export interface ReflexionEpisode {
	attempt: ReActStep[];
	feedback: string;
	reflection?: string;
	improvedAttempt?: ReActStep[];
}

interface ReflexionEngineDeps {
	readonly memory?: ReasoningMemoryManager;
}

export class ReflexionEngine {
	constructor(private readonly deps: ReflexionEngineDeps = {}) {}

	async improve(episode: ReflexionEpisode): Promise<ReflexionEpisode> {
		const reflection = this.composeReflection(episode.feedback);
		const improvedAttempt = this.rewriteAttempt(episode.attempt, reflection);
		const enriched: ReflexionEpisode = {
			...episode,
			reflection,
			improvedAttempt,
		};

		if (this.deps.memory) {
			await this.deps.memory.storeEpisode(enriched);
		}

		return enriched;
	}

	private composeReflection(feedback: string): string {
		const trimmed = feedback.trim();
		return trimmed.length === 0
			? 'Reflection: No feedback provided'
			: `Reflection: ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
	}

	private rewriteAttempt(attempt: ReActStep[], reflection: string): ReActStep[] {
		if (attempt.length === 0) {
			return [
				{
					thought: `final answer: ${this.normaliseReflection(reflection)}`,
					trace: [],
				},
			];
		}

		return attempt.map((step, index) => {
			const thought =
				index === attempt.length - 1
					? `final answer: ${this.normaliseReflection(reflection)}`
					: `${step.thought} (revisited)`;
			return {
				thought,
				action: step.action,
				observation: step.observation,
				trace: step.trace,
			};
		});
	}

	private normaliseReflection(reflection: string): string {
		return reflection.replace(/^Reflection:\s*/i, '').trim();
	}
}
