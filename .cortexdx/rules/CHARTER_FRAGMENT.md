# brAInwav ArcTDD Charter (Canonical Fragment)

**Status:** MANDATORY - Must be included in ALL agent instruction files  
**Enforcement:** CI validates presence via SHA-256 checksum  
**Last Updated:** 2025-10-29
**Version:** 2.1.1

---

## ⚡ **OPERATIVE GUARDRAILS** (Non-Negotiable)

All agents executing workstreams within Cortex-OS MUST obey these rules:

### 1️⃣ **Step Budget ≤ 7**

- Each execution arc MUST complete within **seven discrete plan/act iterations**
- Larger efforts MUST be split into multiple arcs
- **Enforcement**: `run-manifest.json` validation blocks merge if `arc.plan_steps.length > 7`
- **Runtime Check**: Phase machine rejects arcs exceeding budget

### 2️⃣ **Ask-First ≤ 3**

- Agents MAY ask at most **three clarifying questions** before writing code
- Each question MUST enumerate **concrete options and consequences**
- **Format**: "Choice: (A) option1 [consequence]; (B) option2 [consequence]; (C) option3 [consequence]"
- **Enforcement**: Interaction counter logs violations; coordinator blocks 4th question

### 3️⃣ **Explain-While-Doing**

- Narrate intent alongside actions in commits, diffs, and task logs
- Enable reviewers to audit rationale without context-switching
- **Enforcement**: Narrated diffs required in PR body (CI checks for presence)

### 4️⃣ **Proof Required**

- Every behavioral change MUST ship with **executable proof**:
  - ✅ Failing test first (red)
  - ✅ Passing test after (green)
  - ✅ Mutation or property evidence when applicable
- **Evidence Triplet** mandatory per arc:
  1. Milestone test path (red→green proof)
  2. Contract snapshot (types/schema/route)
  3. Reviewer JSON pointer
- **Enforcement**: CI blocks merge if Evidence Triplet incomplete

### 5️⃣ **Recap in ≤ 500 Tokens**

- Close each arc with structured recap:
  - Scope, decisions, tests, follow-ups
  - Written to `evidence/recaps.log`
- **Enforcement**: Token counter validates; excess triggers warning

### 6️⃣ **Brand Logs**

- Runtime and workflow logs MUST include both a **human-readable prefix** and a **structured JSON log** per line:
  - Text prefix: `[brAInwav]`
  - JSON fields:  
    `brand:"brAInwav"`, ISO-8601 timestamp with timezone, `trace_id` (32 lowercase hex), and the **HTTP `traceparent`** value captured at ingress/egress.
- OPA/Conftest policies enforce the following tokens in every charter-governed log line:
  - `MODELS:LIVE:OK` when model health passes
  - Latency markers (e.g., `LATENCY:123ms` or structured JSON `latency_ms` field)
  - ISO-8601 timestamps with timezone offset
  - `NORTH_STAR:RED_FIRST` for the initial failing acceptance execution
  - `NORTH_STAR:GREEN_AFTER` once the acceptance turns green
- First failing acceptance must log `marker:"NORTH_STAR:RED_FIRST"`, passing acceptance `marker:"NORTH_STAR:GREEN_AFTER"`.
- Emit `model_status:"MODELS:LIVE:OK"` **only** after live health checks succeed.
- **Enforcement**: Grep validation in CI; missing brand fails build

**Example JSON log**

```json
{
  "timestamp":"2025-11-10T19:22:11.402-07:00",
  "brand":"brAInwav",
  "trace_id":"3f0a2dbe4c2a4f71a7c1c3b50d1a0c9e",
  "traceparent":"00-3f0a2dbe4c2a4f71a7c1c3b50d1a0c9e-9a1c7b2d3e4f5678-01",
  "marker":"NORTH_STAR:RED_FIRST",
  "model_status":"MODELS:LIVE:OK",
  "latency_ms":742,
  "message":"Acceptance failed as expected"
}
```

```text
[brAInwav] 2025-10-28T19:22:11.402-07:00 LATENCY:742ms MODELS:LIVE:OK NORTH_STAR:RED_FIRST Acceptance failed as expected
```

Swap to `NORTH_STAR:GREEN_AFTER` once the acceptance passes; never emit `MODELS:LIVE:OK` unless model health succeeded.

**Failure Response**: Misconfigured wrappers or partial rollouts must be rolled back; incident hotfixes require waivers capped at 24 hours to restore instrumentation. Monitor CI Conftest output and observability counters for missing `NORTH_STAR:` or `LATENCY:` tokens.

### 7️⃣ **Arc Protocol**

