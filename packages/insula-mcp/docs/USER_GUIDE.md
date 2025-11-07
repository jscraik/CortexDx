# Insula MCP User Guide

**Complete guide to using Insula MCP for Model Context Protocol diagnostics, development, and debugging.**

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Command Reference](#command-reference)
- [Configuration](#configuration)
- [Integration Patterns](#integration-patterns)
- [Output Formats](#output-formats)
- [Common Workflows](#common-workflows)
- [Best Practices](#best-practices)
- [FAQ](#faq)

## Overview

Insula MCP is a comprehensive diagnostic meta-inspector for Model Context Protocol (MCP) servers and clients. It provides:

- **Stateless Analysis**: Read-only diagnostics that never modify target servers
- **Evidence-Based Findings**: Every issue includes concrete evidence and remediation steps
- **Plugin Architecture**: Extensible diagnostic suites covering protocol, security, and performance
- **Multiple Output Formats**: Human-readable reports, machine-readable JSON, and implementation plans
- **CI/CD Integration**: Automated quality gates with configurable severity thresholds

### Key Features

- Protocol compliance validation (JSON-RPC 2.0, SSE, WebSocket)
- Security vulnerability assessment (CORS, authentication, rate limiting)
- Performance profiling and optimization recommendations
- Interactive debugging and development assistance
- Code generation for MCP servers and connectors
- ArcTDD implementation plans with test-driven development guidance

## Installation

### Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **npm/pnpm**: Package manager (pnpm recommended for development)
- **Operating System**: macOS, Linux, or Windows (WSL recommended)

### Platform-Specific Installation

#### macOS

```bash
# Using Homebrew (recommended)
brew install node@20
npm install -g @brainwav/insula-mcp

# Verify installation
insula-mcp --version
insula-mcp doctor
```

#### Linux (Ubuntu/Debian)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Insula MCP
npm install -g @brainwav/insula-mcp

# Verify installation
insula-mcp --version
```

#### Windows (WSL)

```bash
# Install Node.js via Node Version Manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Install Insula MCP
npm install -g @brainwav/insula-mcp
```

### Alternative Installation Methods

#### Using npx (No Global Install)

```bash
# Run directly without installation
npx @brainwav/insula-mcp diagnose https://your-mcp-server.com

# Interactive mode
npx @brainwav/insula-mcp interactive
```

#### Development Installation

```bash
# Clone repository for development/contribution
git clone https://github.com/jscraik/insula-mcp.git
cd insula-mcp

# Install mise for toolchain management
curl https://mise.run | sh
mise install

# Install dependencies and build
pnpm install
pnpm build

# Run from source
pnpm dev diagnose https://your-mcp-server.com
```

### Verification

After installation, verify everything works correctly:

```bash
# Check version and basic functionality
insula-mcp --version
insula-mcp doctor

# Run a quick diagnostic test
insula-mcp diagnose https://httpbin.org --suites discovery
```

Expected output:

```
[brAInwav] Doctor: Node v20.11.1
✅ Node.js version compatible
✅ Network connectivity available
✅ Plugin system functional
```

## Basic Usage

### Quick Start Examples

#### 1. Basic Diagnostic Scan

```bash
# Simple diagnostic of an MCP server
insula-mcp diagnose https://mcp.example.com

# Expected output:
# [brAInwav] Insula MCP Diagnostic Report
# 🔍 Analyzing: https://mcp.example.com
# ⚡ Duration: 1.8s
# 
# ✅ [INFO] MCP server responding (200 OK)
# ⚠️  [MAJOR] SSE endpoint not streaming (HTTP 502)
# ℹ️  [MINOR] No 'rpc.ping' response - method may differ
```

#### 2. Comprehensive Analysis

```bash
# Full diagnostic suite with detailed reporting
insula-mcp diagnose https://mcp.example.com --full --out reports

# This generates:
# - reports/insula-report.md (human-readable)
# - reports/insula-findings.json (machine-readable)
# - reports/insula-arctdd.md (implementation plan)
# - reports/insula-fileplan.patch (code fixes)
```

#### 3. Interactive Development Mode

```bash
# Start conversational assistance
insula-mcp interactive

# Example interaction:
# > How do I create an MCP server for file operations?
# > Debug this error: "WebSocket connection failed"
# > Generate a connector for the GitHub API
```

### Authentication

Insula MCP supports multiple authentication methods:

```bash
# Bearer token authentication
insula-mcp diagnose https://api.example.com --auth bearer:your-jwt-token

# Basic authentication
insula-mcp diagnose https://api.example.com --auth basic:username:password

# Custom header authentication
insula-mcp diagnose https://api.example.com --auth header:X-API-Key:your-api-key

# Multiple headers (JSON format)
insula-mcp diagnose https://api.example.com --auth 'header:{"Authorization":"Bearer token","X-Client-ID":"client123"}'
```

### Diagnostic Suites

Target specific areas of analysis:

```bash
# Protocol compliance only
insula-mcp diagnose https://mcp.example.com --suites protocol,jsonrpc

# Security assessment
insula-mcp diagnose https://mcp.example.com --suites cors,auth,ratelimit,threat-model

# Performance analysis
insula-mcp diagnose https://mcp.example.com --suites streaming,performance-analysis

# All available suites
insula-mcp diagnose https://mcp.example.com --full
```

### Output Control

Customize output format and verbosity:

```bash
# Screen-reader friendly output
insula-mcp diagnose https://mcp.example.com --a11y

# No colors (for CI/CD)
insula-mcp diagnose https://mcp.example.com --no-color

# Deterministic output (stable timestamps)
insula-mcp diagnose https://mcp.example.com --deterministic

# Custom output directory
insula-mcp diagnose https://mcp.example.com --out /path/to/reports
```

## Command Reference

### Core Commands

#### `diagnose <endpoint>`

Run comprehensive diagnostic analysis on an MCP server.

**Syntax:**

```bash
insula-mcp diagnose <endpoint> [options]
```

**Arguments:**

- `<endpoint>`: MCP server URL (e.g., `https://mcp.example.com`, `http://localhost:3000`)

**Options:**

| Option | Description | Example |
|--------|-------------|---------|
| `--full` | Run all diagnostic suites | `--full` |
| `--suites <csv>` | Specific suites to run | `--suites protocol,security` |
| `--auth <scheme:value>` | Authentication method | `--auth bearer:token123` |
| `--out <dir>` | Output directory | `--out ./reports` |
| `--file-plan` | Generate code fix patches | `--file-plan` |
| `--a11y` | Screen-reader friendly output | `--a11y` |
| `--no-color` | Disable ANSI colors | `--no-color` |
| `--deterministic` | Stable timestamps for CI | `--deterministic` |
| `--simulate-external` | Test as external client | `--simulate-external` |
| `--otel-exporter <url>` | OpenTelemetry endpoint | `--otel-exporter http://jaeger:14268` |
| `--har` | Capture network traffic | `--har` |
| `--budget-time <ms>` | Per-plugin timeout | `--budget-time 10000` |
| `--budget-mem <mb>` | Memory limit per plugin | `--budget-mem 128` |

**Examples:**

```bash
# Basic scan
insula-mcp diagnose https://api.example.com

# Security-focused analysis
insula-mcp diagnose https://api.example.com --suites cors,auth,threat-model

# CI/CD integration
insula-mcp diagnose $MCP_ENDPOINT --deterministic --no-color --out reports

# Debug with network capture
insula-mcp diagnose https://api.example.com --har --budget-time 15000
```

#### `interactive` / `i`

Start interactive mode for conversational assistance.

**Syntax:**

```bash
insula-mcp interactive [options]
```

**Options:**

- `--expertise <level>`: Set expertise level (`beginner`, `intermediate`, `expert`)
- `--no-color`: Disable colors

**Examples:**

```bash
# Start interactive session
insula-mcp interactive

# Beginner-friendly mode
insula-mcp interactive --expertise beginner

# Expert mode with advanced features
insula-mcp interactive --expertise expert
```

#### `generate`

Code generation commands for MCP development.

##### `generate template <name>`

Generate MCP server template.

**Syntax:**

```bash
insula-mcp generate template <name> [options]
```

**Options:**

- `--lang <language>`: Programming language (`typescript`, `javascript`, `python`, `go`)
- `--features <csv>`: Features to include (`tools`, `resources`, `prompts`, `authentication`, `streaming`)
- `--transport <csv>`: Transport protocols (`http`, `sse`, `websocket`, `stdio`)
- `--no-tests`: Skip test generation
- `--no-docs`: Skip documentation
- `--out <dir>`: Output directory

**Examples:**

```bash
# Basic TypeScript server
insula-mcp generate template my-server

# Python server with all features
insula-mcp generate template py-server --lang python --features tools,resources,prompts,auth

# Minimal JavaScript server
insula-mcp generate template simple-server --lang javascript --no-tests --no-docs
```

##### `generate connector <name> <spec>`

Generate MCP connector from API specification.

**Syntax:**

```bash
insula-mcp generate connector <name> <spec> [options]
```

**Arguments:**

- `<name>`: Connector name
- `<spec>`: OpenAPI/Swagger specification (URL or file path)

**Options:**

- `--auth <type>`: Authentication type (`none`, `api-key`, `oauth2`, `bearer`, `basic`)
- `--lang <language>`: Programming language
- `--no-tests`: Skip test generation
- `--out <dir>`: Output directory

**Examples:**

```bash
# GitHub API connector
insula-mcp generate connector github-mcp https://api.github.com/openapi.json --auth bearer

# Local API specification
insula-mcp generate connector my-api ./api-spec.yaml --auth api-key --lang python
```

##### `generate docs <target> <source>`

Generate documentation for MCP implementation.

**Syntax:**

```bash
insula-mcp generate docs <target> <source> [options]
```

**Arguments:**

- `<target>`: Documentation type (`server`, `connector`, `tool`, `api`, `deployment`)
- `<source>`: Source code path or MCP endpoint

**Options:**

- `--format <fmt>`: Output format (`markdown`, `html`, `pdf`)
- `--no-examples`: Skip usage examples
- `--out <file>`: Output file path

**Examples:**

```bash
# Server documentation
insula-mcp generate docs server ./src --format markdown --out README.md

# API documentation from live server
insula-mcp generate docs api https://mcp.example.com --format html
```

#### `debug <problem>`

Start interactive debugging session.

**Syntax:**

```bash
insula-mcp debug <problem> [options]
```

**Arguments:**

- `<problem>`: Problem description or error message

**Options:**

- `--errors <files...>`: Error log files to analyze
- `--configs <files...>`: Configuration files for context
- `--code <files...>`: Relevant code files
- `--expertise <level>`: Expertise level

**Examples:**

```bash
# Debug connection issue
insula-mcp debug "WebSocket connection keeps dropping"

# Debug with log files
insula-mcp debug "Server startup fails" --errors server.log --configs config.json

# Debug with code context
insula-mcp debug "Tool registration error" --code src/tools.ts --expertise expert
```

#### `explain`

Explain errors or MCP concepts.

##### `explain error <error>`

Interpret and explain error messages.

**Syntax:**

```bash
insula-mcp explain error <error> [options]
```

**Options:**

- `--context <file>`: Context file (JSON/YAML)
- `--expertise <level>`: Explanation complexity
- `--technical`: Include technical details

**Examples:**

```bash
# Explain error message
insula-mcp explain error "JSON-RPC parse error: unexpected token"

# Explain with context
insula-mcp explain error "Connection refused" --context server-config.json --technical
```

##### `explain concept <concept>`

Explain MCP concepts and patterns.

**Syntax:**

```bash
insula-mcp explain concept <concept> [options]
```

**Options:**

- `--expertise <level>`: Explanation complexity
- `--no-examples`: Skip code examples
- `--no-usecases`: Skip use case examples

**Examples:**

```bash
# Explain MCP tools
insula-mcp explain concept tools --expertise beginner

# Explain resources without examples
insula-mcp explain concept resources --no-examples --expertise expert
```

#### `best-practices [endpoint]`

Analyze implementation and provide recommendations.

**Syntax:**

```bash
insula-mcp best-practices [endpoint] [options]
```

**Options:**

- `--code <path>`: Codebase path to analyze
- `--focus <csv>`: Focus areas (`protocol`, `security`, `performance`, `maintainability`, `testing`, `documentation`)
- `--standards <file>`: Organization standards file
- `--no-samples`: Skip code samples

**Examples:**

```bash
# Analyze live server
insula-mcp best-practices https://mcp.example.com

# Analyze codebase
insula-mcp best-practices --code ./src --focus security,performance

# Use organization standards
insula-mcp best-practices --code ./src --standards .insula-standards.json
```

#### `tutorial <topic>`

Create interactive tutorial for MCP development.

**Syntax:**

```bash
insula-mcp tutorial <topic> [options]
```

**Options:**

- `--expertise <level>`: Tutorial complexity
- `--lang <language>`: Programming language
- `--no-exercises`: Skip hands-on exercises

**Examples:**

```bash
# Basic MCP tutorial
insula-mcp tutorial "creating first MCP server"

# Advanced Python tutorial
insula-mcp tutorial "advanced MCP patterns" --lang python --expertise expert
```

#### `doctor`

Run environment diagnostics.

**Syntax:**

```bash
insula-mcp doctor
```

**Output:**

```
[brAInwav] Doctor: Node v20.11.1
✅ Node.js version compatible (>=20.0.0)
✅ Network connectivity available
✅ Plugin system functional
✅ Worker threads supported
⚠️  Playwright not installed (optional for browser testing)
ℹ️  MLX not detected (optional for local AI)
```

#### `compare <old> <new>`

Compare diagnostic results between runs.

**Syntax:**

```bash
insula-mcp compare <old> <new>
```

**Arguments:**

- `<old>`: Previous findings JSON file
- `<new>`: Current findings JSON file

**Example:**

```bash
# Compare before/after changes
insula-mcp diagnose https://api.example.com --out reports-before
# ... make changes ...
insula-mcp diagnose https://api.example.com --out reports-after
insula-mcp compare reports-before/insula-findings.json reports-after/insula-findings.json
```

## Configuration

### Configuration File

Create `.insula-mcp.json` in your project root for persistent settings:

```json
{
  "diagnostics": {
    "suites": ["protocol", "security", "performance"],
    "severity": "medium",
    "budgets": {
      "time": 10000,
      "memory": 128
    },
    "output": {
      "format": "markdown",
      "accessibility": true,
      "deterministic": false
    }
  },
  "authentication": {
    "default": "bearer",
    "headers": {
      "User-Agent": "Insula-MCP/0.1.0",
      "Accept": "application/json"
    }
  },
  "plugins": {
    "enabled": ["protocol", "security", "streaming"],
    "disabled": ["experimental"],
    "custom": "./plugins"
  },
  "reporting": {
    "outputDir": "./reports",
    "formats": ["markdown", "json", "arctdd"],
    "includeEvidence": true,
    "redactSensitive": true
  },
  "integrations": {
    "ci": {
      "failOnSeverity": "major",
      "uploadArtifacts": true
    },
    "observability": {
      "otelEndpoint": "http://localhost:4318",
      "enableTracing": true,
      "enableMetrics": false
    }
  }
}
```

### Environment Variables

Configure Insula MCP using environment variables:

```bash
# Core settings
export INSULA_CONFIG_FILE=".insula-mcp.json"
export INSULA_OUTPUT_DIR="./reports"
export INSULA_LOG_LEVEL="info"

# Authentication
export INSULA_DEFAULT_AUTH="bearer:${API_TOKEN}"
export INSULA_USER_AGENT="MyOrg-Insula/1.0"

# Plugin budgets
export INSULA_BUDGET_TIME="15000"
export INSULA_BUDGET_MEM="256"

# OpenTelemetry
export OTEL_EXPORTER_OTLP_ENDPOINT="http://jaeger:4318"
export OTEL_SERVICE_NAME="insula-mcp"
export OTEL_RESOURCE_ATTRIBUTES="service.version=0.1.0,environment=production"

# Debug logging
export DEBUG="insula:*"
export DEBUG_COLORS="true"
```

### Common Configuration Examples

#### Development Environment

```json
{
  "diagnostics": {
    "suites": ["protocol", "jsonrpc", "streaming"],
    "severity": "info",
    "budgets": {
      "time": 30000,
      "memory": 512
    }
  },
  "reporting": {
    "outputDir": "./dev-reports",
    "formats": ["markdown", "json"],
    "includeEvidence": true
  },
  "plugins": {
    "enabled": ["protocol", "streaming", "devtool"],
    "custom": "./dev-plugins"
  }
}
```

#### Production CI/CD

```json
{
  "diagnostics": {
    "suites": ["protocol", "security", "governance"],
    "severity": "major",
    "budgets": {
      "time": 5000,
      "memory": 96
    },
    "output": {
      "deterministic": true,
      "accessibility": false
    }
  },
  "reporting": {
    "outputDir": "./ci-reports",
    "formats": ["json"],
    "redactSensitive": true
  },
  "integrations": {
    "ci": {
      "failOnSeverity": "major",
      "uploadArtifacts": true
    }
  }
}
```

#### Security-Focused Analysis

```json
{
  "diagnostics": {
    "suites": ["cors", "auth", "ratelimit", "threat-model", "permissioning"],
    "severity": "minor"
  },
  "authentication": {
    "testMethods": ["bearer", "basic", "oauth2"],
    "validateCertificates": true
  },
  "reporting": {
    "formats": ["markdown", "json", "arctdd"],
    "includeEvidence": true,
    "securityFocus": true
  }
}
```

#### Team Standards Enforcement

```json
{
  "diagnostics": {
    "suites": ["protocol", "governance", "tool-drift"],
    "customRules": "./team-rules.js"
  },
  "standards": {
    "naming": "kebab-case",
    "versioning": "semver",
    "documentation": "required",
    "testing": "vitest"
  },
  "reporting": {
    "formats": ["markdown", "json"],
    "teamTemplate": "./templates/team-report.md"
  }
}
```

### Plugin Configuration

#### Custom Plugin Directory

```json
{
  "plugins": {
    "custom": "./plugins",
    "enabled": ["protocol", "security", "custom-validator"],
    "config": {
      "custom-validator": {
        "rules": "./validation-rules.yaml",
        "strict": true
      }
    }
  }
}
```

#### Plugin-Specific Settings

```json
{
  "plugins": {
    "config": {
      "streaming": {
        "timeout": 10000,
        "retries": 3,
        "protocols": ["sse", "websocket"]
      },
      "security": {
        "checkCORS": true,
        "validateCertificates": true,
        "testAuthMethods": ["bearer", "basic"]
      },
      "performance": {
        "loadTestDuration": 30,
        "concurrentConnections": 10,
        "metricsInterval": 1000
      }
    }
  }
}
```

### Authentication Configuration

#### Multiple Authentication Methods

```json
{
  "authentication": {
    "methods": {
      "production": {
        "type": "bearer",
        "token": "${PROD_API_TOKEN}"
      },
      "staging": {
        "type": "basic",
        "username": "${STAGING_USER}",
        "password": "${STAGING_PASS}"
      },
      "development": {
        "type": "header",
        "headers": {
          "X-API-Key": "${DEV_API_KEY}",
          "X-Client-ID": "insula-mcp-dev"
        }
      }
    },
    "default": "development"
  }
}
```

#### OAuth2 Configuration

```json
{
  "authentication": {
    "oauth2": {
      "clientId": "${OAUTH_CLIENT_ID}",
      "clientSecret": "${OAUTH_CLIENT_SECRET}",
      "tokenUrl": "https://auth.example.com/oauth/token",
      "scopes": ["mcp:read", "mcp:diagnose"],
      "grantType": "client_credentials"
    }
  }
}
```

## Integration Patterns

### CI/CD Pipeline Integration

#### GitHub Actions

```yaml
name: MCP Quality Gate
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  mcp-diagnostics:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Insula MCP
        run: npm install -g @brainwav/insula-mcp

      - name: Run MCP Diagnostics
        run: |
          insula-mcp diagnose ${{ secrets.MCP_ENDPOINT }} \
            --auth bearer:${{ secrets.MCP_TOKEN }} \
            --full \
            --deterministic \
            --no-color \
            --out reports
        env:
          MCP_ENDPOINT: ${{ secrets.MCP_ENDPOINT }}

      - name: Upload Diagnostic Reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: mcp-diagnostic-reports
          path: reports/
          retention-days: 30

      - name: Check Quality Gate
        run: |
          # Parse findings and fail on major issues
          MAJOR_COUNT=$(jq '.findings | map(select(.severity == "major")) | length' reports/insula-findings.json)
          BLOCKER_COUNT=$(jq '.findings | map(select(.severity == "blocker")) | length' reports/insula-findings.json)
          
          echo "Found $BLOCKER_COUNT blocker(s) and $MAJOR_COUNT major issue(s)"
          
          if [ "$BLOCKER_COUNT" -gt 0 ]; then
            echo "❌ Quality gate failed: Blocker issues detected"
            exit 1
          elif [ "$MAJOR_COUNT" -gt 5 ]; then
            echo "❌ Quality gate failed: Too many major issues ($MAJOR_COUNT > 5)"
            exit 1
          else
            echo "✅ Quality gate passed"
          fi

      - name: Comment PR with Results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const findings = JSON.parse(fs.readFileSync('reports/insula-findings.json', 'utf8'));
            const report = fs.readFileSync('reports/insula-report.md', 'utf8');
            
            const summary = findings.findings.reduce((acc, f) => {
              acc[f.severity] = (acc[f.severity] || 0) + 1;
              return acc;
            }, {});
            
            const comment = `## 🔍 MCP Diagnostic Results
            
            **Summary:**
            - 🚨 Blockers: ${summary.blocker || 0}
            - ⚠️ Major: ${summary.major || 0}
            - ℹ️ Minor: ${summary.minor || 0}
            - ✅ Info: ${summary.info || 0}
            
            <details>
            <summary>Full Report</summary>
            
            \`\`\`markdown
            ${report}
            \`\`\`
            </details>`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

#### GitLab CI

```yaml
stages:
  - test
  - quality-gate

mcp-diagnostics:
  stage: quality-gate
  image: node:20-alpine
  before_script:
    - npm install -g @brainwav/insula-mcp
  script:
    - |
      insula-mcp diagnose $MCP_ENDPOINT \
        --auth bearer:$MCP_TOKEN \
        --full \
        --deterministic \
        --no-color \
        --out reports
    - |
      # Check for blockers and majors
      BLOCKER_COUNT=$(jq '.findings | map(select(.severity == "blocker")) | length' reports/insula-findings.json)
      if [ "$BLOCKER_COUNT" -gt 0 ]; then
        echo "Quality gate failed: $BLOCKER_COUNT blocker(s) found"
        exit 1
      fi
  artifacts:
    reports:
      junit: reports/insula-junit.xml
    paths:
      - reports/
    expire_in: 1 week
  only:
    - main
    - merge_requests
```

#### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    environment {
        MCP_ENDPOINT = credentials('mcp-endpoint')
        MCP_TOKEN = credentials('mcp-token')
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g @brainwav/insula-mcp'
            }
        }
        
        stage('MCP Diagnostics') {
            steps {
                sh '''
                    insula-mcp diagnose $MCP_ENDPOINT \
                        --auth bearer:$MCP_TOKEN \
                        --full \
                        --deterministic \
                        --no-color \
                        --out reports
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/**/*', fingerprint: true
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'reports',
                        reportFiles: 'insula-report.html',
                        reportName: 'MCP Diagnostic Report'
                    ])
                }
            }
        }
        
        stage('Quality Gate') {
            steps {
                script {
                    def findings = readJSON file: 'reports/insula-findings.json'
                    def blockers = findings.findings.findAll { it.severity == 'blocker' }.size()
                    def majors = findings.findings.findAll { it.severity == 'major' }.size()
                    
                    if (blockers > 0) {
                        error("Quality gate failed: ${blockers} blocker issue(s) found")
                    } else if (majors > 10) {
                        unstable("Quality gate warning: ${majors} major issue(s) found")
                    }
                    
                    echo "✅ Quality gate passed: ${blockers} blockers, ${majors} majors"
                }
            }
        }
    }
}
```

### Docker Integration

#### Dockerfile for CI

```dockerfile
FROM node:20-alpine

# Install Insula MCP
RUN npm install -g @brainwav/insula-mcp

# Create app directory
WORKDIR /app

# Copy configuration
COPY .insula-mcp.json ./

# Create reports directory
RUN mkdir -p reports

# Default command
CMD ["insula-mcp", "diagnose", "$MCP_ENDPOINT", "--config", ".insula-mcp.json", "--out", "reports"]
```

#### Docker Compose for Testing

```yaml
version: '3.8'

services:
  mcp-server:
    build: ./mcp-server
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=test
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  insula-diagnostics:
    image: node:20-alpine
    depends_on:
      mcp-server:
        condition: service_healthy
    volumes:
      - ./reports:/app/reports
      - ./.insula-mcp.json:/app/.insula-mcp.json
    working_dir: /app
    command: |
      sh -c "
        npm install -g @brainwav/insula-mcp &&
        insula-mcp diagnose http://mcp-server:3000 --config .insula-mcp.json --out reports
      "
```

### Monitoring Integration

#### Prometheus Metrics

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'insula-mcp'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

```bash
# Run with OpenTelemetry metrics export
insula-mcp diagnose https://mcp.example.com \
  --otel-exporter http://prometheus:9090/api/v1/otlp \
  --deterministic
```

#### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "MCP Diagnostic Metrics",
    "panels": [
      {
        "title": "Diagnostic Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(insula_diagnostics_total{status=\"success\"}[5m])"
          }
        ]
      },
      {
        "title": "Finding Severity Distribution",
        "type": "piechart",
        "targets": [
          {
            "expr": "sum by (severity) (insula_findings_total)"
          }
        ]
      },
      {
        "title": "Plugin Execution Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(insula_plugin_duration_seconds_bucket[5m]))"
          }
        ]
      }
    ]
  }
}
```

### IDE Integration

#### VS Code Task

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "MCP Diagnostics",
      "type": "shell",
      "command": "insula-mcp",
      "args": [
        "diagnose",
        "${input:mcpEndpoint}",
        "--out",
        "./reports",
        "--a11y"
      ],
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": {
        "pattern": {
          "regexp": "^\\[(BLOCKER|MAJOR|MINOR|INFO)\\]\\s+(.*)$",
          "severity": 1,
          "message": 2
        }
      }
    },
    {
      "label": "MCP Interactive Debug",
      "type": "shell",
      "command": "insula-mcp",
      "args": ["interactive"],
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": true,
        "panel": "new"
      }
    }
  ],
  "inputs": [
    {
      "id": "mcpEndpoint",
      "description": "MCP Server Endpoint",
      "default": "http://localhost:3000",
      "type": "promptString"
    }
  ]
}
```

#### VS Code Launch Configuration

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug MCP Server with Insula",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/server.ts",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "mcp:*"
      },
      "postDebugTask": {
        "type": "shell",
        "command": "insula-mcp",
        "args": [
          "diagnose",
          "http://localhost:3000",
          "--suites",
          "protocol,streaming",
          "--out",
          "./debug-reports"
        ]
      }
    }
  ]
}
```

### Webhook Integration

#### Slack Notifications

```bash
#!/bin/bash
# webhook-notify.sh

ENDPOINT="$1"
WEBHOOK_URL="$2"

# Run diagnostics
insula-mcp diagnose "$ENDPOINT" --out reports --deterministic

# Parse results
FINDINGS=$(cat reports/insula-findings.json)
BLOCKER_COUNT=$(echo "$FINDINGS" | jq '.findings | map(select(.severity == "blocker")) | length')
MAJOR_COUNT=$(echo "$FINDINGS" | jq '.findings | map(select(.severity == "major")) | length')

# Determine status
if [ "$BLOCKER_COUNT" -gt 0 ]; then
  STATUS="🚨 CRITICAL"
  COLOR="danger"
elif [ "$MAJOR_COUNT" -gt 0 ]; then
  STATUS="⚠️ WARNING"
  COLOR="warning"
else
  STATUS="✅ HEALTHY"
  COLOR="good"
fi

# Send Slack notification
curl -X POST -H 'Content-type: application/json' \
  --data "{
    \"attachments\": [{
      \"color\": \"$COLOR\",
      \"title\": \"MCP Diagnostic Report\",
      \"text\": \"$STATUS - Endpoint: $ENDPOINT\",
      \"fields\": [
        {\"title\": \"Blockers\", \"value\": \"$BLOCKER_COUNT\", \"short\": true},
        {\"title\": \"Major Issues\", \"value\": \"$MAJOR_COUNT\", \"short\": true}
      ]
    }]
  }" \
  "$WEBHOOK_URL"
```

#### Microsoft Teams

```javascript
// teams-webhook.js
const axios = require('axios');
const fs = require('fs');

async function sendTeamsNotification(endpoint, webhookUrl) {
  const findings = JSON.parse(fs.readFileSync('reports/insula-findings.json', 'utf8'));
  
  const summary = findings.findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});

  const card = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": summary.blocker > 0 ? "FF0000" : summary.major > 0 ? "FFA500" : "00FF00",
    "summary": `MCP Diagnostic Report for ${endpoint}`,
    "sections": [{
      "activityTitle": "🔍 MCP Diagnostic Report",
      "activitySubtitle": `Endpoint: ${endpoint}`,
      "facts": [
        {"name": "🚨 Blockers", "value": summary.blocker || 0},
        {"name": "⚠️ Major", "value": summary.major || 0},
        {"name": "ℹ️ Minor", "value": summary.minor || 0},
        {"name": "✅ Info", "value": summary.info || 0}
      ]
    }],
    "potentialAction": [{
      "@type": "OpenUri",
      "name": "View Full Report",
      "targets": [{
        "os": "default",
        "uri": "https://your-ci-system.com/reports"
      }]
    }]
  };

  await axios.post(webhookUrl, card);
}

// Usage: node teams-webhook.js <endpoint> <webhook-url>
sendTeamsNotification(process.argv[2], process.argv[3]);
```

## Output Formats

Insula MCP generates multiple output formats to serve different use cases and audiences.

### 1. Markdown Report (`insula-report.md`)

Human-readable diagnostic report optimized for developers and stakeholders.

**Structure:**

```markdown
# Insula MCP Diagnostic Report (brAInwav)

**Endpoint:** https://mcp.example.com  
**Analyzed:** 2025-11-06T21:50:59.157Z  
**Duration:** 2.3s  
**Suites:** protocol, security, streaming  

## Executive Summary

✅ **Protocol Compliance:** 8/10 checks passed  
⚠️ **Security Assessment:** 3 major issues found  
🔍 **Performance Analysis:** Within acceptable limits  

## 🚨 Critical Issues (Blockers)

*No critical issues detected.*

## ⚠️ Major Issues

### MAJOR: SSE endpoint not streaming
**Area:** streaming  
**Confidence:** high  
**Description:** Server-Sent Events endpoint returns HTTP 502 instead of streaming response.

**Evidence:**
- URL: https://mcp.example.com/events
- Response: HTTP 502 Bad Gateway
- Headers: Content-Type: text/html

**Remediation:**
1. Verify SSE endpoint implementation
2. Check reverse proxy configuration
3. Ensure proper Content-Type headers

### MAJOR: CORS policy too permissive
**Area:** security  
**Confidence:** high  
**Description:** Access-Control-Allow-Origin set to wildcard (*) allows any origin.

**Evidence:**
- Header: Access-Control-Allow-Origin: *
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Credentials: true

**Remediation:**
1. Restrict origins to specific domains
2. Remove credentials support with wildcard origin
3. Implement origin validation

## ℹ️ Minor Issues

### MINOR: No rate limiting detected
**Area:** security  
**Description:** No evidence of rate limiting mechanisms found.

**Remediation:**
- Implement rate limiting middleware
- Add X-RateLimit headers
- Consider using Redis for distributed rate limiting

## ✅ Passed Checks

- JSON-RPC 2.0 compliance
- Authentication mechanisms present
- HTTPS enforcement
- Basic security headers
- Tool enumeration working

## 📊 Metrics

- **Total Requests:** 47
- **Average Response Time:** 156ms
- **Success Rate:** 94.7%
- **Plugin Execution Time:** 1.8s

---
*Generated by Insula MCP v0.1.0 • brAInwav • Apache 2.0*
```

### 2. JSON Findings (`insula-findings.json`)

Machine-readable structured data for automation and integration.

**Schema:**

```json
{
  "endpoint": "https://mcp.example.com",
  "inspectedAt": "2025-11-06T21:50:59.157Z",
  "duration": 2300,
  "suites": ["protocol", "security", "streaming"],
  "summary": {
    "total": 15,
    "blocker": 0,
    "major": 2,
    "minor": 3,
    "info": 10
  },
  "findings": [
    {
      "id": "sse.not_streaming",
      "area": "streaming",
      "severity": "major",
      "confidence": "high",
      "title": "SSE endpoint not streaming",
      "description": "Server-Sent Events endpoint returns HTTP 502 instead of streaming response",
      "evidence": [
        {
          "type": "url",
          "ref": "https://mcp.example.com/events"
        },
        {
          "type": "response",
          "ref": {
            "status": 502,
            "headers": {
              "content-type": "text/html"
            }
          }
        }
      ],
      "remediation": [
        "Verify SSE endpoint implementation",
        "Check reverse proxy configuration",
        "Ensure proper Content-Type headers"
      ],
      "references": [
        "https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events",
        "https://html.spec.whatwg.org/multipage/server-sent-events.html"
      ]
    }
  ],
  "metrics": {
    "requests": 47,
    "averageResponseTime": 156,
    "successRate": 0.947,
    "pluginExecutionTime": 1800
  },
  "metadata": {
    "version": "0.1.0",
    "generator": "insula-mcp",
    "configuration": {
      "suites": ["protocol", "security", "streaming"],
      "budgets": {
        "time": 5000,
        "memory": 96
      }
    }
  }
}
```

### 3. ArcTDD Implementation Plan (`insula-arctdd.md`)

Test-driven development plan with prioritized remediation steps.

**Structure:**

```markdown
# ArcTDD Implementation Plan

*Generated from Insula MCP diagnostic findings*  
*Endpoint:* https://mcp.example.com  
*Priority:* High → Low  

## 🚨 Critical Issues (Immediate Action Required)

*No critical issues detected.*

## ⚠️ Major Issues (Address Before Release)

### 1. SSE Endpoint Implementation

**Problem:** SSE endpoint not streaming (HTTP 502)  
**Impact:** Breaks real-time communication with MCP clients  
**Effort:** Medium (2-4 hours)  

**Test-Driven Implementation:**

#### Red Phase (Write Failing Tests)
```javascript
// tests/sse.test.js
describe('SSE Endpoint', () => {
  test('should stream events with correct headers', async () => {
    const response = await fetch('/events');
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.status).toBe(200);
  });

  test('should send keepalive events', async () => {
    const events = await collectSSEEvents('/events', 5000);
    expect(events.some(e => e.type === 'keepalive')).toBe(true);
  });
});
```

#### Green Phase (Minimal Implementation)

```javascript
// src/routes/events.js
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send keepalive every 30 seconds
  const keepalive = setInterval(() => {
    res.write('event: keepalive\ndata: {}\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepalive);
  });
});
```

#### Refactor Phase (Optimize & Clean)

- Extract SSE utilities to separate module
- Add connection management
- Implement proper error handling
- Add metrics and logging

### 2. CORS Security Hardening

**Problem:** Overly permissive CORS policy  
**Impact:** Security vulnerability allowing any origin  
**Effort:** Low (30 minutes)  

**Test-Driven Implementation:**

#### Red Phase

```javascript
// tests/cors.test.js
describe('CORS Policy', () => {
  test('should reject unauthorized origins', async () => {
    const response = await fetch('/api/tools', {
      headers: { 'Origin': 'https://malicious.com' }
    });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('should allow authorized origins', async () => {
    const response = await fetch('/api/tools', {
      headers: { 'Origin': 'https://trusted.com' }
    });
    expect(response.headers.get('access-control-allow-origin')).toBe('https://trusted.com');
  });
});
```

#### Green Phase

```javascript
// src/middleware/cors.js
const allowedOrigins = [
  'https://app.example.com',
  'https://dashboard.example.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false
}));
```

## ℹ️ Minor Issues (Future Improvements)

### 3. Rate Limiting Implementation

**Problem:** No rate limiting detected  
**Impact:** Potential DoS vulnerability  
**Effort:** Medium (1-2 hours)  

**Implementation Steps:**

1. Add rate limiting middleware
2. Configure limits per endpoint
3. Add rate limit headers
4. Implement Redis backend for scaling

## 📋 Implementation Checklist

- [ ] **Arc 1:** SSE endpoint implementation (2-4 hours)
  - [ ] Write failing SSE tests
  - [ ] Implement basic SSE endpoint
  - [ ] Add keepalive mechanism
  - [ ] Refactor and optimize

- [ ] **Arc 2:** CORS security hardening (30 minutes)
  - [ ] Write CORS security tests
  - [ ] Implement origin validation
  - [ ] Remove wildcard permissions

- [ ] **Arc 3:** Rate limiting (1-2 hours)
  - [ ] Design rate limiting strategy
  - [ ] Implement middleware
  - [ ] Add monitoring and alerts

## 🎯 Success Criteria

**Definition of Done:**

- All tests pass
- No blocker or major findings in re-scan
- Performance impact < 5% overhead
- Documentation updated

**Validation:**

```bash
# Re-run diagnostics after implementation
insula-mcp diagnose https://mcp.example.com --full --out validation-reports

# Compare before/after
insula-mcp compare initial-findings.json validation-findings.json
```

---
*ArcTDD methodology ensures test-first development with rapid feedback cycles*

```

### 4. File Plan (`insula-fileplan.patch`)

Unified diff patches for direct code remediation.

**Format:**
```diff
--- a/src/server.js
+++ b/src/server.js
@@ -15,6 +15,18 @@ app.get('/health', (req, res) => {
   res.json({ status: 'ok' });
 });
 
+// SSE endpoint for real-time events
+app.get('/events', (req, res) => {
+  res.writeHead(200, {
+    'Content-Type': 'text/event-stream',
+    'Cache-Control': 'no-cache',
+    'Connection': 'keep-alive'
+  });
+  
+  const keepalive = setInterval(() => {
+    res.write('event: keepalive\ndata: {}\n\n');
+  }, 30000);
+  
+  req.on('close', () => clearInterval(keepalive));
+});
+
 // JSON-RPC endpoint
 app.post('/rpc', jsonrpc.middleware);

--- a/src/middleware/cors.js
+++ b/src/middleware/cors.js
@@ -1,8 +1,15 @@
 const cors = require('cors');
 
+const allowedOrigins = [
+  'https://app.example.com',
+  'https://dashboard.example.com'
+];
+
 module.exports = cors({
-  origin: '*',
-  credentials: true,
+  origin: (origin, callback) => {
+    if (!origin || allowedOrigins.includes(origin)) {
+      callback(null, true);
+    } else {
+      callback(new Error('Not allowed by CORS'));
+    }
+  },
+  credentials: false,
   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
 });
```

### 5. JUnit XML (`insula-junit.xml`)

Test results format for CI/CD integration.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Insula MCP Diagnostics" tests="15" failures="2" errors="0" time="2.3">
  <testsuite name="Protocol Compliance" tests="8" failures="0" errors="0" time="0.8">
    <testcase name="JSON-RPC 2.0 compliance" classname="protocol" time="0.1"/>
    <testcase name="Tool enumeration" classname="protocol" time="0.2"/>
    <testcase name="Batch request support" classname="protocol" time="0.1"/>
  </testsuite>
  
  <testsuite name="Security Assessment" tests="5" failures="2" errors="0" time="1.2">
    <testcase name="HTTPS enforcement" classname="security" time="0.1"/>
    <testcase name="CORS configuration" classname="security" time="0.3">
      <failure message="Overly permissive CORS policy" type="major">
        Access-Control-Allow-Origin set to wildcard (*) allows any origin
      </failure>
    </testcase>
    <testcase name="Authentication present" classname="security" time="0.2"/>
  </testsuite>
  
  <testsuite name="Streaming" tests="2" failures="1" errors="0" time="0.3">
    <testcase name="SSE endpoint availability" classname="streaming" time="0.2">
      <failure message="SSE endpoint not streaming" type="major">
        Server-Sent Events endpoint returns HTTP 502 instead of streaming response
      </failure>
    </testcase>
  </testsuite>
</testsuites>
```

### 6. SARIF Security Report (`insula-security.sarif`)

Static Analysis Results Interchange Format for security tools.

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "Insula MCP",
          "version": "0.1.0",
          "informationUri": "https://github.com/brainwav/insula-mcp"
        }
      },
      "results": [
        {
          "ruleId": "cors-wildcard-origin",
          "level": "warning",
          "message": {
            "text": "CORS policy allows any origin (*) which may lead to security vulnerabilities"
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "https://mcp.example.com"
                },
                "region": {
                  "startLine": 1,
                  "startColumn": 1
                }
              }
            }
          ],
          "properties": {
            "severity": "major",
            "confidence": "high",
            "category": "security"
          }
        }
      ]
    }
  ]
}
```

### Output Format Selection

Control which formats are generated:

```bash
# Generate all formats (default)
insula-mcp diagnose https://mcp.example.com --out reports

# Specific formats only
insula-mcp diagnose https://mcp.example.com --out reports --formats json,arctdd

# CI-optimized (minimal output)
insula-mcp diagnose https://mcp.example.com --out reports --formats json,junit

# Security-focused
insula-mcp diagnose https://mcp.example.com --out reports --formats json,sarif,arctdd
```

### Custom Output Templates

Create custom report templates:

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

Example Handlebars template:

```handlebars
# {{title}} - {{endpoint}}

**Status:** {{#if hasBlockers}}🚨 Critical{{else if hasMajors}}⚠️ Warning{{else}}✅ Healthy{{/if}}

## Summary
- Blockers: {{summary.blocker}}
- Major: {{summary.major}}
- Minor: {{summary.minor}}

{{#each findings}}
### {{severity}}: {{title}}
{{description}}

**Remediation:**
{{#each remediation}}
- {{this}}
{{/each}}
{{/each}}
```

## Common Workflows

### Development Workflow

#### 1. Building a New MCP Server

```bash
# Start with interactive guidance
insula-mcp interactive --expertise beginner

# Generate server template
insula-mcp generate template my-mcp-server \
  --lang typescript \
  --features tools,resources,authentication \
  --transport http,sse

# Develop your server...

# Test during development
insula-mcp diagnose http://localhost:3000 \
  --suites protocol,streaming \
  --out dev-reports

# Full validation before deployment
insula-mcp diagnose http://localhost:3000 --full
```

#### 2. Debugging Connection Issues

```bash
# Start with basic connectivity
insula-mcp doctor

# Run targeted diagnostics
insula-mcp diagnose https://mcp.example.com \
  --suites streaming,protocol \
  --har \
  --budget-time 15000

# Interactive debugging session
insula-mcp debug "WebSocket connection keeps dropping" \
  --errors server.log \
  --configs mcp-config.json

# Compare before/after fixes
insula-mcp compare before-fix.json after-fix.json
```

#### 3. Security Assessment

```bash
# Comprehensive security scan
insula-mcp diagnose https://mcp.example.com \
  --suites cors,auth,ratelimit,threat-model,permissioning \
  --out security-reports

# Generate security-focused documentation
insula-mcp generate docs security https://mcp.example.com \
  --format markdown \
  --out SECURITY.md

# Best practices analysis
insula-mcp best-practices https://mcp.example.com \
  --focus security,maintainability
```

#### 4. Performance Optimization

```bash
# Performance profiling
insula-mcp diagnose https://mcp.example.com \
  --suites performance-analysis,streaming \
  --budget-time 30000

# Load testing simulation
insula-mcp diagnose https://mcp.example.com \
  --simulate-external \
  --suites streaming,protocol

# Monitor with OpenTelemetry
insula-mcp diagnose https://mcp.example.com \
  --otel-exporter http://jaeger:14268 \
  --full
```

### Production Workflows

#### 1. Pre-Deployment Validation

```bash
# Staging environment validation
insula-mcp diagnose https://staging.mcp.example.com \
  --auth bearer:$STAGING_TOKEN \
  --full \
  --deterministic \
  --out staging-reports

# Production readiness check
insula-mcp best-practices https://staging.mcp.example.com \
  --focus security,performance,maintainability \
  --standards production-standards.json

# Generate deployment documentation
insula-mcp generate docs deployment ./src \
  --format markdown \
  --out DEPLOYMENT.md
```

#### 2. Continuous Monitoring

```bash
# Scheduled health checks
*/15 * * * * insula-mcp diagnose https://mcp.example.com \
  --suites protocol,streaming \
  --deterministic \
  --out /var/log/mcp-health

# Weekly comprehensive scan
0 2 * * 0 insula-mcp diagnose https://mcp.example.com \
  --full \
  --out /var/log/mcp-weekly \
  && ./notify-team.sh
```

#### 3. Incident Response

```bash
# Quick triage
insula-mcp diagnose https://mcp.example.com \
  --suites protocol,streaming \
  --budget-time 3000

# Detailed investigation
insula-mcp debug "Server returning 502 errors" \
  --errors /var/log/mcp-server.log \
  --configs /etc/mcp/config.json \
  --expertise expert

# Generate incident report
insula-mcp generate docs incident https://mcp.example.com \
  --format markdown \
  --out incident-$(date +%Y%m%d).md
```

### Team Workflows

#### 1. Code Review Integration

```bash
# Pre-commit hook
#!/bin/bash
# .git/hooks/pre-commit
if [ -f "mcp-server.js" ]; then
  echo "Running MCP diagnostics..."
  npm start &
  SERVER_PID=$!
  sleep 5
  
  insula-mcp diagnose http://localhost:3000 \
    --suites protocol,security \
    --out .git-reports \
    --deterministic
  
  RESULT=$?
  kill $SERVER_PID
  
  if [ $RESULT -ne 0 ]; then
    echo "❌ MCP diagnostics failed. Commit blocked."
    exit 1
  fi
fi
```

#### 2. Documentation Generation

```bash
# Generate team documentation
insula-mcp generate docs api ./src \
  --format markdown \
  --out docs/API.md

insula-mcp generate docs deployment ./src \
  --format markdown \
  --out docs/DEPLOYMENT.md

# Create interactive tutorial
insula-mcp tutorial "team MCP patterns" \
  --lang typescript \
  --expertise intermediate \
  --out docs/TUTORIAL.md
```

#### 3. Standards Enforcement

```bash
# Validate against team standards
insula-mcp best-practices ./src \
  --standards .team-standards.json \
  --focus protocol,security,documentation

# Generate compliance report
insula-mcp diagnose https://mcp.example.com \
  --full \
  --out compliance-reports \
  --formats json,sarif,junit
```

## Best Practices

### Development Best Practices

#### 1. Test-Driven Diagnostics

```bash
# Write diagnostic expectations first
cat > expected-findings.json << EOF
{
  "maxSeverity": "minor",
  "requiredPasses": ["protocol.jsonrpc", "streaming.sse", "security.https"],
  "allowedFindings": ["minor.rate-limit", "info.documentation"]
}
EOF

# Develop against expectations
insula-mcp diagnose http://localhost:3000 \
  --expect expected-findings.json
```

#### 2. Incremental Validation

```bash
# Start with basic protocol compliance
insula-mcp diagnose http://localhost:3000 --suites protocol

# Add streaming when ready
insula-mcp diagnose http://localhost:3000 --suites protocol,streaming

# Full validation before merge
insula-mcp diagnose http://localhost:3000 --full
```

#### 3. Evidence-Based Development

```bash
# Capture evidence during development
insula-mcp diagnose http://localhost:3000 \
  --har \
  --otel-exporter http://localhost:4318 \
  --out evidence

# Use evidence for debugging
insula-mcp debug "SSE not working" \
  --errors evidence/insula.har \
  --configs .insula-mcp.json
```

### Production Best Practices

#### 1. Layered Monitoring

```bash
# Layer 1: Basic health (every 1 minute)
insula-mcp diagnose https://mcp.example.com \
  --suites protocol \
  --budget-time 2000

# Layer 2: Comprehensive (every 15 minutes)
insula-mcp diagnose https://mcp.example.com \
  --suites protocol,streaming,security \
  --budget-time 5000

# Layer 3: Deep analysis (daily)
insula-mcp diagnose https://mcp.example.com \
  --full \
  --budget-time 30000
```

#### 2. Alerting Strategy

```bash
# Critical alerts (immediate)
if [ "$(jq '.findings | map(select(.severity == "blocker")) | length' findings.json)" -gt 0 ]; then
  alert-critical "MCP server has blocker issues"
fi

# Warning alerts (within 1 hour)
if [ "$(jq '.findings | map(select(.severity == "major")) | length' findings.json)" -gt 3 ]; then
  alert-warning "MCP server has multiple major issues"
fi
```

#### 3. Capacity Planning

```bash
# Monitor resource usage
insula-mcp diagnose https://mcp.example.com \
  --suites performance-analysis \
  --budget-time 60000 \
  --otel-exporter http://prometheus:9090

# Trend analysis
insula-mcp compare \
  reports-$(date -d '1 week ago' +%Y%m%d)/findings.json \
  reports-$(date +%Y%m%d)/findings.json
```

### Security Best Practices

#### 1. Defense in Depth

```bash
# Network security
insula-mcp diagnose https://mcp.example.com \
  --suites cors,ratelimit \
  --simulate-external

# Application security
insula-mcp diagnose https://mcp.example.com \
  --suites auth,permissioning,threat-model

# Infrastructure security
insula-mcp best-practices https://mcp.example.com \
  --focus security \
  --standards security-baseline.json
```

#### 2. Compliance Validation

```bash
# SOC 2 compliance
insula-mcp diagnose https://mcp.example.com \
  --suites security,governance \
  --standards soc2-requirements.json \
  --formats sarif,json

# GDPR compliance
insula-mcp best-practices https://mcp.example.com \
  --focus security,documentation \
  --standards gdpr-requirements.json
```

#### 3. Incident Preparedness

```bash
# Security incident playbook
insula-mcp debug "Potential security breach" \
  --errors /var/log/security.log \
  --configs /etc/mcp/security.json \
  --expertise expert \
  --out incident-response
```

## FAQ

### General Questions

**Q: What is the difference between Insula MCP and other API testing tools?**

A: Insula MCP is specifically designed for the Model Context Protocol (MCP). Unlike generic API testing tools, it understands MCP semantics, validates protocol compliance, and provides MCP-specific remediation guidance. It also includes AI-powered debugging and code generation features.

**Q: Can Insula MCP modify my MCP server?**

A: No. Insula MCP is strictly read-only and stateless. It never modifies target servers, writes data, or performs destructive operations. All analysis is performed through safe, non-mutating requests.

**Q: How accurate are the diagnostic findings?**

A: Findings include confidence levels (high, medium, low) based on evidence quality. High-confidence findings have 95%+ accuracy, while low-confidence findings are flagged for manual review. All findings include concrete evidence for verification.

### Installation & Setup

**Q: What Node.js version is required?**

A: Node.js 20.0.0 or higher is required. This ensures compatibility with modern JavaScript features and security updates.

**Q: Can I run Insula MCP in Docker?**

A: Yes. Use the official Node.js 20 Alpine image and install globally with npm. See the Docker integration section for examples.

**Q: How do I configure authentication for multiple environments?**

A: Use the configuration file with environment-specific authentication methods, or set environment variables for different deployment contexts.

### Usage & Features

**Q: Which diagnostic suites should I run for development vs. production?**

A: For development, use `protocol,streaming,devtool`. For production, use `protocol,security,governance,performance-analysis`. Use `--full` for comprehensive analysis.

**Q: How do I interpret severity levels?**

A:

- **Blocker**: Critical issues preventing MCP functionality
- **Major**: Important issues affecting reliability or security  
- **Minor**: Improvements that enhance quality
- **Info**: Informational findings and best practices

**Q: Can I create custom diagnostic plugins?**

A: Yes. Place custom plugins in the directory specified by the `plugins.custom` configuration option. See the Plugin Development guide for details.

### CI/CD Integration

**Q: What exit codes does Insula MCP return?**

A:

- **0**: Success (no blockers or majors)
- **1**: Blocker findings detected
- **2**: Major findings detected (configurable threshold)

**Q: How do I integrate with GitHub Actions?**

A: Use the provided GitHub Actions workflow examples. The tool supports deterministic output and artifact upload for CI/CD integration.

**Q: Can I fail builds based on specific findings?**

A: Yes. Use the JSON output format to parse findings and implement custom quality gates based on severity, area, or specific finding IDs.

### Troubleshooting

**Q: Diagnostics are timing out. What should I do?**

A: Increase the time budget with `--budget-time 15000` (15 seconds) or use lighter suite selection with `--suites protocol,streaming`.

**Q: I'm getting "connection refused" errors.**

A: Verify the endpoint URL, check network connectivity with `insula-mcp doctor`, and ensure the MCP server is running and accessible.

**Q: How do I debug plugin failures?**

A: Enable debug logging with `DEBUG=insula:plugin:* insula-mcp diagnose <endpoint>` to see detailed plugin execution information.

**Q: The tool reports false positives. How do I handle them?**

A: Check the confidence level and evidence. Low-confidence findings may need manual verification. You can also create custom rules to suppress known false positives.

### Advanced Usage

**Q: How do I create organization-specific standards?**

A: Create a standards JSON file defining your organization's requirements and use it with `--standards your-standards.json`. This enables custom validation rules.

**Q: Can I extend Insula MCP with custom output formats?**

A: Yes. Use custom Handlebars templates in the configuration to generate organization-specific reports, notifications, or integration formats.

**Q: How do I monitor MCP servers continuously?**

A: Set up scheduled diagnostics with cron jobs, integrate with monitoring systems using OpenTelemetry export, and use webhook notifications for alerts.

**Q: Is there an API for programmatic usage?**

A: Yes. Import Insula MCP as a library and use the programmatic API. See the API Reference documentation for details.

---

## Support & Resources

- **Documentation**: [Complete documentation suite](../README.md#documentation)
- **Interactive Help**: Run `insula-mcp interactive` for conversational assistance
- **GitHub Issues**: [Report bugs and request features](https://github.com/brainwav/insula-mcp/issues)
- **Community**: Join discussions and get help from the community

## Related Documentation

### Getting Started

- **[Getting Started Guide](./GETTING_STARTED.md)** - Installation and first steps
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Common issues and solutions

### Development

- **[API Reference](./API_REFERENCE.md)** - Complete CLI and programmatic API documentation
- **[Plugin Development](./PLUGIN_DEVELOPMENT.md)** - Creating custom diagnostic plugins
- **[IDE Integration](./IDE_INTEGRATION.md)** - Editor setup and extensions

### Operations

- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment guidance
- **[Contributing Guide](./CONTRIBUTING.md)** - Development and contribution guidelines

### Project Information

- **[Main README](../../../README.md)** - Project overview and architecture
- **[Package README](../README.md)** - Package-specific information

## License

Licensed under the [Apache License 2.0](../../../LICENSE).

---

*This guide covers the essential usage patterns for Insula MCP. For advanced topics, see the specialized documentation in the [docs directory](./README.md).*
