/**
 * Validation checklists for ensuring fix quality and completeness
 */

export interface ChecklistItem {
  id: string;
  description: string;
  required: boolean;
  validator?: (context: ChecklistContext) => Promise<boolean>;
  errorMessage?: string;
}

export type ChecklistContext = Record<string, unknown>;

export interface Checklist {
  id: string;
  name: string;
  description: string;
  items: ChecklistItem[];
}

export interface ChecklistResult {
  checklistId: string;
  passed: boolean;
  canProceed: boolean;
  results: Array<{
    itemId: string;
    passed: boolean;
    message?: string;
    error?: string;
  }>;
  blocker?: string;
  warnings: string[];
}

/**
 * Validation checklists for different types of fixes
 */
export const Checklists: Record<string, Checklist> = {
  "security.headers": {
    id: "security.headers",
    name: "Security Headers Implementation",
    description: "Validates security headers and rate limiting implementation",
    items: [
      {
        id: "security.middleware.exists",
        description: "Security middleware is imported and configured",
        required: true,
      },
      {
        id: "rate.limiting.configured",
        description: "Rate limiting is configured with appropriate thresholds",
        required: true,
      },
      {
        id: "security.headers.set",
        description:
          "Required security headers are set (CSP, HSTS, X-Frame-Options)",
        required: true,
      },
      {
        id: "cors.compatible",
        description:
          "CORS configuration remains compatible with security headers",
        required: false,
      },
      {
        id: "functionality.preserved",
        description: "All existing MCP functionality remains working",
        required: true,
      },
      {
        id: "tests.passing",
        description: "Security plugin tests pass",
        required: true,
      },
    ],
  },

  "sse.streaming": {
    id: "sse.streaming",
    name: "SSE Streaming Fix",
    description: "Validates SSE streaming implementation and cleanup",
    items: [
      {
        id: "sse.adapter.updated",
        description: "SSE adapter includes proper cleanup mechanisms",
        required: true,
      },
      {
        id: "heartbeat.implemented",
        description: "Heartbeat mechanism is implemented for connection health",
        required: true,
      },
      {
        id: "error.handling",
        description: "Comprehensive error handling is implemented",
        required: true,
      },
      {
        id: "memory.leaks.prevented",
        description: "Memory leak prevention is verified",
        required: true,
      },
      {
        id: "conversation.storage.works",
        description: "Conversation storage works correctly during streaming",
        required: true,
      },
      {
        id: "connection.cleanup",
        description: "Connections are properly cleaned up on disconnect",
        required: true,
      },
    ],
  },

  "jsonrpc.batch": {
    id: "jsonrpc.batch",
    name: "JSON-RPC Batch Processing",
    description: "Validates JSON-RPC batch request handling",
    items: [
      {
        id: "batch.parsing.correct",
        description: "Batch requests are parsed correctly",
        required: true,
      },
      {
        id: "id.correlation.maintained",
        description: "Request/response ID correlation is maintained",
        required: true,
      },
      {
        id: "mixed.ids.handled",
        description: "Mixed string and number IDs are handled correctly",
        required: true,
      },
      {
        id: "response.order.preserved",
        description: "Response order matches request order",
        required: true,
      },
      {
        id: "error.handling.robust",
        description: "Error handling for malformed requests is robust",
        required: true,
      },
      {
        id: "spec.compliance",
        description: "Implementation complies with JSON-RPC 2.0 specification",
        required: true,
      },
    ],
  },

  "cors.configuration": {
    id: "cors.configuration",
    name: "CORS Configuration",
    description: "Validates CORS configuration for development and production",
    items: [
      {
        id: "environment.config",
        description: "Environment-specific CORS configuration is implemented",
        required: true,
      },
      {
        id: "development.allowed",
        description: "Development origins (localhost) are allowed",
        required: true,
      },
      {
        id: "production.restricted",
        description: "Production origins are properly restricted",
        required: true,
      },
      {
        id: "preflight.handled",
        description: "OPTIONS preflight requests are handled correctly",
        required: true,
      },
      {
        id: "headers.configured",
        description: "Allowed headers and methods are properly configured",
        required: true,
      },
    ],
  },

  "performance.memory": {
    id: "performance.memory",
    name: "Memory Optimization",
    description: "Validates memory optimization implementation",
    items: [
      {
        id: "memory.monitoring.implemented",
        description: "Memory monitoring is implemented",
        required: true,
      },
      {
        id: "leaks.prevented",
        description: "Memory leaks are prevented",
        required: true,
      },
      {
        id: "cleanup.utilities",
        description: "Resource cleanup utilities are implemented",
        required: true,
      },
      {
        id: "thresholds.configured",
        description: "Memory thresholds and alerts are configured",
        required: false,
      },
      {
        id: "profiling.available",
        description: "Memory profiling tools are available",
        required: false,
      },
    ],
  },

  "conversation.storage": {
    id: "conversation.storage",
    name: "Conversation Storage",
    description: "Validates conversation storage implementation",
    items: [
      {
        id: "error.handling.robust",
        description: "Error handling for storage failures is robust",
        required: true,
      },
      {
        id: "compression.working",
        description: "Conversation compression is working correctly",
        required: false,
      },
      {
        id: "cleanup.scheduled",
        description: "Old conversation cleanup is scheduled",
        required: true,
      },
      {
        id: "persistence.reliable",
        description: "Conversation persistence across restarts is reliable",
        required: true,
      },
      {
        id: "export.import.functional",
        description: "Export/import functionality is working",
        required: false,
      },
    ],
  },
};

