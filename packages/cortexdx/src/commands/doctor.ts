import { execSync } from "node:child_process";
import { ErrorCode, type JsonOutput, SchemaVersion } from "../cli/index.js";
import { createCliLogger } from "../logging/logger.js";
import {
  ACADEMIC_PROVIDER_ENV_REQUIREMENTS,
  DEFAULT_PROVIDERS,
  runAcademicResearch,
  selectConfiguredProviders,
} from "../research/academic-researcher.js";

const logger = createCliLogger("doctor");

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
    const researchSummary = await runDoctorResearch(opts, Boolean(opts.json));
    if (researchSummary) {
      report.research = researchSummary;
    }
  }

  if (opts.json) {
    // Use schema-versioned JSON output
    const jsonOutput: JsonOutput<DoctorReport> = {
      schema: SchemaVersion.Doctor,
      data: report,
      success: !(
        (report.providers?.some(
          (provider) =>
            provider.status === "missing" && provider.missingEnv?.length,
        ) ??
          false) ||
        report.research?.error
      ),
      errors:
        report.research?.error ||
        report.providers?.some((p) => p.status === "missing")
          ? [
              {
                code:
                  report.research?.error &&
                  !report.providers?.some((p) => p.status === "missing")
                    ? ErrorCode.E_INTERNAL
                    : ErrorCode.E_VALIDATION,
                message:
                  report.research?.error ??
                  "Some providers are missing required environment variables",
              },
            ]
          : undefined,
      metadata: {
        timestamp: new Date().toISOString(),
        version: "0.1.0",
      },
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
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
    logger.warn(
      `Unable to read pnpm version: ${error instanceof Error ? error.message : error}`,
      { error },
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
  silent = false,
): Promise<DoctorReport["research"] | null> {
  const topic =
    opts.researchTopic?.trim() || "Model Context Protocol diagnostics";

  const { ready, missing } = selectConfiguredProviders(
    parseCsv(opts.researchProviders),
  );
  if (missing.length && !silent) {
    logger.warn(
      `Skipping providers with missing env vars: ${missing.map(({ id, vars }) => `${id}:${vars.join("/")}`).join(", ")}`,
      { missing },
    );
  }

  if (ready.length === 0) {
    if (!silent) {
      logger.warn(
        "Academic research probe disabled (no configured providers).",
      );
    }
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

    if (!silent) {
      console.log(
        `[Doctor] Research ${report.summary.totalFindings} findings across ${report.summary.providersResponded}/${report.summary.providersRequested} providers`,
      );
    }

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
  logger.info("Runtime");
  logger.info(`  Node.js: ${report.runtime.node}`, {
    nodeVersion: report.runtime.node,
  });
  if (report.runtime.pnpm) {
    logger.info(`  pnpm: ${report.runtime.pnpm}`, {
      pnpmVersion: report.runtime.pnpm,
    });
  }
  logger.info(
    `  Platform: ${report.runtime.platform} (${report.runtime.arch})`,
    { platform: report.runtime.platform, arch: report.runtime.arch },
  );

  if (report.providers?.length) {
    logger.info("\nAcademic Providers");
    for (const provider of report.providers) {
      if (provider.status === "ready") {
        logger.info(`  ✓ ${provider.name} — ready`, {
          provider: provider.name,
          status: "ready",
        });
      } else {
        logger.warn(
          `  ⚠ ${provider.name} — missing ${provider.missingEnv?.join(", ")}`,
          {
            provider: provider.name,
            status: "missing",
            missingEnv: provider.missingEnv,
          },
        );
      }
    }
  }

  if (report.research) {
    logger.info("\nResearch Probe");
    if (report.research.error) {
      logger.error(`  ✗ Failed to run research: ${report.research.error}`, {
        error: report.research.error,
      });
    } else {
      logger.info(
        `  Topic: ${report.research.topic} (${report.research.totalFindings} findings)`,
        {
          topic: report.research.topic,
          totalFindings: report.research.totalFindings,
        },
      );
      for (const [providerId, summary] of Object.entries(
        report.research.providers,
      )) {
        logger.info(
          `  • ${providerId}: ${summary.findings} findings${summary.lastTitle ? ` (${summary.lastTitle})` : ""}`,
          {
            providerId,
            findings: summary.findings,
            lastTitle: summary.lastTitle,
          },
        );
      }
      if (report.research.artifactsDir) {
        logger.info(`  Artifacts: ${report.research.artifactsDir}`, {
          artifactsDir: report.research.artifactsDir,
        });
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
