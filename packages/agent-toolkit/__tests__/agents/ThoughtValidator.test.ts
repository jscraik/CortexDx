import { describe, expect, it } from 'vitest';

import type { ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';
import { ThoughtValidator } from '@cortex-os/agent-toolkit/agents/ThoughtValidator.js';

describe('ThoughtValidator', () => {
	const validator = new ThoughtValidator();

	it('accepts steps that satisfy the provided rules', async () => {
		const steps: ReActStep[] = [
			{ thought: 'Analyse log output', observation: 'logs inspected', trace: [] },
			{ thought: 'final answer: deploy', observation: 'no regressions', trace: [] },
		];

		const result = await validator.validate(steps, {
			rules: ['require-observation'],
			maxHallucinations: 0,
		});

		expect(result.isValid).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.suggestions).toHaveLength(0);
	});

	it('rejects paths that exceed hallucination budget', async () => {
		const steps: ReActStep[] = [
			{ thought: 'speculate outcome', observation: 'hallucination detected', trace: [] },
			{ thought: 'confirm speculation', observation: 'another hallucination', trace: [] },
		];

		const result = await validator.validate(steps, {
			rules: ['require-observation'],
			maxHallucinations: 1,
		});

		expect(result.isValid).toBe(false);
		expect(result.issues).toContain('hallucination-budget-exceeded');
		expect(result.suggestions).toContain('tighten-evaluation');
	});
});
