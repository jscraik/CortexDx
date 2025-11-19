/**
 * CortexDx Server - FastMCP Implementation
 * Simplified HTTP server using FastMCP's native HTTP transport
 * 
 * ARCHITECTURE UPDATE (Auth Migration Phase 1):
 * - Main Server (Public): Runs on PORT. Handles .well-known, custom endpoints, and proxies MCP traffic.
 * - FastMCP Server (Internal): Runs on PORT + 1. Handles standard MCP protocol.
 */

import { FastMCP } from "fastmcp";
import { existsSync, mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer as createHttpServer, request as httpRequest } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import { createLogger } from "./logging/logger.js";

// Tools and resources
import {
  getMcpDocsResource,
  listMcpDocsResources,
} from "./resources/mcp-docs-store.js";
import {
  getResearchResource,
  listResearchResources,
} from "./resources/research-store.js";
import {
  executeAcademicIntegrationTool,
  executeDeepContextTool,
  executeMcpDocsTool,
  findMcpTool,
  getAllMcpToolsFlat,
} from "./tools/index.js";

// Registry and providers
import { getAcademicRegistry } from "./registry/index.js";

// Healing and monitoring
import { AutoHealer } from "./healing/auto-healer.js";
import {
  buildQuickHealthPayload,
  performHealthCheck,
  recordDiagnostic,
} from "./observability/health-checks.js";
import { getGlobalMonitoring } from "./observability/monitoring.js";

// Middleware
import { createRateLimiterFromEnv } from "./middleware/rate-limiter.js";
import { safeParseJson } from "./utils/json.js";

// Plugin system
import { ConversationManager } from "./conversation/manager.js";
import { runPlugins } from "./plugin-host.js";

// Tasks
import { TaskExecutor, TaskStore } from "./tasks/index.js";

// Types
import type {
  DevelopmentContext,
  DiagnosticContext,
  McpTool,
  McpToolResult,
} from "./types.js";

// Server config
import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_DOMAIN,
  DEFAULT_TIER,
  HOST,
  PORT,
  REQUIRE_AUTH,
  REQUIRE_LICENSE,
  RESTRICTED_TOOLS
} from "./server/config.js";

// Auth and license middleware
import {
  type AuthMiddlewareConfig,
  type AuthenticatedRequest,
  createAuthMiddleware
} from "./plugins/auth-middleware.js";
import type { LicenseKey } from "./plugins/commercial-licensing.js";
import {
  type LicenseEnforcementConfig,
  createFeatureAccessMiddleware,
  createLicenseEnforcementMiddleware,
} from "./plugins/license-enforcement.js";

// Logger
const serverLogger = createLogger({ component: "server-fastmcp" });

// License database (in production, this would be backed by a database)
const licenseDatabase = new Map<string, LicenseKey>();

// Initialize demo licenses
if (process.env.NODE_ENV !== "production") {
  licenseDatabase.set("community-demo-key", {
    key: "community-demo-key",
    tier: "community",
    features: ["basic-diagnostics", "protocol-validation", "core-mcp-tools"],
  });

  licenseDatabase.set("professional-demo-key", {
    key: "professional-demo-key",
    tier: "professional",
    features: [
      "basic-diagnostics",
      "protocol-validation",
      "core-mcp-tools",
      "advanced-diagnostics",
      "llm-backends",
      "academic-validation",
      "performance-profiling",
      "security-scanning",
    ],
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  });

  licenseDatabase.set("enterprise-demo-key", {
    key: "enterprise-demo-key",
    tier: "enterprise",
    features: ["*"],
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    organizationId: "demo-org",
    maxUsers: 100,
  });
}

// Initialize Auth0 middleware
const authMiddlewareConfig: AuthMiddlewareConfig = {
  auth0: {
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_CLIENT_ID,
    audience: AUTH0_AUDIENCE,
  },
  requireAuth: REQUIRE_AUTH,
  publicEndpoints: [
    "/health",
    "/providers",
    "/.well-known/mcp-configuration", // Allow public access to config
    "/sse", // Allow initial connection (auth handled via protocol or headers)
    "/messages",
  ],
};

const authMiddleware = createAuthMiddleware(authMiddlewareConfig);

