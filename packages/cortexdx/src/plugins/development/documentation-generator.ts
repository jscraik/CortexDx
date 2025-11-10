/**
 * Documentation Generator Plugin
 * Generates comprehensive documentation for MCP implementations
 * Requirements: 1.5, 7.5, 10.4
 * Output: Markdown format
 */

import type {
  DevelopmentContext,
  DevelopmentPlugin,
  FilePlan,
  Finding,
} from "../../types.js";

export const DocumentationGeneratorPlugin: DevelopmentPlugin = {
  id: "documentation-generator",
  title: "MCP Documentation Generator",
  category: "development",
  order: 13,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Check if LLM is available
    if (!ctx.conversationalLlm) {
      findings.push({
        id: "docgen.llm.missing",
        area: "development",
        severity: "minor",
        title: "Documentation generator LLM not available",
        description: "No LLM adapter configured for documentation generation.",
        evidence: [{ type: "log", ref: "documentation-generator" }],
        recommendation:
          "Configure an LLM adapter to enable AI-powered documentation generation.",
      });
      return findings;
    }

    // Analyze project for documentation needs
    if (ctx.projectContext) {
      const { type, sourceFiles, configFiles } = ctx.projectContext;
      const allFiles = [...sourceFiles, ...configFiles];

      // Check for missing README
      if (!allFiles.some((f) => f.toLowerCase().includes("readme"))) {
        findings.push({
          id: "docgen.readme.missing",
          area: "documentation",
          severity: "minor",
          title: "README.md missing",
          description: "Project lacks a README file with documentation",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate a comprehensive README with:\n- Project overview\n- Installation instructions\n- Usage examples\n- API documentation\n- Configuration guide\n- Troubleshooting section",
          remediation: {
            filePlan: [
              {
                action: "new",
                path: "README.md",
                description: "Generate comprehensive project documentation",
              },
            ],
            steps: [
              "Analyze project structure and capabilities",
              "Generate overview and description",
              "Create installation instructions",
              "Add usage examples with code samples",
              "Document configuration options",
              "Add troubleshooting guide",
            ],
          },
        });
      }

      // Check for API documentation
      if (type === "mcp-server" && sourceFiles.length > 0) {
        const hasApiDocs = allFiles.some(
          (f) =>
            f.toLowerCase().includes("api") && f.toLowerCase().includes("md"),
        );

        if (!hasApiDocs) {
          findings.push({
            id: "docgen.api.missing",
            area: "documentation",
            severity: "minor",
            title: "API documentation missing",
            description:
              "MCP server lacks API documentation for tools and resources",
            evidence: [{ type: "file", ref: "project-root" }],
            recommendation:
              "I can generate API documentation from your MCP tool definitions including:\n- Tool descriptions and parameters\n- Request/response examples\n- Error codes and handling\n- Authentication requirements",
            remediation: {
              filePlan: [
                {
                  action: "new",
                  path: "docs/API.md",
                  description:
                    "Generate API documentation from tool definitions",
                },
              ],
              steps: [
                "Extract tool definitions from source code",
                "Generate parameter documentation",
                "Create usage examples",
                "Document error responses",
                "Add authentication guide",
              ],
            },
          });
        }
      }

      // Check for deployment documentation
      const hasDeployDocs = allFiles.some(
        (f) =>
          f.toLowerCase().includes("deploy") ||
          f.toLowerCase().includes("installation"),
      );

      if (!hasDeployDocs && type === "mcp-server") {
        findings.push({
          id: "docgen.deployment.missing",
          area: "documentation",
          severity: "info",
          title: "Deployment documentation missing",
          description: "Project lacks deployment and operational documentation",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate deployment guides for:\n- Docker containerization\n- Kubernetes deployment\n- Environment configuration\n- Monitoring and logging\n- Backup and recovery",
          remediation: {
            filePlan: [
              {
                action: "new",
                path: "docs/DEPLOYMENT.md",
                description: "Generate deployment guide",
              },
              {
                action: "new",
                path: "docs/OPERATIONS.md",
                description: "Generate operations guide",
              },
            ],
            steps: [
              "Create Docker deployment guide",
              "Add Kubernetes manifests documentation",
              "Document environment variables",
              "Add monitoring setup guide",
              "Create troubleshooting section",
            ],
          },
        });
      }

      // Check for configuration documentation
      if (configFiles.length > 0) {
        const hasConfigDocs = allFiles.some(
          (f) =>
            f.toLowerCase().includes("config") &&
            f.toLowerCase().includes("md"),
        );

        if (!hasConfigDocs) {
          findings.push({
            id: "docgen.config.missing",
            area: "documentation",
            severity: "info",
            title: "Configuration documentation missing",
            description: "Configuration files lack documentation",
            evidence: [{ type: "file", ref: "config-files" }],
            recommendation:
              "I can document all configuration options with:\n- Parameter descriptions\n- Default values\n- Valid ranges and formats\n- Environment-specific settings\n- Security considerations",
            remediation: {
              filePlan: [
                {
                  action: "new",
                  path: "docs/CONFIGURATION.md",
                  description: "Generate configuration guide",
                },
              ],
              steps: [
                "Extract configuration schema",
                "Document each parameter",
                "Add examples for different environments",
                "Include security best practices",
                "Create validation guide",
              ],
            },
          });
        }
      }
    }

    // Check conversation for documentation requests
    const recentMessages = ctx.conversationHistory.slice(-3);
    const hasDocRequest = recentMessages.some(
      (msg) =>
        msg.role === "user" &&
        (msg.content.toLowerCase().includes("document") ||
          msg.content.toLowerCase().includes("readme") ||
          msg.content.toLowerCase().includes("guide") ||
          msg.content.toLowerCase().includes("how to")),
    );

    if (hasDocRequest) {
      findings.push({
        id: "docgen.request.detected",
        area: "documentation",
        severity: "info",
        title: "Documentation request detected",
        description:
          "I can help generate comprehensive documentation for your MCP project",
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "Available documentation types:\n- README with project overview\n- API documentation from tool definitions\n- Deployment and operations guides\n- Configuration reference\n- User guides and tutorials\n- Troubleshooting documentation\n\nTell me what documentation you need.",
      });
    }

    // Detect specific documentation needs from conversation
    const conversation = ctx.conversationHistory
      .map((m) => m.content.toLowerCase())
      .join(" ");
    const docTypes = detectDocumentationTypes(conversation);

    for (const docType of docTypes) {
      findings.push({
        id: `docgen.${docType.id}`,
        area: "documentation",
        severity: "info",
        title: `${docType.title} documentation needed`,
        description: docType.description,
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation: docType.recommendation,
        remediation: {
          filePlan: docType.filePlan,
          steps: docType.steps,
        },
      });
    }

    // Performance tracking
    const duration = Date.now() - startTime;
    if (duration > 15000) {
      findings.push({
        id: "docgen.performance.slow",
        area: "performance",
        severity: "minor",
        title: "Documentation analysis exceeded expected time",
        description: `Analysis took ${duration}ms`,
        evidence: [{ type: "log", ref: "documentation-generator" }],
        confidence: 1.0,
      });
    }

    return findings;
  },
};

