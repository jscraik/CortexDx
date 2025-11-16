# CortexDx Basics

**Learn the fundamentals of installing and using CortexDx for MCP diagnostics.**

⏱️ **Reading time:** 10 minutes

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Diagnostic Suites](#diagnostic-suites)
- [Output Control](#output-control)
- [Next Steps](#next-steps)

---

## Overview

CortexDx is a comprehensive diagnostic meta-inspector for Model Context Protocol (MCP) servers and clients. It provides:

- **Stateless Analysis** - Read-only diagnostics that never modify target servers
- **Evidence-Based Findings** - Every issue includes concrete evidence and remediation steps
- **Plugin Architecture** - Extensible diagnostic suites covering protocol, security, and performance
- **Multiple Output Formats** - Human-readable reports, machine-readable JSON, and implementation plans
- **CI/CD Integration** - Automated quality gates with configurable severity thresholds

> 📚 **New to MCP?** See the [Glossary](../../../../docs/GLOSSARY.md#mcp-protocol-terms) for definitions of MCP terms.

---

## Installation

### Prerequisites

Before installing CortexDx, ensure you have:

- **Node.js**: Version 20.0.0 or higher ([Download](https://nodejs.org/))
- **npm**: Comes with Node.js (or use [pnpm](https://pnpm.io/))
- **Operating System**: macOS, Linux, or Windows (WSL recommended)

**Check your Node.js version:**

```bash
node --version
# Should output: v20.0.0 or higher
```

### Method 1: Global Installation (Recommended)

Install CortexDx globally for command-line access:

```bash
npm install -g @brainwav/cortexdx

# Verify installation
cortexdx --version
# Expected output: 0.1.0
```

### Method 2: Use with npx (No Installation)

Run CortexDx without installing:

```bash
# Run directly
npx @brainwav/cortexdx diagnose https://your-mcp-server.com

# Use for one-time diagnostics
npx @brainwav/cortexdx --help
```

### Method 3: Local Development

For contributing or customization:

```bash
# Clone and build from source
git clone https://github.com/jscraik/CortexDx.git
cd CortexDx
mise install          # Install Node/pnpm versions
pnpm install          # Install dependencies
pnpm build           # Build the project

# Run locally
pnpm dev diagnose https://your-mcp-server.com
```

### Verification

After installation, verify everything works:

```bash
# Check version
cortexdx --version
# Expected: 0.1.0

# Run environment check
cortexdx doctor
# Expected: ✓ Node.js version compatible
#           ✓ Network connectivity available
#           ✓ Plugin system functional
```

> ⚠️ **Troubleshooting:** See [FAQ](faq.md#installation-issues) for common installation problems.

---

## Quick Start

### Your First Diagnostic

Run a basic diagnostic on an MCP server:

```bash
cortexdx diagnose https://mcp.example.com
```

**Expected Output:**

```text
[brAInwav] CortexDx Diagnostic Report
🔍 Analyzing: https://mcp.example.com
⚡ Duration: 1.8s

✅ [INFO] MCP server responding (200 OK)
⚠️  [MAJOR] SSE endpoint not streaming (HTTP 502)
ℹ️  [MINOR] No 'rpc.ping' response - method may differ

📊 Generated: reports/cortexdx-report.md
```

### Understanding the Output

CortexDx findings use severity levels:

| Severity | Symbol | Meaning | Exit Code |
|----------|--------|---------|-----------|
| **BLOCKER** | 🚨 | Critical issues preventing MCP functionality | 1 |
| **MAJOR** | ⚠️ | Important issues affecting reliability or security | 2 |
| **MINOR** | ℹ️ | Improvements that enhance quality | 0 |
| **INFO** | ✅ | Informational findings and confirmations | 0 |

> 📖 **Learn more:** See [Output Formats](output-formats.md) for detailed report explanations.

### Comprehensive Analysis

Run all diagnostic suites:

```bash
cortexdx diagnose https://mcp.example.com --full --out reports
```

This generates:

- `reports/cortexdx-report.md` - Human-readable findings
- `reports/cortexdx-findings.json` - Machine-readable data
- `reports/cortexdx-arctdd.md` - Implementation plan with test-driven steps
- `reports/cortexdx-fileplan.patch` - Code fixes as unified diffs

---

## Authentication

CortexDx supports multiple authentication methods for protected MCP servers:

### Bearer Token Authentication

For APIs using JWT or OAuth tokens:

```bash
cortexdx diagnose https://api.example.com \
  --auth bearer:your-jwt-token
```

### Basic Authentication

For username/password protected servers:

```bash
cortexdx diagnose https://api.example.com \
  --auth basic:username:password
```

### Custom Header Authentication

For API key or custom header authentication:

```bash
# Single header
cortexdx diagnose https://api.example.com \
  --auth header:X-API-Key:your-api-key

# Multiple headers (JSON format)
cortexdx diagnose https://api.example.com \
  --auth 'header:{"Authorization":"Bearer token","X-Client-ID":"client123"}'
```

### Auth0 OAuth2

For Auth0-protected endpoints:

```bash
cortexdx diagnose https://api.example.com \
  --auth0-domain tenant.auth0.com \
  --auth0-client-id your-client-id \
  --auth0-client-secret your-client-secret \
  --auth0-audience https://api.cortexdx.com
```

> 🔒 **Security:** Never hardcode credentials. Use environment variables:
>
> ```bash
> export MCP_AUTH_TOKEN="your-token"
> cortexdx diagnose https://api.example.com --auth bearer:$MCP_AUTH_TOKEN
> ```

> 📖 **Learn more:** See [Configuration: Authentication](configuration.md#authentication-configuration) for advanced auth setups.

---

## Diagnostic Suites

Target specific areas of analysis with diagnostic suites:

### Available Suites

CortexDx provides focused diagnostic suites:

**Protocol Compliance:**
- `discovery` - Tool enumeration and capability detection
- `jsonrpc` - JSON-RPC 2.0 compliance and batch processing
- `streaming` - Server-Sent Events (SSE) and WebSocket validation
- `protocol` - Core MCP protocol adherence

**Security & Governance:**
- `cors` - Cross-Origin Resource Sharing (CORS) configuration
- `auth` - Authentication and authorization mechanisms
- `ratelimit` - Rate limiting and throttling policies
- `threat-model` - Security vulnerability assessment
- `permissioning` - Access control and permissions

**Quality & Performance:**
- `governance` - Policy compliance and drift detection
- `devtool` - Development environment security
- `tool-drift` - API consistency and versioning

### Running Specific Suites

```bash
# Protocol compliance only
cortexdx diagnose https://mcp.example.com \
  --suites protocol,jsonrpc

# Security assessment
cortexdx diagnose https://mcp.example.com \
  --suites cors,auth,ratelimit,threat-model

# Performance analysis
cortexdx diagnose https://mcp.example.com \
  --suites streaming,performance-analysis

# All suites (comprehensive)
cortexdx diagnose https://mcp.example.com --full
```

### Suite Selection Strategy

Choose suites based on your goal:

| Goal | Recommended Suites | Time |
|------|-------------------|------|
| **Quick Health Check** | `protocol,streaming` | ~30s |
| **Pre-Deployment** | `protocol,security,governance` | ~2min |
| **Security Audit** | `cors,auth,ratelimit,threat-model,permissioning` | ~3min |
| **Comprehensive** | `--full` (all suites) | ~5min |

> 📖 **Learn more:** See [Commands Reference](commands.md#diagnostic-suites) for complete suite descriptions.

---

## Output Control

Customize how CortexDx presents results:

### Accessibility Options

```bash
# Screen-reader friendly output
cortexdx diagnose https://mcp.example.com --a11y

# Disable ANSI colors (for CI/CD)
cortexdx diagnose https://mcp.example.com --no-color

# Both together
cortexdx diagnose https://mcp.example.com --a11y --no-color
```

### Deterministic Mode

For reproducible results in CI/CD:

```bash
cortexdx diagnose https://mcp.example.com --deterministic
```

**What it does:**
- Uses stable timestamps (not current time)
- Sets fixed random seeds
- Produces identical output for identical server states
- Essential for regression testing

### Custom Output Directory

```bash
# Save to specific directory
cortexdx diagnose https://mcp.example.com --out /path/to/reports

# Save with additional formats
cortexdx diagnose https://mcp.example.com \
  --out reports \
  --file-plan \
  --har
```

**Generated Files:**
- `cortexdx-report.md` - Always generated
- `cortexdx-findings.json` - Always generated
- `cortexdx-arctdd.md` - With `--file-plan`
- `cortexdx-fileplan.patch` - With `--file-plan`
- `cortexdx.har` - With `--har` (redacted network capture)

> 📖 **Learn more:** See [Output Formats](output-formats.md) for detailed format descriptions.

---

## Next Steps

Now that you understand the basics, explore these guides:

### Continue Learning

- **[Commands Reference](commands.md)** - Complete CLI command documentation
- **[Configuration](configuration.md)** - Customize CortexDx behavior
- **[Common Workflows](workflows.md)** - Development, debugging, and security patterns

### Advanced Topics

- **[CI/CD Integration](ci-cd.md)** - Automate diagnostics in your pipeline
- **[Integrations](integrations.md)** - Docker, monitoring, and IDE setup
- **[Best Practices](best-practices.md)** - Production deployment patterns

### Reference Materials

- **[API Reference](../API_REFERENCE.md)** - Complete CLI and programmatic API
- **[Glossary](../../../../docs/GLOSSARY.md)** - Technical terms and definitions
- **[FAQ](faq.md)** - Frequently asked questions

---

## Need Help?

- **Interactive Help**: Run `cortexdx interactive` for conversational assistance
- **Troubleshooting**: See [FAQ](faq.md) for common issues
- **GitHub Issues**: [Report bugs](https://github.com/jscraik/CortexDx/issues)
- **Discussions**: [Community Q&A](https://github.com/jscraik/CortexDx/discussions)

---

**[← Back to User Guide](README.md)** | **[Commands Reference →](commands.md)**
