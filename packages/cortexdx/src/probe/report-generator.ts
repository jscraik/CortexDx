/**
 * Report Generator
 * Generates diagnostic reports in multiple formats (Markdown, JSON, ArcTDD)
 */

import type { Finding } from "../types.js";
import type { ProbeMetadata, DiagnosticSummary } from "./mcp-probe-engine.js";

export interface DiagnosticReport {
    id: string;
    targetUrl: string;
    timestamp: string;
    duration: number;
    summary: DiagnosticSummary;
    metadata: ProbeMetadata;
    findings: Finding[];
    markdown: string;
    json: string;
}

/**
 * Generate complete diagnostic report
 */
export function generateReport(
    reportId: string,
    targetUrl: string,
    summary: DiagnosticSummary,
    metadata: ProbeMetadata,
    findings: Finding[],
    duration: number
): DiagnosticReport {
    const timestamp = new Date().toISOString();

    const report: DiagnosticReport = {
        id: reportId,
        targetUrl,
        timestamp,
        duration,
        summary,
        metadata,
        findings,
        markdown: generateMarkdownReport(reportId, targetUrl, summary, metadata, findings, duration, timestamp),
        json: generateJsonReport(reportId, targetUrl, summary, metadata, findings, duration, timestamp)
    };

    return report;
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(
    reportId: string,
    targetUrl: string,
    summary: DiagnosticSummary,
    metadata: ProbeMetadata,
    findings: Finding[],
    duration: number,
    timestamp: string
): string {
    const { compliant, score, totalFindings, criticalFindings } = summary;

    let md = `# CortexDx MCP Diagnostic Report\n\n`;
    md += `**Report ID:** \`${reportId}\`  \n`;
    md += `**Target Server:** ${targetUrl}  \n`;
    md += `**Timestamp:** ${timestamp}  \n`;
    md += `**Duration:** ${duration}ms  \n\n`;

    // Summary Section
    md += `## Executive Summary\n\n`;
    md += `**Compliance Score:** ${score}/100 ${getScoreEmoji(score)}  \n`;
    md += `**Status:** ${compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}  \n`;
    md += `**Total Findings:** ${totalFindings}  \n`;
    md += `**Critical Issues:** ${criticalFindings}  \n\n`;

    if (score >= 90) {
        md += `🎉 **Excellent!** This MCP server demonstrates high protocol compliance and best practices.\n\n`;
    } else if (score >= 70) {
        md += `⚠️ **Good** with room for improvement. Address the findings below to achieve full compliance.\n\n`;
    } else if (score >= 50) {
        md += `⚠️ **Needs Attention.** Several compliance and security issues need to be resolved.\n\n`;
    } else {
        md += `🚨 **Critical Issues Detected.** Immediate action required to meet MCP protocol standards.\n\n`;
    }

    // Server Information
    md += `## Server Information\n\n`;
    if (metadata.serverInfo) {
        md += `- **Name:** ${metadata.serverInfo.name}\n`;
        md += `- **Version:** ${metadata.serverInfo.version}\n`;
    }
    if (metadata.protocolVersion) {
        md += `- **Protocol Version:** ${metadata.protocolVersion}\n`;
    }
    md += `- **Tools:** ${metadata.tools.length}\n`;
    md += `- **Resources:** ${metadata.resources.length}\n\n`;

    // Capabilities
    if (Object.keys(metadata.capabilities).length > 0) {
        md += `### Capabilities\n\n`;
        md += `\`\`\`json\n${JSON.stringify(metadata.capabilities, null, 2)}\n\`\`\`\n\n`;
    }

    // Tools
    if (metadata.tools.length > 0) {
        md += `### Tools (${metadata.tools.length})\n\n`;
        metadata.tools.slice(0, 10).forEach(tool => {
            md += `- **${tool.name}** - ${tool.description || 'No description'}\n`;
        });
        if (metadata.tools.length > 10) {
            md += `\n*...and ${metadata.tools.length - 10} more*\n`;
        }
        md += `\n`;
    }

    // Resources
    if (metadata.resources.length > 0) {
        md += `### Resources (${metadata.resources.length})\n\n`;
        metadata.resources.slice(0, 10).forEach(resource => {
            md += `- **${resource.name}** - \`${resource.uri}\`\n`;
        });
        if (metadata.resources.length > 10) {
            md += `\n*...and ${metadata.resources.length - 10} more*\n`;
        }
        md += `\n`;
    }

    // Findings by Severity
    md += `## Diagnostic Findings\n\n`;

    const findingsBySeverity = {
        blocker: findings.filter(f => f.severity === 'blocker'),
        major: findings.filter(f => f.severity === 'major'),
        minor: findings.filter(f => f.severity === 'minor'),
        info: findings.filter(f => f.severity === 'info')
    };

    if (findingsBySeverity.blocker.length > 0) {
        md += `### 🚨 Critical Issues (${findingsBySeverity.blocker.length})\n\n`;
        findingsBySeverity.blocker.forEach(f => md += formatFinding(f));
    }

    if (findingsBySeverity.major.length > 0) {
        md += `### ⚠️ Major Issues (${findingsBySeverity.major.length})\n\n`;
        findingsBySeverity.major.forEach(f => md += formatFinding(f));
    }

    if (findingsBySeverity.minor.length > 0) {
        md += `### ℹ️ Minor Issues (${findingsBySeverity.minor.length})\n\n`;
        findingsBySeverity.minor.forEach(f => md += formatFinding(f));
    }

    if (findingsBySeverity.info.length > 0) {
        md += `### ✓ Informational (${findingsBySeverity.info.length})\n\n`;
        findingsBySeverity.info.forEach(f => md += formatFinding(f));
    }

    // Recommendations
    md += `## Recommendations\n\n`;
    const recommendations = generateRecommendations(summary, findings);
    recommendations.forEach((rec, idx) => {
        md += `${idx + 1}. ${rec}\n`;
    });
    md += `\n`;

    // Footer
    md += `---\n\n`;
    md += `*Report generated by CortexDx MCP Meta-Inspector*  \n`;
    md += `*Protocol: MCP v2024-11-05*  \n`;
    md += `*For questions or support, visit https://github.com/jscraik/CortexDx*\n`;

    return md;
}

/**
 * Generate JSON report
 */
function generateJsonReport(
    reportId: string,
    targetUrl: string,
    summary: DiagnosticSummary,
    metadata: ProbeMetadata,
    findings: Finding[],
    duration: number,
    timestamp: string
): string {
    const report = {
        reportId,
        targetUrl,
        timestamp,
        duration,
        summary,
        metadata,
        findings: findings.map(f => ({
            id: f.id,
            area: f.area,
            severity: f.severity,
            title: f.title,
            description: f.description,
            evidence: f.evidence,
            recommendation: f.recommendation,
            confidence: f.confidence,
            tags: f.tags
        })),
        recommendations: generateRecommendations(summary, findings),
        generator: {
            name: 'CortexDx MCP Meta-Inspector',
            version: '1.0.0',
            protocol: 'MCP v2024-11-05'
        }
    };

    return JSON.stringify(report, null, 2);
}

/**
 * Format a single finding for markdown
 */
function formatFinding(finding: Finding): string {
    let md = `#### ${finding.title}\n\n`;
    md += `**ID:** \`${finding.id}\`  \n`;
    md += `**Area:** ${finding.area}  \n`;
    md += `**Severity:** ${finding.severity}  \n\n`;
    md += `${finding.description}\n\n`;

    if (finding.recommendation) {
        md += `**Recommendation:** ${finding.recommendation}\n\n`;
    }

    if (finding.evidence && finding.evidence.length > 0) {
        md += `**Evidence:**\n`;
        finding.evidence.forEach(ev => {
            if (ev.type === 'url') {
                md += `- 🔗 URL: ${ev.ref}\n`;
            } else if (ev.type === 'log') {
                md += `- 📄 Log: ${ev.ref}\n`;
            } else if (ev.type === 'file') {
                md += `- 📁 File: ${ev.ref}\n`;
            }
        });
        md += `\n`;
    }

    md += `---\n\n`;
    return md;
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(summary: DiagnosticSummary, findings: Finding[]): string[] {
    const recommendations: string[] = [];

    if (summary.criticalFindings > 0) {
        recommendations.push('**Immediate Action Required:** Address all critical (blocker) issues before deploying to production.');
    }

    const protocolIssues = findings.filter(f => f.area === 'protocol' && f.severity !== 'info');
    if (protocolIssues.length > 0) {
        recommendations.push('Review and fix protocol compliance issues to ensure compatibility with MCP clients.');
    }

    const securityIssues = findings.filter(f =>
        (f.area === 'auth' || f.area === 'security' || f.area === 'cors') &&
        f.severity !== 'info'
    );
    if (securityIssues.length > 0) {
        recommendations.push('Address security vulnerabilities to prevent unauthorized access and data breaches.');
    }

    const performanceIssues = findings.filter(f => f.area === 'performance' && f.severity !== 'info');
    if (performanceIssues.length > 0) {
        recommendations.push('Optimize performance to meet response time and throughput requirements.');
    }

    if (summary.score < 70) {
        recommendations.push('Consider a comprehensive code review and refactoring to improve overall quality.');
    }

    if (recommendations.length === 0) {
        recommendations.push('Continue monitoring and maintaining best practices. Great work!');
    }

    return recommendations;
}

/**
 * Get emoji based on score
 */
function getScoreEmoji(score: number): string {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    if (score >= 50) return '🟠';
    return '🔴';
}
