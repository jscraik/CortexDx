/**
 * Problem Resolver Plugin
 * Automated fix generation for common MCP issues
 * Requirements: 3.3, 4.4, 9.4
 * Performance: <30s for fix generation
 */

import type {
  CodeSample,
  DevelopmentContext,
  DevelopmentPlugin,
  FilePlan,
  Finding,
} from "../../types.js";

export const ProblemResolverPlugin: DevelopmentPlugin = {
  id: "problem-resolver",
  title: "MCP Problem Resolver",
  category: "development",
  order: 12,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Check if LLM is available
    if (!ctx.conversationalLlm) {
      findings.push({
        id: "resolver.llm.missing",
        area: "development",
        severity: "minor",
        title: "Problem resolver LLM not available",
        description:
          "No LLM adapter configured for automated problem resolution.",
        evidence: [{ type: "log", ref: "problem-resolver" }],
        recommendation:
          "Configure an LLM adapter to enable AI-powered problem resolution.",
      });
      return findings;
    }

    // Analyze conversation for problem indicators
    const problems = detectProblems(ctx);

    for (const problem of problems) {
      const solution = generateSolution(problem, ctx);

      findings.push({
        id: `resolver.${problem.type}.${problem.id}`,
        area: "problem-resolution",
        severity: problem.severity,
        title: `Automated fix available: ${problem.title}`,
        description: problem.description,
        evidence: problem.evidence,
        recommendation: solution.recommendation,
        confidence: solution.confidence,
        remediation: {
          filePlan: solution.filePlan,
          steps: solution.steps,
          codeSamples: solution.codeSamples,
        },
        tags: ["automated-fix", problem.type, `risk-${solution.riskLevel}`],
      });
    }

    // Check for common MCP configuration issues
    const configIssues = detectConfigurationIssues(ctx);
    for (const issue of configIssues) {
      findings.push({
        id: `resolver.config.${issue.id}`,
        area: "configuration",
        severity: issue.severity,
        title: `Configuration fix available: ${issue.title}`,
        description: issue.description,
        evidence: issue.evidence,
        recommendation: issue.fix,
        remediation: {
          filePlan: issue.filePlan,
          steps: issue.steps,
        },
        tags: ["automated-fix", "configuration", "quick-fix"],
      });
    }

    // Check for protocol compliance issues
    const protocolIssues = detectProtocolIssues(ctx);
    for (const issue of protocolIssues) {
      findings.push({
        id: `resolver.protocol.${issue.id}`,
        area: "protocol-compliance",
        severity: issue.severity,
        title: `Protocol fix available: ${issue.title}`,
        description: issue.description,
        evidence: issue.evidence,
        recommendation: issue.fix,
        confidence: issue.confidence,
        remediation: {
          filePlan: issue.filePlan,
          steps: issue.steps,
          codeSamples: issue.codeSamples,
        },
        tags: ["automated-fix", "protocol", "compliance"],
      });
    }

    // Check for connection/integration issues
    const connectionIssues = detectConnectionIssues(ctx);
    for (const issue of connectionIssues) {
      findings.push({
        id: `resolver.connection.${issue.id}`,
        area: "integration",
        severity: issue.severity,
        title: `Connection fix available: ${issue.title}`,
        description: issue.description,
        evidence: issue.evidence,
        recommendation: issue.fix,
        remediation: {
          steps: issue.steps,
          codeSamples: issue.codeSamples,
        },
        tags: ["automated-fix", "connection", "integration"],
      });
    }

    // Validate performance requirement (<30s)
    const duration = Date.now() - startTime;
    if (duration > 30000) {
      findings.push({
        id: "resolver.performance.slow",
        area: "performance",
        severity: "minor",
        title: "Problem resolution analysis exceeded time threshold",
        description: `Analysis took ${duration}ms, exceeding 30s requirement`,
        evidence: [{ type: "log", ref: "problem-resolver" }],
        confidence: 1.0,
      });
    }

    return findings;
  },
};

interface DetectedProblem {
  id: string;
  type: "protocol" | "configuration" | "connection" | "code" | "performance";
  severity: "info" | "minor" | "major" | "blocker";
  title: string;
  description: string;
  evidence: Array<{ type: "url" | "file" | "log"; ref: string }>;
}

interface ProblemSolution {
  recommendation: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  filePlan?: FilePlan;
  steps: string[];
  codeSamples?: CodeSample[];
}

