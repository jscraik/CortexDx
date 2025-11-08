/**
 * OAuth Integration for MCP Inspector and Diagnostic Tools
 * Provides seamless authentication flow for secured MCP servers
 * Requirements: 14.1, 14.5
 */

import { credentialManager, type Credentials } from "./credential-manager.js";
import { httpAdapter } from "./http.js";
import { oauthAuthenticator, type OAuth2Config, type TokenResult } from "./oauth-authenticator.js";

export interface AuthDetectionResult {
    required: boolean;
    authType?: "oauth2" | "bearer" | "api-key";
    realm?: string;
    scope?: string[];
    tokenEndpoint?: string;
    authorizationEndpoint?: string;
}

export interface AuthenticatedRequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
}

/**
 * OAuth Integration Helper
 * Handles automatic authentication detection and token management
 */
export class OAuthIntegration {
    /**
     * Detect authentication requirements from HTTP response
     * Requirements: 14.1
     */
    async detectAuthRequirement(
        endpoint: string,
        headers?: Record<string, string>,
    ): Promise<AuthDetectionResult> {
        try {
            // Make a test request to detect auth requirements
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...headers,
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "initialize",
                    params: {
                        protocolVersion: "2024-11-05",
                        capabilities: {},
                        clientInfo: {
                            name: "insula-mcp",
                            version: "1.0.0",
                        },
                    },
                }),
            });

            // Check for authentication requirements
            if (response.status === 401 || response.status === 403) {
                const wwwAuthenticate = response.headers.get("www-authenticate");
                const detection = oauthAuthenticator.detectAuthRequirement(
                    response.status,
                    { "www-authenticate": wwwAuthenticate || "" },
                );

                // Try to extract OAuth endpoints from response headers or well-known locations
                const authEndpoints = await this.discoverOAuthEndpoints(endpoint);

                return {
                    ...detection,
                    ...authEndpoints,
                };
            }

            return { required: false };
        } catch (error) {
            // If request fails, assume no auth required (or network issue)
            return { required: false };
        }
    }

    /**
     * Discover OAuth endpoints from well-known locations
     */
    private async discoverOAuthEndpoints(
        endpoint: string,
    ): Promise<Partial<AuthDetectionResult>> {
        try {
            // Try to discover OAuth configuration from .well-known/oauth-authorization-server
            const baseUrl = new URL(endpoint).origin;
            const wellKnownUrl = `${baseUrl}/.well-known/oauth-authorization-server`;

            const config = await httpAdapter<{
                token_endpoint?: string;
                authorization_endpoint?: string;
                device_authorization_endpoint?: string;
            }>(wellKnownUrl);

            return {
                tokenEndpoint: config.token_endpoint,
                authorizationEndpoint: config.authorization_endpoint,
            };
        } catch {
            // If discovery fails, return empty
            return {};
        }
    }

    /**
     * Perform device code flow with CLI prompts
     * Requirements: 14.2
     */
    async performDeviceCodeFlow(
        config: OAuth2Config,
        onUserCodeReceived: (userCode: string, verificationUri: string) => void,
    ): Promise<TokenResult> {
        if (!config.deviceCodeEndpoint) {
            throw new Error("Device code endpoint not configured");
        }

        // Initiate device code flow
        const deviceCodeResult = await oauthAuthenticator.deviceCodeFlow(
            config.clientId,
            config.scope || [],
            config.deviceCodeEndpoint,
        );

        // Notify caller with user code and verification URI
        onUserCodeReceived(
            deviceCodeResult.userCode,
            deviceCodeResult.verificationUriComplete || deviceCodeResult.verificationUri,
        );

        // Poll for token
        const tokenResult = await oauthAuthenticator.pollDeviceCode(
            deviceCodeResult.deviceCode,
            config.tokenEndpoint,
            config.clientId,
            deviceCodeResult.interval,
        );

        return tokenResult;
    }

    /**
     * Perform client credentials flow for automated scenarios
     * Requirements: 14.3
     */
    async performClientCredentialsFlow(
        config: OAuth2Config,
    ): Promise<TokenResult> {
        if (!config.clientSecret) {
            throw new Error("Client secret required for client credentials flow");
        }

        const tokenResult = await oauthAuthenticator.clientCredentialsFlow(
            config.clientId,
            config.clientSecret,
            config.tokenEndpoint,
            config.scope || [],
            config.audience,
        );

        return tokenResult;
    }

    /**
     * Authenticate with MCP server and store credentials
     * Requirements: 14.1, 14.4, 14.5
     */
    async authenticateServer(
        serverEndpoint: string,
        config: OAuth2Config,
        flowType: "device-code" | "client-credentials",
        onUserCodeReceived?: (userCode: string, verificationUri: string) => void,
    ): Promise<Credentials> {
        let tokenResult: TokenResult;

        if (flowType === "device-code") {
            if (!onUserCodeReceived) {
                throw new Error("User code callback required for device code flow");
            }
            tokenResult = await this.performDeviceCodeFlow(config, onUserCodeReceived);
        } else {
            tokenResult = await this.performClientCredentialsFlow(config);
        }

        // Store credentials
        const credentials: Credentials = {
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
            expiresAt: new Date(Date.now() + tokenResult.expiresIn * 1000),
            tokenType: tokenResult.tokenType,
            scope: tokenResult.scope,
            serverEndpoint,
            clientId: config.clientId,
            tokenEndpoint: config.tokenEndpoint,
        };

        await credentialManager.storeCredentials(serverEndpoint, credentials);

        return credentials;
    }

    /**
     * Make authenticated request to MCP server
     * Requirements: 14.5
     */
    async makeAuthenticatedRequest<T>(
        endpoint: string,
        options: AuthenticatedRequestOptions = {},
    ): Promise<T> {
        // Try to get valid token
        let accessToken: string | null = null;

        try {
            accessToken = await credentialManager.getValidToken(
                endpoint,
                async (refreshToken, tokenEndpoint, clientId) => {
                    return await oauthAuthenticator.refreshToken(
                        refreshToken,
                        tokenEndpoint,
                        clientId,
                    );
                },
            );
        } catch (error) {
            // No credentials or refresh failed
            // Check if authentication is required
            const authDetection = await this.detectAuthRequirement(endpoint);

            if (authDetection.required) {
                throw new Error(
                    `Authentication required for ${endpoint}. Please authenticate first using the CLI.`,
                );
            }
        }

        // Make request with or without authentication
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...options.headers,
        };

        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }

        return await httpAdapter<T>(endpoint, {
            method: options.method || "POST",
            headers,
            body: options.body,
        });
    }

    /**
     * Check if server has stored credentials
     */
    async hasStoredCredentials(serverEndpoint: string): Promise<boolean> {
        const credentials = await credentialManager.retrieveCredentials(serverEndpoint);
        return credentials !== null;
    }

    /**
     * Clear stored credentials for server
     */
    async clearCredentials(serverEndpoint: string): Promise<void> {
        await credentialManager.deleteCredentials(serverEndpoint);
    }

    /**
     * Get authentication headers for server
     */
    async getAuthHeaders(serverEndpoint: string): Promise<Record<string, string>> {
        try {
            const accessToken = await credentialManager.getValidToken(
                serverEndpoint,
                async (refreshToken, tokenEndpoint, clientId) => {
                    return await oauthAuthenticator.refreshToken(
                        refreshToken,
                        tokenEndpoint,
                        clientId,
                    );
                },
            );

            return {
                Authorization: `Bearer ${accessToken}`,
            };
        } catch {
            return {};
        }
    }
}

// Export singleton instance
export const oauthIntegration = new OAuthIntegration();

/**
 * Helper function to create authenticated diagnostic context
 * Requirements: 14.5
 */
export async function createAuthenticatedContext(
    endpoint: string,
    baseHeaders?: Record<string, string>,
): Promise<{ headers: Record<string, string>; authenticated: boolean }> {
    const authHeaders = await oauthIntegration.getAuthHeaders(endpoint);

    return {
        headers: {
            ...baseHeaders,
            ...authHeaders,
        },
        authenticated: Object.keys(authHeaders).length > 0,
    };
}
