#!/usr/bin/env tsx
import { ZAPIntegration, normalizeZAPResults } from "../../src/security/zap-integration.js";

const endpoint = process.argv[2];

async function main(): Promise<void> {
    if (!endpoint) {
        console.error("Usage: pnpm security:zap <endpoint>");
        process.exitCode = 1;
        return;
    }

    const integration = new ZAPIntegration({
        apiUrl: process.env.CORTEXDX_ZAP_API_URL,
        apiKey: process.env.CORTEXDX_ZAP_API_KEY,
        enabled: true,
    });

    const results = await integration.baselineScan(endpoint);
    const normalized = normalizeZAPResults(results);
    const payload = {
        endpoint,
        executionTimeMs: results.executionTime,
        totals: {
            high: results.highRisk,
            medium: results.mediumRisk,
            low: results.lowRisk,
            informational: results.informational,
        },
        findings: normalized,
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    if (results.highRisk > 0 || results.mediumRisk > 0) {
        process.exitCode = 1;
    }
}

void main();
