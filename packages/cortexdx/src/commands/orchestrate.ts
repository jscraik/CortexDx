import { resolveAuthHeaders } from "../auth/auth0-handshake.js";
import { createDiagnosticContext } from "../context/context-factory.js";
import { createDevelopmentContext } from "../context/development-context.js";
import { createCliLogger } from "../logging/logger.js";
import { getEnhancedLlmAdapter } from "../ml/router.js";
import type { WorkflowState } from "../orchestration/agent-orchestrator.js";
import { getAgentOrchestrator } from "../orchestration/agent-orchestrator.js";
import {
  ensureDefaultAgentWorkflows,
  ensureDefaultPluginWorkflows,
} from "../orchestration/default-workflows.js";
import {
  type ExecutionMode,
  normalizeExecutionMode,
  normalizeExpertiseLevel,
} from "../orchestration/orchestrate-options.js";
import { getPluginOrchestrator } from "../orchestration/plugin-orchestrator.js";
import { getOrchestrationStateManager } from "../orchestration/state-manager-factory.js";
import type { StateManager } from "../orchestration/state-manager.js";
import {
  createInitialWorkflowState,
  recoverWorkflowCheckpoint,
} from "../orchestration/workflow-runtime.js";
import { storeConsolidatedReport } from "../report/consolidated-report.js";
import { type AcademicResearchReport, runAcademicResearch, selectConfiguredProviders } from "../research/academic-researcher.js";
import type {
  DevelopmentContext,
  DiagnosticContext,
  Finding,
} from "../types.js";
import { createDeterministicSeed } from "../utils/deterministic.js";

const logger = createCliLogger("orchestrate");

type ListEnv = {
  kind: "list";
  pluginOrchestrator: ReturnType<typeof getPluginOrchestrator>;
  agentOrchestrator: ReturnType<typeof getAgentOrchestrator>;
};
type ExecuteEnv = {
  kind: "execute";
  pluginOrchestrator: ReturnType<typeof getPluginOrchestrator>;
  agentOrchestrator: ReturnType<typeof getAgentOrchestrator>;
  stateManager: StateManager;
  context: DiagnosticContext | DevelopmentContext;
  endpoint: string;
};
type OrchestrationEnv = ListEnv | ExecuteEnv;

interface OrchestrateOptions {
  workflow?: string;
  plugin?: string;
  parallel?: string;
  list?: boolean;
  json?: boolean;
  deterministic?: boolean;
  auth?: string;
  auth0Domain?: string;
  auth0ClientId?: string;
  auth0ClientSecret?: string;
  auth0Audience?: string;
  auth0Scope?: string;
  auth0DeviceCode?: boolean;
  auth0DeviceCodeEndpoint?: string;
  mcpApiKey?: string;
  stateDb?: string;
  threadId?: string;
  checkpointId?: string;
  resumeCheckpoint?: string;
  resumeThread?: string;
  mode?: ExecutionMode;
  expertise?: DevelopmentContext["userExpertiseLevel"];
  stream?: boolean;
  research?: boolean;
  researchTopic?: string;
  researchQuestion?: string;
  researchProviders?: string;
  researchLimit?: string;
  researchOut?: string;
  reportOut?: string;
  disableSse?: boolean;
  sseEndpoint?: string;
}

