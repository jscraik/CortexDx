import { afterEach, describe, expect, it } from "vitest";
import { setupTelemetry } from "@brainwav/cortexdx-plugins/telemetry/telemetry-integration.js";

describe("telemetry token requirements", () => {
    const originalToken = process.env.SHINZO_TELEMETRY_TOKEN;

    afterEach(() => {
        if (originalToken) {
            process.env.SHINZO_TELEMETRY_TOKEN = originalToken;
            return;
        }

        delete process.env.SHINZO_TELEMETRY_TOKEN;
    });

    it("throws when telemetry is enabled without SHINZO_TELEMETRY_TOKEN", () => {
        delete process.env.SHINZO_TELEMETRY_TOKEN;

        expect(() => setupTelemetry({ enabled: true })).toThrowError(
            /SHINZO_TELEMETRY_TOKEN is required/,
        );
    });
});
