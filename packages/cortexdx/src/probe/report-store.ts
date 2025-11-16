/**
 * Report Store
 * Manages storage and retrieval of diagnostic reports
 */

import Database from "better-sqlite3";
import { join } from "node:path";
import type { DiagnosticReport } from "./report-generator.js";

export interface StoredReport {
    id: string;
    targetUrl: string;
    timestamp: string;
    duration: number;
    score: number;
    compliant: boolean;
    markdown: string;
    json: string;
    createdAt: number;
    expiresAt: number;
}

/**
 * Report Store for managing diagnostic reports
 */
export class ReportStore {
    private db: Database.Database;
    private dbPath: string;

    constructor(dbPath?: string) {
        this.dbPath = dbPath || join(process.cwd(), '.cortexdx', 'diagnostic-reports.db');
        this.db = new Database(this.dbPath);
        this.initializeDatabase();
        this.startCleanupTimer();
    }

    /**
     * Initialize database schema
     */
    private initializeDatabase(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS diagnostic_reports (
                id TEXT PRIMARY KEY,
                target_url TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                duration INTEGER NOT NULL,
                score INTEGER NOT NULL,
                compliant INTEGER NOT NULL,
                markdown TEXT NOT NULL,
                json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_target_url
            ON diagnostic_reports(target_url);

            CREATE INDEX IF NOT EXISTS idx_expires_at
            ON diagnostic_reports(expires_at);

            CREATE INDEX IF NOT EXISTS idx_created_at
            ON diagnostic_reports(created_at DESC);
        `);
    }

    /**
     * Store a diagnostic report
     */
    storeReport(report: DiagnosticReport): void {
        const now = Date.now();
        const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days

        const stmt = this.db.prepare(`
            INSERT INTO diagnostic_reports
            (id, target_url, timestamp, duration, score, compliant, markdown, json, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            report.id,
            report.targetUrl,
            report.timestamp,
            report.duration,
            report.summary.score,
            report.summary.compliant ? 1 : 0,
            report.markdown,
            report.json,
            now,
            expiresAt
        );
    }

    /**
     * Retrieve a report by ID
     */
    getReport(reportId: string): StoredReport | null {
        const stmt = this.db.prepare(`
            SELECT * FROM diagnostic_reports
            WHERE id = ?
        `);

        const row = stmt.get(reportId) as {
            id: string;
            target_url: string;
            timestamp: string;
            duration: number;
            score: number;
            compliant: number;
            markdown: string;
            json: string;
            created_at: number;
            expires_at: number;
        } | undefined;

        if (!row) {
            return null;
        }

        // Check expiration
        if (row.expires_at < Date.now()) {
            return null;
        }

        return {
            id: row.id,
            targetUrl: row.target_url,
            timestamp: row.timestamp,
            duration: row.duration,
            score: row.score,
            compliant: Boolean(row.compliant),
            markdown: row.markdown,
            json: row.json,
            createdAt: row.created_at,
            expiresAt: row.expires_at
        };
    }

    /**
     * List all reports for a target URL
     */
    listReportsByTarget(targetUrl: string, limit: number = 10): StoredReport[] {
        const stmt = this.db.prepare(`
            SELECT * FROM diagnostic_reports
            WHERE target_url = ? AND expires_at > ?
            ORDER BY created_at DESC
            LIMIT ?
        `);

        const rows = stmt.all(targetUrl, Date.now(), limit) as Array<{
            id: string;
            target_url: string;
            timestamp: string;
            duration: number;
            score: number;
            compliant: number;
            markdown: string;
            json: string;
            created_at: number;
            expires_at: number;
        }>;

        return rows.map(row => ({
            id: row.id,
            targetUrl: row.target_url,
            timestamp: row.timestamp,
            duration: row.duration,
            score: row.score,
            compliant: Boolean(row.compliant),
            markdown: row.markdown,
            json: row.json,
            createdAt: row.created_at,
            expiresAt: row.expires_at
        }));
    }

    /**
     * List recent reports
     */
    listRecentReports(limit: number = 20): StoredReport[] {
        const stmt = this.db.prepare(`
            SELECT * FROM diagnostic_reports
            WHERE expires_at > ?
            ORDER BY created_at DESC
            LIMIT ?
        `);

        const rows = stmt.all(Date.now(), limit) as Array<{
            id: string;
            target_url: string;
            timestamp: string;
            duration: number;
            score: number;
            compliant: number;
            markdown: string;
            json: string;
            created_at: number;
            expires_at: number;
        }>;

        return rows.map(row => ({
            id: row.id,
            targetUrl: row.target_url,
            timestamp: row.timestamp,
            duration: row.duration,
            score: row.score,
            compliant: Boolean(row.compliant),
            markdown: row.markdown,
            json: row.json,
            createdAt: row.created_at,
            expiresAt: row.expires_at
        }));
    }

    /**
     * Delete a report
     */
    deleteReport(reportId: string): boolean {
        const stmt = this.db.prepare(`
            DELETE FROM diagnostic_reports
            WHERE id = ?
        `);

        const result = stmt.run(reportId);
        return result.changes > 0;
    }

    /**
     * Cleanup expired reports
     */
    cleanupExpiredReports(): number {
        const stmt = this.db.prepare(`
            DELETE FROM diagnostic_reports
            WHERE expires_at < ?
        `);

        const result = stmt.run(Date.now());
        return result.changes;
    }

    /**
     * Get report statistics
     */
    getStatistics(): {
        totalReports: number;
        activeReports: number;
        averageScore: number;
        complianceRate: number;
    } {
        const stats = this.db.prepare(`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN expires_at > ? THEN 1 END) as active,
                AVG(CASE WHEN expires_at > ? THEN score ELSE NULL END) as avg_score,
                AVG(CASE WHEN expires_at > ? THEN compliant ELSE NULL END) as compliance_rate
            FROM diagnostic_reports
        `).get(Date.now(), Date.now(), Date.now()) as {
            total: number;
            active: number;
            avg_score: number;
            compliance_rate: number;
        };

        return {
            totalReports: stats.total,
            activeReports: stats.active,
            averageScore: Math.round(stats.avg_score || 0),
            complianceRate: Math.round((stats.compliance_rate || 0) * 100)
        };
    }

    /**
     * Close database connection
     */
    close(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.db.close();
    }

    // Private helper methods

    private cleanupTimer?: NodeJS.Timeout;

    private startCleanupTimer(): void {
        // Run cleanup every 24 hours
        this.cleanupTimer = setInterval(() => {
            const cleaned = this.cleanupExpiredReports();
            if (cleaned > 0) {
                console.log(`[ReportStore] Cleaned up ${cleaned} expired reports`);
            }
        }, 24 * 60 * 60 * 1000);
    }
}

// Singleton instance
let reportStoreInstance: ReportStore | null = null;

/**
 * Get or create report store instance
 */
export function getReportStore(dbPath?: string): ReportStore {
    if (!reportStoreInstance) {
        reportStoreInstance = new ReportStore(dbPath);
    }
    return reportStoreInstance;
}
