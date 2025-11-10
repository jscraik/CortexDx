import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { readdirSync, readFileSync, statSync } from "node:fs";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const scanTargets = [
  "packages/cortexdx/CHANGELOG.md",
  "packages/cortexdx/RELEASE_NOTES.md",
  "packages/cortexdx/MIGRATION_GUIDE.md",
  "packages/cortexdx/.gitlab-ci.yml",
  "packages/cortexdx/docs",
  "packages/cortexdx/schemas",
  "packages/cortexdx/enhanced-reports",
  "packages/cortexdx/kubernetes",
  "packages/cortexdx/tests",
  "packages/cortexdx/ide-extensions/intellij/plugin.xml",
];

const bannedTerm = ["in", "sula"].join("");
const bannedPattern = new RegExp(bannedTerm, "i");

const collectFiles = (target: string): string[] => {
  const absolute = join(repoRoot, target);
  const stats = statSync(absolute);
  if (stats.isDirectory()) {
    return readdirSync(absolute)
      .filter((entry) => entry !== "node_modules" && entry !== "dist" && entry !== ".git")
      .flatMap((entry) => collectFiles(join(target, entry)));
  }
  return [target];
};

describe("branding hygiene", () => {
  it("does not include legacy branding references in CortexDx package surfaces", () => {
    const offenders = scanTargets
      .flatMap(collectFiles)
      .filter((relativePath) => relativePath !== "packages/cortexdx/tests/branding.spec.ts")
      .filter((relativePath) => relativePath.endsWith(".md") || relativePath.endsWith(".json") || relativePath.endsWith(".yaml") || relativePath.endsWith(".yml") || relativePath.endsWith(".ts") || relativePath.endsWith(".tsx") || relativePath.endsWith(".spec.ts") || relativePath.endsWith(".js") || relativePath.endsWith(".xml"))
      .map((relativePath) => {
        const contents = readFileSync(join(repoRoot, relativePath), "utf8");
        return bannedPattern.test(contents) ? relativePath : null;
      })
      .filter((value): value is string => Boolean(value));

    expect(offenders).toEqual([]);
  });
});