// Initialize license enforcement middleware
const licenseEnforcementConfig: LicenseEnforcementConfig = {
  licenseDatabase,
  requireLicense: REQUIRE_LICENSE,
  defaultTier: DEFAULT_TIER,
};

const licenseEnforcementMiddleware = createLicenseEnforcementMiddleware(
  licenseEnforcementConfig,
);
const featureAccessMiddleware = createFeatureAccessMiddleware();

// Initialize registry
const registry = getAcademicRegistry();

// Initialize conversation manager
const conversationManager = new ConversationManager();

// Initialize Tasks API
const taskDbPath = process.env.CORTEXDX_TASKS_DB || join(process.cwd(), ".cortexdx", "tasks.db");
mkdirSync(join(process.cwd(), ".cortexdx"), { recursive: true });
const taskStore = new TaskStore(taskDbPath);
const taskExecutor = new TaskExecutor(taskStore);

// Prune expired tasks every 5 minutes
const TASK_PRUNE_INTERVAL = 5 * 60 * 1000;
const taskPruneInterval = setInterval(() => {
  const pruned = taskStore.pruneExpired();
  if (pruned > 0) {
    serverLogger.info({ count: pruned }, "Pruned expired tasks");
  }
}, TASK_PRUNE_INTERVAL);

// Initialize monitoring
const monitoring = getGlobalMonitoring();
const ENABLE_MONITORING = process.env.ENABLE_MONITORING !== "false";

/**
 * Create diagnostic context for tool execution
 */
const createDiagnosticContext = (sessionId?: string): DiagnosticContext => {
  const diagnosticLogger = createLogger({ component: "diagnostic" });

  return {
    endpoint: `http://${HOST}:${PORT}`,
    headers: {},
    logger: (...args: unknown[]) => {
      diagnosticLogger.info({ data: args }, "Diagnostic log");
    },
    request: async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
      const response = await fetch(input, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json() as T;
    },
    jsonrpc: async <T>(): Promise<T> => ({}) as T,
    sseProbe: async () => ({ ok: true }),
    evidence: () => undefined,
    deterministic: false,
  };
};

/**
 * Create development context for tool execution
 */
const createDevelopmentContext = (sessionId?: string): DevelopmentContext => {
  const baseCtx = createDiagnosticContext(sessionId);
  return {
    ...baseCtx,
    sessionId: sessionId || `session-${Date.now()}`,
    userExpertiseLevel: "intermediate",
    conversationHistory: [],
  };
};

/**
 * Execute a development tool
 */
