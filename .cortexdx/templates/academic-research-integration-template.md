# Academic Research Integration Template

**Purpose**: Standard workflow for integrating academic research into Cortex-OS planning and implementation cycles.

**Status**: Mandatory for all implementation tasks (per `.cortexdx/rules/vibe-check.md` §2.1)

---

## Required Workflow Steps

### Step 1: Pre-Research Setup

```bash
# Create task directory with academic research structure
mkdir -p ~/.Cortex-OS/tasks/<slug>/logs/academic-research
mkdir -p ~/.Cortex-OS/tasks/<slug>/research/evidence

# Verify all academic connectors are healthy
curl -s ${WIKIDATA_MCP_URL:-http://127.0.0.1:3029}/health
curl -s ${ARXIV_MCP_URL:-http://127.0.0.1:3041}/health
curl -s ${SEMANTIC_SCHOLAR_API_URL:-https://api.semanticscholar.org/graph/v1}/paper/search?query=test
curl -s ${OPENALEX_API_URL:-https://api.openalex.org/works}?search=test

# Store health check results
echo "$(date): Academic connectors health check completed" >> ~/.Cortex-OS/tasks/<slug>/research/connectors-health.log
```

### Step 2: Research Query Generation

Generate academic search queries based on the implementation goal:

```typescript
// Extract key concepts from implementation plan
const concepts = extractTechnicalConcepts(goal, plan);
const academicQueries = [
  `${concepts.primary} best practices 2024 2025`,
  `${concepts.domain} optimization patterns techniques`,
  `${concepts.technology} implementation research`,
  `${concepts.useCase} state-of-the-art approaches`,
  `${concepts.problem} solutions academic research`
];
```

### Step 3: Multi-Source Academic Research with License Validation

Execute parallel searches across all academic databases using MCP tools:

```typescript
// Execute research using MCP tools
const wikidataResults = await mcpClient.callTool('mcp_wikidata_vector_search', {
  query: `${concepts.primary} patterns techniques`,
  limit: 20
});

const arxivResults = await mcpClient.callTool('mcp_arxiv_search', {
  query: `${concepts.technology} optimization`,
  maxResults: 15
});

// For non-MCP sources, use direct HTTP API calls
const semanticScholarResponse = await fetch(
  `${SEMANTIC_SCHOLAR_API_URL:-https://api.semanticscholar.org/graph/v1}/paper/search?query=${concepts.domain}%20best%20practices&limit=20&fields=title,abstract,authors,citationCount,url`
);

const openAlexResponse = await fetch(
  `${OPENALEX_API_URL:-https://api.openalex.org/works}?search=${concepts.primary}&filter=publication_year:>2020&per-page=25`
);

// Store findings
fs.writeFileSync(
  '~/.Cortex-OS/tasks/<slug>/logs/academic-research/findings.json',
  JSON.stringify({
    wikidata: wikidataResults,
    arxiv: arxivResults,
    semanticScholar: await semanticScholarResponse.json(),
    openAlex: await openAlexResponse.json()
  }, null, 2)
);
```

### Step 4: License Validation and Content Filtering

Validate academic content licenses and filter for compliance:

```bash
# Validate licenses for all research findings
pnpm academic:validate-licenses \
  --input ~/.Cortex-OS/tasks/<slug>/logs/academic-research/findings.json \
  --output ~/.Cortex-OS/tasks/<slug>/logs/academic-research/license-validation.json \
  --risk-threshold review

# Filter findings to only include license-compliant content
pnpm academic:filter-by-license \
  --input ~/.Cortex-OS/tasks/<slug>/logs/academic-research/findings.json \
  --license-validation ~/.Cortex-OS/tasks/<slug>/logs/academic-research/license-validation.json \
  --output ~/.Cortex-OS/tasks/<slug>/logs/academic-research/compliant-findings.json
