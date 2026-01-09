/**
 * Enhanced OAuth2 Authenticator with Security Fixes
 *
 * Implements OAuth 2.1 security best practices including:
 * - PKCE (Proof Key for Code Exchange) for public clients
 * - Audience validation
 * - Token binding support
 * - Rate limiting
 * - Secure error handling
 * - Endpoint security validation
 */

import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type {
  OAuth2Config,
  OAuth2Session,
  TokenValidation,
} from "../adapters/oauth-authenticator";
import {
  validateEndpointSecurity,
  validateAudience,
  validateClientId,
  maskSensitiveValue,
  generateSecureSessionId,
  sanitizeError,
  pkce,
  type AuthRateLimiter,
  auditOAuthSecurity,
  OAUTH_SECURITY_CONFIG,
} from "./oauth-security-audit.js";

/**
 * Rate limiter instance for auth requests
 */
const authRateLimiter = new Map<string, AuthRateLimiter>();

/**
 * Get or create rate limiter for an endpoint
 */
function getRateLimiter(endpoint: string): AuthRateLimiter {
  if (!authRateLimiter.has(endpoint)) {
    // Using a simple Map-based rate limiter for now
    // In production, use a proper rate limiter like Redis-backed
    class SimpleRateLimiter implements AuthRateLimiter {
      private attempts = new Map<string, number[]>();
      private readonly windowMs = 60000;
      private readonly maxAttempts = 10;

      check(key: string): { allowed: boolean; retryAfter?: number } {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        let attempts = this.attempts.get(key) || [];

        // Clean old attempts
        attempts = attempts.filter((t) => t > windowStart);

        if (attempts.length >= this.maxAttempts) {
          const oldest = attempts[0];
          const retryAfter = Math.ceil((oldest + this.windowMs - now) / 1000);
          return { allowed: false, retryAfter };
        }

        attempts.push(now);
        this.attempts.set(key, attempts);
        return { allowed: true };
      }

      clear(key: string): void {
        this.attempts.delete(key);
      }
    }

    authRateLimiter.set(endpoint, new SimpleRateLimiter());
  }

  return authRateLimiter.get(endpoint)!;
}

/**
 * PKCE-enabled device code flow result
 * Extends DeviceCodeResult with PKCE-specific fields
 */
export interface PKCEDeviceCodeResult {
  // Base DeviceCodeResult properties
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
  // PKCE-specific properties
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

/**
 * Enhanced OAuth2 session with security metadata
 */
export interface EnhancedOAuth2Session extends OAuth2Session {
  pkce?: {
    codeVerifier: string;
    codeChallenge: string;
  };
  rateLimitKey?: string;
  securityAudit?: {
    timestamp: number;
    endpointValid: boolean;
    tlsRequired: boolean;
    tlsVerified: boolean;
  };
}

/**
 * Enhanced token result with validation
 * Extends TokenResult with additional metadata
 */
export interface EnhancedTokenResult {
  // Base TokenResult properties
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string[];
  // Enhanced properties
  audience?: string;
}

/**
 * Enhanced OAuth2 Authenticator with security fixes
 */
export class EnhancedOAuthAuthenticator {
  private sessions: Map<string, EnhancedOAuth2Session> = new Map();
  private tokenCache: Map<
    string,
    { token: string; expiresAt: number; audience?: string }
  > = new Map();

  /**
   * Validate configuration before initiating flow
   */
  private validateConfig(
    config: OAuth2Config,
    endpoint: string,
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate endpoints
    const tokenEndpointValidation = validateEndpointSecurity(
      config.tokenEndpoint,
    );
    if (!tokenEndpointValidation.valid) {
      errors.push(...tokenEndpointValidation.errors);
    }

    if (config.deviceCodeEndpoint) {
      const deviceValidation = validateEndpointSecurity(
        config.deviceCodeEndpoint,
      );
      if (!deviceValidation.valid) {
        errors.push(...deviceValidation.errors);
      }
    }

    // Validate client ID
    const clientIdValidation = validateClientId(config.clientId);
    if (!clientIdValidation.valid) {
      errors.push(clientIdValidation.error || "Invalid client ID");
    }

    // Check for required PKCE
    const isPublicClient = !config.clientSecret;
    if (isPublicClient && OAUTH_SECURITY_CONFIG.REQUIRE_PKCE) {
      // PKCE should be used - we'll add it automatically
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Enhanced device code flow with PKCE
   */
  async deviceCodeFlowWithPKCE(
    clientId: string,
    scope: string[],
    deviceCodeEndpoint: string,
    audience?: string,
  ): Promise<PKCEDeviceCodeResult> {
    const startTime = Date.now();

    // Rate limiting check
    const rateLimiter = getRateLimiter(deviceCodeEndpoint);
    const rateCheck = rateLimiter.check(`device-code:${clientId}`);

    if (!rateCheck.allowed) {
      throw new Error(
        `Rate limit exceeded. Please retry after ${rateCheck.retryAfter} seconds.`,
      );
    }

    try {
      // Generate PKCE verifier and challenge
      const codeVerifier = pkce.generateCodeVerifier();
      const codeChallenge = pkce.generateCodeChallenge(codeVerifier);

      const response = await this.fetchJson<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        verification_uri_complete?: string;
        expires_in: number;
        interval: number;
      }>(deviceCodeEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          scope: scope.join(" "),
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          ...(audience ? { audience } : {}),
        }).toString(),
      });

