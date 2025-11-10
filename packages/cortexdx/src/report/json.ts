import type { Finding } from "../types.js";

export function buildJsonReport(stamp: Record<string, unknown>, findings: Finding[]) {
  return { ...stamp, findings };
}
