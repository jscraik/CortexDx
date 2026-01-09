import { afterEach, describe, expect, it } from "vitest";
import { setupTelemetry } from "@brainwav/cortexdx-plugins/telemetry/telemetry-integration.js";
import { createInstrumentedMcpServer } from "../src/instrumented-mcp-server.js";

describe("telemetry token requirements", () => {
  const originalToken = process.env.SHINZO_TELEMETRY_TOKEN;
  const originalEnabled = process.env.CORTEXDX_TELEMETRY_ENABLED;

  afterEach(() => {
    if (originalToken) {
      process.env.SHINZO_TELEMETRY_TOKEN = originalToken;
    } else {
      delete process.env.SHINZO_TELEMETRY_TOKEN;
    }

    if (originalEnabled !== undefined) {
      process.env.CORTEXDX_TELEMETRY_ENABLED = originalEnabled;
    } else {
      delete process.env.CORTEXDX_TELEMETRY_ENABLED;
    }
  });

  it("should throw when telemetry is enabled without SHINZO_TELEMETRY_TOKEN", () => {
    delete process.env.SHINZO_TELEMETRY_TOKEN;

    expect(() => setupTelemetry({ enabled: true })).toThrowError(
      /SHINZO_TELEMETRY_TOKEN is required/,
    );
  });

  it("should not require a token when telemetry is disabled via enabled: false", () => {
    delete process.env.SHINZO_TELEMETRY_TOKEN;

    const result = setupTelemetry({ enabled: false });

    expect(result).toBeNull();
  });

  it("should not require a token when telemetry is disabled via CORTEXDX_TELEMETRY_ENABLED=false", () => {
    delete process.env.SHINZO_TELEMETRY_TOKEN;
    process.env.CORTEXDX_TELEMETRY_ENABLED = "false";

    const result = setupTelemetry();

    expect(result).toBeNull();
  });

  it("should throw from createInstrumentedMcpServer when SHINZO_TELEMETRY_TOKEN is not set", async () => {
    delete process.env.SHINZO_TELEMETRY_TOKEN;

    await expect(createInstrumentedMcpServer()).rejects.toThrowError(
      /SHINZO_TELEMETRY_TOKEN is required/,
    );
  });
});
