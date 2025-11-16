/**
 * Commercial Security Features Plugin
 * Enterprise-grade security monitoring, audit logging, and threat detection
 * Requirements: 6.4, 7.1, 10.5
 */

import { randomUUID } from "node:crypto";
import {
  AuditLogger,
  ComplianceReporter,
  SecurityMonitor,
} from "../security/audit-compliance.js";
import { OwaspSecurityScanner } from "../security/security-validator.js";
import type { DiagnosticContext, DiagnosticPlugin, Finding } from "../types.js";

export interface ThreatDetectionResult {
  id: string;
  type: "intrusion" | "anomaly" | "policy-violation" | "data-exfiltration";
  severity: "low" | "medium" | "high" | "critical";
  timestamp: Date;
  description: string;
  indicators: string[];
  affectedResources: string[];
  recommendedActions: string[];
  confidence: number;
}

export interface SecurityDashboard {
  timestamp: Date;
  overallScore: number;
  activeThreats: number;
  recentAlerts: number;
  complianceStatus: "compliant" | "partial" | "non-compliant";
  metrics: SecurityMetrics;
}

export interface SecurityMetrics {
  totalAuditEntries: number;
  failedAuthAttempts: number;
  blockedRequests: number;
  vulnerabilitiesDetected: number;
  complianceScore: number;
  averageResponseTimeMs: number;
}

/**
 * Threat detection engine for real-time security monitoring
 */
export class ThreatDetectionEngine {
  private readonly auditLogger: AuditLogger;
  private readonly securityMonitor: SecurityMonitor;
  private threats: ThreatDetectionResult[] = [];

  constructor(auditLogger: AuditLogger, securityMonitor: SecurityMonitor) {
    this.auditLogger = auditLogger;
    this.securityMonitor = securityMonitor;
  }

  async detectThreats(
    ctx: DiagnosticContext,
  ): Promise<ThreatDetectionResult[]> {
    const threats: ThreatDetectionResult[] = [];

    threats.push(...(await this.detectIntrusionAttempts(ctx)));
    threats.push(...(await this.detectAnomalies(ctx)));
    threats.push(...(await this.detectPolicyViolations(ctx)));

    this.threats.push(...threats);

    for (const threat of threats) {
      if (threat.severity === "critical" || threat.severity === "high") {
        this.securityMonitor.raiseAlert({
          type: this.mapThreatType(threat.type),
          severity: threat.severity,
          title: `Threat Detected: ${threat.type}`,
          description: threat.description,
          affectedResources: threat.affectedResources,
          recommendations: threat.recommendedActions,
        });
      }
    }

    return threats;
  }

  private async detectIntrusionAttempts(
    ctx: DiagnosticContext,
  ): Promise<ThreatDetectionResult[]> {
    const threats: ThreatDetectionResult[] = [];
    const entries = this.auditLogger.getEntries({ result: "denied" });

    const failedAuthCount = entries.filter(
      (e) => e.action === "authentication" && e.result === "denied",
    ).length;

    if (failedAuthCount > 5) {
      threats.push({
        id: this.generateId(),
        type: "intrusion",
        severity: "high",
        timestamp: new Date(),
        description: `Multiple failed authentication attempts detected (${failedAuthCount} attempts)`,
        indicators: ["repeated-auth-failures", "brute-force-pattern"],
        affectedResources: [ctx.endpoint],
        recommendedActions: [
          "Enable rate limiting",
          "Implement account lockout",
          "Review authentication logs",
          "Consider IP blocking",
        ],
        confidence: 0.85,
      });
    }

    return threats;
  }

  private async detectAnomalies(
    ctx: DiagnosticContext,
  ): Promise<ThreatDetectionResult[]> {
    const threats: ThreatDetectionResult[] = [];
    const entries = this.auditLogger.getEntries();

    const recentEntries = entries.filter(
      (e) => Date.now() - e.timestamp.getTime() < 60000,
    );

    if (recentEntries.length > 100) {
      threats.push({
        id: this.generateId(),
        type: "anomaly",
        severity: "medium",
        timestamp: new Date(),
        description: `Unusual activity spike detected (${recentEntries.length} requests in 1 minute)`,
        indicators: ["high-request-rate", "potential-dos"],
        affectedResources: [ctx.endpoint],
        recommendedActions: [
          "Implement rate limiting",
          "Monitor for DDoS patterns",
          "Review request sources",
        ],
        confidence: 0.75,
      });
    }

    return threats;
  }

