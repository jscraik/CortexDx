import { join } from "node:path";
import { InspectorAdapter } from "../adapters/inspector-adapter";
import { loadProjectContext } from "../context/project-context";
import type { FixAttempt, HealingReport } from "../healing/auto-healer";
import { AutoHealer } from "../healing/auto-healer";
import {
  type MonitoringConfig,
  MonitoringScheduler,
} from "../healing/scheduler";
import { createCliLogger } from "../logging/logger";
import type { DevelopmentContext, Finding } from "../types";
import { fileSystem as fs } from "../utils/file-system";
import { safeParseJson } from "../utils/json";

type SeverityThreshold = "blocker" | "major" | "minor" | "info";

const logger = createCliLogger("self-healing");

const jsonRpcStub = async <T>(
  _method: string,
  _params?: unknown,
): Promise<T> => {
  // Stubbed response used for CLI utilities
  return Promise.reject(
    new Error(`JSON-RPC method ${_method} not implemented in CLI context`),
  ) as Promise<T>;
};

const parseSeverityThreshold = (value?: string): SeverityThreshold => {
  if (
    value === "blocker" ||
    value === "major" ||
    value === "minor" ||
    value === "info"
  ) {
    return value;
  }
  return "major";
};

/**
 * Create development context for CLI operations
 */
async function createDevelopmentContext(): Promise<DevelopmentContext> {
  const projectContext = await loadProjectContext().catch((error) => {
    logger.warn("[Self-Healing] Unable to load project context:", error);
    return undefined;
  });
  return {
    endpoint: process.env.CORTEXDX_INTERNAL_ENDPOINT || "http://127.0.0.1:5001",
    logger: (() => {}) as (...args: unknown[]) => void,
    request: async <T>(
      _input: RequestInfo,
      _init?: RequestInit,
    ): Promise<T> => {
      const result = {} as Record<string, unknown>;
      return result as T;
    },
    jsonrpc: jsonRpcStub as <T>(method: string, params?: unknown) => Promise<T>,
    sseProbe: async () => ({ ok: true }),
    evidence: () => undefined,
    deterministic: true,
    sessionId: `self-healing-${Date.now()}`,
    userExpertiseLevel: "expert",
    conversationHistory: [],
    projectContext,
  };
}

/**
 * Run self-diagnosis command
 */
export async function runSelfDiagnose(options: {
  autoFix?: boolean;
  dryRun?: boolean;
  severity?: string;
  backup?: boolean;
  validate?: boolean;
  out?: string;
}): Promise<number> {
  logger.info("[Self-Healing] Starting comprehensive self-diagnosis...");

  try {
    const ctx = await createDevelopmentContext();
    const healer = new AutoHealer(ctx);

    const report = await healer.healSelf({
      autoFix: options.autoFix || false,
      dryRun: options.dryRun || false,
      severityThreshold: parseSeverityThreshold(options.severity),
    });

    // Display results
    displayHealingReport(report, options.dryRun);

    // Save report if requested
    if (options.out) {
      await fs.writeFile(options.out, JSON.stringify(report, null, 2), "utf-8");
      logger.info(`\n[Self-Healing] Report saved to ${options.out}`);
    }

    // Return exit code based on severity
    return report.summary.severity === "failed" ? 1 : 0;
  } catch (error) {
    logger.error("[Self-Healing] Self-diagnosis failed", { error });
    return 1;
  }
}

/**
 * Run heal endpoint command
 */
