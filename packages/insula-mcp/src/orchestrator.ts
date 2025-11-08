import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runPlugins, type SandboxBudgets } from "./plugin-host.js";
import { buildJsonReport } from "./report/json.js";
import { buildMarkdownReport } from "./report/markdown.js";
import { buildArcTddPlan } from "./report/arctdd.js";
import { buildFilePlan } from "./report/fileplan.js";
import type { Finding } from "./types.js";

interface DiagnoseOptions {
  out?: string;
  full?: boolean;
  suites?: string;
  deterministic?: boolean;
  budgetTime?: number | string;
  "budget-time"?: number | string;
  budgetMem?: number | string;
  "budget-mem"?: number | string;
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

  const suites = typeof opts.suites === "string" && opts.suites.length > 0
    ? opts.suites.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const budgets: SandboxBudgets = {
    timeMs: coerceNumber(opts.budgetTime) ?? coerceNumber(opts["budget-time"]) ?? 5000,
    memMb: coerceNumber(opts.budgetMem) ?? coerceNumber(opts["budget-mem"]) ?? 96
  };
  const headers = parseAuthHeaders((opts as unknown as { auth?: string }).auth);

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
    node: process.version
  };

  writeArtifacts(outDir, stamp, findings);

  const hasBlocker = findings.some((f) => f.severity === "blocker");
  const hasMajor = findings.some((f) => f.severity === "major");
  return hasBlocker ? 1 : hasMajor ? 2 : 0;
}

function writeArtifacts(outDir: string, stamp: Record<string, unknown>, findings: Finding[]): void {
  const json = buildJsonReport(stamp, findings);
  const md = buildMarkdownReport(stamp, findings);
  const arc = buildArcTddPlan(stamp, findings);
  const fp = buildFilePlan(findings);

  writeFileSync(join(outDir, "insula-findings.json"), JSON.stringify(json, null, 2));
  writeFileSync(join(outDir, "insula-report.md"), md);
  writeFileSync(join(outDir, "insula-arctdd.md"), arc);
  if (fp.length) writeFileSync(join(outDir, "insula-fileplan.patch"), fp.join("\n"));
}

function coerceNumber(value: number | string | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function parseAuthHeaders(auth?: string): Record<string, string> | undefined {
  if (!auth || auth.trim().length === 0) return undefined;
  const [schemeRaw, ...restParts] = auth.split(":");
  if (!schemeRaw || restParts.length === 0) return undefined;
  const scheme = schemeRaw.toLowerCase();
  if (scheme === "bearer") {
    return { authorization: `Bearer ${restParts.join(":").trim()}` };
  }
  if (scheme === "basic") {
    const [user, ...passwordParts] = restParts;
    if (!user || passwordParts.length === 0) return undefined;
    const credentials = Buffer.from(`${user}:${passwordParts.join(":")}`).toString("base64");
    return { authorization: `Basic ${credentials}` };
  }
  if (scheme === "header") {
    const [name, ...valueParts] = restParts;
    if (!name || valueParts.length === 0) return undefined;
    return { [name]: valueParts.join(":") };
  }
  return { authorization: `${schemeRaw} ${restParts.join(":")}` };
}
