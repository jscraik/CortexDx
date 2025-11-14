import { describeIntegration } from "./utils/test-mode.js";
import { expect, it } from "vitest";
import {
  runAcademicResearch,
  ACADEMIC_PROVIDER_ENV_REQUIREMENTS,
  DEFAULT_PROVIDERS,
} from "../src/research/academic-researcher.js";

const SMOKE_FLAG = process.env.CORTEXDX_RESEARCH_SMOKE === "1";
const DEFAULT_SMOKE_PROVIDERS = DEFAULT_PROVIDERS;

describeIntegration("Academic Provider Smoke Tests", () => {
  if (!SMOKE_FLAG) {
    it.skip("skipped (set CORTEXDX_RESEARCH_SMOKE=1 to enable)", () => {});
    return;
  }

  const requestedProviders =
    process.env.CORTEXDX_RESEARCH_SMOKE_PROVIDERS?.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean) ??
    DEFAULT_SMOKE_PROVIDERS;

  const { availableProviders, missingProviders } = partitionProviders(requestedProviders);

  if (availableProviders.length === 0) {
    const missingSummary =
      missingProviders.length > 0
        ? `missing provider env vars: ${missingProviders
            .map(({ id, vars }) => `${id}:${vars.join("/")}`)
            .join(", ")}`
        : "no providers satisfied the smoke requirements";
    it.skip(missingSummary, () => {});
    return;
  }

  if (missingProviders.length > 0) {
    console.warn(
      "[research:smoke] skipping providers due to missing env:",
      missingProviders
        .map(({ id, vars }) => `${id}:${vars.join("/")}`)
        .join(", "),
    );
  }

  it(
    "collects live findings from configured providers",
    async () => {
      const report = await runAcademicResearch({
        topic:
          process.env.CORTEXDX_RESEARCH_SMOKE_TOPIC ||
          "Model Context Protocol diagnostics",
        question: process.env.CORTEXDX_RESEARCH_SMOKE_QUESTION,
        providers: availableProviders,
        limit: 2,
        includeLicense: true,
        deterministic: false,
      });

      expect(report.providers.length).toBeGreaterThan(0);
      expect(report.summary.totalFindings).toBeGreaterThan(0);
    },
    120_000,
  );
});

function partitionProviders(providerIds: string[]): {
  availableProviders: string[];
  missingProviders: Array<{ id: string; vars: string[] }>;
} {
  const availableProviders: string[] = [];
  const missingProviders: Array<{ id: string; vars: string[] }> = [];

  for (const provider of providerIds) {
    const requirement = ACADEMIC_PROVIDER_ENV_REQUIREMENTS[provider];
    const required = requirement?.required ?? [];
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length > 0) {
      missingProviders.push({ id: provider, vars: missing });
      continue;
    }
    availableProviders.push(provider);
  }

  return { availableProviders, missingProviders };
}