export async function runHealEndpoint(
  endpoint: string,
  options: {
    autoFix?: boolean;
    dryRun?: boolean;
    severity?: string;
    probes?: string;
    webhook?: string;
    out?: string;
  },
): Promise<number> {
  logger.info(`[Self-Healing] Diagnosing endpoint: ${endpoint}`);

  try {
    const ctx = await createDevelopmentContext();
    ctx.endpoint = endpoint;

    const inspector = new InspectorAdapter(ctx);
    const probes =
      options.probes === "all"
        ? ["handshake", "protocol", "security", "performance", "sse"]
        : options.probes?.split(",") || ["handshake", "protocol"];

    // Run diagnostics
    const report = await inspector.diagnose(endpoint, probes);
    const findings = inspector.convertFindings(report.findings);

    logger.info(`[Self-Healing] Found ${findings.length} issues:`);
    findings.forEach((finding, index) => {
      logger.info(
        `  ${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`,
      );
      logger.info(`     ${finding.description}`);
    });

    // Apply fixes if requested and possible
    const _fixes: FixAttempt[] = [];
    if (options.autoFix && findings.length > 0) {
      logger.info("\n[Self-Healing] Attempting automated fixes...");
      // Note: For external endpoints, we'd typically not auto-fix
      logger.info("[Self-Healing] Auto-fix disabled for external endpoints");
    }

    // Send webhook if configured
    if (options.webhook) {
      await sendWebhook(options.webhook, {
        type: "endpoint_diagnosis",
        endpoint,
        findings,
        timestamp: new Date().toISOString(),
      });
    }

    // Save report if requested
    if (options.out) {
      const fullReport = {
        endpoint,
        timestamp: new Date().toISOString(),
        findings,
        inspectorReport: report,
      };
      await fs.writeFile(
        options.out,
        JSON.stringify(fullReport, null, 2),
        "utf-8",
      );
      logger.info(`\n[Self-Healing] Report saved to ${options.out}`);
    }

    // Return exit code based on findings severity
    const hasBlockers = findings.some((f) => f.severity === "blocker");
    return hasBlockers ? 1 : 0;
  } catch (error) {
    logger.error("[Self-Healing] Endpoint diagnosis failed", { error });
    return 1;
  }
}

/**
 * Run monitoring command
 */
export async function runMonitoring(options: {
  start?: boolean;
  stop?: boolean;
  status?: boolean;
  interval?: string;
  autoHeal?: boolean;
  webhook?: string;
  config?: string;
  export?: string;
  stateFile?: string;
}): Promise<number> {
  // Redundant file read removed; config will be loaded in loadMonitoringConfigs()

  const ctx = await createDevelopmentContext();
  const scheduler = new MonitoringScheduler(ctx);
  const stateFile =
    options.stateFile ||
    process.env.CORTEXDX_MONITOR_STATE ||
    join(process.cwd(), ".cortexdx", "monitoring-status.json");
  await scheduler.configurePersistence(stateFile);

  try {
    if (options.start) {
      logger.info("[Monitoring] Starting background monitoring...");

      const configs = await loadMonitoringConfigs(ctx, options);

      scheduler.start({
        checkIntervalMs:
          (Number.parseInt(options.interval || "300", 10) || 300) * 1000,
        configs,
      });

      logger.info("[Monitoring] Background monitoring started");
      logger.info("[Monitoring] Press Ctrl+C to stop");

      // Keep process running
      process.on("SIGINT", () => {
        logger.info("\n[Monitoring] Stopping...");
        scheduler.stop();
        process.exit(0);
      });

      // Keep alive
      return new Promise(() => {}); // Never resolve
    }

    if (options.stop) {
      scheduler.stop();
      logger.info("[Monitoring] Background monitoring stopped");
      return 0;
    }

    if (options.status) {
      const status = scheduler.getStatus();
      const jobs = scheduler.getJobs();

      logger.info("[Monitoring] Status:");
      logger.info(`  Running: ${status.running ? "Yes" : "No"}`);
      logger.info(`  Active Jobs: ${status.activeJobs}`);
      logger.info(`  Last Check: ${status.lastCheck}`);
      logger.info(`  Next Check: ${status.nextCheck}`);

      if (jobs.length > 0) {
        logger.info("\n[Monitoring] Jobs:");
        for (const job of jobs) {
          logger.info(`  ${job.id}:`);
          logger.info(`    Endpoint: ${job.config.endpoint}`);
          logger.info(`    Enabled: ${job.enabled ? "Yes" : "No"}`);
          logger.info(`    Auto-Heal: ${job.config.autoHeal ? "Yes" : "No"}`);
          logger.info(`    Last Run: ${job.lastRun || "Never"}`);
          logger.info(`    Consecutive Failures: ${job.consecutiveFailures}`);
        }
      }

      return 0;
    }

    if (options.export) {
      const config = scheduler.exportConfig();
      await fs.writeFile(
        options.export,
        JSON.stringify(config, null, 2),
        "utf-8",
      );
      logger.info(`[Monitoring] Configuration exported to ${options.export}`);
      return 0;
    }

    // Show help if no action specified
    logger.info(
      "[Monitoring] Please specify an action: --start, --stop, --status, or --export",
    );
    return 1;
  } catch (error) {
    logger.error("[Monitoring] Operation failed", { error });
    return 1;
  }
}

