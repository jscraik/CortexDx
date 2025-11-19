# Authentication & Authorization

This directory contains authentication and authorization implementations for CortexDx.

## Components

### `auth0.ts`
Auth0 OAuth/OIDC integration for enterprise authentication.

- Device code flow for CLI authentication
- JWT token validation
- User profile management
- Token refresh handling

**Usage:**
```typescript
import { authenticateWithAuth0, validateAuth0Token } from './auth0.js';

// Authenticate user
const { accessToken, user } = await authenticateWithAuth0({
  domain: process.env.CORTEXDX_AUTH0_DOMAIN,
  clientId: process.env.CORTEXDX_AUTH0_CLIENT_ID,
  audience: process.env.CORTEXDX_AUTH0_AUDIENCE
});

// Validate token
const isValid = await validateAuth0Token(accessToken, {
  domain: process.env.CORTEXDX_AUTH0_DOMAIN,
  audience: process.env.CORTEXDX_AUTH0_AUDIENCE
});
```

## Configuration

Required environment variables:

```bash
# Auth0 Configuration
CORTEXDX_AUTH0_DOMAIN=your-tenant.auth0.com
CORTEXDX_AUTH0_CLIENT_ID=your-client-id
CORTEXDX_AUTH0_AUDIENCE=https://your-api-identifier
CORTEXDX_AUTH0_SCOPE=openid profile email

# Device Code Flow (for CLI)
CORTEXDX_AUTH0_DEVICE_CODE=true
CORTEXDX_AUTH0_DEVICE_CODE_ENDPOINT=https://your-tenant.auth0.com/oauth/device/code
```

## Security Considerations

1. **Token Storage**: Access tokens are NOT persisted by default. Store securely if needed.
2. **Token Expiry**: Tokens expire after 24 hours. Implement refresh logic.
3. **HTTPS Only**: Auth0 requires HTTPS in production.
4. **Scopes**: Request only the scopes your application needs.

## Testing

```bash
pnpm test tests/auth0-handshake.spec.ts
pnpm test tests/oauth-authentication.spec.ts
```

## Related

- [Auth0 Documentation](https://auth0.com/docs)
- [OAuth 2.0 Device Code Flow](https://oauth.net/2/device-flow/)
- [JWT Token Validation](https://jwt.io/)
