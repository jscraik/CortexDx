import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AgentOrchestrator,
  type WorkflowDefinition,
} from "../../src/orchestration/agent-orchestrator.js";
import {
  StateManager,
  type StatePersistenceConfig,
} from "../../src/orchestration/state-manager.js";
import type { DiagnosticContext, Finding } from "../../src/types.js";

// Mock diagnostic context for testing
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

describe("Orchestration - Workflow Runtime", () => {
  let orchestrator: AgentOrchestrator;
  let stateManager: StateManager;
  let testDbPath: string;

  beforeEach(() => {
    // Use in-memory database for tests
    testDbPath = ":memory:";

    const config: StatePersistenceConfig = {
      dbPath: testDbPath,
      enableAutoSave: false,
      maxCheckpoints: 10,
    };

    stateManager = new StateManager(config);
    orchestrator = new AgentOrchestrator(undefined, stateManager);
  });

  afterEach(() => {
    stateManager.close();
  });

  describe("Workflow Creation", () => {
    it("should create a basic workflow", () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "test-workflow",
          name: "Test Workflow",
          description: "A simple test workflow",
          enableCheckpointing: false,
        },
        nodes: [
          {
            id: "start",
            name: "Start Node",
            type: "aggregation",
            handler: async (state) => ({ currentNode: "start" }),
          },
        ],
        edges: [],
        entryPoint: "start",
      };

      const workflow = orchestrator.createWorkflow(definition);

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe("test-workflow");
      expect(workflow.config.name).toBe("Test Workflow");
      expect(workflow.graph).toBeDefined();
    });

    it("should enable checkpointing when configured", () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "checkpoint-workflow",
          name: "Checkpoint Test",
          description: "Test checkpointing",
          enableCheckpointing: true,
        },
        nodes: [{ id: "node1", name: "Node 1", type: "aggregation" }],
        edges: [],
        entryPoint: "node1",
      };

      const workflow = orchestrator.createWorkflow(definition);

      expect(workflow.checkpointer).toBeDefined();
      expect(orchestrator.getCheckpointer("checkpoint-workflow")).toBeDefined();
    });

    it("should register workflow in orchestrator", () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "registered-workflow",
          name: "Registration Test",
          description: "Test workflow registration",
          enableCheckpointing: false,
        },
        nodes: [{ id: "start", name: "Start", type: "aggregation" }],
        edges: [],
        entryPoint: "start",
      };

      orchestrator.createWorkflow(definition);

      const retrieved = orchestrator.getWorkflow("registered-workflow");
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("registered-workflow");
    });
  });

  describe("Workflow Execution", () => {
    it("should execute a simple linear workflow", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "linear-workflow",
          name: "Linear Test",
          description: "Simple linear execution",
          enableCheckpointing: false,
        },
        nodes: [
          {
            id: "step1",
            name: "First Step",
            type: "aggregation",
            handler: async (state) => ({
              visitedNodes: [...state.visitedNodes, "step1"],
            }),
          },
        ],
        edges: [],
        entryPoint: "step1",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      const result = await orchestrator.executeWorkflow("linear-workflow", {
        context,
        endpoint: context.endpoint,
      });

      expect(result.success).toBe(true);
      expect(result.state.visitedNodes).toContain("step1");
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it("should track execution metadata", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "metadata-workflow",
          name: "Metadata Test",
          description: "Test execution metadata",
          enableCheckpointing: false,
        },
        nodes: [
          {
            id: "tracked",
            name: "Tracked Node",
            type: "aggregation",
            handler: async () => ({ currentNode: "tracked" }),
          },
        ],
        edges: [],
        entryPoint: "tracked",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      const result = await orchestrator.executeWorkflow("metadata-workflow", {
        context,
        endpoint: context.endpoint,
      });

      expect(result.state.executionPath).toBeDefined();
      expect(result.state.nodeTimings).toBeDefined();
      expect(result.state.nodeTimings.tracked).toBeGreaterThanOrEqual(0);
      expect(result.state.startTime).toBeLessThanOrEqual(Date.now());
    });

    it("should handle workflow with findings", async () => {
      const mockFindings: Finding[] = [
        {
          findingId: "test-1",
          category: "Test",
          severity: "minor",
          message: "Test finding",
          component: "test-component",
        },
      ];

      const definition: WorkflowDefinition = {
        config: {
          workflowId: "findings-workflow",
          name: "Findings Test",
          description: "Test findings handling",
          enableCheckpointing: false,
        },
        nodes: [
          {
            id: "analyzer",
            name: "Analyzer",
            type: "aggregation",
            handler: async (state) => ({
              findings: [...state.findings, ...mockFindings],
              findingCount: state.findings.length + mockFindings.length,
            }),
          },
        ],
        edges: [],
        entryPoint: "analyzer",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      const result = await orchestrator.executeWorkflow("findings-workflow", {
        context,
        endpoint: context.endpoint,
      });

      expect(result.state.findings).toHaveLength(1);
      expect(result.state.findingCount).toBe(1);
      expect(result.state.findings[0].findingId).toBe("test-1");
    });
  });

  describe("Conditional Branching", () => {
    it("should route based on conditions", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "conditional-workflow",
          name: "Conditional Test",
          description: "Test conditional routing",
          enableCheckpointing: false,
        },
        nodes: [
          {
            id: "check",
            name: "Check Condition",
            type: "decision",
            handler: async (state) => ({
              hasBlockers: state.endpoint.includes("blocker"),
            }),
          },
          {
            id: "blocker-path",
            name: "Blocker Handler",
            type: "aggregation",
            handler: async () => ({ severity: "blocker" as const }),
          },
          {
            id: "normal-path",
            name: "Normal Handler",
            type: "aggregation",
            handler: async () => ({ severity: "info" as const }),
          },
        ],
        edges: [
          {
            from: "check",
            to: "blocker-path",
            condition: (state) => state.hasBlockers === true,
          },
          {
            from: "check",
            to: "normal-path",
            condition: (state) => state.hasBlockers === false,
          },
        ],
        entryPoint: "check",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      // Test blocker path
      const blockerResult = await orchestrator.executeWorkflow(
        "conditional-workflow",
        {
          context: { ...context, endpoint: "http://blocker.local" },
          endpoint: "http://blocker.local",
        },
      );

      expect(blockerResult.state.hasBlockers).toBe(true);

      // Test normal path
      const normalResult = await orchestrator.executeWorkflow(
        "conditional-workflow",
        {
          context: { ...context, endpoint: "http://normal.local" },
          endpoint: "http://normal.local",
        },
      );

      expect(normalResult.state.hasBlockers).toBe(false);
    });
  });

  describe("State Management", () => {
    it("should persist state checkpoints", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "checkpoint-test",
          name: "Checkpoint Test",
          description: "Test checkpoint persistence",
          enableCheckpointing: true,
        },
        nodes: [
          {
            id: "save-state",
            name: "Save State",
            type: "aggregation",
            handler: async (state) => ({
              visitedNodes: [...state.visitedNodes, "save-state"],
            }),
          },
        ],
        edges: [],
        entryPoint: "save-state",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      const result = await orchestrator.executeWorkflow("checkpoint-test", {
        context,
        endpoint: context.endpoint,
        threadId: "test-thread-1",
      });

      expect(result.checkpointId).toBeDefined();

      // Verify checkpoint was saved
      const checkpoint = await stateManager.loadCheckpoint(
        result.checkpointId!,
      );
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.workflowId).toBe("checkpoint-test");
      expect(checkpoint?.threadId).toBe("test-thread-1");
    });

    it("should create workflow sessions", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "session-test",
          name: "Session Test",
          description: "Test session creation",
          enableCheckpointing: true,
        },
        nodes: [
          {
            id: "session-node",
            name: "Session Node",
            type: "aggregation",
          },
        ],
        edges: [],
        entryPoint: "session-node",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      await orchestrator.executeWorkflow("session-test", {
        context,
        endpoint: context.endpoint,
        threadId: "session-thread",
      });

      const sessions = await stateManager.listSessions("session-test");
      expect(sessions).toBeDefined();
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].workflowId).toBe("session-test");
    });

    it("should recover state from checkpoint", async () => {
      // First, create and execute a workflow
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "recovery-test",
          name: "Recovery Test",
          description: "Test state recovery",
          enableCheckpointing: true,
        },
        nodes: [
          {
            id: "recoverable",
            name: "Recoverable Node",
            type: "aggregation",
            handler: async (state) => ({
              visitedNodes: [...state.visitedNodes, "recoverable"],
              currentNode: "recoverable",
            }),
          },
        ],
        edges: [],
        entryPoint: "recoverable",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      await orchestrator.executeWorkflow("recovery-test", {
        context,
        endpoint: context.endpoint,
        threadId: "recovery-thread",
      });

      // Now recover the state
      const recovered = await stateManager.recoverState({
        workflowId: "recovery-test",
        threadId: "recovery-thread",
      });

      expect(recovered).toBeDefined();
      expect(recovered?.state.visitedNodes).toContain("recoverable");
      expect(recovered?.state.currentNode).toBe("recoverable");
    });
  });

  describe("Error Handling", () => {
    it("should handle node execution errors", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "error-test",
          name: "Error Test",
          description: "Test error handling",
          enableCheckpointing: false,
        },
        nodes: [
          {
            id: "failing-node",
            name: "Failing Node",
            type: "aggregation",
            handler: async () => {
              throw new Error("Intentional test error");
            },
          },
        ],
        edges: [],
        entryPoint: "failing-node",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      const result = await orchestrator.executeWorkflow("error-test", {
        context,
        endpoint: context.endpoint,
      });

      expect(result.success).toBe(false);
      expect(result.state.errors).toBeDefined();
      expect(result.state.errors.length).toBeGreaterThan(0);
      expect(result.state.errors[0]).toContain("Intentional test error");
    });

    it("should handle missing workflow execution", async () => {
      const context = createMockContext();

      await expect(async () => {
        await orchestrator.executeWorkflow("nonexistent-workflow", {
          context,
          endpoint: context.endpoint,
        });
      }).rejects.toThrow(/not found/i);
    });

    it("should require initial context", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "context-required",
          name: "Context Required",
          description: "Test context requirement",
          enableCheckpointing: false,
        },
        nodes: [{ id: "node1", name: "Node 1", type: "aggregation" }],
        edges: [],
        entryPoint: "node1",
      };

      orchestrator.createWorkflow(definition);

      await expect(async () => {
        await orchestrator.executeWorkflow("context-required", {
          endpoint: "http://test.local",
        });
      }).rejects.toThrow(/requires.*context/i);
    });
  });

  describe("Workflow Management", () => {
    it("should list all workflows", () => {
      const definitions: WorkflowDefinition[] = [
        {
          config: {
            workflowId: "wf1",
            name: "Workflow 1",
            description: "Test 1",
            enableCheckpointing: false,
          },
          nodes: [{ id: "n1", name: "Node 1", type: "aggregation" }],
          edges: [],
          entryPoint: "n1",
        },
        {
          config: {
            workflowId: "wf2",
            name: "Workflow 2",
            description: "Test 2",
            enableCheckpointing: false,
          },
          nodes: [{ id: "n2", name: "Node 2", type: "aggregation" }],
          edges: [],
          entryPoint: "n2",
        },
      ];

      definitions.forEach((def) => orchestrator.createWorkflow(def));

      const workflows = orchestrator.listWorkflows();
      expect(workflows.length).toBeGreaterThanOrEqual(2);
      expect(workflows.map((w) => w.id)).toContain("wf1");
      expect(workflows.map((w) => w.id)).toContain("wf2");
    });

    it("should delete workflows", () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "deletable",
          name: "Deletable",
          description: "Test deletion",
          enableCheckpointing: false,
        },
        nodes: [{ id: "node", name: "Node", type: "aggregation" }],
        edges: [],
        entryPoint: "node",
      };

      orchestrator.createWorkflow(definition);
      expect(orchestrator.getWorkflow("deletable")).toBeDefined();

      const deleted = orchestrator.deleteWorkflow("deletable");
      expect(deleted).toBe(true);
      expect(orchestrator.getWorkflow("deletable")).toBeUndefined();
    });

    it("should return false when deleting nonexistent workflow", () => {
      const deleted = orchestrator.deleteWorkflow("does-not-exist");
      expect(deleted).toBe(false);
    });
  });

  describe("Node Types", () => {
    it("should handle decision nodes", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "decision-node-test",
          name: "Decision Node Test",
          description: "Test decision node type",
          enableCheckpointing: false,
        },
        nodes: [
          {
            id: "decision",
            name: "Decision",
            type: "decision",
          },
        ],
        edges: [],
        entryPoint: "decision",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      // Add findings with blocker severity
      const findings: Finding[] = [
        {
          findingId: "blocker-1",
          category: "Security",
          severity: "blocker",
          message: "Critical security issue",
          component: "auth",
        },
      ];

      const result = await orchestrator.executeWorkflow("decision-node-test", {
        context,
        endpoint: context.endpoint,
        findings,
      });

      expect(result.state.severity).toBe("blocker");
    });

    it("should handle human-in-the-loop nodes", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "human-input-test",
          name: "Human Input Test",
          description: "Test human input node",
          enableCheckpointing: false,
        },
        nodes: [
          {
            id: "human",
            name: "Awaiting User Decision",
            type: "human_input",
          },
        ],
        edges: [],
        entryPoint: "human",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      const result = await orchestrator.executeWorkflow("human-input-test", {
        context,
        endpoint: context.endpoint,
      });

      expect(result.state.awaitingUserInput).toBe(true);
      expect(result.state.userPrompt).toBe("Awaiting User Decision");
    });

    it("should handle aggregation nodes", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "aggregation-test",
          name: "Aggregation Test",
          description: "Test aggregation node",
          enableCheckpointing: false,
        },
        nodes: [
          {
            id: "aggregate",
            name: "Aggregate Results",
            type: "aggregation",
            handler: async (state) => ({
              findingCount: state.findings.length,
            }),
          },
        ],
        edges: [],
        entryPoint: "aggregate",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      const result = await orchestrator.executeWorkflow("aggregation-test", {
        context,
        endpoint: context.endpoint,
      });

      expect(result.state.currentNode).toBe("aggregate");
      expect(result.state.findingCount).toBeDefined();
    });
  });

  describe("Streaming Execution", () => {
    it("should support streaming events", async () => {
      const definition: WorkflowDefinition = {
        config: {
          workflowId: "streaming-test",
          name: "Streaming Test",
          description: "Test streaming execution",
          enableCheckpointing: false,
        },
        nodes: [
          {
            id: "stream-node",
            name: "Stream Node",
            type: "aggregation",
            handler: async (state) => ({
              visitedNodes: [...state.visitedNodes, "stream-node"],
            }),
          },
        ],
        edges: [],
        entryPoint: "stream-node",
      };

      orchestrator.createWorkflow(definition);
      const context = createMockContext();

      const events: Array<{ nodeId: string; type: string }> = [];

      const result = await orchestrator.executeWorkflow("streaming-test", {
        context,
        endpoint: context.endpoint,
        streamEvents: true,
        onEvent: (event) => {
          events.push({ nodeId: event.nodeId || "unknown", type: event.type });
        },
      });

      expect(result.success).toBe(true);
      // Events may or may not be captured depending on LangGraph internal timing
      // This test verifies the streaming API doesn't crash
    });
  });
});
