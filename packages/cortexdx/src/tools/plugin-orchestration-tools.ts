/**
 * Plugin Orchestration MCP Tools
 * Exposes diagnostic plugins as MCP tools for integration with other MCP clients
 * Requirements: 17.1, 17.5
 */

import { ensureDefaultPluginWorkflows } from "../orchestration/default-workflows.js";
import { type PluginWorkflow, type WorkflowStage, getPluginOrchestrator } from "../orchestration/plugin-orchestrator.js";
import type { DevelopmentContext, DiagnosticContext, Finding, McpTool, McpToolResult } from "../types.js";

/**
 * Create MCP tools for plugin orchestration
 */
export function createPluginOrchestrationTools(): McpTool[] {
    ensureDefaultPluginWorkflows(getPluginOrchestrator());
    return [
        // Execute single plugin
        {
            name: "cortexdx_execute_plugin",
            description: "Execute a single diagnostic or development plugin",
            inputSchema: {
                type: "object",
                properties: {
                    pluginId: {
                        type: "string",
                        description: "ID of the plugin to execute",
                    },
                    endpoint: {
                        type: "string",
                        description: "MCP server endpoint to diagnose",
                    },
                    context: {
                        type: "object",
                        description: "Additional context for plugin execution",
                        properties: {
                            headers: {
                                type: "object",
                                description: "HTTP headers for requests",
                            },
                            deterministic: {
                                type: "boolean",
                                description: "Enable deterministic mode",
                            },
                            sessionId: {
                                type: "string",
                                description: "Session ID for development context",
                            },
                            userExpertiseLevel: {
                                type: "string",
                                enum: ["beginner", "intermediate", "expert"],
                                description: "User expertise level for development plugins",
                            },
                        },
                    },
                },
                required: ["pluginId", "endpoint"],
            },
        },

        // Execute plugins in parallel
        {
            name: "cortexdx_execute_parallel",
            description:
                "Execute multiple plugins in parallel for faster diagnostics (completes in <30s)",
            inputSchema: {
                type: "object",
                properties: {
                    pluginIds: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of plugin IDs to execute in parallel",
                    },
                    endpoint: {
                        type: "string",
                        description: "MCP server endpoint to diagnose",
                    },
                    context: {
                        type: "object",
                        description: "Additional context for plugin execution",
                    },
                },
                required: ["pluginIds", "endpoint"],
            },
        },

        // Execute workflow
        {
            name: "cortexdx_execute_workflow",
            description:
                "Execute a predefined workflow with sequential and parallel stages",
            inputSchema: {
                type: "object",
                properties: {
                    workflowId: {
                        type: "string",
                        description: "ID of the workflow to execute",
                    },
                    endpoint: {
                        type: "string",
                        description: "MCP server endpoint to diagnose",
                    },
                    context: {
                        type: "object",
                        description: "Additional context for workflow execution",
                    },
                },
                required: ["workflowId", "endpoint"],
            },
        },

        // Create workflow
        {
            name: "cortexdx_create_workflow",
            description: "Create a new diagnostic workflow with stages and dependencies",
            inputSchema: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Workflow name",
                    },
                    description: {
                        type: "string",
                        description: "Workflow description",
                    },
                    stages: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                pluginId: { type: "string" },
                                order: { type: "number" },
                                parallel: { type: "boolean" },
                                inputMapping: { type: "object" },
                                condition: {
                                    type: "object",
                                    properties: {
                                        type: {
                                            type: "string",
                                            enum: ["severity", "finding_count", "custom"],
                                        },
                                        operator: {
                                            type: "string",
                                            enum: ["gt", "lt", "eq", "gte", "lte", "contains"],
                                        },
                                        value: {
                                            oneOf: [{ type: "string" }, { type: "number" }],
                                        },
                                        field: { type: "string" },
                                    },
                                    required: ["type", "operator", "value"],
                                },
                            },
                            required: ["id", "pluginId", "order"],
                        },
                        description: "Workflow stages",
                    },
                    dependencies: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                fromStage: { type: "string" },
                                toStage: { type: "string" },
                                dataFlow: {
                                    type: "array",
                                    items: { type: "string" },
                                },
                                required: { type: "boolean" },
                            },
                            required: ["fromStage", "toStage", "dataFlow"],
                        },
                        description: "Stage dependencies",
                    },
                    timeout: {
                        type: "number",
                        description: "Overall workflow timeout in milliseconds",
                    },
                },
                required: ["name", "description", "stages"],
            },
        },

        // List plugins
        {
            name: "cortexdx_list_plugins",
            description: "List all available diagnostic and development plugins",
            inputSchema: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        enum: ["diagnostic", "development", "all"],
                        description: "Filter plugins by category",
                    },
                },
            },
        },

        // Get plugin schema
        {
            name: "cortexdx_get_plugin_schema",
            description: "Get detailed schema information for a specific plugin",
            inputSchema: {
                type: "object",
                properties: {
                    pluginId: {
                        type: "string",
                        description: "ID of the plugin",
                    },
                },
                required: ["pluginId"],
            },
        },

        // List workflows
        {
            name: "cortexdx_list_workflows",
            description: "List all created workflows",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },

        // Get workflow
        {
            name: "cortexdx_get_workflow",
            description: "Get details of a specific workflow",
            inputSchema: {
                type: "object",
                properties: {
                    workflowId: {
                        type: "string",
                        description: "ID of the workflow",
                    },
                },
                required: ["workflowId"],
            },
        },

        // Delete workflow
        {
            name: "cortexdx_delete_workflow",
            description: "Delete a workflow",
            inputSchema: {
                type: "object",
                properties: {
                    workflowId: {
                        type: "string",
                        description: "ID of the workflow to delete",
                    },
                },
                required: ["workflowId"],
            },
        },

        // Get workflow execution history
        {
            name: "cortexdx_get_workflow_history",
            description: "Get execution history for a workflow",
            inputSchema: {
                type: "object",
                properties: {
                    workflowId: {
                        type: "string",
                        description: "ID of the workflow",
                    },
                    limit: {
                        type: "number",
                        description: "Maximum number of history entries to return",
                    },
                },
                required: ["workflowId"],
            },
        },

        // Validate workflow
        {
            name: "cortexdx_validate_workflow",
            description: "Validate a workflow definition before execution",
            inputSchema: {
                type: "object",
                properties: {
                    workflow: {
                        type: "object",
                        description: "Workflow definition to validate",
                    },
                },
                required: ["workflow"],
            },
        },
    ];
}

