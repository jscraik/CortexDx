import { readFileSync } from "node:fs";
import { diffFindings } from "../compare/diff.js";

export async function runCompare(oldFile: string, newFile: string): Promise<number> {
  const oldData = JSON.parse(readFileSync(oldFile, "utf-8"));
  const newData = JSON.parse(readFileSync(newFile, "utf-8"));
  const diff = diffFindings(oldData.findings ?? [], newData.findings ?? []);
  const added = diff.added.length;
  const removed = diff.removed.length;
  console.log(`[brAInwav] Compare: +${added} / -${removed}`);
  for (const key of diff.added) console.log(`  + ${key}`);
  for (const key of diff.removed) console.log(`  - ${key}`);
  return 0;
}
