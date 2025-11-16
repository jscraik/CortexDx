/**
 * MCP Diagnostic Envelope Types
 * TAP/JUnit-style test envelope for MCP diagnostics with signed URL evidence
 * Schema: schemas/mcp-dx/envelope.schema.json
 */

/**
 * Evidence artifact kinds
 */
export type EvidenceKind =
	| "log" // Log files (JSON, text)
	| "trace" // JSON-RPC message traces
	| "http" // HTTP request/response captures (HAR format)
	| "screenshot" // Visual evidence (PNG, JPG)
	| "diff" // Code diffs (unified patch format)
	| "artifact"; // Generic artifacts

/**
 * Evidence artifact with presigned URL and metadata
 */
export interface Evidence {
	/** Type of evidence artifact */
	kind: EvidenceKind;
	/** Presigned URL to access the evidence */
	url: string;
	/** SHA-256 hash for integrity verification */
	sha256?: string;
	/** MIME type of the artifact */
	content_type?: string;
	/** ISO 8601 timestamp when the presigned URL expires */
	expires_at?: string;
}

/**
 * Remediation instructions for failed assertions
 */
export interface Remediation {
	/** Brief summary of the fix */
	summary?: string;
	/** Unified diff patch for code changes */
	patch_unified?: string;
	/** Shell commands to apply the fix */
	commands?: string[];
}

/**
 * Assertion result status
 */
export type AssertionStatus = "pass" | "fail" | "skip" | "error";

/**
 * Severity levels for failed assertions
 */
export type Severity = "info" | "low" | "medium" | "high" | "critical";

/**
 * Individual test assertion within a case
 */
export interface Assertion {
	/** Unique identifier for this assertion */
	id: string;
	/** Human-readable assertion title */
	title: string;
	/** Assertion result status */
	status: AssertionStatus;
	/** Severity level for failed assertions */
	severity?: Severity;
	/** Assertion execution time in milliseconds */
	duration_ms?: number;
	/** Detailed message about the assertion result */
	message?: string;
	/** Evidence artifacts with presigned URLs */
	evidence?: Evidence[];
	/** Suggested remediation actions */
	remediation?: Remediation;
	/** Tags for categorization and filtering */
	tags?: string[];
	/** Additional structured metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Test case containing multiple assertions
 */
export interface Case {
	/** Unique identifier for this test case */
	id: string;
	/** Human-readable test case name */
	name: string;
	/** Labels for categorization (e.g., 'protocol', 'required') */
	labels?: string[];
	/** Input parameters used for this case */
	inputs?: Record<string, unknown>;
	/** Individual test assertions within this case */
	assertions: Assertion[];
}

/**
 * Aggregated statistics for all assertions
 */
export interface RunSummary {
	/** Total number of assertions */
	total: number;
	/** Number of passed assertions */
	passed: number;
	/** Number of failed assertions */
	failed: number;
	/** Number of skipped assertions */
	skipped: number;
	/** Number of errored assertions */
	errored: number;
	/** Total run duration in milliseconds */
	duration_ms?: number;
}

/**
 * MCP Diagnostic Envelope
 * Main container for diagnostic run results
 */
export interface DxEnvelope {
	/** Schema version following semver */
	version: string;
	/** Unique identifier for this diagnostic run */
	run_id: string;
	/** Emitter identity, e.g. cortex-dx@1.4.0 */
	tool: string;
	/** Target spec/version under test, e.g. MCP 2025-06-18 */
	spec?: string;
	/** ISO 8601 timestamp when the run started */
	started_at: string;
	/** ISO 8601 timestamp when the run finished */
	finished_at?: string;
	/** Context for LLM agents (target URL, profile, config) */
	agent_context?: Record<string, unknown>;
	/** Test cases containing assertions */
	cases: Case[];
	/** Aggregated statistics for all assertions */
	summary: RunSummary;
}

/**
 * Builder options for creating evidence artifacts
 */
export interface EvidenceBuilder {
	kind: EvidenceKind;
	content: string | Buffer;
	contentType?: string;
}

/**
 * Builder options for creating assertions
 */
export interface AssertionBuilder {
	id: string;
	title: string;
	status: AssertionStatus;
	severity?: Severity;
	message?: string;
	tags?: string[];
	metadata?: Record<string, unknown>;
}

/**
 * Builder options for creating test cases
 */
export interface CaseBuilder {
	id: string;
	name: string;
	labels?: string[];
	inputs?: Record<string, unknown>;
}

/**
 * Builder options for creating diagnostic runs
 */
export interface RunBuilder {
	tool: string;
	spec?: string;
	agent_context?: Record<string, unknown>;
}
