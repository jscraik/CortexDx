/**
 * Model Performance Monitor Plugin
 * Tracks inference times, monitors performance degradation, and provides recommendations
 * Requirements: 5.1, 5.4, 12.4
 */

import type {
  DiagnosticContext,
  DiagnosticPlugin,
  Finding,
} from "../../types.js";

export interface ModelPerformanceMetrics {
  modelId: string;
  backend: "ollama" | "mlx";
  taskType: string;
  inferenceTimeMs: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  memoryUsageMb: number;
  timestamp: number;
}

export interface PerformanceThreshold {
  taskType: string;
  maxInferenceTimeMs: number;
  minTokensPerSecond: number;
  maxMemoryUsageMb: number;
}

export interface ModelPerformanceReport {
  modelId: string;
  totalInferences: number;
  averageInferenceTimeMs: number;
  minInferenceTimeMs: number;
  maxInferenceTimeMs: number;
  averageTokensPerSecond: number;
  performanceTrend: "improving" | "stable" | "degrading";
  recommendations: string[];
  lastUpdated: number;
}

export interface PerformanceAlert {
  severity: "info" | "warning" | "critical";
  modelId: string;
  message: string;
  metric: string;
  threshold: number;
  actual: number;
  timestamp: number;
}

export class ModelPerformanceMonitor implements DiagnosticPlugin {
  public readonly id = "model-performance-monitor";
  public readonly title = "Model Performance Monitor";
  public readonly order = 2;

  private readonly metrics = new Map<string, ModelPerformanceMetrics[]>();
  private readonly thresholds: PerformanceThreshold[] = [
    {
      taskType: "development",
      maxInferenceTimeMs: 2000,
      minTokensPerSecond: 20,
      maxMemoryUsageMb: 8192,
    },
    {
      taskType: "debugging",
      maxInferenceTimeMs: 2000,
      minTokensPerSecond: 20,
      maxMemoryUsageMb: 8192,
    },
    {
      taskType: "code-analysis",
      maxInferenceTimeMs: 3000,
      minTokensPerSecond: 15,
      maxMemoryUsageMb: 8192,
    },
    {
      taskType: "documentation",
      maxInferenceTimeMs: 5000,
      minTokensPerSecond: 10,
      maxMemoryUsageMb: 8192,
    },
    {
      taskType: "conversation",
      maxInferenceTimeMs: 2000,
      minTokensPerSecond: 20,
      maxMemoryUsageMb: 8192,
    },
  ];
  private readonly alerts: PerformanceAlert[] = [];
  private readonly maxMetricsPerModel = 100;
  private readonly degradationThreshold = 0.3; // 30% performance drop

  async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Generate performance reports for all monitored models
      const reports = this.generateReports();

      if (reports.length === 0) {
        findings.push({
          id: "model-perf-no-data",
          area: "Model Performance",
          severity: "info",
          title: "No Performance Data",
          description: "No model performance metrics have been collected yet",
          evidence: [{ type: "log", ref: "model-perf-no-data" }],
          confidence: 1.0,
          tags: ["performance", "monitoring"],
        });
        return findings;
      }

      // Report on each model's performance
      for (const report of reports) {
        const severity = this.assessPerformanceSeverity(report);

        findings.push({
          id: `model-perf-${report.modelId}`,
          area: "Model Performance",
          severity,
          title: `${report.modelId} Performance: ${report.performanceTrend}`,
          description: this.formatPerformanceDescription(report),
          evidence: [
            {
              type: "log",
              ref: `model-perf-${report.modelId}-${report.totalInferences}`,
            },
          ],
          confidence: this.calculateConfidence(report.totalInferences),
          tags: ["performance", "llm", report.performanceTrend],
          recommendation: report.recommendations.join("; "),
        });
      }

