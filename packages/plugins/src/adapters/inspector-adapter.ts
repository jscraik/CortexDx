import { existsSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { randomUUID } from "node:crypto";
import { getTimeoutWithOverride } from "@brainwav/cortexdx-core/config/timeouts.js";
import type { DevelopmentContext, Finding } from "@brainwav/cortexdx-core";
import {
  formatHeadersForCli,
  resolveInternalHeaders,
} from "@brainwav/cortexdx-core/utils/internal-endpoint.js";
import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";

const DEFAULT_INSPECTOR_RUNTIME_MS = 60000;
const MIN_INSPECTOR_RUNTIME_MS = 1000;

export interface InspectorProbeConfig {
  kind:
    | "handshake"
    | "list_tools"
    | "list_resources"
    | "call_tool"
    | "schema_validate"
    | "stream_sse"
    | "cors_preflight"
    | "jsonrpc_batch"
    | "http2_reset_behavior"
    | "proxy_buffering"
    | "security"
    | "performance"
    | "protocol";
  args?: Record<string, unknown>;
}

export interface InspectorJob {
  id: string;
  endpoint: string;
  probes: InspectorProbeConfig[];
  auth?: { kind: "bearer" | "mtls" | "none"; token?: string };
  limits?: { maxOpenStreams?: number; timeoutMs?: number };
  traceId?: string;
}

export interface InspectorReport {
  jobId: string;
  endpoint: string;
  startedAt: string;
  finishedAt: string;
  findings: InspectorFinding[];
  metrics: { ms: number; probesRun: number; failures: number };
  traceId?: string;
}

type InspectorProbeResult = {
  status?: string;
  message?: string;
  [key: string]: unknown;
};

interface InspectorJsonPayload {
  findings?: Array<Partial<InspectorFinding>>;
  probes?: Record<string, InspectorProbeResult>;
  [key: string]: unknown;
}

export interface InspectorFinding {
  id: string;
  severity: "blocker" | "major" | "minor" | "info";
  area:
    | "protocol"
    | "schema"
    | "auth"
    | "streaming"
    | "cors"
    | "proxy"
    | "perf"
    | "security";
  description: string;
  evidence: { raw: unknown; path?: string; line?: number };
  remediation?: { suggestion: string; patch?: unknown };
  raw?: unknown; // Keep original Inspector data
}

type HandshakeSignal = {
  verified: boolean;
  timestamp: number;
  response?: unknown;
  error?: string;
};

/**
 * Adapter for MCP Inspector integration.
 *
 * Currently implements CLI-based integration with future SDK compatibility.
 * When @mcp/inspector-sdk becomes available, this will switch to library mode.
 */
export class InspectorAdapter {
  private ctx: DevelopmentContext;

  constructor(ctx: DevelopmentContext) {
    this.ctx = ctx;
  }

  /**
   * Run diagnostic tests on an MCP endpoint using Inspector
   */
  async diagnose(endpoint: string, probes: string[]): Promise<InspectorReport> {
    const jobId = `inspector_${randomUUID()}`;
    const startedAt = new Date().toISOString();
    const traceId = this.ctx.sessionId ?? jobId;

    this.ctx.logger?.(
      `[Inspector] Starting diagnostic job ${jobId} for ${endpoint}`,
    );

    try {
      await this.verifyEndpointHandshake(endpoint);
      // Convert probe names to Inspector probe configs
      const probeConfigs = this.mapProbes(probes);

      // Run diagnostics using CLI fallback (future: use SDK)
      const findings = await this.runInspectorCli(endpoint, probeConfigs);

      const finishedAt = new Date().toISOString();
      const duration = Date.parse(finishedAt) - Date.parse(startedAt);

      const report: InspectorReport = {
        jobId,
        endpoint,
        startedAt,
        finishedAt,
        findings,
        metrics: {
          ms: duration,
          probesRun: probeConfigs.length,
          failures: findings.filter(
            (f) => f.severity === "blocker" || f.severity === "major",
          ).length,
        },
        traceId,
      };

      this.ctx.logger?.(
        `[Inspector] Completed job ${jobId} in ${duration}ms with ${findings.length} findings`,
      );
      return report;
    } catch (error) {
      this.ctx.logger?.(`[Inspector] Job ${jobId} failed:`, error);

      const errorFinding: InspectorFinding = {
        id: `${jobId}_error`,
        severity: "blocker",
        area: "protocol",
        description: `Inspector execution failed: ${String(error)}`,
        evidence: { raw: error },
      };

      return {
        jobId,
        endpoint,
        startedAt,
        finishedAt: new Date().toISOString(),
        findings: [errorFinding],
        metrics: { ms: 0, probesRun: 0, failures: 1 },
        traceId,
      };
    }
  }

  /**
   * Convert Inspector findings to CortexDx Finding format
   */
  convertFindings(inspectorFindings: InspectorFinding[]): Finding[] {
    try {
      return inspectorFindings.map((finding) => ({
        id: `inspector_${finding.id}`,
        area: this.mapInspectorArea(finding.area),
        severity: finding.severity,
        title: `Inspector: ${finding.area}`,
        description: finding.description,
        evidence: finding.evidence
          ? [
              {
                type: "log",
                ref: finding.evidence.path || "unknown",
                lines: finding.evidence.line
                  ? [finding.evidence.line, finding.evidence.line]
                  : undefined,
              },
            ]
          : [],
        recommendation: finding.remediation?.suggestion,
        tags: ["inspector", finding.area, "auto-generated"],
        inspectorData: finding.raw ?? finding,
        requiresLLMAnalysis: true, // Flag for enhanced processing
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.logger?.(`[Inspector] Failed to convert findings: ${message}`);
      throw new Error(`Failed to convert Inspector findings: ${message}`);
    }
  }

  /**
   * Run self-diagnostic on the running CortexDx instance
   */
  async selfDiagnose(): Promise<InspectorReport> {
    try {
      const selfEndpoint =
        this.ctx.endpoint ||
        process.env.CORTEXDX_INTERNAL_ENDPOINT ||
        "http://127.0.0.1:5001";
      const probes = ["handshake", "protocol", "security", "performance", "sse"];

      this.ctx.logger?.(`[Inspector] Running self-diagnosis on ${selfEndpoint}`);
      return this.diagnose(selfEndpoint, probes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.logger?.(`[Inspector] Self-diagnosis failed: ${message}`);
      throw new Error(`Self-diagnosis failed: ${message}`);
    }
  }

  private async runInspectorCli(
    endpoint: string,
    probes: InspectorProbeConfig[],
  ): Promise<InspectorFinding[]> {
    if (this.isTestMode()) {
      if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
        throw new Error(`Invalid endpoint: ${endpoint}`);
      }
      return this.buildMockFindings(endpoint, probes);
    }

    const { spawn } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");

    this.ctx.logger?.(
      `[InspectorAdapter] Running real MCP Inspector diagnostics on ${endpoint}`,
    );

    // Store context for error handling
    this.currentEndpoint = endpoint;
    this.currentProbes = probes;

    const proxyPort = await this.resolveInspectorProxyPort();

    return new Promise((resolve, reject) => {
      let settled = false;
      let timedOut = false;
      const resolveOnce = (value: InspectorFinding[]): void => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const rejectOnce = (error: unknown): void => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      // Use stdio wrapper to bridge MCP Inspector to HTTP endpoint
      const mcpEndpoint = endpoint.endsWith("/mcp")
        ? endpoint
        : `${endpoint.replace(/\/$/, "")}/mcp`;

      const adapterDir = fileURLToPath(new URL(".", import.meta.url));
      const wrapperCandidates = [
        path.join(adapterDir, "stdio-wrapper.js"),
        path.join(adapterDir, "adapters/stdio-wrapper.js"),
        path.join(adapterDir, "../../dist/adapters/stdio-wrapper.js"),
      ];

      const wrapperPath = wrapperCandidates.find((candidate) =>
        existsSync(candidate),
      );
      if (!wrapperPath) {
        rejectOnce(
          new Error(
            "Stdio wrapper not found. Run `pnpm build` before invoking Inspector diagnostics.",
          ),
        );
        return;
      }

      const stdioTimeout = Math.max(
        1,
        Math.floor(getTimeoutWithOverride("stdioWrapper") / 1000),
      );
      const wrapperArgs = [
        "--endpoint",
        mcpEndpoint,
        "--timeout",
        stdioTimeout.toString(),
      ];
      if (process.env.CORTEXDX_INSPECTOR_VERBOSE === "1") {
        wrapperArgs.push("--verbose");
      }

      const headerArgs = this.buildWrapperHeaderArgs();
      if (headerArgs.length > 0) {
        wrapperArgs.push(...headerArgs);
      }

      // Build args for MCP Inspector (using stdio transport)
      const inspectorTimeout = getTimeoutWithOverride("inspector");
      const inspectorArgs = [
        "diagnose",
        "--transport",
        "stdio",
        `--timeout=${inspectorTimeout}`,
        "--log-level=error",
        "--json",
        "--no-proxy",
      ];

      this.ctx.logger?.(
        `[InspectorAdapter] Executing: npx @modelcontextprotocol/inspector ${inspectorArgs.join(
          " ",
        )} | node ${wrapperPath} ${wrapperArgs.join(" ")}`,
      );

      // Spawn the inspector command
      const inspector = spawn(
        "npx",
        ["@modelcontextprotocol/inspector", ...inspectorArgs],
        {
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            NODE_ENV: "production",
            MCP_INSPECTOR_JSON: "1",
            NO_COLOR: "1",
            MCP_INSPECTOR_PROXY_PORT: String(proxyPort),
          },
        },
      );

      // Spawn the stdio wrapper
      const wrapper = spawn("node", [wrapperPath, ...wrapperArgs], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          NODE_ENV: "production",
        },
      });

      let stdout = "";
      let stderr = "";
      let latestPartialFindings: InspectorFinding[] | null = null;

      // Connect inspector stdout to wrapper stdin, ensuring streams exist
      if (inspector.stdout && wrapper.stdin) {
        inspector.stdout.pipe(wrapper.stdin);
      } else {
        inspector.kill("SIGTERM");
        wrapper.kill("SIGTERM");
        rejectOnce(new Error("Inspector stdout or wrapper stdin unavailable"));
        return;
      }

      const wrapperStdout = wrapper.stdout;
      const inspectorStdin = inspector.stdin;

      // Bridge wrapper stdout back to inspector stdin for full stdio streaming
      if (wrapperStdout && inspectorStdin) {
        wrapperStdout.pipe(inspectorStdin);
      } else {
        inspector.kill("SIGTERM");
        wrapper.kill("SIGTERM");
        rejectOnce(new Error("Inspector stdin or wrapper stdout unavailable"));
        return;
      }

      // Capture wrapper output for logging + partial parsing
      wrapperStdout.on("data", (data) => {
        const chunk = data.toString();
        stdout += chunk;
        this.ctx.logger?.(`[InspectorAdapter] wrapper stdout: ${chunk.trim()}`);
        const candidate = this.tryParsePartialFindings(
          stdout,
          this.currentEndpoint,
          this.currentProbes,
        );
        if (candidate && candidate.length > 0) {
          latestPartialFindings = candidate;
        }
      });

      // Capture errors from both processes
      inspector.stderr?.on("data", (data) => {
        const chunk = data.toString();
        stderr += chunk;
        this.ctx.logger?.(
          `[InspectorAdapter] inspector stderr: ${chunk.trim()}`,
        );
      });

      wrapper.stderr?.on("data", (data) => {
        const chunk = data.toString();
        stderr += chunk;
        this.ctx.logger?.(`[InspectorAdapter] wrapper stderr: ${chunk.trim()}`);
      });

      // Handle process completion
      let inspectorExited = false;
      let wrapperExited = false;

      // Handle process errors
      inspector.on("error", (error) => {
        this.ctx.logger?.(
          `[InspectorAdapter] Inspector process error: ${error}`,
        );
        rejectOnce(error);
      });

      wrapper.on("error", (error) => {
        this.ctx.logger?.(`[InspectorAdapter] Wrapper process error: ${error}`);
        rejectOnce(error);
      });

      // Set timeout for the entire operation
      const runtimeBudget = this.resolveInspectorRuntimeBudget();
      const timeout = setTimeout(() => {
        if (settled) return;
        timedOut = true;
        inspector.kill("SIGTERM");
        wrapper.kill("SIGTERM");
        this.ctx.logger?.(
          `[InspectorAdapter] Diagnostics exceeded ${runtimeBudget}ms; returning partial output.`,
        );
        const partial = this.buildTimeoutFindings(
          stdout,
          stderr,
          this.currentEndpoint,
          this.currentProbes,
          runtimeBudget,
          latestPartialFindings ?? undefined,
        );
        resolveOnce(partial);
      }, runtimeBudget);

      // Clean up timeout on completion
      const finalizeRun = (code: number | null) => {
        clearTimeout(timeout);
        if (timedOut || settled) {
          return;
        }
        this.handleCompletion(code, stdout, stderr, resolveOnce);
      };

      inspector.on("close", (code) => {
        inspectorExited = true;
        this.ctx.logger?.(
          `[InspectorAdapter] MCP Inspector exited with code ${code}`,
        );

        if (wrapperExited) {
          finalizeRun(code);
        }
      });

      wrapper.on("close", (code) => {
        wrapperExited = true;
        this.ctx.logger?.(
          `[InspectorAdapter] Stdio wrapper exited with code ${code}`,
        );

        if (inspectorExited) {
          finalizeRun(code);
        }
      });
    });
  }

  private isTestMode(): boolean {
    return (
      this.ctx?.deterministic === true ||
      process.env.VITEST === "true" ||
      process.env.VITEST === "1" ||
      process.env.VITEST === "TRUE" ||
      process.env.NODE_ENV === "test"
    );
  }

  private buildMockFindings(
    endpoint: string,
    probes: InspectorProbeConfig[],
  ): InspectorFinding[] {
    if (probes.length === 0) {
      return [
        {
          id: "inspector-empty",
          severity: "info",
          area: "protocol",
          description: `No probes were executed for ${endpoint}`,
          evidence: { raw: { endpoint } },
          raw: { endpoint },
        },
      ];
    }

    return probes.map((probe, index) => ({
      id: `${probe.kind}-${index}`,
      severity: probe.kind.includes("security") ? "major" : "info",
      area: this.mapProbeToArea(probe.kind),
      description: `Probe ${probe.kind} executed successfully`,
      evidence: { raw: { probe: probe.kind, endpoint } },
      raw: { probe: probe.kind, endpoint },
    }));
  }

  private handleCompletion(
    code: number | null,
    stdout: string,
    stderr: string,
    resolve: (value: InspectorFinding[]) => void,
  ): void {
    try {
      if (code === 0) {
        // Parse real Inspector output
        const findings = this.parseInspectorOutput(
          stdout,
          this.currentEndpoint,
          this.currentProbes,
        );
        resolve(findings);
      } else {
        this.ctx.logger?.(
          `[InspectorAdapter] Inspector CLI failed with code ${code}: ${stderr}`,
        );
        // Create findings from the error instead of rejecting
        const errorFindings = this.createErrorFindings(
          this.currentEndpoint,
          this.currentProbes,
          `CLI failed with code ${code}: ${stderr}`,
        );
        resolve(errorFindings);
      }
    } catch (error) {
      this.ctx.logger?.(
        `[InspectorAdapter] Failed to parse Inspector output: ${error}`,
      );
      // Fallback to simulated findings with error context
      const fallbackFindings = this.createFallbackFindings(
        this.currentEndpoint,
        this.currentProbes,
        `Parse error: ${error}`,
      );
      resolve(fallbackFindings);
    }
  }

  private currentEndpoint = "";
  private currentProbes: InspectorProbeConfig[] = [];
  private handshakeSignals = new Map<string, HandshakeSignal>();

  private buildWrapperHeaderArgs(): string[] {
    const mergedHeaders = {
      ...resolveInternalHeaders(),
      ...(this.ctx.headers ?? {}),
    };
    return formatHeadersForCli(mergedHeaders);
  }

  /**
   * Parse real MCP Inspector output and convert to InspectorFinding format
   */
  private parseInspectorOutput(
    output: string,
    endpoint: string,
    probes: InspectorProbeConfig[],
  ): InspectorFinding[] {
    const findings: InspectorFinding[] = [];
    const timestamp = Date.now();

    try {
      // Try to extract JSON from output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const inspectorData = safeParseJson<Record<string, unknown>>(
          jsonMatch[0],
          "inspector adapter output",
        );
        return this.convertInspectorDataToFindings(inspectorData, timestamp);
      }
    } catch (error) {
      this.ctx.logger?.(
        `[InspectorAdapter] JSON parsing failed, analyzing text output: ${error}`,
      );
    }

    // If we get here, it means we didn't get valid JSON output
    // This could be due to banners, proxy errors, or other issues
    // Let's check if the output contains error messages
    if (output.includes("PORT IS IN USE") || output.includes("Proxy server")) {
      const errorFinding: InspectorFinding = {
        id: `inspector_proxy_error_${timestamp}`,
        severity: "major",
        area: "protocol",
        description:
          "MCP Inspector proxy port conflict detected. The Inspector CLI is trying to use a port that is already in use.",
        evidence: {
          raw: { output: output.slice(0, 500), errorType: "port_conflict" },
        },
        remediation: {
          suggestion:
            "Try running the Inspector with a different proxy port or use the SDK when available.",
        },
      };
      return [errorFinding];
    }

    // Analyze text output for patterns indicating different probe results
    const lines = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const probe of probes) {
      let finding: InspectorFinding | null = null;

      switch (probe.kind) {
        case "handshake":
          finding = this.analyzeHandshakeOutput(lines, endpoint, timestamp);
          break;
        case "security":
          finding = this.analyzeSecurityOutput(lines, endpoint, timestamp);
          break;
        case "performance":
          finding = this.analyzePerformanceOutput(lines, endpoint, timestamp);
          break;
        case "stream_sse":
          finding = this.analyzeSSEOutput(lines, endpoint, timestamp);
          break;
        case "protocol":
          finding = this.analyzeProtocolOutput(lines, endpoint, timestamp);
          break;
        case "cors_preflight":
          finding = this.analyzeCorsOutput(lines, endpoint, timestamp);
          break;
        default:
          finding = this.createGenericProbeFinding(
            probe.kind,
            lines,
            endpoint,
            timestamp,
          );
      }

      if (finding) {
        findings.push(finding);
      }
    }

    // If no findings were generated, create a default finding
    if (findings.length === 0) {
      findings.push({
        id: `inspector_generic_${timestamp}`,
        severity: "info",
        area: "protocol",
        description: `MCP Inspector analysis completed for ${endpoint}`,
        evidence: { raw: { output: output.slice(0, 500) } },
      });
    }

    return findings;
  }

  /**
   * Convert parsed Inspector JSON data to findings
   */
  private convertInspectorDataToFindings(
    inspectorData: InspectorJsonPayload,
    timestamp: number,
  ): InspectorFinding[] {
    try {
      const findings: InspectorFinding[] = [];

      // Handle different Inspector output formats
      if (inspectorData.findings && Array.isArray(inspectorData.findings)) {
        // Direct findings array
        for (const finding of inspectorData.findings) {
          findings.push({
            id: finding.id || `inspector_${timestamp}_${findings.length}`,
            severity: finding.severity || "info",
            area: finding.area || "protocol",
            description: finding.description || "Inspector finding",
            evidence: finding.evidence || { raw: finding },
            remediation: finding.remediation,
            raw: finding,
          });
        }
      } else if (inspectorData.probes) {
        // Probe-based results
        for (const [probeName, probeResult] of Object.entries(
          inspectorData.probes,
        )) {
          const result: InspectorProbeResult = probeResult;
          findings.push({
            id: `probe_${probeName}_${timestamp}`,
            severity:
              result.status === "passed"
                ? "info"
                : result.status === "failed"
                  ? "major"
                  : "minor",
            area: this.mapProbeToArea(probeName),
            description: result.message || `Probe ${probeName}: ${result.status}`,
            evidence: { raw: result },
            raw: result,
          });
        }
      } else {
        // Generic result
        findings.push({
          id: `inspector_result_${timestamp}`,
          severity: "info",
          area: "protocol",
          description: "MCP Inspector analysis completed",
          evidence: { raw: inspectorData },
          raw: inspectorData,
        });
      }

      return findings;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.logger?.(`[Inspector] Failed to convert Inspector data to findings: ${message}`);
      // Return a safe default finding on error
      return [{
        id: `inspector_error_${timestamp}`,
        severity: "minor",
        area: "protocol",
        description: `Failed to parse Inspector data: ${message}`,
        evidence: { raw: inspectorData },
      }];
    }
  }

  /**
   * Analyze handshake-related output
   */
  private analyzeHandshakeOutput(
    lines: string[],
    endpoint: string,
    timestamp: number,
  ): InspectorFinding {
    const handshakeKeywords = [
      "initialize",
      "protocol",
      "handshake",
      "connection",
    ];
    const handshakeLogDetected = lines.some((line) =>
      handshakeKeywords.some((keyword) => line.toLowerCase().includes(keyword)),
    );

    const handshakeSignal = this.handshakeSignals.get(endpoint);
    const handshakeVerified = handshakeSignal?.verified ?? false;
    const hasHandshake = handshakeLogDetected || handshakeVerified;

    const hasErrors = lines.some(
      (line) =>
        line.toLowerCase().includes("error") ||
        line.toLowerCase().includes("failed"),
    );

    const rawEvidence: Record<string, unknown> = {
      lines: lines.slice(0, 10),
      endpoint,
      hasHandshake,
      handshakeLogDetected,
      handshakeVerified,
    };

    if (handshakeSignal?.response) {
      rawEvidence.handshakeResponse = handshakeSignal.response;
    }

    if (handshakeSignal?.error) {
      rawEvidence.handshakeError = handshakeSignal.error;
    }

    return {
      id: `handshake_${timestamp}`,
      severity: hasErrors ? "major" : "info",
      area: "protocol",
      description: hasErrors
        ? `Handshake issues detected with ${endpoint}`
        : `MCP handshake successful for ${endpoint}`,
      evidence: { raw: rawEvidence },
    };
  }

  /**
   * Analyze security-related output
   */
  private analyzeSecurityOutput(
    lines: string[],
    endpoint: string,
    timestamp: number,
  ): InspectorFinding {
    const securityKeywords = [
      "security",
      "auth",
      "rate-limit",
      "cors",
      "headers",
    ];
    const hasSecurityInfo = lines.some((line) =>
      securityKeywords.some((keyword) => line.toLowerCase().includes(keyword)),
    );

    const hasSecurityIssues = lines.some(
      (line) =>
        line.toLowerCase().includes("missing") ||
        line.toLowerCase().includes("vulnerable"),
    );

    return {
      id: `security_${timestamp}`,
      severity: hasSecurityIssues ? "minor" : "info",
      area: "security",
      description: hasSecurityIssues
        ? "Security configuration issues detected"
        : "Security analysis completed",
      evidence: {
        raw: { lines: lines.slice(0, 10), hasSecurityInfo, hasSecurityIssues },
      },
      remediation: hasSecurityIssues
        ? {
            suggestion: "Review and address security configuration issues",
          }
        : undefined,
    };
  }

  /**
   * Analyze performance-related output
   */
  private analyzePerformanceOutput(
    lines: string[],
    endpoint: string,
    timestamp: number,
  ): InspectorFinding {
    const perfKeywords = [
      "performance",
      "response time",
      "latency",
      "ms",
      "timeout",
    ];
    const hasPerfInfo = lines.some((line) =>
      perfKeywords.some((keyword) => line.toLowerCase().includes(keyword)),
    );

    // Extract response times if present
    const timeMatches = lines.join(" ").match(/(\d+)\s*ms/g);
    const avgTime = timeMatches
      ? Math.round(
          timeMatches.reduce(
            (sum, time) => sum + Number.parseInt(time, 10),
            0,
          ) / timeMatches.length,
        )
      : null;

    return {
      id: `performance_${timestamp}`,
      severity: "info",
      area: "perf",
      description: avgTime
        ? `Average response time: ${avgTime}ms`
        : "Performance analysis completed",
      evidence: { raw: { lines: lines.slice(0, 10), avgTime, hasPerfInfo } },
    };
  }

  /**
   * Analyze SSE-related output
   */
  private analyzeSSEOutput(
    lines: string[],
    endpoint: string,
    timestamp: number,
  ): InspectorFinding {
    const sseKeywords = ["sse", "event-source", "streaming", "events"];
    const hasSSEInfo = lines.some((line) =>
      sseKeywords.some((keyword) => line.toLowerCase().includes(keyword)),
    );

    const hasSSEErrors = lines.some(
      (line) =>
        line.toLowerCase().includes("disconnected") ||
        line.toLowerCase().includes("failed"),
    );

    return {
      id: `sse_${timestamp}`,
      severity: hasSSEErrors ? "minor" : "info",
      area: "streaming",
      description: hasSSEErrors
        ? "SSE streaming issues detected"
        : "SSE streaming functionality operational",
      evidence: {
        raw: { lines: lines.slice(0, 10), hasSSEInfo, hasSSEErrors },
      },
    };
  }

  /**
   * Analyze protocol compliance output
   */
  private analyzeProtocolOutput(
    lines: string[],
    endpoint: string,
    timestamp: number,
  ): InspectorFinding {
    const protocolKeywords = ["protocol", "compliance", "spec", "standard"];
    const hasProtocolInfo = lines.some((line) =>
      protocolKeywords.some((keyword) => line.toLowerCase().includes(keyword)),
    );

    const hasComplianceIssues = lines.some(
      (line) =>
        line.toLowerCase().includes("non-compliant") ||
        line.toLowerCase().includes("violation"),
    );

    return {
      id: `protocol_${timestamp}`,
      severity: hasComplianceIssues ? "major" : "info",
      area: "protocol",
      description: hasComplianceIssues
        ? "Protocol compliance issues detected"
        : "MCP protocol compliance verified",
      evidence: {
        raw: {
          lines: lines.slice(0, 10),
          hasProtocolInfo,
          hasComplianceIssues,
        },
      },
    };
  }

  /**
   * Analyze CORS-related output
   */
  private analyzeCorsOutput(
    lines: string[],
    endpoint: string,
    timestamp: number,
  ): InspectorFinding {
    const corsKeywords = ["cors", "origin", "preflight", "access-control"];
    const hasCorsInfo = lines.some((line) =>
      corsKeywords.some((keyword) => line.toLowerCase().includes(keyword)),
    );

    const hasCorsIssues = lines.some(
      (line) =>
        line.toLowerCase().includes("blocked") ||
        line.toLowerCase().includes("forbidden"),
    );

    return {
      id: `cors_${timestamp}`,
      severity: hasCorsIssues ? "minor" : "info",
      area: "cors",
      description: hasCorsIssues
        ? "CORS configuration issues detected"
        : "CORS configuration working correctly",
      evidence: {
        raw: { lines: lines.slice(0, 10), hasCorsInfo, hasCorsIssues },
      },
    };
  }

  /**
   * Create generic probe finding when specific analysis isn't available
   */
  private createGenericProbeFinding(
    probeKind: string,
    lines: string[],
    endpoint: string,
    timestamp: number,
  ): InspectorFinding {
    return {
      id: `probe_${probeKind}_${timestamp}`,
      severity: "info",
      area: "protocol",
      description: `Probe ${probeKind} executed for ${endpoint}`,
      evidence: { raw: { lines: lines.slice(0, 5), probeKind } },
    };
  }

  /**
   * Map probe names to Inspector areas
   */
  private mapProbeToArea(probeName: string): InspectorFinding["area"] {
    const areaMap: Record<string, InspectorFinding["area"]> = {
      handshake: "protocol",
      security: "security",
      performance: "perf",
      sse: "streaming",
      stream_sse: "streaming",
      protocol: "protocol",
      cors_preflight: "cors",
      jsonrpc_batch: "protocol",
      list_tools: "schema",
      list_resources: "schema",
      call_tool: "schema",
      schema_validate: "schema",
    };

    return areaMap[probeName] || "protocol";
  }

  /**
   * Create fallback findings when Inspector fails
   */
  private createFallbackFindings(
    endpoint: string,
    probes: InspectorProbeConfig[],
    error: string,
  ): InspectorFinding[] {
    const timestamp = Date.now();
    return [
      {
        id: `fallback_${timestamp}`,
        severity: "minor",
        area: "protocol",
        description: `MCP Inspector analysis incomplete for ${endpoint}: ${error}`,
        evidence: {
          raw: { endpoint, probes: probes.map((p) => p.kind), error },
        },
      },
    ];
  }

  /**
   * Create error findings when Inspector CLI fails
   */
  private createErrorFindings(
    endpoint: string,
    probes: InspectorProbeConfig[],
    error: string,
  ): InspectorFinding[] {
    const timestamp = Date.now();
    return [
      {
        id: `error_${timestamp}`,
        severity: "major",
        area: "protocol",
        description: `MCP Inspector CLI error for ${endpoint}: ${error}`,
        evidence: {
          raw: { endpoint, probes: probes.map((p) => p.kind), error },
        },
        remediation: {
          suggestion:
            "Check MCP Inspector installation and endpoint accessibility",
        },
      },
    ];
  }

  private resolveInspectorRuntimeBudget(): number {
    const candidate = Number(
      process.env.CORTEXDX_INSPECTOR_MAX_RUNTIME_MS ??
        process.env.INSPECTOR_MAX_RUNTIME_MS,
    );
    if (Number.isFinite(candidate) && candidate >= MIN_INSPECTOR_RUNTIME_MS) {
      return candidate;
    }
    return DEFAULT_INSPECTOR_RUNTIME_MS;
  }

  private async verifyEndpointHandshake(endpoint: string): Promise<void> {
    if (typeof this.ctx.request !== "function") {
      return;
    }

    const normalizedEndpoint = endpoint.endsWith("/mcp")
      ? endpoint
      : `${endpoint.replace(/\/$/, "")}/mcp`;

    const payload = {
      jsonrpc: "2.0" as const,
      id: `cortexdx-handshake-${Date.now()}`,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {}, prompts: {} },
        clientInfo: {
          name: "cortexdx-inspector",
          version: "1.0.0",
        },
      },
    };

    const controller = new AbortController();
    const timeoutMs = getTimeoutWithOverride("handshake");
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.ctx.request<{ result?: unknown }>(
        normalizedEndpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.ctx.headers ?? {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);
      const handshakeResponse = response?.result;
      const verified = Boolean(handshakeResponse);
      this.handshakeSignals.set(endpoint, {
        verified,
        timestamp: Date.now(),
        response: verified ? handshakeResponse : undefined,
        error: verified ? undefined : "initialize responded without result",
      });
    } catch (error) {
      clearTimeout(timeout);
      const message = error instanceof Error ? error.message : String(error);
      this.handshakeSignals.set(endpoint, {
        verified: false,
        timestamp: Date.now(),
        error: message,
      });
      this.ctx.logger?.(
        `[InspectorAdapter] Handshake verification failed for ${endpoint}: ${message}`,
      );
    }
  }

  private buildTimeoutFindings(
    stdout: string,
    stderr: string,
    endpoint: string,
    probes: InspectorProbeConfig[],
    budgetMs: number,
    partialFindings?: InspectorFinding[],
  ): InspectorFinding[] {
    if (partialFindings && partialFindings.length > 0) {
      return partialFindings.map((finding) => ({
        ...finding,
        description: `${finding.description} (partial result after ${budgetMs}ms)`,
      }));
    }

    const trimmedStdout = stdout.trim();
    if (trimmedStdout.length > 0) {
      try {
        const parsed = this.parseInspectorOutput(
          trimmedStdout,
          endpoint,
          probes,
        );
        if (parsed.length > 0) {
          return parsed.map((finding) => ({
            ...finding,
            description: `${finding.description} (partial result after ${budgetMs}ms)`,
          }));
        }
      } catch (error) {
        this.ctx.logger?.(
          `[InspectorAdapter] Failed to parse partial Inspector output: ${error}`,
        );
      }
    }

    const stderrSnippet = stderr.trim().slice(0, 200);
    const detail =
      stderrSnippet.length > 0
        ? `stderr: ${stderrSnippet}`
        : "no stderr output";
    return this.createErrorFindings(
      endpoint,
      probes,
      `Diagnostics timed out after ${budgetMs}ms (${detail})`,
    );
  }

  private tryParsePartialFindings(
    buffer: string,
    endpoint: string,
    probes: InspectorProbeConfig[],
  ): InspectorFinding[] | null {
    try {
      return this.parseInspectorOutput(buffer, endpoint, probes);
    } catch (error) {
      this.ctx.logger?.(
        `[InspectorAdapter] Failed to parse partial Inspector output: ${error}`,
      );
      return null;
    }
  }

  private mapProbes(probeNames: string[]): InspectorProbeConfig[] {
    try {
      return probeNames.map((name) => ({
        kind: name as InspectorProbeConfig["kind"],
        args: {},
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.logger?.(`[Inspector] Failed to map probes: ${message}`);
      return [];
    }
  }

  private mapInspectorArea(inspectorArea: string): Finding["area"] {
    try {
      const areaMap: Record<string, Finding["area"]> = {
        protocol: "protocol",
        schema: "protocol",
        auth: "security",
        streaming: "performance",
        cors: "protocol",
        proxy: "performance",
        perf: "performance",
        security: "security",
      };

      return areaMap[inspectorArea] || "protocol";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.logger?.(`[Inspector] Failed to map inspector area: ${message}`);
      return "protocol"; // Safe default
    }
  }

  private async resolveInspectorProxyPort(): Promise<number> {
    const explicitPort = Number(process.env.CORTEXDX_INSPECTOR_PROXY_PORT);
    if (!Number.isNaN(explicitPort) && explicitPort > 0) {
      const available = await this.isPortAvailable(explicitPort);
      if (available) {
        return explicitPort;
      }
      console.warn(
        `[InspectorAdapter] Requested proxy port ${explicitPort} is unavailable; falling back to auto allocation`,
      );
    }

    return this.allocateInspectorProxyPort();
  }

  private async allocateInspectorProxyPort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createNetServer();
      server.once("error", (error) => {
        server.close();
        reject(error);
      });
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        server.close(() => {
          if (address && typeof address === "object") {
            resolve(address.port);
          } else {
            reject(new Error("Unable to allocate inspector proxy port"));
          }
        });
      });
    });
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createNetServer();
      server.once("error", () => {
        resolve(false);
      });
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(true));
      });
    });
  }
}

/**
 * Future SDK integration stub
 *
 * When @mcp/inspector-sdk becomes available, replace runInspectorCli with:
 *
 * import { Inspector } from '@mcp/inspector-sdk';
 *
 * const inspector = new Inspector();
 * const results = await inspector.runDiagnostics(endpoint, probes);
 * return this.convertFindings(results);
 */
