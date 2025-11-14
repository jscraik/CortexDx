/**
 * Studio Wrapper - stdio transport bridge for MCP Inspector
 *
 * This wrapper allows MCP Inspector (which expects stdio transport) to communicate
 * with HTTP-based MCP servers like CortexDx. It translates between:
 *
 * MCP Inspector stdio ←→ JSON-RPC 2.0 ←→ HTTP requests to MCP server
 */

import { createRequire } from 'node:module';

// JSON-RPC 2.0 type definitions
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

const require = createRequire(import.meta.url);

interface StdioWrapperConfig {
  endpoint: string;
  timeout?: number;
  headers?: Record<string, string>;
  verbose?: boolean;
}

class StudioWrapper {
  private config: StdioWrapperConfig;
  private requestId = 1;

  constructor(config: StdioWrapperConfig) {
    this.config = {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CortexDx-Studio-Wrapper/1.0.0',
      },
      verbose: false,
      ...config,
    };
  }

  /**
   * Main stdio loop - reads from stdin, makes HTTP calls, writes to stdout
   */
  async start(): Promise<void> {
    if (this.config.verbose) {
      console.error(`[StudioWrapper] Starting with endpoint: ${this.config.endpoint}`);
    }

    // Set up stdin handling
    process.stdin.setEncoding('utf8');
    process.stdin.resume();

    let buffer = '';

    process.stdin.on('data', (chunk: string) => {
      buffer += chunk;

      // Try to parse complete JSON-RPC messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(line.trim());
        }
      }
    });

    process.stdin.on('end', () => {
      if (buffer.trim()) {
        this.handleMessage(buffer.trim());
      }
      if (this.config.verbose) {
        console.error('[StudioWrapper] stdin closed, exiting');
      }
    });

    process.on('SIGINT', () => {
      if (this.config.verbose) {
        console.error('[StudioWrapper] Received SIGINT, exiting gracefully');
      }
      process.exit(0);
    });
  }

  /**
   * Handle individual JSON-RPC message
   */
  private async handleMessage(line: string): Promise<void> {
    try {
      if (!line || (line[0] !== '{' && line[0] !== '[')) {
        if (this.config.verbose) {
          console.error(`[StudioWrapper] Ignoring non-JSON line: ${line}`);
        }
        return;
      }

      const request: JsonRpcRequest = JSON.parse(line);

      if (this.config.verbose) {
        console.error(`[StudioWrapper] Received request: ${JSON.stringify(request)}`);
      }

      const response = await this.processRequest(request);

      if (this.config.verbose) {
        console.error(`[StudioWrapper] Sending response: ${JSON.stringify(response)}`);
      }

      // Write response to stdout
      process.stdout.write(`${JSON.stringify(response)}\n`);

    } catch (error) {
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
          data: error instanceof Error ? error.message : String(error),
        },
      };

      if (this.config.verbose) {
        console.error(`[StudioWrapper] Parse error: ${error}`);
      }

      process.stdout.write(`${JSON.stringify(errorResponse)}\n`);
    }
  }

  /**
   * Process JSON-RPC request by making HTTP call to MCP server
   */
  private async processRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: request.id,
    };

    try {
      // Build HTTP request URL and method
      const httpMethod = this.mapMethodToHttp(request.method);
      const url = this.buildUrl(request.method);

      if (this.config.verbose) {
        console.error(`[StudioWrapper] HTTP ${httpMethod} ${url}`);
      }

      // Make HTTP request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const fetchOptions: RequestInit = {
        method: httpMethod,
        headers: {
          ...this.config.headers,
        },
        signal: controller.signal,
      };

      // Add body for POST requests
      if (httpMethod === 'POST' && request.params) {
        fetchOptions.body = JSON.stringify(request.params);
      }

      const httpResponse = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!httpResponse.ok) {
        throw new Error(`HTTP ${httpResponse.status}: ${httpResponse.statusText}`);
      }

      // Parse response
      const contentType = httpResponse.headers.get('content-type');
      let result: unknown;

      if (contentType?.includes('application/json')) {
        result = await httpResponse.json();
      } else {
        const text = await httpResponse.text();
        try {
          result = JSON.parse(text);
        } catch {
          result = text;
        }
      }

      response.result = result;

    } catch (error) {
      let errorCode = -32603; // Internal error
      let errorMessage = 'Internal error';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorCode = -32603;
          errorMessage = 'Request timeout';
        } else if (error.message.includes('HTTP 404')) {
          errorCode = -32601; // Method not found
          errorMessage = 'Method not found';
        } else if (error.message.includes('HTTP 400')) {
          errorCode = -32602; // Invalid params
          errorMessage = 'Invalid params';
        } else {
          errorMessage = error.message;
        }
      }

      response.error = {
        code: errorCode,
        message: errorMessage,
        data: error instanceof Error ? error.stack : String(error),
      };

      if (this.config.verbose) {
        console.error(`[StudioWrapper] Request failed: ${errorMessage}`);
      }
    }

    return response;
  }

  /**
   * Map JSON-RPC method to HTTP method and endpoint
   */
  private mapMethodToHttp(method: string): string {
    // Common MCP methods
    switch (method) {
      case 'initialize':
      case 'tools/call':
      case 'tools/list':
        return 'POST';

      case 'tools/get':
      case 'resources/list':
      case 'resources/read':
      case 'prompts/list':
      case 'prompts/get':
        return 'GET';

      default:
        // Default to POST for unknown methods
        return 'POST';
    }
  }

  /**
   * Build URL from JSON-RPC method
   */
  private buildUrl(method: string): string {
    const baseUrl = this.config.endpoint.replace(/\/$/, '');

    // Map common MCP methods to REST endpoints
    const methodMap: Record<string, string> = {
      'initialize': '/mcp/initialize',
      'tools/list': '/mcp/tools',
      'tools/call': '/mcp/tools/call',
      'tools/get': '/mcp/tools',
      'resources/list': '/mcp/resources',
      'resources/read': '/mcp/resources',
      'prompts/list': '/mcp/prompts',
      'prompts/get': '/mcp/prompts',
    };

    // Check for direct mapping
    if (methodMap[method]) {
      return baseUrl + methodMap[method];
    }

    // Handle dynamic method patterns
    if (method.startsWith('tools/call/')) {
      const toolName = method.replace('tools/call/', '');
      return `${baseUrl}/mcp/tools/${toolName}/call`;
    }

    if (method.startsWith('tools/get/')) {
      const toolName = method.replace('tools/get/', '');
      return `${baseUrl}/mcp/tools/${toolName}`;
    }

    if (method.startsWith('resources/read/')) {
      const resourceUri = method.replace('resources/read/', '');
      return `${baseUrl}/mcp/resources?uri=${encodeURIComponent(resourceUri)}`;
    }

    // Default: try to use method as path
    return `${baseUrl}/mcp/${method}`;
  }
}

