# Diagnostic Session API

## Overview

The Diagnostic Session API provides a secure, time-limited authentication mechanism for MCP-to-MCP communication, specifically designed for diagnostic operations. Instead of sharing long-lived credentials, CortexDx can request temporary API keys that grant scoped access to target MCP servers.

## Architecture

```
┌─────────────┐                          ┌─────────────────┐
│  CortexDx   │                          │  Target MCP     │
│  (Client)   │                          │   Server        │
└──────┬──────┘                          └────────┬────────┘
       │                                          │
       │ 1. Auth0 Client Credentials Flow         │
       ├─────────────────────────────────────────>│
       │    POST /api/v1/diagnostic-session/create│
       │    Authorization: Bearer <auth0-token>    │
       │    Body: {                                │
       │      requestedBy: "cortexdx",             │
       │      scope: ["read:tools", ...],          │
       │      duration: 3600                       │
       │    }                                      │
       │                                           │
       │<─────────────────────────────────────────┤
       │    200 OK                                 │
       │    {                                      │
       │      sessionId: "sess_abc123",            │
       │      apiKey: "diag_xyz789",               │
       │      expiresAt: "2025-11-15T13:00:00Z"    │
       │    }                                      │
       │                                           │
       │ 2. Use Temporary API Key for Diagnostics  │
       ├─────────────────────────────────────────>│
       │    POST /mcp                              │
       │    X-Diagnostic-Session-Key: diag_xyz789  │
       │    { method: "tools/call", ... }          │
       │                                           │
       │<─────────────────────────────────────────┤
       │    200 OK                                 │
       │    { result: { ... } }                    │
       │                                           │
       │ 3. Revoke Session (Optional)              │
       ├─────────────────────────────────────────>│
       │    POST /api/v1/diagnostic-session/       │
       │         sess_abc123/revoke                │
       │    X-Diagnostic-Session-Key: diag_xyz789  │
       │                                           │
       │<─────────────────────────────────────────┤
       │    200 OK                                 │
       │    { success: true }                      │
       │                                           │
       └───────────────────────────────────────────┘
```

## Benefits

1. **Least Privilege**: Scoped, time-limited access instead of full credentials
2. **Auditability**: Each diagnostic session is tracked with usage logs
3. **Security**: Temporary keys can be revoked mid-session if compromised
4. **Revocable**: Sessions can be manually revoked before expiration
5. **Auth0 Integration**: Initial handshake proves identity via OAuth2

## API Endpoints

### 1. Create Diagnostic Session

**Endpoint**: `POST /api/v1/diagnostic-session/create`

**Authentication**: Required (Auth0 Bearer token)

**Request Body**:
```json
{
  "requestedBy": "cortexdx",
  "scope": [
    "read:tools",
    "read:resources",
    "execute:diagnostics"
  ],
  "duration": 3600,
  "allowedEndpoints": [
    "/mcp",
    "/health",
    "/capabilities"
  ],
  "metadata": {
    "purpose": "security audit",
    "ticketId": "DIAG-12345"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "session": {
    "sessionId": "sess_abc123def456",
    "apiKey": "diag_xyz789abc012",
    "requestedBy": "cortexdx",
    "scope": ["read:tools", "read:resources", "execute:diagnostics"],
    "allowedEndpoints": ["/mcp", "/health", "/capabilities"],
    "expiresAt": "2025-11-15T13:00:00Z",
    "createdAt": "2025-11-15T12:00:00Z",
    "status": "active"
  },
  "message": "Diagnostic session created successfully. Store the apiKey securely - it will not be shown again.",
  "timestamp": "2025-11-15T12:00:00Z"
}
```

**Important**: The `apiKey` is only returned once during creation. Store it securely.

### 2. Revoke Diagnostic Session

**Endpoint**: `POST /api/v1/diagnostic-session/{sessionId}/revoke`

**Authentication**: Diagnostic session key or Auth0 token

**Headers**:
```
X-Diagnostic-Session-Key: diag_xyz789abc012
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Diagnostic session sess_abc123def456 revoked successfully",
  "timestamp": "2025-11-15T12:30:00Z"
}
```

### 3. Get Session Information

