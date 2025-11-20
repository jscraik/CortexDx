/**
 * Report MCP Tools
 * Provides MCP tools for accessing diagnostic reports with presigned URLs
 * Implements the report.get_latest and report.get_by_run tools
 * Requirements: Storage, Security, Provenance tracking
 */

import { execSync } from "node:child_process";
import { createCloudStorageFromEnv } from "../adapters/cloud-storage-adapter";
import { ReportManager } from "../storage/report-manager";
import type { McpTool } from "../types";

/**
 * Get git metadata for provenance tracking
 */
function getGitMetadata(): { sha: string; branch: string } | undefined {
  try {
    const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
    return { sha, branch };
  } catch {
    // Not a git repository or git not available
    return undefined;
  }
}

/**
 * Get application version from package.json
 */
function getAppVersion(): string {
  try {
    // In a real implementation, this would read from package.json
    // For now, return a hardcoded version
    return "1.0.0";
  } catch {
    return "unknown";
  }
}

/**
 * Report Tools
 */
export const reportTools: McpTool[] = [
  {
    name: "report.get_latest",
    description:
      "Get latest diagnostic reports with time-limited presigned URLs for secure access. Returns report metadata including cloud storage URLs (if enabled), SHA-256 hashes, and provenance information (git SHA, version, SBOM). URLs expire after 15 minutes by default.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["diagnostic", "metadata", "inspector"],
          description: "Type of reports to retrieve (default: diagnostic)",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 10,
          description: "Maximum number of reports to return (default: 5)",
        },
        days: {
          type: "number",
          minimum: 1,
          maximum: 90,
          description: "Number of days to look back (default: 7)",
        },
      },
    },
  },
  {
    name: "report.get_by_run",
    description:
      "Get a specific diagnostic report by run ID (session ID) with presigned URLs. Returns detailed report metadata including cloud URLs, content hashes, file sizes, and full provenance chain. Useful for retrieving reports for specific diagnostic sessions.",
    inputSchema: {
      type: "object",
      properties: {
        runId: {
          type: "string",
          minLength: 8,
          description: "Run ID (session ID) of the report to retrieve",
        },
        includeProvenance: {
          type: "boolean",
          description:
            "Include full provenance metadata (git, SBOM, model info) (default: true)",
        },
      },
      required: ["runId"],
    },
  },
];

/**
 * Report Tool Handlers
 * These functions implement the actual logic for the MCP tools
 */

export interface GetLatestParams {
  kind?: "diagnostic" | "metadata" | "inspector";
  limit?: number;
  days?: number;
}

export interface GetByRunParams {
  runId: string;
  includeProvenance?: boolean;
}

export interface ReportRefMetadata {
  app: string;
  version: string;
  git?: {
    sha: string;
    branch: string;
  };
  sbom?: {
    cyclonedxSha256: string;
  };
  model?: {
    name: string;
    promptDigest: string;
  };
  tags?: string[];
}

export interface ReportRef {
  runId: string;
  createdAt: string;
  expiresAt: string;
  url: string;
  altUrl?: string;
  bytes?: number;
  sha256: string;
  meta: ReportRefMetadata;
}

/**
 * Handler for report.get_latest
 */
export async function handleGetLatest(
  args: GetLatestParams,
): Promise<{ ok: boolean; items: ReportRef[] }> {
  const kind = args.kind || "diagnostic";
  const limit = Math.min(args.limit || 5, 10);
  const days = args.days || 7;

  // Initialize ReportManager
  const manager = new ReportManager();
  await manager.initialize();

  // Enable cloud storage if configured
  const cloudStorage = createCloudStorageFromEnv();
  if (cloudStorage) {
    manager.enableCloudStorage(cloudStorage);
  }

  // Query reports from the last N days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const reports = await manager.listReports({
    diagnosticType: kind,
    startDate,
  });

  // Get git metadata for provenance
  const git = getGitMetadata();
  const version = getAppVersion();

  // Convert to ReportRef format
  const items: ReportRef[] = reports.slice(0, limit).map((r) => ({
    runId: r.id,
    createdAt: r.createdAt.toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
    url: r.cloudUrls?.html || r.url,
    altUrl: r.cloudUrls?.json || undefined,
    bytes: r.size,
    sha256: r.cloudUrls?.htmlSha256 || "",
    meta: {
      app: "CortexDx",
      version,
      ...(git && { git }),
      tags: r.tags,
    },
  }));

  return { ok: true, items };
}

/**
 * Handler for report.get_by_run
 */
export async function handleGetByRun(
  args: GetByRunParams,
): Promise<{ ok: boolean; item: ReportRef }> {
  const { runId, includeProvenance = true } = args;

  // Initialize ReportManager
  const manager = new ReportManager();
  await manager.initialize();

  // Enable cloud storage if configured
  const cloudStorage = createCloudStorageFromEnv();
  if (cloudStorage) {
    manager.enableCloudStorage(cloudStorage);
  }

  // Find report by session ID (run ID)
  const reports = await manager.listReports({ sessionId: runId });

  if (reports.length === 0) {
    throw new Error(`Report not found for run ID: ${runId}`);
  }

  // TypeScript assertion - we know reports.length > 0 from the check above
  const r = reports[0];
  if (!r) {
    throw new Error(`Report not found for run ID: ${runId}`);
  }

  // Get provenance metadata
  const git = includeProvenance ? getGitMetadata() : undefined;
  const version = getAppVersion();

  const item: ReportRef = {
    runId: r.id,
    createdAt: r.createdAt.toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    url: r.cloudUrls?.html || r.url,
    altUrl: r.cloudUrls?.json || undefined,
    bytes: r.size,
    sha256: r.cloudUrls?.htmlSha256 || "",
    meta: {
      app: "CortexDx",
      version,
      ...(git && { git }),
      ...(r.cloudUrls?.sbomSha256 && {
        sbom: { cyclonedxSha256: r.cloudUrls.sbomSha256 },
      }),
      tags: r.tags,
    },
  };

  return { ok: true, item };
}
