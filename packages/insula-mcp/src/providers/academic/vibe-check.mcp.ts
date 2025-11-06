/**
 * Vibe Check MCP Provider
 * FASTMCP v3.22 compliant provider for research quality assessment and academic integrity
 * Based on research quality metrics and inspired by PV-Bhat/vibe-check-mcp-server
 * Enhanced with anti-pattern detection, refactoring suggestions, and code health analysis
 */

import {
    createLicenseValidator,
    type LicenseValidatorPlugin,
    type ResearchContent,
} from "../../plugins/development/license-validation.js";
import type { DiagnosticContext, Finding } from "../../types.js";

export interface ResearchQualityMetrics {
    methodology_score: number;
    data_quality_score: number;
    reproducibility_score: number;
    statistical_rigor_score: number;
    ethical_compliance_score: number;
    overall_score: number;
    confidence_level: number;
}

export interface QualityAssessment {
    paper_id: string;
    title: string;
    assessment_date: string;
    metrics: ResearchQualityMetrics;
    flags: QualityFlag[];
    recommendations: string[];
    peer_review_indicators: PeerReviewIndicators;
}

export interface QualityFlag {
    type: "methodology" | "data" | "statistical" | "ethical" | "reproducibility" | "citation";
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    evidence: string[];
    recommendation: string;
}

export interface PeerReviewIndicators {
    venue_quality: "predatory" | "low" | "medium" | "high" | "top_tier" | "unknown";
    citation_patterns: "normal" | "suspicious" | "self_citation_heavy" | "citation_farming";
    author_reputation: "unknown" | "emerging" | "established" | "renowned";
    institutional_affiliation: "verified" | "unverified" | "suspicious" | "unknown";
}

export interface IntegrityCheckParams {
    text?: string;
    doi?: string;
    arxiv_id?: string;
    title?: string;
    authors?: string[];
    venue?: string;
    check_plagiarism?: boolean;
    check_methodology?: boolean;
    check_statistics?: boolean;
    check_ethics?: boolean;
}

export interface AntiPattern {
    name: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    locations: CodeLocation[];
    refactoringSuggestion: string;
    example?: string;
}

export interface CodeLocation {
    line?: number;
    column?: number;
    snippet: string;
}

export interface RefactoringPlan {
    antiPatterns: AntiPattern[];
    overallHealth: number;
    recommendations: string[];
    estimatedEffort: "low" | "medium" | "high";
    priority: "low" | "medium" | "high";
}

export interface CodeHealthAnalysis {
    healthScore: number;
    maintainability: number;
    reliability: number;
    security: number;
    performance: number;
    issues: Finding[];
    antiPatterns: AntiPattern[];
    recommendations: string[];
}

export class VibeCheckProvider {
    private readonly userAgent = "Insula-MCP/1.0.0 (Academic Research Quality Assessment)";
    private readonly licenseValidator: LicenseValidatorPlugin;

    // Quality assessment criteria weights
    private readonly qualityWeights = {
        methodology: 0.25,
        data_quality: 0.20,
        reproducibility: 0.20,
        statistical_rigor: 0.20,
        ethical_compliance: 0.15
    };

    // Known predatory publisher patterns
    private readonly predatoryPatterns = [
        /rapid.*publication/i,
        /guaranteed.*acceptance/i,
        /pay.*publish/i,
        /international.*journal.*science/i,
        /world.*journal/i
    ];

