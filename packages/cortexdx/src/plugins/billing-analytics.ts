/**
 * Billing and Analytics Integration
 * Implements usage metrics collection, reporting, and billing integration
 * Requirements: 7.5, 10.5
 */

import type { Finding } from "../types.js";
import type { UsageMetrics } from "./commercial-licensing.js";

// Billing event types
export type BillingEventType =
  | "feature_usage"
  | "api_call"
  | "resource_consumption"
  | "subscription_change"
  | "payment"
  | "refund";

export interface BillingEvent {
  id: string;
  type: BillingEventType;
  userId: string;
  organizationId?: string;
  timestamp: number;
  feature?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageReport {
  organizationId: string;
  period: {
    start: number;
    end: number;
  };
  totalUsage: number;
  featureBreakdown: Record<string, number>;
  costBreakdown: Record<string, number>;
  totalCost: number;
  currency: string;
}

export interface AnalyticsMetrics {
  organizationId: string;
  period: {
    start: number;
    end: number;
  };
  activeUsers: number;
  totalApiCalls: number;
  averageResponseTime: number;
  errorRate: number;
  topFeatures: Array<{ feature: string; count: number }>;
  userActivity: Record<string, number>;
}

export interface AdminDashboardData {
  totalOrganizations: number;
  totalUsers: number;
  totalRevenue: number;
  activeSubscriptions: number;
  tierDistribution: Record<string, number>;
  recentActivity: BillingEvent[];
  topOrganizations: Array<{
    organizationId: string;
    usage: number;
    revenue: number;
  }>;
}

// Pricing configuration per tier and feature
export const FEATURE_PRICING: Record<string, Record<string, number>> = {
  community: {
    diagnose_mcp_server: 0,
    validate_protocol: 0,
  },
  professional: {
    diagnose_mcp_server: 0.01,
    validate_protocol: 0.01,
    advanced_diagnostics: 0.05,
    llm_backends: 0.1,
    academic_validation: 0.05,
    performance_profiling: 0.03,
    security_scanning: 0.03,
  },
  enterprise: {
    // Enterprise uses flat monthly fee, not per-usage
    default: 0,
  },
};

// Storage for billing events and metrics
const billingEvents: BillingEvent[] = [];
const usageMetricsStore = new Map<string, UsageMetrics[]>();
const analyticsCache = new Map<string, AnalyticsMetrics>();

/**
 * Record billing event
 */
export const recordBillingEvent = (
  event: Omit<BillingEvent, "id">,
): BillingEvent => {
  const billingEvent: BillingEvent = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  };

  billingEvents.push(billingEvent);
  return billingEvent;
};

/**
 * Record feature usage for billing
 */
export const recordFeatureUsage = (
  userId: string,
  organizationId: string,
  feature: string,
  tier: string,
  duration?: number,
): BillingEvent => {
  // Calculate cost based on tier and feature
  const tierPricing = FEATURE_PRICING[tier] || {};
  const cost = tierPricing[feature] || tierPricing.default || 0;

  return recordBillingEvent({
    type: "feature_usage",
    userId,
    organizationId,
    timestamp: Date.now(),
    feature,
    amount: cost,
    currency: "USD",
    metadata: {
      tier,
      duration,
    },
  });
};

/**
 * Record API call for analytics
 */
export const recordApiCall = (
  userId: string,
  organizationId: string,
  endpoint: string,
  responseTime: number,
  statusCode: number,
): BillingEvent => {
  return recordBillingEvent({
    type: "api_call",
    userId,
    organizationId,
    timestamp: Date.now(),
    metadata: {
      endpoint,
      responseTime,
      statusCode,
      success: statusCode >= 200 && statusCode < 300,
    },
  });
};

/**
 * Record subscription change
 */
export const recordSubscriptionChange = (
  userId: string,
  organizationId: string,
  fromTier: string,
  toTier: string,
  amount: number,
): BillingEvent => {
  return recordBillingEvent({
    type: "subscription_change",
    userId,
    organizationId,
    timestamp: Date.now(),
    amount,
    currency: "USD",
    metadata: {
      fromTier,
      toTier,
    },
  });
};

/**
 * Generate usage report for organization
 */
export const generateUsageReport = (
  organizationId: string,
  period: { start: number; end: number },
): UsageReport => {
  // Filter events for organization and period
  const orgEvents = billingEvents.filter(
    (e) =>
      e.organizationId === organizationId &&
      e.timestamp >= period.start &&
      e.timestamp <= period.end,
  );

  // Calculate feature breakdown
  const featureBreakdown: Record<string, number> = {};
  const costBreakdown: Record<string, number> = {};
  let totalCost = 0;

  for (const event of orgEvents) {
    if (event.type === "feature_usage" && event.feature) {
      featureBreakdown[event.feature] =
        (featureBreakdown[event.feature] || 0) + 1;
      const cost = event.amount || 0;
      costBreakdown[event.feature] = (costBreakdown[event.feature] || 0) + cost;
      totalCost += cost;
    }
  }

  return {
    organizationId,
    period,
    totalUsage: orgEvents.length,
    featureBreakdown,
    costBreakdown,
    totalCost,
    currency: "USD",
  };
};

/**
 * Generate analytics metrics for organization
 */
