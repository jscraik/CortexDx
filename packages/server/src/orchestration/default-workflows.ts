import type {
  AgentOrchestrator,
  WorkflowDefinition,
  WorkflowState,
} from "./agent-orchestrator.js";
import type {
  PluginOrchestrator,
  PluginWorkflow,
} from "./plugin-orchestrator.js";

const DEFAULT_PLUGIN_WORKFLOWS: PluginWorkflow[] = [
  {
    id: "workflow.baseline",
    name: "Baseline MCP Regression",
    description:
      "Runs discovery → protocol → streaming checks with governance gating.",
    stages: [
      { id: "discovery", pluginId: "discovery", order: 1, parallel: false },
      { id: "protocol", pluginId: "protocol", order: 2, parallel: false },
      { id: "streaming", pluginId: "streaming", order: 3, parallel: false },
      { id: "governance", pluginId: "governance", order: 4, parallel: false },
    ],
    dependencies: [
      {
        fromStage: "discovery",
        toStage: "protocol",
        dataFlow: ["artifacts"],
        required: true,
      },
      {
        fromStage: "protocol",
        toStage: "streaming",
        dataFlow: ["findings"],
        required: true,
      },
      {
        fromStage: "streaming",
        toStage: "governance",
        dataFlow: ["findings"],
        required: false,
      },
    ],
    timeout: 300_000,
  },
  {
    id: "workflow.security-sprint",
    name: "Security Sprint",
    description:
      "Parallel auth, rate limit, threat-model, and dependency scanning.",
    stages: [
      { id: "auth", pluginId: "auth", order: 1, parallel: false },
      { id: "ratelimit", pluginId: "ratelimit", order: 2, parallel: true },
      {
        id: "permissioning",
        pluginId: "permissioning",
        order: 2,
        parallel: true,
      },
      { id: "threat", pluginId: "threat-model", order: 3, parallel: false },
      {
        id: "dependencies",
        pluginId: "dependency-scanner",
        order: 4,
        parallel: false,
      },
    ],
    dependencies: [
      {
        fromStage: "auth",
        toStage: "ratelimit",
        dataFlow: ["headers"],
        required: true,
      },
      {
        fromStage: "auth",
        toStage: "permissioning",
        dataFlow: ["tokens"],
        required: true,
      },
      {
        fromStage: "ratelimit",
        toStage: "threat",
        dataFlow: ["findings"],
        required: false,
      },
      {
        fromStage: "permissioning",
        toStage: "threat",
        dataFlow: ["findings"],
        required: false,
      },
      {
        fromStage: "threat",
        toStage: "dependencies",
        dataFlow: ["findings"],
        required: false,
      },
    ],
    timeout: 420_000,
  },
];

