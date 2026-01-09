# Connecting CortexDx to ChatGPT with Auth0

This guide walks you through securing your MCP server with Auth0 and connecting it to ChatGPT.

## Prerequisites

- Auth0 account ([sign up free](https://auth0.com/signup))
- Auth0 CLI installed: `brew install auth0/auth0-cli/auth0`
- Cloudflared installed: `brew install cloudflared`
- CortexDx server running locally

## Part 1: Auth0 Setup

### 1.1 Login to Auth0 CLI

```bash
auth0 login
```

This will open your browser to authenticate with your Auth0 tenant.

### 1.2 Create an API (Resource Server)

This represents your MCP Server as a protected resource.

```bash
auth0 apis create \
  --name "CortexDx MCP Server" \
  --identifier "https://api.cortexdx.dev" \
  --offline-access
```

**Save the API Identifier** (e.g., `https://api.cortexdx.dev`) - you'll need this for `AUTH0_AUDIENCE`.

### 1.3 Define Permissions (Scopes)

Add scopes that represent what ChatGPT can do with your MCP server:

```bash
# Get your API ID first
auth0 apis list

# Add scopes
auth0 apis scopes create \
  --api-id <YOUR_API_ID> \
  --name "execute:tools" \
  --description "Execute MCP tools"

auth0 apis scopes create \
  --api-id <YOUR_API_ID> \
  --name "read:diagnostics" \
  --description "Read diagnostic information"

auth0 apis scopes create \
  --api-id <YOUR_API_ID> \
  --name "read:health" \
  --description "Read health status"
```

### 1.4 Create an Application (Client)

This represents ChatGPT as a client that will authenticate users and call your API.

```bash
auth0 apps create \
  --name "ChatGPT CortexDx" \
  --type regular \
  --auth-method post \
  --callbacks "https://chat.openai.com/aip/plugin-callback" \
  --web-origins "https://chat.openai.com" \
  --reveal-secrets
```

**Important:** Save the following from the output:
- **Client ID**
- **Client Secret**

### 1.5 Verify Configuration

```bash
# List your APIs
auth0 apis list

# List your applications
auth0 apps list

# View API details
auth0 apis show <YOUR_API_ID>
```

## Part 2: Configure CortexDx Server

### 2.1 Update Environment Variables

Copy `.env.example` to `.env` if you haven't already:

```bash
cd /Users/jamiecraik/CortexDx
cp .env.example .env
```

Edit `.env` and update the Auth0 section:

```env
# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=<CLIENT_ID_FROM_STEP_1.4>
AUTH0_AUDIENCE=https://api.cortexdx.dev

# CortexDx-specific Auth0 configuration
CORTEXDX_AUTH0_DOMAIN=your-tenant.us.auth0.com
CORTEXDX_AUTH0_CLIENT_ID=<CLIENT_ID_FROM_STEP_1.4>
CORTEXDX_AUTH0_CLIENT_SECRET=<CLIENT_SECRET_FROM_STEP_1.4>
CORTEXDX_AUTH0_AUDIENCE=https://api.cortexdx.dev
CORTEXDX_AUTH0_SCOPE=openid profile email execute:tools read:diagnostics read:health

# Enable authentication
REQUIRE_AUTH=true
```

### 2.2 Verify Auth Plugin Configuration

Check that `packages/server/src/index.ts` is configured to use the auth plugin:

```typescript
import { createAuthPlugin } from './mcp-server/plugins/auth.js';

const server = new McpServer({
  name: 'CortexDx MCP Server',
  version: '0.1.0',
  // ... other config
});

// Register auth plugin
server.use(createAuthPlugin({
  requireAuth: process.env.REQUIRE_AUTH === 'true',
  publicEndpoints: ['initialize', 'ping'],
  adminRoles: ['admin'],
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
  }
}));
```

### 2.3 Restart the Server

```bash
pnpm --filter @brainwav/cortexdx-server start
```

## Part 3: Expose Server via Cloudflare Tunnel

### 3.1 Start a Quick Tunnel

For development/testing, use a quick tunnel:

```bash
cloudflared tunnel --url http://localhost:5001
```

You'll see output like:
```
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://random-name-1234.trycloudflare.com
```

**Copy this URL** - you'll need it for ChatGPT configuration.

### 3.2 (Optional) Create a Named Tunnel

For production, create a persistent named tunnel:

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create cortexdx

# Configure the tunnel
cat > ~/.cloudflared/config.yml <<EOF
tunnel: cortexdx
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: cortexdx.yourdomain.com
    service: http://localhost:5001
  - service: http_status:404
EOF

# Run the tunnel
cloudflared tunnel run cortexdx
```

## Part 4: Test Authentication Locally

Before connecting to ChatGPT, verify Auth0 is working:

### 4.1 Get a Test Token

```bash
# Using Auth0 CLI
auth0 test token \
  --audience https://api.cortexdx.dev \
  --scope "execute:tools read:diagnostics"
```

### 4.2 Test the MCP Server

```bash
# Test with the token
curl -X POST https://random-name-1234.trycloudflare.com/mcp \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

You should get a successful response with your tools list.

## Part 5: Connect to ChatGPT

### 5.1 Create a GPT

1. Go to [ChatGPT](https://chat.openai.com)
2. Click **Explore** → **Create a GPT**
3. Configure the basics:
   - **Name:** CortexDx Diagnostics
   - **Description:** AI Engineering Dashboard & MCP Server Diagnostics
   - **Instructions:** "You are a helpful assistant that can diagnose MCP servers, run security scans, and provide health metrics using the CortexDx tools."

### 5.2 Configure Actions

1. Click **Configure** → **Actions** → **Create new action**
2. **Authentication:**
   - Type: **OAuth**
   - Client ID: `<CLIENT_ID_FROM_STEP_1.4>`
   - Client Secret: `<CLIENT_SECRET_FROM_STEP_1.4>`
   - Authorization URL: `https://your-tenant.us.auth0.com/authorize`
   - Token URL: `https://your-tenant.us.auth0.com/oauth/token`
   - Scope: `openid profile email execute:tools read:diagnostics read:health`

3. **Schema:**
   - Import from URL: `https://random-name-1234.trycloudflare.com/mcp/openapi.json` (if you have this endpoint)
   - OR manually define your tools using OpenAPI 3.0 format

### 5.3 Manual Schema Example

If you don't have an auto-generated schema, here's a template:

```yaml
openapi: 3.0.0
info:
  title: CortexDx MCP Server
  version: 0.1.0
servers:
  - url: https://random-name-1234.trycloudflare.com/mcp
paths:
  /tools/call:
    post:
      operationId: callTool
      summary: Execute an MCP tool
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                jsonrpc:
                  type: string
                  enum: ["2.0"]
                method:
                  type: string
                  enum: ["tools/call"]
                params:
                  type: object
                  properties:
                    name:
                      type: string
                      description: Tool name to execute
                    arguments:
                      type: object
                      description: Tool arguments
      responses:
        '200':
          description: Tool execution result
```

## Part 6: Verify the Connection

### 6.1 Test in ChatGPT

Ask your GPT:
- "Check the system health"
- "Run diagnostics on the MCP server"
- "What tools are available?"

### 6.2 Monitor Logs

Watch your server logs to see requests coming in:

```bash
# In your CortexDx directory
pnpm --filter @brainwav/cortexdx-server start
```

You should see:
- Authentication events
- Tool execution logs
- Session connect/disconnect events

## Troubleshooting

### Issue: "Authentication required" error

**Solution:** Verify your Auth0 configuration:
```bash
# Check if token is valid
auth0 test token --audience https://api.cortexdx.dev --decode
```

### Issue: CORS errors in ChatGPT

**Solution:** Update CORS configuration in `.env`:
```env
ALLOWED_ORIGINS=https://chat.openai.com,http://localhost:5001
```

### Issue: Tunnel disconnects

**Solution:** Use a named tunnel instead of quick tunnel (see Part 3.2).

### Issue: Token validation fails

**Solution:** Ensure your Auth0 domain and audience match exactly:
```bash
# Verify API configuration
auth0 apis show <YOUR_API_ID>
```

## Security Best Practices

1. **Use HTTPS only** - Never expose your MCP server over HTTP in production
2. **Rotate secrets regularly** - Update your Auth0 client secret periodically
3. **Limit scopes** - Only grant the minimum required permissions
4. **Monitor access** - Review Auth0 logs regularly
5. **Use named tunnels** - For production, avoid quick tunnels
6. **Enable rate limiting** - Protect against abuse

## Next Steps

- Set up role-based access control (RBAC) in Auth0
- Configure custom claims for fine-grained permissions
- Add monitoring and alerting for authentication failures
- Implement token refresh for long-running sessions
- Set up a custom domain for your tunnel

## Resources

- [Auth0 Documentation](https://auth0.com/docs)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [OpenAI GPT Actions](https://platform.openai.com/docs/actions)
- [MCP Specification](https://modelcontextprotocol.io)
