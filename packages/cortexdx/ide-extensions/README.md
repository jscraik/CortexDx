# CortexDx IDE Extensions

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../../../LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-blue.svg)](https://spec.modelcontextprotocol.io/)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)](https://code.visualstudio.com/)
[![IntelliJ](https://img.shields.io/badge/IntelliJ-Plugin-000000.svg)](https://www.jetbrains.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)

This directory contains IDE-specific extensions and plugins for integrating CortexDx with popular development environments, providing real-time MCP validation, code completions, and diagnostic tools.

## Available Extensions

### Visual Studio Code

Location: `vscode/`

A full-featured VS Code extension providing:

- Real-time MCP validation
- Code completions and IntelliSense
- Quick fixes and refactoring
- Project analysis tools
- Integrated debugging

**Installation:**

```bash
cd vscode
npm install
npm run compile
npm run package
code --install-extension cortexdx-vscode-1.0.0.vsix
```

### IntelliJ IDEA / WebStorm / PyCharm

Location: `intellij/`

A JetBrains plugin providing:

- Real-time inspections
- Code completions
- Intention actions (quick fixes)
- Tool window for diagnostics
- Integrated MCP server management

**Installation:**

```bash
cd intellij
./gradlew buildPlugin
# Install from Settings → Plugins → Install from disk
```

## Architecture

All IDE extensions communicate with CortexDx via the Model Context Protocol (MCP):

```
┌─────────────┐
│     IDE     │
│  Extension  │
└──────┬──────┘
       │ MCP Protocol
       │ (HTTP/WebSocket/stdio)
       ▼
┌─────────────┐
│   CortexDx    │
│  MCP Server │
└─────────────┘
```

### Communication Protocols

1. **HTTP**: REST-like requests over HTTP
2. **WebSocket**: Real-time bidirectional communication
3. **stdio**: Standard input/output for local processes

## Development

### Prerequisites

- Node.js 20.11.1+
- pnpm 9.12.2+
- IDE-specific SDKs:
  - VS Code: Extension API
  - IntelliJ: IntelliJ Platform SDK

### Building Extensions

**VS Code:**

```bash
cd vscode
npm install
npm run compile
npm run package
```

**IntelliJ:**

```bash
cd intellij
./gradlew buildPlugin
```

### Testing

**VS Code:**

```bash
cd vscode
npm test
# Or press F5 in VS Code to launch Extension Development Host
```

**IntelliJ:**

```bash
cd intellij
./gradlew runIde
```

## MCP Tools for IDE Integration

The following MCP tools are available for IDE extensions:

| Tool | Description |
|------|-------------|
| `ide_validate_code` | Real-time code validation |
| `ide_get_suggestions` | Context-aware suggestions |
| `ide_apply_quick_fix` | Apply automated fixes |
| `ide_get_diagnostics` | Get all diagnostics |
| `ide_format_code` | Format code |
| `ide_get_completions` | Code completions |
| `ide_get_hover_info` | Hover information |
| `ide_refactor_code` | Refactoring operations |
| `ide_analyze_project` | Project-wide analysis |
| `ide_generate_tests` | Test generation |

See [IDE Integration Guide](../docs/ide-integration.md) for detailed documentation.

## Configuration

### Server Configuration

Configure the CortexDx server in `mcp-server.config.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost",
    "transport": ["http", "websocket", "stdio"]
  },
  "ide": {
    "enableDiagnostics": true,
    "enableCompletions": true,
    "enableQuickFixes": true,
    "diagnosticDelay": 500
  }
}
```

### Extension Configuration

Each IDE extension has its own configuration:

**VS Code** (`.vscode/settings.json`):

```json
{
  "cortexdx.server.url": "http://localhost:3000",
  "cortexdx.diagnostics.enabled": true
}
```

**IntelliJ** (Settings → Tools → CortexDx):

- Server URL: <http://localhost:3000>
- Enable diagnostics: ✓
- Enable completions: ✓

## Contributing

To contribute IDE extension improvements:

1. Follow the guidelines in [CONTRIBUTING.md](../../../CONTRIBUTING.md) (development setup, coding standards) and [AGENTS.md](../../../AGENTS.md)
2. Test with multiple IDEs
3. Ensure MCP protocol compliance
4. Add tests for new features
5. Update documentation

## Support

For issues or questions:

- **GitHub Issues**: [CortexDx Issues](https://github.com/jscraik/CortexDx/issues)
- **Documentation**: [IDE Integration Guide](../docs/IDE_INTEGRATION.md) and main [CortexDx Documentation](../../../README.md)
- **MCP Specification**: <https://spec.modelcontextprotocol.io/>

## License

Licensed under the [Apache License 2.0](../../../LICENSE)
