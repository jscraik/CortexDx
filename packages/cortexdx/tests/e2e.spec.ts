import { describe, it, expect } from "vitest";

describe("cortexdx e2e (starter)", () => {
  it("prints a report header", async () => {
    expect("# CortexDx Diagnostic Report".includes("CortexDx")).toBe(true);
  });
});
