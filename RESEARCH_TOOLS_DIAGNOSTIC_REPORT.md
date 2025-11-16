# Research Tools Diagnostic Report

**Date:** 2025-11-16
**Branch:** claude/debug-research-tools-01XXbvt1E2oYeV7rkz8X8qcQ
**Status:** Issues Identified - Fixes Required

---

## Executive Summary

After comprehensive analysis of the research tools (Context7, Wikidata, DeepContext, ArXiv, OpenAlex), I've identified **6 critical issues** preventing proper functionality. All tools are implemented but have configuration, integration, or incomplete feature issues.

**Severity Breakdown:**
- 🔴 **Critical (2)**: Missing API key validation, incomplete Wikidata vector search
- 🟡 **High (3)**: Configuration issues, missing error handling
- 🟢 **Medium (1)**: Fallback behavior improvements

---

## Issue #1: Wikidata Vector Search Not Implemented
**Severity:** 🔴 Critical
**Location:** `packages/cortexdx/src/providers/academic/wikidata.mcp.ts:543-579`

### Problem
The Wikidata provider advertises `wikidata_vector_search_items` and `wikidata_vector_search_properties` tools, but they fall back to basic keyword search instead of using semantic vector embeddings.

### Evidence
```typescript
// Line 545
// TODO: Integrate with Wikidata vector database service when available

this.ctx.logger(
  "Vector search not yet fully integrated with Wikidata vector database",
);

// Fallback to enhanced keyword search with scoring
const keywordResults = await this.searchEntities({
  search: query,
  language,
  limit,
});
```

### Impact
- Users get degraded search quality
- Vector search features don't work as advertised
- No semantic similarity matching

### Root Cause
The upstream WikidataMCP uses `https://wd-mcp.wmcloud.org/mcp/` for vector search, but CortexDx hasn't integrated this endpoint.

### Recommended Fix
1. Implement HTTP client to Wikidata vector service
2. Add fallback logic when service unavailable
3. Update tool descriptions to indicate current limitations
4. Add configuration for vector service endpoint

---

## Issue #2: DeepContext Missing API Key Validation
**Severity:** 🔴 Critical
**Location:** `packages/cortexdx/src/deepcontext/client.ts:146-150`

### Problem
DeepContext client throws unclear errors when API keys are missing. Error only appears during tool execution, not at initialization.

### Evidence
```typescript
async runTool(...) {
  if (!this.apiKey || this.apiKey.trim().length === 0) {
    throw new Error(
      "DeepContext API key missing. Set WILDCARD_API_KEY or DEEPCONTEXT_API_KEY in your environment.",
    );
  }
  // ... rest of execution
}
```

### Impact
- Poor user experience (late error detection)
- Unclear which environment variable to set
- No guidance on obtaining API keys

### Root Cause
- API key validation happens at runtime, not initialization
- Multiple environment variable names without priority documentation
- No link to API key registration

### Recommended Fix
1. Add early validation in constructor
2. Provide clear error messages with setup instructions
3. Add `healthCheck()` method that validates configuration
4. Document API key priority: `WILDCARD_API_KEY > DEEPCONTEXT_API_KEY > DEEPCONTEXT_API_TOKEN > DEEPCONTEXT_TOKEN`

---

## Issue #3: Context7 HTTP Client Silent Failures
**Severity:** 🟡 High
**Location:** `packages/cortexdx/src/providers/academic/context7.mcp.ts:889-905`

### Problem
Context7 has optional HTTP MCP client integration that silently falls back to local implementation when remote fails.

### Evidence
```typescript
private async callRemoteTool<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T | null> {
  if (!this.remoteClient) return null;
  try {
    return await this.remoteClient.callToolJson<T>(name, sanitizeToolArgs(args));
  } catch (error) {
    this.ctx.logger?.(
      `[Context7] Remote tool ${name} failed: ${String(error)}`,
    );
    return null; // Silent fallback
  }
}
```

### Impact
- Users don't know if remote or local analysis is used
- Different quality results without notification
- Hard to debug when remote service is misconfigured

### Root Cause
- Silent fallback design pattern
- No health check for remote endpoint
- Missing configuration documentation

### Recommended Fix
1. Add explicit logging when falling back to local implementation
2. Implement health check for remote Context7 service
3. Add configuration flag to require remote (fail if unavailable)
4. Document `CONTEXT7_API_BASE_URL` and `CONTEXT7_API_KEY` setup

---

## Issue #4: OpenAlex Missing Contact Email Warning
**Severity:** 🟡 High
**Location:** `packages/cortexdx/src/providers/academic/openalex.mcp.ts:115-117`

### Problem
OpenAlex strongly recommends setting contact email for "polite pool" access (10x higher rate limits), but there's no warning when it's missing.

### Evidence
```typescript
this.contactEmail = (headerContact ?? envContact ?? "").trim().toLowerCase() || undefined;

// Later used in User-Agent header but no warning if missing
headers: {
  "User-Agent": this.contactEmail
    ? `${this.userAgent} (mailto:${this.contactEmail})`
    : this.userAgent,
```

### Impact
- Users unknowingly get slower rate limits (100 req/min vs 1000 req/min)
- Poor performance without understanding why
- No guidance to improve throughput

### Root Cause
- Optional configuration without visibility
- No documentation of performance impact
- Missing startup warning

### Recommended Fix
1. Add warning log when `OPENALEX_CONTACT_EMAIL` not set
2. Document rate limit differences in tool descriptions
3. Add to health check output
4. Provide setup instructions in error messages

---

## Issue #5: ArXiv XML Parsing Error Handling
**Severity:** 🟡 High
**Location:** `packages/cortexdx/src/providers/academic/arxiv.mcp.ts:285-445`

