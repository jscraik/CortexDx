# Cloudflare Integration Guide

## Overview

This guide shows how to integrate the CortexDx dashboard with Cloudflare Workers based on the [openai-apps-sdk-cloudflare-vite-template](https://github.com/Toolbase-AI/openai-apps-sdk-cloudflare-vite-template).

## Template Analysis

The Cloudflare template provides:
1. **Cloudflare Workers** backend for MCP server
2. **Vite** build setup for client
3. **Wrangler** configuration for deployment
4. **OAuth integration** with ChatGPT
5. **Environment variable** management

## Current CortexDx Architecture

```
apps/chatgpt-dashboard/
├── src/
│   ├── client/          # React app (Vite)
│   ├── server.ts        # Node.js HTTP server
│   ├── mcp-server.ts    # MCP server (@brainwav/cortexdx-server)
│   └── api/handler.ts   # API handlers
├── package.json
└── vite.config.ts
```

## Cloudflare Template Architecture

```
template/
├── src/
│   ├── client/          # React app (Vite)
│   ├── server/
│   │   └── index.ts     # Cloudflare Worker
│   └── mcp/
│       └── server.ts    # MCP server (FastMCP)
├── wrangler.toml        # Cloudflare config
└── package.json
```

## Key Differences

| Aspect | CortexDx Current | Cloudflare Template | Action Needed |
|--------|------------------|---------------------|---------------|
| **Runtime** | Node.js | Cloudflare Workers | Adapt server code |
| **MCP Server** | @brainwav/cortexdx-server | FastMCP | Already compatible |
| **Build** | Vite + Tsup | Vite + Wrangler | Add Wrangler |
| **Deployment** | Manual | `wrangler deploy` | Add wrangler.toml |
| **Environment** | .env files | Cloudflare secrets | Add secrets config |
| **OAuth** | Manual setup | Template included | Adapt OAuth flow |
| **Static Assets** | Node.js serve | Workers Assets | Update asset serving |

## Integration Steps

### 1. Add Cloudflare Dependencies

```bash
cd apps/chatgpt-dashboard
pnpm add -D wrangler @cloudflare/workers-types
```

### 2. Create Wrangler Configuration

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

# Secrets (set via wrangler secret put)
# OPENAI_CLIENT_ID
# OPENAI_CLIENT_SECRET
# DASHBOARD_AUTH_SECRET

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-kv-namespace-id"

[build]
command = "pnpm build"

[observability]
enabled = true
```

### 3. Create Cloudflare Worker Entry Point

Create `src/server/worker.ts`:

```typescript
/**
 * Cloudflare Worker entry point for CortexDx Dashboard
 * Adapts Node.js server to Workers runtime
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import {
  getHealth,
  getLogs,
  getMetrics,
  getTraces,
  getAgentRuns,
  executeControl,
  startTestFlow,
} from '../api/handler.js';

type Env = {
  SESSIONS: KVNamespace;
  OPENAI_CLIENT_ID: string;
  OPENAI_CLIENT_SECRET: string;
  DASHBOARD_AUTH_SECRET: string;
};

const app = new Hono<{ Bindings: Env }>();

// CORS for ChatGPT
app.use('/*', cors({
  origin: ['https://chatgpt.com', 'https://chat.openai.com'],
  credentials: true,
}));

// Health endpoint
app.get('/api/health', (c) => {
  return c.json(getHealth());
});

// Logs endpoint
app.get('/api/logs', (c) => {
  const limit = Number(c.req.query('limit')) || 100;
  const since = c.req.query('since');
  return c.json(getLogs(limit, since));
});

// Metrics endpoint
app.get('/api/metrics', (c) => {
  return c.json(getMetrics());
});

// Traces endpoint
app.get('/api/traces', (c) => {
  const limit = Number(c.req.query('limit')) || 50;
  return c.json(getTraces(limit));
});

// Runs endpoint
app.get('/api/runs', (c) => {
  return c.json(getAgentRuns());
});

// Control endpoint
app.post('/api/control', async (c) => {
  const body = await c.req.json();
  return c.json(executeControl(body));
});

// Test flow endpoint
app.post('/api/test-flow', async (c) => {
  const body = await c.req.json();
  return c.json(startTestFlow(body.endpoint, body.workflow));
});

// OAuth endpoints
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  
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
  
  const tokens = await tokenResponse.json();
  
  // Store session in KV
  const sessionId = crypto.randomUUID();
  await c.env.SESSIONS.put(sessionId, JSON.stringify(tokens), {
    expirationTtl: 3600, // 1 hour
  });
  
  // Redirect back to ChatGPT
  return c.redirect(`https://chatgpt.com/auth/callback?state=${state}`);
});

// Well-known endpoints
app.get('/.well-known/oauth-protected-resource', (c) => {
  return c.json({
    resource: `https://${new URL(c.req.url).host}`,
    authorization_servers: ['https://auth.openai.com'],
    scopes_supported: [
      'search.read',
      'docs.write',
      'memory.read',
      'memory.write',
      'memory.delete',
    ],
    bearer_methods_supported: ['header'],
  });
});

app.get('/.well-known/mcp.json', (c) => {
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

// Serve static files (React app)
app.get('/*', serveStatic({ root: './' }));

export default app;
```

### 4. Update Package Scripts

Update `package.json`:

```json
{
  "scripts": {
    "build": "vite build && wrangler deploy --dry-run",
    "build:client": "vite build",
    "dev": "wrangler dev",
    "dev:local": "tsx src/server.ts",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env staging",
    "deploy:production": "wrangler deploy --env production",
    "test": "vitest --run",
    "lint": "biome lint src"
  }
}
```

### 5. Add Cloudflare-Specific Dependencies

```bash
pnpm add hono
pnpm add -D @cloudflare/workers-types
```

### 6. Update Vite Config for Cloudflare

Update `vite.config.ts`:

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
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787', // Wrangler dev server
        changeOrigin: true,
      },
    },
  },
});
```

### 7. Environment Variables Setup

Create `.dev.vars` (for local development):

```bash
OPENAI_CLIENT_ID=your_client_id
OPENAI_CLIENT_SECRET=your_client_secret
DASHBOARD_AUTH_SECRET=your_secret_key
```

Set production secrets:

```bash
# Set secrets in Cloudflare
wrangler secret put OPENAI_CLIENT_ID
wrangler secret put OPENAI_CLIENT_SECRET
wrangler secret put DASHBOARD_AUTH_SECRET
```

### 8. Update TypeScript Config

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types", "vite/client"],
    // ... rest of config
  }
}
```

## Deployment Workflow

### Local Development

```bash
# Terminal 1: Start Wrangler dev server
pnpm dev

# Terminal 2: Start Vite dev server (optional, for HMR)
pnpm dev:client
```

### Staging Deployment

```bash
# Deploy to staging
pnpm deploy:staging

# Test at: https://cortexdx-dashboard-staging.workers.dev
```

### Production Deployment

```bash
# Deploy to production
pnpm deploy:production

# Available at: https://cortexdx-dashboard.workers.dev
```

## OAuth Integration

### 1. Register App in ChatGPT

1. Go to https://platform.openai.com/settings/organization/apps
2. Create new app
3. Set redirect URI: `https://your-worker.workers.dev/auth/callback`
4. Note Client ID and Secret

### 2. Configure Scopes

In ChatGPT app settings, request:
- `search.read`
- `docs.write`
- `memory.read`
- `memory.write`
- `memory.delete`

### 3. Test OAuth Flow

1. User clicks "Connect" in ChatGPT
2. Redirected to your worker's `/auth/callback`
3. Worker exchanges code for token
4. Token stored in KV
5. User redirected back to ChatGPT

## Cloudflare-Specific Optimizations

### 1. Use KV for Session Storage

```typescript
// Store session
await env.SESSIONS.put(sessionId, JSON.stringify(session), {
  expirationTtl: 3600,
});

// Retrieve session
const session = await env.SESSIONS.get(sessionId, 'json');
```

### 2. Use Durable Objects for Real-Time

For SSE/WebSocket support:

```typescript
// wrangler.toml
[[durable_objects.bindings]]
name = "DASHBOARD_SESSIONS"
class_name = "DashboardSession"
script_name = "cortexdx-dashboard"

// src/server/durable-objects.ts
export class DashboardSession {
  async fetch(request: Request) {
    // Handle WebSocket connections
  }
}
```

### 3. Use R2 for Large Assets

```toml
# wrangler.toml
[[r2_buckets]]
binding = "ASSETS"
bucket_name = "cortexdx-assets"
```

### 4. Use Workers Analytics

```typescript
// Track events
c.executionCtx.waitUntil(
  fetch('https://api.cloudflare.com/client/v4/accounts/:account/analytics', {
    method: 'POST',
    body: JSON.stringify({
      event: 'dashboard_view',
      timestamp: Date.now(),
    }),
  })
);
```

## Migration Checklist

- [ ] Install Cloudflare dependencies
- [ ] Create `wrangler.toml`
- [ ] Create `src/server/worker.ts`
- [ ] Update `package.json` scripts
- [ ] Update `vite.config.ts`
- [ ] Create `.dev.vars`
- [ ] Set production secrets
- [ ] Update TypeScript config
- [ ] Test local development
- [ ] Deploy to staging
- [ ] Register OAuth app
- [ ] Test OAuth flow
- [ ] Deploy to production
- [ ] Update DNS (if custom domain)
- [ ] Test in ChatGPT

## Differences from Template

### What We Keep from CortexDx

1. **React Router navigation** ✅
2. **Apps SDK UI components** ✅
3. **Localization (react-intl)** ✅
4. **Telemetry infrastructure** ✅
5. **Loading/error/empty states** ✅
6. **MCP server (@brainwav/cortexdx-server)** ✅

### What We Adopt from Template

1. **Cloudflare Workers runtime** 🆕
2. **Hono framework** 🆕
3. **Wrangler deployment** 🆕
4. **KV storage** 🆕
5. **OAuth flow** 🆕

### What We Adapt

1. **Server code** - Convert Node.js → Workers
2. **Static serving** - Use Workers Assets
3. **Environment vars** - Use Cloudflare secrets
4. **Session storage** - Use KV instead of memory
5. **Real-time** - Use Durable Objects for SSE/WS

## Benefits of Cloudflare Integration

### Performance
- ✅ Global edge network (low latency)
- ✅ Automatic scaling
- ✅ CDN for static assets
- ✅ HTTP/3 support

### Cost
- ✅ Free tier: 100k requests/day
- ✅ No server maintenance
- ✅ Pay-per-use pricing

### Developer Experience
- ✅ `wrangler dev` for local testing
- ✅ `wrangler deploy` for deployment
- ✅ Instant rollbacks
- ✅ Preview deployments

### Security
- ✅ DDoS protection
- ✅ WAF included
- ✅ Automatic HTTPS
- ✅ Secrets management

## Next Steps

1. **Phase 1**: Set up Cloudflare account and create worker
2. **Phase 2**: Migrate server code to Hono
3. **Phase 3**: Test locally with `wrangler dev`
4. **Phase 4**: Deploy to staging
5. **Phase 5**: Register OAuth app in ChatGPT
6. **Phase 6**: Test OAuth flow
7. **Phase 7**: Deploy to production
8. **Phase 8**: Update documentation

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Template Repository](https://github.com/Toolbase-AI/openai-apps-sdk-cloudflare-vite-template)
- [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/)

## Support

For issues:
1. Check Wrangler logs: `wrangler tail`
2. Check Cloudflare dashboard: https://dash.cloudflare.com
3. Review template examples
4. Consult Cloudflare Workers docs
