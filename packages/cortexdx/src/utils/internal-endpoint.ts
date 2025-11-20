export type HeaderMap = Record<string, string>;

const HEADER_SPLIT_REGEX = /[,;\n]+/;

function parseHeaderPair(pair: string): [string, string] | null {
  const separatorIndex = pair.indexOf(":");
  if (separatorIndex === -1) return null;
  const key = pair.slice(0, separatorIndex).trim();
  const value = pair.slice(separatorIndex + 1).trim();
  if (!key || !value) return null;
  return [key, value];
}

export function parseHeaderList(input?: string): HeaderMap {
  if (!input) return {};
  return input
    .split(HEADER_SPLIT_REGEX)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .reduce<HeaderMap>((acc, entry) => {
      const pair = parseHeaderPair(entry);
      if (pair) {
        const [key, value] = pair;
        acc[key] = value;
      }
      return acc;
    }, {});
}

export function resolveInternalHeaders(): HeaderMap {
  const headers: HeaderMap = {};
  Object.assign(headers, parseHeaderList(process.env.CORTEXDX_INTERNAL_HEADERS));

  const authHeader = parseHeaderPair(
    process.env.CORTEXDX_INTERNAL_AUTH_HEADER ?? "",
  );
  if (authHeader) {
    headers[authHeader[0]] = authHeader[1];
  }

  const bearerToken = process.env.CORTEXDX_BEARER_TOKEN;
  if (bearerToken) {
    headers.Authorization = bearerToken.startsWith("Bearer ")
      ? bearerToken
      : `Bearer ${bearerToken}`;
  }

  const cfClientId = process.env.CF_ACCESS_CLIENT_ID;
  const cfClientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (cfClientId && cfClientSecret) {
    headers["CF-Access-Client-Id"] = cfClientId;
    headers["CF-Access-Client-Secret"] = cfClientSecret;
  }

  return headers;
}

export function mergeHeaders<T extends RequestInit | undefined>(
  base: T,
  defaults: HeaderMap,
): RequestInit {
  if (!defaults || Object.keys(defaults).length === 0) {
    return base ?? {};
  }
  return {
    ...base,
    headers: {
      ...(base?.headers ?? {}),
      ...defaults,
    },
  } satisfies RequestInit;
}

export function formatHeadersForCli(headers: HeaderMap): string[] {
  return Object.entries(headers).flatMap(([key, value]) => [
    "--header",
    `${key}: ${value}`,
  ]);
}

