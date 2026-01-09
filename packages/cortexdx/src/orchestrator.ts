import {
  type SandboxBudgets,
  buildArcTddPlan,
  buildFilePlan,
  buildJsonReport,
  buildMarkdownReport,
  resolveAuthHeaders,
  runPlugins,
  storeConsolidatedReport,
} from "@brainwav/cortexdx-plugins";
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
import { executeDiagnoseAsync } from "./commands/async-task-utils.js";

interface DiagnoseOptions {
  out?: string;
  reportOut?: string;
  full?: boolean;
  suites?: string;
  deterministic?: boolean;
  async?: boolean;
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
  taskTtl?: number | string;
  pollInterval?: number | string;
  "task-ttl"?: number | string;
  "poll-interval"?: number | string;
}

interface DiagnoseStamp {
  endpoint: string;
  inspectedAt: string;
  durationMs: number;
  node: string;
  sessionId: string;
  [key: string]: string | number;
}

export async function runDiagnose({
  endpoint,
  opts,
}: {
  endpoint: string;
  opts: DiagnoseOptions;
}): Promise<number> {
  const t0 = Date.now();
  const outDir = String(opts.out ?? "reports");
  mkdirSync(outDir, { recursive: true });

  const suites = parseSuites(opts.suites);
  const budgets = buildBudgets(opts);
  const headers: Record<string, string> =
    (await resolveAuthHeaders({
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
    })) ?? {};

  if (opts.async) {
    return await runAsyncDiagnose({
      endpoint,
      outDir,
      suites,
      budgets,
      headers,
      opts,
      startedAt: t0,
    });
  }

  return await runSyncDiagnose({
    endpoint,
    outDir,
    suites,
    budgets,
    headers,
    opts,
    startedAt: t0,
  });
}

async function runSyncDiagnose(params: {
  endpoint: string;
  outDir: string;
  suites: string[];
  budgets: SandboxBudgets;
  headers: Record<string, string>;
  opts: DiagnoseOptions;
  startedAt: number;
}): Promise<number> {
  const { endpoint, outDir, suites, budgets, headers, opts, startedAt } = params;
  const sessionId = buildSessionId();
  const { findings } = await runPlugins({
    endpoint,
    suites,
    full: Boolean(opts.full),
    deterministic: Boolean(opts.deterministic),
    budgets,
  });

  const stamp = buildStamp(endpoint, sessionId, startedAt);
  await persistReports({
    outDir,
    stamp,
    findings,
    suites,
    budgets,
    deterministic: Boolean(opts.deterministic),
    reportOut: opts.reportOut,
  });

  return exitCodeForFindings(findings);
}

async function runAsyncDiagnose(params: {
  endpoint: string;
  outDir: string;
  suites: string[];
  budgets: SandboxBudgets;
  headers: Record<string, string>;
  opts: DiagnoseOptions;
  startedAt: number;
}): Promise<number> {
  const { endpoint, outDir, suites, budgets, headers, opts, startedAt } = params;
  const sessionId = buildSessionId();
  const taskTtl =
    coerceNumber(opts.taskTtl) ?? coerceNumber(opts["task-ttl"]) ?? 300000;
  const pollInterval =
    coerceNumber(opts.pollInterval) ?? coerceNumber(opts["poll-interval"]) ?? 5000;

  const result = await executeDiagnoseAsync({
    endpoint,
    diagnosticArgs: { endpoint, suites, full: Boolean(opts.full) },
    taskTtl,
    pollInterval,
    headers,
    noColor: Boolean(opts.noColor),
  });

  const findings = extractFindings(result);
  const stamp = buildStamp(endpoint, sessionId, startedAt);
  await persistReports({
    outDir,
    stamp,
    findings,
    suites,
    budgets,
    deterministic: Boolean(opts.deterministic),
    reportOut: opts.reportOut,
  });

  return exitCodeForFindings(findings);
}

function parseSuites(rawSuites: string | undefined): string[] {
  if (typeof rawSuites !== "string" || rawSuites.length === 0) return [];
  return rawSuites.split(",").map((s) => s.trim()).filter(Boolean);
}

function buildBudgets(opts: DiagnoseOptions): SandboxBudgets {
  return {
    timeMs: coerceNumber(opts.budgetTime) ?? coerceNumber(opts["budget-time"]) ?? 5000,
    memMb: coerceNumber(opts.budgetMem) ?? coerceNumber(opts["budget-mem"]) ?? 96,
  };
}

function buildSessionId(): string {
  return `diagnose-${Date.now().toString(36)}`;
}

function buildStamp(endpoint: string, sessionId: string, startedAt: number): DiagnoseStamp {
  return {
    endpoint,
    inspectedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    node: process.version,
    sessionId,
    budgets,
    headers,
    opts,
    noColor,
    startedAt: t0,
  };
}

