import type { DiagnosticPlugin, Finding } from "@brainwav/cortexdx-core";
import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";

// Enhanced Auth0 integration types
export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret?: string;
  audience?: string;
  scope?: string;
}

export interface Auth0TokenValidationResult {
  valid: boolean;
  userId?: string;
  roles?: string[];
  permissions?: string[];
  expiresAt?: number;
  error?: string;
}

export interface RoleAccessResult {
  allowed: boolean;
  role: string;
  feature: string;
  reason?: string;
}

export interface AuthUsageRecord {
  userId: string;
  action: string;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// Enhanced Auth Plugin with enterprise features
export const AuthPlugin: DiagnosticPlugin = {
  id: "auth",
  title: "Auth Surface (unauth discovery probe)",
  order: 90,
  async run(ctx) {
    const findings: Finding[] = [];
    const open = await ctx.jsonrpc<unknown>("tools/list").then(
      () => true,
      () => false,
    );
    if (open) {
      findings.push({
        id: "auth.zero",
        area: "auth",
        severity: "blocker",
        title: "Unauthenticated tool discovery",
        description: "Endpoint responds to discovery without authentication.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
      });
    }
    return findings;
  },
};

// Auth0 token validation helper
export async function validateAuth0Token(
  token: string,
  config: Auth0Config,
): Promise<Auth0TokenValidationResult> {
  try {
    const jwksUrl = `https://${config.domain}/.well-known/jwks.json`;
    const response = await fetch(jwksUrl);

    if (!response.ok) {
      return {
        valid: false,
        error: `Failed to fetch JWKS: ${response.statusText}`,
      };
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid token format" };
    }

    const payloadPart = parts[1];
    if (!payloadPart) {
      return { valid: false, error: "Invalid token payload" };
    }

    const payloadRaw = safeParseJson(
      Buffer.from(payloadPart, "base64").toString("utf-8"),
    );

    // Type guard to ensure payload is an object
    if (typeof payloadRaw !== "object" || payloadRaw === null) {
      return { valid: false, error: "Invalid token payload" };
    }

    const payload = payloadRaw as {
      exp?: number;
      aud?: string;
      sub?: string;
      [key: string]: unknown;
    };

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: "Token expired" };
    }

    if (config.audience && payload.aud !== config.audience) {
      return { valid: false, error: "Invalid audience" };
    }

    return {
      valid: true,
      userId: payload.sub,
      roles: (payload["https://cortexdx/roles"] as string[] | undefined) || [],
      permissions: (payload.permissions as string[] | undefined) || [],
      expiresAt: payload.exp,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Role-based access control check
export function checkRoleAccess(
  role: string,
  feature: string,
  rolePermissions: Record<string, string[]>,
): RoleAccessResult {
  const permissions = rolePermissions[role];

  if (!permissions) {
    return {
      allowed: false,
      role,
      feature,
      reason: "Role not found",
    };
  }

  const allowed = permissions.includes(feature) || permissions.includes("*");

  return {
    allowed,
    role,
    feature,
    reason: allowed ? undefined : "Feature not permitted for role",
  };
}

// Track authentication usage
export function trackAuthUsage(
  userId: string,
  action: string,
  success: boolean,
  metadata?: Record<string, unknown>,
): AuthUsageRecord {
  return {
    userId,
    action,
    timestamp: Date.now(),
    success,
    metadata,
  };
}