- Implementations MUST be organized into discrete **arcs** (vertical slices)
- Each arc MUST:
  - Deliver ≤ 7 steps (see Guardrail #1)
  - Span 2–5 commits and 45–120 minutes end-to-end
  - Produce a **milestone test** (red → green proof)
  - Freeze its contract (types/schema/route) before implementation
  - Include a contract snapshot in `design/contracts/`
- **Enforcement**: `run-manifest.json` schema validates arc structure; CI blocks merge if arc lacks milestone test or contract snapshot

### 8️⃣ **North-Star Acceptance Test**

- Every task MUST define a **North-Star acceptance test** before implementation begins
- Test MUST:
  - Prove the feature is real (Gherkin, HTTP contract, or executable spec)
  - Be written in `tests/acceptance/<slug>.spec.[ts|js|py|http]`
  - Fail initially, pass upon task completion
- **Enforcement**: `run-manifest.json` requires `north_star.acceptance_test_path`; CI blocks merge if path missing or test not executable

### 9️⃣ **Preflight Guards**

- Before any file writes, network calls, or long executions, agents MUST execute **preflight guards**:
  1. **Vibe Check (Oversight)** – `pnpm oversight:vibe-check` or JSON-RPC to `${VIBE_CHECK_HTTP_URL}`; log saved to `logs/vibe-check/<task>.json`
  2. **Hybrid Model Health** – `pnpm models:health && pnpm models:smoke` with live MLX/Ollama/Frontier engines (no stubs)
  3. **Knowledge Connector Health** – Verify `${WIKIDATA_MCP_URL}/healthz` and `${ARXIV_MCP_URL}/healthz`; log to `research/connectors-health.log`
  4. **Trace Context Verification** – `pnpm tsx scripts/ci/verify-trace-context.ts <logfile>` ensures W3C `trace_id` and `traceparent` in all logs
  5. **Supply-Chain Evidence** – `pnpm sbom:generate` (CycloneDX **1.7**) → `pnpm attest:sign` (SLSA **v1.1**) → `pnpm verify:attest` (Cosign **v3 bundle**); store in `sbom/`
  6. **Identity Gate** – CI/services MUST use GitHub Actions OIDC/WIF (no static credentials)
  7. **Feature Flags** – OpenFeature only; ad-hoc toggles prohibited
  8. **HTTP Cancellation** – All HTTP/tool calls must support `AbortSignal` or SDK equivalent
- **Run Manifest Requirements**: `run-manifest.json` MUST include JSON pointers for each attached log artifact **and** persist the raw text submitted to policy helpers so OPA/Conftest inputs remain reproducible.
- **Enforcement**: PR MUST attach preflight logs (vibe-check, model health, connector health, trace verification with `traceparent`, SBOM attestation); missing logs block merge

**Manifest Pointers**

```json
{"log_evidence":[{"pointer":"/preflight/logs/0","artifact_path":"logs/vibe-check/arc-17.json","raw_text":"[brAInwav] 2025-10-28T19:22:11.402-07:00 LATENCY:742ms MODELS:LIVE:OK NORTH_STAR:RED_FIRST Acceptance failed as expected"}]}
```

Every entry MUST include `pointer`, `artifact_path`, and byte-identical `raw_text`; include hashes when practical. Validate with Conftest + a manifest script (`pnpm policy:validate`) in CI and locally.

### 🔟 **Session Hygiene**

- Agents MUST reset session context periodically to prevent drift:
  - **Cadence**: 50 minutes build / 10 minutes reset
  - **Context Diet**: Last 2 plan bullets + current failing test + current file + manifest summary only
  - **Hard Reset Triggers**:
    - 2 off-spec suggestions in a row
    - ≥ 3 speculative edits without tests
    - Proposes renaming core interfaces mid-arc
- Session resets MUST be logged in `run-manifest.json` with ISO-8601 timestamps
- **Enforcement**: CI warns if `session_resets` array empty and task duration > 60 minutes; reviewers verify reset discipline

---

## 🔒 **ENFORCEMENT MECHANISMS**

| Guardrail | Detection | Prevention | Recovery |
|-----------|-----------|------------|----------|
| Step Budget | `validate-run-manifest.ts` | Phase machine rejects | Split into new arc |
| Ask-First | Interaction logs | Coordinator blocks 4th Q | Document assumption |
| Explain-While-Doing | `narrated-diff.ts` check | PR template requires | Request amendment |
| Proof Required | CI Evidence Triplet check | Template scaffolds tests | Add retroactive proof |
| Recap Rule | Token counter | Template auto-generates | Trim to ≤500 tokens |
| Brand Logs | `grep -r 'brand.*brAInwav'` | Logger wrapper | Patch log calls |
| Arc Protocol | `validate-run-manifest.ts` (arc structure, milestone test, contract snapshot) | Task scaffolding enforces arc template | Add missing arc artifacts |
| North-Star Test | `validate-run-manifest.ts` (`north_star.acceptance_test_path` required) | `pnpm changelog:new` generates acceptance test scaffold | Write missing north-star test |
| Preflight Guards | CI checks for `logs/vibe-check/*.json`, model health logs, trace context, SBOM | PR template checklist requires preflight evidence | Execute missing guards and attach logs |
| Session Hygiene | `run-manifest.json` `session_resets` timestamps; reviewer audit | 10-minute reset hook calls `pnpm session:reset` | Log retrospective resets with justification |

---

## 📋 **QUICK REFERENCE**

**Before starting any task:**

```bash
pnpm changelog:new --slug my-feature --tier feature  # Scaffolds charter-compliant structure + north-star test
pnpm oversight:vibe-check --goal "<task>" --plan "<steps>" --session <id>  # Preflight guard
pnpm models:health && pnpm models:smoke  # Verify live model engines
```

**During implementation:**

```bash
pnpm arc:new --slug my-feature --title "Arc 1: API boundary"  # Max 7 steps enforced
pnpm session:reset --slug my-feature  # At 50-minute mark
```

**Before committing:**

```bash
pnpm charter:validate  # Runs all charter compliance checks
pnpm tsx scripts/ci/verify-trace-context.ts logs/dev.log  # Verify W3C trace_id
pnpm sbom:generate && pnpm attest:sign && pnpm verify:attest  # Supply-chain evidence
```

**In PR:**

- Attach Evidence Triplet links (milestone test, contract snapshot, reviewer JSON)
- Include narrated diff in body
- Attach preflight logs: `logs/vibe-check/*.json`, model health output, connector health log, SBOM attestation
- Reference `CHARTER_SHA256: 1c8cbc194209f690ae9fd015c04223a1c619853190d6302a5ccfea6769ceac5f` in description

---

## 🔗 **CANONICAL REFERENCE**

This fragment is authoritative. Any conflicts defer to:

1. `/.cortexdx/rules/AGENT_CHARTER.md` (full specification)
2. `/.cortexdx/rules/agentic-coding-workflow.md` (workflow integration and task lifecycle)
3. `/.cortexdx/rules/code-review-checklist.md` (verification)

**Workflow Integration Notes:**

- The full task lifecycle (gates G0–G10) is governed by `agentic-coding-workflow.md`
- Workflow MAY define task tiers (fix/feature/refactor) with differentiated gate requirements, provided all tiers enforce these core guardrails
- Waivers policy detailed in lines 115–124 below

**Fragment SHA-256:** `3289664bc8ba94bec3d1418292b76558bcf2ec0eb974e7317f2fb437b5848067`
**Fragment Path:** `/.cortexdx/rules/CHARTER_FRAGMENT.md`

---

**⚠️ DEVIATION POLICY**

Waivers require **Maintainer approval** under `/.cortexdx/waivers/`. All deviations must:

- Document justification with evidence
- Specify compensation controls
- Set expiration date (max 30 days)
- Link to remediation plan
- **Waiver Activation Rule:** A charter waiver is valid only after the `charter-enforce / danger` job posts ✅ with a link to the `Apply Waiver` workflow run that recorded Maintainer approval.
- **Emergency Waiver Sync:** If `charter-enforce / danger` or Apply Waiver automation is unavailable, mark the waiver **provisional**, document manual Maintainer approval + compensating controls in `/.cortexdx/waivers/<id>.md`, and pause merges unless escalation is documented. Once automation is restored, re-run the Apply Waiver workflow, re-trigger Danger until the comment links to that run, and add a post-incident note referencing the workflow URL and recovery timestamp.

**Reviewer Guidance:**

- "Red first" waivers (Guardrail #4) are acceptable only when a production incident blocks execution of a failing acceptance test. Waivers MUST capture validated reproduction evidence and include a follow-up task restoring the red-first proof within 24 hours.
- Connector freshness waivers (Preflight Guard #3) MAY be approved during documented upstream outages when cached telemetry and timestamps are attached. These waivers expire within 72 hours and require explicit reviewer sign-off on compensating controls.

Unapproved deviations are **constitutional violations** and will block merge.

**Connector Freshness Waiver (Sample)**

```yaml
waiver_id: WAIVER-2025-10-28-connector-outage
rule_ids: [AGENTS-PRV-009]
approver: @maintainer-handle
requested_by: @oncall-engineer
expiry: 2025-10-30T19:00:00Z
reason: Wikidata outage blocked live freshness probes; serving cached data timestamped 2025-10-28T18:55:00Z.
compensation_controls:
  - Validated cache checksum (sha256:3b5d5c3712955042212316173ccf37be)
  - Read-only feature flag `connectors.wikidata.read_only`
evidence_required:
  - research/connectors/wikidata-cache-2025-10-28.json
  - docs/incidents/INC-4721-status-page.pdf
  - json/run-manifest.json#/log_evidence/2
remediation_plan:
  tasks:
    - task_slug: restore-wikidata-freshness
      deadline: 2025-10-29T19:00:00Z
```
