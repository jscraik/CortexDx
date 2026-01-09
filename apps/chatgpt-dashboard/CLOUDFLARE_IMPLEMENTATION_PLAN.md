# Cloudflare Implementation Plan

## Executive Summary

This plan outlines how to deploy the CortexDx Apps SDK conformant dashboard to Cloudflare Workers, combining our existing React Router + Apps SDK UI implementation with Cloudflare's edge runtime.

## Current State vs Target State

### Current (Node.js)
```
┌─────────────────────────────────────┐
│ Node.js HTTP Server (port 5002)    │
│ ├── Express/HTTP handlers          │
│ ├── SSE endpoint (/events)         │
│ ├── WebSocket (/mcp)               │
│ ├── Static files (dist/client)     │
│ └── MCP server                     │
└─────────────────────────────────────┘
```

### Target (Cloudflare Workers)
```
┌─────────────────────────────────────┐
│ Cloudflare Worker (Edge)            │
│ ├── Hono handlers                   │
│ ├── Durable Objects (SSE/WS)       │
│ ├── Workers Assets (static)        │
│ ├── KV (sessions)                  │
│ └── MCP server                     │
└─────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Setup (1-2 hours)

#### 1.1 Install Dependencies
```bash
cd apps/chatgpt-dashboard
pnpm add hono
pnpm add -D wrangler @cloudflare/workers-types
```

#### 1.2 Create Wrangler Config
Create `wrangler.toml`:
```toml
name = "cortexdx-dashboard"
main = "src/server/worker.ts"
compatibility_date = "2024-12-07"
node_compat = true

[site]
bucket = "./dist/client"

[vars]
ENVIRONMENT = "production"

[[kv_namespaces]]
binding = "SESSIONS"
id = "preview_id"
preview_id = "preview_id"

[[durable_objects.bindings]]
name = "REALTIME"
class_name = "RealtimeSession"
script_name = "cortexdx-dashboard"

[build]
command = "pnpm build:client"
```

#### 1.3 Create Development Config
Create `.dev.vars`:
```bash
OPENAI_CLIENT_ID=dev_client_id
OPENAI_CLIENT_SECRET=dev_client_secret
DASHBOARD_AUTH_SECRET=dev_secret
```

### Phase 2: Adapt Server Code (3-4 hours)

#### 2.1 Create Hono Worker
Create `src/server/worker.ts`:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Env } from './types.js';
import { apiRoutes } from './routes/api.js';
import { authRoutes } from './routes/auth.js';
import { wellKnownRoutes } from './routes/well-known.js';

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('/*', cors({
  origin: ['https://chatgpt.com', 'https://chat.openai.com'],
  credentials: true,
}));

// Routes
app.route('/api', apiRoutes);
app.route('/auth', authRoutes);
app.route('/.well-known', wellKnownRoutes);

// Static files
app.get('/*', serveStatic({ root: './' }));
app.get('/*', serveStatic({ path: './index.html' })); // SPA fallback

export default app;
```

#### 2.2 Create Route Handlers
Create `src/server/routes/api.ts`:

```typescript
import { Hono } from 'hono';
import type { Env } from '../types.js';
import {
  getHealth,
  getLogs,
  getMetrics,
  getTraces,
  getAgentRuns,
  executeControl,
  startTestFlow,
} from '../../api/handler.js';

export const apiRoutes = new Hono<{ Bindings: Env }>();

apiRoutes.get('/health', (c) => c.json(getHealth()));

apiRoutes.get('/logs', (c) => {
  const limit = Number(c.req.query('limit')) || 100;
  const since = c.req.query('since');
  return c.json(getLogs(limit, since));
});

apiRoutes.get('/metrics', (c) => c.json(getMetrics()));

apiRoutes.get('/traces', (c) => {
  const limit = Number(c.req.query('limit')) || 50;
  return c.json(getTraces(limit));
});

apiRoutes.get('/runs', (c) => c.json(getAgentRuns()));

apiRoutes.post('/control', async (c) => {
  const body = await c.req.json();
  return c.json(executeControl(body));
});

apiRoutes.post('/test-flow', async (c) => {
  const body = await c.req.json();
  return c.json(startTestFlow(body.endpoint, body.workflow));
});
```

#### 2.3 Create OAuth Routes
Create `src/server/routes/auth.ts`:

