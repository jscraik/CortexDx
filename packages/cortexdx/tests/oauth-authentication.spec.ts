/**
 * OAuth Authentication Tests
 * Tests for OAuth2/Auth0 authentication system
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */

import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CredentialManager,
  type Credentials,
} from "../src/adapters/credential-manager.js";
import { OAuthAuthenticator } from "../src/adapters/oauth-authenticator.js";
import { OAuthIntegration } from "../src/adapters/oauth-integration.js";

describe("OAuth Authenticator", () => {
  let authenticator: OAuthAuthenticator;

  beforeEach(() => {
    authenticator = new OAuthAuthenticator();
  });

  describe("OAuth2 Flow Initiation", () => {
    it("should initiate OAuth2 flow within 2s (Req 14.1)", async () => {
      const startTime = Date.now();

      const session = await authenticator.initiateOAuth2Flow(
        "https://example.com/mcp",
        {
          authType: "oauth2",
          tokenEndpoint: "https://auth.example.com/token",
          clientId: "test-client",
        },
      );

      const elapsed = Date.now() - startTime;

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.serverEndpoint).toBe("https://example.com/mcp");
      expect(session.status).toBe("pending");
      expect(elapsed).toBeLessThan(2000);
    });

    it("should generate unique session IDs", async () => {
      const session1 = await authenticator.initiateOAuth2Flow(
        "https://example.com/mcp",
        {
          authType: "oauth2",
          tokenEndpoint: "https://auth.example.com/token",
          clientId: "test-client",
        },
      );

      const session2 = await authenticator.initiateOAuth2Flow(
        "https://example.com/mcp",
        {
          authType: "oauth2",
          tokenEndpoint: "https://auth.example.com/token",
          clientId: "test-client",
        },
      );

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe("Device Code Flow", () => {
    it("should support device code flow (Req 14.2)", async () => {
      // Mock fetch for device code endpoint
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({
          device_code: "test-device-code",
          user_code: "ABCD-1234",
          verification_uri: "https://auth.example.com/device",
          verification_uri_complete:
            "https://auth.example.com/device?code=ABCD-1234",
          expires_in: 900,
          interval: 5,
        }),
      } as unknown as Response);

      const result = await authenticator.deviceCodeFlow(
        "test-client",
        ["read", "write"],
        "https://auth.example.com/device/code",
        "https://api.example.com",
      );

      expect(result).toBeDefined();
      expect(result.deviceCode).toBe("test-device-code");
      expect(result.userCode).toBe("ABCD-1234");
      expect(result.verificationUri).toBe("https://auth.example.com/device");
      expect(result.expiresIn).toBe(900);
      expect(result.interval).toBe(5);
    });

    it("should complete device code flow within 2s (Req 14.1)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({
          device_code: "test-device-code",
          user_code: "ABCD-1234",
          verification_uri: "https://auth.example.com/device",
          expires_in: 900,
          interval: 5,
        }),
      } as unknown as Response);

      const startTime = Date.now();

      await authenticator.deviceCodeFlow(
        "test-client",
        ["read"],
        "https://auth.example.com/device/code",
        undefined,
      );

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe("Client Credentials Flow", () => {
    it("should support client credentials flow (Req 14.3)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({
          access_token: "test-access-token",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "read write",
        }),
      } as unknown as Response);

      const result = await authenticator.clientCredentialsFlow(
        "test-client",
        "test-secret",
        "https://auth.example.com/token",
        ["read", "write"],
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBe("test-access-token");
      expect(result.expiresIn).toBe(3600);
      expect(result.tokenType).toBe("Bearer");
      expect(result.scope).toEqual(["read", "write"]);
    });

    it("should complete client credentials flow within 2s (Req 14.1)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({
          access_token: "test-access-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      } as unknown as Response);

      const startTime = Date.now();

      await authenticator.clientCredentialsFlow(
        "test-client",
        "test-secret",
        "https://auth.example.com/token",
        ["read"],
      );

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe("Token Refresh", () => {
    it("should refresh access token (Req 14.4)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      } as unknown as Response);

      const result = await authenticator.refreshToken(
        "old-refresh-token",
        "https://auth.example.com/token",
        "test-client",
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBe("new-access-token");
      expect(result.refreshToken).toBe("new-refresh-token");
    });
  });

  describe("Token Validation", () => {
    it("should validate JWT tokens", async () => {
      // Create a simple JWT-like token (header.payload.signature)
      const payload = {
        sub: "user123",
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        scope: "read write",
      };

      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const token = `header.${encodedPayload}.signature`;

      const result = await authenticator.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.expiresAt).toBeDefined();
    });

    it("should detect expired tokens", async () => {
      const payload = {
        sub: "user123",
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const token = `header.${encodedPayload}.signature`;

      const result = await authenticator.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("expired");
    });
  });

  describe("Authentication Detection", () => {
    it("should detect 401 Unauthorized (Req 14.1)", () => {
      const result = authenticator.detectAuthRequirement(401, {
        "www-authenticate": 'Bearer realm="example"',
      });

      expect(result.required).toBe(true);
      expect(result.authType).toBe("oauth2");
      expect(result.realm).toBe("example");
    });

    it("should detect 403 Forbidden", () => {
      const result = authenticator.detectAuthRequirement(403, {});

      expect(result.required).toBe(true);
    });

    it("should not require auth for 200 OK", () => {
      const result = authenticator.detectAuthRequirement(200, {});

      expect(result.required).toBe(false);
    });
  });
});

