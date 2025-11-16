import { randomUUID } from "node:crypto";
import type {
  ChatMessage,
  DevelopmentContext,
  Finding,
} from "../types.js";
import { InspectorAdapter } from "../adapters/inspector-adapter.js";
import { SelfImprovementPlugin } from "../plugins/development/self-improvement.js";
import { TemplateEngine } from "../template-engine/engine.js";
import { getTemplateRecommendations } from "../templates/fix-templates.js";
import type { FixTemplate } from "../templates/fix-templates.js";
import { analyzeWithLLM } from "../plugins/development/self-improvement.js";

export interface HealingReport {
  jobId: string;
  startedAt: string;
  finishedAt: string;
  findings: Finding[];
  fixes: FixAttempt[];
  validation: ValidationSummary;
  summary: HealingSummary;
}

export interface FixAttempt {
  findingId: string;
  templateId?: string;
  success: boolean;
  applied: boolean;
  validated: boolean;
  error?: string;
  rollbackAvailable: boolean;
  timeTaken: number;
}

export interface ValidationSummary {
  totalFindings: number;
  issuesFixed: number;
  issuesRemaining: number;
  autoFixed: number;
  manualReviewRequired: number;
  blockersRemaining: number;
}

export interface HealingSummary {
  severity: 'success' | 'partial' | 'failed';
  message: string;
  recommendations: string[];
  nextSteps: string[];
}

/**
 * Auto-healer for CortexDx self-diagnosis and automated fixing
 */
export class AutoHealer {
  private ctx: DevelopmentContext;
  private templateEngine: TemplateEngine;
  private inspector: InspectorAdapter;

  constructor(ctx: DevelopmentContext) {
    this.ctx = ctx;
    this.templateEngine = new TemplateEngine();
    this.inspector = new InspectorAdapter(ctx);
  }

  /**
   * Run complete self-healing cycle
   */
  async healSelf(options: {
    autoFix?: boolean;
    dryRun?: boolean;
    severityThreshold?: 'blocker' | 'major' | 'minor' | 'info';
  } = {}): Promise<HealingReport> {
    const jobId = `heal_${randomUUID()}`;
    const startedAt = new Date().toISOString();

    this.ctx.logger?.(`[AutoHealer] Starting self-healing job ${jobId}`);

    try {
      // 1. Run comprehensive diagnostics
      const findings = await this.runDiagnostics();

      // 2. Analyze findings with LLM
      const analyzedFindings = await this.analyzeFindings(findings);

      // 3. Apply automated fixes if enabled
      const fixes: FixAttempt[] = [];
      if (options.autoFix) {
        fixes.push(...await this.applyAutomatedFixes(analyzedFindings, options));
      }

      // 4. Run validation to verify fixes
      const validation = await this.validateFixes(analyzedFindings, fixes);

      // 5. Generate summary and recommendations
      const summary = await this.generateSummary(validation, analyzedFindings, fixes);

      const finishedAt = new Date().toISOString();

      const report: HealingReport = {
        jobId,
        startedAt,
        finishedAt,
        findings: analyzedFindings,
        fixes,
        validation,
        summary,
      };

      this.ctx.logger?.(`[AutoHealer] Self-healing job ${jobId} completed: ${summary.severity}`);

      return report;

    } catch (error) {
      this.ctx.logger?.(`[AutoHealer] Self-healing job ${jobId} failed:`, error);

      const finishedAt = new Date().toISOString();

      return {
        jobId,
        startedAt,
        finishedAt,
        findings: [],
        fixes: [],
        validation: {
          totalFindings: 0,
          issuesFixed: 0,
          issuesRemaining: 0,
          autoFixed: 0,
          manualReviewRequired: 0,
          blockersRemaining: 0,
        },
        summary: {
          severity: 'failed',
          message: `Self-healing failed: ${String(error)}`,
          recommendations: ['Review error logs and try again'],
          nextSteps: ['Check system health and dependencies'],
        },
      };
    }
  }

