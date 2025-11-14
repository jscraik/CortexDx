# Vibe Check Oversight Gate — Cortex-OS Governance

**Status:** Authoritative  
**Scope:** All human and AI agent executions (planning → action)  
**Inheritance:** Governance Pack (`/.cortexdx/rules/*`), `/.cortexdx/rules/agentic-coding-workflow.md`, `CODESTYLE.md`

---

## 1. Purpose

The Vibe Check MCP gate provides mandatory human-in-the-loop oversight before any agent runs side-effecting actions. Every task **must** capture a successful oversight exchange after planning and **before** file writes, network calls, or long-running executions. Missing or stale evidence blocks review and CI merge.

---

## 2. When to Run

- Trigger immediately after the plan (`implementation-plan.md`) is drafted and before touching the working tree, calling external services, or launching long jobs.
- **Mandatory Academic Research Integration**: For all implementation tasks, run academic research queries to validate and enhance the plan before vibe check submission.
- Re-run if the plan changes materially, a new session starts, or more than one build/reset cadence passes without execution.
- Tier escalation: Tier 2 (feature) tasks require a new vibe check per arc; Tier 1 and Tier 3 may reuse the most recent response if still within the active session window (≤ 50 minutes) and no plan deltas exist.
- All submitted plans MUST contain ≤ 7 discrete steps; split larger efforts into multiple arcs and re-run oversight per arc.

### 2.1 Academic Research Integration (Mandatory)

Before running vibe check, all implementation plans MUST be enhanced with academic research and validated for license compliance using the built-in MCP providers.

**Available Academic MCP Providers:**

- **Wikidata MCP** (Port 3029): Vector search for entities, properties, and relationships via `mcp_wikidata_*` tools
- **arXiv MCP** (Port 3041): Semantic search for recent papers and technical approaches via `mcp_arxiv_*` tools
- **Semantic Scholar API**: Identify proven solutions and highly-cited approaches via HTTP client
- **OpenAlex API**: Discover broad research patterns and collaborations via HTTP client
- **Context7 MCP**: Access domain-specific knowledge and best practices via `mcp_context7_*` tools

**Research Workflow:**
Use MCP tools directly in your AI agent workflow:

```typescript
// Example: Query academic sources via MCP
await mcpClient.callTool('mcp_wikidata_vector_search', { query: '<concept>' });
await mcpClient.callTool('mcp_arxiv_search', { query: '<research topic>' });
await mcpClient.callTool('mcp_context7_get-library-docs', { context7CompatibleLibraryID: '<lib>' });
```

Store findings in `~/.Cortex-OS/tasks/<slug>/logs/academic-research/findings.json`

**License Validation Requirements:**

- **License Risk Assessment**: Classify all academic sources by risk level (SAFE/REVIEW/RESTRICTED/PROHIBITED)
- **Content Filtering**: Only include SAFE and REVIEW content in implementation plans
- **Attribution Compliance**: Ensure proper citation and attribution for all used content
- **Documentation**: Store license validation results alongside research findings

**Integration Points:**

- Research findings MUST be incorporated into the plan steps
- Each step should reference academic backing with proper citations
- Include "Research-backed" indicators for evidence-based approaches
- Document alternative approaches discovered through research
- Filter out PROHIBITED and RESTRICTED content before plan generation
- Include license compliance evidence in research documentation

---

## 3. Invocation Requirements

### 3.1 MCP Tool Invocation

Invoke the `vibe_check` MCP tool directly from your AI agent:

```typescript
// Call vibe_check MCP tool
const response = await mcpClient.callTool('vibe_check', {
  goal: '<task summary>',
  plan: '1. Step one. 2. Step two. ... (max 7 steps)',
  sessionId: '<task-slug>-<timestamp>'
});

// Save response to evidence
fs.writeFileSync(
  '~/.Cortex-OS/tasks/<slug>/logs/vibe-check/initial.json',
  JSON.stringify(response, null, 2)
);
```

**Parameters:**

- `goal` — concise task objective (≤ 140 chars)
- `plan` — ordered steps (≤ 7, numbered). Link each step to the relevant control ID(s) from `/.cortexdx/rules/llm-threat-controls.md` when elevated risk is identified
- `sessionId` — stable identifier (task slug + timestamp is recommended)

**Important Notes:**

- The Vibe Check MCP server must be running on `${VIBE_CHECK_HTTP_URL:-http://127.0.0.1:2091}`
- Academic research should be performed BEFORE calling `vibe_check` using the available MCP tools
- Store the raw response in `logs/vibe-check/` in the task directory
- The response automatically includes the `brAInwav-vibe-check` log marker

**Connector Outage Protocol**

- When any academic MCP connector is unavailable, check connector health via `/health` endpoints:
  - Wikidata MCP: `curl ${WIKIDATA_MCP_URL:-http://127.0.0.1:3029}/health`
  - arXiv MCP: `curl ${ARXIV_MCP_URL:-http://127.0.0.1:3041}/health`
  - Vibe Check MCP: `curl ${VIBE_CHECK_HTTP_URL:-http://127.0.0.1:2091}/health`