```

### Step 5: License-Compliant Research Synthesis and Plan Enhancement

Analyze validated research findings and enhance the implementation plan:

```typescript
// License-compliant research integration framework
const enhancedPlan = {
  originalSteps: plan,
  licenseValidation: licenseValidationResults,
  researchFindings: {
    provenApproaches: extractHighlyCitedPapers(semanticScholarResults, 'SAFE'),
    recentInnovations: extractRecentPapers(arxivResults, 'SAFE', 'REVIEW'),
    knowledgeRelationships: extractWikidataRelationships(wikidataResults, 'SAFE'),
    domainPatterns: extractResearchPatterns(openalexResults, 'SAFE', 'REVIEW')
  },
  enhancedSteps: plan.map((step, index) => ({
    ...step,
    researchBacking: findLicenseCompliantEvidence(step, researchFindings),
    confidenceLevel: calculateEvidenceConfidence(step, researchFindings),
    alternativeApproaches: identifyAlternativeApproaches(step, researchFindings),
    licenseCompliance: verifyLicenseCompliance(step, licenseValidationResults)
  }))
};
```

### Step 6: License-Compliant, Research-Backed Plan Format

Format the plan with academic citations, evidence, and license compliance:

```
Plan for: "<implementation goal>"
1. Research and analyze <domain> patterns (License: CC BY, Research-backed: Semantic Scholar citations: 45, arXiv:2304.12345)
2. Design solution using proven <technology> approaches (License: Open Access, Research-backed: Context7 domain knowledge via HTTP API, OpenAlex research consensus)
3. Implement core functionality with wikidata-validated <concept> properties (License: CC0, Research-backed: Wikidata Q1860, vector similarity: 0.92)
4. Add testing strategy based on peer-reviewed validation methods (License: CC BY-SA, Research-backed: Semantic Scholar highly-cited testing patterns)
5. Create monitoring using academically-proven metrics collection (License: CC BY, Research-backed: arXiv:2305.67890, citation count: 89)
6. Document implementation with academic references and proven methodologies (All sources license-compliant)
7. Deploy with research-backed gradual rollout strategy (License: Open Access, Research-backed: OpenAlex deployment patterns, 2023-2024 consensus)
```

### Step 7: Vibe Check with Research and License Integration

Execute enhanced vibe check with academic research and license validation:

```typescript
// Call vibe_check MCP tool with research-enhanced plan
const response = await mcpClient.callTool('vibe_check', {
  goal: '<task summary>',
  plan: '<license-compliant-research-enhanced-steps>',
  sessionId: '<session-id>'
});

// Save response with research and license evidence
fs.writeFileSync(
  '~/.Cortex-OS/tasks/<slug>/logs/vibe-check/initial.json',
  JSON.stringify({
    ...response,
    research: {
      findings: require('../academic-research/findings.json'),
      licenseValidation: require('../academic-research/license-validation.json')
    }
  }, null, 2)
);
```

### Step 8: Evidence Storage and License Compliance

Store all research evidence for governance compliance:

```bash
# Store license-compliant academic research evidence
cat ~/.Cortex-OS/tasks/<slug>/logs/academic-research/compliant-findings.json \
  > ~/.Cortex-OS/tasks/<slug>/logs/academic-research/final-findings.json

# Local memory parity with license compliance
echo "## License-Compliant Academic Research Findings for <task>" >> ~/.github/instructions/memories.instructions.md
echo "- Date: $(date)" >> ~/.github/instructions/memories.instructions.md
echo "- Research sources: Wikidata, arXiv, Semantic Scholar, OpenAlex, Context7" >> ~/.github/instructions/memories.instructions.md
echo "- License validation: $(jq -r '.compliance_score' ~/.Cortex-OS/tasks/<slug>/logs/academic-research/license-validation.json)% compliant" >> ~/.github/instructions/memories.instructions.md
echo "- Key findings: $(jq -r '.summary' ~/.Cortex-OS/tasks/<slug>/logs/academic-research/final-findings.json)" >> ~/.github/instructions/memories.instructions.md

