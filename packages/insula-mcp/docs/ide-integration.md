# IDE Integration Guide

This guide explains how to integrate Insula MCP with popular IDEs for real-time MCP validation and assistance.

## Overview

Insula MCP provides IDE integration through the Model Context Protocol (MCP), enabling:

- **Real-time validation** of MCP implementations
- **Inline suggestions** and diagnostics
- **Automated fix applications** via quick fixes
- **Context-aware code completion** for MCP tools, resources, and prompts
- **Interactive debugging** with conversational assistance

## Supported IDEs

- Visual Studio Code (via MCP extension)
- IntelliJ IDEA / WebStorm / PyCharm (via MCP plugin)
- Vim/Neovim (via MCP LSP adapter)
- Sublime Text (via MCP package)
- Any editor supporting Language Server Protocol (LSP)

## Quick Start

### 1. Start Insula MCP Server

```bash
cd packages/insula-mcp
pnpm build
node dist/server.js --port 3000
```

The server will start and listen for IDE connections on port 3000.

### 2. Configure Your IDE

#### Visual Studio Code

1. Install the MCP extension from the marketplace
2. Add to your `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "insula": {
      "url": "http://localhost:3000",
      "transport": "http"
    }
  },
  "mcp.enableDiagnostics": true,
  "mcp.enableCompletions": true,
  "mcp.enableQuickFixes": true
}
```

3. Reload VS Code

#### IntelliJ IDEA

1. Install the MCP plugin from JetBrains Marketplace
2. Go to Settings → Tools → MCP
3. Add server configuration:
   - Name: Insula MCP
   - URL: <http://localhost:3000>
   - Transport: HTTP

4. Enable features:
   - ☑ Real-time diagnostics
   - ☑ Code completions
   - ☑ Quick fixes
   - ☑ Refactoring support

#### Vim/Neovim

Using `coc.nvim`:

```vim
" Add to coc-settings.json
{
  "languageserver": {
    "insula-mcp": {
      "command": "node",
      "args": ["path/to/insula-mcp/dist/server.js", "--stdio"],
      "filetypes": ["typescript", "javascript", "python"],
      "rootPatterns": ["package.json", "pyproject.toml"]
    }
  }
}
```

Using native LSP (Neovim 0.5+):

```lua
-- Add to init.lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

configs.insula_mcp = {
  default_config = {
    cmd = {'node', 'path/to/insula-mcp/dist/server.js', '--stdio'},
    filetypes = {'typescript', 'javascript', 'python'},
    root_dir = lspconfig.util.root_pattern('package.json', 'pyproject.toml'),
  },
}

lspconfig.insula_mcp.setup{}
```

## Available MCP Tools

Insula MCP exposes the following tools for IDE integration:

### `ide_validate_code`

Validates MCP code in real-time.

**Input:**

```json
{
  "code": "string",
  "filePath": "string",
  "language": "typescript" | "javascript" | "python" | "go",
  "cursorPosition": { "line": 0, "column": 0 }
}
```

**Output:**

```json
{
  "diagnostics": [...],
  "suggestions": [...],
  "quickFixes": [...]
}
```

### `ide_get_suggestions`

Gets context-aware code suggestions.

**Input:**

```json
{
  "code": "string",
  "filePath": "string",
  "cursorPosition": { "line": 0, "column": 0 },
  "context": {
    "prefix": "string",
    "suffix": "string"
  }
}
```

### `ide_apply_quick_fix`

Applies an automated fix to the code.

**Input:**

```json
{
  "code": "string",
  "filePath": "string",
  "fixId": "string",
  "diagnosticCode": "string"
}
```

**Output:**

```json
{
  "modifiedCode": "string",
  "changes": [...]
}
```

### `ide_get_completions`

Gets code completion suggestions.

**Input:**

```json
{
  "code": "string",
  "cursorPosition": { "line": 0, "column": 0 },
  "triggerCharacter": "."
}
```

### `ide_format_code`

Formats MCP code according to best practices.

**Input:**

```json
{
  "code": "string",
  "language": "typescript" | "javascript" | "python" | "go",
  "options": {
    "indentSize": 2,
    "useTabs": false,
    "lineWidth": 80
  }
}
```

### `ide_analyze_project`

Analyzes entire MCP project for issues.

**Input:**

```json
{
  "projectRoot": "string",
  "includeTests": true,
  "depth": "quick" | "standard" | "deep"
}
```

### `ide_generate_tests`

Generates test cases for MCP code.

**Input:**

```json
{
  "code": "string",
  "filePath": "string",
  "testFramework": "vitest" | "jest" | "mocha" | "pytest",
  "coverage": "basic" | "standard" | "comprehensive"
}
```

## Features

### Real-time Diagnostics

Insula MCP provides real-time validation as you type:

- **Protocol compliance** checking
- **JSON-RPC 2.0** validation
- **Tool schema** validation
- **Error handling** detection
- **Best practices** suggestions

Example diagnostics:

```typescript
// ❌ Error: JSON-RPC version must be "2.0"
const request = {
  jsonrpc: "1.0", // Wrong version
  method: "tools/list"
};

// ✅ Fixed
const request = {
  jsonrpc: "2.0",
  method: "tools/list"
};
```

### Inline Suggestions

Get context-aware suggestions while coding:

```typescript
// Type "tools." and get completions:
tools.list()     // List all available tools
tools.call()     // Call a specific tool
tools.schema()   // Get tool schema
```

### Quick Fixes

Apply automated fixes with one click:

