import { describe, expect, it } from "vitest";
import {
  buildDependencyGraph,
  longestPath,
  type DepGraph,
} from "../src/graph/dependency-graph.js";
import {
  detectLatencySpike,
  detectFallbackEngaged,
  type Event,
} from "../src/anomaly/rules.js";
import { composeStory } from "../src/story/story-composer.js";
import { scoreConfidence } from "../src/story/confidence.js";

const manifest = {
  server: { name: "cortexdx-core" },
  tools: [{ name: "tool.analyze", depends_on: ["connector.edge"] }],
  connectors: [{ id: "connector.edge", target: "service.vector" }],
  resources: [{ name: "service.vector" }],
};

const probes = {
  dependencies: [
    { from: "cortexdx-core", to: "tool.analyze", relation: "calls" },
    { from: "tool.analyze", to: "connector.edge", relation: "depends_on" },
    { from: "connector.edge", to: "service.vector", relation: "streams" },
  ],
};

describe("dependency graph + story composer", () => {
  const graph: DepGraph = buildDependencyGraph(manifest, probes);

  it("captures manifest + probe relationships", () => {
    expect(graph.nodes.map((node) => node.id)).toContain("tool.analyze");
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "connector.edge", to: "service.vector" }),
      ]),
    );
    expect(longestPath(graph, "cortexdx-core").pop()).toBe("service.vector");
  });

  it("detects latency and fallback anomalies deterministically", () => {
    const latencyEvents = detectLatencySpike([220, 240, 680], 100, 3, {
      target: "connector.edge",
      now: Date.UTC(2025, 0, 1),
    });
    expect(latencyEvents).toHaveLength(1);

    const fallbackEvents = detectFallbackEngaged([true, true, true], 3, {
      target: "service.vector",
      now: Date.UTC(2025, 0, 2),
    });
    expect(fallbackEvents[0]?.meta).toMatchObject({ consecutive: 3 });
  });

  it("composes story payloads with scoped actions", () => {
    const [event] = detectLatencySpike([200, 210, 620], 100, 3, {
      target: "connector.edge",
      now: Date.UTC(2025, 0, 3),
    });
    if (!event) {
      throw new Error("expected a latency event for story composition test");
    }
    const story = composeStory(event, graph, {
      deterministicNow: Date.UTC(2025, 0, 3),
    });

    expect(story.trigger.kind).toBe("latency");
    expect(story.propagation.path).toEqual([
      "cortexdx-core",
      "tool.analyze",
      "connector.edge",
    ]);
    expect(story.suggested_actions[0]?.command).toContain("connector.edge");
    expect(story.scope).toBe("connector");
  });

  it("scores confidence based on evidence depth", () => {
    const event: Event = {
      kind: "errors",
      at: Date.UTC(2025, 0, 4),
      target: "tool.analyze",
      window: 3,
      meta: { delta: 0.4 },
    };

    const score = scoreConfidence(event, {
      pathLength: 4,
      evidence: {
        logs: ["logs://tool"],
        traces: ["otel://1"],
        metrics: ["metrics://1", "metrics://2"],
      },
    });

    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThanOrEqual(1);
  });
});
