import type { DiagnosticPlugin, Finding } from "../types.js";

// Commercial licensing types
export interface LicenseKey {
  key: string;
  tier: "community" | "professional" | "enterprise";
  features: string[];
  expiresAt?: number;
  organizationId?: string;
  maxUsers?: number;
}

export interface LicenseValidation {
  valid: boolean;
  tier: "community" | "professional" | "enterprise";
  features: string[];
  expiresAt?: number;
  daysRemaining?: number;
  error?: string;
  warnings?: string[];
}

export interface FeatureAccessCheck {
  feature: string;
  allowed: boolean;
  tier: string;
  reason?: string;
}

export interface UsageMetrics {
  feature: string;
  count: number;
  timestamp: number;
  userId?: string;
  duration?: number;
}

export interface SubscriptionInfo {
  tier: "community" | "professional" | "enterprise";
  status: "active" | "expired" | "suspended" | "trial";
  startDate: number;
  endDate?: number;
  autoRenew: boolean;
  features: string[];
}

// Feature definitions by tier
const TIER_FEATURES: Record<string, string[]> = {
  community: ["basic-diagnostics", "protocol-validation", "core-mcp-tools"],
  professional: [
    "basic-diagnostics",
    "protocol-validation",
    "core-mcp-tools",
    "advanced-diagnostics",
    "llm-backends",
    "academic-validation",
    "performance-profiling",
    "security-scanning",
  ],
  enterprise: [
    "*", // All features
    "auth0-integration",
    "custom-plugins",
    "on-premises",
    "sla-support",
    "usage-analytics",
    "compliance-reporting",
  ],
};

// Commercial Licensing Plugin
export const CommercialLicensingPlugin: DiagnosticPlugin = {
  id: "commercial-licensing",
  title: "Commercial Licensing & Feature Access",
  order: 95,
  async run(ctx) {
    const findings: Finding[] = [];

    // Check if license validation is configured
    const licenseConfigured = ctx.headers?.["x-license-key"] !== undefined;

    if (!licenseConfigured) {
      findings.push({
        id: "license.not-configured",
        area: "licensing",
        severity: "info",
        title: "No commercial license configured",
        description: "Running in community edition mode with basic features.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["licensing", "community"],
      });
    }

    return findings;
  },
};

// Validate commercial license key
export function validateCommercialLicense(
  key: string,
  licenseDatabase: Map<string, LicenseKey>,
): LicenseValidation {
  const license = licenseDatabase.get(key);

  if (!license) {
    return {
      valid: false,
      tier: "community",
      features: TIER_FEATURES.community || [],
      error: "Invalid license key",
    };
  }

  const now = Date.now();
  const expired = license.expiresAt && license.expiresAt < now;

  if (expired) {
    return {
      valid: false,
      tier: license.tier,
      features: TIER_FEATURES.community || [],
      error: "License expired",
      expiresAt: license.expiresAt,
    };
  }

  const daysRemaining = license.expiresAt
    ? Math.floor((license.expiresAt - now) / (1000 * 60 * 60 * 24))
    : undefined;

  const warnings: string[] = [];
  if (daysRemaining !== undefined && daysRemaining < 30) {
    warnings.push(`License expires in ${daysRemaining} days`);
  }

  return {
    valid: true,
    tier: license.tier,
    features: license.features || [],
    expiresAt: license.expiresAt,
    daysRemaining,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// Check feature access based on license
export function checkFeatureAccess(
  feature: string,
  license: LicenseValidation,
): FeatureAccessCheck {
  if (!license.valid) {
    return {
      feature,
      allowed: false,
      tier: license.tier,
      reason: license.error || "Invalid license",
    };
  }

  const hasWildcard = license.features.includes("*");
  const hasFeature = license.features.includes(feature);
  const allowed = hasWildcard || hasFeature;

  return {
    feature,
    allowed,
    tier: license.tier,
    reason: allowed
      ? undefined
      : `Feature not available in ${license.tier} tier`,
  };
}

// Track feature usage
export function trackUsage(
  feature: string,
  userId?: string,
  duration?: number,
): UsageMetrics {
  return {
    feature,
    count: 1,
    timestamp: Date.now(),
    userId,
    duration,
  };
}

// Generate compliance report
export async function generateComplianceReport(
  usageRecords: UsageMetrics[],
  license: LicenseValidation,
  period: { start: number; end: number },
): Promise<Finding[]> {
  const findings: Finding[] = [];

  const filteredRecords = usageRecords.filter(
    (r) => r.timestamp >= period.start && r.timestamp <= period.end,
  );

  const featureUsage = new Map<string, number>();
  for (const record of filteredRecords) {
    const current = featureUsage.get(record.feature) || 0;
    featureUsage.set(record.feature, current + record.count);
  }

  const unauthorizedFeatures: string[] = [];
  for (const [feature] of featureUsage) {
    const access = checkFeatureAccess(feature, license);
    if (!access.allowed) {
      unauthorizedFeatures.push(feature);
    }
  }

  if (unauthorizedFeatures.length > 0) {
    findings.push({
      id: "license.unauthorized-features",
      area: "licensing",
      severity: "major",
      title: "Unauthorized feature usage detected",
      description: `Features used without proper license: ${unauthorizedFeatures.join(", ")}`,
      evidence: [{ type: "log", ref: "usage-records" }],
      tags: ["licensing", "compliance"],
      recommendation: "Upgrade license tier or disable unauthorized features",
    });
  }

  findings.push({
    id: "license.compliance-summary",
    area: "licensing",
    severity: "info",
    title: "License compliance report",
    description: `Period: ${new Date(period.start).toISOString()} to ${new Date(period.end).toISOString()}. Total usage records: ${filteredRecords.length}. Unique features: ${featureUsage.size}.`,
    evidence: [{ type: "log", ref: "compliance-report" }],
    tags: ["licensing", "compliance", "reporting"],
  });

  return findings;
}

// Get subscription information
export function getSubscriptionInfo(
  license: LicenseValidation,
): SubscriptionInfo {
  const now = Date.now();
  let status: SubscriptionInfo["status"] = "active";

  if (!license.valid) {
    status = "expired";
  } else if (license.expiresAt && license.expiresAt < now) {
    status = "expired";
  } else if (license.daysRemaining && license.daysRemaining < 0) {
    status = "expired";
  }

  return {
    tier: license.tier,
    status,
    startDate: now,
    endDate: license.expiresAt,
    autoRenew: false,
    features: license.features || [],
  };
}
