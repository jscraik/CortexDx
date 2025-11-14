import type { AcademicResearchReport } from "../research/academic-researcher.js";
import { runAcademicResearch } from "../research/academic-researcher.js";
import type { Finding } from "../types.js";

interface ResearchCliOptions {
  question?: string;
  providers?: string;
  limit?: string;
  license?: boolean;
  deterministic?: boolean;
  out?: string;
  json?: boolean;
  credential?: string[];
  header?: string[];
}

export async function runResearch(topic: string, opts: ResearchCliOptions): Promise<number> {
  const report = await runAcademicResearch({
    topic,
    question: opts.question,
    providers: parseCsv(opts.providers),
    limit: parseNumber(opts.limit),
    includeLicense: opts.license !== false,
    deterministic: Boolean(opts.deterministic),
    outputDir: opts.out,
    headers: collectKeyValues(opts.header, false),
    credentials: collectKeyValues(opts.credential, true),
  });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return computeExitCode(report.findings);
  }

  printReport(report);
  return computeExitCode(report.findings);
}

function parseCsv(value?: string): string[] | undefined {
  if (!value) return undefined;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function collectKeyValues(entries: string[] | undefined, lowercaseKeys: boolean): Record<string, string> | undefined {
  if (!entries || entries.length === 0) {
    return undefined;
  }
  const map: Record<string, string> = {};
  for (const entry of entries) {
    const [key, ...rest] = entry.split(":");
    if (!key || rest.length === 0) {
      continue;
    }
    const normalizedKey = lowercaseKeys ? key.trim().toLowerCase() : key.trim();
    map[normalizedKey] = rest.join(":").trim();
  }
  return map;
}

function computeExitCode(findings: Finding[]): number {
  if (findings.some((finding) => finding.severity === "blocker")) {
    return 1;
  }
  if (findings.some((finding) => finding.severity === "major")) {
    return 2;
  }
  return 0;
}

function printReport(report: AcademicResearchReport): void {
  console.log(`[INFO] Academic research for ${report.topic}`);
  console.log(
    `Providers: ${report.summary.providersResponded}/${report.summary.providersRequested} • Findings: ${report.summary.totalFindings}`,
  );
  for (const provider of report.providers) {
    console.log(`Provider: ${provider.providerName}`);
    if (provider.findings.length === 0) {
      console.log("  No findings returned.");
      continue;
    }
    for (const finding of provider.findings) {
      console.log(
        `[${finding.severity.toUpperCase()}] ${finding.title} — ${truncateDescription(finding.description)}`,
      );
    }
  }
  if (report.summary.errors.length > 0) {
    console.log("Errors:");
    for (const error of report.summary.errors) {
      console.log(`  [${error.providerId}] ${error.message}`);
    }
  }
  if (report.artifacts) {
    console.log(`Artifacts written to ${report.artifacts.dir}`);
  }
}

function truncateDescription(description?: string | null): string {
  if (!description) {
    return "No description";
  }
  return description.length > 160 ? `${description.slice(0, 157)}...` : description;
}