    // Common anti-patterns
    private readonly antiPatternDefinitions = [
        {
            name: "God Object",
            pattern: /class\s+\w+\s*{[^}]{2000,}}/,
            description: "Class with too many responsibilities",
            severity: "high" as const,
            refactoring: "Split into smaller, focused classes following Single Responsibility Principle"
        },
        {
            name: "Magic Numbers",
            pattern: /\b\d{2,}\b(?!\s*[;,)])/,
            description: "Hard-coded numeric values without explanation",
            severity: "medium" as const,
            refactoring: "Extract to named constants with descriptive names"
        },
        {
            name: "Deep Nesting",
            pattern: /\s{12,}if\s*\(/,
            description: "Excessive nesting depth (>3 levels)",
            severity: "medium" as const,
            refactoring: "Extract nested logic into separate functions or use early returns"
        },
        {
            name: "Long Parameter List",
            pattern: /function\s+\w+\s*\([^)]{100,}\)/,
            description: "Function with too many parameters",
            severity: "medium" as const,
            refactoring: "Use parameter objects or builder pattern"
        },
        {
            name: "Duplicate Code",
            pattern: /(.{50,})\n[\s\S]*?\1/,
            description: "Repeated code blocks",
            severity: "high" as const,
            refactoring: "Extract common code into reusable functions"
        }
    ];

    constructor(private ctx: DiagnosticContext) {
        this.licenseValidator = createLicenseValidator(ctx);
    }

    /**
     * FASTMCP v3.22 tool definitions
     */
    static getToolDefinitions() {
        return [
            {
                name: "vibe_check_assess_quality",
                description: "Assess the quality and integrity of academic research",
                inputSchema: {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            description: "Research paper text or abstract for analysis"
                        },
                        doi: {
                            type: "string",
                            description: "DOI of the paper to assess"
                        },
                        arxiv_id: {
                            type: "string",
                            description: "arXiv ID of the paper to assess"
                        },
                        title: {
                            type: "string",
                            description: "Title of the research paper"
                        },
                        authors: {
                            type: "array",
                            items: { type: "string" },
                            description: "List of author names"
                        },
                        venue: {
                            type: "string",
                            description: "Publication venue (journal, conference, etc.)"
                        },
                        check_plagiarism: {
                            type: "boolean",
                            description: "Enable plagiarism detection (default: true)",
                            default: true
                        },
                        check_methodology: {
                            type: "boolean",
                            description: "Enable methodology assessment (default: true)",
                            default: true
                        },
                        check_statistics: {
                            type: "boolean",
                            description: "Enable statistical rigor check (default: true)",
                            default: true
                        },
                        check_ethics: {
                            type: "boolean",
                            description: "Enable ethics compliance check (default: true)",
                            default: true
                        }
                    }
                }
            },
            {
                name: "vibe_check_venue_assessment",
                description: "Assess the quality and reputation of a publication venue",
                inputSchema: {
                    type: "object",
                    properties: {
                        venue_name: {
                            type: "string",
                            description: "Name of the journal, conference, or publication venue"
                        },
                        issn: {
                            type: "string",
                            description: "ISSN of the journal (if applicable)"
                        },
                        publisher: {
                            type: "string",
                            description: "Publisher name"
                        }
                    },
                    required: ["venue_name"]
                }
            },
            {
                name: "vibe_check_citation_analysis",
                description: "Analyze citation patterns for potential manipulation",
                inputSchema: {
                    type: "object",
                    properties: {
                        paper_id: {
                            type: "string",
                            description: "Paper identifier (DOI, arXiv ID, etc.)"
                        },
                        citations: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    citing_paper: { type: "string" },
                                    authors: { type: "array", items: { type: "string" } },
                                    venue: { type: "string" },
                                    date: { type: "string" }
                                }
                            },
                            description: "List of citing papers with metadata"
                        }
                    },
                    required: ["paper_id"]
                }
            },
            {
                name: "vibe_check_methodology_review",
                description: "Review research methodology for common issues",
                inputSchema: {
                    type: "object",
                    properties: {
                        methodology_text: {
                            type: "string",
                            description: "Methodology section text"
                        },
                        research_type: {
                            type: "string",
                            description: "Type of research (experimental, observational, theoretical, etc.)",
                            enum: ["experimental", "observational", "theoretical", "computational", "meta_analysis", "systematic_review"]
                        },
                        sample_size: {
                            type: "number",
                            description: "Sample size (if applicable)"
                        },
                        statistical_methods: {
                            type: "array",
                            items: { type: "string" },
                            description: "Statistical methods used"
                        }
                    },
                    required: ["methodology_text"]
                }
            },
            {
                name: "vibe_check_detect_anti_patterns",
                description: "Detect anti-patterns in code and suggest refactoring",
                inputSchema: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "Code to analyze for anti-patterns"
                        },
                        language: {
                            type: "string",
                            description: "Programming language"
                        },
                        research_sources: {
                            type: "array",
                            items: { type: "object" },
                            description: "Research papers referenced in code"
                        }
                    },
                    required: ["code"]
                }
            },
            {
                name: "vibe_check_refactoring_suggestions",
                description: "Generate refactoring suggestions for code improvements",
                inputSchema: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "Code to analyze"
                        },
                        focus_areas: {
                            type: "array",
                            items: {
                                type: "string",
                                enum: ["maintainability", "performance", "security", "readability"]
                            },
                            description: "Areas to focus refactoring on"
                        }
                    },
                    required: ["code"]
                }
            },
            {
                name: "vibe_check_code_health",
                description: "Comprehensive code health analysis with Finding types",
                inputSchema: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "Code to analyze"
                        },
                        language: {
                            type: "string",
                            description: "Programming language"
                        },
                        research_sources: {
                            type: "array",
                            items: { type: "object" },
                            description: "Research papers used in implementation"
                        }
                    },
                    required: ["code"]
                }
            }
        ];
    }

    /**
     * Assess overall research quality
     */
    async assessQuality(params: IntegrityCheckParams): Promise<QualityAssessment> {
        const assessment: QualityAssessment = {
            paper_id: params.doi || params.arxiv_id || params.title || "unknown",
            title: params.title || "Unknown Title",
            assessment_date: new Date().toISOString(),
            metrics: {
                methodology_score: 0,
                data_quality_score: 0,
                reproducibility_score: 0,
                statistical_rigor_score: 0,
                ethical_compliance_score: 0,
                overall_score: 0,
                confidence_level: 0
            },
            flags: [],
            recommendations: [],
            peer_review_indicators: {
                venue_quality: "unknown",
                citation_patterns: "normal",
                author_reputation: "unknown",
                institutional_affiliation: "unknown"
            }
        };

        // Assess methodology if text is provided
        if (params.text && params.check_methodology) {
            const methodologyScore = await this.assessMethodology(params.text);
            assessment.metrics.methodology_score = methodologyScore.score;
            assessment.flags.push(...methodologyScore.flags);
            assessment.recommendations.push(...methodologyScore.recommendations);
        }

        // Assess venue quality
        if (params.venue) {
            const venueAssessment = await this.assessVenue(params.venue);
            assessment.peer_review_indicators.venue_quality = venueAssessment.quality;
            if (venueAssessment.flags.length > 0) {
                assessment.flags.push(...venueAssessment.flags);
            }
        }

        // Assess statistical rigor
        if (params.text && params.check_statistics) {
            const statsScore = await this.assessStatisticalRigor(params.text);
            assessment.metrics.statistical_rigor_score = statsScore.score;
            assessment.flags.push(...statsScore.flags);
        }

        // Assess reproducibility
        if (params.text) {
            const reproducibilityScore = await this.assessReproducibility(params.text);
            assessment.metrics.reproducibility_score = reproducibilityScore.score;
            assessment.flags.push(...reproducibilityScore.flags);
        }

        // Assess ethical compliance
        if (params.text && params.check_ethics) {
            const ethicsScore = await this.assessEthicalCompliance(params.text);
            assessment.metrics.ethical_compliance_score = ethicsScore.score;
            assessment.flags.push(...ethicsScore.flags);
        }

        // Calculate overall score
        assessment.metrics.overall_score = this.calculateOverallScore(assessment.metrics);
        assessment.metrics.confidence_level = this.calculateConfidenceLevel(assessment);

        // Generate recommendations based on flags
        assessment.recommendations.push(...this.generateRecommendations(assessment.flags));

        this.ctx.evidence({
            type: "log",
            ref: "Quality assessment completed"
        });

        return assessment;
    }

    /**
     * Assess research methodology
     */
    private async assessMethodology(text: string): Promise<{ score: number; flags: QualityFlag[]; recommendations: string[] }> {
        const flags: QualityFlag[] = [];
        const recommendations: string[] = [];
        let score = 80; // Start with baseline score

        // Check for methodology section
        if (!/method|approach|procedure|design/i.test(text)) {
            flags.push({
                type: "methodology",
                severity: "high",
                description: "No clear methodology section identified",
                evidence: ["Missing methodology description"],
                recommendation: "Include a detailed methodology section"
            });
            score -= 30;
        }

        // Check for sample size reporting
        if (!/sample.*size|n\s*=|participants.*(\d+)/i.test(text)) {
            flags.push({
                type: "methodology",
                severity: "medium",
                description: "Sample size not clearly reported",
                evidence: ["No sample size information found"],
                recommendation: "Clearly report sample size and justify adequacy"
            });
            score -= 15;
        }

        // Check for control groups in experimental studies
        if (/experiment|trial|intervention/i.test(text) && !/control|placebo|comparison/i.test(text)) {
            flags.push({
                type: "methodology",
                severity: "high",
                description: "Experimental study without clear control group",
                evidence: ["Experimental design without control mentioned"],
                recommendation: "Include appropriate control groups in experimental design"
            });
            score -= 25;
        }

        return { score: Math.max(0, score), flags, recommendations };
    }

    /**
     * Assess venue quality
     */
    private async assessVenue(venueName: string): Promise<{ quality: PeerReviewIndicators["venue_quality"]; flags: QualityFlag[] }> {
        const flags: QualityFlag[] = [];
        let quality: PeerReviewIndicators["venue_quality"] = "medium";

        // Check for predatory publisher patterns
        const isPredatory = this.predatoryPatterns.some(pattern => pattern.test(venueName));

        if (isPredatory) {
            quality = "predatory";
            flags.push({
                type: "citation",
                severity: "critical",
                description: "Potential predatory publication venue",
                evidence: [`Venue name matches predatory patterns: ${venueName}`],
                recommendation: "Verify venue legitimacy through reputable indexing services"
            });
        }

        // Check for quality indicators
        if (/nature|science|cell|lancet|nejm/i.test(venueName)) {
            quality = "top_tier";
        } else if (/ieee|acm|springer|elsevier/i.test(venueName)) {
            quality = "high";
        }

        return { quality, flags };
    }

    /**
     * Assess statistical rigor
     */
    private async assessStatisticalRigor(text: string): Promise<{ score: number; flags: QualityFlag[] }> {
        const flags: QualityFlag[] = [];
        let score = 75;

        // Check for p-hacking indicators
        if (/p\s*[<>=]\s*0\.05|p\s*[<>=]\s*\.05/i.test(text)) {
            const pValues = text.match(/p\s*[<>=]\s*0?\.\d+/gi) || [];
            const suspiciousPValues = pValues.filter(p => /0\.04[5-9]|0\.05/i.test(p));

            if (suspiciousPValues.length > 2) {
                flags.push({
                    type: "statistical",
                    severity: "medium",
                    description: "Multiple p-values close to significance threshold",
                    evidence: suspiciousPValues,
                    recommendation: "Consider multiple comparison corrections and report effect sizes"
                });
                score -= 20;
            }
        }

        // Check for effect size reporting
        if (!/effect.*size|cohen.*d|eta.*squared|r\s*=/i.test(text)) {
            flags.push({
                type: "statistical",
                severity: "medium",
                description: "Effect sizes not reported",
                evidence: ["No effect size measures found"],
                recommendation: "Report effect sizes alongside statistical significance"
            });
            score -= 15;
        }

        // Check for confidence intervals
        if (!/confidence.*interval|ci|95%.*interval/i.test(text)) {
            flags.push({
                type: "statistical",
                severity: "low",
                description: "Confidence intervals not reported",
                evidence: ["No confidence intervals found"],
                recommendation: "Include confidence intervals for key estimates"
            });
            score -= 10;
        }

        return { score: Math.max(0, score), flags };
    }

    /**
     * Assess reproducibility
     */
    private async assessReproducibility(text: string): Promise<{ score: number; flags: QualityFlag[] }> {
        const flags: QualityFlag[] = [];
        let score = 70;

        // Check for data availability
        if (!/data.*available|supplementary.*data|repository|github|zenodo/i.test(text)) {
            flags.push({
                type: "reproducibility",
                severity: "medium",
                description: "Data availability not mentioned",
                evidence: ["No data sharing statement found"],
                recommendation: "Provide data availability statement and share data when possible"
            });
            score -= 20;
        }

        // Check for code availability
        if (!/code.*available|software|github|algorithm.*implementation/i.test(text)) {
            flags.push({
                type: "reproducibility",
                severity: "medium",
                description: "Code/software availability not mentioned",
                evidence: ["No code sharing information found"],
                recommendation: "Share analysis code and software implementations"
            });
            score -= 15;
        }

        // Check for detailed procedures
        if (text.length < 500) {
            flags.push({
                type: "reproducibility",
                severity: "low",
                description: "Limited methodological detail",
                evidence: ["Short methodology description"],
                recommendation: "Provide more detailed procedural information"
            });
            score -= 10;
        }

        return { score: Math.max(0, score), flags };
    }

    /**
     * Assess ethical compliance
     */
    private async assessEthicalCompliance(text: string): Promise<{ score: number; flags: QualityFlag[] }> {
        const flags: QualityFlag[] = [];
        let score = 85;

        // Check for ethics approval in human studies
        if (/participant|subject|human|patient/i.test(text) && !/ethics.*approval|irb|institutional.*review/i.test(text)) {
            flags.push({
                type: "ethical",
                severity: "high",
                description: "Human subjects research without ethics approval mention",
                evidence: ["Human subjects mentioned without ethics approval"],
                recommendation: "Include ethics approval information for human subjects research"
            });
            score -= 30;
        }

        // Check for informed consent
        if (/participant|subject|human/i.test(text) && !/consent|informed/i.test(text)) {
            flags.push({
                type: "ethical",
                severity: "medium",
                description: "No mention of informed consent",
                evidence: ["Human subjects without consent information"],
                recommendation: "Include informed consent procedures"
            });
            score -= 20;
        }

        // Check for conflict of interest
        if (!/conflict.*interest|competing.*interest|disclosure/i.test(text)) {
            flags.push({
                type: "ethical",
                severity: "low",
                description: "No conflict of interest statement",
                evidence: ["No conflict of interest disclosure found"],
                recommendation: "Include conflict of interest disclosure"
            });
            score -= 10;
        }

        return { score: Math.max(0, score), flags };
    }

    /**
     * Calculate overall quality score
     */
    private calculateOverallScore(metrics: ResearchQualityMetrics): number {
        return (
            metrics.methodology_score * this.qualityWeights.methodology +
            metrics.data_quality_score * this.qualityWeights.data_quality +
            metrics.reproducibility_score * this.qualityWeights.reproducibility +
            metrics.statistical_rigor_score * this.qualityWeights.statistical_rigor +
            metrics.ethical_compliance_score * this.qualityWeights.ethical_compliance
        );
    }

    /**
     * Calculate confidence level
     */
    private calculateConfidenceLevel(assessment: QualityAssessment): number {
        const criticalFlags = assessment.flags.filter(f => f.severity === "critical").length;
        const highFlags = assessment.flags.filter(f => f.severity === "high").length;

        let confidence = 90;
        confidence -= criticalFlags * 30;
        confidence -= highFlags * 15;

        return Math.max(10, confidence);
    }

    /**
     * Generate recommendations based on flags
     */
    private generateRecommendations(flags: QualityFlag[]): string[] {
        const recommendations = new Set<string>();

        for (const flag of flags) {
            recommendations.add(flag.recommendation);
        }

        return Array.from(recommendations);
    }

    /**
     * Detect anti-patterns in code
     */
    async detectAntiPatterns(
        code: string,
        language?: string,
        researchSources?: ResearchContent[]
    ): Promise<AntiPattern[]> {
        const antiPatterns: AntiPattern[] = [];

        for (const definition of this.antiPatternDefinitions) {
            const matches = code.match(definition.pattern);
            if (matches) {
                const locations: CodeLocation[] = matches.map(match => ({
                    snippet: match.substring(0, 100)
                }));

                antiPatterns.push({
                    name: definition.name,
                    description: definition.description,
                    severity: definition.severity,
                    locations,
                    refactoringSuggestion: definition.refactoring
                });
            }
        }

        if (researchSources && researchSources.length > 0) {
            for (const source of researchSources) {
                const compliance = await this.licenseValidator.checkCompliance(code, source);
                if (!compliance) {
                    antiPatterns.push({
                        name: "Missing License Attribution",
                        description: `Code uses research from "${source.title}" without proper attribution`,
                        severity: "critical",
                        locations: [],
                        refactoringSuggestion: `Add attribution comment: Based on "${source.title}" by ${source.authors.join(", ")}`
                    });
                }
            }
        }

        this.ctx.evidence({
            type: "log",
            ref: `Detected ${antiPatterns.length} anti-patterns`
        });

        return antiPatterns;
    }

    /**
     * Generate refactoring suggestions
     */
    async generateRefactoringSuggestions(
        code: string,
        focusAreas?: string[]
    ): Promise<RefactoringPlan> {
        const antiPatterns = await this.detectAntiPatterns(code);
        const recommendations: string[] = [];

        const focusSet = new Set(focusAreas || ["maintainability", "readability"]);

        if (focusSet.has("maintainability")) {
            const lines = code.split("\n").length;
            if (lines > 300) {
                recommendations.push("Consider splitting large file into smaller modules");
            }

            const functionCount = (code.match(/function\s+\w+/g) || []).length;
            if (functionCount > 20) {
                recommendations.push("High function count - consider organizing into classes or modules");
            }
        }

        if (focusSet.has("performance")) {
            if (/for\s*\([^)]*\)\s*{[^}]*for\s*\(/g.test(code)) {
                recommendations.push("Nested loops detected - consider optimization or caching");
            }
        }

        if (focusSet.has("security")) {
            if (/eval\s*\(|new\s+Function\s*\(/g.test(code)) {
                recommendations.push("Avoid eval() and Function constructor for security");
            }
        }

        if (focusSet.has("readability")) {
            const avgLineLength = code.split("\n").reduce((sum, line) => sum + line.length, 0) / code.split("\n").length;
            if (avgLineLength > 100) {
                recommendations.push("Long lines detected - consider breaking for readability");
            }
        }

        const overallHealth = Math.max(0, 100 - (antiPatterns.length * 10));

        return {
            antiPatterns,
            overallHealth,
            recommendations,
            estimatedEffort: antiPatterns.length > 10 ? "high" : antiPatterns.length > 5 ? "medium" : "low",
            priority: antiPatterns.some(ap => ap.severity === "critical") ? "high" :
                antiPatterns.some(ap => ap.severity === "high") ? "medium" : "low"
        };
    }

    /**
     * Comprehensive code health analysis
     */
    async analyzeCodeHealth(
        code: string,
        language?: string,
        researchSources?: ResearchContent[]
    ): Promise<CodeHealthAnalysis> {
        const antiPatterns = await this.detectAntiPatterns(code, language, researchSources);
        const findings: Finding[] = [];

        for (const pattern of antiPatterns) {
            findings.push({
                id: `anti-pattern-${pattern.name.toLowerCase().replace(/\s+/g, "-")}`,
                area: "code-quality",
                severity: pattern.severity === "critical" ? "blocker" :
                    pattern.severity === "high" ? "major" : "minor",
                title: `Anti-pattern: ${pattern.name}`,
                description: pattern.description,
                evidence: pattern.locations.map(loc => ({
                    type: "log" as const,
                    ref: loc.snippet
                })),
                tags: ["anti-pattern", "refactoring", "code-quality"],
                confidence: 0.85,
                recommendation: pattern.refactoringSuggestion
            });
        }

        const lines = code.split("\n");
        const commentLines = lines.filter(line => /^\s*(\/\/|\/\*|\*|#)/.test(line)).length;
        const maintainability = Math.min(100, (commentLines / lines.length) * 200 + 50);

        const reliability = Math.max(0, 100 - (antiPatterns.filter(ap =>
            ap.severity === "high" || ap.severity === "critical"
        ).length * 15));

        const security = /eval\(|innerHTML|dangerouslySetInnerHTML/.test(code) ? 50 : 90;

        const performance = /for.*for|while.*while/.test(code) ? 70 : 85;

        const healthScore = (maintainability * 0.3 + reliability * 0.3 + security * 0.2 + performance * 0.2);

        const recommendations: string[] = [];
        if (maintainability < 60) {
            recommendations.push("Improve code documentation and comments");
        }
        if (reliability < 70) {
            recommendations.push("Address critical and high-severity anti-patterns");
        }
        if (security < 70) {
            recommendations.push("Review and fix security vulnerabilities");
        }
        if (performance < 70) {
            recommendations.push("Optimize nested loops and expensive operations");
        }

        this.ctx.evidence({
            type: "log",
            ref: `Code health score: ${healthScore.toFixed(1)}/100`
        });

        return {
            healthScore,
            maintainability,
            reliability,
            security,
            performance,
            issues: findings,
            antiPatterns,
            recommendations
        };
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
            case "vibe_check_assess_quality":
                return await this.assessQuality(params);

            case "vibe_check_venue_assessment":
                return await this.assessVenue(params.venue_name);

            case "vibe_check_citation_analysis":
                // Placeholder for citation analysis
                return { message: "Citation analysis not yet implemented" };

            case "vibe_check_methodology_review":
                return await this.assessMethodology(params.methodology_text);

            case "vibe_check_detect_anti_patterns":
                return await this.detectAntiPatterns(
                    params.code,
                    params.language,
                    params.research_sources
                );

            case "vibe_check_refactoring_suggestions":
                return await this.generateRefactoringSuggestions(
                    params.code,
                    params.focus_areas
                );

            case "vibe_check_code_health":
                return await this.analyzeCodeHealth(
                    params.code,
                    params.language,
                    params.research_sources
                );

            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
}

/**
 * FASTMCP v3.22 capability registration
 */
export const vibeCheckCapabilities = {
    id: "vibe-check",
    name: "Vibe Check Research Quality Provider",
    version: "1.0.0",
    description: "Research quality assessment and academic integrity validation",
    tools: VibeCheckProvider.getToolDefinitions(),
    resources: [],
    prompts: [
        {
            name: "comprehensive_quality_check",
            description: "Perform comprehensive quality assessment of research paper",
            arguments: [
                {
                    name: "paper_text",
                    description: "Full text or abstract of the research paper",
                    required: true
                },
                {
                    name: "venue",
                    description: "Publication venue",
                    required: false
                }
            ]
        },
        {
            name: "predatory_publisher_check",
            description: "Check if a venue might be predatory",
            arguments: [
                {
                    name: "venue_name",
                    description: "Name of the publication venue",
                    required: true
                }
            ]
        }
    ]
};