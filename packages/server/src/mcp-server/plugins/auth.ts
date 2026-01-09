/**
 * Authentication Plugin
 * Wraps existing auth-middleware for use with MCP server
 */

import { createLogger } from "../../logging/logger.js";
import { McpError, MCP_ERRORS } from "../core/errors";
import type { ServerPlugin, RequestContext, AuthPluginConfig } from "./types";
import type { JsonRpcResponse } from "../transports/types";

const logger = createLogger({ component: "auth-plugin" });

/**
 * Create authentication plugin
 */
export function createAuthPlugin(config: AuthPluginConfig): ServerPlugin {
  const { requireAuth, publicEndpoints = [], adminRoles = ["admin"] } = config;

  return {
    name: "auth",
    version: "1.0.0",
    priority: 10, // Run early

    async onRequest(ctx: RequestContext): Promise<JsonRpcResponse | undefined> {
      const method = ctx.request.method;

      // Check if endpoint is public
      if (publicEndpoints.includes(method)) {
        return undefined;
      }

      // If auth is not required, allow through
      if (!requireAuth) {
        ctx.auth = { roles: [] };
        return undefined;
      }

      // Check for auth in state (would be set by transport layer)
      const token = ctx.state.get("authToken") as string | undefined;

      if (!token) {
        logger.debug(
          { method },
          "Authentication required but no token provided",
        );
        return {
          jsonrpc: "2.0",
          id: ctx.request.id ?? null,
          error: {
            code: MCP_ERRORS.AUTH_REQUIRED,
            message: "Authentication required",
          },
        };
      }

      try {
        // Verify token (simplified - in production would verify JWT)
        const auth = await verifyToken(token, config);
        ctx.auth = auth;
        logger.debug({ method, userId: auth.userId }, "Request authenticated");
        return undefined;
      } catch (error) {
        logger.warn({ method, error }, "Authentication failed");
        return {
          jsonrpc: "2.0",
          id: ctx.request.id ?? null,
          error: {
            code: MCP_ERRORS.INVALID_TOKEN,
            message: "Invalid or expired token",
          },
        };
      }
    },

    async onToolCall(ctx: RequestContext, toolName: string): Promise<void> {
      // Check for admin-only tools
      const adminTools = ["wikidata_sparql", "cortexdx_delete_workflow"];

      if (adminTools.includes(toolName)) {
        const hasAdminRole = ctx.auth?.roles.some((role) =>
          adminRoles.includes(role),
        );

        if (!hasAdminRole) {
          throw new McpError(
            MCP_ERRORS.ACCESS_DENIED,
            `Tool '${toolName}' requires admin role`,
          );
        }
      }
    },
  };
}

/**
 * Verify authentication token
 */
async function verifyToken(
  token: string,
  config: AuthPluginConfig,
): Promise<{ userId?: string; roles: string[]; token: string }> {
  // Simplified verification - in production would:
  // 1. Verify JWT signature with Auth0 public key
  // 2. Check expiration
  // 3. Extract claims

  if (!config.auth0?.domain) {
    // No Auth0 config, accept any token for development
    return {
      userId: "dev-user",
      roles: [],
      token,
    };
  }

  // Basic JWT structure check
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  try {
    // Decode payload (without verification for demo)
    const payload = JSON.parse(
      Buffer.from(parts[1] || "", "base64").toString(),
    );

    return {
      userId: payload.sub,
      roles: payload["https://cortexdx.dev/roles"] || [],
      token,
    };
  } catch {
    throw new Error("Failed to decode token");
  }
}

/**
 * Helper to check if request context has specific role
 */
export function hasRole(ctx: RequestContext, role: string): boolean {
  return ctx.auth?.roles.includes(role) ?? false;
}

/**
 * Helper to check if request context has any of the specified roles
 */
export function hasAnyRole(ctx: RequestContext, roles: string[]): boolean {
  return roles.some((role) => hasRole(ctx, role));
}

/**
 * Helper to require authentication in tool execute
 */
export function requireAuthentication(ctx: RequestContext): void {
  if (!ctx.auth) {
    throw new McpError(MCP_ERRORS.AUTH_REQUIRED, "Authentication required");
  }
}
