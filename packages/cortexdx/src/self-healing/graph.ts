import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { type SandboxBudgets, runPlugins } from "../plugin-host";
import type { DevelopmentContext, Finding } from "../types";
import type { NormalizedFinding } from "./findings";
import { normalizeFindings } from "./findings";

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

// Use Annotation-based approach which is the recommended way
const GraphState = Annotation.Root({
  context: Annotation<DevelopmentContext | undefined>(),
  findings: Annotation<NormalizedFinding[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  logs: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  plugins: Annotation<string[]>({
    reducer: (a, b) => b ?? a,
    default: () => [],
  }),
  endpoint: Annotation<string>({
    reducer: (a, b) => b ?? a,
    default: () => "",
  }),
  deterministic: Annotation<boolean>({
    reducer: (a, b) => (typeof b === "boolean" ? b : a),
    default: () => false,
  }),
});

const DEFAULT_BUDGETS: SandboxBudgets = {
  timeMs: 20000,
  memMb: 256,
};

export async function runSelfHealingGraph(
  input: GraphInput,
  options?: GraphExecutionOptions,
): Promise<GraphOutput> {
  const diagnosticsRunner =
    options?.diagnosticsRunner ?? defaultDiagnosticsRunner;

  // Create the graph using Annotation-based approach
  const builder = new StateGraph(GraphState);

  builder.addNode("build-context", buildContextNode);
  builder.addNode("run-plugins", pluginRunnerNodeWrapper(diagnosticsRunner));

  // Workaround for TypeScript inference issues with LangGraph
  // biome-ignore lint/suspicious/noExplicitAny: Required due to LangGraph typing issues
  (builder as any).addEdge(START, "build-context");
  // biome-ignore lint/suspicious/noExplicitAny: Required due to LangGraph typing issues
  (builder as any).addEdge("build-context", "run-plugins");
  // biome-ignore lint/suspicious/noExplicitAny: Required due to LangGraph typing issues
  (builder as any).addEdge("run-plugins", END);

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
      // Fix the configuration object structure
      configurable: {
        thread_id: `self-healing-${Date.now()}`,
      },
      // biome-ignore lint/suspicious/noExplicitAny: Required due to LangGraph typing issues
    } as any,
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

function pluginRunnerNodeWrapper(diagnosticsRunner: DiagnosticsRunner) {
  return (state: typeof GraphState.State) =>
    pluginRunnerNode(state, diagnosticsRunner);
}

async function buildContextNode(
  state: typeof GraphState.State,
): Promise<Partial<typeof GraphState.State>> {
  const context: DevelopmentContext = {
    endpoint: state.endpoint,
    logger: (..._args: unknown[]) => {
      // We need to return the updated logs array
    },
    request: async <T>() => Promise.resolve({} as T),
    jsonrpc: async <T>() => Promise.resolve({} as T),
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
  state: typeof GraphState.State,
  diagnosticsRunner: DiagnosticsRunner,
): Promise<Partial<typeof GraphState.State>> {
  const rawFindings = await diagnosticsRunner({
    endpoint: state.endpoint,
    plugins: state.plugins,
    deterministic: state.deterministic,
  });
  const normalized = normalizeFindings(rawFindings);
  const logLine = `Diagnostics run complete: ${normalized.length} findings`;
  return { findings: normalized, logs: [logLine] };
}

async function defaultDiagnosticsRunner(
  input: DiagnosticsRunnerInput,
): Promise<Finding[]> {
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