/**
 * Execute plugin orchestration tool
 */
export async function executePluginOrchestrationTool(
    tool: McpTool,
    args: unknown,
    context: DiagnosticContext | DevelopmentContext,
): Promise<McpToolResult> {
    try {
        const orchestrator = getPluginOrchestrator();
        ensureDefaultPluginWorkflows(orchestrator);

        switch (tool.name) {
            case "cortexdx_execute_plugin":
                return await executePlugin(args, context, orchestrator);

            case "cortexdx_execute_parallel":
                return await executeParallel(args, context, orchestrator);

            case "cortexdx_execute_workflow":
                return await executeWorkflow(args, context, orchestrator);

            case "cortexdx_create_workflow":
                return await createWorkflow(args, orchestrator);

            case "cortexdx_list_plugins":
                return await listPlugins(args, orchestrator);

            case "cortexdx_get_plugin_schema":
                return await getPluginSchema(args, orchestrator);

            case "cortexdx_list_workflows":
                return await listWorkflows(orchestrator);

            case "cortexdx_get_workflow":
                return await getWorkflow(args, orchestrator);

            case "cortexdx_delete_workflow":
                return await deleteWorkflow(args, orchestrator);

            case "cortexdx_get_workflow_history":
                return await getWorkflowHistory(args, orchestrator);

            case "cortexdx_validate_workflow":
                return await validateWorkflow(args, orchestrator);

            default:
                throw new Error(`Unknown plugin orchestration tool: ${tool.name}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(
                        {
                            error: `Plugin orchestration tool ${tool.name} failed: ${message}`,
                            tool: tool.name,
                            timestamp: new Date().toISOString(),
                        },
                        null,
                        2,
                    ),
                },
            ],
            isError: true,
        };
    }
}

// Tool implementation functions

async function executePlugin(
    args: unknown,
    context: DiagnosticContext | DevelopmentContext,
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    try {
        const { pluginId, endpoint, context: additionalContext } = args as {
            pluginId: string;
            endpoint: string;
            context?: Record<string, unknown>;
        };

        const executionContext = {
            ...context,
            endpoint,
            ...additionalContext,
        };

        const findings = await orchestrator.executePlugin(pluginId, executionContext);

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(
                        {
                            pluginId,
                            endpoint,
                            findings,
                            count: findings.length,
                        },
                        null,
                        2,
                    ),
                },
            ],
        };
    } catch (error) {
        const { pluginId, endpoint } = args as { pluginId?: string; endpoint?: string };
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to execute plugin ${pluginId || 'unknown'} on ${endpoint || 'unknown endpoint'}: ${message}`);
    }
}

async function executeParallel(
    args: unknown,
    context: DiagnosticContext | DevelopmentContext,
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    try {
        const { pluginIds, endpoint, context: additionalContext } = args as {
            pluginIds: string[];
            endpoint: string;
            context?: Record<string, unknown>;
        };

        const executionContext = {
            ...context,
            endpoint,
            ...additionalContext,
        };

        const results = await orchestrator.executeParallel(pluginIds, executionContext);

        // Convert Map to object for JSON serialization
        const resultsObj: Record<string, Finding[]> = {};
        for (const [key, value] of results.results.entries()) {
            resultsObj[key] = value;
        }

        const errorsObj: Record<string, string> = {};
        for (const [key, value] of results.errors.entries()) {
            errorsObj[key] = value.message;
        }

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(
                        {
                            pluginIds,
                            endpoint,
                            results: resultsObj,
                            errors: errorsObj,
                            executionTime: results.executionTime,
                            totalFindings: Object.values(resultsObj).flat().length,
                        },
                        null,
                        2,
                    ),
                },
            ],
        };
    } catch (error) {
        const { pluginIds, endpoint } = args as { pluginIds?: string[]; endpoint?: string };
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to execute plugins in parallel (${pluginIds?.join(', ') || 'unknown'}) on ${endpoint || 'unknown endpoint'}: ${message}`);
    }
}

async function executeWorkflow(
    args: unknown,
    context: DiagnosticContext | DevelopmentContext,
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    try {
        const { workflowId, endpoint, context: additionalContext } = args as {
            workflowId: string;
            endpoint: string;
            context?: Record<string, unknown>;
        };

        const workflow = orchestrator.getWorkflow(workflowId);
        if (!workflow) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: `Workflow not found: ${workflowId}` }),
                    },
                ],
                isError: true,
            };
        }

        const executionContext = {
            ...context,
            endpoint,
            ...additionalContext,
        };

        const results = await orchestrator.executeSequential(workflow, executionContext);

        // Convert Maps to objects for JSON serialization
        const stageResultsObj: Record<string, Finding[]> = {};
        for (const [key, value] of results.stageResults.entries()) {
            stageResultsObj[key] = value;
        }

        const stageTimingsObj: Record<string, number> = {};
        for (const [key, value] of results.stageTimings.entries()) {
            stageTimingsObj[key] = value;
        }

        const errorsObj: Record<string, string> = {};
        for (const [key, value] of results.errors.entries()) {
            errorsObj[key] = value.message;
        }

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(
                        {
                            workflowId: results.workflowId,
                            success: results.success,
                            stageResults: stageResultsObj,
                            stageTimings: stageTimingsObj,
                            skippedStages: results.skippedStages,
                            errors: errorsObj,
                            totalExecutionTime: results.totalExecutionTime,
                            totalFindings: Object.values(stageResultsObj).flat().length,
                        },
                        null,
                        2,
                    ),
                },
            ],
        };
    } catch (error) {
        const { workflowId, endpoint } = args as { workflowId?: string; endpoint?: string };
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to execute workflow ${workflowId || 'unknown'} on ${endpoint || 'unknown endpoint'}: ${message}`);
    }
}