export async function runOrchestrate(
  endpoint: string | null,
  opts: OrchestrateOptions,
): Promise<number> {
  const restoreEnv = applySseEnvOverrides(opts);
  try {
    const env = await bootstrapEnvironment(endpoint, opts);
    const sessionId =
      opts.threadId ?? `orchestrate-${Date.now().toString(36)}`;
    if (env.kind === "list") {
      listAvailableWorkflows(
        env.pluginOrchestrator,
        env.agentOrchestrator,
        opts.json,
      );
      return 0;
    }
    const researchReport = await maybeRunAcademicResearchProbe(
      env.endpoint,
      opts,
    );
    if (opts.plugin) {
      const startedAt = Date.now();
      const result = await runPluginExecution(
        env.context,
        env.pluginOrchestrator,
        opts.plugin,
        opts.json,
      );
      await storeConsolidatedReport(opts.reportOut, {
        sessionId,
        diagnosticType: "orchestrate-plugin",
        endpoint: env.endpoint,
        inspectedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        findings: result.findings,
        tags: ["plugin", opts.plugin],
        metadata: {
          pluginId: opts.plugin,
          mode: opts.mode,
          research: summarizeResearch(researchReport),
        },
      });
      return result.code;
    }
    if (opts.parallel) {
      const startedAt = Date.now();
      const result = await runParallelExecution(
        env.context,
        env.pluginOrchestrator,
        opts.parallel,
        opts.json,
      );
      await storeConsolidatedReport(opts.reportOut, {
        sessionId,
        diagnosticType: "orchestrate-parallel",
        endpoint: env.endpoint,
        inspectedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        findings: result.findings,
        tags: ["parallel"],
        metadata: {
          parallelSpec: opts.parallel,
          mode: opts.mode,
          research: summarizeResearch(researchReport),
        },
      });
      return result.code;
    }
    if (opts.workflow) {
      const startedAt = Date.now();
      const result = await runWorkflowExecution(env, opts);
      await storeConsolidatedReport(opts.reportOut, {
        sessionId,
        diagnosticType: "orchestrate-workflow",
        endpoint: env.endpoint,
        inspectedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        findings: result.findings,
        tags: ["workflow", opts.workflow],
        metadata: {
          workflowId: opts.workflow,
          mode: opts.mode,
          research: summarizeResearch(researchReport),
        },
      });
      return result.code;
    }
    throw new Error(
      "Specify --workflow, --plugin, or --parallel to execute orchestration",
    );
  } finally {
    restoreEnv();
  }
}

async function runAgentWorkflow({
  agentOrchestrator,
  workflowId,
  context,
  stateManager,
  stateOptions,
  outputJson,
}: {
  agentOrchestrator: ReturnType<typeof getAgentOrchestrator>;
  workflowId: string;
  context: DiagnosticContext | DevelopmentContext;
  stateManager: StateManager;
  stateOptions: {
    resumeCheckpoint?: string;
    resumeThread?: string;
    checkpointId?: string;
    threadId?: string;
    streamEvents: boolean;
  };
  outputJson?: boolean;
}): Promise<{ findings: Finding[]; code: number }> {
  let initialState: Partial<WorkflowState> =
    createInitialWorkflowState(context);

  if (stateOptions.resumeCheckpoint || stateOptions.resumeThread) {
    const resume = await recoverWorkflowCheckpoint(
      stateManager,
      workflowId,
      stateOptions,
    );
    if (!resume) {
      throw new Error("No checkpoint found for the provided resume options");
    }
    initialState = { ...resume.state, context };
  }

  const threadId =
    stateOptions.threadId ??
    stateOptions.resumeThread ??
    `thread-${Date.now()}`;
  const result = await agentOrchestrator.executeWorkflow(
    workflowId,
    initialState,
    {
      threadId,
      checkpointId: stateOptions.checkpointId,
      streamEvents: stateOptions.streamEvents,
    },
  );

  const findings = result.state.findings;
  printFindings(findings, outputJson);
  return { findings, code: computeExitCode(findings) };
}

async function bootstrapEnvironment(
  endpoint: string | null,
  opts: OrchestrateOptions,
): Promise<OrchestrationEnv> {
  const pluginOrchestrator = getPluginOrchestrator();
  ensureDefaultPluginWorkflows(pluginOrchestrator);

  const stateManager = getOrchestrationStateManager(opts.stateDb);
  const agentOrchestrator = getAgentOrchestrator(
    pluginOrchestrator,
    stateManager,
  );
  ensureDefaultAgentWorkflows(agentOrchestrator);

  if (opts.list) {
    return { kind: "list", pluginOrchestrator, agentOrchestrator };
  }
  if (!endpoint) {
    throw new Error("Endpoint is required unless --list is specified");
  }
  const context = await buildExecutionContext(endpoint, opts);
  return {
    kind: "execute",
    pluginOrchestrator,
    agentOrchestrator,
    stateManager,
    context,
    endpoint,
  };
}

