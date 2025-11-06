# Getting Started with Insula MCP

Welcome to Insula MCP, an intelligent diagnostic and development assistant for the Model Context Protocol ecosystem.

## What is Insula MCP?

Insula MCP is an agentic MCP server that helps you:

- **Build MCP servers** through natural language conversations
- **Debug MCP issues** with AI-powered assistance
- **Validate protocol compliance** automatically
- **Optimize performance** with real-time profiling
- **Ensure security** with automated vulnerability scanning
- **Validate licenses** for academic research integration

## Quick Start

### Installation

```bash
# Install globally
npm install -g @brainwav/insula-mcp

# Or use with npx
npx @brainwav/insula-mcp --help
```

### Basic Usage

#### 1. Diagnose an MCP Server

```bash
insula-mcp diagnose http://localhost:3000
```

This will run a comprehensive diagnostic suite including:

- Protocol compliance validation
- Security vulnerability scanning
- Performance profiling
- Configuration analysis

#### 2. Interactive Development Mode

```bash
insula-mcp interactive
```

Start a conversational session to:

- Get help building your first MCP server
- Debug connection issues
- Generate code from natural language descriptions
- Receive step-by-step guidance

#### 3. Generate MCP Server Template

```bash
insula-mcp generate server --name my-server
```

Creates a complete MCP server template with:

- Proper tool definitions
- Error handling
- Authentication support
- Testing framework

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

# Insula MCP will auto-detect Ollama
insula-mcp interactive
```

#### Option 2: MLX (Apple Silicon)

```bash
# Install MLX
pip install mlx-lm

# Insula MCP will auto-detect MLX
insula-mcp interactive
```

## Common Workflows

### Building Your First MCP Server

1. Start interactive mode:

   ```bash
   insula-mcp interactive
   ```

2. Describe your server:

   ```
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
   insula-mcp diagnose http://localhost:3000 --verbose
   ```

2. Review findings and suggested fixes

3. Apply automated fixes:

   ```bash
   insula-mcp fix --finding-id <id>
   ```

### Validating Protocol Compliance

```bash
# Full compliance check
insula-mcp validate http://localhost:3000

# Check specific protocol version
insula-mcp validate http://localhost:3000 --protocol 2024-11-05

# Test compatibility with multiple clients
insula-mcp compatibility http://localhost:3000
```

## Configuration

Create `.insula-mcp.json` in your project root:

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

## Next Steps

- [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md)
- [API Reference](./API_REFERENCE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Best Practices](./BEST_PRACTICES.md)

## Getting Help

- **Interactive Help**: `insula-mcp interactive` and ask questions
- **Documentation**: `insula-mcp docs`
- **Examples**: `insula-mcp examples`
- **GitHub Issues**: Report bugs and request features

## License

Apache 2.0 - See LICENSE file for details
