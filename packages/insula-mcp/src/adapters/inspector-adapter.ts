import type {
  ChatMessage,
  DevelopmentContext,
  Finding,
} from "../types.js";

export interface InspectorProbeConfig {
  kind:
    | 'handshake'
    | 'list_tools'
    | 'list_resources'
    | 'call_tool'
    | 'schema_validate'
    | 'stream_sse'
    | 'cors_preflight'
    | 'jsonrpc_batch'
    | 'http2_reset_behavior'
    | 'proxy_buffering'
    | 'security'
    | 'performance'
    | 'protocol';
  args?: Record<string, unknown>;
}

export interface InspectorJob {
  id: string;
  endpoint: string;
  probes: InspectorProbeConfig[];
  auth?: { kind: 'bearer' | 'mtls' | 'none'; token?: string };
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
  severity: 'blocker' | 'major' | 'minor' | 'info';
  area: 'protocol' | 'schema' | 'auth' | 'streaming' | 'cors' | 'proxy' | 'perf' | 'security';
  description: string;
  evidence: { raw: unknown; path?: string; line?: number };
  remediation?: { suggestion: string; patch?: unknown };
  raw?: unknown; // Keep original Inspector data
}

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
    const jobId = `inspector_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const startedAt = new Date().toISOString();
    const traceId = this.ctx.sessionId ?? jobId;

    this.ctx.logger?.(`[Inspector] Starting diagnostic job ${jobId} for ${endpoint}`);

    try {
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
          failures: findings.filter(f => f.severity === 'blocker' || f.severity === 'major').length,
        },
        traceId,
      };

      this.ctx.logger?.(`[Inspector] Completed job ${jobId} in ${duration}ms with ${findings.length} findings`);
      return report;

    } catch (error) {
      this.ctx.logger?.(`[Inspector] Job ${jobId} failed:`, error);

      const errorFinding: InspectorFinding = {
        id: `${jobId}_error`,
        severity: 'blocker',
        area: 'protocol',
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
   * Convert Inspector findings to Insula Finding format
   */
  convertFindings(inspectorFindings: InspectorFinding[]): Finding[] {
    return inspectorFindings.map(finding => ({
      id: `inspector_${finding.id}`,
      area: this.mapInspectorArea(finding.area),
      severity: finding.severity,
      title: `Inspector: ${finding.area}`,
      description: finding.description,
      evidence: finding.evidence ? [finding.evidence] : [],
      recommendation: finding.remediation?.suggestion,
      tags: ['inspector', finding.area, 'auto-generated'],
      inspectorData: finding.raw, // Keep original for LLM analysis
      requiresLLMAnalysis: true, // Flag for enhanced processing
    }));
  }

  /**
   * Run self-diagnostic on the running Insula instance
   */
  async selfDiagnose(): Promise<InspectorReport> {
    const selfEndpoint = process.env.INSULA_INTERNAL_ENDPOINT || 'http://127.0.0.1:5001';
    const probes = ['handshake', 'protocol', 'security', 'performance', 'sse'];

    this.ctx.logger?.(`[Inspector] Running self-diagnosis on ${selfEndpoint}`);
    return this.diagnose(selfEndpoint, probes);
  }

  private async runInspectorCli(
    endpoint: string,
    probes: InspectorProbeConfig[]
  ): Promise<InspectorFinding[]> {
    const { spawn } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');

    this.ctx.logger?.(`[InspectorAdapter] Running real MCP Inspector diagnostics on ${endpoint}`);

    // Store context for error handling
    this.currentEndpoint = endpoint;
    this.currentProbes = probes;

    return new Promise((resolve, reject) => {
      // Use stdio wrapper to bridge MCP Inspector to HTTP endpoint
      const mcpEndpoint = endpoint.endsWith('/mcp') ? endpoint : `${endpoint.replace(/\/$/, '')}/mcp`;

      // Path to the stdio wrapper (compiled JS file)
      const wrapperPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../packages/insula-mcp/dist/adapters/stdio-wrapper.js'
      );

      // Build args for stdio wrapper
      const wrapperArgs = [
        '--endpoint', mcpEndpoint,
        '--timeout', '30',
        '--verbose'
      ];

      // Build args for MCP Inspector (using stdio transport)
      const inspectorArgs = [
        '--cli',
        '--transport', 'stdio',
        '--timeout=30000',
        '--log-level=info'
      ];

      this.ctx.logger?.(`[InspectorAdapter] Executing: npx @modelcontextprotocol/inspector ${inspectorArgs.join(' ')} | node ${wrapperPath} ${wrapperArgs.join(' ')}`);

      // Spawn the inspector command
      const inspector = spawn('npx', ['@modelcontextprotocol/inspector', ...inspectorArgs], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
      });

      // Spawn the stdio wrapper
      const wrapper = spawn('node', [wrapperPath, ...wrapperArgs], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
      });

      let stdout = '';
      let stderr = '';

      // Connect inspector stdout to wrapper stdin, ensuring streams exist
      if (inspector.stdout && wrapper.stdin) {
        inspector.stdout.pipe(wrapper.stdin);
      } else {
        inspector.kill('SIGTERM');
        wrapper.kill('SIGTERM');
        reject(new Error('Inspector stdout or wrapper stdin unavailable'));
        return;
      }

      // Capture wrapper output
      wrapper.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        this.ctx.logger?.(`[InspectorAdapter] wrapper stdout: ${chunk.trim()}`);
      });

      // Capture errors from both processes
      inspector.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        this.ctx.logger?.(`[InspectorAdapter] inspector stderr: ${chunk.trim()}`);
      });

      wrapper.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        this.ctx.logger?.(`[InspectorAdapter] wrapper stderr: ${chunk.trim()}`);
      });

      // Handle process completion
      let inspectorExited = false;
      let wrapperExited = false;

      // Handle process errors
      inspector.on('error', (error) => {
        this.ctx.logger?.(`[InspectorAdapter] Inspector process error: ${error}`);
        reject(error);
      });

      wrapper.on('error', (error) => {
        this.ctx.logger?.(`[InspectorAdapter] Wrapper process error: ${error}`);
        reject(error);
      });

      // Set timeout for the entire operation
      const timeout = setTimeout(() => {
        inspector.kill('SIGTERM');
        wrapper.kill('SIGTERM');
        reject(new Error('Inspector diagnostics timed out'));
      }, 35000);

      // Clean up timeout on completion
      const finalizeRun = (code: number | null) => {
        clearTimeout(timeout);
        this.handleCompletion(code, stdout, stderr, resolve);
      };

      inspector.on('close', (code) => {
        inspectorExited = true;
        this.ctx.logger?.(`[InspectorAdapter] MCP Inspector exited with code ${code}`);

        if (wrapperExited) {
          finalizeRun(code);
        }
      });

      wrapper.on('close', (code) => {
        wrapperExited = true;
        this.ctx.logger?.(`[InspectorAdapter] Stdio wrapper exited with code ${code}`);

        if (inspectorExited) {
          finalizeRun(code);
        }
      });
    });
  }

  private handleCompletion(
    code: number | null,
    stdout: string,
    stderr: string,
    resolve: (value: InspectorFinding[]) => void
  ): void {
    try {
      if (code === 0) {
        // Parse real Inspector output
        const findings = this.parseInspectorOutput(stdout, this.currentEndpoint, this.currentProbes);
        resolve(findings);
      } else {
        this.ctx.logger?.(`[InspectorAdapter] Inspector CLI failed with code ${code}: ${stderr}`);
        // Create findings from the error instead of rejecting
        const errorFindings = this.createErrorFindings(this.currentEndpoint, this.currentProbes, `CLI failed with code ${code}: ${stderr}`);
        resolve(errorFindings);
      }
    } catch (error) {
      this.ctx.logger?.(`[InspectorAdapter] Failed to parse Inspector output: ${error}`);
      // Fallback to simulated findings with error context
      const fallbackFindings = this.createFallbackFindings(this.currentEndpoint, this.currentProbes, `Parse error: ${error}`);
      resolve(fallbackFindings);
    }
  }

  private currentEndpoint = '';
  private currentProbes: InspectorProbeConfig[] = [];

  /**
   * Parse real MCP Inspector output and convert to InspectorFinding format
   */
  private parseInspectorOutput(
    output: string,
    endpoint: string,
    probes: InspectorProbeConfig[]
  ): InspectorFinding[] {
    const findings: InspectorFinding[] = [];
    const timestamp = Date.now();

    try {
      // Try to extract JSON from output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const inspectorData = JSON.parse(jsonMatch[0]);
        return this.convertInspectorDataToFindings(inspectorData, timestamp);
      }
    } catch (error) {
      this.ctx.logger?.(`[InspectorAdapter] JSON parsing failed, analyzing text output: ${error}`);
    }

    // Analyze text output for patterns indicating different probe results
    const lines = output.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (const probe of probes) {
      let finding: InspectorFinding | null = null;

      switch (probe.kind) {
        case 'handshake':
          finding = this.analyzeHandshakeOutput(lines, endpoint, timestamp);
          break;
        case 'security':
          finding = this.analyzeSecurityOutput(lines, endpoint, timestamp);
          break;
        case 'performance':
          finding = this.analyzePerformanceOutput(lines, endpoint, timestamp);
          break;
        case 'sse':
        case 'stream_sse':
          finding = this.analyzeSSEOutput(lines, endpoint, timestamp);
          break;
        case 'protocol':
          finding = this.analyzeProtocolOutput(lines, endpoint, timestamp);
          break;
        case 'cors_preflight':
          finding = this.analyzeCorsOutput(lines, endpoint, timestamp);
          break;
        default:
          finding = this.createGenericProbeFinding(probe.kind, lines, endpoint, timestamp);
      }

      if (finding) {
        findings.push(finding);
      }
    }

    // If no findings were generated, create a default finding
    if (findings.length === 0) {
      findings.push({
        id: `inspector_generic_${timestamp}`,
        severity: 'info',
        area: 'protocol',
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
    const findings: InspectorFinding[] = [];

    // Handle different Inspector output formats
    if (inspectorData.findings && Array.isArray(inspectorData.findings)) {
      // Direct findings array
      for (const finding of inspectorData.findings) {
        findings.push({
          id: finding.id || `inspector_${timestamp}_${findings.length}`,
          severity: finding.severity || 'info',
          area: finding.area || 'protocol',
          description: finding.description || 'Inspector finding',
          evidence: finding.evidence || { raw: finding },
          remediation: finding.remediation,
          raw: finding,
        });
      }
    } else if (inspectorData.probes) {
      // Probe-based results
      for (const [probeName, probeResult] of Object.entries(inspectorData.probes)) {
        const result: InspectorProbeResult = probeResult;
        findings.push({
          id: `probe_${probeName}_${timestamp}`,
          severity: result.status === 'passed' ? 'info' :
                   result.status === 'failed' ? 'major' : 'minor',
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
        severity: 'info',
        area: 'protocol',
        description: 'MCP Inspector analysis completed',
        evidence: { raw: inspectorData },
        raw: inspectorData,
      });
    }

    return findings;
  }

  /**
   * Analyze handshake-related output
   */
  private analyzeHandshakeOutput(lines: string[], endpoint: string, timestamp: number): InspectorFinding {
    const handshakeKeywords = ['initialize', 'protocol', 'handshake', 'connection'];
    const hasHandshake = lines.some(line =>
      handshakeKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );

    const hasErrors = lines.some(line =>
      line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')
    );

    return {
      id: `handshake_${timestamp}`,
      severity: hasErrors ? 'major' : 'info',
      area: 'protocol',
      description: hasErrors
        ? `Handshake issues detected with ${endpoint}`
        : `MCP handshake successful for ${endpoint}`,
      evidence: { raw: { lines: lines.slice(0, 10), endpoint, hasHandshake } },
    };
  }

  /**
   * Analyze security-related output
   */
  private analyzeSecurityOutput(lines: string[], endpoint: string, timestamp: number): InspectorFinding {
    const securityKeywords = ['security', 'auth', 'rate-limit', 'cors', 'headers'];
    const hasSecurityInfo = lines.some(line =>
      securityKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );

    const hasSecurityIssues = lines.some(line =>
      line.toLowerCase().includes('missing') || line.toLowerCase().includes('vulnerable')
    );

    return {
      id: `security_${timestamp}`,
      severity: hasSecurityIssues ? 'minor' : 'info',
      area: 'security',
      description: hasSecurityIssues
        ? 'Security configuration issues detected'
        : 'Security analysis completed',
      evidence: { raw: { lines: lines.slice(0, 10), hasSecurityInfo, hasSecurityIssues } },
      remediation: hasSecurityIssues ? {
        suggestion: 'Review and address security configuration issues',
      } : undefined,
    };
  }

  /**
   * Analyze performance-related output
   */
  private analyzePerformanceOutput(lines: string[], endpoint: string, timestamp: number): InspectorFinding {
    const perfKeywords = ['performance', 'response time', 'latency', 'ms', 'timeout'];
    const hasPerfInfo = lines.some(line =>
      perfKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );

    // Extract response times if present
    const timeMatches = lines.join(' ').match(/(\d+)\s*ms/g);
    const avgTime = timeMatches ?
      Math.round(timeMatches.reduce((sum, time) => sum + Number.parseInt(time, 10), 0) / timeMatches.length) :
      null;

    return {
      id: `performance_${timestamp}`,
      severity: 'info',
      area: 'perf',
      description: avgTime
        ? `Average response time: ${avgTime}ms`
        : 'Performance analysis completed',
      evidence: { raw: { lines: lines.slice(0, 10), avgTime, hasPerfInfo } },
    };
  }

  /**
   * Analyze SSE-related output
   */
  private analyzeSSEOutput(lines: string[], endpoint: string, timestamp: number): InspectorFinding {
    const sseKeywords = ['sse', 'event-source', 'streaming', 'events'];
    const hasSSEInfo = lines.some(line =>
      sseKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );

    const hasSSEErrors = lines.some(line =>
      line.toLowerCase().includes('disconnected') || line.toLowerCase().includes('failed')
    );

    return {
      id: `sse_${timestamp}`,
      severity: hasSSEErrors ? 'minor' : 'info',
      area: 'streaming',
      description: hasSSEErrors
        ? 'SSE streaming issues detected'
        : 'SSE streaming functionality operational',
      evidence: { raw: { lines: lines.slice(0, 10), hasSSEInfo, hasSSEErrors } },
    };
  }

  /**
   * Analyze protocol compliance output
   */
  private analyzeProtocolOutput(lines: string[], endpoint: string, timestamp: number): InspectorFinding {
    const protocolKeywords = ['protocol', 'compliance', 'spec', 'standard'];
    const hasProtocolInfo = lines.some(line =>
      protocolKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );

    const hasComplianceIssues = lines.some(line =>
      line.toLowerCase().includes('non-compliant') || line.toLowerCase().includes('violation')
    );

    return {
      id: `protocol_${timestamp}`,
      severity: hasComplianceIssues ? 'major' : 'info',
      area: 'protocol',
      description: hasComplianceIssues
        ? 'Protocol compliance issues detected'
        : 'MCP protocol compliance verified',
      evidence: { raw: { lines: lines.slice(0, 10), hasProtocolInfo, hasComplianceIssues } },
    };
  }

  /**
   * Analyze CORS-related output
   */
  private analyzeCorsOutput(lines: string[], endpoint: string, timestamp: number): InspectorFinding {
    const corsKeywords = ['cors', 'origin', 'preflight', 'access-control'];
    const hasCorsInfo = lines.some(line =>
      corsKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );

    const hasCorsIssues = lines.some(line =>
      line.toLowerCase().includes('blocked') || line.toLowerCase().includes('forbidden')
    );

    return {
      id: `cors_${timestamp}`,
      severity: hasCorsIssues ? 'minor' : 'info',
      area: 'cors',
      description: hasCorsIssues
        ? 'CORS configuration issues detected'
        : 'CORS configuration working correctly',
      evidence: { raw: { lines: lines.slice(0, 10), hasCorsInfo, hasCorsIssues } },
    };
  }

  /**
   * Create generic probe finding when specific analysis isn't available
   */
  private createGenericProbeFinding(probeKind: string, lines: string[], endpoint: string, timestamp: number): InspectorFinding {
    return {
      id: `probe_${probeKind}_${timestamp}`,
      severity: 'info',
      area: 'protocol',
      description: `Probe ${probeKind} executed for ${endpoint}`,
      evidence: { raw: { lines: lines.slice(0, 5), probeKind } },
    };
  }

  /**
   * Map probe names to Inspector areas
   */
  private mapProbeToArea(probeName: string): InspectorFinding['area'] {
    const areaMap: Record<string, InspectorFinding['area']> = {
      'handshake': 'protocol',
      'security': 'security',
      'performance': 'perf',
      'sse': 'streaming',
      'stream_sse': 'streaming',
      'protocol': 'protocol',
      'cors_preflight': 'cors',
      'jsonrpc_batch': 'protocol',
      'list_tools': 'schema',
      'list_resources': 'schema',
      'call_tool': 'schema',
      'schema_validate': 'schema',
    };

    return areaMap[probeName] || 'protocol';
  }

  /**
   * Create fallback findings when Inspector fails
   */
  private createFallbackFindings(endpoint: string, probes: InspectorProbeConfig[], error: string): InspectorFinding[] {
    const timestamp = Date.now();
    return [{
      id: `fallback_${timestamp}`,
      severity: 'minor',
      area: 'protocol',
      description: `MCP Inspector analysis incomplete for ${endpoint}: ${error}`,
      evidence: { raw: { endpoint, probes: probes.map(p => p.kind), error } },
    }];
  }

  /**
   * Create error findings when Inspector CLI fails
   */
  private createErrorFindings(endpoint: string, probes: InspectorProbeConfig[], error: string): InspectorFinding[] {
    const timestamp = Date.now();
    return [{
      id: `error_${timestamp}`,
      severity: 'major',
      area: 'protocol',
      description: `MCP Inspector CLI error for ${endpoint}: ${error}`,
      evidence: { raw: { endpoint, probes: probes.map(p => p.kind), error } },
      remediation: {
        suggestion: 'Check MCP Inspector installation and endpoint accessibility',
      },
    }];
  }

  private mapProbes(probeNames: string[]): InspectorProbeConfig[] {
    return probeNames.map(name => ({
      kind: name as InspectorProbeConfig['kind'],
      args: {},
    }));
  }

  private mapInspectorArea(inspectorArea: string): Finding['area'] {
    const areaMap: Record<string, Finding['area']> = {
      'protocol': 'protocol',
      'schema': 'protocol',
      'auth': 'security',
      'streaming': 'performance',
      'cors': 'protocol',
      'proxy': 'performance',
      'perf': 'performance',
      'security': 'security',
    };

    return areaMap[inspectorArea] || 'protocol';
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
