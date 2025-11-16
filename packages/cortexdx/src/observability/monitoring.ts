/**
 * Monitoring and alerting system for CortexDx
 * Provides real-time monitoring and performance degradation detection
 */

import type { DiagnosticContext } from "../types.js";
import {
    type SystemHealthReport,
    getMemoryMetrics,
    getPerformanceMetrics,
    performHealthCheck
} from "./health-checks.js";

/**
 * Safely convert metrics objects to Record<string, unknown>
 * This avoids unsafe type casts while maintaining type information
 */
function metricsToRecord<T extends Record<string, unknown>>(metrics: T): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(metrics).map(([key, value]) => [key, value])
    );
}

export interface MonitoringConfig {
    checkIntervalMs: number;
    alertThresholds: AlertThresholds;
    enableAlerts: boolean;
    webhookUrl?: string;
}

export interface AlertThresholds {
    memoryUsagePercent: number;
    avgResponseTimeMs: number;
    errorRatePercent: number;
    unhealthyProvidersPercent: number;
}

export interface Alert {
    id: string;
    severity: "warning" | "critical";
    component: string;
    message: string;
    timestamp: string;
    details?: Record<string, unknown>;
}

export interface MonitoringReport {
    timestamp: string;
    health: SystemHealthReport;
    alerts: Alert[];
    trends: PerformanceTrends;
}

export interface PerformanceTrends {
    memoryTrend: "increasing" | "stable" | "decreasing";
    responseTimeTrend: "increasing" | "stable" | "decreasing";
    errorRateTrend: "increasing" | "stable" | "decreasing";
}

export type AlertCallback = (alert: Alert) => void | Promise<void>;

const DEFAULT_THRESHOLDS: AlertThresholds = {
    memoryUsagePercent: 75,
    avgResponseTimeMs: 2000,
    errorRatePercent: 5,
    unhealthyProvidersPercent: 20,
};

/**
 * Monitoring system class
 */
export class MonitoringSystem {
    private config: MonitoringConfig;
    private intervalId: NodeJS.Timeout | null = null;
    private alerts: Alert[] = [];
    private alertCallbacks: AlertCallback[] = [];
    private historicalMetrics: Array<{
        timestamp: number;
        memory: number;
        responseTime: number;
        errorRate: number;
    }> = [];
    private ctx?: DiagnosticContext;

    constructor(config: Partial<MonitoringConfig> = {}) {
        this.config = {
            checkIntervalMs: 60000, // 1 minute default
            alertThresholds: DEFAULT_THRESHOLDS,
            enableAlerts: true,
            ...config,
        };
    }

    /**
     * Set diagnostic context for health checks
     */
    setContext(ctx: DiagnosticContext): void {
        this.ctx = ctx;
    }

