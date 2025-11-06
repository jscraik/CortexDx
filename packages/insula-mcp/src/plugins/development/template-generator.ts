/**
 * Template Generator Plugin
 * Generates customizable MCP server templates for different use cases and organizations
 * Requirements: 1.2, 1.4, 10.1
 * Performance: <5s response time
 */

import type {
  DevelopmentContext,
  DevelopmentPlugin,
  FilePlan,
  Finding,
} from "../../types.js";

export const TemplateGeneratorPlugin: DevelopmentPlugin = {
  id: "template-generator",
  title: "MCP Template Generator",
  category: "development",
  order: 10,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Check if LLM is available for template generation
    if (!ctx.conversationalLlm) {
      findings.push({
        id: "template.llm.missing",
        area: "development",
        severity: "minor",
        title: "Template generation LLM not available",
        description:
          "No LLM adapter configured for template generation capabilities.",
        evidence: [{ type: "log", ref: "template-generator" }],
        recommendation:
          "Configure an LLM adapter to enable AI-powered template generation features.",
      });
      return findings;
    }

    // Analyze project context for template opportunities
    if (ctx.projectContext) {
      const { type, language, sourceFiles } = ctx.projectContext;

      // Detect new project needing template
      if (sourceFiles.length === 0) {
        const templateType = detectTemplateType(type, ctx);

        findings.push({
          id: "template.new_project",
          area: "development",
          severity: "info",
          title: `${templateType} template available`,
          description: `I can generate a ${language} ${templateType} template with best practices and team conventions.`,
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation: `Generate a customized ${templateType} template that includes:\n- Standard project structure\n- MCP protocol implementation\n- Tool definitions and handlers\n- Configuration files\n- Testing setup\n- Documentation`,
          remediation: {
            filePlan: generateTemplatePlan(templateType, language),
            steps: [
              "Select template type and customization options",
              "Generate project structure and core files",
              "Add tool definitions and implementations",
              "Configure build and test setup",
              "Generate documentation and examples",
            ],
          },
        });
      }

      // Detect missing standard files
      const missingStandards = detectMissingStandardFiles(ctx);
      if (missingStandards.length > 0) {
        findings.push({
          id: "template.missing_standards",
          area: "development",
          severity: "minor",
          title: "Missing standard project files",
          description: `Project is missing ${missingStandards.length} standard files: ${missingStandards.join(", ")}`,
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate these standard files following your team conventions.",
          remediation: {
            filePlan: missingStandards.map((file) => ({
              action: "new" as const,
              path: file,
              description: `Generate standard ${file} file`,
            })),
            steps: [
              "Review missing files",
              "Generate with team conventions",
              "Validate against standards",
            ],
          },
        });
      }
    }

    // Check conversation for template requests
    const recentMessages = ctx.conversationHistory.slice(-3);
    const hasTemplateRequest = recentMessages.some(
      (msg) =>
        msg.role === "user" &&
        (msg.content.toLowerCase().includes("template") ||
          msg.content.toLowerCase().includes("boilerplate") ||
          msg.content.toLowerCase().includes("scaffold") ||
          msg.content.toLowerCase().includes("starter")),
    );

    if (hasTemplateRequest) {
      findings.push({
        id: "template.request.detected",
        area: "development",
        severity: "info",
        title: "Template generation request detected",
        description:
          "I can help you generate customized templates for your MCP project.",
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "Available templates:\n- Basic MCP Server\n- MCP Server with Resources\n- MCP Client\n- API-to-MCP Connector\n- Custom Organization Template\n\nTell me which template you need and any specific requirements.",
      });
    }

    // Validate performance requirement (<5s)
    const duration = Date.now() - startTime;
    if (duration > 5000) {
      findings.push({
        id: "template.performance.slow",
        area: "performance",
        severity: "minor",
        title: "Template analysis exceeded time threshold",
        description: `Analysis took ${duration}ms, exceeding 5s requirement`,
        evidence: [{ type: "log", ref: "template-generator" }],
        confidence: 1.0,
      });
    }

    return findings;
  },
};

