/**
 * Comprehensive health check system for Insula MCP
 * Provides detailed health status for all system components
 */

import type { DiagnosticContext } from "../types.js";

export interface HealthCheckResult {
    status: "healthy" | "degraded" | "unhealthy";
    component: string;
    message?: string;
    details?: Record<string, unknown>;
    timestamp: string;
    responseTimeMs?: number;
}

export interface SystemHealthReport {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    uptime: number;
    version: string;
    checks: HealthCheckResult[];
    metrics: SystemMetrics;
}

export interface SystemMetrics {
    memory: MemoryMetrics;
    performance: PerformanceMetrics;
    operations: OperationMetrics;
}

export interface MemoryMetrics {
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
    rss: number;
    heapUsagePercent: number;
}

export interface PerformanceMetrics {
    avgResponseTimeMs: number;
    p95ResponseTimeMs: number;
    p99ResponseTimeMs: number;
    requestsPerSecond: number;
    errorRate: number;
}

export interface OperationMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    activeConnections: number;
    diagnosticsRun: number;
    conversationsActive: number;
}

export interface HealthCheckConfig {
    enableDetailedChecks: boolean;
    timeout: number;
    includeMetrics: boolean;
}

// Global metrics tracking
const metrics = {
    startTime: Date.now(),
    requests: [] as number[],
    responseTimes: [] as number[],
    errors: 0,
    activeConnections: 0,
    diagnosticsRun: 0,
    conversationsActive: 0,
};

/**
 * Record a request for metrics tracking
 */
export const recordRequest = (responseTimeMs: number, success: boolean): void => {
    const now = Date.now();
    metrics.requests.push(now);
    metrics.responseTimes.push(responseTimeMs);

    if (!success) {
        metrics.errors++;
    }

    // Keep only last 1000 requests for memory efficiency
    if (metrics.requests.length > 1000) {
        metrics.requests.shift();
        metrics.responseTimes.shift();
    }
};

/**
 * Update active connections count
 */
export const updateActiveConnections = (delta: number): void => {
    metrics.activeConnections = Math.max(0, metrics.activeConnections + delta);
};

/**
 * Record diagnostic run
 */
export const recordDiagnostic = (): void => {
    metrics.diagnosticsRun++;
};

/**
 * Update active conversations count
 */
export const updateConversations = (delta: number): void => {
    metrics.conversationsActive = Math.max(0, metrics.conversationsActive + delta);
};

/**
 * Get memory metrics
 */
export const getMemoryMetrics = (): MemoryMetrics => {
    const mem = process.memoryUsage();
    const heapUsedMb = mem.heapUsed / 1024 / 1024;
    const heapTotalMb = mem.heapTotal / 1024 / 1024;

    return {
        heapUsedMb: Math.round(heapUsedMb * 100) / 100,
        heapTotalMb: Math.round(heapTotalMb * 100) / 100,
        externalMb: Math.round((mem.external / 1024 / 1024) * 100) / 100,
        rss: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        heapUsagePercent: Math.round((heapUsedMb / heapTotalMb) * 100),
    };
};

/**
 * Get performance metrics
 */
