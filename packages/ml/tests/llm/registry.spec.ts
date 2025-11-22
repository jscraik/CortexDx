import { beforeEach, describe, expect, it, vi } from "vitest";
import { LLMPluginRegistry } from "../../src/llm/registry.js";
import { secureLogger } from "../../src/llm/secure-logger.js";
import type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderPlugin,
  ProviderResponse,
} from "../../src/llm/types.js";

function createPlugin(
  id: string,
  options: {
    supports?: boolean;
    text?: string;
    initialize?: () => Promise<void>;
    failGenerate?: boolean;
  } = {},
): LLMProviderPlugin {
  const supports = options.supports ?? true;
  const generateText = options.text ?? `${id}-response`;
  return {
    metadata: {
      id,
      displayName: `${id}-provider`,
    },
    supports: vi.fn(() => supports),
    initialize: options.initialize ? vi.fn(options.initialize) : undefined,
    generate: vi.fn(async (request: LLMGenerateRequest, _context: LLMPluginContext): Promise<ProviderResponse> => {
      if (options.failGenerate) {
        throw new Error("generation failed");
      }
      return {
        text: `${generateText}:${request.prompt}`,
        model: request.options?.model,
      };
    }),
  };
}

describe("LLMPluginRegistry", () => {
  const env: NodeJS.ProcessEnv = {};

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers available plugins and generates responses", async () => {
    const plugin = createPlugin("mock");
    const registry = new LLMPluginRegistry({ env, plugins: [plugin], logger: secureLogger });

    const { response, plugin: used } = await registry.generate({ prompt: "hello" });

    expect(response.text).toBe("mock-response:hello");
    expect(used.metadata.id).toBe("mock");
    expect(plugin.generate).toHaveBeenCalledTimes(1);
  });

  it("initializes only supporting plugins", async () => {
    const ready = createPlugin("ready", { initialize: async () => Promise.resolve() });
    const skipped = createPlugin("skipped", { supports: false, initialize: async () => Promise.resolve() });
    const registry = new LLMPluginRegistry({ env, plugins: [ready, skipped], logger: secureLogger });

    await registry.initializeAll();

    expect(ready.initialize).toHaveBeenCalledTimes(1);
    expect(skipped.initialize).toHaveBeenCalledTimes(0);
  });

  it("falls back to the first available provider when a preferred one is unavailable", async () => {
    const unavailable = createPlugin("first", { supports: false });
    const fallback = createPlugin("second");
    const registry = new LLMPluginRegistry({ env, plugins: [unavailable, fallback], logger: secureLogger });

    const resolved = await registry.resolve("first");

    expect(resolved?.plugin.metadata.id).toBe("second");
    expect(fallback.supports).toHaveBeenCalled();
  });
});

describe("secureLogger", () => {
  it("redacts sensitive metadata values", () => {
    secureLogger.info("Test", "Logging", { apiKey: "secret", nested: { token: "abcd" } });

    const [entry] = secureLogger.getRecentLogs(1);

    expect(entry.metadata).toEqual({ apiKey: "[REDACTED]", nested: { token: "[REDACTED]" } });
  });
});
