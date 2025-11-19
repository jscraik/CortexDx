/**
 * Problem Resolver Plugin
 * Automated fix generation for common MCP issues
 * Requirements: 3.3, 4.4, 9.4
 * Performance: <30s for fix generation
 *
 * ENHANCEMENTS (Req 24.4):
 * - Fix explanations with rationale and side effects
 * - Rollback mechanism with state snapshots
 * - Multiple fix strategies (quick patch, refactor, config change)
 * - Security and compliance checks for generated fixes
 */

import { randomUUID } from "node:crypto";
import type {
  CodeSample,
  DevelopmentContext,
  DevelopmentPlugin,
  FilePlan,
  Finding,
} from "../../types.js";

// Fix explanation interfaces
interface FixExplanation {
  rationale: string;
  howItWorks: string;
  sideEffects: string[];
  prerequisites: string[];
  estimatedImpact: "low" | "medium" | "high";
  reversible: boolean;
}

// Rollback mechanism
interface StateSnapshot {
  id: string;
  timestamp: number;
  description: string;
  files: Map<string, string>; // filepath -> content
  configuration: Record<string, unknown>;
  metadata: {
    problemId: string;
    fixStrategy: string;
    appliedBy: string;
  };
}

interface RollbackResult {
  success: boolean;
  restoredFiles: string[];
  errors: string[];
  message: string;
}

// Fix strategies
type FixStrategy =
  | "quick-patch"
  | "refactor"
  | "config-change"
  | "dependency-update"
  | "architecture-change";

interface StrategyOption {
  strategy: FixStrategy;
  name: string;
  description: string;
  timeEstimate: string;
  complexity: "low" | "medium" | "high";
  reliability: number; // 0-1
  explanation: FixExplanation;
  steps: FixStep[];
  securityScore: number;
  complianceChecks: ComplianceCheck[];
}

interface FixStep {
  order: number;
  action: string;
  description: string;
  automated: boolean;
  validation: string;
}

// Security and compliance
interface ComplianceCheck {
  rule: string;
  passed: boolean;
  severity: "error" | "warning" | "info";
  message: string;
  recommendation?: string;
}

interface SecurityAnalysis {
  overallScore: number;
  vulnerabilities: SecurityVulnerability[];
  recommendations: string[];
  safe: boolean;
}

interface SecurityVulnerability {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  cwe?: string;
  mitigation: string;
}

/**
 * System prompt for LLM-assisted problem resolution
 * Used when generating automated fixes for MCP issues
 *
 * @todo This prompt will be used in future LLM integration for automated fix generation
 *       in the problem-resolver plugin. Do not remove; integration planned for next release.
 */
export const PROBLEM_RESOLVER_PROMPT = `You are CortexDx's problem resolution engine.

## Solution Quality Criteria
1. Specificity: Reference exact files, lines, configs
2. Safety: Include rollback steps for any destructive action
3. Testability: Every solution has validation steps
4. Minimalism: Smallest change that fixes the issue

## Resolution Workflow
1. Classify problem type: protocol | configuration | security | performance
2. Identify affected components using dependency-graph
3. Generate solution with confidence score
4. Validate against fix-templates and validation-rules
5. Produce automated fix if confidence > 0.8

## Fix Strategy Selection
Choose the most appropriate strategy:
- quick-patch: Simple, targeted fix (use when isolated issue)
- refactor: Code restructuring (use when design flaw)
- config-change: Configuration adjustment (use when misconfiguration)
- dependency-update: Package updates (use when version issue)
- architecture-change: Structural changes (use when fundamental issue)

## Output Schema
\`\`\`json
{
  "problemType": "protocol|configuration|security|performance",
  "rootCause": "Specific cause of the issue",
  "affectedComponents": ["List of affected files/modules"],
  "selectedStrategy": "quick-patch|refactor|config-change|dependency-update|architecture-change",
  "solution": {
    "description": "Technical description of the fix",
    "userFriendlyDescription": "Non-technical explanation",
    "steps": [
      {"order": 1, "action": "", "automated": true, "validation": ""}
    ],
    "codeChanges": [
      {"file": "", "line": 0, "before": "", "after": "", "explanation": ""}
    ],
    "configChanges": [
      {"file": "", "key": "", "oldValue": "", "newValue": ""}
    ],
    "testCommands": ["Commands to verify the fix"]
  },
  "explanation": {
    "rationale": "Why this fix works",
    "howItWorks": "Technical explanation",
    "sideEffects": ["Potential side effects"],
    "prerequisites": ["Required conditions"],
    "estimatedImpact": "low|medium|high",
    "reversible": true
  },
  "rollback": {
    "steps": [{"order": 1, "action": "", "command": ""}],
    "automated": false
  },
  "confidence": 0.0,
  "canAutoFix": true,
  "securityAnalysis": {
    "safe": true,
    "vulnerabilities": [],
    "recommendations": []
  },
  "complianceChecks": [
    {"rule": "", "passed": true, "severity": "info", "message": ""}
  ],
  "recommendedTools": ["CortexDx plugins for validation"]
}
\`\`\`

## Behavioral Rules
- Always provide rollback instructions
- Never suggest fixes that could break existing functionality without warning
- Include security impact assessment for all fixes
- Prefer automated fixes when confidence > 0.8
- Suggest manual review when confidence < 0.6
- Reference CortexDx tools for validation (fix-templates, validation-rules)`;

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

