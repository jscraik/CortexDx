import { describe, expect, it, vi } from 'vitest';

import { ReasoningToolExecutorUseCase } from '@cortex-os/agent-toolkit/use-cases/ReasoningToolExecutorUseCase.js';
import type { ReActResult } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';
import { ReActExecutor } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';
import { TreeOfThoughtsExecutor } from '@cortex-os/agent-toolkit/reasoning/TreeOfThoughts.js';
import { ReasoningGraphTracker } from '@cortex-os/agent-toolkit/reasoning/ReasoningGraph.js';
import { ReflexionEngine } from '@cortex-os/agent-toolkit/reasoning/ReflexionEngine.js';
import { ReasoningMemoryManager } from '@cortex-os/agent-toolkit/session/ReasoningMemory.js';
import { MultiAgentOrchestrator } from '@cortex-os/agent-toolkit/agents/MultiAgentOrchestrator.js';
import { ThoughtValidator } from '@cortex-os/agent-toolkit/agents/ThoughtValidator.js';
import { ProgramOfThoughtExecutor } from '@cortex-os/agent-toolkit/reasoning/ProgramOfThought.js';

const createToolExecutor = () => ({
	execute: vi.fn().mockResolvedValue({ result: 'ok' }),
	isAvailable: vi.fn().mockResolvedValue(true),
	getAvailableTools: vi.fn().mockResolvedValue(['ripgrep']),
});

describe('ReasoningToolExecutorUseCase', () => {
	it('routes execution through ReAct and returns graph summary', async () => {
		const toolExecutor = createToolExecutor();
		const reactResult: ReActResult = {
			finalAnswer: 'Ship it',
			path: [
				{ thought: 'consider context', trace: [], observation: null },
				{ thought: 'final answer: Ship it', trace: [], observation: { done: true } },
			],
			success: true,
		};
		const react = new ReActExecutor({ toolExec: vi.fn(), emit: vi.fn() });
		react.execute = vi.fn().mockResolvedValue(reactResult);
		const useCase = new ReasoningToolExecutorUseCase({
			toolExecutor,
			reAct: react,
			reasoningGraph: new ReasoningGraphTracker(),
		});

		const outcome = await useCase.executeWithReasoning('ripgrep', { pattern: 'TODO', path: '.' });

		expect(outcome.result).toEqual({ result: 'ok' });
		expect(outcome.path).toEqual(reactResult.path);
		expect(outcome.confidence).toBeCloseTo(0.9, 5);
		expect(outcome.reasoningGraph?.nodes.length).toBeGreaterThan(0);
	});

	it('supports Tree-of-Thoughts mode with path extraction', async () => {
		const toolExecutor = createToolExecutor();
		const propose = vi.fn(async (prompt: string) =>
			prompt === 'root' ? ['branch A', 'branch B'] : ['final answer: done'],
		);
		const score = vi.fn(async (idea: string) => (idea.includes('final answer') ? 0.9 : 0.4));
		const tree = new TreeOfThoughtsExecutor({ propose, score });
		const useCase = new ReasoningToolExecutorUseCase({
			toolExecutor,
			reAct: new ReActExecutor({ toolExec: vi.fn(), emit: vi.fn() }),
			treeOfThoughts: tree,
			reasoningGraph: new ReasoningGraphTracker(),
		});

		const outcome = await useCase.executeWithReasoning(
			'ripgrep',
			{ pattern: 'TODO', path: '.' },
			'tot',
		);

		expect(outcome.thoughtPath?.map((node) => node.content)).toEqual([
			'root',
			'branch A',
			'final answer: done',
		]);
		expect(outcome.confidence).toBeGreaterThan(0.5);
		expect(outcome.path).toHaveLength(3);
	});

	it('applies Reflexion with improved attempt stored in memory', async () => {
		const toolExecutor = createToolExecutor();
		const react = new ReActExecutor({ toolExec: vi.fn(), emit: vi.fn(), maxIters: 2 });
		react.execute = vi.fn().mockResolvedValue({
			path: [{ thought: 'draft answer', trace: [], observation: { done: false } }],
			success: false,
		} satisfies ReActResult);
		const memory = new ReasoningMemoryManager();
		const reflexion = new ReflexionEngine({ memory });
		const useCase = new ReasoningToolExecutorUseCase({
			toolExecutor,
			reAct: react,
			reflexion,
		});

		const outcome = await useCase.executeWithReasoning(
			'ripgrep',
			{ pattern: 'TODO', path: '.' },
			'reflexion',
			{
				reflexionFeedback: 'Needs more detail',
			},
		);

		expect(outcome.reflection?.toLowerCase()).toContain('needs more detail');
		expect(outcome.path.at(-1)?.thought.toLowerCase()).toContain('final answer');
		expect(outcome.confidence).toBeGreaterThan(0.5);
		const patterns = await memory.retrievePatterns('draft answer');
		expect(patterns.length).toBeGreaterThan(0);
	});

	it('emits consensus event for multi-agent reasoning', async () => {
		const toolExecutor = createToolExecutor();
		const emit = vi.fn();
		const validator = new ThoughtValidator();
		const orchestrator = new MultiAgentOrchestrator({
			deliberate: async (agent) => ({
				agentId: agent.id,
				proposal: 'Adopt plan A',
				confidence: 0.8,
				steps: [{ thought: 'step', trace: [], observation: 'ok' }],
			}),
			validator,
		});
		const useCase = new ReasoningToolExecutorUseCase({
			toolExecutor,
			reAct: new ReActExecutor({ toolExec: vi.fn(), emit: vi.fn() }),
			orchestrator,
			emit,
		});

		const outcome = await useCase.executeWithReasoning(
			'ripgrep',
			{ pattern: 'TODO', path: '.' },
			'multi-agent',
			{
				agents: [{ id: 'reasoner', role: 'reasoner', capabilities: ['reason'], model: 'gpt-5' }],
			},
		);

		expect(outcome.consensus?.outcome).toBe('Adopt plan A');
		expect(outcome.consensus?.participants).toEqual(['reasoner']);
		expect(outcome.confidence).toBeCloseTo(0.8, 5);
		expect(emit).toHaveBeenCalledWith(
			'reasoning.consensus',
			expect.objectContaining({ consensus: 'Adopt plan A' }),
		);
	});

	it('returns program trace for program-of-thought reasoning', async () => {
		const toolExecutor = createToolExecutor();
		const programExecutor = new ProgramOfThoughtExecutor();
		const useCase = new ReasoningToolExecutorUseCase({
			toolExecutor,
			reAct: new ReActExecutor({ toolExec: vi.fn(), emit: vi.fn() }),
			programOfThought: programExecutor,
		});

		const outcome = await useCase.executeWithReasoning(
			'ripgrep',
			{ pattern: '1 + 2', path: '.' },
			'program',
			{
				program: { timeoutMs: 500 },
			},
		);

		expect(outcome.program?.steps.length).toBeGreaterThan(0);
		expect(outcome.confidence).toBeGreaterThan(0.6);
		expect(outcome.path.length).toEqual(outcome.program?.trace.length ?? 0);
	});
});