      // Report active alerts
      const recentAlerts = this.getRecentAlerts(60000); // Last minute
      if (recentAlerts.length > 0) {
        findings.push({
          id: "model-perf-alerts",
          area: "Model Performance",
          severity: this.getHighestAlertSeverity(recentAlerts),
          title: `${recentAlerts.length} Performance Alert(s)`,
          description: this.formatAlertsDescription(recentAlerts),
          evidence: [
            { type: "log", ref: `model-perf-alerts-${recentAlerts.length}` },
          ],
          confidence: 1.0,
          tags: ["performance", "alerts"],
        });
      }

      ctx.evidence({ type: "log", ref: "model-perf-monitor-complete" });
    } catch (error) {
      findings.push({
        id: "model-perf-error",
        area: "Model Performance",
        severity: "major",
        title: "Performance Monitor Error",
        description: `Failed to monitor performance: ${error instanceof Error ? error.message : "Unknown error"}`,
        evidence: [{ type: "log", ref: "model-perf-error" }],
        confidence: 1.0,
      });
    }

    return findings;
  }

  // Record performance metrics
  recordMetric(metric: ModelPerformanceMetrics): void {
    const key = metric.modelId;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const modelMetrics = this.metrics.get(key);
    if (!modelMetrics) return;

    modelMetrics.push(metric);

    // Keep only recent metrics
    if (modelMetrics.length > this.maxMetricsPerModel) {
      modelMetrics.shift();
    }

    // Check thresholds and generate alerts
    this.checkThresholds(metric);
  }

  // Generate performance reports
  generateReports(): ModelPerformanceReport[] {
    const reports: ModelPerformanceReport[] = [];

    for (const [modelId, modelMetrics] of this.metrics.entries()) {
      if (modelMetrics.length === 0) continue;

      const report = this.generateModelReport(modelId, modelMetrics);
      reports.push(report);
    }

    return reports;
  }

  getReport(modelId: string): ModelPerformanceReport | null {
    const modelMetrics = this.metrics.get(modelId);
    if (!modelMetrics || modelMetrics.length === 0) {
      return null;
    }

    return this.generateModelReport(modelId, modelMetrics);
  }

  // Alert management
  getRecentAlerts(timeWindowMs: number): PerformanceAlert[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.alerts.filter((alert) => alert.timestamp >= cutoff);
  }

  clearAlerts(): void {
    this.alerts.length = 0;
  }

  // Automatic model switching recommendation
  shouldSwitchModel(modelId: string): {
    shouldSwitch: boolean;
    reason?: string;
    suggestedModel?: string;
  } {
    const report = this.getReport(modelId);
    if (!report) {
      return { shouldSwitch: false };
    }

    // Check for degrading performance
    if (report.performanceTrend === "degrading") {
      return {
        shouldSwitch: true,
        reason: "Performance is degrading",
        suggestedModel: this.suggestAlternativeModel(modelId),
      };
    }

    // Check if consistently exceeding thresholds
    const recentMetrics = this.metrics.get(modelId)?.slice(-10) || [];
    const exceedingCount = recentMetrics.filter((m) => {
      const threshold = this.getThresholdForTask(m.taskType);
      return threshold && m.inferenceTimeMs > threshold.maxInferenceTimeMs;
    }).length;

    if (exceedingCount >= 7) {
      // 70% of recent inferences
      return {
        shouldSwitch: true,
        reason: "Consistently exceeding performance thresholds",
        suggestedModel: this.suggestAlternativeModel(modelId),
      };
    }

    return { shouldSwitch: false };
  }

  // Statistics and analysis
  getModelStatistics(modelId: string): {
    totalInferences: number;
    averageTime: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const modelMetrics = this.metrics.get(modelId);
    if (!modelMetrics || modelMetrics.length === 0) {
      return null;
    }

    const times = modelMetrics
      .map((m) => m.inferenceTimeMs)
      .sort((a, b) => a - b);

    return {
      totalInferences: times.length,
      averageTime: times.reduce((sum, t) => sum + t, 0) / times.length,
      p50: this.percentile(times, 0.5),
      p95: this.percentile(times, 0.95),
      p99: this.percentile(times, 0.99),
    };
  }

  // Private helper methods
  private generateModelReport(
    modelId: string,
    modelMetrics: ModelPerformanceMetrics[],
  ): ModelPerformanceReport {
    const inferenceTimes = modelMetrics.map((m) => m.inferenceTimeMs);
    const tokensPerSecond = modelMetrics.map((m) => m.tokensPerSecond);

    const avgInferenceTime = this.average(inferenceTimes);
    const avgTokensPerSecond = this.average(tokensPerSecond);

    const trend = this.calculatePerformanceTrend(modelMetrics);
    const recommendations = this.generateRecommendations(
      modelId,
      modelMetrics,
      trend,
    );

    return {
      modelId,
      totalInferences: modelMetrics.length,
      averageInferenceTimeMs: avgInferenceTime,
      minInferenceTimeMs: Math.min(...inferenceTimes),
      maxInferenceTimeMs: Math.max(...inferenceTimes),
      averageTokensPerSecond: avgTokensPerSecond,
      performanceTrend: trend,
      recommendations,
      lastUpdated: Date.now(),
    };
  }

  private calculatePerformanceTrend(
    metrics: ModelPerformanceMetrics[],
  ): "improving" | "stable" | "degrading" {
    if (metrics.length < 10) {
      return "stable"; // Not enough data
    }

    // Compare recent performance to earlier performance
    const recentMetrics = metrics.slice(-10);
    const earlierMetrics = metrics.slice(0, 10);

    const recentAvg = this.average(recentMetrics.map((m) => m.inferenceTimeMs));
    const earlierAvg = this.average(
      earlierMetrics.map((m) => m.inferenceTimeMs),
    );

    const change = (recentAvg - earlierAvg) / earlierAvg;

    if (change > this.degradationThreshold) {
      return "degrading";
    }
    if (change < -this.degradationThreshold) {
      return "improving";
    }
    return "stable";
  }

  private generateRecommendations(
    modelId: string,
    metrics: ModelPerformanceMetrics[],
    trend: "improving" | "stable" | "degrading",
  ): string[] {
    const recommendations: string[] = [];

    if (trend === "degrading") {
      recommendations.push(
        "Consider restarting the model or switching to an alternative",
      );
      recommendations.push(
        "Check system resources (CPU, memory) for bottlenecks",
      );
    }

    const avgTime = this.average(metrics.map((m) => m.inferenceTimeMs));
    const avgMemory = this.average(metrics.map((m) => m.memoryUsageMb));

    if (avgTime > 3000) {
      recommendations.push(
        "Inference time is high - consider using a smaller or quantized model",
      );
    }

    if (avgMemory > 6000) {
      recommendations.push(
        "High memory usage - consider unloading unused models",
      );
    }

    const avgTokensPerSecond = this.average(
      metrics.map((m) => m.tokensPerSecond),
    );
    if (avgTokensPerSecond < 15) {
      recommendations.push(
        "Low token generation rate - check model optimization settings",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Performance is within acceptable ranges");
    }

    return recommendations;
  }

  private checkThresholds(metric: ModelPerformanceMetrics): void {
    const threshold = this.getThresholdForTask(metric.taskType);
    if (!threshold) return;

    // Check inference time
    if (metric.inferenceTimeMs > threshold.maxInferenceTimeMs) {
      this.addAlert({
        severity:
          metric.inferenceTimeMs > threshold.maxInferenceTimeMs * 1.5
            ? "critical"
            : "warning",
        modelId: metric.modelId,
        message: "Inference time exceeded threshold",
        metric: "inferenceTimeMs",
        threshold: threshold.maxInferenceTimeMs,
        actual: metric.inferenceTimeMs,
        timestamp: Date.now(),
      });
    }

    // Check tokens per second
    if (metric.tokensPerSecond < threshold.minTokensPerSecond) {
      this.addAlert({
        severity:
          metric.tokensPerSecond < threshold.minTokensPerSecond * 0.5
            ? "critical"
            : "warning",
        modelId: metric.modelId,
        message: "Token generation rate below threshold",
        metric: "tokensPerSecond",
        threshold: threshold.minTokensPerSecond,
        actual: metric.tokensPerSecond,
        timestamp: Date.now(),
      });
    }

    // Check memory usage
    if (metric.memoryUsageMb > threshold.maxMemoryUsageMb) {
      this.addAlert({
        severity: "warning",
        modelId: metric.modelId,
        message: "Memory usage exceeded threshold",
        metric: "memoryUsageMb",
        threshold: threshold.maxMemoryUsageMb,
        actual: metric.memoryUsageMb,
        timestamp: Date.now(),
      });
    }
  }

  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Keep only recent alerts (last hour)
    const cutoff = Date.now() - 3600000;
    const recentIndex = this.alerts.findIndex((a) => a.timestamp >= cutoff);
    if (recentIndex > 0) {
      this.alerts.splice(0, recentIndex);
    }
  }

  private getThresholdForTask(taskType: string): PerformanceThreshold | null {
    return this.thresholds.find((t) => t.taskType === taskType) || null;
  }

  private suggestAlternativeModel(currentModel: string): string {
    // Simple heuristic: suggest a smaller model
    if (currentModel.includes("70b")) return currentModel.replace("70b", "34b");
    if (currentModel.includes("34b")) return currentModel.replace("34b", "13b");
    if (currentModel.includes("13b")) return currentModel.replace("13b", "7b");
    if (currentModel.includes("7b")) return currentModel.replace("7b", "3b");

    return "llama3.2:3b"; // Default fallback
  }

  private assessPerformanceSeverity(
    report: ModelPerformanceReport,
  ): "info" | "minor" | "major" | "blocker" {
    if (report.performanceTrend === "degrading") {
      return report.averageInferenceTimeMs > 5000 ? "major" : "minor";
    }
    if (report.performanceTrend === "improving") {
      return "info";
    }
    return report.averageInferenceTimeMs > 3000 ? "minor" : "info";
  }

  private formatPerformanceDescription(report: ModelPerformanceReport): string {
    return `Model: ${report.modelId}
Total Inferences: ${report.totalInferences}
Average Time: ${report.averageInferenceTimeMs.toFixed(0)}ms
Range: ${report.minInferenceTimeMs.toFixed(0)}ms - ${report.maxInferenceTimeMs.toFixed(0)}ms
Tokens/sec: ${report.averageTokensPerSecond.toFixed(1)}
Trend: ${report.performanceTrend}`;
  }

  private formatAlertsDescription(alerts: PerformanceAlert[]): string {
    return alerts
      .map(
        (a) =>
          `[${a.severity.toUpperCase()}] ${a.modelId}: ${a.message} (${a.metric}: ${a.actual.toFixed(0)} vs threshold ${a.threshold})`,
      )
      .join("\n");
  }

  private getHighestAlertSeverity(
    alerts: PerformanceAlert[],
  ): "info" | "minor" | "major" | "blocker" {
    const hasCritical = alerts.some((a) => a.severity === "critical");
    const hasWarning = alerts.some((a) => a.severity === "warning");

    if (hasCritical) return "major";
    if (hasWarning) return "minor";
    return "info";
  }

  private calculateConfidence(sampleSize: number): number {
    if (sampleSize >= 50) return 1.0;
    if (sampleSize >= 20) return 0.8;
    if (sampleSize >= 10) return 0.6;
    return 0.4;
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private percentile(sortedNumbers: number[], p: number): number {
    if (sortedNumbers.length === 0) return 0;
    const index = Math.ceil(sortedNumbers.length * p) - 1;
    return sortedNumbers[Math.max(0, index)] || 0;
  }
}

// Factory function
export const createModelPerformanceMonitor = (): ModelPerformanceMonitor => {
  return new ModelPerformanceMonitor();
};
