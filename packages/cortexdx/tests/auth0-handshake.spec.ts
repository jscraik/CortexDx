import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __internal, resolveAuthHeaders } from "../src/auth/auth0-handshake.js";

describe("Auth0 handshake", () => {
  beforeEach(() => {
    __internal.clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.CORTEXDX_AUTH0_DOMAIN;
    delete process.env.CORTEXDX_AUTH0_CLIENT_ID;
    delete process.env.CORTEXDX_AUTH0_CLIENT_SECRET;
    delete process.env.CORTEXDX_AUTH0_AUDIENCE;
    delete process.env.CORTEXDX_AUTH0_SCOPE;
    delete process.env.CORTEXDX_AUTH0_DEVICE_CODE;
    delete process.env.CORTEXDX_AUTH0_DEVICE_CODE_ENDPOINT;
  });

  it("returns manual auth headers when --auth is provided", async () => {
    const headers = await resolveAuthHeaders({ auth: "bearer:xyz" });
    expect(headers).toEqual({ authorization: "Bearer xyz" });
  });

  it("fetches Auth0 token when configuration is provided via options", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "abc", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const headers = await resolveAuthHeaders({
      auth0Domain: "example.auth0.com",
      auth0ClientId: "client",
      auth0ClientSecret: "secret",
      auth0Audience: "https://api.example.com",
      auth0Scope: "read:all",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.auth0.com/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: expect.any(String),
      },
    );
    expect(headers).toEqual({ authorization: "Bearer abc" });
  });

  it("caches Auth0 tokens until expiration", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "cached", expires_in: 3600 }),
        {
          status: 200,
        },
      ),
    );

    const opts = {
      auth0Domain: "tenant.auth0.com",
      auth0ClientId: "client",
      auth0ClientSecret: "secret",
      auth0Audience: "aud",
    };

    await resolveAuthHeaders(opts);
    await resolveAuthHeaders(opts);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads configuration from environment when CLI flags are absent", async () => {
    process.env.CORTEXDX_AUTH0_DOMAIN = "env.auth0.com";
    process.env.CORTEXDX_AUTH0_CLIENT_ID = "envClient";
    process.env.CORTEXDX_AUTH0_CLIENT_SECRET = "envSecret";
    process.env.CORTEXDX_AUTH0_AUDIENCE = "envAudience";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "envToken", expires_in: 120 }),
        {
          status: 200,
        },
      ),
    );

    const headers = await resolveAuthHeaders({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(headers).toEqual({ authorization: "Bearer envToken" });
  });

  it("falls back to device code flow when enabled", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_code: "devcode",
            user_code: "ABC123",
            verification_uri: "https://verify.example.com",
            expires_in: 900,
            interval: 0,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "authorization_pending" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "deviceToken",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const prompt = vi.fn();
    const headers = await resolveAuthHeaders({
      auth0Domain: "example.auth0.com",
      auth0ClientId: "client",
      auth0Audience: "https://api.example.com",
      auth0DeviceCode: true,
      onDeviceCodePrompt: prompt,
    });

    expect(prompt).toHaveBeenCalledWith("ABC123", "https://verify.example.com");
    expect(headers).toEqual({ authorization: "Bearer deviceToken" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
