import { describe, it, expect } from "vitest";

describe("Self-improvement CLI runner helper", () => {
  it("exports a reusable runner function", async () => {
    const module = await import("../src/self-improvement/runner.js");
    expect(typeof module.runSelfImprovementCli).toBe("function");
  });
});
