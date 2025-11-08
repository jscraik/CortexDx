/**
 * License Tier Enforcement
 * Connects license validation to feature access control with usage tracking and rate limiting
 * Requirements: 7.1, 10.5
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthenticatedRequest } from "./auth-middleware.js";
import {
  type LicenseKey,
  type LicenseValidation,
  type UsageMetrics,
  checkFeatureAccess,
  trackUsage,
  validateCommercialLicense,
} from "./commercial-licensing.js";

// Rate limit configuration per tier
export const TIER_RATE_LIMITS: Record<string, Record<string, number>> = {
  community: {
    diagnose_mcp_server: 10, // per hour
    validate_protocol: 10,
    default: 5,
  },
  professional: {
    diagnose_mcp_server: 100,
    validate_protocol: 100,
    advanced_diagnostics: 50,
    llm_backends: 50,
    default: 50,
  },
  enterprise: {
    default: -1, // unlimited
  },
};

// Usage tracking storage
const usageTracker = new Map<string, UsageMetrics[]>();
const rateLimitTracker = new Map<string, Map<string, number>>();

export interface LicenseEnforcementConfig {
  licenseDatabase: Map<string, LicenseKey>;
  requireLicense: boolean;
  defaultTier: "community" | "professional" | "enterprise";
  rateLimits?: Record<string, Record<string, number>>;
}

export interface EnforcedRequest extends AuthenticatedRequest {
  license?: LicenseValidation;
  tier?: "community" | "professional" | "enterprise";
}

/**
 * Create license enforcement middleware
 */
export const createLicenseEnforcementMiddleware = (
  config: LicenseEnforcementConfig,
) => {
  const rateLimits = config.rateLimits || TIER_RATE_LIMITS;

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> => {
    const enforcedReq = req as EnforcedRequest;

    // Extract license key from header or query param
    const licenseKey =
      (req.headers["x-license-key"] as string) ||
      new URL(req.url || "", `http://${req.headers.host}`).searchParams.get(
        "license",
      );

    if (!licenseKey) {
      if (config.requireLicense) {
        res.writeHead(402, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Payment Required",
            message: "License key required for this service",
            tier: config.defaultTier,
          }),
        );
        return;
      }

      // Use default tier
      enforcedReq.tier = config.defaultTier;
      enforcedReq.license = {
        valid: true,
        tier: config.defaultTier,
        features: [],
      };
      next();
      return;
    }

    // Validate license
    const validation = validateCommercialLicense(
      licenseKey,
      config.licenseDatabase,
    );

    if (!validation.valid) {
      res.writeHead(402, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Payment Required",
          message: validation.error || "Invalid license key",
          tier: validation.tier,
        }),
      );
      return;
    }

    // Attach license info to request
    enforcedReq.license = validation;
    enforcedReq.tier = validation.tier;

    next();
  };
};

/**
 * Check if feature is allowed for license tier
 */
export const checkFeatureAllowed = (
  req: EnforcedRequest,
  feature: string,
): { allowed: boolean; reason?: string } => {
  if (!req.license) {
    return { allowed: false, reason: "No license information available" };
  }

  const access = checkFeatureAccess(feature, req.license);
  return {
    allowed: access.allowed,
    reason: access.reason,
  };
};

/**
 * Check rate limit for feature
 */
export const checkRateLimit = (
  req: EnforcedRequest,
  feature: string,
): { allowed: boolean; remaining: number; resetTime: number } => {
  const tier = req.tier || "community";
  const userId = req.auth?.userId || "anonymous";
  const key = `${userId}:${feature}`;

  // Get rate limit for tier and feature
  const tierLimits = TIER_RATE_LIMITS[tier] || {};
  const limit = tierLimits[feature] || tierLimits.default || 10;

  // Unlimited for enterprise or -1 limit
  if (limit === -1) {
    return { allowed: true, remaining: -1, resetTime: 0 };
  }

  // Get current usage
  const now = Date.now();
  const hourStart = now - (now % (60 * 60 * 1000));
  const resetTime = hourStart + 60 * 60 * 1000;

  let userLimits = rateLimitTracker.get(userId);
  if (!userLimits) {
    userLimits = new Map();
    rateLimitTracker.set(userId, userLimits);
  }

  const currentCount = userLimits.get(key) || 0;

  // Reset if hour has passed
  if (now >= resetTime) {
    userLimits.set(key, 0);
    return { allowed: true, remaining: limit - 1, resetTime };
  }

  // Check if limit exceeded
  if (currentCount >= limit) {
    return { allowed: false, remaining: 0, resetTime };
  }

  return { allowed: true, remaining: limit - currentCount - 1, resetTime };
};

