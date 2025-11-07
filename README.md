# Insula MCP — Diagnostic Meta-Inspector

[![GitHub Actions](https://github.com/brainwav/insula-mcp/workflows/Insula%20MCP%20Diagnose/badge.svg)](https://github.com/brainwav/insula-mcp/actions)
[![npm version](https://img.shields.io/npm/v/@brainwav/insula-mcp.svg)](https://www.npmjs.com/package/@brainwav/insula-mcp)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

**Stateless, plugin-based diagnostics for Model Context Protocol (MCP) servers and clients.** Insula MCP is the comprehensive diagnostic tool that helps you harden MCP implementations before production deployment.

## 🚀 Key Features

- **🔍 Comprehensive MCP Analysis**: HTTP/HTTPS, SSE, WebSocket, JSON-RPC, and gRPC protocol testing
- **🛡️ Security & Governance**: CORS, rate-limiting, authentication, and threat-model validation
- **📊 Evidence-Based Reports**: Markdown, JSON, ArcTDD plans, and optional file patches
- **🔧 Plugin Architecture**: Extensible sandbox-based plugin system with configurable budgets
- **⚡ CI/CD Ready**: GitHub Actions integration with severity-based failure modes
- **♿ Accessibility**: WCAG 2.2 AA compliant CLI output with screen reader support
- **🎯 Deterministic**: Reproducible results with `--deterministic` mode for reliable testing

## 📦 Quick Start

### Installation

```bash
# Install globally
npm install -g @brainwav/insula-mcp

# Or use with npx (no installation required)
npx @brainwav/insula-mcp diagnose https://your-mcp-server.com
```

### Basic Usage

```bash
# Quick diagnostic scan
insula-mcp diagnose https://mcp.example.com

# Full comprehensive analysis
insula-mcp diagnose https://mcp.example.com --full

# Generate implementation plan
insula-mcp diagnose https://mcp.example.com --file-plan --out reports

# Compare two diagnostic runs
insula-mcp compare reports/old.json reports/new.json
```

### Example Output

```bash
$ insula-mcp diagnose https://cortex-mcp.brainwav.io/mcp

[brAInwav] Insula MCP Diagnostic Report
✅ [INFO] MCP server responding
⚠️  [MAJOR] SSE endpoint not streaming (HTTP 502)
ℹ️  [MINOR] No 'rpc.ping' response
📊 Generated: reports/insula-report.md, reports/insula-arctdd.md
```

## 🛠️ Advanced Usage

### Development Environment Setup

```bash
# Clone and setup (for contributors)
git clone https://github.com/brainwav/insula-mcp.git
cd insula-mcp
mise install          # Install Node/pnpm versions
pnpm install          # Install dependencies
pnpm build           # Build the project
pnpm test            # Run tests
```

### Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `diagnose` | Run diagnostic analysis | `insula-mcp diagnose <endpoint> [options]` |
| `interactive` | Start interactive mode | `insula-mcp interactive` |
| `debug` | Interactive debugging session | `insula-mcp debug "connection timeout"` |
| `generate` | Code generation assistance | `insula-mcp generate` |
| `best-practices` | Implementation analysis | `insula-mcp best-practices <endpoint>` |
| `tutorial` | Interactive tutorials | `insula-mcp tutorial "mcp-basics"` |
| `doctor` | Environment diagnostics | `insula-mcp doctor` |
| `compare` | Compare diagnostic results | `insula-mcp compare old.json new.json` |

### Configuration Options

```bash
# Authentication
insula-mcp diagnose <endpoint> --auth bearer:your-token
insula-mcp diagnose <endpoint> --auth basic:user:pass

# Suite Selection
insula-mcp diagnose <endpoint> --suites streaming,governance,cors

# Output Control
insula-mcp diagnose <endpoint> --out custom-reports --file-plan --har

# Performance Tuning
insula-mcp diagnose <endpoint> --budget-time 10000 --budget-mem 128

# Accessibility & CI/CD
insula-mcp diagnose <endpoint> --a11y --no-color --deterministic
```

## 📚 Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [Getting Started](packages/insula-mcp/docs/GETTING_STARTED.md) | Installation and first steps | New Users |
| [User Guide](packages/insula-mcp/docs/USER_GUIDE.md) | Comprehensive usage guide | All Users |
| [API Reference](packages/insula-mcp/docs/API_REFERENCE.md) | CLI and programmatic API | Developers |
| [Plugin Development](packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md) | Creating custom plugins | Plugin Authors |
| [Troubleshooting](packages/insula-mcp/docs/TROUBLESHOOTING.md) | Common issues and solutions | Support |
| [Deployment](packages/insula-mcp/docs/DEPLOYMENT.md) | Production deployment | DevOps |
| [IDE Integration](packages/insula-mcp/docs/IDE_INTEGRATION.md) | Editor setup and extensions | Developers |
| [Contributing](packages/insula-mcp/docs/CONTRIBUTING.md) | Development and contribution guide | Contributors |

### Quick Navigation

- **New to Insula MCP?** Start with [Getting Started](packages/insula-mcp/docs/GETTING_STARTED.md)
- **Need help?** Check [Troubleshooting](packages/insula-mcp/docs/TROUBLESHOOTING.md)
- **Want to contribute?** Read [Contributing](packages/insula-mcp/docs/CONTRIBUTING.md)
- **Building plugins?** See [Plugin Development](packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md)
- **Setting up your IDE?** Visit [IDE Integration](packages/insula-mcp/docs/IDE_INTEGRATION.md)

## 🏗️ Architecture

Insula MCP follows a **plugin-first architecture** with these core principles:

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
    npx @brainwav/insula-mcp diagnose ${{ secrets.MCP_ENDPOINT }} --out reports
    
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

We follow [Semantic Versioning](https://semver.org/). See [Releases](https://github.com/brainwav/insula-mcp/releases) for changelog.

- **Major**: Breaking changes to CLI or API
- **Minor**: New features, plugins, or diagnostic capabilities
- **Patch**: Bug fixes, documentation updates, performance improvements

## 📄 License

Licensed under the [Apache License 2.0](LICENSE). See LICENSE file for details.

## 🆘 Support & Community

- **Issues**: [GitHub Issues](https://github.com/brainwav/insula-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/brainwav/insula-mcp/discussions)
- **Documentation**: [docs.brainwav.io/mcp](https://docs.brainwav.io/mcp)
- **Security**: Report security issues to <security@brainwav.io>

---

<div align="center">

**Built with ❤️ by [brAInwav](https://brainwav.io)**

*Empowering developers to build robust MCP implementations*

</div>