describe("Credential Manager", () => {
  let credentialManager: CredentialManager;
  let testStorageDir: string;

  beforeEach(() => {
    testStorageDir = join(tmpdir(), `cortexdx-test-${Date.now()}`);
    credentialManager = new CredentialManager(testStorageDir);
  });

  afterEach(async () => {
    credentialManager.cleanup();
    try {
      await rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Credential Storage", () => {
    it("should store credentials securely (Req 14.4)", async () => {
      const credentials: Credentials = {
        accessToken: "test-token",
        refreshToken: "test-refresh",
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: "Bearer",
        scope: ["read", "write"],
        serverEndpoint: "https://example.com/mcp",
        clientId: "test-client",
        tokenEndpoint: "https://auth.example.com/token",
      };

      await credentialManager.storeCredentials(
        "https://example.com/mcp",
        credentials,
      );

      const retrieved = await credentialManager.retrieveCredentials(
        "https://example.com/mcp",
      );

      expect(retrieved).toBeDefined();
      expect(retrieved?.accessToken).toBe("test-token");
      expect(retrieved?.refreshToken).toBe("test-refresh");
    });

    it("should encrypt stored credentials", async () => {
      const credentials: Credentials = {
        accessToken: "secret-token",
        refreshToken: "secret-refresh",
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: "Bearer",
        serverEndpoint: "https://example.com/mcp",
        clientId: "test-client",
        tokenEndpoint: "https://auth.example.com/token",
      };

      await credentialManager.storeCredentials(
        "https://example.com/mcp",
        credentials,
      );

      // Read raw storage file
      const { readFile } = await import("node:fs/promises");
      const storageFile = join(testStorageDir, "credentials.enc");
      const rawData = await readFile(storageFile, "utf8");

      // Verify that tokens are not stored in plain text
      expect(rawData).not.toContain("secret-token");
      expect(rawData).not.toContain("secret-refresh");
    });

    it("should delete credentials (Req 14.4)", async () => {
      const credentials: Credentials = {
        accessToken: "test-token",
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: "Bearer",
        serverEndpoint: "https://example.com/mcp",
        clientId: "test-client",
        tokenEndpoint: "https://auth.example.com/token",
      };

      await credentialManager.storeCredentials(
        "https://example.com/mcp",
        credentials,
      );

      await credentialManager.deleteCredentials("https://example.com/mcp");

      const retrieved = await credentialManager.retrieveCredentials(
        "https://example.com/mcp",
      );

      expect(retrieved).toBeNull();
    });
  });

  describe("Automatic Token Refresh", () => {
    it("should refresh token before expiration (Req 14.4)", async () => {
      const credentials: Credentials = {
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 1000), // Expires in 1 second
        tokenType: "Bearer",
        serverEndpoint: "https://example.com/mcp",
        clientId: "test-client",
        tokenEndpoint: "https://auth.example.com/token",
      };

      await credentialManager.storeCredentials(
        "https://example.com/mcp",
        credentials,
      );

      const refreshCallback = vi.fn().mockResolvedValue({
        accessToken: "new-token",
        refreshToken: "new-refresh-token",
        expiresIn: 3600,
        tokenType: "Bearer",
      });

      const token = await credentialManager.getValidToken(
        "https://example.com/mcp",
        refreshCallback,
      );

      expect(refreshCallback).toHaveBeenCalled();
      expect(token).toBe("new-token");
    });

    it("should return valid token without refresh", async () => {
      const credentials: Credentials = {
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3600000), // Expires in 1 hour
        tokenType: "Bearer",
        serverEndpoint: "https://example.com/mcp",
        clientId: "test-client",
        tokenEndpoint: "https://auth.example.com/token",
      };

      await credentialManager.storeCredentials(
        "https://example.com/mcp",
        credentials,
      );

      const refreshCallback = vi.fn();

      const token = await credentialManager.getValidToken(
        "https://example.com/mcp",
        refreshCallback,
      );

      expect(refreshCallback).not.toHaveBeenCalled();
      expect(token).toBe("valid-token");
    });

    it("should complete token refresh within 5s (Req 14.4)", async () => {
      const credentials: Credentials = {
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 1000),
        tokenType: "Bearer",
        serverEndpoint: "https://example.com/mcp",
        clientId: "test-client",
        tokenEndpoint: "https://auth.example.com/token",
      };

      await credentialManager.storeCredentials(
        "https://example.com/mcp",
        credentials,
      );

      const refreshCallback = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          accessToken: "new-token",
          expiresIn: 3600,
          tokenType: "Bearer",
        };
      };

      const startTime = Date.now();

      await credentialManager.getValidToken(
        "https://example.com/mcp",
        refreshCallback,
      );

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe("Credential Lifecycle", () => {
    it("should list stored endpoints", async () => {
      const credentials1: Credentials = {
        accessToken: "token1",
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: "Bearer",
        serverEndpoint: "https://example1.com/mcp",
        clientId: "client1",
        tokenEndpoint: "https://auth.example.com/token",
      };

      const credentials2: Credentials = {
        accessToken: "token2",
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: "Bearer",
        serverEndpoint: "https://example2.com/mcp",
        clientId: "client2",
        tokenEndpoint: "https://auth.example.com/token",
      };

      await credentialManager.storeCredentials(
        "https://example1.com/mcp",
        credentials1,
      );
      await credentialManager.storeCredentials(
        "https://example2.com/mcp",
        credentials2,
      );

      const endpoints = await credentialManager.listStoredEndpoints();

      expect(endpoints).toHaveLength(2);
      expect(endpoints).toContain("https://example1.com/mcp");
      expect(endpoints).toContain("https://example2.com/mcp");
    });

    it("should clear all credentials", async () => {
      const credentials: Credentials = {
        accessToken: "token",
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: "Bearer",
        serverEndpoint: "https://example.com/mcp",
        clientId: "client",
        tokenEndpoint: "https://auth.example.com/token",
      };

      await credentialManager.storeCredentials(
        "https://example.com/mcp",
        credentials,
      );

      await credentialManager.clearAllCredentials();

      const endpoints = await credentialManager.listStoredEndpoints();
      expect(endpoints).toHaveLength(0);
    });
  });
});

