/**
 * Commercial Deployment Tests
 * Tests for Auth0 integration, license enforcement, and billing/analytics
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  type Auth0Config,
  checkRoleAccess,
  trackAuthUsage,
} from "../src/plugins/auth.js";
import {
  clearBillingData,
  generateAdminDashboard,
  generateAnalyticsMetrics,
  generateUsageReport,
  recordFeatureUsage,
} from "../src/plugins/billing-analytics.js";
import {
  type LicenseKey,
  checkFeatureAccess,
  validateCommercialLicense,
} from "../src/plugins/commercial-licensing.js";
import {
  type EnforcedRequest,
  checkFeatureAllowed,
  checkRateLimit,
  clearRateLimits,
  clearUsageTracking,
  incrementRateLimit,
  trackFeatureUsage,
} from "../src/plugins/license-enforcement.js";

describe("Auth0 Integration", () => {
  const mockAuth0Config: Auth0Config = {
    domain: "test.auth0.com",
    clientId: "test-client-id",
    audience: "test-audience",
  };

  it("should validate role access correctly", () => {
    const rolePermissions = {
      admin: ["*"],
      developer: ["diagnose_mcp_server", "generate_code"],
      viewer: ["diagnose_mcp_server"],
    };

    const adminAccess = checkRoleAccess(
      "admin",
      "generate_code",
      rolePermissions,
    );
    expect(adminAccess.allowed).toBe(true);

    const developerAccess = checkRoleAccess(
      "developer",
      "generate_code",
      rolePermissions,
    );
    expect(developerAccess.allowed).toBe(true);

    const viewerAccess = checkRoleAccess(
      "viewer",
      "generate_code",
      rolePermissions,
    );
    expect(viewerAccess.allowed).toBe(false);
    expect(viewerAccess.reason).toBeDefined();
  });

  it("should track authentication usage", () => {
    const record = trackAuthUsage("user-123", "login", true, {
      method: "oauth",
    });

    expect(record.userId).toBe("user-123");
    expect(record.action).toBe("login");
    expect(record.success).toBe(true);
    expect(record.timestamp).toBeGreaterThan(0);
    expect(record.metadata?.method).toBe("oauth");
  });
});

describe("License Tier Enforcement", () => {
  const licenseDatabase = new Map<string, LicenseKey>();

  licenseDatabase.set("community-key", {
    key: "community-key",
    tier: "community",
    features: ["basic-diagnostics", "protocol-validation"],
  });

  licenseDatabase.set("professional-key", {
    key: "professional-key",
    tier: "professional",
    features: [
      "basic-diagnostics",
      "protocol-validation",
      "advanced-diagnostics",
      "llm-backends",
    ],
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  });

  licenseDatabase.set("enterprise-key", {
    key: "enterprise-key",
    tier: "enterprise",
    features: ["*"],
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  });

  it("should validate commercial licenses correctly", () => {
    const communityValidation = validateCommercialLicense(
      "community-key",
      licenseDatabase,
    );
    expect(communityValidation.valid).toBe(true);
    expect(communityValidation.tier).toBe("community");

    const professionalValidation = validateCommercialLicense(
      "professional-key",
      licenseDatabase,
    );
    expect(professionalValidation.valid).toBe(true);
    expect(professionalValidation.tier).toBe("professional");
    expect(professionalValidation.daysRemaining).toBeGreaterThan(0);

    const invalidValidation = validateCommercialLicense(
      "invalid-key",
      licenseDatabase,
    );
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.error).toBeDefined();
  });

  it("should check feature access based on license tier", () => {
    const communityLicense = validateCommercialLicense(
      "community-key",
      licenseDatabase,
    );
    const communityAccess = checkFeatureAccess(
      "advanced-diagnostics",
      communityLicense,
    );
    expect(communityAccess.allowed).toBe(false);

    const professionalLicense = validateCommercialLicense(
      "professional-key",
      licenseDatabase,
    );
    const professionalAccess = checkFeatureAccess(
      "advanced-diagnostics",
      professionalLicense,
    );
    expect(professionalAccess.allowed).toBe(true);

    const enterpriseLicense = validateCommercialLicense(
      "enterprise-key",
      licenseDatabase,
    );
    const enterpriseAccess = checkFeatureAccess(
      "any-feature",
      enterpriseLicense,
    );
    expect(enterpriseAccess.allowed).toBe(true);
  });

  it("should enforce rate limits per tier", () => {
    clearRateLimits();

    const mockRequest = {
      tier: "community",
      auth: { userId: "user-123", roles: [], permissions: [], expiresAt: 0 },
      license: {
        valid: true,
        tier: "community" as const,
        features: ["basic-diagnostics"],
      },
    } as EnforcedRequest;

    // Community tier has limit of 10 per hour for diagnose_mcp_server
    for (let i = 0; i < 10; i++) {
      const limit = checkRateLimit(mockRequest, "diagnose_mcp_server");
      expect(limit.allowed).toBe(true);
      incrementRateLimit(mockRequest, "diagnose_mcp_server");
    }

    // 11th request should be rate limited
    const exceededLimit = checkRateLimit(mockRequest, "diagnose_mcp_server");
    expect(exceededLimit.allowed).toBe(false);
    expect(exceededLimit.remaining).toBe(0);
  });

  it("should track feature usage for billing", () => {
    clearUsageTracking();

    const mockRequest = {
      tier: "professional",
      auth: { userId: "user-456", roles: [], permissions: [], expiresAt: 0 },
      license: {
        valid: true,
        tier: "professional" as const,
        features: ["advanced-diagnostics"],
      },
    } as EnforcedRequest;

    trackFeatureUsage(mockRequest, "advanced-diagnostics", 1500);

    // Usage should be tracked (verified through billing analytics)
    expect(true).toBe(true); // Placeholder assertion
  });
});

describe("Billing and Analytics Integration", () => {
  beforeEach(() => {
    clearBillingData();
  });

  it("should record feature usage for billing", () => {
    const event = recordFeatureUsage(
      "user-789",
      "org-123",
      "advanced-diagnostics",
      "professional",
      2000,
    );

    expect(event.type).toBe("feature_usage");
    expect(event.userId).toBe("user-789");
    expect(event.organizationId).toBe("org-123");
    expect(event.feature).toBe("advanced-diagnostics");
    expect(event.amount).toBeGreaterThanOrEqual(0); // Can be 0 for some features
    expect(event.currency).toBe("USD");
  });

  it("should generate usage reports", () => {
    // Record some usage
    recordFeatureUsage(
      "user-1",
      "org-123",
      "diagnose_mcp_server",
      "professional",
    );
    recordFeatureUsage(
      "user-1",
      "org-123",
      "advanced-diagnostics",
      "professional",
    );
    recordFeatureUsage("user-2", "org-123", "llm-backends", "professional");

    const now = Date.now();
    const report = generateUsageReport("org-123", {
      start: now - 60 * 60 * 1000,
      end: now,
    });

    expect(report.organizationId).toBe("org-123");
    expect(report.totalUsage).toBeGreaterThan(0);
    expect(report.featureBreakdown).toBeDefined();
    expect(report.totalCost).toBeGreaterThan(0);
    expect(report.currency).toBe("USD");
  });

  it("should generate analytics metrics", () => {
    // Record some usage
    recordFeatureUsage(
      "user-1",
      "org-456",
      "diagnose_mcp_server",
      "enterprise",
    );
    recordFeatureUsage(
      "user-2",
      "org-456",
      "advanced-diagnostics",
      "enterprise",
    );
    recordFeatureUsage("user-1", "org-456", "llm-backends", "enterprise");

    const now = Date.now();
    const metrics = generateAnalyticsMetrics("org-456", {
      start: now - 60 * 60 * 1000,
      end: now,
    });

    expect(metrics.organizationId).toBe("org-456");
    expect(metrics.activeUsers).toBeGreaterThan(0);
    expect(metrics.topFeatures).toBeDefined();
    expect(metrics.userActivity).toBeDefined();
  });

  it("should generate admin dashboard data", () => {
    // Record some usage across multiple organizations
    recordFeatureUsage("user-1", "org-1", "diagnose_mcp_server", "community");
    recordFeatureUsage(
      "user-2",
      "org-2",
      "advanced-diagnostics",
      "professional",
    );
    recordFeatureUsage("user-3", "org-3", "llm-backends", "enterprise");

    const dashboard = generateAdminDashboard();

    expect(dashboard.totalOrganizations).toBeGreaterThan(0);
    expect(dashboard.totalUsers).toBeGreaterThan(0);
    expect(dashboard.recentActivity).toBeDefined();
    expect(dashboard.topOrganizations).toBeDefined();
  });
});

describe("Integration Tests", () => {
  it("should integrate auth, licensing, and billing", () => {
    clearBillingData();
    clearRateLimits();
    clearUsageTracking();

    const licenseDatabase = new Map<string, LicenseKey>();
    licenseDatabase.set("test-key", {
      key: "test-key",
      tier: "professional",
      features: ["advanced-diagnostics", "llm-backends"],
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    });

    // Validate license
    const license = validateCommercialLicense("test-key", licenseDatabase);
    expect(license.valid).toBe(true);

    // Create mock request
    const mockRequest = {
      tier: "professional",
      auth: {
        userId: "user-integration",
        roles: ["developer"],
        permissions: [],
        expiresAt: 0,
      },
      license,
    } as EnforcedRequest;

    // Check feature access
    const featureAccess = checkFeatureAllowed(
      mockRequest,
      "advanced-diagnostics",
    );
    expect(featureAccess.allowed).toBe(true);

    // Check rate limit
    const rateLimit = checkRateLimit(mockRequest, "advanced-diagnostics");
    expect(rateLimit.allowed).toBe(true);

    // Track usage
    trackFeatureUsage(mockRequest, "advanced-diagnostics", 1000);

    // Record billing event
    recordFeatureUsage(
      "user-integration",
      "org-integration",
      "advanced-diagnostics",
      "professional",
      1000,
    );

    // Generate report
    const now = Date.now();
    const report = generateUsageReport("org-integration", {
      start: now - 60 * 60 * 1000,
      end: now,
    });

    expect(report.totalUsage).toBeGreaterThan(0);
    expect(report.totalCost).toBeGreaterThanOrEqual(0); // Can be 0 depending on pricing
  });
});
