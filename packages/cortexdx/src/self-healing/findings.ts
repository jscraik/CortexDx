import { createHash } from "node:crypto";
import type { EvidencePointer, Finding, Severity } from "../types";

export type NormalizedSeverity = "info" | "minor" | "major" | "critical";
export type NormalizedPrecision = "file" | "line" | "range";

export interface NormalizedCoordinate {
  line: number;
  column?: number;
}

export interface NormalizedLocation {
  file?: string;
  start?: NormalizedCoordinate;
  end?: NormalizedCoordinate;
}

export interface NormalizedEvidence {
  pointers: string[];
}

export interface NormalizedFindingBase {
  source: string;
  ruleId?: string;
  title: string;
  description?: string;
  severity: NormalizedSeverity;
  precision: NormalizedPrecision;
  location?: NormalizedLocation;
  tags?: string[];
  evidence?: NormalizedEvidence;
  recommendation?: string;
  originalId?: string;
}

export type NormalizedFinding = NormalizedFindingBase & { id: string };

/**
 * Create a deterministic fingerprint for a normalized finding.
 */
export function fingerprintFinding(data: NormalizedFindingBase): string {
  const payload = {
    source: data.source,
    ruleId: data.ruleId ?? null,
    title: data.title,
    file: data.location?.file ?? null,
    start: data.location?.start ?? null,
    end: data.location?.end ?? null,
  };
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
  return `nf_${hash}`;
}

export function mapSeverityToNormalized(severity: Severity): NormalizedSeverity {
  switch (severity) {
    case "blocker":
      return "critical";
    case "major":
      return "major";
    case "minor":
      return "minor";
    default:
      return "info";
  }
}

export function evidencePointersToStrings(evidence: EvidencePointer[]): string[] {
  return evidence.map((entry) => {
    if (entry.lines) {
      const [start, end] = entry.lines;
      return `${entry.ref}#L${start}-${end}`;
    }
    return entry.ref;
  });
}

export function normalizeFindings(
  findings: Finding[],
  fallbackSource?: string,
): NormalizedFinding[] {
  const merged = new Map<string, NormalizedFinding>();
  for (const finding of findings) {
    const normalized = normalizeFinding(finding, fallbackSource);
    const key = buildDeduplicationKey(normalized);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, normalized);
      continue;
    }
    merged.set(key, mergeNormalizedFindings(existing, normalized));
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeFinding(
  finding: Finding,
  fallbackSource?: string,
): NormalizedFinding {
  const source = finding.source ?? fallbackSource ?? finding.area ?? "unknown";
  const location = deriveLocationFromEvidence(finding);
  const precision: NormalizedPrecision = determinePrecision(location);
  const base: NormalizedFindingBase = {
    source,
    ruleId: finding.tags?.[0] ?? finding.id,
    title: finding.title,
    description: finding.description,
    severity: mapSeverityToNormalized(finding.severity),
    precision,
    location,
    tags: finding.tags,
    evidence: finding.evidence.length > 0 ? { pointers: evidencePointersToStrings(finding.evidence) } : undefined,
    recommendation: finding.recommendation,
    originalId: finding.id,
  };
  return {
    id: fingerprintFinding(base),
    ...base,
  };
}

export function deriveLocationFromEvidence(finding: Finding): NormalizedLocation | undefined {
  if (!finding.evidence?.length) return undefined;
  const fileEvidence = finding.evidence.find((entry) => entry.type === "file");
  if (!fileEvidence) return undefined;
  const [start, end] = fileEvidence.lines ?? [];
  return {
    file: fileEvidence.ref,
    start: start ? { line: start } : undefined,
    end: end ? { line: end } : start ? { line: start } : undefined,
  };
}

function determinePrecision(location?: NormalizedLocation): NormalizedPrecision {
  if (!location?.start && !location?.end) return "file";
  if (location.start && location.end) {
    return location.start.line === location.end.line ? "line" : "range";
  }
  return "line";
}

function mergeNormalizedFindings(a: NormalizedFinding, b: NormalizedFinding): NormalizedFinding {
  const severityOrder = compareSeverity(a.severity, b.severity);
  const primary = severityOrder >= 0 ? a : b;
  const secondary = primary === a ? b : a;

  const tags = mergeStringArrays(primary.tags, secondary.tags);
  const evidence = mergeEvidence(primary.evidence, secondary.evidence);
  const recommendation = primary.recommendation ?? secondary.recommendation;
  const location = pickPreciseLocation(primary.location, secondary.location);

  return {
    ...primary,
    tags,
    evidence,
    recommendation,
    location,
  };
}

function mergeStringArrays(a?: string[], b?: string[]): string[] | undefined {
  if (!a && !b) return undefined;
  const combined = new Set<string>([...(a ?? []), ...(b ?? [])].filter(Boolean));
  return combined.size > 0 ? [...combined.values()] : undefined;
}

function mergeEvidence(
  a?: NormalizedEvidence,
  b?: NormalizedEvidence,
): NormalizedEvidence | undefined {
  if (!a && !b) return undefined;
  const pointers = new Set<string>([...(a?.pointers ?? []), ...(b?.pointers ?? [])]);
  return pointers.size > 0 ? { pointers: [...pointers.values()] } : undefined;
}

function compareSeverity(a: NormalizedSeverity, b: NormalizedSeverity): number {
  const weights: Record<NormalizedSeverity, number> = {
    critical: 3,
    major: 2,
    minor: 1,
    info: 0,
  };
  return weights[a] - weights[b];
}

function pickPreciseLocation(
  primary?: NormalizedLocation,
  secondary?: NormalizedLocation,
): NormalizedLocation | undefined {
  if (!primary && !secondary) return undefined;
  if (!primary) return secondary;
  if (!secondary) return primary;

  const score = (loc?: NormalizedLocation): number => {
    if (!loc) return -1;
    if (loc.start && loc.end) {
      return loc.start.line === loc.end.line ? 2 : 3;
    }
    if (loc.start || loc.end) return 1;
    if (loc.file) return 0;
    return -1;
  };

  return score(primary) >= score(secondary) ? primary : secondary;
}

function buildDeduplicationKey(finding: NormalizedFinding): string {
  const location = finding.location;
  const startLine = location?.start?.line ?? -1;
  const file = location?.file ?? "unknown";
  return [finding.source, finding.ruleId ?? finding.title, file, startLine].join("|");
}
