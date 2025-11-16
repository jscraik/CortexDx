/**
 * Agent Orchestrator using LangGraph v1.0
 * Manages complex diagnostic workflows as directed graphs with persistent memory
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5
 */

import { END, MemorySaver, START, StateGraph, type StateGraphArgs } from "@langchain/langgraph";
import type { DiagnosticContext, Finding } from "../types.js";
import type { PluginOrchestrator } from "./plugin-orchestrator.js";
import type { StateManager } from "./state-manager.js";
import { toRecord, fromRecord, hasProperty } from "../utils/type-helpers.js";

/**
 * Workflow state that flows through the graph
 */
export interface WorkflowState {
    // Core diagnostic data
    endpoint: string;
    findings: Finding[];
    errors: string[];

    // Execution metadata
    currentNode: string;
    visitedNodes: string[];
    executionPath: string[];

    // Decision data for conditional branching
    severity: "info" | "minor" | "major" | "blocker" | null;
    findingCount: number;
    hasBlockers: boolean;
    hasMajor: boolean;

    // Human-in-the-loop
    awaitingUserInput: boolean;
    userPrompt?: string;
    userResponse?: string;

    // Context and configuration
    context: DiagnosticContext;
    config: WorkflowConfig;

    // Performance tracking
    startTime: number;
    nodeTimings: Record<string, number>;
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
    workflowId: string;
    name: string;
    description: string;
    timeout?: number;
    enableCheckpointing: boolean;
    checkpointPath?: string;
}

/**
 * Node definition for the workflow graph
 */
export interface WorkflowNode {
    id: string;
    name: string;
    type: "plugin" | "decision" | "aggregation" | "human_input";
    pluginId?: string;
    handler?: (state: WorkflowState) => Promise<Partial<WorkflowState>>;
}

/**
 * Edge definition with conditional logic
 */
export interface WorkflowEdge {
    from: string;
    to: string;
    condition?: (state: WorkflowState) => boolean;
    label?: string;
}

/**
 * Compiled workflow ready for execution
 */
export interface CompiledWorkflow {
    id: string;
    graph: StateGraph<WorkflowState>;
    checkpointer?: MemorySaver;
    config: WorkflowConfig;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
    workflowId: string;
    state: WorkflowState;
    success: boolean;
    executionTime: number;
    checkpointId?: string;
    visualization?: string;
}

/**
 * Workflow definition for creating graphs
 */
export interface WorkflowDefinition {
    config: WorkflowConfig;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    entryPoint: string;
}

/**
 * Agent Orchestrator class using LangGraph v1.0
 */
export class AgentOrchestrator {
    private workflows: Map<string, CompiledWorkflow> = new Map();
    private checkpointers: Map<string, MemorySaver> = new Map();
    private pluginOrchestrator?: PluginOrchestrator;
    private stateManager?: StateManager;

    constructor(pluginOrchestrator?: PluginOrchestrator, stateManager?: StateManager) {
        this.pluginOrchestrator = pluginOrchestrator;
        this.stateManager = stateManager;
    }

    /**
     * Create a workflow from definition
     * Requirements: 18.1
     */
    createWorkflow(definition: WorkflowDefinition): CompiledWorkflow {
        // Create state graph with proper typing
        const graphBuilder = new StateGraph<WorkflowState>({
            channels: {
                endpoint: { value: (x: string, y?: string) => y ?? x },
                findings: { value: (x: Finding[], y?: Finding[]) => y ?? x },
                errors: { value: (x: string[], y?: string[]) => y ?? x },
                currentNode: { value: (x: string, y?: string) => y ?? x },
                visitedNodes: { value: (x: string[], y?: string[]) => [...x, ...(y ?? [])] },
                executionPath: { value: (x: string[], y?: string[]) => [...x, ...(y ?? [])] },
                severity: { value: (x: string | null, y?: string | null) => y ?? x },
                findingCount: { value: (x: number, y?: number) => y ?? x },
                hasBlockers: { value: (x: boolean, y?: boolean) => y ?? x },
                hasMajor: { value: (x: boolean, y?: boolean) => y ?? x },
                awaitingUserInput: { value: (x: boolean, y?: boolean) => y ?? x },
                userPrompt: { value: (x: string | undefined, y?: string) => y ?? x },
                userResponse: { value: (x: string | undefined, y?: string) => y ?? x },
                context: { value: (x: DiagnosticContext, y?: DiagnosticContext) => y ?? x },
                config: { value: (x: WorkflowConfig, y?: WorkflowConfig) => y ?? x },
                startTime: { value: (x: number, y?: number) => y ?? x },
                nodeTimings: { value: (x: Record<string, number>, y?: Record<string, number>) => ({ ...x, ...y }) },
            }
        } as StateGraphArgs<WorkflowState>);

        // Add nodes to the graph
        for (const node of definition.nodes) {
            const nodeHandler = this.createNodeHandler(node);
            graphBuilder.addNode(node.id, nodeHandler);
        }

        // Add edges to the graph
        for (const edge of definition.edges) {
            if (edge.condition) {
                // Conditional edge
                const condition = edge.condition;
                graphBuilder.addConditionalEdges(
                    edge.from as "__start__",
                    (state: WorkflowState) => (condition(state) ? edge.to : END),
                );
            } else {
                // Regular edge
                graphBuilder.addEdge(edge.from as "__start__", edge.to as "__end__");
            }
        }

        // Set entry point
        graphBuilder.addEdge(START, definition.entryPoint as "__end__");

        // Create checkpointer if enabled
        let checkpointer: MemorySaver | undefined;
        if (definition.config.enableCheckpointing) {
            checkpointer = this.stateManager
                ? this.stateManager.getMemorySaver(definition.config.workflowId)
                : new MemorySaver();
            this.checkpointers.set(definition.config.workflowId, checkpointer);
        }

        // Compile the graph
        const compiledWorkflow: CompiledWorkflow = {
            id: definition.config.workflowId,
            graph: graphBuilder,
            checkpointer,
            config: definition.config,
        };

        this.workflows.set(definition.config.workflowId, compiledWorkflow);
        return compiledWorkflow;
    }

