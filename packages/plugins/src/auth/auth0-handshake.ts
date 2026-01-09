import { URL } from "node:url";
import { oauthAuthenticator } from "../adapters/oauth-authenticator.js";
import { enhancedOAuthAuthenticator } from "./enhanced-oauth-authenticator.js";
import {
  maskSensitiveValue,
  validateEndpointSecurity,
  validateAudience,
} from "./oauth-security-audit.js";

interface Auth0MachineConfig {
  domain: string;
  clientId: string;
  clientSecret?: string;
  audience: string;
  scope?: string;
  deviceCodeEndpoint?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

/**
 * Build Authorization headers either from explicit --auth flags or by performing an Auth0 handshake.
 * Also includes MCP API key if provided.
 */
export async function resolveAuthHeaders(opts: {
  auth?: string;
  auth0Domain?: string;
  auth0ClientId?: string;
  auth0ClientSecret?: string;
  auth0Audience?: string;
  auth0Scope?: string;
  mcpApiKey?: string;
  auth0DeviceCode?: boolean;
  auth0DeviceCodeEndpoint?: string;
  onDeviceCodePrompt?: (userCode: string, verifyUri: string) => void;
}): Promise<Record<string, string> | undefined> {
  if (typeof opts.auth === "string" && opts.auth.trim().length > 0) {
    return parseManualAuth(opts.auth, opts.mcpApiKey);
  }

  const config = resolveAuth0Config(opts);
  const headers: Record<string, string> = {};

  if (config) {
    const hasSecret = Boolean(config.clientSecret);
    const useDeviceCode = shouldUseDeviceCode(opts.auth0DeviceCode, hasSecret);

    const token = useDeviceCode
      ? await getAuth0DeviceCodeToken(config, opts.onDeviceCodePrompt)
      : await getAuth0AccessToken(
          config as Auth0MachineConfig & { clientSecret: string },
        );
    headers.authorization = `Bearer ${token}`;
  }

  // Check CLI option first, then environment variable
  const mcpApiKey = opts.mcpApiKey || process.env.CORTEXDX_MCP_API_KEY;
  if (mcpApiKey) {
    headers["mcp-api-key"] = mcpApiKey;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function parseManualAuth(
  value: string,
  mcpApiKey?: string,
): Record<string, string> | undefined {
  const [schemeRaw, ...restParts] = value.split(":");
  if (!schemeRaw || restParts.length === 0) return undefined;
  const scheme = schemeRaw.toLowerCase();

  const headers: Record<string, string> = {};

  if (scheme === "bearer") {
    headers.authorization = `Bearer ${restParts.join(":").trim()}`;
  } else if (scheme === "basic") {
    const [user, ...passwordParts] = restParts;
    if (!user || passwordParts.length === 0) return undefined;
    const credentials = Buffer.from(
      `${user}:${passwordParts.join(":")}`,
    ).toString("base64");
    headers.authorization = `Basic ${credentials}`;
  } else if (scheme === "header") {
    const [name, ...valueParts] = restParts;
    if (!name || valueParts.length === 0) return undefined;
    headers[name] = valueParts.join(":");
  } else {
    headers.authorization = `${schemeRaw} ${restParts.join(":")}`;
  }

  // Check CLI option first, then environment variable
  const finalMcpApiKey = mcpApiKey || process.env.CORTEXDX_MCP_API_KEY;
  if (finalMcpApiKey) {
    headers["mcp-api-key"] = finalMcpApiKey;
  }

  return headers;
}

function resolveAuth0Config(opts: {
  auth0Domain?: string;
  auth0ClientId?: string;
  auth0ClientSecret?: string;
  auth0Audience?: string;
  auth0Scope?: string;
  auth0DeviceCodeEndpoint?: string;
}): Auth0MachineConfig | null {
  const domain = pickFirstDefined(
    opts.auth0Domain,
    process.env.CORTEXDX_AUTH0_DOMAIN,
  );
  const clientId = pickFirstDefined(
    opts.auth0ClientId,
    process.env.CORTEXDX_AUTH0_CLIENT_ID,
  );
  const clientSecret = pickFirstDefined(
    opts.auth0ClientSecret,
    process.env.CORTEXDX_AUTH0_CLIENT_SECRET,
  );
  const audience = pickFirstDefined(
    opts.auth0Audience,
    process.env.CORTEXDX_AUTH0_AUDIENCE,
  );
  const scope = pickFirstDefined(
    opts.auth0Scope,
    process.env.CORTEXDX_AUTH0_SCOPE,
  );

  if (!domain || !clientId || !audience) {
    return null;
  }

  return {
    domain: domain.trim(),
    clientId: clientId.trim(),
    clientSecret: clientSecret?.trim(),
    audience: audience.trim(),
    scope: scope?.trim(),
    deviceCodeEndpoint: pickFirstDefined(
      opts.auth0DeviceCodeEndpoint,
      process.env.CORTEXDX_AUTH0_DEVICE_CODE_ENDPOINT,
    )?.trim(),
  };
}

function shouldUseDeviceCode(
  preference: boolean | undefined,
  hasSecret: boolean,
): boolean {
  if (typeof preference === "boolean") return preference;
  if (process.env.CORTEXDX_AUTH0_DEVICE_CODE === "1") return true;
  return !hasSecret;
}

function pickFirstDefined<T>(...values: Array<T | undefined>): T | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
    if (value) return value;
  }
  return undefined;
}

async function getAuth0AccessToken(
  config: Auth0MachineConfig & { clientSecret: string },
): Promise<string> {
  const cacheKey = `${config.domain}|${config.clientId}|${config.audience}|${config.scope ?? ""}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  // Validate endpoint security
  const tokenUrl = buildTokenUrl(config.domain);
  const endpointValidation = validateEndpointSecurity(tokenUrl);
  if (!endpointValidation.valid) {
    throw new Error(
      `Token endpoint security validation failed: ${endpointValidation.errors.join(", ")}`,
    );
  }

  const scopeArray =
    config.scope?.split(/\s+/).filter((entry) => entry.length > 0) ?? [];

  // Use enhanced client credentials flow with audience validation
  const tokenResult =
    await enhancedOAuthAuthenticator.clientCredentialsFlowEnhanced(
      config.clientId,
      config.clientSecret,
      tokenUrl,
      scopeArray,
      config.audience,
    );

  // Validate token audience
  if (config.audience && tokenResult.audience) {
    const audienceCheck = validateAudience(
      tokenResult.audience,
      config.audience,
    );
    if (!audienceCheck.valid) {
      throw new Error(audienceCheck.error || "Audience validation failed");
    }
  }

  const expiresInMs = Math.max(30, (tokenResult.expiresIn ?? 60) - 30) * 1000;
  const expiresAt = Date.now() + expiresInMs;
  tokenCache.set(cacheKey, { token: tokenResult.accessToken, expiresAt });
  return tokenResult.accessToken;
}

async function getAuth0DeviceCodeToken(
  config: Auth0MachineConfig,
  onPrompt?: (userCode: string, verificationUri: string) => void,
): Promise<string> {
  const cacheKey = `device|${config.domain}|${config.clientId}|${config.audience}|${config.scope ?? ""}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  // Validate endpoint security
  const deviceEndpoint =
    config.deviceCodeEndpoint ?? buildDeviceCodeUrl(config.domain);
  const tokenEndpoint = buildTokenUrl(config.domain);

  const deviceValidation = validateEndpointSecurity(deviceEndpoint);
  if (!deviceValidation.valid) {
    throw new Error(
      `Device code endpoint security validation failed: ${deviceValidation.errors.join(", ")}`,
    );
  }

  const tokenValidation = validateEndpointSecurity(tokenEndpoint);
  if (!tokenValidation.valid) {
    throw new Error(
      `Token endpoint security validation failed: ${tokenValidation.errors.join(", ")}`,
    );
  }

  const scopeArray =
    config.scope?.split(/\s+/).filter((entry) => entry.length > 0) ?? [];

  // Use enhanced OAuth authenticator with PKCE
  const deviceCodeResult =
    await enhancedOAuthAuthenticator.deviceCodeFlowWithPKCE(
      config.clientId,
      scopeArray,
      deviceEndpoint,
      config.audience,
    );

  const prompt = onPrompt ?? defaultDeviceCodePrompt;
  prompt(
    deviceCodeResult.userCode,
    deviceCodeResult.verificationUriComplete ??
      deviceCodeResult.verificationUri,
  );

  // Poll with PKCE verifier and audience validation
  const tokenResult = await enhancedOAuthAuthenticator.pollDeviceCodeWithPKCE(
    deviceCodeResult.deviceCode,
    deviceCodeResult.codeVerifier,
    tokenEndpoint,
    config.clientId,
    deviceCodeResult.interval,
    config.audience,
  );

  // Validate token audience
  if (config.audience && tokenResult.audience) {
    const audienceCheck = validateAudience(
      tokenResult.audience,
      config.audience,
    );
    if (!audienceCheck.valid) {
      throw new Error(audienceCheck.error || "Audience validation failed");
    }
  }

  const expiresAt =
    Date.now() + Math.max(30, (tokenResult.expiresIn ?? 60) - 30) * 1000;
  tokenCache.set(cacheKey, { token: tokenResult.accessToken, expiresAt });
  return tokenResult.accessToken;
}

function buildTokenUrl(domain: string): string {
  const trimmed = domain.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/?$/, "/oauth/token");
    return url.toString();
  }
  return `https://${trimmed.replace(/\/$/, "")}/oauth/token`;
}

function buildDeviceCodeUrl(domain: string): string {
  const trimmed = domain.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/?$/, "/oauth/device/code");
    return url.toString();
  }
  return `https://${trimmed.replace(/\/$/, "")}/oauth/device/code`;
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return "unable to read error body";
  }
}

function defaultDeviceCodePrompt(
  userCode: string,
  verificationUri: string,
): void {
  console.log(
    `[Auth0 Device Code] Visit ${verificationUri} and enter code ${userCode} to continue.`,
  );
}

// Exposed for tests
export const __internal = {
  clearCache: () => tokenCache.clear(),
  cache: tokenCache,
};