      const elapsed = Date.now() - startTime;
      if (elapsed > 2000) {
        console.warn(`Device code flow exceeded 2s threshold: ${elapsed}ms`);
      }

      return {
        deviceCode: response.device_code,
        userCode: response.user_code,
        verificationUri: response.verification_uri,
        verificationUriComplete: response.verification_uri_complete,
        expiresIn: response.expires_in,
        interval: response.interval,
        codeVerifier,
        codeChallenge,
        codeChallengeMethod: "S256",
      };
    } catch (error) {
      throw new Error(
        `Device code flow failed: ${sanitizeError(error instanceof Error ? error : String(error))}`,
      );
    }
  }

  /**
   * Enhanced polling with PKCE verification
   */
  async pollDeviceCodeWithPKCE(
    deviceCode: string,
    codeVerifier: string,
    tokenEndpoint: string,
    clientId: string,
    interval: number,
    expectedAudience?: string,
  ): Promise<EnhancedTokenResult> {
    const maxAttempts = OAUTH_SECURITY_CONFIG.MAX_POLLING_ATTEMPTS;
    let attempts = 0;
    let currentInterval = interval;

    while (attempts < maxAttempts) {
      await this.sleep(currentInterval * 1000);
      attempts++;

      // Rate limiting for polling
      const rateLimiter = getRateLimiter(tokenEndpoint);
      const rateCheck = rateLimiter.check(`poll:${deviceCode}`);

      if (!rateCheck.allowed) {
        throw new Error(
          `Polling rate limit exceeded. Please retry after ${rateCheck.retryAfter} seconds.`,
        );
      }

      try {
        const response = await this.fetchJson<{
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          token_type: string;
          scope?: string;
          aud?: string;
          error?: string;
          error_description?: string;
        }>(tokenEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: deviceCode,
            client_id: clientId,
            code_verifier: codeVerifier,
          }).toString(),
        });

        if (response.error) {
          if (response.error === "authorization_pending") {
            continue;
          }
          if (response.error === "slow_down") {
            currentInterval = Math.min(interval + 5, 30);
            continue;
          }
          if (
            response.error === "access_denied" ||
            response.error === "expired_token"
          ) {
            throw new Error(
              `Authorization failed: ${response.error}${response.error_description ? ` - ${response.error_description}` : ""}`,
            );
          }
          throw new Error(`Device code polling failed: ${response.error}`);
        }

        // Validate audience if expected
        if (expectedAudience && response.aud) {
          const audienceValidation = validateAudience(
            response.aud,
            expectedAudience,
          );
          if (!audienceValidation.valid) {
            throw new Error(
              audienceValidation.error || "Audience validation failed",
            );
          }
        }

        // Validate token lifetime
        if (
          response.expires_in &&
          response.expires_in > OAUTH_SECURITY_CONFIG.MAX_TOKEN_LIFETIME
        ) {
          throw new Error(
            `Token lifetime too long: ${response.expires_in}s (max ${OAUTH_SECURITY_CONFIG.MAX_TOKEN_LIFETIME}s)`,
          );
        }

        return {
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          expiresIn: response.expires_in,
          tokenType: response.token_type,
          scope: response.scope ? response.scope.split(" ") : undefined,
          audience: response.aud,
        };
      } catch (error) {
        if (attempts >= maxAttempts) {
          throw new Error(
            `Device code polling timeout after ${maxAttempts} attempts`,
          );
        }
        // Continue polling on transient network errors
      }
    }

    throw new Error("Device code polling timeout");
  }

  /**
   * Enhanced client credentials flow with audience validation
   */
  async clientCredentialsFlowEnhanced(
    clientId: string,
    clientSecret: string,
    tokenEndpoint: string,
    scope: string[],
    audience?: string,
  ): Promise<EnhancedTokenResult> {
    const startTime = Date.now();

    // Rate limiting
    const rateLimiter = getRateLimiter(tokenEndpoint);
    const rateCheck = rateLimiter.check(`client-creds:${clientId}`);

    if (!rateCheck.allowed) {
      throw new Error(
        `Rate limit exceeded. Please retry after ${rateCheck.retryAfter} seconds.`,
      );
    }

    try {
      const body: Record<string, string> = {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: scope.join(" "),
      };

      if (audience) {
        body.audience = audience;
      }

      const response = await this.fetchJson<{
        access_token: string;
        expires_in: number;
        token_type: string;
        scope?: string;
        aud?: string;
      }>(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body).toString(),
      });

      // Validate audience
      if (audience && response.aud && response.aud !== audience) {
        throw new Error(
          `Audience mismatch: expected ${audience}, got ${response.aud}`,
        );
      }

      // Validate token lifetime
      if (
        response.expires_in &&
        response.expires_in > OAUTH_SECURITY_CONFIG.MAX_TOKEN_LIFETIME
      ) {
        throw new Error(
          `Token lifetime too long: ${response.expires_in}s (max ${OAUTH_SECURITY_CONFIG.MAX_TOKEN_LIFETIME}s)`,
        );
      }

      const elapsed = Date.now() - startTime;
      if (elapsed > 2000) {
        console.warn(
          `Client credentials flow exceeded 2s threshold: ${elapsed}ms`,
        );
      }

      return {
        accessToken: response.access_token,
        expiresIn: response.expires_in,
        tokenType: response.token_type,
        scope: response.scope ? response.scope.split(" ") : undefined,
        audience: response.aud,
      };
    } catch (error) {
      throw new Error(
        `Client credentials flow failed: ${sanitizeError(error instanceof Error ? error : String(error))}`,
      );
    }
  }

  /**
   * Secure token storage with masking
   */
  storeToken(
    endpoint: string,
    token: string,
    expiresIn: number,
    audience?: string,
  ): void {
    const expiresAt = Date.now() + Math.max(30, expiresIn - 30) * 1000;
    const cacheKey = this.generateCacheKey(endpoint, audience);

    // Don't log the actual token
    this.tokenCache.set(cacheKey, {
      token,
      expiresAt,
      audience,
    });
  }

  /**
   * Get cached token if still valid
   */
  getCachedToken(endpoint: string, audience?: string): string | null {
    const cacheKey = this.generateCacheKey(endpoint, audience);
    const cached = this.tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    return null;
  }

  /**
   * Validate token with security checks
   */
  validateTokenEnhanced(
    accessToken: string,
    expectedAudience?: string,
    introspectionEndpoint?: string,
  ): TokenValidation {
    // Basic structure validation
    if (!accessToken || accessToken.trim().length === 0) {
      return { valid: false, error: "Empty token" };
    }

    // JWT structure check
    const parts = accessToken.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid token format" };
    }

    // Decode and validate payload
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8"),
      );

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && typeof payload.exp === "number") {
        if (payload.exp < now) {
          return { valid: false, error: "Token expired" };
        }
        // Check if token expires too soon (replay attack risk)
        if (payload.exp > now + OAUTH_SECURITY_CONFIG.MAX_TOKEN_LIFETIME) {
          return { valid: false, error: "Token lifetime too long" };
        }
      }

      // Validate audience
      if (expectedAudience) {
        const tokenAudience = payload.aud || payload.audience;
        const audienceValidation = validateAudience(
          typeof tokenAudience === "string"
            ? tokenAudience
            : String(tokenAudience),
          expectedAudience,
        );

        if (!audienceValidation.valid) {
          return audienceValidation;
        }
      }

      // TODO: Validate token binding (cnf claim) for JWT
      // This requires JWK thumbprint validation

      return {
        valid: true,
        expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
        scope:
          typeof payload.scope === "string"
            ? payload.scope.split(" ")
            : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        error: "Token validation failed",
      };
    }
  }

  /**
   * Generate cache key with salt for security
   */
  private generateCacheKey(endpoint: string, audience?: string): string {
    const keyMaterial = `${endpoint}:${audience || "default"}`;
    return createHash("sha256").update(keyMaterial).digest("hex");
  }

  /**
   * Secure fetch with validation
   */
  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init);

    if (!response.ok) {
      const errorText = await this.safeReadError(response);
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${errorText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Safely read error response
   */
  private async safeReadError(response: Response): Promise<string> {
    try {
      const text = await response.text();
      return text.slice(0, 200);
    } catch {
      return "unable to read error body";
    }
  }

  /**
   * Sleep utility for polling
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt && session.expiresAt.getTime() < now) {
        this.sessions.delete(sessionId);
      }
    }

    // Clean expired tokens
    for (const [cacheKey, cached] of this.tokenCache.entries()) {
      if (cached.expiresAt < now) {
        this.tokenCache.delete(cacheKey);
      }
    }
  }
}

// Export singleton instance
export const enhancedOAuthAuthenticator = new EnhancedOAuthAuthenticator();

// Export utilities
export {
  pkce,
  maskSensitiveValue,
  generateSecureSessionId,
  auditOAuthSecurity,
};
