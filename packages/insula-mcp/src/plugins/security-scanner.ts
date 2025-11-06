/**
 * Enhanced Security Scanner Plugin
 * Extends threat-model.ts with comprehensive OWASP-based scanning
 * Requirements: 6.1, 6.3, 6.4
 */

import { SecurityValidator } from "../security/security-validator.js";
import type { DiagnosticContext, DiagnosticPlugin, Finding } from "../types.js";

export const SecurityScannerPlugin: DiagnosticPlugin = {
  id: "security-scanner",
  title: "OWASP Security Scanner",
  order: 420,

  async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const validator = new SecurityValidator();
    const findings = await validator.validate(ctx);

    const enhancedFindings = await addBestPractices(ctx, findings);

    return enhancedFindings;
  },
};

async function addBestPractices(
  ctx: DiagnosticContext,
  findings: Finding[],
): Promise<Finding[]> {
  const bestPractices: Finding[] = [];

  try {
    const tools = await ctx.jsonrpc<unknown>("tools/list");
    const toolNames = extractToolNames(tools);

    if (toolNames.length > 0) {
      bestPractices.push({
        id: "bp-tool-validation",
        area: "security",
        severity: "info",
        title: "Best Practice: Tool Input Validation",
        description:
          "Ensure all tool inputs are validated and sanitized before processing",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["best-practice", "owasp"],
        confidence: 0.9,
      });
    }

    if (ctx.headers?.authorization) {
      bestPractices.push({
        id: "bp-auth-present",
        area: "security",
        severity: "info",
        title: "Best Practice: Authentication Implemented",
        description:
          "Authentication headers detected - ensure proper validation",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["best-practice", "authentication"],
        confidence: 0.85,
      });
    }
  } catch {
    // Tool listing failed, skip best practices
  }

  return [...findings, ...bestPractices];
}

function extractToolNames(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    const maybe = (value as { tools?: unknown }).tools;
    if (Array.isArray(maybe)) return maybe;
  }
  return [];
}
