import { createDevelopmentContext } from "../context/development-context.js";
import { getAgentOrchestrator } from "../orchestration/agent-orchestrator.js";
import { ensureDefaultAgentWorkflows, ensureDefaultPluginWorkflows } from "../orchestration/default-workflows.js";
import { normalizeExecutionMode, normalizeExpertiseLevel, type ExecutionMode } from "../orchestration/orchestrate-options.js";
import { getOrchestrationStateManager } from "../orchestration/state-manager-factory.js";
import { getPluginOrchestrator } from "../orchestration/plugin-orchestrator.js";
import { createInitialWorkflowState, recoverWorkflowCheckpoint } from "../orchestration/workflow-runtime.js";
import type { StateManager } from "../orchestration/state-manager.js";
import type { DevelopmentContext, DiagnosticContext, McpTool, McpToolResult } from "../types.js";
import { createDeterministicSeed } from "../utils/deterministic.js";

interface AgentWorkflowArgs {
    workflowId: string;
    endpoint: string;
    headers?: Record<string, string>;
    deterministic?: boolean;
    stateDb?: string;
    threadId?: string;
    checkpointId?: string;
    resumeCheckpoint?: string;
    resumeThread?: string;
    mode?: ExecutionMode;
    expertise?: DevelopmentContext["userExpertiseLevel"];
    stream?: boolean;
}

interface AgentHistoryArgs {
    workflowId: string;
    threadId?: string;
    limit?: number;
    stateDb?: string;
}

interface AgentServices {
    stateManager: StateManager;
    agentOrchestrator: ReturnType<typeof getAgentOrchestrator>;
}

export function createAgentOrchestrationTools(): McpTool[] {
    return [
        {
            name: "cortexdx_agent_list_workflows",
            description: "List available LangGraph agent workflows and checkpointing metadata",
            inputSchema: {
                type: "object",
                properties: {
                    stateDb: {
                        type: "string",
                        description: "Optional SQLite db path override for workflow state",
                    },
                },
            },
        },
        {
            name: "cortexdx_agent_execute_workflow",
            description: "Execute a LangGraph agent workflow with optional resume + streaming",
            inputSchema: {
                type: "object",
                properties: {
                    workflowId: { type: "string" },
                    endpoint: { type: "string" },
                    headers: {
                        type: "object",
                        description: "Additional HTTP headers",
                    },
                    deterministic: { type: "boolean" },
                    stateDb: { type: "string" },
                    threadId: { type: "string" },
                    checkpointId: { type: "string" },
                    resumeCheckpoint: { type: "string" },
                    resumeThread: { type: "string" },
                    mode: {
                        type: "string",
                        enum: ["diagnostic", "development"],
                    },
                    expertise: {
                        type: "string",
                        enum: ["beginner", "intermediate", "expert"],
                    },
                    stream: { type: "boolean" },
                },
                required: ["workflowId", "endpoint"],
            },
        },
        {
            name: "cortexdx_agent_checkpoint_history",
            description: "Inspect stored workflow sessions and node transitions",
            inputSchema: {
                type: "object",
                properties: {
                    workflowId: { type: "string" },
                    threadId: { type: "string" },
                    limit: { type: "number" },
                    stateDb: { type: "string" },
                },
                required: ["workflowId"],
            },
        },
    ];
}

export async function executeAgentOrchestrationTool(
    tool: McpTool,
    args: unknown,
    context: DiagnosticContext | DevelopmentContext,
): Promise<McpToolResult> {
    switch (tool.name) {
        case "cortexdx_agent_list_workflows":
            return listAgentWorkflows(args as { stateDb?: string });
        case "cortexdx_agent_execute_workflow":
            return await runAgentWorkflowFromTool(args as AgentWorkflowArgs, context);
        case "cortexdx_agent_checkpoint_history":
            return await getCheckpointHistory(args as AgentHistoryArgs);
        default:
            throw new Error(`Unknown agent orchestration tool: ${tool.name}`);
    }
}

async function listAgentWorkflows(params: { stateDb?: string }): Promise<McpToolResult> {
    const { agentOrchestrator } = getAgentServices(params.stateDb);
    const workflows = agentOrchestrator.listWorkflows().map((wf) => ({
        id: wf.id,
        name: wf.config.name,
        description: wf.config.description,
        checkpointing: wf.config.enableCheckpointing,
        timeoutMs: wf.config.timeout ?? null,
    }));
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({ workflows }, null, 2),
            },
        ],
    };
}

