import { describe, expect, it } from 'vitest';

import { ProgramOfThoughtExecutor } from '@cortex-os/agent-toolkit/reasoning/ProgramOfThought.js';

describe('ProgramOfThoughtExecutor', () => {
	const executor = new ProgramOfThoughtExecutor();

	it('generates a program with dependency ordering and result', async () => {
		const outcome = await executor.run('Compute sum of 2 and 3');

		expect(outcome.program).toHaveLength(3);
		expect(outcome.program.at(-1)?.operation).toBe('add');
		expect(outcome.result).toBe(5);
		expect(outcome.trace).toContain('x2=5');
	});

	it('throws when timeout budget is exceeded', async () => {
		await expect(executor.run('Generate primes up to 1000', { timeoutMs: 0 })).rejects.toThrow(
			'program-of-thought timeout',
		);
	});
});
