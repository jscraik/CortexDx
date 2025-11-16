# Frequently Asked Questions (FAQ)

**Quick answers to common CortexDx questions.**

⏱️ **Reading time:** 5 minutes

> 💡 **Tip:** Press `Ctrl+F` (or `Cmd+F`) to search for keywords.

---

## Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [Usage & Features](#usage--features)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

---

## General Questions

### What is CortexDx?

CortexDx is a diagnostic meta-inspector for Model Context Protocol (MCP) servers and clients. It validates protocol compliance, identifies security vulnerabilities, and provides evidence-based remediation guidance.

**Key Features:**
- Protocol compliance validation
- Security vulnerability assessment
- Performance profiling
- AI-powered debugging assistance
- Code generation for MCP servers

### What is the difference between CortexDx and other API testing tools?

Unlike generic API testing tools, CortexDx:

- **Understands MCP semantics** - Validates MCP-specific requirements (tool discovery, resource handling, session management)
- **Protocol-aware** - Tests JSON-RPC 2.0, Server-Sent Events (SSE), and WebSocket transports
- **Evidence-based** - Every finding includes verifiable evidence and remediation steps
- **AI-powered** - Includes conversational debugging and code generation features
- **Test-driven guidance** - Generates ArcTDD implementation plans with test-first approach

### Can CortexDx modify my MCP server?

**No.** CortexDx is strictly read-only and stateless. It:

- Never modifies target servers
- Never writes data to your server
- Never performs destructive operations
- Only sends safe, non-mutating requests

All analysis is performed through observation and probing, not modification.

### How accurate are the diagnostic findings?

Findings include confidence levels based on evidence quality:

| Confidence | Accuracy | When Used |
|------------|----------|-----------|
| **High** | 95%+ | Direct protocol violations, explicit errors |
| **Medium** | 80-95% | Inferred issues, best practice violations |
| **Low** | 60-80% | Edge cases requiring manual review |

All findings include concrete evidence for verification. High-confidence findings are highly reliable; low-confidence findings should be manually validated.

### Is CortexDx free to use?

**Yes.** CortexDx is open-source and licensed under Apache 2.0. You can:

- Use it commercially without restrictions
- Modify and distribute it
- Create proprietary plugins
- Integrate it into commercial products

See [LICENSE](../../../../LICENSE) for complete terms.

---

## Installation & Setup

### What Node.js version is required?

**Node.js 20.0.0 or higher** is required. This ensures:

- Modern JavaScript feature support (async/await, ESM modules)
- Security updates and performance optimizations
- Compatibility with latest dependencies

**Check your version:**

```bash
node --version
# Should output: v20.0.0 or higher
```

**Upgrade if needed:**

```bash
# Using nvm (recommended)
nvm install 20
nvm use 20

# Or download from nodejs.org
```

### Can I run CortexDx in Docker?

**Yes.** Use the official Node.js 20 Alpine image:

```dockerfile
FROM node:20-alpine
RUN npm install -g @brainwav/cortexdx
CMD ["cortexdx", "--help"]
```

