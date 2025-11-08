/**
 * OAuth2/Auth0 Authenticator for secured MCP servers
 * Implements device code flow and client credentials flow
 * Requirements: 14.1, 14.2, 14.3
 */

import { httpAdapter } from "./http.js";

// OAuth2 Configuration
export interface OAuth2Config {
    authType: "oauth2" | "bearer" | "api-key";
    authorizationEndpoint?: string;
    tokenEndpoint: string;
    clientId: string;
    clientSecret?: string;
    scope?: string[];
    audience?: string;
    deviceCodeEndpoint?: string;
}

// Device Code Flow Types
export interface DeviceCodeResult {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete?: string;
    expiresIn: number;
    interval: number;
}

export interface TokenResult {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    tokenType: string;
    scope?: string[];
}

export interface OAuth2Session {
    sessionId: string;
    serverEndpoint: string;
    config: OAuth2Config;
    status: "pending" | "authenticated" | "failed";
    createdAt: Date;
    expiresAt?: Date;
}

export interface TokenValidation {
    valid: boolean;
    expiresAt?: Date;
    scope?: string[];
    error?: string;
}

/**
 * OAuth2 Authenticator
 * Handles OAuth2 flows for secured MCP server diagnostics
 */
export class OAuthAuthenticator {
    private sessions: Map<string, OAuth2Session> = new Map();
    private startTime: number = Date.now();

    /**
     * Initiate OAuth2 flow when authentication is required
     * Response time: <2s (Req 14.1)
     */
    async initiateOAuth2Flow(
        serverEndpoint: string,
        config: OAuth2Config,
    ): Promise<OAuth2Session> {
        const sessionId = this.generateSessionId();
        const session: OAuth2Session = {
            sessionId,
            serverEndpoint,
            config,
            status: "pending",
            createdAt: new Date(),
        };

        this.sessions.set(sessionId, session);

        // Validate response time
        const elapsed = Date.now() - this.startTime;
        if (elapsed > 2000) {
            throw new Error(
                `OAuth2 flow initiation exceeded 2s threshold: ${elapsed}ms`,
            );
        }

        return session;
    }

