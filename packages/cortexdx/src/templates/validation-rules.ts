/**
 * Validation rules for post-fix verification
 */

export interface ValidationContext {
  securityHeaders?: string[];
  rateLimiting?: { configured?: boolean };
  cors?: { working?: boolean };
  sse?: { healthy?: boolean; heartbeat?: boolean };
  memory?: { usage?: number; threshold?: number };
  jsonrpc?: { compliance?: Record<string, unknown> };
  conversationStorage?: { working?: boolean; persistence?: boolean };
  functionality?: { core?: string[]; working?: string[] };
  tests?: { results?: TestResult[] };
  performance?: {
    avgResponseTime?: number;
    throughput?: number;
    responseTimeThreshold?: number;
    throughputThreshold?: number;
  };
  [key: string]: unknown;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  validator: (context: ValidationContext) => Promise<ValidationResult>;
  severity: "error" | "warning" | "info";
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: unknown;
  suggestions?: string[];
}

interface TestResult {
  status?: string;
  [key: string]: unknown;
}

/**
 * Validation rules for different types of fixes
 */
export const ValidationRules: Record<string, ValidationRule> = {
  "security.headers.present": {
    id: "security.headers.present",
    name: "Security Headers Present",
    description: "Verifies that security headers are properly set",
    severity: "error",
    validator: async (context) => {
      // In a real implementation, this would check actual response headers
      const hasHeaders = Boolean(
        context.securityHeaders?.length && context.securityHeaders.length > 0,
      );

      return {
        passed: hasHeaders,
        message: hasHeaders
          ? "Security headers are properly configured"
          : "Security headers are missing or incomplete",
        suggestions: hasHeaders
          ? []
          : [
              "Add X-Content-Type-Options: nosniff",
              "Add X-Frame-Options: DENY",
              "Add X-XSS-Protection: 1; mode=block",
              "Add Referrer-Policy: strict-origin-when-cross-origin",
            ],
      };
    },
  },

  "rate.limiting.active": {
    id: "rate.limiting.active",
    name: "Rate Limiting Active",
    description: "Verifies that rate limiting is working",
    severity: "error",
    validator: async (context) => {
      const rateLimitConfigured = context.rateLimiting?.configured;

      return {
        passed: Boolean(rateLimitConfigured),
        message: rateLimitConfigured
          ? "Rate limiting is properly configured"
          : "Rate limiting is not configured",
        suggestions: rateLimitConfigured
          ? []
          : [
              "Install express-rate-limit package",
              "Configure rate limiting middleware",
              "Apply rate limiting to MCP endpoints",
            ],
      };
    },
  },

  "cors.functional": {
    id: "cors.functional",
    name: "CORS Functionality",
    description: "Verifies CORS configuration works correctly",
    severity: "error",
    validator: async (context) => {
      const corsWorking = context.cors?.working;

      return {
        passed: Boolean(corsWorking),
        message: corsWorking
          ? "CORS configuration is working correctly"
          : "CORS configuration has issues",
        suggestions: corsWorking
          ? []
          : [
              "Check CORS origin configuration",
              "Verify preflight request handling",
              "Test with different origins",
            ],
      };
    },
  },

  "sse.streaming.healthy": {
    id: "sse.streaming.healthy",
    name: "SSE Streaming Health",
    description: "Verifies SSE streaming is healthy",
    severity: "error",
    validator: async (context) => {
      const sseHealthy = context.sse?.healthy;
      const heartbeatWorking = context.sse?.heartbeat;

      return {
        passed: Boolean(sseHealthy && heartbeatWorking),
        message:
          sseHealthy && heartbeatWorking
            ? "SSE streaming is healthy with heartbeat"
            : "SSE streaming has issues",
        details: { sseHealthy, heartbeatWorking },
        suggestions:
          !sseHealthy || !heartbeatWorking
            ? [
                "Check SSE adapter implementation",
                "Verify heartbeat mechanism",
                "Add proper cleanup handlers",
              ]
            : [],
      };
    },
  },

  "memory.usage.acceptable": {
    id: "memory.usage.acceptable",
    name: "Memory Usage Acceptable",
    description: "Verifies memory usage is within acceptable limits",
    severity: "warning",
    validator: async (context) => {
      const memoryUsage = context.memory?.usage || 0;
      const threshold = context.memory?.threshold || 500; // 500MB default

      const acceptable = memoryUsage <= threshold;

      return {
        passed: acceptable,
        message: acceptable
          ? `Memory usage (${memoryUsage}MB) is within threshold (${threshold}MB)`
          : `Memory usage (${memoryUsage}MB) exceeds threshold (${threshold}MB)`,
        details: { memoryUsage, threshold },
        suggestions: acceptable
          ? []
          : [
              "Check for memory leaks",
              "Optimize data structures",
              "Add garbage collection hints",
            ],
      };
    },
  },

  "jsonrpc.compliant": {
    id: "jsonrpc.compliant",
    name: "JSON-RPC Compliance",
    description: "Verifies JSON-RPC 2.0 specification compliance",
    severity: "error",
    validator: async (context) => {
      const compliance = context.jsonrpc?.compliance || {};
      const requiredFields = ["jsonrpc", "method"];
      const hasRequiredFields = requiredFields.every(
        (field) => compliance[field],
      );

      return {
        passed: hasRequiredFields,
        message: hasRequiredFields
          ? "JSON-RPC requests are compliant with 2.0 specification"
          : "JSON-RPC requests have compliance issues",
        details: compliance,
        suggestions: hasRequiredFields
          ? []
          : [
              'Ensure all requests have "jsonrpc": "2.0"',
              "Verify method field is present and valid",
              "Check ID handling for notifications vs requests",
            ],
      };
    },
  },

  "conversation.storage.working": {
    id: "conversation.storage.working",
    name: "Conversation Storage Working",
    description: "Verifies conversation storage is functioning",
    severity: "error",
    validator: async (context) => {
      const storageWorking = context.conversationStorage?.working;
      const persistenceVerified = context.conversationStorage?.persistence;

      return {
        passed: Boolean(storageWorking && persistenceVerified),
        message:
          storageWorking && persistenceVerified
            ? "Conversation storage is working with persistence"
            : "Conversation storage has issues",
        details: { storageWorking, persistenceVerified },
        suggestions:
          !storageWorking || !persistenceVerified
            ? [
                "Check storage backend connectivity",
                "Verify error handling for storage failures",
                "Test conversation persistence across restarts",
              ]
            : [],
      };
    },
  },

  "functionality.preserved": {
    id: "functionality.preserved",
    name: "Functionality Preserved",
    description: "Verifies existing functionality is preserved after fixes",
    severity: "error",
    validator: async (context) => {
      const coreFeatures = context.functionality?.core || [];
      const workingFeatures = context.functionality?.working || [];
      const allWorking =
        coreFeatures.length > 0 &&
        coreFeatures.every((feature: string) =>
          workingFeatures.includes(feature),
        );

      return {
        passed: Boolean(allWorking),
        message: allWorking
          ? "All core functionality is preserved"
          : "Some core functionality may be broken",
        details: { coreFeatures, workingFeatures },
        suggestions: allWorking
          ? []
          : [
              "Test all MCP tools and capabilities",
              "Verify SSE events are working",
              "Check conversation management",
            ],
      };
    },
  },

  "tests.passing": {
    id: "tests.passing",
    name: "Tests Passing",
    description: "Verifies relevant tests are passing after fixes",
    severity: "error",
    validator: async (context) => {
      const rawResults = context.tests?.results;
      const testResults: TestResult[] = Array.isArray(rawResults)
        ? rawResults
        : [];
      const failedTests = testResults.filter(
        (test) => test.status === "failed",
      );
      const allPassing = failedTests.length === 0;

      return {
        passed: Boolean(allPassing),
        message: allPassing
          ? `All ${testResults.length} tests are passing`
          : `${failedTests.length} of ${testResults.length} tests are failing`,
        details: { total: testResults.length, failed: failedTests.length },
        suggestions: allPassing
          ? []
          : [
              "Review failed test output",
              "Fix test failures before proceeding",
              "Consider updating tests if functionality changed intentionally",
            ],
      };
    },
  },

  "performance.acceptable": {
    id: "performance.acceptable",
    name: "Performance Acceptable",
    description: "Verifies performance metrics are within acceptable ranges",
    severity: "warning",
    validator: async (context) => {
      const responseTime = context.performance?.avgResponseTime || 0;
      const throughput = context.performance?.throughput || 0;
      const responseTimeThreshold =
        context.performance?.responseTimeThreshold || 1000; // 1s
      const throughputThreshold =
        context.performance?.throughputThreshold || 10; // 10 req/s

      const responseTimeOk = responseTime <= responseTimeThreshold;
      const throughputOk = throughput >= throughputThreshold;

      return {
        passed: responseTimeOk && throughputOk,
        message:
          responseTimeOk && throughputOk
            ? "Performance metrics are acceptable"
            : "Performance metrics need attention",
        details: {
          responseTime,
          throughput,
          responseTimeThreshold,
          throughputThreshold,
        },
        suggestions:
          !responseTimeOk || !throughputOk
            ? [
                "Profile slow operations",
                "Optimize database queries",
                "Consider caching strategies",
              ]
            : [],
      };
    },
  },
};

