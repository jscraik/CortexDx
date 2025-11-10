import { describe, expect, it } from 'vitest';

import type { ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';
import { ReflexionEngine } from '@cortex-os/agent-toolkit/reasoning/ReflexionEngine.js';
import { ReasoningMemoryManager } from '@cortex-os/agent-toolkit/session/ReasoningMemory.js';

describe('ReflexionEngine', () => {
	const memory = new ReasoningMemoryManager();
	const engine = new ReflexionEngine({ memory });

	it('creates a reflection and improved attempt using memory context', async () => {
		const attempt: ReActStep[] = [
			{ thought: 'Summarise current status', observation: 'sparse data', trace: [] },
			{ thought: 'final answer: ready', observation: 'missing acceptance', trace: [] },
		];

		const episode = await engine.improve({
			attempt,
			feedback: 'Needs more acceptance criteria coverage',
		});

		expect(episode.reflection).toContain('acceptance criteria');
		expect(episode.improvedAttempt).toBeDefined();
		expect(episode.improvedAttempt?.at(-1)?.thought).toContain('final answer');

		const patterns = await memory.retrievePatterns('Summarise current status');
		expect(patterns[0]?.successRate).toBeGreaterThan(0);
	});
});
