import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileSystem as fs } from "../src/utils/file-system.js";

// Mock console methods to capture output
const mockConsole = () => {
  const logs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  beforeEach(() => {
    console.log = vi.fn((...args) => {
      logs.push(args.join(" "));
    });
    console.error = vi.fn((...args) => {
      logs.push(args.join(" "));
    });
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    logs.length = 0;
  });

  return {
    getLogs: () => logs,
  };
};

describe("Monitoring Config Loading", () => {
  mockConsole();
  let readFileSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    readFileSpy = vi.spyOn(fs, "readFile").mockResolvedValue("{}");
    // We also need to mock createDevelopmentContext internals if they fail,
    // but the original test just mocked fs and fetch.
    // Let's rely on the environment being similar.
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should wait for config file to be read before proceeding", async () => {
    const { runMonitoring } = await import("../src/commands/self-healing.js");

    const configContent = JSON.stringify({
      jobs: [{ endpoint: "http://localhost:3000" }],
    });
    readFileSpy.mockResolvedValue(configContent);

    // Run monitoring with start: true (which hangs)
    const startPromise = runMonitoring({
      start: true,
      config: "new-test-config.json",
    });

    // Verify that we can wait for the read to happen
    await vi.waitFor(() => {
      expect(readFileSpy).toHaveBeenCalledWith("new-test-config.json", "utf-8");
    });

    // Cleanup
    startPromise.catch(() => {});
  });
});