async function buildExecutionContext(
  endpoint: string,
  opts: OrchestrateOptions,
): Promise<DiagnosticContext | DevelopmentContext> {
  const headers = await resolveAuthHeaders({
    auth: opts.auth,
    auth0Domain: opts.auth0Domain,
    auth0ClientId: opts.auth0ClientId,
    auth0ClientSecret: opts.auth0ClientSecret,
    auth0Audience: opts.auth0Audience,
    auth0Scope: opts.auth0Scope,
    auth0DeviceCode: opts.auth0DeviceCode,
    auth0DeviceCodeEndpoint: opts.auth0DeviceCodeEndpoint,
    mcpApiKey: opts.mcpApiKey,
    onDeviceCodePrompt: logDeviceCodePrompt,
  });
  const deterministic = Boolean(opts.deterministic);
  const deterministicSeed = deterministic
    ? createDeterministicSeed(
      `${endpoint}:${opts.workflow ?? opts.plugin ?? opts.parallel ?? ""}`,
    )
    : undefined;
  const enhancedLlm = await getEnhancedLlmAdapter({ deterministicSeed });
  const diagnosticCtx = createDiagnosticContext({
    endpoint,
    headers: headers ?? {},
    deterministic,
    deterministicSeed,
    llm: enhancedLlm,
  });
  if (normalizeExecutionMode(opts.mode) === "development") {
    return createDevelopmentContext({
      baseContext: diagnosticCtx,
      sessionId: opts.threadId ?? `orchestrate-${Date.now()}`,
      expertise: normalizeExpertiseLevel(opts.expertise),
      enhancedLlm: enhancedLlm ?? null,
      deterministic,
    });
  }
  return diagnosticCtx;
}

async function runPluginExecution(
  context: DiagnosticContext | DevelopmentContext,
  orchestrator: ReturnType<typeof getPluginOrchestrator>,
  pluginId: string,
  outputJson?: boolean,
): Promise<{ findings: Finding[]; code: number }> {
  const findings = await orchestrator.executePlugin(pluginId, context);
  printFindings(findings, outputJson);
  return { findings, code: computeExitCode(findings) };
}

async function runParallelExecution(
  context: DiagnosticContext | DevelopmentContext,
  orchestrator: ReturnType<typeof getPluginOrchestrator>,
  parallelSpec: string,
  outputJson?: boolean,
): Promise<{ findings: Finding[]; code: number }> {
  const pluginIds = parallelSpec
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const results = await orchestrator.executeParallel(pluginIds, context);
  const flattened = Array.from(results.results.values()).flat();
  printFindings(flattened, outputJson);
  const code =
    results.errors.size > 0 ? 1 : computeExitCode(flattened);
  return { findings: flattened, code };
}

async function runWorkflowExecution(
  env: ExecuteEnv,
  opts: OrchestrateOptions,
): Promise<{ findings: Finding[]; code: number }> {
  const workflowId = opts.workflow as string;
  const agentWorkflow = env.agentOrchestrator.getWorkflow(workflowId);
  if (agentWorkflow) {
    return await runAgentWorkflow({
      agentOrchestrator: env.agentOrchestrator,
      workflowId,
      context: env.context,
      stateManager: env.stateManager,
      stateOptions: {
        resumeCheckpoint: opts.resumeCheckpoint,
        resumeThread: opts.resumeThread,
        checkpointId: opts.checkpointId,
        threadId: opts.threadId,
        streamEvents: Boolean(opts.stream),
      },
      outputJson: opts.json,
    });
  }
  const workflow = env.pluginOrchestrator.getWorkflow(workflowId);
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }
  const results = await env.pluginOrchestrator.executeSequential(
    workflow,
    env.context,
  );
  const flattened = Array.from(results.stageResults.values()).flat();
  printFindings(flattened, opts.json);
  const severityCode = computeExitCode(flattened);
  const code = results.success ? severityCode : severityCode || 1;
  return { findings: flattened, code };
}

function listAvailableWorkflows(
  pluginOrchestrator: ReturnType<typeof getPluginOrchestrator>,
  agentOrchestrator: ReturnType<typeof getAgentOrchestrator>,
  asJson?: boolean,
): void {
  const pluginWorkflows = pluginOrchestrator.listWorkflows().map((wf) => ({
    id: wf.id,
    name: wf.name,
    stages: wf.stages.length,
    description: wf.description,
    type: "plugin" as const,
  }));
  const agentWorkflows = agentOrchestrator.listWorkflows().map((wf) => ({
    id: wf.id,
    name: wf.config.name,
    description: wf.config.description,
    type: "agent" as const,
  }));
  const combined = [...pluginWorkflows, ...agentWorkflows];

  if (asJson) {
    logger.info(JSON.stringify(combined, null, 2));
    return;
  }

  logger.info("Agent workflows:");
  for (const wf of agentWorkflows) {
    logger.info(`  • ${wf.id} — ${wf.name}`);
  }
  logger.info("Plugin workflows:");
  for (const wf of pluginWorkflows) {
    logger.info(`  • ${wf.id} — ${wf.name}`);
  }
}

