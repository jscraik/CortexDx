import { MemorySaver, StateGraph, START, END, type StateGraphArgs } from "@langchain/langgraph";
import type { DevelopmentContext, Finding } from "../types.js";
import type { NormalizedFinding } from "./findings.js";
import { normalizeFindings } from "./findings.js";
import { runPlugins, type SandboxBudgets } from "../plugin-host.js";

export interface GraphInput {
  plugins: string[];
  endpoint: string;
  deterministic: boolean;
}

export interface GraphOutput {
  context: DevelopmentContext;
  findings: NormalizedFinding[];
  logs: string[];
}

interface GraphExecutionOptions {
  diagnosticsRunner?: DiagnosticsRunner;
}

interface DiagnosticsRunnerInput {
  endpoint: string;
  plugins: string[];
  deterministic: boolean;
}

type DiagnosticsRunner = (input: DiagnosticsRunnerInput) => Promise<Finding[]>;

interface GraphState {
  context?: DevelopmentContext;
  findings: NormalizedFinding[];
  logs: string[];
  plugins: string[];
  endpoint: string;
  deterministic: boolean;
}

const channels: StateGraphArgs<GraphState>["channels"] = {
  context: {
    value: (x: DevelopmentContext | undefined, y?: DevelopmentContext) => y ?? x,
  },
  findings: {
    value: (x: NormalizedFinding[], y?: NormalizedFinding[]) => (y ? [...x, ...y] : x),
  },
  logs: {
    value: (x: string[], y?: string[]) => (y ? [...x, ...y] : x),
  },
  plugins: {
    value: (x: string[], y?: string[]) => y ?? x,
  },
  endpoint: {
    value: (x: string, y?: string) => y ?? x,
  },
  deterministic: {
    value: (x: boolean, y?: boolean) => (typeof y === "boolean" ? y : x),
  },
};

const DEFAULT_BUDGETS: SandboxBudgets = {
  timeMs: 20000,
  memMb: 256,
};

export async function runSelfHealingGraph(
  input: GraphInput,
  options?: GraphExecutionOptions,
): Promise<GraphOutput> {
  const diagnosticsRunner = options?.diagnosticsRunner ?? defaultDiagnosticsRunner;
  const builder = new StateGraph<GraphState>({ channels });

  builder.addNode("build-context", buildContextNode);
  builder.addNode("run-plugins", (state) => pluginRunnerNode(state, diagnosticsRunner));

  builder.addEdge(START, "build-context");
  builder.addEdge("build-context", "run-plugins");
  builder.addEdge("run-plugins", END);

  const compiled = builder.compile({ checkpointer: new MemorySaver() });

  const result = await compiled.invoke(
    {
      findings: [],
      logs: [],
      plugins: input.plugins,
      endpoint: input.endpoint,
      deterministic: input.deterministic,
    },
    {
      configurable: {
        thread_id: `self-healing-${Date.now()}`,
      },
    },
  );

  if (!result.context) {
    throw new Error("Self-healing graph failed to produce execution context");
  }

  return {
    context: result.context,
    findings: result.findings,
    logs: result.logs,
  };
}

async function buildContextNode(state: GraphState): Promise<Partial<GraphState>> {
  const context: DevelopmentContext = {
    endpoint: state.endpoint,
    logger: (...args: unknown[]) => {
      state.logs.push(["[self-healing]", ...args].join(" "));
    },
    request: async () => ({}),
    jsonrpc: async () => ({}),
    sseProbe: async () => ({ ok: true }),
    evidence: () => undefined,
    deterministic: state.deterministic,
    sessionId: `self-healing-${Date.now()}`,
    userExpertiseLevel: "expert",
    conversationHistory: [],
  };

  return { context };
}

async function pluginRunnerNode(
  state: GraphState,
  diagnosticsRunner: DiagnosticsRunner,
): Promise<Partial<GraphState>> {
  const rawFindings = await diagnosticsRunner({
    endpoint: state.endpoint,
    plugins: state.plugins,
    deterministic: state.deterministic,
  });
  const normalized = normalizeFindings(rawFindings);
  const logLine = `Diagnostics run complete: ${normalized.length} findings`;
  return { findings: normalized, logs: [logLine] };
}

async function defaultDiagnosticsRunner(input: DiagnosticsRunnerInput): Promise<Finding[]> {
  const { findings } = await runPlugins({
    endpoint: input.endpoint,
    headers: undefined,
    suites: input.plugins,
    full: input.plugins.length === 0,
    deterministic: input.deterministic,
    budgets: DEFAULT_BUDGETS,
  });
  return findings;
}
