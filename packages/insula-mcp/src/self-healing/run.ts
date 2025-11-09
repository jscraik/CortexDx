import fs from "node:fs";
import path from "node:path";
import type { NormalizedFinding } from "./findings.js";
import { runSelfHealingGraph } from "./graph.js";
import { PromptCache } from "./prompt-cache.js";
import { generateReasoningSummary } from "./ollama-reasoner.js";

export interface SelfHealingRunOptions {
  outputDir: string;
  deterministic: boolean;
  model: string;
  plugins: string[];
  timestamp: string;
  dryRun: boolean;
  endpoint: string;
}

export interface RunResult {
  summaryPath: string;
  markdownPath: string;
}

export async function executeSelfHealingRun(options: SelfHealingRunOptions): Promise<RunResult> {
  fs.mkdirSync(options.outputDir, { recursive: true });

  const graphResult = await runSelfHealingGraph({
    plugins: options.plugins,
    endpoint: options.endpoint,
    deterministic: options.deterministic,
  });
  const normalizedFindings = graphResult.findings;
  const severitySummary = computeSeveritySummary(normalizedFindings);

  const cache = new PromptCache(path.join(process.cwd(), "reports", "_cache", "ollama"));
  const analysis = await generateReasoningSummary(normalizedFindings, {
    cache,
    deterministic: options.deterministic,
    model: options.model,
    endpoint: process.env.INSULA_OLLAMA_ENDPOINT,
  });

  const now = new Date().toISOString();
  const summary = {
    $schemaVersion: "1.0",
    repo: {
      gitSha: process.env.GITHUB_SHA ?? null,
      branch: process.env.GITHUB_REF ?? null,
    },
    startedAt: now,
    finishedAt: now,
    severitySummary,
    findings: normalizedFindings,
    transcripts: {
      inspector: null,
      plugins: {
        self_healing_graph: graphResult.logs.join("\n"),
      },
    },
    artifacts: {},
    meta: {
      version: "0.2.0",
      deterministic: options.deterministic,
      model: options.model,
      backend: "ollama",
      plugins: options.plugins,
      dryRun: options.dryRun,
      endpoint: options.endpoint,
    },
    analysis,
  };

  const summaryPath = path.join(options.outputDir, "summary.json");
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

  const markdownPath = path.join(options.outputDir, "summary.md");
  fs.writeFileSync(
    markdownPath,
    buildMarkdownReport(options, severitySummary, normalizedFindings, analysis),
    "utf-8",
  );

  return { summaryPath, markdownPath };
}

function computeSeveritySummary(findings: NormalizedFinding[]) {
  const base = { info: 0, minor: 0, major: 0, critical: 0 };
  for (const finding of findings) {
    base[finding.severity] += 1;
  }
  return base;
}

function buildMarkdownReport(
  options: SelfHealingRunOptions,
  severitySummary: ReturnType<typeof computeSeveritySummary>,
  findings: NormalizedFinding[],
  analysis: string,
): string {
  const lines = [
    "# Self-Healing Report",
    "",
    `**Run:** ${options.timestamp}`,
    `**Deterministic:** ${options.deterministic ? "Yes" : "No"}`,
    `**Model:** ${options.model}`,
    `**Endpoint:** ${options.endpoint}`,
    "",
    "## Severity Summary",
    `- Critical: ${severitySummary.critical}`,
    `- Major: ${severitySummary.major}`,
    `- Minor: ${severitySummary.minor}`,
    `- Info: ${severitySummary.info}`,
    "",
    "## Reasoning Summary",
    "",
    "```",
    analysis,
    "```",
    "",
    "## Findings",
  ];

  if (findings.length === 0) {
    lines.push("No findings recorded in this run.");
  } else {
    for (const finding of findings) {
      lines.push(
        `- [${finding.severity.toUpperCase()}] ${finding.title} (${finding.source})`,
        `  - Location: ${finding.location?.file ?? "n/a"}`,
        finding.recommendation ? `  - Recommendation: ${finding.recommendation}` : undefined,
      );
    }
  }

  return `${lines.filter(Boolean).join("\n")}\n`;
}
