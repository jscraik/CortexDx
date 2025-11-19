import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export type DeepContextIndexState =
  | "ready"
  | "pending"
  | "not_indexed"
  | "error"
  | "unknown";

export interface DeepContextStatusRecord {
  codebasePath: string;
  state: DeepContextIndexState;
  summary: string;
  updatedAt: string;
  remoteStatusText?: string;
  indexOutput?: string;
  codexContextDir: string;
  codexContextExists: boolean;
  indexedCodebasesPath?: string;
  indexedCodebasesExists?: boolean;
  indexedCodebasesSnapshot?: string;
}

type StatusMap = Record<string, DeepContextStatusRecord>;

export async function readDeepContextStatus(
  codebasePath: string,
): Promise<DeepContextStatusRecord | undefined> {
  const map = await readStatusMap();
  return map[normalizeCodebase(codebasePath)];
}

export async function readAllDeepContextStatuses(): Promise<DeepContextStatusRecord[]> {
  const map = await readStatusMap();
  return Object.values(map);
}

export async function persistDeepContextStatus(record: DeepContextStatusRecord): Promise<void> {
  const map = await readStatusMap();
  map[normalizeCodebase(record.codebasePath)] = record;
  await writeStatusMap(map);
}

export async function buildStatusRecord(params: {
  codebasePath: string;
  remoteStatusText?: string;
  indexOutput?: string;
  inferredState?: DeepContextIndexState;
}): Promise<DeepContextStatusRecord> {
  const { codebasePath, remoteStatusText, indexOutput, inferredState } = params;
  const artifacts = await inspectCodexArtifacts(codebasePath);
  const state = inferredState ?? inferState(remoteStatusText, indexOutput, artifacts);
  const summary = buildSummary(state, remoteStatusText, artifacts);

  return {
    codebasePath: artifacts.codebasePath,
    state,
    summary,
    updatedAt: new Date().toISOString(),
    remoteStatusText,
    indexOutput,
    codexContextDir: artifacts.codexContextDir,
    codexContextExists: artifacts.codexContextExists,
    indexedCodebasesPath: artifacts.indexedCodebasesPath,
    indexedCodebasesExists: artifacts.indexedCodebasesExists,
    indexedCodebasesSnapshot: artifacts.indexedCodebasesSnapshot,
  };
}

export function resolveCodexContextDir(codebasePath?: string): string {
  const candidates = [
    process.env.CODEX_CONTEXT_DIR,
    process.env.CORTEXDX_CODEX_CONTEXT_DIR,
    codebasePath ? path.join(codebasePath, ".codex-context") : undefined,
    path.join(process.cwd(), ".codex-context"),
    path.join(homedir(), ".codex-context"),
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0));

  return path.resolve(candidates[0] ?? path.join(homedir(), ".codex-context"));
}

export function resolveStateStorePath(): string {
  if (process.env.CORTEXDX_DEEPCONTEXT_STATE) {
    return path.resolve(process.env.CORTEXDX_DEEPCONTEXT_STATE);
  }

  const baseDir = process.env.CORTEXDX_STATE_DIR?.trim().length
    ? path.resolve(process.env.CORTEXDX_STATE_DIR)
    : path.join(process.cwd(), ".cortexdx");

  return path.join(baseDir, "deepcontext-status.json");
}

export function formatStatusLine(record: DeepContextStatusRecord): string {
  const parts = [
    `[${record.state.toUpperCase()}]`,
    path.basename(record.codebasePath) || record.codebasePath,
    "—",
    record.summary,
  ];
  return parts.join(" ");
}

async function inspectCodexArtifacts(codebasePath: string): Promise<{
  codebasePath: string;
  codexContextDir: string;
  codexContextExists: boolean;
  indexedCodebasesPath?: string;
  indexedCodebasesExists: boolean;
  indexedCodebasesSnapshot?: string;
  indexContainsCodebase: boolean;
}> {
  const resolvedCodebase = normalizeCodebase(codebasePath);
  const codexContextDir = resolveCodexContextDir(resolvedCodebase);
  const codexContextExists = await pathExists(codexContextDir);
  const indexedCodebasesPath = path.join(codexContextDir, "indexed-codebases.json");
  const indexedCodebasesExists = await pathExists(indexedCodebasesPath);
  let indexedCodebasesSnapshot: string | undefined;
  let indexContainsCodebase = false;

  if (indexedCodebasesExists) {
    try {
      const raw = await readFile(indexedCodebasesPath, "utf8");
      indexedCodebasesSnapshot = raw.slice(0, 2000);
      indexContainsCodebase = raw.toLowerCase().includes(resolvedCodebase.toLowerCase());
    } catch {
      indexContainsCodebase = false;
    }
  }

  return {
    codebasePath: resolvedCodebase,
    codexContextDir,
    codexContextExists,
    indexedCodebasesPath: indexedCodebasesExists ? indexedCodebasesPath : undefined,
    indexedCodebasesExists,
    indexedCodebasesSnapshot,
    indexContainsCodebase,
  };
}

function inferState(
  remoteStatusText?: string,
  indexOutput?: string,
  artifacts?: {
    codexContextExists: boolean;
    indexedCodebasesExists: boolean;
    indexContainsCodebase: boolean;
  },
): DeepContextIndexState {
  const combined = `${remoteStatusText ?? ""} ${indexOutput ?? ""}`.toLowerCase();
  if (combined.includes("error") || combined.includes("fail")) {
    return "error";
  }
  if (combined.includes("ready") || combined.includes("complete") || combined.includes("indexed")) {
    return "ready";
  }
  if (combined.includes("in progress") || combined.includes("indexing")) {
    return "pending";
  }
  if (combined.includes("not indexed") || combined.includes("no index")) {
    return "not_indexed";
  }

  if (artifacts?.indexContainsCodebase) {
    return "ready";
  }
  if (artifacts && (!artifacts.codexContextExists || !artifacts.indexedCodebasesExists)) {
    return "not_indexed";
  }
  return "unknown";
}

function buildSummary(
  state: DeepContextIndexState,
  remoteStatusText: string | undefined,
  artifacts: {
    codexContextDir: string;
    codexContextExists: boolean;
    indexedCodebasesExists: boolean;
  },
): string {
  const fragments: string[] = [];
  switch (state) {
    case "ready":
      fragments.push("DeepContext index ready");
      break;
    case "pending":
      fragments.push("Indexing still running");
      break;
    case "not_indexed":
      fragments.push("No DeepContext index artifacts detected");
      break;
    case "error":
      fragments.push("DeepContext indexing error");
      break;
    default:
      fragments.push("DeepContext status unknown");
  }

  if (remoteStatusText?.trim()) {
    fragments.push(`status: ${remoteStatusText.trim()}`);
  }
  if (!artifacts.codexContextExists) {
    fragments.push(`missing ${artifacts.codexContextDir}`);
  }
  if (artifacts.codexContextExists && !artifacts.indexedCodebasesExists) {
    fragments.push("indexed-codebases.json missing");
  }

  return fragments.join("; ");
}

async function readStatusMap(): Promise<StatusMap> {
  const stateFile = resolveStateStorePath();
  try {
    const raw = await readFile(stateFile, "utf8");
    const parsed = safeParseJson(raw);
    return parsed && typeof parsed === "object" ? (parsed as StatusMap) : {};
  } catch {
    return {};
  }
}

async function writeStatusMap(map: StatusMap): Promise<void> {
  const stateFile = resolveStateStorePath();
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify(map, null, 2), "utf8");
}

function normalizeCodebase(codebasePath: string): string {
  return path.resolve(codebasePath);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