function detectProblems(ctx: DevelopmentContext): DetectedProblem[] {
  const problems: DetectedProblem[] = [];
  const conversation = ctx.conversationHistory
    .map((m) => m.content.toLowerCase())
    .join(" ");

  // Detect error mentions
  if (conversation.includes("error") || conversation.includes("fail")) {
    problems.push({
      id: "error_detected",
      type: "code",
      severity: "major",
      title: "Error condition detected in conversation",
      description: "User reported an error that may require automated fixing",
      evidence: [{ type: "log", ref: "conversation-history" }],
    });
  }

  // Detect connection issues
  if (
    conversation.includes("connect") &&
    (conversation.includes("fail") || conversation.includes("timeout"))
  ) {
    problems.push({
      id: "connection_failure",
      type: "connection",
      severity: "major",
      title: "Connection failure detected",
      description: "MCP connection issues reported",
      evidence: [{ type: "log", ref: "conversation-history" }],
    });
  }

  // Detect protocol issues
  if (conversation.includes("protocol") || conversation.includes("json-rpc")) {
    problems.push({
      id: "protocol_issue",
      type: "protocol",
      severity: "major",
      title: "Protocol-related issue detected",
      description: "MCP protocol compliance or communication issue",
      evidence: [{ type: "log", ref: "conversation-history" }],
    });
  }

  return problems;
}

function generateSolution(
  problem: DetectedProblem,
  ctx: DevelopmentContext,
): ProblemSolution {
  const language = ctx.projectContext?.language || "typescript";

  switch (problem.type) {
    case "connection":
      return {
        recommendation:
          "I can fix this connection issue by:\n- Adding proper error handling and retries\n- Implementing connection timeout management\n- Adding connection state validation",
        confidence: 0.85,
        riskLevel: "low",
        steps: [
          "Add connection retry logic with exponential backoff",
          "Implement timeout handling",
          "Add connection state monitoring",
          "Validate connection before operations",
        ],
        codeSamples: generateConnectionFixSamples(language),
      };

    case "protocol":
      return {
        recommendation:
          "I can fix this protocol issue by:\n- Ensuring JSON-RPC 2.0 compliance\n- Adding proper message validation\n- Implementing error response handling",
        confidence: 0.9,
        riskLevel: "low",
        steps: [
          "Validate JSON-RPC message format",
          "Add proper error response handling",
          "Implement protocol version negotiation",
          "Add message ID tracking",
        ],
        codeSamples: generateProtocolFixSamples(language),
      };

    case "configuration":
      return {
        recommendation:
          "I can fix this configuration issue by:\n- Validating configuration schema\n- Adding default values\n- Implementing configuration validation",
        confidence: 0.95,
        riskLevel: "low",
        filePlan: [
          {
            action: "update",
            path: "config.json",
            description: "Fix configuration values",
          },
        ],
        steps: [
          "Validate configuration against schema",
          "Add missing required fields",
          "Set appropriate default values",
          "Verify configuration integrity",
        ],
      };

    default:
      return {
        recommendation:
          "I can help diagnose and fix this issue. Please provide more details about the error.",
        confidence: 0.7,
        riskLevel: "medium",
        steps: [
          "Gather more information about the issue",
          "Analyze error logs and context",
          "Generate targeted fix",
          "Validate solution",
        ],
      };
  }
}

function detectConfigurationIssues(ctx: DevelopmentContext): Array<{
  id: string;
  severity: "info" | "minor" | "major" | "blocker";
  title: string;
  description: string;
  evidence: Array<{ type: "url" | "file" | "log"; ref: string }>;
  fix: string;
  filePlan?: FilePlan;
  steps: string[];
}> {
  const issues: Array<{
    id: string;
    severity: "info" | "minor" | "major" | "blocker";
    title: string;
    description: string;
    evidence: Array<{ type: "url" | "file" | "log"; ref: string }>;
    fix: string;
    filePlan?: FilePlan;
    steps: string[];
  }> = [];

  const conversation = ctx.conversationHistory
    .map((m) => m.content.toLowerCase())
    .join(" ");

  // Detect missing configuration
  if (conversation.includes("config") && conversation.includes("missing")) {
    issues.push({
      id: "missing_config",
      severity: "major",
      title: "Missing configuration file",
      description: "Required configuration file not found",
      evidence: [{ type: "file", ref: "config" }],
      fix: "I'll generate a default configuration file with recommended settings",
      filePlan: [
        {
          action: "new",
          path: "mcp-config.json",
          description: "Create default MCP configuration",
        },
      ],
      steps: [
        "Create configuration file with defaults",
        "Add required fields",
        "Set appropriate values for environment",
        "Validate configuration",
      ],
    });
  }

  return issues;
}

