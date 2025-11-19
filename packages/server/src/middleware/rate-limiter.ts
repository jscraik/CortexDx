import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type RateLimitState,
  checkRateLimit,
  createRateLimitState,
  getRateLimitConfig,
  recordApiRequest,
} from "../plugins/ratelimit";

// Rate limit store (in-memory for now, can be replaced with Redis)
const rateLimitStore = new Map<string, RateLimitState>();

// Periodic cleanup to prevent memory leak: remove expired rate limit states
// Run cleanup every 60 seconds to remove entries older than the rate limit window
const CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_WINDOW_MS = 60 * 1000; // Maximum window size (1 minute for all tiers)

setInterval(() => {
  const now = Date.now();
  for (const [key, state] of rateLimitStore.entries()) {
    // Remove state if the window has passed and no requests in the window
    if (state.windowStart && now - state.windowStart > MAX_WINDOW_MS) {
      // Also check if there are no recent requests
      const recentRequests = state.requests.filter(
        (timestamp) => now - timestamp <= MAX_WINDOW_MS,
      );
      if (recentRequests.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }
}, CLEANUP_INTERVAL_MS);

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
  tierResolver?: (
    req: IncomingMessage,
  ) => "community" | "professional" | "enterprise";
}

/**
 * Extract IP address from request
 */
function getClientIp(req: IncomingMessage): string {
  // Check X-Forwarded-For header (proxy/load balancer)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips =
      typeof forwarded === "string" ? forwarded.split(",") : forwarded;
    // With noUncheckedIndexedAccess, ips[0] could be undefined
    // But we know it exists since forwarded is truthy and we split it
    if (ips.length > 0 && ips[0] !== undefined) {
      return ips[0].trim();
    }
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
        const tier = perUserLimits.get(userId);
        if (tier) return tier;
      }

      // Check IP-specific limits
      if (perIpLimits.has(ip)) {
        const tier = perIpLimits.get(ip);
        if (tier) return tier;
      }

      // Check tier from header
      const tierHeader = req.headers["x-rate-limit-tier"];
      if (tierHeader && typeof tierHeader === "string") {
        // Validate before type assertion
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
 *
 * @remarks
 * **IPv6 Limitation**: Environment variable configuration only supports IPv4 addresses.
 * IPv6 addresses contain colons which cannot be represented in environment variable names.
 * For IPv6 support, use programmatic configuration with the `createRateLimiter()` function
 * and pass IP addresses directly via the `perIpLimits` Map.
 *
 * @example
 * ```typescript
 * // For IPv6 support, use programmatic configuration:
 * const perIpLimits = new Map();
 * perIpLimits.set('2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'enterprise');
 * const limiter = createRateLimiter({ perIpLimits });
 * ```
 */
export function createRateLimiterFromEnv(): ReturnType<
  typeof createRateLimiter
> {
  const defaultTier = (process.env.CORTEXDX_DEFAULT_RATE_LIMIT_TIER ||
    "community") as "community" | "professional" | "enterprise";

  const perIpLimits = new Map<
    string,
    "community" | "professional" | "enterprise"
  >();
  const perUserLimits = new Map<
    string,
    "community" | "professional" | "enterprise"
  >();

  // Parse IP-specific limits from env
  // Format: CORTEXDX_RATE_LIMIT_IP_192_168_1_1=professional
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("CORTEXDX_RATE_LIMIT_IP_")) {
      const ip = key.replace("CORTEXDX_RATE_LIMIT_IP_", "").replace(/_/g, ".");

      // Validate IP address format (IPv4 only: x.x.x.x where x is 0-255)
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipv4Regex.test(ip)) {
        console.warn(
          `Invalid IP address format in environment variable ${key}: ${ip}`,
        );
        continue;
      }

      // Validate each octet is in range 0-255
      const octets = ip.split(".");
      if (
        !octets.every((octet) => {
          const num = Number.parseInt(octet, 10);
          return num >= 0 && num <= 255;
        })
      ) {
        console.warn(
          `Invalid IP address octets in environment variable ${key}: ${ip}`,
        );
        continue;
      }

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