**Endpoint**: `GET /api/v1/diagnostic-session/{sessionId}`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "session": {
    "sessionId": "sess_abc123def456",
    "requestedBy": "cortexdx",
    "scope": ["read:tools", "read:resources"],
    "allowedEndpoints": ["/mcp", "/health"],
    "expiresAt": "2025-11-15T13:00:00Z",
    "createdAt": "2025-11-15T12:00:00Z",
    "status": "active"
  },
  "usage": [
    {
      "endpoint": "/mcp",
      "method": "POST",
      "timestamp": "2025-11-15T12:05:00Z",
      "ipAddress": "192.168.1.100"
    }
  ],
  "timestamp": "2025-11-15T12:30:00Z"
}
```

### 4. List Sessions

**Endpoint**: `GET /api/v1/diagnostic-session?requestedBy=cortexdx&status=active`

**Query Parameters**:
- `requestedBy` (required): Filter by requester identity
- `status` (optional): Filter by status (`active`, `revoked`, `expired`)

**Response** (200 OK):
```json
{
  "success": true,
  "sessions": [
    {
      "sessionId": "sess_abc123",
      "requestedBy": "cortexdx",
      "scope": ["read:tools"],
      "expiresAt": "2025-11-15T13:00:00Z",
      "status": "active"
    }
  ],
  "count": 1,
  "timestamp": "2025-11-15T12:30:00Z"
}
```

## Using Diagnostic Sessions

### TypeScript Example (CortexDx Client)

```typescript
import { createDiagnosticMcpClient } from '@cortexdx/cortexdx';

// Method 1: Automatic session creation
const client = await createDiagnosticMcpClient({
  targetServerUrl: 'https://target-mcp-server.example.com',
  auth0: {
    domain: 'your-tenant.auth0.com',
    clientId: 'YOUR_CLIENT_ID',
    clientSecret: 'YOUR_CLIENT_SECRET',
    audience: 'https://target-mcp-server.example.com/api'
  },
  sessionConfig: {
    requestedBy: 'cortexdx',
    scope: ['read:tools', 'read:resources', 'execute:diagnostics'],
    duration: 3600, // 1 hour
    allowedEndpoints: ['/mcp', '/health']
  }
});

// Method 2: Use existing session key
const client2 = await createDiagnosticMcpClient({
  targetServerUrl: 'https://target-mcp-server.example.com',
  diagnosticSessionKey: 'diag_xyz789abc012'
});

// Run diagnostics
const healthResult = await client.callTool('health_check', {});
const toolsList = await client.callTool('tools/list', {});

// Session will auto-expire after 1 hour
```

### curl Example

```bash
# Step 1: Get Auth0 access token
AUTH0_TOKEN=$(curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials' \
  -d 'client_id=YOUR_CLIENT_ID' \
  -d 'client_secret=YOUR_CLIENT_SECRET' \
  -d 'audience=https://target-mcp-server.example.com/api' \
  | jq -r '.access_token')

# Step 2: Create diagnostic session
SESSION_RESPONSE=$(curl -X POST https://target-mcp-server.example.com/api/v1/diagnostic-session/create \
  -H "Authorization: Bearer $AUTH0_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "requestedBy": "cortexdx",
    "scope": ["read:tools", "read:resources"],
    "duration": 3600
  }')

SESSION_KEY=$(echo $SESSION_RESPONSE | jq -r '.session.apiKey')
SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.session.sessionId')

# Step 3: Use diagnostic session for MCP calls
curl -X POST https://target-mcp-server.example.com/mcp \
  -H "X-Diagnostic-Session-Key: $SESSION_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'

# Step 4: Revoke session when done
curl -X POST https://target-mcp-server.example.com/api/v1/diagnostic-session/$SESSION_ID/revoke \
  -H "X-Diagnostic-Session-Key: $SESSION_KEY"
```

## Configuration

### Environment Variables

**Target MCP Server** (server being diagnosed):
```bash
# Enable Auth0 authentication for session creation
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_AUDIENCE=https://your-server.example.com/api
REQUIRE_AUTH=true

