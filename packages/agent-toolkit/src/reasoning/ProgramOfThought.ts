export interface ProgramStep {
	variable: string;
	operation: string;
	result?: unknown;
	deps: string[];
}

interface ProgramConstraints {
	readonly timeoutMs?: number;
}

export class ProgramOfThoughtExecutor {
	async run(
		problem: string,
		constraints: ProgramConstraints = {},
	): Promise<{
		program: ProgramStep[];
		result: unknown;
		trace: string[];
	}> {
		const startedAt = Date.now();
		const budget = constraints.timeoutMs ?? 1000;
		const program: ProgramStep[] = [];
		const trace: string[] = [];

		const guard = () => {
			if (Date.now() - startedAt > budget) {
				throw new Error('program-of-thought timeout');
			}
		};

		const numbers = [...problem.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
		if (numbers.length === 0) {
			numbers.push(0);
		}

		numbers.forEach((value, index) => {
			guard();
			const step: ProgramStep = {
				variable: `x${index}`,
				operation: 'parse',
				result: value,
				deps: [],
			};
			program.push(step);
			trace.push(`${step.variable}=${value}`);
		});

		guard();
		const op = /product|multiply/i.test(problem) ? 'multiply' : 'add';
		let accumulator = op === 'add' ? 0 : 1;
		numbers.forEach((value) => {
			guard();
			accumulator = op === 'add' ? accumulator + value : accumulator * value;
		});

		const resultStep: ProgramStep = {
			variable: `x${numbers.length}`,
			operation: op === 'add' ? 'add' : 'multiply',
			result: accumulator,
			deps: numbers.map((_, index) => `x${index}`),
		};
		program.push(resultStep);
		trace.push(`${resultStep.variable}=${accumulator}`);

		return { program, result: accumulator, trace };
	}
}
