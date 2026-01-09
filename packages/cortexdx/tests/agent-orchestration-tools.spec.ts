import { rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAgentOrchestrationTools,
  executeAgentOrchestrationTool,
} from "../src/tools/agent-orchestration-tools.js";
import type { DiagnosticContext } from "../src/types.js";

const createMockContext = (): DiagnosticContext => ({
  endpoint: "http://localhost:3000",
  headers: {},
  logger: () => {
    /* noop */
  },
  request: async () => ({}),
  jsonrpc: async () => ({}),
  sseProbe: async () => ({ ok: true }),
  evidence: () => {
    /* noop */
  },
  deterministic: true,
});

const createStateDbPath = (): { dir?: string; dbPath: string } => ({
  dbPath: ":memory:",
});

describe("Agent orchestration MCP tools", () => {
  let context: DiagnosticContext;
  let stateDir: string;
  let stateDb: string;

  beforeEach(() => {
    context = createMockContext();
    const temp = createStateDbPath();
    stateDir = temp.dir;
    stateDb = temp.dbPath;
  });

  afterEach(() => {
    if (stateDir) {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("exposes listing, execution, and history tools", async () => {
    const tools = createAgentOrchestrationTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("cortexdx_agent_list_workflows");
    expect(names).toContain("cortexdx_agent_execute_workflow");
    expect(names).toContain("cortexdx_agent_checkpoint_history");

    const listTool = tools.find(
      (tool) => tool.name === "cortexdx_agent_list_workflows",
    )!;
    const listResult = await executeAgentOrchestrationTool(
      listTool,
      { stateDb },
      context,
    );
    const payload = JSON.parse(listResult.content[0].text);
    expect(Array.isArray(payload.workflows)).toBe(true);
    expect(payload.workflows.length).toBeGreaterThan(0);
  });

  it("runs workflows and records checkpoint history", async () => {
    const tools = createAgentOrchestrationTools();
    const executeTool = tools.find(
      (tool) => tool.name === "cortexdx_agent_execute_workflow",
    )!;

    const execution = await executeAgentOrchestrationTool(
      executeTool,
      {
        workflowId: "agent.langgraph.baseline",
        endpoint: "http://localhost:3000",
        deterministic: true,
        stateDb,
      },
      context,
    );

    const execPayload = JSON.parse(execution.content[0].text);
    expect(execPayload.workflowId).toBe("agent.langgraph.baseline");
    expect(Array.isArray(execPayload.findings)).toBe(true);

    const historyTool = tools.find(
      (tool) => tool.name === "cortexdx_agent_checkpoint_history",
    )!;
    const history = await executeAgentOrchestrationTool(
      historyTool,
      {
        workflowId: "agent.langgraph.baseline",
        stateDb,
      },
      context,
    );
    const historyPayload = JSON.parse(history.content[0].text);
    expect(Array.isArray(historyPayload.sessions)).toBe(true);
    expect(historyPayload.sessions.length).toBeGreaterThan(0);
  });
});
