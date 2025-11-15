import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getAcademicRegistry } from "../registry/index.js";
import type {
  ProviderInstance,
  ProviderRegistration,
} from "../registry/providers/academic.js";
import type { DiagnosticContext, EvidencePointer, Finding } from "../types.js";

export const DEFAULT_PROVIDERS = [
  "context7",
  "research-quality",
  "openalex",
  "exa",
  "wikidata",
  "arxiv",
  "cortex-vibe",
];

interface ProviderExecutionContext {
  topic: string;
  question?: string;
  limit: number;
  includeLicense: boolean;
}

interface ProviderExecutionResult {
  providerId: string;
  providerName: string;
  findings: Finding[];
  notes?: string[];
  raw?: unknown;
}

export interface AcademicResearchOptions {
  topic: string;
  question?: string;
  providers?: string[];
  limit?: number;
  includeLicense?: boolean;
  deterministic?: boolean;
  outputDir?: string;
  headers?: Record<string, string>;
  credentials?: Record<string, string>;
}

export interface ResearchError {
  providerId: string;
  message: string;
}

export interface AcademicResearchReport {
  topic: string;
  question?: string;
  timestamp: string;
  providers: ProviderExecutionResult[];
  findings: Finding[];
  summary: {
    totalFindings: number;
    providersRequested: number;
    providersResponded: number;
    errors: ResearchError[];
  };
  artifacts?: {
    dir: string;
    markdown: string;
    json: string;
  };
}

type ProviderExecutor = (
  instance: ProviderInstance,
  registration: ProviderRegistration,
  ctx: ProviderExecutionContext,
) => Promise<ProviderExecutionResult>;