```typescript
// Before: Missing inputSchema
export const myTool = {
  name: "my_tool",
  description: "Does something"
};

// After: Quick fix applied
export const myTool = {
  name: "my_tool",
  description: "Does something",
  inputSchema: {
    type: "object",
    properties: {},
  }
};
```

### Code Actions

Available code actions:

- **Add inputSchema** to MCP tools
- **Fix JSON-RPC version** to 2.0
- **Add error handling** to async functions
- **Extract tool definition** to separate file
- **Generate tests** for tools
- **Format code** according to standards

### Hover Information

Hover over MCP symbols to see:

- **Documentation** from MCP specification
- **Type information** and signatures
- **Usage examples**
- **Related resources**

### Refactoring Support

Supported refactorings:

- **Rename** tools, resources, prompts
- **Extract function** from tool implementation
- **Inline** tool definitions
- **Move** tools to different files
- **Convert** between tool formats

## Configuration

### Server Configuration

Configure the Insula MCP server in `mcp-server.config.json`:

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
    "enableRefactoring": true,
    "diagnosticDelay": 500,
    "completionTriggers": [".", ":", "/"],
    "maxSuggestions": 20
  },
  "validation": {
    "strictMode": false,
    "checkProtocolCompliance": true,
    "checkBestPractices": true,
    "checkSecurity": true
  }
}
```

### IDE-Specific Settings

#### VS Code

```json
{
  "mcp.insula.diagnosticLevel": "all",
  "mcp.insula.suggestionDelay": 300,
  "mcp.insula.autoFix": true,
  "mcp.insula.formatOnSave": true
}
```

#### IntelliJ

```properties
insula.mcp.diagnostic.level=all
insula.mcp.suggestion.delay=300
insula.mcp.auto.fix=true
insula.mcp.format.on.save=true
```

## Troubleshooting

### Connection Issues

**Problem:** IDE cannot connect to Insula MCP server

**Solutions:**

1. Verify server is running: `curl http://localhost:3000/health`
2. Check firewall settings
3. Try different transport (stdio vs http vs websocket)
4. Check IDE logs for connection errors

### Slow Diagnostics

**Problem:** Diagnostics are slow or delayed

**Solutions:**

1. Increase `diagnosticDelay` in configuration
2. Disable unused features
3. Use "quick" analysis depth for large projects
4. Check server resource usage

### Missing Completions

**Problem:** Code completions not appearing

**Solutions:**

1. Verify `enableCompletions` is true
2. Check trigger characters configuration
3. Ensure cursor is in valid completion context
4. Restart IDE and server

### Quick Fixes Not Working

**Problem:** Quick fixes not available or not applying

**Solutions:**

1. Verify `enableQuickFixes` is true
2. Check diagnostic has associated fix
3. Ensure file is writable
4. Check server logs for errors

## Performance

Insula MCP IDE integration is optimized for performance:

- **Diagnostics:** < 500ms for typical files
- **Completions:** < 200ms response time
- **Quick fixes:** < 100ms to apply
- **Project analysis:** < 5s for standard depth

## Security

IDE integration follows security best practices:

- **Local-first:** All processing occurs locally
- **No data transmission:** Code never sent to external services
- **Sandboxed execution:** Plugins run in isolated workers
- **Secure transport:** HTTPS/WSS support for remote connections

## Examples

### Example 1: Real-time Validation

```typescript
// As you type, Insula MCP validates your code
export const weatherTool = {
  name: "get_weather",
  description: "Gets weather information",
  // ⚠️ Warning: Missing inputSchema
  async handler(params) {
    // ⚠️ Warning: Add error handling
    const response = await fetch(`/weather?city=${params.city}`);
    return response.json();
  }
};

// Apply quick fixes to resolve warnings
```

### Example 2: Code Completion

```typescript
// Type "tools." to see available methods
const tools = mcpServer.tools.
//                            ^ Completions appear:
//                              - list()
//                              - call(name, params)
//                              - register(tool)
//                              - unregister(name)
```

### Example 3: Refactoring

```typescript
// Select tool definition and choose "Extract to file"
// Before:
const myTool = { name: "my_tool", ... };

// After: Automatically creates tools/my-tool.ts
import { myTool } from "./tools/my-tool.js";
```

## Advanced Usage

### Custom Validation Rules

Add custom validation rules in `.insula/rules.json`:

```json
{
  "rules": {
    "require-tool-description": {
      "severity": "warning",
      "message": "All tools should have descriptions"
    },
    "max-tool-params": {
      "severity": "error",
      "value": 10,
      "message": "Tools should have at most 10 parameters"
    }
  }
}
```

### Custom Quick Fixes

Register custom quick fixes:

```typescript
import { registerQuickFix } from "insula-mcp/ide";

registerQuickFix({
  id: "add-validation",
  title: "Add input validation",
  diagnosticCodes: ["missing-validation"],
  apply: (code, diagnostic) => {
    // Return modified code
  }
});
```

### Workspace Integration

Insula MCP integrates with workspace features:

- **Multi-root workspaces:** Analyze multiple projects
- **Workspace symbols:** Search across all MCP definitions
- **Workspace diagnostics:** Project-wide issue detection
- **Workspace refactoring:** Rename across files

## Contributing

To contribute IDE integration improvements:

1. Follow the [AGENTS.md](../AGENTS.md) guidelines
2. Test with multiple IDEs
3. Ensure LSP compliance
4. Add tests for new features
5. Update documentation

## Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [Insula MCP Documentation](../README.md)
- [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md)

## License

Apache 2.0 - See [LICENSE](../LICENSE) for details.