```typescript
import { Hono } from 'hono';
import type { Env } from '../types.js';

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  
  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }
  
  // Exchange code for token
  const tokenResponse = await fetch('https://api.openai.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: c.env.OPENAI_CLIENT_ID,
      client_secret: c.env.OPENAI_CLIENT_SECRET,
      redirect_uri: `${new URL(c.req.url).origin}/auth/callback`,
    }),
  });
  
  if (!tokenResponse.ok) {
    return c.json({ error: 'Token exchange failed' }, 500);
  }
  
  const tokens = await tokenResponse.json();
  
  // Store session in KV
  const sessionId = crypto.randomUUID();
  await c.env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(tokens),
    { expirationTtl: 3600 }
  );
  
  // Redirect back to ChatGPT
  return c.redirect(`https://chatgpt.com/auth/callback?state=${state}`);
});

authRoutes.get('/logout', async (c) => {
  const sessionId = c.req.header('X-Session-Id');
  if (sessionId) {
    await c.env.SESSIONS.delete(`session:${sessionId}`);
  }
  return c.json({ success: true });
});
```

#### 2.4 Create Well-Known Routes
Create `src/server/routes/well-known.ts`:

```typescript
import { Hono } from 'hono';
import type { Env } from '../types.js';

export const wellKnownRoutes = new Hono<{ Bindings: Env }>();

wellKnownRoutes.get('/oauth-protected-resource', (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json({
    resource: origin,
    authorization_servers: ['https://auth.openai.com'],
    scopes_supported: [
      'search.read',
      'docs.write',
      'memory.read',
      'memory.write',
      'memory.delete',
    ],
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://docs.brainwav.io/cortexdx',
  });
});

