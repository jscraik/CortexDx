import { createHash } from "node:crypto";
import type { AcademicResearchReport } from "../research/academic-researcher.js";

export interface ResearchResource {
  id: string;
  createdAt: number;
  report: AcademicResearchReport;
}

const MAX_RECORDS = 10;
const researchResources: ResearchResource[] = [];

export function recordResearchReport(
  report: AcademicResearchReport,
): ResearchResource {
  const id = generateResourceId(report);
  const resource: ResearchResource = { id, createdAt: Date.now(), report };
  researchResources.unshift(resource);
  if (researchResources.length > MAX_RECORDS) {
    researchResources.length = MAX_RECORDS;
  }
  return resource;
}

export function listResearchResources(): ResearchResource[] {
  return [...researchResources];
}

export function getResearchResource(id: string): ResearchResource | undefined {
  return researchResources.find((resource) => resource.id === id);
}

function generateResourceId(report: AcademicResearchReport): string {
  const hash = createHash("sha256")
    .update(report.topic)
    .update(report.timestamp)
    .digest("hex")
    .slice(0, 12);
  return `research-${hash}`;
}
