/**
 * Clinic.js Adapter for Node.js Performance Profiling
 *
 * Integrates Clinic.js suite (Doctor, Flame, Bubbleprof) for comprehensive
 * Node.js performance analysis including event-loop monitoring, CPU profiling,
 * and async operation analysis.
 */

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Finding } from "@brainwav/cortexdx-core";

export interface ClinicProfile {
  tool: "doctor" | "flame" | "bubbleprof";
  outputPath: string;
  htmlReport?: string;
  jsonData?: unknown;
  duration: number;
}

export interface ClinicDoctorResult {
  eventLoopDelay: {
    mean: number;
    max: number;
    p99: number;
  };
  cpuUsage: {
    mean: number;
    max: number;
  };
  memoryUsage: {
    mean: number;
    max: number;
  };
  activeHandles: number;
  recommendations: string[];
}

export interface ClinicFlameResult {
  hotspots: Array<{
    function: string;
    file: string;
    line: number;
    selfTime: number;
    totalTime: number;
    percentage: number;
  }>;
  totalSamples: number;
  duration: number;
}

export interface ClinicBubbleprofResult {
  asyncOperations: Array<{
    type: string;
    count: number;
    avgDuration: number;
    maxDuration: number;
  }>;
  asyncBottlenecks: Array<{
    operation: string;
    delay: number;
    impact: "high" | "medium" | "low";
  }>;
}

/**
 * Clinic.js Adapter for profiling Node.js MCP servers
 */
export class ClinicAdapter {
  private workDir: string;

  constructor(workDir?: string) {
    this.workDir = workDir ?? join(tmpdir(), "cortexdx-clinic-profiles");
  }

  /**
   * Initialize the working directory for Clinic.js profiles
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.workDir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to initialize Clinic.js work directory: ${String(error)}`,
      );
    }
  }

  /**
   * Run Clinic Doctor to analyze event-loop health
   *
   * Clinic Doctor monitors event-loop delay, CPU usage, memory usage,
   * and active handles to identify performance issues.
   */
  async runDoctor(
    scriptPath: string,
    args: string[] = [],
    duration = 10000,
  ): Promise<ClinicProfile> {
    const startTime = Date.now();
    const outputDir = join(this.workDir, `doctor-${Date.now()}`);

    try {
      await mkdir(outputDir, { recursive: true });

      // Create a wrapper script that runs for the specified duration
      const wrapperScript = join(outputDir, "wrapper.js");
      const wrapperContent = `
        const { spawn } = require('child_process');
        const child = spawn('node', ${JSON.stringify([scriptPath, ...args])}, {
          stdio: 'inherit'
        });
        
        setTimeout(() => {
          child.kill('SIGTERM');
          process.exit(0);
        }, ${duration});
        
        child.on('exit', () => process.exit(0));
      `;
      await writeFile(wrapperScript, wrapperContent);

      // Run Clinic Doctor
      await this.runClinicTool("doctor", wrapperScript, [], outputDir);

      const profile: ClinicProfile = {
        tool: "doctor",
        outputPath: outputDir,
        duration: Date.now() - startTime,
      };

      return profile;
    } catch (error) {
      throw new Error(`Clinic Doctor profiling failed: ${String(error)}`);
    }
  }

  /**
   * Run Clinic Flame for CPU profiling
   *
   * Clinic Flame generates flame graphs showing CPU hotspots
   * and function call hierarchies.
   */
  async runFlame(
    scriptPath: string,
    args: string[] = [],
    duration = 10000,
  ): Promise<ClinicProfile> {
    const startTime = Date.now();
    const outputDir = join(this.workDir, `flame-${Date.now()}`);

    try {
      await mkdir(outputDir, { recursive: true });

      // Create a wrapper script that runs for the specified duration
      const wrapperScript = join(outputDir, "wrapper.js");
      const wrapperContent = `
        const { spawn } = require('child_process');
        const child = spawn('node', ${JSON.stringify([scriptPath, ...args])}, {
          stdio: 'inherit'
        });
        
        setTimeout(() => {
          child.kill('SIGTERM');
          process.exit(0);
        }, ${duration});
        
        child.on('exit', () => process.exit(0));
      `;
      await writeFile(wrapperScript, wrapperContent);

      // Run Clinic Flame
      await this.runClinicTool("flame", wrapperScript, [], outputDir);

      const profile: ClinicProfile = {
        tool: "flame",
        outputPath: outputDir,
        duration: Date.now() - startTime,
      };

      return profile;
    } catch (error) {
      throw new Error(`Clinic Flame profiling failed: ${String(error)}`);
    }
  }

  /**
   * Run Clinic Bubbleprof for async operation analysis
   *
   * Clinic Bubbleprof visualizes async operations and identifies
   * async bottlenecks in the application.
   */
  async runBubbleprof(
    scriptPath: string,
    args: string[] = [],
    duration = 10000,
  ): Promise<ClinicProfile> {
    const startTime = Date.now();
    const outputDir = join(this.workDir, `bubbleprof-${Date.now()}`);

    try {
      await mkdir(outputDir, { recursive: true });

      // Create a wrapper script that runs for the specified duration
      const wrapperScript = join(outputDir, "wrapper.js");
      const wrapperContent = `
        const { spawn } = require('child_process');
        const child = spawn('node', ${JSON.stringify([scriptPath, ...args])}, {
          stdio: 'inherit'
        });
        
        setTimeout(() => {
          child.kill('SIGTERM');
          process.exit(0);
        }, ${duration});
        
        child.on('exit', () => process.exit(0));
      `;
      await writeFile(wrapperScript, wrapperContent);

      // Run Clinic Bubbleprof
      await this.runClinicTool("bubbleprof", wrapperScript, [], outputDir);

      const profile: ClinicProfile = {
        tool: "bubbleprof",
        outputPath: outputDir,
        duration: Date.now() - startTime,
      };

      return profile;
    } catch (error) {
      throw new Error(`Clinic Bubbleprof profiling failed: ${String(error)}`);
    }
  }

