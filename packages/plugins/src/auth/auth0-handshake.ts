import { URL } from "node:url";
import { oauthAuthenticator } from "../adapters/oauth-authenticator.js";

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
export async function resolveAuthHeaders(
  opts: {
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
  },
): Promise<Record<string, string> | undefined> {
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
      : await getAuth0AccessToken(config as Auth0MachineConfig & { clientSecret: string });
    headers.authorization = `Bearer ${token}`;
  }

  // Check CLI option first, then environment variable
  const mcpApiKey = opts.mcpApiKey || process.env.CORTEXDX_MCP_API_KEY;
  if (mcpApiKey) {
    headers["mcp-api-key"] = mcpApiKey;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function parseManualAuth(value: string, mcpApiKey?: string): Record<string, string> | undefined {
  const [schemeRaw, ...restParts] = value.split(":");
  if (!schemeRaw || restParts.length === 0) return undefined;
  const scheme = schemeRaw.toLowerCase();

  const headers: Record<string, string> = {};

  if (scheme === "bearer") {
    headers.authorization = `Bearer ${restParts.join(":").trim()}`;
  } else if (scheme === "basic") {
    const [user, ...passwordParts] = restParts;
    if (!user || passwordParts.length === 0) return undefined;
    const credentials = Buffer.from(`${user}:${passwordParts.join(":")}`).toString("base64");
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

function resolveAuth0Config(
  opts: {
    auth0Domain?: string;
    auth0ClientId?: string;
    auth0ClientSecret?: string;
    auth0Audience?: string;
    auth0Scope?: string;
    auth0DeviceCodeEndpoint?: string;
  },
): Auth0MachineConfig | null {
  const domain = pickFirstDefined(opts.auth0Domain, process.env.CORTEXDX_AUTH0_DOMAIN);
  const clientId = pickFirstDefined(opts.auth0ClientId, process.env.CORTEXDX_AUTH0_CLIENT_ID);
  const clientSecret = pickFirstDefined(
    opts.auth0ClientSecret,
    process.env.CORTEXDX_AUTH0_CLIENT_SECRET,
  );
  const audience = pickFirstDefined(opts.auth0Audience, process.env.CORTEXDX_AUTH0_AUDIENCE);
  const scope = pickFirstDefined(opts.auth0Scope, process.env.CORTEXDX_AUTH0_SCOPE);

  if (!domain || !clientId || !audience) {
    return null;
  }

  return {
    domain: domain.trim(),
    clientId: clientId.trim(),
    clientSecret: clientSecret?.trim(),
    audience: audience.trim(),
    scope: scope?.trim(),
    deviceCodeEndpoint:
      pickFirstDefined(opts.auth0DeviceCodeEndpoint, process.env.CORTEXDX_AUTH0_DEVICE_CODE_ENDPOINT)?.trim(),
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

  const tokenUrl = buildTokenUrl(config.domain);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    audience: config.audience,
  });

  if (config.scope && config.scope.length > 0) {
    body.set("scope", config.scope);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const errorText = await safeReadError(response);
    throw new Error(
      `Auth0 token request failed (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!payload?.access_token) {
    throw new Error("Auth0 token response missing access_token");
  }

  const expiresInMs = Math.max(30, (payload.expires_in ?? 60) - 30) * 1000;
  const expiresAt = Date.now() + expiresInMs;
  tokenCache.set(cacheKey, { token: payload.access_token, expiresAt });
  return payload.access_token;
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

  const scopeArray =
    config.scope?.split(/\s+/).filter((entry) => entry.length > 0) ?? [];
  const deviceEndpoint = config.deviceCodeEndpoint ?? buildDeviceCodeUrl(config.domain);
  const deviceCodeResult = await oauthAuthenticator.deviceCodeFlow(
    config.clientId,
    scopeArray,
    deviceEndpoint,
    config.audience,
  );

  const prompt = onPrompt ?? defaultDeviceCodePrompt;
  prompt(
    deviceCodeResult.userCode,
    deviceCodeResult.verificationUriComplete ?? deviceCodeResult.verificationUri,
  );

  const tokenResult = await oauthAuthenticator.pollDeviceCode(
    deviceCodeResult.deviceCode,
    buildTokenUrl(config.domain),
    config.clientId,
    deviceCodeResult.interval,
  );

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

function defaultDeviceCodePrompt(userCode: string, verificationUri: string): void {
  console.log(
    `[Auth0 Device Code] Visit ${verificationUri} and enter code ${userCode} to continue.`,
  );
}

// Exposed for tests
export const __internal = {
  clearCache: () => tokenCache.clear(),
  cache: tokenCache,
};
