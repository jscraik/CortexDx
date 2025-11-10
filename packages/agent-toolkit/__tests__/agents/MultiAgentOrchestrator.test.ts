import { describe, expect, it, vi } from 'vitest';

import type { ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';
import { MultiAgentOrchestrator } from '@cortex-os/agent-toolkit/agents/MultiAgentOrchestrator.js';
import { ThoughtValidator } from '@cortex-os/agent-toolkit/agents/ThoughtValidator.js';

describe('MultiAgentOrchestrator', () => {
	const validator = new ThoughtValidator();

	it('builds consensus from validated agent proposals', async () => {
		const deliberate = vi.fn(async (agent: { id: string }) => {
			const agentId = agent.id;
			const sharedSteps: ReActStep[] = [
				{ thought: 'analyse evidence', observation: 'ok', trace: [] },
			];
			return {
				agentId,
				proposal: 'Adopt plan A',
				confidence: agentId === 'critic' ? 0.7 : 0.8,
				steps: sharedSteps,
			};
		});

		const orchestrator = new MultiAgentOrchestrator({
			deliberate,
			validator,
		});

		const outcome = await orchestrator.coordinate('Ship feature safely', [
			{ id: 'reasoner', role: 'reasoner', capabilities: ['reason'], model: 'gpt-5' },
			{ id: 'critic', role: 'critic', capabilities: ['critique'], model: 'gpt-5' },
		]);

		expect(outcome.consensus).toBe('Adopt plan A');
		expect(outcome.confidence).toBeCloseTo(0.75, 5);
		expect(outcome.paths.get('reasoner')).toHaveLength(1);
		expect(outcome.paths.get('critic')).toHaveLength(1);
		expect(deliberate).toHaveBeenCalledTimes(2);
	});

	it('falls back to no-consensus when validator rejects proposals', async () => {
		const deliberate = vi.fn(async (agent: { id: string }) => ({
			agentId: agent.id,
			proposal: agent.id === 'reasoner' ? 'Risky shortcut' : 'Adopt fallback',
			confidence: 0.6,
			steps: [{ thought: '', trace: [], observation: undefined }],
		}));

		const orchestrator = new MultiAgentOrchestrator({
			deliberate,
			validator,
		});

		const outcome = await orchestrator.coordinate(
			'Ship feature safely',
			[
				{ id: 'reasoner', role: 'reasoner', capabilities: ['reason'], model: 'gpt-5' },
				{ id: 'verifier', role: 'verifier', capabilities: ['verify'], model: 'gpt-5' },
			],
			{ rounds: 1 },
		);

		expect(outcome.consensus).toBe('No consensus');
		expect(outcome.confidence).toBeCloseTo(0.2, 5);
		expect(Array.from(outcome.paths.values()).flat()).toHaveLength(0);
	});
});
