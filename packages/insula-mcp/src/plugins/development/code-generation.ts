/**
 * Code Generation Plugin
 * Generates MCP server and client code based on specifications
 */

import type { DevelopmentContext, DevelopmentPlugin, Finding } from "../../types.js";

export const CodeGenerationPlugin: DevelopmentPlugin = {
    id: "code-generation",
    title: "MCP Code Generation",
    category: "development",
    order: 2,
    requiresLlm: true,
    supportedLanguages: ["typescript", "javascript", "python", "go"],

    async run(ctx: DevelopmentContext): Promise<Finding[]> {
        const findings: Finding[] = [];

        // Check if LLM is available for code generation
        if (!ctx.conversationalLlm) {
            findings.push({
                id: "codegen.llm.missing",
                area: "development",
                severity: "minor",
                title: "Code generation LLM not available",
                description: "No LLM adapter configured for code generation capabilities.",
                evidence: [{ type: "log", ref: "code-generation" }],
                recommendation: "Configure an LLM adapter to enable AI-powered code generation features."
            });
            return findings;
        }

        // Analyze project context for code generation opportunities
        if (ctx.projectContext) {
            const { type, language, sourceFiles, dependencies } = ctx.projectContext;

            // Check for incomplete MCP server implementation
            if (type === "mcp-server" && sourceFiles.length === 0) {
                findings.push({
                    id: "codegen.server.missing",
                    area: "development",
                    severity: "info",
                    title: "MCP server implementation needed",
                    description: `No source files found for ${language} MCP server project.`,
                    evidence: [{ type: "file", ref: "project-root" }],
                    recommendation: "I can generate a complete MCP server implementation with tools, resources, and proper protocol handling.",
                    remediation: {
                        steps: [
                            "Define your server's capabilities and tools",
                            "Generate the main server file with MCP protocol handling",
                            "Create tool implementations",
                            "Add proper error handling and logging",
                            "Set up testing framework"
                        ]
                    }
                });
            }

            // Check for missing essential dependencies
            if (type === "mcp-server" && language === "typescript") {
                const requiredDeps = ["@modelcontextprotocol/sdk"];
                const missingDeps = requiredDeps.filter(dep => !dependencies.includes(dep));

                if (missingDeps.length > 0) {
                    findings.push({
                        id: "codegen.dependencies.missing",
                        area: "development",
                        severity: "minor",
                        title: "Missing MCP dependencies",
                        description: `Required MCP dependencies not found: ${missingDeps.join(", ")}`,
                        evidence: [{ type: "file", ref: "package.json" }],
                        recommendation: "I can help you set up the correct dependencies and generate the package.json configuration."
                    });
                }
            }

            // Check for client implementation opportunities
            if (type === "mcp-client" && sourceFiles.length === 0) {
                findings.push({
                    id: "codegen.client.missing",
                    area: "development",
                    severity: "info",
                    title: "MCP client implementation needed",
                    description: `No source files found for ${language} MCP client project.`,
                    evidence: [{ type: "file", ref: "project-root" }],
                    recommendation: "I can generate a complete MCP client implementation with connection handling, tool calling, and resource management."
                });
            }
        }

        // Check conversation history for code generation requests
        const recentMessages = ctx.conversationHistory.slice(-3);
        const hasCodeRequest = recentMessages.some(msg =>
            msg.role === "user" && (
                msg.content.toLowerCase().includes("generate") ||
                msg.content.toLowerCase().includes("create") ||
                msg.content.toLowerCase().includes("implement")
            )
        );

        if (hasCodeRequest) {
            findings.push({
                id: "codegen.request.detected",
                area: "development",
                severity: "info",
                title: "Code generation request detected",
                description: "Recent conversation indicates a request for code generation assistance.",
                evidence: [{ type: "log", ref: "conversation-history" }],
                recommendation: "I'm ready to help generate the code you need. Please provide specific requirements or ask me to continue with the implementation."
            });
        }

        return findings;
    }
};