    /**
     * Device code flow for CLI-based authentication (no browser redirect)
     * Requirements: 14.2
     */
    async deviceCodeFlow(
        clientId: string,
        scope: string[],
        deviceCodeEndpoint: string,
    ): Promise<DeviceCodeResult> {
        const startTime = Date.now();

        try {
            const response = await httpAdapter<{
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
                }).toString(),
            });

            const elapsed = Date.now() - startTime;
            if (elapsed > 2000) {
                throw new Error(
                    `Device code flow exceeded 2s threshold: ${elapsed}ms`,
                );
            }

            return {
                deviceCode: response.device_code,
                userCode: response.user_code,
                verificationUri: response.verification_uri,
                verificationUriComplete: response.verification_uri_complete,
                expiresIn: response.expires_in,
                interval: response.interval,
            };
        } catch (error) {
            throw new Error(
                `Device code flow failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Poll device code for token
     * Requirements: 14.2
     */
    async pollDeviceCode(
        deviceCode: string,
        tokenEndpoint: string,
        clientId: string,
        interval: number,
    ): Promise<TokenResult> {
        const maxAttempts = 60; // 5 minutes with 5s intervals
        let attempts = 0;
        let currentInterval = interval;

        while (attempts < maxAttempts) {
            await this.sleep(currentInterval * 1000);
            attempts++;

            try {
                const response = await httpAdapter<{
                    access_token: string;
                    refresh_token?: string;
                    expires_in: number;
                    token_type: string;
                    scope?: string;
                    error?: string;
                }>(tokenEndpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                        device_code: deviceCode,
                        client_id: clientId,
                    }).toString(),
                });

                if (response.error) {
                    if (response.error === "authorization_pending") {
                        continue; // Keep polling
                    }
                    if (response.error === "slow_down") {
                        currentInterval += 5; // Increase interval without mutating parameter
                        continue;
                    }
                    throw new Error(`Device code polling failed: ${response.error}`);
                }

                return {
                    accessToken: response.access_token,
                    refreshToken: response.refresh_token,
                    expiresIn: response.expires_in,
                    tokenType: response.token_type,
                    scope: response.scope ? response.scope.split(" ") : undefined,
                };
            } catch (error) {
                if (attempts >= maxAttempts) {
                    throw new Error(
                        `Device code polling timeout after ${maxAttempts} attempts`,
                    );
                }
                // Continue polling on network errors
            }
        }

        throw new Error("Device code polling timeout");
    }

    /**
     * Client credentials flow for automated scenarios
     * Requirements: 14.3
     */
    async clientCredentialsFlow(
        clientId: string,
        clientSecret: string,
        tokenEndpoint: string,
        scope: string[],
        audience?: string,
    ): Promise<TokenResult> {
        const startTime = Date.now();

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

            const response = await httpAdapter<{
                access_token: string;
                expires_in: number;
                token_type: string;
                scope?: string;
            }>(tokenEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams(body).toString(),
            });

            const elapsed = Date.now() - startTime;
            if (elapsed > 2000) {
                throw new Error(
                    `Client credentials flow exceeded 2s threshold: ${elapsed}ms`,
                );
            }

            return {
                accessToken: response.access_token,
                expiresIn: response.expires_in,
                tokenType: response.token_type,
                scope: response.scope ? response.scope.split(" ") : undefined,
            };
        } catch (error) {
            throw new Error(
                `Client credentials flow failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Refresh access token using refresh token
     * Requirements: 14.4
     */
    async refreshToken(
        refreshToken: string,
        tokenEndpoint: string,
        clientId: string,
        clientSecret?: string,
    ): Promise<TokenResult> {
        try {
            const body: Record<string, string> = {
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: clientId,
            };

            if (clientSecret) {
                body.client_secret = clientSecret;
            }

            const response = await httpAdapter<{
                access_token: string;
                refresh_token?: string;
                expires_in: number;
                token_type: string;
                scope?: string;
            }>(tokenEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams(body).toString(),
            });

            return {
                accessToken: response.access_token,
                refreshToken: response.refresh_token,
                expiresIn: response.expires_in,
                tokenType: response.token_type,
                scope: response.scope ? response.scope.split(" ") : undefined,
            };
        } catch (error) {
            throw new Error(
                `Token refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Validate access token
     * Requirements: 14.1
     */
    async validateToken(
        accessToken: string,
        introspectionEndpoint?: string,
    ): Promise<TokenValidation> {
        if (!introspectionEndpoint) {
            // Basic validation - check if token is not empty and has valid format
            if (!accessToken || accessToken.trim().length === 0) {
                return { valid: false, error: "Empty token" };
            }

            // JWT format check (3 parts separated by dots)
            const parts = accessToken.split(".");
            if (parts.length !== 3) {
                return { valid: false, error: "Invalid token format" };
            }

            try {
                // Decode JWT payload
                const payloadPart = parts[1];
                if (!payloadPart) {
                    return { valid: false, error: "Invalid token payload" };
                }

                const payload = JSON.parse(
                    Buffer.from(payloadPart, "base64").toString("utf-8"),
                );

                // Check expiration
                const now = Math.floor(Date.now() / 1000);
                if (payload.exp && payload.exp < now) {
                    return { valid: false, error: "Token expired" };
                }

                return {
                    valid: true,
                    expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
                    scope: payload.scope ? payload.scope.split(" ") : undefined,
                };
            } catch (error) {
                return {
                    valid: false,
                    error: `Token validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        }

        // Use introspection endpoint if provided
        try {
            const response = await httpAdapter<{
                active: boolean;
                exp?: number;
                scope?: string;
            }>(introspectionEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    token: accessToken,
                }).toString(),
            });

            return {
                valid: response.active,
                expiresAt: response.exp ? new Date(response.exp * 1000) : undefined,
                scope: response.scope ? response.scope.split(" ") : undefined,
            };
        } catch (error) {
            return {
                valid: false,
                error: `Token introspection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
        }
    }

    /**
     * Detect authentication requirements from HTTP response
     * Requirements: 14.1
     */
    detectAuthRequirement(
        statusCode: number,
        headers: Record<string, string>,
    ): {
        required: boolean;
        authType?: "oauth2" | "bearer" | "api-key";
        realm?: string;
        scope?: string[];
    } {
        // Check for 401 Unauthorized or 403 Forbidden
        if (statusCode !== 401 && statusCode !== 403) {
            return { required: false };
        }

        const wwwAuthenticate = headers["www-authenticate"] || headers["WWW-Authenticate"];

        if (!wwwAuthenticate) {
            return { required: true, authType: "bearer" };
        }

        // Parse WWW-Authenticate header
        const authTypeLower = wwwAuthenticate.toLowerCase();

        if (authTypeLower.includes("bearer")) {
            const realmMatch = wwwAuthenticate.match(/realm="([^"]+)"/);
            const scopeMatch = wwwAuthenticate.match(/scope="([^"]+)"/);

            return {
                required: true,
                authType: "oauth2",
                realm: realmMatch ? realmMatch[1] : undefined,
                scope: scopeMatch ? scopeMatch[1]?.split(" ") : undefined,
            };
        }

        if (authTypeLower.includes("basic")) {
            return { required: true, authType: "api-key" };
        }

        return { required: true, authType: "bearer" };
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): OAuth2Session | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Update session status
     */
    updateSessionStatus(
        sessionId: string,
        status: "pending" | "authenticated" | "failed",
        expiresAt?: Date,
    ): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = status;
            if (expiresAt) {
                session.expiresAt = expiresAt;
            }
            this.sessions.set(sessionId, session);
        }
    }

    /**
     * Clear session
     */
    clearSession(sessionId: string): void {
        this.sessions.delete(sessionId);
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `oauth-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * Sleep utility for polling
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const oauthAuthenticator = new OAuthAuthenticator();
