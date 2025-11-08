# Commercial Deployment Guide

This guide covers the commercial deployment features of Insula MCP, including Auth0 integration, license tier enforcement, and billing/analytics integration.

## Overview

Insula MCP supports three deployment tiers:

- **Community Edition (Free)**: Basic diagnostic tools and core MCP validation
- **Professional Edition**: Advanced diagnostics, LLM backends, and academic validation
- **Enterprise Edition**: Full feature access, Auth0 integration, and custom plugins

## Features

### 1. Auth0 Integration

#### Configuration

Set the following environment variables:

```bash
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_AUDIENCE=your-api-audience
REQUIRE_AUTH=true
```

#### Token Validation

The server validates Auth0 JWT tokens on protected endpoints:

```typescript
// Token is extracted from Authorization header
Authorization: Bearer <your-jwt-token>
```

#### Role-Based Access Control (RBAC)

Roles and their permissions:

- **admin**: Full access to all features (wildcard `*`)
- **developer**: Access to diagnostic, code generation, and LLM features
- **viewer**: Read-only access to diagnostics and validation
- **community**: Basic diagnostics only

#### MCP Tools

- `validate_auth0_token`: Validate Auth0 JWT tokens
- `check_role_access`: Check if user role has access to specific features

### 2. License Tier Enforcement

#### Configuration

Set the following environment variables:

```bash
REQUIRE_LICENSE=true
DEFAULT_TIER=community
```

#### License Key Format

License keys can be provided via:

- HTTP header: `X-License-Key: your-license-key`
- Query parameter: `?license=your-license-key`

#### Demo License Keys

For testing purposes, the following demo keys are available:

```
community-demo-key      - Community tier
professional-demo-key   - Professional tier (expires in 1 year)
enterprise-demo-key     - Enterprise tier (expires in 1 year)
```

#### Feature Access Control

Features are automatically restricted based on license tier:

**Community Tier:**

- `basic-diagnostics`
- `protocol-validation`
- `core-mcp-tools`

**Professional Tier:**

- All Community features
- `advanced-diagnostics`
- `llm-backends`
- `academic-validation`
- `performance-profiling`
- `security-scanning`

**Enterprise Tier:**

- All features (wildcard `*`)
- `auth0-integration`
- `custom-plugins`
- `on-premises`
- `sla-support`
- `usage-analytics`

#### Rate Limiting

Rate limits are enforced per tier and feature:

**Community Tier:**

- 10 requests/hour for most features
- 5 requests/hour default

**Professional Tier:**

- 100 requests/hour for diagnostic features
- 50 requests/hour for advanced features

**Enterprise Tier:**

- Unlimited requests

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699564800000
```

#### MCP Tools

- `validate_commercial_license`: Validate license keys
- `check_feature_access`: Check if license grants access to specific features
- `check_rate_limit`: Check current rate limit status

### 3. Billing and Analytics Integration

#### Usage Tracking

All feature usage is automatically tracked for billing purposes:

```typescript
// Automatically recorded for each feature use
{
  userId: "user-123",
  organizationId: "org-456",
  feature: "advanced-diagnostics",
  timestamp: 1699564800000,
  duration: 1500,
  cost: 0.05
}
```

#### Pricing Model

**Professional Tier** (per-usage pricing):

- `diagnose_mcp_server`: $0.01 per call
- `validate_protocol`: $0.01 per call
- `advanced_diagnostics`: $0.05 per call
- `llm_backends`: $0.10 per call
- `academic_validation`: $0.05 per call
- `performance_profiling`: $0.03 per call
- `security_scanning`: $0.03 per call

**Enterprise Tier**: Flat monthly fee (no per-usage charges)

#### Analytics Metrics

The system collects comprehensive analytics:

- Active users per organization
- Total API calls
- Average response time
- Error rate
- Top features by usage
- User activity patterns

#### MCP Tools

- `track_feature_usage`: Record feature usage for billing
- `get_usage_metrics`: Retrieve usage metrics for user/organization
- `generate_billing_report`: Generate billing reports (JSON/CSV/PDF)
- `generate_compliance_report`: Generate compliance and audit reports

### 4. Admin Dashboard

#### Endpoints

**Dashboard Data:**

```
GET /admin/dashboard
Authorization: Bearer <admin-token>
```

Returns:

- Total organizations and users
- Total revenue
- Active subscriptions
- Tier distribution
- Recent activity
- Top organizations by usage/revenue

**License Management:**

```
GET /admin/licenses
Authorization: Bearer <admin-token>
```

Returns list of all licenses with details.

#### MCP Tools

- `audit_access_logs`: Audit access logs for security monitoring
- `manage_subscription`: Manage subscription upgrades/downgrades
- `configure_sso`: Configure SSO for enterprise customers
- `manage_api_keys`: Manage API keys for programmatic access

## Integration Examples

### Example 1: Authenticated Request with License

```bash
curl -X POST http://localhost:5001/mcp \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "X-License-Key: professional-demo-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "diagnose_mcp_server",
      "arguments": {
        "endpoint": "http://example.com/mcp"
      }
    }
  }'