describe("OAuth Integration", () => {
  let integration: OAuthIntegration;

  beforeEach(() => {
    integration = new OAuthIntegration();
  });

  describe("Authentication Detection", () => {
    it("should detect authentication requirements (Req 14.1)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        headers: new Map([
          ["www-authenticate", 'Bearer realm="example" scope="read write"'],
        ]),
      } as unknown as Response);

      const result = await integration.detectAuthRequirement(
        "https://example.com/mcp",
      );

      expect(result.required).toBe(true);
      expect(result.authType).toBe("oauth2");
      expect(result.realm).toBe("example");
    });

    it("should detect no authentication required", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
      } as unknown as Response);

      const result = await integration.detectAuthRequirement(
        "https://example.com/mcp",
      );

      expect(result.required).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication failures gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await integration.detectAuthRequirement(
        "https://example.com/mcp",
      );

      // Should not throw, should return no auth required
      expect(result.required).toBe(false);
    });

    it("should handle missing refresh token", async () => {
      const testStorageDir = join(tmpdir(), `cortexdx-test-${Date.now()}`);
      const testCredentialManager = new CredentialManager(testStorageDir);

      const credentials: Credentials = {
        accessToken: "old-token",
        // No refresh token
        expiresAt: new Date(Date.now() + 1000),
        tokenType: "Bearer",
        serverEndpoint: "https://example.com/mcp",
        clientId: "test-client",
        tokenEndpoint: "https://auth.example.com/token",
      };

      await testCredentialManager.storeCredentials(
        "https://example.com/mcp",
        credentials,
      );

      await expect(
        testCredentialManager.getValidToken("https://example.com/mcp"),
      ).rejects.toThrow("no refresh token");

      testCredentialManager.cleanup();
      await rm(testStorageDir, { recursive: true, force: true });
    });
  });
});