  /**
   * Run comprehensive diagnostics using Inspector and self-improvement
   */
  private async runDiagnostics(): Promise<Finding[]> {
    this.ctx.logger?.('[AutoHealer] Running comprehensive diagnostics');

    const findings: Finding[] = [];

    // 1. Run Inspector self-diagnosis
    try {
      const inspectorReport = await this.inspector.selfDiagnose();
      const inspectorFindings = this.inspector.convertFindings(inspectorReport.findings);
      findings.push(...inspectorFindings);
      this.ctx.logger?.(`[AutoHealer] Inspector found ${inspectorFindings.length} issues`);
    } catch (error) {
      this.ctx.logger?.('[AutoHealer] Inspector diagnostics failed:', error);
    }

    // 2. Run self-improvement plugin
    try {
      const selfFindings = await SelfImprovementPlugin.run(this.ctx);
      findings.push(...selfFindings);
      this.ctx.logger?.(`[AutoHealer] Self-improvement found ${selfFindings.length} issues`);
    } catch (error) {
      this.ctx.logger?.('[AutoHealer] Self-improvement diagnostics failed:', error);
    }

    // Remove duplicates
    const uniqueFindings = findings.filter((finding, index, self) =>
      index === self.findIndex(f => f.id === finding.id)
    );

    this.ctx.logger?.(`[AutoHealer] Total unique findings: ${uniqueFindings.length}`);
    return uniqueFindings;
  }

  /**
   * Analyze findings with LLM for enhanced insights
   */
  private async analyzeFindings(findings: Finding[]): Promise<Finding[]> {
    if (findings.length === 0) {
      return findings;
    }

    try {
      this.ctx.logger?.('[AutoHealer] Analyzing findings with LLM');
      return await analyzeWithLLM(findings, this.ctx);
    } catch (error) {
      this.ctx.logger?.('[AutoHealer] LLM analysis failed:', error);
      return findings; // Return original findings if LLM fails
    }
  }

  /**
   * Apply automated fixes to findings
   */
  private async applyAutomatedFixes(
    findings: Finding[],
    options: { dryRun?: boolean; severityThreshold?: string }
  ): Promise<FixAttempt[]> {
    try {
      const fixes: FixAttempt[] = [];
      const threshold = options.severityThreshold || 'minor';

      // Filter findings that should be auto-fixed
      const fixableFindings = findings.filter(finding =>
        finding.canAutoFix &&
        this.meetsSeverityThreshold(finding.severity, threshold)
      );

      this.ctx.logger?.(`[AutoHealer] Attempting to fix ${fixableFindings.length} findings automatically`);

      for (const finding of fixableFindings) {
        const fixAttempt = await this.attemptFix(finding, options);
        fixes.push(fixAttempt);
      }

      const successfulFixes = fixes.filter(f => f.success && f.applied);
      this.ctx.logger?.(`[AutoHealer] Successfully applied ${successfulFixes.length} automated fixes`);

      return fixes;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.logger?.(`[AutoHealer] Automated fixes failed: ${message}`);
      return []; // Return empty array on error
    }
  }

  /**
   * Attempt to fix a single finding
   */
  private async attemptFix(
    finding: Finding,
    options: { dryRun?: boolean }
  ): Promise<FixAttempt> {
    const startTime = Date.now();
    const fixAttempt: FixAttempt = {
      findingId: finding.id,
      success: false,
      applied: false,
      validated: false,
      rollbackAvailable: false,
      timeTaken: 0,
    };

    try {
      // Get template recommendation
      const templates = getTemplateRecommendations([finding]);
      const template = templates[0];

      if (!template) {
        fixAttempt.error = 'No suitable template found for this finding';
        return fixAttempt;
      }

      fixAttempt.templateId = template.id;

      // Apply template
      const result = await this.templateEngine.applyTemplate(
        template.id,
        finding,
        this.ctx,
        {
          dryRun: options.dryRun || false,
          backupEnabled: true,
          skipValidation: false,
        }
      );

      fixAttempt.success = result.success;
      fixAttempt.applied = result.codeChanges?.some(change => change.applied) || false;
      fixAttempt.validated = result.validationResults?.every(r => r.passed) || false;
      fixAttempt.rollbackAvailable = result.rollbackAvailable || false;

      if (!result.success) {
        fixAttempt.error = result.error || 'Template application failed';
      }

    } catch (error) {
      fixAttempt.error = String(error);
      this.ctx.logger?.(`[AutoHealer] Fix attempt failed for ${finding.id}:`, error);
    }

    fixAttempt.timeTaken = Date.now() - startTime;
    return fixAttempt;
  }

