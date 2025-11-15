# @cortex-os/mcp-docs-adapter

Offline MCP documentation knowledge pack with SQLite FTS search.

## Overview

The MCP Docs Adapter provides offline access to Model Context Protocol (MCP) documentation through a searchable SQLite database. It replaces hardcoded documentation URLs with dynamic lookups from an indexed knowledge base.

## Features

- **Offline-first**: All documentation indexed locally
- **Fast search**: SQLite FTS5 full-text search
- **Deterministic**: Same input → same output
- **Version-aware**: Support for multiple spec versions
- **Evidence-based**: Returns canonical URLs + anchors for citations

## Installation

```bash
# Install dependencies
pnpm install

# Build the adapter
pnpm build

# Index MCP documentation (requires network)
pnpm docs:mcp:index
```

## Usage

### As an MCP Tool Provider

```typescript
import { createMcpDocsAdapter } from "@cortex-os/mcp-docs-adapter";

const adapter = await createMcpDocsAdapter();

// Search documentation
const results = await adapter.search({
  query: "handshake",
  topK: 5,
});

// Lookup specific chunk
const chunk = await adapter.lookup({ id: "intro-chunk-0" });

// Get version info
const version = await adapter.version();
```

### Integration with CortexDx

The adapter is automatically integrated via the `mcp-docs` plugin:

```typescript
import { McpDocsPlugin } from "@brainwav/cortexdx/plugins/mcp-docs";

// Plugin auto-loads adapter and provides diagnostics
```

### Replacing Hardcoded URLs

The `field-error-reporter` adapter now uses the knowledge pack:

```typescript
import { FieldErrorReporter } from "@brainwav/cortexdx/adapters/field-error-reporter";

// Initialize doc URL cache at startup
await FieldErrorReporter.initializeDocUrlCache();

// Error reports now use offline docs when available
```

## Scripts

- `pnpm docs:mcp:index` - Index documentation (requires network)
- `pnpm docs:mcp:index:dry-run` - Test indexing without writing
- `pnpm build` - Build TypeScript
- `pnpm test` - Run tests
- `pnpm test:watch` - Watch mode

## Architecture

```
data/knowledge/mcp-docs/v2025-06-18/
├── manifest.json       # Provenance & metadata
├── pages.jsonl        # Chunked documentation
└── mcp-docs.sqlite    # SQLite FTS database

tools/mcp/
└── docs-index.ts      # Indexer script

packages/mcp/mcp-docs-adapter/
├── src/
│   ├── contracts.ts   # Zod schemas
│   ├── lib/store.ts   # SQLite wrapper
│   └── server.ts      # MCP adapter
└── __tests__/         # Unit tests
```

## MCP Tools

### `mcp_docs.search`

Search documentation with a query string.

**Input:**
- `query` (string, min 2 chars)
- `topK` (number, 1-20, default 5)
- `version` (string, optional)

**Output:**
- `version` (string)
- `tookMs` (number)
- `hits` (array of passages with id, url, title, score, text, anchor)

### `mcp_docs.lookup`

Get full documentation chunk by ID.

**Input:**
- `id` (string, required)

**Output:**
- `id`, `url`, `title`, `text`, `outline` (array of headings)

### `mcp_docs.version`

Get version info and available snapshots.

**Output:**
- `active` (string)
- `available` (array)
- `commit` (string)

## Updating Documentation

To update the indexed documentation:

1. Fetch latest pages: `pnpm docs:mcp:index`
2. Review changes in `data/knowledge/mcp-docs/v2025-06-18/manifest.json`
3. Run tests: `pnpm test`
4. Commit the new snapshot

## Configuration

Set environment variables:

- `MCP_DOCS_VERSION` - Active version (default: `v2025-06-18`)
- `MCP_DOCS_DRY_RUN` - Skip writing (default: `false`)
- `GIT_SHA` - Commit SHA for provenance

## Testing

```bash
# Run unit tests
pnpm test

# With coverage
pnpm test -- --coverage

# Watch mode
pnpm test:watch
```

## License

Apache-2.0
