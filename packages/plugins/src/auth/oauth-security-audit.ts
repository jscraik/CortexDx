/**
 * OAuth Security Audit and Fixes
 *
 * This module identifies and mitigates security issues in the OAuth 2.0 implementation
 * following OAuth 2.1 security best practices and OWASP guidelines.
 *
 * ## Security Issues Identified
 *
 * ### Critical (Must Fix)
 * 1. No PKCE for device code flow (OAuth 2.1 requirement)
 * 2. Client secret logging/exposure risk
 * 3. Missing audience validation on tokens
 * 4. No TLS verification on endpoints
 *
 * ### High (Should Fix)
 * 5. Token stored in plain text in memory
 * 6. No rate limiting on auth requests
 * 7. Error messages leak implementation details
 * 8. No token binding (JWT cnf claim)
 *
 * ### Medium (Nice to Have)
 * 9. Weak session ID generation
 * 10. No refresh token rotation
 * 11. No nonce for replay protection
 */

import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { URL } from "node:url";

/**
 * Security configuration for OAuth flows
 */
export const OAUTH_SECURITY_CONFIG = {
  /** Require PKCE for all OAuth 2.1 flows */
  REQUIRE_PKCE: true,
  /** Require HTTPS for all endpoints */
  REQUIRE_TLS: true,
  /** Maximum token lifetime (seconds) */
  MAX_TOKEN_LIFETIME: 3600,
  /** Minimum TLS version */
  MIN_TLS_VERSION: "1.2",
  /** Allowed token signature algorithms */
  ALLOWED_ALGOS: ["RS256", "RS384", "ES256", "ES384", "PS256", "PS384"],
  /** Maximum polling attempts for device code */
  MAX_POLLING_ATTEMPTS: 60,
  /** Base polling interval (seconds) */
  POLLING_INTERVAL: 5,
} as const;

/**
 * Validate OAuth endpoint security
 */
export function validateEndpointSecurity(endpoint: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const url = new URL(endpoint);

    // Check for localhost/private network in development (HTTP allowed)
    const isLocalDevelopment =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.startsWith("192.168.") ||
      url.hostname.startsWith("10.") ||
      url.hostname.startsWith("172.16.");

    // Only require HTTPS for non-local development endpoints
    if (!isLocalDevelopment && url.protocol !== "https:") {
      errors.push(
        `Endpoint must use HTTPS for non-local endpoints, got ${url.protocol}`,
      );
    }

    // Check for port validation (no default HTTP ports)
    if (url.port === "80" || url.port === "8080") {
      errors.push("HTTP ports should not be used with OAuth");
    }
  } catch (error) {
    errors.push(
      `Invalid endpoint URL: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate audience matches expected value
 *
 * Prevents token acceptance across different resources/services
 */
export function validateAudience(
  tokenAudience: string | undefined,
  expectedAudience: string,
): {
  valid: boolean;
  error?: string;
} {
  if (!tokenAudience) {
    return {
      valid: false,
      error: "Token missing audience (aud) claim",
    };
  }

  if (tokenAudience !== expectedAudience) {
    return {
      valid: false,
      error: `Token audience mismatch: expected ${expectedAudience}, got ${tokenAudience}`,
    };
  }

  return { valid: true };
}

/**
 * Mask sensitive values for logging
 */
export function maskSensitiveValue(
  value: string,
  visibleChars: number = 4,
): string {
  if (value.length <= visibleChars * 2) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, visibleChars)}${"*".repeat(value.length - visibleChars * 2)}${value.slice(-visibleChars)}`;
}

/**
 * Validate client ID format
 *
 * Prevents injection attacks through client_id parameter
 */
export function validateClientId(clientId: string): {
  valid: boolean;
  error?: string;
} {
  if (!clientId || clientId.trim().length === 0) {
    return { valid: false, error: "Client ID cannot be empty" };
  }

  if (clientId.length > 255) {
    return { valid: false, error: "Client ID too long (max 255 chars)" };
  }

  // Only allow alphanumeric, hyphens, underscores, and dots
  if (!/^[A-Za-z0-9._-]+$/.test(clientId)) {
    return { valid: false, error: "Client ID contains invalid characters" };
  }

  return { valid: true };
}

/**
 * PKCE (Proof Key for Code Exchange) utilities
 * Required for OAuth 2.1 public clients
 */
export const pkce = {
  /**
   * Generate code verifier
   * High-entropy cryptographically random string (43-128 chars)
   */
  generateCodeVerifier(): string {
    const length = 128;
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const random = randomBytes(length);

    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[random[i] % chars.length];
    }

    return result;
  },

  /**
   * Generate code challenge from verifier
   * Uses S256 method (BASE64URL-encode SHA256(verifier))
   */
  generateCodeChallenge(verifier: string): string {
    const hash = createHash("sha256").update(verifier).digest();
    return base64UrlEncode(hash);
  },

  /**
   * Verify code challenge
   */
  verifyCodeChallenge(verifier: string, challenge: string): boolean {
    const expected = this.generateCodeChallenge(verifier);
    return timingSafeEqual(Buffer.from(expected), Buffer.from(challenge));
  },
};

/**
 * Base64URL-encode without padding
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Secure session ID generation
 * Uses crypto-random bytes with timestamp component
 */
