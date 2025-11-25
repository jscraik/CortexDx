/**
 * CortexDx ChatGPT Control Panel Server
 * 
 * HTTP server that serves the dashboard UI and API endpoints.
 * Supports MCP v2025-03-26 with Streamable HTTP and WebSocket transports.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import {
  getHealth,
  getLogs,
  getTraces,
  getMetrics,
  getAgentRuns,
  executeControl,
  getConfig,
  updateConfig,
  getProtectedResourceMetadata,
  getSessions,
  startTestFlow,
  addLog,
} from './api/handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIR = join(__dirname, 'components');

/** Port for the dashboard server */
const PORT = Number(process.env.DASHBOARD_PORT) || 5002;
const HOST = process.env.DASHBOARD_HOST || '127.0.0.1';

/** MIME types for static files */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Connected SSE clients */
const sseClients = new Set<ServerResponse>();

/** Connected WebSocket clients */
const wsClients = new Map<string, WebSocket>();
let wsClientCounter = 0;

/**
 * Parse URL and query parameters
 */
function parseUrl(url: string): { pathname: string; query: Record<string, string> } {
  const urlObj = new URL(url, 'http://localhost');
  const query: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return { pathname: urlObj.pathname, query };
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'MCP-Protocol-Version': '2025-03-26',
  });
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(res: ServerResponse, message: string, status = 400): void {
  sendJson(res, { error: message }, status);
}

/**
 * Serve static files
 */
async function serveStatic(res: ServerResponse, filepath: string): Promise<void> {
  try {
    const content = await readFile(filepath);
    const ext = filepath.slice(filepath.lastIndexOf('.'));
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

/**
 * Handle API requests
 */
async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string, query: Record<string, string>): Promise<void> {
  const method = req.method || 'GET';
  
  // GET endpoints
  if (method === 'GET') {
    switch (pathname) {
      case '/dashboard/api/health':
        return sendJson(res, getHealth());
      case '/dashboard/api/logs':
        return sendJson(res, getLogs(Number(query.limit) || 100, query.since));
      case '/dashboard/api/traces':
        return sendJson(res, getTraces(Number(query.limit) || 50));
      case '/dashboard/api/metrics':
        return sendJson(res, getMetrics());
      case '/dashboard/api/runs':
        return sendJson(res, getAgentRuns());
      case '/dashboard/api/config':
        return sendJson(res, getConfig());
      case '/dashboard/api/sessions':
        return sendJson(res, getSessions());
      default:
        return sendError(res, 'Not Found', 404);
    }
  }
  
  // POST endpoints
  if (method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      return sendError(res, 'Invalid JSON');
    }
    
    switch (pathname) {
      case '/dashboard/api/control':
        return sendJson(res, executeControl(data as Parameters<typeof executeControl>[0]));
      case '/dashboard/api/config':
        return sendJson(res, updateConfig(data as Parameters<typeof updateConfig>[0]));
      case '/dashboard/api/test-flow': {
        const flowData = data as { endpoint: string; workflow: string };
        return sendJson(res, startTestFlow(flowData.endpoint, flowData.workflow));
      }
      default:
        return sendError(res, 'Not Found', 404);
    }
  }
  
  sendError(res, 'Method Not Allowed', 405);
}

/**
 * Handle SSE connection for real-time updates
 */