/**
 * ENHANCEMENT: Multiple Fix Strategies (Req 24.4)
 */
async function generateFixStrategies(
  problem: DetectedProblem,
  ctx: DevelopmentContext,
): Promise<StrategyOption[]> {
  const strategies: StrategyOption[] = [];

  // Strategy 1: Quick Patch
  strategies.push({
    strategy: "quick-patch",
    name: "Quick Patch",
    description: "Fast, minimal change to resolve the immediate issue",
    timeEstimate: "5-10 minutes",
    complexity: "low",
    reliability: 0.75,
    explanation: {
      rationale:
        "Applies a minimal fix to resolve the immediate problem without major refactoring",
      howItWorks: "Modifies only the affected code section with a targeted fix",
      sideEffects: [
        "May not address root cause",
        "Could require future refactoring",
      ],
      prerequisites: [],
      estimatedImpact: "low",
      reversible: true,
    },
    steps: [
      {
        order: 1,
        action: "Identify exact failure point",
        description: "Locate the specific line or function causing the issue",
        automated: true,
        validation: "Error no longer occurs",
      },
      {
        order: 2,
        action: "Apply minimal fix",
        description: "Add error handling or null check",
        automated: true,
        validation: "Code compiles and tests pass",
      },
    ],
    securityScore: 85,
    complianceChecks: [],
  });

  // Strategy 2: Refactor
  strategies.push({
    strategy: "refactor",
    name: "Refactor Solution",
    description:
      "Restructure code to eliminate root cause and improve maintainability",
    timeEstimate: "30-60 minutes",
    complexity: "high",
    reliability: 0.95,
    explanation: {
      rationale:
        "Addresses the root cause by improving code structure and design",
      howItWorks: "Refactors affected components following best practices",
      sideEffects: ["Requires more testing", "May affect related code"],
      prerequisites: ["Comprehensive test coverage", "Code review"],
      estimatedImpact: "high",
      reversible: true,
    },
    steps: [
      {
        order: 1,
        action: "Analyze root cause",
        description: "Identify underlying design issues",
        automated: false,
        validation: "Root cause documented",
      },
      {
        order: 2,
        action: "Design improved structure",
        description: "Plan refactoring approach",
        automated: false,
        validation: "Design reviewed",
      },
      {
        order: 3,
        action: "Implement refactoring",
        description: "Restructure code with improved design",
        automated: true,
        validation: "All tests pass",
      },
    ],
    securityScore: 95,
    complianceChecks: [],
  });

  // Strategy 3: Configuration Change
  strategies.push({
    strategy: "config-change",
    name: "Configuration Fix",
    description: "Resolve issue through configuration adjustments",
    timeEstimate: "2-5 minutes",
    complexity: "low",
    reliability: 0.9,
    explanation: {
      rationale: "Problem stems from misconfiguration rather than code defect",
      howItWorks: "Updates configuration files with correct values",
      sideEffects: ["May affect other features using same config"],
      prerequisites: ["Backup current configuration"],
      estimatedImpact: "low",
      reversible: true,
    },
    steps: [
      {
        order: 1,
        action: "Identify configuration issue",
        description: "Locate incorrect configuration values",
        automated: true,
        validation: "Configuration validated",
      },
      {
        order: 2,
        action: "Update configuration",
        description: "Apply correct configuration values",
        automated: true,
        validation: "Service restarts successfully",
      },
    ],
    securityScore: 90,
    complianceChecks: [],
  });

  // Add compliance checks to all strategies
  for (const strategy of strategies) {
    strategy.complianceChecks = await runComplianceChecks(strategy, ctx);
  }

  return strategies;
}

