import type { DiagnosticPlugin, Finding } from "../types.js";
import type { ResearchContent } from "./license-validator.js";
import { validateAcademicLicense } from "./license-validator.js";

// Compliance tracking types
export interface ComplianceRecord {
  id: string;
  timestamp: number;
  provider: string;
  contentType: "research" | "citation" | "methodology" | "implementation";
  contentId: string;
  contentTitle: string;
  licenseStatus: string;
  approvalRequired: boolean;
  approvalGranted?: boolean;
  approvalDate?: number;
  approver?: string;
  auditTrail: AuditEntry[];
  riskLevel: "low" | "medium" | "high";
}

export interface AuditEntry {
  timestamp: number;
  action: string;
  actor: string;
  details: string;
  metadata?: Record<string, unknown>;
}

export interface ComplianceReport {
  period: { start: number; end: number };
  totalRecords: number;
  compliantRecords: number;
  requiresApprovalRecords: number;
  nonCompliantRecords: number;
  providers: Map<string, number>;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  findings: Finding[];
}

export interface LegalFramework {
  jurisdiction: string;
  regulations: string[];
  approvedLicenses: string[];
  prohibitedLicenses: string[];
  approvalWorkflow: ApprovalWorkflow;
}

export interface ApprovalWorkflow {
  steps: ApprovalStep[];
  requiredApprovers: string[];
  timeoutDays: number;
  escalationPolicy: string;
}

export interface ApprovalStep {
  order: number;
  name: string;
  approver: string;
  required: boolean;
  timeoutDays: number;
}

// Compliance Monitor Plugin
export const ComplianceMonitorPlugin: DiagnosticPlugin = {
  id: "compliance-monitor",
  title: "Academic Integration Compliance Monitor",
  order: 105,
  async run(ctx) {
    const findings: Finding[] = [];

    findings.push({
      id: "compliance.monitor.active",
      area: "compliance",
      severity: "info",
      title: "Compliance monitoring active",
      description:
        "Tracking academic integration usage and license compliance.",
      evidence: [{ type: "log", ref: "compliance-monitor" }],
      tags: ["compliance", "monitoring", "academic"],
    });

    return findings;
  },
};