  /**
   * Validate applied fixes
   */
  private async validateFixes(
    originalFindings: Finding[],
    fixes: FixAttempt[]
  ): Promise<ValidationSummary> {
    try {
      this.ctx.logger?.('[AutoHealer] Validating applied fixes');

      const successfulFixes = fixes.filter(f => f.success && f.applied);
      const issuesFixed = successfulFixes.length;
      const autoFixed = successfulFixes.filter(f => f.validated).length;

      // Find findings that still need attention
      const fixedFindingIds = new Set(successfulFixes.map(f => f.findingId));
      const remainingFindings = originalFindings.filter(f => !fixedFindingIds.has(f.id));

      const issuesRemaining = remainingFindings.length;
      const blockersRemaining = remainingFindings.filter(f => f.severity === 'blocker').length;
      const manualReviewRequired = remainingFindings.filter(f => !f.canAutoFix).length;

      const validation: ValidationSummary = {
        totalFindings: originalFindings.length,
        issuesFixed,
        issuesRemaining,
        autoFixed,
        manualReviewRequired,
        blockersRemaining,
      };

      this.ctx.logger?.('[AutoHealer] Validation summary:', validation);
      return validation;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.logger?.(`[AutoHealer] Validation failed: ${message}`);
      // Return safe defaults on error
      return {
        totalFindings: originalFindings.length,
        issuesFixed: 0,
        issuesRemaining: originalFindings.length,
        autoFixed: 0,
        manualReviewRequired: originalFindings.length,
        blockersRemaining: originalFindings.filter(f => f.severity === 'blocker').length,
      };
    }
  }

