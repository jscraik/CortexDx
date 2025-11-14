import { createHash } from "node:crypto";
import { PatternAnonymizer } from "../storage/pattern-storage-sqlite.js";
import type { ResolutionPattern } from "../storage/pattern-storage.js";
import type { Finding, Problem, Solution } from "../types.js";
import { getPatternStorage } from "./pattern-datastore.js";

interface PatternFeedbackInput {
  endpoint: string;
  findings: Finding[];
  deterministic?: boolean;
}

export async function recordFindingsForLearning(
  input: PatternFeedbackInput,
): Promise<void> {
  const storage = getPatternStorage();
  const now = Date.now();

  await Promise.all(
    input.findings.map(async (finding) => {
      try {
        const signature = PatternAnonymizer.anonymizeProblemSignature(
          `${finding.title} ${finding.description} ${(finding.tags || []).join(" ")}`,
        );
        const patternId = createPatternId(
          signature,
          finding.source ?? "unknown",
        );
        const existing = await storage.loadPattern(patternId);
        const solution = buildSolutionFromFinding(finding);
        const pattern: ResolutionPattern = {
          id: patternId,
          problemType: mapFindingAreaToProblemType(finding.area),
          problemSignature: signature,
          solution,
          successCount: existing?.successCount ?? 0,
          failureCount: existing?.failureCount ?? 0,
          averageResolutionTime: existing?.averageResolutionTime ?? 0,
          lastUsed: now,
          userFeedback: existing?.userFeedback ?? [],
          confidence: existing?.confidence ?? inferConfidence(finding.severity),
        };
        await storage.savePattern(pattern);
        await storage.updateCommonIssue(
          signature,
          finding.source ?? "diagnostics",
        );
      } catch (error) {
        console.debug(
          "[pattern-learning] failed to record finding",
          finding.id,
          error,
        );
      }
    }),
  );
}

function createPatternId(signature: string, source: string): string {
  return createHash("sha256")
    .update(signature)
    .update(source)
    .digest("hex")
    .slice(0, 24);
}

function mapFindingAreaToProblemType(area: string): Problem["type"] {
  switch (area) {
    case "protocol":
    case "streaming":
      return "protocol";
    case "auth":
    case "security":
      return "security";
    case "performance":
      return "performance";
    case "integration":
      return "integration";
    default:
      return "development";
  }
}

function inferConfidence(severity: Finding["severity"]): number {
  switch (severity) {
    case "blocker":
      return 0.9;
    case "major":
      return 0.75;
    case "minor":
      return 0.55;
    default:
      return 0.45;
  }
}

function buildSolutionFromFinding(finding: Finding): Solution {
  const description = finding.recommendation || finding.description;
  const codeChanges = finding.remediation?.filePlan
    ? finding.remediation.filePlan.map((item) => ({
        file: item.path,
        operation: (item.action === "new"
          ? "create"
          : item.action === "update"
            ? "update"
            : "delete") as "create" | "update" | "delete",
        description: item.description,
        content: undefined, // Add missing content property
        patch: item.patch,
        backup: true,
      }))
    : [];

  return {
    id: `solution-${finding.id}`,
    type: finding.canAutoFix ? "automated" : "guided",
    confidence: finding.confidence ?? inferConfidence(finding.severity),
    description,
    userFriendlyDescription: description,
    steps: [
      {
        order: 1,
        description,
        userFriendlyDescription: description,
        action: {
          type: "command",
          target: finding.source ?? "diagnostics",
          operation: "review",
          parameters: { findingId: finding.id },
        },
        validation: {
          type: "manual",
          description: "Re-run cortexdx diagnose",
          expectedResult: "Finding no longer present",
        },
        dependencies: [],
        estimatedDuration: "5m",
        canAutomate: Boolean(finding.canAutoFix),
      },
    ],
    codeChanges,
    configChanges: [],
    testingStrategy: {
      type: "manual",
      tests: [
        {
          name: "diagnose",
          description: "Run cortexdx diagnose to confirm remediation",
          steps: ["cortexdx diagnose <endpoint>"],
          expectedResult: "No matching findings",
          automated: false,
        },
      ],
      coverage: 0,
      automated: false,
    },
    rollbackPlan: {
      steps: [
        {
          order: 1,
          description: "Revert changes using version control",
          action: {
            type: "command",
            target: "git",
            operation: "checkout",
            parameters: { findingId: finding.id },
          },
          validation: {
            type: "manual",
            description: "Confirm prior behavior restored",
            expectedResult: "Original state",
          },
        },
      ],
      automated: false,
      backupRequired: Boolean(codeChanges.length),
      riskLevel: finding.severity === "blocker" ? "high" : "medium",
    },
    automatedFix: finding.canAutoFix
      ? {
          canApplyAutomatically: true,
          requiresUserConfirmation: true,
          riskLevel: finding.severity === "blocker" ? "high" : "medium",
          backupRequired: true,
          validationTests: [],
        }
      : undefined,
    licenseCompliance: {
      requiresLicenseCheck: false,
      approvedLicenses: [],
      proprietaryContent: false,
      approvalRequired: false,
      complianceStatus: "compliant",
    },
  };
}
