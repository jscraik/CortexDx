import { InspectorAdapter } from "../../adapters/inspector-adapter.js";
import { getEnhancedLlmAdapter } from "../../ml/router.js";
import type {
  ChatMessage,
  DevelopmentContext,
  DevelopmentPlugin,
  Finding,
  ProjectContext,
} from "../../types.js";

const HANDSHAKE_FILE_OPTIONS: Array<readonly [string, ...string[]]> = [
  [
    "packages/insula-mcp/src/adapters/jsonrpc.ts",
    "packages/cortexdx/src/adapters/jsonrpc.ts",
  ],
  [
    "packages/insula-mcp/src/adapters/sse.ts",
    "packages/cortexdx/src/adapters/sse.ts",
  ],
];

const REQUIRED_DEPENDENCIES = [
  "@modelcontextprotocol/sdk",
  "eventsource-parser",
];

const SIGNAL_KEYWORDS = [
  { key: "sse", pattern: /sse/i, label: "SSE streaming issues" },
  { key: "batch", pattern: /batch/i, label: "JSON-RPC batch issues" },
  { key: "handshake", pattern: /handshake|initialize/i, label: "Handshake gaps" },
];

function evaluateHandshake(project?: ProjectContext): Finding | null {
  const files = project?.sourceFiles ?? [];
  if (files.length === 0) return null;
  const fileSet = new Set(files);
  const missing = HANDSHAKE_FILE_OPTIONS.flatMap((options) =>
    options.some((candidate) => fileSet.has(candidate)) ? [] : [options[0]]
  );
  if (missing.length === 0) return null;
  return {
    id: "self_improvement.handshake_gaps",
    area: "development",
    severity: "major",
    title: "Handshake instrumentation incomplete",
    description: `Missing critical adapter files: ${missing.join(", ")}`,
    evidence: missing.map((ref) => ({ type: "file" as const, ref })),
    recommendation:
      "Wire initialize/session tracking through the JSON-RPC and SSE adapters before re-running diagnostics.",
    tags: ["self-improvement", "handshake"],
  };
}

function evaluateDependencies(project?: ProjectContext): Finding | null {
  const deps = project?.dependencies ?? [];
  if (deps.length === 0) return null;
  const missing = REQUIRED_DEPENDENCIES.filter((dep) => !deps.includes(dep));
  if (missing.length === 0) return null;
  return {
    id: "self_improvement.dependency_gaps",
    area: "development",
    severity: "minor",
    title: "Missing inspector dependencies",
    description: `Recommended packages not detected: ${missing.join(", ")}`,
    evidence: [{ type: "log", ref: JSON.stringify(deps.slice(0, 10)) }],
    recommendation: "Install the missing packages to enable protocol replay hooks.",
    tags: ["self-improvement", "dependencies"],
  };
}

function summarizeSignals(history: ChatMessage[]): Finding | null {
  if (history.length === 0) return null;
  const counters: Record<string, number> = {};
  for (const entry of history) {
    for (const keyword of SIGNAL_KEYWORDS) {
      if (keyword.pattern.test(entry.content)) {
        counters[keyword.key] = (counters[keyword.key] ?? 0) + 1;
      }
    }
  }
  const flagged = Object.entries(counters);
  if (flagged.length === 0) return null;
  const summary = flagged
    .map(([key, count]) => {
      const label = SIGNAL_KEYWORDS.find((item) => item.key === key)?.label ?? key;
      return `${label}: ${count}`;
    })
    .join("; ");
  return {
    id: "self_improvement.signal_digest",
    area: "development",
    severity: "info",
    title: "Repeated inspector signals detected",
    description: summary,
    evidence: history.slice(-5).map((msg) => ({
      type: "log" as const,
      ref: `${msg.role}: ${msg.content.slice(0, 140)}`,
    })),
    tags: ["self-improvement", "signals"],
  };
}

async function probeHealth(
  ctx: DevelopmentContext,
): Promise<Finding | null> {
  if (!ctx.endpoint) return null;
  const base = ctx.endpoint.replace(/\/$/, "");
  try {
    const health = await ctx.request(`${base}/health`, { method: "GET" });
    return {
      id: "self_improvement.health",
      area: "development",
      severity: "info",
      title: "Inspector health probe",
      description: JSON.stringify(health),
      evidence: [{ type: "url", ref: `${base}/health` }],
      tags: ["self-improvement", "health"],
    };
  } catch (error) {
    return {
      id: "self_improvement.health_unreachable",
      area: "development",
      severity: "minor",
      title: "Inspector health probe failed",
      description: `Unable to query ${base}/health: ${String(error)}`,
      evidence: [{ type: "url", ref: `${base}/health` }],
      tags: ["self-improvement", "health"],
    };
  }
}