# Store memory IDs for reference including license validation
echo '{"academicResearchMemoryId": "'$(memory-store --type academic-research --path ~/.Cortex-OS/tasks/<slug>/logs/academic-research/final-findings.json)'", "licenseValidationMemoryId": "'$(memory-store --type license-validation --path ~/.Cortex-OS/tasks/<slug>/logs/academic-research/license-validation.json)'"}' \
  > ~/.Cortex-OS/tasks/<slug>/json/memory-ids.json
```

---

## Required Evidence Package

### Files Required for CI Compliance:

```
~/.Cortex-OS/tasks/<slug>/
├── logs/
│   ├── academic-research/
│   │   ├── findings.json                    # Complete research synthesis
│   │   ├── license-validation.json          # License compliance results
│   │   ├── compliant-findings.json          # Filtered license-compliant research
│   │   └── final-findings.json              # Final research evidence for implementation
│   └── vibe-check/
│       └── initial.json                     # Enhanced vibe check with research & license evidence
├── research/
│   ├── connectors-health.log                # Academic connector health status
│   └── evidence/
│       ├── wikidata-items.json              # Wikidata vector search results
│       ├── arxiv-search.json                # arXiv semantic search results
│       ├── semantic-scholar.json            # Semantic Scholar proven approaches
│       └── openalex.json                    # OpenAlex research patterns
└── json/
    └── memory-ids.json                      # Local memory parity IDs
```

### Evidence Validation Criteria:

1. **Research Completeness**: All academic databases queried with relevant results
2. **Evidence Integration**: Plan steps include research citations and confidence levels
3. **Governance Compliance**: All evidence stored in correct locations with proper formatting
4. **Brand Compliance**: All logs include `[brAInwav]` and `brand:"brAInwav"`
5. **Trace Context**: All research queries include W3C trace IDs for correlation

---

## Quality Standards

### Research Quality Metrics:

- **Source Diversity**: Minimum 3 different academic databases
- **Recency**: At least 50% of sources from 2023-2025
- **Citation Quality**: Preference for highly-cited papers (citation count > 10)
- **Evidence Strength**: Each plan step must have supporting academic evidence
- **Confidence Scoring**: Document evidence confidence levels (High/Medium/Low)

### Plan Enhancement Standards:

- **Research Integration**: Every step enhanced with academic findings
- **Citation Format**: Consistent citation format with database references
- **Alternative Approaches**: Include academically-supported alternatives
- **Risk Mitigation**: Address potential issues identified in research
- **Innovation Integration**: Include recent advances from pre-prints and new research

---

## Integration Scripts

### Automated Research Integration:

```bash
#!/bin/bash
# academic-research-integration.sh
# Usage: ./academic-research-integration.sh <task-slug> <goal> <plan>

SLUG=$1
GOAL=$2
PLAN=$3

# Create research structure
mkdir -p ~/.Cortex-OS/tasks/$SLUG/logs/academic-research
mkdir -p ~/.Cortex-OS/tasks/$SLUG/research/evidence

# Execute research workflow
pnpm oversight:academic-research \
  --goal "$GOAL" \
  --plan "$PLAN" \
  --session "$(date +%Y%m%d-%H%M%S)-$SLUG" \
  --save ~/.Cortex-OS/tasks/$SLUG/logs/academic-research/findings.json

# Run enhanced vibe check
pnpm oversight:vibe-check \
  --goal "$GOAL" \
  --plan "$(cat ~/.Cortex-OS/tasks/$SLUG/logs/academic-research/enhanced-plan.txt)" \
  --session "$(date +%Y%m%d-%H%M%S)-$SLUG" \
  --save ~/.Cortex-OS/tasks/$SLUG/logs/vibe-check/initial.json \
  --with-academic-research

echo "Academic research integration complete for task: $SLUG"
echo "Evidence stored in: ~/.Cortex-OS/tasks/$SLUG/logs/"
```

This template ensures every implementation plan is enhanced with current academic research while maintaining full governance compliance!
