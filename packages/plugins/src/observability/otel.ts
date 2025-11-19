import { metrics, trace } from "@opentelemetry/api";

type AttributeValue = string | number | boolean | undefined;

export async function withSpan<T>(
  name: string,
  attrs: Record<string, AttributeValue>,
  fn: () => Promise<T>,
) {
  const tracer = trace.getTracer("cortexdx");
  return tracer.startActiveSpan(name, async (span) => {
    try {
      for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined) span.setAttribute(key, value);
      }
      return await fn();
    } finally {
      span.end();
    }
  });
}

// Commercial usage tracking types
export interface CommercialUsageMetrics {
  feature: string;
  userId?: string;
  organizationId?: string;
  apiCallCount: number;
  duration: number;
  timestamp: number;
  tier: "community" | "professional" | "enterprise";
  success: boolean;
  errorType?: string;
}

export interface BillingMetrics {
  organizationId: string;
  tier: "community" | "professional" | "enterprise";
  period: { start: number; end: number };
  apiCalls: number;
  features: Map<string, number>;
  totalDuration: number;
  cost?: number;
}

export interface RateLimitMetrics {
  userId?: string;
  organizationId?: string;
  endpoint: string;
  requestCount: number;
  windowStart: number;
  windowEnd: number;
  limitExceeded: boolean;
}

// Enhanced usage tracking with commercial metrics
export function trackCommercialUsage(
  feature: string,
  tier: "community" | "professional" | "enterprise",
  userId?: string,
  organizationId?: string,
  duration?: number,
  success = true,
  errorType?: string,
): CommercialUsageMetrics {
  const meter = metrics.getMeter("cortexdx-commercial");
  const counter = meter.createCounter("feature.usage", {
    description: "Commercial feature usage counter",
  });

  counter.add(1, {
    feature,
    tier,
    userId: userId || "anonymous",
    organizationId: organizationId || "none",
    success: success.toString(),
  });

  return {
    feature,
    userId,
    organizationId,
    apiCallCount: 1,
    duration: duration || 0,
    timestamp: Date.now(),
    tier,
    success,
    errorType,
  };
}

// Track API calls for rate limiting
export function trackApiCall(
  endpoint: string,
  userId?: string,
  organizationId?: string,
): void {
  const meter = metrics.getMeter("cortexdx-api");
  const counter = meter.createCounter("api.calls", {
    description: "API call counter for rate limiting",
  });

  counter.add(1, {
    endpoint,
    userId: userId || "anonymous",
    organizationId: organizationId || "none",
  });
}

// Track rate limit violations
export function trackRateLimitViolation(
  endpoint: string,
  userId?: string,
  organizationId?: string,
): RateLimitMetrics {
  const meter = metrics.getMeter("cortexdx-ratelimit");
  const counter = meter.createCounter("ratelimit.violations", {
    description: "Rate limit violation counter",
  });

  counter.add(1, {
    endpoint,
    userId: userId || "anonymous",
    organizationId: organizationId || "none",
  });

  const now = Date.now();
  return {
    userId,
    organizationId,
    endpoint,
    requestCount: 1,
    windowStart: now,
    windowEnd: now + 60000, // 1 minute window
    limitExceeded: true,
  };
}

// Generate billing metrics
export function generateBillingMetrics(
  usageRecords: CommercialUsageMetrics[],
  organizationId: string,
  period: { start: number; end: number },
): BillingMetrics {
  const filteredRecords = usageRecords.filter(
    (r) =>
      r.organizationId === organizationId &&
      r.timestamp >= period.start &&
      r.timestamp <= period.end,
  );

  const features = new Map<string, number>();
  let totalDuration = 0;
  let tier: "community" | "professional" | "enterprise" = "community";

  for (const record of filteredRecords) {
    const count = features.get(record.feature) || 0;
    features.set(record.feature, count + record.apiCallCount);
    totalDuration += record.duration;
    tier = record.tier; // Use most recent tier
  }

  return {
    organizationId,
    tier,
    period,
    apiCalls: filteredRecords.length,
    features,
    totalDuration,
  };
}

// Enhanced span tracking with commercial attributes
export async function withCommercialSpan<T>(
  name: string,
  attrs: Record<string, AttributeValue>,
  fn: () => Promise<T>,
  tier: "community" | "professional" | "enterprise",
  userId?: string,
  organizationId?: string,
): Promise<T> {
  const tracer = trace.getTracer("cortexdx-commercial");
  return tracer.startActiveSpan(name, async (span) => {
    const startTime = Date.now();
    try {
      for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined) span.setAttribute(key, value);
      }
      span.setAttribute("tier", tier);
      if (userId) span.setAttribute("userId", userId);
      if (organizationId) span.setAttribute("organizationId", organizationId);

      const result = await fn();

      const duration = Date.now() - startTime;
      trackCommercialUsage(name, tier, userId, organizationId, duration, true);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorType = error instanceof Error ? error.name : "UnknownError";
      trackCommercialUsage(
        name,
        tier,
        userId,
        organizationId,
        duration,
        false,
        errorType,
      );
      throw error;
    } finally {
      span.end();
    }
  });
}
