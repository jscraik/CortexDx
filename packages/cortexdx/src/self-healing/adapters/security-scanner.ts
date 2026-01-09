import type { Finding } from "../../types.js";
import { type NormalizedFinding, normalizeFindings } from "../findings.js";

interface AdaptSecurityOptions {
  sourceId?: string;
}

export function adaptSecurityFindings(
  findings: Finding[],
  options: AdaptSecurityOptions = {},
): NormalizedFinding[] {
  const source = options.sourceId ?? "security-scanner";
  return normalizeFindings(findings, source);
}