async function persistReports({
  outDir,
  stamp,
  findings,
  suites,
  budgets,
  deterministic,
  reportOut,
}: {
  outDir: string;
  stamp: DiagnoseStamp;
  findings: Finding[];
  suites: string[];
  budgets: SandboxBudgets;
  deterministic: boolean;
  reportOut?: string;
}): Promise<void> {
  writeArtifacts(outDir, stamp, findings);
  await storeConsolidatedReport(reportOut, {
    sessionId: String(stamp.sessionId),
    diagnosticType: "diagnose",
    endpoint: String(stamp.endpoint),
    inspectedAt: String(stamp.inspectedAt),
    durationMs: Number(stamp.durationMs),
    findings,
    tags: suites,
    metadata: {
      budgets,
      deterministic,
    },
    taskTtl,
    pollInterval,
    headers: ctx.headers,
    noColor: ctx.noColor,
  })) as { content?: Array<{ type: string; text?: string }> };

  const resultText = extractAsyncText(asyncResult);
  if (!resultText) {
    const stamp = buildStamp(ctx, true);
    const errorFinding: Finding = {
      id: "async-task-parse-failed",
      area: "diagnostics",
      severity: "blocker",
      title: "Async task result parsing failed",
      description: "Failed to extract diagnostic text from async task result.",
      evidence: [
        { type: "log", ref: "No resultText extracted from asyncResult" },
        { type: "raw", ref: JSON.stringify(asyncResult) }
      ],
      confidence: 1.0
    };
    await storeConsolidatedReport(ctx.opts.reportOut, {
      sessionId: ctx.sessionId,
      diagnosticType: "diagnose",
      endpoint: ctx.endpoint,
      inspectedAt: stamp.inspectedAt,
      durationMs: stamp.durationMs,
      findings: [errorFinding],
      tags: ctx.suites,
      metadata: buildMetadata(ctx, {
        asyncMode: true,
        taskTtl,
        pollInterval,
        status: "failed",
        error: "extractAsyncText returned undefined",
        asyncResult
      }),
    });
    return 1;
  }

  const findings = parseFindingsFromText(resultText);
  if (!findings) {
    const stamp = buildStamp(ctx, true);
    const errorFinding: Finding = {
      id: "async-task-findings-parse-failed",
      area: "diagnostics",
      severity: "blocker",
      title: "Async task findings parsing failed",
      description: "Failed to parse findings from extracted async task result text.",
      evidence: [
        { type: "log", ref: "No findings parsed from resultText" },
        { type: "raw", ref: resultText }
      ],
      confidence: 1.0
    };
    await storeConsolidatedReport(ctx.opts.reportOut, {
      sessionId: ctx.sessionId,
      diagnosticType: "diagnose",
      endpoint: ctx.endpoint,
      inspectedAt: stamp.inspectedAt,
      durationMs: stamp.durationMs,
      findings: [errorFinding],
      tags: ctx.suites,
      metadata: buildMetadata(ctx, {
        asyncMode: true,
        taskTtl,
        pollInterval,
        status: "failed",
        error: "parseFindingsFromText returned undefined",
        resultText
      }),
    });
    return 1;
  }
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
}

function exitCodeForFindings(findings: Finding[]): number {
  const hasBlocker = findings.some((f) => f.severity === "blocker");
  const hasMajor = findings.some((f) => f.severity === "major");
  return hasBlocker ? 1 : hasMajor ? 2 : 0;
}

function extractFindings(result: unknown): Finding[] {
  if (result && typeof result === "object" && "findings" in result) {
    const findings = (result as { findings?: unknown }).findings;
    if (Array.isArray(findings)) return findings as Finding[];
  }

  if (result && typeof result === "object" && "content" in result) {
    const content = (result as { content?: Array<{ text?: string }> }).content;
    if (Array.isArray(content)) {
      for (const entry of content) {
        if (entry?.text) {
          const parsed = safeParseJson(entry.text);
          if (parsed && Array.isArray((parsed as { findings?: unknown }).findings)) {
            return (parsed as { findings: Finding[] }).findings;
          }
        }
      }
    }
  }

  return [];
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("Failed to parse async task payload", error);
    return undefined;
  }
}

function writeArtifacts(outDir: string, stamp: DiagnoseStamp, findings: Finding[]): void {
  const json = buildJsonReport(stamp, findings);
  const md = buildMarkdownReport(stamp, findings);
  const arc = buildArcTddPlan(stamp, findings);
  const fp = buildFilePlan(findings);

  writeFileSync(
    join(outDir, "cortexdx-findings.json"),
    JSON.stringify(json, null, 2),
  );
  writeFileSync(join(outDir, "cortexdx-report.md"), md);
  writeFileSync(join(outDir, "cortexdx-arctdd.md"), arc);
  if (fp.length)
    writeFileSync(join(outDir, "cortexdx-fileplan.patch"), fp.join("\n"));
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
