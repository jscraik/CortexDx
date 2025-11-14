import { existsSync } from "node:fs";
import path from "node:path";
import { DeepContextClient } from "./client.js";
import {
  buildStatusRecord,
  persistDeepContextStatus,
  readDeepContextStatus,
  type DeepContextStatusRecord,
} from "./status-store.js";
import type { ChatMessage, DevelopmentContext, Finding } from "../types.js";

const MAX_EVIDENCE = 5;
const DEFAULT_QUERY = "mcp diagnostics handshake sse batching";
const SIGNAL_HINTS = [
  { label: "handshake", pattern: /handshake|initialize/i },
  { label: "sse", pattern: /sse|stream/i },
  { label: "batch", pattern: /batch|jsonrpc/i },
];

export async function collectDeepContextFindings(ctx: DevelopmentContext): Promise<Finding[]> {
  if (!shouldInvokeDeepContext()) return [];
  const codebasePath = resolveCodebaseRoot(ctx);
  if (!codebasePath) {
    ctx.logger?.("[Self-Improvement] DeepContext skipped (no project root detected)");
    return [];
  }

  const client = new DeepContextClient({ logger: ctx.logger });
  const findings: Finding[] = [];

  const cachedStatus = await readDeepContextStatus(codebasePath);
  if (cachedStatus) {
    const cachedFinding = statusRecordToFinding(cachedStatus, "cached");
    if (cachedFinding) findings.push(cachedFinding);
  }

  const indexing = await runIndexing(client, codebasePath);
  if (indexing.finding) findings.push(indexing.finding);

  const query = buildQuery(ctx.conversationHistory ?? [], ctx);
  const search = await runSearch(client, codebasePath, query);
  if (search) findings.push(search);

  const synced = await syncDeepContextStatus(client, codebasePath, { indexOutput: indexing.output });
  if (synced) {
    const statusFinding = statusRecordToFinding(synced, "current");
    if (statusFinding) findings.push(statusFinding);
  }

  return findings;
}

function shouldInvokeDeepContext(): boolean {
  if (process.env.CORTEXDX_DISABLE_DEEPCONTEXT === "1") return false;
  const apiKey = process.env.WILDCARD_API_KEY;
  return Boolean(apiKey && apiKey.trim().length > 0);
}

function resolveCodebaseRoot(ctx: DevelopmentContext): string | undefined {
  const candidates = [
    ctx.projectContext?.rootPath,
    process.env.CORTEXDX_PROJECT_ROOT,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const absolute = path.resolve(candidate);
    if (existsSync(absolute)) return absolute;
  }
  return undefined;
}

async function runIndexing(
  client: DeepContextClient,
  codebasePath: string,
): Promise<{ finding: Finding | null; output?: string }> {
  try {
    const text = await client.indexCodebase(codebasePath, false);
    if (!text.trim()) return { finding: null, output: text };
    return {
      output: text,
      finding: {
        id: "self_improvement.deepcontext_index",
        area: "development",
        severity: "info",
        title: "DeepContext index refreshed",
        description: text,
        evidence: [{ type: "file", ref: codebasePath }],
        tags: ["self-improvement", "deepcontext"],
      },
    };
  } catch (error) {
    return {
      output: undefined,
      finding: {
        id: "self_improvement.deepcontext_index_failed",
        area: "development",
        severity: "minor",
        title: "DeepContext indexing failed",
        description: String(error),
        evidence: [{ type: "file", ref: codebasePath }],
        tags: ["self-improvement", "deepcontext", "error"],
      },
    };
  }
}

async function runSearch(
  client: DeepContextClient,
  codebasePath: string,
  query: string,
): Promise<Finding | null> {
  try {
    const result = await client.searchCodebase(codebasePath, query, 10);
    return buildSearchFinding(result.matches, query, codebasePath, result.text);
  } catch (error) {
    return {
      id: "self_improvement.deepcontext_search_failed",
      area: "development",
      severity: "minor",
      title: "DeepContext search failed",
      description: String(error),
      evidence: [{ type: "file", ref: codebasePath }],
      tags: ["self-improvement", "deepcontext", "error"],
    };
  }
}

