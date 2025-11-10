import { URL } from "node:url";

interface Auth0MachineConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  scope?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

/**
 * Build Authorization headers either from explicit --auth flags or by performing an Auth0 handshake.
 */
export async function resolveAuthHeaders(
  opts: {
    auth?: string;
    auth0Domain?: string;
    auth0ClientId?: string;
    auth0ClientSecret?: string;
    auth0Audience?: string;
    auth0Scope?: string;
  },
): Promise<Record<string, string> | undefined> {
  if (typeof opts.auth === "string" && opts.auth.trim().length > 0) {
    return parseManualAuth(opts.auth);
  }

  const config = resolveAuth0Config(opts);
  if (!config) {
    return undefined;
  }

  const token = await getAuth0AccessToken(config);
  return { authorization: `Bearer ${token}` };
}

function parseManualAuth(value: string): Record<string, string> | undefined {
  const [schemeRaw, ...restParts] = value.split(":");
  if (!schemeRaw || restParts.length === 0) return undefined;
  const scheme = schemeRaw.toLowerCase();
  if (scheme === "bearer") {
    return { authorization: `Bearer ${restParts.join(":").trim()}` };
  }
  if (scheme === "basic") {
    const [user, ...passwordParts] = restParts;
    if (!user || passwordParts.length === 0) return undefined;
    const credentials = Buffer.from(`${user}:${passwordParts.join(":")}`).toString("base64");
    return { authorization: `Basic ${credentials}` };
  }
  if (scheme === "header") {
    const [name, ...valueParts] = restParts;
    if (!name || valueParts.length === 0) return undefined;
    return { [name]: valueParts.join(":") };
  }
  return { authorization: `${schemeRaw} ${restParts.join(":")}` };
}

function resolveAuth0Config(
  opts: {
    auth0Domain?: string;
    auth0ClientId?: string;
    auth0ClientSecret?: string;
    auth0Audience?: string;
    auth0Scope?: string;
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

  if (!domain || !clientId || !clientSecret || !audience) {
    return null;
  }

  return {
    domain: domain.trim(),
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    audience: audience.trim(),
    scope: scope?.trim(),
  };
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

async function getAuth0AccessToken(config: Auth0MachineConfig): Promise<string> {
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

function buildTokenUrl(domain: string): string {
  const trimmed = domain.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/?$/, "/oauth/token");
    return url.toString();
  }
  return `https://${trimmed.replace(/\/$/, "")}/oauth/token`;
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return "unable to read error body";
  }
}

// Exposed for tests
export const __internal = {
  clearCache: () => tokenCache.clear(),
  cache: tokenCache,
};