    /**
     * Compile a workflow for execution
     * Requirements: 18.1
     */
    compileWorkflow(workflowId: string): CompiledWorkflow | null {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            return null;
        }

        // Workflow is already compiled during creation
        return workflow;
    }

    /**
     * Execute a workflow with streaming support
     * Requirements: 18.1
     */
    async executeWorkflow(
        workflowId: string,
        initialState: Partial<WorkflowState>,
        options?: {
            threadId?: string;
            streamEvents?: boolean;
            onEvent?: (event: WorkflowEvent) => void;
            checkpointId?: string;
        }
    ): Promise<WorkflowExecutionResult> {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }

        const startTime = Date.now();
        if (!initialState.context) {
            throw new Error("Workflow execution requires an initial diagnostic context");
        }
        const initialContext = initialState.context;

        // Prepare initial state
        const state: WorkflowState = {
            endpoint: initialState.endpoint || "",
            findings: initialState.findings || [],
            errors: [],
            currentNode: "",
            visitedNodes: [],
            executionPath: [],
            severity: null,
            findingCount: 0,
            hasBlockers: false,
            hasMajor: false,
            awaitingUserInput: false,
            context: initialContext,
            config: workflow.config,
            startTime,
            nodeTimings: {},
            ...initialState,
        };

        // Compile the graph
        const app = workflow.checkpointer
            ? workflow.graph.compile({ checkpointer: workflow.checkpointer })
            : workflow.graph.compile();

        // Execute with streaming if requested
        let finalState: WorkflowState = state;
        const threadId = options?.threadId || `thread-${Date.now()}`;
        const checkpointId = options?.checkpointId ?? threadId;
        let sessionId: string | undefined;

        if (this.stateManager) {
            sessionId = await this.stateManager.createSession(workflowId, threadId, {
                deterministic: initialContext.deterministic,
            });
        }

        if (options?.streamEvents) {
            // Stream execution events
            const stream = await app.stream(toRecord(state), {
                configurable: { thread_id: threadId },
            });

            for await (const event of stream) {
                // Extract state from event
                const nodeId = Object.keys(event)[0];
                if (nodeId && hasProperty(event, nodeId)) {
                    const nodeStateRaw = event[nodeId];
                    // Validate it's an object before treating as state
                    if (typeof nodeStateRaw === "object" && nodeStateRaw !== null) {
                        const nodeState = nodeStateRaw as Partial<WorkflowState>;
                        finalState = { ...finalState, ...nodeState };
                    }

                    // Emit event if handler provided
                    if (options.onEvent) {
                        options.onEvent({
                            type: "node_execution",
                            nodeId,
                            state: finalState,
                            timestamp: Date.now(),
                        });
                    }
                }
            }
        } else {
            // Regular execution
            const result = await app.invoke(toRecord(state), {
                configurable: { thread_id: threadId },
            });
            finalState = fromRecord<WorkflowState>(result, ['endpoint', 'findings', 'errors']);
        }

        const executionTime = Date.now() - startTime;

        if (this.stateManager) {
            const serializableState = createSerializableState(finalState);
            await this.stateManager.saveCheckpoint({
                checkpointId,
                workflowId,
                threadId,
                state: serializableState,
                timestamp: Date.now(),
                metadata: {
                    executionTime,
                    findings: finalState.findings.length,
                    severity: finalState.severity,
                },
            });
            if (sessionId) {
                await this.stateManager.updateSessionStatus(
                    sessionId,
                    finalState.errors.length === 0 ? "completed" : "failed",
                );
            }
        }

        return {
            workflowId,
            state: finalState,
            success: finalState.errors.length === 0,
            executionTime,
            checkpointId,
        };
    }

    /**
     * Get workflow by ID
     */
    getWorkflow(workflowId: string): CompiledWorkflow | undefined {
        return this.workflows.get(workflowId);
    }

    /**
     * List all workflows
     */
    listWorkflows(): CompiledWorkflow[] {
        return Array.from(this.workflows.values());
    }

    /**
     * Delete a workflow
     */
    deleteWorkflow(workflowId: string): boolean {
        this.checkpointers.delete(workflowId);
        return this.workflows.delete(workflowId);
    }

    /**
     * Get checkpointer for a workflow
     */
    getCheckpointer(workflowId: string): MemorySaver | undefined {
        return this.checkpointers.get(workflowId);
    }

    // Private helper methods

    /**
     * Create a node handler function
     */
    private createNodeHandler(
        node: WorkflowNode
    ): (state: WorkflowState) => Promise<Partial<WorkflowState>> {
        return async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
            const nodeStartTime = Date.now();

            try {
                // Update current node
                const updates: Partial<WorkflowState> = {
                    currentNode: node.id,
                    visitedNodes: [...state.visitedNodes, node.id],
                    executionPath: [...state.executionPath, node.name],
                };

                // Execute based on node type
                switch (node.type) {
                    case "plugin": {
                        if (node.pluginId && this.pluginOrchestrator) {
                            const findings = await this.pluginOrchestrator.executePlugin(
                                node.pluginId,
                                state.context
                            );
                            updates.findings = [...state.findings, ...findings];
                            updates.findingCount = updates.findings.length;
                            updates.hasBlockers = updates.findings.some(
                                (f) => f.severity === "blocker"
                            );
                            updates.hasMajor = updates.findings.some(
                                (f) => f.severity === "major"
                            );
                        }
                        break;
                    }

                    case "decision": {
                        // Decision nodes update state based on findings
                        if (state.findings.length > 0) {
                            const severities = state.findings.map((f) => f.severity);
                            if (severities.includes("blocker")) {
                                updates.severity = "blocker";
                            } else if (severities.includes("major")) {
                                updates.severity = "major";
                            } else if (severities.includes("minor")) {
                                updates.severity = "minor";
                            } else {
                                updates.severity = "info";
                            }
                        }
                        break;
                    }

                    case "aggregation": {
                        // Aggregation nodes combine results
                        // Already handled by state updates
                        break;
                    }

                    case "human_input": {
                        // Human-in-the-loop nodes
                        updates.awaitingUserInput = true;
                        updates.userPrompt = node.name;
                        break;
                    }
                }

                // Execute custom handler if provided
                if (node.handler) {
                    const handlerUpdates = await node.handler(state);
                    Object.assign(updates, handlerUpdates);
                }

                // Record timing
                const nodeEndTime = Date.now();
                updates.nodeTimings = {
                    ...state.nodeTimings,
                    [node.id]: nodeEndTime - nodeStartTime,
                };

                return updates;
            } catch (error) {
                return {
                    errors: [
                        ...state.errors,
                        `Node ${node.id} failed: ${error instanceof Error ? error.message : String(error)}`,
                    ],
                };
            }
        };
    }
}

