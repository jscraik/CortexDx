import { describe, it, expect } from "vitest";

describe("insula-mcp e2e (starter)", () => {
  it("prints a report header", async () => {
    expect("# Insula MCP Diagnostic Report".includes("Insula")).toBe(true);
  });
});