  /**
   * Run a Clinic.js tool
   */
  private async runClinicTool(
    tool: "doctor" | "flame" | "bubbleprof",
    scriptPath: string,
    args: string[],
    outputDir: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const clinicArgs = [tool, "--dest", outputDir, "--", scriptPath, ...args];

      const child = spawn("clinic", clinicArgs, {
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
        reject(new Error(`Failed to spawn clinic ${tool}: ${error.message}`));
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `Clinic ${tool} exited with code ${code}\nStderr: ${stderr}`,
            ),
          );
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Clinic ${tool} timed out after 30 seconds`));
      }, 30000);
    });
  }

  /**
   * Parse Clinic Doctor results and generate findings
   */
  async parseDoctorResults(profile: ClinicProfile): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Clinic Doctor generates HTML reports with embedded data
      // For now, we'll generate findings based on the profile existence
      findings.push({
        id: "clinic.doctor.completed",
        area: "performance-profiling",
        severity: "info",
        title: "Clinic Doctor profiling completed",
        description: `Event-loop health analysis completed in ${profile.duration}ms`,
        evidence: [{ type: "file", ref: profile.outputPath }],
        confidence: 1.0,
        recommendation:
          "Review the generated HTML report for detailed event-loop analysis",
      });

      // Check if profiling took too long
      if (profile.duration > 15000) {
        findings.push({
          id: "clinic.doctor.slow",
          area: "performance-profiling",
          severity: "minor",
          title: "Clinic Doctor profiling took longer than expected",
          description: `Profiling duration: ${profile.duration}ms (expected <15s)`,
          evidence: [{ type: "file", ref: profile.outputPath }],
          confidence: 0.8,
        });
      }
    } catch (error) {
      findings.push({
        id: "clinic.doctor.parse_error",
        area: "performance-profiling",
        severity: "major",
        title: "Failed to parse Clinic Doctor results",
        description: `Parse error: ${String(error)}`,
        evidence: [{ type: "log", ref: "ClinicAdapter.parseDoctorResults" }],
        confidence: 0.9,
      });
    }

    return findings;
  }

  /**
   * Parse Clinic Flame results and generate findings
   */
  async parseFlameResults(profile: ClinicProfile): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      findings.push({
        id: "clinic.flame.completed",
        area: "performance-profiling",
        severity: "info",
        title: "Clinic Flame CPU profiling completed",
        description: `CPU profiling completed in ${profile.duration}ms`,
        evidence: [{ type: "file", ref: profile.outputPath }],
        confidence: 1.0,
        recommendation: "Review the generated flame graph for CPU hotspots",
      });

      if (profile.duration > 15000) {
        findings.push({
          id: "clinic.flame.slow",
          area: "performance-profiling",
          severity: "minor",
          title: "Clinic Flame profiling took longer than expected",
          description: `Profiling duration: ${profile.duration}ms (expected <15s)`,
          evidence: [{ type: "file", ref: profile.outputPath }],
          confidence: 0.8,
        });
      }
    } catch (error) {
      findings.push({
        id: "clinic.flame.parse_error",
        area: "performance-profiling",
        severity: "major",
        title: "Failed to parse Clinic Flame results",
        description: `Parse error: ${String(error)}`,
        evidence: [{ type: "log", ref: "ClinicAdapter.parseFlameResults" }],
        confidence: 0.9,
      });
    }

    return findings;
  }

  /**
   * Parse Clinic Bubbleprof results and generate findings
   */
  async parseBubbleprofResults(profile: ClinicProfile): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      findings.push({
        id: "clinic.bubbleprof.completed",
        area: "performance-profiling",
        severity: "info",
        title: "Clinic Bubbleprof async analysis completed",
        description: `Async operation analysis completed in ${profile.duration}ms`,
        evidence: [{ type: "file", ref: profile.outputPath }],
        confidence: 1.0,
        recommendation:
          "Review the generated bubble graph for async bottlenecks",
      });

      if (profile.duration > 15000) {
        findings.push({
          id: "clinic.bubbleprof.slow",
          area: "performance-profiling",
          severity: "minor",
          title: "Clinic Bubbleprof profiling took longer than expected",
          description: `Profiling duration: ${profile.duration}ms (expected <15s)`,
          evidence: [{ type: "file", ref: profile.outputPath }],
          confidence: 0.8,
        });
      }
    } catch (error) {
      findings.push({
        id: "clinic.bubbleprof.parse_error",
        area: "performance-profiling",
        severity: "major",
        title: "Failed to parse Clinic Bubbleprof results",
        description: `Parse error: ${String(error)}`,
        evidence: [
          { type: "log", ref: "ClinicAdapter.parseBubbleprofResults" },
        ],
        confidence: 0.9,
      });
    }

    return findings;
  }

  /**
   * Clean up profile directories
   */
  async cleanup(profile: ClinicProfile): Promise<void> {
    try {
      await rm(profile.outputPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Clean up all profile directories
   */
  async cleanupAll(): Promise<void> {
    try {
      await rm(this.workDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
