import { safeParseJson } from "../utils/json.js";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Finding } from "../types.js";

export type ReportFormat = "json" | "markdown" | "html";

export interface StorageOptions {
  location?: string;
  organizationStrategy: "date" | "session" | "type" | "custom";
  retentionDays?: number;
  compress?: boolean;
}

export interface ReportMetadata {
  id: string;
  url: string;
  sessionId: string;
  diagnosticType: string;
  createdAt: Date;
  size: number;
  formats: ReportFormat[];
  path: string;
  tags: string[];
}

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  diagnosticType?: string;
  sessionId?: string;
  tags?: string[];
  minSeverity?: string;
}

export interface DiagnosticReport {
  id?: string;
  sessionId: string;
  diagnosticType: string;
  endpoint: string;
  inspectedAt: string;
  durationMs: number;
  findings: Finding[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ReportConfig {
  storageRoot: string;
  baseUrl: string;
  organizationStrategy: "date" | "session" | "type";
  retentionDays: number;
  enableCompression: boolean;
  formats: ReportFormat[];
}

const firstAvailableEnv = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const DEFAULT_CONFIG: ReportConfig = {
  storageRoot: firstAvailableEnv("CORTEXDX_REPORT_DIR") || "./reports",
  baseUrl:
    firstAvailableEnv("CORTEXDX_REPORT_URL") || "http://localhost:5001/reports",
  organizationStrategy: "date",
  retentionDays: 30,
  enableCompression: false,
  formats: ["json", "markdown", "html"],
};

export class ReportManager {
  private config: ReportConfig;
  private db: Database.Database | null = null;

  constructor(config?: Partial<ReportConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    // Create storage root directory
    await mkdir(this.config.storageRoot, { recursive: true });

    // Initialize SQLite index
    const dbPath = join(this.config.storageRoot, "index.db");
    this.db = new Database(dbPath);

    // Create reports table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        diagnostic_type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        size INTEGER NOT NULL,
        formats TEXT NOT NULL,
        path TEXT NOT NULL,
        tags TEXT,
        endpoint TEXT,
        duration_ms INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_session_id ON reports(session_id);
      CREATE INDEX IF NOT EXISTS idx_diagnostic_type ON reports(diagnostic_type);
      CREATE INDEX IF NOT EXISTS idx_created_at ON reports(created_at);
      CREATE INDEX IF NOT EXISTS idx_tags ON reports(tags);
    `);
  }

  async storeReport(
    report: DiagnosticReport,
    options?: StorageOptions,
  ): Promise<ReportMetadata> {
    if (!this.db) {
      await this.initialize();
    }

    const reportId = report.id || randomUUID();
    const opts = { ...this.config, ...options };

    // Determine storage path based on organization strategy
    const storagePath = this.getStoragePath(reportId, report, opts);
    await mkdir(dirname(storagePath), { recursive: true });

    // Store in multiple formats
    const formats: ReportFormat[] = opts.formats || this.config.formats;
    const sizes: number[] = [];

    for (const format of formats) {
      const content = this.formatReport(report, format);
      const filePath = `${storagePath}.${format}`;
      await writeFile(filePath, content, "utf-8");
      const stats = await stat(filePath);
      sizes.push(stats.size);
    }

    // Store metadata in SQLite index
    const metadata: ReportMetadata = {
      id: reportId,
      url: this.generateUrl(reportId),
      sessionId: report.sessionId,
      diagnosticType: report.diagnosticType,
      createdAt: new Date(),
      size: Math.max(...sizes),
      formats,
      path: storagePath,
      tags: report.tags || [],
    };

    this.db
      ?.prepare(`
      INSERT INTO reports (
        id, session_id, diagnostic_type, created_at, size, formats, path, tags, endpoint, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        metadata.id,
        metadata.sessionId,
        metadata.diagnosticType,
        metadata.createdAt.getTime(),
        metadata.size,
        JSON.stringify(metadata.formats),
        metadata.path,
        JSON.stringify(metadata.tags),
        report.endpoint,
        report.durationMs,
      );

    return metadata;
  }

  async retrieveReport(
    reportId: string,
    format: ReportFormat,
  ): Promise<string> {
    if (!this.db) {
      await this.initialize();
    }

    const row = this.db
      ?.prepare("SELECT path FROM reports WHERE id = ?")
      .get(reportId) as { path: string } | undefined;

    if (!row?.path) {
      throw new Error(`Report not found: ${reportId}`);
    }

    const filePath = `${row.path}.${format}`;

    if (!existsSync(filePath)) {
      throw new Error(`Report format not available: ${format}`);
    }

    return await readFile(filePath, "utf-8");
  }

  async deleteReport(reportId: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const row = this.db
      ?.prepare("SELECT path, formats FROM reports WHERE id = ?")
      .get(reportId) as { path: string; formats: string } | undefined;

    if (!row) {
      throw new Error(`Report not found: ${reportId}`);
    }

    // Delete all format files
    const formats = safeParseJson(row.formats) as ReportFormat[];
    for (const format of formats) {
      const filePath = `${row.path}.${format}`;
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    }

    // Remove from index
    this.db?.prepare("DELETE FROM reports WHERE id = ?").run(reportId);
  }

  generateUrl(reportId: string): string {
    return `${this.config.baseUrl}/${reportId}`;
  }

  async getReportByUrl(url: string, format: ReportFormat): Promise<string> {
    const reportId = url.split("/").pop();
    if (!reportId) {
      throw new Error("Invalid report URL");
    }
    return this.retrieveReport(reportId, format);
  }

  async listReports(filters?: ReportFilters): Promise<ReportMetadata[]> {
    if (!this.db) {
      await this.initialize();
    }

    let query = "SELECT * FROM reports WHERE 1=1";
    const params: unknown[] = [];

    if (filters?.startDate) {
      query += " AND created_at >= ?";
      params.push(filters.startDate.getTime());
    }

    if (filters?.endDate) {
      query += " AND created_at <= ?";
      params.push(filters.endDate.getTime());
    }

    if (filters?.diagnosticType) {
      query += " AND diagnostic_type = ?";
      params.push(filters.diagnosticType);
    }

    if (filters?.sessionId) {
      query += " AND session_id = ?";
      params.push(filters.sessionId);
    }

    query += " ORDER BY created_at DESC";

    const rows = this.db?.prepare(query).all(...params) as Array<{
      id: string;
      session_id: string;
      diagnostic_type: string;
      created_at: number;
      size: number;
      formats: string;
      path: string;
      tags: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      url: this.generateUrl(row.id),
      sessionId: row.session_id,
      diagnosticType: row.diagnostic_type,
      createdAt: new Date(row.created_at),
      size: row.size,
      formats: safeParseJson(row.formats) as ReportFormat[],
      path: row.path,
      tags: safeParseJson(row.tags || "[]") as string[],
    }));
  }

