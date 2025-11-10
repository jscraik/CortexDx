import { z } from 'zod';

/**
 * Agent Toolkit A2A event schemas for inter-package communication
 */

// Tool Execution Started Event
export const ToolExecutionStartedEventSchema = z.object({
	executionId: z.string(),
	toolName: z.string(),
	toolType: z.enum(['search', 'codemod', 'validation', 'analysis']),
	parameters: z.record(z.any()),
	initiatedBy: z.string(),
	startedAt: z.string(),
});

// Search Results Event
export const SearchResultsEventSchema = z.object({
	executionId: z.string(),
	query: z.string(),
	searchType: z.enum(['ripgrep', 'semgrep', 'ast-grep', 'multi']),
	resultsCount: z.number().int().nonnegative(),
	paths: z.array(z.string()),
	duration: z.number().int().nonnegative(),
	foundAt: z.string(),
	// Optional chunked context summary
	contextSummary: z
		.object({
			totalTokens: z.number().int().nonnegative(),
			files: z.array(z.object({ file: z.string(), tokens: z.number().int().nonnegative() })),
		})
		.optional(),
});

// Code Modification Event
export const CodeModificationEventSchema = z.object({
	executionId: z.string(),
	modificationType: z.enum(['refactor', 'transform', 'fix']),
	filesChanged: z.array(z.string()),
	linesAdded: z.number().int().nonnegative(),
	linesRemoved: z.number().int().nonnegative(),
	modifiedAt: z.string(),
});

// Validation Report Event
export const ValidationReportEventSchema = z.object({
	executionId: z.string(),
	validationType: z.enum(['syntax', 'types', 'tests', 'security']),
	status: z.enum(['passed', 'failed', 'warning']),
	issuesFound: z.number().int().nonnegative(),
	filesValidated: z.array(z.string()),
	reportedAt: z.string(),
	// Optional per-file token summary when smart validation is used
	contextSummary: z
		.array(z.object({ file: z.string(), tokens: z.number().int().nonnegative() }))
		.optional(),
});

export const ReasoningStartedEventSchema = z.object({
	goal: z.string(),
	timestamp: z.string().optional(),
});

export const ReasoningStepEventSchema = z.object({
	goal: z.string(),
	index: z.number().int().nonnegative(),
	step: z.object({
		thought: z.string(),
		observation: z.unknown().optional(),
		trace: z.array(z.string()).optional(),
	}),
	errored: z.boolean().optional(),
	timestamp: z.string().optional(),
});

export const ReasoningCompletedEventSchema = z.object({
	goal: z.string(),
	success: z.boolean(),
	iterations: z.number().int().nonnegative(),
	finalAnswer: z.string().optional(),
	timestamp: z.string().optional(),
});

export const ReasoningAbortedEventSchema = z.object({
	goal: z.string(),
	reason: z.string(),
	iterations: z.number().int().nonnegative(),
	timestamp: z.string().optional(),
});

export const ReasoningGraphUpdatedEventSchema = z.object({
	goal: z.string(),
	graph: z.object({
		nodes: z.array(
			z.object({
				id: z.string(),
				type: z.enum(['question', 'tool_call', 'observation', 'conclusion']),
				content: z.string(),
				confidence: z.number(),
				edges: z.array(z.string()),
			}),
		),
		bestPath: z.array(z.string()),
		hasCycles: z.boolean(),
	}),
	iterations: z.number().int().nonnegative().optional(),
	timestamp: z.string().optional(),
});

export const ReasoningConsensusEventSchema = z.object({
	goal: z.string(),
	consensus: z.string(),
	confidence: z.number(),
	participants: z.array(z.string()),
	timestamp: z.string().optional(),
});

// Export event type definitions
export type ToolExecutionStartedEvent = z.infer<typeof ToolExecutionStartedEventSchema>;
export type SearchResultsEvent = z.infer<typeof SearchResultsEventSchema>;
export type CodeModificationEvent = z.infer<typeof CodeModificationEventSchema>;
export type ValidationReportEvent = z.infer<typeof ValidationReportEventSchema>;
export type ReasoningStartedEvent = z.infer<typeof ReasoningStartedEventSchema>;
export type ReasoningStepEvent = z.infer<typeof ReasoningStepEventSchema>;
export type ReasoningCompletedEvent = z.infer<typeof ReasoningCompletedEventSchema>;
export type ReasoningAbortedEvent = z.infer<typeof ReasoningAbortedEventSchema>;
export type ReasoningGraphUpdatedEvent = z.infer<typeof ReasoningGraphUpdatedEventSchema>;
export type ReasoningConsensusEvent = z.infer<typeof ReasoningConsensusEventSchema>;

// Helper function to create agent toolkit events
export const createAgentToolkitEvent = {
	executionStarted: (data: ToolExecutionStartedEvent) => ({
		type: 'agent_toolkit.execution.started' as const,
		data: ToolExecutionStartedEventSchema.parse(data),
	}),
	searchResults: (data: SearchResultsEvent) => ({
		type: 'agent_toolkit.search.results' as const,
		data: SearchResultsEventSchema.parse(data),
	}),
	codeModification: (data: CodeModificationEvent) => ({
		type: 'agent_toolkit.code.modified' as const,
		data: CodeModificationEventSchema.parse(data),
	}),
	validationReport: (data: ValidationReportEvent) => ({
		type: 'agent_toolkit.validation.report' as const,
		data: ValidationReportEventSchema.parse(data),
	}),
	reasoningStarted: (data: ReasoningStartedEvent) => ({
		type: 'agent_toolkit.reasoning.started' as const,
		data: ReasoningStartedEventSchema.parse(data),
	}),
	reasoningStep: (data: ReasoningStepEvent) => ({
		type: 'agent_toolkit.reasoning.step' as const,
		data: ReasoningStepEventSchema.parse(data),
	}),
	reasoningCompleted: (data: ReasoningCompletedEvent) => ({
		type: 'agent_toolkit.reasoning.completed' as const,
		data: ReasoningCompletedEventSchema.parse(data),
	}),
	reasoningAborted: (data: ReasoningAbortedEvent) => ({
		type: 'agent_toolkit.reasoning.aborted' as const,
		data: ReasoningAbortedEventSchema.parse(data),
	}),
	reasoningGraphUpdated: (data: ReasoningGraphUpdatedEvent) => ({
		type: 'agent_toolkit.reasoning.graph.updated' as const,
		data: ReasoningGraphUpdatedEventSchema.parse(data),
	}),
	reasoningConsensus: (data: ReasoningConsensusEvent) => ({
		type: 'agent_toolkit.reasoning.consensus' as const,
		data: ReasoningConsensusEventSchema.parse(data),
	}),
};
