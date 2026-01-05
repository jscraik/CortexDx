import type { EvidencePointer, Finding } from "../types.js";

export function buildSampleSecurityFindings(): Finding[] {
  const evidence: EvidencePointer = {
    type: "file",
    ref: "src/server/security/middleware.ts",
    lines: [32, 38],
  };

  return [
    {
      id: "security-001",
      area: "security",
      source: "security-scanner",
      severity: "blocker",
      title: "User-supplied SQL string is concatenated without sanitisation",
      description: "Detected concatenation of req.query.id into SQL statement without parameterisation.",
      evidence: [evidence],
      tags: ["sql-injection", "owasp-a01"],
      recommendation: "Use prepared statements or query builders to bind values instead of concatenation.",
    },
    {
      id: "security-002",
      area: "security",
      source: "security-scanner",
      severity: "major",
      title: "Overly permissive CORS policy",
      description: "CORS analyser found Access-Control-Allow-Origin set to wildcard in production",
      evidence: [{ type: "log", ref: "diagnostics/cors.log" }],
      tags: ["cors", "owasp-a05"],
      recommendation: "Restrict allowed origins to trusted domains only",
    },
    {
      id: "security-003",
      area: "security",
      source: "security-scanner",
      severity: "minor",
      title: "Deprecated TLS version enabled",
      description: "TLS scans show TLS 1.0 enabled on /diagnostics endpoint",
      evidence: [{ type: "url", ref: "https://localhost:5001/diagnostics" }],
      tags: ["tls", "hardening"],
      recommendation: "Disable legacy TLS versions and enforce TLS 1.2+",
    },
  ];
}