async function createWorkflow(
    args: unknown,
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    const { name, description, stages, dependencies, timeout } = args as {
        name: string;
        description: string;
        stages: WorkflowStage[];
        dependencies?: PluginWorkflow["dependencies"];
        timeout?: number;
    };

    const workflow = orchestrator.createWorkflow({
        name,
        description,
        stages,
        dependencies: dependencies || [],
        timeout,
    });

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(
                    {
                        success: true,
                        workflow: {
                            id: workflow.id,
                            name: workflow.name,
                            description: workflow.description,
                            stageCount: workflow.stages.length,
                            dependencyCount: workflow.dependencies.length,
                        },
                    },
                    null,
                    2,
                ),
            },
        ],
    };
}

async function listPlugins(
    args: unknown,
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    const { category = "all" } = (args as { category?: string }) || {};

    const allPlugins = orchestrator.listPlugins();
    const filteredPlugins =
        category === "all"
            ? allPlugins
            : allPlugins.filter((p) => p.category === category);

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(
                    {
                        category,
                        plugins: filteredPlugins,
                        count: filteredPlugins.length,
                    },
                    null,
                    2,
                ),
            },
        ],
    };
}

async function getPluginSchema(
    args: unknown,
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    const { pluginId } = args as { pluginId: string };

    const schema = orchestrator.getPluginSchema(pluginId);
    if (!schema) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: `Plugin not found: ${pluginId}` }),
                },
            ],
            isError: true,
        };
    }

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(schema, null, 2),
            },
        ],
    };
}

