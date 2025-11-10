# @brainwav/cortexdx

[![npm version](https://img.shields.io/npm/v/@brainwav/cortexdx.svg)](https://www.npmjs.com/package/@brainwav/cortexdx)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/docker/v/brainwav/cortexdx?label=docker)](https://hub.docker.com/r/brainwav/cortexdx)

**Comprehensive diagnostic meta-inspector and AI-powered development assistant for Model Context Protocol (MCP) servers and clients.** Provides stateless, plugin-based analysis with evidence-backed findings, local LLM integration, academic research validation, and actionable remediation guidance.

## 🎉 v1.0.0 Released

CortexDx v1.0.0 is now available with major enhancements:

- 🤖 **Local LLM Integration**: Conversational development with Ollama, MLX, and llama.cpp
- 🎓 **Academic Research Validation**: 7 integrated academic providers with license compliance
- 💼 **Commercial Licensing**: Three tiers (Community, Professional, Enterprise)
- 🧠 **Learning System**: Pattern recognition and RAG-based knowledge accumulation
- 📊 **Enhanced Diagnostics**: Real-time monitoring and performance profiling

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for complete details and [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for upgrade instructions.

## 🚀 Installation

### NPM Package

```bash
# Install globally
npm install -g @brainwav/cortexdx

# Or use with npx (recommended)
npx @brainwav/cortexdx diagnose https://your-mcp-server.com
```

### Docker (Recommended for Production)

```bash
# Quick deploy Community Edition
curl -fsSL https://raw.githubusercontent.com/brainwav/cortexdx/main/packages/cortexdx/scripts/quick-deploy.sh | bash -s community

# Or manually with Docker
docker run -p 3000:3000 brainwav/cortexdx:1.0.0-community

# Professional Edition (requires license)
docker run -p 3000:3000 \
  -e INSULA_LICENSE_KEY=your-key \
  -e OLLAMA_HOST=ollama:11434 \
  brainwav/cortexdx:1.0.0-professional

# Enterprise Edition (requires license and Auth0)
docker run -p 3000:3000 \
  -e INSULA_LICENSE_KEY=your-key \
  -e AUTH0_DOMAIN=your-domain.auth0.com \
  -e AUTH0_CLIENT_ID=your-client-id \
  -e AUTH0_CLIENT_SECRET=your-secret \
  brainwav/cortexdx:1.0.0-enterprise
```

### Docker Compose

```bash
# Clone repository
git clone https://github.com/brainwav/cortexdx.git
cd cortexdx/packages/cortexdx

# Start with docker-compose
docker-compose up cortexdx-community
```

### Development Setup

```bash
# For development/contribution
git clone https://github.com/brainwav/cortexdx.git
cd cortexdx
mise install && pnpm install && pnpm build
```

## 📋 Quick Start

### Basic Diagnostic

```bash
# Simple diagnostic scan
cortexdx diagnose https://mcp.example.com

# Full comprehensive analysis
cortexdx diagnose https://mcp.example.com --full --out reports

# With authentication
cortexdx diagnose https://mcp.example.com --auth bearer:your-token
```

### Interactive Mode

```bash
# Start interactive diagnostic session
cortexdx interactive

# Debug specific issues
cortexdx debug "SSE connection timeout"

# Get implementation guidance
cortexdx best-practices https://mcp.example.com
```

### Example Output

```bash
$ cortexdx diagnose https://cortex-mcp.brainwav.io/mcp --full

[brAInwav] CortexDx Diagnostic Report
🔍 Analyzing: https://cortex-mcp.brainwav.io/mcp
⚡ Duration: 2.2s

✅ [INFO] MCP server responding (200 OK)
⚠️  [MAJOR] SSE endpoint not streaming (HTTP 502)
ℹ️  [MINOR] No 'rpc.ping' response - method may differ
ℹ️  [MINOR] Could not enumerate tools via JSON-RPC

📊 Reports generated:
  • reports/insula-report.md (human-readable)
  • reports/insula-findings.json (machine-readable)
  • reports/insula-arctdd.md (implementation plan)
  • reports/insula-fileplan.patch (code diffs)

🎯 Next steps: Review ArcTDD plan for remediation guidance
```

## 🛠️ CLI Commands Reference

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `diagnose <endpoint>` | Run diagnostic analysis | `cortexdx diagnose https://api.example.com/mcp` |
| `interactive` | Interactive diagnostic mode | `cortexdx interactive` |
| `debug <problem>` | Debug specific issues | `cortexdx debug "connection timeout"` |
| `generate` | Code generation assistance | `cortexdx generate` |
| `best-practices [endpoint]` | Implementation analysis | `cortexdx best-practices` |
| `tutorial <topic>` | Interactive tutorials | `cortexdx tutorial mcp-basics` |
| `doctor` | Environment diagnostics | `cortexdx doctor` |
| `compare <old> <new>` | Compare diagnostic results | `cortexdx compare old.json new.json` |

### Diagnose Command Options

```bash
cortexdx diagnose <endpoint> [options]

# Core Options
--full                    # Run comprehensive analysis (all suites)
--suites <csv>           # Specific suites: streaming,governance,cors,ratelimit
--out <dir>              # Output directory (default: reports)
--file-plan              # Generate unified diff patches

# Authentication
--auth bearer:TOKEN      # Bearer token authentication
--auth basic:user:pass   # Basic authentication
--auth header:Name:Value # Custom header authentication

# Output Control
--a11y                   # Screen-reader friendly output
--no-color              # Disable ANSI colors
--deterministic         # Stable timestamps and seeds for CI/CD

# Advanced
--simulate-external     # Probe as remote client
--otel-exporter <url>   # OpenTelemetry endpoint
--har                   # Capture redacted HAR on failures
--budget-time <ms>      # Per-plugin time budget (default: 5000)
--budget-mem <mb>       # Per-plugin memory limit (default: 96)
```

## 🔍 Diagnostic Suites

CortexDx includes comprehensive diagnostic suites covering all aspects of MCP implementations:

### Protocol Suites

- **`discovery`**: Tool enumeration and capability detection
- **`jsonrpc`**: JSON-RPC 2.0 compliance and batch processing
- **`streaming`**: Server-Sent Events and WebSocket validation
- **`protocol`**: Core MCP protocol adherence

### Security & Governance

- **`cors`**: Cross-Origin Resource Sharing configuration
- **`auth`**: Authentication and authorization mechanisms
- **`ratelimit`**: Rate limiting and throttling policies
- **`threat-model`**: Security vulnerability assessment
- **`permissioning`**: Access control and permissions

### Quality & Performance

- **`governance`**: Policy compliance and drift detection
- **`devtool`**: Development environment security
- **`tool-drift`**: API consistency and versioning

### Development Features

- **`interactive-debugger`**: Real-time debugging assistance with academic research backing
- **`code-generation`**: Research-validated code generation with quality scoring
- **`performance-analysis`**: Academic research-backed performance optimization

### Narrative Stories (Preview)

Set `INSULA_STORIES_ENABLED=true` to expose the experimental narrative diagnostics stack:

- `story.list` returns normalized story payloads validated against `schemas/story.schema.yaml` and `src/story/story-schema.ts`.
- `story.get` fetches a single story by id for UI consumers or MCP clients.
- `story.reprobe` executes a dry-run remediation from `src/actions/library.ts` (no remote mutations).

Before opening a PR, run the new validation gates:

```bash
pnpm -w nx run cortexdx:schema:check
pnpm -w nx run cortexdx:test
```

Vitest now enforces ≥70% line coverage for the story/anomaly/graph modules, ensuring the conversational diagnostics layer remains deterministic and well-tested.

## 📊 Output Formats

### 1. Markdown Report (`insula-report.md`)

Human-readable diagnostic report with findings organized by severity:

```markdown
# CortexDx Diagnostic Report (brAInwav)
- Endpoint: https://mcp.example.com
- Date: 2025-11-06T21:50:59.157Z

## [MAJOR] SSE endpoint not streaming
Probe failed: HTTP 502
- Evidence: url:https://mcp.example.com/events
```

### 2. JSON Findings (`insula-findings.json`)

Machine-readable structured data for automation:

```json
{
  "endpoint": "https://mcp.example.com",
  "inspectedAt": "2025-11-06T21:50:59.157Z",
  "findings": [
    {
      "id": "sse.missing",
      "area": "streaming",
      "severity": "major",
      "title": "SSE endpoint not streaming",
      "description": "Probe failed: HTTP 502",
      "evidence": [{"type": "url", "ref": "https://mcp.example.com/events"}]
    }
  ]
}
```

### 3. ArcTDD Plan (`insula-arctdd.md`)

Test-driven implementation plan with prioritized remediation steps:

```markdown
# ArcTDD Implementation Plan
## 🚨 Critical Issues (Blockers)
## ⚠️ Major Issues
### MAJOR: SSE endpoint not streaming
**Solution Steps:**
1. Implement SSE endpoint: Add `/events` route
2. Set proper headers: `Content-Type: text/event-stream`
3. Add keepalive: Send periodic heartbeat messages
```

### 4. File Plan (`insula-fileplan.patch`)

Unified diff patches for direct code remediation:

```diff
+++ server.js
@@ -10,6 +10,12 @@
   res.json({status: 'ok'});
 });
 
+app.get('/events', (req, res) => {
+  res.writeHead(200, {
+    'Content-Type': 'text/event-stream',
+    'Cache-Control': 'no-cache'
+  });
+});
```

## 🏗️ Development Commands

### Building and Testing

```bash
# Development workflow
pnpm install              # Install dependencies
pnpm build               # Build TypeScript → JavaScript (tsup)
pnpm test                # Run Vitest test suite
pnpm lint                # Biome linting and formatting
pnpm doctor              # Environment diagnostics

# Advanced testing
pnpm test --coverage     # Test with coverage report
pnpm test --watch        # Watch mode for development
```

### Plugin Development

```bash
# Create new plugin
mkdir src/plugins/custom
touch src/plugins/custom/my-plugin.ts

# Test plugin in isolation
pnpm test src/plugins/custom/my-plugin.test.ts

# Register plugin
# Add to src/plugins/index.ts
```

## 🔧 Configuration

### Environment Variables

```bash
# OpenTelemetry configuration
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector.com
OTEL_SERVICE_NAME=cortexdx

# Plugin budgets (can also use CLI flags)
INSULA_BUDGET_TIME=10000    # 10 seconds per plugin
INSULA_BUDGET_MEM=128       # 128MB memory limit

# Debug logging
DEBUG=insula:*              # Enable debug logging
```

### CI/CD Integration

#### GitHub Actions

```yaml
name: MCP Diagnostics
on: [push, pull_request]

jobs:
  diagnose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          
      - name: Run MCP Diagnostics
        run: |
          npx @brainwav/cortexdx diagnose ${{ secrets.MCP_ENDPOINT }} \
            --full --out reports --deterministic
            
      - name: Upload Reports
        uses: actions/upload-artifact@v4
        with:
          name: mcp-diagnostic-reports
          path: reports/
          
      - name: Fail on Major Issues
        run: |
          # Exit code 2 indicates major findings
          if [ $? -eq 2 ]; then
            echo "Major MCP issues detected - failing build"
            exit 1
          fi
```

#### Exit Codes

- **0**: Success (no blockers or majors)
- **1**: Blocker findings detected (critical issues)
- **2**: Major findings detected (important issues)

## 🔒 Security & Privacy

### Data Handling

- **Read-Only**: Never mutates target MCP servers
- **Local Processing**: All analysis performed locally
- **Optional HAR**: Network capture only with `--har` flag
- **Credential Redaction**: Automatic sanitization of sensitive data

### Sandbox Security

- **Worker Threads**: Plugins run in isolated Node.js workers
- **Resource Limits**: Configurable CPU time and memory budgets
- **API Restrictions**: Blocked access to `fs`, `child_process`, raw sockets
- **Fallback Safety**: Graceful degradation if worker threads unavailable

## 🐛 Troubleshooting

### Common Issues

**Connection Timeouts**

```bash
# Increase timeout budgets
cortexdx diagnose <endpoint> --budget-time 15000

# Check network connectivity
cortexdx doctor
```

**Memory Issues**

```bash
# Increase memory budget
cortexdx diagnose <endpoint> --budget-mem 256

# Use lighter suite selection
cortexdx diagnose <endpoint> --suites discovery,protocol
```

**Authentication Problems**

```bash
# Test different auth methods
cortexdx diagnose <endpoint> --auth bearer:token
cortexdx diagnose <endpoint> --auth basic:user:pass
cortexdx diagnose <endpoint> --auth header:Authorization:"Bearer token"
```

**CI/CD Integration**

```bash
# Use deterministic mode for consistent results
cortexdx diagnose <endpoint> --deterministic --no-color

# Generate machine-readable output only
cortexdx diagnose <endpoint> --out reports
cat reports/insula-findings.json | jq '.findings[].severity'
```

### Debug Logging

```bash
# Enable debug output
DEBUG=insula:* cortexdx diagnose <endpoint>

# Plugin-specific debugging
DEBUG=insula:plugin:* cortexdx diagnose <endpoint>

# Network debugging
DEBUG=insula:adapter:* cortexdx diagnose <endpoint>
```

## 📚 Documentation

### Core Documentation

- **[Getting Started](docs/GETTING_STARTED.md)**: Installation and first steps
- **[User Guide](docs/USER_GUIDE.md)**: Comprehensive usage documentation
- **[API Reference](docs/API_REFERENCE.md)**: Complete CLI and programmatic API
- **[Troubleshooting](docs/TROUBLESHOOTING.md)**: Common issues and solutions

### Developer Resources

- **[Plugin Development](docs/PLUGIN_DEVELOPMENT.md)**: Creating custom diagnostic plugins
- **[IDE Integration](docs/IDE_INTEGRATION.md)**: Editor setup and extensions
- **[Contributing](docs/CONTRIBUTING.md)**: Development and contribution guide

### Operations

- **[Deployment](docs/DEPLOYMENT.md)**: Production deployment guidance

### Quick Links

- 🚀 **First time?** → [Getting Started](docs/GETTING_STARTED.md)
- 🔧 **Having issues?** → [Troubleshooting](docs/TROUBLESHOOTING.md)
- 🛠️ **Want to contribute?** → [Contributing](docs/CONTRIBUTING.md)
- 🔌 **Building plugins?** → [Plugin Development](docs/PLUGIN_DEVELOPMENT.md)

## 🤝 Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development setup, coding standards, and contribution guidelines.

## 📄 License

Licensed under the [Apache License 2.0](LICENSE).
