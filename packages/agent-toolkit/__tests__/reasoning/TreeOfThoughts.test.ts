import { describe, expect, it, vi } from 'vitest';

import { TreeOfThoughtsExecutor } from '@cortex-os/agent-toolkit/reasoning/TreeOfThoughts.js';

describe('TreeOfThoughtsExecutor', () => {
	it('returns the highest scoring thought within the beam width', async () => {
		const expansions = new Map<string, string[]>([
			['root', ['consider edge cases', 'evaluate shortcuts']],
			['consider edge cases', ['derive final answer']],
			['evaluate shortcuts', ['attempt risky path']],
		]);

		const propose = vi.fn(async (prompt: string) => expansions.get(prompt) ?? []);
		const score = vi.fn(async (idea: string) => (idea.includes('final answer') ? 0.92 : 0.4));

		const executor = new TreeOfThoughtsExecutor({ propose, score });
		const result = await executor.explore('root', { maxDepth: 3, beamWidth: 2 });

		expect(result.content).toContain('final answer');
		expect(result.status).toBe('success');
		expect(result.parentId).toBeDefined();
		expect(propose).toHaveBeenCalledTimes(3);
		const path = executor.extractPath(result.id);
		expect(path.map((node) => node.content)).toEqual([
			'root',
			'consider edge cases',
			'derive final answer',
		]);
	});

	it('stops when the maximum depth is reached without success', async () => {
		const propose = vi.fn(async () => ['branch one', 'branch two']);
		const score = vi.fn(async () => 0.3);
		const executor = new TreeOfThoughtsExecutor({ propose, score });

		const result = await executor.explore('root problem', { maxDepth: 2, beamWidth: 1 });

		expect(result.status).toBe('pending');
		expect(result.children).toHaveLength(1);
		expect(propose).toHaveBeenCalledTimes(2);
	});
});
