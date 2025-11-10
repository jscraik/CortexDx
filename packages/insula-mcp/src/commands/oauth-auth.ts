/**
 * OAuth Authentication CLI Command
 * Provides CLI interface for authenticating with secured MCP servers
 * Requirements: 14.1, 14.2, 14.3
 */

import type { OAuth2Config } from "../adapters/oauth-authenticator.js";
import { oauthIntegration } from "../adapters/oauth-integration.js";

export interface OAuthAuthOptions {
    endpoint: string;
    clientId: string;
    clientSecret?: string;
    tokenEndpoint: string;
    deviceCodeEndpoint?: string;
    scope?: string[];
    audience?: string;
    flowType?: "device-code" | "client-credentials" | "auto";
}

/**
 * Authenticate with an MCP server using OAuth2
 */
export async function authenticateWithOAuth(
    options: OAuthAuthOptions,
    logger: (...args: unknown[]) => void = console.log,
): Promise<void> {
    logger(`[OAuth] Authenticating with ${options.endpoint}...`);

    // Determine flow type
    let flowType: "device-code" | "client-credentials" = "device-code";

    if (options.flowType === "auto") {
        // Auto-detect based on available credentials
        flowType = options.clientSecret ? "client-credentials" : "device-code";
    } else if (options.flowType) {
        flowType = options.flowType;
    }

    logger(`[OAuth] Using ${flowType} flow`);

    // Build OAuth config
    const config: OAuth2Config = {
        authType: "oauth2",
        tokenEndpoint: options.tokenEndpoint,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        scope: options.scope,
        audience: options.audience,
        deviceCodeEndpoint: options.deviceCodeEndpoint,
    };

    try {
        if (flowType === "device-code") {
            // Device code flow with user interaction
            await oauthIntegration.authenticateServer(
                options.endpoint,
                config,
                "device-code",
                (userCode, verificationUri) => {
                    logger(`\n${"=".repeat(60)}`);
                    logger("  AUTHENTICATION REQUIRED");
                    logger("=".repeat(60));
                    logger("");
                    logger(`  Please visit: ${verificationUri}`);
                    logger("");
                    logger(`  And enter code: ${userCode}`);
                    logger("");
                    logger("=".repeat(60));
                    logger("\nWaiting for authentication...");
                },
            );

            logger("\n✓ Authentication successful!");
            logger(`Credentials stored for ${options.endpoint}`);
        } else {
            // Client credentials flow (automated)
            await oauthIntegration.authenticateServer(
                options.endpoint,
                config,
                "client-credentials",
            );

            logger("✓ Authentication successful!");
            logger(`Credentials stored for ${options.endpoint}`);
        }
    } catch (error) {
        logger("\n✗ Authentication failed:");
        logger(error instanceof Error ? error.message : String(error));
        throw error;
    }
}

/**
 * Check authentication status for an endpoint
 */
export async function checkAuthStatus(
    endpoint: string,
    logger: (...args: unknown[]) => void = console.log,
): Promise<boolean> {
    const hasCredentials = await oauthIntegration.hasStoredCredentials(endpoint);

    if (hasCredentials) {
        logger(`✓ Authenticated with ${endpoint}`);
        return true;
    }

    logger(`✗ Not authenticated with ${endpoint}`);
    return false;
}

/**
 * Clear stored credentials for an endpoint
 */
export async function clearAuthCredentials(
    endpoint: string,
    logger: (...args: unknown[]) => void = console.log,
): Promise<void> {
    await oauthIntegration.clearCredentials(endpoint);
    logger(`✓ Cleared credentials for ${endpoint}`);
}

/**
 * Detect authentication requirements for an endpoint
 */
export async function detectAuthRequirements(
    endpoint: string,
    logger: (...args: unknown[]) => void = console.log,
): Promise<void> {
    logger(`[OAuth] Detecting authentication requirements for ${endpoint}...`);

    const detection = await oauthIntegration.detectAuthRequirement(endpoint);

    if (!detection.required) {
        logger("✓ No authentication required");
        return;
    }

    logger(`\n${"=".repeat(60)}`);
    logger("  AUTHENTICATION REQUIRED");
    logger("=".repeat(60));
    logger("");
    logger(`  Auth Type: ${detection.authType || "unknown"}`);

    if (detection.realm) {
        logger(`  Realm: ${detection.realm}`);
    }

    if (detection.scope && detection.scope.length > 0) {
        logger(`  Scopes: ${detection.scope.join(", ")}`);
    }

    if (detection.tokenEndpoint) {
        logger(`  Token Endpoint: ${detection.tokenEndpoint}`);
    }

    if (detection.authorizationEndpoint) {
        logger(`  Authorization Endpoint: ${detection.authorizationEndpoint}`);
    }

    logger("");
    logger("=".repeat(60));
    logger("");
    logger("To authenticate, run:");
    logger(`  cortexdx auth --endpoint ${endpoint} --client-id <CLIENT_ID> --token-endpoint <TOKEN_ENDPOINT>`);
    logger("");
}
