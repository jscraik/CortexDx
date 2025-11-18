import fs from "node:fs";
import path from "node:path";
import type { NormalizedFinding } from "./findings.js";
import { getOllamaEndpoint, resolveModelTag } from "./ollama-config.js";
import type { PromptCache } from "./prompt-cache.js";

const PROMPT_VERSION = "2025-11-09";

export interface ReasonerOptions {
  model: string;
  deterministic: boolean;
  cache: PromptCache;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export async function generateReasoningSummary(
  findings: NormalizedFinding[],
  options: ReasonerOptions,
): Promise<string> {
  const normalized = [...findings].sort((a, b) => a.id.localeCompare(b.id));
  const { alias, tag } = resolveModelTag(options.model);
  const prompt = buildPrompt(normalized);
  const cacheKey = options.cache.computeKey({
    version: PROMPT_VERSION,
    model: tag,
    alias,
    findings: normalized.map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      source: finding.source,
      file: finding.location?.file ?? null,
    })),
    system: prompt.system,
    user: prompt.user,
  });

  const cached = options.cache.read(cacheKey);
  if (cached) {
    return cached;
  }

  if (options.deterministic) {
    throw new Error(
      "Deterministic mode requires cached reasoning output. Run once without --deterministic to seed the cache.",
    );
  }

  const endpoint = options.endpoint ?? getOllamaEndpoint();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    throw new Error(
      "fetch is not available in this runtime; unable to reach Ollama.",
    );
  }

  let origin: "ollama" | "fallback" = "ollama";
  let summary: string;
  try {
    summary = await callOllama(fetchImpl, endpoint, tag, prompt);
  } catch (error) {
    origin = "fallback";
    summary = buildFallbackSummary(normalized, tag, error);
  }

  options.cache.write(cacheKey, summary);
  writePromptRecord(cacheKey, {
    alias,
    model: tag,
    endpoint,
    deterministic: options.deterministic,
    origin,
    findings,
    prompt,
    cacheDir: options.cache.getDirectory(),
  });
  return summary;
}

interface PromptSections {
  system: string;
  user: string;
  final: string;
}

function buildPrompt(findings: NormalizedFinding[]): PromptSections {
  const severityCounts = tallySeverities(findings);
  const system = `You are CortexDx's internal safety and remediation partner.

## Output Requirements
Produce factual, objective analysis with this EXACT structure:

### Health Summary
[1-2 paragraphs, ≤4 sentences each, describing overall system state]

### Priority Actions
[Numbered list, max 5 items, ordered by severity: critical > major > minor]
Format each as: "[SEVERITY] Finding ID: Specific action to take"

### Tool Recommendations
[List CortexDx tools/plugins to run for remediation]

## Behavioral Rules
- Reference finding IDs and source files in every recommendation
- For critical findings: include immediate mitigation steps
- For security findings: prioritize over performance issues
- When plugins failed or returned empty: explicitly call out which ones and why
- Use imperative verbs: "Run", "Update", "Configure", "Validate"

## Constraints
- Never recommend actions you cannot verify are safe
- If evidence is incomplete, state what additional diagnostics are needed`;

  const lines: string[] = [
    `Run version: ${PROMPT_VERSION}`,
    `Findings analysed: ${findings.length}`,
    `Critical: ${severityCounts.critical} • Major: ${severityCounts.major} • Minor: ${severityCounts.minor} • Info: ${severityCounts.info}`,
    "",
    "Top findings:",
  ];

  for (const finding of findings.slice(0, 20)) {
    // Create finding lines and filter out empty ones
    const findingLines = [
      `- [${finding.severity.toUpperCase()}] ${finding.id} • ${finding.source} • ${finding.title}`,
      finding.location?.file ? `  file: ${finding.location.file}` : "",
      finding.recommendation
        ? `  recommendation: ${finding.recommendation}`
        : "",
    ].filter((line) => line !== "");

    lines.push(...findingLines);
  }

  const user = [
    lines.filter(Boolean).join("\n"),
    "",
    "Provide:",
    "1. One paragraph summarising overall health.",
    "2. Bullet list of the top 3 remediation priorities referencing finding ids.",
    "3. Explicit call-out if any plugin failed or returned empty findings.",
  ].join("\n");

  return {
    system,
    user,
    final: `${system}\n\n${user}`,
  };
}

async function callOllama(
  fetchImpl: typeof fetch,
  endpoint: string,
  model: string,
  prompt: PromptSections,
): Promise<string> {
  const url = new URL("/api/generate", endpoint).toString();
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: prompt.final,
      stream: false,
      options: {
        temperature: 0,
        top_p: 1,
        repeat_penalty: 1.1,
        seed: 42,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}`);
  }
  const data = (await response.json()) as { response?: string };
  const text = data.response?.trim();
  if (!text) {
    throw new Error("Ollama returned an empty response");
  }
  return text;
}

function buildFallbackSummary(
  findings: NormalizedFinding[],
  model: string,
  error: unknown,
): string {
  const severityCounts = tallySeverities(findings);
  const details = [
    `Model ${model} analysed ${findings.length} findings`,
    `Critical: ${severityCounts.critical}`,
    `Major: ${severityCounts.major}`,
    `Minor: ${severityCounts.minor}`,
    `Info: ${severityCounts.info}`,
    `Reasoner fallback invoked due to: ${error instanceof Error ? error.message : String(error)}`,
  ];
  if (findings.length > 0) {
    details.push(
      "",
      "Top findings:",
      ...findings
        .slice(0, 5)
        .map((f) => `- ${f.id} (${f.severity}) ${f.title}`),
    );
  } else {
    details.push("No findings reported; system appears healthy.");
  }
  return details.join("\n");
}

function tallySeverities(findings: NormalizedFinding[]) {
  return findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { info: 0, minor: 0, major: 0, critical: 0 },
  );
}

interface PromptRecordContext {
  alias: string;
  model: string;
  endpoint: string;
  deterministic: boolean;
  origin: "ollama" | "fallback";
  findings: NormalizedFinding[];
  prompt: PromptSections;
  cacheDir: string;
}

function writePromptRecord(key: string, ctx: PromptRecordContext) {
  const recordLines = [
    `key: ${key}`,
    `version: ${PROMPT_VERSION}`,
    "backend: ollama",
    `model_alias: ${ctx.alias}`,
    `model_tag: ${ctx.model}`,
    `endpoint: ${ctx.endpoint}`,
    `deterministic: ${ctx.deterministic ? "true" : "false"}`,
    `origin: ${ctx.origin}`,
    `generated_at: ${new Date().toISOString()}`,
    `findings_total: ${ctx.findings.length}`,
    "findings_sample:",
    ...ctx.findings.slice(0, 10).map((finding) => `  - ${finding.id}`),
    "prompt_system: |",
    indent(ctx.prompt.system),
    "prompt_user: |",
    indent(ctx.prompt.user),
  ];
  const recordPath = path.join(ctx.cacheDir, `${key}.yaml`);
  fs.writeFileSync(recordPath, `${recordLines.join("\n")}\n`, "utf-8");
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