interface DocumentationType {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  filePlan: FilePlan;
  steps: string[];
}

function detectDocumentationTypes(conversation: string): DocumentationType[] {
  const types: DocumentationType[] = [];

  // API documentation
  if (
    conversation.includes("api") ||
    conversation.includes("endpoint") ||
    conversation.includes("tool")
  ) {
    types.push({
      id: "api",
      title: "API",
      description: "API documentation for MCP tools and resources",
      recommendation:
        "I'll generate comprehensive API documentation including:\n- Tool definitions with parameters\n- Request/response formats\n- Authentication requirements\n- Error handling\n- Usage examples",
      filePlan: [
        {
          action: "new",
          path: "docs/API.md",
          description: "API reference documentation",
        },
        {
          action: "new",
          path: "docs/examples/",
          description: "API usage examples",
        },
      ],
      steps: [
        "Extract tool definitions from code",
        "Generate parameter documentation with types",
        "Create request/response examples",
        "Document error codes and messages",
        "Add authentication guide",
        "Include rate limiting information",
      ],
    });
  }

  // Deployment documentation
  if (
    conversation.includes("deploy") ||
    conversation.includes("docker") ||
    conversation.includes("kubernetes")
  ) {
    types.push({
      id: "deployment",
      title: "Deployment",
      description: "Deployment and infrastructure documentation",
      recommendation:
        "I'll create deployment guides for:\n- Docker containerization\n- Kubernetes orchestration\n- Cloud platform deployment\n- Environment configuration\n- Scaling strategies",
      filePlan: [
        {
          action: "new",
          path: "docs/DEPLOYMENT.md",
          description: "Deployment guide",
        },
        {
          action: "new",
          path: "Dockerfile",
          description: "Docker configuration",
        },
        { action: "new", path: "k8s/", description: "Kubernetes manifests" },
      ],
      steps: [
        "Create Dockerfile with best practices",
        "Generate Kubernetes manifests",
        "Document environment variables",
        "Add health check configuration",
        "Create scaling guide",
        "Document backup procedures",
      ],
    });
  }

  // User guide
  if (
    conversation.includes("user") ||
    conversation.includes("tutorial") ||
    conversation.includes("getting started")
  ) {
    types.push({
      id: "user_guide",
      title: "User Guide",
      description: "End-user documentation and tutorials",
      recommendation:
        "I'll create user-friendly guides with:\n- Getting started tutorial\n- Step-by-step examples\n- Common use cases\n- Best practices\n- FAQ section",
      filePlan: [
        {
          action: "new",
          path: "docs/USER_GUIDE.md",
          description: "User guide",
        },
        {
          action: "new",
          path: "docs/GETTING_STARTED.md",
          description: "Getting started tutorial",
        },
        {
          action: "new",
          path: "docs/FAQ.md",
          description: "Frequently asked questions",
        },
      ],
      steps: [
        "Create getting started tutorial",
        "Add common use case examples",
        "Document best practices",
        "Create troubleshooting guide",
        "Add FAQ section",
        "Include tips and tricks",
      ],
    });
  }

  // Configuration documentation
  if (
    conversation.includes("config") ||
    conversation.includes("setting") ||
    conversation.includes("option")
  ) {
    types.push({
      id: "configuration",
      title: "Configuration",
      description: "Configuration reference and guide",
      recommendation:
        "I'll document all configuration options:\n- Parameter descriptions\n- Default values\n- Valid ranges\n- Environment-specific settings\n- Security considerations",
      filePlan: [
        {
          action: "new",
          path: "docs/CONFIGURATION.md",
          description: "Configuration reference",
        },
        {
          action: "new",
          path: "config/examples/",
          description: "Configuration examples",
        },
      ],
      steps: [
        "Extract configuration schema",
        "Document each parameter with types",
        "Add default values and ranges",
        "Create environment-specific examples",
        "Document security settings",
        "Add validation rules",
      ],
    });
  }

  // Troubleshooting documentation
  if (
    conversation.includes("troubleshoot") ||
    conversation.includes("debug") ||
    conversation.includes("error")
  ) {
    types.push({
      id: "troubleshooting",
      title: "Troubleshooting",
      description: "Troubleshooting and debugging guide",
      recommendation:
        "I'll create a troubleshooting guide with:\n- Common issues and solutions\n- Error message explanations\n- Debugging techniques\n- Log analysis guide\n- Support resources",
      filePlan: [
        {
          action: "new",
          path: "docs/TROUBLESHOOTING.md",
          description: "Troubleshooting guide",
        },
      ],
      steps: [
        "Document common issues",
        "Add error message reference",
        "Create debugging checklist",
        "Add log analysis guide",
        "Include diagnostic commands",
        "List support resources",
      ],
    });
  }

  return types;
}
