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
        next: () => void
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
        const endpoint = new URL(req.url || '/', 'http://localhost').pathname;
        const validation = sessionManager.validateSession(sessionKey, endpoint);

        if (!validation.valid) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Unauthorized',
                message: validation.reason || 'Invalid diagnostic session',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // Attach session info to request
        const sessionReq = req as DiagnosticSessionRequest;
        sessionReq.diagnosticSession = {
            sessionId: validation.session!.sessionId,
            requestedBy: validation.session!.requestedBy,
            scope: validation.session!.scope,
            allowedEndpoints: validation.session!.allowedEndpoints,
            expiresAt: validation.session!.expiresAt
        };

        // Track usage
        const method = req.method || 'UNKNOWN';
        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'];

        sessionManager.trackUsage(
            validation.session!.sessionId,
            endpoint,
            method,
            ipAddress,
            userAgent
        );

        next();
    };
};

/**
 * Extract session key from request headers
 */
function getSessionKeyFromHeaders(headers: IncomingMessage['headers']): string | undefined {
    // Check multiple possible header names
    const possibleHeaders = [
        'x-diagnostic-session-key',
        'x-diagnostic-session',
        'diagnostic-session-key'
    ];

    for (const headerName of possibleHeaders) {
        const value = headers[headerName];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
        if (Array.isArray(value) && value.length > 0 && value[0]) {
            return value[0].trim();
        }
    }

    return undefined;
}

/**
 * Get client IP address from request
 */
function getClientIp(req: IncomingMessage): string | undefined {
    // Check X-Forwarded-For header (for proxies)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        return ips.split(',')[0].trim();
    }

    // Check X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
        return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to socket remote address
    return req.socket.remoteAddress;
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
