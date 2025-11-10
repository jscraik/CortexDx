# Vibe Check Oversight Gate — CortexDx MCP Governance

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

Before running vibe check, all implementation plans MUST be enhanced with academic research and validated for license compliance by using the academic MCP providers that ship with CortexDx (Wikidata, arXiv, Semantic Scholar, OpenAlex, Context7, EXA, Vibe Check). Invoke the tool definitions in `packages/cortexdx/src/tools/academic-integration-tools.ts` via your preferred MCP client (CortexDx CLI, `curl`, or another MCP-aware agent), capture the JSON-RPC transcripts, and store them under `~/.cortexdx/tasks/<slug>/logs/academic-research/`. A minimal example using `validate_architecture_academic`:

```bash
curl -s ${ACADEMIC_MCP_URL:-http://127.0.0.1:3029}/mcp \
  -H 'Content-Type: application/json' \
  -d '{
        "jsonrpc":"2.0",
        "id":"acad-001",
        "method":"tools/call",
        "params":{
          "name":"validate_architecture_academic",
          "arguments":{
            "architectureSpec":"<plan summary>",
            "researchDomains":["distributed systems","security"],
            "includeLicenseValidation":true,
            "checkCodeQuality":true
          }
        }
      }' \
  | tee ~/.cortexdx/tasks/<slug>/logs/academic-research/validate_architecture_academic.json
```

**Research Requirements:**

- **Wikidata Vector Search**: Query relevant entities, properties, and relationships (Port 3029)
- **arXiv Semantic Search**: Find recent papers and technical approaches (Port 3041)
- **Semantic Scholar**: Identify proven solutions and highly-cited approaches (HTTP API)
- **OpenAlex**: Discover broad research patterns and collaborations (HTTP API)
- **Context7**: Access domain-specific knowledge and best practices (HTTP API client with caching)

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

### 3.1 CLI Shortcut

Use the bundled Vibe Check MCP provider at `${VIBE_CHECK_HTTP_URL:-http://127.0.0.1:2091}` (tools `vibe_check`, `vibe_learn`). Submit a `tools/call` request containing the current goal, ≤7-step plan, academic evidence pointers, and OWASP LLM control mapping; save the JSON response under `~/.cortexdx/tasks/<slug>/logs/vibe-check/<session-id>.json`. A `curl` invocation identical to the JSON-RPC example in §3.3 is sufficient; CLI wrappers are optional as long as the stored transcript shows the provider’s approval.

**Parameters:**

- `--goal` — concise task objective (≤ 140 chars).
- `--plan` — ordered steps (≤ 7, numbered). Use `--plan-file` to stream from disk. Link each step to the relevant control ID(s) from `/.cortexdx/rules/llm-threat-controls.md` when elevated risk is identified.
- `--session` — stable identifier (task slug + timestamp is recommended).
- `--save` — required; stores canonical JSON under `logs/vibe-check/` in the task directory.
- `--with-academic-research` — automatically runs academic research queries to enhance the plan
- `--validate-licenses` — enables license validation for academic content (mandatory)
- `--risk-threshold` — maximum allowed risk level (default: review)
- The script automatically sets `Accept: application/json, text/event-stream` and emits the `brAInwav-vibe-check` log marker.

**Enhanced Plan Format with Research Integration:**

```text
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

The Vibe Check MCP server is now included in the CortexDx MCP monorepo:

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
