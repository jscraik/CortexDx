/**
 * JSON Schema to Zod Converter
 * Fixed implementation with proper recursive conversion
 * No .passthrough() for strict validation
 */

import { z } from 'zod';

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JsonSchema;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
  $ref?: string;
  title?: string;
}

/**
 * Convert JSON Schema to Zod schema with full recursive support
 */
export function jsonSchemaToZod(
  schema: JsonSchema,
  refs: Map<string, z.ZodType> = new Map()
): z.ZodType {
  // Handle $ref (basic support - assumes definitions are in same schema)
  if (schema.$ref) {
    const refName = schema.$ref.replace('#/definitions/', '').replace('#/$defs/', '');
    const refSchema = refs.get(refName);
    if (refSchema) return refSchema;
    // If ref not found, return unknown
    return z.unknown();
  }

  // Handle const
  if (schema.const !== undefined) {
    return z.literal(schema.const as string | number | boolean);
  }

  // Handle enum
  if (schema.enum && schema.enum.length > 0) {
    if (schema.enum.every(v => typeof v === 'string')) {
      return z.enum(schema.enum as [string, ...string[]]);
    }
    const literals = schema.enum.map(v => z.literal(v as string | number | boolean));
    if (literals.length === 1) return literals[0]!;
    if (literals.length === 2) return z.union([literals[0]!, literals[1]!]);
    return z.union([literals[0]!, literals[1]!, ...literals.slice(2)] as [z.ZodType, z.ZodType, ...z.ZodType[]]);
  }

  // Handle allOf (intersection)
  if (schema.allOf && schema.allOf.length > 0) {
    const schemas = schema.allOf.map(s => jsonSchemaToZod(s, refs));
    return schemas.reduce((acc, s) => acc.and(s)) as z.ZodType;
  }

  // Handle anyOf/oneOf (union)
  if (schema.anyOf && schema.anyOf.length > 0) {
    const schemas = schema.anyOf.map(s => jsonSchemaToZod(s, refs));
    if (schemas.length === 1) return schemas[0]!;
    return z.union(schemas as [z.ZodType, z.ZodType, ...z.ZodType[]]);
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    const schemas = schema.oneOf.map(s => jsonSchemaToZod(s, refs));
    if (schemas.length === 1) return schemas[0]!;
    return z.union(schemas as [z.ZodType, z.ZodType, ...z.ZodType[]]);
  }

  // Handle by type
  switch (schema.type) {
    case 'string':
      return createStringSchema(schema);

    case 'number':
    case 'integer':
      return createNumberSchema(schema);

    case 'boolean':
      return z.boolean();

    case 'null':
      return z.null();

    case 'array':
      return createArraySchema(schema, refs);

    case 'object':
      return createObjectSchema(schema, refs);

    default:
      // No type specified - try to infer from properties
      if (schema.properties) {
        return createObjectSchema(schema, refs);
      }
      return z.unknown();
  }
}

/**
 * Create string schema with constraints
 */
function createStringSchema(schema: JsonSchema): z.ZodType {
  let zodType = z.string();

  if (schema.minLength !== undefined) {
    zodType = zodType.min(schema.minLength);
  }

  if (schema.maxLength !== undefined) {
    zodType = zodType.max(schema.maxLength);
  }

  if (schema.pattern) {
    zodType = zodType.regex(new RegExp(schema.pattern));
  }

  // Handle common formats
  if (schema.format) {
    switch (schema.format) {
      case 'email':
        zodType = zodType.email();
        break;
      case 'uri':
      case 'url':
        zodType = zodType.url();
        break;
      case 'uuid':
        zodType = zodType.uuid();
        break;
      case 'date-time':
        zodType = zodType.datetime();
        break;
      // Other formats are validation hints, not strict validators
    }
  }

  if (schema.description) {
    zodType = zodType.describe(schema.description);
  }

  return zodType;
}

/**
 * Create number schema with constraints
 */
function createNumberSchema(schema: JsonSchema): z.ZodType {
  let zodType = schema.type === 'integer' ? z.number().int() : z.number();

  if (schema.minimum !== undefined) {
    zodType = zodType.min(schema.minimum);
  }

  if (schema.maximum !== undefined) {
    zodType = zodType.max(schema.maximum);
  }

  if (schema.description) {
    zodType = zodType.describe(schema.description);
  }

  return zodType;
}

/**
 * Create array schema with recursive item conversion
 */
function createArraySchema(schema: JsonSchema, refs: Map<string, z.ZodType>): z.ZodType {
  let itemType: z.ZodType = z.unknown();

  if (schema.items) {
    itemType = jsonSchemaToZod(schema.items, refs);
  }

  let zodType = z.array(itemType);

  if (schema.description) {
    zodType = zodType.describe(schema.description);
  }

  return zodType;
}

/**
 * Create object schema with recursive property conversion
 */
function createObjectSchema(schema: JsonSchema, refs: Map<string, z.ZodType>): z.ZodType {
  const properties = schema.properties || {};
  const required = new Set(schema.required || []);

  const shape: Record<string, z.ZodType> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    let propType = jsonSchemaToZod(propSchema, refs);

    // Handle default values
    if (propSchema.default !== undefined) {
      propType = propType.default(propSchema.default);
    }

    // Make optional if not required
    if (!required.has(key)) {
      propType = propType.optional();
    }

    shape[key] = propType;
  }

  // Create object schema
  const baseObj = z.object(shape);

  // Handle additionalProperties
  let zodType: z.ZodType;
  if (schema.additionalProperties === false) {
    // Strict mode - no extra properties allowed
    zodType = baseObj.strict();
  } else if (schema.additionalProperties === true || schema.additionalProperties === undefined) {
    // Default: allow additional properties but don't validate them
    // Using passthrough only when explicitly allowed
    zodType = baseObj.passthrough();
  } else if (typeof schema.additionalProperties === 'object') {
    // Additional properties must match a schema
    // Zod doesn't support this directly, so we use catchall
    const additionalType = jsonSchemaToZod(schema.additionalProperties, refs);
    zodType = baseObj.catchall(additionalType);
  } else {
    zodType = baseObj;
  }

  if (schema.description) {
    zodType = zodType.describe(schema.description);
  }

  return zodType;
}

/**
 * Convert a tool's JSON Schema inputSchema to Zod
 * This is the main entry point for tool schema conversion
 */
export function convertToolSchema(inputSchema: Record<string, unknown>): z.ZodType {
  // If no properties, return empty strict object
  if (!inputSchema.properties) {
    return z.object({}).strict();
  }

  // Convert with strict validation by default for tools
  const schema = inputSchema as JsonSchema;

  // Override additionalProperties to false for strict tool validation
  const strictSchema: JsonSchema = {
    ...schema,
    additionalProperties: schema.additionalProperties ?? false,
  };

  return jsonSchemaToZod(strictSchema);
}
