/**
 * Commercial Feature MCP Tools
 * Provides MCP tool definitions for authentication, licensing, usage tracking, and billing
 * Requirements: 7.1, 10.5, 12.1
 */

import type { McpTool } from "../types";

export const createCommercialFeatureTools = (): McpTool[] => [
  {
    name: "validate_auth0_token",
    description:
      "Validate Auth0 authentication token and retrieve user information. Supports OAuth 2.0 and OpenID Connect.",
    inputSchema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "Auth0 JWT token to validate",
        },
        audience: {
          type: "string",
          description: "Expected token audience (optional)",
        },
        issuer: {
          type: "string",
          description: "Expected token issuer (optional)",
        },
        validateExpiration: {
          type: "boolean",
          description: "Validate token expiration (default: true)",
        },
        validateSignature: {
          type: "boolean",
          description: "Validate token signature (default: true)",
        },
      },
      required: ["token"],
    },
  },
  {
    name: "check_role_access",
    description:
      "Check if user role has access to specific feature or resource. Implements role-based access control (RBAC).",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User ID to check access for",
        },
        role: {
          type: "string",
          description: "User role (e.g., 'admin', 'developer', 'viewer')",
        },
        feature: {
          type: "string",
          description: "Feature or resource to check access for",
        },
        action: {
          type: "string",
          enum: ["read", "write", "execute", "admin"],
          description: "Action to check permission for (default: read)",
        },
      },
      required: ["userId", "role", "feature"],
    },
  },
  {
    name: "validate_commercial_license",
    description:
      "Validate commercial license key and check feature access entitlements. Supports offline validation.",
    inputSchema: {
      type: "object",
      properties: {
        licenseKey: {
          type: "string",
          description: "Commercial license key to validate",
        },
        productId: {
          type: "string",
          description: "Product ID for license validation",
        },
        checkExpiration: {
          type: "boolean",
          description: "Check license expiration (default: true)",
        },
        checkFeatureAccess: {
          type: "boolean",
          description: "Check feature access entitlements (default: true)",
        },
        offlineMode: {
          type: "boolean",
          description: "Perform offline validation (default: false)",
        },
      },
      required: ["licenseKey", "productId"],
    },
  },
  {
    name: "check_feature_access",
    description:
      "Check if license tier grants access to specific feature. Supports feature-based licensing.",
    inputSchema: {
      type: "object",
      properties: {
        licenseKey: {
          type: "string",
          description: "License key to check",
        },
        feature: {
          type: "string",
          description:
            "Feature to check access for (e.g., 'advanced_diagnostics', 'llm_backends', 'academic_validation')",
        },
        licenseTier: {
          type: "string",
          enum: ["community", "professional", "enterprise"],
          description:
            "License tier (optional, will be determined from key if not provided)",
        },
      },
      required: ["licenseKey", "feature"],
    },
  },
  {
    name: "track_feature_usage",
    description:
      "Track usage of features for billing and analytics. Records API calls, resource consumption, and feature utilization.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User ID for usage tracking",
        },
        feature: {
          type: "string",
          description: "Feature being used",
        },
        action: {
          type: "string",
          description: "Specific action performed",
        },
        metadata: {
          type: "object",
          description:
            "Additional metadata about usage (e.g., duration, resources consumed)",
        },
        timestamp: {
          type: "string",
          description: "Usage timestamp (ISO 8601, defaults to current time)",
        },
      },
      required: ["userId", "feature", "action"],
    },
  },
  {
    name: "get_usage_metrics",
    description:
      "Retrieve usage metrics for user or organization. Provides detailed analytics for billing and monitoring.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description:
            "User ID to get metrics for (optional if organizationId provided)",
        },
        organizationId: {
          type: "string",
          description:
            "Organization ID to get metrics for (optional if userId provided)",
        },
        timeRange: {
          type: "object",
          properties: {
            start: {
              type: "string",
              description: "Start timestamp (ISO 8601)",
            },
            end: { type: "string", description: "End timestamp (ISO 8601)" },
          },
          description:
            "Time range for metrics (optional, defaults to current billing period)",
        },
        features: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific features to get metrics for (optional, returns all if not specified)",
        },
        aggregation: {
          type: "string",
          enum: ["hourly", "daily", "weekly", "monthly"],
          description: "Aggregation level for metrics (default: daily)",
        },
      },
      required: [],
    },
  },
  {
    name: "generate_billing_report",
    description:
      "Generate billing report for usage-based pricing. Includes feature usage, API calls, and resource consumption.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: {
          type: "string",
          description: "Organization ID for billing report",
        },
        billingPeriod: {
          type: "object",
          properties: {
            start: {
              type: "string",
              description: "Billing period start (ISO 8601)",
            },
            end: {
              type: "string",
              description: "Billing period end (ISO 8601)",
            },
          },
          description: "Billing period (optional, defaults to current period)",
        },
        format: {
          type: "string",
          enum: ["json", "csv", "pdf"],
          description: "Report output format (default: json)",
        },
        includeBreakdown: {
          type: "boolean",
          description: "Include detailed usage breakdown (default: true)",
        },
        includeCostEstimate: {
          type: "boolean",
          description:
            "Include cost estimates based on pricing tier (default: true)",
        },
      },
      required: ["organizationId"],
    },
  },
  {
    name: "manage_subscription",
    description:
      "Manage subscription status, upgrades, and downgrades. Handles subscription lifecycle operations.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: {
          type: "string",
          description: "Organization ID for subscription management",
        },
        action: {
          type: "string",
          enum: ["upgrade", "downgrade", "cancel", "renew", "status"],
          description: "Subscription action to perform",
        },
        targetTier: {
          type: "string",
          enum: ["community", "professional", "enterprise"],
          description:
            "Target subscription tier (required for upgrade/downgrade)",
        },
        effectiveDate: {
          type: "string",
          description:
            "Effective date for change (ISO 8601, defaults to immediate)",
        },
      },
      required: ["organizationId", "action"],
    },
  },
  {
    name: "check_rate_limit",
    description:
      "Check current rate limit status for user or organization. Returns remaining quota and reset time.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description:
            "User ID to check rate limit for (optional if organizationId provided)",
        },
        organizationId: {
          type: "string",
          description:
            "Organization ID to check rate limit for (optional if userId provided)",
        },
        feature: {
          type: "string",
          description: "Specific feature to check rate limit for (optional)",
        },
        includeHistory: {
          type: "boolean",
          description: "Include rate limit usage history (default: false)",
        },
      },
      required: [],
    },
  },
  {
    name: "generate_compliance_report",
    description:
      "Generate compliance report for license usage and feature access. Includes audit trail and violation detection.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: {
          type: "string",
          description: "Organization ID for compliance report",
        },
        reportPeriod: {
          type: "object",
          properties: {
            start: {
              type: "string",
              description: "Report period start (ISO 8601)",
            },
            end: {
              type: "string",
              description: "Report period end (ISO 8601)",
            },
          },
          description: "Report period (optional, defaults to last 30 days)",
        },
        includeViolations: {
          type: "boolean",
          description:
            "Include license violations and unauthorized access (default: true)",
        },
        includeAuditTrail: {
          type: "boolean",
          description: "Include detailed audit trail (default: true)",
        },
        format: {
          type: "string",
          enum: ["json", "markdown", "pdf"],
          description: "Report output format (default: json)",
        },
      },
      required: ["organizationId"],
    },
  },
  {
    name: "configure_sso",
    description:
      "Configure Single Sign-On (SSO) integration for enterprise customers. Supports SAML and OAuth providers.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: {
          type: "string",
          description: "Organization ID for SSO configuration",
        },
        provider: {
          type: "string",
          enum: ["auth0", "okta", "azure-ad", "google", "saml"],
          description: "SSO provider type",
        },
        configuration: {
          type: "object",
          description:
            "Provider-specific configuration (e.g., client ID, domain, metadata URL)",
        },
        testConnection: {
          type: "boolean",
          description:
            "Test SSO connection after configuration (default: true)",
        },
      },
      required: ["organizationId", "provider", "configuration"],
    },
  },
  {
    name: "manage_api_keys",
    description:
      "Manage API keys for programmatic access. Supports creation, rotation, and revocation.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User ID for API key management",
        },
        action: {
          type: "string",
          enum: ["create", "list", "rotate", "revoke"],
          description: "API key management action",
        },
        keyId: {
          type: "string",
          description: "API key ID (required for rotate/revoke actions)",
        },
        permissions: {
          type: "array",
          items: { type: "string" },
          description:
            "Permissions for new API key (required for create action)",
        },
        expirationDays: {
          type: "number",
          description:
            "Days until key expiration (optional, defaults to no expiration)",
        },
      },
      required: ["userId", "action"],
    },
  },
  {
    name: "audit_access_logs",
    description:
      "Audit access logs for security and compliance monitoring. Identifies suspicious activity and access patterns.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: {
          type: "string",
          description: "Organization ID for audit",
        },
        timeRange: {
          type: "object",
          properties: {
            start: {
              type: "string",
              description: "Start timestamp (ISO 8601)",
            },
            end: { type: "string", description: "End timestamp (ISO 8601)" },
          },
          description:
            "Time range for audit (optional, defaults to last 24 hours)",
        },
        userId: {
          type: "string",
          description: "Specific user to audit (optional)",
        },
        detectAnomalies: {
          type: "boolean",
          description: "Detect anomalous access patterns (default: true)",
        },
        includeFailedAttempts: {
          type: "boolean",
          description: "Include failed authentication attempts (default: true)",
        },
      },
      required: ["organizationId"],
    },
  },
];
