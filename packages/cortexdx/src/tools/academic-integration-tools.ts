/**
 * Academic Integration MCP Tools
 * Provides MCP tool definitions for academic validation, research integration, and citation checking
 * Requirements: 6.2, 10.2, 11.4
 */

import { runAcademicResearch } from "../research/academic-researcher.js";
import { recordResearchReport } from "../resources/research-store.js";
import type { McpTool, McpToolResult } from "../types.js";

export const createAcademicIntegrationTools = (): McpTool[] => [
  {
    name: "validate_architecture_academic",
    description:
      "Validate MCP architecture against academic research and best practices using Context7 provider. Includes license compliance checking.",
    inputSchema: {
      type: "object",
      properties: {
        architectureSpec: {
          type: "string",
          description:
            "Architecture specification or design document to validate",
        },
        endpoint: {
          type: "string",
          description:
            "MCP server endpoint for live architecture analysis (optional)",
        },
        researchDomains: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific research domains to validate against (e.g., 'distributed systems', 'API design')",
        },
        includeLicenseValidation: {
          type: "boolean",
          description:
            "Include license compliance validation for research sources (default: true)",
        },
        checkCodeQuality: {
          type: "boolean",
          description: "Include code quality assessment (default: true)",
        },
      },
      required: ["architectureSpec"],
    },
  },

  {
    name: "validate_research_methodology",
    description:
      "Validate implementation against academic research methodology using Semantic Scholar provider. Includes citation checking and IP validation.",
    inputSchema: {
      type: "object",
      properties: {
        implementation: {
          type: "string",
          description: "Implementation code or design to validate",
        },
        researchPapers: {
          type: "array",
          items: { type: "string" },
          description:
            "Research paper IDs or DOIs to validate against (optional)",
        },
        methodology: {
          type: "string",
          description:
            "Specific methodology to validate (e.g., 'microservices', 'event-driven')",
        },
        includeCitationCheck: {
          type: "boolean",
          description:
            "Include citation checking and validation (default: true)",
        },
        validateIntellectualProperty: {
          type: "boolean",
          description:
            "Validate intellectual property compliance (default: true)",
        },
      },
      required: ["implementation"],
    },
  },
  {
    name: "analyze_research_trends",
    description:
      "Analyze research trends and validate implementation against latest academic findings using OpenAlex provider. Includes license compatibility assessment.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "Research topic or domain to analyze (e.g., 'MCP protocol design', 'API security')",
        },
        implementation: {
          type: "string",
          description: "Implementation to validate against trends (optional)",
        },
        timeRange: {
          type: "object",
          properties: {
            start: { type: "string", description: "Start year (e.g., '2020')" },
            end: { type: "string", description: "End year (e.g., '2024')" },
          },
          description: "Time range for trend analysis (optional)",
        },
        includeCitationNetwork: {
          type: "boolean",
          description: "Include citation network analysis (default: true)",
        },
        validateLicenseCompatibility: {
          type: "boolean",
          description:
            "Validate license compatibility of research sources (default: true)",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "validate_knowledge_graph",
    description:
      "Validate data structures and relationships using Wikidata knowledge graph. Provides entity validation and relationship verification.",
    inputSchema: {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              properties: { type: "object" },
            },
          },
          description: "Entities to validate against Wikidata",
        },
        relationships: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              target: { type: "string" },
              type: { type: "string" },
            },
          },
          description: "Relationships to verify (optional)",
        },
        includeEntityValidation: {
          type: "boolean",
          description: "Validate entity definitions (default: true)",
        },
        includeRelationshipVerification: {
          type: "boolean",
          description: "Verify relationship correctness (default: true)",
        },
      },
      required: ["entities"],
    },
  },
  {
    name: "analyze_preprint_research",
    description:
      "Analyze preprint research papers from arXiv with license compliance checking. Provides technical validation and research trend integration.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for arXiv papers",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "arXiv categories to search (e.g., 'cs.DC', 'cs.SE')",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of papers to analyze (default: 10)",
        },
        includeTechnicalValidation: {
          type: "boolean",
          description:
            "Include technical validation of findings (default: true)",
        },
        validateLicenseCompliance: {
          type: "boolean",
          description: "Validate license compliance of papers (default: true)",
        },
        integrateWithImplementation: {
          type: "string",
          description: "Implementation to integrate findings with (optional)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_academic_validation",
    description:
      "Advanced search and validation using Exa provider. Provides content analysis and relevance scoring for academic sources.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for academic validation",
        },
        validationTarget: {
          type: "string",
          description: "Implementation or concept to validate",
        },
        searchDepth: {
          type: "string",
          enum: ["quick", "standard", "comprehensive"],
          description: "Search depth and thoroughness (default: standard)",
        },
        includeRelevanceScoring: {
          type: "boolean",
          description: "Include relevance scoring for results (default: true)",
        },
        includeContentAnalysis: {
          type: "boolean",
          description: "Include detailed content analysis (default: true)",
        },
        minConfidence: {
          type: "number",
          description:
            "Minimum confidence score for results (0-1, default: 0.7)",
        },
      },
      required: ["query", "validationTarget"],
    },
  },
  {
    name: "check_citation_compliance",
    description:
      "Check citation compliance and validate proper attribution of academic sources. Ensures intellectual property compliance.",
    inputSchema: {
      type: "object",
      properties: {
        implementation: {
          type: "string",
          description: "Implementation code or documentation to check",
        },
        expectedCitations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              doi: { type: "string" },
              authors: { type: "array", items: { type: "string" } },
            },
          },
          description: "Expected citations to validate (optional)",
        },
        checkAttributionCompleteness: {
          type: "boolean",
          description: "Check for complete attribution (default: true)",
        },
        validateCitationFormat: {
          type: "boolean",
          description: "Validate citation format correctness (default: true)",
        },
        identifyMissingCitations: {
          type: "boolean",
          description: "Identify potentially missing citations (default: true)",
        },
      },
      required: ["implementation"],
    },
  },
  {
    name: "generate_research_report",
    description:
      "Generate comprehensive research validation report combining findings from all academic providers. Includes license compliance summary.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "MCP implementation or design to report on",
        },
        providers: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "context7",
              "research-quality",
              "semantic-scholar",
              "openalex",
              "wikidata",
              "arxiv",
              "exa",
            ],
          },
          description:
            "Academic providers to include in report (includes all if not specified)",
        },
        format: {
          type: "string",
          enum: ["markdown", "json", "html", "pdf"],
          description: "Report output format (default: markdown)",
        },
        includeLicenseSummary: {
          type: "boolean",
          description: "Include license compliance summary (default: true)",
        },
        includeRecommendations: {
          type: "boolean",
          description: "Include improvement recommendations (default: true)",
        },
        includeEvidence: {
          type: "boolean",
          description: "Include evidence and citations (default: true)",
        },
      },
      required: ["target"],
    },
  },
  {
    name: "validate_concept_implementation",
    description:
      "Validate that implementation correctly applies academic concepts and methodologies. Cross-references multiple academic sources.",
    inputSchema: {
      type: "object",
      properties: {
        concept: {
          type: "string",
          description:
            "Academic concept to validate (e.g., 'event sourcing', 'CQRS', 'microservices')",
        },
        implementation: {
          type: "string",
          description: "Implementation code or design to validate",
        },
        referencePapers: {
          type: "array",
          items: { type: "string" },
          description: "Reference papers defining the concept (optional)",
        },
        validateCorrectness: {
          type: "boolean",
          description: "Validate correctness of implementation (default: true)",
        },
        validateCompleteness: {
          type: "boolean",
          description:
            "Validate completeness of implementation (default: true)",
        },
        suggestImprovements: {
          type: "boolean",
          description: "Suggest improvements based on research (default: true)",
        },
      },
      required: ["concept", "implementation"],
    },
  },
  {
    name: "track_research_provenance",
    description:
      "Track provenance of research-based implementations and maintain audit trail for compliance. Ensures proper attribution and license tracking.",
    inputSchema: {
      type: "object",
      properties: {
        implementation: {
          type: "string",
          description: "Implementation to track provenance for",
        },
        researchSources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provider: { type: "string" },
              sourceId: { type: "string" },
              license: { type: "string" },
              usage: { type: "string" },
            },
          },
          description: "Research sources used in implementation",
        },
        generateAuditTrail: {
          type: "boolean",
          description: "Generate detailed audit trail (default: true)",
        },
        validateLicenseChain: {
          type: "boolean",
          description: "Validate license compatibility chain (default: true)",
        },
        includeAttribution: {
          type: "boolean",
          description: "Include proper attribution information (default: true)",
        },
      },
      required: ["implementation", "researchSources"],
    },
  },
  {
    name: "cortexdx_academic_research",
    description: "Aggregate findings from registered academic providers",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Research topic or keyword",
        },
        question: {
          type: "string",
          description: "Optional research question/abstract context",
        },
        providers: {
          type: "array",
          items: { type: "string" },
          description: "Subset of providers to run (defaults to all)",
        },
        limit: {
          type: "number",
          description: "Maximum results per provider",
          minimum: 1,
          maximum: 20,
          default: 5,
        },
        includeLicense: {
          type: "boolean",
          description: "Include license metadata (default true)",
          default: true,
        },
        deterministic: {
          type: "boolean",
          description: "Enable deterministic timestamps/seeds",
          default: false,
        },
        credentials: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Provider credential overrides keyed by provider id",
        },
        headers: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "HTTP headers to forward to providers",
        },
      },
      required: ["topic"],
    },
  },
];

export async function executeAcademicIntegrationTool(tool: McpTool, args: unknown): Promise<McpToolResult> {
  if (tool.name !== "cortexdx_academic_research") {
    throw new Error(`Unknown academic integration tool: ${tool.name}`);
  }

  const {
    topic,
    question,
    providers,
    limit,
    includeLicense,
    deterministic,
    credentials,
    headers,
  } = args as {
    topic?: string;
    question?: string;
    providers?: string[];
    limit?: number;
    includeLicense?: boolean;
    deterministic?: boolean;
    credentials?: Record<string, string>;
    headers?: Record<string, string>;
  };

  if (!topic || topic.trim().length === 0) {
    throw new Error("topic is required for cortexdx_academic_research");
  }

  const report = await runAcademicResearch({
    topic: topic.trim(),
    question,
    providers,
    limit,
    includeLicense,
    deterministic,
    credentials,
    headers,
  });

  const resource = recordResearchReport(report);
  const resourceUri = `cortexdx://research/${resource.id}`;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ resourceUri, report }, null, 2),
      },
    ],
  };
}