/**
 * Increment rate limit counter
 */
export const incrementRateLimit = (
  req: EnforcedRequest,
  feature: string,
): void => {
  const userId = req.auth?.userId || "anonymous";
  const key = `${userId}:${feature}`;

  let userLimits = rateLimitTracker.get(userId);
  if (!userLimits) {
    userLimits = new Map();
    rateLimitTracker.set(userId, userLimits);
  }

  const currentCount = userLimits.get(key) || 0;
  userLimits.set(key, currentCount + 1);
};

/**
 * Track feature usage for billing
 */
export const trackFeatureUsage = (
  req: EnforcedRequest,
  feature: string,
  duration?: number,
): void => {
  const userId = req.auth?.userId || "anonymous";
  const usage = trackUsage(feature, userId, duration);

  let userUsage = usageTracker.get(userId);
  if (!userUsage) {
    userUsage = [];
    usageTracker.set(userId, userUsage);
  }

  userUsage.push(usage);
};

/**
 * Get usage metrics for user
 */
export const getUserUsageMetrics = (
  userId: string,
  timeRange?: { start: number; end: number },
): UsageMetrics[] => {
  const userUsage = usageTracker.get(userId) || [];

  if (!timeRange) {
    return userUsage;
  }

  return userUsage.filter(
    (u) => u.timestamp >= timeRange.start && u.timestamp <= timeRange.end,
  );
};

/**
 * Create feature access middleware with rate limiting
 */
export const createFeatureAccessMiddleware = () => {
  return (
    req: EnforcedRequest,
    res: ServerResponse,
    feature: string,
    next: () => void,
  ): void => {
    // Check feature access
    const featureAccess = checkFeatureAllowed(req, feature);
    if (!featureAccess.allowed) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Forbidden",
          message: featureAccess.reason || "Feature not available in your tier",
          feature,
          tier: req.tier,
          upgradeRequired: true,
        }),
      );
      return;
    }

    // Check rate limit
    const rateLimit = checkRateLimit(req, feature);
    if (!rateLimit.allowed) {
      res.writeHead(429, {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(rateLimit.remaining + 1),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(rateLimit.resetTime),
      });
      res.end(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Rate limit exceeded for this feature",
          feature,
          tier: req.tier,
          resetTime: new Date(rateLimit.resetTime).toISOString(),
        }),
      );
      return;
    }

    // Increment rate limit counter
    incrementRateLimit(req, feature);

    // Track usage
    trackFeatureUsage(req, feature);

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", String(rateLimit.remaining + 1));
    res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
    res.setHeader("X-RateLimit-Reset", String(rateLimit.resetTime));

    next();
  };
};

/**
 * Get subscription status for user
 */
export const getSubscriptionStatus = (
  req: EnforcedRequest,
): {
  tier: string;
  valid: boolean;
  features: string[];
  expiresAt?: number;
  daysRemaining?: number;
} => {
  if (!req.license) {
    return {
      tier: "community",
      valid: false,
      features: [],
    };
  }

  return {
    tier: req.license.tier,
    valid: req.license.valid,
    features: req.license.features,
    expiresAt: req.license.expiresAt,
    daysRemaining: req.license.daysRemaining,
  };
};

/**
 * Check if subscription needs renewal
 */
export const needsRenewal = (req: EnforcedRequest): boolean => {
  if (!req.license || !req.license.daysRemaining) {
    return false;
  }

  return req.license.daysRemaining < 30;
};

/**
 * Get renewal reminder message
 */
export const getRenewalReminder = (req: EnforcedRequest): string | null => {
  if (!needsRenewal(req)) {
    return null;
  }

  const days = req.license?.daysRemaining || 0;
  return `Your ${req.tier} subscription expires in ${days} days. Please renew to continue using premium features.`;
};

/**
 * Clear rate limits (for testing or admin purposes)
 */
export const clearRateLimits = (userId?: string): void => {
  if (userId) {
    rateLimitTracker.delete(userId);
  } else {
    rateLimitTracker.clear();
  }
};

/**
 * Clear usage tracking (for testing or admin purposes)
 */
export const clearUsageTracking = (userId?: string): void => {
  if (userId) {
    usageTracker.delete(userId);
  } else {
    usageTracker.clear();
  }
};

/**
 * Get all usage metrics (admin only)
 */
export const getAllUsageMetrics = (): Map<string, UsageMetrics[]> => {
  return new Map(usageTracker);
};

/**
 * Get rate limit status for all users (admin only)
 */
export const getAllRateLimitStatus = (): Map<string, Map<string, number>> => {
  return new Map(rateLimitTracker);
};
