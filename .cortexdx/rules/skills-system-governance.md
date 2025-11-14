---
title: "Skills System Governance"
description: "Standards and guidelines for creating, managing, and utilizing skills in brAInwav Cortex-OS"
version: "1.2.0"
maintainer: "brAInwav Development Team"
last_updated: "2025-11-11"
status: "authoritative"
applies_to: ["all agents", "all packages", "all skills"]
enforcement: "CI validation + supply-chain gating + code review"
standards_alignment:
  - ArcTDD v2025.11 (G0–G7)
  - Agentic Phase Policy (R→G→F→REVIEW)
  - Constitution v1.3.0
  - WCAG 2.2 AA (ISO/IEC 40500:2025)
  - W3C Trace Context + OpenTelemetry
  - CycloneDX 1.7 • SLSA v1.1 • Cosign v3 bundle
  - OIDC/WIF for CI/cloud auth
---

# Skills System Governance

**Authority**: This document is part of the Governance Pack (`/.cortexdx/rules/`) and is binding for all agent and human activities involving skills.

**Scope**: Standards for creating, validating, storing, discovering, applying, measuring, and retiring skills within the brAInwav Cortex-OS ecosystem.

---

## 0. Operative Guardrails (binding)

- **Structured Outputs (BLOCKER):** Any machine‑consumed output from a skill **must** conform to JSON‑Schema or tool/function calling. Free‑text is not a contract.
- **Trace Context (BLOCKER):** Skill application events include W3C `traceparent` and structured logs with `brand:"brAInwav"`, `trace_id` (32 lower‑hex).
- **Academic Research & Licensing (BLOCKER):** New/major‑updated skills must cite research and pass license validation; only SAFE/REVIEW content allowed.
- **Security by Default (BLOCKER):** No secrets in examples, no unsafe patterns; scanners must be clean (Semgrep ERROR=block, gitleaks ANY=block, OSV clean).
- **A11y Baseline:** Content examples meet WCAG 2.2 AA (ISO/IEC 40500:2025).
- **Identity & Supply Chain:** CI uses OIDC/WIF; skills tooling/artifacts use CycloneDX 1.7 SBOM + SLSA v1.1 provenance; Cosign v3 bundle verify logs attached.

**Evidence Tokens (CI‑scanned across PR/logs):**  
`STRUCTURED_OUTPUTS:OK` · `TRACE_CONTEXT:OK` · `SUPPLY_CHAIN:OK sbom=cyclonedx@1.7 slsa=1.1 cosign=bundle` · `A11Y_REPORT:OK` · `brAInwav-vibe-check` · `AGENTS_MD_SHA:*`

---

## 1. Purpose & Principles

### 1.1 Purpose

The Skills System provides structured reference knowledge that:

- Complements Local Memory (experiential)
- Increases compliance with best practices
- Accelerates agent proficiency
- Ensures consistency across implementations
- Captures and shares organizational knowledge

### 1.2 Core Principles

1. **Quality > Quantity** (curated, high‑signal skills)
2. **Evidence‑Based** (measured effectiveness with citations)
3. **Accessible** (clear, practical, inclusive)
4. **Measurable** (defined success criteria + telemetry)
5. **Ethical** (transparent, beneficial)
6. **Maintainable** (versioned, reviewed, retired when stale)
7. **Constitution‑Compliant** (brand logs, no mock prod claims)

---

## 2. Skill Lifecycle

### 2.1 Creation

**Who:** Humans, agents, or teams.

**Creation Requirements (all MUST):**

1. **Research Phase:** Summarize sources; record license checks.
2. **Validation Phase:** ≥ 5 successful applications (Local Memory evidence).
3. **Documentation Phase:** Fill template (frontmatter + structured sections).
4. **Review Phase:** Peer review for accuracy, ethics, security, a11y.
5. **Testing Phase:** Schema + content checks; security scanners clean.
6. **Approval Phase:** Merge only after gates pass (ArcTDD G0–G7).

**Required Evidence:**

- Local Memory entries (≥ 5) with outcomes and links
- Effectiveness rate ≥ 80% (initial), computed from application records
- Clear problem statement, solution approach, examples, and acceptance checks
- Research citations and license validation summary

### 2.2 Validation Standards

**Schema Validation (Automated, Zod/JSON‑Schema):**

