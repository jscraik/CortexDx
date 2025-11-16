/**
 * Envelope Schema Validation Tests
 * Tests for MCP diagnostic envelope schema, types, and validation
 */

import { describe, expect, it } from "vitest";
import {
	AssertionEmitter,
	RunCollector,
	type DxEnvelope,
	formatValidationErrors,
	validateAssertion,
	validateCase,
	validateEnvelope,
	validateEvidence,
} from "../src/envelope/index.js";

describe("Envelope Schema Validation", () => {
	describe("Evidence Validation", () => {
		it("validates valid evidence", () => {
			const evidence = {
				kind: "log" as const,
				url: "https://example.com/log.json",
				sha256:
					"9b1cef8c4e9f47b9c12e5a4f7b3e2d1c8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
				content_type: "application/json",
				expires_at: "2025-11-16T12:00:00Z",
			};

			const result = validateEvidence(evidence);
			expect(result.success).toBe(true);
			expect(result.data).toEqual(evidence);
		});

		it("rejects invalid evidence kind", () => {
			const evidence = {
				kind: "invalid",
				url: "https://example.com/log.json",
			};

			const result = validateEvidence(evidence);
			expect(result.success).toBe(false);
			expect(result.errors).toBeDefined();
		});

		it("rejects invalid sha256 format", () => {
			const evidence = {
				kind: "log" as const,
				url: "https://example.com/log.json",
				sha256: "invalid-hash",
			};

			const result = validateEvidence(evidence);
			expect(result.success).toBe(false);
			expect(result.errors).toBeDefined();
		});

		it("accepts all evidence kinds", () => {
			const kinds = ["log", "trace", "http", "screenshot", "diff", "artifact"];

			for (const kind of kinds) {
				const evidence = {
					kind: kind as any,
					url: "https://example.com/artifact",
				};

				const result = validateEvidence(evidence);
				expect(result.success).toBe(true);
			}
		});
	});

	describe("Assertion Validation", () => {
		it("validates minimal valid assertion", () => {
			const assertion = {
				id: "test-001",
				title: "Test assertion",
				status: "pass" as const,
			};

			const result = validateAssertion(assertion);
			expect(result.success).toBe(true);
			expect(result.data).toMatchObject(assertion);
		});

		it("validates assertion with all fields", () => {
			const assertion = {
				id: "test-001",
				title: "Test assertion",
				status: "fail" as const,
				severity: "high" as const,
				duration_ms: 142,
				message: "Test failed due to...",
				evidence: [
					{
						kind: "log" as const,
						url: "https://example.com/log.json",
						sha256:
							"9b1cef8c4e9f47b9c12e5a4f7b3e2d1c8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
					},
				],
				remediation: {
					summary: "Fix the issue",
					patch_unified: "--- a/file.ts\n+++ b/file.ts\n",
					commands: ["npm test"],
				},
				tags: ["protocol", "required"],
				metadata: { custom: "value" },
			};

			const result = validateAssertion(assertion);
			expect(result.success).toBe(true);
			expect(result.data).toEqual(assertion);
		});

		it("accepts all assertion statuses", () => {
			const statuses = ["pass", "fail", "skip", "error"];

			for (const status of statuses) {
				const assertion = {
					id: "test-001",
					title: "Test assertion",
					status: status as any,
				};

				const result = validateAssertion(assertion);
				expect(result.success).toBe(true);
			}
		});

		it("accepts all severity levels", () => {
			const severities = ["info", "low", "medium", "high", "critical"];

			for (const severity of severities) {
				const assertion = {
					id: "test-001",
					title: "Test assertion",
					status: "fail" as const,
					severity: severity as any,
				};

				const result = validateAssertion(assertion);
				expect(result.success).toBe(true);
			}
		});

		it("rejects negative duration", () => {
			const assertion = {
				id: "test-001",
				title: "Test assertion",
				status: "pass" as const,
				duration_ms: -1,
			};

			const result = validateAssertion(assertion);
			expect(result.success).toBe(false);
		});
	});

	describe("Case Validation", () => {
		it("validates minimal valid case", () => {
			const testCase = {
				id: "handshake",
				name: "MCP Handshake",
				assertions: [
					{
						id: "hs-001",
						title: "Server returns capabilities",
						status: "pass" as const,
					},
				],
			};

			const result = validateCase(testCase);
			expect(result.success).toBe(true);
			expect(result.data).toMatchObject(testCase);
		});

		it("validates case with all fields", () => {
			const testCase = {
				id: "handshake",
				name: "MCP Handshake",
				labels: ["protocol", "required"],
				inputs: { endpoint: "ws://localhost:8777" },
				assertions: [
					{
						id: "hs-001",
						title: "Server returns capabilities",
						status: "pass" as const,
					},
					{
						id: "hs-002",
						title: "Rejects unknown methods",
						status: "fail" as const,
						severity: "medium" as const,
					},
				],
			};

			const result = validateCase(testCase);
			expect(result.success).toBe(true);
			expect(result.data).toEqual(testCase);
		});

	});

	describe("Envelope Validation", () => {
		it("validates minimal valid envelope", () => {
			const envelope: DxEnvelope = {
				version: "1.0.0",
				run_id: "dx_2025-11-15T12:01:22Z_8f9b",
				tool: "cortex-dx@1.4.0",
				started_at: "2025-11-15T12:01:22Z",
				cases: [],
				summary: {
					total: 0,
					passed: 0,
					failed: 0,
					skipped: 0,
					errored: 0,
				},
			};

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(true);
			expect(result.data).toEqual(envelope);
		});

		it("validates complete envelope", () => {
			const envelope: DxEnvelope = {
				version: "1.0.0",
				run_id: "dx_2025-11-15T12:01:22Z_8f9b",
				tool: "cortex-dx@1.4.0",
				spec: "MCP 2025-06-18",
				started_at: "2025-11-15T12:01:22Z",
				finished_at: "2025-11-15T12:01:33Z",
				agent_context: {
					target_mcp_url: "http://localhost:8777",
					profile: "staging",
				},
				cases: [
					{
						id: "handshake",
						name: "MCP Handshake",
						labels: ["protocol", "required"],
						inputs: { endpoint: "ws://localhost:8777" },
						assertions: [
							{
								id: "hs-001",
								title: "Server returns capabilities",
								status: "pass",
								duration_ms: 142,
							},
							{
								id: "hs-002",
								title: "Rejects unknown methods",
								status: "fail",
								severity: "medium",
								message: "Server responded 200 instead of error",
								evidence: [
									{
										kind: "log",
										url: "https://example.com/log.json",
										sha256:
											"9b1cef8c4e9f47b9c12e5a4f7b3e2d1c8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
										content_type: "application/json",
										expires_at: "2025-11-16T12:00:00Z",
									},
								],
								remediation: {
									summary: "Return JSON-RPC error -32601",
									patch_unified:
										"--- a/server/rpc.ts\n+++ b/server/rpc.ts\n",
									commands: ["pnpm test:rpc"],
								},
								tags: ["jsonrpc", "error-handling"],
							},
						],
					},
				],
				summary: {
					total: 2,
					passed: 1,
					failed: 1,
					skipped: 0,
					errored: 0,
					duration_ms: 11089,
				},
			};

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(true);
			expect(result.data).toEqual(envelope);
		});

		it("rejects invalid version format", () => {
			const envelope = {
				version: "2.0", // Invalid: should be 1.x.x
				run_id: "dx_2025-11-15T12:01:22Z_8f9b",
				tool: "cortex-dx@1.4.0",
				started_at: "2025-11-15T12:01:22Z",
				cases: [],
				summary: {
					total: 0,
					passed: 0,
					failed: 0,
					skipped: 0,
					errored: 0,
				},
			};

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(false);
		});

		it("rejects negative summary counts", () => {
			const envelope = {
				version: "1.0.0",
				run_id: "dx_2025-11-15T12:01:22Z_8f9b",
				tool: "cortex-dx@1.4.0",
				started_at: "2025-11-15T12:01:22Z",
				cases: [],
				summary: {
					total: 0,
					passed: -1, // Invalid
					failed: 0,
					skipped: 0,
					errored: 0,
				},
			};

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(false);
		});
	});

	describe("Error Formatting", () => {
		it("formats validation errors in human-readable format", () => {
			const invalidEnvelope = {
				version: "invalid",
				run_id: "test",
				tool: "test",
				started_at: "invalid-date",
				cases: [],
				summary: {
					total: 0,
					passed: 0,
					failed: 0,
					skipped: 0,
					errored: 0,
				},
			};

			const result = validateEnvelope(invalidEnvelope);
			expect(result.success).toBe(false);

			if (result.errors) {
				const messages = formatValidationErrors(result.errors);
				expect(messages).toBeInstanceOf(Array);
				expect(messages.length).toBeGreaterThan(0);
				expect(messages[0]).toContain("version");
			}
		});
	});
});

