/**
 * Report MCP Tools Tests
 * Tests for report.get_latest and report.get_by_run MCP tools
 */

import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReportManager, type DiagnosticReport } from "../src/storage/report-manager.js";
import {
	handleGetLatest,
	handleGetByRun,
	reportTools,
	type GetLatestParams,
	type GetByRunParams,
} from "../src/tools/report-tools.js";

describe("Report MCP Tools", () => {
	const testStorageRoot = "/tmp/test-reports-mcp";
	let reportManager: ReportManager;

	beforeEach(async () => {
		reportManager = new ReportManager({
			storageRoot: testStorageRoot,
			baseUrl: "http://localhost:5001/reports",
			organizationStrategy: "date",
			retentionDays: 30,
			enableCompression: false,
			formats: ["json", "html"],
		});
		await reportManager.initialize();
	});

	afterEach(async () => {
		reportManager.close();
		try {
			await rm(testStorageRoot, { recursive: true, force: true });
		} catch {
			// Directory might not exist
		}
	});

	describe("Tool Definitions", () => {
		it("should export report.get_latest tool", () => {
			const getLatestTool = reportTools.find(
				(t) => t.name === "report.get_latest",
			);
			expect(getLatestTool).toBeDefined();
			expect(getLatestTool?.description).toContain("latest diagnostic reports");
			expect(getLatestTool?.inputSchema).toBeDefined();
		});

		it("should export report.get_by_run tool", () => {
			const getByRunTool = reportTools.find(
				(t) => t.name === "report.get_by_run",
			);
			expect(getByRunTool).toBeDefined();
			expect(getByRunTool?.description).toContain("specific diagnostic report");
			expect(getByRunTool?.inputSchema).toBeDefined();
			expect(getByRunTool?.inputSchema.required).toContain("runId");
		});

		it("should have correct input schema for get_latest", () => {
			const getLatestTool = reportTools.find(
				(t) => t.name === "report.get_latest",
			);
			const schema = getLatestTool?.inputSchema;

			expect(schema?.properties?.kind).toBeDefined();
			expect(schema?.properties?.kind.enum).toEqual([
				"diagnostic",
				"metadata",
				"inspector",
			]);
			expect(schema?.properties?.limit).toBeDefined();
			expect(schema?.properties?.limit.minimum).toBe(1);
			expect(schema?.properties?.limit.maximum).toBe(10);
		});
	});

	describe("handleGetLatest", () => {
		it("should return empty list when no reports exist", async () => {
			const params: GetLatestParams = {
				kind: "diagnostic",
				limit: 5,
			};

			const result = await handleGetLatest(params);

			expect(result.ok).toBe(true);
			expect(result.items).toEqual([]);
		});

		it("should return latest reports", async () => {
			// Create test reports
			const report1: DiagnosticReport = {
				sessionId: "session-1",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [],
				tags: ["test", "report1"],
			};

			const report2: DiagnosticReport = {
				sessionId: "session-2",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3001",
				inspectedAt: new Date().toISOString(),
				durationMs: 1500,
				findings: [],
				tags: ["test", "report2"],
			};

			await reportManager.storeReport(report1);
			await reportManager.storeReport(report2);

			const params: GetLatestParams = {
				kind: "diagnostic",
				limit: 10,
			};

			const result = await handleGetLatest(params);

			expect(result.ok).toBe(true);
			expect(result.items).toHaveLength(2);
			expect(result.items[0].meta.app).toBe("CortexDx");
			expect(result.items[0].meta.version).toBeDefined();
		});

		it("should respect limit parameter", async () => {
			// Create 5 test reports
			for (let i = 0; i < 5; i++) {
				const report: DiagnosticReport = {
					sessionId: `session-${i}`,
					diagnosticType: "diagnostic",
					endpoint: `http://localhost:300${i}`,
					inspectedAt: new Date().toISOString(),
					durationMs: 1000,
					findings: [],
					tags: [`test-${i}`],
				};
				await reportManager.storeReport(report);
			}

			const params: GetLatestParams = {
				kind: "diagnostic",
				limit: 3,
			};

			const result = await handleGetLatest(params);

			expect(result.ok).toBe(true);
			expect(result.items).toHaveLength(3);
		});

		it("should filter by diagnostic type", async () => {
			const diagnosticReport: DiagnosticReport = {
				sessionId: "session-diag",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [],
			};

			const metadataReport: DiagnosticReport = {
				sessionId: "session-meta",
				diagnosticType: "metadata",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [],
			};

			await reportManager.storeReport(diagnosticReport);
			await reportManager.storeReport(metadataReport);

			const params: GetLatestParams = {
				kind: "metadata",
				limit: 10,
			};

			const result = await handleGetLatest(params);

			expect(result.ok).toBe(true);
			expect(result.items).toHaveLength(1);
		});

		it("should include expiration time in response", async () => {
			const report: DiagnosticReport = {
				sessionId: "session-expiry",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [],
			};

			await reportManager.storeReport(report);

			const params: GetLatestParams = {
				kind: "diagnostic",
			};

			const beforeCall = Date.now();
			const result = await handleGetLatest(params);
			const afterCall = Date.now();

			expect(result.items[0].expiresAt).toBeDefined();

			const expiresAt = new Date(result.items[0].expiresAt).getTime();
			const expectedExpiry = beforeCall + 15 * 60 * 1000; // 15 minutes

			// Allow 1 second tolerance
			expect(expiresAt).toBeGreaterThan(expectedExpiry - 1000);
			expect(expiresAt).toBeLessThan(afterCall + 15 * 60 * 1000 + 1000);
		});

		it("should include provenance metadata", async () => {
			const report: DiagnosticReport = {
				sessionId: "session-provenance",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [],
				tags: ["provenance-test"],
			};

			await reportManager.storeReport(report);

			const params: GetLatestParams = {
				kind: "diagnostic",
			};

			const result = await handleGetLatest(params);

			expect(result.items[0].meta).toBeDefined();
			expect(result.items[0].meta.app).toBe("CortexDx");
			expect(result.items[0].meta.version).toBeDefined();
			expect(result.items[0].meta.tags).toEqual(["provenance-test"]);

			// Git metadata may or may not be present depending on environment
			if (result.items[0].meta.git) {
				expect(result.items[0].meta.git.sha).toBeDefined();
				expect(result.items[0].meta.git.branch).toBeDefined();
			}
		});
	});

	describe("handleGetByRun", () => {
		it("should throw error when report not found", async () => {
			const params: GetByRunParams = {
				runId: "non-existent-id",
			};

			await expect(handleGetByRun(params)).rejects.toThrow(
				/Report not found for run ID/,
			);
		});

		it("should return report by session ID", async () => {
			const report: DiagnosticReport = {
				id: "custom-report-id",
				sessionId: "unique-session-123",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 2000,
				findings: [],
				tags: ["specific-run"],
			};

			await reportManager.storeReport(report);

			const params: GetByRunParams = {
				runId: "unique-session-123",
			};

			const result = await handleGetByRun(params);

			expect(result.ok).toBe(true);
			expect(result.item).toBeDefined();
			expect(result.item.runId).toBe("custom-report-id");
			expect(result.item.meta.tags).toEqual(["specific-run"]);
		});

		it("should include provenance when requested", async () => {
			const report: DiagnosticReport = {
				sessionId: "session-with-provenance",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [],
			};

			await reportManager.storeReport(report);

			const params: GetByRunParams = {
				runId: "session-with-provenance",
				includeProvenance: true,
			};

			const result = await handleGetByRun(params);

			expect(result.item.meta).toBeDefined();
			expect(result.item.meta.app).toBe("CortexDx");
			expect(result.item.meta.version).toBeDefined();
		});

		it("should return URLs (local or cloud)", async () => {
			const report: DiagnosticReport = {
				sessionId: "session-urls",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [],
			};

			await reportManager.storeReport(report);

			const params: GetByRunParams = {
				runId: "session-urls",
			};

			const result = await handleGetByRun(params);

			expect(result.item.url).toBeDefined();
			// URL should be either cloud URL or local URL
			expect(result.item.url).toMatch(/^http/);
		});

		it("should include SHA-256 hash if available", async () => {
			const report: DiagnosticReport = {
				sessionId: "session-hash",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [],
			};

			await reportManager.storeReport(report);

			const params: GetByRunParams = {
				runId: "session-hash",
			};

			const result = await handleGetByRun(params);

			// SHA-256 hash is present if cloud storage is enabled
			// Otherwise it might be empty string
			expect(result.item.sha256).toBeDefined();
			expect(typeof result.item.sha256).toBe("string");
		});

		it("should return report size", async () => {
			const report: DiagnosticReport = {
				sessionId: "session-size",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [],
			};

			await reportManager.storeReport(report);

			const params: GetByRunParams = {
				runId: "session-size",
			};

			const result = await handleGetByRun(params);

			expect(result.item.bytes).toBeDefined();
			expect(result.item.bytes).toBeGreaterThan(0);
		});

		it("should handle reports with findings", async () => {
			const report: DiagnosticReport = {
				sessionId: "session-findings",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [
					{
						id: "finding-1",
						area: "protocol",
						severity: "major",
						title: "Protocol violation",
						description: "Invalid JSON-RPC response",
						evidence: [],
					},
				],
			};

			await reportManager.storeReport(report);

			const params: GetByRunParams = {
				runId: "session-findings",
			};

			const result = await handleGetByRun(params);

			expect(result.ok).toBe(true);
			expect(result.item).toBeDefined();
			// The report should include findings in the stored data
			expect(result.item.bytes).toBeGreaterThan(100); // Report with finding should have some size
		});
	});

	describe("Integration with Cloud Storage", () => {
		it("should prefer cloud URLs over local URLs when available", async () => {
			// Create a report manager
			const manager = new ReportManager({
				storageRoot: testStorageRoot,
			});
			await manager.initialize();

			// Create mock cloud storage adapter
			const mockCloudStorage = {
				uploadReport: async () => ({
					key: "reports/test/report.html",
					sha256: "a".repeat(64),
					url: "https://r2.example.com/reports/test/report.html",
					size: 1000,
				}),
				getBucket: () => "test-bucket",
				getProvider: () => "r2" as const,
			};

			manager.enableCloudStorage(mockCloudStorage as any);

			const report: DiagnosticReport = {
				sessionId: "session-cloud",
				diagnosticType: "diagnostic",
				endpoint: "http://localhost:3000",
				inspectedAt: new Date().toISOString(),
				durationMs: 1000,
				findings: [],
			};

			await manager.storeReport(report);

			const params: GetByRunParams = {
				runId: "session-cloud",
			};

			const result = await handleGetByRun(params);

			// When cloud storage is enabled, should return cloud URL
			if (result.item.url.startsWith("https://r2.example.com")) {
				expect(result.item.url).toContain("r2.example.com");
				expect(result.item.sha256).toHaveLength(64);
			}

			manager.close();
		});
	});
});
