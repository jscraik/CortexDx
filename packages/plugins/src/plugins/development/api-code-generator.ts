/**
 * API Code Generator Plugin
 * Generates API-to-MCP connectors with authentication wrappers
 * Requirements: 2.2, 8.1, 8.2
 * Performance: <60s response time
 */

import type {
  CodeSample,
  DevelopmentContext,
  DevelopmentPlugin,
  FilePlan,
  Finding,
} from "@brainwav/cortexdx-core";

export const ApiCodeGeneratorPlugin: DevelopmentPlugin = {
  id: "api-code-generator",
  title: "API-to-MCP Code Generator",
  category: "development",
  order: 11,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Check if LLM is available
    if (!ctx.conversationalLlm) {
      findings.push({
        id: "api-codegen.llm.missing",
        area: "development",
        severity: "minor",
        title: "API code generation LLM not available",
        description:
          "No LLM adapter configured for API-to-MCP code generation.",
        evidence: [{ type: "log", ref: "api-code-generator" }],
        recommendation:
          "Configure an LLM adapter to enable AI-powered API connector generation.",
      });
      return findings;
    }

    // Analyze conversation for API specification mentions
    const conversation = ctx.conversationHistory
      .map((m) => m.content)
      .join(" ");
    const hasApiSpec = detectApiSpecification(conversation);

    if (hasApiSpec.detected) {
      findings.push({
        id: "api-codegen.spec.detected",
        area: "development",
        severity: "info",
        title: `${hasApiSpec.type} API specification detected`,
        description: `I can generate an MCP connector for your ${hasApiSpec.type} API with proper authentication and error handling.`,
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation: `I'll create:\n- MCP tool definitions from API endpoints\n- ${hasApiSpec.authType} authentication wrapper\n- Request/response mapping\n- Error handling and retries\n- Type definitions\n- Documentation`,
        remediation: {
          filePlan: generateApiConnectorPlan(hasApiSpec, ctx),
          steps: [
            "Parse API specification and extract endpoints",
            "Generate MCP tool definitions for each endpoint",
            "Create authentication wrapper with credential management",
            "Implement request/response transformation",
            "Add error handling and retry logic",
            "Generate type definitions and documentation",
          ],
          codeSamples: generateApiConnectorSamples(hasApiSpec),
        },
      });
    }

    // Check for authentication requirements
    const authRequirements = detectAuthRequirements(conversation);
    if (authRequirements.length > 0) {
      findings.push({
        id: "api-codegen.auth.detected",
        area: "development",
        severity: "info",
        title: `Authentication requirements detected: ${authRequirements.join(", ")}`,
        description:
          "I can generate secure authentication wrappers for your API connector.",
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation: `I'll implement:\n${authRequirements.map((auth) => `- ${auth} authentication flow`).join("\n")}\n- Secure credential storage\n- Token refresh handling\n- Error recovery`,
        remediation: {
          codeSamples: generateAuthSamples(authRequirements),
        },
      });
    }

    // Check project context for API connector opportunities
    if (ctx.projectContext?.type === "mcp-connector") {
      const { sourceFiles, language } = ctx.projectContext;

      if (sourceFiles.length === 0) {
        findings.push({
          id: "api-codegen.connector.needed",
          area: "development",
          severity: "info",
          title: "API connector implementation needed",
          description: `No source files found for ${language} MCP connector project.`,
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "Provide your API specification (OpenAPI, GraphQL schema, or endpoint documentation) and I'll generate a complete MCP connector.",
          remediation: {
            steps: [
              "Provide API specification or documentation",
              "Specify authentication method (OAuth2, API key, etc.)",
              "Define which endpoints to expose as MCP tools",
              "Generate connector with proper error handling",
              "Add tests and documentation",
            ],
          },
        });
      }
    }

    // Check for tool definition generation requests
    const hasToolRequest = ctx.conversationHistory
      .slice(-3)
      .some(
        (msg) =>
          msg.role === "user" &&
          (msg.content.toLowerCase().includes("tool definition") ||
            msg.content.toLowerCase().includes("generate tools") ||
            msg.content.toLowerCase().includes("api endpoint")),
      );

    if (hasToolRequest) {
      findings.push({
        id: "api-codegen.tools.request",
        area: "development",
        severity: "info",
        title: "Tool definition generation request detected",
        description:
          "I can generate MCP tool definitions from your API endpoints.",
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "Share your API endpoints and I'll create properly typed MCP tool definitions with input validation and documentation.",
      });
    }

    // Validate performance requirement (<60s)
    const duration = Date.now() - startTime;
    if (duration > 60000) {
      findings.push({
        id: "api-codegen.performance.slow",
        area: "performance",
        severity: "minor",
        title: "API code generation analysis exceeded time threshold",
        description: `Analysis took ${duration}ms, exceeding 60s requirement`,
        evidence: [{ type: "log", ref: "api-code-generator" }],
        confidence: 1.0,
      });
    }

    return findings;
  },
};

interface ApiSpecDetection {
  detected: boolean;
  type: "OpenAPI" | "GraphQL" | "REST" | "gRPC" | "unknown";
  authType: "OAuth2" | "API Key" | "Bearer Token" | "Basic Auth" | "None";
}

