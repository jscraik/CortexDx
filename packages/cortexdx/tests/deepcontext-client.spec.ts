import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveDeepContextApiKey } from "../src/deepcontext/client.js";

const ENV_KEYS = [
  "WILDCARD_API_KEY",
  "DEEPCONTEXT_API_KEY",
  "DEEPCONTEXT_API_TOKEN",
  "DEEPCONTEXT_TOKEN",
] as const;

const originalEnv: Record<string, string | undefined> = {};

describe("resolveDeepContextApiKey", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      if (!(key in originalEnv)) {
        originalEnv[key] = process.env[key];
      }
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("prefers explicit argument", () => {
    process.env.WILDCARD_API_KEY = "ignored";
    expect(resolveDeepContextApiKey("  override ")).toBe("override");
  });

  it("uses WILDCARD_API_KEY when present", () => {
    process.env.WILDCARD_API_KEY = "wild";
    expect(resolveDeepContextApiKey()).toBe("wild");
  });

  it("falls back to DEEPCONTEXT_API_KEY", () => {
    process.env.DEEPCONTEXT_API_KEY = "deep";
    expect(resolveDeepContextApiKey()).toBe("deep");
  });

  it("checks additional aliases", () => {
    process.env.DEEPCONTEXT_API_TOKEN = "token";
    expect(resolveDeepContextApiKey()).toBe("token");
    delete process.env.DEEPCONTEXT_API_TOKEN;
    process.env.DEEPCONTEXT_TOKEN = "alt";
    expect(resolveDeepContextApiKey()).toBe("alt");
  });

  it("returns undefined when nothing is set", () => {
    expect(resolveDeepContextApiKey()).toBeUndefined();
  });
});