describe("AssertionEmitter", () => {
	const runId = "test-run-123";
	const caseId = "test-case-456";

	it("builds basic passing assertion", () => {
		const emitter = AssertionEmitter.pass(
			"test-001",
			"Test passes",
			runId,
			caseId,
		);

		const assertion = emitter.build();

		expect(assertion.id).toBe("test-001");
		expect(assertion.title).toBe("Test passes");
		expect(assertion.status).toBe("pass");
		expect(assertion.duration_ms).toBeGreaterThanOrEqual(0);
	});

	it("builds failing assertion with severity and message", () => {
		const emitter = AssertionEmitter.fail(
			"test-002",
			"Test fails",
			runId,
			caseId,
			"critical",
			"Critical failure occurred",
		);

		const assertion = emitter.build();

		expect(assertion.status).toBe("fail");
		expect(assertion.severity).toBe("critical");
		expect(assertion.message).toBe("Critical failure occurred");
	});

	it("builds assertion with tags and metadata", () => {
		const emitter = new AssertionEmitter(
			"test-003",
			"Test with metadata",
			runId,
			caseId,
		)
			.status("pass")
			.tags(["protocol", "mcp"])
			.metadata({ custom: "value", count: 42 });

		const assertion = emitter.build();

		expect(assertion.tags).toEqual(["protocol", "mcp"]);
		expect(assertion.metadata).toEqual({ custom: "value", count: 42 });
	});

	it("builds assertion with remediation", () => {
		const emitter = new AssertionEmitter(
			"test-004",
			"Test with fix",
			runId,
			caseId,
		)
			.status("fail")
			.severity("medium")
			.remediation({
				summary: "Fix the bug",
				patch_unified: "--- a/file.ts\n+++ b/file.ts\n",
				commands: ["npm test"],
			});

		const assertion = emitter.build();

		expect(assertion.remediation).toBeDefined();
		expect(assertion.remediation?.summary).toBe("Fix the bug");
		expect(assertion.remediation?.commands).toEqual(["npm test"]);
	});

	it("throws error if required fields missing", () => {
		const emitter = new AssertionEmitter(
			"test-005",
			"Incomplete",
			runId,
			caseId,
		);
		// Don't set status

		expect(() => emitter.build()).toThrow();
	});
});