export const generateAnalyticsMetrics = (
  organizationId: string,
  period: { start: number; end: number },
): AnalyticsMetrics => {
  // Check cache
  const cacheKey = `${organizationId}:${period.start}:${period.end}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Filter events for organization and period
  const orgEvents = billingEvents.filter(
    (e) =>
      e.organizationId === organizationId &&
      e.timestamp >= period.start &&
      e.timestamp <= period.end,
  );

  // Calculate metrics
  const uniqueUsers = new Set(orgEvents.map((e) => e.userId)).size;
  const apiCalls = orgEvents.filter((e) => e.type === "api_call");
  const totalApiCalls = apiCalls.length;

  // Calculate average response time
  const responseTimes = apiCalls
    .map((e) => e.metadata?.responseTime as number)
    .filter((t) => typeof t === "number");
  const averageResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

  // Calculate error rate
  const errors = apiCalls.filter((e) => !e.metadata?.success).length;
  const errorRate = totalApiCalls > 0 ? errors / totalApiCalls : 0;

  // Top features
  const featureCounts = new Map<string, number>();
  for (const event of orgEvents) {
    if (event.feature) {
      featureCounts.set(
        event.feature,
        (featureCounts.get(event.feature) || 0) + 1,
      );
    }
  }
  const topFeatures = Array.from(featureCounts.entries())
    .map(([feature, count]) => ({ feature, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // User activity
  const userActivity: Record<string, number> = {};
  for (const event of orgEvents) {
    userActivity[event.userId] = (userActivity[event.userId] || 0) + 1;
  }

  const metrics: AnalyticsMetrics = {
    organizationId,
    period,
    activeUsers: uniqueUsers,
    totalApiCalls,
    averageResponseTime,
    errorRate,
    topFeatures,
    userActivity,
  };

  // Cache for 5 minutes
  analyticsCache.set(cacheKey, metrics);
  setTimeout(() => analyticsCache.delete(cacheKey), 5 * 60 * 1000);

  return metrics;
};

/**
 * Generate admin dashboard data
 */
export const generateAdminDashboard = (): AdminDashboardData => {
  // Get unique organizations and users
  const organizations = new Set(
    billingEvents
      .map((e) => e.organizationId)
      .filter((id): id is string => !!id),
  );
  const users = new Set(billingEvents.map((e) => e.userId));

  // Calculate total revenue
  const totalRevenue = billingEvents
    .filter((e) => e.type === "payment")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Count active subscriptions
  const activeSubscriptions = organizations.size;

  // Tier distribution (simplified - would need subscription data)
  const tierDistribution = {
    community: 0,
    professional: 0,
    enterprise: 0,
  };

  // Recent activity (last 100 events)
  const recentActivity = billingEvents.slice(-100).reverse();

  // Top organizations by usage
  const orgUsage = new Map<string, { usage: number; revenue: number }>();
  for (const event of billingEvents) {
    if (event.organizationId) {
      const current = orgUsage.get(event.organizationId) || {
        usage: 0,
        revenue: 0,
      };
      orgUsage.set(event.organizationId, {
        usage: current.usage + 1,
        revenue: current.revenue + (event.amount || 0),
      });
    }
  }

  const topOrganizations = Array.from(orgUsage.entries())
    .map(([organizationId, data]) => ({
      organizationId,
      usage: data.usage,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    totalOrganizations: organizations.size,
    totalUsers: users.size,
    totalRevenue,
    activeSubscriptions,
    tierDistribution,
    recentActivity,
    topOrganizations,
  };
};

/**
 * Export billing data for external systems
 */
export const exportBillingData = (
  organizationId: string,
  period: { start: number; end: number },
  format: "json" | "csv",
): string => {
  const events = billingEvents.filter(
    (e) =>
      e.organizationId === organizationId &&
      e.timestamp >= period.start &&
      e.timestamp <= period.end,
  );

  if (format === "json") {
    return JSON.stringify(events, null, 2);
  }

  // CSV format
  const headers = [
    "id",
    "type",
    "userId",
    "timestamp",
    "feature",
    "amount",
    "currency",
  ];
  const rows = events.map((e) => [
    e.id,
    e.type,
    e.userId,
    new Date(e.timestamp).toISOString(),
    e.feature || "",
    e.amount?.toString() || "",
    e.currency || "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
};

/**
 * Generate compliance findings for billing
 */
export const generateBillingComplianceFindings = (
  organizationId: string,
  period: { start: number; end: number },
): Finding[] => {
  const findings: Finding[] = [];
  const report = generateUsageReport(organizationId, period);

  // Check for unusual usage patterns
  if (report.totalCost > 10000) {
    findings.push({
      id: "billing.high-usage",
      area: "billing",
      severity: "info",
      title: "High usage detected",
      description: `Organization ${organizationId} has accumulated $${report.totalCost.toFixed(2)} in charges for the period.`,
      evidence: [{ type: "log", ref: "billing-report" }],
      tags: ["billing", "usage", "high-cost"],
    });
  }

  // Check for zero usage
  if (report.totalUsage === 0) {
    findings.push({
      id: "billing.no-usage",
      area: "billing",
      severity: "minor",
      title: "No usage detected",
      description: `Organization ${organizationId} has no recorded usage for the period.`,
      evidence: [{ type: "log", ref: "billing-report" }],
      tags: ["billing", "usage", "inactive"],
    });
  }

  return findings;
};

/**
 * Get billing events for organization
 */
export const getBillingEvents = (
  organizationId: string,
  period?: { start: number; end: number },
): BillingEvent[] => {
  let events = billingEvents.filter((e) => e.organizationId === organizationId);

  if (period) {
    events = events.filter(
      (e) => e.timestamp >= period.start && e.timestamp <= period.end,
    );
  }

  return events;
};

/**
 * Clear billing data (for testing)
 */
export const clearBillingData = (): void => {
  billingEvents.length = 0;
  usageMetricsStore.clear();
  analyticsCache.clear();
};

/**
 * Get all billing events (admin only)
 */
export const getAllBillingEvents = (): BillingEvent[] => {
  return [...billingEvents];
};
