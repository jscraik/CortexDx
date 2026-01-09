import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Finding } from "../../core/src/types.js";

vi.mock("../../plugins/src/auth/auth0-handshake.ts", () => ({
  resolveAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer mock" }),
}));

vi.mock("@brainwav/cortexdx-plugins", () => ({
  runPlugins: vi.fn(),
}));

vi.mock("../../plugins/src/report/arctdd.ts", () => ({
  buildArcTddPlan: vi.fn().mockReturnValue("arc"),
}));

vi.mock("../../plugins/src/report/fileplan.ts", () => ({
  buildFilePlan: vi.fn().mockReturnValue([]),
}));

vi.mock("../../plugins/src/report/json.ts", () => ({
  buildJsonReport: vi.fn().mockReturnValue({ report: true }),
}));

vi.mock("../../plugins/src/report/markdown.ts", () => ({
  buildMarkdownReport: vi.fn().mockReturnValue("md"),
}));

vi.mock("../../plugins/src/report/consolidated-report.ts", () => ({
  storeConsolidatedReport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/commands/async-task-utils.js", () => ({
  executeDiagnoseAsync: vi.fn(),
}));

describe("runDiagnose", () => {
  const endpoint = "https://mcp.example.com";

  beforeEach(() => {
    vi.resetModules();
  });

  it("returns severity-based exit code for synchronous runs", async () => {
    const { runPlugins } = await import("@brainwav/cortexdx-plugins");
    const findings: Finding[] = [
      { id: "1", severity: "major", description: "issue", evidence: [] },
    ];
    (runPlugins as vi.Mock).mockResolvedValue({ findings });

    const { runDiagnose } = await import("../src/orchestrator.ts");
    const code = await runDiagnose({
      endpoint,
      opts: { out: mkdtempSync(join(tmpdir(), "cortexdx-sync-")) },
    });

    expect(code).toBe(2);
    expect(runPlugins).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint, suites: [] }),
    );
  });

  it("enqueues and polls async diagnose tasks with numeric TTL and poll interval", async () => {
    const { executeDiagnoseAsync } = await import("../src/commands/async-task-utils.js");
    const asyncFindings: Finding[] = [
      { id: "a1", area: "security", severity: "blocker", title: "Critical Issue", description: "critical", evidence: [] },
    ];
    (executeDiagnoseAsync as vi.Mock).mockResolvedValue({ findings: asyncFindings });

    const { runDiagnose } = await import("../src/orchestrator.ts");
    const code = await runDiagnose({
      endpoint,
      opts: {
        async: true,
        taskTtl: "600000",
        pollInterval: "12000",
        suites: "streaming,cors",
        full: true,
        out: mkdtempSync(join(tmpdir(), "cortexdx-async-")),
      },
    });

    expect(code).toBe(1);
    expect(executeDiagnoseAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint,
        taskTtl: 600000,
        pollInterval: 12000,
        diagnosticArgs: {
          endpoint,
          suites: ["streaming", "cors"],
          full: true,
        },
      }),
    );
  });
});
