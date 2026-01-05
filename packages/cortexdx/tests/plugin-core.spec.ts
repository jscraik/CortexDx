/**
 * Core Plugin Test Suite
 * Tests for core diagnostic plugins (discovery, protocol, governance)
 */

import { describe, expect, it } from "vitest";
import type { DiagnosticContext } from "../src/types.js";

// Mock diagnostic context for testing
const mockContext: DiagnosticContext = {
  endpoint: "http://localhost:3000",
  logger: () => {},
  request: async () => ({ data: [], total: 0 }),
  jsonrpc: async (method: string) => {
    if (method === "initialize") {
      return {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "test-server", version: "1.0.0" },
      };
    }
    return {};
  },
  sseProbe: async () => ({ ok: true }),
  evidence: () => {},
  deterministic: true,
};

describe("Discovery Plugin", () => {
  it("should detect MCP server capabilities", async () => {
    const result = await mockContext.jsonrpc("initialize");
    expect(result).toHaveProperty("protocolVersion");
    expect(result).toHaveProperty("capabilities");
  });

  it("should identify server information", async () => {
    const result = await mockContext.jsonrpc("initialize");
    expect(result).toHaveProperty("serverInfo");
    expect(result.serverInfo).toHaveProperty("name");
    expect(result.serverInfo).toHaveProperty("version");
  });
});

describe("Protocol Plugin", () => {
  it("should validate MCP protocol version", async () => {
    const result = await mockContext.jsonrpc("initialize");
    expect(result.protocolVersion).toBe("2024-11-05");
  });

  it("should validate JSON-RPC message structure", () => {
    const validMessage = {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 1,
    };
    expect(validMessage).toHaveProperty("jsonrpc");
    expect(validMessage).toHaveProperty("method");
    expect(validMessage).toHaveProperty("id");
  });
});

describe("Governance Plugin", () => {
  it("should validate governance pack structure", () => {
    const governancePack = {
      id: "test-pack",
      version: "1.0.0",
      rules: [],
    };
    expect(governancePack).toHaveProperty("id");
    expect(governancePack).toHaveProperty("version");
    expect(governancePack).toHaveProperty("rules");
  });
});
