import path from "node:path";
import process from "node:process";
import { DeepContextClient, resolveDeepContextApiKey } from "../deepcontext/client.js";
import {
  buildStatusRecord,
  formatStatusLine,
  persistDeepContextStatus,
  readAllDeepContextStatuses,
} from "../deepcontext/status-store.js";

interface IndexOptions {
  force?: boolean;
}

interface SearchOptions {
  maxResults?: string;
}

export async function runDeepContextIndex(codebase: string, options: IndexOptions): Promise<number> {
  const client = new DeepContextClient({ logger: (msg) => console.log(msg) });
  const resolved = path.resolve(codebase);
  const text = await client.indexCodebase(resolved, Boolean(options.force));
  const remoteStatus = await safeStatusFetch(client, resolved);
  const record = await buildStatusRecord({
    codebasePath: resolved,
    indexOutput: text,
    remoteStatusText: remoteStatus,
  });
  await persistDeepContextStatus(record);
  console.log(text || `Index requested for ${resolved}`);
  console.log(formatStatusLine(record));
  return 0;
}

export async function runDeepContextSearch(
  codebase: string,
  query: string,
  options: SearchOptions,
): Promise<number> {
  const client = new DeepContextClient({ logger: (msg) => console.log(msg) });
  const resolved = path.resolve(codebase);
  const maxResults = options.maxResults ? Number.parseInt(options.maxResults, 10) : 5;
  const result = await client.searchCodebase(resolved, query, Number.isNaN(maxResults) ? 5 : maxResults);
  if (result.matches.length === 0) {
    console.log("No matches returned by DeepContext.");
    console.log(result.text);
    return 0;
  }

  console.log(`Found ${result.matches.length} matches (showing up to ${maxResults}):`);
  for (const match of result.matches) {
    console.log(`\n${match.file_path}:${match.start_line}-${match.end_line} (score=${match.score ?? "n/a"})`);
    if (match.content) {
      console.log(match.content.slice(0, 500));
    }
  }

  const remoteStatus = await safeStatusFetch(client, resolved);
  const record = await buildStatusRecord({
    codebasePath: resolved,
    remoteStatusText: remoteStatus,
    indexOutput: result.text,
  });
  await persistDeepContextStatus(record);
  console.log(formatStatusLine(record));
  return 0;
}

export async function runDeepContextStatus(codebase?: string): Promise<number> {
  const client = new DeepContextClient({ logger: (msg) => console.log(msg) });
  if (!codebase) {
    const cached = await readAllDeepContextStatuses();
    if (cached.length === 0) {
      console.log("No cached DeepContext status. Pass a codebase path to query the MCP server.");
      return 0;
    }
    for (const record of cached) {
      console.log(formatStatusLine(record));
    }
    return 0;
  }

  const resolved = path.resolve(codebase);
  const text = await client.getIndexingStatus(resolved);
  const record = await buildStatusRecord({ codebasePath: resolved, remoteStatusText: text });
  await persistDeepContextStatus(record);
  console.log(text);
  console.log(formatStatusLine(record));
  return 0;
}

export async function runDeepContextClear(codebase?: string): Promise<number> {
  const client = new DeepContextClient({ logger: (msg) => console.log(msg) });
  const resolved = codebase ? path.resolve(codebase) : undefined;
  const text = await client.clearIndex(resolved);
  console.log(text);
  if (resolved) {
    const record = await buildStatusRecord({
      codebasePath: resolved,
      remoteStatusText: "index cleared",
      inferredState: "not_indexed",
    });
    await persistDeepContextStatus(record);
    console.log(formatStatusLine(record));
  }
  return 0;
}

export function ensureWildcardApiKey(): void {
  if (!resolveDeepContextApiKey()) {
    throw new Error("Set WILDCARD_API_KEY or DEEPCONTEXT_API_KEY (managed via 1Password .env) before running DeepContext commands.");
  }
}

async function safeStatusFetch(client: DeepContextClient, codebasePath: string): Promise<string> {
  try {
    return await client.getIndexingStatus(codebasePath);
  } catch (error) {
    return `status unavailable: ${String(error)}`;
  }
}