function buildSearchFinding(
  matches: Awaited<ReturnType<DeepContextClient["searchCodebase"]>>["matches"],
  query: string,
  codebasePath: string,
  summaryText: string,
): Finding | null {
  const evidence = matches
    .slice(0, MAX_EVIDENCE)
    .map((match) => ({
      type: "file" as const,
      ref: formatMatchRef(codebasePath, match.file_path, match.start_line, match.end_line),
    }));
  const severity = matches.length > 0 ? "info" : "minor";
  return {
    id: "self_improvement.deepcontext_search",
    area: "development",
    severity,
    title: "DeepContext semantic search insights",
    description:
      matches.length > 0
        ? `Query "${query}" returned ${matches.length} relevant sections.\n${summaryText.slice(0, 400)}`
        : `Query "${query}" returned no relevant sections; adjust the query or expand the scope.`,
    evidence,
    recommendation:
      matches.length > 0
        ? "Review the referenced files to align Inspector fixes with real code hotspots."
        : "Re-run DeepContext after new commits or broaden the query to capture related modules.",
    tags: ["self-improvement", "deepcontext", "semantic-search"],
  };
}

function formatMatchRef(root: string, filePath: string, start: number, end: number): string {
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..")) return filePath;
  return `${relative}:${start}-${end}`;
}

function buildQuery(history: ChatMessage[], ctx: DevelopmentContext): string {
  const hints = collectSignalHints(history);
  const language = ctx.projectContext?.language ?? "typescript";
  const projectType = ctx.projectContext?.type ?? "mcp";
  const parts = [`${projectType} ${language}`, DEFAULT_QUERY, ...hints];
  return parts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectSignalHints(history: ChatMessage[]): string[] {
  const hints: string[] = [];
  for (const entry of history) {
    for (const hint of SIGNAL_HINTS) {
      if (hint.pattern.test(entry.content)) {
        hints.push(hint.label);
      }
    }
  }
  return Array.from(new Set(hints));
}

async function syncDeepContextStatus(
  client: DeepContextClient,
  codebasePath: string,
  extra?: { indexOutput?: string },
): Promise<DeepContextStatusRecord | null> {
  try {
    const remoteStatus = await client.getIndexingStatus(codebasePath);
    const record = await buildStatusRecord({
      codebasePath,
      remoteStatusText: remoteStatus,
      indexOutput: extra?.indexOutput,
    });
    await persistDeepContextStatus(record);
    return record;
  } catch (error) {
    const record = await buildStatusRecord({
      codebasePath,
      remoteStatusText: `status unavailable: ${String(error)}`,
      indexOutput: extra?.indexOutput,
      inferredState: "error",
    });
    await persistDeepContextStatus(record);
    return record;
  }
}

function statusRecordToFinding(
  record: DeepContextStatusRecord,
  phase: "cached" | "current",
): Finding | null {
  const severity = mapStateToSeverity(record.state);
  if (!severity) return null;
  const evidence = buildStatusEvidence(record);

  return {
    id: `self_improvement.deepcontext_status_${phase}`,
    area: "development",
    severity,
    title: `DeepContext index status (${record.state})`,
    description: record.summary,
    evidence,
    tags: ["self-improvement", "deepcontext", "status"],
  };
}

function mapStateToSeverity(state: DeepContextStatusRecord["state"]): Finding["severity"] | null {
  switch (state) {
    case "ready":
      return "info";
    case "pending":
      return "minor";
    case "not_indexed":
    case "error":
      return "major";
    default:
      return "minor";
  }
}

function buildStatusEvidence(record: DeepContextStatusRecord): Finding["evidence"] {
  const evidence: Finding["evidence"] = [];
  evidence.push({ type: "file", ref: record.codebasePath });
  evidence.push({ type: "file", ref: record.codexContextDir });
  if (record.indexedCodebasesPath) {
    evidence.push({ type: "file", ref: record.indexedCodebasesPath });
  }
  if (record.remoteStatusText) {
    evidence.push({ type: "log", ref: record.remoteStatusText.slice(0, 240) });
  }
  return evidence.slice(0, MAX_EVIDENCE);
}