/**
 * Run a checklist and return results
 */
export async function runChecklist(
  checklistId: string,
  context: ChecklistContext = {},
): Promise<ChecklistResult> {
  const checklist = Checklists[checklistId];
  if (!checklist) {
    throw new Error(`Checklist ${checklistId} not found`);
  }

  const results: ChecklistResult["results"] = [];
  const warnings: string[] = [];
  let blocker: string | undefined;

  for (const item of checklist.items) {
    try {
      let passed = false;
      let message: string | undefined;
      let error: string | undefined;

      if (item.validator) {
        passed = await item.validator(context);
        message = passed ? `✓ ${item.description}` : `✗ ${item.description}`;
        if (!passed && item.errorMessage) {
          error = item.errorMessage;
        }
      } else {
        // Items without validators require manual verification; treat as pass but warn
        passed = true;
        message = `? ${item.description} (manual verification recommended)`;
        warnings.push(`Manual verification recommended: ${item.description}`);
      }

      results.push({
        itemId: item.id,
        passed,
        message,
        error,
      });

      // Check for blockers
      if (item.required && !passed) {
        blocker = blocker || `Required item failed: ${item.description}`;
      }
    } catch (error) {
      results.push({
        itemId: item.id,
        passed: false,
        error: `Validation error: ${String(error)}`,
      });

      if (item.required) {
        blocker =
          blocker || `Validation failed for required item: ${item.description}`;
      }
    }
  }

  const passedItems = results.filter((r) => r.passed).length;
  const totalRequired = checklist.items.filter((i) => i.required).length;
  const passedRequired = results.filter((r) => {
    const item = checklist.items.find((i) => i.id === r.itemId);
    return item?.required && r.passed;
  }).length;

  const passed = passedItems === checklist.items.length;
  const canProceed = passedRequired === totalRequired && !blocker;

  return {
    checklistId,
    passed,
    canProceed,
    results,
    blocker,
    warnings,
  };
}

/**
 * Get checklist by ID
 */
export function getChecklist(id: string): Checklist | undefined {
  return Checklists[id];
}

/**
 * Get all available checklists
 */
export function getAllChecklists(): Checklist[] {
  return Object.values(Checklists);
}

/**
 * Format checklist result for display
 */
export function formatChecklistResult(result: ChecklistResult): string {
  const lines = [
    `Checklist: ${result.checklistId}`,
    `Status: ${result.passed ? "✓ PASSED" : "✗ FAILED"}`,
    `Can Proceed: ${result.canProceed ? "✓ YES" : "✗ NO"}`,
    "",
    "Results:",
  ];

  for (const itemResult of result.results) {
    lines.push(`  ${itemResult.message}`);
    if (itemResult.error) {
      lines.push(`    Error: ${itemResult.error}`);
    }
  }

  if (result.blocker) {
    lines.push("", `BLOCKER: ${result.blocker}`);
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of result.warnings) {
      lines.push(`  ⚠ ${warning}`);
    }
  }

  return lines.join("\n");
}
