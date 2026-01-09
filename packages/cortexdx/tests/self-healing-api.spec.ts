/**
 * Self-healing API endpoint tests
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { promises as fs } from "node:fs";
import { LlmOrchestrator } from "../src/ml/orchestrator.js";

const initializeAdaptersSpy = vi
  .spyOn(
    LlmOrchestrator.prototype as unknown as {
      initializeAdapters: () => Promise<void>;
    },
    "initializeAdapters",
  )
  .mockResolvedValue(undefined);

afterAll(() => {
  initializeAdaptersSpy.mockRestore();
});

// Mock the self-healing modules
vi.mock("../src/healing/auto-healer.js", () => ({
  AutoHealer: vi.fn().mockImplementation(() => ({
    healSelf: vi.fn().mockResolvedValue({
      jobId: "test-job",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      findings: [],
      fixes: [],
      validation: {
        totalFindings: 0,
        issuesFixed: 0,
        issuesRemaining: 0,
        autoFixed: 0,
        manualReviewRequired: 0,
        blockersRemaining: 0,
      },
      summary: {
        severity: "success",
        message: "All systems healthy",
        recommendations: [],
        nextSteps: [],
      },
    }),
    quickHealthCheck: vi.fn().mockResolvedValue({
      healthy: true,
      issues: 0,
      criticalIssues: 0,
      message: "System is healthy",
    }),
  })),
}));

vi.mock("../src/template-engine/engine.js", () => ({
  TemplateEngine: vi.fn().mockImplementation(() => ({
    applyTemplate: vi.fn().mockResolvedValue({
      success: true,
      templateId: "security.headers",
      checklistResult: { canProceed: true },
      codeChanges: [],
      validationResults: [],
    }),
  })),
}));

vi.mock("../src/templates/fix-templates.js", () => ({
  getTemplate: vi.fn().mockReturnValue({
    id: "security.headers",
    name: "Add Security Headers",
    description: "Adds security headers to server",
    area: "security",
    severity: "minor",
    riskLevel: "low",
    estimatedTime: "5-10 minutes",
    filesAffected: ["src/server.ts"],
  }),
  getTemplatesByArea: vi.fn().mockReturnValue([]),
  getTemplatesBySeverity: vi.fn().mockReturnValue([]),
}));

vi.mock("../src/healing/scheduler.js", () => ({
  MonitoringScheduler: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      running: false,
      activeJobs: 0,
      lastCheck: new Date().toISOString(),
      nextCheck: "No scheduled jobs",
    }),
    getJobs: vi.fn().mockReturnValue([]),
  })),
}));

describe("Self-Healing API Endpoints", () => {
  let server: any;
  let baseUrl: string;

  beforeEach(async () => {
    // Import the server module after mocking
    const { default: serverModule } = await import("../src/server.js");

    // Create a test server
    server = await new Promise((resolve) => {
      const testServer = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          // Set CORS headers
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
          res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization",
          );

          if (req.method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
          }

          // Import and use the API handler
          const { handleSelfHealingAPI } = await import("../src/server.js");
          await handleSelfHealingAPI(req, res, req.url || "/");
        },
      );

      testServer.listen(0, () => {
        const address = testServer.address();
        if (address && typeof address === "object") {
          baseUrl = `http://localhost:${address.port}`;
          resolve(testServer);
        }
      });
    });
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  describe("POST /api/v1/self-diagnose", () => {
    it("should run self-diagnosis successfully", async () => {
      const response = await fetch(`${baseUrl}/api/v1/self-diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoFix: false,
          dryRun: true,
          severity: "major",
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.report).toBeDefined();
      expect(data.report.jobId).toBeDefined();
      expect(data.report.summary.severity).toBe("success");
      expect(data.timestamp).toBeDefined();
    });

    it("should handle request with no body", async () => {
      const response = await fetch(`${baseUrl}/api/v1/self-diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.report).toBeDefined();
    });

    it("should handle internal errors gracefully", async () => {
      // Mock a failure
      const { AutoHealer } = await import("../src/healing/auto-healer.js");
      (AutoHealer as any).mockImplementationOnce(() => ({
        healSelf: vi.fn().mockRejectedValue(new Error("Service unavailable")),
      }));

      const response = await fetch(`${baseUrl}/api/v1/self-diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(500);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe("GET /api/v1/health", () => {
    it("should return health status", async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`);

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.health).toBeDefined();
      expect(data.health.healthy).toBe(true);
      expect(data.health.issues).toBe(0);
      expect(data.health.criticalIssues).toBe(0);
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("GET /api/v1/templates", () => {
    it("should list available templates", async () => {
      const response = await fetch(`${baseUrl}/api/v1/templates`);

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.templates).toBeDefined();
      expect(Array.isArray(data.templates)).toBe(true);
      expect(data.count).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });

    it("should filter templates by area", async () => {
      const response = await fetch(`${baseUrl}/api/v1/templates?area=security`);

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.templates).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });

    it("should filter templates by severity", async () => {
      const response = await fetch(
        `${baseUrl}/api/v1/templates?severity=minor`,
      );

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.templates).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("POST /api/v1/templates/:id", () => {
    it("should apply a template successfully", async () => {
      const response = await fetch(
        `${baseUrl}/api/v1/templates/security.headers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dryRun: true,
            backup: true,
            validate: true,
          }),
        },
      );

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.result).toBeDefined();
      expect(data.result.templateId).toBe("security.headers");
      expect(data.timestamp).toBeDefined();
    });

    it("should handle missing template ID", async () => {
      const response = await fetch(`${baseUrl}/api/v1/templates/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(404);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("Template ID required");
    });

    it("should handle non-existent template", async () => {
      const response = await fetch(`${baseUrl}/api/v1/templates/non-existent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(404);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("not found");
    });

    it("should handle template application errors", async () => {
      // Mock a template failure
      const { TemplateEngine } = await import(
        "../src/template-engine/engine.js"
      );
      (TemplateEngine as any).mockImplementationOnce(() => ({
        applyTemplate: vi
          .fn()
          .mockRejectedValue(new Error("Template application failed")),
      }));

      const response = await fetch(
        `${baseUrl}/api/v1/templates/security.headers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      expect(response.status).toBe(500);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe("POST /api/v1/monitor", () => {
    it("should start monitoring", async () => {
      const response = await fetch(`${baseUrl}/api/v1/monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          intervalSeconds: 300,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe("Monitoring started");
      expect(data.status).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });

    it("should stop monitoring", async () => {
      const response = await fetch(`${baseUrl}/api/v1/monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop",
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe("Monitoring stopped");
      expect(data.timestamp).toBeDefined();
    });

    it("should get monitoring status", async () => {
      const response = await fetch(`${baseUrl}/api/v1/monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.status).toBeDefined();
      expect(data.jobs).toBeDefined();
      expect(Array.isArray(data.jobs)).toBe(true);
      expect(data.timestamp).toBeDefined();
    });

    it("should handle invalid monitoring action", async () => {
      const response = await fetch(`${baseUrl}/api/v1/monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invalid",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid action");
    });

    it("should handle monitoring errors gracefully", async () => {
      // Mock a monitoring failure
      const { MonitoringScheduler } = await import(
        "../src/healing/scheduler.js"
      );
      (MonitoringScheduler as any).mockImplementationOnce(() => ({
        start: vi.fn().mockImplementation(() => {
          throw new Error("Monitoring service unavailable");
        }),
      }));

      const response = await fetch(`${baseUrl}/api/v1/monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe("Invalid Endpoints", () => {
    it("should return 404 for unknown API endpoints", async () => {
      const response = await fetch(`${baseUrl}/api/v1/unknown`);

      expect(response.status).toBe(404);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("API endpoint not found");
      expect(data.path).toBe("/api/v1/unknown");
      expect(data.method).toBe("GET");
      expect(data.timestamp).toBeDefined();
    });

    it("should return 404 for invalid HTTP methods", async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`, {
        method: "DELETE",
      });

      expect(response.status).toBe(404);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("API endpoint not found");
    });
  });

  describe("CORS Headers", () => {
    it("should include CORS headers", async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`, {
        method: "OPTIONS",
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "GET",
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "POST",
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
        "Content-Type",
      );
    });
  });

  describe("Content Type Headers", () => {
    it("should return JSON content type", async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`);

      expect(response.ok).toBe(true);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("Error Response Format", () => {
    it("should consistently format error responses", async () => {
      const response = await fetch(`${baseUrl}/api/v1/invalid-endpoint`);

      expect(response.status).toBe(404);
      const data = await response.json();

      // All error responses should have these fields
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("error");
      expect(data).toHaveProperty("timestamp");
      expect(data.success).toBe(false);
      expect(typeof data.error).toBe("string");
      expect(typeof data.timestamp).toBe("string");
    });
  });
});
