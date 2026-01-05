/**
 * Plugin SDK for Custom Plugin Development
 * Provides interfaces and utilities for creating CortexDx plugins
 * Requirements: 8.2, 10.1, 7.2
 */

import type {
  DevelopmentContext,
  DevelopmentPlugin,
  DiagnosticContext,
  DiagnosticPlugin,
  Finding,
} from "../types.js";

export interface PluginMetadata {
  id: string;
  title: string;
  description: string;
  version: string;
  author: string;
  category: "diagnostic" | "development" | "conversational";
  order?: number;
  requiresLlm?: boolean;
  supportedLanguages?: string[];
  tags?: string[];
}

export interface PluginConfig {
  enabled: boolean;
  settings?: Record<string, unknown>;
  timeout?: number;
  retries?: number;
}

export abstract class BasePlugin implements DiagnosticPlugin {
  public readonly id: string;
  public readonly title: string;
  public readonly order?: number;

  protected config: PluginConfig;

  constructor(metadata: PluginMetadata, config?: PluginConfig) {
    this.id = metadata.id;
    this.title = metadata.title;
    this.order = metadata.order;
    this.config = config || { enabled: true };
  }

  abstract run(ctx: DiagnosticContext): Promise<Finding[]>;

  protected createFinding(
    id: string,
    area: string,
    severity: "info" | "minor" | "major" | "blocker",
    title: string,
    description: string,
    evidence: Array<{ type: "url" | "file" | "log"; ref: string }>,
    options?: {
      recommendation?: string;
      confidence?: number;
      tags?: string[];
    },
  ): Finding {
    return {
      id: `${this.id}.${id}`,
      area,
      severity,
      title,
      description,
      evidence,
      recommendation: options?.recommendation,
      confidence: options?.confidence,
      tags: options?.tags,
    };
  }

  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
      ),
    ]);
  }

  protected async retry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delayMs = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, delayMs * 2 ** attempt),
          );
        }
      }
    }

    throw lastError;
  }
}

export abstract class BaseDevelopmentPlugin
  extends BasePlugin
  implements DevelopmentPlugin
{
  public readonly category: "diagnostic" | "development" | "conversational";
  public readonly supportedLanguages?: string[];
  public readonly requiresLlm?: boolean;

  constructor(metadata: PluginMetadata, config?: PluginConfig) {
    super(metadata, config);
    this.category = metadata.category;
    this.supportedLanguages = metadata.supportedLanguages;
    this.requiresLlm = metadata.requiresLlm;
  }

  abstract override run(ctx: DevelopmentContext): Promise<Finding[]>;

  protected checkLlmAvailable(ctx: DevelopmentContext): boolean {
    return !!ctx.conversationalLlm;
  }

  protected async analyzeLlm(
    ctx: DevelopmentContext,
    prompt: string,
  ): Promise<string> {
    if (!ctx.conversationalLlm) {
      throw new Error("LLM adapter not available");
    }

    return ctx.conversationalLlm.complete(prompt);
  }
}

