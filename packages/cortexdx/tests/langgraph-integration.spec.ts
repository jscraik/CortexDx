/**
 * LangGraph Integration Tests
 * Tests workflow definition, compilation, state persistence, conditional branching,
 * human-in-the-loop, and visualization
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    AgentOrchestrator,
    type WorkflowDefinition,
    type WorkflowState
} from "../src/orchestration/agent-orchestrator.js";
import {
    ConditionalBranchingEngine,
    type Branch,
} from "../src/orchestration/conditional-branching.js";
import {
    HumanInLoopManager,
    type DecisionPoint,
    type UserResponse,
} from "../src/orchestration/human-in-loop.js";
import {
    StateManager,
    type StatePersistenceConfig,
} from "../src/orchestration/state-manager.js";
import {
    WorkflowVisualizationEngine,
} from "../src/orchestration/workflow-visualization.js";
import type { DiagnosticContext, Finding } from "../src/types.js";

describe("LangGraph Integration", () => {
    let tempDir: string;
    let orchestrator: AgentOrchestrator;
    let stateManager: StateManager;
    let branchingEngine: ConditionalBranchingEngine;
    let humanInLoop: HumanInLoopManager;
    let visualizationEngine: WorkflowVisualizationEngine;

    beforeEach(() => {
        // Create temporary directory for SQLite database
        tempDir = mkdtempSync(join(tmpdir(), "langgraph-test-"));

        // Initialize components
        orchestrator = new AgentOrchestrator();

        const stateConfig: StatePersistenceConfig = {
            dbPath: join(tempDir, "test-state.db"),
            enableAutoSave: false,
            maxCheckpoints: 10,
        };
        stateManager = new StateManager(stateConfig);

        branchingEngine = new ConditionalBranchingEngine({
            maxIterations: 50,
            maxSameNodeVisits: 2,
            detectCycles: true,
            breakOnLoop: true,
        });

        humanInLoop = new HumanInLoopManager({
            defaultTimeoutMs: 60000,
            onTimeout: "continue",
        });

        visualizationEngine = new WorkflowVisualizationEngine();
    });

    afterEach(() => {
        // Cleanup
        stateManager.close();
        humanInLoop.cleanup();
        rmSync(tempDir, { recursive: true, force: true });
    });

    describe("Workflow Definition and Compilation (Req 18.1)", () => {
        it("should create a workflow from definition", () => {
            const definition: WorkflowDefinition = {
                config: {
                    workflowId: "test-workflow",
                    name: "Test Workflow",
                    description: "A test workflow",
                    enableCheckpointing: true,
                },
                nodes: [
                    {
                        id: "node1",
                        name: "Node 1",
                        type: "plugin",
                        pluginId: "test-plugin",
                    },
                    {
                        id: "node2",
                        name: "Node 2",
                        type: "decision",
                    },
                ],
                edges: [
                    { from: "node1", to: "node2" },
                ],
                entryPoint: "node1",
            };

            const workflow = orchestrator.createWorkflow(definition);

            expect(workflow).toBeDefined();
            expect(workflow.id).toBe("test-workflow");
            expect(workflow.config.name).toBe("Test Workflow");
            expect(workflow.checkpointer).toBeDefined();
        });

        it("should compile a workflow for execution", () => {
            const definition: WorkflowDefinition = {
                config: {
                    workflowId: "compile-test",
                    name: "Compile Test",
                    description: "Test compilation",
                    enableCheckpointing: false,
                },
                nodes: [
                    {
                        id: "start-node",
                        name: "Start",
                        type: "aggregation",
                    },
                ],
                edges: [],
                entryPoint: "start-node",
            };

            orchestrator.createWorkflow(definition);
            const compiled = orchestrator.compileWorkflow("compile-test");

            expect(compiled).toBeDefined();
            expect(compiled?.id).toBe("compile-test");
        });

        it("should support streaming workflow execution", async () => {
            const definition: WorkflowDefinition = {
                config: {
                    workflowId: "streaming-test",
                    name: "Streaming Test",
                    description: "Test streaming",
                    enableCheckpointing: false,
                },
                nodes: [
                    {
                        id: "stream-node",
                        name: "Stream Node",
                        type: "aggregation",
                    },
                ],
                edges: [],
                entryPoint: "stream-node",
            };

            orchestrator.createWorkflow(definition);

            const mockContext: DiagnosticContext = {
                endpoint: "http://test.com",
                logger: () => { },
                request: async () => ({}),
                jsonrpc: async () => ({}),
                sseProbe: async () => ({ ok: true }),
                evidence: () => { },
            };

            const events: string[] = [];
            const result = await orchestrator.executeWorkflow(
                "streaming-test",
                {
                    endpoint: "http://test.com",
                    context: mockContext,
                },
                {
                    streamEvents: true,
                    onEvent: (event) => {
                        events.push(event.type);
                    },
                }
            );

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });

    describe("State Persistence (Req 18.2)", () => {
        it("should save and load checkpoints", async () => {
            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [],
                errors: [],
                currentNode: "test-node",
                visitedNodes: ["node1", "node2"],
                executionPath: ["Node 1", "Node 2"],
                severity: "info",
                findingCount: 0,
                hasBlockers: false,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: {
                    workflowId: "test",
                    name: "Test",
                    description: "Test",
                    enableCheckpointing: true,
                },
                startTime: Date.now(),
                nodeTimings: {},
            };

            await stateManager.saveCheckpoint({
                checkpointId: "checkpoint-1",
                workflowId: "test-workflow",
                threadId: "thread-1",
                state: mockState,
                timestamp: Date.now(),
            });

            const loaded = await stateManager.loadCheckpoint("checkpoint-1");

            expect(loaded).toBeDefined();
            expect(loaded?.workflowId).toBe("test-workflow");
            expect(loaded?.state.currentNode).toBe("test-node");
        });

        it("should recover state after interruption", async () => {
            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [],
                errors: [],
                currentNode: "interrupted-node",
                visitedNodes: ["node1"],
                executionPath: ["Node 1"],
                severity: null,
                findingCount: 0,
                hasBlockers: false,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: {
                    workflowId: "recovery-test",
                    name: "Recovery Test",
                    description: "Test recovery",
                    enableCheckpointing: true,
                },
                startTime: Date.now(),
                nodeTimings: {},
            };

            await stateManager.saveCheckpoint({
                checkpointId: "recovery-checkpoint",
                workflowId: "recovery-test",
                threadId: "thread-1",
                state: mockState,
                timestamp: Date.now(),
            });

            const recovered = await stateManager.recoverState({
                workflowId: "recovery-test",
                threadId: "thread-1",
            });

            expect(recovered).toBeDefined();
            expect(recovered?.state.currentNode).toBe("interrupted-node");
        });

        it("should maintain cross-session state continuity", async () => {
            const sessionId = await stateManager.createSession(
                "continuity-test",
                "thread-1",
                { user: "test-user" }
            );

            expect(sessionId).toBeDefined();

            const session = await stateManager.getSession(sessionId);
            expect(session).toBeDefined();
            expect(session?.workflowId).toBe("continuity-test");
            expect(session?.status).toBe("active");
        });

        it("should record state transitions", async () => {
            // First create a checkpoint that the transition can reference
            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [],
                errors: [],
                currentNode: "node2",
                visitedNodes: ["node1", "node2"],
                executionPath: ["Node 1", "Node 2"],
                severity: null,
                findingCount: 0,
                hasBlockers: false,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: {
                    workflowId: "transition-test",
                    name: "Transition Test",
                    description: "Test transitions",
                    enableCheckpointing: true,
                },
                startTime: Date.now(),
                nodeTimings: {},
            };

            await stateManager.saveCheckpoint({
                checkpointId: "checkpoint-1",
                workflowId: "transition-test",
                threadId: "thread-1",
                state: mockState,
                timestamp: Date.now(),
            });

            await stateManager.recordTransition(
                "checkpoint-1",
                "transition-test",
                "thread-1",
                "node1",
                "node2",
                "normal",
                150
            );

            const history = await stateManager.getTransitionHistory(
                "transition-test",
                "thread-1"
            );

            expect(history).toBeDefined();
            expect(history.length).toBeGreaterThan(0);
            expect(history[0].fromNode).toBe("node1");
            expect(history[0].toNode).toBe("node2");
        });
    });

    describe("Conditional Branching (Req 18.3)", () => {
        it("should evaluate branches based on severity", () => {
            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [
                    {
                        id: "1",
                        area: "test",
                        severity: "blocker",
                        title: "Test",
                        description: "Test",
                        evidence: [],
                    } as Finding,
                ],
                errors: [],
                currentNode: "test",
                visitedNodes: [],
                executionPath: [],
                severity: "blocker",
                findingCount: 1,
                hasBlockers: true,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: {
                    workflowId: "test",
                    name: "Test",
                    description: "Test",
                    enableCheckpointing: false,
                },
                startTime: Date.now(),
                nodeTimings: {},
            };

            const branches: Branch[] = [
                {
                    id: "blocker-branch",
                    name: "Blocker",
                    targetNode: "blocker-handler",
                    conditions: [
                        {
                            type: "has_blockers",
                            operator: "eq",
                            value: true,
                        },
                    ],
                    conditionLogic: "AND",
                    priority: 100,
                },
                {
                    id: "fallback",
                    name: "Fallback",
                    targetNode: "default-handler",
                    conditions: [],
                    conditionLogic: "AND",
                    priority: 0,
                    fallback: true,
                },
            ];

            const decision = branchingEngine.evaluateBranches(mockState, branches);

            expect(decision.targetNode).toBe("blocker-handler");
            expect(decision.branchId).toBe("blocker-branch");
        });

        it("should detect and prevent loops", () => {
            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [],
                errors: [],
                currentNode: "node1",
                visitedNodes: ["node1", "node2", "node1", "node2", "node1"],
                executionPath: [],
                severity: null,
                findingCount: 0,
                hasBlockers: false,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: {
                    workflowId: "test",
                    name: "Test",
                    description: "Test",
                    enableCheckpointing: false,
                },
                startTime: Date.now(),
                nodeTimings: {},
            };

            const loopDetected = branchingEngine.detectLoop(mockState);

            expect(loopDetected).toBe(true);
        });

        it("should create severity-based routing", () => {
            const branches = branchingEngine.createSeverityRouting(
                "blocker-node",
                "major-node",
                "minor-node",
                "info-node"
            );

            expect(branches).toHaveLength(4);
            expect(branches[0].targetNode).toBe("blocker-node");
            expect(branches[1].targetNode).toBe("major-node");
            expect(branches[2].targetNode).toBe("minor-node");
            expect(branches[3].targetNode).toBe("info-node");
        });
    });

    describe("Human-in-the-Loop (Req 18.4)", () => {
        it("should pause workflow at decision point", async () => {
            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [],
                errors: [],
                currentNode: "decision-node",
                visitedNodes: [],
                executionPath: [],
                severity: null,
                findingCount: 0,
                hasBlockers: false,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: {
                    workflowId: "test",
                    name: "Test",
                    description: "Test",
                    enableCheckpointing: false,
                },
                startTime: Date.now(),
                nodeTimings: {},
            };

            const decisionPoint: DecisionPoint = {
                id: "decision-1",
                nodeId: "decision-node",
                prompt: humanInLoop.createConfirmationPrompt(
                    "Continue?",
                    "Do you want to continue?"
                ),
            };

            const prompt = await humanInLoop.pauseWorkflow(
                "test-workflow",
                "thread-1",
                decisionPoint,
                mockState
            );

            expect(prompt).toBeDefined();
            expect(prompt.type).toBe("confirmation");
            expect(humanInLoop.isWorkflowPaused("test-workflow", "thread-1")).toBe(true);
        });

        it("should resume workflow with user input", async () => {
            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [],
                errors: [],
                currentNode: "decision-node",
                visitedNodes: [],
                executionPath: [],
                severity: null,
                findingCount: 0,
                hasBlockers: false,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: {
                    workflowId: "test",
                    name: "Test",
                    description: "Test",
                    enableCheckpointing: false,
                },
                startTime: Date.now(),
                nodeTimings: {},
            };

            const decisionPoint: DecisionPoint = {
                id: "decision-2",
                nodeId: "decision-node",
                prompt: humanInLoop.createConfirmationPrompt(
                    "Continue?",
                    "Do you want to continue?"
                ),
            };

            await humanInLoop.pauseWorkflow(
                "test-workflow-2",
                "thread-2",
                decisionPoint,
                mockState
            );

            const response: UserResponse = {
                promptId: decisionPoint.prompt.id,
                type: "confirmation",
                value: "yes",
                timestamp: Date.now(),
            };

            const resumedState = await humanInLoop.resumeWorkflow(
                "test-workflow-2",
                "thread-2",
                response
            );

            expect(resumedState).toBeDefined();
            expect(resumedState.awaitingUserInput).toBe(false);
            expect(resumedState.userResponse).toBe("yes");
        });

        it("should handle timeout for abandoned workflows", async () => {
            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [],
                errors: [],
                currentNode: "timeout-node",
                visitedNodes: [],
                executionPath: [],
                severity: null,
                findingCount: 0,
                hasBlockers: false,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: {
                    workflowId: "test",
                    name: "Test",
                    description: "Test",
                    enableCheckpointing: false,
                },
                startTime: Date.now(),
                nodeTimings: {},
            };

            const decisionPoint: DecisionPoint = {
                id: "timeout-decision",
                nodeId: "timeout-node",
                prompt: {
                    ...humanInLoop.createConfirmationPrompt(
                        "Timeout Test",
                        "This will timeout"
                    ),
                    timeout: 100, // 100ms timeout
                },
            };

            await humanInLoop.pauseWorkflow(
                "timeout-workflow",
                "timeout-thread",
                decisionPoint,
                mockState
            );

            // Wait for timeout
            await new Promise((resolve) => setTimeout(resolve, 150));

            const timedOutState = await humanInLoop.handleTimeout(
                "timeout-workflow",
                "timeout-thread"
            );

            expect(timedOutState).toBeDefined();
            if (timedOutState) {
                expect(timedOutState.errors.length).toBeGreaterThan(0);
            }
        });
    });

    describe("Workflow Visualization (Req 18.5)", () => {
        it("should generate Mermaid diagram from workflow", () => {
            const definition: WorkflowDefinition = {
                config: {
                    workflowId: "viz-test",
                    name: "Visualization Test",
                    description: "Test visualization",
                    enableCheckpointing: false,
                },
                nodes: [
                    {
                        id: "node1",
                        name: "Node 1",
                        type: "plugin",
                    },
                    {
                        id: "node2",
                        name: "Node 2",
                        type: "decision",
                    },
                ],
                edges: [
                    { from: "node1", to: "node2", label: "next" },
                ],
                entryPoint: "node1",
            };

            const diagram = visualizationEngine.generateMermaidDiagram(definition);

            expect(diagram).toContain("graph TD");
            expect(diagram).toContain("node1");
            expect(diagram).toContain("node2");
            expect(diagram).toContain("START");
            expect(diagram).toContain("END");
        });

        it("should calculate performance metrics per node", () => {
            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [],
                errors: [],
                currentNode: "node2",
                visitedNodes: ["node1", "node2"],
                executionPath: ["Node 1", "Node 2"],
                severity: null,
                findingCount: 0,
                hasBlockers: false,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: {
                    workflowId: "test",
                    name: "Test",
                    description: "Test",
                    enableCheckpointing: false,
                },
                startTime: Date.now(),
                nodeTimings: {
                    node1: 150,
                    node2: 200,
                },
            };

            const metrics = visualizationEngine.calculateNodeMetrics(mockState);

            expect(metrics.size).toBe(2);
            expect(metrics.get("node1")?.totalExecutionTime).toBe(150);
            expect(metrics.get("node2")?.totalExecutionTime).toBe(200);
        });

        it("should generate complete workflow visualization", () => {
            const definition: WorkflowDefinition = {
                config: {
                    workflowId: "complete-viz",
                    name: "Complete Visualization",
                    description: "Complete test",
                    enableCheckpointing: false,
                },
                nodes: [
                    {
                        id: "start",
                        name: "Start",
                        type: "aggregation",
                    },
                ],
                edges: [],
                entryPoint: "start",
            };

            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [],
                errors: [],
                currentNode: "start",
                visitedNodes: ["start"],
                executionPath: ["Start"],
                severity: null,
                findingCount: 0,
                hasBlockers: false,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: definition.config,
                startTime: Date.now() - 1000,
                nodeTimings: { start: 100 },
            };

            const visualization = visualizationEngine.generateVisualization(
                definition,
                mockState
            );

            expect(visualization).toBeDefined();
            expect(visualization.mermaidDiagram).toContain("graph TD");
            expect(visualization.metrics.size).toBeGreaterThan(0);
            expect(visualization.executionPath).toEqual(["Start"]);
            expect(visualization.currentNode).toBe("start");
        });

        it("should export visualization in different formats", () => {
            const definition: WorkflowDefinition = {
                config: {
                    workflowId: "export-test",
                    name: "Export Test",
                    description: "Test export",
                    enableCheckpointing: false,
                },
                nodes: [
                    {
                        id: "export-node",
                        name: "Export Node",
                        type: "aggregation",
                    },
                ],
                edges: [],
                entryPoint: "export-node",
            };

            const mockState: WorkflowState = {
                endpoint: "http://test.com",
                findings: [],
                errors: [],
                currentNode: "export-node",
                visitedNodes: ["export-node"],
                executionPath: ["Export Node"],
                severity: null,
                findingCount: 0,
                hasBlockers: false,
                hasMajor: false,
                awaitingUserInput: false,
                context: {} as DiagnosticContext,
                config: definition.config,
                startTime: Date.now(),
                nodeTimings: { "export-node": 50 },
            };

            const visualization = visualizationEngine.generateVisualization(
                definition,
                mockState
            );

            const mermaidExport = visualizationEngine.exportVisualization(
                visualization,
                "mermaid"
            );
            expect(mermaidExport).toContain("graph TD");

            const jsonExport = visualizationEngine.exportVisualization(
                visualization,
                "json"
            );
            expect(() => JSON.parse(jsonExport)).not.toThrow();

            const markdownExport = visualizationEngine.exportVisualization(
                visualization,
                "markdown"
            );
            expect(markdownExport).toContain("# Workflow Visualization");
            expect(markdownExport).toContain("```mermaid");
        });
    });
});