```

### Example 2: Check License Status

```bash
curl -X POST http://localhost:5001/mcp \
  -H "X-License-Key: professional-demo-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "validate_commercial_license",
      "arguments": {
        "licenseKey": "professional-demo-key",
        "productId": "insula-mcp"
      }
    }
  }'
```

### Example 3: Generate Billing Report

```bash
curl -X POST http://localhost:5001/mcp \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "X-License-Key: enterprise-demo-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "generate_billing_report",
      "arguments": {
        "organizationId": "org-123",
        "format": "json",
        "includeBreakdown": true,
        "includeCostEstimate": true
      }
    }
  }'
```

## Security Considerations

### Token Validation

- All Auth0 tokens are validated against JWKS
- Token expiration is checked
- Audience and issuer are verified
- Signature validation is performed

### License Security

- License keys are validated server-side
- Expired licenses are rejected
- Feature access is enforced at the middleware level
- Rate limits prevent abuse

### Data Privacy

- Usage data is stored securely
- PII is handled according to data protection regulations
- Audit logs track all access attempts
- Failed authentication attempts are logged

## Monitoring and Observability

### Metrics

The system exposes the following metrics:

- Authentication success/failure rates
- License validation attempts
- Feature usage by tier
- Rate limit violations
- API response times
- Error rates

### Logging

All commercial operations are logged:

```typescript
{
  timestamp: "2024-11-07T22:00:00Z",
  userId: "user-123",
  action: "feature_access",
  feature: "advanced-diagnostics",
  success: true,
  tier: "professional",
  cost: 0.05
}
```

## Troubleshooting

### Common Issues

**401 Unauthorized:**

- Check Auth0 token is valid and not expired
- Verify `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` are correct
- Ensure token is in `Authorization: Bearer <token>` format

**402 Payment Required:**

- Verify license key is valid
- Check license has not expired
- Ensure license tier includes requested feature

**403 Forbidden:**

- Check user role has permission for the feature
- Verify license tier grants access to the feature
- Ensure admin role for admin endpoints

**429 Too Many Requests:**

- Rate limit exceeded for your tier
- Wait for rate limit reset time
- Consider upgrading to higher tier

## Production Deployment

### Environment Variables

```bash
# Auth0 Configuration
AUTH0_DOMAIN=production.auth0.com
AUTH0_CLIENT_ID=prod-client-id
AUTH0_AUDIENCE=https://api.insula-mcp.com
REQUIRE_AUTH=true

# License Configuration
REQUIRE_LICENSE=true
DEFAULT_TIER=community

# Server Configuration
PORT=5001
HOST=0.0.0.0
NODE_ENV=production
```

### Database Integration

In production, replace in-memory storage with persistent databases:

- **License Database**: PostgreSQL or MongoDB
- **Usage Tracking**: Time-series database (InfluxDB, TimescaleDB)
- **Analytics**: Data warehouse (BigQuery, Redshift)
- **Audit Logs**: Elasticsearch or CloudWatch

### Scaling Considerations

- Use Redis for rate limiting across multiple instances
- Implement distributed caching for license validation
- Use message queues for async billing event processing
- Deploy behind load balancer with session affinity

## Support

For commercial deployment support:

- Email: support@insula-mcp.com
- Documentation: https://docs.insula-mcp.com
- Enterprise Support: Available with Enterprise tier