```typescript
// @cortex-os/contracts SkillSchema (excerpt)
id: /^skill-[a-z0-9-]{3,}$/  // kebab-case with skill- prefix
name: string(3..100)
description: string(10..500)
content: string(50..50000)
version: semver
category: oneOf( "coding","security","testing","documentation","automation","communication","analysis","integration","observability" )
tags: string[1..20](1..50)
difficulty: oneOf("beginner","intermediate","advanced","expert")
estimatedTokens: int(1..10000)
persuasiveFraming?: { authority?: string[]; commitment?: string[]; scarcity?: string[]; socialProof?: string[]; reciprocity?: string[] }
citations?: { title: string; url: string; license: "SAFE"|"REVIEW" }[]
licenseSummary: { overall: "SAFE"|"REVIEW"; notes?: string }
successCriteria: string[1..20]
structuredOutputs:
  applicationRecordSchemaRef: "schemas/skill-application-record.schema.json" // REQUIRED
```

**Content Quality (Manual):**

- “When to Use”, “How to Apply” (stepwise), “Success Criteria”
- “Common Pitfalls” and “Examples” (runnable or verifiable)
- brAInwav branding included in outputs where appropriate
- Inclusive language; no dark patterns

**Security Validation (Automated):**

- Rejects SQL/command/path injection, hardcoded secrets, insecure shells
- Code blocks scanned by Semgrep; repo scanned by gitleaks/OSV

**Ethical Validation (Manual):**

- Facts cited; no manipulation; respects autonomy
- Claims marked `[Inference]`/`[Speculation]` if unproven

### 2.3 Storage

**Directory Structure:**

```text
skills/
├── README.md
├── schemas/skill-application-record.schema.json
├── examples/
├── coding/ security/ testing/ documentation/ automation/
├── communication/ analysis/ integration/ observability/
└── archived/
```

**File Naming:** `skill-{descriptive-name}.md` (kebab‑case); must match frontmatter `id`.

**Version Control:** semantic versioning; `deprecated: true` + `replacedBy` when retiring.

### 2.4 Discovery

**MCP Tooling (REQUIRED for agents):**

```typescript
// MCP tool contracts (JSON-Schema enforced)
skill_search(args: { query: string; category?: string; difficulty?: string; topK?: number; threshold?: number })
skill_get(args: { id: string })
skill_apply(args: { id: string; context: object }) -> returns { planSteps: string[]; outputs: object } // structured
```

**RAG Surface:** index skills; semantic search (Qdrant or equivalent); store vector config in repo.

### 2.5 Application

**Standard Flow:** Search → Read → Apply → Record → Link → Analyze.

**Structured Application Record (REQUIRED):**

```json
// schemas/skill-application-record.schema.json (excerpt)
{
  "type":"object",
  "required":["skillId","skillVersion","outcome","effectivenessScore","traceId","timestamp","brand"],
  "properties":{
    "skillId":{"type":"string"},
    "skillVersion":{"type":"string"},
    "outcome":{"enum":["success","partial","failure"]},
    "effectivenessScore":{"type":"number","minimum":0,"maximum":1},
    "traceId":{"type":"string","pattern":"^[0-9a-f]{32}$"},
    "timestamp":{"type":"string","format":"date-time"},
    "brand":{"const":"brAInwav"}
  }
}
```

**Local Memory Write (example):**

```javascript
memoryStore({
  content: "Applied skill-refactoring-guard-clauses to task-123. Outcome: success.",
  importance: 8,
  tags: ["skill-applied","skill-refactoring-guard-clauses","success"],
  metadata: {
    skillUsed: "skill-refactoring-guard-clauses",
    skillVersion: "1.2.0",
    outcome: "success",
    effectivenessScore: 0.9,
    traceparent: "<w3c-traceparent>",
    branding: "brAInwav"
  }
})
```

**Relationship Link:**

```javascript
relationships({
  relationship_type: "create",
  source_memory_id: "<outcome-memory-id>",
  target_memory_id: "skill-refactoring-guard-clauses",
  relationship_type_enum: "applies",
  strength: 0.0-1.0
})
```

### 2.6 Updates & Deprecation

- SemVer bump; update `last_updated`; document changes
- Breaking guidance → new skill + deprecate old (`deprecated: true`, `replacedBy`)
- Keep deprecated skills searchable but down‑ranked for 6 months, then archive

