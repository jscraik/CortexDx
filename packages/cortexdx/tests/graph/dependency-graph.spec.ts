import { describe, expect, it } from "vitest";
import { buildDependencyGraph } from "../src/graph/dependency-graph.js";
import type {
  ManifestLike,
  ProbeInventory,
} from "../src/graph/dependency-graph.js";

describe("Dependency Graph - Critical Path Tests", () => {
  describe("buildDependencyGraph", () => {
    it("should create a basic graph with server node", () => {
      const graph = buildDependencyGraph();

      expect(graph).toBeDefined();
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0]).toEqual({
        id: "cortexdx",
        type: "server",
      });
      expect(graph.edges).toEqual([]);
    });

    it("should use custom server name from manifest", () => {
      const manifest: ManifestLike = {
        name: "my-mcp-server",
      };

      const graph = buildDependencyGraph(manifest);

      expect(graph.nodes[0].id).toBe("my-mcp-server");
      expect(graph.nodes[0].type).toBe("server");
    });

    it("should add tools from manifest", () => {
      const manifest: ManifestLike = {
        name: "test-server",
        tools: [
          { name: "tool1" },
          { name: "tool2", metadata: { description: "Test tool" } },
        ],
      };

      const graph = buildDependencyGraph(manifest);

      expect(graph.nodes).toHaveLength(3); // server + 2 tools

      const toolNodes = graph.nodes.filter((n) => n.type === "tool");
      expect(toolNodes).toHaveLength(2);
      expect(toolNodes.map((n) => n.id)).toContain("tool1");
      expect(toolNodes.map((n) => n.id)).toContain("tool2");
    });

    it("should create edges for tool dependencies", () => {
      const manifest: ManifestLike = {
        name: "test-server",
        tools: [{ name: "tool1" }, { name: "tool2", depends_on: ["tool1"] }],
      };

      const graph = buildDependencyGraph(manifest);

      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toEqual({
        from: "tool2",
        to: "tool1",
        relation: "depends_on",
      });
    });

    it("should handle circular dependencies without infinite loop", () => {
      const manifest: ManifestLike = {
        name: "test-server",
        tools: [
          { name: "toolA", depends_on: ["toolB"] },
          { name: "toolB", depends_on: ["toolA"] },
        ],
      };

      const graph = buildDependencyGraph(manifest);

      expect(graph.nodes).toHaveLength(3); // server + toolA + toolB
      expect(graph.edges).toHaveLength(2); // A->B and B->A

      // Verify both edges exist
      const edgeIds = graph.edges.map((e) => `${e.from}->${e.to}`);
      expect(edgeIds).toContain("toolA->toolB");
      expect(edgeIds).toContain("toolB->toolA");
    });

    it("should add connector nodes from manifest", () => {
      const manifest: ManifestLike = {
        name: "test-server",
        connectors: [{ id: "conn1", target: "external-api" }, { id: "conn2" }],
      };

      const graph = buildDependencyGraph(manifest);

      const connectorNodes = graph.nodes.filter((n) => n.type === "connector");
      expect(connectorNodes).toHaveLength(2);
      expect(connectorNodes.map((n) => n.id)).toContain("conn1");
      expect(connectorNodes.map((n) => n.id)).toContain("conn2");
    });

    it("should merge probe inventory with manifest", () => {
      const manifest: ManifestLike = {
        name: "test-server",
        tools: [{ name: "manifest-tool" }],
      };

      const probes: ProbeInventory = {
        targets: [{ id: "discovered-tool", type: "tool" }],
      };

      const graph = buildDependencyGraph(manifest, probes);

      expect(graph.nodes).toHaveLength(3); // server + manifest-tool + discovered-tool
      expect(graph.nodes.map((n) => n.id)).toContain("manifest-tool");
      expect(graph.nodes.map((n) => n.id)).toContain("discovered-tool");
    });

    it("should not duplicate nodes when same tool appears in manifest and probes", () => {
      const manifest: ManifestLike = {
        name: "test-server",
        tools: [{ name: "shared-tool" }],
      };

      const probes: ProbeInventory = {
        targets: [{ id: "shared-tool", type: "tool" }],
      };

      const graph = buildDependencyGraph(manifest, probes);

      expect(graph.nodes).toHaveLength(2); // server + shared-tool (not duplicated)
      const toolNodes = graph.nodes.filter((n) => n.type === "tool");
      expect(toolNodes).toHaveLength(1);
    });

    it("should handle multiple dependency relations", () => {
      const probes: ProbeInventory = {
        targets: [
          { id: "tool1", type: "tool" },
          { id: "tool2", type: "tool" },
        ],
        dependencies: [
          { from: "tool1", to: "tool2", relation: "depends_on" },
          { from: "tool1", to: "tool2", relation: "calls" },
        ],
      };

      const graph = buildDependencyGraph({}, probes);

      expect(graph.edges).toHaveLength(2);
      expect(
        graph.edges.some(
          (e) =>
            e.from === "tool1" &&
            e.to === "tool2" &&
            e.relation === "depends_on",
        ),
      ).toBe(true);
      expect(
        graph.edges.some(
          (e) =>
            e.from === "tool1" && e.to === "tool2" && e.relation === "calls",
        ),
      ).toBe(true);
    });

    it("should not duplicate edges", () => {
      const manifest: ManifestLike = {
        name: "test-server",
        tools: [{ name: "toolA", depends_on: ["toolB"] }, { name: "toolB" }],
      };

      const probes: ProbeInventory = {
        dependencies: [{ from: "toolA", to: "toolB", relation: "depends_on" }],
      };

      const graph = buildDependencyGraph(manifest, probes);

      // Should only have 1 edge, not 2 (no duplication)
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toEqual({
        from: "toolA",
        to: "toolB",
        relation: "depends_on",
      });
    });

    it("should preserve node metadata", () => {
      const manifest: ManifestLike = {
        tools: [
          {
            name: "complex-tool",
            metadata: {
              version: "1.0.0",
              author: "test",
              tags: ["important", "critical"],
            },
          },
        ],
      };

      const graph = buildDependencyGraph(manifest);

      const toolNode = graph.nodes.find((n) => n.id === "complex-tool");
      expect(toolNode).toBeDefined();
      expect(toolNode?.metadata).toEqual({
        version: "1.0.0",
        author: "test",
        tags: ["important", "critical"],
      });
    });

    it("should handle empty manifest and probes", () => {
      const graph = buildDependencyGraph({}, {});

      expect(graph.nodes).toHaveLength(1); // Just the default server node
      expect(graph.edges).toEqual([]);
    });

    it("should create service nodes from resources", () => {
      const manifest: ManifestLike = {
        name: "test-server",
        resources: [
          { name: "database" },
          { name: "cache", depends_on: ["database"] },
        ],
      };

      const graph = buildDependencyGraph(manifest);

      const serviceNodes = graph.nodes.filter((n) => n.type === "service");
      expect(serviceNodes).toHaveLength(2);
      expect(serviceNodes.map((n) => n.id)).toContain("database");
      expect(serviceNodes.map((n) => n.id)).toContain("cache");

      // Check dependency edge
      expect(
        graph.edges.some(
          (e) =>
            e.from === "cache" &&
            e.to === "database" &&
            e.relation === "depends_on",
        ),
      ).toBe(true);
    });
  });

  describe("Graph Validation", () => {
    it("should produce valid graph structure for complex scenarios", () => {
      const manifest: ManifestLike = {
        name: "production-server",
        tools: [
          { name: "userService", depends_on: ["database"] },
          { name: "authService", depends_on: ["database", "cache"] },
        ],
        connectors: [{ id: "apiGateway", target: "external" }],
        resources: [{ name: "database" }, { name: "cache" }],
      };

      const graph = buildDependencyGraph(manifest);

      // Validate structure
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);

      // All edges should reference existing nodes
      const nodeIds = new Set(graph.nodes.map((n) => n.id));
      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.from)).toBe(true);
        expect(nodeIds.has(edge.to)).toBe(true);
      }

      // Should have correct node types
      const hasServer = graph.nodes.some((n) => n.type === "server");
      const hasTools = graph.nodes.some((n) => n.type === "tool");
      const hasServices = graph.nodes.some((n) => n.type === "service");
      const hasConnectors = graph.nodes.some((n) => n.type === "connector");

      expect(hasServer).toBe(true);
      expect(hasTools).toBe(true);
      expect(hasServices).toBe(true);
      expect(hasConnectors).toBe(true);
    });
  });
});