function handleSSE(res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'MCP-Protocol-Version': '2025-03-26',
  });
  
  sseClients.add(res);
  addLog('debug', 'sse', 'SSE client connected');
  
  // Send initial health
  res.write(`data: ${JSON.stringify({ type: 'health', payload: getHealth() })}\n\n`);
  
  // Heartbeat
  const heartbeat = setInterval(() => {
    if (res.writable) {
      res.write(': heartbeat\n\n');
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);
  
  res.on('close', () => {
    sseClients.delete(res);
    clearInterval(heartbeat);
    addLog('debug', 'sse', 'SSE client disconnected');
  });
}

/**
 * Broadcast event to all SSE clients
 */
function broadcastSSE(type: string, payload: unknown): void {
  const message = `data: ${JSON.stringify({ type, payload })}\n\n`;
  for (const client of sseClients) {
    if (client.writable) {
      client.write(message);
    }
  }
}

/**
 * Broadcast event to all WebSocket clients
 */
function broadcastWS(type: string, payload: unknown): void {
  const message = JSON.stringify({ type, payload });
  for (const client of wsClients.values()) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

/**
 * Handle well-known endpoints
 */
function handleWellKnown(res: ServerResponse, pathname: string): void {
  if (pathname === '/.well-known/oauth-protected-resource') {
    sendJson(res, getProtectedResourceMetadata());
  } else if (pathname === '/.well-known/mcp.json') {
    sendJson(res, {
      '@context': 'https://modelcontextprotocol.io/schema/2025-03-26',
      protocol_version: '2025-03-26',
      name: 'CortexDx Control Panel',
      version: '0.1.0',
      capabilities: {
        resources: true,
        tools: true,
        prompts: false,
      },
    });
  } else {
    sendError(res, 'Not Found', 404);
  }
}

/**
 * Main request handler
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { pathname, query } = parseUrl(req.url || '/');
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }
  
  // Well-known endpoints
  if (pathname.startsWith('/.well-known/')) {
    handleWellKnown(res, pathname);
    return;
  }
  
  // SSE endpoint
  if (pathname === '/events' || pathname === '/dashboard/events') {
    handleSSE(res);
    return;
  }
  
  // API endpoints
  if (pathname.startsWith('/dashboard/api/')) {
    await handleApi(req, res, pathname, query);
    return;
  }
  
  // Dashboard UI routes
  if (pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard/') {
    await serveStatic(res, join(COMPONENTS_DIR, 'dashboard.html'));
    return;
  }
  
  // Static files
  if (pathname.startsWith('/dashboard/')) {
    const filename = pathname.replace('/dashboard/', '');
    await serveStatic(res, join(COMPONENTS_DIR, filename));
    return;
  }
  
  // Health check
  if (pathname === '/health') {
    sendJson(res, getHealth());
    return;
  }
  
  // Metrics endpoint (Prometheus format would go here)
  if (pathname === '/metrics') {
    const metrics = getMetrics();
    const prometheusFormat = metrics.metrics
      .map(m => `${m.name}{} ${m.value}`)
      .join('\n');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(prometheusFormat);
    return;
  }
  
  // Default to dashboard
  await serveStatic(res, join(COMPONENTS_DIR, 'dashboard.html'));
}

/**
 * Setup WebSocket server
 */
function setupWebSocket(server: ReturnType<typeof createServer>): void {
  const wss = new WebSocketServer({ server, path: '/mcp' });
  
  wss.on('connection', (ws) => {
    const clientId = `ws-${++wsClientCounter}`;
    wsClients.set(clientId, ws);
    addLog('debug', 'websocket', `WebSocket client connected: ${clientId}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notification',
      params: {
        type: 'welcome',
        protocolVersion: '2025-03-26',
        serverInfo: {
          name: 'CortexDx Control Panel',
          version: '0.1.0',
        },
      },
    }));
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleWebSocketMessage(ws, clientId, message);
      } catch {
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error' },
        }));
      }
    });
    
    ws.on('close', () => {
      wsClients.delete(clientId);
      addLog('debug', 'websocket', `WebSocket client disconnected: ${clientId}`);
    });
    
    ws.on('error', (error) => {
      addLog('error', 'websocket', `WebSocket error: ${error.message}`);
    });
  });
}

/**
 * Handle WebSocket message
 */
function handleWebSocketMessage(ws: WebSocket, _clientId: string, message: { jsonrpc: string; id?: string | number; method: string; params?: unknown }): void {
  const { method, id, params } = message;
  
  // Handle JSON-RPC methods
  switch (method) {
    case 'initialize':
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          serverInfo: {
            name: 'CortexDx Control Panel',
            version: '0.1.0',
          },
          capabilities: {
            tools: {},
            resources: {},
          },
        },
      }));
      break;
      
    case 'ping':
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: { status: 'ok', timestamp: new Date().toISOString() },
      }));
      break;
      
    case 'health/get':
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: getHealth(),
      }));
      break;
      
    case 'logs/list':
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: getLogs(),
      }));
      break;
      
    case 'traces/list':
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: getTraces(),
      }));
      break;
      
    case 'metrics/get':
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: getMetrics(),
      }));
      break;
      
    case 'runs/list':
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: getAgentRuns(),
      }));
      break;
      
    case 'control/execute':
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: executeControl(params as Parameters<typeof executeControl>[0]),
      }));
      break;
      
    default:
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      }));
  }
}

/**
 * Start the dashboard server
 */
export function startDashboardServer(): Server {
  const server = createServer(handleRequest);
  setupWebSocket(server);
  
  server.listen(PORT, HOST, () => {
    console.log("\n🔬 CortexDx Control Panel");
    console.log(`   Dashboard: http://${HOST}:${PORT}/dashboard`);
    console.log(`   Health:    http://${HOST}:${PORT}/health`);
    console.log(`   Metrics:   http://${HOST}:${PORT}/metrics`);
    console.log(`   WebSocket: ws://${HOST}:${PORT}/mcp`);
    console.log("   Protocol:  MCP v2025-03-26");
    console.log("\n   Press Ctrl+C to stop\n");
  });
  
  // Broadcast health updates periodically
  setInterval(() => {
    const health = getHealth();
    broadcastSSE('health', health);
    broadcastWS('health', health);
  }, 10000);
  
  // Broadcast metrics updates
  setInterval(() => {
    const metrics = getMetrics();
    broadcastSSE('metrics', metrics);
    broadcastWS('metrics', metrics);
  }, 5000);
  
  return server;
}

// Start server if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startDashboardServer();
}

export { broadcastSSE, broadcastWS };
