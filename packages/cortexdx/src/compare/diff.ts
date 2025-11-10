import type { Finding } from "../types.js";

const keyOf = (finding: Finding) => `${finding.id}:${finding.title}`;

export function diffFindings(a: Finding[], b: Finding[]) {
  const before = new Map(a.map((finding) => [keyOf(finding), finding]));
  const after = new Map(b.map((finding) => [keyOf(finding), finding]));
  const added = [...after.keys()].filter((key) => !before.has(key));
  const removed = [...before.keys()].filter((key) => !after.has(key));
  return { added, removed };
}
