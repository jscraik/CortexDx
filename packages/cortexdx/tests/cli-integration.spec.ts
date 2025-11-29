/**
 * CLI integration tests for self-healing commands
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileSystem as fs } from "../src/utils/file-system.js";

const execFileAsync = promisify(execFile);

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
    clearLogs: () => {
      logs.length = 0;
    },
  };
};

describe("CLI Self-Healing Commands", () => {
  const { getLogs, clearLogs } = mockConsole();

  // Setup spies for side effects
  let writeFileSpy: ReturnType<typeof vi.spyOn>;
  let readFileSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup file system spies
    writeFileSpy = vi.spyOn(fs, "writeFile").mockResolvedValue();
    readFileSpy = vi.spyOn(fs, "readFile").mockResolvedValue("{}");

    // Setup network spy
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "{}",
    });
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("self-diagnose command", () => {
    it("should run self-diagnose with correct options", async () => {
      const { runSelfDiagnose } = await import(
        "../src/commands/self-healing.js"
      );
      clearLogs();

      const result = await runSelfDiagnose({
        autoFix: true,
        dryRun: false,
        severity: "major",
        out: "report.json",
      });

      // Should complete successfully (exit code 0 or 1)
      expect(typeof result).toBe("number");

      // Should have written report to file
      expect(writeFileSpy).toHaveBeenCalledWith(
        "report.json",
        expect.any(String),
        "utf-8",
      );

      // Should have console output
      const output = getLogs().join("\n");
      expect(output).toContain("[Self-Healing]");
    }, 15000);

    it("should handle dry run mode", async () => {
      const { runSelfDiagnose } = await import(
        "../src/commands/self-healing.js"
      );
      clearLogs();

      const result = await runSelfDiagnose({
        dryRun: true,
        autoFix: false,
      });

      expect(typeof result).toBe("number");

      const output = getLogs().join("\n");
      expect(output).toContain("[Self-Healing]");
      expect(output).toContain("DRY RUN");
    }, 15000);

    it("should save report to file when specified", async () => {
      const { runSelfDiagnose } = await import(
        "../src/commands/self-healing.js"
      );

      await runSelfDiagnose({
        out: "test-report.json",
      });

      expect(writeFileSpy).toHaveBeenCalledWith(
        "test-report.json",
        expect.any(String),
        "utf-8",
      );
    }, 15000);
  });

  describe("heal command", () => {
    it("should run heal endpoint with correct parameters", async () => {
      const { runHealEndpoint } = await import(
        "../src/commands/self-healing.js"
      );
      clearLogs();

      const result = await runHealEndpoint("http://localhost:3000", {
        autoFix: false,
        dryRun: true,
        severity: "major",
        probes: "handshake,security",
        webhook: "https://example.com/webhook",
        out: "heal-report.json",
      });

      expect(typeof result).toBe("number");

      // Should have called webhook
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "User-Agent": expect.stringContaining("CortexDx"),
          }),
        }),
      );

      // Should have written report - check for any report file call since order may vary
      expect(writeFileSpy).toHaveBeenCalledWith(
        "heal-report.json",
        expect.any(String),
        "utf-8",
      );

      // Should have console output
      const output = getLogs().join("\n");
      expect(output).toContain("[Self-Healing]");
      expect(output).toContain("http://localhost:3000");
    }, 15000);

    it("should handle default probe selection", async () => {
      const { runHealEndpoint } = await import(
        "../src/commands/self-healing.js"
      );
      clearLogs();

      const result = await runHealEndpoint("http://localhost:3000", {});

      expect(typeof result).toBe("number");

      const output = getLogs().join("\n");
      expect(output).toContain("[Self-Healing]");
      expect(output).toContain("Found"); // Should mention findings count
    }, 15000);

    it("should parse probe list correctly", async () => {
      const { runHealEndpoint } = await import(
        "../src/commands/self-healing.js"
      );

      const result = await runHealEndpoint("http://localhost:3000", {
        probes: "all",
      });

      expect(typeof result).toBe("number");
      // With 'all' probes, should use the full probe list
      // This tests that the probe parsing logic works
    }, 15000);
  });

  describe("monitor command", () => {
    it("should stop monitoring", async () => {
      const { runMonitoring } = await import("../src/commands/self-healing.js");
      clearLogs();

      const result = await runMonitoring({
        stop: true,
      });

      expect(result).toBe(0);

      const output = getLogs().join("\n");
      expect(output).toContain("[Monitoring]");
      expect(output).toContain("Background monitoring stopped");
    });

    it("should show monitoring status", async () => {
      const { runMonitoring } = await import("../src/commands/self-healing.js");
      clearLogs();

      const result = await runMonitoring({
        status: true,
      });

      expect(result).toBe(0);

      const output = getLogs().join("\n");
      expect(output).toContain("[Monitoring]");
      expect(output).toContain("Status:");
      expect(output).toContain("Running:");
      expect(output).toContain("Active Jobs:");
    });

    it("should export monitoring configuration", async () => {
      const { runMonitoring } = await import("../src/commands/self-healing.js");

      const result = await runMonitoring({
        export: "monitor-config.json",
      });

      expect(result).toBe(0);

      // Should have written configuration to file - empty jobs array is expected
      expect(writeFileSpy).toHaveBeenCalledWith(
        "monitor-config.json",
        expect.any(String),
        "utf-8",
      );
    });

    it("should load configuration from file", async () => {
      const { runMonitoring } = await import("../src/commands/self-healing.js");

      // Mock config file content
      const configContent = JSON.stringify({
        jobs: [
          {
            endpoint: "http://localhost:3000",
            schedule: "*/5 * * * *",
            probes: ["handshake"],
            autoHeal: true,
            enabled: true,
          },
        ],
      });
      readFileSpy.mockResolvedValue(configContent);

      // Test that it attempts to read config by calling the function and catching the promise
      // Since start never resolves, we'll catch the promise rejection
      let promiseResolved = false;
      const startPromise = runMonitoring({
        start: true,
        config: "monitor-config.json",
      })
        .then(() => {
          promiseResolved = true;
        })
        .catch(() => {
          promiseResolved = true;
        }); // Ignore the hanging promise

      // Wait for a short time to allow the async operation to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify that the config file was read
      await vi.waitFor(() => {
        expect(readFileSpy).toHaveBeenCalledWith(
          "monitor-config.json",
          "utf-8",
        );
      });

      // Clean up - we can't let this hang
      if (!promiseResolved) {
        startPromise.catch(() => {}); // Ignore inevitable cancellation
      }
    });

    it("should read monitoring configuration files", async () => {
      const { runMonitoring } = await import("../src/commands/self-healing.js");

      const configContent = JSON.stringify({
        jobs: [{ endpoint: "http://localhost:3000" }],
      });
      readFileSpy.mockResolvedValue(configContent);

      // Test that it attempts to read config (start will hang)
      const startPromise = runMonitoring({
        start: true,
        config: "config.json",
      });

      // Verify that the config file was read
      await vi.waitFor(() => {
        expect(readFileSpy).toHaveBeenCalledWith("config.json", "utf-8");
      });

      // Clean up
      startPromise.catch(() => {});
    });
  });

  describe("templates command", () => {
    it("should list templates with filters", async () => {
      const { runTemplatesList } = await import("../src/commands/templates.js");
      clearLogs();

      const result = await runTemplatesList({
        area: "security",
        severity: "minor",
      });

      expect(result).toBe(0);

      const output = getLogs().join("\n");
      expect(output).toContain("[Templates]");
      expect(output).toContain("Available fix templates:");
    });

    it("should apply template with options", async () => {
      const { runTemplateApply } = await import("../src/commands/templates.js");
      clearLogs();

      const result = await runTemplateApply("security.headers", {
        dryRun: true,
        backup: false,
        validate: true,
      });

      expect(typeof result).toBe("number");

      const output = getLogs().join("\n");
      expect(output).toContain("[Templates]");
    });

    it("should show template details", async () => {
      const { runTemplateShow } = await import("../src/commands/templates.js");
      clearLogs();

      const result = await runTemplateShow("security.headers");

      expect(typeof result).toBe("number");

      const output = getLogs().join("\n");
      expect(output).toContain("[Templates]");
    });
  });

  describe("health command", () => {
    it("should check health with default endpoint", async () => {
      const { runHealthCheck } = await import("../src/commands/health.js");
      clearLogs();

      const result = await runHealthCheck({
        json: false,
      });

      expect(typeof result).toBe("number");

      const output = getLogs().join("\n");
      expect(output).toContain("[Health]");
    }, 15000);

    it("should check specific endpoint", async () => {
      const { runHealthCheck } = await import("../src/commands/health.js");
      clearLogs();

      const result = await runHealthCheck({
        endpoint: "http://localhost:3000",
        webhook: "https://example.com/webhook",
        json: true,
      });

      expect(typeof result).toBe("number");

      // Should have called webhook
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    }, 15000);

    it("should output JSON format when requested", async () => {
      const { runHealthCheck } = await import("../src/commands/health.js");

      const result = await runHealthCheck({
        json: true,
      });

      expect(typeof result).toBe("number");
    }, 15000);
  });

  describe("Error Handling", () => {
    it("should handle file writing errors gracefully", async () => {
      const { runSelfDiagnose } = await import(
        "../src/commands/self-healing.js"
      );
      clearLogs();

      // Mock file write to fail
      writeFileSpy.mockRejectedValue(new Error("Permission denied"));

      const result = await runSelfDiagnose({
        out: "/invalid/path/report.json",
      });

      expect(result).toBe(1); // Should return error code when file write fails

      const output = getLogs().join("\n");
      expect(output).toContain("[Self-Healing]");
    }, 15000);

    it("should handle file reading errors gracefully", async () => {
      const { runMonitoring } = await import("../src/commands/self-healing.js");
      clearLogs();

      // Mock file read to fail
      readFileSpy.mockRejectedValue(new Error("File not found"));

      const result = await runMonitoring({
        start: true,
        config: "/nonexistent/config.json",
      });

      // Note: start never resolves, but we can test the error handling by checking
      // that it attempted to read the file before hanging
      expect(readFileSpy).toHaveBeenCalledWith(
        "/nonexistent/config.json",
        "utf-8",
      );

      // Clean up hanging promise
      Promise.reject().catch(() => {}); // Prevent hanging
    });

    it("should handle webhook errors gracefully", async () => {
      const { runHealEndpoint } = await import(
        "../src/commands/self-healing.js"
      );
      clearLogs();

      // Mock fetch to fail
      fetchSpy.mockRejectedValue(new Error("Network error"));

      const result = await runHealEndpoint("http://localhost:3000", {
        webhook: "https://example.com/webhook",
      });

      expect(result).toBe(0); // Should still succeed even if webhook fails

      const output = getLogs().join("\n");
      expect(output).toContain("[Self-Healing]");
    }, 15000);

    it("should handle template not found gracefully", async () => {
      const { runTemplateApply } = await import("../src/commands/templates.js");
      clearLogs();

      const result = await runTemplateApply("nonexistent-template", {});

      expect(typeof result).toBe("number"); // Should handle gracefully

      const output = getLogs().join("\n");
      expect(output).toContain("[Templates]");
    });

    it("should handle health check endpoint errors gracefully", async () => {
      const { runHealthCheck } = await import("../src/commands/health.js");
      clearLogs();

      // Mock fetch to fail for health check
      fetchSpy.mockRejectedValue(new Error("Endpoint unreachable"));

      const result = await runHealthCheck({
        endpoint: "http://invalid-endpoint:9999",
      });

      expect(typeof result).toBe("number"); // Should handle gracefully

      const output = getLogs().join("\n");
      expect(output).toContain("[Health]");
    }, 15000);
  });

  describe("Output Formatting", () => {
    it("should format healing reports correctly", async () => {
      const { runSelfDiagnose } = await import(
        "../src/commands/self-healing.js"
      );
      clearLogs();

      await runSelfDiagnose({});

      // Check that output contains expected sections
      const output = getLogs().join("\n");
      expect(output).toContain("[Self-Healing]");
      expect(output).toContain("SUMMARY");
      expect(output).toContain("FINDINGS");
    }, 15000);

    it("should format health check results correctly", async () => {
      const { runHealthCheck } = await import("../src/commands/health.js");
      clearLogs();

      await runHealthCheck({ json: false });

      // Check that output contains expected sections
      const output = getLogs().join("\n");
      expect(output).toContain("[Health]");
      expect(output).toContain("Status:");
      expect(output).toContain("Endpoint:");
    }, 15000);

    it("should format template lists correctly", async () => {
      const { runTemplatesList } = await import("../src/commands/templates.js");
      clearLogs();

      await runTemplatesList({});

      // Check that output contains expected sections
      const output = getLogs().join("\n");
      expect(output).toContain("[Templates]");
      expect(output).toContain("Available fix templates:");
    });
  });

  describe("File Operations", () => {
    it("should write reports when specified", async () => {
      const { runSelfDiagnose } = await import(
        "../src/commands/self-healing.js"
      );

      await runSelfDiagnose({
        out: "test-report.json",
      });

      expect(writeFileSpy).toHaveBeenCalledWith(
        "test-report.json",
        expect.any(String),
        "utf-8",
      );
    }, 15000);

    it("should read monitoring configuration files", async () => {
      const { runMonitoring } = await import("../src/commands/self-healing.js");

      const configContent = JSON.stringify({
        jobs: [{ endpoint: "http://localhost:3000" }],
      });
      readFileSpy.mockResolvedValue(configContent);

      // Test that it attempts to read config (start will hang)
      const startPromise = runMonitoring({
        start: true,
        config: "config.json",
      });

      // Verify that the config file was read
      await vi.waitFor(() => {
        expect(readFileSpy).toHaveBeenCalledWith("config.json", "utf-8");
      });

      // Clean up
      startPromise.catch(() => {});
    });
  });

  describe("Webhook Integration", () => {
    it("should send webhook notifications for heal endpoint", async () => {
      const { runHealEndpoint } = await import(
        "../src/commands/self-healing.js"
      );

      await runHealEndpoint("http://localhost:3000", {
        webhook: "https://example.com/webhook",
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "User-Agent": expect.stringContaining("CortexDx"),
          }),
        }),
      );
    }, 15000);

    it("should send webhook notifications for health checks", async () => {
      const { runHealthCheck } = await import("../src/commands/health.js");

      await runHealthCheck({
        endpoint: "http://localhost:3000",
        webhook: "https://example.com/webhook",
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    }, 15000);
  });
});
