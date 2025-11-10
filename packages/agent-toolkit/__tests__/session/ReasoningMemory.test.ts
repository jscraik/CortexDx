import { describe, expect, it } from 'vitest';

import type { ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';
import {
	ReasoningMemoryManager,
	type FailureMode,
} from '@cortex-os/agent-toolkit/session/ReasoningMemory.js';
import type { ReflexionEpisode } from '@cortex-os/agent-toolkit/reasoning/ReflexionEngine.js';

describe('ReasoningMemoryManager', () => {
	it('stores episodes and surface useful patterns', async () => {
		const manager = new ReasoningMemoryManager();
		const attempt: ReActStep[] = [
			{ thought: 'Explore alternatives', observation: 'option A', trace: [] },
			{ thought: 'final answer: pick option A', observation: 'confidence high', trace: [] },
		];

		const episode: ReflexionEpisode = {
			attempt,
			feedback: 'Great coverage',
			improvedAttempt: attempt,
		};

		await manager.storeEpisode(episode);

		const patterns = await manager.retrievePatterns('Explore alternatives');
		expect(patterns[0]).toMatchObject({
			name: 'explore alternatives',
			successRate: expect.any(Number),
		});

		const failure: FailureMode = {
			name: 'lack-of-context',
			signature: ['context'],
		};
		const mitigation = await manager.analyzeFailure(failure);
		expect(mitigation.mitigations).toContain('add-context');
	});
});
