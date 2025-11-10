/**
 * Plugin Orchestration Tests
 * Tests for plugin orchestrator, workflow engine, and MCP tool exposure
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */

import { beforeEach, describe, expect, it } from "vitest";
import { PluginOrchestrator } from "../src/orchestration/plugin-orchestrator.js";
import { WorkflowEngine } from "../src/orchestration/workflow-engine.js";
import { createPluginOrchestrationTools, executePluginOrchestrationTool } from "../src/tools/plugin-orchestration-tools.js";
import type { DiagnosticContext } from "../src/types.js";

// Mock diagnostic context
const createMockContext = (): DiagnosticContext => ({
    endpoint: "http://localhost:3000",
    headers: {},
    logger: () => { },
    request: async () => ({}),
    jsonrpc: async () => ({}),
    sseProbe: async () => ({ ok: true }),
    evidence: () => { },
    deterministic: true,
});

describe("Plugin Orchestrator", () => {
    let orchestrator: PluginOrchestrator;
    let mockContext: DiagnosticContext;

    beforeEach(() => {
        orchestrator = new PluginOrchestrator();
        mockContext = createMockContext();
    });

    describe("Plugin Execution", () => {
        it("should execute a single plugin", async () => {
            const findings = await orchestrator.executePlugin("protocol", mockContext);
            expect(Array.isArray(findings)).toBe(true);
        });

        it("should throw error for unknown plugin", async () => {
            await expect(
                orchestrator.executePlugin("unknown-plugin", mockContext),
            ).rejects.toThrow("Plugin not found");
        });
    });

    describe("Parallel Execution (Req 17.2)", () => {
        it("should execute multiple plugins in parallel", async () => {
            const pluginIds = ["protocol", "discovery", "devtool"];
            const startTime = Date.now();

            const results = await orchestrator.executeParallel(pluginIds, mockContext);

            const executionTime = Date.now() - startTime;

            expect(results.results.size).toBeGreaterThan(0);
            expect(results.executionTime).toBeLessThan(30000); // <30s requirement
            expect(executionTime).toBeLessThan(30000);
        });

        it("should handle plugin errors in parallel execution", async () => {
            const pluginIds = ["protocol", "unknown-plugin", "discovery"];

            const results = await orchestrator.executeParallel(pluginIds, mockContext);

            expect(results.errors.size).toBeGreaterThan(0);
            expect(results.errors.has("unknown-plugin")).toBe(true);
        });

        it("should return results for successful plugins even if some fail", async () => {
            const pluginIds = ["protocol", "unknown-plugin"];

            const results = await orchestrator.executeParallel(pluginIds, mockContext);

            expect(results.results.size).toBeGreaterThan(0);
            expect(results.errors.size).toBeGreaterThan(0);
        });
    });

    describe("Workflow Management (Req 17.3)", () => {
        it("should create a valid workflow", () => {
            const workflow = orchestrator.createWorkflow({
                name: "Test Workflow",
                description: "A test workflow",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: false,
                    },
                    {
                        id: "stage2",
                        pluginId: "discovery",
                        order: 2,
                        parallel: false,
                    },
                ],
                dependencies: [
                    {
                        fromStage: "stage1",
                        toStage: "stage2",
                        dataFlow: ["findings"],
                        required: true,
                    },
                ],
            });

            expect(workflow.id).toBeDefined();
            expect(workflow.name).toBe("Test Workflow");
            expect(workflow.stages.length).toBe(2);
        });

        it("should validate workflow definition", () => {
            const workflow = orchestrator.createWorkflow({
                name: "Valid Workflow",
                description: "Test",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: false,
                    },
                ],
                dependencies: [],
            });

            const validation = orchestrator.validateWorkflow(workflow);
            expect(validation.valid).toBe(true);
            expect(validation.errors.length).toBe(0);
        });

        it("should detect invalid workflow with duplicate stage IDs", () => {
            expect(() =>
                orchestrator.createWorkflow({
                    name: "Invalid Workflow",
                    description: "Test",
                    stages: [
                        {
                            id: "stage1",
                            pluginId: "protocol",
                            order: 1,
                            parallel: false,
                        },
                        {
                            id: "stage1",
                            pluginId: "discovery",
                            order: 2,
                            parallel: false,
                        },
                    ],
                    dependencies: [],
                }),
            ).toThrow("Invalid workflow definition");
        });

        it("should detect invalid workflow with unknown plugin", () => {
            expect(() =>
                orchestrator.createWorkflow({
                    name: "Invalid Workflow",
                    description: "Test",
                    stages: [
                        {
                            id: "stage1",
                            pluginId: "unknown-plugin",
                            order: 1,
                            parallel: false,
                        },
                    ],
                    dependencies: [],
                }),
            ).toThrow("Plugin not found");
        });

        it("should detect circular dependencies", () => {
            expect(() =>
                orchestrator.createWorkflow({
                    name: "Circular Workflow",
                    description: "Test",
                    stages: [
                        {
                            id: "stage1",
                            pluginId: "protocol",
                            order: 1,
                            parallel: false,
                        },
                        {
                            id: "stage2",
                            pluginId: "discovery",
                            order: 2,
                            parallel: false,
                        },
                    ],
                    dependencies: [
                        {
                            fromStage: "stage1",
                            toStage: "stage2",
                            dataFlow: ["findings"],
                            required: true,
                        },
                        {
                            fromStage: "stage2",
                            toStage: "stage1",
                            dataFlow: ["findings"],
                            required: true,
                        },
                    ],
                }),
            ).toThrow("Circular dependency detected");
        });
    });

    describe("Sequential Execution with Dependencies (Req 17.3, 17.4)", () => {
        it("should execute workflow stages sequentially", async () => {
            const workflow = orchestrator.createWorkflow({
                name: "Sequential Workflow",
                description: "Test sequential execution",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: false,
                    },
                    {
                        id: "stage2",
                        pluginId: "discovery",
                        order: 2,
                        parallel: false,
                    },
                ],
                dependencies: [
                    {
                        fromStage: "stage1",
                        toStage: "stage2",
                        dataFlow: ["findings"],
                        required: false,
                    },
                ],
            });

            const results = await orchestrator.executeSequential(workflow, mockContext);

            expect(results.success).toBe(true);
            expect(results.stageResults.size).toBe(2);
            expect(results.stageTimings.size).toBe(2);
            expect(results.totalExecutionTime).toBeGreaterThan(0);
        });

        it("should execute parallel stages at same order level", async () => {
            const workflow = orchestrator.createWorkflow({
                name: "Parallel Stages Workflow",
                description: "Test parallel execution within order",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: true,
                    },
                    {
                        id: "stage2",
                        pluginId: "discovery",
                        order: 1,
                        parallel: true,
                    },
                    {
                        id: "stage3",
                        pluginId: "devtool",
                        order: 2,
                        parallel: false,
                    },
                ],
                dependencies: [],
            });

            const results = await orchestrator.executeSequential(workflow, mockContext);

            expect(results.success).toBe(true);
            expect(results.stageResults.size).toBe(3);
        });

        it("should skip stages based on conditions", async () => {
            const workflow = orchestrator.createWorkflow({
                name: "Conditional Workflow",
                description: "Test conditional execution",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: false,
                    },
                    {
                        id: "stage2",
                        pluginId: "discovery",
                        order: 2,
                        parallel: false,
                        condition: {
                            type: "finding_count",
                            operator: "gt",
                            value: 1000, // Unlikely to have this many findings
                        },
                    },
                ],
                dependencies: [],
            });

            const results = await orchestrator.executeSequential(workflow, mockContext);

            expect(results.skippedStages.length).toBeGreaterThan(0);
            expect(results.skippedStages).toContain("stage2");
        });
    });

    describe("Plugin Registry", () => {
        it("should list all available plugins", () => {
            const plugins = orchestrator.listPlugins();

            expect(plugins.length).toBeGreaterThan(0);
            expect(plugins.every((p) => p.id && p.title && p.category)).toBe(true);
        });

        it("should get plugin schema", () => {
            const schema = orchestrator.getPluginSchema("protocol");

            expect(schema).toBeDefined();
            expect(schema?.id).toBe("protocol");
            expect(schema?.category).toBe("diagnostic");
        });

        it("should return null for unknown plugin schema", () => {
            const schema = orchestrator.getPluginSchema("unknown-plugin");
            expect(schema).toBeNull();
        });
    });

    describe("Workflow Storage", () => {
        it("should store and retrieve workflows", () => {
            const workflow = orchestrator.createWorkflow({
                name: "Stored Workflow",
                description: "Test storage",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: false,
                    },
                ],
                dependencies: [],
            });

            const retrieved = orchestrator.getWorkflow(workflow.id);
            expect(retrieved).toEqual(workflow);
        });

        it("should list all workflows", () => {
            orchestrator.createWorkflow({
                name: "Workflow 1",
                description: "Test",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: false,
                    },
                ],
                dependencies: [],
            });

            const workflows = orchestrator.listWorkflows();
            expect(workflows.length).toBeGreaterThan(0);
        });

        it("should delete workflows", () => {
            const workflow = orchestrator.createWorkflow({
                name: "To Delete",
                description: "Test",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: false,
                    },
                ],
                dependencies: [],
            });

            const deleted = orchestrator.deleteWorkflow(workflow.id);
            expect(deleted).toBe(true);

            const retrieved = orchestrator.getWorkflow(workflow.id);
            expect(retrieved).toBeUndefined();
        });
    });

    describe("Execution History", () => {
        it("should track workflow execution history", async () => {
            const workflow = orchestrator.createWorkflow({
                name: "History Test",
                description: "Test history tracking",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: false,
                    },
                ],
                dependencies: [],
            });

            await orchestrator.executeSequential(workflow, mockContext);

            const history = orchestrator.getExecutionHistory(workflow.id);
            expect(history.length).toBe(1);
            expect(history[0].workflowId).toBe(workflow.id);
        });
    });
});