    /**
     * Start monitoring
     */
    start(): void {
        if (this.intervalId) {
            return; // Already running
        }

        this.intervalId = setInterval(() => {
            this.performCheck().catch((error) => {
                console.error("Monitoring check failed:", error);
            });
        }, this.config.checkIntervalMs);

        // Perform initial check
        this.performCheck().catch((error) => {
            console.error("Initial monitoring check failed:", error);
        });
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Register alert callback
     */
    onAlert(callback: AlertCallback): void {
        this.alertCallbacks.push(callback);
    }

    /**
     * Get current alerts
     */
    getAlerts(): Alert[] {
        return [...this.alerts];
    }

    /**
     * Clear alerts
     */
    clearAlerts(): void {
        this.alerts = [];
    }

    /**
     * Get monitoring status
     */
    getStatus(): { running: boolean; checkIntervalMs: number; alertCount: number } {
        return {
            running: this.intervalId !== null,
            checkIntervalMs: this.config.checkIntervalMs,
            alertCount: this.alerts.length,
        };
    }

    /**
     * Perform monitoring check
     */
    private async performCheck(): Promise<void> {
        const health = await performHealthCheck(this.ctx, {
            enableDetailedChecks: true,
            includeMetrics: true,
        });

        // Record metrics for trend analysis
        const mem = getMemoryMetrics();
        const perf = getPerformanceMetrics();

        this.historicalMetrics.push({
            timestamp: Date.now(),
            memory: mem.heapUsagePercent,
            responseTime: perf.avgResponseTimeMs,
            errorRate: perf.errorRate,
        });

        // Keep only last 100 data points
        if (this.historicalMetrics.length > 100) {
            this.historicalMetrics.shift();
        }

        // Check for alerts
        if (this.config.enableAlerts) {
            this.checkAlerts(health);
        }
    }

    /**
     * Check for alert conditions
     */
    private checkAlerts(health: SystemHealthReport): void {
        const newAlerts: Alert[] = [];

        // Check memory usage
        if (health.metrics.memory.heapUsagePercent > this.config.alertThresholds.memoryUsagePercent) {
            const severity =
                health.metrics.memory.heapUsagePercent > 90 ? "critical" : "warning";

            newAlerts.push({
                id: `memory-${Date.now()}`,
                severity,
                component: "memory",
                message: `Memory usage at ${health.metrics.memory.heapUsagePercent}%`,
                timestamp: new Date().toISOString(),
                details: metricsToRecord(health.metrics.memory),
            });
        }

        // Check response time
        if (
            health.metrics.performance.avgResponseTimeMs >
            this.config.alertThresholds.avgResponseTimeMs
        ) {
            const severity =
                health.metrics.performance.avgResponseTimeMs > 5000 ? "critical" : "warning";

            newAlerts.push({
                id: `response-time-${Date.now()}`,
                severity,
                component: "performance",
                message: `Average response time: ${health.metrics.performance.avgResponseTimeMs}ms`,
                timestamp: new Date().toISOString(),
                details: metricsToRecord(health.metrics.performance),
            });
        }

        // Check error rate
        if (health.metrics.performance.errorRate > this.config.alertThresholds.errorRatePercent) {
            const severity = health.metrics.performance.errorRate > 10 ? "critical" : "warning";

            newAlerts.push({
                id: `error-rate-${Date.now()}`,
                severity,
                component: "performance",
                message: `Error rate at ${health.metrics.performance.errorRate}%`,
                timestamp: new Date().toISOString(),
                details: metricsToRecord(health.metrics.performance),
            });
        }

        // Check unhealthy components
        const unhealthyChecks = health.checks.filter((c) => c.status === "unhealthy");
        if (unhealthyChecks.length > 0) {
            for (const check of unhealthyChecks) {
                newAlerts.push({
                    id: `component-${check.component}-${Date.now()}`,
                    severity: "critical",
                    component: check.component,
                    message: check.message || `Component ${check.component} is unhealthy`,
                    timestamp: new Date().toISOString(),
                    details: check.details,
                });
            }
        }

        // Add new alerts and trigger callbacks
        for (const alert of newAlerts) {
            this.alerts.push(alert);
            this.triggerAlertCallbacks(alert);
        }

        // Send webhook if configured
        if (newAlerts.length > 0 && this.config.webhookUrl) {
            this.sendWebhookAlert(newAlerts).catch((error) => {
                console.error("Failed to send webhook alert:", error);
            });
        }
    }

    /**
     * Trigger alert callbacks
     */
    private triggerAlertCallbacks(alert: Alert): void {
        for (const callback of this.alertCallbacks) {
            try {
                const result = callback(alert);
                if (result instanceof Promise) {
                    result.catch((error) => {
                        console.error("Alert callback error:", error);
                    });
                }
            } catch (error) {
                console.error("Alert callback error:", error);
            }
        }
    }

    /**
     * Send webhook alert
     */
    private async sendWebhookAlert(alerts: Alert[]): Promise<void> {
        if (!this.config.webhookUrl) {
            return;
        }

        try {
            await fetch(this.config.webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "alerts",
                    alerts,
                    timestamp: new Date().toISOString(),
                }),
            });
        } catch (error) {
            console.error("Webhook alert failed:", error);
        }
    }

    /**
     * Calculate performance trends
     */
    calculateTrends(): PerformanceTrends {
        if (this.historicalMetrics.length < 2) {
            return {
                memoryTrend: "stable",
                responseTimeTrend: "stable",
                errorRateTrend: "stable",
            };
        }

        const recent = this.historicalMetrics.slice(-10);
        const older = this.historicalMetrics.slice(-20, -10);

        const avgRecent = {
            memory: recent.reduce((sum, m) => sum + m.memory, 0) / recent.length,
            responseTime: recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length,
            errorRate: recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length,
        };

        const avgOlder = {
            memory: older.reduce((sum, m) => sum + m.memory, 0) / older.length,
            responseTime: older.reduce((sum, m) => sum + m.responseTime, 0) / older.length,
            errorRate: older.reduce((sum, m) => sum + m.errorRate, 0) / older.length,
        };

        const memoryDiff = avgRecent.memory - avgOlder.memory;
        const responseTimeDiff = avgRecent.responseTime - avgOlder.responseTime;
        const errorRateDiff = avgRecent.errorRate - avgOlder.errorRate;

        return {
            memoryTrend:
                memoryDiff > 5 ? "increasing" : memoryDiff < -5 ? "decreasing" : "stable",
            responseTimeTrend:
                responseTimeDiff > 100
                    ? "increasing"
                    : responseTimeDiff < -100
                        ? "decreasing"
                        : "stable",
            errorRateTrend:
                errorRateDiff > 1 ? "increasing" : errorRateDiff < -1 ? "decreasing" : "stable",
        };
    }

    /**
     * Get monitoring report
     */
    async getReport(): Promise<MonitoringReport> {
        const health = await performHealthCheck(this.ctx, {
            enableDetailedChecks: true,
            includeMetrics: true,
        });

        return {
            timestamp: new Date().toISOString(),
            health,
            alerts: this.getAlerts(),
            trends: this.calculateTrends(),
        };
    }
}

/**
 * Create global monitoring instance
 */
let globalMonitoring: MonitoringSystem | null = null;

export const getGlobalMonitoring = (): MonitoringSystem => {
    if (!globalMonitoring) {
        globalMonitoring = new MonitoringSystem();
    }
    return globalMonitoring;
};

export const setGlobalMonitoring = (monitoring: MonitoringSystem): void => {
    globalMonitoring = monitoring;
};
