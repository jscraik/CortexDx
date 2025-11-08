import type { DevelopmentContext } from "../types.js";
import { AutoHealer } from "./auto-healer.js";
import type { HealingReport } from "./auto-healer.js";

export interface MonitoringConfig {
  endpoint: string;
  schedule: string; // Cron expression
  probes: string[];
  autoHeal: boolean;
  webhook?: string;
  enabled: boolean;
}

export interface MonitoringJob {
  id: string;
  config: MonitoringConfig;
  lastRun?: string;
  nextRun?: string;
  running: boolean;
  consecutiveFailures: number;
  enabled: boolean;
}

export interface SchedulerStatus {
  running: boolean;
  activeJobs: number;
  lastCheck: string;
  nextCheck: string;
}

type MonitoringWebhookPayload = Record<string, unknown>;

interface MonitoringAlert {
  type: string;
  message: string;
  error?: string;
  findings?: number;
  summary?: HealingReport["summary"];
}

/**
 * Background monitoring scheduler for continuous health checks and auto-healing
 */
export class MonitoringScheduler {
  private ctx: DevelopmentContext;
  private jobs = new Map<string, MonitoringJob>();
  private interval: NodeJS.Timeout | null = null;
  private running = false;
  private checkInterval = 60000; // 1 minute default

  constructor(ctx: DevelopmentContext) {
    this.ctx = ctx;
  }

  /**
   * Start the monitoring scheduler
   */
  start(options: {
    checkIntervalMs?: number;
    configs?: MonitoringConfig[];
  } = {}): void {
    if (this.running) {
      this.ctx.logger?.('[MonitoringScheduler] Already running');
      return;
    }

    this.checkInterval = options.checkIntervalMs || this.checkInterval;
    this.running = true;

    // Add initial configurations
    if (options.configs) {
      for (const config of options.configs) {
        this.addJob(config);
      }
    }

    // Start the monitoring loop
    this.interval = setInterval(() => {
      this.runScheduledChecks();
    }, this.checkInterval);

    this.ctx.logger?.(`[MonitoringScheduler] Started with ${this.checkInterval}ms interval`);
  }

  /**
   * Stop the monitoring scheduler
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.ctx.logger?.('[MonitoringScheduler] Stopped');
  }

  /**
   * Add a monitoring job
   */
  addJob(config: MonitoringConfig): string {
    const jobId = this.generateJobId(config.endpoint);
    const job: MonitoringJob = {
      id: jobId,
      config,
      running: false,
      consecutiveFailures: 0,
      enabled: config.enabled !== false,
    };

    this.jobs.set(jobId, job);
    this.ctx.logger?.(`[MonitoringScheduler] Added monitoring job for ${config.endpoint}`);

    return jobId;
  }

  /**
   * Remove a monitoring job
   */
  removeJob(jobId: string): boolean {
    const removed = this.jobs.delete(jobId);
    if (removed) {
      this.ctx.logger?.(`[MonitoringScheduler] Removed monitoring job ${jobId}`);
    }
    return removed;
  }

