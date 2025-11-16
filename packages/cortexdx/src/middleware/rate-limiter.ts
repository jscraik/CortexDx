import type { IncomingMessage, ServerResponse } from "node:http";
import {
  checkRateLimit,
  createRateLimitState,
  getRateLimitConfig,
  recordApiRequest,
  type RateLimitState,
} from "../plugins/ratelimit.js";

// Rate limit store (in-memory for now, can be replaced with Redis)
const rateLimitStore = new Map<string, RateLimitState>();

// Periodic cleanup to prevent memory leak: remove expired rate limit states
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of rateLimitStore.entries()) {
    // Assume RateLimitState has windowStart (ms) and windowMs (duration in ms)
    if (typeof state.windowStart === "number" && typeof state.windowMs === "number") {
      if (now - state.windowStart > state.windowMs) {
        rateLimitStore.delete(key);
      }
    }
  }
}, 60 * 1000); // Run every 60 seconds
export interface RateLimitOptions {
  /**
   * Default tier for unauthenticated requests
   */
  defaultTier?: "community" | "professional" | "enterprise";

  /**
   * Override rate limits per IP
   */
  perIpLimits?: Map<string, "community" | "professional" | "enterprise">;

  /**
   * Override rate limits per user
   */
  perUserLimits?: Map<string, "community" | "professional" | "enterprise">;

  /**
   * Custom key generator function
   */
  keyGenerator?: (req: IncomingMessage) => string;

  /**
   * Custom tier resolver function
   */
  tierResolver?: (req: IncomingMessage) => "community" | "professional" | "enterprise";
}

/**
 * Extract IP address from request
 */
function getClientIp(req: IncomingMessage): string {
  // Check X-Forwarded-For header (proxy/load balancer)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = typeof forwarded === "string" ? forwarded.split(",") : forwarded;
    return ips[0].trim();
  }

  // Check X-Real-IP header
  const realIp = req.headers["x-real-ip"];
  if (realIp && typeof realIp === "string") {
    return realIp.trim();
  }

  // Fall back to socket remote address
  return req.socket.remoteAddress || "unknown";
}

/**
 * Extract user ID from request (can be from auth header, session, etc.)
 */
function getUserId(req: IncomingMessage): string | undefined {
  // Check for user ID in custom header
  const userId = req.headers["x-user-id"];
  if (userId && typeof userId === "string") {
    return userId;
  }

  // Check for organization ID
  const orgId = req.headers["x-organization-id"];
  if (orgId && typeof orgId === "string") {
    return orgId;
  }

  // Could also extract from Authorization header or JWT token
  // For now, return undefined for anonymous requests
  return undefined;
}

/**
 * Create rate limit middleware for HTTP endpoints
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    defaultTier = "community",
    perIpLimits = new Map(),
    perUserLimits = new Map(),
    keyGenerator = (req) => {
      const userId = getUserId(req);
      const ip = getClientIp(req);
      return userId ? `user:${userId}` : `ip:${ip}`;
    },
    tierResolver = (req) => {
      const userId = getUserId(req);
      const ip = getClientIp(req);

      // Check user-specific limits first
      if (userId && perUserLimits.has(userId)) {
        return perUserLimits.get(userId)!;
      }

      // Check IP-specific limits
      if (perIpLimits.has(ip)) {
        return perIpLimits.get(ip)!;
      }

      // Check tier from header
      const tierHeader = req.headers["x-rate-limit-tier"];
      if (tierHeader && typeof tierHeader === "string") {
        if (["community", "professional", "enterprise"].includes(tierHeader)) {
          return tierHeader as "community" | "professional" | "enterprise";
        }
      }

      return defaultTier;
    },
  } = options;

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    endpoint: string,
  ): Promise<boolean> => {
    const key = keyGenerator(req);
    const tier = tierResolver(req);
    const config = getRateLimitConfig(tier);

    // Get or create rate limit state
    let state = rateLimitStore.get(key);
    if (!state) {
      const userId = getUserId(req);
      const orgId = req.headers["x-organization-id"];
      state = createRateLimitState(
        endpoint,
        userId,
        typeof orgId === "string" ? orgId : undefined,
      );
      rateLimitStore.set(key, state);
    }

    // Check rate limit
    const { allowed, remaining, resetAt } = checkRateLimit(state, config);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", config.maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader("X-RateLimit-Reset", resetAt.toString());

    if (!allowed) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      res.setHeader("Retry-After", retryAfter.toString());
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: "Rate limit exceeded",
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          retryAfter,
          limit: config.maxRequests,
          remaining,
          resetAt,
          timestamp: new Date().toISOString(),
        }),
      );
      return false;
    }

    // Record the request
    recordApiRequest(state);

    return true;
  };
}

/**
 * Environment variable based configuration
 */
export function createRateLimiterFromEnv(): ReturnType<typeof createRateLimiter> {
  const defaultTier = (process.env.CORTEXDX_DEFAULT_RATE_LIMIT_TIER ||
    "community") as "community" | "professional" | "enterprise";

  const perIpLimits = new Map<string, "community" | "professional" | "enterprise">();
  const perUserLimits = new Map<string, "community" | "professional" | "enterprise">();

  // Parse IP-specific limits from env
  // Format: CORTEXDX_RATE_LIMIT_IP_192_168_1_1=professional
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("CORTEXDX_RATE_LIMIT_IP_")) {
      const ip = key.replace("CORTEXDX_RATE_LIMIT_IP_", "").replace(/_/g, ".");
      const tier = value as "community" | "professional" | "enterprise";
      if (["community", "professional", "enterprise"].includes(tier)) {
        perIpLimits.set(ip, tier);
      }
    }

    if (key.startsWith("CORTEXDX_RATE_LIMIT_USER_")) {
      const userId = key.replace("CORTEXDX_RATE_LIMIT_USER_", "");
      const tier = value as "community" | "professional" | "enterprise";
      if (["community", "professional", "enterprise"].includes(tier)) {
        perUserLimits.set(userId, tier);
      }
    }
  }

  return createRateLimiter({
    defaultTier,
    perIpLimits,
    perUserLimits,
  });
}

/**
 * Clear rate limit state (for testing or maintenance)
 */
export function clearRateLimitState(key?: string): void {
  if (key) {
    rateLimitStore.delete(key);
  } else {
    rateLimitStore.clear();
  }
}

/**
 * Get current rate limit state (for monitoring/debugging)
 */
export function getRateLimitState(key: string): RateLimitState | undefined {
  return rateLimitStore.get(key);
}

/**
 * Get all rate limit states (for monitoring)
 */
export function getAllRateLimitStates(): Map<string, RateLimitState> {
  return new Map(rateLimitStore);
}
