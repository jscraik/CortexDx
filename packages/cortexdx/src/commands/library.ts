import { ingestMcpDocsSnapshot } from "../library/mcp-docs-ingestion.js";
import type { McpDocsIngestResult } from "../library/mcp-docs-ingestion.js";

interface LibraryIngestCliOptions {
  version?: string;
  root?: string;
  storage?: string;
  limit?: string;
  promoted?: boolean;
  dryRun?: boolean;
}

export async function runLibraryIngestCommand(
  opts: LibraryIngestCliOptions,
): Promise<number> {
  try {
    const result = await ingestMcpDocsSnapshot({
      rootDir: opts.root,
      version: opts.version,
      staging: opts.promoted ? false : undefined,
      vectorStoragePath: opts.storage,
      chunkLimit: parseNumeric(opts.limit),
      dryRun: opts.dryRun,
    });
    printIngestionSummary(result, Boolean(opts.dryRun));
    return 0;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
    console.error(`[ERROR] ${message}`);
    return 1;
  }
}

function printIngestionSummary(
  result: McpDocsIngestResult,
  dryRun: boolean,
): void {
  const mode = dryRun ? "[DRY-RUN]" : "[INGEST]";
  console.log(
    `${mode} MCP docs snapshot ${result.version} • chunks=${result.chunksProcessed} docs=${result.documentsInserted}`,
  );
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Chunks:   ${result.chunksPath}`);
  if (result.storagePath) {
    console.log(`Storage:  ${result.storagePath}`);
  }
}

function parseNumeric(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
