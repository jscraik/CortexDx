/**
 * py-spy Adapter for Python Performance Profiling
 *
 * Integrates py-spy for Python process profiling including CPU profiling,
 * flame graph generation, and subprocess profiling support.
 */

import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Finding } from "@brainwav/cortexdx-core";

export interface PySpyProfile {
  outputPath: string;
  format: "flamegraph" | "speedscope" | "raw";
  duration: number;
  pid?: number;
  command?: string;
}

export interface PySpyFlameGraphData {
  samples: number;
  duration: number;
  hotspots: Array<{
    function: string;
    module: string;
    line: number;
    selfTime: number;
    totalTime: number;
    percentage: number;
  }>;
}

export interface PySpyOptions {
  duration?: number;
  rate?: number;
  format?: "flamegraph" | "speedscope" | "raw";
  subprocesses?: boolean;
  native?: boolean;
  gil?: boolean;
  idle?: boolean;
}

/**
 * py-spy Adapter for profiling Python MCP servers
 */
export class PySpyAdapter {
  private workDir: string;

  constructor(workDir?: string) {
    this.workDir = workDir ?? join(tmpdir(), "cortexdx-pyspy-profiles");
  }

  /**
   * Initialize the working directory for py-spy profiles
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.workDir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to initialize py-spy work directory: ${String(error)}`,
      );
    }
  }

  /**
   * Check if py-spy is installed and available
   */
  async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn("py-spy", ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.on("error", () => {
        resolve(false);
      });

      child.on("exit", (code) => {
        resolve(code === 0);
      });

      // Timeout after 2 seconds
      setTimeout(() => {
        child.kill("SIGTERM");
        resolve(false);
      }, 2000);
    });
  }

  /**
   * Profile a running Python process by PID
   */
  async profileByPid(
    pid: number,
    options: PySpyOptions = {},
  ): Promise<PySpyProfile> {
    const startTime = Date.now();
    const duration = options.duration ?? 10;
    const rate = options.rate ?? 100;
    const format = options.format ?? "flamegraph";
    const outputFile = join(
      this.workDir,
      `pyspy-pid-${pid}-${Date.now()}.${this.getFileExtension(format)}`,
    );

    try {
      await this.runPySpy([
        "record",
        "--pid",
        String(pid),
        "--duration",
        String(duration),
        "--rate",
        String(rate),
        "--format",
        format,
        "--output",
        outputFile,
        ...(options.subprocesses ? ["--subprocesses"] : []),
        ...(options.native ? ["--native"] : []),
        ...(options.gil ? ["--gil"] : []),
        ...(options.idle ? ["--idle"] : []),
      ]);

      const profile: PySpyProfile = {
        outputPath: outputFile,
        format,
        duration: Date.now() - startTime,
        pid,
      };

      return profile;
    } catch (error) {
      throw new Error(`py-spy profiling by PID failed: ${String(error)}`);
    }
  }

  /**
   * Profile a Python command
   */
  async profileCommand(
    command: string,
    args: string[] = [],
    options: PySpyOptions = {},
  ): Promise<PySpyProfile> {
    const startTime = Date.now();
    const duration = options.duration ?? 10;
    const rate = options.rate ?? 100;
    const format = options.format ?? "flamegraph";
    const outputFile = join(
      this.workDir,
      `pyspy-cmd-${Date.now()}.${this.getFileExtension(format)}`,
    );

    try {
      await this.runPySpy([
        "record",
        "--rate",
        String(rate),
        "--format",
        format,
        "--output",
        outputFile,
        ...(options.subprocesses ? ["--subprocesses"] : []),
        ...(options.native ? ["--native"] : []),
        ...(options.gil ? ["--gil"] : []),
        ...(options.idle ? ["--idle"] : []),
        "--",
        command,
        ...args,
      ]);

      const profile: PySpyProfile = {
        outputPath: outputFile,
        format,
        duration: Date.now() - startTime,
        command: `${command} ${args.join(" ")}`,
      };

      return profile;
    } catch (error) {
      throw new Error(`py-spy profiling by command failed: ${String(error)}`);
    }
  }

  /**
   * Generate a flame graph from a running Python process
   */
  async generateFlameGraph(
    pid: number,
    duration = 10,
    options: Omit<PySpyOptions, "duration" | "format"> = {},
  ): Promise<PySpyProfile> {
    return this.profileByPid(pid, {
      ...options,
      duration,
      format: "flamegraph",
    });
  }

  /**
   * Generate a speedscope profile from a running Python process
   */
  async generateSpeedscopeProfile(
    pid: number,
    duration = 10,
    options: Omit<PySpyOptions, "duration" | "format"> = {},
  ): Promise<PySpyProfile> {
    return this.profileByPid(pid, {
      ...options,
      duration,
      format: "speedscope",
    });
  }

  /**
   * Profile with subprocess support
   */
  async profileWithSubprocesses(
    pid: number,
    duration = 10,
  ): Promise<PySpyProfile> {
    return this.profileByPid(pid, {
      duration,
      format: "flamegraph",
      subprocesses: true,
    });
  }

  /**
   * Run py-spy command
   */
  private async runPySpy(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn("py-spy", args, {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: this.workDir,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (error) => {
        reject(new Error(`Failed to spawn py-spy: ${error.message}`));
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`py-spy exited with code ${code}\nStderr: ${stderr}`),
          );
        }
      });

      // Timeout after 60 seconds (longer than Clinic.js due to profiling duration)
      setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("py-spy timed out after 60 seconds"));
      }, 60000);
    });
  }

  /**
   * Get file extension for format
   */
  private getFileExtension(format: string): string {
    switch (format) {
      case "flamegraph":
        return "svg";
      case "speedscope":
        return "json";
      case "raw":
        return "txt";
      default:
        return "txt";
    }
  }

  /**
   * Parse flame graph and generate findings
   */
  async parseFlameGraphResults(profile: PySpyProfile): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      findings.push({
        id: "pyspy.flamegraph.completed",
        area: "performance-profiling",
        severity: "info",
        title: "py-spy flame graph generation completed",
        description: `Python CPU profiling completed in ${profile.duration}ms`,
        evidence: [{ type: "file", ref: profile.outputPath }],
        confidence: 1.0,
        recommendation:
          "Review the generated flame graph to identify CPU hotspots in Python code",
      });

      // Check if profiling took too long
      if (profile.duration > 15000) {
        findings.push({
          id: "pyspy.flamegraph.slow",
          area: "performance-profiling",
          severity: "minor",
          title: "py-spy profiling took longer than expected",
          description: `Profiling duration: ${profile.duration}ms (expected <15s)`,
          evidence: [{ type: "file", ref: profile.outputPath }],
          confidence: 0.8,
        });
      }

      // Try to read and analyze the flame graph if it's SVG
      if (profile.format === "flamegraph") {
        try {
          const svgContent = await readFile(profile.outputPath, "utf-8");

          // Basic analysis of flame graph content
          if (svgContent.includes("samples")) {
            findings.push({
              id: "pyspy.flamegraph.samples",
              area: "performance-profiling",
              severity: "info",
              title: "Flame graph contains profiling samples",
              description:
                "Successfully captured Python execution samples for analysis",
              evidence: [{ type: "file", ref: profile.outputPath }],
              confidence: 0.95,
            });
          }
        } catch {
          // Ignore read errors
        }
      }
    } catch (error) {
      findings.push({
        id: "pyspy.flamegraph.parse_error",
        area: "performance-profiling",
        severity: "major",
        title: "Failed to parse py-spy flame graph results",
        description: `Parse error: ${String(error)}`,
        evidence: [{ type: "log", ref: "PySpyAdapter.parseFlameGraphResults" }],
        confidence: 0.9,
      });
    }

    return findings;
  }

  /**
   * Parse speedscope profile and generate findings
   */
  async parseSpeedscopeResults(profile: PySpyProfile): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      findings.push({
        id: "pyspy.speedscope.completed",
        area: "performance-profiling",
        severity: "info",
        title: "py-spy speedscope profile generation completed",
        description: `Python profiling completed in ${profile.duration}ms`,
        evidence: [{ type: "file", ref: profile.outputPath }],
        confidence: 1.0,
        recommendation:
          "Open the speedscope JSON file at https://www.speedscope.app/ for interactive analysis",
      });

      // Try to read and analyze the speedscope JSON
      if (profile.format === "speedscope") {
        try {
          const jsonContent = await readFile(profile.outputPath, "utf-8");
          const data = safeParseJson<{ profiles?: unknown[] }>(
            jsonContent,
            "py-spy speedscope profile",
          );

          if (data.profiles && Array.isArray(data.profiles)) {
            findings.push({
              id: "pyspy.speedscope.profiles",
              area: "performance-profiling",
              severity: "info",
              title: `Speedscope profile contains ${data.profiles.length} profile(s)`,
              description:
                "Successfully captured Python execution profile data",
              evidence: [{ type: "file", ref: profile.outputPath }],
              confidence: 0.95,
            });
          }
        } catch {
          // Ignore parse errors
        }
      }
    } catch (error) {
      findings.push({
        id: "pyspy.speedscope.parse_error",
        area: "performance-profiling",
        severity: "major",
        title: "Failed to parse py-spy speedscope results",
        description: `Parse error: ${String(error)}`,
        evidence: [{ type: "log", ref: "PySpyAdapter.parseSpeedscopeResults" }],
        confidence: 0.9,
      });
    }

    return findings;
  }

  /**
   * Clean up profile files
   */
  async cleanup(profile: PySpyProfile): Promise<void> {
    try {
      await rm(profile.outputPath, { force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Clean up all profile files
   */
  async cleanupAll(): Promise<void> {
    try {
      await rm(this.workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
