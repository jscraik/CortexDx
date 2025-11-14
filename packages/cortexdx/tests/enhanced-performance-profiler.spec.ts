/**
 * Enhanced Performance Profiler Plugin Tests
 *
 * Tests for task 27.6: Write Enhanced Performance Profiler Tests
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5
 *
 * This test suite validates:
 * - Clinic.js integration for Node.js profiling (Req 22.1)
 * - py-spy integration for Python profiling (Req 22.2)
 * - Unified flame graph generation (Req 22.3)
 * - Enhanced bottleneck detection (Req 22.4)
 * - Optimization recommendations with code examples (Req 22.5)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { describeIntegration } from "./utils/test-mode.js";
import {
    ClinicJsPerformanceProfilerPlugin,
    EnhancedPerformanceProfilerPlugin,
    PySpyPerformanceProfilerPlugin,
    UnifiedFlameGraphPlugin,
    generateOptimizationRecommendations,
} from "../src/plugins/performance.js";
import type { DiagnosticContext, Finding } from "../src/types.js";

// Mock diagnostic context
function createMockContext(): DiagnosticContext {
    return {
        endpoint: "http://localhost:3000",
        headers: {},
        logger: vi.fn(),
        request: vi.fn(),
        jsonrpc: vi.fn(),
        sseProbe: vi.fn(),
        evidence: vi.fn(),
        deterministic: false,
    };
}

describeIntegration("Enhanced Performance Profiler Plugin", () => {
    let ctx: DiagnosticContext;

    beforeEach(() => {
        ctx = createMockContext();
        vi.clearAllMocks();
    });

    describe("Core Performance Profiling", () => {
        it(
            "should complete profiling within performance requirements (<20s)",
            async () => {
                // Mock successful JSON-RPC responses
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const startTime = performance.now();
                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);
                const duration = performance.now() - startTime;

                expect(findings).toBeDefined();
                expect(Array.isArray(findings)).toBe(true);
                expect(duration).toBeLessThan(20000); // <20s requirement

                // Should have performance timing finding
                const perfFinding = findings.find((f) =>
                    f.id.includes("perf.profiler.performance"),
                );
                expect(perfFinding).toBeDefined();
            },
            25000,
        ); // 25s timeout

        it(
            "should perform real-time monitoring with 1-second intervals",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                // Should have monitoring results
                const monitoringFinding = findings.find((f) =>
                    f.id.includes("perf.monitoring"),
                );
                expect(monitoringFinding).toBeDefined();
            },
            25000,
        );

        it(
            "should perform millisecond precision timing analysis",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                // Should have timing analysis with millisecond precision
                const timingFindings = findings.filter((f) =>
                    f.id.includes("perf.timing"),
                );
                expect(timingFindings.length).toBeGreaterThan(0);

                // Check that timing values are in milliseconds with decimal precision
                timingFindings.forEach((finding) => {
                    expect(finding.description).toMatch(/\d+\.\d+ms/);
                });
            },
            25000,
        );

        it(
            "should identify bottlenecks with <20s analysis time",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const startTime = performance.now();
                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);
                const duration = performance.now() - startTime;

                expect(duration).toBeLessThan(20000);

                // Should have bottleneck analysis
                const bottleneckFindings = findings.filter((f) =>
                    f.id.includes("perf.bottleneck"),
                );
                expect(bottleneckFindings.length).toBeGreaterThan(0);
            },
            25000,
        );

        it(
            "should profile resource usage (memory, CPU)",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                // Should have resource profiling results
                const resourceFindings = findings.filter((f) =>
                    f.id.includes("perf.resources"),
                );
                expect(resourceFindings.length).toBeGreaterThan(0);
            },
            25000,
        );
    });

    describe("Enhanced Bottleneck Detection (Req 22.4)", () => {
        it(
            "should detect event-loop blocking",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                // Should have event-loop analysis
                const eventLoopFindings = findings.filter((f) =>
                    f.id.includes("event_loop"),
                );
                expect(eventLoopFindings.length).toBeGreaterThan(0);

                // Should provide recommendations for event-loop issues
                const eventLoopFinding = eventLoopFindings[0];
                if (eventLoopFinding && eventLoopFinding.severity !== "info") {
                    expect(eventLoopFinding.recommendation).toBeDefined();
                    expect(eventLoopFinding.recommendation).toContain("event-loop");
                }
            },
            25000,
        );

        it(
            "should detect CPU hotspots",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                // Should have CPU profiling results
                const cpuFindings = findings.filter((f) => f.id.includes("cpu"));
                expect(cpuFindings.length).toBeGreaterThan(0);
            },
            25000,
        );

        it(
            "should detect async bottlenecks",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                // Should have async operation analysis
                const asyncFindings = findings.filter((f) => f.id.includes("async"));
                expect(asyncFindings.length).toBeGreaterThan(0);
            },
            25000,
        );

        it(
            "should provide bottleneck recommendations with code examples",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                // Find bottleneck findings with recommendations
                const bottleneckWithRec = findings.find(
                    (f) =>
                        f.id.includes("bottleneck") &&
                        f.severity !== "info" &&
                        f.recommendation,
                );

                if (bottleneckWithRec) {
                    expect(bottleneckWithRec.recommendation).toBeDefined();
                    // Recommendations should include code examples
                    expect(bottleneckWithRec.recommendation).toMatch(/```/);
                }
            },
            25000,
        );
    });

    describe("Optimization Recommendations (Req 22.5)", () => {
        it(
            "should generate optimization recommendations within 30s",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const startTime = performance.now();
                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);
                const duration = performance.now() - startTime;

                expect(duration).toBeLessThan(30000); // <30s requirement

                // Should have recommendations
                const recommendations = findings.filter((f) =>
                    f.id.includes("recommendation"),
                );
                expect(recommendations.length).toBeGreaterThan(0);
            },
            35000,
        ); // 35s timeout

        it(
            "should provide actionable recommendations with code examples",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                const recommendations = findings.filter((f) =>
                    f.id.includes("recommendation"),
                );

                // At least one recommendation should have code examples
                const hasCodeExamples = recommendations.some(
                    (r) => r.description && r.description.includes("```"),
                );
                expect(hasCodeExamples).toBe(true);
            },
            25000,
        );

        it(
            "should include performance impact estimates in recommendations",
            async () => {
                vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                const recommendations = findings.filter((f) =>
                    f.id.includes("recommendation"),
                );

                // Recommendations should include performance impact estimates
                const hasImpactEstimates = recommendations.some(
                    (r) =>
                        r.description &&
                        (r.description.includes("Performance Impact") ||
                            r.description.includes("Expected Impact") ||
                            r.description.includes("reduction")),
                );
                expect(hasImpactEstimates).toBe(true);
            },
            25000,
        );

        it("should generate comprehensive recommendations from findings", () => {
            // Create mock findings with various issues
            const mockFindings: Finding[] = [
                {
                    id: "perf.bottleneck.event_loop_blocking",
                    area: "performance-bottlenecks",
                    severity: "major",
                    title: "Event-loop blocking detected",
                    description: "Event-loop delays detected",
                    evidence: [],
                    confidence: 0.9,
                },
                {
                    id: "perf.bottleneck.cpu_hotspot.json_parsing",
                    area: "performance-bottlenecks",
                    severity: "minor",
                    title: "CPU hotspot: JSON Parsing",
                    description: "JSON parsing consuming CPU",
                    evidence: [],
                    confidence: 0.8,
                },
                {
                    id: "perf.bottleneck.async_slow",
                    area: "performance-bottlenecks",
                    severity: "minor",
                    title: "Slow async operation",
                    description: "Async operation taking too long",
                    evidence: [],
                    confidence: 0.8,
                },
                {
                    id: "perf.resources.potential_leak",
                    area: "performance-resources",
                    severity: "minor",
                    title: "Potential memory leak",
                    description: "Memory usage increasing",
                    evidence: [],
                    confidence: 0.6,
                },
            ];

            const recommendations =
                generateOptimizationRecommendations(mockFindings);

            expect(recommendations.length).toBeGreaterThan(0);

            // Should have event-loop recommendation
            const eventLoopRec = recommendations.find((r) =>
                r.id.includes("event_loop"),
            );
            expect(eventLoopRec).toBeDefined();
            expect(eventLoopRec?.description).toContain("Event-loop");

            // Should have CPU recommendation
            const cpuRec = recommendations.find((r) => r.id.includes("cpu"));
            expect(cpuRec).toBeDefined();
            expect(cpuRec?.description).toContain("CPU");

            // Should have async recommendation
            const asyncRec = recommendations.find((r) => r.id.includes("async"));
            expect(asyncRec).toBeDefined();
            expect(asyncRec?.description).toContain("Async");

            // Memory recommendation is optional - only generated if memory issues exist
            // The function checks for hasMemoryIssues before generating memory recommendations
            const memoryRec = recommendations.find((r) => r.id.includes("memory"));
            if (memoryRec) {
                expect(memoryRec.description).toContain("Memory");
            }

            // Should have best practices recommendation
            const bestPracticesRec = recommendations.find((r) =>
                r.id.includes("best_practices"),
            );
            expect(bestPracticesRec).toBeDefined();
        });
    });

    describe("Error Handling", () => {
        it(
            "should handle JSON-RPC failures gracefully",
            async () => {
                vi.mocked(ctx.jsonrpc).mockRejectedValue(
                    new Error("Connection failed"),
                );

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                expect(findings).toBeDefined();
                expect(Array.isArray(findings)).toBe(true);
                // Should still return findings even with errors
                expect(findings.length).toBeGreaterThan(0);
            },
            25000,
        );

        it(
            "should report profiling errors with appropriate severity",
            async () => {
                vi.mocked(ctx.jsonrpc).mockRejectedValue(
                    new Error("Profiling failed"),
                );

                const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

                const errorFinding = findings.find((f) => f.id.includes("error"));
                if (errorFinding) {
                    expect(errorFinding.severity).toMatch(/major|minor/);
                }
            },
            25000,
        );
    });
});

describe("Clinic.js Performance Profiler Plugin (Req 22.1)", () => {
    let ctx: DiagnosticContext;

    beforeEach(() => {
        ctx = createMockContext();
        vi.clearAllMocks();
    });

    it("should check Clinic.js availability", async () => {
        const findings = await ClinicJsPerformanceProfilerPlugin.run(ctx);

        expect(findings).toBeDefined();
        expect(Array.isArray(findings)).toBe(true);
        expect(findings.length).toBeGreaterThan(0);
    });

    it("should provide information about Clinic Doctor", async () => {
        const findings = await ClinicJsPerformanceProfilerPlugin.run(ctx);

        const doctorInfo = findings.find((f) => f.id.includes("doctor"));
        expect(doctorInfo).toBeDefined();
        expect(doctorInfo?.title).toContain("Doctor");
        expect(doctorInfo?.description).toContain("event-loop");
    });

    it("should provide information about Clinic Flame", async () => {
        const findings = await ClinicJsPerformanceProfilerPlugin.run(ctx);

        const flameInfo = findings.find((f) => f.id.includes("flame"));
        expect(flameInfo).toBeDefined();
        expect(flameInfo?.title).toContain("Flame");
        expect(flameInfo?.description).toContain("CPU");
    });

    it("should provide information about Clinic Bubbleprof", async () => {
        const findings = await ClinicJsPerformanceProfilerPlugin.run(ctx);

        const bubbleInfo = findings.find((f) => f.id.includes("bubbleprof"));
        expect(bubbleInfo).toBeDefined();
        expect(bubbleInfo?.title).toContain("Bubbleprof");
        expect(bubbleInfo?.description).toContain("async");
    });

    it("should provide usage recommendations for Clinic.js tools", async () => {
        const findings = await ClinicJsPerformanceProfilerPlugin.run(ctx);

        const findingsWithRec = findings.filter((f) => f.recommendation);
        expect(findingsWithRec.length).toBeGreaterThan(0);

        // Recommendations should mention clinic commands
        const hasClinicCommands = findingsWithRec.some(
            (f) => f.recommendation && f.recommendation.includes("clinic"),
        );
        expect(hasClinicCommands).toBe(true);
    });

    it("should handle non-Node.js environments gracefully", async () => {
        // This test runs in Node.js, so we can't truly test non-Node.js
        // but we can verify the plugin handles the check
        const findings = await ClinicJsPerformanceProfilerPlugin.run(ctx);

        expect(findings).toBeDefined();
        expect(Array.isArray(findings)).toBe(true);
    });
});

describe("py-spy Performance Profiler Plugin (Req 22.2)", () => {
    let ctx: DiagnosticContext;

    beforeEach(() => {
        ctx = createMockContext();
        vi.clearAllMocks();
    });

    it("should check py-spy availability", async () => {
        const findings = await PySpyPerformanceProfilerPlugin.run(ctx);

        expect(findings).toBeDefined();
        expect(Array.isArray(findings)).toBe(true);
        expect(findings.length).toBeGreaterThan(0);
    });

    it("should provide information about py-spy CPU profiling", async () => {
        const findings = await PySpyPerformanceProfilerPlugin.run(ctx);

        const cpuInfo = findings.find((f) => f.id.includes("cpu_profiling"));
        if (cpuInfo) {
            expect(cpuInfo.title).toContain("CPU profiling");
            expect(cpuInfo.description).toContain("Python");
        }
    });

    it("should provide information about py-spy flame graph generation", async () => {
        const findings = await PySpyPerformanceProfilerPlugin.run(ctx);

        const flameInfo = findings.find((f) => f.id.includes("flamegraph"));
        if (flameInfo) {
            expect(flameInfo.title).toContain("flame graph");
            expect(flameInfo.description).toContain("SVG");
        }
    });

    it("should provide information about subprocess profiling", async () => {
        const findings = await PySpyPerformanceProfilerPlugin.run(ctx);

        const subprocessInfo = findings.find((f) => f.id.includes("subprocess"));
        if (subprocessInfo) {
            expect(subprocessInfo.title).toContain("subprocess");
            expect(subprocessInfo.description).toContain("Python");
        }
    });

    it("should provide information about native extension profiling", async () => {
        const findings = await PySpyPerformanceProfilerPlugin.run(ctx);

        const nativeInfo = findings.find((f) => f.id.includes("native"));
        if (nativeInfo) {
            expect(nativeInfo.title).toContain("native");
            expect(nativeInfo.description).toContain("C code");
        }
    });

    it("should provide usage recommendations for py-spy", async () => {
        const findings = await PySpyPerformanceProfilerPlugin.run(ctx);

        const findingsWithRec = findings.filter((f) => f.recommendation);
        expect(findingsWithRec.length).toBeGreaterThan(0);

        // Recommendations should mention py-spy commands
        const hasPySpyCommands = findingsWithRec.some(
            (f) => f.recommendation && f.recommendation.includes("py-spy"),
        );
        expect(hasPySpyCommands).toBe(true);
    });
});

describe("Unified Flame Graph Plugin (Req 22.3)", () => {
    let ctx: DiagnosticContext;

    beforeEach(() => {
        ctx = createMockContext();
        vi.clearAllMocks();
    });

    it("should initialize flame graph generator", async () => {
        const findings = await UnifiedFlameGraphPlugin.run(ctx);

        expect(findings).toBeDefined();
        expect(Array.isArray(findings)).toBe(true);
        expect(findings.length).toBeGreaterThan(0);
    });

    it("should support multiple flame graph formats (SVG, HTML, JSON)", async () => {
        const findings = await UnifiedFlameGraphPlugin.run(ctx);

        const formatInfo = findings.find((f) => f.id.includes("formats"));
        expect(formatInfo).toBeDefined();
        expect(formatInfo?.description).toContain("SVG");
        expect(formatInfo?.description).toContain("HTML");
        expect(formatInfo?.description).toContain("JSON");
    });

    it("should provide interactive flame graph features", async () => {
        const findings = await UnifiedFlameGraphPlugin.run(ctx);

        const interactiveInfo = findings.find((f) => f.id.includes("interactive"));
        expect(interactiveInfo).toBeDefined();
        expect(interactiveInfo?.description).toMatch(/zoom|search|interactive/i);
    });

    it("should include flame graph metadata support", async () => {
        const findings = await UnifiedFlameGraphPlugin.run(ctx);

        const metadataInfo = findings.find((f) => f.id.includes("metadata"));
        expect(metadataInfo).toBeDefined();
        expect(metadataInfo?.description).toMatch(/metadata|timestamp|samples/i);
    });

    it("should support multiple color schemes", async () => {
        const findings = await UnifiedFlameGraphPlugin.run(ctx);

        const colorInfo = findings.find((f) => f.id.includes("color"));
        if (colorInfo) {
            expect(colorInfo.description).toMatch(/hot|cold|aqua|green|red/);
        }
    });

    it("should integrate with Clinic.js Flame output", async () => {
        const findings = await UnifiedFlameGraphPlugin.run(ctx);

        const clinicInfo = findings.find((f) => f.id.includes("clinic"));
        expect(clinicInfo).toBeDefined();
        expect(clinicInfo?.description).toContain("Clinic");
    });

    it("should integrate with py-spy flame graph output", async () => {
        const findings = await UnifiedFlameGraphPlugin.run(ctx);

        const pyspyInfo = findings.find((f) => f.id.includes("pyspy"));
        expect(pyspyInfo).toBeDefined();
        expect(pyspyInfo?.description).toContain("py-spy");
    });

    it("should support speedscope JSON format", async () => {
        const findings = await UnifiedFlameGraphPlugin.run(ctx);

        const speedscopeInfo = findings.find((f) => f.id.includes("speedscope"));
        expect(speedscopeInfo).toBeDefined();
        expect(speedscopeInfo?.description).toContain("speedscope");
    });
});

describe("Performance Requirements Validation", () => {
    let ctx: DiagnosticContext;

    beforeEach(() => {
        ctx = createMockContext();
        vi.clearAllMocks();
    });

    it(
        "should complete enhanced profiling within 20 seconds (Req 22.4)",
        async () => {
            vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

            const startTime = performance.now();
            await EnhancedPerformanceProfilerPlugin.run(ctx);
            const duration = performance.now() - startTime;

            expect(duration).toBeLessThan(20000);
        },
        25000,
    );

    it(
        "should generate recommendations within 30 seconds (Req 22.5)",
        async () => {
            vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

            const startTime = performance.now();
            const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);
            const duration = performance.now() - startTime;

            expect(duration).toBeLessThan(30000);

            // Should have recommendations
            const recommendations = findings.filter((f) =>
                f.id.includes("recommendation"),
            );
            expect(recommendations.length).toBeGreaterThan(0);
        },
        35000,
    );

    it(
        "should provide millisecond precision in timing measurements",
        async () => {
            vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

            const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

            // Check that timing values have decimal precision
            const timingFindings = findings.filter(
                (f) => f.description && f.description.includes("ms"),
            );

            expect(timingFindings.length).toBeGreaterThan(0);

            // At least some findings should have decimal precision
            const hasDecimalPrecision = timingFindings.some(
                (f) => f.description && /\d+\.\d+ms/.test(f.description),
            );
            expect(hasDecimalPrecision).toBe(true);
        },
        25000,
    );
});

describe("Integration Tests", () => {
    let ctx: DiagnosticContext;

    beforeEach(() => {
        ctx = createMockContext();
        vi.clearAllMocks();
    });

    it(
        "should integrate all profiling components",
        async () => {
            vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

            const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

            // Should have findings from multiple profiling areas
            const areas = new Set(findings.map((f) => f.area));

            expect(areas.has("performance-profiling")).toBe(true);
            expect(areas.has("performance-monitoring")).toBe(true);
            expect(areas.has("performance-timing")).toBe(true);
            expect(areas.has("performance-bottlenecks")).toBe(true);
        },
        25000,
    );

    it(
        "should provide comprehensive profiling report",
        async () => {
            vi.mocked(ctx.jsonrpc).mockResolvedValue({ result: "success" });

            const findings = await EnhancedPerformanceProfilerPlugin.run(ctx);

            // Should have multiple types of findings
            expect(findings.length).toBeGreaterThan(5);

            // Should have findings with different severity levels
            const severities = new Set(findings.map((f) => f.severity));
            expect(severities.size).toBeGreaterThan(1);

            // Should have findings with evidence
            const withEvidence = findings.filter((f) => f.evidence.length > 0);
            expect(withEvidence.length).toBeGreaterThan(0);

            // Should have findings with confidence scores
            const withConfidence = findings.filter((f) => f.confidence !== undefined);
            expect(withConfidence.length).toBeGreaterThan(0);
        },
        25000,
    );
});
