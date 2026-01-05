/**
 * OAuth Authentication CLI Command
 * Provides CLI interface for authenticating with secured MCP servers
 * Requirements: 14.1, 14.2, 14.3
 */

import type { OAuth2Config } from "../adapters/oauth-authenticator.js";
import { oauthIntegration } from "../adapters/oauth-integration.js";
import { createCliLogger } from "../logging/logger.js";

const defaultLogger = createCliLogger("oauth-auth");

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
  logger = defaultLogger,
): Promise<void> {
  logger.info(`Authenticating with ${options.endpoint}...`, {
    endpoint: options.endpoint,
  });

  // Determine flow type
  let flowType: "device-code" | "client-credentials" = "device-code";

  if (options.flowType === "auto") {
    // Auto-detect based on available credentials
    flowType = options.clientSecret ? "client-credentials" : "device-code";
  } else if (options.flowType) {
    flowType = options.flowType;
  }

  logger.info(`Using ${flowType} flow`, { flowType });

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
          logger.info(`\n${"=".repeat(60)}`);
          logger.info("  AUTHENTICATION REQUIRED");
          logger.info("=".repeat(60));
          logger.info("");
          logger.info(`  Please visit: ${verificationUri}`, {
            verificationUri,
          });
          logger.info("");
          logger.info(`  And enter code: ${userCode}`, { userCode });
          logger.info("");
          logger.info("=".repeat(60));
          logger.info("\nWaiting for authentication...");
        },
      );

      logger.info("\n✓ Authentication successful!");
      logger.info(`Credentials stored for ${options.endpoint}`, {
        endpoint: options.endpoint,
      });
    } else {
      // Client credentials flow (automated)
      await oauthIntegration.authenticateServer(
        options.endpoint,
        config,
        "client-credentials",
      );

      logger.info("✓ Authentication successful!");
      logger.info(`Credentials stored for ${options.endpoint}`, {
        endpoint: options.endpoint,
      });
    }
  } catch (error) {
    logger.error("\n✗ Authentication failed:");
    logger.error(error instanceof Error ? error.message : String(error), {
      error,
    });
    throw error;
  }
}

/**
 * Check authentication status for an endpoint
 */
export async function checkAuthStatus(
  endpoint: string,
  logger = defaultLogger,
): Promise<boolean> {
  const hasCredentials = await oauthIntegration.hasStoredCredentials(endpoint);

  if (hasCredentials) {
    logger.info(`✓ Authenticated with ${endpoint}`, {
      endpoint,
      authenticated: true,
    });
    return true;
  }

  logger.warn(`✗ Not authenticated with ${endpoint}`, {
    endpoint,
    authenticated: false,
  });
  return false;
}

/**
 * Clear stored credentials for an endpoint
 */
export async function clearAuthCredentials(
  endpoint: string,
  logger = defaultLogger,
): Promise<void> {
  await oauthIntegration.clearCredentials(endpoint);
  logger.info(`✓ Cleared credentials for ${endpoint}`, { endpoint });
}

/**
 * Detect authentication requirements for an endpoint
 */
export async function detectAuthRequirements(
  endpoint: string,
  logger = defaultLogger,
): Promise<void> {
  logger.info(`Detecting authentication requirements for ${endpoint}...`, {
    endpoint,
  });

  const detection = await oauthIntegration.detectAuthRequirement(endpoint);

  if (!detection.required) {
    logger.info("✓ No authentication required", { endpoint, required: false });
    return;
  }

  logger.info(`\n${"=".repeat(60)}`);
  logger.info("  AUTHENTICATION REQUIRED");
  logger.info("=".repeat(60));
  logger.info("");
  logger.info(`  Auth Type: ${detection.authType || "unknown"}`, {
    authType: detection.authType,
  });

  if (detection.realm) {
    logger.info(`  Realm: ${detection.realm}`, { realm: detection.realm });
  }

  if (detection.scope && detection.scope.length > 0) {
    logger.info(`  Scopes: ${detection.scope.join(", ")}`, {
      scope: detection.scope,
    });
  }

  if (detection.tokenEndpoint) {
    logger.info(`  Token Endpoint: ${detection.tokenEndpoint}`, {
      tokenEndpoint: detection.tokenEndpoint,
    });
  }

  if (detection.authorizationEndpoint) {
    logger.info(
      `  Authorization Endpoint: ${detection.authorizationEndpoint}`,
      { authorizationEndpoint: detection.authorizationEndpoint },
    );
  }

  logger.info("");
  logger.info("=".repeat(60));
  logger.info("");
  logger.info("To authenticate, run:");
  logger.info(
    `  cortexdx auth --endpoint ${endpoint} --client-id <CLIENT_ID> --token-endpoint <TOKEN_ENDPOINT>`,
  );
  logger.info("");
}
