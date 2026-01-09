import type { Finding } from "@brainwav/cortexdx-core";

type ControlFramework = "ASVS" | "ATLAS";
type ControlSeverity = "critical" | "high" | "medium" | "low";

export interface ControlMetadata {
  id: string;
  framework: ControlFramework;
  title: string;
  severity: ControlSeverity;
  matchTags: string[];
  description: string;
}

const ASVS_CONTROL_MAPPINGS: ControlMetadata[] = [
  {
    id: "V2.1.1",
    framework: "ASVS",
    title: "Authentication Strength",
    severity: "high",
    description:
      "Verify passwords and credentials follow strong policy requirements.",
    matchTags: ["authentication", "broken-auth", "V2.1.1", "asvs"],
  },
  {
    id: "V3.2.1",
    framework: "ASVS",
    title: "Session Token Renewal",
    severity: "high",
    description: "Verify new session tokens are generated on authentication.",
    matchTags: ["session", "session-management", "V3.2.1"],
  },
  {
    id: "V5.3.2",
    framework: "ASVS",
    title: "Input Validation",
    severity: "high",
    description:
      "Verify inputs are validated and sanitized to prevent injection.",
    matchTags: ["injection", "input-validation", "V5.3.2"],
  },
  {
    id: "V9.1.1",
    framework: "ASVS",
    title: "Transport Security",
    severity: "medium",
    description: "Verify secure transport (TLS) is enforced for all endpoints.",
    matchTags: ["insecure-transport", "transport", "V9.1.1"],
  },
];

const ATLAS_CONTROL_MAPPINGS: ControlMetadata[] = [
  {
    id: "AML.T0051",
    framework: "ATLAS",
    title: "LLM Prompt Injection",
    severity: "high",
    description:
      "Detect and mitigate malicious prompt behavior targeting LLMs.",
    matchTags: ["AML.T0051", "ai-ml-security", "prompt-injection", "atlas"],
  },
  {
    id: "AML.T0020",
    framework: "ATLAS",
    title: "Poison Training Data",
    severity: "high",
    description:
      "Detect adversarial data injections during training workflows.",
    matchTags: ["AML.T0020", "pattern_store", "learn_feedback", "atlas"],
  },
  {
    id: "AML.T0024",
    framework: "ATLAS",
    title: "Inference API Exfiltration",
    severity: "medium",
    description: "Detect data exfiltration via ML inference APIs.",
    matchTags: ["AML.T0024", "atlas"],
  },
];

const CONTROL_CATALOG: ControlMetadata[] = [
  ...ASVS_CONTROL_MAPPINGS,
  ...ATLAS_CONTROL_MAPPINGS,
];

const severityRank: Record<ControlSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Add control evidence pointers to a finding based on its tags.
 * Returns the IDs of any matched controls.
 */
export function annotateControlEvidence(finding: Finding): string[] {
  const matched = getControlMatches(finding);
  if (matched.length === 0) {
    return [];
  }

  if (!finding.evidence) {
    finding.evidence = [];
  }

  for (const control of matched) {
    const ref = `${control.framework} ${control.id}: ${control.title}`;
    const hasRef = finding.evidence.some((evidence) => evidence.ref === ref);
    if (!hasRef) {
      finding.evidence.push({ type: "log", ref });
    }
    if (!finding.tags?.includes(control.id)) {
      finding.tags = [...(finding.tags ?? []), control.id];
    }
  }

  return matched.map((control) => control.id);
}

/**
 * Returns control metadata entries that match the finding tags.
 */
function getControlMatches(finding: Finding): ControlMetadata[] {
  const tags = (finding.tags ?? []).map((tag) => tag.toLowerCase());
  if (tags.length === 0) {
    return [];
  }

  return CONTROL_CATALOG.filter((control) =>
    control.matchTags.some((tag) => tags.includes(tag.toLowerCase())),
  );
}

/**
 * Compute missing high-severity controls (>= targetSeverity) that lack evidence.
 */
export function getMissingControls(
  coveredControls: Set<string>,
  targetSeverity: ControlSeverity = "high",
): ControlMetadata[] {
  return CONTROL_CATALOG.filter(
    (control) =>
      severityRank[control.severity] >= severityRank[targetSeverity] &&
      !coveredControls.has(control.id),
  );
}

export function buildCoverageGapDescription(
  missing: ControlMetadata[],
): string {
  return missing
    .map((control) => `• ${control.framework} ${control.id} — ${control.title}`)
    .join("\n");
}

export function summarizeCoverage(coverage: Set<string>): {
  description: string;
  evidence: string[];
} {
  if (coverage.size === 0) {
    return {
      description:
        "No ASVS or MITRE ATLAS controls were tagged by current findings.",
      evidence: [],
    };
  }
  const coveredList = Array.from(coverage).sort();
  const description = `Controls covered (${coveredList.length}): ${coveredList
    .slice(0, 8)
    .join(", ")}${coveredList.length > 8 ? "…" : ""}`;
  return {
    description,
    evidence: coveredList.slice(0, 8),
  };
}
