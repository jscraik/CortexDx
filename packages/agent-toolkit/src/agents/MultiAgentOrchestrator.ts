import type { ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';

import { ThoughtValidator } from './ThoughtValidator.js';

export interface AgentRole {
	readonly id: string;
	readonly role: 'reasoner' | 'critic' | 'verifier' | 'synthesizer';
	readonly capabilities: readonly string[];
	readonly model: string;
}

interface DeliberationResult {
	readonly agentId: string;
	readonly proposal: string;
	readonly confidence: number;
	readonly steps: ReActStep[];
}

interface DebateSnapshot extends DeliberationResult {
	readonly valid: boolean;
	readonly issues: readonly string[];
}

interface OrchestratorDeps {
	readonly deliberate: (
		agent: AgentRole,
		problem: string,
		history: readonly DebateSnapshot[],
	) => Promise<DeliberationResult>;
	readonly validator: ThoughtValidator;
}

interface CoordinateOptions {
	readonly rounds?: number;
}

interface VoteBucket {
	confidence: number;
	readonly members: Set<string>;
	readonly paths: Map<string, ReActStep[]>;
}

export class MultiAgentOrchestrator {
	private readonly deliberate: OrchestratorDeps['deliberate'];
	private readonly validator: ThoughtValidator;

	constructor(deps: OrchestratorDeps) {
		this.deliberate = deps.deliberate;
		this.validator = deps.validator;
	}

	async coordinate(
		problem: string,
		agents: readonly AgentRole[],
		opts: CoordinateOptions = {},
	): Promise<{ consensus: string; paths: Map<string, ReActStep[]>; confidence: number }> {
		const rounds = Math.max(1, opts.rounds ?? 2);
		const history: DebateSnapshot[] = [];
		const tallies = new Map<string, VoteBucket>();

		for (let round = 0; round < rounds; round += 1) {
			for (const agent of agents) {
				const deliberation = await this.deliberate(agent, problem, history);
				const verdict = await this.validator.validate(deliberation.steps, {
					rules: ['require-observation', 'non-empty-thoughts'],
					maxHallucinations: 0,
				});

				history.push({ ...deliberation, valid: verdict.isValid, issues: verdict.issues });

				if (!verdict.isValid) {
					continue;
				}

				const bucket = this.ensureBucket(tallies, deliberation.proposal);
				bucket.confidence += deliberation.confidence;
				bucket.members.add(agent.id);
				bucket.paths.set(agent.id, deliberation.steps);
			}
		}

		return this.finaliseOutcome(tallies);
	}

	private ensureBucket(store: Map<string, VoteBucket>, key: string): VoteBucket {
		if (!store.has(key)) {
			store.set(key, {
				confidence: 0,
				members: new Set<string>(),
				paths: new Map<string, ReActStep[]>(),
			});
		}
		return store.get(key)!;
	}

	private finaliseOutcome(tallies: Map<string, VoteBucket>) {
		if (tallies.size === 0) {
			return { consensus: 'No consensus', paths: new Map<string, ReActStep[]>(), confidence: 0.2 };
		}

		let best: { proposal: string; bucket: VoteBucket; score: number } | undefined;
		for (const [proposal, bucket] of tallies.entries()) {
			const members = Math.max(1, bucket.members.size);
			const average = bucket.confidence / members;
			const score = average + members * 0.05;
			if (!best || score > best.score) {
				best = { proposal, bucket, score };
			}
		}

		const { proposal, bucket } = best!;
		const members = Math.max(1, bucket.members.size);
		const confidence = Number(Math.min(0.99, bucket.confidence / members).toFixed(2));
		return { consensus: proposal, paths: bucket.paths, confidence };
	}
}
