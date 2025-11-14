import { execSync } from "node:child_process";
import {
  runAcademicResearch,
  DEFAULT_PROVIDERS,
  ACADEMIC_PROVIDER_ENV_REQUIREMENTS,
  selectConfiguredProviders,
} from "../research/academic-researcher.js";

interface DoctorOptions {
  providers?: string;
  skipProviders?: boolean;
  research?: boolean;
  researchTopic?: string;
  researchQuestion?: string;
  researchProviders?: string;
  researchLimit?: string;
  researchOut?: string;
  deterministic?: boolean;
  json?: boolean;
}

interface ProviderStatus {
  id: string;
  name: string;
  status: "ready" | "missing";
  missingEnv?: string[];
}

interface DoctorReport {
  runtime: {
    node: string;
    pnpm?: string;
    platform: string;
    arch: string;
  };
  providers?: ProviderStatus[];
  research?: {
    topic: string;
    totalFindings: number;
    providers: Record<
      string,
      { findings: number; lastTitle?: string; severity?: string }
    >;
    artifactsDir?: string;
    error?: string;
  };
}

export async function runDoctor(opts: DoctorOptions = {}): Promise<number> {
  const report: DoctorReport = {
    runtime: collectRuntimeInfo(),
  };

  if (!opts.skipProviders) {
    report.providers = evaluateProviders(parseCsv(opts.providers));
  }

  if (shouldRunResearch(opts)) {
    const researchSummary = await runDoctorResearch(opts);
    if (researchSummary) {
      report.research = researchSummary;
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printDoctorReport(report);
  }

  const hasMissingProviders = report.providers?.some(
    (provider) => provider.status === "missing" && provider.missingEnv?.length,
  );
  const researchErrored = report.research?.error;
  return hasMissingProviders || researchErrored ? 1 : 0;
}

function collectRuntimeInfo(): DoctorReport["runtime"] {
  return {
    node: process.version,
    pnpm: readPnpmVersion(),
    platform: process.platform,
    arch: process.arch,
  };
}

function readPnpmVersion(): string | undefined {
  try {
    return execSync("pnpm -v", { encoding: "utf8" }).trim();
  } catch (error) {
    console.warn(
      "[doctor] Unable to read pnpm version:",
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

function evaluateProviders(providerIds?: string[]): ProviderStatus[] {
  const requested =
    providerIds && providerIds.length > 0 ? providerIds : DEFAULT_PROVIDERS;

  return requested.map((id) => {
    const requirement = ACADEMIC_PROVIDER_ENV_REQUIREMENTS[id] ?? {
      name: id,
      required: [],
    };
    const missingEnv = requirement.required.filter(
      (envVar) => !(process.env[envVar] ?? "").trim(),
    );
    return {
      id,
      name: requirement.name,
      status: missingEnv.length === 0 ? "ready" : "missing",
      missingEnv: missingEnv.length ? missingEnv : undefined,
    };
  });
}

function shouldRunResearch(opts: DoctorOptions): boolean {
  return opts.research !== false;
}

async function runDoctorResearch(
  opts: DoctorOptions,
): Promise<DoctorReport["research"] | null> {
  const topic =
    opts.researchTopic?.trim() || "Model Context Protocol diagnostics";

  const { ready, missing } = selectConfiguredProviders(
    parseCsv(opts.researchProviders),
  );
  if (missing.length) {
    console.warn(
      "[Doctor] Skipping providers with missing env vars:",
      missing.map(({ id, vars }) => `${id}:${vars.join("/")}`).join(", "),
    );
  }

  if (ready.length === 0) {
    console.warn(
      "[Doctor] Academic research probe disabled (no configured providers).",
    );
    return null;
  }

  try {
    const report = await runAcademicResearch({
      topic,
      question: opts.researchQuestion,
      providers: ready,
      limit: parseNumber(opts.researchLimit) ?? 3,
      deterministic: Boolean(opts.deterministic),
      outputDir: opts.researchOut,
    });

    const providersSummary = Object.fromEntries(
      report.providers.map((provider) => [
        provider.providerId,
        {
          findings: provider.findings.length,
          lastTitle: provider.findings[0]?.title,
          severity: provider.findings[0]?.severity,
        },
      ]),
    );

    return {
      topic: report.topic,
      totalFindings: report.summary.totalFindings,
      providers: providersSummary,
      artifactsDir: report.artifacts?.dir,
    };
  } catch (error) {
    return {
      topic,
      totalFindings: 0,
      providers: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function printDoctorReport(report: DoctorReport): void {
  console.log("[Doctor] Runtime");
  console.log(`  Node.js: ${report.runtime.node}`);
  if (report.runtime.pnpm) {
    console.log(`  pnpm: ${report.runtime.pnpm}`);
  }
  console.log(
    `  Platform: ${report.runtime.platform} (${report.runtime.arch})`,
  );

  if (report.providers?.length) {
    console.log("\n[Doctor] Academic Providers");
    for (const provider of report.providers) {
      if (provider.status === "ready") {
        console.log(`  ✓ ${provider.name} — ready`);
      } else {
        console.log(
          `  ⚠ ${provider.name} — missing ${provider.missingEnv?.join(", ")}`,
        );
      }
    }
  }

  if (report.research) {
    console.log("\n[Doctor] Research Probe");
    if (report.research.error) {
      console.log(`  ✗ Failed to run research: ${report.research.error}`);
    } else {
      console.log(
        `  Topic: ${report.research.topic} (${report.research.totalFindings} findings)`,
      );
      for (const [providerId, summary] of Object.entries(
        report.research.providers,
      )) {
        console.log(
          `  • ${providerId}: ${summary.findings} findings${summary.lastTitle ? ` (${summary.lastTitle})` : ""}`,
        );
      }
      if (report.research.artifactsDir) {
        console.log(`  Artifacts: ${report.research.artifactsDir}`);
      }
    }
  }
}

function parseCsv(value?: string): string[] | undefined {
  if (!value) return undefined;
  const entries = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return entries.length > 0 ? entries : undefined;
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
