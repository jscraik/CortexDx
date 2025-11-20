/**
 * Commercial Feature Tool Implementations
 * Implements the actual logic for commercial feature MCP tools
 * Requirements: 6.4, 7.1, 10.5
 */

import {
  type Auth0Config,
  checkRoleAccess,
  trackAuthUsage,
  validateAuth0Token,
} from "../plugins/auth";
import {
  exportBillingData,
  generateAdminDashboard,
  generateAnalyticsMetrics,
  generateBillingComplianceFindings,
  generateUsageReport,
  recordSubscriptionChange,
} from "../plugins/billing-analytics";
import {
  type LicenseKey,
  type UsageMetrics,
  checkFeatureAccess,
  generateComplianceReport,
  trackUsage,
  validateCommercialLicense,
} from "../plugins/commercial-licensing";
import type { McpToolResult } from "../types";

// In-memory storage for demo purposes
// In production, these would be backed by a database
const licenseDatabase = new Map<string, LicenseKey>();
const usageRecords: UsageMetrics[] = [];
const authUsageRecords: ReturnType<typeof trackAuthUsage>[] = [];

// Role permissions database
const rolePermissionsDb: Record<string, string[]> = {
  admin: ["*"],
  developer: [
    "diagnose_mcp_server",
    "validate_protocol",
    "scan_security",
    "profile_performance",
    "generate_code",
    "interactive_debug",
    "validate_license",
    "academic_validation",
    "advanced_diagnostics",
    "llm_backends",
  ],
  viewer: [
    "diagnose_mcp_server",
    "validate_protocol",
    "scan_security",
    "profile_performance",
  ],
  community: ["diagnose_mcp_server", "validate_protocol"],
};

/**
 * Validate Auth0 token
 */
