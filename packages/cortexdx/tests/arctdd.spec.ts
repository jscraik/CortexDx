import { describe, it, expect } from "vitest";
import { buildArcTddPlan } from "../src/report/arctdd.js";
import type { Finding } from "../src/types.js";

describe("ArcTDD Report Generator", () => {
  const baseStamp = {
    endpoint: "http://localhost:5001",
    inspectedAt: "2024-01-15T10:30:00Z",
    durationMs: 1500,
    targetLabel: "Test Server",
  };

  describe("Report Generation", () => {
    it("should generate a complete ArcTDD plan with findings", () => {
      const findings: Finding[] = [
        {
          id: "blocker-1",
          area: "protocol",
          severity: "blocker",
          title: "Invalid JSON-RPC response",
          description: "Server returns HTML instead of JSON",
          evidence: [
            { type: "log", ref: "server.log", lines: [10, 15] },
          ],
          recommendation: "Fix the routing configuration",
        },
        {
          id: "major-1",
          area: "security",
          severity: "major",
          title: "Missing CORS headers",
          description: "CORS headers are not properly configured",
          evidence: [
            { type: "network", ref: "request.har" },
          ],
        },
        {
          id: "minor-1",
          area: "performance",
          severity: "minor",
          title: "Slow response time",
          description: "Response time exceeds recommended threshold",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("# ArcTDD Implementation Plan — Test Server");
      expect(plan).toContain("**Endpoint:** http://localhost:5001");
      expect(plan).toContain("**Inspected:** 2024-01-15T10:30:00Z");
      expect(plan).toContain("**Duration:** 1500ms");
      expect(plan).toContain("## 🚨 Critical Issues (Blockers)");
      expect(plan).toContain("## ⚠️ Major Issues");
      expect(plan).toContain("## 📋 Minor Issues & Improvements");
      expect(plan).toContain("BLOCKER: Invalid JSON-RPC response");
      expect(plan).toContain("MAJOR: Missing CORS headers");
      expect(plan).toContain("MINOR: Slow response time");
    });

    it("should handle empty findings gracefully", () => {
      const findings: Finding[] = [];
      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("✅ No blocking issues found!");
      expect(plan).toContain("✅ No major issues found!");
      expect(plan).toContain("✅ No minor issues found!");
    });

    it("should include implementation priority section", () => {
      const findings: Finding[] = [];
      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("## 🎯 Implementation Priority");
      expect(plan).toContain("Phase 1 (Critical)");
      expect(plan).toContain("Phase 2 (Important)");
      expect(plan).toContain("Phase 3 (Polish)");
    });

    it("should include resources section", () => {
      const findings: Finding[] = [];
      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("## 📚 Resources");
      expect(plan).toContain("MCP Protocol Specification");
      expect(plan).toContain("brAInwav MCP Best Practices");
      expect(plan).toContain("JSON-RPC 2.0 Specification");
    });

    it("should limit minor issues to 5 with overflow message", () => {
      const findings: Finding[] = Array.from({ length: 10 }, (_, i) => ({
        id: `minor-${i}`,
        area: "performance" as const,
        severity: "minor" as const,
        title: `Minor Issue ${i}`,
        description: `Description ${i}`,
        evidence: [],
      }));

      const plan = buildArcTddPlan(baseStamp, findings);

      const minorMatches = plan.match(/MINOR: Minor Issue/g);
      expect(minorMatches).toHaveLength(5);
      expect(plan).toContain("and 5 more minor issues");
    });

    it("should use endpoint as target label when targetLabel is missing", () => {
      const stamp = {
        endpoint: "http://api.example.com/mcp",
        inspectedAt: "2024-01-15T10:30:00Z",
        durationMs: 1000,
      };

      const plan = buildArcTddPlan(stamp, []);

      expect(plan).toContain("api.example.com");
    });
  });

  describe("Solution Generation", () => {
    it("should generate specific solution for batch request errors", () => {
      const findings: Finding[] = [
        {
          id: "batch.req.error",
          area: "protocol",
          severity: "blocker",
          title: "Batch request returns HTML",
          description: "Server responds with DOCTYPE when expecting JSON",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("Fix routing issue");
      expect(plan).toContain("Ensure `/mcp` endpoint returns JSON, not HTML");
      expect(plan).toContain("Check server configuration");
      expect(plan).toContain("curl -X POST");
    });

    it("should generate specific solution for SSE issues", () => {
      const findings: Finding[] = [
        {
          id: "sse.missing",
          area: "streaming",
          severity: "major",
          title: "SSE not implemented",
          description: "Server does not support Server-Sent Events",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("Implement SSE endpoint");
      expect(plan).toContain("Add `/events` route");
      expect(plan).toContain("Content-Type: text/event-stream");
      expect(plan).toContain("Add keepalive");
    });

    it("should generate specific solution for tools endpoint", () => {
      const findings: Finding[] = [
        {
          id: "disc.unknown.tools",
          area: "protocol",
          severity: "major",
          title: "Tools endpoint not implemented",
          description: "tools/list method not available",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("Implement tools/list endpoint");
      expect(plan).toContain("Return proper format");
      expect(plan).toContain("Include tool schemas");
    });

    it("should generate specific solution for ping method", () => {
      const findings: Finding[] = [
        {
          id: "jsonrpc.no_ping",
          area: "protocol",
          severity: "minor",
          title: "Ping method missing",
          description: "rpc.ping method not implemented",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("Add ping method");
      expect(plan).toContain("rpc.ping");
      expect(plan).toContain("pong");
    });

    it("should generate specific solution for CORS issues", () => {
      const findings: Finding[] = [
        {
          id: "cors.preflight.missing",
          area: "protocol",
          severity: "major",
          title: "CORS preflight not handled",
          description: "OPTIONS requests not handled properly",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("Add CORS headers");
      expect(plan).toContain("Access-Control-Allow-Origin");
      expect(plan).toContain("Handle OPTIONS requests");
    });

    it("should generate generic solution for unknown issues", () => {
      const findings: Finding[] = [
        {
          id: "unknown-issue",
          area: "security",
          severity: "major",
          title: "Unknown Security Issue",
          description: "Some unknown security problem",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("Review security implementation");
      expect(plan).toContain("Consult documentation");
      expect(plan).toContain("Test thoroughly");
    });
  });

  describe("Quick Wins", () => {
    it("should identify CORS as a quick win", () => {
      const findings: Finding[] = [
        {
          id: "cors.issue",
          area: "protocol",
          severity: "minor",
          title: "CORS issue",
          description: "CORS not configured",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("## 🔧 Quick Wins");
      expect(plan).toContain("5 min");
      expect(plan).toContain("CORS headers");
    });

    it("should identify ping as a quick win", () => {
      const findings: Finding[] = [
        {
          id: "jsonrpc.no_ping",
          area: "protocol",
          severity: "minor",
          title: "No ping",
          description: "Ping not implemented",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("2 min");
      expect(plan).toContain("rpc.ping");
    });

    it("should identify routing fix as a quick win", () => {
      const findings: Finding[] = [
        {
          id: "batch.req.error",
          area: "protocol",
          severity: "blocker",
          title: "Routing issue",
          description: "Wrong response type",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("10 min");
      expect(plan).toContain("routing");
    });

    it("should show congratulations when no quick wins", () => {
      const findings: Finding[] = [];
      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("Great job!");
      expect(plan).toContain("No obvious quick wins");
    });
  });

  describe("Evidence Formatting", () => {
    it("should format evidence in issue description", () => {
      const findings: Finding[] = [
        {
          id: "test-1",
          area: "protocol",
          severity: "major",
          title: "Test Issue",
          description: "Test description",
          evidence: [
            { type: "log", ref: "app.log" },
            { type: "network", ref: "trace.har" },
          ],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("**Evidence:** log:app.log, network:trace.har");
    });

    it("should handle findings without evidence", () => {
      const findings: Finding[] = [
        {
          id: "test-2",
          area: "protocol",
          severity: "minor",
          title: "Test Issue",
          description: "Test description",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      expect(plan).toContain("**Evidence:** N/A");
    });
  });

  describe("Severity Grouping", () => {
    it("should group findings by severity correctly", () => {
      const findings: Finding[] = [
        {
          id: "b1",
          area: "protocol",
          severity: "blocker",
          title: "Blocker 1",
          description: "desc",
          evidence: [],
        },
        {
          id: "b2",
          area: "security",
          severity: "blocker",
          title: "Blocker 2",
          description: "desc",
          evidence: [],
        },
        {
          id: "m1",
          area: "protocol",
          severity: "major",
          title: "Major 1",
          description: "desc",
          evidence: [],
        },
        {
          id: "min1",
          area: "performance",
          severity: "minor",
          title: "Minor 1",
          description: "desc",
          evidence: [],
        },
      ];

      const plan = buildArcTddPlan(baseStamp, findings);

      // Check that blockers appear first
      const blockerIndex = plan.indexOf("BLOCKER: Blocker 1");
      const majorIndex = plan.indexOf("MAJOR: Major 1");
      const minorIndex = plan.indexOf("MINOR: Minor 1");

      expect(blockerIndex).toBeLessThan(majorIndex);
      expect(majorIndex).toBeLessThan(minorIndex);
    });
  });
});