wellKnownRoutes.get('/mcp.json', (c) => {
  return c.json({
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
});
```

#### 2.5 Create Types
Create `src/server/types.ts`:

```typescript
export interface Env {
  // KV Namespaces
  SESSIONS: KVNamespace;
  
  // Durable Objects
  REALTIME: DurableObjectNamespace;
  
  // Secrets
  OPENAI_CLIENT_ID: string;
  OPENAI_CLIENT_SECRET: string;
  DASHBOARD_AUTH_SECRET: string;
  
  // Variables
  ENVIRONMENT: string;
}
```

### Phase 3: Real-Time Support (4-6 hours)

#### 3.1 Create Durable Object for SSE/WebSocket
Create `src/server/durable-objects/realtime.ts`:

```typescript
import type { DurableObject } from 'cloudflare:workers';

export class RealtimeSession implements DurableObject {
  private sessions: Map<string, WebSocket> = new Map();
  
  constructor(private state: DurableObjectState, private env: Env) {}
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      const sessionId = crypto.randomUUID();
      this.sessions.set(sessionId, server);
      
      server.accept();
      server.addEventListener('message', (event) => {
        this.handleMessage(sessionId, event.data);
      });
      
      server.addEventListener('close', () => {
        this.sessions.delete(sessionId);
      });
      
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }
    
    // SSE endpoint
    if (url.pathname === '/events') {
      return this.handleSSE(request);
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  private async handleSSE(request: Request): Promise<Response> {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    
    // Send initial health event
    await writer.write(
      encoder.encode(`data: ${JSON.stringify({ type: 'health', payload: {} })}\n\n`)
    );
    
    // Keep connection alive with heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await writer.write(encoder.encode(': heartbeat\n\n'));
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);
    
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
  
  private handleMessage(sessionId: string, data: string) {
    try {
      const message = JSON.parse(data);
      // Handle JSON-RPC messages
      console.log('Received message:', message);
    } catch (error) {
      console.error('Invalid message:', error);
    }
  }
  
  // Broadcast to all sessions
  broadcast(type: string, payload: unknown) {
    const message = JSON.stringify({ type, payload });
    for (const ws of this.sessions.values()) {
      ws.send(message);
    }
  }
}
```

#### 3.2 Export Durable Object
Update `src/server/worker.ts`:

```typescript
export { RealtimeSession } from './durable-objects/realtime.js';
```

### Phase 4: Update Build Configuration (1 hour)

#### 4.1 Update package.json
```json
{
  "scripts": {
    "build": "pnpm build:client && wrangler deploy --dry-run",
    "build:client": "vite build",
    "dev": "wrangler dev",
    "dev:local": "tsx src/server.ts",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env staging",
    "deploy:production": "wrangler deploy --env production",
    "tail": "wrangler tail",
    "kv:create": "wrangler kv:namespace create SESSIONS",
    "test": "vitest --run",
    "lint": "biome lint src"
  }
}
```

#### 4.2 Update vite.config.ts
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'intl': ['react-intl'],
          'ui': ['@openai/apps-sdk-ui'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/auth': 'http://localhost:8787',
      '/.well-known': 'http://localhost:8787',
    },
  },
});
```

### Phase 5: Testing (2-3 hours)

#### 5.1 Local Testing
```bash
# Terminal 1: Start Wrangler dev
pnpm dev

# Terminal 2: Test endpoints
curl http://localhost:8787/api/health
curl http://localhost:8787/.well-known/mcp.json

# Terminal 3: Test client (optional)
cd dist/client && python -m http.server 5173
```

#### 5.2 Create Test Script
Create `scripts/test-cloudflare.sh`:

```bash
#!/bin/bash

echo "Testing Cloudflare Worker..."

# Test health endpoint
echo "Testing /api/health..."
curl -s http://localhost:8787/api/health | jq

# Test well-known
echo "Testing /.well-known/oauth-protected-resource..."
curl -s http://localhost:8787/.well-known/oauth-protected-resource | jq

# Test static files
echo "Testing static files..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/

echo "Tests complete!"
```

### Phase 6: Deployment (1-2 hours)

#### 6.1 Create KV Namespace
```bash
# Create production KV
wrangler kv:namespace create SESSIONS

# Create preview KV
wrangler kv:namespace create SESSIONS --preview

# Update wrangler.toml with IDs
```

#### 6.2 Set Secrets
```bash
wrangler secret put OPENAI_CLIENT_ID
wrangler secret put OPENAI_CLIENT_SECRET
wrangler secret put DASHBOARD_AUTH_SECRET
```

#### 6.3 Deploy to Staging
```bash
pnpm deploy:staging
```

#### 6.4 Test Staging
```bash
curl https://cortexdx-dashboard-staging.workers.dev/api/health
```

#### 6.5 Deploy to Production
```bash
pnpm deploy:production
```

### Phase 7: ChatGPT Integration (2-3 hours)

#### 7.1 Register OAuth App
1. Go to https://platform.openai.com/settings/organization/apps
2. Create new app: "CortexDx Dashboard"
3. Set redirect URI: `https://cortexdx-dashboard.workers.dev/auth/callback`
4. Request scopes: search.read, docs.write, memory.*
5. Save Client ID and Secret

#### 7.2 Update Secrets
```bash
wrangler secret put OPENAI_CLIENT_ID
# Paste actual client ID

wrangler secret put OPENAI_CLIENT_SECRET
# Paste actual client secret
```

#### 7.3 Test OAuth Flow
1. Open ChatGPT
2. Try to connect to your app
3. Should redirect to your worker
4. Should exchange code for token
5. Should redirect back to ChatGPT

### Phase 8: Custom Domain (Optional, 1 hour)

#### 8.1 Add Custom Domain
```bash
wrangler domains add dashboard.cortexdx.io
```

#### 8.2 Update DNS
Add CNAME record:
```
dashboard.cortexdx.io → cortexdx-dashboard.workers.dev
```

#### 8.3 Update OAuth Redirect
Update redirect URI in ChatGPT app settings:
```
https://dashboard.cortexdx.io/auth/callback
```

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Setup | 1-2 hours | None |
| 2. Server Code | 3-4 hours | Phase 1 |
| 3. Real-Time | 4-6 hours | Phase 2 |
| 4. Build Config | 1 hour | Phase 2 |
| 5. Testing | 2-3 hours | Phase 4 |
| 6. Deployment | 1-2 hours | Phase 5 |
| 7. ChatGPT | 2-3 hours | Phase 6 |
| 8. Custom Domain | 1 hour | Phase 7 |
| **Total** | **15-22 hours** | |

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Workers runtime differences | High | Test thoroughly, use node_compat |
| SSE/WebSocket complexity | Medium | Use Durable Objects, test extensively |
| OAuth flow issues | High | Follow template exactly, test with staging |
| Build size limits | Medium | Code splitting, tree shaking |
| Cold start latency | Low | Workers are fast, use warming |

## Success Criteria

- [ ] Worker deploys successfully
- [ ] All API endpoints work
- [ ] Static files serve correctly
- [ ] OAuth flow completes
- [ ] Dashboard loads in ChatGPT
- [ ] Real-time updates work
- [ ] Performance < 100ms p95
- [ ] No errors in logs

## Rollback Plan

If deployment fails:
1. Keep Node.js server running
2. Point DNS back to Node.js
3. Debug Cloudflare issues
4. Redeploy when fixed

## Next Steps After Deployment

1. Monitor Cloudflare analytics
2. Set up alerts for errors
3. Optimize bundle size
4. Add caching strategies
5. Implement rate limiting
6. Add monitoring dashboard
7. Document deployment process
8. Train team on Cloudflare

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Hono Documentation](https://hono.dev/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [Template Repository](https://github.com/Toolbase-AI/openai-apps-sdk-cloudflare-vite-template)