  /**
   * Enable/disable a monitoring job
   */
  toggleJob(jobId: string, enabled: boolean): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    job.enabled = enabled;
    this.ctx.logger?.(`[MonitoringScheduler] ${enabled ? 'Enabled' : 'Disabled'} job ${jobId}`);
    return true;
  }

  /**
   * Run scheduled checks for all due jobs
   */
  private async runScheduledChecks(): Promise<void> {
    if (!this.running) {
      return;
    }

    const now = new Date();
    const dueJobs = Array.from(this.jobs.values()).filter(job =>
      job.enabled &&
      !job.running &&
      this.isJobDue(job, now)
    );

    if (dueJobs.length === 0) {
      return;
    }

    this.ctx.logger?.(`[MonitoringScheduler] Running ${dueJobs.length} scheduled checks`);

    // Run jobs in parallel
    await Promise.allSettled(
      dueJobs.map(job => this.runJob(job))
    );
  }

  /**
   * Run a single monitoring job
   */
  private async runJob(job: MonitoringJob): Promise<void> {
    job.running = true;
    job.lastRun = new Date().toISOString();

    try {
      this.ctx.logger?.(`[MonitoringScheduler] Running job ${job.id} for ${job.config.endpoint}`);

      // Create a healer for this endpoint
      const healer = new AutoHealer(this.ctx);

      // Check if it's self-monitoring or external endpoint
      const isSelf = job.config.endpoint.includes('localhost') ||
                    job.config.endpoint.includes('127.0.0.1') ||
                    job.config.endpoint === (process.env.INSULA_INTERNAL_ENDPOINT || '');

      let report: HealingReport;
      if (isSelf) {
        // Self-healing
        report = await healer.healSelf({
          autoFix: job.config.autoHeal,
          severityThreshold: 'major', // Only auto-fix major issues in background
        });
      } else {
        // External endpoint monitoring (no auto-fix for external systems)
        report = await healer.healSelf({
          autoFix: false, // Don't auto-fix external systems
          dryRun: true,
        });
      }

      // Process results
      await this.processJobResults(job, report);

      // Reset consecutive failures on success
      job.consecutiveFailures = 0;

      this.ctx.logger?.(
        `[MonitoringScheduler] Job ${job.id} completed: ${report.summary.severity}`
      );

    } catch (error) {
      job.consecutiveFailures++;
      this.ctx.logger?.(
        `[MonitoringScheduler] Job ${job.id} failed (${job.consecutiveFailures} consecutive):`,
        error
      );

      // Send alert if too many consecutive failures
      if (job.consecutiveFailures >= 3) {
        await this.sendAlert(job, {
          type: 'consecutive_failures',
          message: `Job ${job.id} failed ${job.consecutiveFailures} times consecutively`,
          error: String(error),
        });
      }
    } finally {
      job.running = false;
      job.nextRun = this.calculateNextRun(job);
    }
  }

  /**
   * Process job results and send notifications
   */
  private async processJobResults(job: MonitoringJob, report: HealingReport): Promise<void> {
    // Send webhook notification if configured
    if (job.config.webhook) {
      await this.sendWebhook(job.config.webhook, {
        type: 'job_completed',
        jobId: job.id,
        endpoint: job.config.endpoint,
        summary: report.summary,
        timestamp: new Date().toISOString(),
      });
    }

    // Send alerts for critical issues
    if (report.validation.blockersRemaining > 0) {
      await this.sendAlert(job, {
        type: 'critical_issues',
        message: `${report.validation.blockersRemaining} critical issues detected`,
        findings: report.validation.blockersRemaining,
        summary: report.summary,
      });
    }

    // Log summary
    const logLevel = report.summary.severity === 'success' ? 'info' :
                     report.summary.severity === 'partial' ? 'warn' : 'error';

    this.ctx.logger?.(`[MonitoringScheduler] [${logLevel.toUpperCase()}] ${job.id}: ${report.summary.message}`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    webhookUrl: string,
    payload: MonitoringWebhookPayload,
  ): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Insula-MCP-Monitor/1.0',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.ctx.logger?.(`[MonitoringScheduler] Webhook sent to ${webhookUrl}`);
    } catch (error) {
      this.ctx.logger?.("[MonitoringScheduler] Webhook failed:", error);
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(job: MonitoringJob, alert: MonitoringAlert): Promise<void> {
    this.ctx.logger?.(`[MonitoringScheduler] ALERT: ${alert.message}`);

    // Send webhook if configured
    if (job.config.webhook) {
      await this.sendWebhook(job.config.webhook, {
        type: 'alert',
        jobId: job.id,
        endpoint: job.config.endpoint,
        alert,
        timestamp: new Date().toISOString(),
      });
    }

    // Could integrate with other alerting systems here (email, Slack, etc.)
  }

  /**
   * Check if a job is due to run
   */
  private isJobDue(job: MonitoringJob, now: Date): boolean {
    if (!job.lastRun) {
      return true; // First run
    }

    // For now, run every 5 minutes per job
    // In a full implementation, this would parse cron expressions
    const lastRun = new Date(job.lastRun);
    const timeSinceLastRun = now.getTime() - lastRun.getTime();
    const intervalMs = 5 * 60 * 1000; // 5 minutes

    return timeSinceLastRun >= intervalMs;
  }

  /**
   * Calculate next run time for a job
   */
  private calculateNextRun(job: MonitoringJob): string {
    const nextRun = new Date();
    nextRun.setMinutes(nextRun.getMinutes() + 5); // Next run in 5 minutes
    return nextRun.toISOString();
  }

  /**
   * Generate job ID from endpoint
   */
  private generateJobId(endpoint: string): string {
    return `monitor_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Get scheduler status
   */
  getStatus(): SchedulerStatus {
    const activeJobs = Array.from(this.jobs.values()).filter(job => job.enabled).length;
    const nextJob = Array.from(this.jobs.values())
      .filter(job => job.enabled && job.nextRun)
      .sort((a, b) => {
        const aTime = a.nextRun ? new Date(a.nextRun).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.nextRun ? new Date(b.nextRun).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      })[0];

    return {
      running: this.running,
      activeJobs,
      lastCheck: new Date().toISOString(),
      nextCheck: nextJob?.nextRun || 'No scheduled jobs',
    };
  }

  /**
   * Get all monitoring jobs
   */
  getJobs(): MonitoringJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): MonitoringJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Add default monitoring configurations
   */
  addDefaultMonitoring(): void {
    // Self-monitoring
    this.addJob({
      endpoint: process.env.INSULA_INTERNAL_ENDPOINT || 'http://127.0.0.1:5001',
      schedule: '*/5 * * * *', // Every 5 minutes
      probes: ['handshake', 'protocol', 'security', 'performance'],
      autoHeal: true,
      enabled: true,
    });
  }

  /**
   * Export monitoring configuration
   */
  exportConfig(): { jobs: MonitoringConfig[] } {
    const jobs = Array.from(this.jobs.values()).map(job => job.config);
    return { jobs };
  }

  /**
   * Import monitoring configuration
   */
  importConfig(config: { jobs: MonitoringConfig[] }): void {
    // Clear existing jobs
    this.jobs.clear();

    // Import new configurations
    for (const jobConfig of config.jobs) {
      this.addJob(jobConfig);
    }

    this.ctx.logger?.(`[MonitoringScheduler] Imported ${config.jobs.length} monitoring configurations`);
  }
}
