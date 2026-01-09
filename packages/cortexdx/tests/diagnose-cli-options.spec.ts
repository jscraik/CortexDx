import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalArgv = [...process.argv];

describe("diagnose CLI options", () => {
  beforeEach(() => {
    vi.resetModules();
    process.argv = [
      "node",
      "cortexdx",
      "diagnose",
      "https://mcp.example.com",
      "--async",
      "--task-ttl",
      "123",
      "--poll-interval",
      "456",
      "--simulate-external",
      "--a11y",
      "--no-color",
      "--otel-exporter",
      "http://otel.collector",
      "--har",
    ];
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    vi.clearAllMocks();
  });

  it("passes CLI flags through to orchestrator", async () => {
    const runDiagnose = vi.fn().mockResolvedValue(0);
    vi.doMock("../src/orchestrator.js", () => ({ runDiagnose }));

    await import("../src/cli.js");

    await vi.waitFor(() => {
      expect(runDiagnose).toHaveBeenCalledTimes(1);
    });
    expect(runDiagnose).toHaveBeenCalledWith({
      endpoint: "https://mcp.example.com",
      opts: expect.objectContaining({
        async: true,
        taskTtl: "123",
        pollInterval: "456",
        simulateExternal: true,
        a11y: true,
        noColor: true,
        otelExporter: "http://otel.collector",
        har: true,
      }),
    });
  });
});
