/**
 * Fix templates for common MCP Inspector findings
 * Each template provides structured fix procedures with checklists and code patterns
 */ import type { Finding } from "../types.js";

export interface FixTemplate {
  id: string;
  name: string;
  description: string;
  area: string;
  severity: "blocker" | "major" | "minor" | "info";
  checklist: string[];
  codeTemplate?: string;
  validationPlugins?: string[];
  riskLevel: "low" | "medium" | "high";
  estimatedTime: string;
  filesAffected: string[];
}

export const FixTemplates: Record<string, FixTemplate> = {
  "security.headers": {
    id: "security.headers",
    name: "Add Security Headers",
    description:
      "Adds rate limiting and security headers to MCP server endpoints",
    area: "security",
    severity: "minor",
    checklist: [
      "✓ Identify security middleware integration point in server.ts",
      "✓ Add rate limiting configuration with appropriate thresholds",
      "✓ Add security headers (CSP, HSTS, X-Frame-Options)",
      "✓ Update security plugin validation rules",
      "✓ Test with security-scanner plugin suite",
      "✓ Verify no breaking changes to existing functionality",
      "✓ Confirm CORS policies remain compatible",
    ],
    codeTemplate: `
// Add to src/server.ts after existing middleware
import rateLimit from 'express-rate-limit';

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});

// Apply rate limiting to MCP endpoints
app.use('/mcp', limiter);
app.use('/tools/call', limiter);

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
    `,
    validationPlugins: ["security-scanner", "cors", "ratelimit", "protocol"],
    riskLevel: "low",
    estimatedTime: "5-10 minutes",
    filesAffected: ["src/server.ts", "src/plugins/threat-model.ts"],
  },

  "sse.streaming": {
    id: "sse.streaming",
    name: "Fix SSE Streaming Issues",
    description:
      "Resolves Server-Sent Events streaming problems and memory leaks",
    area: "performance",
    severity: "major",
    checklist: [
      "✓ Check SSE adapter implementation in src/adapters/sse.ts",
      "✓ Verify eventsource-parser integration is correct",
      "✓ Add proper cleanup for SSE connections",
      "✓ Implement heartbeat mechanism for connection health",
      "✓ Add error handling and automatic reconnection",
      "✓ Test SSE probe functionality",
      "✓ Validate conversation storage updates during streaming",
      "✓ Check for memory leaks with long-running connections",
      "✓ Verify buffer limits and backpressure handling",
    ],
    codeTemplate: `
// Add to src/adapters/sse.ts
export class EnhancedSSEAdapter {
  private connections = new Map<string, { response: Response; cleanup: () => void }>();

  async handleSSE(request: Request): Promise<Response> {
    const sessionId = generateSessionId();
    const response = new Response();

    // Set up SSE headers
    response.headers.set('Content-Type', 'text/event-stream');
    response.headers.set('Cache-Control', 'no-cache');
    response.headers.set('Connection', 'keep-alive');

    // Store connection for cleanup
    const cleanup = () => {
      this.connections.delete(sessionId);
      // Clean up any associated resources
    };

    this.connections.set(sessionId, { response, cleanup });

    // Set up heartbeat
    const heartbeat = setInterval(() => {
      if (this.connections.has(sessionId)) {
        response.write(': heartbeat\\n\\n');
      } else {
        clearInterval(heartbeat);
      }
    }, 30000); // 30 second heartbeat

    // Cleanup on disconnect
    request.signal.addEventListener('abort', cleanup);

    return response;
  }

  // Add proper error handling
  private handleSSEError(error: Error, sessionId: string): void {
    console.error(\`SSE error for session \${sessionId}:\`, error);
    this.connections.get(sessionId)?.cleanup();
  }
}
    `,
    validationPlugins: ["sse-probe", "performance", "conversation-storage"],
    riskLevel: "medium",
    estimatedTime: "15-20 minutes",
    filesAffected: [
      "src/adapters/sse.ts",
      "src/server.ts",
      "src/conversation/manager.ts",
    ],
  },

  "jsonrpc.batch": {
    id: "jsonrpc.batch",
    name: "Fix JSON-RPC Batch Handling",
    description:
      "Corrects JSON-RPC batch request processing and response ordering",
    area: "protocol",
    severity: "major",
    checklist: [
      "✓ Review JSON-RPC batch request parsing in src/adapters/jsonrpc.ts",
      "✓ Ensure proper correlation of request/response IDs",
      "✓ Handle mixed ID types (string and number) correctly",
      "✓ Process batch requests in parallel when possible",
      "✓ Maintain response order matching request order",
      "✓ Add proper error handling for malformed batch requests",
      "✓ Test with various batch sizes and ID types",
      "✓ Validate response format matches JSON-RPC 2.0 spec",
    ],
    codeTemplate: `
// Add to src/adapters/jsonrpc.ts
export async function handleBatchRequest(
  requests: JsonRpcRequest[],
  context: RequestContext
): Promise<JsonRpcResponse[]> {
  // Process requests in parallel but maintain order
  const responses = await Promise.all(
    requests.map(async (request) => {
      try {
        // Handle both string and number IDs
        const id = typeof request.id === 'string' || typeof request.id === 'number'
          ? request.id
          : null;

        const result = await processIndividualRequest(request, context);

        return {
          jsonrpc: '2.0',
          id,
          result,
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error),
          },
        };
      }
    })
  );

  return responses;
}
    `,
    validationPlugins: ["protocol", "jsonrpc-batch", "performance"],
    riskLevel: "medium",
    estimatedTime: "10-15 minutes",
    filesAffected: ["src/adapters/jsonrpc.ts", "src/server.ts"],
  },

  "cors.configuration": {
    id: "cors.configuration",
    name: "Fix CORS Configuration",
    description:
      "Configures proper CORS settings for development and production",
    area: "protocol",
    severity: "minor",
    checklist: [
      "✓ Review current CORS middleware configuration",
      "✓ Add environment-specific CORS settings",
      "✓ Configure allowed origins for development (localhost)",
      "✓ Set up production origin restrictions",
      "✓ Add proper preflight handling for OPTIONS requests",
      "✓ Configure allowed headers and methods",
      "✓ Test CORS preflight requests",
      "✓ Verify MCP tool calls work across origins",
    ],
    codeTemplate: `
// Add to src/server.ts
import cors from 'cors';

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (origin, callback) => {
        // Allow specific origins in production
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use('/mcp', cors(corsOptions));
app.use('/tools', cors(corsOptions));
app.use('/events', cors(corsOptions));
    `,
    validationPlugins: ["cors", "protocol", "security-scanner"],
    riskLevel: "low",
    estimatedTime: "5 minutes",
    filesAffected: ["src/server.ts"],
  },

  "performance.memory": {
    id: "performance.memory",
    name: "Optimize Memory Usage",
    description: "Reduces memory footprint and prevents memory leaks",
    area: "performance",
    severity: "minor",
    checklist: [
      "✓ Profile current memory usage patterns",
      "✓ Identify memory leaks in long-running processes",
      "✓ Add garbage collection hints where appropriate",
      "✓ Optimize data structures for memory efficiency",
      "✓ Add memory monitoring and alerts",
      "✓ Implement connection pooling for database connections",
      "✓ Add cleanup for event listeners and timers",
      "✓ Configure appropriate Node.js memory limits",
    ],
    codeTemplate: `
// Add to src/utils/memory-monitor.ts
export class MemoryMonitor {
  private checkInterval: NodeJS.Timeout | null = null;

  start(intervalMs: number = 60000): void {
    this.checkInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(usage.heapTotal / 1024 / 1024);

      console.log(\`[Memory] \${usedMB}MB / \${totalMB}MB\`);

      // Alert if memory usage is high
      if (usedMB > 500) { // 500MB threshold
        console.warn(\`[Memory] High memory usage detected: \${usedMB}MB\`);
        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Add cleanup utilities
export function cleanupResources(): void {
  // Clear any pending timeouts
  clearTimeouts();

  // Remove event listeners
  removeAllListeners();

  // Close database connections
  closeConnections();
}
    `,
    validationPlugins: ["performance", "memory-profiling"],
    riskLevel: "low",
    estimatedTime: "20-30 minutes",
    filesAffected: ["src/server.ts", "src/utils/memory-monitor.ts"],
  },

  "conversation.storage": {
    id: "conversation.storage",
    name: "Fix Conversation Storage",
    description: "Improves conversation storage performance and reliability",
    area: "development",
    severity: "minor",
    checklist: [
      "✓ Review conversation storage implementation",
      "✓ Add proper error handling for storage failures",
      "✓ Implement conversation compression for long sessions",
      "✓ Add conversation cleanup for old sessions",
      "✓ Optimize database queries for conversation retrieval",
      "✓ Add conversation backup and restore functionality",
      "✓ Test conversation persistence across server restarts",
      "✓ Validate conversation export/import features",
    ],
    codeTemplate: `
// Add to src/storage/conversation-storage.ts
export class EnhancedConversationStorage {
  private compressionEnabled = true;
  private maxConversationAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  async saveConversation(
    sessionId: string,
    messages: ChatMessage[]
  ): Promise<void> {
    try {
      const data = this.compressionEnabled
        ? this.compressMessages(messages)
        : messages;

      await this.storage.set(\`conversation:\${sessionId}\`, data);

      // Update last accessed time
      await this.storage.set(\`conversation:\${sessionId}:lastAccess\`, Date.now());

    } catch (error) {
      console.error(\`Failed to save conversation \${sessionId}:\`, error);
      // Fallback to in-memory storage
      await this.saveToMemory(sessionId, messages);
    }
  }

  async cleanupOldConversations(): Promise<void> {
    const cutoff = Date.now() - this.maxConversationAge;
    const keys = await this.storage.getKeys('conversation:*:lastAccess');

    for (const key of keys) {
      const lastAccess = await this.storage.get(key);
      if (lastAccess < cutoff) {
        const sessionId = key.split(':')[1];
        await this.storage.delete(\`conversation:\${sessionId}\`);
        await this.storage.delete(key);
      }
    }
  }

  private compressMessages(messages: ChatMessage[]): Uint8Array {
    // Implement message compression
    const json = JSON.stringify(messages);
    return Buffer.from(json);
  }
}
    `,
    validationPlugins: ["conversation-storage", "performance"],
    riskLevel: "low",
    estimatedTime: "15-20 minutes",
    filesAffected: [
      "src/storage/conversation-storage.ts",
      "src/conversation/manager.ts",
    ],
  },
};

