/**
 * Enhanced Error Handling Tests (SEP-1303)
 * Validates that input validation errors are returned as tool execution errors
 * instead of protocol errors to enable model self-correction
 */

import { describe, it, expect } from "vitest";
import {
  validateToolInput,
  createValidationErrorResult,
  createExecutionErrorResult,
} from "../src/utils/validation.js";

describe("Enhanced Error Handling (SEP-1303)", () => {
  describe("Input Validation", () => {
    it("should validate valid input", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      };

      const input = { name: "John", age: 30 };
      const result = validateToolInput(schema, input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing required properties", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
        },
        required: ["name", "email"],
      };

      const input = { name: "John" }; // Missing email
      const result = validateToolInput(schema, input);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("email");
    });

    it("should detect type mismatches", () => {
      const schema = {
        type: "object",
        properties: {
          age: { type: "number" },
        },
        required: ["age"],
      };

      const input = { age: "thirty" }; // Should be number
      const result = validateToolInput(schema, input);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("should be number");
    });

    it("should validate enum values", () => {
      const schema = {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "inactive", "pending"],
          },
        },
        required: ["status"],
      };

      const invalidInput = { status: "unknown" };
      const result = validateToolInput(schema, invalidInput);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("should be one of");

      const validInput = { status: "active" };
      const validResult = validateToolInput(schema, validInput);
      expect(validResult.valid).toBe(true);
    });

    it("should validate string length constraints", () => {
      const schema = {
        type: "object",
        properties: {
          username: {
            type: "string",
            minLength: 3,
            maxLength: 20,
          },
        },
        required: ["username"],
      };

      const tooShort = { username: "ab" };
      const resultShort = validateToolInput(schema, tooShort);
      expect(resultShort.valid).toBe(false);
      expect(resultShort.errors[0]).toContain("at least 3 characters");

      const tooLong = { username: "a".repeat(21) };
      const resultLong = validateToolInput(schema, tooLong);
      expect(resultLong.valid).toBe(false);
      expect(resultLong.errors[0]).toContain("at most 20 characters");

      const justRight = { username: "john_doe" };
      const resultValid = validateToolInput(schema, justRight);
      expect(resultValid.valid).toBe(true);
    });

    it("should validate number ranges", () => {
      const schema = {
        type: "object",
        properties: {
          port: {
            type: "number",
            minimum: 1024,
            maximum: 65535,
          },
        },
        required: ["port"],
      };

      const tooLow = { port: 80 };
      const resultLow = validateToolInput(schema, tooLow);
      expect(resultLow.valid).toBe(false);
      expect(resultLow.errors[0]).toContain(">= 1024");

      const tooHigh = { port: 70000 };
      const resultHigh = validateToolInput(schema, tooHigh);
      expect(resultHigh.valid).toBe(false);
      expect(resultHigh.errors[0]).toContain("<= 65535");
    });

    it("should validate patterns", () => {
      const schema = {
        type: "object",
        properties: {
          email: {
            type: "string",
            pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          },
        },
        required: ["email"],
      };

      const invalid = { email: "not-an-email" };
      const result = validateToolInput(schema, invalid);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("pattern");

      const valid = { email: "user@example.com" };
      const validResult = validateToolInput(schema, valid);
      expect(validResult.valid).toBe(true);
    });

    it("should validate formats", () => {
      const schema = {
        type: "object",
        properties: {
          website: {
            type: "string",
            format: "uri",
          },
        },
        required: ["website"],
      };

      const invalid = { website: "not a url" };
      const result = validateToolInput(schema, invalid);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("format");

      const valid = { website: "https://example.com" };
      const validResult = validateToolInput(schema, valid);
      expect(validResult.valid).toBe(true);
    });
  });

  describe("Validation Error Results", () => {
    it("should create tool execution error for validation failures", () => {
      const validation = {
        valid: false,
        errors: [
          "input/name: missing required property",
          "input/age: should be number",
        ],
      };

      const result = createValidationErrorResult(validation);

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("validation failed");
      expect(result.content[0].text).toContain("name");
      expect(result.content[0].text).toContain("age");
    });
  });

  describe("Execution Error Results", () => {
    it("should create tool execution error for runtime errors", () => {
      const error = new Error("Database connection failed");
      const result = createExecutionErrorResult(error);

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("execution failed");
      expect(result.content[0].text).toContain("Database connection failed");
    });

    it("should handle non-Error objects", () => {
      const error = "Something went wrong";
      const result = createExecutionErrorResult(error);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Something went wrong");
    });

    it("should include stack trace in error details", () => {
      const error = new Error("Test error");
      const result = createExecutionErrorResult(error);

      expect(result._errorDetails).toBeDefined();
      expect(result._errorDetails?.stack).toBeDefined();
    });
  });

  describe("Complex Schema Validation", () => {
    it("should validate nested objects", () => {
      const schema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              contact: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                },
                required: ["email"],
              },
            },
            required: ["name", "contact"],
          },
        },
        required: ["user"],
      };

      const invalid = {
        user: {
          name: "John",
          // Missing contact
        },
      };

      const result = validateToolInput(schema, invalid);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("contact");
    });

    it("should validate arrays", () => {
      const schema = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
          },
        },
        required: ["tags"],
      };

      const tooFew = { tags: [] };
      const resultFew = validateToolInput(schema, tooFew);
      expect(resultFew.valid).toBe(false);

      const tooMany = { tags: ["a", "b", "c", "d", "e", "f"] };
      const resultMany = validateToolInput(schema, tooMany);
      expect(resultMany.valid).toBe(false);

      const justRight = { tags: ["tag1", "tag2"] };
      const resultValid = validateToolInput(schema, justRight);
      expect(resultValid.valid).toBe(true);
    });
  });

  describe("Model Self-Correction Flow", () => {
    it("should provide actionable error messages for models", () => {
      const schema = {
        type: "object",
        properties: {
          endpoint: {
            type: "string",
            format: "uri",
            description: "MCP server endpoint URL",
          },
          suites: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "connectivity",
                "security",
                "governance",
                "streaming",
                "performance",
              ],
            },
            description: "Diagnostic suites to run",
          },
        },
        required: ["endpoint"],
      };

      // Model provides invalid input
      const invalidInput = {
        endpoint: "not-a-url",
        suites: ["connectivity", "unknown-suite"],
      };

      const validation = validateToolInput(schema, invalidInput);
      expect(validation.valid).toBe(false);

      const errorResult = createValidationErrorResult(validation);
      const errorText = errorResult.content[0].text;

      // Error message should be clear enough for model to understand
      expect(errorText).toBeTruthy();
      expect(errorText.length).toBeGreaterThan(20);

      // Should mention both issues
      expect(errorText).toMatch(/endpoint|suites/);
    });
  });
});
