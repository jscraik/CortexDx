import process from "node:process";

interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
}

const endpoint = process.env.MCP_EVAL_ENDPOINT ?? "http://127.0.0.1:5001/mcp";

async function fetchAuth0Token(config: Auth0Config): Promise<string> {
  const response = await fetch(`https://${config.domain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: config.audience,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth0 token request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Auth0 response missing access_token");
  }
  return data.access_token;
}

function parseStaticHeader(raw?: string): Record<string, string> {
  if (!raw) return {};
  const idx = raw.indexOf(":");
  if (idx === -1) {
    throw new Error("MCP_EVAL_AUTH_HEADER must be formatted as 'Name: Value'");
  }
  const name = raw.slice(0, idx).trim();
  const value = raw.slice(idx + 1).trim();
  if (!name || !value) {
    throw new Error("MCP_EVAL_AUTH_HEADER cannot have empty name or value");
  }
  return { [name]: value };
}

async function resolveHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  Object.assign(headers, parseStaticHeader(process.env.MCP_EVAL_AUTH_HEADER));

  if (process.env.MCP_EVAL_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.MCP_EVAL_BEARER_TOKEN}`;
    return headers;
  }

  const auth0Domain = process.env.MCP_EVAL_AUTH0_DOMAIN;
  const auth0ClientId = process.env.MCP_EVAL_AUTH0_CLIENT_ID;
  const auth0ClientSecret = process.env.MCP_EVAL_AUTH0_CLIENT_SECRET;
  const auth0Audience = process.env.MCP_EVAL_AUTH0_AUDIENCE;

  if (auth0Domain && auth0ClientId && auth0ClientSecret && auth0Audience) {
    const token = await fetchAuth0Token({
      domain: auth0Domain,
      clientId: auth0ClientId,
      clientSecret: auth0ClientSecret,
      audience: auth0Audience,
    });
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function forwardJsonRpc(line: string, headers: Record<string, string>): Promise<void> {
  if (!line.trim()) return;

  let request: unknown;
  try {
    request = JSON.parse(line);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: `Parse error: ${error}` } })}\n`,
    );
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    const payload = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(payload);
    } catch {
      json = {
        jsonrpc: "2.0",
        id: (request as { id?: unknown }).id ?? null,
        error: { code: response.status, message: payload },
      };
    }

    process.stdout.write(`${JSON.stringify(json)}\n`);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: (request as { id?: unknown }).id ?? null,
        error: { code: -32000, message: error instanceof Error ? error.message : String(error) },
      })}\n`,
    );
  }
}

async function main(): Promise<void> {
  const headers = await resolveHeaders();

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    const lines = chunk.split("\n");
    for (const line of lines) {
      void forwardJsonRpc(line, headers);
    }
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("JSON-RPC stdio bridge failed:", error);
  process.exit(1);
});
