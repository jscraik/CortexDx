/**
 * Auth0 Middleware for MCP Server
 * Provides token validation and role-based access control
 * Requirements: 6.4, 7.1
 */

import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Auth0Config } from "./auth.js";
import { validateAuth0Token } from "./auth.js";

// Role-based feature permissions
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["*"], // All features
  developer: [
    "diagnose_mcp_server",
    "validate_protocol",
    "scan_security",
    "profile_performance",
    "generate_code",
    "interactive_debug",
    "validate_license",
    "academic_validation",
    "advanced_diagnostics",
    "llm_backends",
  ],
  viewer: [
    "diagnose_mcp_server",
    "validate_protocol",
    "scan_security",
    "profile_performance",
  ],
  community: ["diagnose_mcp_server", "validate_protocol"],
};

// Feature to tool mapping
export const FEATURE_TOOL_MAP: Record<string, string[]> = {
  diagnose_mcp_server: ["diagnose_mcp_server", "inspect_server"],
  validate_protocol: ["validate_protocol", "check_compliance"],
  scan_security: ["scan_security", "check_vulnerabilities"],
  profile_performance: ["profile_performance", "analyze_performance"],
  generate_code: [
    "generate_mcp_code",
    "generate_connector",
    "generate_template",
  ],
  interactive_debug: [
    "start_conversation",
    "continue_conversation",
    "debug_interactive",
  ],
  validate_license: ["validate_academic_license", "check_license_compliance"],
  academic_validation: [
    "validate_research",
    "check_citation",
    "analyze_methodology",
  ],
  advanced_diagnostics: [
    "deep_analysis",
    "compatibility_check",
    "integration_test",
  ],
  llm_backends: ["load_model", "manage_models", "optimize_inference"],
};

export interface AuthMiddlewareConfig {
  auth0: Auth0Config;
  requireAuth: boolean;
  publicEndpoints: string[];
  rolePermissions?: Record<string, string[]>;
}

export interface AuthenticatedRequest extends IncomingMessage {
  auth?: {
    userId: string;
    roles: string[];
    permissions: string[];
    expiresAt: number;
  };
}

/**
 * Create Auth0 middleware for MCP server
 */
export const createAuthMiddleware = (config: AuthMiddlewareConfig) => {
  const rolePermissions = config.rolePermissions || ROLE_PERMISSIONS;
  const staticApiKey = process.env.CORTEXDX_API_KEY?.trim();

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> => {
    // Skip auth for public endpoints
    if (
      config.publicEndpoints.some((endpoint) => req.url?.startsWith(endpoint))
    ) {
      next();
      return;
    }

    // Skip auth if not required
    if (!config.requireAuth) {
      // Attach synthetic auth context when API key is present so downstream RBAC can use it
      if (staticApiKey) {
        const apiKeyHeader = extractHeader(req.headers["x-cortexdx-api-key"]);
        if (apiKeyHeader && safeCompare(apiKeyHeader, staticApiKey)) {
          const authReq = req as AuthenticatedRequest;
          authReq.auth = {
            userId: "api-key-user",
            roles: ["admin"],
            permissions: ["*"],
            expiresAt: Date.now() + 60 * 60 * 1000,
          };
        }
      }
      next();
      return;
    }

    // Static API key fallback
    if (staticApiKey) {
      const apiKeyHeader = extractHeader(req.headers["x-cortexdx-api-key"]);
      if (apiKeyHeader && safeCompare(apiKeyHeader, staticApiKey)) {
        const authReq = req as AuthenticatedRequest;
        authReq.auth = {
          userId: "api-key-user",
          roles: ["admin"],
          permissions: ["*"],
          expiresAt: Date.now() + 60 * 60 * 1000,
        };
        next();
        return;
      }
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Unauthorized",
          message: "Missing Authorization header",
        }),
      );
      return;
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Unauthorized",
          message: "Invalid Authorization header format",
        }),
      );
      return;
    }

    // Validate token
    const validation = await validateAuth0Token(token, config.auth0);
    if (!validation.valid) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Unauthorized",
          message: validation.error || "Invalid token",
        }),
      );
      return;
    }

    // Attach auth info to request
    const authReq = req as AuthenticatedRequest;
    authReq.auth = {
      userId: validation.userId || "unknown",
      roles: validation.roles || [],
      permissions: validation.permissions || [],
      expiresAt: validation.expiresAt || 0,
    };

    next();
  };
};

const extractHeader = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === "string" ? value : null;
};

const safeCompare = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
};

/**
 * Check if user has access to specific tool
 */
export const checkToolAccess = (
  req: AuthenticatedRequest,
  toolName: string,
  rolePermissions: Record<string, string[]> = ROLE_PERMISSIONS,
): { allowed: boolean; reason?: string } => {
  // No auth info means public access or auth not required
  if (!req.auth) {
    return { allowed: true };
  }

  const { roles } = req.auth;

  // Check each role for access
  for (const role of roles) {
    const permissions = rolePermissions[role];
    if (!permissions) {
      continue;
    }

    // Check for wildcard permission
    if (permissions.includes("*")) {
      return { allowed: true };
    }

    // Find feature for this tool
    const feature = Object.entries(FEATURE_TOOL_MAP).find(([, tools]) =>
      tools.includes(toolName),
    )?.[0];

    if (!feature) {
      // Tool not mapped to feature, allow by default
      return { allowed: true };
    }

    // Check if role has permission for this feature
    if (permissions.includes(feature)) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: `User roles [${roles.join(", ")}] do not have access to tool: ${toolName}`,
  };
};

/**
 * Middleware to check tool access
 */
export const createToolAccessMiddleware = (
  rolePermissions: Record<string, string[]> = ROLE_PERMISSIONS,
) => {
  return (
    req: AuthenticatedRequest,
    res: ServerResponse,
    toolName: string,
    next: () => void,
  ): void => {
    const access = checkToolAccess(req, toolName, rolePermissions);

    if (!access.allowed) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Forbidden",
          message: access.reason || "Access denied to this tool",
          tool: toolName,
        }),
      );
      return;
    }

    next();
  };
};

/**
 * Extract user info from authenticated request
 */
export const getUserInfo = (req: AuthenticatedRequest) => {
  return req.auth || null;
};

/**
 * Check if user has specific role
 */
export const hasRole = (req: AuthenticatedRequest, role: string): boolean => {
  return req.auth?.roles.includes(role) ?? false;
};

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (
  req: AuthenticatedRequest,
  roles: string[],
): boolean => {
  if (!req.auth) return false;
  return roles.some((role) => req.auth?.roles.includes(role));
};

/**
 * Check if user has all of the specified roles
 */
export const hasAllRoles = (
  req: AuthenticatedRequest,
  roles: string[],
): boolean => {
  if (!req.auth) return false;
  return roles.every((role) => req.auth?.roles.includes(role));
};

/**
 * Get user's effective permissions based on roles
 */
export const getEffectivePermissions = (
  req: AuthenticatedRequest,
  rolePermissions: Record<string, string[]> = ROLE_PERMISSIONS,
): string[] => {
  if (!req.auth) return [];

  const permissions = new Set<string>();

  for (const role of req.auth.roles) {
    const rolePerms = rolePermissions[role];
    if (rolePerms) {
      for (const perm of rolePerms) {
        permissions.add(perm);
      }
    }
  }

  return Array.from(permissions);
};
