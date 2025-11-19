/**
 * Security Monitoring Service
 * Centralized security monitoring and alerting for commercial deployments
 * Requirements: 6.4, 7.1, 10.5
 */

import {
  type SecurityDashboard,
  ThreatDetectionEngine,
  type ThreatDetectionResult,
} from "../plugins/commercial-security.js";
import type { DiagnosticContext } from "@brainwav/cortexdx-core";
import {
  type AuditEntry,
  AuditLogger,
  type ComplianceReport,
  ComplianceReporter,
  type SecurityAlert,
  SecurityMonitor,
} from "./audit-compliance.js";

export interface SecurityMonitoringConfig {
  enableAuditLogging: boolean;
  enableThreatDetection: boolean;
  enableComplianceReporting: boolean;
  alertThresholds: AlertThresholds;
  complianceFrameworks: Array<"owasp" | "gdpr" | "hipaa" | "sox" | "custom">;
}

export interface AlertThresholds {
  failedAuthAttempts: number;
  requestsPerMinute: number;
  criticalVulnerabilities: number;
  complianceScoreMin: number;
}

export interface SecurityReport {
  timestamp: Date;
  period: { start: Date; end: Date };
  summary: SecuritySummary;
  auditEntries: AuditEntry[];
  threats: ThreatDetectionResult[];
  alerts: SecurityAlert[];
  complianceReports: ComplianceReport[];
  dashboard: SecurityDashboard;
  recommendations: string[];
}

export interface SecuritySummary {
  totalEvents: number;
  criticalEvents: number;
  threatsDetected: number;
  complianceStatus: "compliant" | "partial" | "non-compliant";
  overallRisk: "low" | "medium" | "high" | "critical";
}

const DEFAULT_CONFIG: SecurityMonitoringConfig = {
  enableAuditLogging: true,
  enableThreatDetection: true,
  enableComplianceReporting: true,
  alertThresholds: {
    failedAuthAttempts: 5,
    requestsPerMinute: 100,
    criticalVulnerabilities: 1,
    complianceScoreMin: 70,
  },
  complianceFrameworks: ["owasp"],
};

/**
 * Centralized security monitoring service
 */
export class SecurityMonitoringService {
  private readonly config: SecurityMonitoringConfig;
  private readonly auditLogger: AuditLogger;
  private readonly securityMonitor: SecurityMonitor;
  private readonly complianceReporter: ComplianceReporter;
  private readonly threatEngine: ThreatDetectionEngine;

  constructor(config: Partial<SecurityMonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.auditLogger = new AuditLogger();
    this.securityMonitor = new SecurityMonitor(this.auditLogger);
    this.complianceReporter = new ComplianceReporter(this.auditLogger);
    this.threatEngine = new ThreatDetectionEngine(
      this.auditLogger,
      this.securityMonitor,
    );
  }

  async monitorEndpoint(ctx: DiagnosticContext): Promise<void> {
    if (this.config.enableAuditLogging) {
      this.auditLogger.log({
        action: "endpoint-access",
        resource: ctx.endpoint,
        result: "success",
        details: { timestamp: Date.now() },
        severity: "info",
      });
    }

    if (this.config.enableThreatDetection) {
      await this.threatEngine.detectThreats(ctx);
    }
  }

  async generateSecurityReport(period: {
    start: Date;
    end: Date;
  }): Promise<SecurityReport> {
    const timestamp = new Date();
    const auditEntries = this.auditLogger.getEntries();
    const threats = this.threatEngine.getThreats();
    const alerts = this.securityMonitor.getAlerts();

    const filteredEntries = auditEntries.filter(
      (e) => e.timestamp >= period.start && e.timestamp <= period.end,
    );

    const complianceReports: ComplianceReport[] = [];
    for (const framework of this.config.complianceFrameworks) {
      const report = await this.complianceReporter.generateReport(
        framework,
        period,
      );
      complianceReports.push(report);
    }

    const summary = this.generateSummary(
      filteredEntries,
      threats,
      alerts,
      complianceReports,
    );

    const dashboard = await this.generateDashboard();

    const recommendations = this.generateRecommendations(
      summary,
      threats,
      complianceReports,
    );

    return {
      timestamp,
      period,
      summary,
      auditEntries: filteredEntries,
      threats,
      alerts,
      complianceReports,
      dashboard,
      recommendations,
    };
  }

