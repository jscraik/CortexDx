# Getting Started with CortexDx

Welcome to CortexDx, an intelligent diagnostic and development assistant for the Model Context Protocol ecosystem.

## What is CortexDx?

CortexDx is an agentic MCP server that helps you:

- **Build MCP servers** through natural language conversations
- **Debug MCP issues** with AI-powered assistance
- **Validate protocol compliance** automatically
- **Optimize performance** with real-time profiling
- **Ensure security** with automated vulnerability scanning
- **Validate licenses** for academic research integration

## Prerequisites and System Requirements

Before installing CortexDx, ensure your system meets these requirements:

### Required

- **Node.js**: Version 20.0.0 or higher
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Memory**: Minimum 4GB RAM (8GB recommended for local AI features)
- **Storage**: 500MB free disk space

### Optional (for enhanced features)

- **Local AI Models**: Ollama, MLX (Apple Silicon), or llama.cpp for offline assistance
- **Docker**: For containerized MCP server testing
- **Git**: For template generation and version control

### Checking Prerequisites

Run this command to verify your system is ready:

```bash
# Check Node.js version
node --version
# Should output v20.0.0 or higher

# Check npm availability
npm --version
# Should output version number

# Check available memory (Linux/macOS)
free -h || vm_stat | head -5

# Check disk space
df -h .
```

## Installation

### Method 1: Global Installation (Recommended)

```bash
# Install globally via npm
npm install -g @brainwav/cortexdx

# Verify installation
cortexdx --version
# Expected output: 0.1.0
```

### Method 2: Use with npx (No Installation)

```bash
# Run directly without installing
npx @brainwav/cortexdx --help

# Use for one-time diagnostics
npx @brainwav/cortexdx diagnose http://localhost:3000
```

### Method 3: Local Development

```bash
# Clone and build from source
git clone https://github.com/brainwav/cortexdx.git
cd cortexdx/packages/cortexdx
npm install
npm run build

# Run locally
npm run dev -- --help
```

## Installation Verification

After installation, verify everything works correctly:

### 1. Check Installation

```bash
cortexdx --version
```

**Expected Output:**

```text
0.1.0
```

### 2. Run Environment Check

```bash
cortexdx doctor
```

**Expected Output:**

```text
[brAInwav] Doctor: Node v20.11.1
✓ Node.js version compatible
✓ Network connectivity available
✓ Required dependencies installed
```

### 3. Test Basic Functionality

```bash
cortexdx --help
```

**Expected Output:**

```text
Usage: cortexdx [options] [command]

brAInwav • CortexDx — Diagnostic Meta-Inspector (stateless, plugin-based)

Options:
  -V, --version                    display version number
  -h, --help                       display help for command

Commands:
  diagnose [options] <endpoint>    run diagnostic suite against MCP endpoint
  interactive|i [options]          start interactive mode with conversational assistance
  generate                         code generation commands
  debug [options] <problem>        start interactive debugging session
  explain                          explain errors or MCP concepts
  best-practices|bp [options]      analyze implementation and provide best practices
  tutorial [options] <topic>       create interactive tutorial for MCP development
  doctor                           environment checks
  compare <old> <new>              show added/removed findings
  help [command]                   display help for command
```

## First-Time User Walkthrough

This section provides a step-by-step walkthrough for new users to get familiar with CortexDx.

### Step 1: Start Interactive Mode

```bash
cortexdx interactive
```

**Expected Output:**

```text
[brAInwav] CortexDx Interactive Mode
🤖 Hello! I'm your MCP development assistant.

What would you like to do today?
1. Build a new MCP server
2. Debug an existing MCP server
3. Learn about MCP concepts
4. Get help with an error

Type your choice (1-4) or describe what you need help with:
```

**Try this:** Type `1` and follow the prompts to create your first MCP server template.

### Step 2: Generate Your First MCP Server

```bash
cortexdx generate template my-first-server
```

**Expected Output:**

```text
[brAInwav] Generating MCP server template: my-first-server
✓ Created project structure
✓ Generated TypeScript server implementation
✓ Added tool definitions
✓ Created test suite
✓ Generated documentation

📁 Files created:
  my-first-server/
  ├── src/
  │   ├── index.ts
  │   ├── tools/
  │   └── types.ts
  ├── tests/
  ├── package.json
  └── README.md

🚀 Next steps:
  cd my-first-server
  npm install
  npm run dev
```

### Step 3: Test the Generated Server

```bash
cd my-first-server
npm install
npm run dev
```

**Expected Output:**

```text
[MCP Server] Starting on http://localhost:3000
[MCP Server] Available tools: echo, calculate
[MCP Server] Ready for connections
```

### Step 4: Diagnose Your Server

Open a new terminal and run:

```bash
cortexdx diagnose http://localhost:3000
```

**Expected Output:**

