# Modular MCP Server Template - Updated with Monorepo Best Practices

A portable template for building Model Context Protocol (MCP) servers with a **modular monorepo architecture** that conforms to the Release Candidate (RC) specification (2025-06-18+).

📖 **[View Glossary](../../docs/GLOSSARY.md)** for definitions of abbreviations and technical terms.

---

## 🆕 What's New in This Version

This template has been updated based on lessons learned from refactoring a large MCP server into a modular monorepo structure. Key improvements include:

- **Package Split Strategy**: Guidelines for splitting monolithic servers into focused packages
- **ESM Import Best Practices**: Proper handling of `.js` extensions for workspace vs local imports
- **Circular Dependency Resolution**: Strategies for breaking circular dependencies
- **Subpath Exports**: Proper configuration for package subpath exports
- **Build Tooling**: Optimized `tsup` configuration for monorepo packages

---

## Table of Contents

- [Overview](#overview)
- [Monorepo Architecture](#monorepo-architecture) **NEW**
- [Package Structure](#package-structure) **NEW**
- [Dependencies](#dependencies)
- [Core Modules](#core-modules)
- [Transport Layer](#transport-layer)
- [Plugin System](#plugin-system)
- [Lessons Learned](#lessons-learned) **NEW**
- [Migration Guide](#migration-guide) **NEW**
- [Usage Examples](#usage-examples)
- [RC Compliance Checklist](#rc-compliance-checklist)

---

## Overview

This template provides a **modular, production-ready MCP server implementation** that:

- Conforms to MCP RC specification 2025-06-18 + Draft
- Supports multiple transports: **HTTP Streamable**, **STDIO**, and **WebSocket**
- Features a formal **plugin system** for authentication, CORS, and rate limiting
- Includes **full JSON-RPC 2.0** compliance
- Provides **type-safe schema conversion** from JSON Schema to Zod
- **Scales to monorepo architecture** for large projects

---

## Monorepo Architecture

### Why Split Your MCP Server?

As your MCP server grows, you may want to split it into multiple packages for:

1. **Separation of Concerns**: Core utilities, ML adapters, plugins, and server logic in separate packages
2. **Reusability**: Share core utilities across multiple projects
3. **Build Performance**: Only rebuild changed packages
4. **Team Collaboration**: Different teams can own different packages
5. **Dependency Management**: Clear dependency hierarchy prevents circular dependencies

### Recommended Package Structure

```
packages/
├── core/                    # Core utilities and types
│   ├── src/
│   │   ├── types/          # Shared TypeScript types
│   │   ├── utils/          # Utility functions
│   │   ├── logging/        # Logging infrastructure
│   │   ├── di/             # Dependency injection
│   │   └── config/         # Configuration management
│   ├── package.json
│   └── tsup.config.ts
│
├── ml/                      # ML/AI adapters (if applicable)
│   ├── src/
│   │   ├── adapters/       # LLM adapters (Ollama, OpenAI, etc.)
│   │   ├── ml/             # ML utilities and routing
│   │   └── index.ts
│   ├── package.json
│   └── tsup.config.ts
│
├── plugins/                 # Plugin system
│   ├── src/
│   │   ├── plugin-host.ts  # Plugin host/runner
│   │   ├── plugins/        # Individual plugins
│   │   ├── providers/      # External service providers
│   │   ├── registry/       # Plugin registry
│   │   └── index.ts
│   ├── package.json
│   └── tsup.config.ts
│
├── server/                  # MCP server implementation
│   ├── src/
│   │   ├── mcp-server/     # Core MCP server (this template)
│   │   ├── orchestration/  # Workflow orchestration
│   │   └── index.ts
│   ├── package.json
│   └── tsup.config.ts
│
└── main/                    # Main application (optional)
    ├── src/
    │   ├── cli.ts          # CLI entry point
    │   └── index.ts
    ├── package.json
    └── tsup.config.ts
```

### Package Dependency Hierarchy

```
@your-org/core (no dependencies)
    ↓
@your-org/ml (depends on: core)
    ↓
@your-org/plugins (depends on: core, ml)
    ↓
@your-org/server (depends on: core, ml, plugins)
    ↓
@your-org/main (depends on: all above)
```

**Key Principle**: Dependencies should flow in one direction only. Never create circular dependencies.

---

## Package Structure

### Core Package (`@your-org/core`)

```json
{
  "name": "@your-org/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./utils/*": "./dist/utils/*.js",
    "./logging/*": "./dist/logging/*.js",
    "./config/*": "./dist/config/*.js",
    "./di/*": "./dist/di/*.js"
  },
  "scripts": {
    "build": "tsup",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "zod": "^3.22.4",
    "pino": "^10.1.0"
  }
}
```

**tsup.config.ts for Core:**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/config/index.ts",
    "src/di/index.ts",
    "src/logging/index.ts",
    "src/utils/index.ts",
    "src/utils/deterministic.ts",
    "src/utils/json.ts",
    "src/utils/lru-cache.ts",
    "src/utils/type-helpers.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
});
```

**Core Package Index (`src/index.ts`):**

```typescript
// Export all core types and utilities
export * from "./types/index.js";
export * from "./utils/index.js";
export * from "./logging/index.js";
export * from "./di/index.js";
export * from "./config/index.js";
```

### Server Package (`@your-org/server`)

```json
{
  "name": "@your-org/server",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./orchestration": "./dist/orchestration/index.js"
  },
  "scripts": {
    "build": "tsup",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "@your-org/core": "workspace:*",
    "@your-org/ml": "workspace:*",
    "@your-org/plugins": "workspace:*",
    "fastmcp": "^3.23.1",
    "@modelcontextprotocol/sdk": "^1.22.0",
    "zod": "^3.22.4",
    "@langchain/core": "^0.3.0",
    "@langchain/langgraph": "^0.2.0",
    "better-sqlite3": "^12.4.1"
  },
  "devDependencies": {
    "@types/node": "^22.19.1",
    "@types/better-sqlite3": "^7.6.11",
    "tsup": "^8.1.0",
    "typescript": "^5.6.3"
  }
}
```

---

## Lessons Learned

### 1. ESM Import Extensions

**The Rule:**
- **Workspace packages**: NO `.js` extension
- **Local relative imports**: YES `.js` extension required

```typescript
// ✅ CORRECT: Workspace package import (no .js)
import { something } from "@your-org/core";
import { util } from "@your-org/core/utils/json";

// ✅ CORRECT: Local relative import (with .js)
import { helper } from "./helpers.js";
import { type } from "../types.js";

// ❌ WRONG: Workspace package with .js
import { something } from "@your-org/core.js";

// ❌ WRONG: Local import without .js
import { helper } from "./helpers";
```

**Why?** TypeScript resolves workspace packages through `tsconfig.json` paths, but Node.js ESM requires explicit `.js` extensions for local file imports.

### 2. Subpath Exports Configuration

**package.json exports must include .js extensions:**

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./utils/*": "./dist/utils/*.js",  // ✅ Include .js
    "./logging": "./dist/logging/index.js"
  }
}
```

**tsup.config.ts must include all subpath entry points:**

```typescript
export default defineConfig({
  entry: [
    "src/index.ts",
    "src/utils/json.ts",      // For @your-org/core/utils/json
    "src/utils/lru-cache.ts", // For @your-org/core/utils/lru-cache
    "src/logging/index.ts",   // For @your-org/core/logging
  ],
  // ...
});
```

**Why?** Without explicit entry points, `tsup` won't generate `.d.ts` files for subpaths, causing TypeScript errors.

### 3. Circular Dependency Resolution

**Problem:** Package A depends on Package B, and Package B depends on Package A.

**Solution Strategies:**

1. **Move Shared Code Up**: Extract shared code into a lower-level package
2. **Move Module to Different Package**: Relocate modules to break the cycle
3. **Use Dependency Injection**: Pass dependencies at runtime instead of import time

**Example from CortexDx refactoring:**

```
Before (circular):
ML Package ←→ Plugins Package

After (hierarchical):
ML Package → Core Package
Plugins Package → ML Package → Core Package
Server Package → Plugins Package → ML Package → Core Package
```

**How we fixed it:** Moved the `orchestration` module from `ml` package to `server` package, breaking the circular dependency.

### 4. Automated Import Fixing

Create scripts to bulk-fix imports across your codebase:

```javascript
// fix-imports.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, 'packages/your-package/src');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.ts')) {
      arrayOfFiles.push(fullPath);
    }
  });
  
  return arrayOfFiles;
}

const files = getAllFiles(rootDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;

  // Remove .js from workspace package imports
  content = content.replace(
    /from "@your-org\/([^"]+)\.js"/g,
    'from "@your-org/$1"'
  );

  // Add .js to local relative imports
  content = content.replace(
    /from "(\.\.?\/[^"]+)"/g,
    (match, p1) => {
      if (p1.endsWith('.js')) return match;
      return `from "${p1}.js"`;
    }
  );

  if (content !== originalContent) {
    console.log(`Fixing imports in ${file}`);
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log('Finished fixing imports.');
```

### 5. Package Build Order

**Always build in dependency order:**

```bash
# Build core first (no dependencies)
cd packages/core && pnpm build

# Then ML (depends on core)
cd packages/ml && pnpm build

# Then plugins (depends on core, ml)
cd packages/plugins && pnpm build

# Finally server (depends on all)
cd packages/server && pnpm build
```

**Or use pnpm's built-in topological sorting:**

```bash
# Build all packages in correct order
pnpm -r build
```

### 6. TypeScript Configuration

**Root tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  }
}
```

**Package tsconfig.json:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@your-org/core": ["../core/src"],
      "@your-org/core/*": ["../core/src/*"]
    }
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../core" }
  ]
}
```

### 7. Common Pitfalls to Avoid

❌ **Don't** mix CommonJS and ESM in the same package
❌ **Don't** use `index.js` imports without explicit file extensions
❌ **Don't** create circular dependencies between packages
❌ **Don't** forget to add subpath entry points to tsup config
❌ **Don't** use `.js` extensions in workspace package imports

✅ **Do** use consistent `"type": "module"` across all packages
✅ **Do** add `.js` extensions to all local relative imports
✅ **Do** maintain a clear dependency hierarchy
✅ **Do** export all subpaths explicitly in package.json
✅ **Do** use workspace protocol (`workspace:*`) for internal dependencies

---

## Migration Guide

### Migrating from Monolithic to Modular Architecture

**Step 1: Plan Your Package Split**

Identify logical boundaries in your codebase:
- Core utilities and types
- ML/AI adapters
- Plugin system
- Server implementation
- CLI/main application

**Step 2: Create Package Structure**

```bash
mkdir -p packages/{core,ml,plugins,server}/src
```

**Step 3: Move Code to Packages**

Start with the lowest-level package (core) and work your way up:

1. Move core types and utilities to `packages/core/src`
2. Move ML adapters to `packages/ml/src`
3. Move plugins to `packages/plugins/src`
4. Move server code to `packages/server/src`

**Step 4: Update Imports**

Use the automated import fixing script (see Lesson #4 above) to update all imports.

**Step 5: Configure Package Exports**

For each package, configure:
- `package.json` exports with `.js` extensions
- `tsup.config.ts` entry points for all subpaths
- `tsconfig.json` with proper paths and references

**Step 6: Build and Test**

```bash
# Install dependencies
pnpm install

# Build in order
pnpm -r build

# Run tests
pnpm -r test
```

**Step 7: Verify No Circular Dependencies**

```bash
# Check for circular dependencies
pnpm list --depth=Infinity | grep -i "circular"
```

---

## Core Modules

### 1. Protocol Compliance (`core/protocol.ts`)

```typescript
// Protocol versions
export const PROTOCOL_VERSIONS = {
  LEGACY: '2024-11-05',
  CURRENT: '2025-06-18',
  DRAFT: '2025-11-25',
} as const;

export type ProtocolVersion = typeof PROTOCOL_VERSIONS[keyof typeof PROTOCOL_VERSIONS];

// Default version
export const DEFAULT_PROTOCOL_VERSION = PROTOCOL_VERSIONS.CURRENT;

// Server capabilities
export interface ServerCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: Record<string, never>;
  experimental?: Record<string, unknown>;
}

// Initialize response
export interface InitializeResponse {
  protocolVersion: ProtocolVersion;
  capabilities: ServerCapabilities;
  serverInfo: { name: string; version: string };
}

// Protocol validation
export function validateNotBatch(request: unknown): void {
  if (Array.isArray(request)) {
    throw new Error('JSON-RPC batching not supported');
  }
}
```

### 2. Error Codes (`core/errors.ts`)

```typescript
// Standard JSON-RPC errors
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// Custom MCP errors
export const MCP_ERRORS = {
  ACCESS_DENIED: -32001,
  AUTH_REQUIRED: -32002,
  LICENSE_REQUIRED: -32010,
  RATE_LIMITED: -32020,
  TOOL_NOT_FOUND: -32030,
  TOOL_EXECUTION_ERROR: -32032,
  RESOURCE_NOT_FOUND: -32040,
  PROTOCOL_VERSION_MISMATCH: -32050,
} as const;

// Error class
export class McpError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
  }
}

// Tool execution errors (SEP-1303)
export function createToolExecutionError(message: string, details?: unknown): McpError {
  return new McpError(MCP_ERRORS.TOOL_EXECUTION_ERROR, message, details);
}
```

### 3. Schema Converter (`core/schema-converter.ts`)

```typescript
import { z } from 'zod';

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JsonSchema;
}

// Recursive JSON Schema to Zod conversion
export function jsonSchemaToZod(schema: JsonSchema): z.ZodType {
  // Handle enum
  if (schema.enum?.length) {
    return z.enum(schema.enum as [string, ...string[]]);
  }

  switch (schema.type) {
    case 'string': {
      let s = z.string();
      if (schema.minLength) s = s.min(schema.minLength);
      if (schema.maxLength) s = s.max(schema.maxLength);
      if (schema.pattern) s = s.regex(new RegExp(schema.pattern));
      return s;
    }

    case 'number':
    case 'integer': {
      let n = schema.type === 'integer' ? z.number().int() : z.number();
      if (schema.minimum) n = n.min(schema.minimum);
      if (schema.maximum) n = n.max(schema.maximum);
      return n;
    }

    case 'boolean':
      return z.boolean();

    case 'array':
      return z.array(schema.items ? jsonSchemaToZod(schema.items) : z.unknown());

    case 'object': {
      const shape: Record<string, z.ZodType> = {};
      const required = new Set(schema.required || []);

      for (const [key, prop] of Object.entries(schema.properties || {})) {
        let propType = jsonSchemaToZod(prop);
        if (!required.has(key)) propType = propType.optional();
        shape[key] = propType;
      }

      const obj = z.object(shape);
      return schema.additionalProperties === false ? obj.strict() : obj.passthrough();
    }

    default:
      return z.unknown();
  }
}

// Convert tool schema with strict validation
export function convertToolSchema(inputSchema: Record<string, unknown>): z.ZodType {
  if (!inputSchema.properties) return z.object({}).strict();
  return jsonSchemaToZod({
    ...(inputSchema as JsonSchema),
    additionalProperties: false,
  });
}
```

---

## Quick Start Checklist

### For New Projects

- [ ] Choose monorepo structure if project will grow beyond 10k LOC
- [ ] Set up workspace with pnpm/yarn/npm workspaces
- [ ] Create core package first with types and utilities
- [ ] Add additional packages as needed (ml, plugins, server)
- [ ] Configure tsup with explicit entry points for subpaths
- [ ] Add `.js` extensions to package.json exports
- [ ] Use workspace protocol for internal dependencies
- [ ] Set up automated import fixing scripts
- [ ] Verify no circular dependencies
- [ ] Document package dependency hierarchy

### For Existing Projects

- [ ] Audit codebase for logical boundaries
- [ ] Create migration plan with package split strategy
- [ ] Start with core package extraction
- [ ] Move code incrementally, testing at each step
- [ ] Run automated import fixing scripts
- [ ] Update all package.json files with proper exports
- [ ] Configure tsup for all packages
- [ ] Verify builds in dependency order
- [ ] Check for and resolve circular dependencies
- [ ] Update documentation

---

## Best Practices Summary

### Package Design
✅ Keep packages focused on single responsibility
✅ Maintain clear dependency hierarchy (no cycles)
✅ Export public API through index.ts
✅ Use subpath exports for internal modules
✅ Version packages independently when needed

### Import Management
✅ No `.js` for workspace packages
✅ Always `.js` for local relative imports
✅ Use `workspace:*` for internal dependencies
✅ Automate import fixing with scripts

### Build Configuration
✅ Explicit entry points in tsup config
✅ Include `.js` in package.json exports
✅ Build in dependency order
✅ Use `pnpm -r build` for topological builds

### Type Safety
✅ Enable strict TypeScript mode
✅ Use composite projects for monorepos
✅ Generate declaration maps
✅ Validate schemas with Zod

---

## Additional Resources

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [tsup Documentation](https://tsup.egoist.dev/)
- [Node.js ESM](https://nodejs.org/api/esm.html)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

---

## Support

For questions or issues:
1. Check the [Lessons Learned](#lessons-learned) section
2. Review the [Migration Guide](#migration-guide)
3. Consult the [Best Practices Summary](#best-practices-summary)
4. Open an issue in your project repository

---

**Last Updated**: 2025-11-19
**Template Version**: 2.0.0 (Monorepo Edition)
