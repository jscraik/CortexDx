import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    PerformancePlugin,
    buildPerformanceFindings,
    measureTransports,
    type PerformanceMeasurementOptions,
} from "../src/plugins/performance.js";
import type { DiagnosticContext, TransportTranscript } from "../src/types.js";

interface FakeHarnessOptions {
    httpLatency?: number;
    sse?: { firstEventMs?: number; heartbeatMs?: number };
    websocketGaps?: number[];
    status?: number;
}

function createFakeHarness(options: FakeHarnessOptions = {}) {
    let tick = 0;
    const latency = options.httpLatency ?? 25;
    return {
        now: () => {
            const current = tick;
            tick += latency;
            return current;
        },
        fetch: vi.fn(async () => new Response("{}", { status: options.status ?? 200 })),
        sseProbe: vi.fn(async () => ({
            ok: true,
            firstEventMs: options.sse?.firstEventMs,
            heartbeatMs: options.sse?.heartbeatMs,
        })),
        transcript: (): TransportTranscript => buildTranscript(options.websocketGaps ?? []),
        headers: () => ({}),
    };
}

function buildTranscript(gaps: number[]): TransportTranscript {
    let cursor = 0;
    const exchanges = gaps.map((gap, index) => {
        cursor += gap;
        return {
            method: index === 0 ? "CONNECT" : "MESSAGE",
            timestamp: new Date(cursor).toISOString(),
        };
    });
    return { sessionId: "ws", exchanges } as TransportTranscript;
}

function buildMeasurementOptions(options: FakeHarnessOptions): PerformanceMeasurementOptions {
    const harness = createFakeHarness(options);
    return {
        harness,
    };
}

beforeEach(() => {
    vi.restoreAllMocks();
});

describe("measureTransports", () => {
    it("captures latency and transport metrics deterministically", async () => {
        const ctx = createDiagnosticContext();
        const options = buildMeasurementOptions({
            httpLatency: 30,
            sse: { firstEventMs: 120, heartbeatMs: 45 },
            websocketGaps: [0, 50, 120, 200],
        });

        const metrics = await measureTransports(ctx, options);

        expect(metrics.http?.latencyMs).toBe(30);
        expect(metrics.sse?.firstEventMs).toBe(120);
        expect(metrics.sse?.heartbeatMs).toBe(45);
        expect(metrics.sse?.jitterMs).toBe(75);
        expect(metrics.websocket?.maxGapMs).toBe(200);
    });
});

describe("buildPerformanceFindings", () => {
    it("emits findings with evidence for each transport", () => {
        const findings = buildPerformanceFindings({
            http: { latencyMs: 40, status: 200 },
            sse: { firstEventMs: 120, heartbeatMs: 60, jitterMs: 15 },
            websocket: { messageCount: 3, maxGapMs: 80, reconnects: 0 },
        }, "https://mcp.local");

        expect(findings).toHaveLength(3);
        expect(findings.map((f) => f.area)).toEqual([
            "performance",
            "performance",
            "performance",
        ]);
        expect(findings[0]?.evidence[0]?.ref).toContain("http");
        expect(findings[1]?.description).toContain("jitter");
        expect(findings[2]?.description).toContain("messages");
    });
});

describe("PerformancePlugin", () => {
    it("uses harness metrics when running in deterministic tests", async () => {
        const ctx = createDiagnosticContext();
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response("{}", { status: 200 }));
        const nowValues = [0, 30, 30];
        const nowMock = vi.spyOn(performance, "now").mockImplementation(() => {
            const next = nowValues.shift();
            return next ?? 30;
        });
        const sseProbeMock = vi.fn().mockResolvedValue({
            ok: true,
            firstEventMs: 120,
            heartbeatMs: 45,
        });
        ctx.sseProbe = sseProbeMock;
        ctx.transport = {
            transcript: () => buildTranscript([0, 50, 120, 200]),
            headers: () => ({}),
        };

        const findings = await PerformancePlugin.run(ctx);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(sseProbeMock).toHaveBeenCalledTimes(1);
        expect(findings).toHaveLength(3);
        expect(findings.every((finding) => finding.area === "performance")).toBe(true);
        expect(findings.map((finding) => finding.id)).toEqual([
            "perf.http.latency",
            "perf.sse.metrics",
            "perf.websocket.activity",
        ]);

        fetchMock.mockRestore();
        nowMock.mockRestore();
    });
});

function createDiagnosticContext(): DiagnosticContext {
    return {
        endpoint: "https://mcp.local", 
        logger: vi.fn(),
        request: vi.fn(),
        jsonrpc: vi.fn().mockResolvedValue({}),
        sseProbe: vi.fn().mockResolvedValue({ ok: true }),
        evidence: vi.fn(),
        deterministic: true,
    };
}