const providerExecutors: Record<string, ProviderExecutor> = {
  "semantic-scholar": async (instance, registration, ctx) => {
    const papers = (await instance.executeTool(
      "semantic_scholar_search_papers",
      {
        query: ctx.question ? `${ctx.topic} ${ctx.question}` : ctx.topic,
        limit: ctx.limit,
        fields: [
          "title",
          "abstract",
          "authors",
          "citationCount",
          "year",
          "url",
        ],
        minCitationCount: 0,
      },
    )) as Array<Record<string, unknown>>;
    const findings = (papers ?? []).map((paper, index) => {
      const title = String(
        paper.title ?? `Semantic Scholar result ${index + 1}`,
      );
      const abstract = String(paper.abstract ?? "No abstract available");
      const url = String(paper.url ?? "");
      const citations = Number(paper.citationCount ?? 0);
      const confidence = Math.min(1, Math.max(0.3, citations / 200));
      const evidence: EvidencePointer[] = [];
      if (url) evidence.push({ type: "url", ref: url });
      return {
        id: `research.semantic-scholar.${index + 1}`,
        area: "research",
        severity: "info",
        title,
        description: abstract,
        evidence,
        tags: buildTags(ctx.topic, registration.id),
        confidence,
      } satisfies Finding;
    });
    return {
      providerId: registration.id,
      providerName: registration.name,
      findings: findings.slice(0, ctx.limit),
      raw: papers,
    };
  },
  openalex: async (instance, registration, ctx) => {
    const works = (await instance.executeTool("openalex_search_works", {
      query: ctx.topic,
      per_page: ctx.limit,
      sort: "cited_by_count:desc",
      filter: ctx.question
        ? `concepts.display_name.search:${ctx.question}`
        : undefined,
    })) as Array<Record<string, unknown>>;
    const findings = (works ?? []).map((work, index) => {
      const title = String(work.title ?? `OpenAlex work ${index + 1}`);
      const summary = String(
        work.abstract ?? work.display_name ?? "No abstract available",
      );
      const primaryLocation = work.primary_location as
        | { source?: { url?: string } }
        | undefined;
      const url = String(primaryLocation?.source?.url ?? work.id ?? "");
      const citations = Number(work.cited_by_count ?? 0);
      const evidence: EvidencePointer[] = [];
      if (url) evidence.push({ type: "url", ref: url });
      return {
        id: `research.openalex.${index + 1}`,
        area: "research",
        severity: "info",
        title,
        description: summary,
        evidence,
        confidence: Math.min(1, Math.max(0.25, citations / 500)),
        tags: buildTags(ctx.topic, registration.id),
      } satisfies Finding;
    });
    return {
      providerId: registration.id,
      providerName: registration.name,
      findings: findings.slice(0, ctx.limit),
      raw: works,
    };
  },
  arxiv: async (instance, registration, ctx) => {
    const papers = (await instance.executeTool("arxiv_search_papers", {
      query: ctx.topic,
      max_results: ctx.limit,
      sort_by: "submittedDate",
      sort_order: "descending",
    })) as Array<Record<string, unknown>>;
    const findings = (papers ?? []).map((paper, index) => {
      const title = String(paper.title ?? `arXiv paper ${index + 1}`);
      const summary = String(paper.summary ?? "No summary available");
      const url = String(paper.id ?? "");
      const published = String(paper.published ?? "");
      const evidence: EvidencePointer[] = [];
      if (url) evidence.push({ type: "url", ref: url });
      return {
        id: `research.arxiv.${index + 1}`,
        area: "research",
        severity: "info",
        title,
        description: summary,
        evidence,
        tags: buildTags(ctx.topic, registration.id),
        recommendation: published ? `Published ${published}` : undefined,
      } satisfies Finding;
    });
    return {
      providerId: registration.id,
      providerName: registration.name,
      findings: findings.slice(0, ctx.limit),
      raw: papers,
    };
  },
  context7: async (instance, registration, ctx) => {
    const analysis = await instance.executeTool("context7_analyze_paper", {
      title: ctx.topic,
      abstract: ctx.question,
      analysis_depth: "medium",
      include_citations: true,
      include_temporal: true,
      include_thematic: true,
    });
    const summaryFinding: Finding = {
      id: "research.context7.1",
      area: "research",
      severity: "info",
      title: `Contextual analysis for ${ctx.topic}`,
      description: JSON.stringify(analysis, null, 2).slice(0, 1000),
      evidence: [
        {
          type: "log",
          ref: "context7",
        },
      ],
      tags: buildTags(ctx.topic, registration.id),
    };
    return {
      providerId: registration.id,
      providerName: registration.name,
      findings: [summaryFinding],
      raw: analysis,
    };
  },
  "research-quality": async (instance, registration, ctx) => {
    const assessment = await instance.executeTool("research_quality_assess_quality", {
      text: ctx.topic,
      title: ctx.topic,
      criteria: ["methodology", "completeness", "accuracy"],
    });
    const score = Number(
      (assessment as { metrics?: { overall_score?: number } })?.metrics?.overall_score ?? 0.5,
    );
    return {
      providerId: registration.id,
      providerName: registration.name,
      findings: [
        {
          id: "research.research-quality.1",
          area: "research",
          severity: score >= 0.7 ? "info" : score >= 0.5 ? "minor" : "major",
          title: `Research Quality score ${(score * 100).toFixed(1)}%`,
          description: JSON.stringify(assessment, null, 2).slice(0, 1000),
          evidence: [],
          tags: buildTags(ctx.topic, registration.id),
          confidence: score,
        },
      ],
      raw: assessment,
    };
  },
  "cortex-vibe": async (instance, registration, ctx) => {
    const vibeCheck = await instance.executeTool("cortex_vibe_check", {
      taskContext: ctx.topic,
      currentPlan: ctx.question ?? "Analyze research topic",
    });
    const questions = (vibeCheck as { questions?: string[] })?.questions ?? [];
    return {
      providerId: registration.id,
      providerName: registration.name,
      findings: [
        {
          id: "research.cortex-vibe.1",
          area: "research",
          severity: "info",
          title: "Cortex Vibe metacognitive check",
          description: `Questions to consider:\n${questions.join("\n")}`,
          evidence: [],
          tags: buildTags(ctx.topic, registration.id),
          confidence: 0.8,
        },
      ],
      raw: vibeCheck,
    };
  },
  exa: async (instance, registration, ctx) => {
    const results = (await instance.executeTool("exa_search", {
      query: ctx.topic,
      limit: ctx.limit,
      includeAnalysis: false,
    })) as Array<Record<string, unknown>>;
    const findings = (results ?? []).map((result, index) => {
      const title = String(result.title ?? `Exa result ${index + 1}`);
      const snippet = String(result.snippet ?? "No snippet available");
      const url = String(result.url ?? "");
      const relevance = Number(result.relevanceScore ?? 0.6);
      const evidence: EvidencePointer[] = [];
      if (url) evidence.push({ type: "url", ref: url });
      return {
        id: `research.exa.${index + 1}`,
        area: "research",
        severity: "info",
        title,
        description: snippet,
        evidence,
        confidence: Math.min(1, Math.max(0.3, relevance)),
        tags: buildTags(ctx.topic, registration.id),
      } satisfies Finding;
    });
    return {
      providerId: registration.id,
      providerName: registration.name,
      findings: findings.slice(0, ctx.limit),
      raw: results,
    };
  },
  wikidata: async (instance, registration, ctx) => {
    const query = `SELECT ?item ?itemLabel WHERE { ?item wdt:P31 wd:Q11424 . ?item rdfs:label ?itemLabel FILTER(LANG(?itemLabel) = "en") FILTER(CONTAINS(LCASE(?itemLabel), "${ctx.topic.toLowerCase()}")) } LIMIT ${ctx.limit}`;
    const data = await instance.executeTool("sparql_query", { query });
    const bindings =
      (
        data as {
          results?: { bindings?: Array<Record<string, { value?: string }>> };
        }
      )?.results?.bindings ?? [];
    const findings = bindings.map((binding, index) => {
      const label = binding.itemLabel?.value ?? `Wikidata entity ${index + 1}`;
      return {
        id: `research.wikidata.${index + 1}`,
        area: "research",
        severity: "info",
        title: label,
        description: `Entity reference for ${ctx.topic}`,
        evidence: binding.item?.value
          ? [{ type: "url", ref: binding.item.value }]
          : [],
        tags: buildTags(ctx.topic, registration.id),
      } satisfies Finding;
    });
    return {
      providerId: registration.id,
      providerName: registration.name,
      findings: findings.slice(0, ctx.limit),
      raw: data,
    };
  },
};