export function generateSecureSessionId(): string {
  const random = randomBytes(16).toString("hex");
  const timestamp = Date.now().toString(36);
  return `${timestamp}-${random}`;
}

/**
 * Sanitize error messages for user display
 * Removes implementation details that could aid attackers
 */
export function sanitizeError(error: Error | string): string {
  const message = typeof error === "string" ? error : error.message;

  // Remove file paths
  const noPaths = message.replace(/\/[^\s]+/g, "[path]");

  // Remove internal function names
  const noFunctions = noPaths.replace(
    /\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/g,
    "[function](",
  );

  // Limit length
  const maxLength = 200;
  return noFunctions.length > maxLength
    ? noFunctions.slice(0, maxLength) + "..."
    : noFunctions;
}

/**
 * Validate JWT token structure
 * Basic validation before accepting tokens
 */
export function validateJwtStructure(token: string): {
  valid: boolean;
  error?: string;
} {
  if (!token || token.trim().length === 0) {
    return { valid: false, error: "Token is empty" };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return {
      valid: false,
      error: `Invalid token structure (expected 3 parts, got ${parts.length})`,
    };
  }

  try {
    // Validate each part is valid base64
    for (const part of parts) {
      // Add padding if needed
      const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
      Buffer.from(padded, "base64");
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: "Token contains invalid base64 encoding",
    };
  }
}

/**
 * Rate limiter for authentication requests
 * Prevents abuse of OAuth endpoints
 */
export class AuthRateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private windowMs: number = 60000; // 1 minute window
  private maxAttempts: number = 10; // Max attempts per window per key

  constructor(maxAttempts: number = 10, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed
   */
  check(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing attempts for this key
    let attempts = this.attempts.get(key) || [];

    // Remove attempts outside the current window
    attempts = attempts.filter((timestamp) => timestamp > windowStart);

    // Check if limit exceeded
    if (attempts.length >= this.maxAttempts) {
      // Calculate when the oldest attempt will expire
      const oldestAttempt = attempts[0];
      const retryAfter = Math.ceil(
        (oldestAttempt + this.windowMs - now) / 1000,
      );

      return {
        allowed: false,
        retryAfter,
      };
    }

    // Record this attempt
    attempts.push(now);
    this.attempts.set(key, attempts);

    return { allowed: true };
  }

  /**
   * Clear attempts for a key
   */
  clear(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Clear all expired attempts
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, attempts] of this.attempts.entries()) {
      const validAttempts = attempts.filter(
        (timestamp) => timestamp > windowStart,
      );
      if (validAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, validAttempts);
      }
    }
  }
}

/**
 * Security audit result
 */
export interface SecurityAuditResult {
  valid: boolean;
  critical: string[];
  high: string[];
  medium: string[];
  recommendations: string[];
}

/**
 * Run security audit on OAuth configuration
 */
export function auditOAuthSecurity(config: {
  endpoint: string;
  clientId: string;
  tokenEndpoint: string;
  deviceCodeEndpoint?: string;
  audience?: string;
  usePkce?: boolean;
}): SecurityAuditResult {
  const critical: string[] = [];
  const high: string[] = [];
  const medium: string[] = [];
  const recommendations: string[] = [];

  // Validate endpoints
  const endpointValidation = validateEndpointSecurity(config.endpoint);
  if (!endpointValidation.valid) {
    critical.push(...endpointValidation.errors);
  }

  const tokenEndpointValidation = validateEndpointSecurity(
    config.tokenEndpoint,
  );
  if (!tokenEndpointValidation.valid) {
    critical.push(...tokenEndpointValidation.errors);
  }

  if (config.deviceCodeEndpoint) {
    const deviceValidation = validateEndpointSecurity(
      config.deviceCodeEndpoint,
    );
    if (!deviceValidation.valid) {
      critical.push(...deviceValidation.errors);
    }
  }

  // Check PKCE
  if (!config.usePkce) {
    critical.push("PKCE not enabled - required for OAuth 2.1 public clients");
    recommendations.push("Enable PKCE for device code flow (RFC 7636)");
  }

  // Check client ID validation
  const clientIdValidation = validateClientId(config.clientId);
  if (!clientIdValidation.valid) {
    high.push(`Invalid client ID: ${clientIdValidation.error}`);
  }

  // Check audience
  if (!config.audience) {
    high.push("No audience specified - tokens could be used for any resource");
    recommendations.push(
      "Always specify audience parameter for token requests",
    );
  }

  // Check for TLS
  try {
    const tokenUrl = new URL(config.tokenEndpoint);
    if (tokenUrl.protocol !== "https:") {
      critical.push("Token endpoint must use HTTPS");
    }
  } catch {
    critical.push("Invalid token endpoint URL");
  }

  // Additional recommendations
  recommendations.push("Implement token binding with JWT cnf claim");
  recommendations.push("Add refresh token rotation");
  recommendations.push("Implement rate limiting on auth requests");
  recommendations.push("Mask sensitive values in logs");
  recommendations.push("Add token introspection for server-side validation");

  return {
    valid: critical.length === 0 && high.length === 0,
    critical,
    high,
    medium,
    recommendations,
  };
}
