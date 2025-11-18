/**
 * Input Validation Utilities
 * Validates tool inputs against JSON Schema for enhanced error handling (SEP-1303)
 */

import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
});

addFormats(ajv);

// Schema cache to avoid recompiling (Critical #4)
const schemaCache = new Map<string, ValidateFunction>();

/**
 * Validation result with detailed error information
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  details?: Array<{
    path: string;
    message: string;
    params?: Record<string, unknown>;
  }>;
}

/**
 * Get or compile schema from cache
 */
function getOrCompileSchema(
  schema: Record<string, unknown>,
  schemaKey: string
): { validate: ValidateFunction | null; error?: string } {
  let validate = schemaCache.get(schemaKey);
  
  if (!validate) {
    try {
      validate = ajv.compile(schema);
      schemaCache.set(schemaKey, validate);
    } catch (compileError) {
      return {
        validate: null,
        error: compileError instanceof Error ? compileError.message : 'Schema compilation failed'
      };
    }
  }
  
  return { validate: validate || null };
}

/**
 * Convert Ajv errors to validation result details
 */
function convertAjvErrors(
  errors: ErrorObject[]
): Array<{ path: string; message: string; params?: Record<string, unknown> }> {
  return errors.map(error => ({
    path: error.instancePath || 'input',
    message: formatErrorMessage(error),
    params: error.params as Record<string, unknown>
  }));
}

/**
 * Validate tool input against JSON Schema
 * Returns validation result with human-readable error messages
 *
 * Per SEP-1303: Input validation errors should be returned as Tool Execution Errors
 * rather than Protocol Errors to enable model self-correction.
 *
 * Fixed: Cache compiled schemas to avoid recompilation (Critical #4)
 */
export function validateToolInput(
  schema: Record<string, unknown>,
  input: unknown
): ValidationResult {
  // Use schema as cache key (Critical #4: avoid recompiling same schema)
  const schemaKey = JSON.stringify(schema);
  const { validate, error } = getOrCompileSchema(schema, schemaKey);

  if (!validate) {
    // Schema compilation error - this is a server issue
    return {
      valid: false,
      errors: ['Invalid tool schema configuration'],
      details: [{ path: 'schema', message: error || 'Schema compilation failed' }]
    };
  }

  const valid = validate(input);

  if (valid) {
    return { valid: true, errors: [] };
  }

  // Convert Ajv errors to human-readable format
  const details = convertAjvErrors(validate.errors || []);
  const errors = details.map(d => `${d.path}: ${d.message}`);

  return { valid: false, errors, details };
}

/**
 * Format Ajv error into human-readable message
 */
function formatErrorMessage(error: ErrorObject): string {
  const { keyword, message, params } = error;

  switch (keyword) {
    case 'required':
      return `missing required property '${params.missingProperty}'`;
    case 'type':
      return `should be ${params.type}`;
    case 'enum':
      return `should be one of: ${params.allowedValues.join(', ')}`;
    case 'minimum':
      return `should be >= ${params.limit}`;
    case 'maximum':
      return `should be <= ${params.limit}`;
    case 'minLength':
      return `should be at least ${params.limit} characters`;
    case 'maxLength':
      return `should be at most ${params.limit} characters`;
    case 'pattern':
      return `should match pattern ${params.pattern}`;
    case 'format':
      return `should match format "${params.format}"`;
    case 'additionalProperties':
      return `should not have additional property '${params.additionalProperty}'`;
    default:
      return message || `validation failed (${keyword})`;
  }
}

/**
 * Create a tool execution error result (per SEP-1303)
 * Use this instead of throwing protocol errors for validation failures
 */
export function createValidationErrorResult(validation: ValidationResult) {
  return {
    content: [
      {
        type: 'text',
        text: `Input validation failed:\n${validation.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
      },
    ],
    isError: true,
  };
}

/**
 * Create a tool execution error result for runtime errors
 */
export function createExecutionErrorResult(error: Error | unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  return {
    content: [
      {
        type: 'text',
        text: `Tool execution failed: ${message}`,
      },
    ],
    isError: true,
    _errorDetails: stack ? { stack } : undefined,
  };
}
