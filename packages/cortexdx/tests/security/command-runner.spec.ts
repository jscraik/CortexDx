import { describe, expect, it } from "vitest";
import { defaultCommandRunner } from "../../src/security/command-runner.js";

describe("Security - Command Runner", () => {
  describe("Basic Functionality", () => {
    it("should execute simple commands and return output", async () => {
      const result = await defaultCommandRunner("echo", ["hello"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("hello");
      expect(result.stderr).toBe("");
    });

    it("should capture stderr separately from stdout", async () => {
      const result = await defaultCommandRunner("sh", [
        "-c",
        "echo stdout; echo stderr >&2",
      ]);

      expect(result.stdout).toContain("stdout");
      expect(result.stderr).toContain("stderr");
    });

    it("should return non-zero exit codes", async () => {
      const result = await defaultCommandRunner("sh", ["-c", "exit 42"]);

      expect(result.exitCode).toBe(42);
    });

    it("should handle non-existent commands", async () => {
      await expect(async () => {
        await defaultCommandRunner("nonexistentcommand12345", []);
      }).rejects.toThrow();
    });
  });

  describe("Timeout Handling", () => {
    it("should enforce timeout on long-running commands", async () => {
      const startTime = Date.now();

      await expect(async () => {
        await defaultCommandRunner("sleep", ["10"], { timeoutMs: 100 });
      }).rejects.toThrow("Command timed out after 100ms");

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should timeout quickly
    });
  });

  describe("Environment Variables", () => {
    it("should pass environment variables to commands", async () => {
      const result = await defaultCommandRunner(
        "sh",
        ["-c", "echo $TEST_VAR"],
        {
          env: { ...process.env, TEST_VAR: "test-value" },
        },
      );

      expect(result.stdout).toContain("test-value");
    });
  });

  describe("Working Directory", () => {
    it("should use specified working directory", async () => {
      const result = await defaultCommandRunner("pwd", [], { cwd: "/tmp" });

      expect(result.stdout.trim()).toBe("/tmp");
    });
  });
});
