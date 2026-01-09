/**
 * Academic Providers Index
 * Central exports for all academic research providers
 */

export { arxivCapabilities, ArxivProvider } from "./arxiv.mcp.js";
export { context7Capabilities, Context7Provider } from "./context7.mcp.js";
export {
  cortexVibeCapabilities,
  CortexVibeProvider,
} from "./cortex-vibe.mcp.js";
export { exaCapabilities, ExaProvider } from "./exa.mcp.js";
export { openAlexCapabilities, OpenAlexProvider } from "./openalex.mcp.js";
export {
  researchQualityCapabilities,
  ResearchQualityProvider,
} from "./research-quality.mcp.js";
export {
  semanticScholarCapabilities,
  SemanticScholarProvider,
} from "./semantic-scholar.mcp.js";
export { wikidataCapabilities, WikidataProvider } from "./wikidata.mcp.js";

export type {
  SemanticScholarCitationParams,
  SemanticScholarPaper,
  SemanticScholarSearchParams,
} from "./semantic-scholar.mcp.js";

export type {
  OpenAlexAuthor,
  OpenAlexInstitution,
  OpenAlexSearchParams,
  OpenAlexWork,
} from "./openalex.mcp.js";

export type {
  SparqlResult,
  WikidataEntity,
  WikidataSearchParams,
  WikidataSearchResult,
} from "./wikidata.mcp.js";

export type {
  ArxivCategory,
  ArxivPaper,
  ArxivSearchParams,
} from "./arxiv.mcp.js";

export type {
  IntegrityCheckParams,
  PeerReviewIndicators,
  QualityAssessment,
  QualityFlag,
  ResearchQualityMetrics,
} from "./research-quality.mcp.js";

export type {
  ConstitutionResult,
  ConstitutionRule,
  VibeCheckResult,
  VibeLearnResult,
} from "./cortex-vibe.mcp.js";

export type {
  CitationContext,
  ContextAnalysisParams,
  ContextualAnalysis,
  CrossReference,
  RelevanceMetrics,
  TemporalContext,
  ThematicAnalysis,
} from "./context7.mcp.js";

export type {
  ExaContentAnalysis,
  ExaSearchParams,
  ExaSearchResult,
} from "./exa.mcp.js";