describe("RunCollector", () => {
	it("generates valid run ID", () => {
		const collector = new RunCollector("cortex-dx@1.4.0");
		const runId = collector.getRunId();

		expect(runId).toMatch(/^dx_\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z_[a-f0-9]+$/);
	});

	it("builds envelope with cases", () => {
		const collector = new RunCollector(
			"cortex-dx@1.4.0",
			"MCP 2025-06-18",
			{ target: "localhost:8777" },
		);

		const testCase = collector.buildCase(
			"test-case",
			"Test Case",
			[
				{
					id: "test-001",
					title: "Test assertion",
					status: "pass",
				},
			],
			["protocol"],
			{ endpoint: "ws://localhost:8777" },
		);

		collector.addCase(testCase);

		const envelope = collector.build();

		expect(envelope.version).toBe("1.0.0");
		expect(envelope.tool).toBe("cortex-dx@1.4.0");
		expect(envelope.spec).toBe("MCP 2025-06-18");
		expect(envelope.cases).toHaveLength(1);
		expect(envelope.summary.total).toBe(1);
		expect(envelope.summary.passed).toBe(1);
	});

	it("calculates summary correctly", () => {
		const collector = new RunCollector("cortex-dx@1.4.0");

		collector.addCase(
			collector.buildCase("case-1", "Case 1", [
				{ id: "a1", title: "A1", status: "pass" },
				{ id: "a2", title: "A2", status: "fail" },
				{ id: "a3", title: "A3", status: "skip" },
			]),
		);

		collector.addCase(
			collector.buildCase("case-2", "Case 2", [
				{ id: "a4", title: "A4", status: "error" },
				{ id: "a5", title: "A5", status: "pass" },
			]),
		);

		const summary = collector.getSummary();

		expect(summary.total).toBe(5);
		expect(summary.passed).toBe(2);
		expect(summary.failed).toBe(1);
		expect(summary.skipped).toBe(1);
		expect(summary.errored).toBe(1);
	});

	it("detects failures and errors", () => {
		const collector = new RunCollector("cortex-dx@1.4.0");

		collector.addCase(
			collector.buildCase("case-1", "Case 1", [
				{ id: "a1", title: "A1", status: "pass" },
				{ id: "a2", title: "A2", status: "fail" },
			]),
		);

		expect(collector.hasFailures()).toBe(true);
		expect(collector.hasErrors()).toBe(false);

		collector.addCase(
			collector.buildCase("case-2", "Case 2", [
				{ id: "a3", title: "A3", status: "error" },
			]),
		);

		expect(collector.hasErrors()).toBe(true);
	});

	it("gets failed and errored assertions", () => {
		const collector = new RunCollector("cortex-dx@1.4.0");

		collector.addCase(
			collector.buildCase("case-1", "Case 1", [
				{ id: "a1", title: "A1", status: "pass" },
				{ id: "a2", title: "A2", status: "fail" },
			]),
		);

		collector.addCase(
			collector.buildCase("case-2", "Case 2", [
				{ id: "a3", title: "A3", status: "error" },
				{ id: "a4", title: "A4", status: "fail" },
			]),
		);

		const failed = collector.getFailedAssertions();
		const errored = collector.getErroredAssertions();

		expect(failed).toHaveLength(2);
		expect(errored).toHaveLength(1);
		expect(failed[0].assertion.id).toBe("a2");
		expect(errored[0].assertion.id).toBe("a3");
	});

	it("auto-finishes when building", () => {
		const collector = new RunCollector("cortex-dx@1.4.0");

		collector.addCase(
			collector.buildCase("case-1", "Case 1", [
				{ id: "a1", title: "A1", status: "pass" },
			]),
		);

		const envelope = collector.build();

		expect(envelope.started_at).toBeDefined();
		expect(envelope.finished_at).toBeDefined();
		expect(envelope.summary.duration_ms).toBeGreaterThanOrEqual(0);
	});

	it("produces valid JSON", () => {
		const collector = new RunCollector("cortex-dx@1.4.0");

		collector.addCase(
			collector.buildCase("case-1", "Case 1", [
				{ id: "a1", title: "A1", status: "pass" },
			]),
		);

		const json = collector.toJSON(true);

		expect(() => JSON.parse(json)).not.toThrow();
		const parsed = JSON.parse(json);
		expect(parsed.version).toBe("1.0.0");
	});
});