- Document the outage in a waiver JSON at `logs/academic-research/<slug>-<timestamp>-waiver.json` with `[brAInwav]` branding
- Record the waiver pointer in `run-manifest.json` and schedule a follow-up check within 72 hours
- Plans submitted to Oversight must surface outstanding uncertainties (e.g., connector uptime, attestation tooling) so reviewers can challenge mitigations early

**Enhanced Plan Format with Research Integration:**

```
Plan for: "Implement API rate limiting"
1. Research rate limiting patterns and best practices (Research-backed: arXiv:2301.12345, Semantic Scholar citations: 156)
2. Design token bucket algorithm based on academic standards (Research-backed: Context7 patterns)
3. Implement Redis-based rate limiter with wikidata-validated algorithm properties (Research-backed: Wikidata Q1860)
4. Add comprehensive testing based on peer-reviewed validation methods (Research-backed: OpenAlex research patterns)
5. Create monitoring dashboards using academically-proven metrics (Research-backed: Semantic Scholar highly-cited approaches)
6. Document with academic references and proven methodologies
7. Deploy with gradual rollout based on research-backed deployment strategies
```

**Academic Research Enhancement Process:**

1. **Automatic Query Generation**: Extract key concepts from the plan and generate academic search queries
2. **Multi-Source Research**: Execute searches across all academic databases simultaneously
3. **License Validation**: Assess risk levels and filter content by usage rights
4. **Evidence Integration**: Incorporate license-compliant findings into plan steps with proper citations
5. **Validation**: Cross-reference approaches across multiple academic sources
6. **Documentation**: Store research evidence and license validation alongside vibe-check responses

### 3.2 Server Setup

The Vibe Check MCP server is now included in the Cortex-OS monorepo:

```bash
# Local development setup
cd packages/vibe-check-mcp-server
pnpm install
pnpm build

# Start the server
pnpm start --port 2091

# Or use launchd service
launchctl load ~/Library/LaunchAgents/com.brainwav.vibe-check.plist
```

**Server Configuration:**

- **Default URL**: `http://127.0.0.1:2091` (configurable via `VIBE_CHECK_HTTP_URL`)
- **Health Check**: `GET /health`
- **MCP Endpoint**: `POST /mcp` (JSON-RPC 2.0)
- **Tools Available**:
  - `vibe_check` - Oversight with clarifying questions and alignment validation
  - `vibe_learn` - Optional logging of mistakes and successes for review

**Supported LLM Providers**:

- OpenAI (GPT models)
- Anthropic (Claude models)
- Google (Gemini models)
- OpenRouter (various models)

### 3.3 JSON-RPC Fallback

POST to `${VIBE_CHECK_HTTP_URL:-http://127.0.0.1:2091}/mcp` with:

```json
{
  "jsonrpc": "2.0",
  "id": "<uuid>",
  "method": "tools/call",
  "params": {
    "name": "vibe_check",
    "arguments": {
      "goal": "<task summary>",
      "plan": "1. Step one. 2. Step two.",
      "sessionId": "<session-id>"
    }
  }
}
```

- Include headers: `Content-Type: application/json` and `Accept: application/json, text/event-stream`.
- Save the raw response to `logs/vibe-check/<slug>.json` (pretty or compact JSON allowed).

---

## 4. Evidence Package (merge gate)

To satisfy CI and review:

1. Commit the JSON response at `logs/vibe-check/<slug>.json` inside the task folder.
2. Record the command (or HTTP POST) with timestamp and session ID in `~/tasks/<slug>/notes.md` or `decisions.md`.
3. Reference the artifact in the PR description and attach the same path in review evidence (Code Review Checklist).
4. Map each finding or mitigation to the applicable OWASP LLM Top 10 control ID(s) listed in `/.cortexdx/rules/llm-threat-controls.md`; include the mapping in the PR evidence comment.
5. Capture the proposed edit envelope: directories, allowed file globs, max files, and max total LOC. Store alongside the JSON response (e.g., `edit-envelope.json`) so CI can enforce the declared patch budget.
6. Ensure all oversight-related logs contain `[brAInwav]` and `brand:"brAInwav"` for audit search.

Failure to meet any item keeps the PR in a blocked state (`agents-guard` job).

---

## 5. Error Handling and Escalation

- **Server unreachable / health check fails:** stop work, mark the task blocked, and escalate per the Constitution. Do **not** bypass the gate without a formally recorded waiver under `/.cortexdx/waivers/`.
- **HTTP 406 or schema errors:** verify headers and ensure the plan contains numbered steps ≤ 7. Correct and retry.
- **Timeouts:** retry once after confirming server health; repeated timeouts require escalation.
- **Session resets:** if a `pnpm session:reset` run occurs, perform a new vibe check before resuming implementation.

---

## 6. Related Resources

- Runbook with troubleshooting scripts: `docs/runbooks/vibe-check.md`
- Governance reference: `/.cortexdx/rules/agentic-coding-workflow.md` §0.1 and §G5
- CLI helper source: `scripts/oversight/vibe-check-call.mjs`
- Oversight evidence index: `.cortexdx/audit/`

---
