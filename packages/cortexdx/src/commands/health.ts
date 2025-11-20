import { loadProjectContext } from "../context/project-context";
import { AutoHealer } from "../healing/auto-healer";
import { createCliLogger } from "../logging/logger";
import type { DevelopmentContext } from "../types";

const logger = createCliLogger("health");

/**
 * Create development context for health check
 */
const jsonRpcStub = async <T>(
  _method: string,
  _params?: unknown,
): Promise<T> => {
  // This is a stub implementation for health checks
  return {} as T;
};

interface HealthWebhookPayload {
  type: "health_check";
  endpoint: string;
  healthy: boolean;
  issues: number;
  criticalIssues: number;
  message: string;
  timestamp: string;
}

async function createDevelopmentContext(): Promise<DevelopmentContext> {
  const projectContext = await loadProjectContext().catch(() => undefined);
  return {
    endpoint: process.env.CORTEXDX_INTERNAL_ENDPOINT || "http://127.0.0.1:5001",
    logger: (() => {}) as (...args: unknown[]) => void,
    request: async <T>(
      _input: RequestInfo,
      _init?: RequestInit,
    ): Promise<T> => {
      const result = {} as Record<string, unknown>;
      return result as T;
    },
    jsonrpc: jsonRpcStub,
    sseProbe: async () => ({ ok: true }),
    evidence: () => undefined,
    deterministic: true,
    sessionId: `health-${Date.now()}`,
    userExpertiseLevel: "expert",
    conversationHistory: [],
    projectContext,
  };
}

/**
 * Run health check command
 */
export async function runHealthCheck(options: {
  endpoint?: string;
  webhook?: string;
  json?: boolean;
}): Promise<number> {
  const endpoint =
    options.endpoint ||
    process.env.CORTEXDX_INTERNAL_ENDPOINT ||
    "http://127.0.0.1:5001";
  const isJson = options.json || false;

  try {
    const ctx = await createDevelopmentContext();
    ctx.endpoint = endpoint;

    // Quick health check using AutoHealer
    const healer = new AutoHealer(ctx);
    const healthResult = await healer.quickHealthCheck();

    if (isJson) {
      // JSON output
      const jsonOutput = {
        timestamp: new Date().toISOString(),
        endpoint,
        healthy: healthResult.healthy,
        issues: healthResult.issues,
        criticalIssues: healthResult.criticalIssues,
        message: healthResult.message,
      };

      logger.info(JSON.stringify(jsonOutput, null, 2));
    } else {
      // Human-readable output
      displayHealthResult(healthResult, endpoint);
    }

    // Send webhook if configured
    if (options.webhook) {
      await sendWebhook(options.webhook, {
        type: "health_check",
        endpoint,
        healthy: healthResult.healthy,
        issues: healthResult.issues,
        criticalIssues: healthResult.criticalIssues,
        message: healthResult.message,
        timestamp: new Date().toISOString(),
      });
    }

    return healthResult.healthy ? 0 : 1;
  } catch (error) {
    const errorResult = {
      healthy: false,
      issues: -1,
      criticalIssues: -1,
      message: `Health check failed: ${String(error)}`,
    };

    if (isJson) {
      logger.info(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            endpoint,
            ...errorResult,
          },
          null,
          2,
        ),
      );
    } else {
      logger.error(`[Health] ${errorResult.message}`);
    }

    return 1;
  }
}

/**
 * Display health check results in human-readable format
 */
function displayHealthResult(
  healthResult: {
    healthy: boolean;
    issues: number;
    criticalIssues: number;
    message: string;
  },
  endpoint: string,
): void {
  logger.info("[Health] Running health check");
  logger.info("=".repeat(50));
  logger.info("CORTEXDX HEALTH CHECK");
  logger.info("=".repeat(50));

  logger.info(`Endpoint: ${endpoint}`);
  logger.info(`Timestamp: ${new Date().toISOString()}`);

  const status = healthResult.healthy ? "✅ HEALTHY" : "❌ UNHEALTHY";
  const statusColor = healthResult.healthy ? "\x1b[32m" : "\x1b[31m"; // Green or Red
  const reset = "\x1b[0m";

  logger.info(`\nStatus: ${statusColor}${status}${reset}`);
  logger.info(`Message: ${healthResult.message}`);

  if (healthResult.issues >= 0) {
    logger.info(`\nIssues Found: ${healthResult.issues}`);
    if (healthResult.criticalIssues > 0) {
      logger.info(`Critical Issues: ${healthResult.criticalIssues}`);
    }
  }

  // Provide recommendations based on health status
  if (!healthResult.healthy) {
    logger.info("\nRECOMMENDATIONS:");
    if (healthResult.criticalIssues > 0) {
      logger.info("  1. Run comprehensive self-diagnosis:");
      logger.info("     cortexdx self-diagnose --auto-fix");
      logger.info("  2. Check system logs for detailed error information");
      logger.info("  3. Verify all dependencies are properly installed");
    } else {
      logger.info("  1. Run detailed diagnostics:");
      logger.info("     cortexdx self-diagnose --dry-run");
      logger.info("  2. Review findings and apply fixes if needed");
    }

    logger.info("  4. Start background monitoring:");
    logger.info("     cortexdx monitor --start --auto-heal");
  } else {
    logger.info("\n✅ All systems operational");
    logger.info("\nMAINTENANCE RECOMMENDATIONS:");
    logger.info("  1. Enable background monitoring:");
    logger.info("     cortexdx monitor --start");
    logger.info("  2. Schedule regular health checks");
    logger.info("  3. Monitor system performance and logs");
  }

  logger.info("\nFor more detailed analysis, run:");
  logger.info("  cortexdx self-diagnose --dry-run");
  logger.info("  cortexdx templates list");

  logger.info("=".repeat(50));
}

/**
 * Send webhook notification
 */
async function sendWebhook(
  webhookUrl: string,
  payload: HealthWebhookPayload,
): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CortexDx-Health/1.0",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    logger.info(`[Health] Health status sent to ${webhookUrl}`);
  } catch (error) {
    logger.error("[Health] Webhook failed", { error });
  }
}
