/**
 * Diagnostic MCP Client
 * Specialized HTTP MCP client for diagnosing other MCP servers using temporary session authentication
 */

import { HttpMcpClient, type HttpMcpClientOptions } from "./academic/http-mcp-client.js";
import { type DiagnosticSessionConfig } from "../auth/diagnostic-session-manager.js";
import { resolveAuthHeaders } from "../auth/auth0-handshake.js";

export interface DiagnosticMcpClientOptions {
    targetServerUrl: string;

    // Session-based authentication (recommended)
    diagnosticSessionKey?: string;

    // Or create a new session using Auth0
    auth0?: {
        domain: string;
        clientId: string;
        clientSecret?: string;
        audience: string;
        scope?: string;
    };

    // Session configuration (if creating new session)
    sessionConfig?: Omit<DiagnosticSessionConfig, 'metadata'>;

    // Additional options
    timeoutMs?: number;
    userAgent?: string;
}

/**
 * Create HTTP MCP client for diagnostic operations
 *
 * This function handles the authentication flow:
 * 1. If diagnosticSessionKey is provided, use it directly
 * 2. If auth0 config is provided, create a new diagnostic session
 * 3. Return configured HttpMcpClient ready for diagnostic operations
 */
export async function createDiagnosticMcpClient(
    options: DiagnosticMcpClientOptions
): Promise<HttpMcpClient> {
    const headers: Record<string, string> = {};

    // Method 1: Use existing diagnostic session key
    if (options.diagnosticSessionKey) {
        headers['X-Diagnostic-Session-Key'] = options.diagnosticSessionKey;
    }
    // Method 2: Create new diagnostic session using Auth0
    else if (options.auth0) {
        const sessionConfig: Omit<DiagnosticSessionConfig, 'metadata'> = options.sessionConfig || {
            requestedBy: 'cortexdx',
            scope: ['read:tools', 'read:resources'],
            duration: 3600
        };
        const session = await createDiagnosticSession(
            options.targetServerUrl,
            options.auth0,
            sessionConfig
        );
        headers['X-Diagnostic-Session-Key'] = session.apiKey;
    } else {
        throw new Error('Either diagnosticSessionKey or auth0 config must be provided');
    }

    return new HttpMcpClient({
        baseUrl: options.targetServerUrl,
        headers,
        timeoutMs: options.timeoutMs,
        userAgent: options.userAgent
    });
}
/**
/**
 * Create a diagnostic session on the target MCP server
 *
 * Workflow:
 * 1. Get Auth0 access token using client credentials
 * 2. Call target server's /api/v1/diagnostic-session/create endpoint
 */
async function createDiagnosticSession(
    targetServerUrl: string,
    auth0Config: {
        domain: string;
        clientId: string;
        clientSecret?: string;
        audience: string;
        scope?: string;
    },
    sessionConfig: Omit<DiagnosticSessionConfig, 'metadata'>
): Promise<{
    sessionId: string;
    apiKey: string;
    expiresAt: string;
}> {
    // Get Auth0 access token
    const auth0Headers = await resolveAuthHeaders({
        auth0Domain: auth0Config.domain,
        auth0ClientId: auth0Config.clientId,
        auth0ClientSecret: auth0Config.clientSecret,
        auth0Audience: auth0Config.audience,
        auth0Scope: auth0Config.scope
    });

    if (!auth0Headers || !auth0Headers.authorization) {
        throw new Error('Failed to obtain Auth0 access token');
    }

    // Request diagnostic session from target server
    const response = await fetch(`${targetServerUrl}/api/v1/diagnostic-session/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...auth0Headers
        },
        body: JSON.stringify(sessionConfig)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(
            `Failed to create diagnostic session: ${response.status} ${response.statusText} - ${error}`
        );
    }

    const result = await response.json() as {
        success: boolean;
        session?: {
            sessionId: string;
            apiKey: string;
            expiresAt: string;
        };
        error?: string;
    };

    if (!result.success || !result.session) {
        throw new Error(`Failed to create diagnostic session: ${result.error || 'Unknown error'}`);
    }

    return result.session;
}

/**
 * Revoke a diagnostic session on the target MCP server
 */
export async function revokeDiagnosticSession(
    targetServerUrl: string,
    sessionId: string,
    sessionKey: string
): Promise<boolean> {
    const response = await fetch(
        `${targetServerUrl}/api/v1/diagnostic-session/${sessionId}/revoke`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Diagnostic-Session-Key': sessionKey
            }
        }
    );

    if (!response.ok) {
        return false;
    }

    const result = await response.json() as { success: boolean };
    return result.success;
}