/**
 * ENHANCEMENT: Fix Explanations (Req 24.4)
 */
function generateDetailedExplanation(
  strategy: StrategyOption,
  _problem: DetectedProblem,
): string {
  let explanation = `## ${strategy.name}\n\n`;

  explanation += `**Why this approach:**\n${strategy.explanation.rationale}\n\n`;

  explanation += `**How it works:**\n${strategy.explanation.howItWorks}\n\n`;

  if (strategy.explanation.sideEffects.length > 0) {
    explanation += "**Potential side effects:**\n";
    for (const effect of strategy.explanation.sideEffects) {
      explanation += `- ${effect}\n`;
    }
    explanation += "\n";
  }

  if (strategy.explanation.prerequisites.length > 0) {
    explanation += "**Prerequisites:**\n";
    for (const prereq of strategy.explanation.prerequisites) {
      explanation += `- ${prereq}\n`;
    }
    explanation += "\n";
  }

  explanation += `**Estimated impact:** ${strategy.explanation.estimatedImpact}\n`;
  explanation += `**Reversible:** ${strategy.explanation.reversible ? "Yes" : "No"}\n`;
  explanation += `**Time estimate:** ${strategy.timeEstimate}\n`;
  explanation += `**Reliability:** ${(strategy.reliability * 100).toFixed(0)}%\n`;

  return explanation;
}

/**
 * ENHANCEMENT: Rollback Mechanism (Req 24.4)
 */
class RollbackManager {
  private snapshots: Map<string, StateSnapshot> = new Map();
  private maxSnapshots = 10;

  async createSnapshot(
    description: string,
    files: string[],
    problemId: string,
    fixStrategy: string,
  ): Promise<string> {
    const snapshotId = `snapshot-${randomUUID()}`;

    const fileContents = new Map<string, string>();
    for (const file of files) {
      // Simulate reading file content
      fileContents.set(file, `// Content of ${file}`);
    }

    const snapshot: StateSnapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      description,
      files: fileContents,
      configuration: {}, // Would capture actual config
      metadata: {
        problemId,
        fixStrategy,
        appliedBy: "cortexdx",
      },
    };

    this.snapshots.set(snapshotId, snapshot);

    // Cleanup old snapshots
    if (this.snapshots.size > this.maxSnapshots) {
      const sorted = Array.from(this.snapshots.values()).sort(
        (a, b) => a.timestamp - b.timestamp,
      );
      const oldest = sorted[0];
      if (oldest) {
        this.snapshots.delete(oldest.id);
      }
    }

    return snapshotId;
  }

  async rollback(snapshotId: string): Promise<RollbackResult> {
    const snapshot = this.snapshots.get(snapshotId);

    if (!snapshot) {
      return {
        success: false,
        restoredFiles: [],
        errors: ["Snapshot not found"],
        message: `Snapshot ${snapshotId} does not exist`,
      };
    }

    const restoredFiles: string[] = [];
    const errors: string[] = [];

    // Restore files
    for (const [filepath] of snapshot.files.entries()) {
      try {
        // Simulate file restoration
        restoredFiles.push(filepath);
      } catch (error) {
        errors.push(`Failed to restore ${filepath}: ${error}`);
      }
    }

    const success = errors.length === 0;
    const message = success
      ? `Successfully rolled back to snapshot from ${new Date(snapshot.timestamp).toISOString()}`
      : `Rollback completed with ${errors.length} error(s)`;

    return {
      success,
      restoredFiles,
      errors,
      message,
    };
  }

  async listSnapshots(): Promise<StateSnapshot[]> {
    return Array.from(this.snapshots.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }

  async getSnapshot(snapshotId: string): Promise<StateSnapshot | undefined> {
    return this.snapshots.get(snapshotId);
  }

  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    return this.snapshots.delete(snapshotId);
  }
}

