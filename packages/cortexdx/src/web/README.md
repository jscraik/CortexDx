# CortexDx Web Interface

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../../../../LICENSE)
[![WCAG](https://img.shields.io/badge/WCAG-2.2%20AA-green.svg)](https://www.w3.org/WAI/WCAG22/quickref/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://www.ecma-international.org/)

A minimal, accessible web-based interface for visual MCP development and debugging.

## Overview

The CortexDx Web Interface provides a browser-based UI for interacting with MCP servers, running diagnostics, and receiving AI-powered development assistance. Built with vanilla JavaScript and no framework dependencies, it offers a lightweight and performant development experience.

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

- Select LLM backend (Ollama)
- Choose model for assistance
- Set expertise level (beginner, intermediate, expert)
- Configuration persists in browser localStorage

## Real-Time Features

The interface uses Server-Sent Events (SSE) for real-time updates:

- Connection status monitoring
- Live diagnostic progress updates
- Real-time collaboration notifications

## Getting Started

### Prerequisites

- CortexDx server installed and configured
- Modern web browser with ES6+ support
- Node.js 20.0.0+ (for development)

### Installation

The web interface is included with the CortexDx installation and built automatically during the build process:

```bash
# From the CortexDx root directory
pnpm install
pnpm build
```

### Usage

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

The web interface is designed with accessibility as a priority:

- ✅ WCAG 2.2 AA compliant
- ✅ Keyboard navigation support
- ✅ Screen reader friendly
- ✅ Semantic HTML structure
- ✅ Clear visual hierarchy
- ✅ High contrast color schemes
- ✅ Focus indicators for all interactive elements

## Browser Support

- Modern browsers with ES6+ support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development

### Project Structure

```
src/web/
├── index.html        # Main HTML file
├── styles.css        # Global styles
├── app.js           # Main application logic
├── api.js           # API communication layer
└── README.md        # This file
```

### Building

The web interface is built as part of the main build process:

```bash
pnpm build
```

Web assets are automatically copied to `dist/web/` during build.

### Local Development

For rapid development, you can serve the web directory directly:

```bash
# Start the server in development mode
pnpm server

# Open http://localhost:5000 in your browser
```

Changes to HTML, CSS, and JavaScript files will require a browser refresh to see updates.

## Configuration

The web interface can be configured through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `CORTEXDX_WEB_PORT` | Web server port | `5000` |
| `CORTEXDX_API_BASE_URL` | Base URL for API calls | `http://localhost:5000` |

## Contributing

Contributions to improve the web interface are welcome! When contributing:

1. Follow accessibility best practices (WCAG 2.2 AA)
2. Test across multiple browsers and screen sizes
3. Ensure keyboard navigation works correctly
4. Test with screen readers when possible
5. Update documentation for new features

See the main [Contributing Guide](../../../../CONTRIBUTING.md) for complete development setup and coding standards.

## Security Considerations

- All API calls use proper authentication headers
- Input sanitization to prevent XSS attacks
- Content Security Policy (CSP) headers
- Secure cookie handling for session management

## Troubleshooting

### Web Interface Not Loading

1. Ensure the CortexDx server is running
2. Check browser console for errors
3. Verify the correct port is being used
4. Clear browser cache and reload

### SSE Connection Issues

1. Check that the server supports Server-Sent Events
2. Verify firewall settings allow SSE connections
3. Check browser console for connection errors

## Support

For issues or questions:

- **GitHub Issues**: [CortexDx Issues](https://github.com/jscraik/CortexDx/issues)
- **Documentation**: See main [CortexDx Documentation](../../../../README.md)

## License

Licensed under the [Apache License 2.0](../../../../LICENSE)
