import { describe, it, expect } from "vitest";

describe.skip("LLM performance manual suite", () => {
  it("is executed only when INSULA_ENABLE_LOCAL_LLM is true", () => {
    expect(process.env.INSULA_ENABLE_LOCAL_LLM).toBe("true");
  });
});