```text
[brAInwav] CortexDx Diagnostic Report
🔍 Analyzing: http://localhost:3000

✓ Protocol Compliance: PASS (100%)
✓ Security Scan: PASS (no vulnerabilities)
✓ Performance: PASS (avg response: 45ms)
✓ Configuration: PASS (optimal settings)

📊 Summary:
  - Total checks: 24
  - Passed: 24
  - Failed: 0
  - Warnings: 0

🎉 Your MCP server is healthy and compliant!

📁 Detailed report saved to: reports/cortexdx-report.md
```

### Step 5: Explore Advanced Features

Try these commands to explore more features:

```bash
# Get help with MCP concepts
cortexdx explain concept tools

# Debug a specific error
cortexdx debug "connection refused"

# Generate API connector
cortexdx generate connector weather-api https://api.openweathermap.org/swagger.json

# Get best practices analysis
cortexdx best-practices http://localhost:3000
```

## Common First-Time Issues and Solutions

### Issue: "Command not found: cortexdx"

**Solution:**

```bash
# Check if npm global bin is in PATH
npm config get prefix
# Add the bin directory to your PATH, or reinstall:
npm install -g @brainwav/cortexdx
```

### Issue: "Node version not supported"

**Solution:**

```bash
# Update Node.js to version 20 or higher
# Using nvm (recommended):
nvm install 20
nvm use 20

# Or download from nodejs.org
```

### Issue: "Permission denied" during installation

**Solution:**

```bash
# Use npx instead of global install:
npx @brainwav/cortexdx --help

# Or fix npm permissions:
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Issue: "Cannot connect to localhost:3000"

**Solution:**

```bash
# Make sure your MCP server is running:
cd my-first-server
npm run dev

# Check if port is available:
lsof -i :3000  # macOS/Linux
netstat -an | findstr :3000  # Windows
```

## Quick Reference

Once you've completed the walkthrough above, use these commands for daily development:

### Core Commands

#### 1. Diagnose an MCP Server

```bash
cortexdx diagnose http://localhost:3000
```

**Available Options:**

```bash
# Full diagnostic suite
cortexdx diagnose http://localhost:3000 --full

# Specific test suites
cortexdx diagnose http://localhost:3000 --suites protocol,security

# With authentication
cortexdx diagnose http://localhost:3000 --auth bearer:your-token

# Save detailed reports
cortexdx diagnose http://localhost:3000 --out ./reports --har
```

#### 2. Interactive Development Mode

```bash
cortexdx interactive
```

**Available Options:**

```bash
# Set expertise level
cortexdx interactive --expertise beginner

# Disable colors for CI/CD
cortexdx interactive --no-color
```

#### 3. Generate MCP Components

```bash
# Generate server template
cortexdx generate template my-server --lang typescript

# Generate API connector
cortexdx generate connector weather-api ./openapi.json --auth api-key

# Generate documentation
cortexdx generate docs server ./src --format markdown
```

## Key Features

### For Beginners

- **Natural Language Interface**: Describe what you want to build in plain English
- **Step-by-Step Guidance**: Interactive tutorials adapted to your skill level
- **Error Explanations**: Technical errors translated into user-friendly language
- **Automated Fixes**: Common issues resolved automatically

### For Developers

- **Protocol Validation**: 99% accuracy in detecting MCP compliance issues
- **Performance Profiling**: Millisecond-precision timing analysis
- **Security Scanning**: 95% detection accuracy for OWASP vulnerabilities
- **Code Generation**: API-to-MCP connectors in under 60 seconds

### For Teams

- **Custom Templates**: Organization-specific MCP patterns
- **Coding Standards**: Automated validation against team conventions
- **Documentation Generation**: Comprehensive docs from tool definitions
- **Compliance Tracking**: License validation for academic research

## Local-First AI

All AI assistance runs locally on your machine:

- **Privacy**: No code or data sent to external services
- **Offline**: Works without internet connectivity
- **Performance**: Sub-2-second response times
- **Flexibility**: Support for Ollama, MLX, and llama.cpp

### Setting Up Local LLM

#### Option 1: Ollama (Recommended)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3

# CortexDx will auto-detect Ollama
cortexdx interactive
```

## Common Workflows

### Building Your First MCP Server

1. Start interactive mode:

   ```bash
   cortexdx interactive
   ```

2. Describe your server:

   ```text
   I want to create an MCP server that searches academic papers
   ```

3. Follow the guided steps to:
   - Define tool specifications
   - Generate implementation code
   - Add authentication
   - Create tests

### Debugging Connection Issues

1. Run diagnostics:

   ```bash
   cortexdx diagnose http://localhost:3000 --verbose
   ```

2. Review findings and suggested fixes

3. Apply automated fixes:

   ```bash
   cortexdx fix --finding-id <id>
   ```

### Validating Protocol Compliance

