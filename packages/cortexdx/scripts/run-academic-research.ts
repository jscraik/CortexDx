import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAcademicRegistry } from "../src/registry/index.js";
import type { DiagnosticContext } from "../src/types.js";

const ctx: DiagnosticContext = {
  endpoint: "research://cortexdx/auth0-handshake",
  headers: {},
  logger: (...args: unknown[]) => console.log("[Research]", ...args),
  request: async (input: RequestInfo, init?: RequestInit) => {
    const res = await fetch(input, init);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    const text = await res.text();
    return text as unknown as Record<string, unknown>;
  },
  jsonrpc: async () => ({ result: "noop" }),
  sseProbe: async () => ({ ok: true }),
  evidence: () => undefined,
  deterministic: true,
};

const registry = getAcademicRegistry();

// Note: Semantic Scholar and Exa require API keys. Until those are available,
// their entries remain commented out to keep the research script deterministic.
const plan = [
  // {
  //   id: "semantic-scholar",
  //   tool: "semantic_scholar_search_papers",
  //   params: {
  //     query: "OAuth 2.0 client credentials API gateway reliability Auth0",
  //     limit: 5,
  //     minCitationCount: 10,
  //     fields: ["title", "year", "citationCount", "url", "publicationVenue"],
  //   },
  // },
  {
    id: "openalex",
    tool: "openalex_search_works",
    params: {
      query: "OAuth 2.0 client credentials API gateway security",
      per_page: 5,
      sort: "cited_by_count:desc",
    },
  },
  {
    id: "arxiv",
    tool: "arxiv_search",
    params: {
      search_query: 'cat:cs.CR AND ("OAuth 2.0" OR Auth0)',
      max_results: 5,
      sort_by: "submittedDate",
      sort_order: "descending",
    },
  },
  {
    id: "context7",
    tool: "context7_analyze_paper",
    params: {
      title: "Improving OAuth 2.0 Client Credentials Reliability for MCP Gateways",
      abstract:
        "Analyzes deterministic token acquisition strategies, session caching, and transport hardening for Auth0-protected CortexDx diagnostics.",
      keywords: ["OAuth2", "client credentials", "API gateway", "Auth0", "MCP"],
      analysis_depth: "deep",
      include_citations: true,
    },
  },
  {
    id: "vibe-check",
    tool: "vibe_check_assess_quality",
    params: {
      title: "Auth0 Handshake Hardening Playbook",
      abstract:
        "Guidance on enforcing machine-to-machine token exchange, deterministic diagnostics, and zero-trust headers for CortexDx MCP clients.",
      methodology: "client credentials grant, deterministic diagnostics, session caching",
      dataset_description: "CortexDx mock reports + Auth0 RC specs",
      arxiv_id: "auth0-handoff-2025",
    },
  },
  {
    id: "wikidata",
    tool: "wikidata_sparql",
    params: {
      query: `SELECT ?item ?itemLabel ?description WHERE {
        ?item rdfs:label ?itemLabel .
        FILTER(LANG(?itemLabel) = "en")
        OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "en") }
        FILTER(CONTAINS(LCASE(?itemLabel), "oauth"))
      } LIMIT 5`,
    },
  },
  // {
  //   id: "exa",
  //   tool: "exa_search",
  //   params: {
  //     query: "Auth0 client credential best practices API reliability",
  //     numResults: 5,
  //   },
  // },
];

const results: Record<string, unknown> = {};

async function run(): Promise<void> {
  for (const entry of plan) {
    const provider = registry.createProviderInstance(entry.id, ctx);
    try {
      const data = await provider.executeTool(entry.tool, entry.params as Record<string, unknown>);
      results[entry.id] = { ok: true, sample: data };
    } catch (error) {
      results[entry.id] = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  console.log(JSON.stringify(results, null, 2));
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(scriptDir, "..", "..", "..");
  const reportsDir = join(repoRoot, "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, "academic-research.json"), JSON.stringify(results, null, 2));
}

run().catch((error) => {
  console.error("Failed to run academic research", error);
  process.exitCode = 1;
});
