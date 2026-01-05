/**
 * CLI Output Utilities
 *
 * Provides JSON output with schema versioning and plain mode for
 * stable line-oriented output. Follows clig.dev conventions.
 */

import type { SchemaVersion } from "./constants.js";

/**
 * JSON output with schema versioning
 * All JSON output includes a "schema" field for version tracking
 */
export interface JsonOutput<T = unknown> {
  /** Schema version identifier (e.g., "cortexdx.diagnose.v1") */
  schema: SchemaVersion | string;
  /** Output data */
  data: T;
  /** Optional success flag */
  success?: boolean;
  /** Optional error details */
  errors?: Array<{
    /** Machine-parseable error code */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Optional context */
    context?: Record<string, unknown>;
  }>;
  /** Optional metadata (timestamp, duration, etc.) */
  metadata?: {
    timestamp?: string;
    duration?: number;
    version?: string;
    [key: string]: unknown;
  };
}

/**
 * Create versioned JSON output
 */
export function createJsonOutput<T>(
  schema: SchemaVersion | string,
  data: T,
  options?: {
    success?: boolean;
    errors?: Array<{ code: string; message: string; context?: Record<string, unknown> }>;
    metadata?: Record<string, unknown>;
  },
): JsonOutput<T> {
  const output: JsonOutput<T> = { schema, data };
  if (options?.success !== undefined) output.success = options.success;
  if (options?.errors) output.errors = options.errors;
  if (options?.metadata) output.metadata = options.metadata;
  return output;
}

/**
 * Format versioned JSON output string
 */
export function formatJsonOutput<T>(
  schema: SchemaVersion | string,
  data: T,
  options?: {
    success?: boolean;
    errors?: Array<{ code: string; message: string; context?: Record<string, unknown> }>;
    metadata?: Record<string, unknown>;
    pretty?: boolean;
  },
): string {
  const output = createJsonOutput(schema, data, options);
  return JSON.stringify(output, null, options?.pretty ?? true ? 2 : 0);
}

/**
 * Plain mode output types
 * Stable line-oriented output for simple parsing
 */
export interface PlainOutput {
  /** Key-value pairs for plain output */
  lines: Array<{ key: string; value: string | number | boolean }>;
}

/**
 * Format plain mode output (stable line-oriented)
 * Format: "key: value" (one per line)
 */
export function formatPlainOutput(output: PlainOutput): string {
  return output.lines
    .map(({ key, value }) => {
      // Format value as string
      const valueStr =
        typeof value === "boolean" ? (value ? "true" : "false") : String(value);
      return `${key}: ${valueStr}`;
    })
    .join("\n");
}

/**
 * Convert structured data to plain output lines
 */
export function toPlainOutput(data: Record<string, unknown>): PlainOutput {
  const lines: Array<{ key: string; value: string | number | boolean }> = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      // Handle nested objects by converting to JSON string
      lines.push({ key, value: JSON.stringify(value) });
    } else if (typeof value === "boolean") {
      lines.push({ key, value });
    } else if (typeof value === "number") {
      lines.push({ key, value });
    } else {
      lines.push({ key, value: String(value) });
    }
  }
  return { lines };
}

/**
 * Print JSON output with schema versioning
 */
export function printJsonOutput<T>(
  schema: SchemaVersion | string,
  data: T,
  options?: {
    success?: boolean;
    errors?: Array<{ code: string; message: string; context?: Record<string, unknown> }>;
    metadata?: Record<string, unknown>;
  },
): void {
  console.log(formatJsonOutput(schema, data, options));
}

/**
 * Print plain mode output
 */
export function printPlainOutput(data: Record<string, unknown>): void {
  console.log(formatPlainOutput(toPlainOutput(data)));
}

/**
 * Detect if --plain or --json should be used based on options
 */
export interface OutputOptions {
  /** JSON mode flag */
  json?: boolean;
  /** Plain mode flag */
  plain?: boolean;
  /** Schema version for JSON output */
  schema?: SchemaVersion | string;
}

/**
 * Print output based on mode (json/plain/default)
 */
export function printOutput<T extends Record<string, unknown>>(
  data: T,
  options: OutputOptions,
  defaultPrinter?: (data: T) => void,
): void {
  if (options.json) {
    printJsonOutput(options.schema ?? "cortexdx.generic.v1", data);
  } else if (options.plain) {
    printPlainOutput(data);
  } else if (defaultPrinter) {
    defaultPrinter(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Wrap existing JSON output with schema versioning
 * For backward compatibility with existing code
 */
export function wrapJsonWithSchema<T>(
  existingJson: string | T,
  schema: SchemaVersion | string,
): string {
  let data: T;
  try {
    data = typeof existingJson === "string" ? JSON.parse(existingJson) : existingJson;
  } catch {
    // If not valid JSON, wrap as-is
    data = existingJson as T;
  }
  return formatJsonOutput(schema, data);
}