export async function analyzeWithLLM(
  findings: Finding[],
  ctx: DevelopmentContext
): Promise<Finding[]> {
  const startTime = Date.now();
  const adapter = await getEnhancedLlmAdapter();

  if (!adapter) {
    ctx.logger?.("[Self-Improvement] LLM not available, returning raw findings");
    return findings;
  }

  const analyzedFindings: Finding[] = [];

  for (const finding of findings) {
    const findingStartTime = Date.now();

    try {
      ctx.logger?.(`[Self-Improvement] Analyzing finding with LLM: ${finding.id}`);

      const prompt = `
You are CortexDx's self-healing AI assistant. Analyze this Inspector finding and provide CortexDx-specific guidance.

Inspector Finding:
${JSON.stringify(finding, null, 2)}

Current CortexDx Context:
- Project Files: ${ctx.projectContext?.sourceFiles?.slice(0, 10).join(', ') || 'unknown'}
- Dependencies: ${ctx.projectContext?.dependencies?.slice(0, 10).join(', ') || 'unknown'}
- Language: ${ctx.projectContext?.language || 'typescript'}
- Expertise Level: ${ctx.userExpertiseLevel || 'intermediate'}

Provide analysis in JSON format with these REQUIRED fields:
{
  "rootCause": "Specific cause in CortexDx's codebase (REQUIRED)",
  "filesToModify": ["file1.ts", "file2.ts"],
  "codeChanges": "Actual code changes needed with line numbers and context",
  "validationSteps": ["step1: specific validation action", "step2: verification command"],
  "riskLevel": "low|medium|high",
  "templateId": "template.identifier or null",
  "canAutoFix": true/false
}

IMPORTANT: Provide specific, actionable code changes with file paths and line numbers. Include validation commands that can be executed.
`;

      const analysis = await adapter.complete(prompt, 2000);
      const findingDuration = Date.now() - findingStartTime;

      let analysisData: {
        rootCause?: string;
        filesToModify?: string[];
        codeChanges?: string;
        validationSteps?: string[];
        riskLevel?: 'low' | 'medium' | 'high';
        templateId?: string | null;
        canAutoFix?: boolean;
      } = {};

      // Try to parse JSON response
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = analysis.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        const jsonStr = jsonMatch?.[1] ?? analysis;
        analysisData = JSON.parse(jsonStr);

        // Validate required fields
        if (!analysisData.rootCause) {
          throw new Error("Missing required field: rootCause");
        }

        ctx.logger?.(`[Self-Improvement] Successfully parsed LLM analysis for ${finding.id} in ${findingDuration}ms`);
      } catch (parseError) {
        ctx.logger?.(`[Self-Improvement] Failed to parse LLM response as JSON for ${finding.id}:`, parseError);

        // Fallback: extract what we can from text
        analysisData = {
          rootCause: analysis.slice(0, 500),
          filesToModify: extractFilePaths(analysis),
          codeChanges: analysis,
          validationSteps: extractValidationSteps(analysis),
          riskLevel: "medium",
          templateId: null,
          canAutoFix: false,
        };
      }

      // Enhance finding with LLM analysis
      const enhancedFinding: Finding = {
        ...finding,
        llmAnalysis: analysis,
        rootCause: analysisData.rootCause,
        filesToModify: analysisData.filesToModify || [],
        codeChanges: analysisData.codeChanges || "",
        validationSteps: analysisData.validationSteps || [],
        riskLevel: analysisData.riskLevel || "medium",
        templateId: analysisData.templateId ?? undefined,
        canAutoFix: analysisData.canAutoFix ?? false,
        tags: [...(finding.tags || []), 'llm-analyzed'],
      };

      analyzedFindings.push(enhancedFinding);
      ctx.logger?.(`[Self-Improvement] Enhanced finding ${finding.id} with LLM analysis (${findingDuration}ms)`);

    } catch (error) {
      const findingDuration = Date.now() - findingStartTime;
      ctx.logger?.(`[Self-Improvement] LLM analysis failed for ${finding.id} after ${findingDuration}ms:`, error);
      // Return original finding if analysis fails
      analyzedFindings.push(finding);
    }
  }

  const totalDuration = Date.now() - startTime;
  ctx.logger?.(`[Self-Improvement] Completed LLM analysis of ${findings.length} findings in ${totalDuration}ms`);

  // Verify performance requirement: <15s per finding (Req 15.5)
  const avgDuration = totalDuration / findings.length;
  if (avgDuration > 15000) {
    ctx.logger?.(`[Self-Improvement] WARNING: Average LLM analysis time (${avgDuration}ms) exceeds 15s requirement`);
  }

  return analyzedFindings;
}