/**
 * Workflow event for streaming
 */
export interface WorkflowEvent {
    type: "node_execution" | "edge_traversal" | "checkpoint" | "error";
    nodeId?: string;
    state?: WorkflowState;
    timestamp: number;
    error?: string;
}

function createSerializableState(state: WorkflowState): WorkflowState {
    return {
        ...state,
        context: createSerializableContext(state.context),
    };
}

function createSerializableContext(context: DiagnosticContext): DiagnosticContext {
    const noopRequest: DiagnosticContext["request"] = async <T>(): Promise<T> => {
        throw new Error("Checkpoint context is read-only");
    };
    const noopJsonrpc: DiagnosticContext["jsonrpc"] = async <T>(): Promise<T> => {
        throw new Error("Checkpoint context is unavailable");
    };
    const noopSse: DiagnosticContext["sseProbe"] = async () => ({ ok: false });
    const noopEvidence: DiagnosticContext["evidence"] = () => undefined;
    const noopLogger: DiagnosticContext["logger"] = () => undefined;

    return {
        endpoint: context.endpoint,
        headers: context.headers,
        logger: noopLogger,
        request: noopRequest,
        jsonrpc: noopJsonrpc,
        sseProbe: noopSse,
        evidence: noopEvidence,
        deterministic: context.deterministic,
        deterministicSeed: context.deterministicSeed,
    };
}

/**
 * Create a singleton instance of the agent orchestrator
 */
let agentOrchestratorInstance: AgentOrchestrator | null = null;

export function getAgentOrchestrator(
    pluginOrchestrator?: PluginOrchestrator,
    stateManager?: StateManager
): AgentOrchestrator {
    if (!agentOrchestratorInstance) {
        agentOrchestratorInstance = new AgentOrchestrator(pluginOrchestrator, stateManager);
    }
    return agentOrchestratorInstance;
}
