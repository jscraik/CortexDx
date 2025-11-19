/**
 * Diagnostic Session Middleware
 * Validates temporary diagnostic session API keys
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { getDiagnosticSessionManager } from "../auth/diagnostic-session-manager.js";

export interface DiagnosticSessionRequest extends IncomingMessage {
  diagnosticSession?: {
    sessionId: string;
    requestedBy: string;
    scope: string[];
    allowedEndpoints: string[];
    expiresAt: string;
  };
}

/**
 * Middleware to validate diagnostic session keys
 * Checks for X-Diagnostic-Session-Key header and validates it
 */
export const createDiagnosticSessionMiddleware = () => {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> => {
    // Check for diagnostic session key header
    const sessionKey = getSessionKeyFromHeaders(req.headers);

    if (!sessionKey) {
      // No diagnostic session key provided, pass through to allow other auth methods
      next();
      return;
    }

    // Validate the session key
    const sessionManager = getDiagnosticSessionManager();
    // Use a fixed base URL to avoid Host header injection
    // Defensive extraction of endpoint path to avoid Host header injection
    const endpoint = req.url?.startsWith("/")
      ? req.url.split("?")[0]
      : new URL(req.url || "/", "http://localhost").pathname;

    if (!endpoint) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: "Invalid endpoint",
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }
    const validation = sessionManager.validateSession(sessionKey, endpoint);

    if (!validation.valid || !validation.session) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Unauthorized",
          message: validation.reason || "Invalid diagnostic session",
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    // Attach session info to request
    const sessionReq = req as DiagnosticSessionRequest;
    sessionReq.diagnosticSession = {
      sessionId: validation.session.sessionId,
      requestedBy: validation.session.requestedBy,
      scope: validation.session.scope,
      allowedEndpoints: validation.session.allowedEndpoints,
      expiresAt: validation.session.expiresAt,
    };

    // Track usage
    const method = req.method || "UNKNOWN";
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    sessionManager.trackUsage(
      validation.session.sessionId,
      endpoint,
      method,
      ipAddress,
      userAgent,
    );

    next();
  };
};

/**
 * Extract session key from request headers
 */
function getSessionKeyFromHeaders(
  headers: IncomingMessage["headers"],
): string | undefined {
  // Check multiple possible header names
  const possibleHeaders = [
    "x-diagnostic-session-key",
    "x-diagnostic-session",
    "diagnostic-session-key",
  ];

  for (const headerName of possibleHeaders) {
    const value = headers[headerName];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (Array.isArray(value) && value.length > 0 && value[0]) {
      return value[0].trim();
    }
  }

  return undefined;
}

/**
 * Get client IP address from request.
 *
 * SECURITY NOTE: The X-Forwarded-For and X-Real-IP headers are easily spoofed.
 * Only use these for audit/logging purposes, never for security decisions.
 * Always log both the forwarded IP and the direct socket address for comparison.
 */
export function getClientIpInfo(req: IncomingMessage): {
  forwardedFor?: string;
  realIp?: string;
  socketIp?: string;
} {
  // Extract X-Forwarded-For header (for proxies)
  const forwardedForHeader = req.headers["x-forwarded-for"];
  let forwardedFor: string | undefined;
  if (forwardedForHeader) {
    const firstHeader = Array.isArray(forwardedForHeader)
      ? forwardedForHeader[0]
      : forwardedForHeader;
    if (typeof firstHeader === "string") {
      const parts = firstHeader.split(",");
      if (parts.length > 0 && parts[0]) {
        forwardedFor = parts[0].trim();
      }
    }
  }

  // Extract X-Real-IP header
  const realIpHeader = req.headers["x-real-ip"];
  const realIp = realIpHeader
    ? Array.isArray(realIpHeader)
      ? realIpHeader[0]
      : realIpHeader
    : undefined;

  // Extract socket remote address
  const socketIp = req.socket.remoteAddress;

  return { forwardedFor, realIp, socketIp };
}

/**
 * Get client IP address as a string (for middleware usage).
 * Returns forwardedFor, realIp, or socketIp (in order of preference).
 */
export function getClientIp(req: IncomingMessage): string | undefined {
  const { forwardedFor, realIp, socketIp } = getClientIpInfo(req);
  return forwardedFor || realIp || socketIp;
}

/**
 * Helper to check if request has valid diagnostic session
 */
export function hasDiagnosticSession(req: IncomingMessage): boolean {
  const sessionReq = req as DiagnosticSessionRequest;
  return Boolean(sessionReq.diagnosticSession);
}

/**
 * Helper to check if diagnostic session has specific scope
 */
export function hasScope(req: IncomingMessage, scope: string): boolean {
  const sessionReq = req as DiagnosticSessionRequest;
  return sessionReq.diagnosticSession?.scope.includes(scope) || false;
}
