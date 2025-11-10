import type { ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';
import type { ReflexionEpisode } from '@cortex-os/agent-toolkit/reasoning/ReflexionEngine.js';

export interface ReasoningPattern {
	name: string;
	successRate: number;
}

export interface FailureMode {
	name: string;
	signature: string[];
}

export interface EpisodicRecord {
	timestamp: string;
	context: string;
	associations: string[];
	decayRate: number;
}

export interface Procedure {
	skillId: string;
	procedure: string;
	successRate: number;
	lastUsed: string;
}

interface PatternStats {
	successes: number;
	total: number;
}

export class ReasoningMemoryManager {
	private readonly episodic: EpisodicRecord[] = [];
	private readonly procedures: Procedure[] = [];
	private readonly patternStats = new Map<string, PatternStats>();

	async storeEpisode(episode: ReflexionEpisode): Promise<void> {
		const now = new Date().toISOString();
		const patternName = this.patternKey(episode.attempt);
		const stats = this.patternStats.get(patternName) ?? { successes: 0, total: 0 };
		stats.total += 1;
		if (episode.improvedAttempt && episode.improvedAttempt.length > 0) {
			stats.successes += 1;
			this.procedures.push({
				skillId: `procedure-${this.procedures.length + 1}`,
				procedure: this.serialiseAttempt(episode.improvedAttempt),
				successRate: this.computeSuccessRate(stats),
				lastUsed: now,
			});
		}
		this.patternStats.set(patternName, stats);

		this.episodic.push({
			timestamp: now,
			context: episode.feedback,
			associations: episode.attempt.map((step) => step.thought),
			decayRate: 0.1,
		});
	}

	async retrievePatterns(goal: string): Promise<ReasoningPattern[]> {
		const goalKey = goal.toLowerCase();
		const entries = Array.from(this.patternStats.entries())
			.filter(([name]) => name.includes(goalKey.split(' ')[0] ?? ''))
			.map(([name, stats]) => ({ name, successRate: this.computeSuccessRate(stats) }));

		if (entries.length === 0) {
			return Array.from(this.patternStats.entries()).map(([name, stats]) => ({
				name,
				successRate: this.computeSuccessRate(stats),
			}));
		}

		const sortedEntries = [...entries].sort((a, b) => b.successRate - a.successRate);
		return sortedEntries.slice(0, 5);
	}

	async analyzeFailure(mode: FailureMode): Promise<{ mitigations: string[] }> {
		const mitigations = new Set<string>();

		if (mode.signature.some((sig) => sig.toLowerCase().includes('context'))) {
			mitigations.add('add-context');
		}
		if (mode.signature.some((sig) => sig.toLowerCase().includes('test'))) {
			mitigations.add('add-tests');
		}
		if (mode.signature.some((sig) => sig.toLowerCase().includes('evidence'))) {
			mitigations.add('collect-evidence');
		}

		if (mitigations.size === 0 && this.procedures.length > 0) {
			mitigations.add('reuse-procedure');
		}

		return { mitigations: Array.from(mitigations) };
	}

	private computeSuccessRate(stats: PatternStats): number {
		return Number((stats.successes / Math.max(1, stats.total)).toFixed(2));
	}

	private patternKey(steps: ReActStep[]): string {
		const firstThought = steps[0]?.thought ?? 'unknown pattern';
		return firstThought.toLowerCase();
	}

	private serialiseAttempt(steps: ReActStep[]): string {
		return steps
			.map((step) => step.thought)
			.join(' -> ')
			.slice(0, 240);
	}
}
