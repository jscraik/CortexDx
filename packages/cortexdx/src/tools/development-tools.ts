/**
 * Development Tools for MCP Server Enhancement
 * Provides diagnostic and development assistance capabilities
 */

import type { McpTool } from "../types";

export const createDevelopmentTools = (): McpTool[] => [
  {
    name: "diagnose_mcp_server",
    description:
      "Diagnose MCP server for issues, performance problems, and compliance violations",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint URL to diagnose",
        },
        suites: {
          type: "array",
          items: { type: "string" },
          description: "Specific diagnostic suites to run (optional)",
        },
        full: {
          type: "boolean",
          description: "Run full diagnostic suite (default: false)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "start_conversation",
    description:
      "Start a conversational development session for MCP-related assistance",
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description:
            "Development intent or goal (e.g., 'create MCP server', 'debug connection issues')",
        },
        context: {
          type: "string",
          description:
            "Additional context about the project or problem (optional)",
        },
      },
      required: ["intent"],
    },
  },
  {
    name: "continue_conversation",
    description: "Continue an existing conversational development session",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "ID of the conversation session to continue",
        },
        userInput: {
          type: "string",
          description: "User's response or new input",
        },
      },
      required: ["sessionId", "userInput"],
    },
  },
  {
    name: "generate_mcp_code",
    description:
      "Generate MCP server or client code based on natural language description",
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Natural language description of what to build",
        },
        language: {
          type: "string",
          enum: ["typescript", "javascript", "python", "go"],
          description:
            "Programming language for generated code (default: typescript)",
        },
        framework: {
          type: "string",
          description: "Framework or library to use (optional)",
        },
        includeTests: {
          type: "boolean",
          description: "Include test files in generation (default: false)",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "validate_license",
    description: "Validate academic research content for license compliance",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content or research to validate",
        },
        provider: {
          type: "string",
          description:
            "Academic provider source (e.g., 'arxiv', 'semantic-scholar')",
        },
        usage: {
          type: "string",
          enum: ["research", "citation", "methodology", "implementation"],
          description: "Intended usage of the content",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "analyze_performance",
    description:
      "Analyze MCP server performance and provide optimization recommendations",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint to analyze",
        },
        duration: {
          type: "number",
          description: "Analysis duration in seconds (default: 60)",
        },
        includeMemory: {
          type: "boolean",
          description: "Include memory usage analysis (default: true)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "check_compliance",
    description:
      "Check MCP implementation compliance with protocol specifications",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint to check",
        },
        version: {
          type: "string",
          description:
            "MCP protocol version to validate against (default: latest)",
        },
        strict: {
          type: "boolean",
          description: "Enable strict compliance checking (default: false)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "suggest_improvements",
    description: "Analyze MCP implementation and suggest improvements using AI",
    inputSchema: {
      type: "object",
      properties: {
        codebase: {
          type: "string",
          description: "Path to codebase or code snippet to analyze",
        },
        focus: {
          type: "string",
          enum: [
            "performance",
            "security",
            "maintainability",
            "compliance",
            "all",
          ],
          description: "Focus area for suggestions (default: all)",
        },
        expertiseLevel: {
          type: "string",
          enum: ["beginner", "intermediate", "expert"],
          description:
            "User expertise level for tailored suggestions (default: intermediate)",
        },
      },
      required: ["codebase"],
    },
  },
];