/**
 * Get validation rule by ID
 */
export function getValidationRule(id: string): ValidationRule | undefined {
  return ValidationRules[id];
}

/**
 * Run validation rules for a specific area
 */
export async function runValidationRules(
  area: string,
  rules: string[],
  context: ValidationContext,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const ruleId of rules) {
    const rule = getValidationRule(`${area}.${ruleId}`);
    if (rule) {
      try {
        const result = await rule.validator(context);
        results.push(result);
      } catch (error) {
        results.push({
          passed: false,
          message: `Validation rule ${ruleId} failed: ${String(error)}`,
        });
      }
    } else {
      results.push({
        passed: false,
        message: `Validation rule ${ruleId} not found`,
      });
    }
  }

  return results;
}

/**
 * Get all validation rules
 */
export function getAllValidationRules(): ValidationRule[] {
  return Object.values(ValidationRules);
}

/**
 * Get validation rules by severity
 */
export function getValidationRulesBySeverity(
  severity: ValidationRule["severity"],
): ValidationRule[] {
  return Object.values(ValidationRules).filter(
    (rule) => rule.severity === severity,
  );
}

/**
 * Format validation results for display
 */
export function formatValidationResults(results: ValidationResult[]): string {
  const lines = ["Validation Results:", ""];

  const errors = results.filter((r) => !r.passed);
  const _warnings = results.filter((r) => !r.passed);

  if (errors.length === 0) {
    lines.push("✓ All validations passed");
  } else {
    lines.push(`✗ ${errors.length} validation(s) failed`);

    for (const result of errors) {
      lines.push(`  ✗ ${result.message}`);
      if (result.suggestions && result.suggestions.length > 0) {
        for (const suggestion of result.suggestions) {
          lines.push(`    → ${suggestion}`);
        }
      }
    }
  }

  return lines.join("\n");
}