async function runAgentWorkflowFromTool(
    args: AgentWorkflowArgs,
    baseContext: DiagnosticContext | DevelopmentContext,
): Promise<McpToolResult> {
    const services = getAgentServices(args.stateDb);
    const threadId = args.threadId ?? args.resumeThread ?? `agent-thread-${Date.now()}`;
    const execContext = buildToolContext(baseContext, args, threadId);
    let initialState = createInitialWorkflowState(execContext);

    if (args.resumeCheckpoint || args.resumeThread) {
        const resume = await recoverWorkflowCheckpoint(services.stateManager, args.workflowId, {
            resumeCheckpoint: args.resumeCheckpoint,
            resumeThread: args.resumeThread,
        });
        if (!resume) {
            throw new Error("No checkpoint found for the provided resume options");
        }
        initialState = { ...resume.state, context: execContext };
    }

    const result = await services.agentOrchestrator.executeWorkflow(args.workflowId, initialState, {
        threadId,
        checkpointId: args.checkpointId,
        streamEvents: Boolean(args.stream),
    });

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(
                    {
                        workflowId: result.workflowId,
                        success: result.success,
                        findings: result.state.findings,
                        errors: result.state.errors,
                        checkpointId: result.checkpointId,
                        threadId,
                        executionTime: result.executionTime,
                        severity: result.state.severity,
                    },
                    null,
                    2,
                ),
            },
        ],
    };
}

async function getCheckpointHistory(args: AgentHistoryArgs): Promise<McpToolResult> {
    const { stateManager } = getAgentServices(args.stateDb);
    const sessions = await stateManager.listSessions(args.workflowId);
    const transitions = await stateManager.getTransitionHistory(args.workflowId, args.threadId);
    const limit = typeof args.limit === "number" && args.limit > 0 ? args.limit : undefined;

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(
                    {
                        workflowId: args.workflowId,
                        sessions: limit ? sessions.slice(0, limit) : sessions,
                        transitions: limit ? transitions.slice(-limit) : transitions,
                    },
                    null,
                    2,
                ),
            },
        ],
    };
}

function getAgentServices(stateDb?: string): AgentServices {
    const pluginOrchestrator = getPluginOrchestrator();
    ensureDefaultPluginWorkflows(pluginOrchestrator);
    const stateManager = getOrchestrationStateManager(stateDb);
    const agentOrchestrator = getAgentOrchestrator(pluginOrchestrator, stateManager);
    ensureDefaultAgentWorkflows(agentOrchestrator);
    return { stateManager, agentOrchestrator };
}

function buildToolContext(
    context: DiagnosticContext | DevelopmentContext,
    args: AgentWorkflowArgs,
    threadId: string,
): DiagnosticContext | DevelopmentContext {
    const mergedHeaders = {
        ...(context.headers ?? {}),
        ...(args.headers ?? {}),
    };
    const deterministic = args.deterministic ?? context.deterministic ?? false;
    const deterministicSeed = deterministic
        ? createDeterministicSeed(`${args.endpoint}:${args.workflowId}`)
        : context.deterministicSeed;

    const diagnosticContext: DiagnosticContext = {
        ...context,
        endpoint: args.endpoint,
        headers: mergedHeaders,
        deterministic,
        deterministicSeed,
    };

    const mode = normalizeExecutionMode(args.mode);
    if (mode === "diagnostic") {
        return diagnosticContext;
    }

    if (isDevelopmentContext(context)) {
        return {
            ...context,
            endpoint: args.endpoint,
            headers: mergedHeaders,
            deterministic,
            deterministicSeed,
        };
    }

    return createDevelopmentContext({
        baseContext: diagnosticContext,
        sessionId: threadId,
        expertise: normalizeExpertiseLevel(args.expertise),
        deterministic,
        enhancedLlm: null,
    });
}

function isDevelopmentContext(
    context: DiagnosticContext | DevelopmentContext,
): context is DevelopmentContext {
    return "sessionId" in context && "conversationHistory" in context;
}
