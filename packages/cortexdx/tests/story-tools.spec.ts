import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeStoryAction } from "../src/actions/library.js";
import { STORY_FEATURE_FLAG } from "../src/story/feature-flag.js";
import { createDiagnosticTools } from "../src/tools/diagnostic-tools.js";

const originalFlag = process.env[STORY_FEATURE_FLAG];

beforeEach(() => {
  delete process.env[STORY_FEATURE_FLAG];
});

afterEach(() => {
  if (originalFlag) {
    process.env[STORY_FEATURE_FLAG] = originalFlag;
  } else {
    delete process.env[STORY_FEATURE_FLAG];
  }
});

describe("story MCP tools", () => {
  it("remain disabled by default", () => {
    const tools = createDiagnosticTools();
    expect(tools.find((tool) => tool.name === "story.list")).toBeUndefined();
  });

  it("register once the feature flag is enabled", () => {
    process.env[STORY_FEATURE_FLAG] = "true";
    const tools = createDiagnosticTools();
    const storyList = tools.find((tool) => tool.name === "story.list");
    expect(storyList).toBeDefined();

    const result = executeStoryAction("reprobe", "connector.edge");
    expect(result).toMatchObject({ dryRun: true, target: "connector.edge" });
  });
});