export interface PluginValidator {
  validate: (plugin: DiagnosticPlugin) => ValidationResult;
  validateMetadata: (metadata: PluginMetadata) => ValidationResult;
  validateFindings: (findings: Finding[]) => ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function createPluginValidator(): PluginValidator {
  return {
    validate(plugin: DiagnosticPlugin): ValidationResult {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate required fields
      if (!plugin.id || typeof plugin.id !== "string") {
        errors.push("Plugin must have a valid string id");
      }

      if (!plugin.title || typeof plugin.title !== "string") {
        errors.push("Plugin must have a valid string title");
      }

      if (typeof plugin.run !== "function") {
        errors.push("Plugin must have a run function");
      }

      // Validate id format (kebab-case)
      if (plugin.id && !/^[a-z][a-z0-9-]*$/.test(plugin.id)) {
        errors.push("Plugin id must be in kebab-case format");
      }

      // Validate order if present
      if (plugin.order !== undefined && typeof plugin.order !== "number") {
        errors.push("Plugin order must be a number");
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },

    validateMetadata(metadata: PluginMetadata): ValidationResult {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Required fields
      if (!metadata.id) errors.push("Metadata must include id");
      if (!metadata.title) errors.push("Metadata must include title");
      if (!metadata.description)
        errors.push("Metadata must include description");
      if (!metadata.version) errors.push("Metadata must include version");
      if (!metadata.author) errors.push("Metadata must include author");
      if (!metadata.category) errors.push("Metadata must include category");

      // Validate version format (semver)
      if (metadata.version && !/^\d+\.\d+\.\d+/.test(metadata.version)) {
        errors.push("Version must follow semantic versioning (x.y.z)");
      }

      // Validate category
      const validCategories = ["diagnostic", "development", "conversational"];
      if (metadata.category && !validCategories.includes(metadata.category)) {
        errors.push(`Category must be one of: ${validCategories.join(", ")}`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },

    validateFindings(findings: Finding[]): ValidationResult {
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const [index, finding] of findings.entries()) {
        const prefix = `Finding ${index}:`;

        // Required fields
        if (!finding.id) errors.push(`${prefix} must have id`);
        if (!finding.area) errors.push(`${prefix} must have area`);
        if (!finding.severity) errors.push(`${prefix} must have severity`);
        if (!finding.title) errors.push(`${prefix} must have title`);
        if (!finding.description)
          errors.push(`${prefix} must have description`);
        if (!finding.evidence || finding.evidence.length === 0) {
          errors.push(`${prefix} must have at least one evidence pointer`);
        }

        // Validate severity
        const validSeverities = ["info", "minor", "major", "blocker"];
        if (finding.severity && !validSeverities.includes(finding.severity)) {
          errors.push(
            `${prefix} severity must be one of: ${validSeverities.join(", ")}`,
          );
        }

        // Validate confidence if present
        if (
          finding.confidence !== undefined &&
          (finding.confidence < 0 || finding.confidence > 1)
        ) {
          errors.push(`${prefix} confidence must be between 0 and 1`);
        }

        // Validate evidence
        if (finding.evidence) {
          for (const [evIndex, evidence] of finding.evidence.entries()) {
            const evPrefix = `${prefix} Evidence ${evIndex}:`;
            if (!evidence.type) errors.push(`${evPrefix} must have type`);
            if (!evidence.ref) errors.push(`${evPrefix} must have ref`);

            const validTypes = ["url", "file", "log"];
            if (evidence.type && !validTypes.includes(evidence.type)) {
              errors.push(
                `${evPrefix} type must be one of: ${validTypes.join(", ")}`,
              );
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },
  };
}

export interface PluginTestRunner {
  runTests: (plugin: DiagnosticPlugin) => Promise<TestResult>;
  runBenchmark: (plugin: DiagnosticPlugin) => Promise<BenchmarkResult>;
}

export interface TestResult {
  passed: boolean;
  tests: Array<{
    name: string;
    passed: boolean;
    error?: string;
    duration: number;
  }>;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
  };
}

export interface BenchmarkResult {
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  iterations: number;
  memoryUsage: number;
}

export function createPluginTestRunner(): PluginTestRunner {
  return {
    async runTests(plugin: DiagnosticPlugin): Promise<TestResult> {
      const tests: Array<{
        name: string;
        passed: boolean;
        error?: string;
        duration: number;
      }> = [];

      // Test 1: Plugin structure validation
      const startStructure = Date.now();
      try {
        const validator = createPluginValidator();
        const result = validator.validate(plugin);
        tests.push({
          name: "Plugin structure validation",
          passed: result.valid,
          error: result.errors.join(", ") || undefined,
          duration: Date.now() - startStructure,
        });
      } catch (error) {
        tests.push({
          name: "Plugin structure validation",
          passed: false,
          error: (error as Error).message,
          duration: Date.now() - startStructure,
        });
      }

      // Test 2: Plugin execution with mock context
      const startExecution = Date.now();
      try {
        const mockContext = createMockContext();
        const findings = await plugin.run(mockContext);

        const validator = createPluginValidator();
        const result = validator.validateFindings(findings);

        tests.push({
          name: "Plugin execution with mock context",
          passed: result.valid,
          error: result.errors.join(", ") || undefined,
          duration: Date.now() - startExecution,
        });
      } catch (error) {
        tests.push({
          name: "Plugin execution with mock context",
          passed: false,
          error: (error as Error).message,
          duration: Date.now() - startExecution,
        });
      }

      return {
        passed: tests.every((t) => t.passed),
        tests,
      };
    },

    async runBenchmark(plugin: DiagnosticPlugin): Promise<BenchmarkResult> {
      const iterations = 10;
      const executionTimes: number[] = [];
      const mockContext = createMockContext();

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await plugin.run(mockContext);
        executionTimes.push(Date.now() - start);
      }

      return {
        averageExecutionTime:
          executionTimes.reduce((a, b) => a + b, 0) / iterations,
        minExecutionTime: Math.min(...executionTimes),
        maxExecutionTime: Math.max(...executionTimes),
        iterations,
        memoryUsage: 0, // Would need actual memory profiling
      };
    },
  };
}

function createMockContext(): DiagnosticContext {
  return {
    endpoint: "http://localhost:3000",
    headers: {},
    logger: (...args: unknown[]) => console.log(...args),
    request: async <T>(
      _input: RequestInfo,
      _init?: RequestInit,
    ): Promise<T> => {
      return {} as T;
    },
    jsonrpc: async <T>(_method: string, _params?: unknown): Promise<T> => {
      return {} as T;
    },
    sseProbe: async (_url: string, _opts?: unknown) => {
      return { ok: true };
    },
    evidence: (_ev) => {},
    deterministic: false,
  };
}
