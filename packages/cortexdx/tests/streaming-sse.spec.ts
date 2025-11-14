import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamingSsePlugin } from "../src/plugins/streaming-sse.js";
import type { DiagnosticContext } from "../src/types.js";

const createContext = (
  overrides: Partial<DiagnosticContext> & {
    sseProbe?: DiagnosticContext["sseProbe"];
  } = {},
): DiagnosticContext => {
  const defaultSseProbe = vi.fn().mockResolvedValue({
    ok: true,
    resolvedUrl: "http://localhost:5001/events",
  }) as DiagnosticContext["sseProbe"];
  return {
    endpoint: "http://localhost:5001",
    headers: {},
    logger: () => undefined,
    request: async () => ({}),
    jsonrpc: async () => ({}),
    sseProbe: overrides.sseProbe ?? defaultSseProbe,
    evidence: () => undefined,
    deterministic: true,
    ...overrides,
  };
};

describe("StreamingSsePlugin configuration guards", () => {
  const originalDisable = process.env.CORTEXDX_DISABLE_SSE;
  const originalEndpoint = process.env.CORTEXDX_SSE_ENDPOINT;

  beforeEach(() => {
    process.env.CORTEXDX_DISABLE_SSE = originalDisable;
    process.env.CORTEXDX_SSE_ENDPOINT = originalEndpoint;
  });

  afterEach(() => {
    if (originalDisable === undefined) {
      delete process.env.CORTEXDX_DISABLE_SSE;
    } else {
      process.env.CORTEXDX_DISABLE_SSE = originalDisable;
    }
    if (originalEndpoint === undefined) {
      delete process.env.CORTEXDX_SSE_ENDPOINT;
    } else {
      process.env.CORTEXDX_SSE_ENDPOINT = originalEndpoint;
    }
  });

  it("skips the SSE probe when disabled via env", async () => {
    process.env.CORTEXDX_DISABLE_SSE = "1";
    const sseProbe = vi.fn();
    const ctx = createContext({ sseProbe });

    const findings = await StreamingSsePlugin.run(ctx);

    expect(sseProbe).not.toHaveBeenCalled();
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      id: "sse.disabled",
      severity: "info",
    });
  });

  it("uses the override endpoint when provided", async () => {
    const overrideEndpoint = "http://127.0.0.1:5001/sse";
    process.env.CORTEXDX_SSE_ENDPOINT = overrideEndpoint;
    const sseProbe = vi.fn().mockResolvedValue({
      ok: true,
      resolvedUrl: overrideEndpoint,
    });
    const ctx = createContext({ sseProbe });

    await StreamingSsePlugin.run(ctx);

    expect(sseProbe).toHaveBeenCalledTimes(1);
    expect(sseProbe).toHaveBeenCalledWith(
      overrideEndpoint,
      expect.objectContaining({ headers: ctx.headers }),
    );
  });
});
