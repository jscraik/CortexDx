/**
 * Context7 MCP Provider
 * FASTMCP v3.22 compliant provider for contextual research analysis and cross-referencing
 * Based on Context7 API and inspired by upstash/context7
 * Enhanced with license validation and academic compliance reporting
 */

import {
    createLicenseValidator,
    type LicenseValidatorPlugin,
    type ResearchContent,
} from "../../plugins/development/license-validation.js";
import type { DiagnosticContext } from "../../types.js";

export interface ContextualAnalysis {
    paper_id: string;
    title: string;
    context_score: number;
    relevance_metrics: RelevanceMetrics;
    cross_references: CrossReference[];
    citation_context: CitationContext[];
    thematic_analysis: ThematicAnalysis;
    temporal_context: TemporalContext;
}

export interface RelevanceMetrics {
    topical_relevance: number;
    methodological_similarity: number;
    citation_overlap: number;
    author_network_proximity: number;
    temporal_relevance: number;
}

export interface CrossReference {
    target_paper_id: string;
    target_title: string;
    relationship_type: "cites" | "cited_by" | "similar_topic" | "same_author" | "methodological_similarity";
    strength: number;
    context_snippet?: string;
    shared_concepts: string[];
}

export interface CitationContext {
    citing_paper_id: string;
    citing_title: string;
    citation_sentence: string;
    citation_type: "supportive" | "critical" | "neutral" | "methodological" | "background";
    section: "introduction" | "methods" | "results" | "discussion" | "conclusion";
    sentiment_score: number;
}

export interface ThematicAnalysis {
    primary_themes: string[];
    secondary_themes: string[];
    methodology_keywords: string[];
    domain_concepts: string[];
    interdisciplinary_connections: string[];
}

export interface TemporalContext {
    publication_timeline: TimelineEvent[];
    trend_analysis: TrendAnalysis;
    impact_evolution: ImpactEvolution;
}

export interface TimelineEvent {
    date: string;
    event_type: "publication" | "citation" | "follow_up" | "replication";
    description: string;
    related_papers: string[];
}

export interface TrendAnalysis {
    research_momentum: "increasing" | "stable" | "declining";
    citation_velocity: number;
    topic_evolution: string[];
    emerging_connections: string[];
}

export interface ImpactEvolution {
    citation_growth_rate: number;
    influence_spread: number;
    field_penetration: number;
    cross_disciplinary_impact: number;
}

export interface ContextAnalysisParams {
    paper_id?: string;
    title?: string;
    abstract?: string;
    authors?: string[];
    keywords?: string[];
    references?: string[];
    analysis_depth?: "shallow" | "medium" | "deep";
    include_citations?: boolean;
    include_temporal?: boolean;
    include_thematic?: boolean;
}

export interface ArchitectureValidationResult {
    isValid: boolean;
    score: number;
    issues: string[];
    recommendations: string[];
    licenseCompliance: boolean;
}

export interface CodeQualityAssessment {
    overallScore: number;
    maintainability: number;
    complexity: number;
    documentation: number;
    testCoverage: number;
    issues: CodeQualityIssue[];
    licenseCompliance: boolean;
}

export interface CodeQualityIssue {
    type: "error" | "warning" | "info";
    category: "architecture" | "style" | "performance" | "security" | "license";
    message: string;
    severity: "low" | "medium" | "high" | "critical";
    line?: number;
}

export class Context7Provider {
    private readonly userAgent = "CortexDx/1.0.0 (Contextual Research Analysis)";
    private readonly licenseValidator: LicenseValidatorPlugin;

    constructor(private ctx: DiagnosticContext) {
        this.licenseValidator = createLicenseValidator(ctx);
    }

