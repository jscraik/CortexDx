#!/usr/bin/env tsx
import {
  SemgrepIntegration,
  normalizeSemgrepResults,
} from "../../src/security/semgrep-integration.js";

const target = process.argv[2] || "packages/cortexdx/src";
const integration = new SemgrepIntegration();

async function main() {
  const rules = integration.loadMCPRules();
  const results = await integration.scanCode(target, rules);
  const normalized = normalizeSemgrepResults(results);
  const payload = {
    target,
    executionTimeMs: results.executionTime,
    findings: normalized,
    errors: results.errors,
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (normalized.length > 0) {
    process.exitCode = 1;
  }
}

void main();
