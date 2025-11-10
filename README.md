# CortexDx — Diagnostic Meta-Inspector

[![GitHub Actions](https://github.com/brainwav/cortexdx/workflows/CortexDx%20Diagnose/badge.svg)](https://github.com/brainwav/cortexdx/actions)
[![npm version](https://img.shields.io/npm/v/@brainwav/cortexdx.svg)](https://www.npmjs.com/package/@brainwav/cortexdx)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

**Stateless, plugin-based diagnostics for Model Context Protocol (MCP) servers and clients.** CortexDx is the comprehensive diagnostic tool that helps you harden MCP implementations before production deployment.

## 🚀 Key Features

- **🔍 Comprehensive MCP Analysis**: HTTP/HTTPS, SSE, WebSocket, JSON-RPC, and gRPC protocol testing
- **🛡️ Security & Governance**: CORS, rate-limiting, authentication, and threat-model validation
- **📊 Evidence-Based Reports**: Markdown, JSON, ArcTDD plans, and optional file patches
- **🔧 Plugin Architecture**: Extensible sandbox-based plugin system with configurable budgets
- **⚡ CI/CD Ready**: GitHub Actions integration with severity-based failure modes
- **♿ Accessibility**: WCAG 2.2 AA compliant CLI output with screen reader support
- **🎯 Deterministic**: Reproducible results with `--deterministic` mode for reliable testing
- **🧠 Internal Self-Improvement** *(Brainwav dev builds only)*: Internal diagnostics plugin highlights handshake, dependency, and health regressions inside CortexDx itself

## 📦 Quick Start

### Installation

```bash
# Install globally
npm install -g @brainwav/cortexdx

# Or use with npx (no installation required)
npx @brainwav/cortexdx diagnose https://your-mcp-server.com
```

### Basic Usage

```bash
# Quick diagnostic scan
cortexdx diagnose https://mcp.example.com

# Full comprehensive analysis
cortexdx diagnose https://mcp.example.com --full

# Generate implementation plan
cortexdx diagnose https://mcp.example.com --file-plan --out reports

# Compare two diagnostic runs
cortexdx compare reports/old.json reports/new.json
```

### Example Output

```bash
$ cortexdx diagnose https://cortex-mcp.brainwav.io/mcp

[brAInwav] CortexDx Diagnostic Report
✅ [INFO] MCP server responding
⚠️  [MAJOR] SSE endpoint not streaming (HTTP 502)
ℹ️  [MINOR] No 'rpc.ping' response
📊 Generated: reports/cortexdx-report.md, reports/cortexdx-arctdd.md
```

## 🛠️ Advanced Usage

### Development Environment Setup

```bash
# Clone and setup (for contributors)
git clone https://github.com/brainwav/cortexdx.git
cd cortexdx
mise install          # Install Node/pnpm versions
pnpm install          # Install dependencies
pnpm build           # Build the project
pnpm test            # Run tests
```

#### CortexDx LaunchAgent (macOS)

Need CortexDx listening on `127.0.0.1:5001` without touching `.Cortex-OS`? Use the
bundled service scripts:

```bash
./install-service.sh      # render + install com.brainwav.cortexdx
./manage-service.sh logs  # tail /var/log/cortexdx.log
./uninstall-service.sh    # remove the LaunchAgent
```

The plist template renders with your absolute paths and the label stays
`com.brainwav.cortexdx`, so it can co-exist with `.Cortex-OS`'s
`com.brainwav.cortexdx-local-memory` profile. See `SERVICE_SETUP.md` for details
and environment overrides like `PORT=5002 ./install-service.sh`.

#### Optional: reuse `.Cortex-OS` toggle (Cortex ↔ CortexDx)

If you prefer the shared profile switcher that ships with `.Cortex-OS`, you can
still flip between Cortex profiles:

```bash
# From ~/.Cortex-OS
pnpm mcp:profile cortexdx   # MCP-only (REST disabled, Qdrant still on 6333)
pnpm mcp:profile cortex     # Restore Cortex profile (REST 3002 + MCP bridge)
```

Each command wraps `scripts/launchd/toggle-local-memory.sh`, which renders the
correct plist, bootouts the previous LaunchAgent, and bootstraps the new one via
`launchctl`. Confirm the active profile before diagnostics:

```bash
launchctl print gui/$UID/com.brainwav.cortexdx-local-memory | rg -i state
lsof -i :3002   # should be empty for CortexDx profile
lsof -i :6333   # Qdrant should listen in both profiles
```

Share these commands in runbooks/PRs when asking reviewers to reproduce CortexDx
issues so everyone flips the same profile without editing plist files manually.

### Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `diagnose` | Run diagnostic analysis | `cortexdx diagnose <endpoint> [options]` |
| `interactive` | Start interactive mode | `cortexdx interactive` |
| `debug` | Interactive debugging session | `cortexdx debug "connection timeout"` |
| `generate` | Code generation assistance | `cortexdx generate` |
| `best-practices` | Implementation analysis | `cortexdx best-practices <endpoint>` |
| `tutorial` | Interactive tutorials | `cortexdx tutorial "mcp-basics"` |
| `doctor` | Environment diagnostics | `cortexdx doctor` |
| `compare` | Compare diagnostic results | `cortexdx compare old.json new.json` |

### Configuration Options

```bash
# Authentication
cortexdx diagnose <endpoint> --auth bearer:your-token
cortexdx diagnose <endpoint> --auth basic:user:pass

# Auth0 (client credentials)
cortexdx diagnose <endpoint> \
  --auth0-domain tenant.auth0.com \
  --auth0-client-id <client_id> \
  --auth0-client-secret <client_secret> \
  --auth0-audience https://api.cortexdx.com

# Suite Selection
cortexdx diagnose <endpoint> --suites streaming,governance,cors

# Output Control
cortexdx diagnose <endpoint> --out custom-reports --file-plan --har

# Performance Tuning
cortexdx diagnose <endpoint> --budget-time 10000 --budget-mem 128

# Accessibility & CI/CD
cortexdx diagnose <endpoint> --a11y --no-color --deterministic
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXA_API_KEY` | Required for the Exa academic provider. Stored in 1Password-managed `.env` and injected at runtime. |
| `SEMANTIC_SCHOLAR_API_KEY` | Optional API key for Semantic Scholar. If unset, CortexDx falls back to `jscraik@brainwav.io` as the contact identity so traffic stays compliant until a dedicated email is provisioned. |
| `CORTEXDX_AUTH0_DOMAIN` | Auth0 tenant domain (`example.auth0.com`) used to secure the MCP endpoint. |
| `CORTEXDX_AUTH0_CLIENT_ID` | Machine-to-machine client id for CortexDx to request tokens. |
| `CORTEXDX_AUTH0_CLIENT_SECRET` | Client secret paired with the Auth0 client id (store securely). |
| `CORTEXDX_AUTH0_AUDIENCE` | API audience / identifier configured in Auth0. |
| `CORTEXDX_AUTH0_SCOPE` | Optional scopes (space-delimited) to request during the client credential flow. |

## 📚 Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [Getting Started](packages/cortexdx/docs/GETTING_STARTED.md) | Installation and first steps | New Users |
| [User Guide](packages/cortexdx/docs/USER_GUIDE.md) | Comprehensive usage guide | All Users |
| [Auth0 Setup](docs/AUTH0_SETUP.md) | Auth0 authentication configuration | Production Setup |
| [API Reference](packages/cortexdx/docs/API_REFERENCE.md) | CLI and programmatic API | Developers |
| [Plugin Development](packages/cortexdx/docs/PLUGIN_DEVELOPMENT.md) | Creating custom plugins | Plugin Authors |
| [Troubleshooting](packages/cortexdx/docs/TROUBLESHOOTING.md) | Common issues and solutions | Support |
| [Deployment](packages/cortexdx/docs/DEPLOYMENT.md) | Production deployment | DevOps |
| [IDE Integration](packages/cortexdx/docs/IDE_INTEGRATION.md) | Editor setup and extensions | Developers |
| [Contributing](packages/cortexdx/docs/CONTRIBUTING.md) | Development and contribution guide | Contributors |

### Quick Navigation

- **New to CortexDx?** Start with [Getting Started](packages/cortexdx/docs/GETTING_STARTED.md)
- **Need Auth0 authentication?** See [Auth0 Setup](docs/AUTH0_SETUP.md)
- **Need help?** Check [Troubleshooting](packages/cortexdx/docs/TROUBLESHOOTING.md)
- **Want to contribute?** Read [Contributing](packages/cortexdx/docs/CONTRIBUTING.md)
- **Building plugins?** See [Plugin Development](packages/cortexdx/docs/PLUGIN_DEVELOPMENT.md)
- **Setting up your IDE?** Visit [IDE Integration](packages/cortexdx/docs/IDE_INTEGRATION.md)

## 🏗️ Architecture

CortexDx follows a **plugin-first architecture** with these core principles:

- **Stateless & Read-Only**: Never mutates target MCP servers
- **Sandboxed Plugins**: Worker-thread isolation with CPU/memory budgets
- **Evidence-Based**: Every finding includes verifiable evidence pointers
- **Deterministic**: Reproducible results for reliable CI/CD integration
- **Accessible**: WCAG 2.2 AA compliant output for inclusive development

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CLI Interface │────│   Orchestrator   │────│  Plugin System  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Report Engine   │    │   Adapters      │
                       └──────────────────┘    └─────────────────┘
                                │                        │
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Evidence System  │    │ Protocol Probes │
                       └──────────────────┘    └─────────────────┘
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork & Clone**: Fork the repository and clone your fork
2. **Setup**: Run `mise install && pnpm install`
3. **Develop**: Follow [ArcTDD methodology](AGENTS.md) (Test → Code → Refactor)
4. **Test**: Ensure `pnpm lint && pnpm test && pnpm build` passes
5. **Submit**: Create a pull request with clear description

### Code Standards

- **TypeScript ESM**: Modern module system with strict typing
- **Named Exports**: No default exports, explicit interfaces
- **Function Size**: ≤40 lines per function for maintainability
- **Test Coverage**: ≥90% coverage with mutation testing
- **Documentation**: Update docs for any user-facing changes

## 🔧 CI/CD Integration

### GitHub Actions

```yaml
- name: MCP Diagnostic
  run: |
    npx @brainwav/cortexdx diagnose ${{ secrets.MCP_ENDPOINT }} --out reports
    
- name: Upload Reports
  uses: actions/upload-artifact@v4
  with:
    name: mcp-diagnostic-reports
    path: reports/
```

### Exit Codes

- `0`: Success (no blockers or majors)
- `1`: Blocker findings detected
- `2`: Major findings detected

## 🌟 Use Cases

- **Pre-Production Validation**: Ensure MCP servers meet production standards
- **Security Auditing**: Identify authentication, CORS, and rate-limiting issues
- **Performance Analysis**: Detect streaming, timeout, and resource problems
- **Compliance Checking**: Validate against MCP protocol specifications
- **Regression Testing**: Compare diagnostic results across deployments
- **Developer Onboarding**: Interactive tutorials and debugging assistance

## 📊 Supported Protocols & Features

| Protocol | Support | Features |
|----------|---------|----------|
| **HTTP/HTTPS** | ✅ Full | Headers, status codes, response validation |
| **JSON-RPC 2.0** | ✅ Full | Batch requests, notifications, error handling |
| **Server-Sent Events** | ✅ Full | Streaming, reconnection, heartbeat validation |
| **WebSocket** | ✅ Full | Bidirectional messaging, connection lifecycle |
| **gRPC** | 🚧 Beta | Basic probing (roadmap: full validation) |

## 🏷️ Versioning & Releases

We follow [Semantic Versioning](https://semver.org/). See [Releases](https://github.com/brainwav/cortexdx/releases) for changelog.

- **Major**: Breaking changes to CLI or API
- **Minor**: New features, plugins, or diagnostic capabilities
- **Patch**: Bug fixes, documentation updates, performance improvements

## 📄 License

Licensed under the [Apache License 2.0](LICENSE). See LICENSE file for details.

## 🆘 Support & Community

- **Issues**: [GitHub Issues](https://github.com/brainwav/cortexdx/issues)
- **Discussions**: [GitHub Discussions](https://github.com/brainwav/cortexdx/discussions)
- **Documentation**: [docs.brainwav.io/mcp](https://docs.brainwav.io/mcp)
- **Security**: Report security issues to <security@brainwav.io>

---

<div align="center">

**Built with ❤️ by [brAInwav](https://brainwav.io)**

*Empowering developers to build robust MCP implementations*

</div>