const DEFAULT_AGENT_WORKFLOWS: WorkflowDefinition[] = [
  {
    config: {
      workflowId: "agent.langgraph.baseline",
      name: "LangGraph Baseline Diagnostic",
      description:
        "LangGraph workflow executing discovery, protocol, and summary nodes with checkpointing.",
      timeout: 600_000,
      enableCheckpointing: true,
    },
    entryPoint: "context-init",
    nodes: [
      {
        id: "context-init",
        name: "Context Builder",
        type: "aggregation",
        handler: async (state) => ({
          executionPath: [...state.executionPath, "context-init"],
          visitedNodes: [...state.visitedNodes, "context-init"],
        }),
      },
      {
        id: "discovery",
        name: "Discovery Probe",
        type: "plugin",
        pluginId: "discovery",
      },
      {
        id: "protocol",
        name: "Protocol Compliance",
        type: "plugin",
        pluginId: "protocol",
      },
      {
        id: "streaming",
        name: "Streaming Health",
        type: "plugin",
        pluginId: "streaming",
      },
      {
        id: "severity-gate",
        name: "Severity Gate",
        type: "decision",
        handler: summarizeSeverity,
      },
      {
        id: "report",
        name: "Report Synthesizer",
        type: "aggregation",
        handler: annotateSummary,
      },
    ],
    edges: [
      { from: "context-init", to: "discovery" },
      { from: "discovery", to: "protocol" },
      { from: "protocol", to: "streaming" },
      { from: "streaming", to: "severity-gate" },
      { from: "severity-gate", to: "report" },
    ],
  },
  {
    config: {
      workflowId: "agent.langgraph.security",
      name: "LangGraph Security Sweep",
      description:
        "Auth → permissioning → threat-model with conditional dependency scanner.",
      timeout: 900_000,
      enableCheckpointing: true,
    },
    entryPoint: "auth",
    nodes: [
      {
        id: "auth",
        name: "Authentication Audit",
        type: "plugin",
        pluginId: "auth",
      },
      {
        id: "permissioning",
        name: "Permissioning Review",
        type: "plugin",
        pluginId: "permissioning",
      },
      {
        id: "ratelimit",
        name: "Rate Limit Probe",
        type: "plugin",
        pluginId: "ratelimit",
      },
      {
        id: "threat",
        name: "Threat Model",
        type: "plugin",
        pluginId: "threat-model",
      },
      {
        id: "decision-security",
        name: "Security Branch",
        type: "decision",
        handler: summarizeSeverity,
      },
      {
        id: "dependencies",
        name: "Dependency Scanner",
        type: "plugin",
        pluginId: "dependency-scanner",
      },
      {
        id: "security-report",
        name: "Security Summary",
        type: "aggregation",
        handler: annotateSummary,
      },
    ],
    edges: [
      { from: "auth", to: "permissioning" },
      { from: "permissioning", to: "ratelimit" },
      { from: "ratelimit", to: "threat" },
      { from: "threat", to: "decision-security" },
      {
        from: "decision-security",
        to: "dependencies",
        condition: (state) => state.hasMajor || state.hasBlockers,
      },
      { from: "decision-security", to: "security-report" },
      { from: "dependencies", to: "security-report" },
    ],
  },
];

let pluginWorkflowsSeeded = false;
let agentWorkflowsSeeded = false;

export function ensureDefaultPluginWorkflows(
  orchestrator: PluginOrchestrator,
): void {
  if (pluginWorkflowsSeeded) {
    return;
  }
  for (const workflow of DEFAULT_PLUGIN_WORKFLOWS) {
    if (orchestrator.getWorkflow(workflow.id)) {
      continue;
    }
    if (!hasRequiredPlugins(orchestrator, workflow)) {
      continue;
    }
    orchestrator.createWorkflow(workflow);
  }
  pluginWorkflowsSeeded = true;
}

export function ensureDefaultAgentWorkflows(agent: AgentOrchestrator): void {
  if (agentWorkflowsSeeded) {
    return;
  }
  for (const definition of DEFAULT_AGENT_WORKFLOWS) {
    if (agent.getWorkflow(definition.config.workflowId)) {
      continue;
    }
    agent.createWorkflow(definition);
  }
  agentWorkflowsSeeded = true;
}

function summarizeSeverity(
  state: WorkflowState,
): Promise<Partial<WorkflowState>> {
  const counts = state.findings.reduce(
    (acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  return Promise.resolve({
    hasBlockers: (counts.blocker ?? 0) > 0,
    hasMajor: (counts.major ?? 0) > 0,
    findingCount: state.findings.length,
    severity:
      (counts.blocker ?? 0) > 0
        ? "blocker"
        : (counts.major ?? 0) > 0
          ? "major"
          : (counts.minor ?? 0) > 0
            ? "minor"
            : "info",
  });
}

function annotateSummary(
  state: WorkflowState,
): Promise<Partial<WorkflowState>> {
  const summary = `Findings: ${state.findings.length}; blockers=${state.findings.filter((f) => f.severity === "blocker").length}; majors=${state.findings.filter((f) => f.severity === "major").length}`;
  state.context.logger?.("[orchestrator]", summary);
  return Promise.resolve({
    executionPath: [...state.executionPath, summary],
  });
}

function hasRequiredPlugins(
  orchestrator: PluginOrchestrator,
  workflow: PluginWorkflow,
): boolean {
  const missing = workflow.stages
    .filter((stage) => !orchestrator.getPluginSchema(stage.pluginId))
    .map((stage) => stage.pluginId);

  if (missing.length > 0) {
    console.warn(
      `[orchestrator] Skipping default workflow ${workflow.id} because plugins are missing: ${missing.join(", ")}`,
    );
    return false;
  }
  return true;
}
