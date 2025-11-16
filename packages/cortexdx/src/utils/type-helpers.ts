/**
 * Type-safe helper functions to eliminate unsafe type casts
 *
 * These helpers provide safe alternatives to `as unknown as` patterns,
 * maintaining type safety while allowing necessary conversions.
 */

import type { ConversationSession, Finding } from "../types.js";

/**
 * Safely cast session state to a specific type
 * Validates that the state is an object before casting
 */
export function getSessionState<T extends Record<string, unknown>>(
  session: ConversationSession
): T {
  if (typeof session.state !== "object" || session.state === null) {
    throw new Error(
      `Invalid session state: expected object, got ${typeof session.state}`
    );
  }
  return session.state as T;
}

/**
 * Safely convert an object to Record<string, unknown>
 * Used for API boundaries that require this type
 */
export function toRecord<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  if (typeof obj !== "object" || obj === null) {
    throw new Error(`Cannot convert ${typeof obj} to Record`);
  }
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, value])
  );
}

/**
 * Safely access a field from a Finding object
 * Returns undefined if field doesn't exist
 */
export function getFindingField(
  finding: Finding,
  fieldName: string
): unknown {
  const findingAsRecord = finding as Record<string, unknown>;
  return findingAsRecord[fieldName];
}

/**
 * Extract field values from multiple findings
 * Filters out undefined values
 */
export function extractFindingFields(
  findings: Finding[],
  fieldName: string
): unknown[] {
  return findings
    .map((f) => getFindingField(f, fieldName))
    .filter((v) => v !== undefined);
}

/**
 * Safely convert from Record<string, unknown> back to a typed object
 * Performs basic validation that required keys exist
 */
export function fromRecord<T extends Record<string, unknown>>(
  record: Record<string, unknown>,
  requiredKeys?: (keyof T)[]
): T {
  if (requiredKeys) {
    for (const key of requiredKeys) {
      if (!(key in record)) {
        throw new Error(`Missing required key: ${String(key)}`);
      }
    }
  }
  return record as T;
}

/**
 * Type guard to check if an object has a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === "object" && obj !== null && key in obj;
}

/**
 * Safely access a nested property using a path
 * Returns undefined if any part of the path doesn't exist
 */
export function getNestedProperty(
  obj: Record<string, unknown>,
  path: string[]
): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!hasProperty(current, key)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}
