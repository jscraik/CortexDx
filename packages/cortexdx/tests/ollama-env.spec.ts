import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  getCloudOllamaConfig,
  getDefaultOllamaBaseUrl,
  getDefaultOllamaModel,
  getLlmPrioritySource,
  getOllamaDeterministicSeed,
  getOllamaMaxRetries,
  getOllamaTemperature,
  getOllamaTimeoutMs,
} from "../src/ml/ollama-env.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("ollama env helpers", () => {
  it("falls back to defaults when env unset", () => {
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.LLM_MODEL;
    expect(getDefaultOllamaBaseUrl()).toBe(DEFAULT_OLLAMA_BASE_URL);
    expect(getDefaultOllamaModel()).toBe(DEFAULT_OLLAMA_MODEL);
  });

  it("prefers OLLAMA_BASE_URL and LLM_MODEL", () => {
    process.env.OLLAMA_BASE_URL = "http://10.0.0.5:9000";
    process.env.LLM_MODEL = "qwen2.5:7b";
    expect(getDefaultOllamaBaseUrl()).toBe("http://10.0.0.5:9000");
    expect(getDefaultOllamaModel()).toBe("qwen2.5:7b");
  });

  it("parses numeric overrides", () => {
    process.env.OLLAMA_TIMEOUT_MS = "45000";
    process.env.OLLAMA_MAX_RETRIES = "5";
    process.env.LLM_SEED = "42";
    process.env.LLM_TEMPERATURE = "0.2";

    expect(getOllamaTimeoutMs()).toBe(45000);
    expect(getOllamaMaxRetries()).toBe(5);
    expect(getOllamaDeterministicSeed()).toBe(42);
    expect(getOllamaTemperature()).toBeCloseTo(0.2);
  });

  it("derives priority source from LLM_PROVIDER", () => {
    delete process.env.CORTEXDX_LLM_PRIORITY;
    process.env.LLM_PROVIDER = "none";
    expect(getLlmPrioritySource()).toBe("none");
  });

  describe("cloud config", () => {
    it("returns null when no cloud overrides are set", () => {
      delete process.env.CORTEXDX_CLOUD_OLLAMA_BASE_URL;
      delete process.env.CORTEXDX_CLOUD_LLM_MODEL;
      delete process.env.CORTEXDX_CLOUD_OLLAMA_API_KEY;
      delete process.env.CORTEXDX_CLOUD_ENV_FILE;
      expect(getCloudOllamaConfig()).toBeNull();
    });

    it("prefers process env overrides for cloud config", () => {
      process.env.CORTEXDX_CLOUD_OLLAMA_BASE_URL = "https://cloud-ollama";
      process.env.CORTEXDX_CLOUD_LLM_MODEL = "kimi-k2:1t";
      process.env.CORTEXDX_CLOUD_OLLAMA_API_KEY = "cloud-key";

      const config = getCloudOllamaConfig();
      expect(config).not.toBeNull();
      expect(config).toEqual(
        expect.objectContaining({
          baseUrl: "https://cloud-ollama",
          model: "kimi-k2:1t",
          apiKey: "cloud-key",
          source: "env",
        }),
      );
    });

    it("parses .env.cloud files when path is provided", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "cortexdx-cloud-env-"));
      const tempFile = join(tempDir, ".env.cloud");
      writeFileSync(
        tempFile,
        "LLM_MODEL=remote-model\nOLLAMA_BASE_URL=https://remote-ollama\nOLLAMA_API_KEY=file-key\n",
        "utf8",
      );

      delete process.env.CORTEXDX_CLOUD_OLLAMA_BASE_URL;
      delete process.env.CORTEXDX_CLOUD_LLM_MODEL;
      delete process.env.CORTEXDX_CLOUD_OLLAMA_API_KEY;
      process.env.CORTEXDX_CLOUD_ENV_FILE = tempFile;

      const config = getCloudOllamaConfig();
      expect(config).not.toBeNull();
      expect(config).toEqual(
        expect.objectContaining({
          baseUrl: "https://remote-ollama",
          model: "remote-model",
          apiKey: "file-key",
          source: "file",
        }),
      );

      delete process.env.CORTEXDX_CLOUD_ENV_FILE;
      rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
