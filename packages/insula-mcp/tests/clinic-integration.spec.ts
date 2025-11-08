/**
 * Clinic.js Integration Tests
 * 
 * Tests the integration of Clinic.js suite (Doctor, Flame, Bubbleprof)
 * for Node.js performance profiling.
 */

import { describe, expect, it } from "vitest";
import { ClinicAdapter } from "../src/adapters/clinic-adapter.js";
import { ClinicJsPerformanceProfilerPlugin } from "../src/plugins/performance.js";
import type { DiagnosticContext } from "../src/types.js";

describe("Clinic.js Integration", () => {
    describe("ClinicAdapter", () => {
        it("should create a Clinic adapter instance", () => {
            const adapter = new ClinicAdapter();
            expect(adapter).toBeDefined();
        });

        it("should initialize the working directory", async () => {
            const adapter = new ClinicAdapter();
            await expect(adapter.initialize()).resolves.not.toThrow();
        });

        it("should support custom working directory", () => {
            const customDir = "/tmp/custom-clinic-dir";
            const adapter = new ClinicAdapter(customDir);
            expect(adapter).toBeDefined();
        });
    });

    describe("ClinicJsPerformanceProfilerPlugin", () => {
        it("should have correct plugin metadata", () => {
            expect(ClinicJsPerformanceProfilerPlugin.id).toBe(
                "clinic-js-performance-profiler",
            );
            expect(ClinicJsPerformanceProfilerPlugin.title).toBe(
                "Clinic.js Performance Profiler (Node.js)",
            );
            expect(ClinicJsPerformanceProfilerPlugin.order).toBe(502);
        });

        it("should detect Node.js environment and report Clinic.js availability", async () => {
            const mockContext: DiagnosticContext = {
                endpoint: "http://localhost:3000",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({
                    connected: true,
                    messages: [],
                    errors: [],
                    duration: 0,
                }),
                evidence: () => { },
            };

            const findings = await ClinicJsPerformanceProfilerPlugin.run(mockContext);

            expect(findings).toBeDefined();
            expect(Array.isArray(findings)).toBe(true);
            expect(findings.length).toBeGreaterThan(0);

            // Should report Clinic.js availability
            const availabilityFinding = findings.find(
                (f) => f.id === "clinic.available",
            );
            expect(availabilityFinding).toBeDefined();
            expect(availabilityFinding?.severity).toBe("info");
            expect(availabilityFinding?.title).toContain("Clinic.js profiling available");
        });

        it("should provide information about Clinic Doctor", async () => {
            const mockContext: DiagnosticContext = {
                endpoint: "http://localhost:3000",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({
                    connected: true,
                    messages: [],
                    errors: [],
                    duration: 0,
                }),
                evidence: () => { },
            };

            const findings = await ClinicJsPerformanceProfilerPlugin.run(mockContext);

            const doctorFinding = findings.find((f) => f.id === "clinic.doctor.info");
            expect(doctorFinding).toBeDefined();
            expect(doctorFinding?.title).toContain("Clinic Doctor");
            expect(doctorFinding?.description).toContain("event-loop");
            expect(doctorFinding?.recommendation).toBeDefined();
        });

        it("should provide information about Clinic Flame", async () => {
            const mockContext: DiagnosticContext = {
                endpoint: "http://localhost:3000",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({
                    connected: true,
                    messages: [],
                    errors: [],
                    duration: 0,
                }),
                evidence: () => { },
            };

            const findings = await ClinicJsPerformanceProfilerPlugin.run(mockContext);

            const flameFinding = findings.find((f) => f.id === "clinic.flame.info");
            expect(flameFinding).toBeDefined();
            expect(flameFinding?.title).toContain("Clinic Flame");
            expect(flameFinding?.description).toContain("flame graphs");
            expect(flameFinding?.recommendation).toBeDefined();
        });

        it("should provide information about Clinic Bubbleprof", async () => {
            const mockContext: DiagnosticContext = {
                endpoint: "http://localhost:3000",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({
                    connected: true,
                    messages: [],
                    errors: [],
                    duration: 0,
                }),
                evidence: () => { },
            };

            const findings = await ClinicJsPerformanceProfilerPlugin.run(mockContext);

            const bubbleprofFinding = findings.find(
                (f) => f.id === "clinic.bubbleprof.info",
            );
            expect(bubbleprofFinding).toBeDefined();
            expect(bubbleprofFinding?.title).toContain("Clinic Bubbleprof");
            expect(bubbleprofFinding?.description).toContain("async operations");
            expect(bubbleprofFinding?.recommendation).toBeDefined();
        });

        it("should complete analysis within reasonable time", async () => {
            const mockContext: DiagnosticContext = {
                endpoint: "http://localhost:3000",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({
                    connected: true,
                    messages: [],
                    errors: [],
                    duration: 0,
                }),
                evidence: () => { },
            };

            const startTime = performance.now();
            const findings = await ClinicJsPerformanceProfilerPlugin.run(mockContext);
            const duration = performance.now() - startTime;

            // Should complete quickly since it's just checking availability
            expect(duration).toBeLessThan(1000); // Less than 1 second

            const completionFinding = findings.find(
                (f) => f.id === "clinic.analysis.complete",
            );
            expect(completionFinding).toBeDefined();
        });

        it("should include evidence pointers in findings", async () => {
            const mockContext: DiagnosticContext = {
                endpoint: "http://localhost:3000",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({
                    connected: true,
                    messages: [],
                    errors: [],
                    duration: 0,
                }),
                evidence: () => { },
            };

            const findings = await ClinicJsPerformanceProfilerPlugin.run(mockContext);

            // All findings should have evidence
            for (const finding of findings) {
                expect(finding.evidence).toBeDefined();
                expect(Array.isArray(finding.evidence)).toBe(true);
                expect(finding.evidence.length).toBeGreaterThan(0);
            }
        });

        it("should have confidence scores", async () => {
            const mockContext: DiagnosticContext = {
                endpoint: "http://localhost:3000",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({
                    connected: true,
                    messages: [],
                    errors: [],
                    duration: 0,
                }),
                evidence: () => { },
            };

            const findings = await ClinicJsPerformanceProfilerPlugin.run(mockContext);

            // All findings should have confidence scores
            for (const finding of findings) {
                expect(finding.confidence).toBeDefined();
                expect(finding.confidence).toBeGreaterThanOrEqual(0);
                expect(finding.confidence).toBeLessThanOrEqual(1);
            }
        });
    });

    describe("Clinic.js Tool Information", () => {
        it("should document Clinic Doctor capabilities", async () => {
            const mockContext: DiagnosticContext = {
                endpoint: "http://localhost:3000",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({
                    connected: true,
                    messages: [],
                    errors: [],
                    duration: 0,
                }),
                evidence: () => { },
            };

            const findings = await ClinicJsPerformanceProfilerPlugin.run(mockContext);
            const doctorFinding = findings.find((f) => f.id === "clinic.doctor.info");

            expect(doctorFinding?.description).toContain("event-loop delay");
            expect(doctorFinding?.description).toContain("CPU usage");
            expect(doctorFinding?.description).toContain("memory usage");
            expect(doctorFinding?.description).toContain("active handles");
        });

        it("should document Clinic Flame capabilities", async () => {
            const mockContext: DiagnosticContext = {
                endpoint: "http://localhost:3000",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({
                    connected: true,
                    messages: [],
                    errors: [],
                    duration: 0,
                }),
                evidence: () => { },
            };

            const findings = await ClinicJsPerformanceProfilerPlugin.run(mockContext);
            const flameFinding = findings.find((f) => f.id === "clinic.flame.info");

            expect(flameFinding?.description).toContain("flame graphs");
            expect(flameFinding?.description).toContain("CPU hotspots");
            expect(flameFinding?.description).toContain("function call hierarchies");
        });

        it("should document Clinic Bubbleprof capabilities", async () => {
            const mockContext: DiagnosticContext = {
                endpoint: "http://localhost:3000",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({
                    connected: true,
                    messages: [],
                    errors: [],
                    duration: 0,
                }),
                evidence: () => { },
            };

            const findings = await ClinicJsPerformanceProfilerPlugin.run(mockContext);
            const bubbleprofFinding = findings.find(
                (f) => f.id === "clinic.bubbleprof.info",
            );

            expect(bubbleprofFinding?.description).toContain("async operations");
            expect(bubbleprofFinding?.description).toContain("async bottlenecks");
        });
    });
});