const executeDevelopmentTool = async (
  tool: McpTool,
  args: unknown,
  ctx: DevelopmentContext,
): Promise<McpToolResult> => {
  switch (tool.name) {
    case "diagnose_mcp_server": {
      const { endpoint, suites = [], full = false } = args as {
        endpoint: string;
        suites?: string[];
        full?: boolean;
      };
      recordDiagnostic();
      const results = await runPlugins({
        endpoint,
        suites,
        full,
        deterministic: ctx.deterministic || false,
        budgets: { timeMs: 30000, memMb: 256 },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }

    case "start_conversation": {
      const { intent, context } = args as { intent: string; context?: string };
      const session = await conversationManager.startConversation(ctx, intent, context);
      return {
        content: [{ type: "text", text: JSON.stringify(session, null, 2) }],
      };
    }

    case "continue_conversation": {
      const { sessionId, userInput } = args as { sessionId: string; userInput: string };
      const response = await conversationManager.continueConversation(sessionId, userInput);
      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    }

    case "cortexdx_academic_research":
      return await executeAcademicIntegrationTool(tool, args);

    case "cortexdx_deepcontext_index":
    case "cortexdx_deepcontext_search":
    case "cortexdx_deepcontext_status":
    case "cortexdx_deepcontext_clear":
      return await executeDeepContextTool(tool, args, ctx);

    case "cortexdx_mcp_docs_search":
    case "cortexdx_mcp_docs_lookup":
    case "cortexdx_mcp_docs_versions":
      return await executeMcpDocsTool(tool, args, ctx);

    default:
      throw new Error(`Unknown development tool: ${tool.name}`);
  }
};

/**
 * Create and configure the FastMCP server
 */
export function createFastMCPServer() {
  const mcp = new FastMCP({
    name: "CortexDx Server",
    version: "1.0.0",
  });

  // Register all tools
  const allTools = getAllMcpToolsFlat();

  for (const tool of allTools) {
    // Convert tool's inputSchema to Zod schema for FastMCP
    const zodSchema = tool.inputSchema
      ? createZodSchemaFromJsonSchema(tool.inputSchema as Record<string, unknown>)
      : z.object({});

    // Determine if tool is destructive
    const isDestructive = tool.name === "cortexdx_delete_workflow" || 
                          tool.name === "cortexdx_deepcontext_clear";

    mcp.addTool({
      name: tool.name,
      description: tool.description || "",
      parameters: zodSchema,
      // @ts-ignore - FastMCP types might not yet reflect the latest RC annotations fully in all versions, but we pass it for compatibility
      isDestructive,
      execute: async (args: Record<string, unknown>) => {
        const ctx = createDevelopmentContext();

        // Check if tool is restricted (requires admin role via OAuth2)
        // Restricted tools must be accessed via admin endpoints with proper authentication
        if (RESTRICTED_TOOLS.has(tool.name)) {
          const endpointMap: Record<string, string> = {
            "wikidata_sparql": "/admin/tools/wikidata-sparql",
            "cortexdx_delete_workflow": "/admin/tools/delete-workflow",
          };
          const endpoint = endpointMap[tool.name] || "/admin/tools";
          
          // Throw a proper error instead of returning a JSON error object
          throw new Error(
            `Tool ${tool.name} requires admin role. Use POST ${endpoint} on port ${PORT + 1} with OAuth2 authentication.`
          );
        }

        // Try development tools first
        const mcpTool = findMcpTool(tool.name);
        if (mcpTool) {
          const result = await executeDevelopmentTool(mcpTool, args, ctx);
          return result.content[0]?.text || JSON.stringify(result);
        }

        // Try academic providers
        const providers = registry.getAllProviders();
        for (const [providerId, providerReg] of Object.entries(providers)) {
          const tools = providerReg.capabilities.tools as Array<{ name?: string }>;
          const hasTool = tools.some((t) => t.name === tool.name);
          if (hasTool) {
            const diagCtx = createDiagnosticContext();
            const providerInstance = registry.createProviderInstance(providerId, diagCtx);
            const result = await providerInstance.executeTool(tool.name, args as Record<string, unknown>);
            return JSON.stringify(result, null, 2);
          }
        }

        throw new Error(`Tool not found: ${tool.name}`);
      },
    });
  }

  // Register academic provider tools
  const providers = registry.getAllProviders();
  for (const [providerId, providerReg] of Object.entries(providers)) {
    const tools = providerReg.capabilities.tools as Array<{
      name?: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
    }>;

    for (const providerTool of tools) {
      if (!providerTool.name) continue;

      // Skip if already registered
      if (allTools.some(t => t.name === providerTool.name)) continue;

      const zodSchema = providerTool.inputSchema
        ? createZodSchemaFromJsonSchema(providerTool.inputSchema)
        : z.object({});

      mcp.addTool({
        name: providerTool.name,
        description: providerTool.description || "",
        parameters: zodSchema,
        execute: async (args: Record<string, unknown>) => {
          const ctx = createDiagnosticContext();
          const providerInstance = registry.createProviderInstance(providerId, ctx);
          const result = await providerInstance.executeTool(
            providerTool.name!,
            args as Record<string, unknown>
          );
          return JSON.stringify(result, null, 2);
        },
      });
    }
  }

  // Register resources
  // Research resources
  mcp.addResource({
    uri: "cortexdx://research",
    name: "Academic Research Resources",
    description: "Academic research results stored by CortexDx",
    mimeType: "application/json",
    async load() {
      const resources = listResearchResources();
      return {
        text: JSON.stringify(resources.map(r => ({
          uri: `cortexdx://research/${r.id}`,
          name: `Academic Research — ${r.report.topic}`,
          description: `Captured ${new Date(r.createdAt).toISOString()}`,
        })), null, 2),
      };
    },
  });

  // Dynamic research resource template
  mcp.addResourceTemplate({
    uriTemplate: "cortexdx://research/{id}",
    name: "Research Resource",
    description: "Individual academic research result",
    mimeType: "application/json",
    arguments: [
      {
        name: "id",
        description: "Research ID",
        required: true,
      },
    ],
    async load(args: any) {
      const { id } = args;
      const resource = getResearchResource(id);
      if (!resource) {
        throw new Error(`Resource not found: ${id}`);
      }
      return {
        text: JSON.stringify(resource.report, null, 2),
      };
    },
  });

  // MCP docs resources
  mcp.addResource({
    uri: "cortexdx://mcp-docs",
    name: "MCP Documentation Resources",
    description: "MCP documentation chunks stored by CortexDx",
    mimeType: "application/json",
    async load() {
      const resources = listMcpDocsResources();
      return {
        text: JSON.stringify(resources.map(r => {
          const payload = r.payload as { query?: string; chunk?: { title?: string; url?: string } };
          let name: string;
          if (r.type === "search") {
            if (!payload.query || typeof payload.query !== "string" || payload.query.trim() === "") {
              name = "MCP Docs Search — MISSING QUERY";
            } else {
              name = `MCP Docs Search — ${payload.query}`;
            }
          } else {
            const chunk = payload.chunk;
            if (!chunk || (!chunk.title && !chunk.url)) {
              name = "MCP Docs Chunk — MISSING TITLE/URL";
            } else if (chunk.title) {
              name = `MCP Docs Chunk — ${chunk.title}`;
            } else if (chunk.url) {
              name = `MCP Docs Chunk — ${chunk.url}`;
            } else {
              name = `MCP Docs Chunk — ${r.id}`;
            }
          }
          return {
            uri: `cortexdx://mcp-docs/${r.id}`,
            name,
            description: `Captured ${new Date(r.createdAt).toISOString()}`,
          };
        }), null, 2),
      };
    },
  });

  // Dynamic MCP docs resource template
  mcp.addResourceTemplate({
    uriTemplate: "cortexdx://mcp-docs/{id}",
    name: "MCP Docs Resource",
    description: "Individual MCP documentation chunk",
    mimeType: "application/json",
    arguments: [
      {
        name: "id",
        description: "Doc ID",
        required: true,
      },
    ],
    async load(args: any) {
      const { id } = args;
      const resource = getMcpDocsResource(id);
      if (!resource) {
        throw new Error(`Resource not found: ${id}`);
      }
      return {
        text: JSON.stringify(resource.payload, null, 2),
      };
    },
  });

  return mcp;
}

/**
 * Convert JSON Schema to Zod schema (recursive version)
 */
function createZodSchemaFromJsonSchema(jsonSchema: Record<string, unknown>): z.ZodType {
  // Handle basic types
  if (jsonSchema.type === "string") {
    let schema = z.string();
    if (jsonSchema.enum && Array.isArray(jsonSchema.enum)) {
      // @ts-ignore - Zod enum expects non-empty array of strings
      return z.enum(jsonSchema.enum as [string, ...string[]]);
    }
    if (jsonSchema.description) {
      schema = schema.describe(jsonSchema.description as string);
    }
    return schema;
  }

  if (jsonSchema.type === "number" || jsonSchema.type === "integer") {
    let schema = z.number();
    if (jsonSchema.description) {
      schema = schema.describe(jsonSchema.description as string);
    }
    return schema;
  }

  if (jsonSchema.type === "boolean") {
    let schema = z.boolean();
    if (jsonSchema.description) {
      schema = schema.describe(jsonSchema.description as string);
    }
    return schema;
  }

  if (jsonSchema.type === "array") {
    const items = jsonSchema.items as Record<string, unknown> | undefined;
    const itemSchema = items ? createZodSchemaFromJsonSchema(items) : z.unknown();
    let schema = z.array(itemSchema);
    if (jsonSchema.description) {
      schema = schema.describe(jsonSchema.description as string);
    }
    return schema;
  }

  if (jsonSchema.type === "object" || jsonSchema.properties) {
    const properties = (jsonSchema.properties || {}) as Record<string, unknown>;
    const required = (jsonSchema.required as string[]) || [];
    
    const shape: Record<string, z.ZodType> = {};

    for (const [key, prop] of Object.entries(properties)) {
      const propSchema = prop as Record<string, unknown>;
      let zodType = createZodSchemaFromJsonSchema(propSchema);

      // Make optional if not required
      if (!required.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    let schema = z.object(shape).passthrough();
    if (jsonSchema.description) {
      schema = schema.describe(jsonSchema.description as string);
    }
    return schema;
  }

  // Fallback for unknown types
  return z.unknown();
}

/**
 * Create Main HTTP Server (Public)
 * Handles .well-known, custom endpoints, and proxies MCP traffic
 */
function createMainServer(port: number, internalMcpPort: number) {
  // Read allowed origins from environment variable (comma-separated)
  const allowedOrigins = (process.env.CORTEXDX_ALLOWED_ORIGINS
    ? process.env.CORTEXDX_ALLOWED_ORIGINS.split(",").map(o => o.trim()).filter(Boolean)
    : ["http://localhost", "http://127.0.0.1"]).map(origin => origin.toLowerCase());

  const server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS
    const requestOrigin = req.headers.origin?.toLowerCase();
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Apply authentication middleware
    let authPassed = false;
    await authMiddleware(req, res, () => {
      authPassed = true;
    });

    if (!authPassed) {
      return; // Auth middleware already sent response
    }

    // Apply license enforcement middleware
    let licensePassed = false;
    await licenseEnforcementMiddleware(req, res, () => {
      licensePassed = true;
    });

    if (!licensePassed) {
      return; // License middleware already sent response
    }

    const url = new URL(req.url || "/", `http://${HOST}:${port}`);
    const path = url.pathname;

    try {
      // ---------------------------------------------------------
      // 1. MCP Configuration Endpoint (Discovery)
      // ---------------------------------------------------------
      if (path === "/.well-known/mcp-configuration") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          authorization_endpoint: process.env.MCP_AUTH_ENDPOINT || `http://${HOST}:${port}/auth/authorize`,
          token_endpoint: process.env.MCP_TOKEN_ENDPOINT || `http://${HOST}:${port}/auth/token`,
          capabilities: {
            authorization: {},
            // Add other capabilities as needed
          }
        }));
        return;
      }

      // ---------------------------------------------------------
      // 1.5 Auth Endpoints (OAuth 2.1)
      // ---------------------------------------------------------
      if (path === "/auth/authorize") {
        if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Auth0 not configured" }));
          return;
        }

        const params = new URLSearchParams(url.search);
        // Ensure required params for Auth0
        if (!params.has("client_id")) params.set("client_id", AUTH0_CLIENT_ID);
        if (!params.has("response_type")) params.set("response_type", "code");
        if (!params.has("audience") && AUTH0_AUDIENCE) params.set("audience", AUTH0_AUDIENCE);
        
        // Construct Auth0 authorize URL
        const auth0Url = `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`;
        
        res.writeHead(302, { Location: auth0Url });
        res.end();
        return;
      }

      if (path === "/auth/token" && req.method === "POST") {
        if (!AUTH0_DOMAIN) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Auth0 not configured" }));
          return;
        }

        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            // Proxy to Auth0 token endpoint
            const tokenRes = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: body,
            });

            const data = await tokenRes.json();
            res.writeHead(tokenRes.status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(data));
          } catch (error) {
            serverLogger.error({ error }, "Token proxy error");
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to proxy token request" }));
          }
        });
        return;
      }

      // ---------------------------------------------------------
      // 2. Proxy to Internal FastMCP Server (/sse, /messages)
      // ---------------------------------------------------------
      if (path === "/sse" || path === "/messages" || path.startsWith("/messages/")) {
        const options = {
          hostname: HOST,
          port: internalMcpPort,
          path: req.url,
          method: req.method,
          headers: req.headers,
        };

        const proxyReq = httpRequest(options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
          proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (e) => {
          serverLogger.error({ error: e }, "Proxy error");
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Bad Gateway: Failed to connect to MCP server" }));
          }
        });

        req.pipe(proxyReq, { end: true });
        return;
      }

      // ---------------------------------------------------------
      // 3. Custom Endpoints (Health, Providers, etc.)
      // ---------------------------------------------------------
      
      // Health check
      if (path === "/health") {
        const detailed = url.searchParams.get("detailed") === "true";

        if (detailed) {
          const ctx = createDiagnosticContext();
          const health = await performHealthCheck(ctx, {
            enableDetailedChecks: true,
            includeMetrics: true,
            timeout: 5000,
          });
          res.writeHead(health.status === "healthy" ? 200 : 503, {
            "Content-Type": "application/json",
          });
          res.end(JSON.stringify(health));
        } else {
          const providers = Object.keys(registry.getAllProviders());
          const stateDbPath = join(process.cwd(), ".cortexdx", "workflow-state.db");
          const quickPayload = buildQuickHealthPayload({
            providers,
            responseTimeMs: 0,
            stateDbPath,
            stateDbExists: existsSync(stateDbPath),
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(quickPayload));
        }
        return;
      }

      // Providers list
      if (path === "/providers") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          providers: registry.getAllProviders(),
          categories: registry.getCategories(),
        }));
        return;
      }

      // Monitoring status
      if (path === "/monitoring/status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          monitoring: monitoring.getStatus(),
          alerts: monitoring.getAlerts(),
          timestamp: new Date().toISOString(),
        }));
        return;
      }

      // Self-diagnosis API
      if (path === "/api/v1/self-diagnose" && req.method === "POST") {
        const rateLimiter = createRateLimiterFromEnv();
        const allowed = await rateLimiter(req, res, "/api/v1/self-diagnose");
        if (!allowed) return;

        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            // Define Zod schema for self-diagnose options
            const SelfDiagnoseOptionsSchema = z.object({
              autoFix: z.boolean().optional(),
              dryRun: z.boolean().optional(),
              severity: z.enum(["blocker", "major", "minor", "info"]).optional(),
            });
            const optionsRaw = body ? safeParseJson(body, "self-diagnose options") : {};
            const parseResult = SelfDiagnoseOptionsSchema.safeParse(optionsRaw);
            if (!parseResult.success) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                success: false,
                error: "Invalid request body: " + parseResult.error.message,
                timestamp: new Date().toISOString(),
              }));
              return;
            }
            const options = parseResult.data;
            const ctx = createDevelopmentContext();
            const healer = new AutoHealer(ctx);
            const report = await healer.healSelf({
              autoFix: options.autoFix ?? false,
              dryRun: options.dryRun ?? false,
              severityThreshold: options.severity ?? "major",
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, report, timestamp: new Date().toISOString() }));
          } catch (error) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(error), timestamp: new Date().toISOString() }));
          }
        });
        return;
      }

      // Quick health check API
      if (path === "/api/v1/health" && req.method === "GET") {
        const ctx = createDevelopmentContext();
        const healer = new AutoHealer(ctx);
        const health = await healer.quickHealthCheck();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, health, timestamp: new Date().toISOString() }));
        return;
      }

      // Admin dashboard endpoint (requires admin role)
      if (path === "/admin/dashboard") {
        const authReq = req as AuthenticatedRequest;
        const hasAdminRole = authReq.auth?.roles.includes("admin") ?? false;

        if (!hasAdminRole && REQUIRE_AUTH) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: "Forbidden",
            message: "Admin role required for dashboard access",
          }));
          return;
        }

        const { getAdminDashboardImpl } = await import("./tools/commercial-feature-impl.js");
        const result = await getAdminDashboardImpl();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(result.content[0]?.text || "{}");
        return;
      }

      // License management endpoint
      if (path === "/admin/licenses") {
        const authReq = req as AuthenticatedRequest;
        const hasAdminRole = authReq.auth?.roles.includes("admin") ?? false;

        if (!hasAdminRole && REQUIRE_AUTH) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: "Forbidden",
            message: "Admin role required for license management",
          }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          licenses: Array.from(licenseDatabase.entries()).map(([key, license]) => ({
            key,
            tier: license.tier,
            features: license.features,
            expiresAt: license.expiresAt,
            organizationId: license.organizationId,
            maxUsers: license.maxUsers,
          })),
        }));
        return;
      }

      // Admin tool: wikidata_sparql (requires admin role)
      if (path === "/admin/tools/wikidata-sparql" && req.method === "POST") {
        const authReq = req as AuthenticatedRequest;
        const hasAdminRole = authReq.auth?.roles.includes("admin") ?? false;

        if (!hasAdminRole && REQUIRE_AUTH) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: "Forbidden",
            message: "Admin role required for wikidata_sparql tool",
          }));
          return;
        }

        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const params = body ? safeParseJson(body, "wikidata sparql params") : {};
            const ctx = createDiagnosticContext();
            const providerInstance = registry.createProviderInstance("wikidata", ctx);
            const result = await providerInstance.executeTool("wikidata_sparql", params as Record<string, unknown>);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, result, timestamp: new Date().toISOString() }));
          } catch (error) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(error), timestamp: new Date().toISOString() }));
          }
        });
        return;
      }

      // Admin tool: cortexdx_delete_workflow (requires admin role)
      if (path === "/admin/tools/delete-workflow" && req.method === "POST") {
        const authReq = req as AuthenticatedRequest;
        const hasAdminRole = authReq.auth?.roles.includes("admin") ?? false;

        if (!hasAdminRole && REQUIRE_AUTH) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: "Forbidden",
            message: "Admin role required for cortexdx_delete_workflow tool",
          }));
          return;
        }

        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const params = body ? safeParseJson(body, "delete workflow params") : {};
            const mcpTool = findMcpTool("cortexdx_delete_workflow");
            if (!mcpTool) {
              throw new Error("Tool not found: cortexdx_delete_workflow");
            }
            const ctx = createDevelopmentContext();
            const result = await executeDevelopmentTool(mcpTool, params, ctx);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, result, timestamp: new Date().toISOString() }));
          } catch (error) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(error), timestamp: new Date().toISOString() }));
          }
        });
        return;
      }

      // 404
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (error) {
      serverLogger.error({ error }, "Main server error");
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });

  return server;
}