function detectTemplateType(
  projectType: string,
  ctx: DevelopmentContext,
): string {
  const conversation = ctx.conversationHistory
    .map((m) => m.content.toLowerCase())
    .join(" ");

  if (conversation.includes("api") || conversation.includes("connector")) {
    return "API-to-MCP Connector";
  }
  if (conversation.includes("resource")) {
    return "MCP Server with Resources";
  }
  if (conversation.includes("client")) {
    return "MCP Client";
  }
  if (projectType === "mcp-server") {
    return "MCP Server";
  }
  if (projectType === "mcp-client") {
    return "MCP Client";
  }
  if (projectType === "mcp-connector") {
    return "MCP Connector";
  }

  return "Basic MCP Server";
}

function generateTemplatePlan(
  templateType: string,
  language: string,
): FilePlan {
  const plan: FilePlan = [];

  // Common files for all templates
  plan.push(
    { action: "new", path: "README.md", description: "Project documentation" },
    { action: "new", path: ".gitignore", description: "Git ignore patterns" },
  );

  if (language === "typescript" || language === "javascript") {
    plan.push(
      {
        action: "new",
        path: "package.json",
        description: "Node.js package configuration",
      },
      {
        action: "new",
        path: "tsconfig.json",
        description: "TypeScript configuration",
      },
    );

    if (templateType.includes("Server")) {
      plan.push(
        {
          action: "new",
          path: "src/index.ts",
          description: "Main server entry point",
        },
        {
          action: "new",
          path: "src/server.ts",
          description: "MCP server implementation",
        },
        {
          action: "new",
          path: "src/tools/index.ts",
          description: "Tool definitions",
        },
        {
          action: "new",
          path: "src/types.ts",
          description: "Type definitions",
        },
      );
    }

    if (templateType.includes("Client")) {
      plan.push(
        {
          action: "new",
          path: "src/client.ts",
          description: "MCP client implementation",
        },
        {
          action: "new",
          path: "src/connection.ts",
          description: "Connection handling",
        },
      );
    }

    if (templateType.includes("Connector")) {
      plan.push(
        {
          action: "new",
          path: "src/connector.ts",
          description: "API connector implementation",
        },
        {
          action: "new",
          path: "src/api-client.ts",
          description: "API client wrapper",
        },
        {
          action: "new",
          path: "src/auth.ts",
          description: "Authentication handling",
        },
      );
    }
  }

  if (language === "python") {
    plan.push(
      {
        action: "new",
        path: "pyproject.toml",
        description: "Python project configuration",
      },
      {
        action: "new",
        path: "requirements.txt",
        description: "Python dependencies",
      },
    );

    if (templateType.includes("Server")) {
      plan.push(
        {
          action: "new",
          path: "src/__init__.py",
          description: "Package initialization",
        },
        {
          action: "new",
          path: "src/server.py",
          description: "MCP server implementation",
        },
        {
          action: "new",
          path: "src/tools.py",
          description: "Tool implementations",
        },
      );
    }
  }

  return plan;
}

function detectMissingStandardFiles(ctx: DevelopmentContext): string[] {
  const missing: string[] = [];
  const { sourceFiles, configFiles, language } = ctx.projectContext || {};

  if (!sourceFiles || !configFiles) {
    return missing;
  }

  const allFiles = [...sourceFiles, ...configFiles];

  // Check for README
  if (!allFiles.some((f) => f.toLowerCase().includes("readme"))) {
    missing.push("README.md");
  }

  // Check for .gitignore
  if (!allFiles.some((f) => f === ".gitignore")) {
    missing.push(".gitignore");
  }

  // Language-specific checks
  if (language === "typescript" || language === "javascript") {
    if (!allFiles.some((f) => f === "package.json")) {
      missing.push("package.json");
    }
    if (
      language === "typescript" &&
      !allFiles.some((f) => f === "tsconfig.json")
    ) {
      missing.push("tsconfig.json");
    }
  }

  if (language === "python") {
    if (!allFiles.some((f) => f === "pyproject.toml" || f === "setup.py")) {
      missing.push("pyproject.toml");
    }
  }

  return missing;
}