export const getPerformanceMetrics = (): PerformanceMetrics => {
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Filter requests from last second
    const recentRequests = metrics.requests.filter((t) => t > oneSecondAgo);
    const recentResponseTimes = metrics.responseTimes.slice(-recentRequests.length);

    // Calculate average response time
    const avgResponseTime =
        recentResponseTimes.length > 0
            ? recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length
            : 0;

    // Calculate percentiles
    const sortedTimes = [...metrics.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    const totalRequests = metrics.requests.length;
    const errorRate = totalRequests > 0 ? metrics.errors / totalRequests : 0;

    return {
        avgResponseTimeMs: Math.round(avgResponseTime * 100) / 100,
        p95ResponseTimeMs: sortedTimes[p95Index] || 0,
        p99ResponseTimeMs: sortedTimes[p99Index] || 0,
        requestsPerSecond: recentRequests.length,
        errorRate: Math.round(errorRate * 10000) / 100, // percentage
    };
};

/**
 * Get operation metrics
 */
export const getOperationMetrics = (): OperationMetrics => {
    const totalRequests = metrics.requests.length;
    const failedRequests = metrics.errors;

    return {
        totalRequests,
        successfulRequests: totalRequests - failedRequests,
        failedRequests,
        activeConnections: metrics.activeConnections,
        diagnosticsRun: metrics.diagnosticsRun,
        conversationsActive: metrics.conversationsActive,
    };
};

/**
 * Check memory health
 */
export const checkMemoryHealth = (): HealthCheckResult => {
    const startTime = Date.now();
    const mem = getMemoryMetrics();

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    let message = "Memory usage is normal";

    if (mem.heapUsagePercent > 90) {
        status = "unhealthy";
        message = "Critical: Memory usage above 90%";
    } else if (mem.heapUsagePercent > 75) {
        status = "degraded";
        message = "Warning: Memory usage above 75%";
    }

    return {
        status,
        component: "memory",
        message,
        details: mem as unknown as Record<string, unknown>,
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
    };
};

/**
 * Check performance health
 */
export const checkPerformanceHealth = (): HealthCheckResult => {
    const startTime = Date.now();
    const perf = getPerformanceMetrics();

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    let message = "Performance is normal";

    if (perf.avgResponseTimeMs > 5000) {
        status = "unhealthy";
        message = "Critical: Average response time above 5s";
    } else if (perf.avgResponseTimeMs > 2000) {
        status = "degraded";
        message = "Warning: Average response time above 2s";
    }

    if (perf.errorRate > 10) {
        status = "unhealthy";
        message = "Critical: Error rate above 10%";
    } else if (perf.errorRate > 5) {
        status = status === "unhealthy" ? "unhealthy" : "degraded";
        message = "Warning: Error rate above 5%";
    }

    return {
        status,
        component: "performance",
        message,
        details: perf as unknown as Record<string, unknown>,
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
    };
};

/**
 * Check LLM backend health
 */
export const checkLlmHealth = async (ctx?: DiagnosticContext): Promise<HealthCheckResult> => {
    const startTime = Date.now();

    try {
        // Check if LLM is available
        if (!ctx?.llm) {
            return {
                status: "degraded",
                component: "llm",
                message: "LLM backend not configured",
                timestamp: new Date().toISOString(),
                responseTimeMs: Date.now() - startTime,
            };
        }

        // Try a simple completion to verify LLM is working
        const testPrompt = "test";
        await ctx.llm.complete(testPrompt, 10);

        return {
            status: "healthy",
            component: "llm",
            message: "LLM backend is operational",
            timestamp: new Date().toISOString(),
            responseTimeMs: Date.now() - startTime,
        };
    } catch (error) {
        return {
            status: "unhealthy",
            component: "llm",
            message: `LLM backend error: ${error instanceof Error ? error.message : "Unknown error"}`,
            timestamp: new Date().toISOString(),
            responseTimeMs: Date.now() - startTime,
        };
    }
};

/**
 * Check academic providers health
 */
export const checkProvidersHealth = async (ctx: DiagnosticContext): Promise<HealthCheckResult> => {
    const startTime = Date.now();

    try {
        const { getAcademicRegistry } = await import("../registry/index.js");
        const registry = getAcademicRegistry();

        const healthResults = await registry.performHealthChecks(ctx);
        const providers = Object.keys(healthResults);
        const healthyProviders = providers.filter((p) => healthResults[p]);

        const healthyPercent = (healthyProviders.length / providers.length) * 100;

        let status: "healthy" | "degraded" | "unhealthy" = "healthy";
        let message = `All ${providers.length} providers are healthy`;

        if (healthyPercent < 50) {
            status = "unhealthy";
            message = `Critical: Only ${healthyProviders.length}/${providers.length} providers healthy`;
        } else if (healthyPercent < 80) {
            status = "degraded";
            message = `Warning: ${healthyProviders.length}/${providers.length} providers healthy`;
        }

        return {
            status,
            component: "providers",
            message,
            details: {
                total: providers.length,
                healthy: healthyProviders.length,
                unhealthy: providers.length - healthyProviders.length,
                providers: healthResults,
            },
            timestamp: new Date().toISOString(),
            responseTimeMs: Date.now() - startTime,
        };
    } catch (error) {
        return {
            status: "unhealthy",
            component: "providers",
            message: `Provider health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            timestamp: new Date().toISOString(),
            responseTimeMs: Date.now() - startTime,
        };
    }
};

/**
 * Perform comprehensive system health check
 */
export const performHealthCheck = async (
    ctx?: DiagnosticContext,
    config: Partial<HealthCheckConfig> = {}
): Promise<SystemHealthReport> => {
    const fullConfig: HealthCheckConfig = {
        enableDetailedChecks: true,
        timeout: 5000,
        includeMetrics: true,
        ...config,
    };

    const checks: HealthCheckResult[] = [];

    // Always check memory and performance
    checks.push(checkMemoryHealth());
    checks.push(checkPerformanceHealth());

    // Detailed checks if enabled
    if (fullConfig.enableDetailedChecks && ctx) {
        try {
            const llmCheck = await Promise.race([
                checkLlmHealth(ctx),
                new Promise<HealthCheckResult>((resolve) =>
                    setTimeout(
                        () =>
                            resolve({
                                status: "degraded",
                                component: "llm",
                                message: "Health check timed out",
                                timestamp: new Date().toISOString(),
                            }),
                        fullConfig.timeout
                    )
                ),
            ]);
            checks.push(llmCheck);

            const providersCheck = await Promise.race([
                checkProvidersHealth(ctx),
                new Promise<HealthCheckResult>((resolve) =>
                    setTimeout(
                        () =>
                            resolve({
                                status: "degraded",
                                component: "providers",
                                message: "Health check timed out",
                                timestamp: new Date().toISOString(),
                            }),
                        fullConfig.timeout
                    )
                ),
            ]);
            checks.push(providersCheck);
        } catch (error) {
            checks.push({
                status: "unhealthy",
                component: "detailed-checks",
                message: `Detailed checks failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                timestamp: new Date().toISOString(),
            });
        }
    }

    // Determine overall status
    const hasUnhealthy = checks.some((c) => c.status === "unhealthy");
    const hasDegraded = checks.some((c) => c.status === "degraded");

    const overallStatus = hasUnhealthy ? "unhealthy" : hasDegraded ? "degraded" : "healthy";

    const systemMetrics: SystemMetrics = {
        memory: getMemoryMetrics(),
        performance: getPerformanceMetrics(),
        operations: getOperationMetrics(),
    };

    return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
        version: "1.0.0",
        checks,
        metrics: fullConfig.includeMetrics ? systemMetrics : ({} as SystemMetrics),
    };
};

/**
 * Reset metrics (useful for testing)
 */
export const resetMetrics = (): void => {
    metrics.startTime = Date.now();
    metrics.requests = [];
    metrics.responseTimes = [];
    metrics.errors = 0;
    metrics.activeConnections = 0;
    metrics.diagnosticsRun = 0;
    metrics.conversationsActive = 0;
};