// Track academic integration usage
export function trackAcademicIntegration(
  provider: string,
  content: ResearchContent,
  contentType: ComplianceRecord["contentType"],
): ComplianceRecord {
  const validation = validateAcademicLicense(content);

  const record: ComplianceRecord = {
    id: `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    provider,
    contentType,
    contentId: content.doi || content.url || content.title,
    contentTitle: content.title,
    licenseStatus: validation.complianceStatus,
    approvalRequired: validation.requiresApproval,
    auditTrail: [
      {
        timestamp: Date.now(),
        action: "integration-tracked",
        actor: "system",
        details: `Academic content from ${provider} tracked for compliance`,
      },
    ],
    riskLevel: validation.riskLevel,
  };

  return record;
}

// Add audit entry to compliance record
export function addAuditEntry(
  record: ComplianceRecord,
  action: string,
  actor: string,
  details: string,
  metadata?: Record<string, unknown>,
): void {
  record.auditTrail.push({
    timestamp: Date.now(),
    action,
    actor,
    details,
    metadata,
  });
}

// Request approval for compliance record
export function requestApproval(
  record: ComplianceRecord,
  requester: string,
  justification: string,
): void {
  addAuditEntry(
    record,
    "approval-requested",
    requester,
    `Approval requested: ${justification}`,
  );
}

// Grant approval for compliance record
export function grantApproval(
  record: ComplianceRecord,
  approver: string,
  notes?: string,
): void {
  record.approvalGranted = true;
  record.approvalDate = Date.now();
  record.approver = approver;

  addAuditEntry(
    record,
    "approval-granted",
    approver,
    notes || "Approval granted for academic content usage",
  );
}

// Deny approval for compliance record
export function denyApproval(
  record: ComplianceRecord,
  approver: string,
  reason: string,
): void {
  record.approvalGranted = false;
  record.approvalDate = Date.now();
  record.approver = approver;

  addAuditEntry(record, "approval-denied", approver, `Denied: ${reason}`);
}

// Generate compliance report
export function generateComplianceReport(
  records: ComplianceRecord[],
  period: { start: number; end: number },
): ComplianceReport {
  const filteredRecords = records.filter(
    (r) => r.timestamp >= period.start && r.timestamp <= period.end,
  );

  const providers = new Map<string, number>();
  const riskDistribution = { low: 0, medium: 0, high: 0 };
  let compliantRecords = 0;
  let requiresApprovalRecords = 0;
  let nonCompliantRecords = 0;

  for (const record of filteredRecords) {
    // Count by provider
    const count = providers.get(record.provider) || 0;
    providers.set(record.provider, count + 1);

    // Count by risk level
    riskDistribution[record.riskLevel] += 1;

    // Count by compliance status
    if (record.licenseStatus === "compliant") {
      compliantRecords += 1;
    } else if (record.licenseStatus === "requires_approval") {
      requiresApprovalRecords += 1;
    } else {
      nonCompliantRecords += 1;
    }
  }

  const findings: Finding[] = [];

  // Generate findings for non-compliant records
  if (nonCompliantRecords > 0) {
    findings.push({
      id: "compliance.non-compliant",
      area: "compliance",
      severity: "major",
      title: "Non-compliant academic integrations detected",
      description: `${nonCompliantRecords} academic integrations are non-compliant with licensing requirements.`,
      evidence: [{ type: "log", ref: "compliance-report" }],
      tags: ["compliance", "non-compliant", "risk"],
      recommendation:
        "Review non-compliant integrations and remove or seek approval",
    });
  }

  // Generate findings for pending approvals
  if (requiresApprovalRecords > 0) {
    const pendingApprovals = filteredRecords.filter(
      (r) => r.approvalRequired && !r.approvalGranted,
    );

    if (pendingApprovals.length > 0) {
      findings.push({
        id: "compliance.pending-approvals",
        area: "compliance",
        severity: "minor",
        title: "Academic integrations pending approval",
        description: `${pendingApprovals.length} academic integrations require legal approval.`,
        evidence: [{ type: "log", ref: "compliance-report" }],
        tags: ["compliance", "approval-required"],
        recommendation: "Submit pending integrations for legal review",
      });
    }
  }

  // Generate summary finding
  findings.push({
    id: "compliance.summary",
    area: "compliance",
    severity: "info",
    title: "Compliance monitoring summary",
    description: `Period: ${new Date(period.start).toISOString()} to ${new Date(period.end).toISOString()}. Total: ${filteredRecords.length}, Compliant: ${compliantRecords}, Requires Approval: ${requiresApprovalRecords}, Non-compliant: ${nonCompliantRecords}`,
    evidence: [{ type: "log", ref: "compliance-report" }],
    tags: ["compliance", "summary", "reporting"],
  });

  return {
    period,
    totalRecords: filteredRecords.length,
    compliantRecords,
    requiresApprovalRecords,
    nonCompliantRecords,
    providers,
    riskDistribution,
    findings,
  };
}

// Export compliance report to findings
export function exportComplianceFindings(
  records: ComplianceRecord[],
): Finding[] {
  const findings: Finding[] = [];

  for (const record of records) {
    if (record.licenseStatus === "non_compliant") {
      findings.push({
        id: `compliance.${record.id}`,
        area: "compliance",
        severity: record.riskLevel === "high" ? "major" : "minor",
        title: `Non-compliant: ${record.contentTitle}`,
        description: `Academic content from ${record.provider} is non-compliant. ${record.approvalRequired ? "Requires approval." : ""}`,
        evidence: [
          {
            type: "log",
            ref: record.contentId,
          },
        ],
        tags: ["compliance", "non-compliant", record.provider],
        recommendation:
          "Review license and seek approval or remove integration",
      });
    }
  }

  return findings;
}

// Check if record needs escalation
export function needsEscalation(
  record: ComplianceRecord,
  framework: LegalFramework,
): boolean {
  if (!record.approvalRequired) {
    return false;
  }

  if (record.approvalGranted !== undefined) {
    return false;
  }

  const daysSinceCreation =
    (Date.now() - record.timestamp) / (1000 * 60 * 60 * 24);

  return daysSinceCreation > framework.approvalWorkflow.timeoutDays;
}

// Get compliance statistics
export function getComplianceStatistics(records: ComplianceRecord[]): {
  total: number;
  compliant: number;
  requiresApproval: number;
  nonCompliant: number;
  complianceRate: number;
} {
  const total = records.length;
  const compliant = records.filter(
    (r) => r.licenseStatus === "compliant",
  ).length;
  const requiresApproval = records.filter(
    (r) => r.licenseStatus === "requires_approval",
  ).length;
  const nonCompliant = records.filter(
    (r) => r.licenseStatus === "non_compliant",
  ).length;
  const complianceRate = total > 0 ? (compliant / total) * 100 : 0;

  return {
    total,
    compliant,
    requiresApproval,
    nonCompliant,
    complianceRate,
  };
}
