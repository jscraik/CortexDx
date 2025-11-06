/**
 * Development Assistance MCP Tools
 * Provides MCP tool definitions for code generation, template creation, debugging, and best practices
 * Requirements: 1.2, 2.2, 4.1
 */

import type { McpTool } from "../types.js";

export const createDevelopmentAssistanceTools = (): McpTool[] => [
  {
    name: "generate_mcp_server_template",
    description:
      "Generate customized MCP server template based on requirements with proper tool definitions, resource handlers, and configuration. Completes within 5 seconds.",
    inputSchema: {
      type: "object",
      properties: {
        serverName: {
          type: "string",
          description: "Name of the MCP server to generate",
        },
        language: {
          type: "string",
          enum: ["typescript", "javascript", "python", "go"],
          description:
            "Programming language for the server (default: typescript)",
        },
        features: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "tools",
              "resources",
              "prompts",
              "authentication",
              "streaming",
            ],
          },
          description: "Features to include in the template",
        },
        transportProtocols: {
          type: "array",
          items: {
            type: "string",
            enum: ["http", "sse", "websocket", "stdio"],
          },
          description: "Transport protocols to support (default: ['http'])",
        },
        includeTests: {
          type: "boolean",
          description: "Include test files and testing setup (default: true)",
        },
        includeDocumentation: {
          type: "boolean",
          description: "Include README and API documentation (default: true)",
        },
        organizationStandards: {
          type: "object",
          description:
            "Organization-specific coding standards and conventions (optional)",
        },
      },
      required: ["serverName"],
    },
  },
  {
    name: "generate_mcp_connector",
    description:
      "Generate MCP connector from API specification with automatic tool definition generation, authentication wrappers, and error handling. Completes within 60 seconds.",
    inputSchema: {
      type: "object",
      properties: {
        apiSpecification: {
          type: "string",
          description: "API specification (OpenAPI/Swagger URL or JSON)",
        },
        connectorName: {
          type: "string",
          description: "Name for the generated connector",
        },
        authenticationType: {
          type: "string",
          enum: ["none", "api-key", "oauth2", "bearer", "basic"],
          description: "Authentication type for the API (default: none)",
        },
        language: {
          type: "string",
          enum: ["typescript", "javascript", "python"],
          description:
            "Programming language for the connector (default: typescript)",
        },
        includeErrorHandling: {
          type: "boolean",
          description: "Include comprehensive error handling (default: true)",
        },
        includeRateLimiting: {
          type: "boolean",
          description: "Include rate limiting support (default: true)",
        },
        generateTests: {
          type: "boolean",
          description: "Generate test suite for the connector (default: true)",
        },
      },
      required: ["apiSpecification", "connectorName"],
    },
  },
  {
    name: "generate_tool_definitions",
    description:
      "Generate MCP tool definitions from natural language descriptions or API endpoints. Creates proper JSON schemas and parameter validation.",
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Natural language description of the tool functionality",
        },
        toolName: {
          type: "string",
          description: "Name for the tool (auto-generated if not provided)",
        },
        parameters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string" },
              description: { type: "string" },
              required: { type: "boolean" },
            },
          },
          description:
            "Tool parameters (optional, can be inferred from description)",
        },
        returnType: {
          type: "string",
          description: "Expected return type (optional)",
        },
        includeValidation: {
          type: "boolean",
          description: "Include parameter validation logic (default: true)",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "start_interactive_debugging",
    description:
      "Start conversational debugging session with step-by-step diagnosis and context-aware questioning. Accepts error messages, logs, and configurations. Response time <10 seconds.",
    inputSchema: {
      type: "object",
      properties: {
        problem: {
          type: "string",
          description: "Description of the problem or error",
        },
        errorMessages: {
          type: "array",
          items: { type: "string" },
          description: "Error messages to analyze (optional)",
        },
        logFiles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              content: { type: "string" },
              format: { type: "string", enum: ["text", "json", "yaml"] },
            },
          },
          description: "Log files for context (optional)",
        },
        configurationFiles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              content: { type: "string" },
              format: { type: "string", enum: ["json", "yaml", "toml", "ini"] },
            },
          },
          description: "Configuration files for context (optional)",
        },
        codeSnippets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              language: { type: "string" },
              content: { type: "string" },
              filename: { type: "string" },
            },
          },
          description: "Relevant code snippets (optional)",
        },
        expertiseLevel: {
          type: "string",
          enum: ["beginner", "intermediate", "expert"],
          description:
            "User expertise level for tailored guidance (default: intermediate)",
        },
      },
      required: ["problem"],
    },
  },
  {
    name: "continue_debugging_session",
    description:
      "Continue an active debugging session with user responses and additional context. Provides targeted diagnostic questions and solution suggestions.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "ID of the debugging session to continue",
        },
        userResponse: {
          type: "string",
          description:
            "User's response to previous question or additional information",
        },
        additionalContext: {
          type: "object",
          description: "Additional context or evidence (optional)",
        },
      },
      required: ["sessionId", "userResponse"],
    },
  },
  {
    name: "interpret_error",
    description:
      "Translate technical errors into user-friendly explanations with actionable troubleshooting steps. Response time <5 seconds.",
    inputSchema: {
      type: "object",
      properties: {
        error: {
          type: "string",
          description: "Error message or stack trace to interpret",
        },
        context: {
          type: "object",
          properties: {
            environment: { type: "string" },
            mcpVersion: { type: "string" },
            serverType: { type: "string" },
            configuration: { type: "object" },
          },
          description: "Context about where the error occurred (optional)",
        },
        expertiseLevel: {
          type: "string",
          enum: ["beginner", "intermediate", "expert"],
          description:
            "User expertise level for explanation depth (default: intermediate)",
        },
        includeTechnicalDetails: {
          type: "boolean",
          description:
            "Include technical details alongside user-friendly explanation (default: false)",
        },
      },
      required: ["error"],
    },
  },
  {
    name: "suggest_solution_alternatives",
    description:
      "Generate multiple solution approaches for a problem, ranked by success likelihood and implementation complexity.",
    inputSchema: {
      type: "object",
      properties: {
        problem: {
          type: "string",
          description: "Problem description or error to solve",
        },
        context: {
          type: "object",
          description:
            "Problem context including environment, configuration, and constraints",
        },
        maxSolutions: {
          type: "number",
          description:
            "Maximum number of alternative solutions to generate (default: 3)",
        },
        preferredComplexity: {
          type: "string",
          enum: ["low", "medium", "high", "any"],
          description: "Preferred implementation complexity (default: any)",
        },
        includeAutomatedFixes: {
          type: "boolean",
          description:
            "Include solutions that can be applied automatically (default: true)",
        },
      },
      required: ["problem"],
    },
  },
  {
    name: "generate_documentation",
    description:
      "Generate comprehensive documentation for MCP implementations including API docs, deployment guides, and operational documentation in Markdown format.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["server", "connector", "tool", "api", "deployment"],
          description: "Type of documentation to generate",
        },
        source: {
          type: "string",
          description: "Source code path or MCP endpoint to document",
        },
        format: {
          type: "string",
          enum: ["markdown", "html", "pdf"],
          description: "Documentation output format (default: markdown)",
        },
        includeExamples: {
          type: "boolean",
          description: "Include usage examples (default: true)",
        },
        includeApiReference: {
          type: "boolean",
          description: "Include API reference documentation (default: true)",
        },
        includeDeploymentGuide: {
          type: "boolean",
          description:
            "Include deployment and configuration guide (default: true)",
        },
        includeTroubleshooting: {
          type: "boolean",
          description: "Include troubleshooting section (default: true)",
        },
      },
      required: ["target", "source"],
    },
  },
  {
    name: "provide_best_practices",
    description:
      "Analyze MCP implementation and provide best practices recommendations based on protocol standards, security guidelines, and performance optimization.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description:
            "MCP server endpoint to analyze (optional if codebase provided)",
        },
        codebase: {
          type: "string",
          description:
            "Path to codebase or code snippet to analyze (optional if endpoint provided)",
        },
        focus: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "protocol",
              "security",
              "performance",
              "maintainability",
              "testing",
              "documentation",
            ],
          },
          description:
            "Focus areas for best practices (analyzes all if not specified)",
        },
        organizationStandards: {
          type: "object",
          description:
            "Organization-specific standards to validate against (optional)",
        },
        includeCodeSamples: {
          type: "boolean",
          description:
            "Include code samples demonstrating best practices (default: true)",
        },
      },
      required: [],
    },
  },
  {
    name: "create_interactive_tutorial",
    description:
      "Generate interactive tutorial for MCP development with step-by-step guidance and real-time feedback. Completes within 15 seconds.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "Tutorial topic (e.g., 'creating first MCP server', 'implementing tools')",
        },
        expertiseLevel: {
          type: "string",
          enum: ["beginner", "intermediate", "expert"],
          description: "Target expertise level (default: beginner)",
        },
        language: {
          type: "string",
          enum: ["typescript", "javascript", "python", "go"],
          description:
            "Programming language for examples (default: typescript)",
        },
        includeExercises: {
          type: "boolean",
          description: "Include hands-on exercises (default: true)",
        },
        includeValidation: {
          type: "boolean",
          description:
            "Include automated validation of exercise solutions (default: true)",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "refine_generated_code",
    description:
      "Iteratively improve generated code based on user feedback, requirements clarification, and best practices. Supports conversational refinement.",
    inputSchema: {
      type: "object",
      properties: {
        generatedCode: {
          type: "string",
          description: "Previously generated code to refine",
        },
        feedback: {
          type: "string",
          description: "User feedback or requirements for refinement",
        },
        language: {
          type: "string",
          description: "Programming language of the code",
        },
        focusAreas: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "functionality",
              "performance",
              "security",
              "readability",
              "testing",
            ],
          },
          description: "Areas to focus refinement on (optional)",
        },
        applyBestPractices: {
          type: "boolean",
          description: "Apply best practices during refinement (default: true)",
        },
      },
      required: ["generatedCode", "feedback"],
    },
  },
  {
    name: "explain_mcp_concept",
    description:
      "Provide clear explanation of MCP concepts, patterns, and best practices adapted to user expertise level.",
    inputSchema: {
      type: "object",
      properties: {
        concept: {
          type: "string",
          description:
            "MCP concept to explain (e.g., 'tools', 'resources', 'prompts', 'transport protocols')",
        },
        expertiseLevel: {
          type: "string",
          enum: ["beginner", "intermediate", "expert"],
          description:
            "User expertise level for explanation depth (default: intermediate)",
        },
        includeExamples: {
          type: "boolean",
          description: "Include code examples (default: true)",
        },
        includeUseCases: {
          type: "boolean",
          description: "Include real-world use cases (default: true)",
        },
        relatedConcepts: {
          type: "boolean",
          description:
            "Include related concepts and connections (default: true)",
        },
      },
      required: ["concept"],
    },
  },
];
