import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding } from "../../core/src/types.ts";
import { resolveAuthHeaders } from "../../plugins/src/auth/auth0-handshake.ts";
import { type SandboxBudgets, runPlugins } from "@brainwav/cortexdx-plugins";
import { buildArcTddPlan } from "../../plugins/src/report/arctdd.ts";
import { buildFilePlan } from "../../plugins/src/report/fileplan.ts";
import { buildJsonReport } from "../../plugins/src/report/json.ts";
import { buildMarkdownReport } from "../../plugins/src/report/markdown.ts";
import { storeConsolidatedReport } from "../../plugins/src/report/consolidated-report.ts";

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
  async?: boolean;
  taskTtl?: string | number;
  pollInterval?: string | number;
  simulateExternal?: boolean;
  a11y?: boolean;
  noColor?: boolean;
  color?: boolean;
  otelExporter?: string;
  har?: boolean;
}

export async function runDiagnose({
  endpoint,
  opts,
}: {
  endpoint: string;
  opts: DiagnoseOptions;
}): Promise<number> {
  const outDir = String(opts.out ?? "reports");
  mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  const sessionId = `diagnose-${Date.now().toString(36)}`;
  const noColor = opts.noColor ?? opts.color === false;

  const suites =
    typeof opts.suites === "string" && opts.suites.length > 0
      ? opts.suites.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const budgets: SandboxBudgets = {
    timeMs: coerceNumber(opts.budgetTime) ?? coerceNumber(opts["budget-time"]) ?? 5000,
    memMb: coerceNumber(opts.budgetMem) ?? coerceNumber(opts["budget-mem"]) ?? 96,
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

  const context: DiagnoseContext = {
    endpoint,
    suites,
    outDir,
    sessionId,
    budgets,
    headers,
    opts,
    noColor,
    startedAt: t0,
  };

  return opts.async ? runAsyncDiagnose(context) : runSyncDiagnose(context);
}

interface DiagnoseContext {
  endpoint: string;
  suites: string[];
  outDir: string;
  sessionId: string;
  budgets: SandboxBudgets;
  headers?: Record<string, string>;
  opts: DiagnoseOptions;
  noColor: boolean;
  startedAt: number;
}

async function runSyncDiagnose(ctx: DiagnoseContext): Promise<number> {
  const { findings } = await runPlugins({
    endpoint: ctx.endpoint,
    headers: ctx.headers,
    suites: ctx.suites,
    full: Boolean(ctx.opts.full),
    deterministic: Boolean(ctx.opts.deterministic),
    budgets: ctx.budgets,
    // Remove unsupported options: simulateExternal, a11y, noColor, otelExporter, har
  });

  const stamp = buildStamp(ctx, false);
  writeArtifacts(ctx.outDir, stamp, findings);
  await storeConsolidatedReport(ctx.opts.reportOut, {
    sessionId: ctx.sessionId,
    diagnosticType: "diagnose",
    endpoint: ctx.endpoint,
    inspectedAt: stamp.inspectedAt,
    durationMs: stamp.durationMs,
    findings,
    tags: ctx.suites,
    metadata: buildMetadata(ctx, { asyncMode: false }),
  });

  return determineExitCode(findings);
}

async function runAsyncDiagnose(ctx: DiagnoseContext): Promise<number> {
  const { executeDiagnoseAsync } = await import("./commands/async-task-utils.js");
  const taskTtl = coerceNumber(ctx.opts.taskTtl) ?? 300000;
  const pollInterval = coerceNumber(ctx.opts.pollInterval) ?? 5000;

  const asyncResult = (await executeDiagnoseAsync({
    endpoint: ctx.endpoint,
    diagnosticArgs: {
      endpoint: ctx.endpoint,
      suites: ctx.suites,
      full: ctx.opts.full,
      simulateExternal: Boolean(ctx.opts.simulateExternal),
      a11y: Boolean(ctx.opts.a11y),
      otelExporter: ctx.opts.otelExporter,
      har: Boolean(ctx.opts.har),
    },
    taskTtl,
    pollInterval,
    headers: ctx.headers,
    noColor: ctx.noColor,
  })) as { content?: Array<{ type: string; text?: string }> };

  const resultText = extractAsyncText(asyncResult);
  if (!resultText) return 1;

  const findings = parseFindingsFromText(resultText);
  if (!findings) return 1;
  const stamp = buildStamp(ctx, true);
  writeArtifacts(ctx.outDir, stamp, findings);
  await storeConsolidatedReport(ctx.opts.reportOut, {
    sessionId: ctx.sessionId,
    diagnosticType: "diagnose",
    endpoint: ctx.endpoint,
    inspectedAt: stamp.inspectedAt,
    durationMs: stamp.durationMs,
    findings,
    tags: ctx.suites,
    metadata: buildMetadata(ctx, { asyncMode: true, taskTtl, pollInterval }),
  });

  return determineExitCode(findings);
}

function buildStamp(ctx: DiagnoseContext, asyncMode: boolean): Record<string, unknown> {
  return {
    endpoint: ctx.endpoint,
    inspectedAt: new Date().toISOString(),
    durationMs: Date.now() - ctx.startedAt,
    node: process.version,
    sessionId: ctx.sessionId,
    asyncMode,
  };
}

function buildMetadata(
  ctx: DiagnoseContext,
  extras: Record<string, unknown>,
): Record<string, unknown> {
  return {
    budgets: ctx.budgets,
    deterministic: Boolean(ctx.opts.deterministic),
    simulateExternal: Boolean(ctx.opts.simulateExternal),
    a11y: Boolean(ctx.opts.a11y),
    noColor: ctx.noColor,
    otelExporter: ctx.opts.otelExporter,
    har: Boolean(ctx.opts.har),
    ...extras,
  };
}

function extractAsyncText(response: { content?: Array<{ type: string; text?: string }> }): string | undefined {
  const textContent = response.content?.find((content) => content.type === "text" && content.text)?.text;
  if (textContent) return textContent;

  console.error("❌ No text content received from async task");
  console.error("   Received:", JSON.stringify(response, null, 2));
  return undefined;
}

function parseFindingsFromText(text: string): Finding[] | undefined {
  try {
    const payload = JSON.parse(text) as { findings?: Finding[] };
    return payload.findings ?? [];
  } catch (error) {
    console.error("❌ Failed to parse async task result:", error);
    console.error("   Raw result:", text.substring(0, 200));
    return undefined;
  }
}

function determineExitCode(findings: Finding[]): number {
  const hasBlocker = findings.some((finding) => finding.severity === "blocker");
  const hasMajor = findings.some((finding) => finding.severity === "major");
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