/**
 * Parse command line arguments and start wrapper
 */
function parseArgs(): StdioWrapperConfig {
  const args = process.argv.slice(2);

  const config: StdioWrapperConfig = {
    endpoint: 'http://127.0.0.1:5001/mcp',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--endpoint':
      case '-e': {
        const endpoint = args[++i];
        if (endpoint) {
          config.endpoint = endpoint;
        }
        break;
      }

      case '--timeout':
      case '-t': {
        const timeoutArg = args[++i];
        if (timeoutArg) {
          const timeoutSec = +timeoutArg;
          if (!Number.isNaN(timeoutSec) && timeoutSec > 0) {
            config.timeout = timeoutSec * 1000;
          } else {
            console.warn(`Invalid timeout value: "${timeoutArg}". Timeout must be a positive integer.`);
          }
        }
        break;
      }

      case '--verbose':
      case '-v':
        config.verbose = true;
        break;

      case '--header':
      case '-H': {
        const headerArg = args[++i];
        if (headerArg) {
          const headerParts = headerArg.split(':', 2);
          if (headerParts.length === 2 && headerParts[0] && headerParts[1]) {
            config.headers = config.headers || {};
            config.headers[headerParts[0].trim()] = headerParts[1].trim();
          }
        }
        break;
      }

      case '--help':
      case '-h':
        console.log(`
Studio Wrapper - stdio transport bridge for MCP Inspector

Usage: studio-wrapper [options]

Options:
  -e, --endpoint <url>    MCP server endpoint (default: http://127.0.0.1:5001/mcp)
  -t, --timeout <sec>     Request timeout in seconds (default: 30)
  -H, --header <header>   Add HTTP header (format: "Name: Value")
  -v, --verbose          Enable verbose logging
  -h, --help             Show this help message

Examples:
  studio-wrapper --endpoint http://localhost:3000/mcp --verbose
  studio-wrapper -e https://mcp.example.com -t 60 -H "Authorization: Bearer token"

The wrapper reads JSON-RPC 2.0 requests from stdin, makes HTTP calls to the
specified MCP server, and writes responses to stdout in JSON-RPC 2.0 format.
        `);
        process.exit(0);
        break;

      default:
        if (arg && (arg.startsWith('http://') || arg.startsWith('https://'))) {
          config.endpoint = arg;
        } else {
          console.error(`Unknown argument: ${arg}`);
          process.exit(1);
        }
    }
  }

  return config;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const config = parseArgs();
    const wrapper = new StudioWrapper(config);
    await wrapper.start();
  } catch (error) {
    console.error('Studio wrapper failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { StudioWrapper, type StdioWrapperConfig };