# Database path for diagnostic sessions (optional)
```

**CortexDx Client** (performing diagnostics):
```bash
# Auth0 configuration for creating sessions
CORTEXDX_AUTH0_DOMAIN=target-tenant.auth0.com
CORTEXDX_AUTH0_CLIENT_ID=cortexdx_client_id
CORTEXDX_AUTH0_CLIENT_SECRET=cortexdx_client_secret
CORTEXDX_AUTH0_AUDIENCE=https://target-mcp-server.example.com/api
```

## Security Considerations

### Session Key Storage

- **Never log or expose diagnostic session keys** in plaintext
- Store keys in secure credential managers (e.g., HashiCorp Vault, AWS Secrets Manager)
- Keys are hashed using SHA-256 before storage in the database

### Duration Limits

- Maximum session duration: **24 hours** (86400 seconds)
- Recommended duration: **1-4 hours** for active diagnostics
- Sessions auto-expire and are cleaned up after 30 days

### Scope Permissions

Common scope values:
- `read:tools` - List and inspect tool definitions
- `read:resources` - Access resource catalog
- `execute:diagnostics` - Run diagnostic tools
- `read:health` - Access health check endpoints
- `write:config` - Modify server configuration (admin only)

### Endpoint Restrictions

Sessions can be limited to specific endpoints:
```json
{
  "allowedEndpoints": [
    "/mcp",           // MCP protocol endpoint
    "/health",        // Health checks only
    "/capabilities",  // Read capabilities
    "/providers"      // Provider information
  ]
}
```

Wildcard support:
```json
{
  "allowedEndpoints": [
    "/api/v1/*",     // All v1 API endpoints
    "/mcp"           // Specific endpoint
  ]
}
```

## Session Lifecycle

```
┌─────────┐  create   ┌────────┐  use   ┌────────┐  expire  ┌─────────┐
│ Pending ├──────────>│ Active ├───────>│ Active ├─────────>│ Expired │
└─────────┘           └────┬───┘        └───┬────┘          └─────────┘
                           │                 │
                           │ revoke          │ revoke
                           │                 │
                           v                 v
                      ┌─────────┐       ┌─────────┐
                      │ Revoked │       │ Revoked │
                      └─────────┘       └─────────┘
```

### Automatic Cleanup

- **Expired sessions**: Marked as `expired` when accessed after expiration
- **Old sessions**: Deleted after 30 days (configurable)
- **Cleanup interval**: Runs every 1 hour

## Monitoring and Auditing

### Usage Tracking

Every request using a diagnostic session is logged:
```sql
SELECT * FROM session_usage WHERE session_id = 'sess_abc123' ORDER BY timestamp DESC;
```

Fields tracked:
- `endpoint` - Endpoint accessed
- `method` - HTTP method (GET, POST, etc.)
- `timestamp` - Request time
- `ip_address` - Client IP address
- `user_agent` - Client user agent

### Alerts

Monitor for suspicious activity:
- Multiple failed validation attempts
- Session keys used from unexpected IP addresses
- Unusually high request volume from a single session
- Sessions used after revocation attempts

## Migration from Static API Keys

### Before (Static API Key)
```typescript
const client = new HttpMcpClient({
  baseUrl: 'https://target-server.example.com',
  apiKey: 'static-api-key-12345' // Long-lived, high privilege
});
```

### After (Diagnostic Session)
```typescript
const client = await createDiagnosticMcpClient({
  targetServerUrl: 'https://target-server.example.com',
  auth0: { /* config */ },
  sessionConfig: {
    requestedBy: 'cortexdx',
    scope: ['read:tools'], // Scoped permissions
    duration: 3600          // Time-limited
  }
});
```

## Troubleshooting

### Common Errors

**401 Unauthorized - "Invalid diagnostic session"**
- Session key is incorrect or malformed
- Session has expired
- Session has been revoked

**401 Unauthorized - "Authentication required"**
- Missing `X-Diagnostic-Session-Key` header
- Auth0 token required for session creation

**401 Unauthorized - "Endpoint not allowed"**
- The endpoint being accessed is not in the `allowedEndpoints` list
- Check session configuration

**400 Bad Request - "Duration cannot exceed 86400 seconds"**
- Requested session duration is too long
- Maximum is 24 hours (86400 seconds)

### Debug Mode

Enable debug logging:
```typescript
const sessionManager = getDiagnosticSessionManager();
console.log('Validating session key...');
const validation = sessionManager.validateSession(apiKey, '/mcp');
console.log('Validation result:', validation);
```

## Best Practices

1. **Use shortest necessary duration**: Request 1-2 hour sessions for active work
2. **Revoke when done**: Manually revoke sessions after diagnostics complete
3. **Monitor usage**: Regularly audit session usage logs
4. **Rotate Auth0 credentials**: Rotate client secrets periodically
5. **Scope appropriately**: Only request necessary permissions
6. **Endpoint whitelist**: Limit to specific endpoints when possible
7. **Secure storage**: Never commit session keys to version control

## Related Documentation

- [AUTH0_SETUP.md](./AUTH0_SETUP.md) - Auth0 configuration guide
- [MCP Protocol Specification](https://modelcontextprotocol.io/docs/specification)
- [CortexDx Security Model](./SECURITY.md)
