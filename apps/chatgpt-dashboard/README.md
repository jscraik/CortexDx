# CortexDx ChatGPT Control Panel

A **100% OpenAI Apps SDK conformant** WCAG 2.2 AA accessible dashboard for monitoring health, logs, traces, metrics and controlling agents within ChatGPT using MCP v2025-03-26.

> ✅ **Fully conformant with [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/) guidelines**

## Features

### Core Functionality
- **Health Monitoring**: Real-time system health status with component-level details
- **Log Viewer**: Filterable, searchable log entries with level indicators (coming soon)
- **Trace Explorer**: Distributed trace spans for debugging workflows (coming soon)
- **Metrics Dashboard**: System metrics with auto-refresh capability (coming soon)
- **Agent Controls**: Pause, resume, cancel runs and execute test flows (coming soon)
- **Dual-Mode Transport**: Supports both Streamable HTTP (SSE) and WebSocket

### Apps SDK Conformance ✅
- **React Router Navigation**: Host-backed navigation with browser history
- **Progressive Disclosure**: Simplified inline widget, full dashboard in fullscreen
- **Loading/Error/Empty States**: Comprehensive user feedback
- **Telemetry**: Event tracking for debugging and analytics
- **Internationalization**: Multi-language support (en-US, es-ES)
- **Safe Area Insets**: Mobile-friendly layout
- **Accessibility**: WCAG 2.2 AA compliant

## MCP v2025-03-26 Compliance

This dashboard implements the Model Context Protocol specification v2025-03-26:

- **Streamable HTTP Transport**: Server-Sent Events for real-time updates
- **WebSocket Transport**: Bidirectional communication on `/mcp` endpoint
- **Session Management**: `Mcp-Session-Id` header support
- **Protocol Version Header**: `MCP-Protocol-Version: 2025-03-26`
- **OAuth Protected Resource**: RFC 9728 metadata at `/.well-known/oauth-protected-resource`

## Accessibility (WCAG 2.2 AA)

The dashboard is fully accessible:

- **Keyboard Navigation**: Full tab navigation with arrow keys for tabs
- **Screen Reader Support**: ARIA labels, live regions, and announcements
- **Focus Management**: Visible focus indicators and skip links
- **Color Independence**: Status indicators use icons/text in addition to color
- **High Contrast Mode**: Respects `prefers-contrast: more`
- **Reduced Motion**: Respects `prefers-reduced-motion`

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the dashboard server
pnpm dev

# Or build and run production
pnpm build
node dist/server.js
```

## Documentation

- **[APPS_SDK_CONFORMANCE.md](./APPS_SDK_CONFORMANCE.md)** - Full conformance guide
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Migration instructions
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - What was built
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference card
- **[TODO.md](./TODO.md)** - Implementation roadmap

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /dashboard` | Dashboard UI |
| `GET /dashboard/api/health` | Health status |
| `GET /dashboard/api/logs` | Log entries |
| `GET /dashboard/api/traces` | Trace spans |
| `GET /dashboard/api/metrics` | Metrics snapshot |
| `GET /dashboard/api/runs` | Agent runs |
| `POST /dashboard/api/control` | Execute control action |
| `GET /events` | SSE event stream |
| `WS /mcp` | WebSocket JSON-RPC |
| `GET /.well-known/oauth-protected-resource` | OAuth metadata |
| `GET /.well-known/mcp.json` | MCP manifest |

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHBOARD_PORT` | `5002` | Server port |
| `DASHBOARD_HOST` | `127.0.0.1` | Server host |

## Integration with ChatGPT

The dashboard is designed to be embedded within ChatGPT via the OpenAI Apps SDK:

1. Register the app in ChatGPT developer portal
2. Configure OAuth scopes: `search.read`, `docs.write`, `memory.read`, `memory.write`, `memory.delete`
3. Set up Cloudflare Tunnel for secure access
4. Access the dashboard from within ChatGPT

## Development

```bash
# Run tests
pnpm test

# Lint code
pnpm lint

# Build
pnpm build
```

## Architecture

```
apps/chatgpt-dashboard/
├── src/
│   ├── api/           # API handlers
│   ├── components/    # UI components (HTML, CSS, JS)
│   ├── types/         # TypeScript type definitions
│   ├── index.ts       # Main exports
│   └── server.ts      # HTTP/WebSocket server
├── tests/             # Test suites
└── package.json
```

## License

Apache 2.0 - See [LICENSE](../../LICENSE)