  /**
   * Generate healing summary and recommendations
   */
  private generateSummary(
    validation: ValidationSummary,
    findings: Finding[],
    fixes: FixAttempt[]
  ): HealingSummary {
    try {
      let severity: HealingSummary['severity'];
      let message: string;
      const recommendations: string[] = [];
      const nextSteps: string[] = [];

      if (validation.blockersRemaining > 0) {
        severity = 'failed';
        message = `Critical issues remain: ${validation.blockersRemaining} blockers unresolved`;
        recommendations.push('Address remaining blocker issues immediately');
        recommendations.push('Consider manual intervention for complex fixes');
        nextSteps.push('Review failed fix attempts');
        nextSteps.push('Apply manual fixes for remaining issues');
      } else if (validation.issuesRemaining > 0) {
        severity = 'partial';
        message = `Partial success: ${validation.autoFixed} issues fixed automatically, ${validation.issuesRemaining} remain`;
        recommendations.push('Review remaining issues for manual resolution');
        recommendations.push('Consider updating templates for uncovered issues');
        nextSteps.push('Manually address remaining findings');
        nextSteps.push('Test system after manual fixes');
      } else {
        severity = 'success';
        message = `Complete success: All ${validation.issuesFixed} issues resolved automatically`;
        recommendations.push('Continue monitoring system health');
        recommendations.push('Schedule regular self-healing checks');
        nextSteps.push('Run full system test suite');
        nextSteps.push('Monitor system performance');
      }

      // Add specific recommendations based on findings
      const securityIssues = findings.filter(f => f.area === 'security');
      const performanceIssues = findings.filter(f => f.area === 'performance');
      const protocolIssues = findings.filter(f => f.area === 'protocol');

      if (securityIssues.length > 0) {
        recommendations.push('Conduct comprehensive security audit');
      }
      if (performanceIssues.length > 0) {
        recommendations.push('Monitor system performance metrics');
      }
      if (protocolIssues.length > 0) {
        recommendations.push('Test MCP protocol compliance');
      }

      return {
        severity,
        message,
        recommendations,
        nextSteps,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.logger?.(`[AutoHealer] Summary generation failed: ${message}`);
      // Return safe defaults on error
      return {
        severity: 'failed',
        message: 'Failed to generate healing summary',
        recommendations: ['Review error logs and retry healing'],
        nextSteps: ['Check system health manually'],
      };
    }
  }

  /**
   * Check if finding meets severity threshold for auto-fix
   */
  private meetsSeverityThreshold(
    severity: Finding['severity'],
    threshold: string
  ): boolean {
    try {
      const severityOrder = { blocker: 0, major: 1, minor: 2, info: 3 };
      const findingLevel = severityOrder[severity];
      const thresholdLevel = severityOrder[threshold as Finding['severity']];

      return findingLevel <= thresholdLevel;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.logger?.(`[AutoHealer] Severity threshold check failed: ${message}`);
      return false; // Safe default: don't auto-fix on error
    }
  }

  /**
   * Run quick health check
   */
  async quickHealthCheck(): Promise<{
    healthy: boolean;
    issues: number;
    criticalIssues: number;
    message: string;
  }> {
    try {
      const findings = await this.runDiagnostics();
      const criticalIssues = findings.filter(f => f.severity === 'blocker').length;
      const healthy = criticalIssues === 0;

      return {
        healthy,
        issues: findings.length,
        criticalIssues,
        message: healthy
          ? 'System is healthy'
          : `System has ${criticalIssues} critical issues requiring attention`,
      };
    } catch (error) {
      return {
        healthy: false,
        issues: -1,
        criticalIssues: -1,
        message: `Health check failed: ${String(error)}`,
      };
    }
  }

  /**
   * Get healing recommendations without applying fixes
   */
  async getHealingRecommendations(): Promise<{
    findings: Finding[];
    recommendations: string[];
    estimatedTime: string;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    try {
      const findings = await this.runDiagnostics();
      const analyzedFindings = await this.analyzeFindings(findings);
      const templates = getTemplateRecommendations(analyzedFindings);

      const recommendations = templates.map((template) =>
        `Apply ${template.name} (${template.estimatedTime})`,
      );

      const estimatedTime = this.summarizeEstimatedTime(templates);

      const highRiskFindings = analyzedFindings.filter(f => f.riskLevel === 'high').length;
      const riskLevel = highRiskFindings > 2
        ? 'high'
        : highRiskFindings > 0
          ? 'medium'
          : 'low';

      return {
        findings: analyzedFindings,
        recommendations,
        estimatedTime,
        riskLevel,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.logger?.(`[AutoHealer] Failed to get healing recommendations: ${message}`);
      throw new Error(`Failed to get healing recommendations: ${message}`);
    }
  }

  private summarizeEstimatedTime(templates: FixTemplate[]): string {
    try {
      if (templates.length === 0) {
        return "0 minutes";
      }
      if (templates.length === 1) {
        return templates[0]?.estimatedTime ?? "0 minutes";
      }

      const minutes = templates
        .map((template) => this.estimateMinutes(template.estimatedTime))
        .filter((value): value is number => typeof value === "number")
        .reduce((sum, value) => sum + value, 0);

      if (minutes <= 0) {
        return `${templates.length} tasks`;
      }
      return minutes >= 60 ? `${Math.round(minutes / 60)} hours` : `${minutes} minutes`;
    } catch (error) {
      this.ctx.logger?.('[AutoHealer] Failed to summarize estimated time:', error);
      return `${templates.length} tasks`;
    }
  }

  private estimateMinutes(value: string): number | null {
    try {
      const matches = value.match(/\d+/g);
      if (!matches || matches.length === 0) {
        return null;
      }
      const numbers = matches.map((entry) => Number.parseInt(entry, 10)).filter((n) => !Number.isNaN(n));
      if (numbers.length === 0) {
        return null;
      }
      const average = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
      return Math.round(average);
    } catch (error) {
      this.ctx.logger?.('[AutoHealer] Failed to estimate minutes:', error);
      return null;
    }
  }
}