/**
 * Get template by ID
 */
export function getTemplate(id: string): FixTemplate | undefined {
  return FixTemplates[id];
}

export function getAllTemplates(): FixTemplate[] {
  return Object.values(FixTemplates);
}

/**
 * Get all templates for a specific area
 */
export function getTemplatesByArea(area: string): FixTemplate[] {
  return Object.values(FixTemplates).filter(
    (template) => template.area === area,
  );
}

/**
 * Get templates by severity level
 */
export function getTemplatesBySeverity(
  severity: FixTemplate["severity"],
): FixTemplate[] {
  return Object.values(FixTemplates).filter(
    (template) => template.severity === severity,
  );
}

/**
 * Get template recommendations based on findings
 */
export function getTemplateRecommendations(findings: Finding[]): FixTemplate[] {
  const recommendations: FixTemplate[] = [];

  for (const finding of findings) {
    if (finding.templateId) {
      const template = getTemplate(finding.templateId);
      if (template && !recommendations.find((t) => t.id === template.id)) {
        recommendations.push(template);
      }
    }
  }

  return recommendations.sort((a, b) => {
    // Sort by severity first, then by estimated time
    const severityOrder = { blocker: 0, major: 1, minor: 2, info: 3 };
    const aSeverity = severityOrder[a.severity];
    const bSeverity = severityOrder[b.severity];

    if (aSeverity !== bSeverity) {
      return aSeverity - bSeverity;
    }

    // If same severity, prioritize faster fixes
    const aTime = Number.parseInt(a.estimatedTime, 10) || 999;
    const bTime = Number.parseInt(b.estimatedTime, 10) || 999;
    return aTime - bTime;
  });
}
