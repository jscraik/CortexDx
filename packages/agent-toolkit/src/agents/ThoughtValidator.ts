import type { ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';

export interface ValidationCriteria {
	readonly rules: string[];
	readonly maxHallucinations?: number;
}

export class ThoughtValidator {
	async validate(
		steps: readonly ReActStep[],
		criteria: ValidationCriteria,
	): Promise<{ isValid: boolean; issues: string[]; suggestions: string[] }> {
		const issues = new Set<string>();

		if (criteria.rules.includes('require-observation') && !this.hasObservation(steps)) {
			issues.add('missing-observation');
		}

		if (criteria.rules.includes('non-empty-thoughts') && this.hasEmptyThought(steps)) {
			issues.add('empty-thought');
		}

		const hallucinations = this.countHallucinations(steps);
		if (
			typeof criteria.maxHallucinations === 'number' &&
			hallucinations > criteria.maxHallucinations
		) {
			issues.add('hallucination-budget-exceeded');
		}

		const suggestions = this.suggestRemediations(Array.from(issues));
		return {
			isValid: issues.size === 0,
			issues: Array.from(issues),
			suggestions,
		};
	}

	private hasObservation(steps: readonly ReActStep[]): boolean {
		return steps.some((step) => this.isMeaningful(step.observation));
	}

	private hasEmptyThought(steps: readonly ReActStep[]): boolean {
		return steps.some((step) => step.thought.trim().length === 0);
	}

	private countHallucinations(steps: readonly ReActStep[]): number {
		return steps.filter(
			(step) =>
				typeof step.observation === 'string' && /hallucination|fabricated/i.test(step.observation),
		).length;
	}

	private isMeaningful(value: unknown): boolean {
		if (value === null || value === undefined) {
			return false;
		}
		if (typeof value === 'string') {
			return value.trim().length > 0;
		}
		if (Array.isArray(value)) {
			return value.length > 0;
		}
		if (typeof value === 'object') {
			return Object.keys(value as Record<string, unknown>).length > 0;
		}
		return true;
	}

	private suggestRemediations(issues: readonly string[]): string[] {
		const suggestions = new Set<string>();
		for (const issue of issues) {
			switch (issue) {
				case 'missing-observation':
					suggestions.add('collect-evidence');
					break;
				case 'hallucination-budget-exceeded':
					suggestions.add('tighten-evaluation');
					break;
				case 'empty-thought':
					suggestions.add('enforce-structured-thinking');
					break;
				default:
					suggestions.add('revisit-criteria');
			}
		}
		return Array.from(suggestions);
	}
}