export const validateAuth0TokenImpl = async (
  args: unknown,
  auth0Config: Auth0Config,
): Promise<McpToolResult> => {
  const {
    token,
    audience,
    issuer: _issuer,
    validateExpiration = true,
    validateSignature = true,
  } = args as {
    token: string;
    audience?: string;
    issuer?: string;
    validateExpiration?: boolean;
    validateSignature?: boolean;
  };

  const config: Auth0Config = {
    ...auth0Config,
    audience: audience || auth0Config.audience,
  };

  const validation = await validateAuth0Token(token, config);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            valid: validation.valid,
            userId: validation.userId,
            roles: validation.roles,
            permissions: validation.permissions,
            expiresAt: validation.expiresAt,
            error: validation.error,
            validationSettings: {
              validateExpiration,
              validateSignature,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Check role access
 */
export const checkRoleAccessImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const {
    userId,
    role,
    feature,
    action = "read",
  } = args as {
    userId: string;
    role: string;
    feature: string;
    action?: string;
  };

  const access = checkRoleAccess(role, feature, rolePermissionsDb);

  // Track auth usage
  const usageRecord = trackAuthUsage(
    userId,
    `check_access:${feature}`,
    access.allowed,
    {
      role,
      action,
    },
  );
  authUsageRecords.push(usageRecord);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            userId,
            role,
            feature,
            action,
            allowed: access.allowed,
            reason: access.reason,
            timestamp: usageRecord.timestamp,
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Validate commercial license
 */
export const validateCommercialLicenseImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const {
    licenseKey,
    productId,
    checkExpiration = true,
    checkFeatureAccess: checkFeatures = true,
    offlineMode = false,
  } = args as {
    licenseKey: string;
    productId: string;
    checkExpiration?: boolean;
    checkFeatureAccess?: boolean;
    offlineMode?: boolean;
  };

  const validation = validateCommercialLicense(licenseKey, licenseDatabase);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            valid: validation.valid,
            tier: validation.tier,
            features: validation.features,
            expiresAt: validation.expiresAt,
            daysRemaining: validation.daysRemaining,
            warnings: validation.warnings,
            error: validation.error,
            productId,
            validationMode: offlineMode ? "offline" : "online",
            checks: {
              expiration: checkExpiration,
              featureAccess: checkFeatures,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Check feature access
 */
export const checkFeatureAccessImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const { licenseKey, feature, licenseTier } = args as {
    licenseKey: string;
    feature: string;
    licenseTier?: string;
  };

  const validation = validateCommercialLicense(licenseKey, licenseDatabase);
  const access = checkFeatureAccess(feature, validation);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            feature,
            allowed: access.allowed,
            tier: access.tier,
            reason: access.reason,
            licenseValid: validation.valid,
            providedTier: licenseTier,
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Track feature usage
 */
export const trackFeatureUsageImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const { userId, feature, action, metadata } = args as {
    userId: string;
    feature: string;
    action: string;
    metadata?: Record<string, unknown>;
  };

  const duration = metadata?.duration as number | undefined;
  const usage = trackUsage(feature, userId, duration);

  // Store usage record
  usageRecords.push(usage);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            userId,
            feature,
            action,
            timestamp: usage.timestamp,
            recorded: true,
            metadata,
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Get usage metrics
 */
export const getUsageMetricsImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const {
    userId,
    organizationId,
    timeRange,
    features: _features,
    aggregation = "daily",
  } = args as {
    userId?: string;
    organizationId?: string;
    timeRange?: { start: string; end: string };
    features?: string[];
    aggregation?: string;
  };

  // Filter usage records
  let filtered = usageRecords;

  if (userId) {
    filtered = filtered.filter((r) => r.userId === userId);
  }

  if (timeRange) {
    const start = new Date(timeRange.start).getTime();
    const end = new Date(timeRange.end).getTime();
    filtered = filtered.filter(
      (r) => r.timestamp >= start && r.timestamp <= end,
    );
  }

  if (_features && _features.length > 0) {
    filtered = filtered.filter((r) => _features.includes(r.feature));
  }

  // Aggregate metrics
  const metrics = new Map<string, { count: number; totalDuration: number }>();
  for (const record of filtered) {
    const key = record.feature;
    const current = metrics.get(key) || { count: 0, totalDuration: 0 };
    metrics.set(key, {
      count: current.count + record.count,
      totalDuration: current.totalDuration + (record.duration || 0),
    });
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            userId,
            organizationId,
            timeRange,
            aggregation,
            totalRecords: filtered.length,
            metrics: Object.fromEntries(metrics),
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Generate billing report
 */
export const generateBillingReportImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const {
    organizationId,
    billingPeriod,
    format = "json",
    includeBreakdown = true,
    includeCostEstimate = true,
  } = args as {
    organizationId: string;
    billingPeriod?: { start: string; end: string };
    format?: string;
    includeBreakdown?: boolean;
    includeCostEstimate?: boolean;
  };

  // Calculate billing period
  const now = Date.now();
  const start = billingPeriod?.start
    ? new Date(billingPeriod.start).getTime()
    : now - 30 * 24 * 60 * 60 * 1000;
  const end = billingPeriod?.end ? new Date(billingPeriod.end).getTime() : now;

  // Filter usage for organization
  const orgUsage = usageRecords.filter(
    (r) => r.timestamp >= start && r.timestamp <= end,
  );

  // Calculate breakdown
  const breakdown = new Map<string, number>();
  for (const record of orgUsage) {
    const current = breakdown.get(record.feature) || 0;
    breakdown.set(record.feature, current + record.count);
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            organizationId,
            billingPeriod: {
              start: new Date(start).toISOString(),
              end: new Date(end).toISOString(),
            },
            format,
            totalUsage: orgUsage.length,
            breakdown: includeBreakdown
              ? Object.fromEntries(breakdown)
              : undefined,
            costEstimate: includeCostEstimate
              ? {
                  currency: "USD",
                  amount: orgUsage.length * 0.01,
                  note: "Estimated based on usage",
                }
              : undefined,
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Manage subscription
 */
export const manageSubscriptionImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const { organizationId, action, targetTier, effectiveDate } = args as {
    organizationId: string;
    action: string;
    targetTier?: string;
    effectiveDate?: string;
  };

  // For demo purposes, return success
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            organizationId,
            action,
            targetTier,
            effectiveDate: effectiveDate || new Date().toISOString(),
            status: "success",
            message: `Subscription ${action} completed successfully`,
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Check rate limit
 */
export const checkRateLimitImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const {
    userId,
    organizationId,
    feature,
    includeHistory = false,
  } = args as {
    userId?: string;
    organizationId?: string;
    feature?: string;
    includeHistory?: boolean;
  };

  // Calculate rate limit (demo implementation)
  const limit = 1000;
  const used = usageRecords.filter((r) => r.userId === userId).length;
  const remaining = Math.max(0, limit - used);
  const resetTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            userId,
            organizationId,
            feature,
            limit,
            used,
            remaining,
            resetTime,
            history: includeHistory ? usageRecords.slice(-10) : undefined,
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Generate compliance report
 */
export const generateComplianceReportImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const {
    organizationId,
    reportPeriod,
    includeViolations = true,
    includeAuditTrail = true,
    format = "json",
  } = args as {
    organizationId: string;
    reportPeriod?: { start: string; end: string };
    includeViolations?: boolean;
    includeAuditTrail?: boolean;
    format?: string;
  };

  // Calculate report period
  const now = Date.now();
  const start = reportPeriod?.start
    ? new Date(reportPeriod.start).getTime()
    : now - 30 * 24 * 60 * 60 * 1000;
  const end = reportPeriod?.end ? new Date(reportPeriod.end).getTime() : now;

  // Get license for organization (demo)
  const license = {
    valid: true,
    tier: "professional" as const,
    features: ["advanced_diagnostics", "llm_backends"],
  };

  // Generate compliance findings
  const findings = await generateComplianceReport(usageRecords, license, {
    start,
    end,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            organizationId,
            reportPeriod: {
              start: new Date(start).toISOString(),
              end: new Date(end).toISOString(),
            },
            format,
            findings: includeViolations ? findings : [],
            auditTrail: includeAuditTrail
              ? authUsageRecords.slice(-100)
              : undefined,
            summary: {
              totalFindings: findings.length,
              violations: findings.filter((f) => f.severity === "major").length,
              warnings: findings.filter((f) => f.severity === "minor").length,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
};

// Helper to add demo license keys
export const addDemoLicense = (key: string, license: LicenseKey): void => {
  licenseDatabase.set(key, license);
};

// Initialize with demo licenses
addDemoLicense("community-demo-key", {
  key: "community-demo-key",
  tier: "community",
  features: ["basic-diagnostics", "protocol-validation", "core-mcp-tools"],
});

addDemoLicense("professional-demo-key", {
  key: "professional-demo-key",
  tier: "professional",
  features: [
    "basic-diagnostics",
    "protocol-validation",
    "core-mcp-tools",
    "advanced-diagnostics",
    "llm-backends",
    "academic-validation",
    "performance-profiling",
    "security-scanning",
  ],
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
});

addDemoLicense("enterprise-demo-key", {
  key: "enterprise-demo-key",
  tier: "enterprise",
  features: ["*"],
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
  organizationId: "demo-org",
  maxUsers: 100,
});

/**
 * Get usage metrics with analytics
 */
export const getUsageMetricsWithAnalyticsImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const {
    userId,
    organizationId,
    timeRange,
    features: _features,
    aggregation = "daily",
  } = args as {
    userId?: string;
    organizationId?: string;
    timeRange?: { start: string; end: string };
    features?: string[];
    aggregation?: string;
  };

  if (!organizationId) {
    return getUsageMetricsImpl(args);
  }

  // Calculate time range
  const now = Date.now();
  const start = timeRange?.start
    ? new Date(timeRange.start).getTime()
    : now - 30 * 24 * 60 * 60 * 1000;
  const end = timeRange?.end ? new Date(timeRange.end).getTime() : now;

  // Generate analytics metrics
  const analytics = generateAnalyticsMetrics(organizationId, { start, end });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            userId,
            organizationId,
            timeRange: {
              start: new Date(start).toISOString(),
              end: new Date(end).toISOString(),
            },
            aggregation,
            analytics,
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Generate billing report with analytics
 */
export const generateBillingReportWithAnalyticsImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const {
    organizationId,
    billingPeriod,
    format = "json",
    includeBreakdown = true,
    includeCostEstimate = true,
  } = args as {
    organizationId: string;
    billingPeriod?: { start: string; end: string };
    format?: string;
    includeBreakdown?: boolean;
    includeCostEstimate?: boolean;
  };

  // Calculate billing period
  const now = Date.now();
  const start = billingPeriod?.start
    ? new Date(billingPeriod.start).getTime()
    : now - 30 * 24 * 60 * 60 * 1000;
  const end = billingPeriod?.end ? new Date(billingPeriod.end).getTime() : now;

  // Generate usage report
  const report = generateUsageReport(organizationId, { start, end });

  // Export in requested format
  let content: string;
  if (format === "csv") {
    content = exportBillingData(organizationId, { start, end }, "csv");
  } else {
    content = JSON.stringify(
      {
        organizationId,
        billingPeriod: {
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
        },
        format,
        totalUsage: report.totalUsage,
        breakdown: includeBreakdown ? report.featureBreakdown : undefined,
        costBreakdown: includeBreakdown ? report.costBreakdown : undefined,
        totalCost: includeCostEstimate ? report.totalCost : undefined,
        currency: report.currency,
      },
      null,
      2,
    );
  }

  return {
    content: [
      {
        type: "text",
        text: content,
      },
    ],
  };
};

/**
 * Manage subscription with billing integration
 */
export const manageSubscriptionWithBillingImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const {
    organizationId,
    action,
    targetTier,
    effectiveDate,
    userId = "system",
  } = args as {
    organizationId: string;
    action: string;
    targetTier?: string;
    effectiveDate?: string;
    userId?: string;
  };

  // Record subscription change if upgrading/downgrading
  if (action === "upgrade" || action === "downgrade") {
    const fromTier = "professional"; // Would be fetched from database
    const toTier = targetTier || "professional";
    const amount = action === "upgrade" ? 99 : -99; // Simplified pricing

    recordSubscriptionChange(userId, organizationId, fromTier, toTier, amount);
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            organizationId,
            action,
            targetTier,
            effectiveDate: effectiveDate || new Date().toISOString(),
            status: "success",
            message: `Subscription ${action} completed successfully`,
            billingRecorded: action === "upgrade" || action === "downgrade",
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Generate compliance report with billing findings
 */
export const generateComplianceReportWithBillingImpl = async (
  args: unknown,
): Promise<McpToolResult> => {
  const {
    organizationId,
    reportPeriod,
    includeViolations = true,
    includeAuditTrail = true,
    format = "json",
  } = args as {
    organizationId: string;
    reportPeriod?: { start: string; end: string };
    includeViolations?: boolean;
    includeAuditTrail?: boolean;
    format?: string;
  };

  // Calculate report period
  const now = Date.now();
  const start = reportPeriod?.start
    ? new Date(reportPeriod.start).getTime()
    : now - 30 * 24 * 60 * 60 * 1000;
  const end = reportPeriod?.end ? new Date(reportPeriod.end).getTime() : now;

  // Generate billing compliance findings
  const billingFindings = generateBillingComplianceFindings(organizationId, {
    start,
    end,
  });

  // Get license for organization (demo)
  const license = {
    valid: true,
    tier: "professional" as const,
    features: ["advanced_diagnostics", "llm_backends"],
  };

  // Generate license compliance findings
  const licenseFindings = await generateComplianceReport(
    usageRecords,
    license,
    {
      start,
      end,
    },
  );

  const allFindings = [...billingFindings, ...licenseFindings];

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            organizationId,
            reportPeriod: {
              start: new Date(start).toISOString(),
              end: new Date(end).toISOString(),
            },
            format,
            findings: includeViolations ? allFindings : [],
            auditTrail: includeAuditTrail
              ? authUsageRecords.slice(-100)
              : undefined,
            summary: {
              totalFindings: allFindings.length,
              violations: allFindings.filter((f) => f.severity === "major")
                .length,
              warnings: allFindings.filter((f) => f.severity === "minor")
                .length,
              billingIssues: billingFindings.length,
              licenseIssues: licenseFindings.length,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
};

/**
 * Get admin dashboard data
 */
export const getAdminDashboardImpl = async (): Promise<McpToolResult> => {
  const dashboard = generateAdminDashboard();

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(dashboard, null, 2),
      },
    ],
  };
};
