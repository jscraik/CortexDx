/**
 * IDE Integration Plugin
 * Provides real-time MCP validation and assistance for IDE environments
 * Requirements: 1.3, 4.1, 9.2
 *
 * This plugin enables IDEs to connect via MCP protocol for:
 * - Real-time validation of MCP implementations
 * - Inline suggestions and diagnostics
 * - Automated fix applications
 * - Context-aware code completion
 */

import type {
  DevelopmentContext,
  DevelopmentPlugin,
  Finding,
} from "@brainwav/cortexdx-core";

interface IdeContext {
  editor: string; // vscode, intellij, etc.
  filePath?: string;
  fileContent?: string;
  cursorPosition?: { line: number; column: number };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  projectRoot?: string;
}

interface ValidationResult {
  diagnostics: Diagnostic[];
  suggestions: Suggestion[];
  quickFixes: QuickFix[];
}

interface Diagnostic {
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  code?: string;
  source: string;
}

interface Suggestion {
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  text: string;
  description: string;
  priority: number;
}

interface QuickFix {
  title: string;
  description: string;
  edits: Array<{
    range: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
    newText: string;
  }>;
}

export const IdeIntegrationPlugin: DevelopmentPlugin = {
  id: "ide-integration",
  title: "IDE Integration Support",
  category: "development",
  order: 15,
  requiresLlm: false,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Extract IDE context from development context
    const ideContext = extractIdeContext(ctx);

    if (!ideContext) {
      findings.push({
        id: "ide.context.missing",
        area: "development",
        severity: "info",
        title: "IDE integration available",
        description:
          "Connect your IDE to CortexDx for real-time validation and assistance.",
        evidence: [{ type: "log", ref: "ide-integration" }],
        recommendation:
          "Configure your IDE to connect to this MCP server:\n" +
          "- VS Code: Use MCP extension\n" +
          "- IntelliJ: Use MCP plugin\n" +
          "- Other editors: Use Language Server Protocol adapter",
      });
      return findings;
    }

    // Perform real-time validation if file content is provided
    if (ideContext.fileContent) {
      const validation = await validateMcpCode(
        ideContext.fileContent,
        ideContext.filePath || "unknown",
        ctx,
      );

      // Convert diagnostics to findings
      for (const diagnostic of validation.diagnostics) {
        findings.push({
          id: `ide.diagnostic.${diagnostic.code || "unknown"}`,
          area: "validation",
          severity: mapSeverity(diagnostic.severity),
          title: diagnostic.message,
          description: `${diagnostic.source}: ${diagnostic.message}`,
          evidence: [
            {
              type: "file",
              ref: `${ideContext.filePath}:${diagnostic.range.start.line}:${diagnostic.range.start.column}`,
            },
          ],
          tags: ["ide", "real-time", diagnostic.severity],
        });
      }

      // Add suggestions as findings
      for (const suggestion of validation.suggestions) {
        findings.push({
          id: `ide.suggestion.${Date.now()}`,
          area: "improvement",
          severity: "info",
          title: suggestion.description,
          description: `Suggested: ${suggestion.text}`,
          evidence: [
            {
              type: "file",
              ref: `${ideContext.filePath}:${suggestion.range.start.line}`,
            },
          ],
          recommendation: suggestion.text,
          confidence: suggestion.priority / 10,
          tags: ["ide", "suggestion"],
        });
      }

      // Add quick fixes as recommendations
      if (validation.quickFixes.length > 0) {
        findings.push({
          id: "ide.quickfixes.available",
          area: "development",
          severity: "info",
          title: `${validation.quickFixes.length} quick fix(es) available`,
          description: validation.quickFixes.map((f) => f.title).join(", "),
          evidence: [
            { type: "file", ref: ideContext.filePath || "current-file" },
          ],
          recommendation: `Apply quick fixes:\n${validation.quickFixes.map((f) => `- ${f.title}: ${f.description}`).join("\n")}`,
          tags: ["ide", "quick-fix"],
        });
      }
    }

    return findings;
  },
};

function extractIdeContext(ctx: DevelopmentContext): IdeContext | null {
  // Check if IDE context is provided in project context
  if (ctx.projectContext && "ideContext" in ctx.projectContext) {
    return ctx.projectContext.ideContext as IdeContext;
  }

  // Check conversation history for IDE-related information
  const recentMessages = ctx.conversationHistory.slice(-3);
  for (const msg of recentMessages) {
    if (msg.role === "user") {
      const content = msg.content.toLowerCase();
      if (
        content.includes("vscode") ||
        content.includes("vs code") ||
        content.includes("visual studio code")
      ) {
        return { editor: "vscode" };
      }
      if (
        content.includes("intellij") ||
        content.includes("idea") ||
        content.includes("jetbrains")
      ) {
        return { editor: "intellij" };
      }
      if (content.includes("vim") || content.includes("neovim")) {
        return { editor: "vim" };
      }
    }
  }

  return null;
}

