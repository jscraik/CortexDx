# Auth0 & MCP API Key Setup for CortexDx

This document contains the Auth0 and MCP API key configuration details for the CortexDx diagnostic tool,
which supports dual authentication.

## Authentication Methods

CortexDx supports multiple authentication methods:

1. **Auth0 JWT Tokens** - OAuth2 client credentials flow for production systems
2. **MCP API Keys** - Static API keys for MCP server authentication  
3. **Dual Authentication** - Both Auth0 JWT + MCP API key for enhanced security

## Auth0 Application Configuration

### CortexDx Diagnostic Application

- **Application Name**: CortexDx (originally "CodexDx")
- **Application Type**: Machine to Machine
- **Client ID**: Stored in 1Password item `CortexDx • Auth0`
- **Client Secret**: Stored in 1Password item `CortexDx • Auth0`
- **Grant Types**: `client_credentials`
- **Token Endpoint Auth Method**: `client_secret_post`

### API Access Configuration

- **Audience**: `https://cortex-mcp.brainwav.io/mcp`
- **Scopes**:
  - `search.read`
  - `docs.write`
  - `memory.read`
  - `memory.write`
  - `memory.delete`
  - `code.write`
- **Client Grant ID**: `cgr_aAzB9rizVuNXxEbr`

## Environment Variables

For production use, set these environment variables:

```bash
# Auth0 credentials (managed in 1Password – never commit real secrets)
export CORTEXDX_AUTH0_DOMAIN=brainwav.uk.auth0.com
export CORTEXDX_AUTH0_CLIENT_ID="$(op read 'op://CortexDx/Auth0/Client ID')"
export CORTEXDX_AUTH0_CLIENT_SECRET="$(op read 'op://CortexDx/Auth0/Client Secret')"
export CORTEXDX_AUTH0_AUDIENCE=https://cortex-mcp.brainwav.io/mcp

# MCP API key (managed in 1Password)
export CORTEXDX_MCP_API_KEY="$(op read 'op://CortexDx/MCP API Key/password')"
```

## Usage

With the environment variables set, run diagnostics with different authentication methods:

### Auth0 Only

```bash
# Build the latest version
pnpm --dir packages/cortexdx run build

# Run diagnostic with Auth0 authentication only
node packages/cortexdx/dist/cli.js diagnose https://cortex-mcp.brainwav.io/mcp \
  --deterministic --full --out reports/auth0-only
```

### MCP API Key Only

```bash
# Run diagnostic with MCP API key only
node packages/cortexdx/dist/cli.js diagnose https://cortex-mcp.brainwav.io/mcp \
  --mcp-api-key "$CORTEXDX_MCP_API_KEY" \
  --deterministic --full --out reports/mcp-only
```

### Dual Authentication (Recommended)

```bash
# Run diagnostic with both Auth0 JWT + MCP API key
node packages/cortexdx/dist/cli.js diagnose https://cortex-mcp.brainwav.io/mcp \
  --mcp-api-key "$CORTEXDX_MCP_API_KEY" \
  --deterministic --full --out reports/dual-auth
```

## Diagnostic Results

The most recent diagnostic run (2025-11-10T15:41:55.206Z) generated reports in `reports/auth0-prod/`:

- `cortexdx-report.md` - Main diagnostic report
- `cortexdx-findings.json` - Machine-readable findings
- `cortexdx-arctdd.md` - Architecture/TDD analysis
- `cortexdx-fileplan.patch` - File plan patch

### Key Findings

The diagnostic successfully authenticated with Auth0 but encountered:

1. **Authentication Issues**: Server returned "Unauthorized: Invalid MCP API key" after successful JWT token validation
2. **SSE Endpoint Issues**: Server returned HTTP 500 for Server-Sent Events endpoint  
3. **JSON-RPC Batch Issues**: Batch responses not properly formatted as arrays
4. **Session Management**: "Session not found" errors suggesting additional session management requirements

This indicates the MCP server requires additional API keys beyond Auth0 authentication.

## Security Notes

- **Client Secret**: Store securely and never commit to version control
- **Scopes**: Minimal required scopes have been granted for diagnostic operations
- **Token Validation**: Tokens are validated against JWKS endpoint
- **Audience**: Specific to the Cortex MCP API endpoint

## Auth0 CLI Commands Used

For reference, these Auth0 CLI commands were used to set up the application:

```bash
# Create application (interactive)
auth0 apps create

# Update to machine-to-machine type
auth0 apps update <client_id_from_1password> --type m2m --grants "credentials" --auth-method "Post"

# Grant API access
auth0 api post "client-grants" --data '{
  "client_id": "<client_id_from_1password>",
  "audience": "https://cortex-mcp.brainwav.io/mcp",
  "scope": ["search.read","docs.write","memory.read","memory.write","memory.delete","code.write"]
}'
```

## Troubleshooting

If you encounter authentication issues:

1. Verify environment variables are set correctly
2. Check Auth0 application configuration in the Auth0 Dashboard
3. Ensure the client has proper grants to the Cortex-OS API
4. Validate JWT token manually using jwt.io

For additional MCP server setup issues beyond Auth0, see the main CortexDx diagnostic reports in `reports/auth0-prod/`.
