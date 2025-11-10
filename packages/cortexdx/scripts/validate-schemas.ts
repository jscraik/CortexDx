import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  StorySchema,
  STORY_FIELD_KEYS,
  STORY_SCOPE_VALUES,
  STORY_TRIGGER_VALUES,
  type Story,
} from "../src/story/story-schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaDir = path.resolve(__dirname, "../schemas");

function assertListEquals(label: string, actual: string[], expected: readonly string[]) {
  if (actual.length !== expected.length) {
    throw new Error(`${label} length mismatch: got ${actual.length}, expected ${expected.length}`);
  }

  actual.forEach((value, index) => {
    if (value !== expected[index]) {
      throw new Error(`${label} mismatch at index ${index}: got ${value}, expected ${expected[index]}`);
    }
  });
}

async function validateStorySchema() {
  const raw = await readFile(path.join(schemaDir, "story.schema.yaml"), "utf8");
  const parsed = YAML.parse(raw);

  if (!parsed?.properties) {
    throw new Error("story.schema.yaml missing top-level properties");
  }

  const propertyKeys = Object.keys(parsed.properties);
  assertListEquals("story properties", propertyKeys, STORY_FIELD_KEYS);

  const requiredKeys = parsed.required as string[];
  assertListEquals("story required", requiredKeys, STORY_FIELD_KEYS);

  const scopeEnum = parsed.properties.scope?.enum as string[];
  assertListEquals("scope enum", scopeEnum, STORY_SCOPE_VALUES);

  const triggerEnum = parsed.properties.trigger?.properties?.kind?.enum as string[];
  assertListEquals("trigger enum", triggerEnum, STORY_TRIGGER_VALUES);

  const sample: Story = {
    id: "story-validation",
    timestamp: new Date().toISOString(),
    scope: "server",
    trigger: { kind: "deploy", details: "Validation stub" },
    propagation: { path: ["origin", "server"] },
    symptom: {
      user_visible: "Users notice delays",
      technical: "Validation path stub",
    },
    evidence: {
      logs: ["logs://dummy"],
      traces: ["otel://trace"],
      metrics: ["metrics://series"],
    },
    confidence: 0.5,
    suggested_actions: [
      {
        id: "action-validate",
        label: "Dry-run reprobe",
        command: "cortexdx story.reprobe --target origin",
        reversible: true,
      },
    ],
  };

  StorySchema.parse(sample);
}

async function main() {
  await validateStorySchema();
  console.log("✅ story schema validated");
}

void main().catch((error) => {
  console.error("Schema validation failed:", error);
  process.exitCode = 1;
});
