import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveAuthHeaders } from "./auth/auth0-handshake.js";
import { type SandboxBudgets, runPlugins } from "./plugin-host.js";
import { buildArcTddPlan } from "./report/arctdd.js";
import { buildFilePlan } from "./report/fileplan.js";
import { buildJsonReport } from "./report/json.js";
import { buildMarkdownReport } from "./report/markdown.js";
import { storeConsolidatedReport } from "./report/consolidated-report.js";
import type { Finding } from "./types.js";

interface DiagnoseOptions {
  out?: string;
  reportOut?: string;
  full?: boolean;
  suites?: string;
  deterministic?: boolean;
  budgetTime?: number | string;
  "budget-time"?: number | string;
  budgetMem?: number | string;
  "budget-mem"?: number | string;
  auth?: string;
  auth0Domain?: string;
  auth0ClientId?: string;
  auth0ClientSecret?: string;
  auth0Audience?: string;
  auth0Scope?: string;
  mcpApiKey?: string;
  auth0DeviceCode?: boolean;
  auth0DeviceCodeEndpoint?: string;
  // Async task options (MCP draft spec)
  async?: boolean;
  taskTtl?: string | number;
  pollInterval?: string | number;
  noColor?: boolean;
}

export async function runDiagnose({
  endpoint,
  opts
}: {
  endpoint: string;
  opts: DiagnoseOptions;
}): Promise<number> {
  const outDir = String(opts.out ?? "reports");
  mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  const sessionId = `diagnose-${Date.now().toString(36)}`;

  const suites = typeof opts.suites === "string" && opts.suites.length > 0
    ? opts.suites.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const budgets: SandboxBudgets = {
    timeMs: coerceNumber(opts.budgetTime) ?? coerceNumber(opts["budget-time"]) ?? 5000,
    memMb: coerceNumber(opts.budgetMem) ?? coerceNumber(opts["budget-mem"]) ?? 96
  };
  const headers = await resolveAuthHeaders({
    auth: opts.auth,
    auth0Domain: opts.auth0Domain,
    auth0ClientId: opts.auth0ClientId,
    auth0ClientSecret: opts.auth0ClientSecret,
    auth0Audience: opts.auth0Audience,
    auth0Scope: opts.auth0Scope,
    mcpApiKey: opts.mcpApiKey,
    auth0DeviceCode: opts.auth0DeviceCode,
    auth0DeviceCodeEndpoint: opts.auth0DeviceCodeEndpoint,
    onDeviceCodePrompt: logDeviceCodePrompt,
  });

  // Check if async mode is requested (MCP draft spec)
  if (opts.async) {
    const { executeDiagnoseAsync } = await import('./commands/async-task-utils.js');

    const taskTtl = coerceNumber(opts.taskTtl) || 300000; // Default 5 minutes
    const pollInterval = coerceNumber(opts.pollInterval) || 5000; // Default 5 seconds

    console.log('🔄 Running diagnostic in async mode...\n');

    // Execute as async task
    const resultResponse = await executeDiagnoseAsync({
      endpoint,
      diagnosticArgs: {
        endpoint,
        suites,
        full: opts.full
      },
      taskTtl,
      pollInterval,
      headers,
      noColor: opts.noColor
    }) as { content?: Array<{ type: string; text?: string }> };

    // Extract findings from async result (High #9: handle multiple content formats)
    let resultText: string | undefined;

    // Try to extract text from various content formats
    if (resultResponse.content && Array.isArray(resultResponse.content)) {
      for (const content of resultResponse.content) {
        if (content.type === 'text' && content.text) {
          resultText = content.text;
          break;
        }
      }
    }

    if (!resultText) {
      console.error('❌ No text content received from async task');
      console.error('   Received:', JSON.stringify(resultResponse, null, 2));
      return 1;
    }

    let asyncResult;
    try {
      asyncResult = JSON.parse(resultText);
    } catch (err) {
      console.error('❌ Failed to parse async task result:', err);
      console.error('   Raw result:', resultText.substring(0, 200));
      return 1;
    }

    // Validate result structure
    if (!asyncResult || typeof asyncResult !== 'object') {
      console.error('❌ Invalid result structure (expected object)');
      return 1;
    }

    const findings: Finding[] = asyncResult.findings || [];

    const stamp = {
      endpoint,
      inspectedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      node: process.version,
      sessionId,
      asyncMode: true,
    };

    writeArtifacts(outDir, stamp, findings);

    await storeConsolidatedReport(opts.reportOut, {
      sessionId,
      diagnosticType: "diagnose",
      endpoint,
      inspectedAt: stamp.inspectedAt,
      durationMs: stamp.durationMs,
      findings,
      tags: suites,
      metadata: {
        budgets,
        deterministic: Boolean(opts.deterministic),
        asyncMode: true,
      },
    });

    const hasBlocker = findings.some((f) => f.severity === "blocker");
    const hasMajor = findings.some((f) => f.severity === "major");

    console.log('\n✅ Async diagnostic complete');
    console.log(`   Reports written to: ${outDir}`);

    return hasBlocker ? 1 : hasMajor ? 2 : 0;
  }

  // Synchronous execution (default)
  const { findings } = await runPlugins({
    endpoint,
    headers,
    suites,
    full: Boolean(opts.full),
    deterministic: Boolean(opts.deterministic),
    budgets
  });

  const stamp = {
    endpoint,
    inspectedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    node: process.version,
    sessionId,
  };

  writeArtifacts(outDir, stamp, findings);

  await storeConsolidatedReport(opts.reportOut, {
    sessionId,
    diagnosticType: "diagnose",
    endpoint,
    inspectedAt: stamp.inspectedAt,
    durationMs: stamp.durationMs,
    findings,
    tags: suites,
    metadata: {
      budgets,
      deterministic: Boolean(opts.deterministic),
    },
  });

  const hasBlocker = findings.some((f) => f.severity === "blocker");
  const hasMajor = findings.some((f) => f.severity === "major");
  return hasBlocker ? 1 : hasMajor ? 2 : 0;
}

function writeArtifacts(outDir: string, stamp: Record<string, unknown>, findings: Finding[]): void {
  const json = buildJsonReport(stamp, findings);
  const md = buildMarkdownReport(stamp, findings);
  const arc = buildArcTddPlan(stamp, findings);
  const fp = buildFilePlan(findings);

  writeFileSync(join(outDir, "cortexdx-findings.json"), JSON.stringify(json, null, 2));
  writeFileSync(join(outDir, "cortexdx-report.md"), md);
  writeFileSync(join(outDir, "cortexdx-arctdd.md"), arc);
  if (fp.length) writeFileSync(join(outDir, "cortexdx-fileplan.patch"), fp.join("\n"));
}

function coerceNumber(value: number | string | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function logDeviceCodePrompt(userCode: string, verificationUri: string): void {
  console.log(
    `[Auth0 Device Code] Visit ${verificationUri} and enter code ${userCode} to continue authentication.`,
  );
}