async function loadMonitoringConfigs(
  ctx: DevelopmentContext,
  options: { config?: string; autoHeal?: boolean; webhook?: string },
): Promise<MonitoringConfig[]> {
  if (!options.config) {
    return [
      {
        endpoint: ctx.endpoint,
        schedule: "*/5 * * * *",
        probes: ["handshake", "protocol", "security", "performance"],
        autoHeal: Boolean(options.autoHeal),
        webhook: options.webhook,
        enabled: true,
      },
    ];
  }

  ctx.logger?.([
    `[Monitoring] Loading monitoring config from ${options.config}`,
  ]);
  // Custom event emission removed - not compatible with Node.js process events

  const raw = await fs.readFile(options.config, "utf-8");
  const parsed = safeParseJson<unknown>(
    typeof raw === "string" ? raw : raw.toString(),
    "monitoring config",
  );
  const jobs = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        "jobs" in parsed &&
        Array.isArray((parsed as { jobs: unknown[] }).jobs)
      ? (parsed as { jobs: unknown[] }).jobs
      : [];

  return jobs.map((job: MonitoringConfig) => ({
    endpoint: job.endpoint ?? ctx.endpoint,
    schedule: job.schedule ?? "*/5 * * * *",
    probes: job.probes ?? ["handshake", "protocol"],
    autoHeal: Boolean(job.autoHeal),
    webhook: job.webhook,
    enabled: job.enabled !== false,
  }));
}

/**
 * Display healing report in terminal
 */
function displayHealingReport(report: HealingReport, dryRun?: boolean): void {
  logger.info(`\n${"=".repeat(60)}`);
  logger.info("SELF-HEALING REPORT");
  logger.info("=".repeat(60));

  const mode = dryRun ? " (DRY RUN)" : "";
  logger.info(`Job ID: ${report.jobId}${mode}`);
  logger.info(`Started: ${report.startedAt}`);
  logger.info(`Finished: ${report.finishedAt}`);

  logger.info("\nSUMMARY:");
  logger.info(`  Status: ${report.summary.severity.toUpperCase()}`);
  logger.info(`  ${report.summary.message}`);

  logger.info("\nFINDINGS:");
  if (report.findings.length === 0) {
    logger.info("  ✅ No issues detected - system is healthy!");
  } else {
    report.findings.forEach((finding: Finding, index: number) => {
      const status = finding.autoFixed ? "✅ FIXED" : "⚠️  OPEN";
      logger.info(
        `  ${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title} - ${status}`,
      );
      if (finding.description) {
        logger.info(`     ${finding.description}`);
      }
      if (finding.autoFixed) {
        logger.info(`     → Auto-fixed using template: ${finding.templateId}`);
      }
    });
  }

  if (report.fixes.length > 0) {
    logger.info("\nFIXES ATTEMPTED:");
    report.fixes.forEach((fix: FixAttempt, index: number) => {
      const status = fix.success ? "✅ SUCCESS" : "❌ FAILED";
      logger.info(`  ${index + 1}. ${fix.templateId} - ${status}`);
      logger.info(`     Finding: ${fix.findingId}`);
      logger.info(`     Applied: ${fix.applied ? "Yes" : "No"}`);
      logger.info(`     Validated: ${fix.validated ? "Yes" : "No"}`);
      logger.info(`     Time: ${fix.timeTaken}ms`);
      if (fix.error) {
        logger.info(`     Error: ${fix.error}`);
      }
    });
  }

  logger.info("\nVALIDATION SUMMARY:");
  logger.info(`  Total Findings: ${report.validation.totalFindings}`);
  logger.info(`  Issues Fixed: ${report.validation.issuesFixed}`);
  logger.info(`  Issues Remaining: ${report.validation.issuesRemaining}`);
  logger.info(`  Auto-Fixed: ${report.validation.autoFixed}`);
  logger.info(
    `  Manual Review Required: ${report.validation.manualReviewRequired}`,
  );
  logger.info(`  Blockers Remaining: ${report.validation.blockersRemaining}`);

  if (report.summary.recommendations.length > 0) {
    logger.info("\nRECOMMENDATIONS:");
    report.summary.recommendations.forEach((rec: string, index: number) => {
      logger.info(`  ${index + 1}. ${rec}`);
    });
  }

  if (report.summary.nextSteps.length > 0) {
    logger.info("\nNEXT STEPS:");
    report.summary.nextSteps.forEach((step: string, index: number) => {
      logger.info(`  ${index + 1}. ${step}`);
    });
  }

  logger.info("=".repeat(60));
}

/**
 * Send webhook notification
 */
async function sendWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CortexDx-Self-Healing/1.0",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    logger.info(`[Self-Healing] Webhook sent to ${webhookUrl}`);
  } catch (error) {
    logger.error("[Self-Healing] Webhook failed", { error });
  }
}