  private async detectPolicyViolations(
    ctx: DiagnosticContext,
  ): Promise<ThreatDetectionResult[]> {
    const threats: ThreatDetectionResult[] = [];

    if (ctx.endpoint.startsWith("http://")) {
      threats.push({
        id: this.generateId(),
        type: "policy-violation",
        severity: "high",
        timestamp: new Date(),
        description: "Unencrypted HTTP connection violates security policy",
        indicators: ["no-tls", "plaintext-transmission"],
        affectedResources: [ctx.endpoint],
        recommendedActions: [
          "Enforce HTTPS/TLS",
          "Disable HTTP endpoints",
          "Update security policy",
        ],
        confidence: 1.0,
      });
    }

    return threats;
  }

  getThreats(
    filter?: Partial<Pick<ThreatDetectionResult, "type" | "severity">>,
  ): ThreatDetectionResult[] {
    if (!filter) return [...this.threats];

    return this.threats.filter((threat) => {
      return Object.entries(filter).every(([key, value]) => {
        return threat[key as keyof ThreatDetectionResult] === value;
      });
    });
  }

  clearThreats(): void {
    this.threats = [];
  }

  private mapThreatType(
    type: ThreatDetectionResult["type"],
  ): "vulnerability" | "breach-attempt" | "policy-violation" {
    if (type === "intrusion") return "breach-attempt";
    if (type === "policy-violation") return "policy-violation";
    return "vulnerability";
  }

  private generateId(): string {
    return `threat-${randomUUID()}`;
  }
}

/**
 * Security dashboard for enterprise monitoring
 */
export class EnterpriseSecurityDashboard {
  private readonly auditLogger: AuditLogger;
  private readonly securityMonitor: SecurityMonitor;
  private readonly complianceReporter: ComplianceReporter;
  private readonly threatEngine: ThreatDetectionEngine;
  private readonly scanner: OwaspSecurityScanner;

  constructor(
    auditLogger: AuditLogger,
    securityMonitor: SecurityMonitor,
    complianceReporter: ComplianceReporter,
    threatEngine: ThreatDetectionEngine,
  ) {
    this.auditLogger = auditLogger;
    this.securityMonitor = securityMonitor;
    this.complianceReporter = complianceReporter;
    this.threatEngine = threatEngine;
    this.scanner = new OwaspSecurityScanner();
  }

  async generateDashboard(): Promise<SecurityDashboard> {
    const timestamp = new Date();
    const entries = this.auditLogger.getEntries();
    const alerts = this.securityMonitor.getAlerts();
    const threats = this.threatEngine.getThreats();

    const failedAuthAttempts = entries.filter(
      (e) => e.action === "authentication" && e.result === "denied",
    ).length;

    const blockedRequests = entries.filter((e) => e.result === "denied").length;

    const criticalAlerts = alerts.filter(
      (a) => a.severity === "critical" || a.severity === "high",
    );

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const complianceReport = await this.complianceReporter.generateReport(
      "owasp",
      { start: new Date(weekAgo), end: new Date(now) },
    );

    const complianceStatus: SecurityDashboard["complianceStatus"] =
      complianceReport.score >= 80
        ? "compliant"
        : complianceReport.score >= 60
          ? "partial"
          : "non-compliant";

    const overallScore = this.calculateOverallScore(
      complianceReport.score,
      criticalAlerts.length,
      threats.length,
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
        failedAuthAttempts,
        blockedRequests,
        vulnerabilitiesDetected: alerts.filter(
          (a) => a.type === "vulnerability",
        ).length,
        complianceScore: complianceReport.score,
        averageResponseTimeMs: this.calculateAverageResponseTime(entries),
      },
    };
  }

  private calculateOverallScore(
    complianceScore: number,
    criticalAlerts: number,
    threats: number,
  ): number {
    let score = complianceScore;
    score -= criticalAlerts * 5;
    score -= threats * 3;
    return Math.max(0, Math.min(100, score));
  }

  private calculateAverageResponseTime(
    entries: Array<{ timestamp: Date }>,
  ): number {
    if (entries.length < 2) return 0;

    const times: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      const current = entries[i];
      const previous = entries[i - 1];
      if (current && previous) {
        const diff = current.timestamp.getTime() - previous.timestamp.getTime();
        times.push(diff);
      }
    }

    return times.length > 0
      ? times.reduce((sum, t) => sum + t, 0) / times.length
      : 0;
  }
}

