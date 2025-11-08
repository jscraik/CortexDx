import type { Finding } from "../types.js";
import type { DiagnosticReport, ReportMetadata } from "./report-manager.js";

export interface OptimizedResponse {
    summary: string;
    reportUrl: string;
    findingsSummary: FindingSummary;
    criticalFindings?: Finding[];
    metadata: {
        reportId: string;
        sessionId: string;
        diagnosticType: string;
        timestamp: string;
        durationMs: number;
    };
}

export interface FindingSummary {
    total: number;
    bySevert: {
        blocker: number;
        major: number;
        minor: number;
        info: number;
    };
    topIssues: Array<{
        severity: string;
        title: string;
        area: string;
    }>;
}

export interface ReportSearchResult {
    reports: Array<{
        id: string;
        url: string;
        diagnosticType: string;
        timestamp: string;
        findingsCount: number;
    }>;
    total: number;
}

export class ReportOptimizer {
    /**
     * Create an optimized response that returns URLs instead of full content
     * to minimize token usage in MCP tool responses (Req 19.5)
     */
    static optimizeResponse(
        report: DiagnosticReport,
        metadata: ReportMetadata
    ): OptimizedResponse {
        const findingsSummary = this.summarizeFindings(report.findings);

        // Only include critical findings (blocker/major) in response
        const criticalFindings = report.findings
            .filter(f => f.severity === "blocker" || f.severity === "major")
            .slice(0, 3) // Limit to top 3
            .map(f => ({
                ...f,
                // Truncate long descriptions
                description: f.description.length > 200
                    ? f.description.substring(0, 200) + "..."
                    : f.description,
            }));

        return {
            summary: this.generateSummary(report, findingsSummary),
            reportUrl: metadata.url,
            findingsSummary,
            criticalFindings: criticalFindings.length > 0 ? criticalFindings : undefined,
            metadata: {
                reportId: metadata.id,
                sessionId: report.sessionId,
                diagnosticType: report.diagnosticType,
                timestamp: report.inspectedAt,
                durationMs: report.durationMs,
            },
        };
    }

    /**
     * Summarize findings by severity and extract top issues
     */
    static summarizeFindings(findings: Finding[]): FindingSummary {
        const bySeverity = {
            blocker: 0,
            major: 0,
            minor: 0,
            info: 0,
        };

        for (const finding of findings) {
            bySeverity[finding.severity]++;
        }

        // Extract top 5 issues (prioritize by severity)
        const severityOrder = ["blocker", "major", "minor", "info"];
        const sortedFindings = [...findings].sort((a, b) => {
            const aIndex = severityOrder.indexOf(a.severity);
            const bIndex = severityOrder.indexOf(b.severity);
            return aIndex - bIndex;
        });

        const topIssues = sortedFindings.slice(0, 5).map(f => ({
            severity: f.severity,
            title: f.title,
            area: f.area,
        }));

        return {
            total: findings.length,
            bySevert: bySeverity,
            topIssues,
        };
    }

    /**
     * Generate a concise summary of the diagnostic report
     */
    static generateSummary(report: DiagnosticReport, summary: FindingSummary): string {
        const parts: string[] = [];

        if (summary.total === 0) {
            return `No issues found in ${report.diagnosticType} diagnostic.`;
        }

        parts.push(`Found ${summary.total} issue${summary.total === 1 ? "" : "s"} in ${report.diagnosticType} diagnostic:`);

        const severityCounts: string[] = [];
        if (summary.bySevert.blocker > 0) {
            severityCounts.push(`${summary.bySevert.blocker} blocker`);
        }
        if (summary.bySevert.major > 0) {
            severityCounts.push(`${summary.bySevert.major} major`);
        }
        if (summary.bySevert.minor > 0) {
            severityCounts.push(`${summary.bySevert.minor} minor`);
        }
        if (summary.bySevert.info > 0) {
            severityCounts.push(`${summary.bySevert.info} info`);
        }

        parts.push(severityCounts.join(", "));

        return parts.join(" ");
    }

    /**
     * Filter reports based on criteria
     */
    static filterReports(
        reports: ReportMetadata[],
        options: {
            minSeverity?: string;
            diagnosticType?: string;
            limit?: number;
        }
    ): ReportMetadata[] {
        let filtered = reports;

        if (options.diagnosticType) {
            filtered = filtered.filter(r => r.diagnosticType === options.diagnosticType);
        }

        if (options.limit) {
            filtered = filtered.slice(0, options.limit);
        }

        return filtered;
    }

    /**
     * Create a search result response optimized for token usage
     */
    static optimizeSearchResults(
        reports: ReportMetadata[],
        limit: number = 10
    ): ReportSearchResult {
        const limitedReports = reports.slice(0, limit);

        return {
            reports: limitedReports.map(r => ({
                id: r.id,
                url: r.url,
                diagnosticType: r.diagnosticType,
                timestamp: r.createdAt.toISOString(),
                findingsCount: 0, // Would need to be populated from report content
            })),
            total: reports.length,
        };
    }

    /**
     * Calculate token savings by using URL-based responses
     */
    static estimateTokenSavings(report: DiagnosticReport): {
        fullReportTokens: number;
        optimizedTokens: number;
        savings: number;
        savingsPercent: number;
    } {
        // Rough estimation: 1 token ≈ 4 characters
        const fullReportJson = JSON.stringify(report);
        const fullReportTokens = Math.ceil(fullReportJson.length / 4);

        // Optimized response includes only summary + URL + top findings
        const optimizedJson = JSON.stringify({
            summary: this.generateSummary(report, this.summarizeFindings(report.findings)),
            reportUrl: "http://localhost:5001/reports/example",
            findingsSummary: this.summarizeFindings(report.findings),
            criticalFindings: report.findings
                .filter(f => f.severity === "blocker" || f.severity === "major")
                .slice(0, 3),
        });
        const optimizedTokens = Math.ceil(optimizedJson.length / 4);

        const savings = fullReportTokens - optimizedTokens;
        const savingsPercent = (savings / fullReportTokens) * 100;

        return {
            fullReportTokens,
            optimizedTokens,
            savings,
            savingsPercent,
        };
    }
}
