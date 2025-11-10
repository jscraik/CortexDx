import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { createStoryCard } from "../src/web/story-card.js";
import { StorySchema } from "../src/story/story-schema.js";

const story = StorySchema.parse({
  id: "story-latency-edge",
  timestamp: "2025-11-08T05:00:00.000Z",
  scope: "connector",
  trigger: { kind: "latency", details: "Connector latency > 600ms" },
  propagation: { path: ["insula-core", "tool.analyze", "connector.edge"] },
  symptom: {
    user_visible: "Tool replies are delayed",
    technical: "Connector edge exceeded latency budget",
  },
  evidence: {
    logs: ["logs://connector"],
    traces: ["otel://abc"],
    metrics: ["metrics://latency"],
  },
  confidence: 0.82,
  suggested_actions: [
    {
      id: "action-reprobe-connector",
      label: "Run reprobe",
      command: "insula-mcp story.reprobe --target connector.edge",
      reversible: true,
    },
  ],
});

describe("story card UI stub", () => {
  it("creates aria-friendly markup", () => {
    const dom = new JSDOM("<main></main>");
    const card = createStoryCard(dom.window.document, story);
    dom.window.document.body.appendChild(card);

    expect(card.getAttribute("role")).toBe("article");
    expect(card.getAttribute("aria-keyshortcuts")).toContain("Enter");
    expect(card.querySelectorAll(".story-card__chip").length).toBe(3);
    expect(card.querySelector(".sr-only")?.textContent).toContain("Confidence");
  });
});
