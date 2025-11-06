/**
 * Testing Framework Plugin
 * Generates comprehensive test suites for MCP implementations
 * Requirements: 2.5, 7.4, 11.2
 * Performance: 80-90% code coverage target
 */

import type {
  DevelopmentContext,
  DevelopmentPlugin,
  FilePlan,
  Finding,
} from "../../types.js";

export const TestingFrameworkPlugin: DevelopmentPlugin = {
  id: "testing-framework",
  title: "MCP Testing Framework",
  category: "development",
  order: 20,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Check if LLM is available for test generation
    if (!ctx.conversationalLlm) {
      findings.push({
        id: "testing.llm.missing",
        area: "development",
        severity: "minor",
        title: "Test generation LLM not available",
        description: "No LLM adapter configured for automated test generation.",
        evidence: [{ type: "log", ref: "testing-framework" }],
        recommendation:
          "Configure an LLM adapter to enable AI-powered test generation.",
      });
      return findings;
    }

    // Analyze project for testing needs
    if (ctx.projectContext) {
      const { type, language, sourceFiles } = ctx.projectContext;

      // Check for missing test files
      const testFiles = sourceFiles.filter((f) => isTestFile(f));
      const sourceCodeFiles = sourceFiles.filter(
        (f) => !isTestFile(f) && isSourceFile(f),
      );

      if (sourceCodeFiles.length > 0 && testFiles.length === 0) {
        findings.push({
          id: "testing.no_tests",
          area: "development",
          severity: "major",
          title: "No test files found",
          description: `Found ${sourceCodeFiles.length} source files but no test files.`,
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate a comprehensive test suite with:\n" +
            "- Unit tests for core functionality\n" +
            "- Integration tests for MCP protocol compliance\n" +
            "- Interoperability tests for different MCP clients\n" +
            "- Target: 80-90% code coverage",
          remediation: {
            filePlan: generateTestFilePlan(sourceCodeFiles, language),
            steps: [
              "Analyze source code structure and dependencies",
              "Generate unit tests for individual components",
              "Create integration tests for MCP protocol handling",
              "Add interoperability tests for client compatibility",
              "Set up test configuration and scripts",
              "Validate test coverage meets 80-90% target",
            ],
          },
        });
      }

      // Check test coverage ratio
      if (testFiles.length > 0 && sourceCodeFiles.length > 0) {
        const coverageRatio = testFiles.length / sourceCodeFiles.length;
        if (coverageRatio < 0.5) {
          findings.push({
            id: "testing.low_coverage",
            area: "development",
            severity: "minor",
            title: "Low test coverage ratio",
            description: `Only ${testFiles.length} test files for ${sourceCodeFiles.length} source files (${Math.round(coverageRatio * 100)}% ratio).`,
            evidence: [{ type: "file", ref: "project-root" }],
            recommendation: `I can generate additional tests to improve coverage:\n- Need approximately ${Math.ceil(sourceCodeFiles.length * 0.8 - testFiles.length)} more test files\n- Focus on untested components and edge cases\n- Add interoperability tests for MCP clients`,
          });
        }
      }

      // Check for MCP-specific test requirements
      if (type === "mcp-server") {
        const hasProtocolTests = testFiles.some(
          (f) =>
            f.toLowerCase().includes("protocol") ||
            f.toLowerCase().includes("compliance"),
        );

        if (!hasProtocolTests) {
          findings.push({
            id: "testing.no_protocol_tests",
            area: "development",
            severity: "major",
            title: "Missing MCP protocol compliance tests",
            description:
              "MCP server lacks protocol compliance and validation tests.",
            evidence: [{ type: "file", ref: "project-root" }],
            recommendation:
              "I can generate MCP protocol tests including:\n" +
              "- JSON-RPC message format validation\n" +
              "- Tool definition compliance checks\n" +
              "- Resource handling validation\n" +
              "- Error response format verification\n" +
              "- Protocol version compatibility tests",
            remediation: {
              filePlan: generateProtocolTestPlan(language),
              steps: [
                "Create protocol compliance test suite",
                "Add JSON-RPC message validation tests",
                "Implement tool definition validation",
                "Add resource handling tests",
                "Create error response validation tests",
              ],
            },
          });
        }

        const hasInteropTests = testFiles.some(
          (f) =>
            f.toLowerCase().includes("interop") ||
            f.toLowerCase().includes("compatibility") ||
            f.toLowerCase().includes("client"),
        );

        if (!hasInteropTests) {
          findings.push({
            id: "testing.no_interop_tests",
            area: "development",
            severity: "minor",
            title: "Missing interoperability tests",
            description:
              "No tests for compatibility with different MCP clients.",
            evidence: [{ type: "file", ref: "project-root" }],
            recommendation:
              "I can generate interoperability tests for:\n" +
              "- Claude Desktop client compatibility\n" +
              "- VS Code MCP extension compatibility\n" +
              "- Custom MCP client implementations\n" +
              "- Transport protocol variations (HTTP, SSE, WebSocket)",
            remediation: {
              filePlan: generateInteropTestPlan(language),
              steps: [
                "Create interoperability test framework",
                "Add tests for major MCP clients",
                "Implement transport protocol tests",
                "Add version compatibility tests",
                "Create client behavior validation tests",
              ],
            },
          });
        }
      }

      // Check for test configuration
      const hasTestConfig = ctx.projectContext.configFiles.some(
        (f) =>
          f.includes("jest") ||
          f.includes("vitest") ||
          f.includes("pytest") ||
          f.includes("test"),
      );

      if (!hasTestConfig && testFiles.length === 0) {
        findings.push({
          id: "testing.no_config",
          area: "development",
          severity: "minor",
          title: "Missing test configuration",
          description: "No test framework configuration found.",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation: `I can set up ${getRecommendedTestFramework(language)} with:\n- Test configuration file\n- Coverage reporting setup\n- Test scripts in package.json\n- CI/CD integration configuration`,
        });
      }
    }

    // Check conversation for test generation requests
    const recentMessages = ctx.conversationHistory.slice(-3);
    const hasTestRequest = recentMessages.some(
      (msg) =>
        msg.role === "user" &&
        (msg.content.toLowerCase().includes("test") ||
          msg.content.toLowerCase().includes("coverage") ||
          msg.content.toLowerCase().includes("spec")),
    );

    if (hasTestRequest) {
      findings.push({
        id: "testing.request.detected",
        area: "development",
        severity: "info",
        title: "Test generation request detected",
        description:
          "I can help you generate comprehensive tests for your MCP implementation.",
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "Available test types:\n" +
          "- Unit tests for individual components\n" +
          "- Integration tests for MCP protocol\n" +
          "- Interoperability tests for client compatibility\n" +
          "- Performance tests for load and stress testing\n" +
          "- Security tests for vulnerability detection\n\n" +
          "Tell me which tests you need or ask me to generate a complete test suite.",
      });
    }

    // Validate performance
    const duration = Date.now() - startTime;
    ctx.logger(`Testing framework analysis completed in ${duration}ms`);

    return findings;
  },
};