### 2.7 Retirement

Retire when: no usage in 12 months, effectiveness < 50%, replaced, or obsolete.

Process: mark deprecated → notify → archive (`skills/archived/`) → remove from indices.

---

## 3. Effectiveness Tracking

### 3.1 Metrics

- **Success Rate** (≥ 10 applications): `success/(success+partial+failure)`
- **Application Frequency** (≥ 1/month target)
- **Relationship Strength** (avg ≥ 0.7 target)
- **A/B or cohort deltas** (optional for optimization)

### 3.2 Gates & Remediation

- Falling below thresholds → review, update plan, or deprecate
- Track remediation in skill’s changelog; re‑validate effectiveness after changes

---

## 4. Persuasive Framing Standards

**Elements:** authority, commitment, scarcity, socialProof, reciprocity.
**Ethical Requirements (MUST):** honest, beneficial, cited, proportional, respectful.
**Stats:** If quantitative claims are used, provide citations; otherwise mark as `[Unverified]` and avoid numeric claims.

---

## 5. Integration with Cortex‑OS

### 5.1 Agentic Coding Workflow Touchpoints

- **Research:** reference skills + citations in `research/findings.md`
- **Planning:** include skill IDs in `implementation-plan.md`; add success criteria
- **Implementation:** apply guidance; store TDD progress with skill ID
- **Review:** verify success criteria met; deviations documented
- **Verification:** confirm gates; update effectiveness metrics
- **Archive:** write final metrics; link outcomes to skill

### 5.2 Testing Standards

- Adhere to `.cortexdx/rules/testing-standards.md`: coverage ≥90% global; ≥95% changed lines; mutation ≥90% (where enabled); performance budgets.

### 5.3 Code Style

- Follow `CODESTYLE.md`: named exports, ≤ 40 lines per function, async/await with cancellation, strict types, brAInwav branding.

---

## 6. CI/CD Integration

### 6.1 Automated Validation

```bash
pnpm skills:validate           # schema/frontmatter/structured outputs
pnpm skills:security-scan      # semgrep/gitleaks/osv on code blocks and repo
pnpm skills:parse-all          # index build
pnpm sbom:generate             # CycloneDX 1.7
pnpm attest:sign && pnpm verify:attest  # SLSA v1.1 + Cosign v3 bundle
```

### 6.2 Pre-commit Hooks

```bash
pnpm skills:validate --changed
pnpm skills:security-scan --changed
```

### 6.3 PR Requirements

1. Evidence links (Local Memory outcomes, ≥5 for new skills)
2. Peer review approval
3. Validator/scanner logs attached
4. README updates (if needed)
5. Changeset + release notes (if published package impacted)

---

## 7. Governance Enforcement

### 7.1 Review Checklist (must pass before merge)

- [ ] Schema validation passes
- [ ] Structured outputs present & validated
- [ ] Security scanners clean (Semgrep/gitleaks/OSV)
- [ ] Frontmatter complete and valid
- [ ] Content quality reviewed (When/How/Success/Pitfalls/Examples)
- [ ] Ethical framing and citations present
- [ ] brAInwav branding present in relevant examples
- [ ] Success criteria defined and testable
- [ ] Effectiveness evidence present (for new skills)
- [ ] Correct category/tags; version bumped; changelog entry

### 7.2 Metrics & Escalation

- Track pass rates for validators/scanners; target 100%
- Non‑compliance → block merge; repeated issues → access review (per Constitution)

---

## 8. Future Enhancements

- Analytics dashboard; skill recommendations; cross‑skill graphs
- A/B testing; multi‑language skills; automated extraction from patterns

---

## 9. References

- `skills/README.md`
- `AGENTS.md §24.1` (skills ops)
- `.cortexdx/rules/agentic-coding-workflow.md`
- `.cortexdx/rules/testing-standards.md`
- `.cortexdx/rules/CODESTYLE.md`
- `.cortexdx/rules/RULES_OF_AI.md`
- `@cortex-os/contracts/skill-events.ts`
- `packages/memory-core/src/skills/`

---

**Maintained by:** brAInwav Development Team
**Version:** 1.2.0
**Last Updated:** 2025-11-11
**Status:** Authoritative