```bash
# Full compliance check
cortexdx validate http://localhost:3000

# Check specific protocol version
cortexdx validate http://localhost:3000 --protocol 2024-11-05

# Test compatibility with multiple clients
cortexdx compatibility http://localhost:3000
```

## Configuration Examples

### Basic Configuration

Create `.cortexdx.json` in your project root for custom settings:

```json
{
  "llm": {
    "backend": "ollama",
    "model": "llama3"
  },
  "diagnostics": {
    "suites": ["protocol", "security", "performance"],
    "severity": "medium"
  },
  "templates": {
    "organization": "my-org",
    "conventions": {
      "naming": "kebab-case",
      "testing": "vitest"
    }
  }
}
```

### Environment Variables

Set these environment variables for global configuration:

```bash
# Local AI backend preference
export CORTEXDX_LLM_BACKEND=ollama
export CORTEXDX_LLM_MODEL=llama3

# Default output directory
export CORTEXDX_OUTPUT_DIR=./reports

# Authentication for CI/CD
export CORTEXDX_AUTH_TOKEN=your-token-here

# Disable colors in CI
export NO_COLOR=1
```

### Verification of Configuration

Test your configuration:

```bash
# Check current settings
cortexdx doctor

# Test with your configuration
cortexdx diagnose http://localhost:3000 --deterministic
```

**Expected Output with Custom Config:**

```text
[brAInwav] Using configuration: .cortexdx.json
[brAInwav] LLM Backend: ollama (llama3)
[brAInwav] Output Directory: ./reports
✓ Configuration loaded successfully
```

## Troubleshooting Common Setup Issues

### Installation Problems

#### npm install fails with permission errors

```bash
# Solution 1: Use npx instead
npx @brainwav/cortexdx --help

# Solution 2: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### "Cannot find module" errors

```bash
# Clear npm cache and reinstall
npm cache clean --force
npm install -g @brainwav/cortexdx
```

### Runtime Issues

#### "ECONNREFUSED" when diagnosing localhost

**Cause:** Target MCP server is not running

**Solution:**

```bash
# Start your MCP server first
cd your-mcp-server
npm run dev

# Then run diagnostics in another terminal
cortexdx diagnose http://localhost:3000
```

#### Slow performance or timeouts

**Cause:** Insufficient system resources or network issues

**Solution:**

```bash
# Increase timeout budgets
cortexdx diagnose http://localhost:3000 --budget-time 10000

# Run lighter test suites
cortexdx diagnose http://localhost:3000 --suites protocol
```

#### Interactive mode not responding

**Cause:** Local AI model not available

**Solution:**

```bash
# Install Ollama for local AI
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3

# Or use without AI features
cortexdx diagnose http://localhost:3000  # Non-interactive diagnostics
```

### Verification Commands

Use these commands to verify your setup is working correctly:

```bash
# 1. Check installation
cortexdx --version
# Expected: 0.1.0

# 2. Verify environment
cortexdx doctor
# Expected: Node version and dependency checks

# 3. Test basic functionality
cortexdx --help | head -5
# Expected: Usage information

# 4. Test network connectivity
curl -I http://httpbin.org/get
# Expected: HTTP/1.1 200 OK (if internet available)
```

## Next Steps

Now that you have CortexDx set up and verified, explore these guides:

### For Users

- **[User Guide](./USER_GUIDE.md)** - Comprehensive usage documentation and advanced features
- **[API Reference](./API_REFERENCE.md)** - Complete command reference and programmatic API
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Detailed problem-solving and common issues

### For Developers

- **[Plugin Development Guide](./PLUGIN_DEVELOPMENT.md)** - Create custom diagnostic plugins
- **[IDE Integration](./IDE_INTEGRATION.md)** - Set up your development environment with VS Code, IntelliJ, and more
- **[Contributing Guide](./CONTRIBUTING.md)** - Contribute to the project and development workflow

### For Teams and Operations

- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment with Docker, Kubernetes, and CI/CD
- **[Best Practices](../../../docs/BEST_PRACTICES.md)** - Team conventions and organizational standards

### Related Resources

- **[Main Project README](../../../README.md)** - Project overview and quick start
- **[Package README](../README.md)** - Package-specific information and installation

## Getting Help

If you encounter issues not covered in this guide:

### Interactive Help

```bash
# Ask questions directly
cortexdx interactive
# Then type: "I'm having trouble with..."
```

### Community Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/brainwav/cortexdx/issues)
- **Discussions**: [Community Q&A](https://github.com/brainwav/cortexdx/discussions)
- **Documentation**: All guides available in the `docs/` directory

### Self-Service Debugging

```bash
# Explain specific errors
cortexdx explain error "your error message here"

# Get concept explanations
cortexdx explain concept "MCP tools"

# Debug specific problems
cortexdx debug "cannot connect to server"
```

## License

Apache 2.0 - See LICENSE file for details