// Helper function to extract file paths from text
function extractFilePaths(text: string): string[] {
  const pathPattern = /(?:packages\/[\w-]+\/)?src\/[\w/-]+\.ts/g;
  const matches = text.match(pathPattern);
  return matches ? [...new Set(matches)] : [];
}

// Helper function to extract validation steps from text
function extractValidationSteps(text: string): string[] {
  const steps: string[] = [];

  // Look for numbered lists
  const numberedPattern = /\d+\.\s+([^\n]+)/g;
  let match: RegExpExecArray | null = numberedPattern.exec(text);
  while (match) {
    if (match[1]) {
      steps.push(match[1].trim());
    }
    match = numberedPattern.exec(text);
  }

  // Look for bullet points if no numbered list found
  if (steps.length === 0) {
    const bulletPattern = /[-*]\s+([^\n]+)/g;
    match = bulletPattern.exec(text);
    while (match) {
      if (match[1]) {
        steps.push(match[1].trim());
      }
      match = bulletPattern.exec(text);
    }
  }

  return steps.slice(0, 5); // Limit to 5 steps
}

async function runInspectorDiagnostics(ctx: DevelopmentContext): Promise<Finding[]> {
  const inspector = new InspectorAdapter(ctx);

  try {
    ctx.logger?.("[Self-Improvement] Running MCP Inspector self-diagnosis");
    const report = await inspector.selfDiagnose();

    // Convert Inspector findings to CortexDx format
    const cortexdxFindings = inspector.convertFindings(report.findings);

    ctx.logger?.(`[Self-Improvement] Inspector found ${cortexdxFindings.length} issues`);
    return cortexdxFindings;

  } catch (error) {
    ctx.logger?.("[Self-Improvement] Inspector self-diagnosis failed:", error);

    return [{
      id: "self_improvement.inspector_failed",
      area: "development",
      severity: "minor",
      title: "Inspector self-diagnosis unavailable",
      description: `MCP Inspector integration failed: ${String(error)}`,
      evidence: [{ type: "log" as const, ref: String(error) }],
      tags: ["self-improvement", "inspector-failed"],
    }];
  }
}

export const SelfImprovementPlugin: DevelopmentPlugin = {
  id: "self-improvement",
  title: "Internal Self-Improvement Diagnostics",
  category: "development",
  order: 15,
  requiresLlm: true, // Now requires LLM for enhanced analysis
  async run(ctx) {
    let findings: Finding[] = [];

    // 1. Run Inspector diagnostics first (most comprehensive)
    const inspectorFindings = await runInspectorDiagnostics(ctx);
    findings.push(...inspectorFindings);

    // 2. Run traditional self-improvement checks
    const handshake = evaluateHandshake(ctx.projectContext);
    if (handshake) findings.push(handshake);

    const deps = evaluateDependencies(ctx.projectContext);
    if (deps) findings.push(deps);

    const signalSummary = summarizeSignals(ctx.conversationHistory || []);
    if (signalSummary) findings.push(signalSummary);

    const health = await probeHealth(ctx);
    if (health) findings.push(health);

    const transport = summarizeTransport(ctx);
    if (transport) findings.push(transport);

    // 3. Analyze findings with LLM for enhanced insights
    if (findings.length > 0) {
      findings = await analyzeWithLLM(findings, ctx);
    }

    if (findings.length === 0) {
      findings.push({
        id: "self_improvement.ok",
        area: "development",
        severity: "info",
        title: "Internal diagnostics baseline satisfied",
        description:
          "All tracked adapters and dependencies are present; no repeated failure signals detected.",
        evidence: [],
        tags: ["self-improvement"],
      });
    }

    return findings;
  },
};

function summarizeTransport(ctx: DevelopmentContext): Finding | null {
  const transcript = ctx.transport?.transcript();
  if (!transcript) return null;
  const exchangeCount = transcript.exchanges.length;
  const initializeSummary = transcript.initialize
    ? `Initialize -> status ${transcript.initialize.status ?? "unknown"}`
    : "Initialize missing";
  return {
    id: "self_improvement.transport_transcript",
    area: "development",
    severity: "info",
    title: "Inspector transport transcript captured",
    description: `${initializeSummary}; ${exchangeCount} follow-up exchanges.`,
    evidence: [
      {
        type: "log",
        ref: JSON.stringify(
          {
            sessionId: transcript.sessionId,
            initialize: (transcript.initialize?.response as { result?: unknown })?.result ?? null,
            exchanges: transcript.exchanges.slice(-3),
          },
          null,
          2,
        ).slice(0, 500),
      },
    ],
    tags: ["self-improvement", "transport"],
  };
}
