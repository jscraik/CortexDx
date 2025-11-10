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
