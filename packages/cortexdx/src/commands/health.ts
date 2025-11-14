import { loadProjectContext } from "../context/project-context.js";
import { AutoHealer } from "../healing/auto-healer.js";
import type { DevelopmentContext } from "../types.js";

/**
 * Create development context for health check
 */
const jsonRpcStub = async <T>(method: string, params?: unknown): Promise<T> => {
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
    logger: (...args) => console.log("[Health]", ...args),
    request: async (input, init) => {
      const response = await fetch(input, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      return text.length ? JSON.parse(text) : {};
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

      console.log(JSON.stringify(jsonOutput, null, 2));
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
      console.log(
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
      console.error(`[Health] ${errorResult.message}`);
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
  console.log("=".repeat(50));
  console.log("CORTEXDX HEALTH CHECK");
  console.log("=".repeat(50));

  console.log(`Endpoint: ${endpoint}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const status = healthResult.healthy ? "✅ HEALTHY" : "❌ UNHEALTHY";
  const statusColor = healthResult.healthy ? "\x1b[32m" : "\x1b[31m"; // Green or Red
  const reset = "\x1b[0m";

  console.log(`\nStatus: ${statusColor}${status}${reset}`);
  console.log(`Message: ${healthResult.message}`);

  if (healthResult.issues >= 0) {
    console.log(`\nIssues Found: ${healthResult.issues}`);
    if (healthResult.criticalIssues > 0) {
      console.log(`Critical Issues: ${healthResult.criticalIssues}`);
    }
  }

  // Provide recommendations based on health status
  if (!healthResult.healthy) {
    console.log("\nRECOMMENDATIONS:");
    if (healthResult.criticalIssues > 0) {
      console.log("  1. Run comprehensive self-diagnosis:");
      console.log("     cortexdx self-diagnose --auto-fix");
      console.log("  2. Check system logs for detailed error information");
      console.log("  3. Verify all dependencies are properly installed");
    } else {
      console.log("  1. Run detailed diagnostics:");
      console.log("     cortexdx self-diagnose --dry-run");
      console.log("  2. Review findings and apply fixes if needed");
    }

    console.log("  4. Start background monitoring:");
    console.log("     cortexdx monitor --start --auto-heal");
  } else {
    console.log("\n✅ All systems operational");
    console.log("\nMAINTENANCE RECOMMENDATIONS:");
    console.log("  1. Enable background monitoring:");
    console.log("     cortexdx monitor --start");
    console.log("  2. Schedule regular health checks");
    console.log("  3. Monitor system performance and logs");
  }

  console.log("\nFor more detailed analysis, run:");
  console.log("  cortexdx self-diagnose --dry-run");
  console.log("  cortexdx templates list");

  console.log("=".repeat(50));
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

    console.log(`[Health] Health status sent to ${webhookUrl}`);
  } catch (error) {
    console.error("[Health] Webhook failed:", error);
  }
}
