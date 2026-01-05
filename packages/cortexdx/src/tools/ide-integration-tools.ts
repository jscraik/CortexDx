/**
 * IDE Integration MCP Tools
 * Provides MCP tool definitions for IDE integration
 * Requirements: 1.3, 4.1, 9.2
 */

import type { McpTool } from "../types.js";

export const ideValidateCodeTool: McpTool = {
  name: "ide_validate_code",
  description:
    "Validates MCP code in real-time for IDE integration. " +
    "Provides diagnostics, suggestions, and quick fixes.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The code content to validate",
      },
      filePath: {
        type: "string",
        description: "Path to the file being validated",
      },
      language: {
        type: "string",
        enum: ["typescript", "javascript", "python", "go"],
        description: "Programming language of the code",
      },
      cursorPosition: {
        type: "object",
        properties: {
          line: { type: "number" },
          column: { type: "number" },
        },
        description: "Current cursor position in the editor",
      },
    },
    required: ["code", "filePath", "language"],
  },
};

export const ideGetSuggestionsTool: McpTool = {
  name: "ide_get_suggestions",
  description:
    "Gets context-aware code suggestions for the current cursor position. " +
    "Provides inline completions and recommendations.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The current code content",
      },
      filePath: {
        type: "string",
        description: "Path to the file",
      },
      cursorPosition: {
        type: "object",
        properties: {
          line: { type: "number" },
          column: { type: "number" },
        },
        required: ["line", "column"],
        description: "Cursor position for suggestions",
      },
      context: {
        type: "object",
        properties: {
          prefix: { type: "string", description: "Text before cursor" },
          suffix: { type: "string", description: "Text after cursor" },
        },
        description: "Additional context around cursor",
      },
    },
    required: ["code", "filePath", "cursorPosition"],
  },
};

export const ideApplyQuickFixTool: McpTool = {
  name: "ide_apply_quick_fix",
  description:
    "Applies an automated fix to the code. " +
    "Returns the modified code with the fix applied.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The current code content",
      },
      filePath: {
        type: "string",
        description: "Path to the file",
      },
      fixId: {
        type: "string",
        description: "ID of the quick fix to apply",
      },
      diagnosticCode: {
        type: "string",
        description: "Code of the diagnostic being fixed",
      },
    },
    required: ["code", "filePath", "fixId"],
  },
};

export const ideGetDiagnosticsTool: McpTool = {
  name: "ide_get_diagnostics",
  description:
    "Gets all diagnostics for a file or project. " +
    "Returns errors, warnings, and info messages.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Path to the file to diagnose",
      },
      projectRoot: {
        type: "string",
        description: "Root directory of the project",
      },
      includeWarnings: {
        type: "boolean",
        description: "Include warnings in results",
        default: true,
      },
      includeInfo: {
        type: "boolean",
        description: "Include info messages in results",
        default: false,
      },
    },
    required: ["filePath"],
  },
};

export const ideFormatCodeTool: McpTool = {
  name: "ide_format_code",
  description:
    "Formats MCP code according to best practices. " +
    "Returns formatted code with consistent style.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The code to format",
      },
      language: {
        type: "string",
        enum: ["typescript", "javascript", "python", "go"],
        description: "Programming language",
      },
      options: {
        type: "object",
        properties: {
          indentSize: { type: "number", default: 2 },
          useTabs: { type: "boolean", default: false },
          lineWidth: { type: "number", default: 80 },
        },
        description: "Formatting options",
      },
    },
    required: ["code", "language"],
  },
};

export const ideGetCompletionsTool: McpTool = {
  name: "ide_get_completions",
  description:
    "Gets code completion suggestions at cursor position. " +
    "Provides MCP-specific completions for tools, resources, and prompts.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Current code content",
      },
      cursorPosition: {
        type: "object",
        properties: {
          line: { type: "number" },
          column: { type: "number" },
        },
        required: ["line", "column"],
      },
      triggerCharacter: {
        type: "string",
        description: "Character that triggered completion (e.g., '.', ':')",
      },
    },
    required: ["code", "cursorPosition"],
  },
};

export const ideGetHoverInfoTool: McpTool = {
  name: "ide_get_hover_info",
  description:
    "Gets hover information for symbol at cursor position. " +
    "Provides documentation and type information.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Current code content",
      },
      filePath: {
        type: "string",
        description: "Path to the file",
      },
      position: {
        type: "object",
        properties: {
          line: { type: "number" },
          column: { type: "number" },
        },
        required: ["line", "column"],
      },
    },
    required: ["code", "filePath", "position"],
  },
};

export const ideRefactorCodeTool: McpTool = {
  name: "ide_refactor_code",
  description:
    "Performs code refactoring operations. " +
    "Supports rename, extract function, inline, and more.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Current code content",
      },
      filePath: {
        type: "string",
        description: "Path to the file",
      },
      refactoringType: {
        type: "string",
        enum: [
          "rename",
          "extract_function",
          "extract_variable",
          "inline",
          "move",
        ],
        description: "Type of refactoring to perform",
      },
      selection: {
        type: "object",
        properties: {
          start: {
            type: "object",
            properties: {
              line: { type: "number" },
              column: { type: "number" },
            },
          },
          end: {
            type: "object",
            properties: {
              line: { type: "number" },
              column: { type: "number" },
            },
          },
        },
        description: "Selected code range",
      },
      options: {
        type: "object",
        description: "Refactoring-specific options",
      },
    },
    required: ["code", "filePath", "refactoringType"],
  },
};

export const ideAnalyzeProjectTool: McpTool = {
  name: "ide_analyze_project",
  description:
    "Analyzes entire MCP project for issues and improvements. " +
    "Provides project-wide diagnostics and recommendations.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: {
        type: "string",
        description: "Root directory of the project",
      },
      includeTests: {
        type: "boolean",
        description: "Include test files in analysis",
        default: true,
      },
      depth: {
        type: "string",
        enum: ["quick", "standard", "deep"],
        description: "Analysis depth",
        default: "standard",
      },
    },
    required: ["projectRoot"],
  },
};

export const ideGenerateTestsTool: McpTool = {
  name: "ide_generate_tests",
  description:
    "Generates test cases for MCP code. " +
    "Creates comprehensive test suites based on code analysis.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Code to generate tests for",
      },
      filePath: {
        type: "string",
        description: "Path to the source file",
      },
      testFramework: {
        type: "string",
        enum: ["vitest", "jest", "mocha", "pytest"],
        description: "Test framework to use",
        default: "vitest",
      },
      coverage: {
        type: "string",
        enum: ["basic", "standard", "comprehensive"],
        description: "Test coverage level",
        default: "standard",
      },
    },
    required: ["code", "filePath"],
  },
};

export const ideIntegrationTools: McpTool[] = [
  ideValidateCodeTool,
  ideGetSuggestionsTool,
  ideApplyQuickFixTool,
  ideGetDiagnosticsTool,
  ideFormatCodeTool,
  ideGetCompletionsTool,
  ideGetHoverInfoTool,
  ideRefactorCodeTool,
  ideAnalyzeProjectTool,
  ideGenerateTestsTool,
];