function buildTags(topic: string, providerId: string): string[] {
  return ["academic", providerId, slugify(topic)];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function createResearchContext(
  topic: string,
  deterministic: boolean,
  headers: Record<string, string>,
): DiagnosticContext {
  return {
    endpoint: `research://${slugify(topic)}`,
    headers,
    logger: () => undefined,
    request: async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
      const response = await fetch(input, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as T;
      }
    },
    jsonrpc: async () => ({}) as unknown,
    sseProbe: async () => ({ ok: true }),
    evidence: () => undefined,
    deterministic,
  } as DiagnosticContext;
}

async function writeArtifacts(
  report: AcademicResearchReport,
  outDir: string,
): Promise<AcademicResearchReport["artifacts"]> {
  const topicSlug = slugify(report.topic) || "research";
  const stamp = report.timestamp.replace(/[:.]/g, "-");
  const dir = resolve(outDir, topicSlug, stamp);
  await mkdir(dir, { recursive: true });
  const jsonPath = join(dir, "research.json");
  const markdownPath = join(dir, "research.md");
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(markdownPath, buildMarkdown(report), "utf8");
  return { dir, json: jsonPath, markdown: markdownPath };
}

function buildMarkdown(report: AcademicResearchReport): string {
  const lines: string[] = [];
  lines.push("# Academic Research Report");
  lines.push(`- **Topic:** ${report.topic}`);
  if (report.question) lines.push(`- **Question:** ${report.question}`);
  lines.push(`- **Timestamp:** ${report.timestamp}`);
  lines.push(
    `- **Providers:** ${report.summary.providersResponded}/${report.summary.providersRequested}`,
  );
  lines.push(`- **Findings:** ${report.summary.totalFindings}`);
  if (report.summary.errors.length) {
    lines.push("- **Errors:**");
    for (const error of report.summary.errors) {
      lines.push(`  - ${error.providerId}: ${error.message}`);
    }
  }
  lines.push("\n## Findings\n");
  for (const provider of report.providers) {
    lines.push(`### ${provider.providerName}`);
    if (provider.findings.length === 0) {
      lines.push("No findings returned.\n");
      continue;
    }
    for (const finding of provider.findings) {
      lines.push(`- **${finding.title}**`);
      lines.push(`  - Severity: ${finding.severity}`);
      if (finding.confidence !== undefined) {
        lines.push(`  - Confidence: ${(finding.confidence * 100).toFixed(1)}%`);
      }
      lines.push(`  - ${finding.description ?? "No description"}`);
      if (finding.evidence?.length) {
        const first = finding.evidence[0];
        if (first) {
          lines.push(`  - Evidence: ${first.ref}`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function runAcademicResearch(
  options: AcademicResearchOptions,
): Promise<AcademicResearchReport> {
  const topic = options.topic?.trim();
  if (!topic) {
    throw new Error("Topic is required for academic research");
  }

  const providerIds = normalizeProviders(options.providers);
  const { headers, missingCredentials } = resolveCredentialHeaders(
    providerIds,
    options,
  );
  const context = createResearchContext(
    topic,
    Boolean(options.deterministic),
    headers,
  );
  const execCtx = createExecutionContext(topic, options);

  const { providers, errors } = await executeProviders({
    providerIds,
    context,
    execCtx,
    missingCredentials,
  });

  const report = createReport({
    topic,
    question: options.question,
    providersRequested: providerIds.length,
    providers,
    errors,
  });

  if (options.outputDir) {
    report.artifacts = await writeArtifacts(report, options.outputDir);
  }

  return report;
}

export interface ProviderSelectionResult {
  ready: string[];
  missing: Array<{ id: string; vars: string[] }>;
}

export function selectConfiguredProviders(
  explicit?: string[],
): ProviderSelectionResult {
  const requested = normalizeProviders(explicit);
  const ready: string[] = [];
  const missing: Array<{ id: string; vars: string[] }> = [];

  for (const providerId of requested) {
    const requirement = ACADEMIC_PROVIDER_ENV_REQUIREMENTS[providerId];
    const required = requirement?.required ?? [];
    const missingVars = required.filter(
      (key) => !(process.env[key] ?? "").toString().trim(),
    );
    if (missingVars.length > 0) {
      missing.push({ id: providerId, vars: missingVars });
      continue;
    }
    ready.push(providerId);
  }

  return { ready, missing };
}

function normalizeProviders(explicit?: string[]): string[] {
  if (explicit && explicit.length > 0) {
    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const id of explicit) {
      const trimmed = id?.trim().toLowerCase();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      normalized.push(trimmed);
    }
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return DEFAULT_PROVIDERS;
}

function createExecutionContext(
  topic: string,
  options: AcademicResearchOptions,
): ProviderExecutionContext {
  return {
    topic,
    question: options.question,
    limit: options.limit ?? 5,
    includeLicense: options.includeLicense ?? true,
  };
}

async function executeProviders(params: {
  providerIds: string[];
  context: DiagnosticContext;
  execCtx: ProviderExecutionContext;
  missingCredentials: Map<string, string>;
}): Promise<{ providers: ProviderExecutionResult[]; errors: ResearchError[] }> {
  const registry = getAcademicRegistry();
  const providers: ProviderExecutionResult[] = [];
  const errors: ResearchError[] = [];

  for (const providerId of params.providerIds) {
    const missingMessage = params.missingCredentials.get(providerId);
    if (missingMessage) {
      errors.push({ providerId, message: missingMessage });
      continue;
    }
    const handler = providerExecutors[providerId];
    if (!handler) {
      errors.push({ providerId, message: "No handler defined" });
      continue;
    }
    try {
      const registration = registry.getProvider(providerId);
      if (!registration) {
        errors.push({ providerId, message: "Provider not registered" });
        continue;
      }
      const instance = registry.createProviderInstance(
        providerId,
        params.context,
      );
      const result = await handler(instance, registration, params.execCtx);
      providers.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ providerId, message });
    }
  }

  return { providers, errors };
}

function createReport(input: {
  topic: string;
  question?: string;
  providersRequested: number;
  providers: ProviderExecutionResult[];
  errors: ResearchError[];
}): AcademicResearchReport {
  const findings = input.providers.flatMap((provider) => provider.findings);
  return {
    topic: input.topic,
    question: input.question,
    timestamp: new Date().toISOString(),
    providers: input.providers,
    findings,
    summary: {
      totalFindings: findings.length,
      providersRequested: input.providersRequested,
      providersResponded: input.providers.length,
      errors: input.errors,
    },
  };
}

export const ACADEMIC_PROVIDER_CREDENTIALS: Record<
  string,
  {
    envVar: string;
    header: string;
    required: boolean;
    description: string;
    format?: (value: string) => string;
  }
> = {
  exa: {
    envVar: "EXA_API_KEY",
    header: "x-exa-api-key",
    required: true,
    description: "Exa API key",
  },
  "semantic-scholar": {
    envVar: "SEMANTIC_SCHOLAR_API_KEY",
    header: "x-api-key",
    required: false,
    description: "Semantic Scholar API key",
  },
  context7: {
    envVar: "CONTEXT7_API_KEY",
    header: "authorization",
    required: true,
    description: "Context7 API key",
    format: (value: string) =>
      value.toLowerCase().startsWith("bearer ") ? value : `Bearer ${value}`,
  },
};

export const ACADEMIC_PROVIDER_HEADER_OVERRIDES: Record<
  string,
  Array<{
    envVar: string;
    header: string;
    format?: (value: string) => string;
  }>
> = {
  context7: [
    { envVar: "CONTEXT7_API_BASE_URL", header: "context7-base-url" },
    { envVar: "CONTEXT7_PROFILE", header: "x-context7-profile" },
  ],
  "cortex-vibe": [
    { envVar: "CORTEX_VIBE_HTTP_URL", header: "cortex-vibe-base-url" },
  ],
  openalex: [
    {
      envVar: "OPENALEX_CONTACT_EMAIL",
      header: "x-openalex-contact",
      format: (value) => value.trim().toLowerCase(),
    },
  ],
};

export const ACADEMIC_PROVIDER_ENV_REQUIREMENTS: Record<
  string,
  { name: string; required: string[]; optional?: string[] }
> = {
  "semantic-scholar": {
    name: "Semantic Scholar",
    required: ["SEMANTIC_SCHOLAR_API_KEY"],
  },
  openalex: {
    name: "OpenAlex",
    required: ["OPENALEX_CONTACT_EMAIL"],
  },
  arxiv: {
    name: "arXiv",
    required: [],
  },
  context7: {
    name: "Context7",
    required: ["CONTEXT7_API_KEY", "CONTEXT7_API_BASE_URL"],
    optional: ["CONTEXT7_PROFILE"],
  },
  "research-quality": {
    name: "Research Quality",
    required: [],
    optional: ["RESEARCH_QUALITY_API_KEY", "RESEARCH_QUALITY_HTTP_URL"],
  },
  "cortex-vibe": {
    name: "Cortex Vibe",
    required: [],
    optional: ["CORTEX_VIBE_HTTP_URL"],
  },
  exa: {
    name: "Exa",
    required: ["EXA_API_KEY"],
  },
  wikidata: {
    name: "Wikidata",
    required: [],
  },
};

function resolveCredentialHeaders(
  providerIds: string[],
  options: AcademicResearchOptions,
): {
  headers: Record<string, string>;
  missingCredentials: Map<string, string>;
} {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  const missing = new Map<string, string>();
  const credentialOverrides = options.credentials ?? {};

  for (const providerId of providerIds) {
    const config = ACADEMIC_PROVIDER_CREDENTIALS[providerId];
    if (!config) continue;
    const override = credentialOverrides[providerId];
    const envValue = process.env[config.envVar];
    const value = (override ?? envValue ?? "").trim();
    if (value) {
      headers[config.header] = config.format ? config.format(value) : value;
      continue;
    }
    if (config.required) {
      missing.set(
        providerId,
        `${config.description} missing. Provide via --credential ${providerId}:<value> or set ${config.envVar}.`,
      );
    }
  }

  for (const providerId of providerIds) {
    const overrides = ACADEMIC_PROVIDER_HEADER_OVERRIDES[providerId];
    if (!overrides) continue;
    for (const override of overrides) {
      if (headers[override.header]) continue;
      const value = process.env[override.envVar];
      if (value && value.trim().length > 0) {
        headers[override.header] = override.format
          ? override.format(value)
          : value.trim();
      }
    }
  }

  return { headers, missingCredentials: missing };
}
