/**
 * URI Template (RFC 6570) validation and matching
 * Implements MCP resource template URI pattern matching
 */

/**
 * URI Template validation result
 */
export interface UriTemplateValidationResult {
  valid: boolean;
  error?: string;
  parameters: string[];
}

/**
 * URI Template match result
 */
export interface UriTemplateMatch {
  matches: boolean;
  parameters?: Record<string, string>;
}

/**
 * Valid URI schemes for MCP resources
 */
const VALID_URI_SCHEMES = [
  "file",
  "http",
  "https",
  "config",
  "data",
  "resource",
  "mcp",
  "shell",
  "log",
  "memory",
  "vault",
  "stream",
  "asset",
  "git",
  "pkg",
  // Custom schemes
  "cortexdx",
  "diagnostic",
];

/**
 * URI Template validation regex patterns
 * Based on RFC 6570 Level 1 and 2 (most common)
 */
const PATTERNS = {
  // Variable names: alphanumeric, underscore, percent-encoded
  variable: /[A-Za-z0-9_]|%[0-9A-Fa-f]{2}/,

  // Simple string expansion: {var}
  simpleExpansion: /\{([A-Za-z0-9_\.]+)\}/g,

  // Reserved expansion: {+var}
  reservedExpansion: /\{\+([A-Za-z0-9_\.]+)\}/g,

  // Fragment expansion: {#var}
  fragmentExpansion: /\{#([A-Za-z0-9_\.]+)\}/g,

  // Label expansion: {.var}
  labelExpansion: /\{\.([A-Za-z0-9_\.]+)\}/g,

  // Path segment expansion: {/var}
  pathExpansion: /\{\/([A-Za-z0-9_\.]+)\}/g,

  // Path-style parameter: {;var}
  paramExpansion: /\{;([A-Za-z0-9_\.]+)\}(?:=[^&]*)?/g,

  // Form-style query: {?var}
  queryExpansion: /\{\?([A-Za-z0-9_\.]+)\}(?:=[^&]*)?/g,

  // Continuation: {&var}
  continuationExpansion: /\{&([A-Za-z0-9_\.]+)\}(?:=[^&]*)?/g,
};

/**
 * Validate a URI template string
 */
export function validateUriTemplate(
  template: string,
): UriTemplateValidationResult {
  if (!template || typeof template !== "string") {
    return {
      valid: false,
      error: "URI template must be a non-empty string",
      parameters: [],
    };
  }

  // Extract URI scheme
  const schemeMatch = template.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
  if (!schemeMatch) {
    return {
      valid: false,
      error:
        "URI template must include a valid scheme (e.g., file://, config://)",
      parameters: [],
    };
  }

  const scheme = schemeMatch[1].toLowerCase();

  // Validate scheme
  if (!VALID_URI_SCHEMES.includes(scheme)) {
    return {
      valid: false,
      error: `URI scheme '${scheme}' is not supported. Valid schemes: ${VALID_URI_SCHEMES.join(", ")}`,
      parameters: [],
    };
  }

  // Extract all template parameters (counting occurrences)
  const rawMatches = template.match(/\{[A-Za-z0-9_\.]+\}/g) || [];
  const invalidMatches = template.match(/\{[^}]*[^A-Za-z0-9_\.}][^}]*\}/g);

  // Check for invalid characters within braces
  if (invalidMatches) {
    return {
      valid: false,
      error: `Invalid parameter name '${invalidMatches[0]}'. Parameters must contain only alphanumeric characters, dots, hyphens, and underscores`,
      parameters: [],
    };
  }

  const paramCounts = new Map<string, number>();
  for (const match of rawMatches) {
    const name = match.slice(1, -1); // Remove braces
    // Split on dot and add each part
    const parts = name.split(".");
    for (const part of parts) {
      paramCounts.set(part, (paramCounts.get(part) || 0) + 1);
    }
  }

  // Check for duplicate parameters
  for (const [param, count] of paramCounts.entries()) {
    if (count > 1) {
      return {
        valid: false,
        error: `Duplicate parameter '${param}' in URI template`,
        parameters: Array.from(paramCounts.keys()),
      };
    }
  }

  const parameters = Array.from(paramCounts.keys());

  // Validate template syntax
  try {
    // Check for unmatched braces
    const openBraces = (template.match(/\{/g) || []).length;
    const closeBraces = (template.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      return {
        valid: false,
        error: "Unmatched braces in URI template",
        parameters,
      };
    }

    return {
      valid: true,
      parameters,
    };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof Error ? error.message : "Unknown validation error",
      parameters,
    };
  }
}