/**
 * Commercial Security Features Plugin
 */
export const CommercialSecurityPlugin: DiagnosticPlugin = {
  id: "commercial-security",
  title: "Enterprise Security Monitoring",
  order: 96,
  async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const auditLogger = new AuditLogger();
    const securityMonitor = new SecurityMonitor(auditLogger);
    const complianceReporter = new ComplianceReporter(auditLogger);
    const threatEngine = new ThreatDetectionEngine(
      auditLogger,
      securityMonitor,
    );

    auditLogger.log({
      action: "security-scan",
      resource: ctx.endpoint,
      result: "success",
      details: { plugin: "commercial-security" },
      severity: "info",
    });

    const threats = await threatEngine.detectThreats(ctx);

    for (const threat of threats) {
      findings.push({
        id: threat.id,
        area: "security",
        severity: mapThreatSeverity(threat.severity),
        title: `Threat: ${threat.type}`,
        description: `${threat.description}\n\nIndicators: ${threat.indicators.join(", ")}\n\nRecommended Actions:\n${threat.recommendedActions.map((a) => `- ${a}`).join("\n")}`,
        evidence: threat.affectedResources.map((ref) => ({
          type: "url" as const,
          ref,
        })),
        tags: ["threat-detection", threat.type, "commercial"],
        confidence: threat.confidence,
      });
    }

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const complianceReport = await complianceReporter.generateReport("owasp", {
      start: new Date(weekAgo),
      end: new Date(now),
    });

    findings.push({
      id: "commercial-security.compliance",
      area: "security",
      severity: complianceReport.passed ? "info" : "major",
      title: `Compliance Report: ${complianceReport.framework.toUpperCase()}`,
      description: `Compliance Score: ${complianceReport.score}/100\nStatus: ${complianceReport.passed ? "PASSED" : "FAILED"}\n\nRecommendations:\n${complianceReport.recommendations.map((r) => `- ${r}`).join("\n")}`,
      evidence: [{ type: "log", ref: complianceReport.id }],
      tags: ["compliance", "audit", "commercial"],
      confidence: 0.95,
    });

    const dashboard = new EnterpriseSecurityDashboard(
      auditLogger,
      securityMonitor,
      complianceReporter,
      threatEngine,
    );
    const dashboardData = await dashboard.generateDashboard();

    findings.push({
      id: "commercial-security.dashboard",
      area: "security",
      severity: dashboardData.overallScore >= 70 ? "info" : "major",
      title: "Enterprise Security Dashboard",
      description: `Overall Security Score: ${dashboardData.overallScore}/100\nActive Threats: ${dashboardData.activeThreats}\nRecent Alerts: ${dashboardData.recentAlerts}\nCompliance Status: ${dashboardData.complianceStatus}\n\nMetrics:\n- Total Audit Entries: ${dashboardData.metrics.totalAuditEntries}\n- Failed Auth Attempts: ${dashboardData.metrics.failedAuthAttempts}\n- Blocked Requests: ${dashboardData.metrics.blockedRequests}\n- Vulnerabilities: ${dashboardData.metrics.vulnerabilitiesDetected}\n- Compliance Score: ${dashboardData.metrics.complianceScore}/100`,
      evidence: [{ type: "url", ref: ctx.endpoint }],
      tags: ["dashboard", "monitoring", "commercial"],
      confidence: 1.0,
    });

    return findings;
  },
};

function mapThreatSeverity(
  severity: "low" | "medium" | "high" | "critical",
): "info" | "minor" | "major" | "blocker" {
  const map = {
    low: "info" as const,
    medium: "minor" as const,
    high: "major" as const,
    critical: "blocker" as const,
  };
  return map[severity];
}