function detectProtocolIssues(ctx: DevelopmentContext): Array<{
  id: string;
  severity: "info" | "minor" | "major" | "blocker";
  title: string;
  description: string;
  evidence: Array<{ type: "url" | "file" | "log"; ref: string }>;
  fix: string;
  confidence: number;
  filePlan?: FilePlan;
  steps: string[];
  codeSamples?: CodeSample[];
}> {
  const issues: Array<{
    id: string;
    severity: "info" | "minor" | "major" | "blocker";
    title: string;
    description: string;
    evidence: Array<{ type: "url" | "file" | "log"; ref: string }>;
    fix: string;
    confidence: number;
    filePlan?: FilePlan;
    steps: string[];
    codeSamples?: CodeSample[];
  }> = [];

  const conversation = ctx.conversationHistory
    .map((m) => m.content.toLowerCase())
    .join(" ");

  // Detect JSON-RPC format issues
  if (conversation.includes("json-rpc") || conversation.includes("jsonrpc")) {
    issues.push({
      id: "jsonrpc_format",
      severity: "major",
      title: "JSON-RPC format issue",
      description: "Messages not conforming to JSON-RPC 2.0 specification",
      evidence: [{ type: "log", ref: "protocol-validator" }],
      fix: "I'll fix the JSON-RPC message format to comply with the specification",
      confidence: 0.95,
      steps: [
        "Validate message structure against JSON-RPC 2.0 spec",
        "Add required fields (jsonrpc, method, id)",
        "Fix parameter format",
        "Ensure proper error response format",
      ],
      codeSamples: generateProtocolFixSamples(
        ctx.projectContext?.language || "typescript",
      ),
    });
  }

  return issues;
}

function detectConnectionIssues(ctx: DevelopmentContext): Array<{
  id: string;
  severity: "info" | "minor" | "major" | "blocker";
  title: string;
  description: string;
  evidence: Array<{ type: "url" | "file" | "log"; ref: string }>;
  fix: string;
  steps: string[];
  codeSamples?: CodeSample[];
}> {
  const issues: Array<{
    id: string;
    severity: "info" | "minor" | "major" | "blocker";
    title: string;
    description: string;
    evidence: Array<{ type: "url" | "file" | "log"; ref: string }>;
    fix: string;
    steps: string[];
    codeSamples?: CodeSample[];
  }> = [];

  const conversation = ctx.conversationHistory
    .map((m) => m.content.toLowerCase())
    .join(" ");

  // Detect timeout issues
  if (conversation.includes("timeout")) {
    issues.push({
      id: "connection_timeout",
      severity: "major",
      title: "Connection timeout issue",
      description: "MCP server connection timing out",
      evidence: [{ type: "log", ref: "connection-handler" }],
      fix: "I'll add proper timeout handling and retry logic",
      steps: [
        "Increase connection timeout to reasonable value",
        "Add exponential backoff retry logic",
        "Implement connection health checks",
        "Add timeout error handling",
      ],
      codeSamples: generateConnectionFixSamples(
        ctx.projectContext?.language || "typescript",
      ),
    });
  }

  return issues;
}

function generateConnectionFixSamples(language: string): CodeSample[] {
  if (language === "typescript" || language === "javascript") {
    return [
      {
        language: "typescript",
        title: "Connection Retry with Exponential Backoff",
        snippet: `async function connectWithRetry(
  endpoint: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Connection> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const connection = await connect(endpoint, {
        timeout: 30000, // 30 second timeout
        keepAlive: true
      });
      
      // Validate connection
      await connection.ping();
      return connection;
      
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(\`Failed to connect after \${maxRetries} attempts: \${lastError?.message}\`);
}`,
      },
    ];
  }

  return [];
}

function generateProtocolFixSamples(language: string): CodeSample[] {
  if (language === "typescript" || language === "javascript") {
    return [
      {
        language: "typescript",
        title: "JSON-RPC 2.0 Compliant Message Format",
        snippet: `interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id: string | number;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number | null;
}

function createJsonRpcRequest(method: string, params?: unknown): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    method,
    params,
    id: generateRequestId()
  };
}

function validateJsonRpcResponse(response: unknown): response is JsonRpcResponse {
  if (typeof response !== "object" || response === null) {
    return false;
  }
  
  const r = response as Record<string, unknown>;
  return r.jsonrpc === "2.0" && ("result" in r || "error" in r) && "id" in r;
}`,
      },
    ];
  }

  return [];
}
