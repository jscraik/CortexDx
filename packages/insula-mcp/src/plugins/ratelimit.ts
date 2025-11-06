import {
  trackApiCall,
  trackRateLimitViolation,
} from "../observability/otel.js";
import type { DiagnosticPlugin, Finding } from "../types.js";

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  tier: "community" | "professional" | "enterprise";
}

// Rate limit state tracking
export interface RateLimitState {
  userId?: string;
  organizationId?: string;
  endpoint: string;
  requests: number[];
  windowStart: number;
}

// Tier-based rate limits
const TIER_RATE_LIMITS: Record<string, RateLimitConfig> = {
  community: {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
    tier: "community",
  },
  professional: {
    windowMs: 60000,
    maxRequests: 300,
    tier: "professional",
  },
  enterprise: {
    windowMs: 60000,
    maxRequests: 1000,
    tier: "enterprise",
  },
};

export const RateLimitPlugin: DiagnosticPlugin = {
  id: "ratelimit",
  title: "Rate-limit Semantics",
  order: 220,
  async run(ctx) {
    const findings: Finding[] = [];
    try {
      const res = await fetch(ctx.endpoint, { method: "POST", body: "{}" });
      if (res.status === 429) {
        const retry = res.headers.get("retry-after");
        if (!retry) {
          findings.push({
            id: "rl.429.no_retry_after",
            area: "reliability",
            severity: "minor",
            title: "429 without Retry-After",
            description:
              "Consider setting Retry-After and documenting backoff.",
            evidence: [{ type: "url", ref: ctx.endpoint }],
          });
        }
      }
    } catch {
      // network failures ignored for starter implementation
    }
    return findings;
  },
};

// Check if rate limit is exceeded
export function checkRateLimit(
  state: RateLimitState,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Filter requests within current window
  const recentRequests = state.requests.filter((t) => t >= windowStart);
  state.requests = recentRequests;

  const allowed = recentRequests.length < config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - recentRequests.length);
  const resetAt = state.windowStart + config.windowMs;

  if (!allowed) {
    trackRateLimitViolation(state.endpoint, state.userId, state.organizationId);
  }

  return { allowed, remaining, resetAt };
}

// Track API call with rate limiting
export function trackApiCallWithRateLimit(
  endpoint: string,
  tier: "community" | "professional" | "enterprise",
  userId?: string,
  organizationId?: string,
): void {
  trackApiCall(endpoint, userId, organizationId);
}

// Get rate limit configuration for tier
export function getRateLimitConfig(
  tier: "community" | "professional" | "enterprise",
): RateLimitConfig {
  const config = TIER_RATE_LIMITS[tier];
  if (!config) {
    const fallback = TIER_RATE_LIMITS.community;
    if (!fallback) {
      return {
        windowMs: 60000,
        maxRequests: 60,
        tier: "community",
      };
    }
    return fallback;
  }
  return config;
}

// Create rate limit state
export function createRateLimitState(
  endpoint: string,
  userId?: string,
  organizationId?: string,
): RateLimitState {
  return {
    userId,
    organizationId,
    endpoint,
    requests: [],
    windowStart: Date.now(),
  };
}

// Record API request
export function recordApiRequest(state: RateLimitState): void {
  state.requests.push(Date.now());
}