async function maybeRunAcademicResearchProbe(
  endpoint: string,
  opts: OrchestrateOptions,
): Promise<AcademicResearchReport | null> {
  if (!shouldRunResearchProbe(opts)) {
    return null;
  }
  const topic =
    opts.researchTopic?.trim() || `Diagnostics for ${endpoint ?? "unknown"}`;
  const { ready, missing } = selectConfiguredProviders(
    parseCsvList(opts.researchProviders),
  );
  if (missing.length) {
    logger.warn(
      `Research: Skipping providers missing env vars: ${missing.map(({ id, vars }) => `${id}:${vars.join("/")}`).join(", ")}`,
      { missing }
    );
  }
  if (ready.length === 0) {
    logger.warn("Research: Academic probe disabled (no configured providers).");
    return null;
  }
  try {
    const report = await runAcademicResearch({
      topic,
      question: opts.researchQuestion,
      providers: ready,
      limit: parseNumber(opts.researchLimit),
      deterministic: Boolean(opts.deterministic),
      outputDir: opts.researchOut,
    });
    logger.info(
      `Research: ${report.summary.providersResponded}/${report.summary.providersRequested} providers responded for ${topic} (${report.summary.totalFindings} findings)`,
      { topic, providersResponded: report.summary.providersResponded, providersRequested: report.summary.providersRequested, totalFindings: report.summary.totalFindings }
    );
    for (const provider of report.providers) {
      logger.info(
        `  - ${provider.providerName}: ${provider.findings.length} findings`,
        { provider: provider.providerName, findings: provider.findings.length }
      );
    }
    if (report.artifacts?.dir) {
      logger.info(`Research: Artifacts written to ${report.artifacts.dir}`, { artifactsDir: report.artifacts.dir });
    }
    return report;
  } catch (error) {
    logger.warn(
      `Research: Unable to run academic research probe: ${error instanceof Error ? error.message : String(error)}`,
      { error }
    );
    return null;
  }
}

function shouldRunResearchProbe(opts: OrchestrateOptions): boolean {
  return opts.research !== false;
}

function parseCsvList(value?: string): string[] | undefined {
  if (!value) return undefined;
  const entries = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return entries.length > 0 ? entries : undefined;
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function computeExitCode(findings: Finding[]): number {
  if (findings.some((finding) => finding.severity === "blocker")) {
    return 1;
  }
  if (findings.some((finding) => finding.severity === "major")) {
    return 2;
  }
  return 0;
}

function printFindings(findings: Finding[], asJson?: boolean): void {
  if (asJson) {
    logger.info(JSON.stringify(findings, null, 2));
    return;
  }
  if (findings.length === 0) {
    logger.info("No findings returned.");
    return;
  }
  for (const finding of findings) {
    logger.info(
      `[${finding.severity.toUpperCase()}] ${finding.title} :: ${finding.description}`,
      { severity: finding.severity, title: finding.title }
    );
  }
  logger.info(`Total findings: ${findings.length}`, { count: findings.length });
}

function logDeviceCodePrompt(userCode: string, verificationUri: string): void {
  logger.info(
    `Auth0 Device Code: Visit ${verificationUri} and enter code ${userCode} to continue authentication.`,
    { userCode, verificationUri }
  );
}

function summarizeResearch(report: AcademicResearchReport | null):
  | {
    topic: string;
    providersResponded: number;
    totalFindings: number;
    artifactsDir?: string;
  }
  | undefined {
  if (!report) return undefined;
  return {
    topic: report.topic,
    providersResponded: report.summary.providersResponded,
    totalFindings: report.summary.totalFindings,
    artifactsDir: report.artifacts?.dir,
  };
}

function applySseEnvOverrides(opts: OrchestrateOptions): () => void {
  const originalDisable = process.env.CORTEXDX_DISABLE_SSE;
  const originalEndpoint = process.env.CORTEXDX_SSE_ENDPOINT;

  if (opts.disableSse) {
    process.env.CORTEXDX_DISABLE_SSE = "1";
  }
  if (opts.sseEndpoint) {
    process.env.CORTEXDX_SSE_ENDPOINT = opts.sseEndpoint;
  }

  return () => {
    if (originalDisable === undefined) {
      Reflect.deleteProperty(process.env, "CORTEXDX_DISABLE_SSE");
    } else {
      process.env.CORTEXDX_DISABLE_SSE = originalDisable;
    }
    if (originalEndpoint === undefined) {
      Reflect.deleteProperty(process.env, "CORTEXDX_SSE_ENDPOINT");
    } else {
      process.env.CORTEXDX_SSE_ENDPOINT = originalEndpoint;
    }
  };
}
