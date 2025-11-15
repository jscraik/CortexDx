/**
 * Zod Validation Schemas for MCP Diagnostic Envelope
 * Provides runtime validation and type inference
 */

import { z } from "zod";
import type {
	Assertion,
	AssertionStatus,
	Case,
	DxEnvelope,
	Evidence,
	EvidenceKind,
	Remediation,
	RunSummary,
	Severity,
} from "./types.js";

/**
 * Evidence Kind Schema
 */
export const EvidenceKindSchema = z.enum([
	"log",
	"trace",
	"http",
	"screenshot",
	"diff",
	"artifact",
]) satisfies z.ZodType<EvidenceKind>;

/**
 * Evidence Schema
 */
export const EvidenceSchema = z.object({
	kind: EvidenceKindSchema,
	url: z.string().url(),
	sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
	content_type: z.string().optional(),
	expires_at: z.string().datetime().optional(),
}) satisfies z.ZodType<Evidence>;

/**
 * Remediation Schema
 */
export const RemediationSchema = z.object({
	summary: z.string().optional(),
	patch_unified: z.string().optional(),
	commands: z.array(z.string()).optional(),
}) satisfies z.ZodType<Remediation>;

/**
 * Assertion Status Schema
 */
export const AssertionStatusSchema = z.enum([
	"pass",
	"fail",
	"skip",
	"error",
]) satisfies z.ZodType<AssertionStatus>;

/**
 * Severity Schema
 */
export const SeveritySchema = z.enum([
	"info",
	"low",
	"medium",
	"high",
	"critical",
]) satisfies z.ZodType<Severity>;

/**
 * Assertion Schema
 */
export const AssertionSchema = z.object({
	id: z.string(),
	title: z.string(),
	status: AssertionStatusSchema,
	severity: SeveritySchema.optional(),
	duration_ms: z.number().min(0).optional(),
	message: z.string().optional(),
	evidence: z.array(EvidenceSchema).optional(),
	remediation: RemediationSchema.optional(),
	tags: z.array(z.string()).optional(),
	metadata: z.record(z.unknown()).optional(),
}) satisfies z.ZodType<Assertion>;

/**
 * Case Schema
 */
export const CaseSchema = z.object({
	id: z.string(),
	name: z.string(),
	labels: z.array(z.string()).optional(),
	inputs: z.record(z.unknown()).optional(),
	assertions: z.array(AssertionSchema),
}) satisfies z.ZodType<Case>;

/**
 * Run Summary Schema
 */
export const RunSummarySchema = z.object({
	total: z.number().int().min(0),
	passed: z.number().int().min(0),
	failed: z.number().int().min(0),
	skipped: z.number().int().min(0),
	errored: z.number().int().min(0),
	duration_ms: z.number().min(0).optional(),
}) satisfies z.ZodType<RunSummary>;

/**
 * DxEnvelope Schema
 */
export const DxEnvelopeSchema = z.object({
	version: z.string().regex(/^1\.\d+\.\d+$/),
	run_id: z.string(),
	tool: z.string(),
	spec: z.string().optional(),
	started_at: z.string().datetime(),
	finished_at: z.string().datetime().optional(),
	agent_context: z.record(z.unknown()).optional(),
	cases: z.array(CaseSchema),
	summary: RunSummarySchema,
}) satisfies z.ZodType<DxEnvelope>;

/**
 * Validation result type
 */
export interface ValidationResult<T> {
	success: boolean;
	data?: T;
	errors?: z.ZodError;
}

/**
 * Validate a DxEnvelope against the schema
 */
export function validateEnvelope(data: unknown): ValidationResult<DxEnvelope> {
	const result = DxEnvelopeSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

/**
 * Validate an Assertion against the schema
 */
export function validateAssertion(data: unknown): ValidationResult<Assertion> {
	const result = AssertionSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

/**
 * Validate a Case against the schema
 */
export function validateCase(data: unknown): ValidationResult<Case> {
	const result = CaseSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

/**
 * Validate Evidence against the schema
 */
export function validateEvidence(data: unknown): ValidationResult<Evidence> {
	const result = EvidenceSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

/**
 * Get human-readable validation error messages
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
	return errors.errors.map((err) => {
		const path = err.path.join(".");
		return `${path}: ${err.message}`;
	});
}

/**
 * Assert that data matches the envelope schema, throwing on failure
 */
export function assertValidEnvelope(data: unknown): asserts data is DxEnvelope {
	const result = validateEnvelope(data);
	if (!result.success) {
		const messages = formatValidationErrors(result.errors!);
		throw new Error(
			`Invalid DxEnvelope:\n${messages.join("\n")}`,
		);
	}
}
