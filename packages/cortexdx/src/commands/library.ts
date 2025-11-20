import { ingestMcpDocsSnapshot } from "../library/mcp-docs-ingestion";
import type { McpDocsIngestResult } from "../library/mcp-docs-ingestion";
import { createCliLogger } from "../logging/logger";

const logger = createCliLogger("library");

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
    logger.error(message, { error });
    return 1;
  }
}

function printIngestionSummary(
  result: McpDocsIngestResult,
  dryRun: boolean,
): void {
  const mode = dryRun ? "DRY-RUN" : "INGEST";
  logger.info(
    `${mode} MCP docs snapshot ${result.version} • chunks=${result.chunksProcessed} docs=${result.documentsInserted}`,
    { mode, version: result.version, chunksProcessed: result.chunksProcessed, documentsInserted: result.documentsInserted }
  );
  logger.info(`Manifest: ${result.manifestPath}`, { manifestPath: result.manifestPath });
  logger.info(`Chunks:   ${result.chunksPath}`, { chunksPath: result.chunksPath });
  if (result.storagePath) {
    logger.info(`Storage:  ${result.storagePath}`, { storagePath: result.storagePath });
  }
}

function parseNumeric(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
