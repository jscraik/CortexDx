import { describe, expect, it, vi } from 'vitest';

import { ReActExecutor } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';

const createStub = () => {
	const observations = [
		{ summary: 'gather context', done: false },
		{ summary: 'final answer: success', done: true, value: 'Ship it' },
	];
	const toolExec = vi
		.fn<
			[string, { step: number; goal: string; prior: unknown[] } & Record<string, unknown>],
			Promise<unknown>
		>()
		.mockImplementation(async (_tool, payload) => {
			const next = observations[payload.step] ?? { summary: 'no-op', done: true };
			return { ...next };
		});
	const emit = vi.fn();
	return { toolExec, emit };
};

describe('ReActExecutor', () => {
	it('produces a final answer within the iteration budget', async () => {
		const { toolExec, emit } = createStub();
		const executor = new ReActExecutor({ toolExec, emit, maxIters: 5 });

		const result = await executor.execute('Refine pull request description');

		expect(result.success).toBe(true);
		expect(result.finalAnswer).toBe('Ship it');
		expect(result.path).toHaveLength(2);
		expect(toolExec).toHaveBeenCalledTimes(2);
		expect(emit).toHaveBeenCalledWith('reasoning.started', expect.any(Object));
		expect(emit).toHaveBeenCalledWith('reasoning.step', expect.objectContaining({ index: 0 }));
		expect(emit).toHaveBeenCalledWith('reasoning.step', expect.objectContaining({ index: 1 }));
		expect(emit).toHaveBeenCalledWith(
			'reasoning.completed',
			expect.objectContaining({ success: true }),
		);
	});

	it('stops early when the abort signal is triggered', async () => {
		const { toolExec, emit } = createStub();
		const executor = new ReActExecutor({ toolExec, emit, maxIters: 5 });
		const controller = new AbortController();

		toolExec.mockImplementationOnce(async () => {
			controller.abort();
			return { summary: 'aborted', done: false };
		});

		const result = await executor.execute('Investigate flaky test', controller.signal);

		expect(result.success).toBe(false);
		expect(result.finalAnswer).toBeUndefined();
		expect(result.path).toHaveLength(1);
		expect(emit).toHaveBeenCalledWith(
			'reasoning.aborted',
			expect.objectContaining({ reason: 'aborted' }),
		);
	});

	it('caps iterations at maxIters when no final answer is found', async () => {
		const { toolExec, emit } = createStub();
		toolExec.mockImplementation(async () => ({ summary: 'keep going', done: false }));
		const executor = new ReActExecutor({ toolExec, emit, maxIters: 3 });

		const result = await executor.execute('Generate release notes');

		expect(result.success).toBe(false);
		expect(result.path).toHaveLength(3);
		expect(toolExec).toHaveBeenCalledTimes(3);
		expect(emit).toHaveBeenCalledWith(
			'reasoning.completed',
			expect.objectContaining({ success: false }),
		);
	});
});
