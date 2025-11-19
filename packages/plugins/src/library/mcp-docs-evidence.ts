import type { EvidencePointer } from "@brainwav/cortexdx-core";
import { searchMcpDocs } from "./mcp-docs-service.js";
import { recordMcpDocsChunkResource } from "../resources/mcp-docs-store.js";

const evidenceCache = new Map<string, EvidencePointer>();

export async function getMcpSpecEvidence(
  query: string,
): Promise<EvidencePointer | undefined> {
  const trimmed = query.trim();
  if (!trimmed) {
    return undefined;
  }

  const cached = evidenceCache.get(trimmed);
  if (cached) {
    return cached;
  }

  try {
    const result = await searchMcpDocs({ query: trimmed, topK: 1 });
    const match = result.matches[0];
    if (!match) {
      return undefined;
    }
    const resource = recordMcpDocsChunkResource(match);
    const pointer: EvidencePointer = {
      type: "resource",
      ref: `cortexdx://mcp-docs/${resource.id}`,
    };
    evidenceCache.set(trimmed, pointer);
    return pointer;
  } catch {
    return undefined;
  }
}
