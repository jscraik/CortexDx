import { describe, expect, it } from "vitest";
import { StoryService } from "../src/story/story-service.js";

const manifest = {
  server: { name: "cortexdx-core" },
  tools: [{ name: "tool.analyze", depends_on: ["connector.edge"] }],
  connectors: [{ id: "connector.edge", target: "service.vector" }],
};

const probes = {
  dependencies: [
    { from: "tool.analyze", to: "connector.edge", relation: "depends_on" },
    { from: "connector.edge", to: "service.vector", relation: "streams" },
  ],
};

describe("StoryService", () => {
  const service = new StoryService(manifest, probes);

  it("creates stories when signals are provided", () => {
    const stories = service.generateStories({
      latency: { p95: [210, 230, 640], target: "connector.edge" },
      now: Date.UTC(2025, 0, 5),
    });

    expect(stories).toHaveLength(1);
    expect(stories[0]?.trigger.kind).toBe("latency");
  });

  it("emits error, health, and fallback triggers", () => {
    const stories = service.generateStories({
      errors: {
        buckets: [
          { 200: 90, 500: 10 },
          { 200: 40, 500: 60 },
        ],
        pct: 10,
        target: "tool.analyze",
      },
      health: {
        downtime: [5, 60],
        thresholdSec: 30,
        target: "connector.edge",
      },
      fallback: {
        flags: [true, true, true],
        minutes: 3,
        target: "service.vector",
      },
      now: Date.UTC(2025, 0, 7),
    });

    const kinds = stories.map((story) => story.trigger.kind);
    expect(kinds).toContain("errors");
    expect(kinds).toContain("health");
    expect(kinds).toContain("fallback");
  });

  it("returns no stories when no signals supplied", () => {
    expect(service.generateStories()).toHaveLength(0);
  });

  it("locates individual stories by id", () => {
    const stories = service.generateStories({
      latency: { p95: [210, 230, 640], target: "connector.edge" },
      now: Date.UTC(2025, 0, 6),
    });
    const story = service.getStoryById(stories[0]!.id, {
      latency: { p95: [210, 230, 640], target: "connector.edge" },
      now: Date.UTC(2025, 0, 6),
    });

    expect(story?.id).toBe(stories[0]?.id);
  });
});
