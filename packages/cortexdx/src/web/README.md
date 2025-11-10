# CortexDx Web Interface

A minimal web-based interface for visual MCP development and debugging.

## Features

### 1. Diagnose Tab

- Run diagnostics on MCP servers
- Select specific diagnostic suites (protocol, security, performance, compatibility)
- View results with severity-based color coding
- Real-time diagnostic execution

### 2. Plugins Tab

- View all available MCP providers and plugins
- Search and filter plugins
- See plugin capabilities and tool counts
- Refresh plugin list

### 3. Assistant Tab

- Conversational AI development assistant
- Natural language interaction for MCP development help
- Context-aware responses based on expertise level
- Persistent conversation history

### 4. Configuration Tab

- Select LLM backend (Ollama, MLX, llama.cpp)
- Choose model for assistance
- Set expertise level (beginner, intermediate, expert)
- Configuration persists in browser localStorage

## Real-Time Features

The interface uses Server-Sent Events (SSE) for real-time updates:

- Connection status monitoring
- Live diagnostic progress updates
- Real-time collaboration notifications

## Usage

1. Start the CortexDx server:

   ```bash
   pnpm server:prod
   ```

2. Open your browser to `http://localhost:5000`

3. Use the tabs to navigate between different features

## Architecture

- **Frontend**: Vanilla JavaScript (no framework dependencies)
- **Styling**: CSS with CSS variables for theming
- **Communication**: REST API + Server-Sent Events
- **State Management**: Browser localStorage for configuration

## Accessibility

- WCAG 2.2 AA compliant
- Keyboard navigation support
- Screen reader friendly
- Semantic HTML structure
- Clear visual hierarchy

## Browser Support

- Modern browsers with ES6+ support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development

The web interface is built as part of the main build process:

```bash
pnpm build
```

Web assets are automatically copied to `dist/web/` during build.
