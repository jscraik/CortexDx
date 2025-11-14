import { describe, expect, it } from "vitest";
import type { AcademicResearchReport } from "../src/research/academic-researcher.js";
import { getResearchResource, listResearchResources, recordResearchReport } from "../src/resources/research-store.js";

const baseReport: AcademicResearchReport = {
  topic: "MCP baseline",
  question: undefined,
  timestamp: new Date().toISOString(),
  providers: [],
  findings: [],
  summary: {
    totalFindings: 0,
    providersRequested: 1,
    providersResponded: 0,
    errors: [],
  },
};

describe("research-store", () => {
  it("records and retrieves the latest report", () => {
    const recorded = recordResearchReport({ ...baseReport, topic: "Topic A" });
    const listed = listResearchResources();
    expect(listed[0]?.id).toBe(recorded.id);
    expect(getResearchResource(recorded.id)?.report.topic).toBe("Topic A");
  });

  it("enforces the record limit", () => {
    for (let i = 0; i < 12; i += 1) {
      recordResearchReport({ ...baseReport, topic: `Topic ${i}`, timestamp: new Date(Date.now() + i).toISOString() });
    }
    expect(listResearchResources().length).toBeLessThanOrEqual(10);
  });
});
