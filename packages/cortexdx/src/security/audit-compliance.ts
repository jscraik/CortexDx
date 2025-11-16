/**
 * Audit and Compliance Module
 * Security monitoring and compliance reporting
 * Requirements: 6.4, 7.1, 10.5
 */

import { randomUUID } from "node:crypto";

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  result: "success" | "failure" | "denied";
  details: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: "vulnerability" | "breach-attempt" | "policy-violation";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  affectedResources: string[];
  recommendations: string[];
}

export interface ComplianceReport {
  id: string;
  timestamp: Date;
  period: { start: Date; end: Date };
  framework: "owasp" | "gdpr" | "hipaa" | "sox" | "custom";
  score: number;
  passed: boolean;
  findings: ComplianceFinding[];
  recommendations: string[];
}

interface ComplianceFinding {
  id: string;
  control: string;
  status: "compliant" | "non-compliant" | "partial";
  evidence: string[];
  gaps?: string[];
}

/**
 * Audit logger for security events
 */
export class AuditLogger {
  private entries: AuditEntry[] = [];
  private readonly maxEntries = 10000;

  log(entry: Omit<AuditEntry, "id" | "timestamp">): void {
    const auditEntry: AuditEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      ...entry,
    };

    this.entries.push(auditEntry);

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  getEntries(filter?: Partial<AuditEntry>): AuditEntry[] {
    if (!filter) return [...this.entries];

    return this.entries.filter((entry) => {
      return Object.entries(filter).every(([key, value]) => {
        return entry[key as keyof AuditEntry] === value;
      });
    });
  }

  clear(): void {
    this.entries = [];
  }

  private generateId(): string {
    return `audit-${randomUUID()}`;
  }
}

/**
 * Security monitoring system
 */
export class SecurityMonitor {
  private alerts: SecurityAlert[] = [];
  private readonly auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  raiseAlert(alert: Omit<SecurityAlert, "id" | "timestamp">): void {
    const securityAlert: SecurityAlert = {
      id: this.generateId(),
      timestamp: new Date(),
      ...alert,
    };

    this.alerts.push(securityAlert);

    this.auditLogger.log({
      action: "security-alert",
      resource: alert.affectedResources.join(","),
      result: "success",
      details: { alert: securityAlert },
      severity: this.mapSeverity(alert.severity),
    });
  }

  getAlerts(
    filter?: Partial<Pick<SecurityAlert, "type" | "severity">>,
  ): SecurityAlert[] {
    if (!filter) return [...this.alerts];

    return this.alerts.filter((alert) => {
      return Object.entries(filter).every(([key, value]) => {
        return alert[key as keyof SecurityAlert] === value;
      });
    });
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  private generateId(): string {
    return `alert-${randomUUID()}`;
  }

  private mapSeverity(
    severity: "low" | "medium" | "high" | "critical",
  ): "info" | "warning" | "critical" {
    if (severity === "low") return "info";
    if (severity === "critical" || severity === "high") return "critical";
    return "warning";
  }
}

/**
 * Compliance reporter
 */
export class ComplianceReporter {
  private readonly auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  async generateReport(
    framework: ComplianceReport["framework"],
    period: { start: Date; end: Date },
  ): Promise<ComplianceReport> {
    const findings = await this.assessCompliance(framework, period);
    const score = this.calculateScore(findings);
    const passed = score >= 80;

    const report: ComplianceReport = {
      id: this.generateId(),
      timestamp: new Date(),
      period,
      framework,
      score,
      passed,
      findings,
      recommendations: this.generateRecommendations(findings),
    };

    this.auditLogger.log({
      action: "compliance-report",
      resource: framework,
      result: passed ? "success" : "failure",
      details: { report },
      severity: passed ? "info" : "warning",
    });

    return report;
  }

  private async assessCompliance(
    framework: ComplianceReport["framework"],
    period: { start: Date; end: Date },
  ): Promise<ComplianceFinding[]> {
    const entries = this.auditLogger.getEntries();
    const relevantEntries = entries.filter(
      (e) => e.timestamp >= period.start && e.timestamp <= period.end,
    );

    const findings: ComplianceFinding[] = [];

    if (framework === "owasp") {
      findings.push(
        this.assessOwaspControl(
          "A01:2021",
          "Broken Access Control",
          relevantEntries,
        ),
        this.assessOwaspControl(
          "A02:2021",
          "Cryptographic Failures",
          relevantEntries,
        ),
        this.assessOwaspControl("A03:2021", "Injection", relevantEntries),
        this.assessOwaspControl(
          "A07:2021",
          "Authentication Failures",
          relevantEntries,
        ),
        this.assessOwaspControl(
          "A09:2021",
          "Logging Failures",
          relevantEntries,
        ),
      );
    }

    return findings;
  }

  private assessOwaspControl(
    id: string,
    name: string,
    entries: AuditEntry[],
  ): ComplianceFinding {
    const violations = entries.filter(
      (e) => e.result === "denied" || e.result === "failure",
    );

    const status: ComplianceFinding["status"] =
      violations.length === 0
        ? "compliant"
        : violations.length < 5
          ? "partial"
          : "non-compliant";

    return {
      id,
      control: name,
      status,
      evidence: entries.slice(0, 10).map((e) => e.id),
      gaps:
        status !== "compliant"
          ? [`${violations.length} violations detected`]
          : undefined,
    };
  }

  private calculateScore(findings: ComplianceFinding[]): number {
    if (findings.length === 0) return 100;

    const weights = { compliant: 100, partial: 60, "non-compliant": 0 };
    const totalScore = findings.reduce((sum, f) => sum + weights[f.status], 0);

    return Math.round(totalScore / findings.length);
  }

  private generateRecommendations(findings: ComplianceFinding[]): string[] {
    const recommendations: string[] = [];

    const nonCompliant = findings.filter((f) => f.status === "non-compliant");
    if (nonCompliant.length > 0) {
      recommendations.push(
        `Address ${nonCompliant.length} non-compliant controls immediately`,
      );
    }

    const partial = findings.filter((f) => f.status === "partial");
    if (partial.length > 0) {
      recommendations.push(
        `Improve ${partial.length} partially compliant controls`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Maintain current security posture");
    }

    return recommendations;
  }

  private generateId(): string {
    return `report-${randomUUID()}`;
  }
}