async function listWorkflows(
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    const workflows = orchestrator.listWorkflows();

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(
                    {
                        workflows: workflows.map((w) => ({
                            id: w.id,
                            name: w.name,
                            description: w.description,
                            stageCount: w.stages.length,
                            dependencyCount: w.dependencies.length,
                        })),
                        count: workflows.length,
                    },
                    null,
                    2,
                ),
            },
        ],
    };
}

async function getWorkflow(
    args: unknown,
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    const { workflowId } = args as { workflowId: string };

    const workflow = orchestrator.getWorkflow(workflowId);
    if (!workflow) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: `Workflow not found: ${workflowId}` }),
                },
            ],
            isError: true,
        };
    }

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(workflow, null, 2),
            },
        ],
    };
}

async function deleteWorkflow(
    args: unknown,
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    const { workflowId } = args as { workflowId: string };

    const deleted = orchestrator.deleteWorkflow(workflowId);

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    success: deleted,
                    message: deleted
                        ? `Workflow ${workflowId} deleted`
                        : `Workflow ${workflowId} not found`,
                }),
            },
        ],
    };
}

async function getWorkflowHistory(
    args: unknown,
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    const { workflowId, limit = 10 } = args as {
        workflowId: string;
        limit?: number;
    };

    const history = orchestrator.getExecutionHistory(workflowId).slice(0, limit);

    // Convert Maps to objects for JSON serialization
    const serializedHistory = history.map((result) => {
        const stageResultsObj: Record<string, number> = {};
        for (const [key, value] of result.stageResults.entries()) {
            stageResultsObj[key] = value.length;
        }

        const stageTimingsObj: Record<string, number> = {};
        for (const [key, value] of result.stageTimings.entries()) {
            stageTimingsObj[key] = value;
        }

        const errorsObj: Record<string, string> = {};
        for (const [key, value] of result.errors.entries()) {
            errorsObj[key] = value.message;
        }

        return {
            workflowId: result.workflowId,
            success: result.success,
            totalExecutionTime: result.totalExecutionTime,
            stageResultCounts: stageResultsObj,
            stageTimings: stageTimingsObj,
            skippedStages: result.skippedStages,
            errors: errorsObj,
        };
    });

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(
                    {
                        workflowId,
                        history: serializedHistory,
                        count: serializedHistory.length,
                    },
                    null,
                    2,
                ),
            },
        ],
    };
}

async function validateWorkflow(
    args: unknown,
    orchestrator: ReturnType<typeof getPluginOrchestrator>,
): Promise<McpToolResult> {
    const { workflow } = args as { workflow: PluginWorkflow };

    const validation = orchestrator.validateWorkflow(workflow);

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(validation, null, 2),
            },
        ],
        isError: !validation.valid,
    };
}