/**
 * Start the CortexDx server
 */
export async function startServer() {
  const mcp = createFastMCPServer();

  // Ports
  const mainPort = PORT;
  const internalMcpPort = PORT + 1; // Internal FastMCP port

  // Start FastMCP server (Internal)
  await mcp.start({
    transportType: "httpStream",
    httpStream: {
      port: internalMcpPort,
      host: HOST,
    },
  });

  serverLogger.info(`Internal FastMCP Server running on http://${HOST}:${internalMcpPort}`);

  // Start Main Server (Public)
  const mainServer = createMainServer(mainPort, internalMcpPort);
  
  mainServer.on("error", (err) => {
    serverLogger.error({ error: err }, "Main server error");
  });

  mainServer.listen(mainPort, HOST, () => {
    serverLogger.info(`Main Server running on http://${HOST}:${mainPort}`);
    serverLogger.info(`  - MCP Config: http://${HOST}:${mainPort}/.well-known/mcp-configuration`);
    serverLogger.info(`  - MCP SSE: http://${HOST}:${mainPort}/sse`);
    serverLogger.info(`  - Health: http://${HOST}:${mainPort}/health`);
    serverLogger.info(`  - Providers: http://${HOST}:${mainPort}/providers`);
    serverLogger.info(`  - Monitoring: http://${HOST}:${mainPort}/monitoring/status`);
    serverLogger.info(`  - Self-diagnose: http://${HOST}:${mainPort}/api/v1/self-diagnose`);
  });

  // Start monitoring if enabled
  if (ENABLE_MONITORING) {
    const ctx = createDiagnosticContext();
    monitoring.setContext(ctx);
    monitoring.start();
    serverLogger.info("Monitoring enabled");
  }

  // Graceful shutdown
  const shutdown = async () => {
    serverLogger.info("Shutting down...");
    clearInterval(taskPruneInterval);
    taskStore.close();
    monitoring.stop();
    await mcp.stop();
    mainServer.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return { mcp, mainServer };
}

// Auto-start if running directly
const SHOULD_LISTEN = process.env.VITEST !== "true" && process.env.NODE_ENV !== "test";

if (SHOULD_LISTEN) {
  startServer().catch((error) => {
    serverLogger.error({ error }, "Failed to start server");
    process.exit(1);
  });
}

export { createDevelopmentContext, createDiagnosticContext };

