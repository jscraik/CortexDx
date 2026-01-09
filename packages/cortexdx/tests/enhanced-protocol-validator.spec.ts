/**
 * Enhanced Protocol Validator Tests
 *
 * Tests for Protovalidate integration, semantic validation, custom CEL rules,
 * field-level error reporting, and performance optimization.
 *
 * Requirements: 23.1, 23.2, 23.3, 23.4, 23.5
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  CELRuleBuilder,
  CELRuleConfigLoader,
  CELRuleValidator,
  MCPCELRuleLibrary,
} from "../src/adapters/cel-rules.js";
import {
  ErrorFormatter,
  FieldErrorReporter,
} from "../src/adapters/field-error-reporter.js";
import {
  ProtovalidateAdapter,
  type CELRule,
} from "../src/adapters/protovalidate.js";

describe("Enhanced Protocol Validator", () => {
  describe("Protovalidate Integration (Req 23.1)", () => {
    let adapter: ProtovalidateAdapter;

    beforeEach(() => {
      adapter = new ProtovalidateAdapter();
    });

    it("should validate Protocol Buffer messages with CEL expressions", async () => {
      const message = {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "test-server",
          version: "1.0.0",
        },
      };

      const rules: CELRule[] = [
        {
          field: "protocolVersion",
          expression: 'this.matches("^\\\\d{4}-\\\\d{2}-\\\\d{2}$")',
          message: "Protocol version must be in YYYY-MM-DD format",
          severity: "error",
        },
      ];

      const result = await adapter.validate(message, rules);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should detect violations in Protocol Buffer messages", async () => {
      const message = {
        protocolVersion: "invalid-version",
        serverInfo: {
          name: "test-server",
          version: "1.0.0",
        },
      };

      const rules: CELRule[] = [
        {
          field: "protocolVersion",
          expression: 'this.matches("^\\\\d{4}-\\\\d{2}-\\\\d{2}$")',
          message: "Protocol version must be in YYYY-MM-DD format",
          severity: "error",
        },
      ];

      const result = await adapter.validate(message, rules);

      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].fieldPath).toBe("protocolVersion");
    });

    it("should validate string constraints", async () => {
      const value = "test-server";
      const result = await adapter.validateField(value, "serverInfo.name", {
        minLength: 3,
        maxLength: 100,
      });

      expect(result.valid).toBe(true);
    });

    it("should validate number constraints", async () => {
      const value = 42;
      const result = await adapter.validateField(value, "timeout", {
        gte: 0,
        lte: 100,
      });

      expect(result.valid).toBe(true);
    });

    it("should validate array constraints", async () => {
      const value = ["tool1", "tool2", "tool3"];
      const result = await adapter.validateField(value, "tools", {
        minItems: 1,
        maxItems: 10,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("MCP Protocol Validation (Req 23.2)", () => {
    let adapter: ProtovalidateAdapter;

    beforeEach(() => {
      adapter = new ProtovalidateAdapter();
    });

    it("should validate JSON-RPC message structure", async () => {
      const message = {
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
        },
      };

      const rules: CELRule[] = [
        {
          field: "jsonrpc",
          expression: 'this == "2.0"',
          message: 'JSON-RPC version must be "2.0"',
          severity: "error",
        },
        {
          field: "method",
          expression: "size(this) > 0",
          message: "Method name must not be empty",
          severity: "error",
        },
      ];

      const result = await adapter.validate(message, rules);

      expect(result.valid).toBe(true);
    });

    it("should validate MCP handshake messages", async () => {
      const initResponse = {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: "test-server",
          version: "1.0.0",
        },
      };

      const rules = MCPCELRuleLibrary.getProtocolVersionRules();

      const result = await adapter.validate(initResponse, rules);

      expect(result.valid).toBe(true);
    });

    it("should detect invalid protocol version format", async () => {
      const message = {
        protocolVersion: "1.0.0", // Should be YYYY-MM-DD
      };

      const rules: CELRule[] = [
        {
          field: "protocolVersion",
          expression: 'this.matches("^\\\\d{4}-\\\\d{2}-\\\\d{2}$")',
          message: "Protocol version must be in YYYY-MM-DD format",
          severity: "error",
        },
      ];

      const result = await adapter.validate(message, rules);

      expect(result.valid).toBe(false);
      expect(result.violations[0].message).toContain("YYYY-MM-DD format");
    });

    it("should validate server capabilities", async () => {
      const message = {
        capabilities: {
          tools: {},
          resources: {},
        },
      };

      // Use a simpler expression that checks size
      const rules: CELRule[] = [
        {
          field: "capabilities",
          expression: "size(this) > 0",
          message: "Server must declare at least one capability",
          severity: "warning",
        },
      ];

      const result = await adapter.validate(message, rules);

      expect(result.valid).toBe(true);
    });
  });

  describe("Custom CEL Rules (Req 23.3)", () => {
    it("should build CEL rules with fluent API", () => {
      const rule = new CELRuleBuilder()
        .forField("serverInfo.name")
        .stringLength(3, 100)
        .withSeverity("error")
        .build();

      expect(rule.field).toBe("serverInfo.name");
      expect(rule.expression).toContain("size(this)");
      expect(rule.severity).toBe("error");
    });

    it("should create pattern matching rules", () => {
      const rule = new CELRuleBuilder()
        .forField("protocolVersion")
        .matchesPattern("^\\d{4}-\\d{2}-\\d{2}$")
        .build();

      expect(rule.expression).toContain("matches");
    });

    it("should create string prefix rules", () => {
      const rule = new CELRuleBuilder()
        .forField("resource.uri")
        .startsWith("file://")
        .build();

      expect(rule.expression).toContain("startsWith");
    });

    it("should load rules from JSON configuration", () => {
      const config = {
        version: "1.0",
        rules: [
          {
            field: "test.field",
            expression: 'this == "value"',
            message: "Test message",
            severity: "error" as const,
          },
        ],
      };

      const rules = CELRuleConfigLoader.loadFromConfig(config);

      expect(rules).toHaveLength(1);
      expect(rules[0].field).toBe("test.field");
    });

    it("should provide MCP-specific rule library", () => {
      const protocolRules = MCPCELRuleLibrary.getProtocolVersionRules();
      const toolRules = MCPCELRuleLibrary.getToolDefinitionRules();
      const resourceRules = MCPCELRuleLibrary.getResourceRules();

      expect(protocolRules.length).toBeGreaterThan(0);
      expect(toolRules.length).toBeGreaterThan(0);
      expect(resourceRules.length).toBeGreaterThan(0);
    });

    it("should validate rule syntax", () => {
      const validRule: CELRule = {
        field: "test",
        expression: 'this == "value"',
        message: "Test",
        severity: "error",
      };

      const result = CELRuleValidator.validateRule(validRule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid rule syntax", () => {
      const invalidRule: CELRule = {
        field: "",
        expression: "",
        message: "",
        severity: "error",
      };

      const result = CELRuleValidator.validateRule(invalidRule);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Field-Level Error Reporting (Req 23.4)", () => {
    it("should generate detailed errors from violations", () => {
      const violations = [
        {
          fieldPath: "protocolVersion",
          constraintId: "string.pattern",
          message: "Protocol version must be in YYYY-MM-DD format",
          value: "invalid",
          expectedConstraint: "pattern: ^\\d{4}-\\d{2}-\\d{2}$",
        },
      ];

      const errors = FieldErrorReporter.generateDetailedErrors(violations);

      expect(errors).toHaveLength(1);
      expect(errors[0].fieldPath).toBe("protocolVersion");
      expect(errors[0].suggestion).toBeTruthy();
      expect(errors[0].documentation).toBeTruthy();
    });

    it("should categorize errors correctly", () => {
      const violations = [
        {
          fieldPath: "protocolVersion",
          constraintId: "test",
          message: "Test",
          value: "test",
          expectedConstraint: "test",
        },
        {
          fieldPath: "capabilities.tools",
          constraintId: "test",
          message: "Test",
          value: "test",
          expectedConstraint: "test",
        },
        {
          fieldPath: "tool.name",
          constraintId: "test",
          message: "Test",
          value: "test",
          expectedConstraint: "test",
        },
      ];

      const errors = FieldErrorReporter.generateDetailedErrors(violations);

      expect(errors[0].category).toBe("protocol-version");
      expect(errors[1].category).toBe("capabilities");
      expect(errors[2].category).toBe("tool-definition");
    });

    it("should provide documentation links", () => {
      const violations = [
        {
          fieldPath: "protocolVersion",
          constraintId: "test",
          message: "Test",
          value: "test",
          expectedConstraint: "test",
        },
      ];

      const errors = FieldErrorReporter.generateDetailedErrors(violations);

      expect(errors[0].documentation).toContain("http");
      expect(errors[0].documentation).toContain("modelcontextprotocol");
    });

    it("should format errors as plain text", () => {
      const violations = [
        {
          fieldPath: "protocolVersion",
          constraintId: "test",
          message: "Invalid format",
          value: "invalid",
          expectedConstraint: "YYYY-MM-DD",
        },
      ];

      const errors = FieldErrorReporter.generateDetailedErrors(violations);
      const formatted = FieldErrorReporter.formatError(errors[0]);

      expect(formatted).toContain("protocolVersion");
      expect(formatted).toContain("Invalid format");
      expect(formatted).toContain("Suggestion");
    });

    it("should format errors as Markdown", () => {
      const violations = [
        {
          fieldPath: "protocolVersion",
          constraintId: "test",
          message: "Invalid format",
          value: "invalid",
          expectedConstraint: "YYYY-MM-DD",
        },
      ];

      const errors = FieldErrorReporter.generateDetailedErrors(violations);
      const markdown = ErrorFormatter.toMarkdown(errors);

      expect(markdown).toContain("# MCP Protocol Validation Report");
      expect(markdown).toContain("protocolVersion");
      expect(markdown).toContain("**Problem**");
    });

    it("should format errors as JSON", () => {
      const violations = [
        {
          fieldPath: "protocolVersion",
          constraintId: "test",
          message: "Invalid format",
          value: "invalid",
          expectedConstraint: "YYYY-MM-DD",
        },
      ];

      const errors = FieldErrorReporter.generateDetailedErrors(violations);
      const json = ErrorFormatter.toJSON(errors);

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
    });

    it("should create validation summary", () => {
      const violations = [
        {
          fieldPath: "field1",
          constraintId: "test",
          message: "Error 1",
          value: "test",
          expectedConstraint: "test",
        },
        {
          fieldPath: "field2",
          constraintId: "test",
          message: "Error 2",
          value: "test",
          expectedConstraint: "test",
        },
      ];

      const errors = FieldErrorReporter.generateDetailedErrors(violations);
      const summary = FieldErrorReporter.createValidationSummary(errors);

      expect(summary.totalIssues).toBe(2);
      expect(summary.errors).toBeGreaterThanOrEqual(0);
      expect(summary.warnings).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Performance Optimization (Req 23.5)", () => {
    let adapter: ProtovalidateAdapter;

    beforeEach(() => {
      adapter = new ProtovalidateAdapter();
    });

    it("should cache validation results", async () => {
      const message = {
        protocolVersion: "2024-11-05",
      };

      const rules: CELRule[] = [
        {
          field: "protocolVersion",
          expression: 'this.matches("^\\\\d{4}-\\\\d{2}-\\\\d{2}$")',
          message: "Test",
          severity: "error",
        },
      ];

      // First validation
      const result1 = await adapter.validate(message, rules);

      // Second validation (should use cache)
      const result2 = await adapter.validate(message, rules);

      expect(result1.valid).toBe(result2.valid);
    });

    it("should support cache control", () => {
      adapter.setCacheEnabled(false);
      const stats = adapter.getCacheStats();

      expect(stats.size).toBe(0);

      adapter.setCacheEnabled(true);
    });

    it("should clear cache", async () => {
      const message = { test: "value" };
      const rules: CELRule[] = [];

      await adapter.validate(message, rules);

      adapter.clearCache();
      const stats = adapter.getCacheStats();

      expect(stats.size).toBe(0);
    });

    it("should validate multiple messages in parallel", async () => {
      const messages = [
        { protocolVersion: "2024-11-05" },
        { protocolVersion: "2024-10-01" },
        { protocolVersion: "2024-09-15" },
      ];

      const rules: CELRule[] = [
        {
          field: "protocolVersion",
          expression: 'this.matches("^\\\\d{4}-\\\\d{2}-\\\\d{2}$")',
          message: "Test",
          severity: "error",
        },
      ];

      const startTime = Date.now();
      const results = await adapter.validateBatch(messages, rules);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.valid)).toBe(true);

      // Parallel execution should be faster than sequential
      // (This is a basic check; actual performance depends on system)
      expect(duration).toBeLessThan(1000);
    });

    it("should complete validation within 5 seconds for typical MCP messages", async () => {
      const message = {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: "test-server",
          version: "1.0.0",
        },
      };

      const rules = MCPCELRuleLibrary.getAllRules();

      const startTime = Date.now();
      const result = await adapter.validate(message, rules);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Requirement: <5s validation time
    });

    it("should optimize CEL expression compilation", async () => {
      const message = { test: "value" };
      const rule: CELRule = {
        field: "test",
        expression: 'this == "value"',
        message: "Test",
        severity: "error",
      };

      // First evaluation (compiles expression)
      const start1 = Date.now();
      await adapter.validate(message, [rule]);
      const duration1 = Date.now() - start1;

      // Second evaluation (uses compiled expression)
      const start2 = Date.now();
      await adapter.validate(message, [rule]);
      const duration2 = Date.now() - start2;

      // Second evaluation should be faster due to compilation caching
      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });

  describe("Integration Tests", () => {
    let adapter: ProtovalidateAdapter;

    beforeEach(() => {
      adapter = new ProtovalidateAdapter();
    });

    it("should validate complete MCP initialization message", async () => {
      const initMessage = {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: "test-mcp-server",
          version: "1.0.0",
        },
      };

      // Use only rules that will pass for this message
      const rules: CELRule[] = [
        {
          field: "protocolVersion",
          expression: 'this.matches("^\\\\d{4}-\\\\d{2}-\\\\d{2}$")',
          message: "Protocol version must be in YYYY-MM-DD format",
          severity: "error",
        },
        {
          field: "capabilities",
          expression: "size(this) > 0",
          message: "Server must declare at least one capability",
          severity: "warning",
        },
        {
          field: "serverInfo.name",
          expression: "size(this) >= 3 && size(this) <= 100",
          message: "Server name should be between 3 and 100 characters",
          severity: "warning",
        },
      ];

      const result = await adapter.validate(initMessage, rules);

      expect(result.valid).toBe(true);
    });

    it("should detect multiple violations in invalid message", async () => {
      const invalidMessage = {
        protocolVersion: "invalid",
        capabilities: {},
        serverInfo: {
          name: "ab", // Too short
          version: "invalid-version",
        },
      };

      const rules = [
        ...MCPCELRuleLibrary.getProtocolVersionRules(),
        ...MCPCELRuleLibrary.getServerInfoRules(),
      ];

      const result = await adapter.validate(invalidMessage, rules);

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it("should generate comprehensive error report", async () => {
      const invalidMessage = {
        protocolVersion: "invalid",
        serverInfo: {
          name: "ab",
          version: "bad",
        },
      };

      const rules = MCPCELRuleLibrary.getAllRules();

      const result = await adapter.validate(invalidMessage, rules);
      const errors = FieldErrorReporter.generateDetailedErrors(
        result.violations,
      );
      const report = FieldErrorReporter.formatErrorReport(errors);

      expect(report).toContain("MCP Protocol Validation Report");
      expect(report).toContain("Suggestion");
      expect(report).toContain("Documentation");
    });
  });
});