function detectApiSpecification(conversation: string): ApiSpecDetection {
  const lower = conversation.toLowerCase();

  let type: ApiSpecDetection["type"] = "unknown";
  if (lower.includes("openapi") || lower.includes("swagger")) {
    type = "OpenAPI";
  } else if (lower.includes("graphql")) {
    type = "GraphQL";
  } else if (lower.includes("grpc")) {
    type = "gRPC";
  } else if (lower.includes("rest") || lower.includes("api")) {
    type = "REST";
  }

  let authType: ApiSpecDetection["authType"] = "None";
  if (lower.includes("oauth") || lower.includes("oauth2")) {
    authType = "OAuth2";
  } else if (lower.includes("api key") || lower.includes("apikey")) {
    authType = "API Key";
  } else if (lower.includes("bearer")) {
    authType = "Bearer Token";
  } else if (lower.includes("basic auth")) {
    authType = "Basic Auth";
  }

  return {
    detected: type !== "unknown",
    type,
    authType,
  };
}

function detectAuthRequirements(conversation: string): string[] {
  const lower = conversation.toLowerCase();
  const requirements: string[] = [];

  if (lower.includes("oauth") || lower.includes("oauth2")) {
    requirements.push("OAuth2");
  }
  if (lower.includes("api key") || lower.includes("apikey")) {
    requirements.push("API Key");
  }
  if (lower.includes("bearer")) {
    requirements.push("Bearer Token");
  }
  if (lower.includes("basic auth")) {
    requirements.push("Basic Auth");
  }

  return requirements;
}

function generateApiConnectorPlan(
  spec: ApiSpecDetection,
  ctx: DevelopmentContext,
): FilePlan {
  const language = ctx.projectContext?.language || "typescript";
  const plan: FilePlan = [];

  if (language === "typescript" || language === "javascript") {
    plan.push(
      {
        action: "new",
        path: "src/connector.ts",
        description: "Main API-to-MCP connector",
      },
      {
        action: "new",
        path: "src/api-client.ts",
        description: "API client wrapper",
      },
      {
        action: "new",
        path: "src/tools.ts",
        description: "MCP tool definitions",
      },
      { action: "new", path: "src/types.ts", description: "Type definitions" },
      {
        action: "new",
        path: "src/auth.ts",
        description: `${spec.authType} authentication handler`,
      },
      {
        action: "new",
        path: "src/errors.ts",
        description: "Error handling utilities",
      },
      {
        action: "new",
        path: "src/config.ts",
        description: "Configuration management",
      },
    );
  } else if (language === "python") {
    plan.push(
      {
        action: "new",
        path: "src/connector.py",
        description: "Main API-to-MCP connector",
      },
      {
        action: "new",
        path: "src/api_client.py",
        description: "API client wrapper",
      },
      {
        action: "new",
        path: "src/tools.py",
        description: "MCP tool definitions",
      },
      {
        action: "new",
        path: "src/auth.py",
        description: `${spec.authType} authentication handler`,
      },
      {
        action: "new",
        path: "src/errors.py",
        description: "Error handling utilities",
      },
    );
  }

  return plan;
}

function generateApiConnectorSamples(spec: ApiSpecDetection): CodeSample[] {
  const samples: CodeSample[] = [];

  // Tool definition sample
  samples.push({
    language: "typescript",
    title: "MCP Tool Definition from API Endpoint",
    snippet: `export const apiTools: McpTool[] = [
  {
    name: "api_get_resource",
    description: "Fetch resource from API endpoint",
    inputSchema: {
      type: "object",
      properties: {
        resourceId: {
          type: "string",
          description: "Resource identifier"
        },
        includeMetadata: {
          type: "boolean",
          description: "Include metadata in response"
        }
      },
      required: ["resourceId"]
    }
  }
];`,
  });

  // Authentication wrapper sample
  if (spec.authType === "OAuth2") {
    samples.push({
      language: "typescript",
      title: "OAuth2 Authentication Wrapper",
      snippet: `export class OAuth2AuthHandler {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;

  async authenticate(credentials: OAuth2Credentials): Promise<void> {
    const response = await fetch(credentials.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret
      })
    });
    
    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
  }

  async getAuthHeader(): Promise<Record<string, string>> {
    if (Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
    return { Authorization: \`Bearer \${this.accessToken}\` };
  }
}`,
    });
  } else if (spec.authType === "API Key") {
    samples.push({
      language: "typescript",
      title: "API Key Authentication Wrapper",
      snippet: `export class ApiKeyAuthHandler {
  constructor(private apiKey: string, private headerName: string = "X-API-Key") {}

  getAuthHeader(): Record<string, string> {
    return { [this.headerName]: this.apiKey };
  }
}`,
    });
  }

  return samples;
}

function generateAuthSamples(authTypes: string[]): CodeSample[] {
  const samples: CodeSample[] = [];

  for (const authType of authTypes) {
    if (authType === "OAuth2") {
      samples.push({
        language: "typescript",
        title: "OAuth2 Flow Implementation",
        snippet: `async function handleOAuth2Flow(config: OAuth2Config): Promise<AuthResult> {
  // Authorization code flow
  const authUrl = new URL(config.authorizationUrl);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  
  // Exchange code for token
  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: authorizationCode,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri
    })
  });
  
  return await tokenResponse.json();
}`,
      });
    }

    if (authType === "API Key") {
      samples.push({
        language: "typescript",
        title: "API Key Management",
        snippet: `class ApiKeyManager {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  injectAuth(request: RequestInit): RequestInit {
    return {
      ...request,
      headers: {
        ...request.headers,
        "X-API-Key": this.apiKey
      }
    };
  }
}`,
      });
    }
  }

  return samples;
}