  private generateSummary(
    entries: AuditEntry[],
    threats: ThreatDetectionResult[],
    alerts: SecurityAlert[],
    complianceReports: ComplianceReport[],
  ): SecuritySummary {
    const criticalEvents = entries.filter(
      (e) => e.severity === "critical",
    ).length;
    const threatsDetected = threats.length;

    const avgComplianceScore =
      complianceReports.reduce((sum, r) => sum + r.score, 0) /
      complianceReports.length;

    const complianceStatus: SecuritySummary["complianceStatus"] =
      avgComplianceScore >= 80
        ? "compliant"
        : avgComplianceScore >= 60
          ? "partial"
          : "non-compliant";

    const overallRisk = this.calculateOverallRisk(
      criticalEvents,
      threatsDetected,
      avgComplianceScore,
    );

    return {
      totalEvents: entries.length,
      criticalEvents,
      threatsDetected,
      complianceStatus,
      overallRisk,
    };
  }

  private calculateOverallRisk(
    criticalEvents: number,
    threats: number,
    complianceScore: number,
  ): SecuritySummary["overallRisk"] {
    if (criticalEvents > 10 || threats > 5 || complianceScore < 50) {
      return "critical";
    }
    if (criticalEvents > 5 || threats > 2 || complianceScore < 70) {
      return "high";
    }
    if (criticalEvents > 0 || threats > 0 || complianceScore < 85) {
      return "medium";
    }
    return "low";
  }

  private generateRecommendations(
    summary: SecuritySummary,
    threats: ThreatDetectionResult[],
    complianceReports: ComplianceReport[],
  ): string[] {
    const recommendations: string[] = [];

    if (summary.overallRisk === "critical" || summary.overallRisk === "high") {
      recommendations.push("Immediate security review required");
      recommendations.push("Implement additional security controls");
    }

    if (summary.threatsDetected > 0) {
      recommendations.push(
        `Address ${summary.threatsDetected} detected threats`,
      );
      const criticalThreats = threats.filter((t) => t.severity === "critical");
      if (criticalThreats.length > 0) {
        recommendations.push(
          `URGENT: ${criticalThreats.length} critical threats require immediate attention`,
        );
      }
    }

    if (summary.complianceStatus !== "compliant") {
      recommendations.push("Improve compliance posture");
      for (const report of complianceReports) {
        if (!report.passed) {
          recommendations.push(
            `Address ${report.framework.toUpperCase()} compliance gaps`,
          );
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Security posture is good - maintain current controls",
      );
    }

    return recommendations;
  }

  private async generateDashboard(): Promise<SecurityDashboard> {
    const timestamp = new Date();
    const entries = this.auditLogger.getEntries();
    const alerts = this.securityMonitor.getAlerts();
    const threats = this.threatEngine.getThreats();

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const complianceReport = await this.complianceReporter.generateReport(
      "owasp",
      {
        start: new Date(weekAgo),
        end: new Date(now),
      },
    );

    const complianceStatus: SecurityDashboard["complianceStatus"] =
      complianceReport.score >= 80
        ? "compliant"
        : complianceReport.score >= 60
          ? "partial"
          : "non-compliant";

    const criticalAlerts = alerts.filter(
      (a) => a.severity === "critical" || a.severity === "high",
    );

    const overallScore = Math.max(
      0,
      complianceReport.score - criticalAlerts.length * 5 - threats.length * 3,
    );

    return {
      timestamp,
      overallScore,
      activeThreats: threats.filter(
        (t) => t.severity === "critical" || t.severity === "high",
      ).length,
      recentAlerts: criticalAlerts.length,
      complianceStatus,
      metrics: {
        totalAuditEntries: entries.length,
        failedAuthAttempts: entries.filter(
          (e) => e.action === "authentication" && e.result === "denied",
        ).length,
        blockedRequests: entries.filter((e) => e.result === "denied").length,
        vulnerabilitiesDetected: alerts.filter(
          (a) => a.type === "vulnerability",
        ).length,
        complianceScore: complianceReport.score,
        averageResponseTimeMs: 0,
      },
    };
  }

  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  getSecurityMonitor(): SecurityMonitor {
    return this.securityMonitor;
  }

  getComplianceReporter(): ComplianceReporter {
    return this.complianceReporter;
  }

  getThreatEngine(): ThreatDetectionEngine {
    return this.threatEngine;
  }
}