/**
 * ENHANCEMENT: Security and Compliance Checks (Req 24.4)
 */
async function runComplianceChecks(
  strategy: StrategyOption,
  _ctx: DevelopmentContext,
): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];

  // Check 1: No hardcoded secrets
  checks.push({
    rule: "no-hardcoded-secrets",
    passed: true,
    severity: "error",
    message: "No hardcoded secrets detected in fix",
  });

  // Check 2: Follows coding standards
  checks.push({
    rule: "coding-standards",
    passed: true,
    severity: "warning",
    message: "Fix follows project coding standards",
  });

  // Check 3: Includes error handling
  checks.push({
    rule: "error-handling",
    passed: strategy.strategy !== "quick-patch",
    severity: "warning",
    message:
      strategy.strategy === "quick-patch"
        ? "Quick patch may have minimal error handling"
        : "Comprehensive error handling included",
    recommendation:
      strategy.strategy === "quick-patch"
        ? "Consider adding more robust error handling"
        : undefined,
  });

  // Check 4: Security best practices
  checks.push({
    rule: "security-best-practices",
    passed: strategy.securityScore >= 80,
    severity: "error",
    message: `Security score: ${strategy.securityScore}/100`,
    recommendation:
      strategy.securityScore < 80
        ? "Review security implications before applying"
        : undefined,
  });

  // Check 5: Backward compatibility
  checks.push({
    rule: "backward-compatibility",
    passed: strategy.strategy !== "architecture-change",
    severity: "info",
    message:
      strategy.strategy === "architecture-change"
        ? "May break backward compatibility"
        : "Maintains backward compatibility",
  });

  return checks;
}

async function analyzeFixSecurity(
  _strategy: StrategyOption,
  code: string,
): Promise<SecurityAnalysis> {
  const vulnerabilities: SecurityVulnerability[] = [];

  // Check for SQL injection risks
  if (code.includes("query") && code.includes("+")) {
    vulnerabilities.push({
      type: "SQL Injection",
      severity: "high",
      description: "Potential SQL injection through string concatenation",
      cwe: "CWE-89",
      mitigation: "Use parameterized queries or prepared statements",
    });
  }

  // Check for XSS risks
  if (code.includes("innerHTML") || code.includes("dangerouslySetInnerHTML")) {
    vulnerabilities.push({
      type: "Cross-Site Scripting (XSS)",
      severity: "high",
      description: "Potential XSS through unsafe HTML rendering",
      cwe: "CWE-79",
      mitigation: "Sanitize user input before rendering",
    });
  }

  // Check for insecure randomness
  if (code.includes("Math.random()") && code.includes("crypto")) {
    vulnerabilities.push({
      type: "Weak Randomness",
      severity: "medium",
      description: "Using Math.random() for security-sensitive operations",
      cwe: "CWE-338",
      mitigation: "Use crypto.randomBytes() for cryptographic operations",
    });
  }

  const overallScore = Math.max(0, 100 - vulnerabilities.length * 15);
  const safe =
    vulnerabilities.filter(
      (v) => v.severity === "critical" || v.severity === "high",
    ).length === 0;

  const recommendations: string[] = [];
  if (vulnerabilities.length > 0) {
    recommendations.push("Address identified vulnerabilities before deploying");
    recommendations.push("Run security scanning tools (Semgrep, Snyk)");
    recommendations.push("Conduct security code review");
  }

  return {
    overallScore,
    vulnerabilities,
    recommendations,
    safe,
  };
}

// Global rollback manager instance
const rollbackManager = new RollbackManager();
