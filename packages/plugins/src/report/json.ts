import type { Finding } from "@brainwav/cortexdx-core";

export function buildJsonReport(stamp: Record<string, unknown>, findings: Finding[]) {
  return { ...stamp, findings };
}