/**
 * Extract template parameters from a URI template
 */
export function extractTemplateParameters(template: string): string[] {
  const parameters = new Set<string>();

  // Match all expansion patterns
  for (const pattern of Object.values(PATTERNS)) {
    let match;
    const regex = new RegExp(pattern.source, "g");
    while ((match = regex.exec(template)) !== null) {
      if (match[1]) {
        // Split on dot for compound variables like {parent.child}
        const vars = match[1].split(".");
        vars.forEach((v) => parameters.add(v));
      }
    }
  }

  return Array.from(parameters);
}

/**
 * Match a URI against a template and extract parameters
 */
export function matchUriTemplate(
  template: string,
  uri: string,
): UriTemplateMatch {
  const validation = validateUriTemplate(template);
  if (!validation.valid) {
    return { matches: false };
  }

  // Convert template to regex pattern
  const regexPattern = templateToRegex(template);
  const match = uri.match(new RegExp(`^${regexPattern}$`));

  if (!match) {
    return { matches: false };
  }

  // Extract named parameters from the match
  const parameters: Record<string, string> = {};

  if (match.groups) {
    for (const [key, value] of Object.entries(match.groups)) {
      if (value !== undefined) {
        parameters[key] = value;
      }
    }
  }

  return {
    matches: true,
    parameters,
  };
}

/**
 * Convert a URI template to a regex pattern with named groups
 */
function templateToRegex(template: string): string {
  // First, escape dots in static parts (not inside {...})
  let pattern = template.replace(/\.(?![^{}]*})/g, "\\.");

  // Replace template expansions with regex named groups
  // Simple expansion: {var} -> (?<var>[^/]+)
  pattern = pattern.replace(
    /\{([A-Za-z0-9_\.]+)\}/g,
    (_, name) => `(?<name_${name.replace(/\./g, "_")}>[^/]+)`,
  );

  // Reserved expansion: {+var} -> (?<var>[^/?#]+)
  pattern = pattern.replace(
    /\{\+([A-Za-z0-9_\.]+)\}/g,
    (_, name) => `(?<reserved_${name.replace(/\./g, "_")}>[^/?#]+)`,
  );

  // Path expansion: {/var} -> /(?<var>[^/?#]+)
  pattern = pattern.replace(/\{\/([A-Za-z0-9_\.]+)\}/g, "/(?<path_$1>[^/?#]+)");

  // Query expansion: {?var} -> (?<var>.*)
  pattern = pattern.replace(
    /\{\?([A-Za-z0-9_\.]+)\}/g,
    (_, name) => `(?:\\?(?<query_${name.replace(/\./g, "_")}>[^#]*))?`,
  );

  return pattern;
}

/**
 * Check if a URI matches any of the given templates
 */
export function matchesAnyTemplate(
  uri: string,
  templates: string[],
): {
  matches: boolean;
  template?: string;
  parameters?: Record<string, string>;
} {
  for (const template of templates) {
    const result = matchUriTemplate(template, uri);
    if (result.matches) {
      return {
        matches: true,
        template,
        parameters: result.parameters,
      };
    }
  }

  return { matches: false };
}

/**
 * Build a URI from a template and parameters
 */
export function buildUriFromTemplate(
  template: string,
  parameters: Record<string, string>,
): string {
  let uri = template;

  // Replace simple expansions: {var}
  uri = uri.replace(/\{([A-Za-z0-9_\.]+)\}/g, (_, name) => {
    const keys = name.split(".");
    let value: string | undefined = parameters;
    for (const key of keys) {
      value = value && typeof value === "object" ? value[key] : undefined;
    }
    return value || "";
  });

  // Replace path expansions: {/var}
  uri = uri.replace(/\{\/([A-Za-z0-9_\.]+)\}/g, (_, name) => {
    const value = parameters[name];
    // Don't add leading slash if template already has one
    return value ? value : "";
  });

  // Replace query expansions: {?var}
  uri = uri.replace(/\{\?([A-Za-z0-9_\.]+)\}/g, (_, name) => {
    const value = parameters[name];
    return value ? `?${name}=${encodeURIComponent(value)}` : "";
  });

  return uri;
}
