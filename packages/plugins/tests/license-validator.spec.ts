import { describe, expect, it } from "vitest";
import type { DiagnosticContext } from "@brainwav/cortexdx-core";
import {
  LicenseValidatorPlugin,
  type ResearchContent,
} from "../src/plugins/license-validator.js";

const baseContext: DiagnosticContext = {
  endpoint: "https://example.test",
  logger: () => {},
  request: async <T>() => Promise.resolve({} as T),
  jsonrpc: async <T>() => Promise.resolve({} as T),
  sseProbe: async () => Promise.resolve({} as never),
  evidence: () => {},
};

function createContext(
  researchContent: ResearchContent[],
): DiagnosticContext {
  return {
    ...baseContext,
    artifacts: { researchContent },
  };
}

describe("LicenseValidatorPlugin.run", () => {
  it("emits compliant finding with evidence for approved licenses", async () => {
    const ctx = createContext([
      {
        title: "MIT Licensed Paper",
        authors: ["Test Author"],
        source: "arXiv",
        license: "MIT",
        url: "https://example.test/mit",
      },
    ]);

    const findings = await LicenseValidatorPlugin.run(ctx);
    const finding = findings.find((f) => f.id.includes("compliant"));

    expect(finding?.severity).toBe("info");
    expect(finding?.tags).toContain("compliant");
    expect(finding?.evidence.some((ev) => ev.ref.includes("example.test"))).toBe(
      true,
    );
  });

  it("returns high-severity findings when approval is required", async () => {
    const ctx = createContext([
      {
        title: "Non-Commercial Research",
        authors: ["Test Author"],
        source: "Semantic Scholar",
        license: "CC-BY-NC-4.0",
        doi: "10.1234/non-commercial",
      },
    ]);

    const findings = await LicenseValidatorPlugin.run(ctx);
    const finding = findings.find((f) => f.id.includes("requires_approval"));

    expect(finding?.severity).toBe("major");
    expect(finding?.tags).toContain("requires_approval");
    expect(finding?.evidence.some((ev) => ev.ref.includes("10.1234"))).toBe(
      true,
    );
  });

  it("flags non-compliant research with major severity", async () => {
    const ctx = createContext([
      {
        title: "Proprietary Research",
        authors: ["Test Author"],
        source: "Institutional Repo",
        license: "PROPRIETARY-NO-DIST",
      },
    ]);

    const findings = await LicenseValidatorPlugin.run(ctx);
    const finding = findings.find((f) => f.id.includes("non_compliant"));

    expect(finding?.severity).toBe("major");
    expect(finding?.tags).toContain("non_compliant");
    expect(finding?.evidence[0]?.ref).toBe(baseContext.endpoint);
  });
});
