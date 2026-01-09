/**
 * Type Helpers Tests
 * Comprehensive test suite for type-safe helper utilities
 */

import { describe, it, expect } from "vitest";
import {
  getSessionState,
  toRecord,
  fromRecord,
  getFindingField,
  extractFindingFields,
  hasProperty,
  getNestedProperty,
} from "../../src/utils/type-helpers.js";
import type { ConversationSession, Finding } from "../../src/types.js";

describe("Type Helpers", () => {
  describe("getSessionState()", () => {
    it("should extract session state with correct type", () => {
      const session: ConversationSession = {
        id: "session-1",
        pluginId: "test-plugin",
        context: {} as any,
        state: { phase: "testing", counter: 42 },
        startTime: Date.now(),
        lastActivity: Date.now(),
      };

      interface TestState extends Record<string, unknown> {
        phase: string;
        counter: number;
      }

      const state = getSessionState<TestState>(session);

      expect(state.phase).toBe("testing");
      expect(state.counter).toBe(42);
    });

    it("should throw error for null state", () => {
      const session: ConversationSession = {
        id: "session-1",
        pluginId: "test-plugin",
        context: {} as any,
        state: null as any,
        startTime: Date.now(),
        lastActivity: Date.now(),
      };

      expect(() => getSessionState(session)).toThrow(
        "Invalid session state: expected object, got object",
      );
    });

    it("should throw error for non-object state", () => {
      const session: ConversationSession = {
        id: "session-1",
        pluginId: "test-plugin",
        context: {} as any,
        state: "not an object" as any,
        startTime: Date.now(),
        lastActivity: Date.now(),
      };

      expect(() => getSessionState(session)).toThrow(
        "Invalid session state: expected object, got string",
      );
    });

    it("should handle empty state object", () => {
      const session: ConversationSession = {
        id: "session-1",
        pluginId: "test-plugin",
        context: {} as any,
        state: {},
        startTime: Date.now(),
        lastActivity: Date.now(),
      };

      const state = getSessionState<Record<string, unknown>>(session);
      expect(state).toEqual({});
    });
  });

  describe("toRecord()", () => {
    it("should convert object to Record", () => {
      const obj = { key1: "value1", key2: 42, key3: true };
      const record = toRecord(obj);

      expect(record).toEqual(obj);
      expect(record.key1).toBe("value1");
      expect(record.key2).toBe(42);
      expect(record.key3).toBe(true);
    });

    it("should handle nested objects", () => {
      const obj = {
        outer: {
          inner: "value",
          num: 123,
        },
      };

      const record = toRecord(obj);
      expect(record.outer).toEqual(obj.outer);
    });

    it("should throw error for null", () => {
      expect(() => toRecord(null as any)).toThrow(
        "Cannot convert object to Record",
      );
    });

    it("should throw error for undefined", () => {
      expect(() => toRecord(undefined as any)).toThrow(
        "Cannot convert undefined to Record",
      );
    });

    it("should throw error for primitive values", () => {
      expect(() => toRecord("string" as any)).toThrow(
        "Cannot convert string to Record",
      );
      expect(() => toRecord(123 as any)).toThrow(
        "Cannot convert number to Record",
      );
      expect(() => toRecord(true as any)).toThrow(
        "Cannot convert boolean to Record",
      );
    });

    it("should handle arrays", () => {
      const arr = [1, 2, 3];
      const record = toRecord(arr as any);

      expect(record["0"]).toBe(1);
      expect(record["1"]).toBe(2);
      expect(record["2"]).toBe(3);
    });
  });

  describe("fromRecord()", () => {
    interface TestType extends Record<string, unknown> {
      id: number;
      name: string;
      active: boolean;
    }

    it("should convert Record to typed object without validation", () => {
      const record: Record<string, unknown> = {
        id: 123,
        name: "Test",
        active: true,
      };

      const obj = fromRecord<TestType>(record);

      expect(obj.id).toBe(123);
      expect(obj.name).toBe("Test");
      expect(obj.active).toBe(true);
    });

    it("should validate required keys when provided", () => {
      const record: Record<string, unknown> = {
        id: 123,
        name: "Test",
        active: true,
      };

      const obj = fromRecord<TestType>(record, ["id", "name", "active"]);

      expect(obj.id).toBe(123);
    });

    it("should throw error for missing required keys", () => {
      const record: Record<string, unknown> = {
        id: 123,
        // Missing 'name' and 'active'
      };

      expect(() =>
        fromRecord<TestType>(record, ["id", "name", "active"]),
      ).toThrow("Missing required key: name");
    });

    it("should allow optional validation with empty array", () => {
      const record: Record<string, unknown> = { extra: "data" };

      const obj = fromRecord<TestType>(record, []);
      expect(obj.extra).toBe("data");
    });

    it("should not throw for missing keys when no validation", () => {
      const record: Record<string, unknown> = { id: 123 };

      const obj = fromRecord<TestType>(record);
      expect(obj.id).toBe(123);
      expect(obj.name).toBeUndefined();
    });
  });

  describe("getFindingField()", () => {
    it("should extract field from finding object", () => {
      const finding: Finding = {
        id: "finding-1",
        area: "security",
        severity: "major",
        title: "Test Finding",
        description: "Test description",
        evidence: [],
        confidence: 1.0,
        customField: "custom value",
      } as any;

      const value = getFindingField(finding, "customField");
      expect(value).toBe("custom value");
    });

    it("should return undefined for non-existent field", () => {
      const finding: Finding = {
        id: "finding-1",
        area: "security",
        severity: "major",
        title: "Test",
        description: "Test",
        evidence: [],
        confidence: 1.0,
      };

      const value = getFindingField(finding, "nonExistent");
      expect(value).toBeUndefined();
    });

    it("should throw error for null finding", () => {
      expect(() => getFindingField(null as any, "field")).toThrow(
        "Invalid finding: expected object, got object",
      );
    });

    it("should throw error for non-object finding", () => {
      expect(() => getFindingField("not an object" as any, "field")).toThrow(
        "Invalid finding: expected object, got string",
      );
    });

    it("should access standard Finding fields", () => {
      const finding: Finding = {
        id: "finding-1",
        area: "performance",
        severity: "minor",
        title: "Slow Response",
        description: "Response time exceeds threshold",
        evidence: [{ type: "log", ref: "timing.log" }],
        confidence: 0.9,
      };

      expect(getFindingField(finding, "id")).toBe("finding-1");
      expect(getFindingField(finding, "severity")).toBe("minor");
      expect(getFindingField(finding, "confidence")).toBe(0.9);
    });
  });

  describe("extractFindingFields()", () => {
    const findings: Finding[] = [
      {
        id: "f1",
        area: "security",
        severity: "major",
        title: "Finding 1",
        description: "Desc 1",
        evidence: [],
        confidence: 1.0,
        priority: 1,
      } as any,
      {
        id: "f2",
        area: "performance",
        severity: "minor",
        title: "Finding 2",
        description: "Desc 2",
        evidence: [],
        confidence: 0.8,
        priority: 2,
      } as any,
      {
        id: "f3",
        area: "security",
        severity: "blocker",
        title: "Finding 3",
        description: "Desc 3",
        evidence: [],
        confidence: 1.0,
        // No priority field
      },
    ];

    it("should extract existing field from all findings", () => {
      const severities = extractFindingFields(findings, "severity");

      expect(severities).toHaveLength(3);
      expect(severities).toEqual(["major", "minor", "blocker"]);
    });

    it("should filter out undefined values", () => {
      const priorities = extractFindingFields(findings, "priority");

      expect(priorities).toHaveLength(2);
      expect(priorities).toEqual([1, 2]);
    });

    it("should return empty array when field not found", () => {
      const result = extractFindingFields(findings, "nonExistent");

      expect(result).toEqual([]);
    });

    it("should handle empty findings array", () => {
      const result = extractFindingFields([], "field");

      expect(result).toEqual([]);
    });

    it("should extract nested values if present", () => {
      const findingsWithMetadata: Finding[] = [
        {
          id: "f1",
          area: "security",
          severity: "major",
          title: "Test",
          description: "Test",
          evidence: [],
          confidence: 1.0,
          metadata: { score: 95 },
        } as any,
        {
          id: "f2",
          area: "performance",
          severity: "minor",
          title: "Test",
          description: "Test",
          evidence: [],
          confidence: 0.8,
          metadata: { score: 70 },
        } as any,
      ];

      const metadata = extractFindingFields(findingsWithMetadata, "metadata");

      expect(metadata).toHaveLength(2);
      expect(metadata[0]).toEqual({ score: 95 });
      expect(metadata[1]).toEqual({ score: 70 });
    });
  });

  describe("hasProperty()", () => {
    it("should return true for existing property", () => {
      const obj = { name: "test", value: 42 };

      expect(hasProperty(obj, "name")).toBe(true);
      expect(hasProperty(obj, "value")).toBe(true);
    });

    it("should return false for non-existent property", () => {
      const obj = { name: "test" };

      expect(hasProperty(obj, "other")).toBe(false);
    });

    it("should return false for null", () => {
      expect(hasProperty(null, "prop")).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(hasProperty(undefined, "prop")).toBe(false);
    });

    it("should return false for primitive values", () => {
      expect(hasProperty("string", "prop")).toBe(false);
      expect(hasProperty(123, "prop")).toBe(false);
      expect(hasProperty(true, "prop")).toBe(false);
    });

    it("should work with nested objects", () => {
      const obj = {
        outer: {
          inner: "value",
        },
      };

      expect(hasProperty(obj, "outer")).toBe(true);
      expect(hasProperty(obj.outer, "inner")).toBe(true);
    });

    it("should narrow type correctly", () => {
      const obj: unknown = { key: "value" };

      if (hasProperty(obj, "key")) {
        // Type should be narrowed to Record<"key", unknown>
        expect(obj.key).toBe("value");
      } else {
        throw new Error("Should have property");
      }
    });
  });

  describe("getNestedProperty()", () => {
    it("should access nested property with path", () => {
      const obj: Record<string, unknown> = {
        level1: {
          level2: {
            level3: "deep value",
          },
        },
      };

      const value = getNestedProperty(obj, ["level1", "level2", "level3"]);

      expect(value).toBe("deep value");
    });

    it("should return undefined for non-existent path", () => {
      const obj: Record<string, unknown> = {
        level1: {
          level2: "value",
        },
      };

      const value = getNestedProperty(obj, ["level1", "nonExistent", "level3"]);

      expect(value).toBeUndefined();
    });

    it("should return undefined for partial path", () => {
      const obj: Record<string, unknown> = {
        level1: "value",
      };

      const value = getNestedProperty(obj, ["level1", "level2"]);

      expect(value).toBeUndefined();
    });

    it("should return value for empty path", () => {
      const obj: Record<string, unknown> = { key: "value" };

      const value = getNestedProperty(obj, []);

      expect(value).toBe(obj);
    });

    it("should handle single-level path", () => {
      const obj: Record<string, unknown> = { key: "value" };

      const value = getNestedProperty(obj, ["key"]);

      expect(value).toBe("value");
    });

    it("should handle arrays in path", () => {
      const obj: Record<string, unknown> = {
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      };

      const value = getNestedProperty(obj, ["items", "1"]);

      expect(value).toEqual({ id: 2 });
    });
  });

  describe("Integration Tests", () => {
    it("should work together for session state extraction", () => {
      interface AppState extends Record<string, unknown> {
        user: {
          id: number;
          name: string;
        };
        settings: {
          theme: string;
          notifications: boolean;
        };
      }

      const session: ConversationSession = {
        id: "session-1",
        pluginId: "app-plugin",
        context: {} as any,
        state: {
          user: { id: 42, name: "Alice" },
          settings: { theme: "dark", notifications: true },
        },
        startTime: Date.now(),
        lastActivity: Date.now(),
      };

      const state = getSessionState<AppState>(session);

      expect(hasProperty(state, "user")).toBe(true);
      expect(hasProperty(state, "settings")).toBe(true);

      if (hasProperty(state, "user")) {
        const user = state.user as AppState["user"];
        expect(user.id).toBe(42);
        expect(user.name).toBe("Alice");
      }
    });

    it("should work together for finding field extraction", () => {
      const findings: Finding[] = [
        {
          id: "f1",
          area: "security",
          severity: "major",
          title: "SQL Injection",
          description: "Potential SQL injection vulnerability",
          evidence: [],
          confidence: 0.95,
          cvss: 8.5,
        } as any,
        {
          id: "f2",
          area: "security",
          severity: "critical",
          title: "XSS Vulnerability",
          description: "Cross-site scripting detected",
          evidence: [],
          confidence: 1.0,
          cvss: 9.0,
        } as any,
      ];

      const cvssScores = extractFindingFields(findings, "cvss");

      expect(cvssScores).toHaveLength(2);
      expect(Math.max(...(cvssScores as number[]))).toBe(9.0);
    });
  });
});
