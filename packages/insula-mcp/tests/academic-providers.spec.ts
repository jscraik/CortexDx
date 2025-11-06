/**
 * Academic Providers Test Suite
 * Tests for the academic research MCP providers
 */

import { describe, expect, it } from "vitest";
import { getAcademicRegistry } from "../src/registry/index.js";
import type { DiagnosticContext } from "../src/types.js";

// Mock diagnostic context for testing
const mockContext: DiagnosticContext = {
    endpoint: "test://localhost",
    logger: () => { },
    request: async () => ({ data: [], total: 0 }),
    jsonrpc: async () => ({}),
    sseProbe: async () => ({ ok: true }),
    evidence: () => { },
    deterministic: true
};

describe("Academic Providers Registry", () => {
    it("should register all academic providers", () => {
        const registry = getAcademicRegistry();
        const providers = registry.getAllProviders();

        expect(Object.keys(providers)).toHaveLength(6);
        expect(providers).toHaveProperty("semantic-scholar");
        expect(providers).toHaveProperty("openalex");
        expect(providers).toHaveProperty("wikidata");
        expect(providers).toHaveProperty("arxiv");
        expect(providers).toHaveProperty("vibe-check");
        expect(providers).toHaveProperty("context7");
    });

    it("should provide correct capabilities for each provider", () => {
        const registry = getAcademicRegistry();
        const capabilities = registry.getAllCapabilities();

        expect(capabilities["semantic-scholar"]).toBeDefined();
        expect(capabilities["semantic-scholar"].tools).toBeInstanceOf(Array);
        expect(capabilities["semantic-scholar"].tools.length).toBeGreaterThan(0);
    });

    it("should categorize providers correctly", () => {
        const registry = getAcademicRegistry();
        const categories = registry.getCategories();

        expect(categories["paper_search"]).toContain("semantic-scholar");
        expect(categories["paper_search"]).toContain("arxiv");
        expect(categories["quality_assessment"]).toContain("vibe-check");
        expect(categories["knowledge_graph"]).toContain("wikidata");
    });

    it("should create provider instances", () => {
        const registry = getAcademicRegistry();

        const semanticScholar = registry.createProviderInstance("semantic-scholar", mockContext);
        expect(semanticScholar).toBeDefined();
        expect(typeof semanticScholar.healthCheck).toBe("function");
        expect(typeof semanticScholar.executeTool).toBe("function");
    });

    it("should handle tool execution", async () => {
        const registry = getAcademicRegistry();
        const vibeCheck = registry.createProviderInstance("vibe-check", mockContext);

        // Test a simple quality assessment
        const result = await vibeCheck.executeTool("vibe_check_assess_quality", {
            text: "This is a test research paper about machine learning.",
            title: "Test Paper"
        });

        expect(result).toBeDefined();
        expect(result.paper_id).toBeDefined();
        expect(result.metrics).toBeDefined();
        expect(typeof result.metrics.overall_score).toBe("number");
    });

    it("should search providers by tags", () => {
        const registry = getAcademicRegistry();
        const academicProviders = registry.searchProvidersByTags(["academic"]);

        expect(academicProviders.length).toBeGreaterThan(0);
        academicProviders.forEach(provider => {
            expect(provider.tags).toContain("academic");
        });
    });
});

describe("Semantic Scholar Provider", () => {
    it("should have correct tool definitions", () => {
        const registry = getAcademicRegistry();
        const provider = registry.getProvider("semantic-scholar");

        expect(provider?.capabilities.tools).toBeDefined();
        const toolNames = provider?.capabilities.tools.map(tool => tool.name);

        expect(toolNames).toContain("semantic_scholar_search_papers");
        expect(toolNames).toContain("semantic_scholar_get_paper");
        expect(toolNames).toContain("semantic_scholar_get_paper_citations");
        expect(toolNames).toContain("semantic_scholar_search_authors");
    });
});

describe("Provider Health Checks", () => {
    it("should perform health checks for local providers", async () => {
        const registry = getAcademicRegistry();

        // Test local providers (vibe-check, context7) which should always be healthy
        const vibeCheck = registry.createProviderInstance("vibe-check", mockContext);
        const context7 = registry.createProviderInstance("context7", mockContext);

        expect(await vibeCheck.healthCheck()).toBe(true);
        expect(await context7.healthCheck()).toBe(true);
    });
});