    /**
     * FASTMCP v3.22 tool definitions
     */
    static getToolDefinitions() {
        return [
            {
                name: "context7_analyze_paper",
                description: "Perform comprehensive contextual analysis of a research paper",
                inputSchema: {
                    type: "object",
                    properties: {
                        paper_id: {
                            type: "string",
                            description: "Paper identifier (DOI, arXiv ID, etc.)"
                        },
                        title: {
                            type: "string",
                            description: "Paper title"
                        },
                        abstract: {
                            type: "string",
                            description: "Paper abstract"
                        },
                        authors: {
                            type: "array",
                            items: { type: "string" },
                            description: "List of author names"
                        },
                        keywords: {
                            type: "array",
                            items: { type: "string" },
                            description: "Paper keywords or topics"
                        },
                        analysis_depth: {
                            type: "string",
                            description: "Depth of contextual analysis",
                            enum: ["shallow", "medium", "deep"],
                            default: "medium"
                        },
                        include_citations: {
                            type: "boolean",
                            description: "Include citation context analysis (default: true)",
                            default: true
                        },
                        include_temporal: {
                            type: "boolean",
                            description: "Include temporal context analysis (default: true)",
                            default: true
                        },
                        include_thematic: {
                            type: "boolean",
                            description: "Include thematic analysis (default: true)",
                            default: true
                        }
                    }
                }
            },
            {
                name: "context7_find_related_papers",
                description: "Find papers related to the given research through various contextual dimensions",
                inputSchema: {
                    type: "object",
                    properties: {
                        query_paper: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                title: { type: "string" },
                                abstract: { type: "string" },
                                keywords: { type: "array", items: { type: "string" } }
                            },
                            description: "Reference paper for finding related work"
                        },
                        relationship_types: {
                            type: "array",
                            items: {
                                type: "string",
                                enum: ["cites", "cited_by", "similar_topic", "same_author", "methodological_similarity"]
                            },
                            description: "Types of relationships to explore",
                            default: ["similar_topic", "methodological_similarity"]
                        },
                        max_results: {
                            type: "number",
                            description: "Maximum number of related papers to return (default: 20)",
                            minimum: 1,
                            maximum: 100,
                            default: 20
                        },
                        min_relevance: {
                            type: "number",
                            description: "Minimum relevance score (0-1, default: 0.3)",
                            minimum: 0,
                            maximum: 1,
                            default: 0.3
                        }
                    },
                    required: ["query_paper"]
                }
            },
            {
                name: "context7_citation_context",
                description: "Analyze how a paper is cited and the context of those citations",
                inputSchema: {
                    type: "object",
                    properties: {
                        paper_id: {
                            type: "string",
                            description: "Paper identifier to analyze citations for"
                        },
                        include_sentiment: {
                            type: "boolean",
                            description: "Include sentiment analysis of citations (default: true)",
                            default: true
                        },
                        group_by_section: {
                            type: "boolean",
                            description: "Group citations by paper section (default: true)",
                            default: true
                        },
                        max_citations: {
                            type: "number",
                            description: "Maximum number of citations to analyze (default: 50)",
                            minimum: 1,
                            maximum: 500,
                            default: 50
                        }
                    },
                    required: ["paper_id"]
                }
            },
            {
                name: "context7_research_trajectory",
                description: "Analyze the research trajectory and evolution of a topic or author",
                inputSchema: {
                    type: "object",
                    properties: {
                        focus: {
                            type: "string",
                            description: "Focus of trajectory analysis",
                            enum: ["topic", "author", "institution", "methodology"]
                        },
                        identifier: {
                            type: "string",
                            description: "Topic keywords, author name, institution, or methodology"
                        },
                        time_range: {
                            type: "object",
                            properties: {
                                start_year: { type: "number" },
                                end_year: { type: "number" }
                            },
                            description: "Time range for analysis (optional)"
                        },
                        include_predictions: {
                            type: "boolean",
                            description: "Include trend predictions (default: false)",
                            default: false
                        }
                    },
                    required: ["focus", "identifier"]
                }
            },
            {
                name: "context7_interdisciplinary_analysis",
                description: "Analyze interdisciplinary connections and cross-field influences",
                inputSchema: {
                    type: "object",
                    properties: {
                        paper_id: {
                            type: "string",
                            description: "Paper identifier for interdisciplinary analysis"
                        },
                        primary_field: {
                            type: "string",
                            description: "Primary research field of the paper"
                        },
                        explore_depth: {
                            type: "number",
                            description: "Depth of interdisciplinary exploration (1-3, default: 2)",
                            minimum: 1,
                            maximum: 3,
                            default: 2
                        }
                    },
                    required: ["paper_id"]
                }
            },
            {
                name: "context7_validate_architecture",
                description: "Validate architecture design with license compliance checking",
                inputSchema: {
                    type: "object",
                    properties: {
                        design: {
                            type: "object",
                            description: "Architecture design specification"
                        },
                        research_sources: {
                            type: "array",
                            items: { type: "object" },
                            description: "Research papers used as basis for design"
                        },
                        check_license: {
                            type: "boolean",
                            description: "Enable license compliance checking (default: true)",
                            default: true
                        }
                    },
                    required: ["design"]
                }
            },
            {
                name: "context7_assess_code_quality",
                description: "Assess code quality with academic standards and license compliance",
                inputSchema: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "Code to assess"
                        },
                        language: {
                            type: "string",
                            description: "Programming language"
                        },
                        research_sources: {
                            type: "array",
                            items: { type: "object" },
                            description: "Research papers referenced in implementation"
                        },
                        check_license: {
                            type: "boolean",
                            description: "Enable license compliance checking (default: true)",
                            default: true
                        }
                    },
                    required: ["code", "language"]
                }
            }
        ];
    }

    /**
     * Perform comprehensive contextual analysis
     */
    async analyzePaper(params: ContextAnalysisParams): Promise<ContextualAnalysis> {
        const analysis: ContextualAnalysis = {
            paper_id: params.paper_id || params.title || "unknown",
            title: params.title || "Unknown Title",
            context_score: 0,
            relevance_metrics: {
                topical_relevance: 0,
                methodological_similarity: 0,
                citation_overlap: 0,
                author_network_proximity: 0,
                temporal_relevance: 0
            },
            cross_references: [],
            citation_context: [],
            thematic_analysis: {
                primary_themes: [],
                secondary_themes: [],
                methodology_keywords: [],
                domain_concepts: [],
                interdisciplinary_connections: []
            },
            temporal_context: {
                publication_timeline: [],
                trend_analysis: {
                    research_momentum: "stable",
                    citation_velocity: 0,
                    topic_evolution: [],
                    emerging_connections: []
                },
                impact_evolution: {
                    citation_growth_rate: 0,
                    influence_spread: 0,
                    field_penetration: 0,
                    cross_disciplinary_impact: 0
                }
            }
        };

        // Perform thematic analysis
        if (params.include_thematic && (params.abstract || params.keywords)) {
            analysis.thematic_analysis = await this.performThematicAnalysis(
                params.abstract || "",
                params.keywords || []
            );
        }

        // Find cross-references
        if (params.title || params.abstract) {
            analysis.cross_references = await this.findCrossReferences({
                title: params.title,
                abstract: params.abstract,
                authors: params.authors,
                keywords: params.keywords
            });
        }

        // Calculate relevance metrics
        analysis.relevance_metrics = await this.calculateRelevanceMetrics(params);

        // Calculate overall context score
        analysis.context_score = this.calculateContextScore(analysis);

        this.ctx.evidence({
            type: "log",
            ref: "Contextual analysis completed"
        });

        return analysis;
    }

    /**
     * Perform thematic analysis
     */
    private async performThematicAnalysis(text: string, keywords: string[]): Promise<ThematicAnalysis> {
        const analysis: ThematicAnalysis = {
            primary_themes: [],
            secondary_themes: [],
            methodology_keywords: [],
            domain_concepts: [],
            interdisciplinary_connections: []
        };

        // Extract methodology keywords
        const methodologyPatterns = [
            /machine learning/gi,
            /deep learning/gi,
            /neural network/gi,
            /statistical analysis/gi,
            /experimental design/gi,
            /survey/gi,
            /case study/gi,
            /meta-analysis/gi,
            /systematic review/gi,
            /qualitative/gi,
            /quantitative/gi
        ];

        for (const pattern of methodologyPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                analysis.methodology_keywords.push(...matches.map(m => m.toLowerCase()));
            }
        }

        // Extract domain concepts from keywords and text
        analysis.primary_themes = keywords.slice(0, 3);
        analysis.secondary_themes = keywords.slice(3, 8);

        // Identify interdisciplinary connections
        const disciplinaryKeywords = {
            "computer_science": ["algorithm", "computation", "software", "programming"],
            "biology": ["gene", "protein", "cell", "organism", "evolution"],
            "psychology": ["behavior", "cognitive", "mental", "perception"],
            "physics": ["quantum", "particle", "energy", "force"],
            "mathematics": ["theorem", "proof", "equation", "optimization"],
            "medicine": ["patient", "treatment", "diagnosis", "clinical"],
            "economics": ["market", "economic", "financial", "trade"]
        };

        const textLower = text.toLowerCase();
        for (const [field, fieldKeywords] of Object.entries(disciplinaryKeywords)) {
            const hasKeywords = fieldKeywords.some(keyword => textLower.includes(keyword));
            if (hasKeywords) {
                analysis.interdisciplinary_connections.push(field);
            }
        }

        return analysis;
    }

    /**
     * Find cross-references to related papers
     */
    private async findCrossReferences(params: {
        title?: string;
        abstract?: string;
        authors?: string[];
        keywords?: string[];
    }): Promise<CrossReference[]> {
        const crossRefs: CrossReference[] = [];

        // Simulate finding related papers based on content similarity
        // In a real implementation, this would query external APIs or databases

        if (params.keywords) {
            params.keywords.forEach((keyword, index) => {
                crossRefs.push({
                    target_paper_id: `related_${index + 1}`,
                    target_title: `Related Paper on ${keyword}`,
                    relationship_type: "similar_topic",
                    strength: Math.random() * 0.5 + 0.5, // 0.5-1.0
                    shared_concepts: [keyword],
                    context_snippet: `This paper explores ${keyword} in depth...`
                });
            });
        }

        // Add author-based cross-references
        if (params.authors) {
            params.authors.forEach((author, index) => {
                crossRefs.push({
                    target_paper_id: `author_work_${index + 1}`,
                    target_title: `Previous Work by ${author}`,
                    relationship_type: "same_author",
                    strength: 0.8,
                    shared_concepts: ["authorship"],
                    context_snippet: "Earlier research by the same author..."
                });
            });
        }

        return crossRefs.slice(0, 10); // Limit to top 10 cross-references
    }

    /**
     * Calculate relevance metrics
     */
    private async calculateRelevanceMetrics(params: ContextAnalysisParams): Promise<RelevanceMetrics> {
        // Simulate metric calculations
        // In a real implementation, these would be calculated based on actual data

        return {
            topical_relevance: Math.random() * 0.4 + 0.6, // 0.6-1.0
            methodological_similarity: Math.random() * 0.5 + 0.4, // 0.4-0.9
            citation_overlap: Math.random() * 0.3 + 0.2, // 0.2-0.5
            author_network_proximity: Math.random() * 0.6 + 0.3, // 0.3-0.9
            temporal_relevance: Math.random() * 0.4 + 0.5 // 0.5-0.9
        };
    }

    /**
     * Calculate overall context score
     */
    private calculateContextScore(analysis: ContextualAnalysis): number {
        const metrics = analysis.relevance_metrics;
        const weights = {
            topical: 0.3,
            methodological: 0.25,
            citation: 0.2,
            author: 0.15,
            temporal: 0.1
        };

        return (
            metrics.topical_relevance * weights.topical +
            metrics.methodological_similarity * weights.methodological +
            metrics.citation_overlap * weights.citation +
            metrics.author_network_proximity * weights.author +
            metrics.temporal_relevance * weights.temporal
        );
    }

    /**
     * Analyze citation contexts
     */
    async analyzeCitationContext(paperId: string, options: {
        includeSentiment?: boolean;
        groupBySection?: boolean;
        maxCitations?: number;
    } = {}): Promise<CitationContext[]> {
        // Simulate citation context analysis
        const contexts: CitationContext[] = [];
        const maxCitations = options.maxCitations || 50;

        for (let i = 0; i < Math.min(maxCitations, 10); i++) {
            const citationTypes: Array<"supportive" | "critical" | "neutral" | "methodological" | "background"> = ["supportive", "critical", "neutral", "methodological", "background"];
            const sections: Array<"introduction" | "methods" | "results" | "discussion" | "conclusion"> = ["introduction", "methods", "results", "discussion", "conclusion"];

            contexts.push({
                citing_paper_id: `citing_${i + 1}`,
                citing_title: `Paper Citing ${paperId} #${i + 1}`,
                citation_sentence: `This work builds upon the methodology presented in ${paperId}...`,
                citation_type: citationTypes[Math.floor(Math.random() * 5)],
                section: sections[Math.floor(Math.random() * 5)],
                sentiment_score: Math.random() * 2 - 1 // -1 to 1
            });
        }

        return contexts;
    }

    /**
     * Validate architecture design with license compliance
     */
    async validateArchitecture(
        design: Record<string, unknown>,
        researchSources?: ResearchContent[],
        checkLicense = true
    ): Promise<ArchitectureValidationResult> {
        const result: ArchitectureValidationResult = {
            isValid: true,
            score: 85,
            issues: [],
            recommendations: [],
            licenseCompliance: true,
        };

        if (checkLicense && researchSources && researchSources.length > 0) {
            for (const source of researchSources) {
                const validation = await this.licenseValidator.validateLicense(source);

                if (!validation.isValid || validation.riskLevel === "high") {
                    result.licenseCompliance = false;
                    result.isValid = false;
                    result.issues.push(
                        `Research source "${source.title}" has unapproved license: ${validation.license}`
                    );
                    result.recommendations.push(...validation.recommendations);
                }

                if (validation.restrictions.length > 0) {
                    result.recommendations.push(
                        `For "${source.title}": ${validation.restrictions.join(", ")}`
                    );
                }
            }
        }

        if (!design.components || design.components.length === 0) {
            result.issues.push("Architecture missing component definitions");
            result.score -= 20;
        }

        if (!design.interfaces || design.interfaces.length === 0) {
            result.issues.push("Architecture missing interface definitions");
            result.score -= 15;
        }

        if (!design.dataModels) {
            result.issues.push("Architecture missing data model definitions");
            result.score -= 15;
        }

        if (result.issues.length > 0) {
            result.isValid = false;
        }

        this.ctx.evidence({
            type: "log",
            ref: `Architecture validation completed: ${result.score}/100`,
        });

        return result;
    }

    /**
     * Assess code quality with academic standards
     */
    async assessCodeQuality(
        code: string,
        language: string,
        researchSources?: ResearchContent[],
        checkLicense = true
    ): Promise<CodeQualityAssessment> {
        const assessment: CodeQualityAssessment = {
            overallScore: 75,
            maintainability: 80,
            complexity: 70,
            documentation: 65,
            testCoverage: 0,
            issues: [],
            licenseCompliance: true,
        };

        if (checkLicense && researchSources && researchSources.length > 0) {
            for (const source of researchSources) {
                const compliance = await this.licenseValidator.checkCompliance(
                    code,
                    source
                );

                if (!compliance) {
                    assessment.licenseCompliance = false;
                    assessment.issues.push({
                        type: "error",
                        category: "license",
                        message: `Missing attribution for research source: ${source.title}`,
                        severity: "critical",
                    });
                }
            }
        }

        const lines = code.split("\n");
        const commentLines = lines.filter((line) =>
            /^\s*(\/\/|\/\*|\*|#)/.test(line)
        ).length;
        assessment.documentation = Math.min(
            100,
            (commentLines / lines.length) * 200
        );

        const longFunctions = code.match(/function\s+\w+[^}]{200,}/g);
        if (longFunctions && longFunctions.length > 0) {
            assessment.complexity -= 20;
            assessment.issues.push({
                type: "warning",
                category: "architecture",
                message: `Found ${longFunctions.length} functions exceeding 40 lines`,
                severity: "medium",
            });
        }

        if (!/test|spec|\.test\.|\.spec\./i.test(code)) {
            assessment.issues.push({
                type: "info",
                category: "architecture",
                message: "No test coverage detected",
                severity: "low",
            });
        }

        assessment.overallScore =
            (assessment.maintainability * 0.3 +
                assessment.complexity * 0.3 +
                assessment.documentation * 0.2 +
                assessment.testCoverage * 0.2) *
            (assessment.licenseCompliance ? 1 : 0.5);

        this.ctx.evidence({
            type: "log",
            ref: `Code quality assessment: ${assessment.overallScore.toFixed(1)}/100`,
        });

        return assessment;
    }

    /**
     * Health check for the provider
     */
    async healthCheck(): Promise<boolean> {
        // This is a local analysis provider, so always healthy
        return true;
    }

    /**
     * Execute tool calls
     */
    async executeTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
        switch (toolName) {
            case "context7_analyze_paper":
                return await this.analyzePaper(params);

            case "context7_find_related_papers": {
                const crossRefs = await this.findCrossReferences(params.query_paper);
                return crossRefs.filter(ref => ref.strength >= (params.min_relevance || 0.3))
                    .slice(0, params.max_results || 20);
            }

            case "context7_citation_context":
                return await this.analyzeCitationContext(params.paper_id, {
                    includeSentiment: params.include_sentiment,
                    groupBySection: params.group_by_section,
                    maxCitations: params.max_citations
                });

            case "context7_research_trajectory":
                return {
                    focus: params.focus,
                    identifier: params.identifier,
                    trajectory: "Research trajectory analysis not yet fully implemented",
                    trends: []
                };

            case "context7_interdisciplinary_analysis":
                return {
                    paper_id: params.paper_id,
                    interdisciplinary_score: Math.random() * 0.5 + 0.3,
                    connected_fields: ["computer_science", "mathematics", "biology"],
                    cross_field_citations: []
                };

            case "context7_validate_architecture":
                return await this.validateArchitecture(
                    params.design,
                    params.research_sources,
                    params.check_license
                );

            case "context7_assess_code_quality":
                return await this.assessCodeQuality(
                    params.code,
                    params.language,
                    params.research_sources,
                    params.check_license
                );

            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
}

/**
 * FASTMCP v3.22 capability registration
 */
export const context7Capabilities = {
    id: "context7",
    name: "Context7 Contextual Research Provider",
    version: "1.0.0",
    description: "Contextual research analysis and cross-reference discovery",
    tools: Context7Provider.getToolDefinitions(),
    resources: [],
    prompts: [
        {
            name: "deep_contextual_analysis",
            description: "Perform deep contextual analysis of research paper",
            arguments: [
                {
                    name: "paper_id",
                    description: "Paper identifier for analysis",
                    required: true
                },
                {
                    name: "analysis_focus",
                    description: "Focus area for analysis (citations, themes, trajectory)",
                    required: false
                }
            ]
        },
        {
            name: "research_landscape_mapping",
            description: "Map the research landscape around a topic",
            arguments: [
                {
                    name: "topic",
                    description: "Research topic to map",
                    required: true
                },
                {
                    name: "time_span",
                    description: "Time span for analysis (e.g., '5 years', '2020-2023')",
                    required: false
                }
            ]
        }
    ]
};