async function validateMcpCode(
  content: string,
  filePath: string,
  ctx: DevelopmentContext,
): Promise<ValidationResult> {
  const diagnostics: Diagnostic[] = [];
  const suggestions: Suggestion[] = [];
  const quickFixes: QuickFix[] = [];

  // Check for common MCP patterns and issues
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const lineNum = i + 1;

    // Check for MCP tool definition patterns
    if (
      line.includes("tools:") ||
      (line.includes("export const") && line.includes("Tool"))
    ) {
      // Validate tool structure
      if (
        !content.includes("inputSchema") &&
        !content.includes("input_schema")
      ) {
        diagnostics.push({
          range: {
            start: { line: lineNum, column: 0 },
            end: { line: lineNum, column: line.length },
          },
          severity: "warning",
          message: "MCP tool should define inputSchema",
          code: "mcp-tool-schema",
          source: "cortexdx",
        });

        quickFixes.push({
          title: "Add inputSchema",
          description: "Add JSON Schema for tool input validation",
          edits: [
            {
              range: {
                start: { line: lineNum + 1, column: 0 },
                end: { line: lineNum + 1, column: 0 },
              },
              newText:
                '  inputSchema: {\n    type: "object",\n    properties: {},\n  },\n',
            },
          ],
        });
      }
    }

    // Check for JSON-RPC patterns
    if (line.includes("jsonrpc") && !line.includes('"2.0"')) {
      diagnostics.push({
        range: {
          start: { line: lineNum, column: 0 },
          end: { line: lineNum, column: line.length },
        },
        severity: "error",
        message: 'JSON-RPC version must be "2.0"',
        code: "jsonrpc-version",
        source: "cortexdx",
      });

      quickFixes.push({
        title: 'Set JSON-RPC version to "2.0"',
        description: "MCP requires JSON-RPC 2.0",
        edits: [
          {
            range: {
              start: { line: lineNum, column: 0 },
              end: { line: lineNum, column: line.length },
            },
            newText: line.replace(/jsonrpc.*?[,}]/, 'jsonrpc: "2.0",'),
          },
        ],
      });
    }

    // Check for async/await patterns
    if (
      line.includes("async") &&
      !line.includes("await") &&
      i < lines.length - 10
    ) {
      const nextLines = lines.slice(i, i + 10).join("\n");
      if (!nextLines.includes("await")) {
        suggestions.push({
          range: {
            start: { line: lineNum, column: 0 },
            end: { line: lineNum, column: line.length },
          },
          text: "Consider if async is needed",
          description: "Async function without await may not need to be async",
          priority: 5,
        });
      }
    }

    // Check for error handling
    if (
      line.includes("await") &&
      !content.includes("try") &&
      !content.includes("catch")
    ) {
      suggestions.push({
        range: {
          start: { line: lineNum, column: 0 },
          end: { line: lineNum, column: line.length },
        },
        text: "Add error handling",
        description: "Async operations should have error handling",
        priority: 8,
      });
    }

    // Check for MCP protocol compliance
    if (line.includes("method:") && !line.includes("tools/")) {
      const methodMatch = line.match(/method:\s*["']([^"']+)["']/);
      if (methodMatch?.[1]) {
        const method = methodMatch[1];
        const validMethods = [
          "initialize",
          "tools/list",
          "tools/call",
          "resources/list",
          "resources/read",
          "prompts/list",
          "prompts/get",
        ];

        if (!validMethods.some((m) => method.startsWith(m))) {
          diagnostics.push({
            range: {
              start: { line: lineNum, column: 0 },
              end: { line: lineNum, column: line.length },
            },
            severity: "warning",
            message: `Unknown MCP method: ${method}`,
            code: "mcp-method-unknown",
            source: "cortexdx",
          });
        }
      }
    }
  }

  return { diagnostics, suggestions, quickFixes };
}

function mapSeverity(
  severity: "error" | "warning" | "info" | "hint",
): "blocker" | "major" | "minor" | "info" {
  switch (severity) {
    case "error":
      return "blocker";
    case "warning":
      return "major";
    case "info":
      return "minor";
    case "hint":
      return "info";
  }
}