describe("Workflow Engine", () => {
    let engine: WorkflowEngine;
    let mockContext: DiagnosticContext;

    beforeEach(() => {
        engine = new WorkflowEngine();
        mockContext = createMockContext();
    });

    describe("Execution Planning", () => {
        it("should create execution plan", () => {
            const workflow = {
                id: "test-workflow",
                name: "Test",
                description: "Test",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: false,
                    },
                    {
                        id: "stage2",
                        pluginId: "discovery",
                        order: 2,
                        parallel: false,
                    },
                ],
                dependencies: [
                    {
                        fromStage: "stage1",
                        toStage: "stage2",
                        dataFlow: ["findings"],
                        required: true,
                    },
                ],
            };

            const plan = engine.createExecutionPlan(workflow);

            expect(plan.workflow).toEqual(workflow);
            expect(plan.executionOrder.length).toBeGreaterThan(0);
            expect(plan.dependencyGraph.size).toBeGreaterThan(0);
            expect(plan.criticalPath.length).toBeGreaterThan(0);
        });
    });

    describe("Conditional Execution", () => {
        it("should evaluate severity condition", () => {
            const context = engine.createExecutionContext("test-workflow");

            // Add some mock findings
            context.stageData.set("stage1", {
                stageId: "stage1",
                pluginId: "protocol",
                findings: [
                    {
                        id: "f1",
                        area: "test",
                        severity: "blocker",
                        title: "Test",
                        description: "Test",
                        evidence: [],
                    },
                ],
                executionTime: 100,
                startTime: Date.now(),
                endTime: Date.now(),
                status: "completed",
            });

            const stage = {
                id: "stage2",
                pluginId: "discovery",
                order: 2,
                parallel: false,
                condition: {
                    type: "finding_count" as const,
                    operator: "gt" as const,
                    value: 0,
                },
            };

            const result = engine.evaluateConditionalExecution(stage, context);
            expect(result.shouldExecute).toBe(true);
        });

        it("should evaluate finding count condition", () => {
            const context = engine.createExecutionContext("test-workflow");

            context.stageData.set("stage1", {
                stageId: "stage1",
                pluginId: "protocol",
                findings: [
                    {
                        id: "f1",
                        area: "test",
                        severity: "info",
                        title: "Test",
                        description: "Test",
                        evidence: [],
                    },
                    {
                        id: "f2",
                        area: "test",
                        severity: "info",
                        title: "Test",
                        description: "Test",
                        evidence: [],
                    },
                ],
                executionTime: 100,
                startTime: Date.now(),
                endTime: Date.now(),
                status: "completed",
            });

            const stage = {
                id: "stage2",
                pluginId: "discovery",
                order: 2,
                parallel: false,
                condition: {
                    type: "finding_count" as const,
                    operator: "gte" as const,
                    value: 2,
                },
            };

            const result = engine.evaluateConditionalExecution(stage, context);
            expect(result.shouldExecute).toBe(true);
        });
    });

    describe("Data Mapping", () => {
        it("should apply input mapping from previous stages", () => {
            const workflow = {
                id: "test-workflow",
                name: "Test",
                description: "Test",
                stages: [
                    {
                        id: "stage1",
                        pluginId: "protocol",
                        order: 1,
                        parallel: false,
                    },
                    {
                        id: "stage2",
                        pluginId: "discovery",
                        order: 2,
                        parallel: false,
                        inputMapping: {
                            findings: "previousFindings",
                        },
                    },
                ],
                dependencies: [
                    {
                        fromStage: "stage1",
                        toStage: "stage2",
                        dataFlow: ["findings"],
                        required: true,
                    },
                ],
            };

            const context = engine.createExecutionContext(workflow.id);

            context.stageData.set("stage1", {
                stageId: "stage1",
                pluginId: "protocol",
                findings: [
                    {
                        id: "f1",
                        area: "test",
                        severity: "info",
                        title: "Test",
                        description: "Test",
                        evidence: [],
                    },
                ],
                executionTime: 100,
                startTime: Date.now(),
                endTime: Date.now(),
                status: "completed",
            });

            const result = engine.applyInputMapping(
                workflow.stages[1],
                workflow,
                context,
            );

            expect(result.mappedData.previousFindings).toBeDefined();
            expect(result.sourcesUsed).toContain("stage1");
            expect(result.missingDependencies.length).toBe(0);
        });
    });

    describe("Result Aggregation", () => {
        it("should aggregate results from multiple stages", () => {
            const context = engine.createExecutionContext("test-workflow");

            context.stageData.set("stage1", {
                stageId: "stage1",
                pluginId: "protocol",
                findings: [
                    {
                        id: "f1",
                        area: "test",
                        severity: "blocker",
                        title: "Test",
                        description: "Test",
                        evidence: [],
                    },
                ],
                executionTime: 100,
                startTime: Date.now(),
                endTime: Date.now(),
                status: "completed",
            });

            context.stageData.set("stage2", {
                stageId: "stage2",
                pluginId: "discovery",
                findings: [
                    {
                        id: "f2",
                        area: "test",
                        severity: "major",
                        title: "Test",
                        description: "Test",
                        evidence: [],
                    },
                ],
                executionTime: 150,
                startTime: Date.now(),
                endTime: Date.now(),
                status: "completed",
            });

            const aggregated = engine.aggregateResults(context);

            expect(aggregated.findings.length).toBe(2);
            expect(aggregated.totalExecutionTime).toBe(250);
            expect(aggregated.stageCount).toBe(2);
            expect(aggregated.successCount).toBe(2);
        });
    });
});