function isTestFile(filename: string): boolean {
  const testPatterns = [
    /\.test\./,
    /\.spec\./,
    /_test\./,
    /test_.*\.py$/,
    /.*_test\.go$/,
  ];
  return testPatterns.some((pattern) => pattern.test(filename));
}

function isSourceFile(filename: string): boolean {
  const sourceExtensions = [".ts", ".js", ".py", ".go"];
  return sourceExtensions.some((ext) => filename.endsWith(ext));
}

function generateTestFilePlan(
  sourceFiles: string[],
  language: string,
): FilePlan {
  const plan: FilePlan = [];
  const testExt = getTestExtension(language);

  // Generate test files for each source file
  for (const sourceFile of sourceFiles) {
    const testFile = sourceFile.replace(/\.(ts|js|py|go)$/, testExt);
    plan.push({
      action: "new",
      path: testFile,
      description: `Unit tests for ${sourceFile}`,
    });
  }

  // Add test configuration
  if (language === "typescript" || language === "javascript") {
    plan.push({
      action: "new",
      path: "vitest.config.ts",
      description: "Vitest test configuration",
    });
  } else if (language === "python") {
    plan.push({
      action: "new",
      path: "pytest.ini",
      description: "Pytest configuration",
    });
  } else if (language === "go") {
    plan.push({
      action: "new",
      path: "go.mod",
      description: "Go module with test dependencies",
    });
  }

  return plan;
}

function generateProtocolTestPlan(language: string): FilePlan {
  const plan: FilePlan = [];
  const testExt = getTestExtension(language);

  plan.push(
    {
      action: "new",
      path: `tests/protocol-compliance${testExt}`,
      description: "MCP protocol compliance tests",
    },
    {
      action: "new",
      path: `tests/jsonrpc-validation${testExt}`,
      description: "JSON-RPC message format validation",
    },
    {
      action: "new",
      path: `tests/tool-validation${testExt}`,
      description: "Tool definition validation tests",
    },
    {
      action: "new",
      path: `tests/resource-handling${testExt}`,
      description: "Resource handling tests",
    },
  );

  return plan;
}

function generateInteropTestPlan(language: string): FilePlan {
  const plan: FilePlan = [];
  const testExt = getTestExtension(language);

  plan.push(
    {
      action: "new",
      path: `tests/interop/client-compatibility${testExt}`,
      description: "MCP client compatibility tests",
    },
    {
      action: "new",
      path: `tests/interop/transport-protocols${testExt}`,
      description: "Transport protocol tests",
    },
    {
      action: "new",
      path: `tests/interop/version-compatibility${testExt}`,
      description: "Protocol version compatibility tests",
    },
  );

  return plan;
}

function getTestExtension(language: string): string {
  switch (language) {
    case "typescript":
      return ".test.ts";
    case "javascript":
      return ".test.js";
    case "python":
      return "_test.py";
    case "go":
      return "_test.go";
    default:
      return ".test.js";
  }
}

function getRecommendedTestFramework(language: string): string {
  switch (language) {
    case "typescript":
    case "javascript":
      return "Vitest";
    case "python":
      return "pytest";
    case "go":
      return "Go testing package";
    default:
      return "Jest";
  }
}
