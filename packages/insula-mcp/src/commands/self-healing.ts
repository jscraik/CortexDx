import type { DevelopmentContext, Finding } from "../types.js";
import type { FixAttempt, HealingReport } from "../healing/auto-healer.js";
import { AutoHealer } from "../healing/auto-healer.js";
import { MonitoringScheduler } from "../healing/scheduler.js";
import { InspectorAdapter } from "../adapters/inspector-adapter.js";
import { promises as fs } from "node:fs";

type SeverityThreshold = "blocker" | "major" | "minor" | "info";

const jsonRpcStub = async (): Promise<Record<string, never>> => ({
  // Stubbed response used for CLI utilities
});

const parseSeverityThreshold = (value?: string): SeverityThreshold => {
  if (value === "blocker" || value === "major" || value === "minor" || value === "info") {
    return value;
  }
  return "major";
};

/**
 * Create development context for CLI operations
 */
function createDevelopmentContext(): DevelopmentContext {
  return {
    endpoint: process.env.INSULA_INTERNAL_ENDPOINT || 'http://127.0.0.1:5001',
    logger: (...args) => console.log('[Self-Healing]', ...args),
    request: async (input, init) => {
      const response = await fetch(input, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      return text.length ? JSON.parse(text) : {};
    },
    jsonrpc: jsonRpcStub,
    sseProbe: async () => ({ ok: true }),
    evidence: () => undefined,
    deterministic: true,
    sessionId: `self-healing-${Date.now()}`,
    userExpertiseLevel: 'expert',
    conversationHistory: [],
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
  console.log('[Self-Healing] Starting comprehensive self-diagnosis...');

  try {
    const ctx = createDevelopmentContext();
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
      console.log(`\n[Self-Healing] Report saved to ${options.out}`);
    }

    // Return exit code based on severity
    return report.summary.severity === 'failed' ? 1 : 0;

  } catch (error) {
    console.error('[Self-Healing] Self-diagnosis failed:', error);
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
  }
): Promise<number> {
  console.log(`[Self-Healing] Diagnosing endpoint: ${endpoint}`);

  try {
    const ctx = createDevelopmentContext();
    ctx.endpoint = endpoint;

    const inspector = new InspectorAdapter(ctx);
    const probes = options.probes === 'all'
      ? ['handshake', 'protocol', 'security', 'performance', 'sse']
      : options.probes?.split(',') || ['handshake', 'protocol'];

    // Run diagnostics
    const report = await inspector.diagnose(endpoint, probes);
    const findings = inspector.convertFindings(report.findings);

    console.log(`[Self-Healing] Found ${findings.length} issues:`);
    findings.forEach((finding, index) => {
      console.log(`  ${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`);
      console.log(`     ${finding.description}`);
    });

    // Apply fixes if requested and possible
    const fixes: FixAttempt[] = [];
    if (options.autoFix && findings.length > 0) {
      console.log('\n[Self-Healing] Attempting automated fixes...');
      // Note: For external endpoints, we'd typically not auto-fix
      console.log('[Self-Healing] Auto-fix disabled for external endpoints');
    }

    // Send webhook if configured
    if (options.webhook) {
      await sendWebhook(options.webhook, {
        type: 'endpoint_diagnosis',
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
      await fs.writeFile(options.out, JSON.stringify(fullReport, null, 2), "utf-8");
      console.log(`\n[Self-Healing] Report saved to ${options.out}`);
    }

    // Return exit code based on findings severity
    const hasBlockers = findings.some(f => f.severity === 'blocker');
    return hasBlockers ? 1 : 0;

  } catch (error) {
    console.error('[Self-Healing] Endpoint diagnosis failed:', error);
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
}): Promise<number> {
  const ctx = createDevelopmentContext();
  const scheduler = new MonitoringScheduler(ctx);

  try {
    if (options.start) {
      console.log('[Monitoring] Starting background monitoring...');

      const configs = options.config
        ? (JSON.parse(await fs.readFile(options.config, 'utf-8')).jobs ?? [])
        : [{
            endpoint: ctx.endpoint,
            schedule: '*/5 * * * *',
            probes: ['handshake', 'protocol', 'security', 'performance'],
            autoHeal: options.autoHeal || false,
            webhook: options.webhook,
            enabled: true,
          }];

      scheduler.start({
        checkIntervalMs: (Number.parseInt(options.interval || '300', 10) || 300) * 1000,
        configs,
      });

      console.log('[Monitoring] Background monitoring started');
      console.log('[Monitoring] Press Ctrl+C to stop');

      // Keep process running
      process.on('SIGINT', () => {
        console.log('\n[Monitoring] Stopping...');
        scheduler.stop();
        process.exit(0);
      });

      // Keep alive
      return new Promise(() => {}); // Never resolve
    }

    if (options.stop) {
      scheduler.stop();
      console.log('[Monitoring] Background monitoring stopped');
      return 0;
    }

    if (options.status) {
      const status = scheduler.getStatus();
      const jobs = scheduler.getJobs();

      console.log('[Monitoring] Status:');
      console.log(`  Running: ${status.running ? 'Yes' : 'No'}`);
      console.log(`  Active Jobs: ${status.activeJobs}`);
      console.log(`  Last Check: ${status.lastCheck}`);
      console.log(`  Next Check: ${status.nextCheck}`);

      if (jobs.length > 0) {
        console.log('\n[Monitoring] Jobs:');
        for (const job of jobs) {
          console.log(`  ${job.id}:`);
          console.log(`    Endpoint: ${job.config.endpoint}`);
          console.log(`    Enabled: ${job.enabled ? 'Yes' : 'No'}`);
          console.log(`    Auto-Heal: ${job.config.autoHeal ? 'Yes' : 'No'}`);
          console.log(`    Last Run: ${job.lastRun || 'Never'}`);
          console.log(`    Consecutive Failures: ${job.consecutiveFailures}`);
        }
      }

      return 0;
    }

    if (options.export) {
      const config = scheduler.exportConfig();
      await fs.writeFile(options.export, JSON.stringify(config, null, 2), "utf-8");
      console.log(`[Monitoring] Configuration exported to ${options.export}`);
      return 0;
    }

    // Show help if no action specified
    console.log('[Monitoring] Please specify an action: --start, --stop, --status, or --export');
    return 1;

  } catch (error) {
    console.error('[Monitoring] Operation failed:', error);
    return 1;
  }
}

/**
 * Display healing report in terminal
 */
function displayHealingReport(report: HealingReport, dryRun?: boolean): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log('SELF-HEALING REPORT');
  console.log('='.repeat(60));

  const mode = dryRun ? ' (DRY RUN)' : '';
  console.log(`Job ID: ${report.jobId}${mode}`);
  console.log(`Started: ${report.startedAt}`);
  console.log(`Finished: ${report.finishedAt}`);

  console.log('\nSUMMARY:');
  console.log(`  Status: ${report.summary.severity.toUpperCase()}`);
  console.log(`  ${report.summary.message}`);

  console.log('\nFINDINGS:');
  if (report.findings.length === 0) {
    console.log('  ✅ No issues detected - system is healthy!');
  } else {
    report.findings.forEach((finding: Finding, index: number) => {
      const status = finding.autoFixed ? '✅ FIXED' : '⚠️  OPEN';
      console.log(`  ${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title} - ${status}`);
      if (finding.description) {
        console.log(`     ${finding.description}`);
      }
      if (finding.autoFixed) {
        console.log(`     → Auto-fixed using template: ${finding.templateId}`);
      }
    });
  }

  if (report.fixes.length > 0) {
    console.log('\nFIXES ATTEMPTED:');
    report.fixes.forEach((fix: FixAttempt, index: number) => {
      const status = fix.success ? '✅ SUCCESS' : '❌ FAILED';
      console.log(`  ${index + 1}. ${fix.templateId} - ${status}`);
      console.log(`     Finding: ${fix.findingId}`);
      console.log(`     Applied: ${fix.applied ? 'Yes' : 'No'}`);
      console.log(`     Validated: ${fix.validated ? 'Yes' : 'No'}`);
      console.log(`     Time: ${fix.timeTaken}ms`);
      if (fix.error) {
        console.log(`     Error: ${fix.error}`);
      }
    });
  }

  console.log('\nVALIDATION SUMMARY:');
  console.log(`  Total Findings: ${report.validation.totalFindings}`);
  console.log(`  Issues Fixed: ${report.validation.issuesFixed}`);
  console.log(`  Issues Remaining: ${report.validation.issuesRemaining}`);
  console.log(`  Auto-Fixed: ${report.validation.autoFixed}`);
  console.log(`  Manual Review Required: ${report.validation.manualReviewRequired}`);
  console.log(`  Blockers Remaining: ${report.validation.blockersRemaining}`);

  if (report.summary.recommendations.length > 0) {
    console.log('\nRECOMMENDATIONS:');
    report.summary.recommendations.forEach((rec: string, index: number) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }

  if (report.summary.nextSteps.length > 0) {
    console.log('\nNEXT STEPS:');
    report.summary.nextSteps.forEach((step: string, index: number) => {
      console.log(`  ${index + 1}. ${step}`);
    });
  }

  console.log('='.repeat(60));
}

/**
 * Send webhook notification
 */
async function sendWebhook(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Insula-MCP-Self-Healing/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`[Self-Healing] Webhook sent to ${webhookUrl}`);
  } catch (error) {
    console.error('[Self-Healing] Webhook failed:', error);
  }
}