describe("MCP Tool Exposure (Req 17.1, 17.5)", () => {
    it("should create plugin orchestration tools", () => {
        const tools = createPluginOrchestrationTools();

        expect(tools.length).toBeGreaterThan(0);
        expect(tools.every((t) => t.name && t.description && t.inputSchema)).toBe(
            true,
        );
    });

    it("should have standardized tool schemas", () => {
        const tools = createPluginOrchestrationTools();

        for (const tool of tools) {
            expect(tool.inputSchema.type).toBe("object");
            expect(tool.inputSchema.properties).toBeDefined();
        }
    });

    it("should include execute plugin tool", () => {
        const tools = createPluginOrchestrationTools();
        const executeTool = tools.find((t) => t.name === "cortexdx_execute_plugin");

        expect(executeTool).toBeDefined();
        expect(executeTool?.inputSchema.properties).toHaveProperty("pluginId");
        expect(executeTool?.inputSchema.properties).toHaveProperty("endpoint");
    });

    it("should include execute parallel tool", () => {
        const tools = createPluginOrchestrationTools();
        const parallelTool = tools.find(
            (t) => t.name === "cortexdx_execute_parallel",
        );

        expect(parallelTool).toBeDefined();
        expect(parallelTool?.inputSchema.properties).toHaveProperty("pluginIds");
    });

    it("should include workflow management tools", () => {
        const tools = createPluginOrchestrationTools();
        const workflowTools = tools.filter((t) => t.name.includes("workflow"));

        expect(workflowTools.length).toBeGreaterThan(0);
    });

    it("should execute plugin tool", async () => {
        const tools = createPluginOrchestrationTools();
        const executeTool = tools.find((t) => t.name === "cortexdx_execute_plugin");

        if (!executeTool) {
            throw new Error("Execute plugin tool not found");
        }

        const mockContext = createMockContext();
        const result = await executePluginOrchestrationTool(
            executeTool,
            {
                pluginId: "protocol",
                endpoint: "http://localhost:3000",
            },
            mockContext,
        );

        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe("text");
    });

    it("should return structured diagnostic results", async () => {
        const tools = createPluginOrchestrationTools();
        const executeTool = tools.find((t) => t.name === "cortexdx_execute_plugin");

        if (!executeTool) {
            throw new Error("Execute plugin tool not found");
        }

        const mockContext = createMockContext();
        const result = await executePluginOrchestrationTool(
            executeTool,
            {
                pluginId: "protocol",
                endpoint: "http://localhost:3000",
            },
            mockContext,
        );

        const resultData = JSON.parse(result.content[0].text || "{}");
        expect(resultData).toHaveProperty("pluginId");
        expect(resultData).toHaveProperty("endpoint");
        expect(resultData).toHaveProperty("findings");
        expect(resultData).toHaveProperty("count");
    });
});
