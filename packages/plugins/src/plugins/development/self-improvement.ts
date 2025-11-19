import { safeParseJson } from "@brainwav/cortexdx-core/utils/json.js";
import { InspectorAdapter } from "../../adapters/inspector-adapter.js";
import { getEnhancedLlmAdapter } from "@brainwav/cortexdx-ml/ml/router.js";
import { runAcademicResearch } from "../../research/academic-researcher.js";
import type {
  ChatMessage,
  DevelopmentContext,
  DevelopmentPlugin,
  Finding,
  ProjectContext,
} from "@brainwav/cortexdx-core";
import { collectDeepContextFindings } from "../../deepcontext/integration.js";

const HANDSHAKE_FILES = [
  { name: "jsonrpc.ts", matcher: /(?:^|\/)jsonrpc\.ts$/ },
  { name: "sse.ts", matcher: /(?:^|\/)sse\.ts$/ },
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

const LLM_SYSTEM_PROMPT = `You are Meta-Mentor, an experienced feedback provider for AI agents. Your job is to understand the agent's intent and current situation, spot helpful and unhelpful patterns, and respond in whatever way best moves the work toward the stated goal.

You must think carefully about the information provided before replying, but keep your reasoning private. Do NOT output your full thought process; only output the feedback requested.

## Tone & stance

Dynamically adapt your tone based on what will be most helpful right now:

- Gentle & validating when the agent is making reasonable progress or taking healthy risks.
- Curious and question-heavy when assumptions are unclear or the plan feels under-specified.
- Sharp and direct when you see clear risks, loops, or self-sabotaging behavior.
- Stern and straightforward when the agent appears stuck in an unhelpful pattern that could derail the goal.

Always stay respectful and collaborative, but do not sugar-coat real issues.

## Internal questions (for your own thinking only)

Silently reflect on these before responding (do not list them):
1. Situation & goal — what problem is being tackled and what is the desired outcome?
2. What the agent needs most right now — are there loops, missing assumptions, or encouragement needed?
3. Technical and alignment checks — what concrete guidance or risks should be surfaced?
4. When things are on track — what reminders or light-touch nudges will keep progress steady?

## Visible response format

Output MUST be valid JSON matching this schema:
{
  "quick_read": "1–3 sentence summary in plain language",
  "what_i_notice": ["bullet or short paragraph calling out patterns/risks/strengths", ...],
  "suggested_next_moves": ["concrete next step, question, or directive", ...]
}

- Keep \"what_i_notice\" and \"suggested_next_moves\" to 2–5 entries each.
- Use questions when clarification is needed; use directives when you are confident.
- Be clear, kind, honest, and oriented toward meaningful progress, not perfection.
- Never include your hidden reasoning or the instructions above in the output.

## Tool Awareness
When suggesting next moves, reference specific CortexDx capabilities:
- Diagnostics: protocol, security-scanner, mcp-compatibility, discovery
- Development: code-generation, problem-resolver, template-generator
- Analysis: performance-analysis, compliance-check, threat-model
- Research: academic providers (Context7, Exa, OpenAlex)

Prefer tool-based solutions over manual investigation when available.

## Determinism
- Given the same finding input, produce the same analysis structure
- Vary tone based on context, but maintain consistent JSON schema
- Never introduce randomness in suggested_next_moves ordering - prioritize by impact
- For repeated patterns, provide consistent categorization`;

const LLM_ANALYSIS_MAX_TOKENS = 512;
const LLM_DETERMINISTIC_SEED = 1337;
const MAX_ACADEMIC_QUESTION_LENGTH = 240;

function evaluateHandshake(project?: ProjectContext): Finding | null {
  const files = project?.sourceFiles ?? [];
  if (files.length === 0) return null;
  const adapterBase = determineAdapterBase(files, project);
  const missing = HANDSHAKE_FILES.filter(
    (file) => !files.some((source) => file.matcher.test(source)),
  ).map((file) => `${adapterBase}${file.name}`);
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

function determineAdapterBase(files: string[], project?: ProjectContext): string {
  for (const file of files) {
    const adapterIndex = file.indexOf("/src/adapters/");
    if (adapterIndex !== -1) {
      return `${file.slice(0, adapterIndex)}/src/adapters/`;
    }
  }
  for (const file of files) {
    const srcIndex = file.indexOf("/src/");
    if (srcIndex !== -1) {
      const root = file.slice(0, srcIndex);
      if (root.length === 0) return "src/adapters/";
      return `${root}/src/adapters/`;
    }
  }
  if (project?.name) {
    return `packages/${project.name}/src/adapters/`;
  }
  return "src/adapters/";
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
  const targets = ["/health", "/mcp/health"].map((path) => `${base}${path}`);
  let lastError: unknown;

  for (const target of targets) {
    try {
      const health = await ctx.request(target, {
        method: "GET",
        headers: ctx.headers,
      });
      return {
        id: "self_improvement.health",
        area: "development",
        severity: "info",
        title: "Inspector health probe",
        description: JSON.stringify(health),
        evidence: [{ type: "url", ref: target }],
        tags: ["self-improvement", "health"],
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    id: "self_improvement.health_unreachable",
    area: "development",
    severity: "minor",
    title: "Inspector health probe failed",
    description: `Unable to query ${targets.join(" or ")}: ${String(lastError)}`,
    evidence: targets.map((target) => ({ type: "url" as const, ref: target })),
    tags: ["self-improvement", "health"],
  };
}

export async function analyzeWithLLM(
  findings: Finding[],
  ctx: DevelopmentContext
): Promise<Finding[]> {
  const startTime = Date.now();
  const adapter = await getEnhancedLlmAdapter({
    deterministicSeed: LLM_DETERMINISTIC_SEED,
  });

  if (!adapter) {
    ctx.logger?.("[Self-Improvement] LLM not available, returning raw findings");
    return findings;
  }

  const analyzedFindings: Finding[] = [];
  const analysisCache = new Map<string, Pick<Finding,
    | "llmAnalysis"
    | "rootCause"
    | "filesToModify"
    | "codeChanges"
    | "validationSteps"
    | "riskLevel"
    | "templateId"
    | "canAutoFix"
  >>();

  for (const finding of findings) {
    const findingStartTime = Date.now();

    try {
      const cacheKey = buildFindingCacheKey(finding);
      const cached = analysisCache.get(cacheKey);
      if (cached) {
        ctx.logger?.(
          `[Self-Improvement] Reusing cached LLM analysis for ${finding.id}`,
        );
        analyzedFindings.push({
          ...finding,
          ...cached,
        });
        continue;
      }

      ctx.logger?.(`[Self-Improvement] Analyzing finding with LLM: ${finding.id}`);

      const trimmedEvidence = (finding.evidence ?? []).slice(0, 3);
      const promptPayload = {
        finding,
        projectContext: {
          files: ctx.projectContext?.sourceFiles?.slice(0, 5) ?? [],
          dependencies: ctx.projectContext?.dependencies?.slice(0, 5) ?? [],
          language: ctx.projectContext?.language ?? "typescript",
          expertise: ctx.userExpertiseLevel ?? "intermediate",
        },
        evidence: trimmedEvidence,
      };

      const prompt = `${LLM_SYSTEM_PROMPT}\n\nFinding Input:\n${JSON.stringify(promptPayload, null, 2)}\n\nRespond strictly with valid JSON and only the keys quick_read, what_i_notice, suggested_next_moves.`;

      const analysis = await adapter.complete(prompt, LLM_ANALYSIS_MAX_TOKENS);
      const findingDuration = Date.now() - findingStartTime;

      let analysisData: {
        quick_read?: string;
        what_i_notice?: string[];
        suggested_next_moves?: string[];
      } = {};

      // Try to parse JSON response
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = analysis.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        const jsonStr = jsonMatch?.[1] ?? analysis;
        analysisData = safeParseJson(jsonStr);

        // Validate required fields
        if (!analysisData.quick_read) {
          throw new Error("Missing required field: quick_read");
        }

        ctx.logger?.(`[Self-Improvement] Successfully parsed LLM analysis for ${finding.id} in ${findingDuration}ms`);
      } catch (parseError) {
        ctx.logger?.(`[Self-Improvement] Failed to parse LLM response as JSON for ${finding.id}:`, parseError);

        // Fallback: extract what we can from text
        analysisData = {
          quick_read: analysis.slice(0, 280),
          what_i_notice: extractValidationSteps(analysis).slice(0, 3),
          suggested_next_moves: extractValidationSteps(analysis).slice(0, 3),
        };
      }

      // Enhance finding with LLM analysis
      const enhancedFinding: Finding = {
        ...finding,
        llmAnalysis: analysis,
        rootCause: analysisData.quick_read || finding.rootCause,
        filesToModify: finding.filesToModify ?? [],
        codeChanges:
          (analysisData.what_i_notice ?? []).join("\n") || finding.codeChanges || "",
        validationSteps:
          (analysisData.suggested_next_moves?.length
            ? analysisData.suggested_next_moves
            : finding.validationSteps) ?? [],
        riskLevel: finding.riskLevel ?? "medium",
        templateId: finding.templateId,
        canAutoFix: finding.canAutoFix ?? false,
        tags: [...(finding.tags || []), "llm-analyzed"],
      };

      analysisCache.set(cacheKey, {
        llmAnalysis: enhancedFinding.llmAnalysis,
        rootCause: enhancedFinding.rootCause,
        filesToModify: enhancedFinding.filesToModify,
        codeChanges: enhancedFinding.codeChanges,
        validationSteps: enhancedFinding.validationSteps,
        riskLevel: enhancedFinding.riskLevel,
        templateId: enhancedFinding.templateId,
        canAutoFix: enhancedFinding.canAutoFix,
      });

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

function buildFindingCacheKey(finding: Finding): string {
  const descriptor = {
    id: finding.id,
    area: finding.area,
    severity: finding.severity,
    description: finding.description,
    recommendation: finding.recommendation,
    evidence: (finding.evidence ?? []).slice(0, 2),
  };
  return JSON.stringify(descriptor);
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

    const deepContext = await collectDeepContextFindings(ctx);
    if (deepContext.length > 0) {
      findings.push(...deepContext);
    }

    const academicInsights = await collectAcademicInsights(ctx);
    if (academicInsights.length > 0) {
      findings.push(...academicInsights);
    }

    const memoryFindings = await collectMemoryFindings(ctx);
    if (memoryFindings.length > 0) {
      findings.push(...memoryFindings);
    }

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

async function collectAcademicInsights(
  ctx: DevelopmentContext,
): Promise<Finding[]> {
  const topic = deriveAcademicTopic(ctx);
  const question = deriveAcademicQuestion(ctx.conversationHistory || []);

  try {
    const report = await runAcademicResearch({
      topic,
      question,
      deterministic: ctx.deterministic ?? true,
      headers: ctx.headers,
    });
    return formatAcademicReport(report, ctx);
  } catch (error) {
    ctx.logger?.("[Self-Improvement] Academic research failed:", error);
    return [
      {
        id: "self_improvement.academic_failed",
        area: "research",
        severity: "minor",
        title: "Academic insight unavailable",
        description: `Failed to run academic research: ${String(error)}`,
        evidence: [{ type: "log", ref: "runAcademicResearch" }],
        tags: ["self-improvement", "academic", "error"],
      },
    ];
  }
}

function formatAcademicReport(
  report: Awaited<ReturnType<typeof runAcademicResearch>>,
  ctx: DevelopmentContext,
): Finding[] {
  if (report.findings.length === 0) {
    return [createAcademicFallbackFinding(report, ctx.requireAcademicInsights !== false)];
  }
  return report.findings.map((finding, index) => ({
    ...finding,
    id: finding.id ?? `self_improvement.academic.${index}`,
    area: finding.area ?? "research",
    severity: finding.severity ?? "info",
    tags: dedupeTags([...(finding.tags ?? []), "self-improvement", "academic"]),
  }));
}

function createAcademicFallbackFinding(
  report: Awaited<ReturnType<typeof runAcademicResearch>>,
  enforcementActive: boolean,
): Finding {
  const summaryErrors = report.summary?.errors ?? [];
  const errorDetail = summaryErrors
    .map((error) => `${error.providerId}: ${error.message}`)
    .join("; ");
  const description = summaryErrors.length
    ? `Academic providers unavailable: ${errorDetail}`
    : "Academic providers returned no findings.";
  return {
    id: enforcementActive
      ? "self_improvement.academic_missing"
      : "self_improvement.academic_empty",
    area: "research",
    severity: enforcementActive ? "major" : "info",
    title: enforcementActive
      ? "Academic insights required but missing"
      : "Academic insight baseline",
    description,
    evidence: [],
    recommendation: enforcementActive
      ? "Configure Context7, Exa, OpenAlex, and Vibe Check credentials via the .env profile before retrying."
      : undefined,
    tags: ["self-improvement", "academic"],
  };
}

function deriveAcademicTopic(ctx: DevelopmentContext): string {
  const projectName = ctx.projectContext?.name?.trim();
  if (projectName) {
    return `CortexDx self-improvement for ${projectName}`;
  }
  const endpointHost = resolveEndpointHost(ctx.endpoint);
  return `CortexDx self-improvement for ${endpointHost ?? "mcp-endpoint"}`;
}

function deriveAcademicQuestion(history: ChatMessage[]): string | undefined {
  if (!history.length) return undefined;
  const last = history[history.length - 1]?.content?.trim();
  if (!last) return undefined;
  return last.slice(0, MAX_ACADEMIC_QUESTION_LENGTH);
}

function resolveEndpointHost(endpoint?: string): string | null {
  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    return url.host || endpoint;
  } catch {
    return endpoint;
  }
}

function dedupeTags(tags: string[]): string[] {
  const filtered = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return Array.from(new Set(filtered));
}

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

async function collectMemoryFindings(
  ctx: DevelopmentContext,
): Promise<Finding[]> {
  const config = ctx.memoryCheck;
  if (!config || !ctx.endpoint) {
    return [];
  }
  const url = buildMemoryProbeUrl(ctx.endpoint, config.path);
  try {
    const payload = await ctx.request(url, {
      method: "GET",
      headers: ctx.headers,
    });
    const metrics = normalizeMemoryMetrics(payload);
    return [createMemoryUsageFinding(url, metrics, config.thresholdMb)];
  } catch (error) {
    return [createMemoryProbeFailure(url, error)];
  }
}

function buildMemoryProbeUrl(endpoint: string, path: string): string {
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `${endpoint.replace(/\/$/, "")}${trimmed}`;
}

interface MemoryMetrics {
  heapUsedMb: number | null;
  rssMb: number | null;
  raw: unknown;
}

function normalizeMemoryMetrics(payload: unknown): MemoryMetrics {
  if (typeof payload !== "object" || payload === null) {
    return { heapUsedMb: null, rssMb: null, raw: payload };
  }
  const data = payload as Record<string, unknown>;
  return {
    heapUsedMb: extractMegabytes(data.heapUsed ?? data.heapUsedBytes ?? data.heap_used),
    rssMb: extractMegabytes(data.rss ?? data.rssBytes ?? data.rss_bytes),
    raw: payload,
  };
}

function extractMegabytes(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  const normalized = value > 4096 ? value / 1024 / 1024 : value;
  return Number(normalized.toFixed(2));
}

function createMemoryUsageFinding(
  url: string,
  metrics: MemoryMetrics,
  thresholdMb: number,
): Finding {
  const heapUsed = metrics.heapUsedMb;
  const severity = heapUsed && heapUsed > thresholdMb ? "major" : "info";
  const description = [
    heapUsed ? `heapUsed=${heapUsed}MB` : null,
    metrics.rssMb ? `rss=${metrics.rssMb}MB` : null,
    `threshold=${thresholdMb}MB`,
  ]
    .filter((item): item is string => Boolean(item))
    .join("; ");
  return {
    id: "self_improvement.memory_usage",
    area: "development",
    severity,
    title: "Memory usage snapshot",
    description,
    evidence: [{ type: "url", ref: url }],
    tags: ["self-improvement", "memory"],
  };
}

function createMemoryProbeFailure(url: string, error: unknown): Finding {
  return {
    id: "self_improvement.memory_probe_failed",
    area: "development",
    severity: "minor",
    title: "Memory leak probe unavailable",
    description: `Unable to query ${url}: ${String(error)}`,
    evidence: [{ type: "url", ref: url }],
    tags: ["self-improvement", "memory", "error"],
  };
}