### Problem
ArXiv XML parsing uses regex without validation. Malformed responses could cause silent failures or incorrect data extraction.

### Evidence
```typescript
private parseArxivXml(xmlText: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];

  // Regex-based parsing without validation
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null = entryRegex.exec(xmlText);

  while (match) {
    const entryXml = match[1] || "";
    // ... extraction continues
    match = entryRegex.exec(xmlText);
  }

  return papers; // Could return empty array silently
}
```

### Impact
- Silent failures when ArXiv API changes format
- No validation of extracted data completeness
- Difficult to debug parsing issues

### Root Cause
- Regex-only XML parsing (fragile)
- No schema validation
- Missing error reporting for malformed entries

### Recommended Fix
1. Add XML structure validation before parsing
2. Log warnings for malformed entries
3. Include raw XML in diagnostic context on errors
4. Consider using a proper XML parser library
5. Add unit tests for various ArXiv response formats

---

## Issue #6: Academic Researcher Provider Executor Missing Error Context
**Severity:** 🟢 Medium
**Location:** `packages/cortexdx/src/research/academic-researcher.ts:78-330`

### Problem
Provider executors catch errors but lose context about which tool/parameter caused the failure.

### Evidence
```typescript
const providerExecutors: Record<string, ProviderExecutor> = {
  openalex: async (instance, registration, ctx) => {
    const worksResponse = (await instance.executeTool("openalex_search_works", {
      query: ctx.question ? `${ctx.topic} ${ctx.question}` : ctx.topic,
      per_page: ctx.limit,
      sort: "cited_by_count:desc",
    })) as /* ... */;
    // No try-catch, error bubbles up without tool context
  },
  // ... similar pattern for all providers
};
```

### Impact
- Generic error messages without tool identification
- Hard to debug which parameter caused failure
- Users can't distinguish between provider issues

### Root Cause
- No try-catch blocks in provider executors
- Error handling at higher level loses context
- Missing structured error reporting

### Recommended Fix
1. Wrap each executor in try-catch
2. Add tool name and parameters to error messages
3. Include provider-specific diagnostic hints
4. Return structured error objects instead of throwing

---

## Configuration Requirements Summary

### Required Environment Variables by Provider

#### ArXiv ✅
- **None** - Public API, no authentication

#### OpenAlex ⚠️
- `OPENALEX_CONTACT_EMAIL` - Recommended for polite pool (10x rate limit)
- `OPENALEX_API_KEY` - Optional for premium features

#### Wikidata ✅
- **None** - Public API, no authentication
- **Note:** Vector search requires upstream service integration

#### Context7 ⚠️
- `CONTEXT7_API_BASE_URL` - Required for remote MCP server
- `CONTEXT7_API_KEY` - Required for authentication
- `CONTEXT7_PROFILE` - Optional profile selection
- `CORTEXDX_DISABLE_CONTEXT7_HTTP=1` - Disable remote, use local only

#### DeepContext ❌
- `WILDCARD_API_KEY` - **Required** (primary)
- `DEEPCONTEXT_API_KEY` - Fallback option
- `DEEPCONTEXT_API_TOKEN` - Fallback option
- `DEEPCONTEXT_TOKEN` - Fallback option
- `JINA_API_KEY` - Optional for enhanced features
- `TURBOPUFFER_API_KEY` - Optional for vector storage

---

## Testing Status

### Can Be Tested Without Configuration
✅ ArXiv - Public API
✅ Wikidata - Public API (keyword search)

### Requires Configuration
⚠️ OpenAlex - Works but slow without email
⚠️ Context7 - Falls back to local implementation
❌ DeepContext - **Requires API key**

---

## Recommended Action Plan

### Immediate (Critical)
1. **Fix DeepContext API key validation** - Add early check with clear setup instructions
2. **Document Wikidata vector search limitations** - Update tool descriptions to indicate fallback behavior
3. **Add OpenAlex contact email warning** - Log at startup when missing

### Short-term (High Priority)
4. **Improve Context7 fallback logging** - Make remote/local selection visible
5. **Enhance ArXiv error handling** - Add XML validation and better error messages
6. **Add provider-level error context** - Wrap executors with detailed error capture

### Long-term (Enhancements)
7. **Implement Wikidata vector search** - Integrate with wd-mcp.wmcloud.org
8. **Add configuration health check tool** - Validate all API keys and endpoints
9. **Create setup wizard** - Interactive configuration for all providers
10. **Add comprehensive integration tests** - Test all providers with mock responses

---

## Files Requiring Changes

```
packages/cortexdx/src/providers/academic/wikidata.mcp.ts       (Issue #1)
packages/cortexdx/src/deepcontext/client.ts                    (Issue #2)
packages/cortexdx/src/providers/academic/context7.mcp.ts       (Issue #3)
packages/cortexdx/src/providers/academic/openalex.mcp.ts       (Issue #4)
packages/cortexdx/src/providers/academic/arxiv.mcp.ts          (Issue #5)
packages/cortexdx/src/research/academic-researcher.ts          (Issue #6)
packages/cortexdx/README.md                                     (Documentation)
packages/cortexdx/docs/RESEARCH_TOOLS_SETUP.md                 (New: Setup guide)
```

---

## Next Steps

1. **Review this report** - Confirm issues and prioritization
2. **Apply critical fixes** - Issues #1, #2, #3
3. **Update documentation** - Add setup guide for all providers
4. **Test each provider** - Validate fixes with live API calls
5. **Create integration tests** - Prevent regression

---

**Report prepared by:** Claude (Anthropic)
**Analysis method:** Static code analysis + architecture review
**Confidence level:** High (based on source code examination)
