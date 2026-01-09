#!/usr/bin/env tsx
import {
  GitleaksIntegration,
  normalizeGitleaksResults,
} from "../../src/security/gitleaks-integration.js";

const target = process.argv[2] || process.cwd();
const integration = new GitleaksIntegration();

async function main() {
  const results = await integration.scanRepository(target);
  const normalized = normalizeGitleaksResults(results);
  const payload = {
    target,
    executionTimeMs: results.executionTime,
    totals: results.byType,
    findings: normalized,
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (results.totalFound > 0) {
    process.exitCode = 1;
  }
}

void main();
