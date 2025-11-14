import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectManifestType, runGenerateSbom } from "../src/commands/sbom.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("sbom CLI", () => {
  it("detects manifest types automatically", () => {
    expect(detectManifestType("/tmp/project/package.json")).toBe("npm");
    expect(detectManifestType("/tmp/project/requirements.txt")).toBe("pip");
    expect(detectManifestType("/tmp/project/pom.xml")).toBe("maven");
    expect(detectManifestType("/tmp/project/unknown.txt")).toBeNull();
    expect(detectManifestType("/tmp/whatever", "maven")).toBe("maven");
    expect(detectManifestType("/tmp/whatever", "invalid")).toBeNull();
  });

  it("generates a CycloneDX SBOM artifact", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sbom-cli-"));
    tempDirs.push(tempDir);
    const manifestPath = join(tempDir, "package.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({
        name: "sbom-demo",
        version: "1.0.0",
        dependencies: { lodash: "^4.17.21" },
      }),
      "utf8",
    );

    const outDir = join(tempDir, "reports");
    const code = await runGenerateSbom({
      manifest: manifestPath,
      out: outDir,
      format: "cyclonedx",
    });
    expect(code).toBe(0);

    const files = listFiles(outDir);
    const jsonFile = files.find((file) => file.endsWith("sbom.json"));
    expect(jsonFile).toBeDefined();
    const summaryFile = files.find((file) => file.endsWith("summary.json"));
    expect(summaryFile).toBeDefined();
    const summary = JSON.parse(readFileSync(summaryFile as string, "utf8"));
    expect(summary.components).toBeGreaterThan(0);
  });
});

describe("sbom CLI Dependency Track integration", () => {
  it("uploads SBOM when config is provided", async () => {
    vi.mock("../src/security/dependency-track-integration.js", () => ({
      DependencyTrackIntegration: class {
        async getProjectByNameAndVersion() {
          return { uuid: "proj-1", name: "demo", version: "1.0.0" };
        }
        async uploadSBOM() {
          return { token: "upload-token", success: true };
        }
        async subscribeToAlerts() {
          return {
            uuid: "rule-1",
            webhook: "https://example.com",
            active: true,
          };
        }
        async createProject() {
          return { uuid: "proj-1", name: "demo", version: "1.0.0" };
        }
      },
      DependencyTrackConfig: class {},
    }));

    const tempDir = mkdtempSync(join(tmpdir(), "sbom-cli-dt-"));
    tempDirs.push(tempDir);
    const manifestPath = join(tempDir, "package.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({ name: "demo", version: "1.0.0" }),
      "utf8",
    );

    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
      logs.push(String(msg));
    });

    const { runGenerateSbom } = await import("../src/commands/sbom.js");
    const code = await runGenerateSbom({
      manifest: manifestPath,
      dtUrl: "https://dt.example.com",
      dtApiKey: "token",
      dtProject: "demo",
      dtVersion: "1.0.0",
      dtSubscribe: true,
      dtWebhook: "https://alerts.example.com",
    });
    expect(code).toBe(0);
    expect(logs.some((log) => log.includes("Dependency Track"))).toBe(true);
    logSpy.mockRestore();
  });
});

function listFiles(root: string): string[] {
  const entries: string[] = [];
  const queue = [root];
  while (queue.length) {
    const current = queue.pop();
    if (!current) continue;
    const dirEntries = readdirSync(current, { withFileTypes: true });
    for (const entry of dirEntries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else {
        entries.push(fullPath);
      }
    }
  }
  return entries;
}
