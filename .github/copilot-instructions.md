# CortexDx — AI Coding Agent Instructions

## Project Overview

CortexDx is a stateless, **plugin-first diagnostic meta-inspector** for Model Context Protocol (MCP) servers. Think of it as a comprehensive testing framework specifically designed for MCP implementations, providing security, performance, and compliance analysis.

### Core Architecture Principles

- **Stateless & Read-Only**: Never mutates target MCP servers - all diagnostics are passive
- **Sandboxed Plugin System**: Plugins run in worker threads with resource budgets (CPU/memory/time)
- **Evidence-Based Findings**: Every diagnostic result includes verifiable evidence pointers
- **ArcTDD Methodology**: Red → Green → Refactor in ≤7 steps (tests before code)

### Monorepo Structure (pnpm + Nx)
This is a **pnpm workspace** orchestrated by **Nx 19.8.4**:
- `packages/cortexdx/` - Main diagnostic engine (TypeScript ESM)
- `packages/mcp/` - MCP protocol implementations
- `packages/insula-mcp/` - MCP server utilities
- Always use `nx run <project>:<target>` for builds/tests (never direct tooling)
- Nx cloud is disabled (`NX_CLOUD=false`) for all workspace scripts

## Essential Development Workflow

### Setup & Dependencies
```bash
mise install && pnpm install    # Install pinned Node/pnpm versions
pnpm lint && pnpm test && pnpm build    # Required before any commit
```

### Critical Commands (Follow This Order)
1. **`mise install`** - Ensures Node.js 20.11.1 and pnpm 9.12.2
2. **`pnpm install`** - Install workspace dependencies (never use npm/yarn)
3. **`pnpm lint`** - Biome lint (zero warnings required for merge)
4. **`pnpm test`** - Vitest suite (includes build dependency)
5. **`pnpm build`** - tsup bundle verification (builds `packages/cortexdx`)

### Integration Testing (Opt-in)
```bash
pnpm test:integration    # Sets CORTEXDX_RUN_INTEGRATION=1 for long-running suites
```

### Important Workspace Scripts
```bash
pnpm self:diagnose              # Run CortexDx against itself (uses .env.self)
pnpm research:smoke             # Academic provider smoke tests
pnpm deepcontext:status         # Check DeepContext semantic index status
pnpm sbom                       # Generate SBOM artifacts (CycloneDX/SPDX)
pnpm internal:self-improvement  # Self-diagnostic with LLM analysis
pnpm governance:validate        # Validate .cortex governance packs
```

## Plugin Development Patterns

### Plugin Structure (Always Follow)
```typescript
// packages/cortexdx/src/plugins/my-plugin.ts
export const myPlugin: DiagnosticPlugin = {
  id: 'unique-plugin-id',
  title: 'Human Readable Name',
  order: 100,  // Execution order
  
  async run(ctx: DiagnosticContext): Promise<Finding[]> {
    // CRITICAL: Always include evidence pointers
    return [{
      id: 'finding-id',
      area: 'protocol|security|performance|governance',
      severity: 'info|minor|major|blocker',
      title: 'Finding Title',
      description: 'Detailed description',
      evidence: [{ type: 'url|file|log', ref: 'evidence-reference' }],
      confidence: 0.0-1.0
    }];
  }
};
```

### Sandbox Requirements
- Plugins MUST work in worker threads (see `src/workers/sandbox.ts`)
- No direct filesystem access - use `ctx.request()`, `ctx.jsonrpc()`, `ctx.sseProbe()`
- Respect budgets: memory (32MB+), time (default), CPU limits

## Code Style Requirements

### Function & Export Rules
- **Named exports only** - No `export default` anywhere
- **≤40 lines per function** - Split larger functions into helpers
- **No `any` types** - Use explicit types or type guards
- **ESM imports MUST include `.js` extension** - `from "./foo.js"` not `from "./foo"`

### File Organization
```
packages/cortexdx/src/
├── plugins/           # Diagnostic plugins
├── adapters/          # Protocol adapters (HTTP, SSE, gRPC)
├── report/            # Report generators (markdown, JSON, ArcTDD)
├── workers/           # Sandbox worker implementations
├── context/           # Context factories and sessions
├── ml/                # LLM integration (Ollama router)
├── orchestration/     # LangGraph workflow definitions
├── self-healing/      # Self-improvement workflows
├── providers/         # Academic research providers (Context7, Exa, etc.)
├── storage/           # SQLite persistence (patterns, conversations, reports)
└── types.ts           # Core type definitions
```

## MCP Protocol Integration

### Context Helpers (Use These)
```typescript
// In plugin implementations
const response = await ctx.request('/mcp-endpoint');  // HTTP requests
const rpcResult = await ctx.jsonrpc('method', params);  // JSON-RPC calls
const sseResult = await ctx.sseProbe('/sse-endpoint');  // SSE testing
ctx.evidence({ type: 'url', ref: ctx.endpoint });      // Log evidence
```

### Session Management
- Plugins share MCP sessions via `SharedSessionState`
- Session initialization happens once per diagnostic run
- **CRITICAL**: Always include `MCP-Session-ID` header in all JSON-RPC requests
- Use `ctx.transport?.transcript()` for transport-level findings
- FastMCP requires session ID before any RPC calls (including `initialize`)

