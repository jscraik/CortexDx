/**
 * Performance Analysis Plugin
 * Analyzes MCP server performance and provides optimization recommendations
 */

import type { DevelopmentContext, DevelopmentPlugin, Finding, PerformanceMetrics } from "../../types.js";

// Helper functions
async function analyzeEndpointPerformance(endpoint: string): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    let responseTimeMs = 0;
    let memoryUsageMb = 0;
    let cpuUsagePercent = 0;

    try {
        // Simple health check to measure response time
        const response = await fetch(`${endpoint}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });

        responseTimeMs = Date.now() - startTime;

        // Get basic system metrics (simplified)
        memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
        cpuUsagePercent = process.cpuUsage().user / 1000; // Simplified CPU usage

    } catch (error) {
        responseTimeMs = Date.now() - startTime;
        // Use fallback metrics if endpoint is not accessible
    }

    return {
        responseTimeMs,
        memoryUsageMb,
        cpuUsagePercent,
        diagnosticTimeMs: responseTimeMs,
        timestamp: Date.now()
    };
}

function generatePerformanceFindings(metrics: PerformanceMetrics): Finding[] {
    const findings: Finding[] = [];

    // Response time analysis
    if (metrics.responseTimeMs > 2000) {
        findings.push({
            id: "performance.response.slow",
            area: "performance",
            severity: metrics.responseTimeMs > 5000 ? "major" : "minor",
            title: "Slow response time detected",
            description: `Server response time is ${metrics.responseTimeMs}ms, which exceeds recommended thresholds.`,
            evidence: [{ type: "log", ref: "performance-metrics" }],
            recommendation: "Consider optimizing server performance, checking network connectivity, or implementing caching strategies.",
            remediation: {
                steps: [
                    "Profile server code for bottlenecks",
                    "Implement response caching where appropriate",
                    "Optimize database queries if applicable",
                    "Consider load balancing for high traffic"
                ]
            }
        });
    } else if (metrics.responseTimeMs < 500) {
        findings.push({
            id: "performance.response.good",
            area: "performance",
            severity: "info",
            title: "Good response time performance",
            description: `Server response time is ${metrics.responseTimeMs}ms, which meets performance targets.`,
            evidence: [{ type: "log", ref: "performance-metrics" }]
        });
    }

    // Memory usage analysis
    if (metrics.memoryUsageMb > 512) {
        findings.push({
            id: "performance.memory.high",
            area: "performance",
            severity: metrics.memoryUsageMb > 1024 ? "major" : "minor",
            title: "High memory usage detected",
            description: `Memory usage is ${metrics.memoryUsageMb.toFixed(2)}MB, which may indicate memory leaks or inefficient resource usage.`,
            evidence: [{ type: "log", ref: "memory-metrics" }],
            recommendation: "Review memory usage patterns, implement proper resource cleanup, and consider memory profiling.",
            remediation: {
                steps: [
                    "Profile memory usage to identify leaks",
                    "Implement proper resource disposal",
                    "Review large object allocations",
                    "Consider implementing memory limits"
                ]
            }
        });
    }

    return findings;
}

interface PerformanceProjectContext {
    type?: string;
    language?: string;
    dependencies?: string[];
    sourceFiles?: string[];
}

function analyzeProjectPerformance(projectContext: PerformanceProjectContext): Finding[] {
    const findings: Finding[] = [];
    const { type, language, dependencies = [], sourceFiles = [] } = projectContext;

    // Check for performance-related dependencies
    const performanceDeps = dependencies.filter((dep: string) =>
        dep.includes("cache") ||
        dep.includes("redis") ||
        dep.includes("memory") ||
        dep.includes("cluster")
    );

    if (performanceDeps.length === 0 && type === "mcp-server") {
        findings.push({
            id: "performance.dependencies.missing",
            area: "performance",
            severity: "info",
            title: "No performance optimization dependencies",
            description: "Project doesn't include common performance optimization libraries.",
            evidence: [{ type: "file", ref: "package.json" }],
            recommendation: "Consider adding caching, clustering, or other performance optimization libraries based on your use case."
        });
    }

    // Check for large number of source files (potential complexity issue)
    if (sourceFiles.length > 50) {
        findings.push({
            id: "performance.complexity.high",
            area: "performance",
            severity: "minor",
            title: "High project complexity detected",
            description: `Project has ${sourceFiles.length} source files, which may impact build and runtime performance.`,
            evidence: [{ type: "file", ref: "project-structure" }],
            recommendation: "Consider modularizing the codebase, implementing lazy loading, or optimizing build processes."
        });
    }

    return findings;
}

export const PerformanceAnalysisPlugin: DevelopmentPlugin = {
    id: "performance-analysis",
    title: "MCP Performance Analysis",
    category: "development",
    order: 4,
    requiresLlm: false,

    async run(ctx: DevelopmentContext): Promise<Finding[]> {
        const findings: Finding[] = [];

        try {
            // Analyze endpoint performance if available
            if (ctx.endpoint) {
                const metrics = await analyzeEndpointPerformance(ctx.endpoint);
                findings.push(...generatePerformanceFindings(metrics));
            }

            // Check for performance-related conversation topics
            const recentMessages = ctx.conversationHistory.slice(-5);
            const hasPerformanceIssues = recentMessages.some(msg =>
                msg.content.toLowerCase().includes("slow") ||
                msg.content.toLowerCase().includes("performance") ||
                msg.content.toLowerCase().includes("timeout") ||
                msg.content.toLowerCase().includes("memory")
            );

            if (hasPerformanceIssues) {
                findings.push({
                    id: "performance.issues.detected",
                    area: "performance",
                    severity: "minor",
                    title: "Performance concerns mentioned",
                    description: "Recent conversation indicates potential performance issues.",
                    evidence: [{ type: "log", ref: "conversation-history" }],
                    recommendation: "I can help analyze your MCP server performance and suggest optimizations. Would you like me to run a detailed performance analysis?"
                });
            }

            // Analyze project structure for performance opportunities
            if (ctx.projectContext) {
                findings.push(...analyzeProjectPerformance(ctx.projectContext));
            }

        } catch (error) {
            findings.push({
                id: "performance.analysis.error",
                area: "performance",
                severity: "minor",
                title: "Performance analysis failed",
                description: `Could not complete performance analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
                evidence: [{ type: "log", ref: "performance-analysis" }],
                recommendation: "Check endpoint accessibility and try again."
            });
        }

        return findings;
    }
};