For complete Docker setup instructions, see the example above or refer to the [README.md](../../README.md#docker-usage).

### How do I configure authentication for multiple environments?

Use configuration files with environment-specific auth methods:

**Option 1: Configuration File (`.cortexdx.json`):**

```json
{
  "authentication": {
    "production": {
      "type": "bearer",
      "token": "${PROD_API_TOKEN}"
    },
    "staging": {
      "type": "basic",
      "username": "${STAGING_USER}",
      "password": "${STAGING_PASS}"
    }
  }
}
```

**Option 2: Environment Variables:**

```bash
# Production
export MCP_ENDPOINT="https://api.example.com"
export MCP_AUTH_TOKEN="prod-token"
cortexdx diagnose $MCP_ENDPOINT --auth bearer:$MCP_AUTH_TOKEN

# Staging
export MCP_ENDPOINT="https://staging.example.com"
export MCP_AUTH_TOKEN="staging-token"
cortexdx diagnose $MCP_ENDPOINT --auth bearer:$MCP_AUTH_TOKEN
```

See [Setup Guide: Authentication](setup.md#authentication) for advanced setups.

### "Command not found: cortexdx" - How do I fix this?

**Cause:** CortexDx is not in your system PATH.

**Solutions:**

1. **Use npx (no installation needed):**
   ```bash
   npx @brainwav/cortexdx --help
   ```

2. **Fix npm global bin PATH:**
   ```bash
   # Check npm prefix
   npm config get prefix

   # Add to PATH (add to ~/.bashrc or ~/.zshrc)
   export PATH="$(npm config get prefix)/bin:$PATH"

   # Reload shell
   source ~/.bashrc  # or source ~/.zshrc
   ```

3. **Reinstall globally:**
   ```bash
   npm install -g @brainwav/cortexdx
   cortexdx --version
   ```

---

## Usage & Features

### Which diagnostic suites should I run for development vs. production?

**Development (fast feedback):**

```bash
cortexdx diagnose http://localhost:3000 \
  --suites protocol,streaming,devtool
```

**Pre-Production (comprehensive):**

```bash
cortexdx diagnose https://staging.example.com \
  --full
```

**Production Monitoring (lightweight):**

```bash
cortexdx diagnose https://api.example.com \
  --suites protocol,streaming \
  --budget-time 3000
```

See [Basics: Diagnostic Suites](basics.md#diagnostic-suites) for complete suite descriptions.

### How do I interpret severity levels?

| Severity | Meaning | Action Required | Exit Code |
|----------|---------|-----------------|-----------|
| **BLOCKER** 🚨 | Critical issues preventing MCP functionality | Fix immediately before deployment | 1 |
| **MAJOR** ⚠️ | Important issues affecting reliability or security | Address before release | 2 |
| **MINOR** ℹ️ | Improvements that enhance quality | Consider for next iteration | 0 |
| **INFO** ✅ | Informational findings and confirmations | No action needed | 0 |

**In CI/CD:** Configure failure thresholds based on severity.

See [Exit Codes](../README.md#exit-codes) for automation details.

### Can I create custom diagnostic plugins?

**Yes.** Place custom plugins in a directory and configure CortexDx:

**1. Create plugin:**

```typescript
// plugins/my-plugin.ts
import { DiagnosticPlugin } from '@brainwav/cortexdx';

export const MyPlugin: DiagnosticPlugin = {
  id: 'my-custom-check',
  title: 'My Custom Validation',
  order: 1000,
  async run(ctx) {
    // Your diagnostic logic
    return [{
      id: 'custom.check',
      area: 'custom',
      severity: 'info',
      title: 'Custom check passed',
      description: 'Everything looks good!'
    }];
  }
};
```

**2. Configure:**

```json
{
  "plugins": {
    "custom": "./plugins",
    "enabled": ["protocol", "security", "my-custom-check"]
  }
}
```

See [Plugin Development Guide](../PLUGIN_DEVELOPMENT.md) for complete documentation.

---

## CI/CD Integration

### What exit codes does CortexDx return?

| Exit Code | Meaning | Trigger |
|-----------|---------|---------|
| **0** | Success | No blockers or majors found |
| **1** | Critical | Blocker findings detected |
| **2** | Warning | Major findings detected (configurable threshold) |

**Use in CI/CD:**

```bash
cortexdx diagnose $MCP_ENDPOINT --out reports
EXIT_CODE=$?

if [ $EXIT_CODE -eq 1 ]; then
  echo "❌ Build failed: Blocker issues found"
  exit 1
elif [ $EXIT_CODE -eq 2 ]; then
  echo "⚠️  Build warning: Major issues found"
  # Optionally fail or warn
fi
```

### How do I integrate with GitHub Actions?

**Basic workflow:**

```yaml
- name: Run MCP Diagnostics
  run: |
    npx @brainwav/cortexdx diagnose ${{ secrets.MCP_ENDPOINT }} \
      --auth bearer:${{ secrets.MCP_TOKEN }} \
      --full \
      --deterministic \
      --out reports

- name: Upload Reports
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: mcp-diagnostic-reports
    path: reports/
```

See [CI/CD: GitHub Actions](ci-cd.md#github-actions) for complete examples.

### Can I fail builds based on specific findings?

**Yes.** Parse JSON output and implement custom quality gates:

```bash
# Run diagnostics
cortexdx diagnose $MCP_ENDPOINT --out reports --deterministic

# Parse findings
BLOCKER_COUNT=$(jq '.findings | map(select(.severity == "blocker")) | length' \
  reports/cortexdx-findings.json)

MAJOR_COUNT=$(jq '.findings | map(select(.severity == "major")) | length' \
  reports/cortexdx-findings.json)

# Custom thresholds
if [ "$BLOCKER_COUNT" -gt 0 ]; then
  echo "❌ Build failed: $BLOCKER_COUNT blocker(s)"
  exit 1
elif [ "$MAJOR_COUNT" -gt 5 ]; then
  echo "❌ Build failed: Too many majors ($MAJOR_COUNT > 5)"
  exit 1
fi
```

See [CI/CD: Quality Gates](ci-cd.md#quality-gates) for advanced patterns.

---

## Troubleshooting

### Diagnostics are timing out. What should I do?

**Cause:** Default time budget (5 seconds per plugin) is insufficient.

**Solutions:**

1. **Increase time budget:**
   ```bash
   cortexdx diagnose <endpoint> --budget-time 15000
   ```

2. **Run lighter suites:**
   ```bash
   cortexdx diagnose <endpoint> --suites protocol,streaming
   ```

3. **Check network connectivity:**
   ```bash
   cortexdx doctor
   curl -I <endpoint>
   ```

### "Connection refused" errors - How do I fix this?

**Cause:** Target MCP server is not running or not accessible.

**Solutions:**

1. **Verify server is running:**
   ```bash
   # Check if server is listening
   lsof -i :3000  # macOS/Linux
   netstat -an | findstr :3000  # Windows
   ```

2. **Start your server:**
   ```bash
   cd your-mcp-server
   npm run dev
   ```

3. **Check firewall/network:**
   ```bash
   # Test connectivity
   curl -I http://localhost:3000
   telnet localhost 3000
   ```

4. **Verify endpoint URL:**
   ```bash
   # Ensure correct protocol and port
   cortexdx diagnose http://localhost:3000  # Not https:// for local
   ```

### How do I debug plugin failures?

**Enable debug logging:**

```bash
# All debug output
DEBUG=cortexdx:* cortexdx diagnose <endpoint>

# Plugin-specific debugging
DEBUG=cortexdx:plugin:* cortexdx diagnose <endpoint>

# Network debugging
DEBUG=cortexdx:adapter:* cortexdx diagnose <endpoint>
```

**Check plugin execution:**

```bash
# Increase time/memory budgets
cortexdx diagnose <endpoint> \
  --budget-time 30000 \
  --budget-mem 256
```

### The tool reports false positives. How do I handle them?

**Steps:**

1. **Check confidence level** in the finding:
   - High confidence (95%+) → Likely accurate
   - Medium confidence (80-95%) → Verify evidence
   - Low confidence (60-80%) → May need manual review

2. **Review evidence** in the finding details

3. **Create custom rules** to suppress known false positives:

   ```json
   {
     "diagnostics": {
       "suppressFindings": ["minor.rate-limit", "info.documentation"]
     }
   }
   ```

4. **Report issue** if it's a bug: [GitHub Issues](https://github.com/jscraik/CortexDx/issues)

---

## Advanced Topics

### How do I create organization-specific standards?

**Create a standards file:**

```json
{
  "standards": {
    "naming": "kebab-case",
    "versioning": "semver",
    "authentication": "required",
    "cors": {
      "allowedOrigins": ["https://app.example.com"],
      "allowCredentials": false
    },
    "rateLimit": {
      "required": true,
      "minimumLimit": 100
    }
  }
}
```

**Use in diagnostics:**

```bash
cortexdx best-practices <endpoint> --standards your-standards.json
```

See [Configuration: Standards Enforcement](configuration.md#standards-enforcement) for details.

### Can I extend CortexDx with custom output formats?

**Yes.** Use custom Handlebars templates:

```json
{
  "reporting": {
    "templates": {
      "markdown": "./templates/custom-report.md.hbs",
      "html": "./templates/dashboard.html.hbs",
      "slack": "./templates/slack-notification.json.hbs"
    }
  }
}
```

See [Configuration: Custom Templates](configuration.md#custom-output-templates) for examples.

### How do I monitor MCP servers continuously?

**Scheduled diagnostics with cron:**

```bash
# Every 15 minutes (lightweight)
*/15 * * * * cortexdx diagnose https://api.example.com \
  --suites protocol,streaming \
  --deterministic \
  --out /var/log/mcp-health

# Daily comprehensive scan
0 2 * * * cortexdx diagnose https://api.example.com \
  --full \
  --out /var/log/mcp-daily
```

**With monitoring integration:**

```bash
cortexdx diagnose https://api.example.com \
  --otel-exporter http://prometheus:9090/api/v1/otlp
```

See [Integrations: Monitoring](integrations.md#monitoring-integration) for complete setup.

### Is there an API for programmatic usage?

**Yes.** Import CortexDx as a library:

```typescript
import { runDiagnose } from '@brainwav/cortexdx';

const findings = await runDiagnose({
  endpoint: 'https://api.example.com',
  suites: ['protocol', 'security'],
  auth: { type: 'bearer', token: process.env.API_TOKEN }
});

console.log(findings);
```

See [API Reference](../API_REFERENCE.md) for complete programmatic API documentation.

---

## Still Have Questions?

- **Interactive Help**: Run `cortexdx interactive` for conversational assistance
- **Troubleshooting Guide**: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Comprehensive problem-solving
- **GitHub Issues**: [Report bugs and request features](https://github.com/jscraik/CortexDx/issues)
- **Discussions**: [Community Q&A](https://github.com/jscraik/CortexDx/discussions)
- **Documentation**: [Complete guide index](README.md)

---

**[← Back to User Guide](README.md)**