### MCP Session Lifecycle
1. Generate session ID: `cortexdx-<timestamp>` or UUID
2. Send with first `initialize` call via `MCP-Session-ID` header
3. Reuse same session ID for all subsequent requests (`rpc.ping`, `tools/list`, etc.)
4. Include session ID in SSE probes (`/events?mcp-session-id=...`)
5. See `src/context/inspector-session.ts` for reference implementation

## Testing Conventions

### Vitest Patterns
```typescript
// tests/my-feature.spec.ts
import { describe, expect, it, vi } from 'vitest';

describe('Feature Name', () => {
  it('should handle specific case', () => {
    expect(actualResult).toEqual(expectedResult);
  });
});
```

### Mock Patterns for MCP Testing
```typescript
// Use mock servers from scripts/mock-servers/
const mockCtx = createDiagnosticContext({
  endpoint: 'http://localhost:mock-port',
  deterministic: true
});
```

## Environment & Configuration

### Required Environment Variables
```bash
# Core operation
CORTEXDX_ADMIN_TOKEN=your-admin-token
PORT=5001

# Academic providers (optional)
CONTEXT7_API_KEY=key CONTEXT7_API_BASE_URL=url
EXA_API_KEY=key OPENALEX_CONTACT_EMAIL=email

# LLM integration
LLM_PROVIDER=ollama OLLAMA_BASE_URL=http://localhost:11434
```

### Development vs Cloud Configuration
- **Local**: Use `.env` with local Ollama
- **Cloud**: Use `.env.cloud` with cloud LLM providers via `op run --env-file=.env.cloud`

## Integration Points

### Academic Research System
- **Registry**: `src/registry/providers/academic.ts` - Provider registration
- **Researcher**: `src/research/academic-researcher.ts` - Execution engine
- **Providers**: `src/providers/academic/` - Individual provider implementations
- **Supported**: Context7, Vibe Check, OpenAlex, Exa, Wikidata, arXiv
- **Preview-only**: Semantic Scholar (exclude from production flows)

### Self-Healing Workflows
- **LangGraph Integration**: `src/self-healing/graph.ts` - Workflow definitions
- **State Management**: Uses SQLite checkpoints (`CORTEXDX_STATE_DB`)
- **Orchestration**: `src/commands/orchestrate.ts` - CLI entry point
- **Deterministic**: Seeds LLM adapter for reproducible conversations

### Monitoring & Observability
- **Health Checks**: `src/commands/health.ts` - System health monitoring
- **SBOM Generation**: `src/commands/sbom.ts` - Dependency tracking
- **Report Manager**: `src/storage/report-manager.ts` - Report aggregation
- **OpenTelemetry**: Full OTEL integration with Shinzo Labs instrumentation

### DeepContext Semantic Search
- **Tool**: Wildcard's DeepContext MCP server for semantic code intelligence
- **Index Command**: `cortexdx deepcontext index <codebase>`
- **Search Command**: `cortexdx deepcontext search <codebase> "query"`
- **Status Command**: `cortexdx deepcontext status` (reads cached snapshots)
- **Auto-Integration**: Self-improvement plugins automatically use DeepContext
- **Storage**: `.codex-context/` for semantic index, `.cortexdx/deepcontext-status.json` for cache

## Security & Compliance

### Secret Handling
- Never hardcode secrets - use environment variables or 1Password CLI
- HAR files automatically redact `authorization`, `cookie`, `token` headers
- Use `CORTEXDX_DISABLE_LLM=1` for air-gapped environments
- All secrets managed via `op run --env-file=.env -- <command>`
- **NEVER** duplicate secrets from `.env` into GitHub secrets

### Governance Integration
- `.cortex` packs drive policy checks via `src/adapters/cel-rules.ts`
- All changes must respect `/.cortexdx/rules/vision.md`
- Evidence pointers required for audit trails

### Security Tooling
- **Semgrep**: `pnpm security:semgrep` - MCP-focused rules
- **Gitleaks**: `pnpm security:gitleaks` - Secret scanning
- **OWASP ZAP**: `pnpm security:zap <endpoint>` - Dynamic scanning
- All emit JSON summaries with deterministic exit codes for CI

## Debugging & Troubleshooting

### Common Issues
- **Plugin Sandbox Failures**: Check `src/workers/sandbox.ts` for worker thread compatibility
- **MCP Session Issues**: Verify `src/context/inspector-session.ts` initialization
- **Build Failures**: Ensure all imports use `.js` extensions for ESM compatibility

### Logging
```typescript
ctx.logger('Debug message', data);  // In plugins
process.env.CORTEXDX_LOG_LEVEL = 'debug';  // Enable verbose logging
```

---

**Key Files to Understand:**
- `AGENTS.md` - Authoritative development rules
- `packages/cortexdx/src/plugin-host.ts` - Plugin orchestration
- `packages/cortexdx/src/types.ts` - Core type definitions
- `.cortexdx/rules/vision.md` - Project vision and constraints
