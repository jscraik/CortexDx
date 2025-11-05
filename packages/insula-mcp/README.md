# Insula MCP — Diagnostic Meta-Inspector (starter)

Stateless, plugin-based diagnostics for MCP servers/connectors. Outputs **Markdown + JSON** findings, an **ArcTDD** plan, and an optional **File Plan** (diffs).

This workspace is managed with **pnpm**, **Nx**, **Biome**, and **Mise** for consistent tooling.

## QuickStart

```bash
mise install                  # installs Node/pnpm versions declared in .mise.toml
pnpm install
pnpm build                    # Nx → insula-mcp:build
npx insula-mcp diagnose https://mcp.example.com --out reports
```

Flags: `--full`, `--suites streaming,governance`, `--file-plan`, `--deterministic`, `--otel-exporter <url>`, `--har`, `--compare old.json new.json`, `--a11y`, `--no-color`.

### Useful commands
- `pnpm build` — runs `nx run insula-mcp:build` (tsup bundle).
- `pnpm test` — runs `nx run insula-mcp:test` (Vitest).
- `pnpm lint` — runs `nx run insula-mcp:lint` (Biome).
- `mise run doctor` — executes the CLI doctor target through Nx.
- `npx insula-mcp compare reports/old.json reports/new.json` — added/removed findings (human diff).
- Flags: `--deterministic`, `--har`, `--otel-exporter <url>`, `--suites cors,jsonrpc-batch,permissioning,sse-reconnect,threat-model,ratelimit`.

## Notes
- This starter implements HTTP/JSON-RPC/SSE probes + core plugins and stubs hardening checks (CORS, rate-limit, tool drift, devtool CVE warning).
- All findings are evidence-linked and brand logs as **brAInwav**.
- Plugins are read-only. No mutations to target servers or repos.

## Advanced

### Sandbox & Budgets
Every plugin runs in a Node Worker with a default **time budget** of `5000ms` and **memory (old space)** limit of `96MB`.

- Adjust with `--budget-time <ms>` and `--budget-mem <MB>`.
- If worker start fails (rare platforms), Insula falls back to **in-process** execution.
- The sandbox is designed for **read-only diagnostics**; built-ins avoid `fs`/`child_process`.
