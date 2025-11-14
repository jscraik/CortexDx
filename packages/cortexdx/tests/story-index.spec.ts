import { describe, expect, it } from "vitest";
import * as Story from "../src/story/index.js";

describe("story index barrel", () => {
  it("re-exports the expected helpers", () => {
    expect(typeof Story.composeStory).toBe("function");
    expect(typeof Story.scoreConfidence).toBe("function");
    expect(typeof Story.StoryService).toBe("function");
    expect(typeof Story.isStoryFeatureEnabled).toBe("function");
  });
});
