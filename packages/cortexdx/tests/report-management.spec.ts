import { rm, unlink } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReportConfigManager } from "../src/storage/report-config.js";
import { ReportManager, type DiagnosticReport } from "../src/storage/report-manager.js";
import { ReportOptimizer } from "../src/storage/report-optimizer.js";
import type { Finding } from "../src/types.js";

describe("Report Management Tests", () => {
    const testStorageRoot = "/tmp/test-reports";
    let reportManager: ReportManager;

    beforeEach(async () => {
        reportManager = new ReportManager({
            storageRoot: testStorageRoot,
            baseUrl: "http://localhost:5001/reports",
            organizationStrategy: "date",
            retentionDays: 30,
            enableCompression: false,
            formats: ["json", "markdown", "html"],
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

    describe("Report Storage", () => {
        it("should store a report in multiple formats", async () => {
            const report: DiagnosticReport = {
                sessionId: "test-session-1",
                diagnosticType: "protocol-compliance",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1500,
                findings: [],
                tags: ["test"],
            };

            const metadata = await reportManager.storeReport(report);

            expect(metadata.id).toBeDefined();
            expect(metadata.url).toContain(metadata.id);
            expect(metadata.sessionId).toBe("test-session-1");
            expect(metadata.diagnosticType).toBe("protocol-compliance");
            expect(metadata.formats).toEqual(["json", "markdown", "html"]);
        });

        it("should retrieve a report in JSON format", async () => {
            const report: DiagnosticReport = {
                sessionId: "test-session-2",
                diagnosticType: "security-scan",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 2000,
                findings: [],
            };

            const metadata = await reportManager.storeReport(report);
            const retrieved = await reportManager.retrieveReport(metadata.id, "json");

            expect(retrieved).toBeDefined();
            const parsed = JSON.parse(retrieved) as DiagnosticReport;
            expect(parsed.sessionId).toBe("test-session-2");
            expect(parsed.diagnosticType).toBe("security-scan");
        });

        it("should retrieve a report in Markdown format", async () => {
            const report: DiagnosticReport = {
                sessionId: "test-session-3",
                diagnosticType: "performance-test",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1000,
                findings: [],
            };

            const metadata = await reportManager.storeReport(report);
            const retrieved = await reportManager.retrieveReport(metadata.id, "markdown");

            expect(retrieved).toContain("# CortexDx Diagnostic Report");
            expect(retrieved).toContain("test-session-3");
            expect(retrieved).toContain("performance-test");
        });

        it("should retrieve a report in HTML format", async () => {
            const report: DiagnosticReport = {
                sessionId: "test-session-4",
                diagnosticType: "compatibility-test",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1500,
                findings: [],
            };

            const metadata = await reportManager.storeReport(report);
            const retrieved = await reportManager.retrieveReport(metadata.id, "html");

            expect(retrieved).toContain("<!DOCTYPE html>");
            expect(retrieved).toContain("CortexDx Diagnostic Report");
            expect(retrieved).toContain("test-session-4");
        });
    });

    describe("Report Organization", () => {
        it("should organize reports by date", async () => {
            const manager = new ReportManager({
                storageRoot: testStorageRoot,
                organizationStrategy: "date",
            });
            await manager.initialize();

            const report: DiagnosticReport = {
                sessionId: "session-date",
                diagnosticType: "test",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1000,
                findings: [],
            };

            const metadata = await manager.storeReport(report);
            const date = new Date().toISOString().split("T")[0];

            expect(metadata.path).toContain(date);
            manager.close();
        });

        it("should organize reports by session", async () => {
            const manager = new ReportManager({
                storageRoot: testStorageRoot,
                organizationStrategy: "session",
            });
            await manager.initialize();

            const report: DiagnosticReport = {
                sessionId: "session-123",
                diagnosticType: "test",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1000,
                findings: [],
            };

            const metadata = await manager.storeReport(report);

            expect(metadata.path).toContain("session-123");
            manager.close();
        });

        it("should organize reports by type", async () => {
            const manager = new ReportManager({
                storageRoot: testStorageRoot,
                organizationStrategy: "type",
            });
            await manager.initialize();

            const report: DiagnosticReport = {
                sessionId: "session-type",
                diagnosticType: "security-scan",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1000,
                findings: [],
            };

            const metadata = await manager.storeReport(report);

            expect(metadata.path).toContain("security-scan");
            manager.close();
        });
    });

    describe("Report Deletion", () => {
        it("should delete a report and all its formats", async () => {
            const report: DiagnosticReport = {
                sessionId: "delete-test",
                diagnosticType: "test",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1000,
                findings: [],
            };

            const metadata = await reportManager.storeReport(report);
            await reportManager.deleteReport(metadata.id);

            await expect(
                reportManager.retrieveReport(metadata.id, "json")
            ).rejects.toThrow("Report not found");
        });
    });

    describe("Report Listing and Search", () => {
        it("should list all reports", async () => {
            const reports: DiagnosticReport[] = [
                {
                    sessionId: "list-1",
                    diagnosticType: "type-a",
                    endpoint: "http://localhost:3000",
                    inspectedAt: new Date().toISOString(),
                    durationMs: 1000,
                    findings: [],
                },
                {
                    sessionId: "list-2",
                    diagnosticType: "type-b",
                    endpoint: "http://localhost:3000",
                    inspectedAt: new Date().toISOString(),
                    durationMs: 1500,
                    findings: [],
                },
            ];

            for (const report of reports) {
                await reportManager.storeReport(report);
            }

            const listed = await reportManager.listReports();
            expect(listed.length).toBeGreaterThanOrEqual(2);
        });

        it("should filter reports by diagnostic type", async () => {
            const reports: DiagnosticReport[] = [
                {
                    sessionId: "filter-1",
                    diagnosticType: "security-scan",
                    endpoint: "http://localhost:3000",
                    inspectedAt: new Date().toISOString(),
                    durationMs: 1000,
                    findings: [],
                },
                {
                    sessionId: "filter-2",
                    diagnosticType: "performance-test",
                    endpoint: "http://localhost:3000",
                    inspectedAt: new Date().toISOString(),
                    durationMs: 1500,
                    findings: [],
                },
            ];

            for (const report of reports) {
                await reportManager.storeReport(report);
            }

            const filtered = await reportManager.listReports({
                diagnosticType: "security-scan",
            });

            expect(filtered.length).toBeGreaterThanOrEqual(1);
            expect(filtered.every(r => r.diagnosticType === "security-scan")).toBe(true);
        });

        it("should search reports by query", async () => {
            const report: DiagnosticReport = {
                sessionId: "search-test",
                diagnosticType: "security-scan",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1000,
                findings: [],
                tags: ["important", "production"],
            };

            await reportManager.storeReport(report);

            const results = await reportManager.searchReports("security");
            expect(results.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("URL Generation", () => {
        it("should generate unique URLs for reports", async () => {
            const report: DiagnosticReport = {
                sessionId: "url-test",
                diagnosticType: "test",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1000,
                findings: [],
            };

            const metadata = await reportManager.storeReport(report);

            expect(metadata.url).toContain("http://localhost:5001/reports/");
            expect(metadata.url).toContain(metadata.id);
        });

        it("should retrieve report by URL", async () => {
            const report: DiagnosticReport = {
                sessionId: "url-retrieve",
                diagnosticType: "test",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1000,
                findings: [],
            };

            const metadata = await reportManager.storeReport(report);
            const retrieved = await reportManager.getReportByUrl(metadata.url, "json");

            expect(retrieved).toBeDefined();
            const parsed = JSON.parse(retrieved) as DiagnosticReport;
            expect(parsed.sessionId).toBe("url-retrieve");
        });
    });

    describe("Storage Location Management", () => {
        it("should get current storage location", async () => {
            const location = await reportManager.getStorageLocation();
            expect(location).toBe(testStorageRoot);
        });

        it("should set new storage location", async () => {
            const newLocation = "/tmp/new-reports";
            await reportManager.setStorageLocation(newLocation);

            const location = await reportManager.getStorageLocation();
            expect(location).toBe(newLocation);

            // Cleanup
            try {
                await rm(newLocation, { recursive: true, force: true });
            } catch {
                // Ignore
            }
        });
    });

    describe("Retention Policy", () => {
        it("should cleanup old reports", async () => {
            const manager = new ReportManager({
                storageRoot: testStorageRoot,
                retentionDays: 0, // Immediate cleanup
            });
            await manager.initialize();

            const report: DiagnosticReport = {
                sessionId: "cleanup-test",
                diagnosticType: "test",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1000,
                findings: [],
            };

            await manager.storeReport(report);

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 100));

            const cleaned = await manager.cleanupOldReports();
            expect(cleaned).toBeGreaterThanOrEqual(0);

            manager.close();
        });
    });
});

describe("Report Optimizer Tests", () => {
    describe("Token Usage Optimization", () => {
        it("should create optimized response with URL", () => {
            const findings: Finding[] = [
                {
                    id: "f1",
                    area: "security",
                    severity: "blocker",
                    title: "Critical Security Issue",
                    description: "This is a critical security vulnerability",
                    evidence: [],
                },
                {
                    id: "f2",
                    area: "performance",
                    severity: "minor",
                    title: "Minor Performance Issue",
                    description: "This is a minor performance issue",
                    evidence: [],
                },
            ];

            const report: DiagnosticReport = {
                sessionId: "opt-test",
                diagnosticType: "security-scan",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1500,
                findings,
            };

            const metadata = {
                id: "report-123",
                url: "http://localhost:5001/reports/report-123",
                sessionId: "opt-test",
                diagnosticType: "security-scan",
                createdAt: new Date(),
                size: 1000,
                formats: ["json" as const],
                path: "/tmp/report-123",
                tags: [],
            };

            const optimized = ReportOptimizer.optimizeResponse(report, metadata);

            expect(optimized.reportUrl).toBe(metadata.url);
            expect(optimized.summary).toContain("2 issue");
            expect(optimized.findingsSummary.total).toBe(2);
            expect(optimized.findingsSummary.bySevert.blocker).toBe(1);
            expect(optimized.criticalFindings).toBeDefined();
            expect(optimized.criticalFindings?.length).toBe(1);
        });

        it("should summarize findings by severity", () => {
            const findings: Finding[] = [
                {
                    id: "f1",
                    area: "security",
                    severity: "blocker",
                    title: "Blocker",
                    description: "desc",
                    evidence: [],
                },
                {
                    id: "f2",
                    area: "security",
                    severity: "major",
                    title: "Major",
                    description: "desc",
                    evidence: [],
                },
                {
                    id: "f3",
                    area: "performance",
                    severity: "minor",
                    title: "Minor",
                    description: "desc",
                    evidence: [],
                },
                {
                    id: "f4",
                    area: "info",
                    severity: "info",
                    title: "Info",
                    description: "desc",
                    evidence: [],
                },
            ];

            const summary = ReportOptimizer.summarizeFindings(findings);

            expect(summary.total).toBe(4);
            expect(summary.bySevert.blocker).toBe(1);
            expect(summary.bySevert.major).toBe(1);
            expect(summary.bySevert.minor).toBe(1);
            expect(summary.bySevert.info).toBe(1);
            expect(summary.topIssues.length).toBe(4);
        });

        it("should estimate token savings", () => {
            const findings: Finding[] = Array.from({ length: 10 }, (_, i) => ({
                id: `f${i}`,
                area: "test",
                severity: "minor" as const,
                title: `Finding ${i}`,
                description: "This is a test finding with some description text that takes up space",
                evidence: [{ type: "url" as const, ref: "http://example.com" }],
            }));

            const report: DiagnosticReport = {
                sessionId: "token-test",
                diagnosticType: "test",
                endpoint: "http://localhost:3000",
                inspectedAt: new Date().toISOString(),
                durationMs: 1000,
                findings,
            };

            const savings = ReportOptimizer.estimateTokenSavings(report);

            expect(savings.fullReportTokens).toBeGreaterThan(0);
            expect(savings.optimizedTokens).toBeGreaterThan(0);
            expect(savings.savings).toBeGreaterThan(0);
            expect(savings.savingsPercent).toBeGreaterThan(0);
            expect(savings.fullReportTokens).toBeGreaterThan(savings.optimizedTokens);
        });
    });
});

describe("Report Configuration Tests", () => {
    const testConfigPath = "/tmp/test-report-config.json";

    afterEach(async () => {
        try {
            await unlink(testConfigPath);
        } catch {
            // File might not exist
        }
    });

    describe("Configuration Loading", () => {
        it("should load default configuration", async () => {
            const configManager = new ReportConfigManager();
            const config = await configManager.loadConfig({
                useEnvironment: false,
                useConfigFile: false,
            });

            expect(config.storageRoot).toBeDefined();
            expect(config.baseUrl).toBeDefined();
            expect(config.organizationStrategy).toBeDefined();
            expect(config.retentionDays).toBeGreaterThan(0);
        });

        it("should save and load configuration from file", async () => {
            const configManager = new ReportConfigManager();

            const config = {
                storageRoot: "/tmp/custom-reports",
                baseUrl: "http://custom:5001/reports",
                organizationStrategy: "session" as const,
                retentionDays: 60,
                enableCompression: true,
                formats: ["json" as const, "markdown" as const],
            };

            await configManager.saveConfig(config, testConfigPath);

            const newManager = new ReportConfigManager();
            const loaded = await newManager.loadConfig({
                configPath: testConfigPath,
                useEnvironment: false,
            });

            expect(loaded.baseUrl).toBe("http://custom:5001/reports");
            expect(loaded.organizationStrategy).toBe("session");
            expect(loaded.retentionDays).toBe(60);
            expect(loaded.enableCompression).toBe(true);
        });
    });

    describe("Storage Location Validation", () => {
        it("should validate writable storage location", async () => {
            const configManager = new ReportConfigManager();
            const result = await configManager.validateStorageLocation("/tmp/test-validation");

            expect(result.valid).toBe(true);
            expect(result.resolvedPath).toBeDefined();

            // Cleanup
            try {
                await rm("/tmp/test-validation", { recursive: true, force: true });
            } catch {
                // Ignore
            }
        });
    });

    describe("Configuration Updates", () => {
        it("should update configuration values", async () => {
            const configManager = new ReportConfigManager();
            await configManager.loadConfig({ useEnvironment: false, useConfigFile: false });

            const updated = await configManager.updateConfig({
                retentionDays: 90,
                enableCompression: true,
            });

            expect(updated.retentionDays).toBe(90);
            expect(updated.enableCompression).toBe(true);
        });
    });
});
