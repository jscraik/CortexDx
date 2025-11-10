import { describe, expect, it } from 'vitest';

import type { ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';
import { ReasoningGraphTracker } from '@cortex-os/agent-toolkit/reasoning/ReasoningGraph.js';

describe('ReasoningGraphTracker', () => {
	const tracker = new ReasoningGraphTracker();

	it('builds nodes and detects cycles', async () => {
		const steps: ReActStep[] = [
			{
				thought: 'Investigate failing tests',
				action: { tool: 'search', input: { pattern: 'FAIL', path: '.' } },
				observation: { logs: 4 },
				trace: [],
			},
			{
				thought: 'final answer: patch regression',
				observation: 'Resolved',
				trace: [],
			},
		];

		const graph = await tracker.build(steps);
		expect(graph.nodes.length).toBeGreaterThan(0);
		const hasCycle = tracker.hasCycles(graph.nodes);
		expect(hasCycle).toBe(false);
		const path = tracker.bestPath(graph.nodes);
		expect(path[0]).toContain('thought');
		expect(path.at(-1)).toContain('conclusion');
	});
});
