/**
 * Server Configuration
 * Centralized configuration constants for the CortexDx server
 */

import { fileURLToPath } from "node:url";
import { join } from "node:path";

// Server address configuration
export const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 5001;
export const HOST = process.env.HOST || "127.0.0.1";

// TLS configuration
export const TLS_CERT_PATH = process.env.CORTEXDX_TLS_CERT_PATH;
export const TLS_KEY_PATH = process.env.CORTEXDX_TLS_KEY_PATH;

// Admin configuration
export const ADMIN_TOOL_TOKEN = process.env.CORTEXDX_ADMIN_TOKEN?.trim();

// Restricted tools that require admin access
export const RESTRICTED_TOOLS = new Set([
  "wikidata_sparql",
  "cortexdx_delete_workflow",
]);

// Auth0 configuration
export const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "";
export const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || "";
export const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || "";
export const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true";

// License configuration
export const REQUIRE_LICENSE = process.env.REQUIRE_LICENSE === "true";
export const DEFAULT_TIER =
  (process.env.DEFAULT_TIER as "community" | "professional" | "enterprise") ||
  "community";

// MIME types for static file serving
export const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

// File paths
// Note: __dirname calculation moved to server.ts to avoid import.meta issues
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = join(__filename, "../..");