  async searchReports(query: string): Promise<ReportMetadata[]> {
    if (!this.db) {
      await this.initialize();
    }

    const rows = this.db
      ?.prepare(`
      SELECT * FROM reports 
      WHERE diagnostic_type LIKE ? OR tags LIKE ?
      ORDER BY created_at DESC
    `)
      .all(`%${query}%`, `%${query}%`) as Array<{
      id: string;
      session_id: string;
      diagnostic_type: string;
      created_at: number;
      size: number;
      formats: string;
      path: string;
      tags: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      url: this.generateUrl(row.id),
      sessionId: row.session_id,
      diagnosticType: row.diagnostic_type,
      createdAt: new Date(row.created_at),
      size: row.size,
      formats: safeParseJson(row.formats) as ReportFormat[],
      path: row.path,
      tags: safeParseJson(row.tags || "[]") as string[],
    }));
  }

  async setStorageLocation(location: string): Promise<void> {
    // Validate location
    try {
      await mkdir(location, { recursive: true });
      this.config.storageRoot = location;

      // Reinitialize with new location
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      await this.initialize();
    } catch (error) {
      throw new Error(`Invalid storage location: ${location}`);
    }
  }

  async getStorageLocation(): Promise<string> {
    return this.config.storageRoot;
  }

  async cleanupOldReports(): Promise<number> {
    if (!this.db) {
      await this.initialize();
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const rows = this.db
      ?.prepare("SELECT id FROM reports WHERE created_at < ?")
      .all(cutoffDate.getTime()) as Array<{ id: string }>;

    for (const row of rows) {
      await this.deleteReport(row.id);
    }

    return rows.length;
  }

  private getStoragePath(
    reportId: string,
    report: DiagnosticReport,
    options: StorageOptions,
  ): string {
    const base = options.location || this.config.storageRoot;
    const sessionId = report.sessionId ?? "unknown";
    const diagnosticType = report.diagnosticType ?? "unknown";

    switch (options.organizationStrategy) {
      case "date": {
        const dateStr = new Date().toISOString().split("T")[0] ?? "unknown";
        return join(base, "reports", dateStr, `session-${sessionId}`, reportId);
      }
      case "session":
        return join(base, "reports", `session-${sessionId}`, reportId);
      case "type":
        return join(base, "reports", diagnosticType, reportId);
      case "custom":
        return join(base, "reports", reportId);
      default:
        return join(base, "reports", reportId);
    }
  }

  private formatReport(report: DiagnosticReport, format: ReportFormat): string {
    switch (format) {
      case "json":
        return JSON.stringify(report, null, 2);
      case "markdown":
        return this.toMarkdown(report);
      case "html":
        return this.toHtml(report);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private toMarkdown(report: DiagnosticReport): string {
    const lines: string[] = [];
    lines.push("# CortexDx Diagnostic Report (brAInwav)");
    lines.push("");
    lines.push(`- **Report ID**: ${report.id || "N/A"}`);
    lines.push(`- **Session ID**: ${report.sessionId}`);
    lines.push(`- **Diagnostic Type**: ${report.diagnosticType}`);
    lines.push(`- **Endpoint**: ${report.endpoint}`);
    lines.push(`- **Date**: ${report.inspectedAt}`);
    lines.push(`- **Duration**: ${report.durationMs}ms`);

    if (report.tags && report.tags.length > 0) {
      lines.push(`- **Tags**: ${report.tags.join(", ")}`);
    }

    lines.push("");
    lines.push("## Findings");
    lines.push("");

    if (report.findings.length === 0) {
      lines.push("No issues found.");
    } else {
      for (const finding of report.findings) {
        lines.push(`### [${finding.severity.toUpperCase()}] ${finding.title}`);
        lines.push("");
        lines.push(finding.description);
        lines.push("");

        if (finding.evidence?.length) {
          lines.push("**Evidence:**");
          for (const ev of finding.evidence) {
            lines.push(`- ${ev.type}: ${ev.ref}`);
          }
          lines.push("");
        }

        if (finding.recommendation) {
          lines.push("**Recommendation:**");
          lines.push(finding.recommendation);
          lines.push("");
        }
      }
    }

    lines.push("---");
    lines.push("_Data policy: read-only; optional redacted HAR if --har._");
    return lines.join("\n");
  }

  private toHtml(report: DiagnosticReport): string {
    const findings = report.findings
      .map(
        (f) => `
      <div class="finding ${f.severity}">
        <h3>[${f.severity.toUpperCase()}] ${this.escapeHtml(f.title)}</h3>
        <p>${this.escapeHtml(f.description)}</p>
        ${
          f.evidence?.length
            ? `
          <div class="evidence">
            <strong>Evidence:</strong>
            <ul>
              ${f.evidence.map((e) => `<li>${e.type}: ${this.escapeHtml(e.ref)}</li>`).join("")}
            </ul>
          </div>
        `
            : ""
        }
        ${
          f.recommendation
            ? `
          <div class="recommendation">
            <strong>Recommendation:</strong>
            <p>${this.escapeHtml(f.recommendation)}</p>
          </div>
        `
            : ""
        }
      </div>
    `,
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CortexDx Diagnostic Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .metadata { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .metadata p { margin: 5px 0; }
    .finding { border-left: 4px solid #ccc; padding: 15px; margin: 20px 0; background: #fafafa; }
    .finding.blocker { border-color: #d32f2f; }
    .finding.major { border-color: #f57c00; }
    .finding.minor { border-color: #fbc02d; }
    .finding.info { border-color: #1976d2; }
    .evidence, .recommendation { margin-top: 10px; }
    .evidence ul { margin: 5px 0; padding-left: 20px; }
    footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>CortexDx Diagnostic Report (brAInwav)</h1>
  
  <div class="metadata">
    <p><strong>Report ID:</strong> ${this.escapeHtml(report.id || "N/A")}</p>
    <p><strong>Session ID:</strong> ${this.escapeHtml(report.sessionId)}</p>
    <p><strong>Diagnostic Type:</strong> ${this.escapeHtml(report.diagnosticType)}</p>
    <p><strong>Endpoint:</strong> ${this.escapeHtml(report.endpoint)}</p>
    <p><strong>Date:</strong> ${this.escapeHtml(report.inspectedAt)}</p>
    <p><strong>Duration:</strong> ${report.durationMs}ms</p>
    ${report.tags?.length ? `<p><strong>Tags:</strong> ${report.tags.map((t) => this.escapeHtml(t)).join(", ")}</p>` : ""}
  </div>

  <h2>Findings</h2>
  ${report.findings.length === 0 ? "<p>No issues found.</p>" : findings}

  <footer>
    <p><em>Data policy: read-only; optional redacted HAR if --har.</em></p>
  </footer>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m] || m);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
