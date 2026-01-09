import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const detectMocks = {
  hasOllama: vi.fn(),
  isOllamaReachable: vi.fn(),
};

vi.mock("../src/ml/detect.js", () => ({
  hasOllama: detectMocks.hasOllama,
  isOllamaReachable: detectMocks.isOllamaReachable,
}));

import { getEnhancedLlmAdapter, pickLocalLLM } from "../src/ml/router.js";

const ORIGINAL_ENV = { ...process.env };

describe("LLM router backends", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.keys(process.env).forEach((key) => {
      if (!(key in ORIGINAL_ENV)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, ORIGINAL_ENV);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("prefers local backend when available", async () => {
    detectMocks.hasOllama.mockReturnValue(true);
    detectMocks.isOllamaReachable.mockResolvedValue(true);
    process.env.CORTEXDX_LLM_PRIORITY = "local,cloud";

    const backend = await pickLocalLLM();
    expect(backend).toBe("ollama");
    expect(detectMocks.isOllamaReachable).toHaveBeenCalled();

    const adapter = await getEnhancedLlmAdapter();
    expect(adapter).not.toBeNull();
    expect(detectMocks.isOllamaReachable.mock.calls[0][0]).toBe(
      "http://127.0.0.1:11434",
    );
  });

  it("falls back to cloud when local disabled", async () => {
    detectMocks.hasOllama.mockReturnValue(false);
    detectMocks.isOllamaReachable.mockImplementation(async (url?: string) =>
      Boolean(url?.startsWith("https://cloud")),
    );

    process.env.CORTEXDX_ENABLE_LOCAL_LLM = "false";
    process.env.CORTEXDX_ENABLE_CLOUD_LLM = "true";
    process.env.CORTEXDX_LLM_PRIORITY = "local,cloud";
    process.env.CORTEXDX_CLOUD_OLLAMA_BASE_URL = "https://cloud-ollama";
    process.env.CORTEXDX_CLOUD_LLM_MODEL = "kimi-k2:1t";
    process.env.CORTEXDX_CLOUD_OLLAMA_API_KEY = "cloud-key";

    const backend = await pickLocalLLM();
    expect(backend).toBe("ollama");

    const adapter = await getEnhancedLlmAdapter();
    expect(adapter).not.toBeNull();
    expect(detectMocks.isOllamaReachable).toHaveBeenCalledWith(
      "https://cloud-ollama",
      "cloud-key",
    );
  });
});
