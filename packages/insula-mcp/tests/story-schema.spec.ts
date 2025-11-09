import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  StorySchema,
  type Story,
  STORY_FIELD_KEYS,
} from "../src/story/story-schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(repoRoot, "schemas/story.schema.yaml");

describe("story schema", () => {
  const baseStory: Story = {
    id: "story-local-latency",
    timestamp: "2025-11-08T12:00:00.000Z",
    scope: "tool",
    trigger: {
      kind: "latency",
      details: "Connector latency p95 jumped above 600ms",
    },
    propagation: {
      path: ["workspace", "connector", "tool"],
    },
    symptom: {
      user_visible: "Users see delayed responses from Insula tools",
      technical: "Connector rpc latency exceeded threshold",
    },
    evidence: {
      logs: ["logs://connector/latency"],
      traces: ["otel://trace/123"],
      metrics: ["metrics://connector/p95"],
    },
    confidence: 0.82,
    suggested_actions: [
      {
        id: "action-reprobe",
        label: "Run targeted reprobe",
        command: "insula-mcp story.reprobe --target connector",
        reversible: true,
      },
    ],
  };

  it("keeps yaml + zod in sync", async () => {
    const yamlDoc = YAML.parse(await readFile(schemaPath, "utf8"));
    expect(yamlDoc.type).toBe("object");
    const yamlFields = Object.keys(yamlDoc.properties ?? {});
    expect(yamlFields).toEqual(STORY_FIELD_KEYS);
  });

  it("accepts canonical story payloads", () => {
    const parsed = StorySchema.parse(baseStory);
    expect(parsed.confidence).toBeGreaterThan(0.8 - Number.EPSILON);
  });

  it("rejects invalid confidence or missing path", () => {
    expect(() =>
      StorySchema.parse({
        ...baseStory,
        confidence: 1.5,
      }),
    ).toThrowError();

    expect(() =>
      StorySchema.parse({
        ...baseStory,
        propagation: { path: [] },
      }),
    ).toThrowError();
  });
});
